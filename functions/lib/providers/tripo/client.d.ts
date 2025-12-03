/**
 * Tripo3D Provider
 *
 * Implements I3DProvider interface for Tripo3D v3.0 API.
 * Features: Native multi-view support, fast generation, texture + PBR.
 */
import type { I3DProvider, ProviderType, ProviderOutputFormat, ProviderCapabilities, GenerationOptions, GenerationTaskResult, TaskStatusResult, DownloadResult } from '../types';
export declare class TripoProvider implements I3DProvider {
    readonly providerType: ProviderType;
    private apiKey;
    constructor(apiKey: string);
    /**
     * Upload image to Tripo and get file_token
     */
    private uploadImage;
    /**
     * Generate 3D model from single image
     */
    generateFromImage(imageBuffer: Buffer, options: GenerationOptions): Promise<GenerationTaskResult>;
    /**
     * Generate 3D model from multiple images
     *
     * Uses multiview_to_model when 2+ images are provided.
     * Pipeline order: [front, back, left, right]
     * Tripo order: [front, left, back, right]
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
     * Create a new task
     */
    private createTask;
    /**
     * Get task status
     */
    private getTaskStatus;
    /**
     * Handle and log API errors
     */
    private handleError;
}
