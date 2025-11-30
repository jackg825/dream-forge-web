/**
 * Meshy AI Provider
 *
 * Implements I3DProvider interface for Meshy AI API.
 * Uses meshy-6 (latest) by default for highest quality.
 *
 * API Docs: https://docs.meshy.ai/en/api/image-to-3d
 */
import type { I3DProvider, ProviderType, ProviderOutputFormat, GenerationOptions, GenerationTaskResult, TaskStatusResult, DownloadResult } from '../types';
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
