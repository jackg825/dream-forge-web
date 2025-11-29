/**
 * Gemini API Types
 * For generating multi-view images from a reference image
 */
import type { ViewAngle } from '../rodin/types';
export interface GeminiRequest {
    contents: Array<{
        parts: Array<{
            inline_data?: {
                mime_type: string;
                data: string;
            };
            text?: string;
        }>;
    }>;
    generationConfig?: {
        responseModalities?: string[];
        imageSizes?: string[];
    };
}
export interface SafetyRating {
    category: string;
    probability: string;
}
export type FinishReason = 'STOP' | 'MAX_TOKENS' | 'SAFETY' | 'RECITATION' | 'OTHER';
export interface GeminiResponse {
    candidates?: Array<{
        content?: {
            parts: Array<{
                inline_data?: {
                    mime_type: string;
                    data: string;
                };
                text?: string;
            }>;
        };
        finishReason?: FinishReason;
        safetyRatings?: SafetyRating[];
    }>;
    promptFeedback?: {
        blockReason?: string;
        safetyRatings?: SafetyRating[];
    };
    error?: {
        code: number;
        message: string;
        status: string;
    };
}
export interface GeminiResponseAnalysis {
    hasImage: boolean;
    textContent: string | null;
    blockReason: string | null;
    finishReason: string | null;
    safetyIssues: string[];
    errorMessage: string | null;
}
export interface GeminiGeneratedView {
    angle: ViewAngle;
    imageBase64: string;
    mimeType: string;
}
