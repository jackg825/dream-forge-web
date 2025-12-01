/**
 * H2C Color Optimizer
 * Optimizes images to 7 solid colors for Bambu Lab H2C multi-color 3D printing
 *
 * Uses Gemini 3 Pro Image Preview for intelligent color reduction
 * while preserving visual fidelity and printability
 */

import axios from 'axios';
import * as functions from 'firebase-functions';
import type { GeminiResponse, GeminiResponseAnalysis } from './types';

const GEMINI_API_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';
const MODEL = 'gemini-3-pro-image-preview';

/**
 * Result of H2C color optimization
 */
export interface H2COptimizationResult {
  /** Optimized image as base64 */
  imageBase64: string;
  /** MIME type of the image */
  mimeType: string;
  /** Array of 7 HEX color values extracted from the image */
  colorPalette: string[];
}

/**
 * Prompt for H2C 7-color optimization
 * Uses Vector Art / Sticker Art style for clean color separation
 */
const H2C_OPTIMIZATION_PROMPT = `You are a vector artist preparing images for multi-color 3D printing on a Bambu Lab H2C printer.

Task: Transform this image into a "Paint-by-numbers" style illustration with approximately 7 solid colors.

STYLE REQUIREMENTS:
1. **STYLE**: Flat Vector Illustration / Sticker Art style. Think of vinyl toy or cel-shaded game art.
2. **PALETTE**: Reduce to approximately 7 distinct solid colors with high contrast between them.
3. **GRADIENTS**: FORBIDDEN. No gradients, no fading, no anti-aliasing between color regions.
4. **REGIONS**: "Chunky design" - each color region must be large and well-defined (minimum ~2mm width at typical print scales). Avoid tiny pixel noise.
5. **EDGES**: Crisp, pixel-sharp boundaries between color zones.
6. **COMPOSITION**: Preserve the main subject's recognizable features and overall silhouette.
7. **CONTRAST**: Each color should be distinctly different from adjacent colors for visual appeal.

Output logic: The final image should look like a clean sticker or decal that could be 3D printed with distinct color changes.

After the image, list the colors used in this exact format:
COLORS: #RRGGBB, #RRGGBB, #RRGGBB, #RRGGBB, #RRGGBB, #RRGGBB, #RRGGBB

Important: Generate the actual optimized image, not a description or placeholder.`;

/**
 * Analyze Gemini response for image and color data
 */
function analyzeGeminiResponse(response: GeminiResponse): GeminiResponseAnalysis {
  const result: GeminiResponseAnalysis = {
    hasImage: false,
    textContent: null,
    blockReason: null,
    finishReason: null,
    safetyIssues: [],
    errorMessage: null,
  };

  if (response.error) {
    result.errorMessage = `API Error ${response.error.code}: ${response.error.message}`;
    return result;
  }

  if (response.promptFeedback?.blockReason) {
    result.blockReason = response.promptFeedback.blockReason;
    if (response.promptFeedback.safetyRatings) {
      result.safetyIssues = response.promptFeedback.safetyRatings
        .filter((r) => r.probability !== 'NEGLIGIBLE')
        .map((r) => `${r.category}: ${r.probability}`);
    }
    return result;
  }

  const candidate = response.candidates?.[0];
  if (!candidate) {
    result.errorMessage = 'No candidates in response';
    return result;
  }

  result.finishReason = candidate.finishReason || null;

  if (candidate.safetyRatings) {
    result.safetyIssues = candidate.safetyRatings
      .filter((r) => r.probability !== 'NEGLIGIBLE' && r.probability !== 'LOW')
      .map((r) => `${r.category}: ${r.probability}`);
  }

  const parts = candidate.content?.parts || [];
  const imagePart = parts.find((p) => p.inlineData?.data);
  result.hasImage = !!imagePart;

  const textParts = parts.filter((p) => p.text).map((p) => p.text).join('\n');
  if (textParts) {
    result.textContent = textParts;
  }

  return result;
}

/**
 * Extract color palette from Gemini's text response
 * Looks for the COLORS: format in the response
 */
function extractColorPalette(text: string | null): string[] {
  if (!text) return [];

  // Look for COLORS: #RRGGBB, #RRGGBB, ... format
  const colorsMatch = text.match(/COLORS:\s*(#[0-9A-Fa-f]{6}(?:\s*,\s*#[0-9A-Fa-f]{6})*)/i);
  if (colorsMatch) {
    const colors = colorsMatch[1].match(/#[0-9A-Fa-f]{6}/gi);
    if (colors && colors.length > 0) {
      return colors.map(c => c.toUpperCase());
    }
  }

  // Fallback: find any hex colors in the text
  const hexColors = text.match(/#[0-9A-Fa-f]{6}/gi);
  if (hexColors && hexColors.length > 0) {
    // Remove duplicates and return up to 7 colors
    const uniqueColors = [...new Set(hexColors.map(c => c.toUpperCase()))];
    return uniqueColors.slice(0, 7);
  }

  return [];
}

/**
 * H2C Color Optimizer class
 * Handles image color reduction for multi-color 3D printing
 */
export class H2CColorOptimizer {
  private apiKey: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  /**
   * Optimize an image for H2C 7-color printing
   *
   * @param imageBase64 - Base64 encoded input image
   * @param mimeType - MIME type of the input image (e.g., 'image/png')
   * @returns Optimized image with color palette
   */
  async optimize(
    imageBase64: string,
    mimeType: string
  ): Promise<H2COptimizationResult> {
    functions.logger.info('Starting H2C color optimization', {
      model: MODEL,
      inputMimeType: mimeType,
    });

    const response = await axios.post<GeminiResponse>(
      `${GEMINI_API_BASE}/${MODEL}:generateContent`,
      {
        contents: [
          {
            parts: [
              {
                inline_data: {
                  mime_type: mimeType,
                  data: imageBase64,
                },
              },
              {
                text: H2C_OPTIMIZATION_PROMPT,
              },
            ],
          },
        ],
        generationConfig: {
          responseModalities: ['TEXT', 'IMAGE'],
          imageConfig: {
            aspectRatio: '1:1',
            imageSize: '1K',
          },
        },
      },
      {
        headers: {
          'Content-Type': 'application/json',
        },
        params: {
          key: this.apiKey,
        },
        timeout: 90000, // 90 second timeout for optimization
      }
    );

    const analysis = analyzeGeminiResponse(response.data);

    functions.logger.info('H2C optimization response analysis', {
      hasImage: analysis.hasImage,
      hasText: !!analysis.textContent,
      textPreview: analysis.textContent?.substring(0, 300),
      blockReason: analysis.blockReason,
      finishReason: analysis.finishReason,
      safetyIssues: analysis.safetyIssues,
      errorMessage: analysis.errorMessage,
    });

    // Handle error cases
    if (analysis.errorMessage) {
      throw new functions.https.HttpsError(
        'internal',
        `Gemini API error: ${analysis.errorMessage}`
      );
    }

    if (analysis.blockReason) {
      throw new functions.https.HttpsError(
        'invalid-argument',
        `Image blocked by Gemini safety filters: ${analysis.blockReason}. ` +
          `Please try a different image.`
      );
    }

    if (analysis.safetyIssues.length > 0 && !analysis.hasImage) {
      throw new functions.https.HttpsError(
        'invalid-argument',
        `Image optimization blocked due to safety concerns: ${analysis.safetyIssues.join(', ')}`
      );
    }

    if (!analysis.hasImage) {
      const textInfo = analysis.textContent
        ? ` Gemini responded: "${analysis.textContent.substring(0, 200)}"`
        : '';
      throw new functions.https.HttpsError(
        'internal',
        `No optimized image returned from Gemini.${textInfo}`
      );
    }

    // Extract image data
    const candidates = response.data.candidates!;
    const parts = candidates[0].content?.parts || [];
    const imagePart = parts.find((p) => p.inlineData?.data)!;

    const responseMimeType = imagePart.inlineData!.mimeType;
    const validMimeTypes = ['image/png', 'image/jpeg', 'image/webp'];

    // Extract color palette from text response
    const colorPalette = extractColorPalette(analysis.textContent);

    functions.logger.info('H2C optimization complete', {
      outputMimeType: responseMimeType,
      colorPaletteCount: colorPalette.length,
      colorPalette,
    });

    // Warn if we didn't get exactly 7 colors
    if (colorPalette.length !== 7) {
      functions.logger.warn('Color palette count mismatch', {
        expected: 7,
        actual: colorPalette.length,
        colorPalette,
      });
    }

    return {
      imageBase64: imagePart.inlineData!.data,
      mimeType:
        responseMimeType && validMimeTypes.includes(responseMimeType)
          ? responseMimeType
          : 'image/png',
      colorPalette,
    };
  }
}

/**
 * Create an H2CColorOptimizer instance with the API key from environment
 */
export function createH2CColorOptimizer(): H2CColorOptimizer {
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    throw new functions.https.HttpsError(
      'failed-precondition',
      'Gemini API key not configured'
    );
  }

  return new H2CColorOptimizer(apiKey);
}
