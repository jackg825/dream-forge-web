/**
 * Generation Mode Configurations
 *
 * Defines different image generation modes for A/B testing 3D model quality.
 * Each mode specifies how mesh and texture images should be processed.
 */

import type { PipelineMeshAngle, PipelineTextureAngle, ImageAnalysisResult } from '../rodin/types';

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
 * Structured viewpoint information for clearer AI understanding
 */
interface ViewpointInfo {
  whatYouSee: string[];       // What should be visible in this view
  mustNotGenerate: string[];  // Explicit negative constraints
  humanAnalogy: string;       // Human-relatable description
}

/**
 * Get structured viewpoint information for each angle
 * Uses result-oriented descriptions and negative constraints
 */
function getViewpointInfo(angle: PipelineMeshAngle): ViewpointInfo {
  switch (angle) {
    case 'front':
      return {
        whatYouSee: [
          'The character FACING the camera directly',
          'BOTH ears visible (symmetrically on each side of head)',
          'The FACE is centered and looking forward',
        ],
        mustNotGenerate: [
          'Side profile view',
          'Back view',
          'Three-quarter angle',
        ],
        humanAnalogy: 'Like the character is looking at you',
      };
    case 'back':
      return {
        whatYouSee: [
          'The BACK of the character\'s head',
          'The character is facing AWAY from the camera',
          'If there\'s a tail, it should be visible',
          'You see the back of the body, NOT the face',
        ],
        mustNotGenerate: [
          'Front view (face visible)',
          'Side profile view',
          'The character looking over shoulder at camera',
        ],
        humanAnalogy: 'Like standing behind someone',
      };
    case 'left':
      return {
        whatYouSee: [
          'Pure side profile view',
          'LEFT EAR is visible',
          'NOSE/FACE points toward RIGHT edge of image',
        ],
        mustNotGenerate: [
          'Front view (face at camera)',
          'Back view',
          'Three-quarter view',
          'Face pointing LEFT (that would be RIGHT view)',
        ],
        humanAnalogy: 'Like standing to the LEFT of someone - you see their left ear',
      };
    case 'right':
      return {
        whatYouSee: [
          'Pure side profile view',
          'RIGHT EAR is visible',
          'NOSE/FACE points toward LEFT edge of image',
        ],
        mustNotGenerate: [
          'Front view (face at camera)',
          'Back view',
          'Three-quarter view',
          'Face pointing RIGHT (that would be LEFT view)',
        ],
        humanAnalogy: 'Like standing to the RIGHT of someone - you see their right ear',
      };
  }
}

/**
 * Build the view direction block for the prompt header
 * Places critical view direction info at the very beginning
 */
function buildViewDirectionBlock(angle: PipelineMeshAngle): string {
  const info = getViewpointInfo(angle);
  const angleDisplay = ANGLE_PROMPTS[angle];

  return `=== VIEW DIRECTION (CRITICAL - Read First) ===

Generate the ${angleDisplay} PROFILE view for a 3D turnaround reference sheet.

**WHAT YOU SHOULD SEE:**
${info.whatYouSee.map(item => `- ${item}`).join('\n')}
- ${info.humanAnalogy}

**WHAT YOU MUST NOT GENERATE:**
${info.mustNotGenerate.map(item => `❌ ${item}`).join('\n')}

=== END VIEW DIRECTION ===`;
}

/**
 * Build the narrative subject context from image analysis
 * Prioritizes promptDescription for better image generation results
 */
function buildNarrativeContext(
  userDescription?: string | null,
  imageAnalysis?: ImageAnalysisResult | null
): string {
  // If we have a prompt description from analysis, use it as the primary narrative
  // This follows Gemini's best practice: "describe the scene, don't just list keywords"
  if (imageAnalysis?.promptDescription) {
    const styleContext = imageAnalysis.styleHints?.length
      ? ` Style hints: ${imageAnalysis.styleHints.join(', ')}.`
      : '';

    return `\n\n=== SUBJECT DESCRIPTION ===

${imageAnalysis.promptDescription}${styleContext}

This subject must maintain consistent identity, proportions, and features across all views.

=== END SUBJECT DESCRIPTION ===\n`;
  }

  // Fallback: Build narrative from structured data
  const narrativeParts: string[] = [];

  if (userDescription) {
    narrativeParts.push(`This is ${userDescription}.`);
  }

  if (imageAnalysis?.detectedMaterials?.length) {
    const materials = imageAnalysis.detectedMaterials.join(', ');
    narrativeParts.push(`The surface features ${materials} textures that should be visible in all views.`);
  }

  if (imageAnalysis?.keyFeatures) {
    const kf = imageAnalysis.keyFeatures;

    if (kf.ears?.present && kf.ears.description) {
      narrativeParts.push(`It has ears: ${kf.ears.description}.`);
    }
    if (kf.tail?.present && kf.tail.description) {
      narrativeParts.push(`A tail is present: ${kf.tail.description}.`);
    }
    if (kf.accessories?.length) {
      narrativeParts.push(`Accessories include: ${kf.accessories.join(', ')}.`);
    }
    if (kf.surfaceTextures?.length) {
      narrativeParts.push(`Surface textures: ${kf.surfaceTextures.join(', ')}.`);
    }
  }

  if (narrativeParts.length === 0) {
    return '';
  }

  return `\n\n=== SUBJECT DESCRIPTION ===

${narrativeParts.join(' ')}

Maintain consistent identity, proportions, and features across all views.

=== END SUBJECT DESCRIPTION ===\n`;
}

/**
 * Generate mesh view prompt based on mode and angle
 * Uses narrative style following Gemini's best practice:
 * "Describe the scene, don't just list keywords"
 *
 * @param mode - The generation mode configuration
 * @param angle - The view angle to generate
 * @param userDescription - Optional user-provided description of the object
 * @param hint - Optional regeneration hint for adjustments
 * @param imageAnalysis - Optional image analysis result with key features
 */
export function getMeshPrompt(
  mode: ModeConfig,
  angle: PipelineMeshAngle,
  userDescription?: string | null,
  hint?: string,
  imageAnalysis?: ImageAnalysisResult | null
): string {
  const angleDisplay = ANGLE_PROMPTS[angle];

  // Build view direction block (placed at the very beginning for emphasis)
  const viewDirectionBlock = buildViewDirectionBlock(angle);

  // Build narrative context from user description and image analysis
  const narrativeContext = buildNarrativeContext(userDescription, imageAnalysis);

  // Build regeneration hint block if provided
  const hintBlock = hint
    ? `\n\nIMPORTANT ADJUSTMENT: The user requests: "${hint}". Apply this adjustment while maintaining all other visual characteristics.\n`
    : '';

  if (mode.mesh.simplified) {
    // Simplified mode: vinyl toy / Funko Pop style with narrative description
    return `${viewDirectionBlock}
${narrativeContext}${hintBlock}
Imagine this subject transformed into a charming collectible vinyl figure, reminiscent of Funko Pop or kawaii-style toys. The form is simplified with rounded edges, smooth surfaces, and exaggerated cute proportions. Complex details like individual hairs or fabric folds are smoothed into clean, stylized shapes while keeping the recognizable silhouette.

The figure is rendered in a cel-shaded style with approximately ${mode.mesh.colorCount} distinct, high-contrast solid colors. There are no gradients or soft shadows - just clean blocks of flat color that define the 3D volumes. Each color zone has crisp, pixel-sharp edges, like a modern low-poly game asset.

The camera captures this ${angleDisplay} view using orthographic projection, eliminating any perspective distortion. The subject sits centered against a pure white (#FFFFFF) background, filling about 90% of the frame. The lighting is completely flat - no cast shadows, no highlights, just clean unlit color.

Think of this as a professional turnaround reference sheet for a 3D modeler, not a photograph.

After generating the image, list the colors used: COLORS: #RRGGBB, #RRGGBB, ...

Generate the actual image now.`;
  } else {
    // Full color mode: photogrammetry reference with narrative description
    return `${viewDirectionBlock}
${narrativeContext}${hintBlock}
Picture this subject in a professional photogrammetry studio, set up for accurate 3D model reconstruction. Multiple softboxes provide even, diffused illumination that wraps around the form, revealing every surface texture and detail without harsh directional shadows. Subtle ambient occlusion appears naturally in crevices, helping define the shape and depth.

All the fine details are preserved - the texture direction of fur, the subtle folds of fabric, the smoothness or roughness of each material surface. Colors appear true-to-life with natural saturation. The overall form maintains its realistic proportions with only minimal smoothing (10-20%) of the most complex geometry.

The camera is positioned at eye level, using orthographic projection to eliminate perspective distortion. Parallel lines remain perfectly parallel. The subject sits centered against a pure white (#FFFFFF) background, filling about 85% of the frame. This ${angleDisplay} view captures both the 3D volume and the rich surface details.

The goal is a perfect photogrammetry reference image - detailed enough for accurate 3D reconstruction, clean enough for professional modeling.

Generate the actual image now.`;
  }
}

/**
 * Generate texture view prompt based on mode and angle
 * Uses narrative style following Gemini's best practice:
 * "Describe the scene, don't just list keywords"
 *
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
  const viewPosition = angle === 'front' ? 'directly in front, centered' : 'from behind (180° from front)';

  // Build user description as narrative context
  const subjectContext = userDescription
    ? `\n\nThis is ${userDescription}. Preserve its key visual features and identity.\n`
    : '';

  // Build regeneration hint as narrative
  const hintContext = hint
    ? `\n\nIMPORTANT ADJUSTMENT: The user requests: "${hint}". Apply this change while maintaining all other visual characteristics.\n`
    : '';

  if (mode.texture.simplified) {
    // Simplified mode: vector art / sticker art style for H2C printing
    return `Create a texture map for multi-color 3D printing in a clean, flat vector illustration style.${subjectContext}${hintContext}

Imagine this ${angleDisplay} view as a stylized sticker or paint-by-numbers template. The entire image uses exactly ${mode.texture.colorCount} solid, distinct colors with absolutely no gradients, shading, or soft transitions. Each color zone is a crisp, clean block with sharp edges between regions - like a professional vector illustration or a simplified screen print design.

This texture will be applied directly to a 3D printed object, so the colors represent the exact pigments to be printed. There are no simulated lighting effects - no shadows of any kind, no highlights, no ambient occlusion, no reflections. Every pixel shows the true base color, completely flat and unlit.

The camera captures the view ${viewPosition}, using orthographic projection. The subject fills about 90% of the frame against a pure white (#FFFFFF) background. The silhouette and proportions match the corresponding mesh view exactly.

Think of this as creating a color map where each region is large enough to be physically printed - avoid tiny color details that would get lost in production.

After generating the image, list the colors used: COLORS: #RRGGBB, #RRGGBB, ...

Generate the actual image now.`;
  } else {
    // Full color mode: Albedo Map (Base Color) for PBR
    return `Create an albedo texture map (base color) for a 3D model, optimized for printing.${subjectContext}${hintContext}

This ${angleDisplay} view captures the true surface colors of the subject as they would appear without any lighting. Imagine scanning the object's colors directly - no shadows, no highlights, no ambient occlusion, no reflections. Each pixel represents the exact pigment color to be printed, in full color with natural saturation.

All the high-frequency texture details are visible as color information - the weave of fabric, the grain of wood, the subtle variations in skin tones, the scratches on metal. These details appear as color data, not as shading effects.

The camera is positioned ${viewPosition}, using orthographic projection. The subject sits centered against a pure white (#FFFFFF) background, filling about 90% of the frame. Proportions match the mesh views exactly for perfect UV alignment.

The result should look like a flat, unlit texture map ready to be applied in a game engine or 3D printing workflow.

Generate the actual image now.`;
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

  // Inject color consistency instruction as narrative
  const colorHint = `

For visual consistency with the mesh views, use only these specific colors: ${colorPalette.join(', ')}. These exact shades have been extracted from the mesh reference images. Stay strictly within this palette - do not introduce any new colors.`;

  // Insert color hint before the final "Generate the actual image" line
  const insertPoint = basePrompt.lastIndexOf('Generate the actual image');
  if (insertPoint > 0) {
    return basePrompt.slice(0, insertPoint) + colorHint + '\n\n' + basePrompt.slice(insertPoint);
  }

  // Fallback: append to end
  return basePrompt + colorHint;
}
