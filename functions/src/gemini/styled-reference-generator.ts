/**
 * Styled Reference Generator for Pipeline Workflow
 *
 * Generates a single styled, background-removed reference image from the original photo.
 * This reference image is then used as the source for generating consistent multi-view images.
 *
 * Phase 1 of the two-phase generation flow:
 * 1. Original image → Styled reference (this module)
 * 2. Styled reference → Multi-view images (multi-view-generator.ts)
 */

import axios from 'axios';
import * as functions from 'firebase-functions';
import type { GeminiResponse, GeminiResponseAnalysis } from './types';
import type { ViewAngle, ImageAnalysisResult } from '../rodin/types';
import { type StyleId, getStyleConfig } from '../config/styles';

const GEMINI_API_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';
const GEMINI_MODEL_ID = 'gemini-2.5-flash-image';

/**
 * Result of styled reference generation
 */
export interface StyledReferenceResult {
  /** Base64 encoded styled image */
  imageBase64: string;
  /** MIME type of the generated image */
  mimeType: string;
  /** The view angle this reference represents */
  sourceAngle: ViewAngle;
  /** Extracted color palette (7 dominant colors) */
  colorPalette: string[];
}

/**
 * Options for styled reference generation
 */
export interface StyledReferenceOptions {
  /** Detected view angle of the original image */
  detectedAngle: ViewAngle;
  /** Selected figure style (bobblehead, chibi, cartoon, emoji, none) */
  style: StyleId;
  /** Image analysis result for context */
  imageAnalysis?: ImageAnalysisResult | null;
  /** User-provided description of the object */
  userDescription?: string | null;
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
function extractColorPalette(text: string | null): string[] {
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
    return uniqueColors.slice(0, 7);
  }

  return [];
}

/**
 * Build human-readable view angle description
 */
function getViewAngleDescription(angle: ViewAngle): string {
  const descriptions: Record<ViewAngle, string> = {
    front: 'directly facing the camera (front view)',
    back: 'facing away from the camera (back view)',
    left: 'with the left side visible (left view)',
    right: 'with the right side visible (right view)',
    top: 'viewed from above (top-down view)',
  };
  return descriptions[angle];
}

/**
 * Build the prompt for styled reference generation
 */
function buildStyledReferencePrompt(options: StyledReferenceOptions): string {
  const { detectedAngle, style, imageAnalysis, userDescription } = options;
  const styleConfig = getStyleConfig(style);
  const viewDescription = getViewAngleDescription(detectedAngle);

  // Build subject description from analysis or user input
  let subjectDescription = 'the subject in the image';
  if (userDescription) {
    subjectDescription = userDescription;
  } else if (imageAnalysis?.promptDescription) {
    subjectDescription = imageAnalysis.promptDescription;
  } else if (imageAnalysis?.description) {
    subjectDescription = imageAnalysis.description;
  }

  // Build key features context if available
  let keyFeaturesContext = '';
  if (imageAnalysis?.keyFeatures) {
    const kf = imageAnalysis.keyFeatures;
    const featureLines: string[] = [];
    if (kf.ears?.present) featureLines.push(`Ears: ${kf.ears.description || 'present'}`);
    if (kf.tail?.present) featureLines.push(`Tail: ${kf.tail.description || 'present'}`);
    if (kf.limbs) featureLines.push(`Limbs: ${kf.limbs}`);
    if (kf.accessories?.length) featureLines.push(`Accessories: ${kf.accessories.join(', ')}`);
    if (kf.distinctiveMarks?.length) featureLines.push(`Distinctive marks: ${kf.distinctiveMarks.join(', ')}`);
    if (kf.surfaceTextures?.length) featureLines.push(`Surface textures: ${kf.surfaceTextures.join(', ')}`);
    if (featureLines.length > 0) {
      keyFeaturesContext = `
KEY FEATURES TO PRESERVE:
${featureLines.map((f) => `- ${f}`).join('\n')}
`;
    }
  }

  // Handle "none" style differently - preserve original appearance
  if (style === 'none') {
    return `You are generating a REFERENCE IMAGE for 3D model generation.

INPUT: A photo of ${subjectDescription}, ${viewDescription}.

TASK: Create a clean, background-removed version of this subject while preserving its original appearance.
${keyFeaturesContext}
REQUIREMENTS:
1. REMOVE the background completely - output pure white background (#FFFFFF)
2. PRESERVE the original appearance, proportions, and style exactly as shown
3. MAINTAIN the exact same camera angle (${detectedAngle} view)
4. Keep all details, textures, colors, and characteristics unchanged
5. Output should be suitable for 3D modeling software

IMPORTANT: Do NOT apply any stylization. Keep the subject looking natural and realistic.

After generating the image, also output a color palette:
COLORS: Extract the 7 most prominent colors from the subject as hex codes, comma-separated.
Format: COLORS: #RRGGBB, #RRGGBB, #RRGGBB, #RRGGBB, #RRGGBB, #RRGGBB, #RRGGBB`;
  }

  // For other styles, apply transformation
  return `You are generating a STYLED REFERENCE IMAGE for 3D figure generation.

INPUT: A photo of ${subjectDescription}, ${viewDescription}.

TARGET STYLE: ${styleConfig.name.toUpperCase()}
${keyFeaturesContext}
STYLE TRANSFORMATION:
${styleConfig.promptModifiers.meshStyle}

PROPORTIONS:
${styleConfig.promptModifiers.proportions}

FEATURE EMPHASIS:
${styleConfig.promptModifiers.features}

REQUIREMENTS:
1. TRANSFORM the subject into the ${styleConfig.name} style while maintaining recognizability
2. REMOVE the background completely - output pure white background (#FFFFFF)
3. MAINTAIN the exact same camera angle (${detectedAngle} view) - do not rotate or change perspective
4. Apply the style transformation CONSISTENTLY to the entire subject
5. Preserve key identifying features (distinctive marks, accessories, etc.)
6. Output should be suitable as a reference for generating other view angles

CRITICAL: This image will be used as the SINGLE REFERENCE for generating all other view angles.
The style, colors, and proportions you establish here will be replicated in all subsequent views.
Be precise and consistent with the style application.

After generating the image, also output a color palette:
COLORS: Extract the 7 most prominent colors from the styled figure as hex codes, comma-separated.
Format: COLORS: #RRGGBB, #RRGGBB, #RRGGBB, #RRGGBB, #RRGGBB, #RRGGBB, #RRGGBB`;
}

/**
 * Generate a styled reference image from the original photo
 *
 * This creates a single styled, background-removed image that serves as the
 * reference for generating all other view angles with consistent styling.
 *
 * @param referenceImageBase64 - Base64 encoded original image
 * @param mimeType - MIME type of the input image
 * @param options - Generation options including style and detected angle
 * @returns Styled reference image with metadata
 */
export async function generateStyledReference(
  referenceImageBase64: string,
  mimeType: string,
  options: StyledReferenceOptions
): Promise<StyledReferenceResult> {
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    throw new functions.https.HttpsError(
      'failed-precondition',
      'Gemini API key not configured'
    );
  }

  const { detectedAngle, style } = options;

  functions.logger.info('Generating styled reference image', {
    model: GEMINI_MODEL_ID,
    style,
    detectedAngle,
    hasImageAnalysis: !!options.imageAnalysis,
    hasUserDescription: !!options.userDescription,
  });

  const prompt = buildStyledReferencePrompt(options);

  const response = await axios.post<GeminiResponse>(
    `${GEMINI_API_BASE}/${GEMINI_MODEL_ID}:generateContent`,
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
      },
    },
    {
      headers: {
        'Content-Type': 'application/json',
      },
      params: {
        key: apiKey,
      },
      timeout: 90000, // 90 second timeout
    }
  );

  const analysis = analyzeGeminiResponse(response.data);

  functions.logger.info('Styled reference generation response', {
    model: GEMINI_MODEL_ID,
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
      `No image returned from Gemini for styled reference.${textInfo}`
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

  functions.logger.info('Styled reference generation complete', {
    style,
    sourceAngle: detectedAngle,
    colorCount: colorPalette.length,
    colorPalette,
  });

  return {
    imageBase64: imagePart.inlineData!.data,
    mimeType:
      responseMimeType && validMimeTypes.includes(responseMimeType)
        ? responseMimeType
        : 'image/png',
    sourceAngle: detectedAngle,
    colorPalette,
  };
}
