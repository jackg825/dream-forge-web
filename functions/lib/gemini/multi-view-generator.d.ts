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
import type { PipelineMeshAngle, GenerationModeId, ImageAnalysisResult, ViewAngle } from '../rodin/types';
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
     * Generate remaining view angles from a styled reference image
     *
     * This is Phase 2 of the two-phase generation flow:
     * - Phase 1 generates a styled reference at the detected angle
     * - Phase 2 (this method) generates the remaining 3 angles from that reference
     *
     * The key difference from generateAllViews: the prompt emphasizes maintaining
     * EXACT style consistency with the reference, not applying style transformation.
     *
     * @param styledReferenceBase64 - Base64 encoded styled reference image
     * @param mimeType - MIME type of the reference image
     * @param sourceAngle - The angle of the styled reference (will be excluded)
     * @param referenceColorPalette - Color palette from the styled reference
     * @param onProgress - Optional callback for progress updates
     * @returns Views for the 3 remaining angles (excluding sourceAngle)
     */
    generateViewsFromStyledReference(styledReferenceBase64: string, mimeType: string, sourceAngle: ViewAngle, referenceColorPalette: string[], onProgress?: ViewProgressCallback): Promise<Partial<Record<PipelineMeshAngle, GeneratedViewResult>>>;
    /**
     * Generate a single view from styled reference with delay
     */
    private generateViewFromReferenceWithDelay;
    /**
     * Generate a single view from styled reference (for regeneration)
     *
     * @param styledReferenceBase64 - Base64 encoded styled reference image
     * @param mimeType - MIME type of the reference image
     * @param sourceAngle - The angle of the styled reference
     * @param targetAngle - The angle to generate
     * @param referenceColorPalette - Color palette from the styled reference
     * @param hint - Optional regeneration hint
     */
    generateSingleViewFromReference(styledReferenceBase64: string, mimeType: string, sourceAngle: ViewAngle, targetAngle: PipelineMeshAngle, referenceColorPalette: string[], hint?: string): Promise<GeneratedViewResult>;
    /**
     * Build prompt for generating a view from styled reference
     *
     * Key differences from regular mesh prompt:
     * - Input is already styled (no style transformation needed)
     * - Emphasizes EXACT consistency with reference (same style, proportions, colors)
     * - Only changes camera angle
     */
    private buildFromReferencePrompt;
    /**
     * Get angle information for prompt building
     */
    private getAngleInfo;
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
