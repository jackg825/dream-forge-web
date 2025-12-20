/**
 * Styled Reference Generator for Pipeline Workflow
 *
 * Generates a single styled, background-removed reference image from the original photo.
 * This reference image is then used as the source for generating consistent multi-view images.
 *
 * Phase 1 of the two-phase generation flow:
 * 1. Original image → Styled reference (this module)
 * 2. Styled reference → Multi-view images (multi-view-generator.ts)
 */
import type { ViewAngle, ImageAnalysisResult } from '../rodin/types';
import { type StyleId } from '../config/styles';
/**
 * Result of styled reference generation
 */
export interface StyledReferenceResult {
    /** Base64 encoded styled image */
    imageBase64: string;
    /** MIME type of the generated image */
    mimeType: string;
    /** The view angle this reference represents */
    sourceAngle: ViewAngle;
    /** Extracted color palette (7 dominant colors) */
    colorPalette: string[];
}
/**
 * Options for styled reference generation
 */
export interface StyledReferenceOptions {
    /** Detected view angle of the original image */
    detectedAngle: ViewAngle;
    /** Selected figure style (bobblehead, chibi, cartoon, emoji, none) */
    style: StyleId;
    /** Image analysis result for context */
    imageAnalysis?: ImageAnalysisResult | null;
    /** User-provided description of the object */
    userDescription?: string | null;
}
/**
 * Generate a styled reference image from the original photo
 *
 * This creates a single styled, background-removed image that serves as the
 * reference for generating all other view angles with consistent styling.
 *
 * @param referenceImageBase64 - Base64 encoded original image
 * @param mimeType - MIME type of the input image
 * @param options - Generation options including style and detected angle
 * @returns Styled reference image with metadata
 */
export declare function generateStyledReference(referenceImageBase64: string, mimeType: string, options: StyledReferenceOptions): Promise<StyledReferenceResult>;
