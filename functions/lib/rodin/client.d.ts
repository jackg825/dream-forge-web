import { type GenerateOptions, type GenerateTextureOptions, type OutputFormat } from './types';
/**
 * Rodin Gen-2 API Client
 *
 * Handles communication with the Hyper3D Rodin API for 3D model generation.
 * Updated to match official API documentation:
 * - https://developer.hyper3d.ai/api-specification/rodin-generation-gen2
 */
export declare class RodinClient {
    private apiKey;
    constructor(apiKey: string);
    /**
     * Start a 3D model generation task
     *
     * API requires multipart/form-data with image as binary file upload.
     * See: https://developer.hyper3d.ai/api-specification/rodin-generation-gen2
     *
     * @param imageBuffer - Image data as Buffer (downloaded from Storage)
     * @param options - Generation options (quality, format, etc.)
     * @returns Task ID and subscription key for status polling
     */
    generateModel(imageBuffer: Buffer, options: GenerateOptions): Promise<{
        taskUuid: string;
        jobUuids: string[];
        subscriptionKey: string;
    }>;
    /**
     * Start a 3D model generation task with multiple images
     *
     * Uses Rodin's multi-view mode (condition_mode: 'concat') for better
     * 3D reconstruction from multiple angles.
     *
     * @param imageBuffers - Array of image data buffers (up to 5 images)
     * @param options - Generation options including printer type for material selection
     * @returns Task ID and subscription key for status polling
     */
    generateModelMulti(imageBuffers: Buffer[], options: GenerateOptions): Promise<{
        taskUuid: string;
        jobUuids: string[];
        subscriptionKey: string;
    }>;
    /**
     * Generate texture for an existing 3D model
     *
     * Uses the texture-only endpoint to add PBR textures to a model.
     * See: https://developer.hyper3d.ai/api-specification/generate-texture
     *
     * @param imageBuffer - Reference image for texture style
     * @param modelBuffer - Existing 3D model file (max 10MB)
     * @param options - Texture generation options
     * @returns Task UUID and subscription key for status polling
     */
    generateTexture(imageBuffer: Buffer, modelBuffer: Buffer, options?: GenerateTextureOptions): Promise<{
        taskUuid: string;
        jobUuids: string[];
        subscriptionKey: string;
    }>;
    /**
     * Check the status of a generation task
     *
     * See: https://developer.hyper3d.ai/api-specification/check-status
     *
     * @param subscriptionKey - The subscription key for this task
     * @returns Current status and job UUID
     */
    checkStatus(subscriptionKey: string): Promise<{
        status: string;
        jobUuid: string;
    }>;
    /**
     * Get download URLs for a completed task
     *
     * See: https://developer.hyper3d.ai/api-specification/download-results
     *
     * Includes retry logic to handle timing delays between status=Done
     * and files being available for download.
     *
     * @param taskUuid - The task UUID (from generateModel response)
     * @param maxRetries - Number of retry attempts (default: 5)
     * @param retryDelayMs - Delay between retries in ms (default: 3000)
     * @returns List of downloadable files with URLs and names
     */
    getDownloadUrls(taskUuid: string, maxRetries?: number, retryDelayMs?: number): Promise<Array<{
        url: string;
        name: string;
    }>>;
    /**
     * Download a completed model
     *
     * @param modelUrl - The URL of the completed model
     * @returns Model data as a Buffer
     */
    downloadModel(modelUrl: string): Promise<Buffer>;
    /**
     * Check remaining Rodin API credits
     *
     * See: https://developer.hyper3d.ai/api-specification/check_balance
     *
     * @returns Current credit balance
     */
    checkBalance(): Promise<number>;
    /**
     * Get supported output formats
     */
    static getSupportedFormats(): OutputFormat[];
    /**
     * Handle and log API errors
     */
    private handleError;
}
/**
 * Create a RodinClient instance with the API key from environment
 */
export declare function createRodinClient(): RodinClient;
