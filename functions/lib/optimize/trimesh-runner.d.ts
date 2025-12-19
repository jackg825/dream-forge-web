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
export interface TrimeshOptions extends TrimeshRepairOptions, TrimeshScaleOptions {
}
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
export declare function isTrimeshAvailable(): Promise<boolean>;
/**
 * Run trimesh optimization via Python Cloud Function
 */
export declare function runTrimeshOptimize(inputPath: string, outputPath: string, options: TrimeshOptions): Promise<TrimeshResult>;
/**
 * Optimize a mesh buffer via Python Cloud Function
 */
export declare function optimizeMeshBuffer(inputBuffer: Buffer, options: TrimeshOptions, outputFormat?: 'glb' | 'stl'): Promise<TrimeshResult>;
/**
 * Analyze a mesh via Python Cloud Function
 */
export declare function analyzeMesh(inputPath: string): Promise<TrimeshAnalysisResult>;
/**
 * Analyze a mesh buffer via Python Cloud Function
 */
export declare function analyzeMeshBuffer(inputBuffer: Buffer): Promise<TrimeshAnalysisResult>;
/**
 * Repair and scale a mesh buffer
 */
export declare function repairMesh(inputBuffer: Buffer, options: TrimeshOptions, _tempDir: string, // Kept for API compatibility
outputFormat?: 'glb' | 'stl'): Promise<{
    success: boolean;
    buffer?: Buffer;
    result?: TrimeshResult;
    error?: string;
}>;
/**
 * Convert Python snake_case stats to TypeScript camelCase
 */
export declare function convertStats(pythonStats: Record<string, unknown>): MeshStats;
