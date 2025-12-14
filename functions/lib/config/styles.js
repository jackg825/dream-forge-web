"use strict";
/**
 * Style Configuration for Dream Forge Backend
 *
 * Mirror of frontend config for use in Cloud Functions.
 * Contains prompt modifiers used by Gemini for multi-view generation.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.STYLE_CONFIGS = exports.DEFAULT_STYLE = exports.STYLE_IDS = void 0;
exports.isValidStyleId = isValidStyleId;
exports.getStyleConfig = getStyleConfig;
/**
 * All available style IDs
 */
exports.STYLE_IDS = ['bobblehead', 'chibi', 'cartoon', 'emoji'];
/**
 * Default style when none selected
 */
exports.DEFAULT_STYLE = 'chibi';
/**
 * Validate if a string is a valid StyleId
 */
function isValidStyleId(value) {
    return value !== undefined && exports.STYLE_IDS.includes(value);
}
/**
 * Style configurations with prompt engineering
 */
exports.STYLE_CONFIGS = {
    bobblehead: {
        id: 'bobblehead',
        name: 'Bobblehead',
        promptModifiers: {
            meshStyle: 'Transform into a classic bobblehead collectible figure. ' +
                'The head should be dramatically oversized (3-4 times larger than body). ' +
                'Thin cylindrical neck connection (like a spring mount). ' +
                'Small compact body with simplified limbs. ' +
                'Flat circular base for stability. ' +
                'Smooth vinyl toy finish with subtle glossy sheen.',
            textureStyle: 'Bobblehead vinyl toy texture. ' +
                'Clean solid colors with slight plastic sheen. ' +
                'Simplified facial features - large eyes, friendly expression. ' +
                'No fabric textures - all surfaces appear as smooth vinyl.',
            proportions: 'Head: 3-4x body size. ' +
                'Neck: Thin cylindrical spring mount. ' +
                'Body: Compact, 1/3 to 1/4 of total height. ' +
                'Base: Flat circular platform.',
            features: 'Emphasize facial features and hair. ' +
                'Simplify body details. ' +
                'Exaggerate distinctive characteristics (glasses, hat, etc). ' +
                'Round all edges for toy-safe appearance.',
        },
    },
    chibi: {
        id: 'chibi',
        name: 'Chibi',
        promptModifiers: {
            meshStyle: 'Transform into an adorable chibi anime figure. ' +
                'Head is 2-3 times larger than body (classic 2-3 head proportion). ' +
                'Large sparkly anime eyes taking up 1/3 of face. ' +
                'Tiny stubby limbs with rounded hands and feet. ' +
                'Soft rounded forms throughout - no sharp edges. ' +
                'Optional: subtle blush marks on cheeks.',
            textureStyle: 'Chibi anime figure texture. ' +
                'Smooth matte finish like quality anime figurines. ' +
                'Large expressive eyes with highlights. ' +
                'Soft gradients on skin and hair. ' +
                'Clean cel-shaded appearance.',
            proportions: 'Head: 2-3x body size (2-3 head tall total). ' +
                'Eyes: Large, 1/3 of face height. ' +
                'Body: Stubby, rounded. ' +
                'Limbs: Short and thick.',
            features: 'Focus on cute expression and large eyes. ' +
                'Simplify clothing details. ' +
                'Add blush marks for extra cuteness. ' +
                'Hair should be stylized but recognizable.',
        },
    },
    cartoon: {
        id: 'cartoon',
        name: 'Cartoon',
        promptModifiers: {
            meshStyle: 'Transform into a stylized 3D cartoon character (Pixar/Disney style). ' +
                'Slightly exaggerated proportions (head 1.5-2x normal). ' +
                'Expressive pose with personality. ' +
                'Dynamic silhouette with clear gesture. ' +
                'Smooth stylized forms, not realistic. ' +
                'Clean topology suitable for animation.',
            textureStyle: 'Cartoon character texture (Pixar/Disney quality). ' +
                'Vibrant saturated colors. ' +
                'Soft subsurface scattering on skin. ' +
                'Stylized but detailed - not flat. ' +
                'Expressive eyes with subtle reflections.',
            proportions: 'Head: 1.5-2x realistic proportions. ' +
                'Body: Stylized but functional. ' +
                'Hands: Slightly large for expressiveness. ' +
                'Overall: Appeal and personality over realism.',
            features: 'Capture personality and expression. ' +
                'Exaggerate defining characteristics. ' +
                'Clear silhouette readable from any angle. ' +
                'Dynamic pose if appropriate.',
        },
    },
    emoji: {
        id: 'emoji',
        name: 'Emoji',
        promptModifiers: {
            meshStyle: 'Transform into an emoji-style 3D figure. ' +
                'The head IS the body - spherical or pill-shaped form. ' +
                'Extremely simplified: face on a round shape. ' +
                'Tiny or no limbs (small hands/feet if needed). ' +
                'Maximum 3-4 colors total. ' +
                'Clean geometric forms, no complex details.',
            textureStyle: 'Emoji flat texture style. ' +
                'Solid flat colors, no gradients. ' +
                'Bold simple shapes for features. ' +
                'High contrast - yellow, black, red typical. ' +
                'Clean vector-like appearance.',
            proportions: 'Head/Body: Merged into single spherical form. ' +
                'Features: Minimal, iconic. ' +
                'Limbs: Optional, very small if present. ' +
                'Overall: Icon-like simplicity.',
            features: 'Focus ONLY on expression. ' +
                'Remove all unnecessary details. ' +
                'Use iconic shapes (circles, curves). ' +
                'Maximum recognizability at small sizes.',
        },
    },
};
/**
 * Get style config by ID with fallback to default
 */
function getStyleConfig(styleId) {
    return exports.STYLE_CONFIGS[styleId || exports.DEFAULT_STYLE];
}
//# sourceMappingURL=styles.js.map