/**
 * Gemini API Types
 * For generating multi-view images from a reference image
 */

import type { ViewAngle } from '../rodin/types';

// Gemini API request structure
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

// Safety rating from Gemini API
export interface SafetyRating {
  category: string;
  probability: string;
}

// Finish reason indicates why generation stopped
export type FinishReason =
  | 'STOP' // Normal completion
  | 'MAX_TOKENS' // Hit token limit
  | 'SAFETY' // Blocked by safety filters
  | 'RECITATION' // Content matched training data
  | 'OTHER'; // Other reasons

// Gemini API response structure (enhanced)
// Note: Response uses camelCase (inlineData, mimeType) unlike request (inline_data, mime_type)
export interface GeminiResponse {
  candidates?: Array<{
    content?: {
      parts: Array<{
        // Response format uses camelCase
        inlineData?: {
          mimeType: string;
          data: string;
        };
        text?: string;
        thoughtSignature?: string; // Gemini 3 Pro Image specific
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

// Result of analyzing a Gemini response
export interface GeminiResponseAnalysis {
  hasImage: boolean;
  textContent: string | null;
  blockReason: string | null;
  finishReason: string | null;
  safetyIssues: string[];
  errorMessage: string | null;
}

// Generated view result
export interface GeminiGeneratedView {
  angle: ViewAngle;
  imageBase64: string;
  mimeType: string;
}
