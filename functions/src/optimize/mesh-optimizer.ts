/**
 * Core mesh optimization module
 *
 * Orchestrates the mesh optimization pipeline:
 * 1. Simplification with gltfpack
 * 2. Repair with trimesh (fill holes, fix normals, watertight)
 * 3. Scaling to target size or print bed
 *
 * All operations happen in a temp directory to avoid conflicts.
 */

import * as path from 'path';
import * as fs from 'fs/promises';
import * as os from 'os';
import { v4 as uuidv4 } from 'uuid';
import { runGltfpack, type GltfpackOptions } from './gltfpack-runner';
import {
  runTrimeshOptimize,
  analyzeMesh,
  isTrimeshAvailable,
  type TrimeshOptions,
  type MeshStats,
} from './trimesh-runner';

export interface SimplifyOptions {
  enabled: boolean;
  /** Target ratio 0.1 - 1.0 (e.g., 0.5 = 50% of original faces) */
  targetRatio?: number;
  /** Preserve mesh topology by locking border vertices */
  preserveTopology?: boolean;
}

export interface RepairOptions {
  enabled: boolean;
  /** Fill holes in the mesh */
  fillHoles?: boolean;
  /** Fix inconsistent normals */
  fixNormals?: boolean;
  /** Attempt more aggressive watertight repair */
  makeWatertight?: boolean;
}

export interface ScaleOptions {
  enabled: boolean;
  /** Target size in mm (uses min scale to maintain aspect ratio) */
  targetSize?: {
    width?: number;
    height?: number;
    depth?: number;
  };
  /** Uniform scale factor */
  uniformScale?: number;
  /** Auto-fit to print bed with 5% margin */
  printBedSize?: {
    width: number;
    height: number;
    depth: number;
  };
}

export interface OptimizationOptions {
  simplify?: SimplifyOptions;
  repair?: RepairOptions;
  scale?: ScaleOptions;
  /** Output format (default: glb) */
  outputFormat?: 'glb' | 'stl';
}

export interface OptimizationPreview {
  original: MeshStats;
  optimized: MeshStats;
  reductionPercent: number;
  operations: string[];
  warnings: string[];
}

export interface OptimizationResult {
  success: boolean;
  buffer?: Buffer;
  preview: OptimizationPreview;
  error?: string;
}

/**
 * Create a unique temporary directory for optimization
 */
async function createTempDirectory(): Promise<string> {
  const tempBase = os.tmpdir();
  const tempDir = path.join(tempBase, `mesh-optimize-${uuidv4()}`);
  await fs.mkdir(tempDir, { recursive: true });
  return tempDir;
}

/**
 * Clean up temporary directory
 */
async function cleanupTempDirectory(tempDir: string): Promise<void> {
  try {
    await fs.rm(tempDir, { recursive: true, force: true });
  } catch {
    // Ignore cleanup errors
  }
}

/**
 * Run the full mesh optimization pipeline
 *
 * @param inputBuffer - Input GLB file buffer
 * @param options - Optimization options
 * @returns Optimized mesh buffer and preview stats
 */
export async function optimizeMesh(
  inputBuffer: Buffer,
  options: OptimizationOptions
): Promise<OptimizationResult> {
  const tempDir = await createTempDirectory();
  const operations: string[] = [];
  const warnings: string[] = [];

  try {
    // Write input to temp file
    const inputPath = path.join(tempDir, 'input.glb');
    await fs.writeFile(inputPath, inputBuffer);

    // Get original stats (may fail if Python not available)
    const trimeshAvailable = await isTrimeshAvailable();
    let originalStats: MeshStats;

    if (trimeshAvailable) {
      const originalAnalysis = await analyzeMesh(inputPath);
      if (originalAnalysis.success && originalAnalysis.analysis) {
        originalStats = {
          vertexCount: originalAnalysis.analysis.vertexCount,
          faceCount: originalAnalysis.analysis.faceCount,
          boundingBox: originalAnalysis.analysis.boundingBox,
          isWatertight: originalAnalysis.analysis.isWatertight,
          volume: originalAnalysis.analysis.volume,
        };
      } else {
        warnings.push('Mesh analysis failed, proceeding with optimization');
        originalStats = {
          vertexCount: 0,
          faceCount: 0,
          boundingBox: { width: 0, height: 0, depth: 0 },
          isWatertight: false,
          volume: null,
        };
      }
    } else {
      // Python not available - proceed without detailed stats
      warnings.push('Full mesh analysis unavailable (Python not installed). Simplification still works.');
      originalStats = {
        vertexCount: 0,
        faceCount: 0,
        boundingBox: { width: 0, height: 0, depth: 0 },
        isWatertight: false,
        volume: null,
      };
    }

    let currentPath = inputPath;

    // Step 1: Simplification with gltfpack
    if (options.simplify?.enabled) {
      const simplifiedPath = path.join(tempDir, 'simplified.glb');
      const gltfpackOptions: GltfpackOptions = {
        simplifyRatio: options.simplify.targetRatio || 0.5,
        preserveTopology: options.simplify.preserveTopology !== false,
      };

      const simplifyResult = await runGltfpack(currentPath, simplifiedPath, gltfpackOptions);

      if (simplifyResult.success) {
        currentPath = simplifiedPath;
        operations.push(`simplify:${Math.round((1 - gltfpackOptions.simplifyRatio) * 100)}%`);
        if (simplifyResult.stats) {
          operations.push(`size_reduction:${simplifyResult.stats.reductionPercent}%`);
        }
      } else {
        warnings.push(`Simplification skipped: ${simplifyResult.error}`);
      }
    }

    // Step 2: Repair and scale with trimesh
    if (options.repair?.enabled || options.scale?.enabled) {
      // Check if trimesh (Python) is available
      const trimeshAvailable = await isTrimeshAvailable();
      if (!trimeshAvailable) {
        warnings.push('Mesh repair/scaling skipped: Python environment not available. Only simplification is supported.');
        // Skip to next step
      } else {
      const outputFormat = options.outputFormat || 'glb';
      const repairedPath = path.join(tempDir, `repaired.${outputFormat}`);

      const trimeshOptions: TrimeshOptions = {
        fillHoles: options.repair?.fillHoles !== false,
        fixNormals: options.repair?.fixNormals !== false,
        makeWatertight: options.repair?.makeWatertight !== false,
        centerMesh: true,
        targetSize: options.scale?.targetSize,
        uniformScale: options.scale?.uniformScale,
        printBedSize: options.scale?.printBedSize,
      };

      const repairResult = await runTrimeshOptimize(currentPath, repairedPath, trimeshOptions);

      if (repairResult.success) {
        currentPath = repairedPath;

        // Add operations from trimesh
        if (repairResult.operations) {
          operations.push(...repairResult.operations);
        }
        if (repairResult.warnings) {
          warnings.push(...repairResult.warnings);
        }
      } else {
        warnings.push(`Repair skipped: ${repairResult.error}`);
      }
      } // Close else block for trimeshAvailable check
    }

    // Step 3: Final format conversion if needed
    const outputFormat = options.outputFormat || 'glb';
    let finalPath = currentPath;

    if (outputFormat === 'stl' && !currentPath.endsWith('.stl')) {
      // Check if trimesh is available for STL conversion
      const trimeshAvailable = await isTrimeshAvailable();
      if (trimeshAvailable) {
        // Use trimesh to convert to STL
        const stlPath = path.join(tempDir, 'output.stl');
        const convertResult = await runTrimeshOptimize(currentPath, stlPath, {
          fillHoles: false,
          fixNormals: false,
          makeWatertight: false,
          centerMesh: false,
        });

        if (convertResult.success) {
          finalPath = stlPath;
          operations.push('convert:stl');
        } else {
          warnings.push(`STL conversion failed: ${convertResult.error}`);
        }
      } else {
        warnings.push('STL conversion unavailable: Python environment not available. Returning GLB format.');
      }
    }

    // Get optimized stats
    const optimizedAnalysis = await analyzeMesh(finalPath);
    const optimizedStats: MeshStats = optimizedAnalysis.success && optimizedAnalysis.analysis
      ? {
          vertexCount: optimizedAnalysis.analysis.vertexCount,
          faceCount: optimizedAnalysis.analysis.faceCount,
          boundingBox: optimizedAnalysis.analysis.boundingBox,
          isWatertight: optimizedAnalysis.analysis.isWatertight,
          volume: optimizedAnalysis.analysis.volume,
        }
      : originalStats;

    // Read final output
    const outputBuffer = await fs.readFile(finalPath);

    // Calculate reduction
    const reductionPercent =
      originalStats.faceCount > 0
        ? Math.round(
            ((originalStats.faceCount - optimizedStats.faceCount) / originalStats.faceCount) * 100
          )
        : 0;

    return {
      success: true,
      buffer: outputBuffer,
      preview: {
        original: originalStats,
        optimized: optimizedStats,
        reductionPercent: Math.max(0, reductionPercent),
        operations,
        warnings,
      },
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error during optimization',
      preview: {
        original: {
          vertexCount: 0,
          faceCount: 0,
          boundingBox: { width: 0, height: 0, depth: 0 },
          isWatertight: false,
          volume: null,
        },
        optimized: {
          vertexCount: 0,
          faceCount: 0,
          boundingBox: { width: 0, height: 0, depth: 0 },
          isWatertight: false,
          volume: null,
        },
        reductionPercent: 0,
        operations,
        warnings: [error instanceof Error ? error.message : 'Unknown error'],
      },
    };
  } finally {
    await cleanupTempDirectory(tempDir);
  }
}

/**
 * Analyze a mesh without modifying it
 * Note: Full analysis requires Python/Trimesh. If unavailable, returns basic info.
 */
export async function getMeshAnalysis(
  inputBuffer: Buffer
): Promise<{
  success: boolean;
  analysis?: MeshStats & { issues: string[]; recommendations: string[]; printabilityScore: number };
  error?: string;
}> {
  // Check if Python/Trimesh is available
  const trimeshAvailable = await isTrimeshAvailable();
  if (!trimeshAvailable) {
    // Return basic analysis based on file size only
    // TODO: Add pure JS GLB parser for basic mesh stats
    return {
      success: true,
      analysis: {
        vertexCount: 0, // Unknown without Python
        faceCount: 0,
        boundingBox: { width: 0, height: 0, depth: 0 },
        isWatertight: false,
        volume: null,
        issues: ['Full analysis unavailable: Python environment not available'],
        recommendations: ['Mesh simplification is still available'],
        printabilityScore: 3, // Unknown, default to middle score
      },
    };
  }

  const tempDir = await createTempDirectory();

  try {
    const inputPath = path.join(tempDir, 'analyze.glb');
    await fs.writeFile(inputPath, inputBuffer);

    const result = await analyzeMesh(inputPath);

    if (result.success && result.analysis) {
      return {
        success: true,
        analysis: result.analysis,
      };
    }

    return {
      success: false,
      error: result.error || 'Analysis failed',
    };
  } finally {
    await cleanupTempDirectory(tempDir);
  }
}

/**
 * Preview optimization without actually modifying (dry run with analysis)
 */
export async function previewOptimization(
  inputBuffer: Buffer,
  options: OptimizationOptions
): Promise<{
  success: boolean;
  preview?: {
    original: MeshStats & { issues: string[]; recommendations: string[] };
    estimatedOptimized: {
      faceCount: number;
      isWatertight: boolean;
    };
    estimatedReductionPercent: number;
  };
  error?: string;
}> {
  const analysis = await getMeshAnalysis(inputBuffer);

  if (!analysis.success || !analysis.analysis) {
    return {
      success: false,
      error: analysis.error || 'Failed to analyze mesh',
    };
  }

  // Estimate optimization results
  const targetRatio = options.simplify?.enabled ? options.simplify.targetRatio || 0.5 : 1.0;
  const estimatedFaceCount = Math.round(analysis.analysis.faceCount * targetRatio);
  const willBeWatertight =
    analysis.analysis.isWatertight ||
    Boolean(options.repair?.enabled && options.repair.makeWatertight !== false);

  return {
    success: true,
    preview: {
      original: analysis.analysis,
      estimatedOptimized: {
        faceCount: estimatedFaceCount,
        isWatertight: willBeWatertight,
      },
      estimatedReductionPercent: Math.round((1 - targetRatio) * 100),
    },
  };
}

// Re-export types for convenience
export type { MeshStats } from './trimesh-runner';
