/**
 * Generation Mode Configurations
 *
 * Defines different image generation modes for A/B testing 3D model quality.
 * Each mode specifies how mesh and texture images should be processed.
 */
import type { PipelineMeshAngle, PipelineTextureAngle, ImageAnalysisResult } from '../rodin/types';
/**
 * Available generation mode IDs
 */
export type GenerationModeId = 'simplified-mesh' | 'simplified-texture';
/**
 * Configuration for a single image type (mesh or texture)
 */
export interface ImageTypeConfig {
    colorCount: number;
    simplified: boolean;
    extractColors: boolean;
}
/**
 * Complete mode configuration
 */
export interface ModeConfig {
    id: GenerationModeId;
    name: string;
    description: string;
    mesh: ImageTypeConfig;
    texture: ImageTypeConfig;
}
/**
 * Default generation mode
 */
export declare const DEFAULT_MODE: GenerationModeId;
/**
 * All available generation modes
 */
export declare const GENERATION_MODES: Record<GenerationModeId, ModeConfig>;
/**
 * Get mode configuration by ID
 */
export declare function getMode(id: GenerationModeId): ModeConfig;
/**
 * Generate mesh view prompt based on mode and angle
 * @param mode - The generation mode configuration
 * @param angle - The view angle to generate
 * @param userDescription - Optional user-provided description of the object
 * @param hint - Optional regeneration hint for adjustments
 * @param imageAnalysis - Optional image analysis result with key features
 */
export declare function getMeshPrompt(mode: ModeConfig, angle: PipelineMeshAngle, userDescription?: string | null, hint?: string, imageAnalysis?: ImageAnalysisResult | null): string;
/**
 * Generate texture view prompt based on mode and angle
 * @param mode - The generation mode configuration
 * @param angle - The view angle to generate
 * @param userDescription - Optional user-provided description of the object
 * @param hint - Optional regeneration hint for adjustments
 */
export declare function getTexturePrompt(mode: ModeConfig, angle: PipelineTextureAngle, userDescription?: string | null, hint?: string): string;
/**
 * Generate texture view prompt with color palette hints for consistency
 * Used when generating texture views after mesh views are complete
 *
 * @param mode - The generation mode configuration
 * @param angle - The view angle to generate
 * @param colorPalette - Color palette extracted from mesh views for consistency
 * @param userDescription - Optional user-provided description of the object
 * @param hint - Optional regeneration hint for adjustments
 */
export declare function getTexturePromptWithColors(mode: ModeConfig, angle: PipelineTextureAngle, colorPalette: string[], userDescription?: string | null, hint?: string): string;
