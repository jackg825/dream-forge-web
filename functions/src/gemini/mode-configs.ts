/**
 * Generation Mode Configurations
 *
 * Defines different image generation modes for A/B testing 3D model quality.
 * Each mode specifies how mesh and texture images should be processed.
 */

import type { PipelineMeshAngle, PipelineTextureAngle } from '../rodin/types';

/**
 * Available generation mode IDs
 */
export type GenerationModeId = 'simplified-mesh' | 'simplified-texture';

/**
 * Configuration for a single image type (mesh or texture)
 */
export interface ImageTypeConfig {
  colorCount: number;
  simplified: boolean;
  extractColors: boolean;
}

/**
 * Complete mode configuration
 */
export interface ModeConfig {
  id: GenerationModeId;
  name: string;
  description: string;
  mesh: ImageTypeConfig;
  texture: ImageTypeConfig;
}

/**
 * Default generation mode
 */
export const DEFAULT_MODE: GenerationModeId = 'simplified-mesh';

/**
 * Mode A: Simplified Mesh (Current behavior)
 * - Mesh images: 7-color simplified, no shadows
 * - Texture images: Full color, soft lighting
 */
const MODE_SIMPLIFIED_MESH: ModeConfig = {
  id: 'simplified-mesh',
  name: '模式 A: 簡化網格',
  description: '網格用圖片 7 色簡化，貼圖用圖片保留全彩',
  mesh: {
    colorCount: 7,
    simplified: true,
    extractColors: true,
  },
  texture: {
    colorCount: 0, // Full color
    simplified: false,
    extractColors: false,
  },
};

/**
 * Mode B: Simplified Texture (New mode for A/B testing)
 * - Mesh images: Full color, soft lighting
 * - Texture images: 6-color simplified, no shadows
 */
const MODE_SIMPLIFIED_TEXTURE: ModeConfig = {
  id: 'simplified-texture',
  name: '模式 B: 簡化貼圖',
  description: '網格用圖片保留全彩，貼圖用圖片 6 色簡化',
  mesh: {
    colorCount: 0, // Full color
    simplified: false,
    extractColors: false,
  },
  texture: {
    colorCount: 6,
    simplified: true,
    extractColors: true,
  },
};

/**
 * All available generation modes
 */
export const GENERATION_MODES: Record<GenerationModeId, ModeConfig> = {
  'simplified-mesh': MODE_SIMPLIFIED_MESH,
  'simplified-texture': MODE_SIMPLIFIED_TEXTURE,
};

/**
 * Get mode configuration by ID
 */
export function getMode(id: GenerationModeId): ModeConfig {
  const mode = GENERATION_MODES[id];
  if (!mode) {
    throw new Error(`Unknown generation mode: ${id}`);
  }
  return mode;
}

// =============================================================================
// Prompt Templates
// =============================================================================

/**
 * Angle display names for prompts
 */
const ANGLE_PROMPTS: Record<PipelineMeshAngle, string> = {
  front: 'FRONT',
  back: 'BACK (rotated 180°)',
  left: 'LEFT SIDE (rotated 90° counterclockwise)',
  right: 'RIGHT SIDE (rotated 90° clockwise)',
};

const TEXTURE_ANGLE_PROMPTS: Record<PipelineTextureAngle, string> = {
  front: 'FRONT',
  back: 'BACK (rotated 180°)',
};

/**
 * Generate mesh view prompt based on mode and angle
 */
export function getMeshPrompt(mode: ModeConfig, angle: PipelineMeshAngle): string {
  const angleDisplay = ANGLE_PROMPTS[angle];

  if (mode.mesh.simplified) {
    // Simplified mode: 7-color, flat lighting, no shadows
    return `You are an expert at preparing reference images for 3D printing mesh generation.

Generate a ${angleDisplay} VIEW of this object optimized for 3D mesh reconstruction.

CRITICAL REQUIREMENTS:
1. ORTHOGRAPHIC VIEW - No perspective distortion, show from directly ${angle === 'front' ? 'in front, centered' : angle === 'back' ? 'behind (180° from front)' : angle === 'left' ? 'left side (90° CCW from front)' : 'right side (90° CW from front)'}
2. NO SHADOWS - Remove ALL shadows completely (no drop shadows, no cast shadows, no ambient occlusion)
3. FLAT LIGHTING - Use completely uniform, flat lighting with no highlights or shading gradients
4. Reduce to exactly ${mode.mesh.colorCount} distinct SOLID colors (no gradients, no anti-aliasing, no soft edges)
5. HARD EDGES - All color boundaries must be pixel-sharp, no blending
6. Pure white background (#FFFFFF)
7. Object should fill 80-90% of the frame
8. Maintain accurate proportions and all structural details

The output image will be used by AI to generate a 3D printable mesh. Shadows and lighting variations will cause incorrect geometry.

After the image, list the ${mode.mesh.colorCount} colors used: COLORS: ${Array(mode.mesh.colorCount).fill('#RRGGBB').join(', ')}

Generate the actual image, not a description.`;
  } else {
    // Full color mode: preserve details, soft lighting
    return `You are an expert at preparing reference images for 3D mesh generation.

Generate a ${angleDisplay} VIEW of this object optimized for 3D mesh reconstruction.

REQUIREMENTS:
1. ORTHOGRAPHIC VIEW - No perspective distortion, show from directly ${angle === 'front' ? 'in front, centered' : angle === 'back' ? 'behind (180° from front)' : angle === 'left' ? 'left side (90° CCW from front)' : 'right side (90° CW from front)'}
2. NO HARSH SHADOWS - Use soft, diffuse lighting only
3. PRESERVE COLORS - Keep full color detail and surface textures
4. Pure white background (#FFFFFF)
5. Object should fill 80-90% of the frame
6. High-resolution surface detail
7. Maintain accurate proportions matching other views

Generate the actual image, not a description.`;
  }
}

/**
 * Generate texture view prompt based on mode and angle
 */
export function getTexturePrompt(mode: ModeConfig, angle: PipelineTextureAngle): string {
  const angleDisplay = TEXTURE_ANGLE_PROMPTS[angle];

  if (mode.texture.simplified) {
    // Simplified mode: 6-color, flat lighting, no shadows
    return `You are an expert at preparing texture reference images for 3D printed models.

Generate a ${angleDisplay} VIEW of this object optimized for texture mapping.

CRITICAL REQUIREMENTS:
1. ORTHOGRAPHIC VIEW - No perspective distortion, show from directly ${angle === 'front' ? 'in front, centered' : 'behind (180° from front)'}
2. NO SHADOWS - Remove ALL shadows completely
3. FLAT LIGHTING - Uniform lighting with no gradients
4. Reduce to exactly ${mode.texture.colorCount} distinct SOLID colors (no gradients)
5. HARD EDGES - All color boundaries must be pixel-sharp
6. Pure white background (#FFFFFF)
7. Object should fill 80-90% of the frame
8. Maintain exact proportions matching mesh views

After the image, list the ${mode.texture.colorCount} colors used: COLORS: ${Array(mode.texture.colorCount).fill('#RRGGBB').join(', ')}

Generate the actual image, not a description.`;
  } else {
    // Full color mode: preserve details for texture mapping
    return `You are an expert at preparing texture reference images for 3D printed models.

Generate a ${angleDisplay} VIEW of this object optimized for texture mapping onto a 3D printed mesh.

REQUIREMENTS:
1. ORTHOGRAPHIC VIEW - No perspective distortion, show from directly ${angle === 'front' ? 'in front, centered' : 'behind (180° from front)'}
2. NO HARSH SHADOWS - Use soft, diffuse lighting only. Shadows would bake incorrectly into the texture
3. PRESERVE COLORS - Keep full color detail, natural gradients, and surface textures
4. High-resolution surface detail for quality texture mapping
5. Pure white background (#FFFFFF)
6. Object should fill 80-90% of the frame
7. Maintain exact proportions matching the reference image

The texture will be applied to a 3D printed model, so accurate colors without lighting artifacts are essential.

Generate the actual image, not a description.`;
  }
}
