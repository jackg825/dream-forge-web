"use strict";
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
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.optimizeMesh = optimizeMesh;
exports.getMeshAnalysis = getMeshAnalysis;
exports.previewOptimization = previewOptimization;
const path = __importStar(require("path"));
const fs = __importStar(require("fs/promises"));
const os = __importStar(require("os"));
const uuid_1 = require("uuid");
const gltfpack_runner_1 = require("./gltfpack-runner");
const trimesh_runner_1 = require("./trimesh-runner");
/**
 * Create a unique temporary directory for optimization
 */
async function createTempDirectory() {
    const tempBase = os.tmpdir();
    const tempDir = path.join(tempBase, `mesh-optimize-${(0, uuid_1.v4)()}`);
    await fs.mkdir(tempDir, { recursive: true });
    return tempDir;
}
/**
 * Clean up temporary directory
 */
async function cleanupTempDirectory(tempDir) {
    try {
        await fs.rm(tempDir, { recursive: true, force: true });
    }
    catch {
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
async function optimizeMesh(inputBuffer, options) {
    const tempDir = await createTempDirectory();
    const operations = [];
    const warnings = [];
    try {
        // Write input to temp file
        const inputPath = path.join(tempDir, 'input.glb');
        await fs.writeFile(inputPath, inputBuffer);
        // Get original stats (may fail if Python not available)
        const trimeshAvailable = await (0, trimesh_runner_1.isTrimeshAvailable)();
        let originalStats;
        if (trimeshAvailable) {
            const originalAnalysis = await (0, trimesh_runner_1.analyzeMesh)(inputPath);
            if (originalAnalysis.success && originalAnalysis.analysis) {
                originalStats = {
                    vertexCount: originalAnalysis.analysis.vertexCount,
                    faceCount: originalAnalysis.analysis.faceCount,
                    boundingBox: originalAnalysis.analysis.boundingBox,
                    isWatertight: originalAnalysis.analysis.isWatertight,
                    volume: originalAnalysis.analysis.volume,
                };
            }
            else {
                warnings.push('Mesh analysis failed, proceeding with optimization');
                originalStats = {
                    vertexCount: 0,
                    faceCount: 0,
                    boundingBox: { width: 0, height: 0, depth: 0 },
                    isWatertight: false,
                    volume: null,
                };
            }
        }
        else {
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
            const gltfpackOptions = {
                simplifyRatio: options.simplify.targetRatio || 0.5,
                preserveTopology: options.simplify.preserveTopology !== false,
            };
            const simplifyResult = await (0, gltfpack_runner_1.runGltfpack)(currentPath, simplifiedPath, gltfpackOptions);
            if (simplifyResult.success) {
                currentPath = simplifiedPath;
                operations.push(`simplify:${Math.round((1 - gltfpackOptions.simplifyRatio) * 100)}%`);
                if (simplifyResult.stats) {
                    operations.push(`size_reduction:${simplifyResult.stats.reductionPercent}%`);
                }
            }
            else {
                warnings.push(`Simplification skipped: ${simplifyResult.error}`);
            }
        }
        // Step 2: Repair and scale with trimesh
        if (options.repair?.enabled || options.scale?.enabled) {
            // Check if trimesh (Python) is available
            const trimeshAvailable = await (0, trimesh_runner_1.isTrimeshAvailable)();
            if (!trimeshAvailable) {
                warnings.push('Mesh repair/scaling skipped: Python environment not available. Only simplification is supported.');
                // Skip to next step
            }
            else {
                const outputFormat = options.outputFormat || 'glb';
                const repairedPath = path.join(tempDir, `repaired.${outputFormat}`);
                const trimeshOptions = {
                    fillHoles: options.repair?.fillHoles !== false,
                    fixNormals: options.repair?.fixNormals !== false,
                    makeWatertight: options.repair?.makeWatertight !== false,
                    centerMesh: true,
                    targetSize: options.scale?.targetSize,
                    uniformScale: options.scale?.uniformScale,
                    printBedSize: options.scale?.printBedSize,
                };
                const repairResult = await (0, trimesh_runner_1.runTrimeshOptimize)(currentPath, repairedPath, trimeshOptions);
                if (repairResult.success) {
                    currentPath = repairedPath;
                    // Add operations from trimesh
                    if (repairResult.operations) {
                        operations.push(...repairResult.operations);
                    }
                    if (repairResult.warnings) {
                        warnings.push(...repairResult.warnings);
                    }
                }
                else {
                    warnings.push(`Repair skipped: ${repairResult.error}`);
                }
            } // Close else block for trimeshAvailable check
        }
        // Step 3: Final format conversion if needed
        const outputFormat = options.outputFormat || 'glb';
        let finalPath = currentPath;
        if (outputFormat === 'stl' && !currentPath.endsWith('.stl')) {
            // Check if trimesh is available for STL conversion
            const trimeshAvailable = await (0, trimesh_runner_1.isTrimeshAvailable)();
            if (trimeshAvailable) {
                // Use trimesh to convert to STL
                const stlPath = path.join(tempDir, 'output.stl');
                const convertResult = await (0, trimesh_runner_1.runTrimeshOptimize)(currentPath, stlPath, {
                    fillHoles: false,
                    fixNormals: false,
                    makeWatertight: false,
                    centerMesh: false,
                });
                if (convertResult.success) {
                    finalPath = stlPath;
                    operations.push('convert:stl');
                }
                else {
                    warnings.push(`STL conversion failed: ${convertResult.error}`);
                }
            }
            else {
                warnings.push('STL conversion unavailable: Python environment not available. Returning GLB format.');
            }
        }
        // Get optimized stats
        const optimizedAnalysis = await (0, trimesh_runner_1.analyzeMesh)(finalPath);
        const optimizedStats = optimizedAnalysis.success && optimizedAnalysis.analysis
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
        const reductionPercent = originalStats.faceCount > 0
            ? Math.round(((originalStats.faceCount - optimizedStats.faceCount) / originalStats.faceCount) * 100)
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
    }
    catch (error) {
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
    }
    finally {
        await cleanupTempDirectory(tempDir);
    }
}
/**
 * Analyze a mesh without modifying it
 * Note: Full analysis requires Python/Trimesh. If unavailable, returns basic info.
 */
async function getMeshAnalysis(inputBuffer) {
    // Check if Python/Trimesh is available
    const trimeshAvailable = await (0, trimesh_runner_1.isTrimeshAvailable)();
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
        const result = await (0, trimesh_runner_1.analyzeMesh)(inputPath);
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
    }
    finally {
        await cleanupTempDirectory(tempDir);
    }
}
/**
 * Preview optimization without actually modifying (dry run with analysis)
 */
async function previewOptimization(inputBuffer, options) {
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
    const willBeWatertight = analysis.analysis.isWatertight ||
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
//# sourceMappingURL=mesh-optimizer.js.map