/**
 * HiTem3D Provider
 *
 * Implements I3DProvider interface for HiTem3D API.
 * Uses hitem3dv1.5 model by default for high quality.
 *
 * API Docs: https://docs.hitem3d.ai/en/api/api-reference/
 */
import type { I3DProvider, ProviderType, ProviderOutputFormat, ProviderCapabilities, GenerationOptions, GenerationTaskResult, TaskStatusResult, DownloadResult } from '../types';
export declare class Hitem3DProvider implements I3DProvider {
    readonly providerType: ProviderType;
    private authManager;
    constructor(clientId: string, clientSecret: string);
    /**
     * Generate 3D model from single image
     */
    generateFromImage(imageBuffer: Buffer, options: GenerationOptions): Promise<GenerationTaskResult>;
    /**
     * Generate 3D model from multiple images
     *
     * HiTem supports multi-view generation with multi_images field.
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
     * Get provider capabilities for UI introspection
     */
    getCapabilities(): ProviderCapabilities;
    /**
     * Get format code for HiTem API
     */
    private getFormatCode;
    /**
     * Handle API-level errors from response
     */
    private handleApiError;
    /**
     * Handle and log errors
     */
    private handleError;
}
