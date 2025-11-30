"use strict";
/**
 * Multi-View Generator for Pipeline Workflow
 *
 * Generates 6 images from a reference image using Gemini:
 * - 4 mesh-optimized views (7-color H2C style) for 3D mesh generation
 * - 2 texture-ready views (full color) for texture mapping
 *
 * Uses Gemini 3 Pro Image Preview for consistent multi-view generation
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
exports.MultiViewGenerator = void 0;
exports.createMultiViewGenerator = createMultiViewGenerator;
const axios_1 = __importDefault(require("axios"));
const functions = __importStar(require("firebase-functions"));
const GEMINI_API_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';
const MODEL = 'gemini-3-pro-image-preview';
// Minimum delay between sequential API calls to avoid rate limiting
const MIN_DELAY_BETWEEN_CALLS_MS = 500;
/**
 * Prompts for mesh-optimized views (7-color H2C style)
 * These images are simplified to 7 solid colors for optimal 3D mesh generation
 */
const MESH_VIEW_PROMPTS = {
    front: `You are an expert at preparing images for multi-color 3D printing.

Generate a FRONT VIEW of this object optimized for 3D mesh generation.

Requirements:
1. Show the object from directly in front, centered in frame
2. Reduce to exactly 7 distinct solid colors (no gradients, no anti-aliasing)
3. Clear, well-defined boundaries between color regions
4. Clean, plain white background
5. Maintain recognizable features and proportions
6. Optimize for layer adhesion (minimum ~2mm width color regions)

After the image, list the 7 colors: COLORS: #RRGGBB, #RRGGBB, #RRGGBB, #RRGGBB, #RRGGBB, #RRGGBB, #RRGGBB

Generate the actual image, not a description.`,
    back: `You are an expert at preparing images for multi-color 3D printing.

Generate a BACK VIEW of this object (rotated 180 degrees) optimized for 3D mesh generation.

Requirements:
1. Show the object from directly behind (180° rotation from front)
2. Reduce to exactly 7 distinct solid colors (no gradients, no anti-aliasing)
3. Clear, well-defined boundaries between color regions
4. Clean, plain white background
5. Maintain consistent lighting, style, and proportions as front view
6. Optimize for layer adhesion (minimum ~2mm width color regions)

After the image, list the 7 colors: COLORS: #RRGGBB, #RRGGBB, #RRGGBB, #RRGGBB, #RRGGBB, #RRGGBB, #RRGGBB

Generate the actual image, not a description.`,
    left: `You are an expert at preparing images for multi-color 3D printing.

Generate a LEFT SIDE VIEW of this object (rotated 90° counterclockwise) optimized for 3D mesh generation.

Requirements:
1. Show the object from the left side (90° counterclockwise from front)
2. Reduce to exactly 7 distinct solid colors (no gradients, no anti-aliasing)
3. Clear, well-defined boundaries between color regions
4. Clean, plain white background
5. Maintain consistent lighting, style, and proportions
6. Optimize for layer adhesion (minimum ~2mm width color regions)

After the image, list the 7 colors: COLORS: #RRGGBB, #RRGGBB, #RRGGBB, #RRGGBB, #RRGGBB, #RRGGBB, #RRGGBB

Generate the actual image, not a description.`,
    right: `You are an expert at preparing images for multi-color 3D printing.

Generate a RIGHT SIDE VIEW of this object (rotated 90° clockwise) optimized for 3D mesh generation.

Requirements:
1. Show the object from the right side (90° clockwise from front)
2. Reduce to exactly 7 distinct solid colors (no gradients, no anti-aliasing)
3. Clear, well-defined boundaries between color regions
4. Clean, plain white background
5. Maintain consistent lighting, style, and proportions
6. Optimize for layer adhesion (minimum ~2mm width color regions)

After the image, list the 7 colors: COLORS: #RRGGBB, #RRGGBB, #RRGGBB, #RRGGBB, #RRGGBB, #RRGGBB, #RRGGBB

Generate the actual image, not a description.`,
};
/**
 * Prompts for texture-ready views (full color)
 * These images preserve full color detail for texture mapping
 */
const TEXTURE_VIEW_PROMPTS = {
    front: `Generate a high-quality FRONT VIEW of this object for texture mapping.

Requirements:
1. Show the object from directly in front, centered
2. Preserve full color detail, gradients, and textures
3. High-resolution surface detail
4. Consistent, neutral lighting
5. Clean, plain background (white or neutral)
6. Maintain exact proportions and all features

Generate the actual image, not a description.`,
    back: `Generate a high-quality BACK VIEW of this object (rotated 180 degrees) for texture mapping.

Requirements:
1. Show the object from directly behind (180° rotation from front)
2. Preserve full color detail, gradients, and textures
3. High-resolution surface detail
4. Consistent, neutral lighting matching front view
5. Clean, plain background (white or neutral)
6. Maintain exact proportions and all features

Generate the actual image, not a description.`,
};
/**
 * Analyze Gemini response for image and text data
 */
function analyzeGeminiResponse(response) {
    const result = {
        hasImage: false,
        textContent: null,
        blockReason: null,
        finishReason: null,
        safetyIssues: [],
        errorMessage: null,
    };
    if (response.error) {
        result.errorMessage = `API Error ${response.error.code}: ${response.error.message}`;
        return result;
    }
    if (response.promptFeedback?.blockReason) {
        result.blockReason = response.promptFeedback.blockReason;
        if (response.promptFeedback.safetyRatings) {
            result.safetyIssues = response.promptFeedback.safetyRatings
                .filter((r) => r.probability !== 'NEGLIGIBLE')
                .map((r) => `${r.category}: ${r.probability}`);
        }
        return result;
    }
    const candidate = response.candidates?.[0];
    if (!candidate) {
        result.errorMessage = 'No candidates in response';
        return result;
    }
    result.finishReason = candidate.finishReason || null;
    if (candidate.safetyRatings) {
        result.safetyIssues = candidate.safetyRatings
            .filter((r) => r.probability !== 'NEGLIGIBLE' && r.probability !== 'LOW')
            .map((r) => `${r.category}: ${r.probability}`);
    }
    const parts = candidate.content?.parts || [];
    const imagePart = parts.find((p) => p.inlineData?.data);
    result.hasImage = !!imagePart;
    const textParts = parts.filter((p) => p.text).map((p) => p.text).join('\n');
    if (textParts) {
        result.textContent = textParts;
    }
    return result;
}
/**
 * Extract color palette from Gemini's text response
 */
function extractColorPalette(text) {
    if (!text)
        return [];
    // Look for COLORS: #RRGGBB, #RRGGBB, ... format
    const colorsMatch = text.match(/COLORS:\s*(#[0-9A-Fa-f]{6}(?:\s*,\s*#[0-9A-Fa-f]{6})*)/i);
    if (colorsMatch) {
        const colors = colorsMatch[1].match(/#[0-9A-Fa-f]{6}/gi);
        if (colors && colors.length > 0) {
            return colors.map((c) => c.toUpperCase());
        }
    }
    // Fallback: find any hex colors in the text
    const hexColors = text.match(/#[0-9A-Fa-f]{6}/gi);
    if (hexColors && hexColors.length > 0) {
        const uniqueColors = [...new Set(hexColors.map((c) => c.toUpperCase()))];
        return uniqueColors.slice(0, 7);
    }
    return [];
}
/**
 * Multi-View Generator class
 * Generates 6 images from a reference image for 3D model generation
 */
class MultiViewGenerator {
    apiKey;
    constructor(apiKey) {
        this.apiKey = apiKey;
    }
    /**
     * Generate all 6 views from a reference image
     *
     * @param referenceImageBase64 - Base64 encoded reference image
     * @param mimeType - MIME type of the input image
     * @returns All 6 generated views (4 mesh + 2 texture)
     */
    async generateAllViews(referenceImageBase64, mimeType) {
        functions.logger.info('Starting multi-view generation', {
            model: MODEL,
            totalViews: 6,
            meshViews: 4,
            textureViews: 2,
        });
        const meshAngles = ['front', 'back', 'left', 'right'];
        const textureAngles = ['front', 'back'];
        const meshViews = {};
        const textureViews = {};
        let viewIndex = 0;
        // Generate mesh-optimized views (7-color)
        for (const angle of meshAngles) {
            if (viewIndex > 0) {
                await new Promise((resolve) => setTimeout(resolve, MIN_DELAY_BETWEEN_CALLS_MS));
            }
            functions.logger.info(`Generating mesh view: ${angle}`, { viewIndex, type: 'mesh' });
            const result = await this.generateSingleView(referenceImageBase64, mimeType, MESH_VIEW_PROMPTS[angle], true // isMeshView
            );
            meshViews[angle] = result;
            viewIndex++;
        }
        // Generate texture-ready views (full color)
        for (const angle of textureAngles) {
            await new Promise((resolve) => setTimeout(resolve, MIN_DELAY_BETWEEN_CALLS_MS));
            functions.logger.info(`Generating texture view: ${angle}`, { viewIndex, type: 'texture' });
            const result = await this.generateSingleView(referenceImageBase64, mimeType, TEXTURE_VIEW_PROMPTS[angle], false // isMeshView
            );
            textureViews[angle] = result;
            viewIndex++;
        }
        functions.logger.info('Multi-view generation complete', {
            meshViewCount: Object.keys(meshViews).length,
            textureViewCount: Object.keys(textureViews).length,
        });
        return {
            meshViews: meshViews,
            textureViews: textureViews,
        };
    }
    /**
     * Generate a single mesh-optimized view (7-color)
     */
    async generateMeshView(referenceImageBase64, mimeType, angle) {
        return this.generateSingleView(referenceImageBase64, mimeType, MESH_VIEW_PROMPTS[angle], true);
    }
    /**
     * Generate a single texture-ready view (full color)
     */
    async generateTextureView(referenceImageBase64, mimeType, angle) {
        return this.generateSingleView(referenceImageBase64, mimeType, TEXTURE_VIEW_PROMPTS[angle], false);
    }
    /**
     * Generate a single view with the given prompt
     */
    async generateSingleView(referenceImageBase64, mimeType, prompt, isMeshView) {
        const response = await axios_1.default.post(`${GEMINI_API_BASE}/${MODEL}:generateContent`, {
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
                responseModalities: ['TEXT', 'IMAGE'],
                imageConfig: {
                    aspectRatio: '1:1',
                    imageSize: '1K',
                },
            },
        }, {
            headers: {
                'Content-Type': 'application/json',
            },
            params: {
                key: this.apiKey,
            },
            timeout: 90000, // 90 second timeout
        });
        const analysis = analyzeGeminiResponse(response.data);
        functions.logger.info('View generation response', {
            isMeshView,
            hasImage: analysis.hasImage,
            hasText: !!analysis.textContent,
            blockReason: analysis.blockReason,
            finishReason: analysis.finishReason,
            safetyIssues: analysis.safetyIssues,
            errorMessage: analysis.errorMessage,
        });
        // Handle error cases
        if (analysis.errorMessage) {
            throw new functions.https.HttpsError('internal', `Gemini API error: ${analysis.errorMessage}`);
        }
        if (analysis.blockReason) {
            throw new functions.https.HttpsError('invalid-argument', `Image blocked by Gemini safety filters: ${analysis.blockReason}. ` +
                `Please try a different image.`);
        }
        if (analysis.safetyIssues.length > 0 && !analysis.hasImage) {
            throw new functions.https.HttpsError('invalid-argument', `Image generation blocked due to safety concerns: ${analysis.safetyIssues.join(', ')}`);
        }
        if (!analysis.hasImage) {
            const textInfo = analysis.textContent
                ? ` Gemini responded: "${analysis.textContent.substring(0, 200)}"`
                : '';
            throw new functions.https.HttpsError('internal', `No image returned from Gemini.${textInfo}`);
        }
        // Extract image data
        const candidates = response.data.candidates;
        const parts = candidates[0].content?.parts || [];
        const imagePart = parts.find((p) => p.inlineData?.data);
        const responseMimeType = imagePart.inlineData.mimeType;
        const validMimeTypes = ['image/png', 'image/jpeg', 'image/webp'];
        const result = {
            imageBase64: imagePart.inlineData.data,
            mimeType: responseMimeType && validMimeTypes.includes(responseMimeType)
                ? responseMimeType
                : 'image/png',
        };
        // Extract color palette for mesh views
        if (isMeshView) {
            result.colorPalette = extractColorPalette(analysis.textContent);
            if (result.colorPalette.length !== 7) {
                functions.logger.warn('Color palette count mismatch', {
                    expected: 7,
                    actual: result.colorPalette.length,
                    colorPalette: result.colorPalette,
                });
            }
        }
        return result;
    }
}
exports.MultiViewGenerator = MultiViewGenerator;
/**
 * Create a MultiViewGenerator instance with the API key from environment
 */
function createMultiViewGenerator() {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
        throw new functions.https.HttpsError('failed-precondition', 'Gemini API key not configured');
    }
    return new MultiViewGenerator(apiKey);
}
//# sourceMappingURL=multi-view-generator.js.map