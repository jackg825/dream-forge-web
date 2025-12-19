"use strict";
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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.isTrimeshAvailable = isTrimeshAvailable;
exports.runTrimeshOptimize = runTrimeshOptimize;
exports.optimizeMeshBuffer = optimizeMeshBuffer;
exports.analyzeMesh = analyzeMesh;
exports.analyzeMeshBuffer = analyzeMeshBuffer;
exports.repairMesh = repairMesh;
exports.convertStats = convertStats;
const axios_1 = __importDefault(require("axios"));
// Python Cloud Function URLs (Gen 2)
// These are deployed to asia-east1 region
const PYTHON_FUNCTION_BASE_URL = process.env.PYTHON_FUNCTION_URL ||
    'https://asia-east1-dreamforge-66998.cloudfunctions.net';
const TRIMESH_ANALYZE_URL = `${PYTHON_FUNCTION_BASE_URL}/trimesh_analyze`;
const TRIMESH_OPTIMIZE_URL = `${PYTHON_FUNCTION_BASE_URL}/trimesh_optimize`;
/**
 * Check if Python Cloud Functions are available
 * For Gen 2 Cloud Functions, we assume they're available after deployment
 */
async function isTrimeshAvailable() {
    try {
        // Simple health check - try to reach the function
        const response = await axios_1.default.get(TRIMESH_ANALYZE_URL, {
            timeout: 5000,
            validateStatus: () => true, // Accept any status
        });
        // Function exists if we get any response (even 405 for wrong method)
        return response.status !== 404;
    }
    catch {
        return false;
    }
}
/**
 * Run trimesh optimization via Python Cloud Function
 */
async function runTrimeshOptimize(inputPath, outputPath, options) {
    // This function is kept for backwards compatibility
    // For new code, use optimizeMeshBuffer directly
    const fs = await Promise.resolve().then(() => __importStar(require('fs/promises')));
    try {
        const inputBuffer = await fs.readFile(inputPath);
        const result = await optimizeMeshBuffer(inputBuffer, options);
        if (result.success && result.buffer) {
            await fs.writeFile(outputPath, result.buffer);
        }
        return result;
    }
    catch (error) {
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Failed to optimize mesh',
        };
    }
}
/**
 * Optimize a mesh buffer via Python Cloud Function
 */
async function optimizeMeshBuffer(inputBuffer, options, outputFormat = 'glb') {
    try {
        const response = await axios_1.default.post(TRIMESH_OPTIMIZE_URL, {
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
        }, {
            timeout: 300000, // 5 minutes
            headers: {
                'Content-Type': 'application/json',
            },
        });
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
    }
    catch (error) {
        if (axios_1.default.isAxiosError(error)) {
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
async function analyzeMesh(inputPath) {
    const fs = await Promise.resolve().then(() => __importStar(require('fs/promises')));
    try {
        const inputBuffer = await fs.readFile(inputPath);
        return await analyzeMeshBuffer(inputBuffer);
    }
    catch (error) {
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Failed to read file',
        };
    }
}
/**
 * Analyze a mesh buffer via Python Cloud Function
 */
async function analyzeMeshBuffer(inputBuffer) {
    try {
        const response = await axios_1.default.post(TRIMESH_ANALYZE_URL, {
            file_data: inputBuffer.toString('base64'),
        }, {
            timeout: 120000, // 2 minutes
            headers: {
                'Content-Type': 'application/json',
            },
        });
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
    }
    catch (error) {
        if (axios_1.default.isAxiosError(error)) {
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
async function repairMesh(inputBuffer, options, _tempDir, // Kept for API compatibility
outputFormat = 'glb') {
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
function convertStats(pythonStats) {
    return {
        vertexCount: pythonStats.vertex_count || 0,
        faceCount: pythonStats.face_count || 0,
        boundingBox: pythonStats.bounding_box,
        isWatertight: pythonStats.is_watertight || false,
        volume: pythonStats.volume ?? null,
        center: pythonStats.center,
    };
}
//# sourceMappingURL=trimesh-runner.js.map