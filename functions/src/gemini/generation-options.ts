import * as functions from 'firebase-functions';
import type { PipelineMeshAngle, ViewAngle } from '../rodin/types';

export type GeminiImageModel =
  | 'gemini-2.5-flash'
  | 'gemini-2.5-flash-image'
  | 'gemini-3-pro-image-preview';

export const DEFAULT_GEMINI_MODEL: GeminiImageModel = 'gemini-2.5-flash-image';

export function resolveGeminiImageModel(model: GeminiImageModel = DEFAULT_GEMINI_MODEL): string {
  if (model === 'gemini-2.5-flash') return 'gemini-2.5-flash-image';
  if (model === 'gemini-2.5-flash-image') return model;
  // Preserve saved UI settings while using the stable replacement for the retired preview.
  if (model === 'gemini-3-pro-image-preview') return 'gemini-3-pro-image';
  throw new functions.https.HttpsError('invalid-argument', 'Invalid Gemini image model');
}

export interface GenerationColors {
  colorCount?: number;
  colorPalette?: string[];
}

export function resolveGenerationColors(options: GenerationColors): Required<GenerationColors> {
  const palette = options.colorPalette ?? [];
  if (!Array.isArray(palette) || palette.length > 12 || palette.some(
    (color) => typeof color !== 'string' || !/^#[0-9a-f]{6}$/i.test(color)
  )) {
    throw new functions.https.HttpsError('invalid-argument', 'Use up to 12 valid HEX colors');
  }
  const colorCount = options.colorCount ?? 7;
  if (!Number.isInteger(colorCount) || colorCount < (palette.length ? 1 : 3) || colorCount > 12) {
    throw new functions.https.HttpsError('invalid-argument', 'Color count must be between 3 and 12');
  }
  // Edited swatches are the final choice; adding/removing a swatch changes the count.
  const colorPalette = [...new Set(palette.map((color) => color.toUpperCase()))];
  return { colorCount: colorPalette.length || colorCount, colorPalette };
}

export function buildGenerationColorPrompt(options: GenerationColors): string {
  const { colorCount, colorPalette } = resolveGenerationColors(options);
  return `=== USER COLOR REQUIREMENTS ===
Use ${colorCount} subject colors.${colorPalette.length ? ` Use ONLY these subject colors: ${colorPalette.join(', ')}. Preserve their assignments to the subject's features.` : ''}
The white background is separate from the subject palette.
These user-selected colors take precedence over colors inferred from the reference photo.
=== END USER COLOR REQUIREMENTS ===`;
}

export function assertSupportedReferenceAngle(angle: ViewAngle): asserts angle is PipelineMeshAngle {
  if (!['front', 'back', 'left', 'right'].includes(angle)) {
    throw new functions.https.HttpsError(
      'failed-precondition',
      'Top-view references are not supported yet. Upload a front or side photo and analyze it again.'
    );
  }
}
