/**
 * Multi-View Generator for Pipeline Workflow
 *
 * Generates images from a reference image using Gemini:
 * - 4 mesh views for 3D mesh generation (always generated)
 * - 2 texture views for texture mapping (controlled by ENABLE_TEXTURE_VIEWS flag)
 *
 * Supports multiple generation modes for A/B testing different
 * image processing strategies.
 *
 * Uses Gemini 3 Pro Image Preview for consistent multi-view generation
 */
import type { PipelineMeshAngle, PipelineTextureAngle, GenerationModeId, ImageAnalysisResult } from '../rodin/types';
import { type ModeConfig } from './mode-configs';
import { type StyleId } from '../config/styles';
export type GeminiImageModel = 'gemini-3-pro' | 'gemini-2.5-flash';
/**
 * Result of a single view generation
 */
export interface GeneratedViewResult {
    imageBase64: string;
    mimeType: string;
    colorPalette?: string[];
}
/**
 * Aggregated color palette from all mesh views
 * Used to ensure color consistency in texture generation
 */
export interface AggregatedColorPalette {
    byView: Record<PipelineMeshAngle, string[]>;
    unified: string[];
    dominantColors: string[];
}
/**
 * Result of all 6 views generation
 */
export interface MultiViewGenerationResult {
    meshViews: Record<PipelineMeshAngle, GeneratedViewResult>;
    textureViews: Record<PipelineTextureAngle, GeneratedViewResult>;
    aggregatedPalette?: AggregatedColorPalette;
}
/**
 * Callback for progress updates during parallel generation
 */
export type ViewProgressCallback = (type: 'mesh' | 'texture', angle: string, completed: number, total: number) => Promise<void>;
/**
 * Multi-View Generator class
 * Generates 6 images from a reference image for 3D model generation
 *
 * Supports different generation modes for A/B testing
 */
export declare class MultiViewGenerator {
    private apiKey;
    private modeConfig;
    private userDescription?;
    private preAnalyzedColors?;
    private imageAnalysis?;
    private geminiModel;
    private selectedStyle?;
    constructor(apiKey: string, modeId?: GenerationModeId, userDescription?: string | null, preAnalyzedColors?: string[], imageAnalysis?: ImageAnalysisResult | null, geminiModel?: GeminiImageModel, selectedStyle?: StyleId);
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
     * Aggregate color palettes from all mesh views
     * Combines colors from all 4 views, deduplicates, and sorts by frequency
     */
    private aggregateColorPalettes;
    /**
     * Generate all 6 views using staggered parallel execution
     *
     * This method respects the 500ms rate limit while maximizing parallelism:
     * - Phase 1: Start 4 mesh views with 0, 500, 1000, 1500ms delays
     * - Aggregate color palette from mesh views
     * - Phase 2: Start 2 texture views with 0, 500ms delays (with color hints)
     *
     * Expected time: ~18s (vs ~50s for sequential)
     *
     * @param referenceImageBase64 - Base64 encoded reference image
     * @param mimeType - MIME type of the input image
     * @param onProgress - Optional callback for progress updates
     * @returns All 6 generated views with aggregated color palette
     */
    generateAllViewsParallel(referenceImageBase64: string, mimeType: string, onProgress?: ViewProgressCallback): Promise<MultiViewGenerationResult>;
    /**
     * Generate a single view with a delay (for staggered parallel execution)
     */
    private generateViewWithDelay;
    /**
     * Generate a texture view with color hints from mesh views
     * Used during parallel generation to ensure color consistency
     */
    private generateTextureViewWithColorHints;
    /**
     * Generate texture views with existing color palette
     * Used when regenerating mesh views and need to update texture views
     */
    generateTextureViewsWithColors(referenceImageBase64: string, mimeType: string, colorPalette: string[]): Promise<Record<PipelineTextureAngle, GeneratedViewResult>>;
    /**
     * Generate a single mesh view
     * @param hint - Optional regeneration hint for adjustments
     */
    generateMeshView(referenceImageBase64: string, mimeType: string, angle: PipelineMeshAngle, hint?: string): Promise<GeneratedViewResult>;
    /**
     * Generate a single texture view
     * @param hint - Optional regeneration hint for adjustments
     */
    generateTextureView(referenceImageBase64: string, mimeType: string, angle: PipelineTextureAngle, hint?: string): Promise<GeneratedViewResult>;
    /**
     * Generate a single view with the given prompt
     */
    private generateSingleView;
}
/**
 * Create a MultiViewGenerator instance with the API key from environment
 *
 * @param modeId - Generation mode ID (default: 'simplified-mesh')
 * @param userDescription - Optional user-provided description of the object
 * @param preAnalyzedColors - Optional pre-analyzed color palette from image analysis
 * @param imageAnalysis - Optional full image analysis result with key features
 * @param geminiModel - Gemini model for image generation (default: 'gemini-2.5-flash')
 * @param selectedStyle - User-selected figure style (bobblehead, chibi, cartoon, emoji)
 */
export declare function createMultiViewGenerator(modeId?: GenerationModeId, userDescription?: string | null, preAnalyzedColors?: string[], imageAnalysis?: ImageAnalysisResult | null, geminiModel?: GeminiImageModel, selectedStyle?: StyleId): MultiViewGenerator;
