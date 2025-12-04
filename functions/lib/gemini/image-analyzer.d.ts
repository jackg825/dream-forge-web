/**
 * Image Analyzer for Pipeline Workflow
 *
 * Analyzes uploaded images using Gemini to extract:
 * - Object description (including all materials)
 * - Color palette (configurable count, 3D-print friendly)
 * - 3D print friendliness assessment
 * - Material detection
 * - Object type classification
 *
 * Results are used to optimize view generation prompts and Meshy texture prompts.
 */
import type { PrinterType, KeyFeatures } from '../rodin/types';
/**
 * 3D Print friendliness assessment
 */
export interface PrintFriendlinessAssessment {
    score: number;
    colorSuggestions: string[];
    structuralConcerns: string[];
    materialRecommendations: string[];
    orientationTips: string[];
}
/**
 * Image analysis result from Gemini
 */
export interface ImageAnalysisResult {
    description: string;
    promptDescription?: string;
    styleHints?: string[];
    colorPalette: string[];
    detectedMaterials: string[];
    objectType: string;
    printFriendliness: PrintFriendlinessAssessment;
    keyFeatures?: KeyFeatures;
    analyzedAt: FirebaseFirestore.Timestamp;
}
/**
 * Options for image analysis
 */
export interface AnalyzeImageOptions {
    colorCount: number;
    printerType: PrinterType;
}
/**
 * Analyze an image using Gemini
 *
 * @param imageBase64 - Base64 encoded image data
 * @param mimeType - MIME type of the image (e.g., 'image/png')
 * @param options - Analysis options (colorCount, printerType)
 * @returns Analysis result
 */
export declare function analyzeImage(imageBase64: string, mimeType: string, options: AnalyzeImageOptions): Promise<Omit<ImageAnalysisResult, 'analyzedAt'>>;
