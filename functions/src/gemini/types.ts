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

// Gemini API response structure
export interface GeminiResponse {
  candidates: Array<{
    content: {
      parts: Array<{
        inline_data?: {
          mime_type: string;
          data: string;
        };
        text?: string;
      }>;
    };
  }>;
}

// Generated view result
export interface GeminiGeneratedView {
  angle: ViewAngle;
  imageBase64: string;
  mimeType: string;
}
