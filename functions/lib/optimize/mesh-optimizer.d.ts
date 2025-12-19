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
import { type MeshStats } from './trimesh-runner';
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
 * Run the full mesh optimization pipeline
 *
 * @param inputBuffer - Input GLB file buffer
 * @param options - Optimization options
 * @returns Optimized mesh buffer and preview stats
 */
export declare function optimizeMesh(inputBuffer: Buffer, options: OptimizationOptions): Promise<OptimizationResult>;
/**
 * Analyze a mesh without modifying it
 * Note: Full analysis requires Python/Trimesh. If unavailable, returns basic info.
 */
export declare function getMeshAnalysis(inputBuffer: Buffer): Promise<{
    success: boolean;
    analysis?: MeshStats & {
        issues: string[];
        recommendations: string[];
        printabilityScore: number;
    };
    error?: string;
}>;
/**
 * Preview optimization without actually modifying (dry run with analysis)
 */
export declare function previewOptimization(inputBuffer: Buffer, options: OptimizationOptions): Promise<{
    success: boolean;
    preview?: {
        original: MeshStats & {
            issues: string[];
            recommendations: string[];
        };
        estimatedOptimized: {
            faceCount: number;
            isWatertight: boolean;
        };
        estimatedReductionPercent: number;
    };
    error?: string;
}>;
export type { MeshStats } from './trimesh-runner';
