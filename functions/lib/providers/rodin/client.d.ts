/**
 * Rodin Provider
 *
 * Wraps existing RodinClient to implement I3DProvider interface.
 * Delegates to the original implementation for API calls.
 */
import type { I3DProvider, ProviderType, ProviderOutputFormat, ProviderCapabilities, GenerationOptions, GenerationTaskResult, TaskStatusResult, DownloadResult } from '../types';
export declare class RodinProvider implements I3DProvider {
    readonly providerType: ProviderType;
    private client;
    constructor(apiKey: string);
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
     *
     * Rodin requires subscriptionKey for status polling.
     */
    checkStatus(taskId: string, subscriptionKey?: string): Promise<TaskStatusResult>;
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
     * Check API credit balance
     */
    checkBalance(): Promise<number>;
}
