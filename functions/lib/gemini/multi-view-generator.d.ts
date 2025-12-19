/**
 * Multi-View Generator for Pipeline Workflow
 *
 * Generates 4 mesh view images from a reference image using Gemini
 * for 3D mesh generation.
 *
 * Supports multiple generation modes for A/B testing different
 * image processing strategies.
 *
 * Uses Gemini 2.5 Flash Image for consistent multi-view generation
 */
import type { PipelineMeshAngle, GenerationModeId, ImageAnalysisResult } from '../rodin/types';
import { type ModeConfig } from './mode-configs';
import { type StyleId } from '../config/styles';
export type GeminiImageModel = 'gemini-2.5-flash';
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
 * Result of all 4 mesh views generation
 */
export interface MultiViewGenerationResult {
    meshViews: Record<PipelineMeshAngle, GeneratedViewResult>;
    aggregatedPalette?: AggregatedColorPalette;
}
/**
 * Callback for progress updates during parallel generation
 */
export type ViewProgressCallback = (type: 'mesh', angle: string, completed: number, total: number) => Promise<void>;
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
    private imageAnalysis?;
    private geminiModel;
    private selectedStyle?;
    constructor(apiKey: string, modeId?: GenerationModeId, userDescription?: string | null, imageAnalysis?: ImageAnalysisResult | null, geminiModel?: GeminiImageModel, selectedStyle?: StyleId);
    /**
     * Get the current mode configuration
     */
    get mode(): ModeConfig;
    /**
     * Generate all 4 mesh views from a reference image
     *
     * @param referenceImageBase64 - Base64 encoded reference image
     * @param mimeType - MIME type of the input image
     * @returns All 4 generated mesh views
     */
    generateAllViews(referenceImageBase64: string, mimeType: string): Promise<MultiViewGenerationResult>;
    /**
     * Aggregate color palettes from all mesh views
     * Combines colors from all 4 views, deduplicates, and sorts by frequency
     */
    private aggregateColorPalettes;
    /**
     * Generate all 4 mesh views using staggered parallel execution
     *
     * This method respects the 500ms rate limit while maximizing parallelism:
     * - Start 4 mesh views with 0, 500, 1000, 1500ms delays
     * - Aggregate color palette from mesh views
     *
     * Expected time: ~12s (vs ~32s for sequential)
     *
     * @param referenceImageBase64 - Base64 encoded reference image
     * @param mimeType - MIME type of the input image
     * @param onProgress - Optional callback for progress updates
     * @returns All 4 generated mesh views with aggregated color palette
     */
    generateAllViewsParallel(referenceImageBase64: string, mimeType: string, onProgress?: ViewProgressCallback): Promise<MultiViewGenerationResult>;
    /**
     * Generate a single mesh view with a delay (for staggered parallel execution)
     */
    private generateMeshViewWithDelay;
    /**
     * Generate a single mesh view
     * @param hint - Optional regeneration hint for adjustments
     */
    generateMeshView(referenceImageBase64: string, mimeType: string, angle: PipelineMeshAngle, hint?: string): Promise<GeneratedViewResult>;
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
 * @param imageAnalysis - Optional full image analysis result with key features
 * @param geminiModel - Gemini model for image generation (default: 'gemini-2.5-flash')
 * @param selectedStyle - User-selected figure style (bobblehead, chibi, cartoon, emoji)
 */
export declare function createMultiViewGenerator(modeId?: GenerationModeId, userDescription?: string | null, imageAnalysis?: ImageAnalysisResult | null, geminiModel?: GeminiImageModel, selectedStyle?: StyleId): MultiViewGenerator;
