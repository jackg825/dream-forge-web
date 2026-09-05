"use strict";
/**
 * Composite View Generator
 *
 * Generates a 2x2 grid image with 4 orthographic views using the selected Gemini model.
 * This replaces the multi-view generator's 4 separate API calls with a single call,
 * requesting consistent appearance across all views.
 *
 * Output: a native-resolution square image containing:
 * - Top-left: FRONT view (0 degrees)
 * - Top-right: BACK view (180 degrees)
 * - Bottom-left: LEFT view (90 degrees)
 * - Bottom-right: RIGHT view (270 degrees)
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateCompositeView = generateCompositeView;
const axios_1 = __importDefault(require("axios"));
const functions = __importStar(require("firebase-functions"));
const styles_1 = require("../config/styles");
const image_cropper_1 = require("./image-cropper");
const generation_options_1 = require("./generation-options");
const GEMINI_API_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';
/**
 * Build the composite view prompt
 */
function buildCompositePrompt(options, boardSize, colorCount) {
    const viewSize = boardSize / 2;
    const style = (0, styles_1.getStyleConfig)(options.selectedStyle || styles_1.DEFAULT_STYLE);
    const { meshStyle, proportions, features } = style.promptModifiers;
    // Build subject description from analysis
    let subjectBlock = '';
    if (options.userDescription || options.imageAnalysis?.promptDescription) {
        subjectBlock = `
=== SUBJECT DESCRIPTION ===

${options.userDescription || options.imageAnalysis?.promptDescription}

Maintain this exact subject identity across all 4 views.

=== END SUBJECT DESCRIPTION ===
`;
    }
    return `Generate a 2x2 grid image showing 4 orthographic views of the SAME subject.

=== GRID LAYOUT (CRITICAL) ===

The output image MUST be exactly ${boardSize}x${boardSize} pixels, divided into 4 equal quadrants:

+-------------------+-------------------+
|   TOP-LEFT        |   TOP-RIGHT       |
|   FRONT VIEW      |   BACK VIEW       |
|   (0 degrees)     |   (180 degrees)   |
|   ${viewSize}x${viewSize}       |   ${viewSize}x${viewSize}       |
+-------------------+-------------------+
|   BOTTOM-LEFT     |   BOTTOM-RIGHT    |
|   LEFT VIEW       |   RIGHT VIEW      |
|   (90 degrees)    |   (270 degrees)   |
|   ${viewSize}x${viewSize}       |   ${viewSize}x${viewSize}       |
+-------------------+-------------------+

=== END GRID LAYOUT ===
${subjectBlock}
=== FIGURE STYLE: ${style.name.toUpperCase()} ===

**Target Style**: ${meshStyle}

**Proportions**: ${proportions}

**Feature Emphasis**: ${features}

Render in cel-shaded style with approximately ${colorCount} distinct, high-contrast solid colors.
No gradients, no soft shadows - just clean blocks of flat color.
Each color zone has crisp, pixel-sharp edges.

=== END FIGURE STYLE ===

=== CONSISTENCY REQUIREMENTS (CRITICAL) ===

ALL 4 VIEWS MUST SHOW:
- The EXACT same subject (identical proportions, features, accessories)
- The EXACT same color palette (use identical hex colors across all views)
- The EXACT same art style (cel-shaded, flat colors, no gradients)
- The EXACT same level of detail and simplification
- ONLY the camera angle changes between views

DO NOT:
- Change any features between views
- Add or remove accessories between views
- Vary the color palette between views
- Change the art style between views

=== END CONSISTENCY REQUIREMENTS ===

=== VIEW SPECIFICATIONS ===

**FRONT (top-left quadrant)**:
- Camera at 6 o'clock position, looking at center
- Face and front body visible
- Both left and right sides symmetrically visible

**BACK (top-right quadrant)**:
- Camera at 12 o'clock position, looking at center
- Back of head/body visible
- NO face visible
- Tail visible if present

**LEFT (bottom-left quadrant)**:
- Camera at 3 o'clock position, looking at center
- Subject's LEFT side visible
- For characters: LEFT ear visible, nose points toward LEFT edge

**RIGHT (bottom-right quadrant)**:
- Camera at 9 o'clock position, looking at center
- Subject's RIGHT side visible
- For characters: RIGHT ear visible, nose points toward RIGHT edge

=== END VIEW SPECIFICATIONS ===

=== RENDERING REQUIREMENTS ===

- Each quadrant has pure white (#FFFFFF) background
- Add a 2-pixel light gray (#CCCCCC) border between quadrants
- Orthographic projection (no perspective distortion)
- Subject centered in each quadrant, fills 90% of quadrant
- Completely flat lighting - no cast shadows, no highlights
- Output exactly ${boardSize}x${boardSize} pixels

=== END RENDERING REQUIREMENTS ===

Generate the 2x2 grid image now.`;
}
/**
 * Generate a composite view using the selected Gemini image model
 *
 * @param referenceImageBase64 - Base64 encoded reference image
 * @param mimeType - MIME type of the input image
 * @param options - Generation options
 * @returns Cropped view images ready for 3D generation
 */
async function generateCompositeView(referenceImageBase64, mimeType, options = {}) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
        throw new functions.https.HttpsError('failed-precondition', 'Gemini API key not configured');
    }
    const modelId = (0, generation_options_1.resolveGeminiImageModel)(options.geminiModel);
    const colors = (0, generation_options_1.resolveGenerationColors)({ ...options, colorPalette: options.colorPalette ?? options.imageAnalysis?.colorPalette });
    functions.logger.info('Starting composite view generation', {
        model: modelId,
        hasUserDescription: !!options.userDescription,
        hasImageAnalysis: !!options.imageAnalysis,
        selectedStyle: options.selectedStyle || styles_1.DEFAULT_STYLE,
    });
    const boardSize = modelId === 'gemini-3-pro-image' ? 2048 : 1024;
    const prompt = `${buildCompositePrompt(options, boardSize, colors.colorCount)}\n\n${(0, generation_options_1.buildGenerationColorPrompt)(colors)}`;
    // Request 2K only on models that support it; Flash keeps its native 1K output.
    const response = await axios_1.default.post(`${GEMINI_API_BASE}/${modelId}:generateContent`, {
        contents: [
            {
                parts: [
                    {
                        inline_data: {
                            mime_type: mimeType,
                            data: referenceImageBase64,
                        },
                    },
                    {
                        text: prompt,
                    },
                ],
            },
        ],
        generationConfig: {
            responseModalities: ['IMAGE'],
            imageConfig: {
                aspectRatio: '1:1',
                ...(modelId === 'gemini-3-pro-image' && { imageSize: '2K' }),
            },
        },
    }, {
        headers: {
            'Content-Type': 'application/json',
        },
        params: {
            key: apiKey,
        },
        timeout: 120000, // 2 minute timeout for larger image
    });
    // Check for errors
    if (response.data.error) {
        throw new functions.https.HttpsError('internal', `Gemini API error: ${response.data.error.message}`);
    }
    if (response.data.promptFeedback?.blockReason) {
        throw new functions.https.HttpsError('invalid-argument', `Image blocked by safety filters: ${response.data.promptFeedback.blockReason}`);
    }
    // Extract image from response
    const candidate = response.data.candidates?.[0];
    if (!candidate) {
        throw new functions.https.HttpsError('internal', 'No candidates in response');
    }
    const parts = candidate.content?.parts || [];
    const imagePart = parts.find((p) => p.inlineData?.data);
    if (!imagePart) {
        const textPart = parts.find((p) => p.text);
        const textInfo = textPart ? ` Response: "${textPart.text?.substring(0, 200)}"` : '';
        throw new functions.https.HttpsError('internal', `No image returned from Gemini.${textInfo}`);
    }
    const compositeBase64 = imagePart.inlineData.data;
    const compositeBuffer = Buffer.from(compositeBase64, 'base64');
    functions.logger.info('Composite image received, cropping...', {
        bufferSize: compositeBuffer.length,
    });
    // Crop into 4 views
    const cropped = await (0, image_cropper_1.cropCompositeView)(compositeBuffer);
    // Convert buffers back to base64
    const result = {
        front: {
            imageBase64: cropped.front.toString('base64'),
            mimeType: 'image/png',
        },
        back: {
            imageBase64: cropped.back.toString('base64'),
            mimeType: 'image/png',
        },
        left: {
            imageBase64: cropped.left.toString('base64'),
            mimeType: 'image/png',
        },
        right: {
            imageBase64: cropped.right.toString('base64'),
            mimeType: 'image/png',
        },
    };
    functions.logger.info('Composite view generation complete', {
        frontSize: result.front.imageBase64.length,
        backSize: result.back.imageBase64.length,
        leftSize: result.left.imageBase64.length,
        rightSize: result.right.imageBase64.length,
    });
    return result;
}
//# sourceMappingURL=composite-view-generator.js.map