/**
 * Multi-View Generator for Pipeline Workflow
 *
 * Generates images from a reference image using Gemini:
 * - 4 mesh views for 3D mesh generation (always generated)
 * - 2 texture views for texture mapping (controlled by ENABLE_TEXTURE_VIEWS flag)
 *
 * Supports multiple generation modes for A/B testing different
 * image processing strategies.
 *
 * Uses Gemini 3 Pro Image Preview for consistent multi-view generation
 */

import axios from 'axios';
import * as functions from 'firebase-functions';
import type { GeminiResponse, GeminiResponseAnalysis } from './types';
import type { PipelineMeshAngle, PipelineTextureAngle, GenerationModeId, ImageAnalysisResult } from '../rodin/types';
import {
  type ModeConfig,
  DEFAULT_MODE,
  getMode,
  getMeshPrompt,
  getTexturePrompt,
  getTexturePromptWithColors,
} from './mode-configs';

const GEMINI_API_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';

// Gemini model options for image generation
export type GeminiImageModel = 'gemini-3-pro' | 'gemini-2.5-flash';

const GEMINI_MODEL_IDS: Record<GeminiImageModel, string> = {
  'gemini-3-pro': 'gemini-3-pro-image-preview',
  'gemini-2.5-flash': 'gemini-2.5-flash-image',
};

const DEFAULT_GEMINI_MODEL: GeminiImageModel = 'gemini-2.5-flash';

// Minimum delay between sequential API calls to avoid rate limiting
const MIN_DELAY_BETWEEN_CALLS_MS = 500;

// Feature flag to enable/disable texture view generation
// When false, only 4 mesh views are generated (no texture views)
const ENABLE_TEXTURE_VIEWS = false;

/**
 * Result of a single view generation
 */
export interface GeneratedViewResult {
  imageBase64: string;
  mimeType: string;
  colorPalette?: string[]; // Only for simplified views (when extractColors is true)
}

/**
 * Aggregated color palette from all mesh views
 * Used to ensure color consistency in texture generation
 */
export interface AggregatedColorPalette {
  byView: Record<PipelineMeshAngle, string[]>;  // Per-view palettes
  unified: string[];                             // All unique colors, sorted by frequency
  dominantColors: string[];                      // Top 7 most frequent colors
}

/**
 * Result of all 6 views generation
 */
export interface MultiViewGenerationResult {
  meshViews: Record<PipelineMeshAngle, GeneratedViewResult>;
  textureViews: Record<PipelineTextureAngle, GeneratedViewResult>;
  aggregatedPalette?: AggregatedColorPalette;    // Color palette aggregated from mesh views
}

/**
 * Callback for progress updates during parallel generation
 */
export type ViewProgressCallback = (
  type: 'mesh' | 'texture',
  angle: string,
  completed: number,
  total: number
) => Promise<void>;

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
  private preAnalyzedColors?: string[];  // Pre-analyzed colors from image analysis
  private imageAnalysis?: ImageAnalysisResult | null;  // Full image analysis for feature extraction
  private geminiModel: GeminiImageModel;  // Selected Gemini model for image generation

  constructor(
    apiKey: string,
    modeId: GenerationModeId = DEFAULT_MODE,
    userDescription?: string | null,
    preAnalyzedColors?: string[],
    imageAnalysis?: ImageAnalysisResult | null,
    geminiModel: GeminiImageModel = DEFAULT_GEMINI_MODEL
  ) {
    this.apiKey = apiKey;
    this.modeConfig = getMode(modeId);
    this.userDescription = userDescription;
    this.preAnalyzedColors = preAnalyzedColors;
    this.imageAnalysis = imageAnalysis;
    this.geminiModel = geminiModel;
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
      model: GEMINI_MODEL_IDS[this.geminiModel],
      geminiModel: this.geminiModel,
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

      const prompt = getMeshPrompt(this.modeConfig, angle, this.userDescription, undefined, this.imageAnalysis);
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

    // Generate texture views (if enabled)
    if (ENABLE_TEXTURE_VIEWS) {
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
    } else {
      functions.logger.info('Texture view generation skipped (ENABLE_TEXTURE_VIEWS=false)');
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
   * Aggregate color palettes from all mesh views
   * Combines colors from all 4 views, deduplicates, and sorts by frequency
   */
  private aggregateColorPalettes(
    meshViews: Record<PipelineMeshAngle, GeneratedViewResult>
  ): AggregatedColorPalette {
    const colorFrequency = new Map<string, number>();
    const byView: Partial<Record<PipelineMeshAngle, string[]>> = {};

    // Collect colors from each view
    for (const [angle, view] of Object.entries(meshViews)) {
      const viewColors = view.colorPalette || [];
      byView[angle as PipelineMeshAngle] = viewColors;

      for (const color of viewColors) {
        const normalizedColor = color.toUpperCase();
        colorFrequency.set(normalizedColor, (colorFrequency.get(normalizedColor) || 0) + 1);
      }
    }

    // Sort by frequency (most common first)
    const sortedColors = [...colorFrequency.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([color]) => color);

    return {
      byView: byView as Record<PipelineMeshAngle, string[]>,
      unified: sortedColors,
      dominantColors: sortedColors.slice(0, 7),  // Top 7 colors
    };
  }

  /**
   * Generate all 6 views using staggered parallel execution
   *
   * This method respects the 500ms rate limit while maximizing parallelism:
   * - Phase 1: Start 4 mesh views with 0, 500, 1000, 1500ms delays
   * - Aggregate color palette from mesh views
   * - Phase 2: Start 2 texture views with 0, 500ms delays (with color hints)
   *
   * Expected time: ~18s (vs ~50s for sequential)
   *
   * @param referenceImageBase64 - Base64 encoded reference image
   * @param mimeType - MIME type of the input image
   * @param onProgress - Optional callback for progress updates
   * @returns All 6 generated views with aggregated color palette
   */
  async generateAllViewsParallel(
    referenceImageBase64: string,
    mimeType: string,
    onProgress?: ViewProgressCallback
  ): Promise<MultiViewGenerationResult> {
    const meshAngles: PipelineMeshAngle[] = ['front', 'back', 'left', 'right'];
    const textureAngles: PipelineTextureAngle[] = ['front', 'back'];

    functions.logger.info('Starting parallel multi-view generation', {
      model: GEMINI_MODEL_IDS[this.geminiModel],
      geminiModel: this.geminiModel,
      mode: this.modeConfig.id,
      modeName: this.modeConfig.name,
      strategy: 'staggered-parallel',
      totalViews: 6,
    });

    // Phase 1: Staggered parallel mesh view generation
    let meshCompleted = 0;
    const meshPromises = meshAngles.map((angle, index) =>
      this.generateViewWithDelay(
        referenceImageBase64,
        mimeType,
        'mesh',
        angle,
        index * MIN_DELAY_BETWEEN_CALLS_MS  // 0, 500, 1000, 1500ms
      ).then(async (result) => {
        meshCompleted++;
        if (onProgress) {
          await onProgress('mesh', angle, meshCompleted, 4);
        }
        return { angle, result };
      })
    );

    const meshResults = await Promise.all(meshPromises);

    // Build meshViews record
    const meshViews: Partial<Record<PipelineMeshAngle, GeneratedViewResult>> = {};
    for (const { angle, result } of meshResults) {
      meshViews[angle as PipelineMeshAngle] = result;
    }

    // Aggregate color palettes from all mesh views
    const aggregatedPalette = this.aggregateColorPalettes(
      meshViews as Record<PipelineMeshAngle, GeneratedViewResult>
    );

    // Use pre-analyzed colors if available, otherwise use aggregated from mesh views
    // Pre-analyzed colors are user-confirmed and should take priority
    const colorsForTexture = this.preAnalyzedColors && this.preAnalyzedColors.length > 0
      ? this.preAnalyzedColors
      : aggregatedPalette.dominantColors;

    functions.logger.info('Mesh views complete', {
      meshViewCount: meshResults.length,
      dominantColors: aggregatedPalette.dominantColors,
      totalUniqueColors: aggregatedPalette.unified.length,
      usingPreAnalyzedColors: !!(this.preAnalyzedColors && this.preAnalyzedColors.length > 0),
      preAnalyzedColorCount: this.preAnalyzedColors?.length || 0,
      textureViewsEnabled: ENABLE_TEXTURE_VIEWS,
    });

    // Build textureViews record
    const textureViews: Partial<Record<PipelineTextureAngle, GeneratedViewResult>> = {};

    // Phase 2: Staggered parallel texture view generation (with color hints) - if enabled
    if (ENABLE_TEXTURE_VIEWS) {
      let textureCompleted = 0;
      const texturePromises = textureAngles.map((angle, index) =>
        this.generateTextureViewWithColorHints(
          referenceImageBase64,
          mimeType,
          angle,
          colorsForTexture,
          index * MIN_DELAY_BETWEEN_CALLS_MS  // 0, 500ms
        ).then(async (result) => {
          textureCompleted++;
          if (onProgress) {
            await onProgress('texture', angle, textureCompleted, 2);
          }
          return { angle, result };
        })
      );

      const textureResults = await Promise.all(texturePromises);

      for (const { angle, result } of textureResults) {
        textureViews[angle as PipelineTextureAngle] = result;
      }
    } else {
      functions.logger.info('Texture view generation skipped (ENABLE_TEXTURE_VIEWS=false)');
    }

    functions.logger.info('Parallel multi-view generation complete', {
      mode: this.modeConfig.id,
      meshViewCount: Object.keys(meshViews).length,
      textureViewCount: Object.keys(textureViews).length,
      dominantColorCount: aggregatedPalette.dominantColors.length,
    });

    return {
      meshViews: meshViews as Record<PipelineMeshAngle, GeneratedViewResult>,
      textureViews: textureViews as Record<PipelineTextureAngle, GeneratedViewResult>,
      aggregatedPalette,
    };
  }

  /**
   * Generate a single view with a delay (for staggered parallel execution)
   */
  private async generateViewWithDelay(
    referenceImageBase64: string,
    mimeType: string,
    type: 'mesh' | 'texture',
    angle: string,
    delayMs: number
  ): Promise<GeneratedViewResult> {
    if (delayMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }

    functions.logger.info(`Generating ${type} view: ${angle}`, {
      type,
      angle,
      delayMs,
      simplified: type === 'mesh' ? this.modeConfig.mesh.simplified : this.modeConfig.texture.simplified,
    });

    if (type === 'mesh') {
      const prompt = getMeshPrompt(this.modeConfig, angle as PipelineMeshAngle, this.userDescription, undefined, this.imageAnalysis);
      return this.generateSingleView(
        referenceImageBase64,
        mimeType,
        prompt,
        this.modeConfig.mesh.extractColors,
        this.modeConfig.mesh.colorCount
      );
    } else {
      const prompt = getTexturePrompt(this.modeConfig, angle as PipelineTextureAngle, this.userDescription);
      return this.generateSingleView(
        referenceImageBase64,
        mimeType,
        prompt,
        this.modeConfig.texture.extractColors,
        this.modeConfig.texture.colorCount
      );
    }
  }

  /**
   * Generate a texture view with color hints from mesh views
   * Used during parallel generation to ensure color consistency
   */
  private async generateTextureViewWithColorHints(
    referenceImageBase64: string,
    mimeType: string,
    angle: PipelineTextureAngle,
    colorPalette: string[],
    delayMs: number
  ): Promise<GeneratedViewResult> {
    if (delayMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }

    functions.logger.info(`Generating texture view with color hints: ${angle}`, {
      angle,
      delayMs,
      colorCount: colorPalette.length,
      simplified: this.modeConfig.texture.simplified,
    });

    // Use color-aware prompt if we have colors
    const prompt = colorPalette.length > 0
      ? getTexturePromptWithColors(this.modeConfig, angle, colorPalette, this.userDescription)
      : getTexturePrompt(this.modeConfig, angle, this.userDescription);

    return this.generateSingleView(
      referenceImageBase64,
      mimeType,
      prompt,
      this.modeConfig.texture.extractColors,
      this.modeConfig.texture.colorCount
    );
  }

  /**
   * Generate texture views with existing color palette
   * Used when regenerating mesh views and need to update texture views
   */
  async generateTextureViewsWithColors(
    referenceImageBase64: string,
    mimeType: string,
    colorPalette: string[]
  ): Promise<Record<PipelineTextureAngle, GeneratedViewResult>> {
    const textureAngles: PipelineTextureAngle[] = ['front', 'back'];

    functions.logger.info('Generating texture views with color palette', {
      colorCount: colorPalette.length,
      colors: colorPalette,
    });

    // Staggered parallel generation
    const promises = textureAngles.map((angle, index) =>
      this.generateTextureViewWithColorHints(
        referenceImageBase64,
        mimeType,
        angle,
        colorPalette,
        index * MIN_DELAY_BETWEEN_CALLS_MS
      ).then((result) => ({ angle, result }))
    );

    const results = await Promise.all(promises);

    const textureViews: Partial<Record<PipelineTextureAngle, GeneratedViewResult>> = {};
    for (const { angle, result } of results) {
      textureViews[angle] = result;
    }

    return textureViews as Record<PipelineTextureAngle, GeneratedViewResult>;
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
    const prompt = getMeshPrompt(this.modeConfig, angle, this.userDescription, hint, this.imageAnalysis);
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
    const modelId = GEMINI_MODEL_IDS[this.geminiModel];

    // Build generation config - imageConfig only supported by Pro model
    const generationConfig: Record<string, unknown> = {
      responseModalities: ['TEXT', 'IMAGE'],
    };

    // Only add imageConfig for Pro model (Flash doesn't support it)
    if (this.geminiModel === 'gemini-3-pro') {
      generationConfig.imageConfig = {
        aspectRatio: '1:1',
        imageSize: '1K',
      };
    }

    const response = await axios.post<GeminiResponse>(
      `${GEMINI_API_BASE}/${modelId}:generateContent`,
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
        generationConfig,
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
      model: modelId,
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
 * @param preAnalyzedColors - Optional pre-analyzed color palette from image analysis
 * @param imageAnalysis - Optional full image analysis result with key features
 * @param geminiModel - Gemini model for image generation (default: 'gemini-2.5-flash')
 */
export function createMultiViewGenerator(
  modeId: GenerationModeId = DEFAULT_MODE,
  userDescription?: string | null,
  preAnalyzedColors?: string[],
  imageAnalysis?: ImageAnalysisResult | null,
  geminiModel: GeminiImageModel = DEFAULT_GEMINI_MODEL
): MultiViewGenerator {
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    throw new functions.https.HttpsError(
      'failed-precondition',
      'Gemini API key not configured'
    );
  }

  return new MultiViewGenerator(apiKey, modeId, userDescription, preAnalyzedColors, imageAnalysis, geminiModel);
}
