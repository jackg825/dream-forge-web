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
 * @param mode - The generation mode configuration
 * @param angle - The view angle to generate
 * @param userDescription - Optional user-provided description of the object
 * @param hint - Optional regeneration hint for adjustments
 */
export function getMeshPrompt(
  mode: ModeConfig,
  angle: PipelineMeshAngle,
  userDescription?: string | null,
  hint?: string
): string {
  const angleDisplay = ANGLE_PROMPTS[angle];

  // Build user description block if provided
  const userDescBlock = userDescription
    ? `\n\n**USER DESCRIPTION**\nThe user describes this object as: "${userDescription}"\nUse this description to better understand and preserve the object's key features.\n`
    : '';

  // Build regeneration hint block if provided
  const hintBlock = hint
    ? `\n\n**REGENERATION ADJUSTMENT**\nThe user requests the following adjustment: "${hint}"\nApply this adjustment while maintaining all other requirements.\n`
    : '';

  if (mode.mesh.simplified) {
    // Simplified mode: ~7-color cel-shaded vinyl toy style
    return `You are a professional 3D character artist creating a "Turnaround Reference Sheet" for a 3D modeler.${userDescBlock}${hintBlock}

Generate a ${angleDisplay} VIEW of this object.

STYLE & TECHNICAL REQUIREMENTS:
1. **STYLE**: 3D Cel-Shaded Render. Look like a clean, low-poly game asset or vinyl toy.
2. **COLOR**: Use "Posterized" coloring. Limit to approximately ${mode.mesh.colorCount} distinct, high-contrast solid colors.
3. **LIGHTING**: "Flat Shading" or "Unlit". NO cast shadows, NO drop shadows.
4. **GEOMETRY CUES**: Although flat lit, use distinct color blocks to define distinct 3D volumes (e.g., separate sleeves from arms with a color edge).
5. **VIEWPORT**: Orthographic Projection (Telephoto lens). No perspective distortion. Show from directly ${angle === 'front' ? 'in front, centered' : angle === 'back' ? 'behind (180° from front)' : angle === 'left' ? 'left side (90° CCW from front)' : 'right side (90° CW from front)'}.
6. **BOUNDARIES**: Hard, pixel-sharp edges against a Pure White (#FFFFFF) background.
7. **CONSISTENCY**: The proportions, height, and features MUST match the front view logic.
8. **COMPOSITION**: Object fills 90% of frame.

Ensure the output looks like a technical design document, not a photograph.

After the image, list the colors used: COLORS: #RRGGBB, #RRGGBB, ...

Generate the actual image, not a description.`;
  } else {
    // Full color mode: photogrammetry style with ambient occlusion
    return `You are a 3D scanning expert preparing reference data for Photogrammetry.${userDescBlock}${hintBlock}

Generate a ${angleDisplay} VIEW of this object optimized for Mesh Reconstruction.

REQUIREMENTS:
1. **VIEW**: Strictly Orthographic (Technical drawing view). Camera perfectly level with the object center. Show from directly ${angle === 'front' ? 'in front, centered' : angle === 'back' ? 'behind (180° from front)' : angle === 'left' ? 'left side (90° CCW from front)' : 'right side (90° CW from front)'}.
2. **LIGHTING**: "Studio Softbox Lighting". Even illumination. IMPORTANT: Include subtle "Ambient Occlusion" in crevices to define shape/depth, but AVOID harsh directional shadows.
3. **DETAILS**: Hyper-realistic surface definition. We need to see the depth of the texture.
4. **BACKGROUND**: Pure White (#FFFFFF).
5. **CONSISTENCY**: Critical. If the object has a tail/backpack/feature in the reference, it MUST appear correctly in this angle.
6. **FRAMING**: Center the object, fill 85% of the canvas.

Goal: A perfect reference image that interprets the 3D volume of the input image from the ${angleDisplay}.

Generate the actual image, not a description.`;
  }
}

/**
 * Generate texture view prompt based on mode and angle
 * @param mode - The generation mode configuration
 * @param angle - The view angle to generate
 * @param userDescription - Optional user-provided description of the object
 * @param hint - Optional regeneration hint for adjustments
 */
export function getTexturePrompt(
  mode: ModeConfig,
  angle: PipelineTextureAngle,
  userDescription?: string | null,
  hint?: string
): string {
  const angleDisplay = TEXTURE_ANGLE_PROMPTS[angle];

  // Build user description block if provided
  const userDescBlock = userDescription
    ? `\n\n**USER DESCRIPTION**\nThe user describes this object as: "${userDescription}"\nUse this description to better understand and preserve the object's key features.\n`
    : '';

  // Build regeneration hint block if provided
  const hintBlock = hint
    ? `\n\n**REGENERATION ADJUSTMENT**\nThe user requests the following adjustment: "${hint}"\nApply this adjustment while maintaining all other requirements.\n`
    : '';

  if (mode.texture.simplified) {
    // Simplified mode: vector art / sticker art style for H2C printing
    return `You are a vector artist creating a texture map for a multi-color 3D print.${userDescBlock}${hintBlock}

Generate a ${angleDisplay} VIEW image designed for Color Mapping.

CRITICAL CONSTRAINTS:
1. **STYLE**: Flat Vector Illustration / Sticker Art style.
2. **PALETTE**: STRICTLY LIMITED PALETTE. Reduce entire image to approximately ${mode.texture.colorCount} solid colors.
3. **GRADIENTS**: FORBIDDEN. No gradients, no fading, no airbrushing. Solid blocks of color only.
4. **SHADING**: Zero shading. Pure Albedo color (Unlit).
5. **EDGES**: Crisp, sharp lines between color zones. No anti-aliasing fuzziness.
6. **ALIGNMENT**: Must match the silhouette of the 3D mesh perfectly. Show from directly ${angle === 'front' ? 'in front, centered' : 'behind (180° from front)'}.
7. **BACKGROUND**: Pure White (#FFFFFF).
8. **COMPOSITION**: Object fills 90% of frame.

Output logic: Think of this as a "Paint-by-numbers" guide. Each color region must be large enough to be 3D printed (avoid tiny pixel noise).

After the image, list the colors used: COLORS: #RRGGBB, #RRGGBB, ...

Generate the actual image, not a description.`;
  } else {
    // Full color mode: Albedo Map (Base Color) for PBR
    return `You are a texture artist creating the "Albedo Map" (Base Color) for a 3D model.${userDescBlock}${hintBlock}

Generate a ${angleDisplay} VIEW Albedo texture reference.

REQUIREMENTS:
1. **LIGHTING**: "Delit" / "Unlit" / "Flat" lighting. The image should represent the surface color ONLY, without any shadows or highlights caused by light sources.
2. **DETAIL**: High-frequency texture details (fabric weave, skin pores, metal scratches) should be visible as color information.
3. **VIEW**: Orthographic. Show from directly ${angle === 'front' ? 'in front, centered' : 'behind (180° from front)'}.
4. **COLOR**: Full color dynamic range. Natural saturation.
5. **BACKGROUND**: Pure White (#FFFFFF).
6. **COMPOSITION**: Object fills 90% of frame.
7. **CONSISTENCY**: Maintain exact proportions matching the mesh views.

The output must look like a flat texture map applied to the object, ready for a game engine.

Generate the actual image, not a description.`;
  }
}
