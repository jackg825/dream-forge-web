"use strict";
/**
 * Generation Mode Configurations
 *
 * Defines different image generation modes for A/B testing 3D model quality.
 * Each mode specifies how mesh and texture images should be processed.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.GENERATION_MODES = exports.DEFAULT_MODE = void 0;
exports.getMode = getMode;
exports.getMeshPrompt = getMeshPrompt;
exports.getTexturePrompt = getTexturePrompt;
exports.getTexturePromptWithColors = getTexturePromptWithColors;
/**
 * Default generation mode
 */
exports.DEFAULT_MODE = 'simplified-mesh';
/**
 * Mode A: Simplified Texture (Recommended for H2C multi-color printing)
 * - Mesh images: Full color, soft lighting (for accurate mesh reconstruction)
 * - Texture images: 6-color simplified (for H2C color mapping)
 */
const MODE_SIMPLIFIED_MESH = {
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
const MODE_SIMPLIFIED_TEXTURE = {
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
exports.GENERATION_MODES = {
    'simplified-mesh': MODE_SIMPLIFIED_MESH,
    'simplified-texture': MODE_SIMPLIFIED_TEXTURE,
};
/**
 * Get mode configuration by ID
 */
function getMode(id) {
    const mode = exports.GENERATION_MODES[id];
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
const ANGLE_PROMPTS = {
    front: 'FRONT',
    back: 'BACK',
    left: 'LEFT SIDE',
    right: 'RIGHT SIDE',
};
const TEXTURE_ANGLE_PROMPTS = {
    front: 'FRONT',
    back: 'BACK',
};
/**
 * Get viewpoint information using CLOCK SYSTEM
 *
 * Subject is at center, facing toward 6 o'clock (toward the viewer)
 * - Front: Camera at 6 o'clock → sees front
 * - Back: Camera at 12 o'clock → sees back
 * - Left: Camera at 3 o'clock → sees subject's LEFT side
 * - Right: Camera at 9 o'clock → sees subject's RIGHT side
 */
function getViewpointInfo(angle) {
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
                characterDescription: 'Left profile view - LEFT ear visible, face/nose points toward RIGHT edge of image',
                technicalSpec: 'Camera perpendicular to left plane, 90° clockwise rotation from front',
                rotationDegrees: 90,
            };
        case 'right':
            return {
                clockPosition: '9 o\'clock',
                cameraDirection: 'looking toward the center',
                visibleSide: 'RIGHT surface (the subject\'s own right side)',
                objectDescription: 'The right side of the object when you face its front',
                characterDescription: 'Right profile view - RIGHT ear visible, face/nose points toward LEFT edge of image',
                technicalSpec: 'Camera perpendicular to right plane, 90° counter-clockwise rotation from front',
                rotationDegrees: 270,
            };
    }
}
/**
 * Build the camera position block using clock system
 * Works for both objects and characters
 */
function buildViewDirectionBlock(angle) {
    const info = getViewpointInfo(angle);
    const angleDisplay = ANGLE_PROMPTS[angle];
    return `=== CAMERA POSITION (CRITICAL - READ FIRST) ===

**CLOCK SYSTEM**: The subject is at the CENTER, with its front facing toward 6 o'clock.
**CAMERA POSITION**: ${info.clockPosition}, ${info.cameraDirection}
**VISIBLE SURFACE**: ${info.visibleSide}
**ROTATION**: ${info.rotationDegrees}° from front view

For OBJECTS (cups, machines, furniture, buildings, etc.):
→ ${info.objectDescription}

For CHARACTERS (people, animals, toys, figures):
→ ${info.characterDescription}

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
function buildBackgroundIsolationBlock() {
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
function build3DPrintOptimizationBlock(simplified) {
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
    }
    else {
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
function buildNarrativeContext(userDescription, imageAnalysis) {
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
    const narrativeParts = [];
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
 * 5. STYLE & RENDERING
 * 6. OUTPUT INSTRUCTION
 *
 * @param mode - The generation mode configuration
 * @param angle - The view angle to generate
 * @param userDescription - Optional user-provided description of the object
 * @param hint - Optional regeneration hint for adjustments
 * @param imageAnalysis - Optional image analysis result with key features
 */
function getMeshPrompt(mode, angle, userDescription, hint, imageAnalysis) {
    const angleDisplay = ANGLE_PROMPTS[angle];
    const info = getViewpointInfo(angle);
    // Build all blocks
    const cameraBlock = buildViewDirectionBlock(angle);
    const subjectBlock = buildNarrativeContext(userDescription, imageAnalysis);
    const backgroundBlock = buildBackgroundIsolationBlock();
    const printOptBlock = build3DPrintOptimizationBlock(mode.mesh.simplified);
    // Build regeneration hint if provided
    const hintBlock = hint
        ? `\n=== USER ADJUSTMENT ===\nThe user requests: "${hint}"\nApply this adjustment while maintaining the correct viewing angle and all other requirements.\n=== END USER ADJUSTMENT ===\n`
        : '';
    if (mode.mesh.simplified) {
        // Simplified mode: vinyl toy / Funko Pop style
        return `${cameraBlock}
${subjectBlock}
${backgroundBlock}

${printOptBlock}
${hintBlock}
=== STYLE & RENDERING ===

Transform this subject into a charming collectible vinyl figure style, like Funko Pop or kawaii toys. Simplify the form with rounded edges, smooth surfaces, and clean shapes. Complex details (individual hairs, fabric folds, fine texture) should be smoothed into stylized forms while keeping the recognizable silhouette.

Render in cel-shaded style with approximately ${mode.mesh.colorCount} distinct, high-contrast solid colors. No gradients, no soft shadows - just clean blocks of flat color. Each color zone has crisp, pixel-sharp edges.

Camera: Orthographic projection from ${info.clockPosition} position, ${info.rotationDegrees}° rotation.
Framing: Subject centered, fills 90% of frame.
Lighting: Completely flat - no cast shadows, no highlights.
Background: Pure white (#FFFFFF), seamless.

This is a professional turnaround reference for 3D modeling, not a photograph.

=== END STYLE & RENDERING ===

After generating the image, list the colors used: COLORS: #RRGGBB, #RRGGBB, ...

Generate the actual ${angleDisplay} view image now.`;
    }
    else {
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
function getTexturePrompt(mode, angle, userDescription, hint) {
    const angleDisplay = TEXTURE_ANGLE_PROMPTS[angle];
    const clockPos = angle === 'front' ? '6 o\'clock' : '12 o\'clock';
    const rotation = angle === 'front' ? 0 : 180;
    // Build user description as narrative context
    const subjectContext = userDescription
        ? `\n\n=== SUBJECT ===\nThis is ${userDescription}. Preserve its key visual features and identity.\n=== END SUBJECT ===\n`
        : '';
    // Build regeneration hint
    const hintContext = hint
        ? `\n=== USER ADJUSTMENT ===\nThe user requests: "${hint}"\nApply this while maintaining the correct viewing angle.\n=== END USER ADJUSTMENT ===\n`
        : '';
    // Background isolation block
    const backgroundBlock = buildBackgroundIsolationBlock();
    if (mode.texture.simplified) {
        // Simplified mode: vector art / sticker art style for H2C printing
        return `=== CAMERA POSITION ===
**CLOCK SYSTEM**: Subject at center, front facing 6 o'clock.
**CAMERA**: ${clockPos}, looking at center
**ROTATION**: ${rotation}° from front
**VIEW**: ${angleDisplay}
=== END CAMERA POSITION ===
${subjectContext}
${backgroundBlock}
${hintContext}
=== TEXTURE STYLE ===

Create a texture map for multi-color 3D PRINTING in flat vector illustration style.

**COLOR CONSTRAINTS**:
- Use EXACTLY ${mode.texture.colorCount} solid, distinct colors
- NO gradients, NO shading, NO soft transitions
- Each color zone is a crisp block with sharp edges
- Like a paint-by-numbers template or screen print design

**LIGHTING**: COMPLETELY FLAT AND UNLIT
- NO shadows of any kind
- NO highlights or specular reflections
- NO ambient occlusion
- Every pixel shows the TRUE BASE COLOR for printing

**TECHNICAL**:
- Orthographic projection from ${clockPos}
- Subject fills 90% of frame
- Proportions match mesh views exactly
- Color regions large enough for physical printing

=== END TEXTURE STYLE ===

After generating, list colors: COLORS: #RRGGBB, #RRGGBB, ...

Generate the actual ${angleDisplay} texture view now.`;
    }
    else {
        // Full color mode: Albedo Map (Base Color) for PBR
        return `=== CAMERA POSITION ===
**CLOCK SYSTEM**: Subject at center, front facing 6 o'clock.
**CAMERA**: ${clockPos}, looking at center
**ROTATION**: ${rotation}° from front
**VIEW**: ${angleDisplay}
=== END CAMERA POSITION ===
${subjectContext}
${backgroundBlock}
${hintContext}
=== ALBEDO TEXTURE MAP ===

Create an albedo (base color) texture map for 3D printing.

**COLOR CAPTURE**:
- True surface colors WITHOUT any lighting effects
- Full color with natural saturation
- High-frequency texture details as color information
- Fabric weave, wood grain, skin variations, surface scratches

**LIGHTING**: STRICTLY UNLIT
- NO shadows, NO highlights
- NO ambient occlusion, NO reflections
- Each pixel = exact pigment color to be printed

**TECHNICAL**:
- Orthographic projection from ${clockPos}
- Subject fills 90% of frame
- Proportions match mesh views for UV alignment

Result: A flat, unlit texture map for 3D printing workflow.

=== END ALBEDO TEXTURE MAP ===

Generate the actual ${angleDisplay} texture view now.`;
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
function getTexturePromptWithColors(mode, angle, colorPalette, userDescription, hint) {
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
//# sourceMappingURL=mode-configs.js.map