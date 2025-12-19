/**
 * gltfpack CLI wrapper for mesh simplification
 *
 * gltfpack is a command-line tool from meshoptimizer that optimizes glTF/GLB files.
 * It supports mesh simplification, compression, and optimization.
 *
 * @see https://github.com/zeux/meshoptimizer
 */
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
 * Check if gltfpack is available
 */
export declare function isGltfpackAvailable(): Promise<boolean>;
/**
 * Run gltfpack to simplify a GLB file
 *
 * @param inputPath - Path to input GLB file
 * @param outputPath - Path for output GLB file
 * @param options - Simplification options
 */
export declare function runGltfpack(inputPath: string, outputPath: string, options: GltfpackOptions): Promise<GltfpackResult>;
/**
 * Simplify a GLB buffer and return the simplified buffer
 */
export declare function simplifyGlb(inputBuffer: Buffer, options: GltfpackOptions, tempDir: string): Promise<{
    success: boolean;
    buffer?: Buffer;
    error?: string;
    stats?: GltfpackResult['stats'];
}>;
