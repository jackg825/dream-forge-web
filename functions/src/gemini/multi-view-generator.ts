/**
 * Multi-View Generator for Pipeline Workflow
 *
 * Generates 6 images from a reference image using Gemini:
 * - 4 mesh views for 3D mesh generation
 * - 2 texture views for texture mapping
 *
 * Supports multiple generation modes for A/B testing different
 * image processing strategies.
 *
 * Uses Gemini 3 Pro Image Preview for consistent multi-view generation
 */

import axios from 'axios';
import * as functions from 'firebase-functions';
import type { GeminiResponse, GeminiResponseAnalysis } from './types';
import type { PipelineMeshAngle, PipelineTextureAngle, GenerationModeId } from '../rodin/types';
import {
  type ModeConfig,
  DEFAULT_MODE,
  getMode,
  getMeshPrompt,
  getTexturePrompt,
} from './mode-configs';

const GEMINI_API_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';
const MODEL = 'gemini-3-pro-image-preview';

// Minimum delay between sequential API calls to avoid rate limiting
const MIN_DELAY_BETWEEN_CALLS_MS = 500;

/**
 * Result of a single view generation
 */
export interface GeneratedViewResult {
  imageBase64: string;
  mimeType: string;
  colorPalette?: string[]; // Only for simplified views (when extractColors is true)
}

/**
 * Result of all 6 views generation
 */
export interface MultiViewGenerationResult {
  meshViews: Record<PipelineMeshAngle, GeneratedViewResult>;
  textureViews: Record<PipelineTextureAngle, GeneratedViewResult>;
}

/**
 * Analyze Gemini response for image and text data
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
 */
function extractColorPalette(text: string | null, expectedCount: number): string[] {
  if (!text) return [];

  // Look for COLORS: #RRGGBB, #RRGGBB, ... format
  const colorsMatch = text.match(/COLORS:\s*(#[0-9A-Fa-f]{6}(?:\s*,\s*#[0-9A-Fa-f]{6})*)/i);
  if (colorsMatch) {
    const colors = colorsMatch[1].match(/#[0-9A-Fa-f]{6}/gi);
    if (colors && colors.length > 0) {
      return colors.map((c) => c.toUpperCase());
    }
  }

  // Fallback: find any hex colors in the text
  const hexColors = text.match(/#[0-9A-Fa-f]{6}/gi);
  if (hexColors && hexColors.length > 0) {
    const uniqueColors = [...new Set(hexColors.map((c) => c.toUpperCase()))];
    return uniqueColors.slice(0, expectedCount);
  }

  return [];
}

/**
 * Multi-View Generator class
 * Generates 6 images from a reference image for 3D model generation
 *
 * Supports different generation modes for A/B testing
 */
export class MultiViewGenerator {
  private apiKey: string;
  private modeConfig: ModeConfig;
  private userDescription?: string | null;

  constructor(
    apiKey: string,
    modeId: GenerationModeId = DEFAULT_MODE,
    userDescription?: string | null
  ) {
    this.apiKey = apiKey;
    this.modeConfig = getMode(modeId);
    this.userDescription = userDescription;
  }

  /**
   * Get the current mode configuration
   */
  get mode(): ModeConfig {
    return this.modeConfig;
  }

  /**
   * Generate all 6 views from a reference image
   *
   * @param referenceImageBase64 - Base64 encoded reference image
   * @param mimeType - MIME type of the input image
   * @returns All 6 generated views (4 mesh + 2 texture)
   */
  async generateAllViews(
    referenceImageBase64: string,
    mimeType: string
  ): Promise<MultiViewGenerationResult> {
    functions.logger.info('Starting multi-view generation', {
      model: MODEL,
      mode: this.modeConfig.id,
      modeName: this.modeConfig.name,
      totalViews: 6,
      meshViews: 4,
      textureViews: 2,
      meshSimplified: this.modeConfig.mesh.simplified,
      textureSimplified: this.modeConfig.texture.simplified,
    });

    const meshAngles: PipelineMeshAngle[] = ['front', 'back', 'left', 'right'];
    const textureAngles: PipelineTextureAngle[] = ['front', 'back'];

    const meshViews: Partial<Record<PipelineMeshAngle, GeneratedViewResult>> = {};
    const textureViews: Partial<Record<PipelineTextureAngle, GeneratedViewResult>> = {};

    let viewIndex = 0;

    // Generate mesh views
    for (const angle of meshAngles) {
      if (viewIndex > 0) {
        await new Promise((resolve) => setTimeout(resolve, MIN_DELAY_BETWEEN_CALLS_MS));
      }

      functions.logger.info(`Generating mesh view: ${angle}`, {
        viewIndex,
        type: 'mesh',
        simplified: this.modeConfig.mesh.simplified,
        hasUserDescription: !!this.userDescription,
      });

      const prompt = getMeshPrompt(this.modeConfig, angle, this.userDescription);
      const result = await this.generateSingleView(
        referenceImageBase64,
        mimeType,
        prompt,
        this.modeConfig.mesh.extractColors,
        this.modeConfig.mesh.colorCount
      );

      meshViews[angle] = result;
      viewIndex++;
    }

    // Generate texture views
    for (const angle of textureAngles) {
      await new Promise((resolve) => setTimeout(resolve, MIN_DELAY_BETWEEN_CALLS_MS));

      functions.logger.info(`Generating texture view: ${angle}`, {
        viewIndex,
        type: 'texture',
        simplified: this.modeConfig.texture.simplified,
        hasUserDescription: !!this.userDescription,
      });

      const prompt = getTexturePrompt(this.modeConfig, angle, this.userDescription);
      const result = await this.generateSingleView(
        referenceImageBase64,
        mimeType,
        prompt,
        this.modeConfig.texture.extractColors,
        this.modeConfig.texture.colorCount
      );

      textureViews[angle] = result;
      viewIndex++;
    }

    functions.logger.info('Multi-view generation complete', {
      mode: this.modeConfig.id,
      meshViewCount: Object.keys(meshViews).length,
      textureViewCount: Object.keys(textureViews).length,
    });

    return {
      meshViews: meshViews as Record<PipelineMeshAngle, GeneratedViewResult>,
      textureViews: textureViews as Record<PipelineTextureAngle, GeneratedViewResult>,
    };
  }

  /**
   * Generate a single mesh view
   * @param hint - Optional regeneration hint for adjustments
   */
  async generateMeshView(
    referenceImageBase64: string,
    mimeType: string,
    angle: PipelineMeshAngle,
    hint?: string
  ): Promise<GeneratedViewResult> {
    const prompt = getMeshPrompt(this.modeConfig, angle, this.userDescription, hint);
    return this.generateSingleView(
      referenceImageBase64,
      mimeType,
      prompt,
      this.modeConfig.mesh.extractColors,
      this.modeConfig.mesh.colorCount
    );
  }

  /**
   * Generate a single texture view
   * @param hint - Optional regeneration hint for adjustments
   */
  async generateTextureView(
    referenceImageBase64: string,
    mimeType: string,
    angle: PipelineTextureAngle,
    hint?: string
  ): Promise<GeneratedViewResult> {
    const prompt = getTexturePrompt(this.modeConfig, angle, this.userDescription, hint);
    return this.generateSingleView(
      referenceImageBase64,
      mimeType,
      prompt,
      this.modeConfig.texture.extractColors,
      this.modeConfig.texture.colorCount
    );
  }

  /**
   * Generate a single view with the given prompt
   */
  private async generateSingleView(
    referenceImageBase64: string,
    mimeType: string,
    prompt: string,
    extractColors: boolean,
    expectedColorCount: number
  ): Promise<GeneratedViewResult> {
    const response = await axios.post<GeminiResponse>(
      `${GEMINI_API_BASE}/${MODEL}:generateContent`,
      {
        contents: [
          {
            parts: [
              {
                inline_data: {
                  mime_type: mimeType,
                  data: referenceImageBase64,
                },
              },
              {
                text: prompt,
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
        timeout: 90000, // 90 second timeout
      }
    );

    const analysis = analyzeGeminiResponse(response.data);

    functions.logger.info('View generation response', {
      extractColors,
      hasImage: analysis.hasImage,
      hasText: !!analysis.textContent,
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
        `Image generation blocked due to safety concerns: ${analysis.safetyIssues.join(', ')}`
      );
    }

    if (!analysis.hasImage) {
      const textInfo = analysis.textContent
        ? ` Gemini responded: "${analysis.textContent.substring(0, 200)}"`
        : '';
      throw new functions.https.HttpsError(
        'internal',
        `No image returned from Gemini.${textInfo}`
      );
    }

    // Extract image data
    const candidates = response.data.candidates!;
    const parts = candidates[0].content?.parts || [];
    const imagePart = parts.find((p) => p.inlineData?.data)!;

    const responseMimeType = imagePart.inlineData!.mimeType;
    const validMimeTypes = ['image/png', 'image/jpeg', 'image/webp'];

    const result: GeneratedViewResult = {
      imageBase64: imagePart.inlineData!.data,
      mimeType:
        responseMimeType && validMimeTypes.includes(responseMimeType)
          ? responseMimeType
          : 'image/png',
    };

    // Extract color palette if requested
    if (extractColors) {
      result.colorPalette = extractColorPalette(analysis.textContent, expectedColorCount);
      if (result.colorPalette.length !== expectedColorCount) {
        functions.logger.warn('Color palette count mismatch', {
          expected: expectedColorCount,
          actual: result.colorPalette.length,
          colorPalette: result.colorPalette,
        });
      }
    }

    return result;
  }
}

/**
 * Create a MultiViewGenerator instance with the API key from environment
 *
 * @param modeId - Generation mode ID (default: 'simplified-mesh')
 * @param userDescription - Optional user-provided description of the object
 */
export function createMultiViewGenerator(
  modeId: GenerationModeId = DEFAULT_MODE,
  userDescription?: string | null
): MultiViewGenerator {
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    throw new functions.https.HttpsError(
      'failed-precondition',
      'Gemini API key not configured'
    );
  }

  return new MultiViewGenerator(apiKey, modeId, userDescription);
}
