/**
 * Style Configuration for Dream Forge Backend
 *
 * Mirror of frontend config for use in Cloud Functions.
 * Contains prompt modifiers used by Gemini for multi-view generation.
 */
/**
 * Available style identifiers
 */
export type StyleId = 'bobblehead' | 'chibi' | 'cartoon' | 'emoji';
/**
 * Prompt modifiers for different generation stages
 */
export interface StylePromptModifiers {
    meshStyle: string;
    textureStyle: string;
    proportions: string;
    features: string;
}
/**
 * Style configuration for backend use
 */
export interface StyleConfig {
    id: StyleId;
    name: string;
    promptModifiers: StylePromptModifiers;
}
/**
 * All available style IDs
 */
export declare const STYLE_IDS: StyleId[];
/**
 * Default style when none selected
 */
export declare const DEFAULT_STYLE: StyleId;
/**
 * Validate if a string is a valid StyleId
 */
export declare function isValidStyleId(value: string | undefined): value is StyleId;
/**
 * Style configurations with prompt engineering
 */
export declare const STYLE_CONFIGS: Record<StyleId, StyleConfig>;
/**
 * Get style config by ID with fallback to default
 */
export declare function getStyleConfig(styleId: StyleId | undefined): StyleConfig;
