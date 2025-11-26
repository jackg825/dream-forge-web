import { type GenerateOptions, type RodinStatusResponse, type OutputFormat } from './types';
/**
 * Rodin Gen-2 API Client
 *
 * Handles communication with the Hyper3D Rodin API for 3D model generation.
 */
export declare class RodinClient {
    private client;
    constructor(apiKey: string);
    /**
     * Start a 3D model generation task
     *
     * @param imageUrl - URL of the input image
     * @param options - Generation options (quality, format, etc.)
     * @returns Task ID and subscription key for status polling
     */
    generateModel(imageUrl: string, options: GenerateOptions): Promise<{
        taskId: string;
        subscriptionKey: string;
    }>;
    /**
     * Check the status of a generation task
     *
     * @param taskId - The task UUID
     * @param subscriptionKey - The subscription key for this task
     * @returns Current status and result URL if complete
     */
    checkStatus(taskId: string, subscriptionKey: string): Promise<RodinStatusResponse>;
    /**
     * Download a completed model
     *
     * @param modelUrl - The URL of the completed model
     * @returns Model data as a Buffer
     */
    downloadModel(modelUrl: string): Promise<Buffer>;
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
