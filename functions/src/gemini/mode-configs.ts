/**
 * Generation Mode Configurations
 *
 * Defines different image generation modes for A/B testing 3D model quality.
 * Each mode specifies how mesh and texture images should be processed.
 */

import type { PipelineMeshAngle, ImageAnalysisResult } from '../rodin/types';
import { type StyleId, getStyleConfig, DEFAULT_STYLE } from '../config/styles';

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
// Style-Aware Prompt Generation
// =============================================================================

/**
 * Generate style-specific prompt block for mesh generation
 *
 * This is the core function that translates the selected style into
 * specific prompt instructions that guide Gemini's image generation.
 *
 * @param selectedStyle - The user's selected style (or default)
 * @param colorCount - Number of colors for cel-shaded rendering
 * @returns Style prompt block to inject into the main prompt
 */
function getStylePromptBlockForMesh(selectedStyle: StyleId | undefined, colorCount: number): string {
  const style = getStyleConfig(selectedStyle || DEFAULT_STYLE);
  const { meshStyle, proportions, features } = style.promptModifiers;

  return `=== FIGURE STYLE: ${style.name.toUpperCase()} ===

**Target Style**: ${meshStyle}

**Proportions**: ${proportions}

**Feature Emphasis**: ${features}

Render in cel-shaded style with approximately ${colorCount || 7} distinct, high-contrast solid colors. No gradients, no soft shadows - just clean blocks of flat color. Each color zone has crisp, pixel-sharp edges.

=== END FIGURE STYLE ===`;
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


/**
 * Structured viewpoint information using clock system for clarity
 * Works for both objects and characters
 */
interface ViewpointInfo {
  clockPosition: string;        // Camera position on clock face
  cameraDirection: string;      // Where camera looks
  visibleSide: string;          // Which surface is visible
  objectDescription: string;    // Description for objects (cups, machines, etc.)
  characterDescription: string; // Description for characters (people, animals)
  technicalSpec: string;        // Technical camera specification
  rotationDegrees: number;      // Rotation from front view
  notThisSide?: string;         // Opposite side to avoid confusion (for left/right)
  mirrorCheck?: string;         // Self-check instruction to verify correct orientation
}

/**
 * Get viewpoint information using CLOCK SYSTEM
 *
 * Subject is at center, facing toward 6 o'clock (toward the viewer)
 * - Front: Camera at 6 o'clock → sees front
 * - Back: Camera at 12 o'clock → sees back
 * - Left: Camera at 3 o'clock → sees subject's LEFT side
 * - Right: Camera at 9 o'clock → sees subject's RIGHT side
 */
function getViewpointInfo(angle: PipelineMeshAngle): ViewpointInfo {
  switch (angle) {
    case 'front':
      return {
        clockPosition: '6 o\'clock',
        cameraDirection: 'looking toward the center',
        visibleSide: 'FRONT surface',
        objectDescription: 'The primary/front face of the object, the side typically displayed or presented to viewers',
        characterDescription: 'Face and front body visible, both left and right sides symmetrically visible',
        technicalSpec: 'Camera perpendicular to front plane, 0° rotation from front',
        rotationDegrees: 0,
      };
    case 'back':
      return {
        clockPosition: '12 o\'clock',
        cameraDirection: 'looking toward the center',
        visibleSide: 'BACK surface',
        objectDescription: 'The rear face of the object, opposite to the front/display side',
        characterDescription: 'Back of head and body visible, NO face visible, tail visible if present',
        technicalSpec: 'Camera perpendicular to back plane, 180° rotation from front',
        rotationDegrees: 180,
      };
    case 'left':
      return {
        clockPosition: '3 o\'clock',
        cameraDirection: 'looking toward the center',
        visibleSide: 'LEFT surface (the subject\'s own left side)',
        objectDescription: 'The left side of the object when you face its front',
        characterDescription: 'Left profile view - LEFT ear visible, face/nose points toward LEFT edge of image',
        technicalSpec: 'Camera perpendicular to left plane, 90° clockwise rotation from front',
        rotationDegrees: 90,
        notThisSide: 'RIGHT',
        mirrorCheck: 'If the face/nose points toward the RIGHT edge, you generated the WRONG side - that would be the RIGHT view',
      };
    case 'right':
      return {
        clockPosition: '9 o\'clock',
        cameraDirection: 'looking toward the center',
        visibleSide: 'RIGHT surface (the subject\'s own right side)',
        objectDescription: 'The right side of the object when you face its front',
        characterDescription: 'Right profile view - RIGHT ear visible, face/nose points toward RIGHT edge of image',
        technicalSpec: 'Camera perpendicular to right plane, 90° counter-clockwise rotation from front',
        rotationDegrees: 270,
        notThisSide: 'LEFT',
        mirrorCheck: 'If the face/nose points toward the LEFT edge, you generated the WRONG side - that would be the LEFT view',
      };
  }
}

/**
 * Build the camera position block using clock system
 * Works for both objects and characters
 */
function buildViewDirectionBlock(angle: PipelineMeshAngle): string {
  const info = getViewpointInfo(angle);
  const angleDisplay = ANGLE_PROMPTS[angle];

  // Build confusion warning block for left/right views
  const confusionWarning = info.notThisSide
    ? `
**⚠️ DO NOT CONFUSE - COMMON MISTAKE**:
- This is the ${angleDisplay} view, absolutely NOT the ${info.notThisSide} SIDE view
- ${info.mirrorCheck}
`
    : '';

  // Build self-check block for left/right views
  const selfCheckBlock = info.notThisSide
    ? `
**SELF-CHECK before generating**:
For characters with a face: Which direction should the nose point?
- LEFT SIDE view → nose points toward LEFT edge of image
- RIGHT SIDE view → nose points toward RIGHT edge of image
You are generating the ${angleDisplay} view. Verify the nose direction matches before finalizing.
`
    : '';

  return `=== CAMERA POSITION (CRITICAL - READ FIRST) ===

**CLOCK SYSTEM**: The subject is at the CENTER, with its front facing toward 6 o'clock.
**CAMERA POSITION**: ${info.clockPosition}, ${info.cameraDirection}
**VISIBLE SURFACE**: ${info.visibleSide}
**ROTATION**: ${info.rotationDegrees}° from front view
${confusionWarning}
For OBJECTS (cups, machines, furniture, buildings, etc.):
→ ${info.objectDescription}

For CHARACTERS (people, animals, toys, figures):
→ ${info.characterDescription}
${selfCheckBlock}
**CRITICAL REQUIREMENTS**:
- Generate EXACTLY this ${angleDisplay} viewing angle - no other angle
- Do NOT rotate or tilt the subject from this specified view
- Maintain orthographic projection (no perspective distortion)
- The subject should appear as if photographed from this exact position

=== END CAMERA POSITION ===`;
}

/**
 * Build background isolation block
 * Ensures clean output with only the subject
 */
function buildBackgroundIsolationBlock(): string {
  return `=== BACKGROUND ISOLATION ===

REMOVE all background elements, secondary objects, and environmental clutter from the original image.
ISOLATE only the PRIMARY SUBJECT - nothing else should appear in the generated image.
The subject floats against a PURE WHITE (#FFFFFF) seamless background.
No ground plane, no surface reflections, no cast shadows on the background.
The background must be completely empty, uniform, and distraction-free.

=== END BACKGROUND ISOLATION ===`;
}

/**
 * Build 3D print optimization block
 * Different instructions for simplified vs full-color modes
 */
function build3DPrintOptimizationBlock(simplified: boolean): string {
  if (simplified) {
    return `=== 3D PRINT OPTIMIZATION ===

This image will be used as reference for 3D PRINTING. Apply these optimizations:

**GEOMETRY SIMPLIFICATION**:
- Smooth out fine surface details (wrinkles, tiny bumps, fabric texture)
- Round sharp edges and corners for printability
- Fill small holes and gaps
- Merge thin protruding elements into thicker, more stable forms

**STRUCTURAL STABILITY**:
- Thicken thin elements (antennas, fingers, hair strands, thin handles)
- Connect floating or loosely attached parts to the main body
- Avoid deep undercuts and severe overhangs
- Ensure all parts have sufficient thickness for printing

**SURFACE TREATMENT**:
- Matte, uniform surface finish (no glossy reflections)
- Flatten complex textures into distinct color zones
- Remove any transparency - all parts must appear solid

The result should look like a MANUFACTURABLE toy or collectible figure.

=== END 3D PRINT OPTIMIZATION ===`;
  } else {
    return `=== 3D RECONSTRUCTION REFERENCE ===

This image will be used for photogrammetry-based 3D model reconstruction.

**DETAIL PRESERVATION**:
- Maintain surface textures and material details
- Preserve color gradients and subtle variations
- Keep structural proportions accurate

**SLIGHT OPTIMIZATION** (for printability):
- Apply minimal smoothing (10-20%) to only the most extreme fine details
- Slightly thicken very thin elements that would be unprintable
- Ensure continuous, manifold surfaces (no impossible geometry)

**LIGHTING FOR SCANNING**:
- Even, diffused studio illumination revealing all surfaces
- Subtle ambient occlusion in crevices for depth definition
- No harsh shadows that would confuse 3D reconstruction

=== END 3D RECONSTRUCTION REFERENCE ===`;
  }
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
 * Structure:
 * 1. CAMERA POSITION (clock system)
 * 2. SUBJECT DESCRIPTION (from analysis)
 * 3. BACKGROUND ISOLATION
 * 4. 3D PRINT OPTIMIZATION
 * 5. FIGURE STYLE (user-selected style)
 * 6. STYLE & RENDERING
 * 7. OUTPUT INSTRUCTION
 *
 * @param mode - The generation mode configuration
 * @param angle - The view angle to generate
 * @param userDescription - Optional user-provided description of the object
 * @param hint - Optional regeneration hint for adjustments
 * @param imageAnalysis - Optional image analysis result with key features
 * @param selectedStyle - User-selected figure style (bobblehead, chibi, cartoon, emoji)
 */
export function getMeshPrompt(
  mode: ModeConfig,
  angle: PipelineMeshAngle,
  userDescription?: string | null,
  hint?: string,
  imageAnalysis?: ImageAnalysisResult | null,
  selectedStyle?: StyleId
): string {
  const angleDisplay = ANGLE_PROMPTS[angle];
  const info = getViewpointInfo(angle);

  // Build all blocks
  const cameraBlock = buildViewDirectionBlock(angle);
  const subjectBlock = buildNarrativeContext(userDescription, imageAnalysis);
  const backgroundBlock = buildBackgroundIsolationBlock();
  const printOptBlock = build3DPrintOptimizationBlock(mode.mesh.simplified);
  const styleBlock = getStylePromptBlockForMesh(selectedStyle, mode.mesh.colorCount);

  // Build regeneration hint if provided
  const hintBlock = hint
    ? `\n=== USER ADJUSTMENT ===\nThe user requests: "${hint}"\nApply this adjustment while maintaining the correct viewing angle and all other requirements.\n=== END USER ADJUSTMENT ===\n`
    : '';

  if (mode.mesh.simplified) {
    // Simplified mode: use selected figure style
    return `${cameraBlock}
${subjectBlock}
${backgroundBlock}

${printOptBlock}
${hintBlock}
${styleBlock}

=== RENDERING REQUIREMENTS ===

Camera: Orthographic projection from ${info.clockPosition} position, ${info.rotationDegrees}° rotation.
Framing: Subject centered, fills 90% of frame.
Lighting: Completely flat - no cast shadows, no highlights.
Background: Pure white (#FFFFFF), seamless.

This is a professional turnaround reference for 3D modeling, not a photograph.

=== END RENDERING REQUIREMENTS ===

After generating the image, list the colors used: COLORS: #RRGGBB, #RRGGBB, ...

Generate the actual ${angleDisplay} view image now.`;
  } else {
    // Full color mode: photogrammetry reference
    return `${cameraBlock}
${subjectBlock}
${backgroundBlock}

${printOptBlock}
${hintBlock}
=== STYLE & RENDERING ===

Picture this subject in a professional photogrammetry studio for accurate 3D reconstruction. Multiple softboxes provide even, diffused illumination that wraps around the form, revealing surface textures without harsh shadows. Subtle ambient occlusion appears in crevices for depth definition.

Preserve fine details: texture direction of materials, subtle surface variations, color gradients. Colors appear true-to-life with natural saturation. Apply only minimal smoothing (10-20%) to the most extreme fine details for printability.

Camera: Orthographic projection from ${info.clockPosition} position, ${info.rotationDegrees}° rotation.
Framing: Subject centered, fills 85% of frame.
Lighting: Even studio softbox illumination, no harsh directional shadows.
Background: Pure white (#FFFFFF), seamless.

Goal: A photogrammetry reference image - detailed for 3D reconstruction, optimized for printing.

=== END STYLE & RENDERING ===

Generate the actual ${angleDisplay} view image now.`;
  }
}
