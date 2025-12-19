/**
 * gltfpack CLI wrapper for mesh simplification
 *
 * gltfpack is a command-line tool from meshoptimizer that optimizes glTF/GLB files.
 * It supports mesh simplification, compression, and optimization.
 *
 * @see https://github.com/zeux/meshoptimizer
 */

import { spawn } from 'child_process';
import * as path from 'path';
import * as fs from 'fs/promises';

export interface GltfpackOptions {
  /** Target ratio for simplification (0.1 - 1.0, where 0.5 = 50% reduction) */
  simplifyRatio: number;
  /** Lock border vertices to preserve mesh topology */
  preserveTopology?: boolean;
  /** Error threshold for simplification (0.0 - 1.0) */
  simplifyError?: number;
  /** Enable mesh compression */
  compress?: boolean;
}

export interface GltfpackResult {
  success: boolean;
  outputPath: string;
  error?: string;
  stats?: {
    inputSize: number;
    outputSize: number;
    reductionPercent: number;
  };
}

/**
 * Get the path to the gltfpack CLI
 * Uses the npm package which includes a WASM-based implementation
 */
function getGltfpackPath(): string {
  // Use the npm package's CLI (WASM-based, cross-platform)
  const npmPath = path.join(__dirname, '../../node_modules/gltfpack/cli.js');
  return npmPath;
}

/**
 * Check if gltfpack is available
 */
export async function isGltfpackAvailable(): Promise<boolean> {
  const gltfpackPath = getGltfpackPath();

  try {
    await fs.access(gltfpackPath, fs.constants.X_OK);
    return true;
  } catch {
    // Try system PATH
    return new Promise((resolve) => {
      const process = spawn('which', ['gltfpack']);
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
export async function runGltfpack(
  inputPath: string,
  outputPath: string,
  options: GltfpackOptions
): Promise<GltfpackResult> {
  const gltfpackPath = getGltfpackPath();

  // Build command arguments
  const args: string[] = ['-i', inputPath, '-o', outputPath];

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
  } catch {
    // Ignore stat errors
  }

  return new Promise((resolve) => {
    let stderr = '';
    let stdout = '';

    // Use node to run the gltfpack CLI.js (WASM-based)
    const tryRun = () => {
      const process = spawn('node', [gltfpackPath, ...args]);

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
          } catch {
            // Ignore stat errors
          }

          resolve({
            success: true,
            outputPath,
            stats: {
              inputSize,
              outputSize,
              reductionPercent:
                inputSize > 0 ? Math.round((1 - outputSize / inputSize) * 100) : 0,
            },
          });
        } else {
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
export async function simplifyGlb(
  inputBuffer: Buffer,
  options: GltfpackOptions,
  tempDir: string
): Promise<{ success: boolean; buffer?: Buffer; error?: string; stats?: GltfpackResult['stats'] }> {
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
  } finally {
    // Cleanup temp files
    try {
      await fs.unlink(inputPath);
    } catch {
      // Ignore cleanup errors
    }
    try {
      await fs.unlink(outputPath);
    } catch {
      // Ignore cleanup errors
    }
  }
}
