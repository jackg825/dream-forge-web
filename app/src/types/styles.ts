/**
 * Style System Types for Dream Forge
 *
 * Defines the 4 figure styles available for 3D generation:
 * - Bobblehead: Large head, spring neck, vinyl finish
 * - Chibi: Anime style, cute proportions
 * - Cartoon: Pixar/Disney style, expressive
 * - Emoji: Minimalist, spherical, expression-focused
 */

/**
 * Available style identifiers
 */
export type StyleId = 'bobblehead' | 'chibi' | 'cartoon' | 'emoji';

/**
 * Prompt modifiers for different generation stages
 */
export interface StylePromptModifiers {
  /** Style description for mesh view generation */
  meshStyle: string;
  /** Style description for texture view generation */
  textureStyle: string;
  /** Body proportion guidelines */
  proportions: string;
  /** Feature emphasis guidelines */
  features: string;
}

/**
 * Visual characteristics for UI display
 */
export interface StyleCharacteristics {
  /** Head to body ratio description */
  headRatio: string;
  /** Body style description */
  bodyStyle: string;
  /** Face/expression emphasis */
  faceEmphasis: string;
  /** Color usage approach */
  colorApproach: string;
}

/**
 * Complete style configuration
 */
export interface StyleConfig {
  id: StyleId;
  name: string;
  nameZh: string;
  description: string;
  descriptionZh: string;
  /** Prompt modifiers for image generation */
  promptModifiers: StylePromptModifiers;
  /** Preview image paths (6 per style) */
  previewImages: string[];
  /** Visual characteristics for UI */
  characteristics: StyleCharacteristics;
}

/**
 * Style recommendation from AI analysis
 */
export interface StyleRecommendation {
  /** Recommended style ID */
  recommendedStyle: StyleId;
  /** Confidence score 0-1 */
  styleConfidence: number;
  /** Reasoning in user's language */
  styleReasoning?: string;
}

/**
 * Default style when none selected
 */
export const DEFAULT_STYLE: StyleId = 'chibi';

/**
 * All available style IDs for validation
 */
export const STYLE_IDS: StyleId[] = ['bobblehead', 'chibi', 'cartoon', 'emoji'];

/**
 * Validate if a string is a valid StyleId
 */
export function isValidStyleId(value: string): value is StyleId {
  return STYLE_IDS.includes(value as StyleId);
}
