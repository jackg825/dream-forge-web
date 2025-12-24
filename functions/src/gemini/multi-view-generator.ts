/**
 * Multi-View Generator for Pipeline Workflow
 *
 * Generates 4 mesh view images from a reference image using Gemini
 * for 3D mesh generation.
 *
 * Supports multiple generation modes for A/B testing different
 * image processing strategies.
 *
 * Uses Gemini 2.5 Flash Image for consistent multi-view generation
 */

import axios from 'axios';
import * as functions from 'firebase-functions';
import type { GeminiResponse, GeminiResponseAnalysis } from './types';
import type { PipelineMeshAngle, GenerationModeId, ImageAnalysisResult, ViewAngle } from '../rodin/types';
import {
  type ModeConfig,
  DEFAULT_MODE,
  getMode,
  getMeshPrompt,
} from './mode-configs';
import { type StyleId, getStyleConfig } from '../config/styles';

const GEMINI_API_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';

// Gemini model for image generation
// Supports both short names (legacy) and full names (frontend)
export type GeminiImageModel =
  | 'gemini-2.5-flash'           // Legacy short name
  | 'gemini-2.5-flash-image'     // Full name from frontend
  | 'gemini-3-pro-image-preview'; // Premium model

// Maps model keys to actual Gemini API model IDs
const GEMINI_MODEL_IDS: Record<GeminiImageModel, string> = {
  'gemini-2.5-flash': 'gemini-2.5-flash-image',           // Legacy -> same API model
  'gemini-2.5-flash-image': 'gemini-2.5-flash-image',     // Direct mapping
  'gemini-3-pro-image-preview': 'gemini-2.5-flash-image', // TODO: Update when Pro image model available
};

const DEFAULT_GEMINI_MODEL: GeminiImageModel = 'gemini-2.5-flash-image';

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
 * Aggregated color palette from all mesh views
 * Used to ensure color consistency in texture generation
 */
export interface AggregatedColorPalette {
  byView: Record<PipelineMeshAngle, string[]>;  // Per-view palettes
  unified: string[];                             // All unique colors, sorted by frequency
  dominantColors: string[];                      // Top 7 most frequent colors
}

/**
 * Result of all 4 mesh views generation
 */
export interface MultiViewGenerationResult {
  meshViews: Record<PipelineMeshAngle, GeneratedViewResult>;
  aggregatedPalette?: AggregatedColorPalette;    // Color palette aggregated from mesh views
}

/**
 * Callback for progress updates during parallel generation
 */
export type ViewProgressCallback = (
  type: 'mesh',
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
  private imageAnalysis?: ImageAnalysisResult | null;  // Full image analysis for feature extraction
  private geminiModel: GeminiImageModel;  // Selected Gemini model for image generation
  private selectedStyle?: StyleId;  // User-selected figure style

  constructor(
    apiKey: string,
    modeId: GenerationModeId = DEFAULT_MODE,
    userDescription?: string | null,
    imageAnalysis?: ImageAnalysisResult | null,
    geminiModel: GeminiImageModel = DEFAULT_GEMINI_MODEL,
    selectedStyle?: StyleId
  ) {
    this.apiKey = apiKey;
    this.modeConfig = getMode(modeId);
    this.userDescription = userDescription;
    this.imageAnalysis = imageAnalysis;
    this.geminiModel = geminiModel;
    this.selectedStyle = selectedStyle;
  }

  /**
   * Get the current mode configuration
   */
  get mode(): ModeConfig {
    return this.modeConfig;
  }

  /**
   * Generate all 4 mesh views from a reference image
   *
   * @param referenceImageBase64 - Base64 encoded reference image
   * @param mimeType - MIME type of the input image
   * @returns All 4 generated mesh views
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
      totalViews: 4,
      meshSimplified: this.modeConfig.mesh.simplified,
    });

    const meshAngles: PipelineMeshAngle[] = ['front', 'back', 'left', 'right'];

    const meshViews: Partial<Record<PipelineMeshAngle, GeneratedViewResult>> = {};

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

      const prompt = getMeshPrompt(this.modeConfig, angle, this.userDescription, undefined, this.imageAnalysis, this.selectedStyle);
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

    functions.logger.info('Multi-view generation complete', {
      mode: this.modeConfig.id,
      meshViewCount: Object.keys(meshViews).length,
    });

    return {
      meshViews: meshViews as Record<PipelineMeshAngle, GeneratedViewResult>,
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
   * Generate all 4 mesh views using staggered parallel execution
   *
   * This method respects the 500ms rate limit while maximizing parallelism:
   * - Start 4 mesh views with 0, 500, 1000, 1500ms delays
   * - Aggregate color palette from mesh views
   *
   * Expected time: ~12s (vs ~32s for sequential)
   *
   * @param referenceImageBase64 - Base64 encoded reference image
   * @param mimeType - MIME type of the input image
   * @param onProgress - Optional callback for progress updates
   * @returns All 4 generated mesh views with aggregated color palette
   */
  async generateAllViewsParallel(
    referenceImageBase64: string,
    mimeType: string,
    onProgress?: ViewProgressCallback
  ): Promise<MultiViewGenerationResult> {
    const meshAngles: PipelineMeshAngle[] = ['front', 'back', 'left', 'right'];

    functions.logger.info('Starting parallel multi-view generation', {
      model: GEMINI_MODEL_IDS[this.geminiModel],
      geminiModel: this.geminiModel,
      mode: this.modeConfig.id,
      modeName: this.modeConfig.name,
      strategy: 'staggered-parallel',
      totalViews: 4,
    });

    // Staggered parallel mesh view generation
    let meshCompleted = 0;
    const meshPromises = meshAngles.map((angle, index) =>
      this.generateMeshViewWithDelay(
        referenceImageBase64,
        mimeType,
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

    functions.logger.info('Parallel multi-view generation complete', {
      mode: this.modeConfig.id,
      meshViewCount: Object.keys(meshViews).length,
      dominantColorCount: aggregatedPalette.dominantColors.length,
    });

    return {
      meshViews: meshViews as Record<PipelineMeshAngle, GeneratedViewResult>,
      aggregatedPalette,
    };
  }

  /**
   * Generate a single mesh view with a delay (for staggered parallel execution)
   */
  private async generateMeshViewWithDelay(
    referenceImageBase64: string,
    mimeType: string,
    angle: PipelineMeshAngle,
    delayMs: number
  ): Promise<GeneratedViewResult> {
    if (delayMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }

    functions.logger.info(`Generating mesh view: ${angle}`, {
      type: 'mesh',
      angle,
      delayMs,
      simplified: this.modeConfig.mesh.simplified,
    });

    const prompt = getMeshPrompt(this.modeConfig, angle, this.userDescription, undefined, this.imageAnalysis, this.selectedStyle);
    return this.generateSingleView(
      referenceImageBase64,
      mimeType,
      prompt,
      this.modeConfig.mesh.extractColors,
      this.modeConfig.mesh.colorCount
    );
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
    const prompt = getMeshPrompt(this.modeConfig, angle, this.userDescription, hint, this.imageAnalysis, this.selectedStyle);
    return this.generateSingleView(
      referenceImageBase64,
      mimeType,
      prompt,
      this.modeConfig.mesh.extractColors,
      this.modeConfig.mesh.colorCount
    );
  }

  /**
   * Generate remaining view angles from a styled reference image
   *
   * This is Phase 2 of the two-phase generation flow:
   * - Phase 1 generates a styled reference at the detected angle
   * - Phase 2 (this method) generates the remaining 3 angles from that reference
   *
   * The key difference from generateAllViews: the prompt emphasizes maintaining
   * EXACT style consistency with the reference, not applying style transformation.
   *
   * @param styledReferenceBase64 - Base64 encoded styled reference image
   * @param mimeType - MIME type of the reference image
   * @param sourceAngle - The angle of the styled reference (will be excluded)
   * @param referenceColorPalette - Color palette from the styled reference
   * @param onProgress - Optional callback for progress updates
   * @returns Views for the 3 remaining angles (excluding sourceAngle)
   */
  async generateViewsFromStyledReference(
    styledReferenceBase64: string,
    mimeType: string,
    sourceAngle: ViewAngle,
    referenceColorPalette: string[],
    onProgress?: ViewProgressCallback
  ): Promise<Partial<Record<PipelineMeshAngle, GeneratedViewResult>>> {
    // Determine which angles to generate (all except sourceAngle)
    const allAngles: PipelineMeshAngle[] = ['front', 'back', 'left', 'right'];
    const targetAngles = allAngles.filter((a) => a !== sourceAngle);

    functions.logger.info('Starting views from styled reference', {
      model: GEMINI_MODEL_IDS[this.geminiModel],
      sourceAngle,
      targetAngles,
      colorPaletteCount: referenceColorPalette.length,
      selectedStyle: this.selectedStyle,
    });

    // Staggered parallel generation
    let completed = 0;
    const promises = targetAngles.map((angle, index) =>
      this.generateViewFromReferenceWithDelay(
        styledReferenceBase64,
        mimeType,
        sourceAngle,
        angle,
        referenceColorPalette,
        index * MIN_DELAY_BETWEEN_CALLS_MS // 0, 500, 1000ms
      ).then(async (result) => {
        completed++;
        if (onProgress) {
          await onProgress('mesh', angle, completed, targetAngles.length);
        }
        return { angle, result };
      })
    );

    const results = await Promise.all(promises);

    // Build result record
    const views: Partial<Record<PipelineMeshAngle, GeneratedViewResult>> = {};
    for (const { angle, result } of results) {
      views[angle] = result;
    }

    functions.logger.info('Views from styled reference complete', {
      sourceAngle,
      generatedViews: Object.keys(views),
      viewCount: Object.keys(views).length,
    });

    return views;
  }

  /**
   * Generate a single view from styled reference with delay
   */
  private async generateViewFromReferenceWithDelay(
    styledReferenceBase64: string,
    mimeType: string,
    sourceAngle: ViewAngle,
    targetAngle: PipelineMeshAngle,
    referenceColorPalette: string[],
    delayMs: number
  ): Promise<GeneratedViewResult> {
    if (delayMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }

    functions.logger.info(`Generating view from reference: ${targetAngle}`, {
      sourceAngle,
      targetAngle,
      delayMs,
    });

    const prompt = this.buildFromReferencePrompt(sourceAngle, targetAngle, referenceColorPalette);
    return this.generateSingleView(
      styledReferenceBase64,
      mimeType,
      prompt,
      true, // Always extract colors for consistency
      7
    );
  }

  /**
   * Generate a single view from styled reference (for regeneration)
   *
   * @param styledReferenceBase64 - Base64 encoded styled reference image
   * @param mimeType - MIME type of the reference image
   * @param sourceAngle - The angle of the styled reference
   * @param targetAngle - The angle to generate
   * @param referenceColorPalette - Color palette from the styled reference
   * @param hint - Optional regeneration hint
   */
  async generateSingleViewFromReference(
    styledReferenceBase64: string,
    mimeType: string,
    sourceAngle: ViewAngle,
    targetAngle: PipelineMeshAngle,
    referenceColorPalette: string[],
    hint?: string
  ): Promise<GeneratedViewResult> {
    const prompt = this.buildFromReferencePrompt(sourceAngle, targetAngle, referenceColorPalette, hint);
    return this.generateSingleView(
      styledReferenceBase64,
      mimeType,
      prompt,
      true,
      7
    );
  }

  /**
   * Build prompt for generating a view from styled reference
   *
   * Key differences from regular mesh prompt:
   * - Input is already styled (no style transformation needed)
   * - Emphasizes EXACT consistency with reference (same style, proportions, colors)
   * - Only changes camera angle
   */
  private buildFromReferencePrompt(
    sourceAngle: ViewAngle,
    targetAngle: PipelineMeshAngle,
    referenceColorPalette: string[],
    hint?: string
  ): string {
    const styleConfig = this.selectedStyle ? getStyleConfig(this.selectedStyle) : null;
    const styleName = styleConfig?.name || 'styled';

    // Get view info for target angle
    const targetInfo = this.getAngleInfo(targetAngle);
    const sourceInfo = this.getAngleInfo(sourceAngle as PipelineMeshAngle);

    // Build color reference block
    const colorBlock = referenceColorPalette.length > 0
      ? `\nREFERENCE COLORS (use EXACTLY these colors):\n${referenceColorPalette.join(', ')}\n`
      : '';

    // Build hint block if provided
    const hintBlock = hint
      ? `\n=== USER ADJUSTMENT ===\nThe user requests: "${hint}"\nApply this adjustment while maintaining style consistency and correct angle.\n=== END USER ADJUSTMENT ===\n`
      : '';

    return `You are generating the ${targetAngle.toUpperCase()} VIEW from a styled reference image.

=== CRITICAL: STYLE CONSISTENCY ===

The reference image shows a ${styleName} figure from the ${sourceAngle.toUpperCase()} view.
You must generate the ${targetAngle.toUpperCase()} view of the EXACT SAME figure.

DO NOT CHANGE:
- The overall style or proportions
- The color palette (use exactly the same colors)
- Any distinctive features or accessories
- The level of detail or simplification

ONLY CHANGE:
- The camera angle: rotate from ${sourceAngle} (${sourceInfo.degrees}°) to ${targetAngle} (${targetInfo.degrees}°)

=== END STYLE CONSISTENCY ===
${colorBlock}
=== CAMERA POSITION ===

**SOURCE VIEW**: ${sourceAngle.toUpperCase()} (${sourceInfo.degrees}° - this is the reference image)
**TARGET VIEW**: ${targetAngle.toUpperCase()} (${targetInfo.degrees}° - generate this view)
**ROTATION**: ${Math.abs(targetInfo.degrees - sourceInfo.degrees)}° rotation

${targetInfo.description}

${targetInfo.sideCheck || ''}

=== END CAMERA POSITION ===

=== REQUIREMENTS ===

1. EXACT same figure appearance as the reference - same style, same colors, same proportions
2. Pure white background (#FFFFFF) - no shadows, no ground plane
3. Orthographic projection from ${targetAngle} position
4. Subject centered, fills 90% of frame
5. Completely flat lighting - no cast shadows
${hintBlock}
=== END REQUIREMENTS ===

After generating the image, output the colors used:
COLORS: #RRGGBB, #RRGGBB, #RRGGBB, #RRGGBB, #RRGGBB, #RRGGBB, #RRGGBB

Generate the ${targetAngle.toUpperCase()} view now.`;
  }

  /**
   * Get angle information for prompt building
   */
  private getAngleInfo(angle: PipelineMeshAngle): { degrees: number; description: string; sideCheck?: string } {
    switch (angle) {
      case 'front':
        return {
          degrees: 0,
          description: 'Front view: Face and front body visible, camera at 6 o\'clock position.',
        };
      case 'back':
        return {
          degrees: 180,
          description: 'Back view: Back of head/body visible, NO face visible, camera at 12 o\'clock position.',
        };
      case 'left':
        return {
          degrees: 90,
          description: 'Left side view: Subject\'s LEFT side visible, camera at 3 o\'clock position.',
          sideCheck: '⚠️ For characters: LEFT ear visible, nose points toward LEFT edge of image.',
        };
      case 'right':
        return {
          degrees: 270,
          description: 'Right side view: Subject\'s RIGHT side visible, camera at 9 o\'clock position.',
          sideCheck: '⚠️ For characters: RIGHT ear visible, nose points toward RIGHT edge of image.',
        };
    }
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

    // Build generation config for Flash model
    const generationConfig: Record<string, unknown> = {
      responseModalities: ['TEXT', 'IMAGE'],
    };

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
 * @param imageAnalysis - Optional full image analysis result with key features
 * @param geminiModel - Gemini model for image generation (default: 'gemini-2.5-flash')
 * @param selectedStyle - User-selected figure style (bobblehead, chibi, cartoon, emoji)
 */
export function createMultiViewGenerator(
  modeId: GenerationModeId = DEFAULT_MODE,
  userDescription?: string | null,
  imageAnalysis?: ImageAnalysisResult | null,
  geminiModel: GeminiImageModel = DEFAULT_GEMINI_MODEL,
  selectedStyle?: StyleId
): MultiViewGenerator {
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    throw new functions.https.HttpsError(
      'failed-precondition',
      'Gemini API key not configured'
    );
  }

  return new MultiViewGenerator(apiKey, modeId, userDescription, imageAnalysis, geminiModel, selectedStyle);
}
