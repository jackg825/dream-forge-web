/**
 * Multi-View Generator for Pipeline Workflow
 *
 * Generates 6 images from a reference image using Gemini:
 * - 4 mesh views for 3D mesh generation
 * - 2 texture views for texture mapping
 *
 * Supports multiple generation modes for A/B testing different
 * image processing strategies.
 *
 * Uses Gemini 3 Pro Image Preview for consistent multi-view generation
 */
import type { PipelineMeshAngle, PipelineTextureAngle, GenerationModeId } from '../rodin/types';
import { type ModeConfig } from './mode-configs';
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
 *
 * Supports different generation modes for A/B testing
 */
export declare class MultiViewGenerator {
    private apiKey;
    private modeConfig;
    constructor(apiKey: string, modeId?: GenerationModeId);
    /**
     * Get the current mode configuration
     */
    get mode(): ModeConfig;
    /**
     * Generate all 6 views from a reference image
     *
     * @param referenceImageBase64 - Base64 encoded reference image
     * @param mimeType - MIME type of the input image
     * @returns All 6 generated views (4 mesh + 2 texture)
     */
    generateAllViews(referenceImageBase64: string, mimeType: string): Promise<MultiViewGenerationResult>;
    /**
     * Generate a single mesh view
     */
    generateMeshView(referenceImageBase64: string, mimeType: string, angle: PipelineMeshAngle): Promise<GeneratedViewResult>;
    /**
     * Generate a single texture view
     */
    generateTextureView(referenceImageBase64: string, mimeType: string, angle: PipelineTextureAngle): Promise<GeneratedViewResult>;
    /**
     * Generate a single view with the given prompt
     */
    private generateSingleView;
}
/**
 * Create a MultiViewGenerator instance with the API key from environment
 *
 * @param modeId - Generation mode ID (default: 'simplified-mesh')
 */
export declare function createMultiViewGenerator(modeId?: GenerationModeId): MultiViewGenerator;
