/**
 * Meshy AI Provider
 *
 * Implements I3DProvider interface for Meshy AI API.
 * Uses meshy-6 (latest) by default for highest quality.
 *
 * API Docs: https://docs.meshy.ai/en/api/image-to-3d
 */
import type { I3DProvider, ProviderType, ProviderOutputFormat, GenerationOptions, GenerationTaskResult, TaskStatusResult, DownloadResult } from '../types';
import type { MeshPrecision } from '../../rodin/types';
/**
 * Extended generation options with mesh precision for 3D printing
 */
export interface MeshGenerationOptions extends GenerationOptions {
    precision?: MeshPrecision;
}
export declare class MeshyProvider implements I3DProvider {
    readonly providerType: ProviderType;
    private apiKey;
    constructor(apiKey: string);
    /**
     * Generate 3D model from single image
     */
    generateFromImage(imageBuffer: Buffer, options: GenerationOptions): Promise<GenerationTaskResult>;
    /**
     * Generate 3D model from multiple images
     *
     * Meshy supports 1-4 images for multi-image mode.
     * Uses meshy-5 for mesh generation (required for multi-image).
     */
    generateFromMultipleImages(imageBuffers: Buffer[], options: GenerationOptions): Promise<GenerationTaskResult>;
    /**
     * Generate 3D mesh only (no texture) from multiple images
     *
     * Used for the new pipeline workflow where texture is generated separately.
     * This costs 5 credits (mesh-only) vs 15 credits (with texture).
     *
     * Supports mesh precision option for 3D printing optimization:
     * - 'high' precision: should_remesh=false (preserves original mesh topology)
     * - 'standard' precision: should_remesh=true (optimizes polycount)
     *
     * @param imageBuffers - Array of image buffers (max 4)
     * @param options - Generation options (quality, format, precision)
     * @returns Task ID for polling
     */
    generateMeshOnly(imageBuffers: Buffer[], options: MeshGenerationOptions): Promise<GenerationTaskResult>;
    /**
     * Check status of a generation task
     */
    checkStatus(taskId: string): Promise<TaskStatusResult>;
    /**
     * Get download URLs for completed task
     */
    getDownloadUrls(taskId: string, requiredFormat?: string): Promise<DownloadResult>;
    /**
     * Download model file from URL
     */
    downloadModel(url: string): Promise<Buffer>;
    /**
     * Get supported output formats
     */
    getSupportedFormats(): ProviderOutputFormat[];
    /**
     * Handle and log API errors
     */
    private handleError;
}
