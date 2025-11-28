/**
 * Gemini API Client
 * Generates multi-view images from a reference image using Gemini 2.5 Flash Image
 *
 * API Documentation: https://ai.google.dev/gemini-api/docs/image-generation
 */
import type { ViewAngle } from '../rodin/types';
import type { GeminiGeneratedView } from './types';
export declare class GeminiClient {
    private apiKey;
    constructor(apiKey: string);
    /**
     * Generate additional views from a reference image
     *
     * @param referenceImageBase64 - Base64 encoded reference image
     * @param mimeType - MIME type of the image (e.g., 'image/png')
     * @param angles - Array of view angles to generate
     * @returns Array of generated views with base64 image data
     */
    generateViews(referenceImageBase64: string, mimeType: string, angles: ViewAngle[]): Promise<GeminiGeneratedView[]>;
    /**
     * Generate a single view of the object
     */
    private generateSingleView;
}
/**
 * Create a GeminiClient instance with the API key from environment
 */
export declare function createGeminiClient(): GeminiClient;
