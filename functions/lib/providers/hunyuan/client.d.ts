/**
 * Hunyuan 3D Provider
 *
 * Implements I3DProvider interface for Tencent Cloud Hunyuan 3D v3.0 API.
 * Features: High polygon count control (40K-1.5M), PBR materials, multi-view support.
 */
import type { I3DProvider, ProviderType, ProviderOutputFormat, ProviderCapabilities, GenerationOptions, GenerationTaskResult, TaskStatusResult, DownloadResult } from '../types';
export declare class HunyuanProvider implements I3DProvider {
    readonly providerType: ProviderType;
    private secretId;
    private secretKey;
    private region;
    constructor(secretId: string, secretKey: string, region?: string);
    /**
     * Generate 3D model from single image
     */
    generateFromImage(imageBuffer: Buffer, options: GenerationOptions): Promise<GenerationTaskResult>;
    /**
     * Generate 3D model from multiple images
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
     * Get face count from options
     */
    private getFaceCount;
    /**
     * Call Tencent Cloud API with TC3 signature
     */
    private callAPI;
    /**
     * Handle and log API errors
     */
    private handleError;
}
