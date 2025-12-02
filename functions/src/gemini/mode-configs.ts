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
 * Mode A: Simplified Texture (Recommended for H2C multi-color printing)
 * - Mesh images: Full color, soft lighting (for accurate mesh reconstruction)
 * - Texture images: 6-color simplified (for H2C color mapping)
 */
const MODE_SIMPLIFIED_MESH: ModeConfig = {
  id: 'simplified-mesh',
  name: '模式 A: 簡化貼圖',
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
 * Mode B: Simplified Mesh (Alternative mode)
 * - Mesh images: 7-color simplified, no shadows
 * - Texture images: Full color, soft lighting
 */
const MODE_SIMPLIFIED_TEXTURE: ModeConfig = {
  id: 'simplified-texture',
  name: '模式 B: 簡化網格',
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
 * Angle display names for prompts (used in title)
 */
const ANGLE_PROMPTS: Record<PipelineMeshAngle, string> = {
  front: 'FRONT',
  back: 'BACK',
  left: 'LEFT SIDE',
  right: 'RIGHT SIDE',
};

const TEXTURE_ANGLE_PROMPTS: Record<PipelineTextureAngle, string> = {
  front: 'FRONT',
  back: 'BACK',
};

/**
 * Get mesh style instructions based on mode
 * - Simplified mode: Cartoon/vinyl toy style (low-poly, rounded)
 * - Full color mode: Preserve details but optimize for 3D modeling
 */
function getMeshStyleDescription(simplified: boolean): string {
  if (simplified) {
    // 卡通公仔化風格
    return `**3D MODELING OPTIMIZATION - CARTOON FIGURE STYLE**:
Transform the subject into a collectible vinyl toy / Funko Pop style figure:
- Round off sharp edges and corners
- Simplify complex geometry (hair becomes solid mass, fabric folds become smooth)
- Exaggerate cute features (larger head-to-body ratio for characters)
- Remove fine details that cannot be 3D printed (individual hairs, tiny patterns)
- Maintain recognizable silhouette and key identifying features
- Think "chibi" or "SD (Super Deformed)" style for characters`;
  } else {
    // 保留細節但優化建模 - 輕度平滑
    return `**3D MODELING OPTIMIZATION - DETAIL PRESERVATION with LIGHT SMOOTHING**:
Optimize the subject for accurate 3D reconstruction while preserving most details.
Apply LIGHT SURFACE SMOOTHING (10-20% simplification) - preserve textures and patterns:

**FEATURES TO FULLY PRESERVE**:
- Face/head shape and all facial features (eyes, nose, mouth, expressions)
- Accessories and adornments (bows, collars, patterns, decorations)
- Overall silhouette, body proportions, and pose
- Surface textures and patterns (fur direction, fabric weave, skin texture)
- Color boundaries and gradients

**FEATURES TO SLIGHTLY SIMPLIFY (Only if impossible to model)**:
- Individual hair strands → suggest as volume/mass while keeping texture direction visible
- Transparent parts → show as solid with surface indication
- Very thin elements (< 1mm) → thicken slightly for printability

**IMPORTANT - DO NOT OVER-SMOOTH**:
- Keep fabric folds and wrinkles - they add realism
- Keep fur/hair texture visible - show the direction and flow
- Keep surface details like stitching, patterns, and material textures
- The goal is a DETAILED figurine, NOT a smooth vinyl toy

The result should look like a high-quality resin figure with preserved surface details.`;
  }
}

/**
 * Get concrete viewpoint description for better AI understanding
 * Uses physical feature visibility instead of abstract rotation angles
 */
function getViewpointDescription(angle: PipelineMeshAngle): string {
  switch (angle) {
    case 'front':
      return 'in front, facing the camera';
    case 'back':
      return 'behind, showing the back of the object';
    case 'left':
      // LEFT view = viewer sees the object's RIGHT side (object's right ear/arm/leg visible)
      // Think: if object faces you, rotate it 90° clockwise to show its left-facing profile
      return "the LEFT view (object rotated 90° clockwise from front). The viewer sees the object's profile facing LEFT. The object's RIGHT side features are visible (RIGHT ear, RIGHT arm). The nose/face points toward the LEFT edge of the image";
    case 'right':
      // RIGHT view = viewer sees the object's LEFT side (object's left ear/arm/leg visible)
      // Think: if object faces you, rotate it 90° counter-clockwise to show its right-facing profile
      return "the RIGHT view (object rotated 90° counter-clockwise from front). The viewer sees the object's profile facing RIGHT. The object's LEFT side features are visible (LEFT ear, LEFT arm). The nose/face points toward the RIGHT edge of the image";
  }
}

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

${getMeshStyleDescription(true)}

STYLE & TECHNICAL REQUIREMENTS:
1. **STYLE**: 3D Cel-Shaded Render. Look like a clean, low-poly game asset or vinyl toy.
2. **COLOR**: Use "Posterized" coloring. Limit to approximately ${mode.mesh.colorCount} distinct, high-contrast solid colors.
3. **LIGHTING**: "Flat Shading" or "Unlit". NO cast shadows, NO drop shadows.
4. **GEOMETRY CUES**: Although flat lit, use distinct color blocks to define distinct 3D volumes (e.g., separate sleeves from arms with a color edge).
5. **VIEWPORT**: Orthographic Projection (Telephoto lens). No perspective distortion. Show from directly ${getViewpointDescription(angle)}.
6. **BOUNDARIES**: Hard, pixel-sharp edges against a Pure White (#FFFFFF) background.
7. **CONSISTENCY**: The proportions, height, and features MUST match the front view logic.
8. **COMPOSITION**: Object fills 90% of frame.

Ensure the output looks like a technical design document, not a photograph.

After the image, list the colors used: COLORS: #RRGGBB, #RRGGBB, ...

Generate the actual image, not a description.`;
  } else {
    // Full color mode: photogrammetry style with detail preservation
    return `You are a 3D scanning expert preparing reference data for accurate 3D model reconstruction.${userDescBlock}${hintBlock}

Generate a ${angleDisplay} VIEW of this object optimized for Mesh Reconstruction.

${getMeshStyleDescription(false)}

REQUIREMENTS:
1. **VIEW**: Strictly Orthographic (Technical drawing view). Camera perfectly level with the object center. Show from directly ${getViewpointDescription(angle)}.
2. **LIGHTING**: "Studio Softbox Lighting". Even illumination. Include subtle "Ambient Occlusion" in crevices to define shape/depth, but AVOID harsh directional shadows.
3. **DETAILS**: Preserve surface textures and details. Show fur direction, fabric folds, and material textures clearly.
4. **BACKGROUND**: Pure White (#FFFFFF).
5. **CONSISTENCY**: Critical. If the object has a tail/backpack/feature in the reference, it MUST appear correctly in this angle.
6. **FRAMING**: Center the object, fill 85% of the canvas.

Goal: A perfect reference image that captures the 3D volume AND surface details of the input image from the ${angleDisplay}.

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
4. **SHADING**: ABSOLUTELY ZERO SHADING. This texture will be used for 3D PRINTING - the printed colors must NOT be affected by any simulated lighting.
   - NO shadows (not even subtle ones)
   - NO highlights or specular reflections
   - NO ambient occlusion
   - Think of this as a "flat color map" where each color zone represents the exact pigment to be printed.
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
1. **LIGHTING**: STRICTLY UNLIT / FLAT. This is for 3D PRINTING - the colors represent the actual pigment to be printed, NOT how the surface appears under lighting.
   - ZERO shadows of any kind
   - ZERO highlights or reflections
   - ZERO ambient occlusion
   - Each pixel color = the exact print pigment color
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

/**
 * Generate texture view prompt with color palette hints for consistency
 * Used when generating texture views after mesh views are complete
 *
 * @param mode - The generation mode configuration
 * @param angle - The view angle to generate
 * @param colorPalette - Color palette extracted from mesh views for consistency
 * @param userDescription - Optional user-provided description of the object
 * @param hint - Optional regeneration hint for adjustments
 */
export function getTexturePromptWithColors(
  mode: ModeConfig,
  angle: PipelineTextureAngle,
  colorPalette: string[],
  userDescription?: string | null,
  hint?: string
): string {
  const basePrompt = getTexturePrompt(mode, angle, userDescription, hint);

  // If no color palette or mode doesn't use simplified mesh, return base prompt
  if (colorPalette.length === 0) {
    return basePrompt;
  }

  // Inject color consistency instruction
  const colorHint = `

**COLOR CONSISTENCY REQUIREMENT**
IMPORTANT: To ensure color consistency with the mesh views, use ONLY these colors in your generated image:
${colorPalette.join(', ')}

These colors have been extracted from the mesh views. Your texture image MUST use the same color palette to ensure visual consistency across all views. Do not introduce new colors.`;

  // Insert color hint before the final "Generate the actual image" line
  const insertPoint = basePrompt.lastIndexOf('Generate the actual image');
  if (insertPoint > 0) {
    return basePrompt.slice(0, insertPoint) + colorHint + '\n\n' + basePrompt.slice(insertPoint);
  }

  // Fallback: append to end
  return basePrompt + colorHint;
}
