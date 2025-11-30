/**
 * Multi-View Generator for Pipeline Workflow
 *
 * Generates 6 images from a reference image using Gemini:
 * - 4 mesh-optimized views (7-color H2C style) for 3D mesh generation
 * - 2 texture-ready views (full color) for texture mapping
 *
 * Uses Gemini 3 Pro Image Preview for consistent multi-view generation
 */
import type { PipelineMeshAngle, PipelineTextureAngle } from '../rodin/types';
/**
 * Result of a single view generation
 */
export interface GeneratedViewResult {
    imageBase64: string;
    mimeType: string;
    colorPalette?: string[];
}
/**
 * Result of all 6 views generation
 */
export interface MultiViewGenerationResult {
    meshViews: Record<PipelineMeshAngle, GeneratedViewResult>;
    textureViews: Record<PipelineTextureAngle, GeneratedViewResult>;
}
/**
 * Multi-View Generator class
 * Generates 6 images from a reference image for 3D model generation
 */
export declare class MultiViewGenerator {
    private apiKey;
    constructor(apiKey: string);
    /**
     * Generate all 6 views from a reference image
     *
     * @param referenceImageBase64 - Base64 encoded reference image
     * @param mimeType - MIME type of the input image
     * @returns All 6 generated views (4 mesh + 2 texture)
     */
    generateAllViews(referenceImageBase64: string, mimeType: string): Promise<MultiViewGenerationResult>;
    /**
     * Generate a single mesh-optimized view (7-color)
     */
    generateMeshView(referenceImageBase64: string, mimeType: string, angle: PipelineMeshAngle): Promise<GeneratedViewResult>;
    /**
     * Generate a single texture-ready view (full color)
     */
    generateTextureView(referenceImageBase64: string, mimeType: string, angle: PipelineTextureAngle): Promise<GeneratedViewResult>;
    /**
     * Generate a single view with the given prompt
     */
    private generateSingleView;
}
/**
 * Create a MultiViewGenerator instance with the API key from environment
 */
export declare function createMultiViewGenerator(): MultiViewGenerator;
