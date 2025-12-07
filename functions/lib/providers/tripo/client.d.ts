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
     * Generate 3D model from image URLs (no upload needed)
     *
     * Passes R2/storage URLs directly to Tripo API, avoiding timeout issues
     * from downloading and re-uploading images.
     *
     * Pipeline order: [front, back, left, right]
     * Tripo order: [front, left, back, right]
     */
    generateFromUrls(imageUrls: string[], options: GenerationOptions): Promise<GenerationTaskResult>;
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
     * Check API credit balance
     * Returns the current available balance (conforms to I3DProvider interface)
     */
    checkBalance(): Promise<number>;
    /**
     * Check API credit balance with frozen amount
     * Returns both balance and frozen for admin dashboard
     */
    checkBalanceWithFrozen(): Promise<{
        balance: number;
        frozen: number;
    }>;
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
