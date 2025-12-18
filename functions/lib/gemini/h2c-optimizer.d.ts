/**
 * H2C Color Optimizer
 * Optimizes images to 7 solid colors for Bambu Lab H2C multi-color 3D printing
 *
 * Uses Gemini 2.5 Flash Image for intelligent color reduction
 * while preserving visual fidelity and printability
 */
/**
 * Result of H2C color optimization
 */
export interface H2COptimizationResult {
    /** Optimized image as base64 */
    imageBase64: string;
    /** MIME type of the image */
    mimeType: string;
    /** Array of 7 HEX color values extracted from the image */
    colorPalette: string[];
}
/**
 * H2C Color Optimizer class
 * Handles image color reduction for multi-color 3D printing
 */
export declare class H2CColorOptimizer {
    private apiKey;
    constructor(apiKey: string);
    /**
     * Optimize an image for H2C 7-color printing
     *
     * @param imageBase64 - Base64 encoded input image
     * @param mimeType - MIME type of the input image (e.g., 'image/png')
     * @returns Optimized image with color palette
     */
    optimize(imageBase64: string, mimeType: string): Promise<H2COptimizationResult>;
}
/**
 * Create an H2CColorOptimizer instance with the API key from environment
 */
export declare function createH2CColorOptimizer(): H2CColorOptimizer;
