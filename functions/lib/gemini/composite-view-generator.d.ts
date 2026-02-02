/**
 * Composite View Generator
 *
 * Generates a 2x2 grid image with 4 orthographic views using Gemini 3 Pro.
 * This replaces the multi-view generator's 4 separate API calls with a single call,
 * ensuring perfect consistency across all views.
 *
 * Output: 2048x2048 image containing:
 * - Top-left: FRONT view (0 degrees)
 * - Top-right: BACK view (180 degrees)
 * - Bottom-left: LEFT view (90 degrees)
 * - Bottom-right: RIGHT view (270 degrees)
 */
import type { ImageAnalysisResult } from '../rodin/types';
import { type StyleId } from '../config/styles';
/**
 * Options for composite view generation
 */
export interface CompositeViewOptions {
    userDescription?: string | null;
    imageAnalysis?: ImageAnalysisResult | null;
    selectedStyle?: StyleId;
}
/**
 * Result of composite view generation (after cropping)
 */
export interface CompositeViewResult {
    front: {
        imageBase64: string;
        mimeType: string;
    };
    back: {
        imageBase64: string;
        mimeType: string;
    };
    left: {
        imageBase64: string;
        mimeType: string;
    };
    right: {
        imageBase64: string;
        mimeType: string;
    };
}
/**
 * Generate composite view using Gemini 3 Pro
 *
 * @param referenceImageBase64 - Base64 encoded reference image
 * @param mimeType - MIME type of the input image
 * @param options - Generation options
 * @returns Cropped view images ready for 3D generation
 */
export declare function generateCompositeView(referenceImageBase64: string, mimeType: string, options?: CompositeViewOptions): Promise<CompositeViewResult>;
