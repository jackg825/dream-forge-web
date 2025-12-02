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
 * Get mesh style instructions based on mode
 * - Simplified mode: Cartoon/vinyl toy style (low-poly, rounded)
 * - Full color mode: Preserve details but optimize for 3D modeling
 */
function getMeshStyleDescription(simplified) {
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
    }
    else {
        // 印刷優化風格 - 平衡細節與可製造性
        return `**3D MODELING OPTIMIZATION - PRINT-READY STYLE**:
Create a 3D-printable representation that balances detail and manufacturability.
Apply MODERATE SURFACE SMOOTHING (30-50% simplification from photorealistic):

**FEATURES TO PRESERVE (Critical for Recognition)**:
- Face/head shape and facial features (eyes, nose, mouth proportions)
- Accessories and adornments (bows, collars, hats, glasses, jewelry)
- Overall silhouette and body proportions
- Large-scale color boundaries and patterns
- Distinctive anatomical features (ears, tail shape, limb positions)

**FEATURES TO SMOOTH/SIMPLIFY (Problematic for Printing)**:
- Fur/hair: Convert to smooth, flowing VOLUMES - no individual strands or texture lines
- Fabric folds: Reduce to 2-3 major creases maximum, eliminate micro-wrinkles
- Skin texture: Smooth to matte finish, remove pores and fine wrinkles
- Surface patterns: Keep only patterns larger than 3mm at print scale
- Feathers/scales: Suggest with subtle surface undulation, not individual elements

**GEOMETRY GUIDELINES**:
- Minimum feature thickness: 2mm equivalent (avoid thin protrusions)
- Prefer convex surfaces over concave (reduces support requirements)
- Round sharp edges to smooth transitions
- Merge closely-spaced elements where appropriate

The result should look like a high-quality collectible figurine or resin kit -
detailed enough to be recognizable, smooth enough to print cleanly.`;
    }
}
/**
 * Get concrete viewpoint description for better AI understanding
 * Uses physical feature visibility instead of abstract rotation angles
 */
function getViewpointDescription(angle) {
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
function getMeshPrompt(mode, angle, userDescription, hint) {
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
    }
    else {
        // Full color mode: print-ready style optimized for 3D printing
        return `You are a 3D modeling expert preparing reference images for 3D PRINTING.${userDescBlock}${hintBlock}

Generate a ${angleDisplay} VIEW of this object optimized for 3D Print Manufacturing.

${getMeshStyleDescription(false)}

REQUIREMENTS:
1. **VIEW**: Strictly Orthographic. Camera perfectly level with the object center. Show from directly ${getViewpointDescription(angle)}.
2. **LIGHTING**: Studio Softbox Lighting. Even illumination. Include subtle Ambient Occlusion in MAJOR crevices only to define primary shapes. Avoid shadow detail that suggests surface texture.
3. **SURFACE TREATMENT**: Render smooth, matte surfaces. Show form through SHAPE, not through surface texture rendering. Think "injection-molded plastic" or "resin cast" finish.
4. **BACKGROUND**: Pure White (#FFFFFF).
5. **CONSISTENCY**: Critical. If the object has a tail/backpack/feature in the reference, it MUST appear correctly in this angle.
6. **FRAMING**: Center the object, fill 85% of the canvas.

Goal: A reference image that clearly defines 3D VOLUMES and SHAPES for mesh reconstruction, without confusing surface detail that the AI might interpret as geometry.

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
function getTexturePrompt(mode, angle, userDescription, hint) {
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
    }
    else {
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
function getTexturePromptWithColors(mode, angle, colorPalette, userDescription, hint) {
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
//# sourceMappingURL=mode-configs.js.map