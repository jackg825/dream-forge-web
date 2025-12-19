/**
 * Trimesh Python Cloud Function client
 *
 * Calls the Python Gen 2 Cloud Functions for mesh operations:
 * - Analyze mesh for issues (holes, inverted normals, etc.)
 * - Repair mesh (fill holes, fix normals, make watertight)
 * - Scale mesh to target size or fit print bed
 *
 * @see https://trimesh.org/
 */

import axios from 'axios';

// Python Cloud Function URLs (Gen 2)
// These are deployed to asia-east1 region
const PYTHON_FUNCTION_BASE_URL = process.env.PYTHON_FUNCTION_URL ||
  'https://asia-east1-dreamforge-66998.cloudfunctions.net';

const TRIMESH_ANALYZE_URL = `${PYTHON_FUNCTION_BASE_URL}/trimesh_analyze`;
const TRIMESH_OPTIMIZE_URL = `${PYTHON_FUNCTION_BASE_URL}/trimesh_optimize`;

export interface TrimeshRepairOptions {
  /** Fill holes in the mesh */
  fillHoles?: boolean;
  /** Fix inconsistent normals */
  fixNormals?: boolean;
  /** Attempt to make mesh watertight (more aggressive repair) */
  makeWatertight?: boolean;
  /** Center mesh and place on ground plane */
  centerMesh?: boolean;
}

export interface TrimeshScaleOptions {
  /** Target dimensions in mm (maintains aspect ratio using min scale) */
  targetSize?: {
    width?: number;
    height?: number;
    depth?: number;
  };
  /** Uniform scale factor */
  uniformScale?: number;
  /** Auto-fit to print bed size (with 5% margin) */
  printBedSize?: {
    width: number;
    height: number;
    depth: number;
  };
}

export interface TrimeshOptions extends TrimeshRepairOptions, TrimeshScaleOptions {}

export interface MeshStats {
  vertexCount: number;
  faceCount: number;
  boundingBox: {
    width: number;
    height: number;
    depth: number;
  };
  isWatertight: boolean;
  volume: number | null;
  center?: number[];
}

export interface MeshAnalysis extends MeshStats {
  issues: string[];
  recommendations: string[];
  printabilityScore: number;
  holeCount?: number;
}

export interface TrimeshResult {
  success: boolean;
  original?: MeshStats;
  optimized?: MeshStats;
  operations?: string[];
  warnings?: string[];
  issues?: string[];
  recommendations?: string[];
  error?: string;
  outputFormat?: string;
  buffer?: Buffer;
}

export interface TrimeshAnalysisResult {
  success: boolean;
  analysis?: MeshAnalysis;
  error?: string;
}

/**
 * Check if Python Cloud Functions are available
 * For Gen 2 Cloud Functions, we assume they're available after deployment
 */
export async function isTrimeshAvailable(): Promise<boolean> {
  try {
    // Simple health check - try to reach the function
    const response = await axios.get(TRIMESH_ANALYZE_URL, {
      timeout: 5000,
      validateStatus: () => true, // Accept any status
    });
    // Function exists if we get any response (even 405 for wrong method)
    return response.status !== 404;
  } catch {
    return false;
  }
}

/**
 * Run trimesh optimization via Python Cloud Function
 */
export async function runTrimeshOptimize(
  inputPath: string,
  outputPath: string,
  options: TrimeshOptions
): Promise<TrimeshResult> {
  // This function is kept for backwards compatibility
  // For new code, use optimizeMeshBuffer directly
  const fs = await import('fs/promises');

  try {
    const inputBuffer = await fs.readFile(inputPath);
    const result = await optimizeMeshBuffer(inputBuffer, options);

    if (result.success && result.buffer) {
      await fs.writeFile(outputPath, result.buffer);
    }

    return result;
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to optimize mesh',
    };
  }
}

/**
 * Optimize a mesh buffer via Python Cloud Function
 */
export async function optimizeMeshBuffer(
  inputBuffer: Buffer,
  options: TrimeshOptions,
  outputFormat: 'glb' | 'stl' = 'glb'
): Promise<TrimeshResult> {
  try {
    const response = await axios.post(
      TRIMESH_OPTIMIZE_URL,
      {
        file_data: inputBuffer.toString('base64'),
        options: {
          fill_holes: options.fillHoles !== false,
          fix_normals: options.fixNormals !== false,
          make_watertight: options.makeWatertight !== false,
          center_mesh: options.centerMesh !== false,
          target_size: options.targetSize || null,
          uniform_scale: options.uniformScale || null,
          print_bed_size: options.printBedSize || null,
        },
        output_format: outputFormat,
      },
      {
        timeout: 300000, // 5 minutes
        headers: {
          'Content-Type': 'application/json',
        },
      }
    );

    const data = response.data;

    if (!data.success) {
      return {
        success: false,
        error: data.error || 'Optimization failed',
      };
    }

    return {
      success: true,
      original: data.original ? convertStats(data.original) : undefined,
      optimized: data.optimized ? convertStats(data.optimized) : undefined,
      operations: data.operations || [],
      warnings: data.warnings || [],
      outputFormat: data.output_format,
      buffer: data.file_data ? Buffer.from(data.file_data, 'base64') : undefined,
    };
  } catch (error) {
    if (axios.isAxiosError(error)) {
      if (error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND') {
        return {
          success: false,
          error: 'Python Cloud Function not available. Please deploy functions-python.',
        };
      }
      return {
        success: false,
        error: error.response?.data?.error || error.message,
      };
    }
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Analyze a mesh via Python Cloud Function
 */
export async function analyzeMesh(inputPath: string): Promise<TrimeshAnalysisResult> {
  const fs = await import('fs/promises');

  try {
    const inputBuffer = await fs.readFile(inputPath);
    return await analyzeMeshBuffer(inputBuffer);
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to read file',
    };
  }
}

/**
 * Analyze a mesh buffer via Python Cloud Function
 */
export async function analyzeMeshBuffer(inputBuffer: Buffer): Promise<TrimeshAnalysisResult> {
  try {
    const response = await axios.post(
      TRIMESH_ANALYZE_URL,
      {
        file_data: inputBuffer.toString('base64'),
      },
      {
        timeout: 120000, // 2 minutes
        headers: {
          'Content-Type': 'application/json',
        },
      }
    );

    const data = response.data;

    if (!data.success) {
      return {
        success: false,
        error: data.error || 'Analysis failed',
      };
    }

    return {
      success: true,
      analysis: {
        vertexCount: data.analysis.vertex_count,
        faceCount: data.analysis.face_count,
        boundingBox: data.analysis.bounding_box,
        isWatertight: data.analysis.is_watertight,
        volume: data.analysis.volume,
        issues: data.analysis.issues || [],
        recommendations: data.analysis.recommendations || [],
        printabilityScore: data.analysis.printability_score || 3,
      },
    };
  } catch (error) {
    if (axios.isAxiosError(error)) {
      if (error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND') {
        return {
          success: false,
          error: 'Python Cloud Function not available. Please deploy functions-python.',
        };
      }
      return {
        success: false,
        error: error.response?.data?.error || error.message,
      };
    }
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Repair and scale a mesh buffer
 */
export async function repairMesh(
  inputBuffer: Buffer,
  options: TrimeshOptions,
  _tempDir: string, // Kept for API compatibility
  outputFormat: 'glb' | 'stl' = 'glb'
): Promise<{
  success: boolean;
  buffer?: Buffer;
  result?: TrimeshResult;
  error?: string;
}> {
  const result = await optimizeMeshBuffer(inputBuffer, options, outputFormat);

  if (!result.success) {
    return { success: false, error: result.error };
  }

  return {
    success: true,
    buffer: result.buffer,
    result,
  };
}

/**
 * Convert Python snake_case stats to TypeScript camelCase
 */
export function convertStats(pythonStats: Record<string, unknown>): MeshStats {
  return {
    vertexCount: (pythonStats.vertex_count as number) || 0,
    faceCount: (pythonStats.face_count as number) || 0,
    boundingBox: pythonStats.bounding_box as MeshStats['boundingBox'],
    isWatertight: (pythonStats.is_watertight as boolean) || false,
    volume: (pythonStats.volume as number) ?? null,
    center: pythonStats.center as number[] | undefined,
  };
}
