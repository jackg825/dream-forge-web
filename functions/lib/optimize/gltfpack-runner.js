"use strict";
/**
 * gltfpack CLI wrapper for mesh simplification
 *
 * gltfpack is a command-line tool from meshoptimizer that optimizes glTF/GLB files.
 * It supports mesh simplification, compression, and optimization.
 *
 * @see https://github.com/zeux/meshoptimizer
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
exports.isGltfpackAvailable = isGltfpackAvailable;
exports.runGltfpack = runGltfpack;
exports.simplifyGlb = simplifyGlb;
const child_process_1 = require("child_process");
const path = __importStar(require("path"));
const fs = __importStar(require("fs/promises"));
/**
 * Get the path to the gltfpack CLI
 * Uses the npm package which includes a WASM-based implementation
 */
function getGltfpackPath() {
    // Use the npm package's CLI (WASM-based, cross-platform)
    const npmPath = path.join(__dirname, '../../node_modules/gltfpack/cli.js');
    return npmPath;
}
/**
 * Check if gltfpack is available
 */
async function isGltfpackAvailable() {
    const gltfpackPath = getGltfpackPath();
    try {
        await fs.access(gltfpackPath, fs.constants.X_OK);
        return true;
    }
    catch {
        // Try system PATH
        return new Promise((resolve) => {
            const process = (0, child_process_1.spawn)('which', ['gltfpack']);
            process.on('close', (code) => resolve(code === 0));
            process.on('error', () => resolve(false));
        });
    }
}
/**
 * Run gltfpack to simplify a GLB file
 *
 * @param inputPath - Path to input GLB file
 * @param outputPath - Path for output GLB file
 * @param options - Simplification options
 */
async function runGltfpack(inputPath, outputPath, options) {
    const gltfpackPath = getGltfpackPath();
    // Build command arguments
    const args = ['-i', inputPath, '-o', outputPath];
    // Simplification ratio
    if (options.simplifyRatio < 1.0) {
        args.push('-si', options.simplifyRatio.toString());
        // Preserve topology (lock border vertices)
        if (options.preserveTopology !== false) {
            args.push('-slb');
        }
        // Error threshold
        if (options.simplifyError !== undefined) {
            args.push('-se', options.simplifyError.toString());
        }
    }
    // Compression
    if (options.compress) {
        args.push('-cc'); // Enable compression
    }
    // Get input file size
    let inputSize = 0;
    try {
        const inputStats = await fs.stat(inputPath);
        inputSize = inputStats.size;
    }
    catch {
        // Ignore stat errors
    }
    return new Promise((resolve) => {
        let stderr = '';
        let stdout = '';
        // Use node to run the gltfpack CLI.js (WASM-based)
        const tryRun = () => {
            const process = (0, child_process_1.spawn)('node', [gltfpackPath, ...args]);
            process.stdout.on('data', (data) => {
                stdout += data.toString();
            });
            process.stderr.on('data', (data) => {
                stderr += data.toString();
            });
            process.on('close', async (code) => {
                if (code === 0) {
                    // Success - get output stats
                    let outputSize = 0;
                    try {
                        const outputStats = await fs.stat(outputPath);
                        outputSize = outputStats.size;
                    }
                    catch {
                        // Ignore stat errors
                    }
                    resolve({
                        success: true,
                        outputPath,
                        stats: {
                            inputSize,
                            outputSize,
                            reductionPercent: inputSize > 0 ? Math.round((1 - outputSize / inputSize) * 100) : 0,
                        },
                    });
                }
                else {
                    resolve({
                        success: false,
                        outputPath,
                        error: `gltfpack failed with code ${code}: ${stderr || stdout}`,
                    });
                }
            });
            process.on('error', (err) => {
                resolve({
                    success: false,
                    outputPath,
                    error: `gltfpack error: ${err.message}`,
                });
            });
        };
        tryRun();
    });
}
/**
 * Simplify a GLB buffer and return the simplified buffer
 */
async function simplifyGlb(inputBuffer, options, tempDir) {
    const inputPath = path.join(tempDir, 'input_simplify.glb');
    const outputPath = path.join(tempDir, 'output_simplified.glb');
    try {
        // Write input buffer to temp file
        await fs.writeFile(inputPath, inputBuffer);
        // Run gltfpack
        const result = await runGltfpack(inputPath, outputPath, options);
        if (!result.success) {
            return { success: false, error: result.error };
        }
        // Read output buffer
        const buffer = await fs.readFile(outputPath);
        return {
            success: true,
            buffer,
            stats: result.stats,
        };
    }
    finally {
        // Cleanup temp files
        try {
            await fs.unlink(inputPath);
        }
        catch {
            // Ignore cleanup errors
        }
        try {
            await fs.unlink(outputPath);
        }
        catch {
            // Ignore cleanup errors
        }
    }
}
//# sourceMappingURL=gltfpack-runner.js.map