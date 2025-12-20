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
import type { PrinterType, KeyFeatures, ViewAngle } from '../rodin/types';
import { type StyleId } from '../config/styles';
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
    detectedViewAngle?: ViewAngle;
    recommendedStyle?: StyleId;
    styleConfidence?: number;
    styleReasoning?: string;
    analyzedWithStyle?: StyleId;
    styleSuitability?: number;
    styleSuitabilityReason?: string;
    analyzedAt: FirebaseFirestore.Timestamp;
}
/**
 * Options for image analysis
 */
export interface AnalyzeImageOptions {
    colorCount: number;
    printerType: PrinterType;
    locale?: string;
    selectedStyle?: StyleId;
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
