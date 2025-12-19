/**
 * Style Configuration for Dream Forge
 *
 * Each style defines:
 * - Visual characteristics for UI display
 * - Prompt modifiers that shape AI generation
 * - Preview images for user selection
 *
 * The promptModifiers are CRITICAL - they directly control
 * how Gemini generates multi-view images and how 3D providers
 * interpret the style intent.
 */

import type { StyleConfig, StyleId } from '@/types/styles';

// Re-export for convenience
export type { StyleConfig } from '@/types/styles';

/**
 * Style configurations with prompt engineering for each style
 *
 * CUSTOMIZATION OPPORTUNITY:
 * The `promptModifiers` can be fine-tuned based on generation results.
 * Test different phrasings and adjust for optimal output quality.
 */
export const STYLE_CONFIGS: Record<StyleId, StyleConfig> = {
  none: {
    id: 'none',
    name: 'None',
    nameZh: '無',
    description: 'Preserve original photo style without transformation',
    descriptionZh: '保持上傳照片原始模樣及風格',
    promptModifiers: {
      meshStyle:
        'Preserve the original appearance and style of the subject exactly as shown. ' +
        'Do not apply any stylization or transformation. ' +
        'Maintain realistic proportions and natural appearance. ' +
        'Keep all details, textures, and characteristics as they are.',
      textureStyle:
        'Preserve original textures and materials exactly as shown. ' +
        'Maintain natural skin tones, fabric textures, and surface details. ' +
        'No stylization - keep photorealistic appearance.',
      proportions:
        'Maintain original realistic proportions. ' +
        'No exaggeration or stylization of body parts. ' +
        'Keep natural human proportions.',
      features:
        'Preserve all original features without modification. ' +
        'Maintain natural facial features and expressions. ' +
        'Keep clothing and accessories as they appear.',
    },
    previewImages: [], // No preview images - shows original style
    characteristics: {
      headRatio: '原始比例',
      bodyStyle: '保持原貌',
      faceEmphasis: '自然外觀',
      colorApproach: '原始色彩',
    },
  },

  bobblehead: {
    id: 'bobblehead',
    name: 'Bobblehead',
    nameZh: '搖頭公仔',
    description: 'Classic bobblehead with oversized head on spring neck',
    descriptionZh: '大頭配小身體，經典搖頭公仔風格',
    promptModifiers: {
      meshStyle:
        'Transform into a classic bobblehead collectible figure. ' +
        'The head should be dramatically oversized (3-4 times larger than body). ' +
        'Thin cylindrical neck connection (like a spring mount). ' +
        'Small compact body with simplified limbs. ' +
        'Flat circular base for stability. ' +
        'Smooth vinyl toy finish with subtle glossy sheen.',
      textureStyle:
        'Bobblehead vinyl toy texture. ' +
        'Clean solid colors with slight plastic sheen. ' +
        'Simplified facial features - large eyes, friendly expression. ' +
        'No fabric textures - all surfaces appear as smooth vinyl.',
      proportions:
        'Head: 3-4x body size. ' +
        'Neck: Thin cylindrical spring mount. ' +
        'Body: Compact, 1/3 to 1/4 of total height. ' +
        'Base: Flat circular platform.',
      features:
        'Emphasize facial features and hair. ' +
        'Simplify body details. ' +
        'Exaggerate distinctive characteristics (glasses, hat, etc). ' +
        'Round all edges for toy-safe appearance.',
    },
    previewImages: [
      '/styles/bobblehead/preview-1.webp',
      '/styles/bobblehead/preview-2.webp',
      '/styles/bobblehead/preview-3.webp',
      '/styles/bobblehead/preview-4.webp',
      '/styles/bobblehead/preview-5.webp',
      '/styles/bobblehead/preview-6.webp',
    ],
    characteristics: {
      headRatio: '3-4x 身體大小',
      bodyStyle: '小巧緊湊，有底座',
      faceEmphasis: '誇張的臉部特徵',
      colorApproach: '乾淨的實色，光澤質感',
    },
  },

  chibi: {
    id: 'chibi',
    name: 'Chibi',
    nameZh: 'Q版',
    description: 'Cute anime-style with big head and small body',
    descriptionZh: '日式可愛 Q 版風格，大頭小身體的萌系造型',
    promptModifiers: {
      meshStyle:
        'Transform into an adorable chibi anime figure. ' +
        'Head is 2-3 times larger than body (classic 2-3 head proportion). ' +
        'Large sparkly anime eyes taking up 1/3 of face. ' +
        'Tiny stubby limbs with rounded hands and feet. ' +
        'Soft rounded forms throughout - no sharp edges. ' +
        'Optional: subtle blush marks on cheeks.',
      textureStyle:
        'Chibi anime figure texture. ' +
        'Smooth matte finish like quality anime figurines. ' +
        'Large expressive eyes with highlights. ' +
        'Soft gradients on skin and hair. ' +
        'Clean cel-shaded appearance.',
      proportions:
        'Head: 2-3x body size (2-3 head tall total). ' +
        'Eyes: Large, 1/3 of face height. ' +
        'Body: Stubby, rounded. ' +
        'Limbs: Short and thick.',
      features:
        'Focus on cute expression and large eyes. ' +
        'Simplify clothing details. ' +
        'Add blush marks for extra cuteness. ' +
        'Hair should be stylized but recognizable.',
    },
    previewImages: [
      '/styles/chibi/preview-1.webp',
      '/styles/chibi/preview-2.webp',
      '/styles/chibi/preview-3.webp',
      '/styles/chibi/preview-4.webp',
      '/styles/chibi/preview-5.webp',
      '/styles/chibi/preview-6.webp',
    ],
    characteristics: {
      headRatio: '2-3 頭身比例',
      bodyStyle: '圓潤短小的四肢',
      faceEmphasis: '大眼睛，可愛表情',
      colorApproach: '柔和漸層，動漫風格',
    },
  },

  cartoon: {
    id: 'cartoon',
    name: 'Cartoon',
    nameZh: '卡通',
    description: 'Stylized cartoon character with personality',
    descriptionZh: '風格化卡通角色，誇張的特徵和鮮明的個性',
    promptModifiers: {
      meshStyle:
        'Transform into a stylized 3D cartoon character (Pixar/Disney style). ' +
        'Slightly exaggerated proportions (head 1.5-2x normal). ' +
        'Expressive pose with personality. ' +
        'Dynamic silhouette with clear gesture. ' +
        'Smooth stylized forms, not realistic. ' +
        'Clean topology suitable for animation.',
      textureStyle:
        'Cartoon character texture (Pixar/Disney quality). ' +
        'Vibrant saturated colors. ' +
        'Soft subsurface scattering on skin. ' +
        'Stylized but detailed - not flat. ' +
        'Expressive eyes with subtle reflections.',
      proportions:
        'Head: 1.5-2x realistic proportions. ' +
        'Body: Stylized but functional. ' +
        'Hands: Slightly large for expressiveness. ' +
        'Overall: Appeal and personality over realism.',
      features:
        'Capture personality and expression. ' +
        'Exaggerate defining characteristics. ' +
        'Clear silhouette readable from any angle. ' +
        'Dynamic pose if appropriate.',
    },
    previewImages: [
      '/styles/cartoon/preview-1.webp',
      '/styles/cartoon/preview-2.webp',
      '/styles/cartoon/preview-3.webp',
      '/styles/cartoon/preview-4.webp',
      '/styles/cartoon/preview-5.webp',
      '/styles/cartoon/preview-6.webp',
    ],
    characteristics: {
      headRatio: '1.5-2x 正常比例',
      bodyStyle: '風格化但完整',
      faceEmphasis: '個性表情，生動傳神',
      colorApproach: '鮮豔飽和，立體感',
    },
  },

  emoji: {
    id: 'emoji',
    name: 'Emoji',
    nameZh: '表情符號',
    description: 'Minimalist emoji-style, spherical and expressive',
    descriptionZh: '極簡表情符號風格，圓形為主，專注表情表達',
    promptModifiers: {
      meshStyle:
        'Transform into an emoji-style 3D figure. ' +
        'The head IS the body - spherical or pill-shaped form. ' +
        'Extremely simplified: face on a round shape. ' +
        'Tiny or no limbs (small hands/feet if needed). ' +
        'Maximum 3-4 colors total. ' +
        'Clean geometric forms, no complex details.',
      textureStyle:
        'Emoji flat texture style. ' +
        'Solid flat colors, no gradients. ' +
        'Bold simple shapes for features. ' +
        'High contrast - yellow, black, red typical. ' +
        'Clean vector-like appearance.',
      proportions:
        'Head/Body: Merged into single spherical form. ' +
        'Features: Minimal, iconic. ' +
        'Limbs: Optional, very small if present. ' +
        'Overall: Icon-like simplicity.',
      features:
        'Focus ONLY on expression. ' +
        'Remove all unnecessary details. ' +
        'Use iconic shapes (circles, curves). ' +
        'Maximum recognizability at small sizes.',
    },
    previewImages: [
      '/styles/emoji/preview-1.webp',
      '/styles/emoji/preview-2.webp',
      '/styles/emoji/preview-3.webp',
      '/styles/emoji/preview-4.webp',
      '/styles/emoji/preview-5.webp',
      '/styles/emoji/preview-6.webp',
    ],
    characteristics: {
      headRatio: '頭即身體（球形）',
      bodyStyle: '極簡幾何形狀',
      faceEmphasis: '只有表情，沒有細節',
      colorApproach: '3-4 色，純色塊',
    },
  },
};

/**
 * Get style config by ID with fallback
 */
export function getStyleConfig(styleId: StyleId | undefined): StyleConfig {
  return STYLE_CONFIGS[styleId || 'chibi'];
}

/**
 * Get all style configs as array for iteration
 */
export function getAllStyles(): StyleConfig[] {
  return Object.values(STYLE_CONFIGS);
}

/**
 * Style options for UI selector (simplified)
 */
export const STYLE_OPTIONS = Object.values(STYLE_CONFIGS).map((style) => ({
  id: style.id,
  name: style.name,
  nameZh: style.nameZh,
  description: style.description,
  descriptionZh: style.descriptionZh,
  thumbnail: style.previewImages[0],
}));
