"use strict";
/**
 * H2C Color Optimizer
 * Optimizes images to 7 solid colors for Bambu Lab H2C multi-color 3D printing
 *
 * Uses Gemini 2.5 Flash Image for intelligent color reduction
 * while preserving visual fidelity and printability
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
exports.H2CColorOptimizer = void 0;
exports.createH2CColorOptimizer = createH2CColorOptimizer;
const axios_1 = __importDefault(require("axios"));
const functions = __importStar(require("firebase-functions"));
const GEMINI_API_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';
const MODEL = 'gemini-2.5-flash-image';
/**
 * Prompt for H2C 7-color optimization
 * Uses Vector Art / Sticker Art style for clean color separation
 */
const H2C_OPTIMIZATION_PROMPT = `You are a vector artist preparing images for multi-color 3D printing on a Bambu Lab H2C printer.

Task: Transform this image into a "Paint-by-numbers" style illustration with approximately 7 solid colors.

STYLE REQUIREMENTS:
1. **STYLE**: Flat Vector Illustration / Sticker Art style. Think of vinyl toy or cel-shaded game art.
2. **PALETTE**: Reduce to approximately 7 distinct solid colors with high contrast between them.
3. **GRADIENTS**: FORBIDDEN. No gradients, no fading, no anti-aliasing between color regions.
4. **REGIONS**: "Chunky design" - each color region must be large and well-defined (minimum ~2mm width at typical print scales). Avoid tiny pixel noise.
5. **EDGES**: Crisp, pixel-sharp boundaries between color zones.
6. **COMPOSITION**: Preserve the main subject's recognizable features and overall silhouette.
7. **CONTRAST**: Each color should be distinctly different from adjacent colors for visual appeal.

Output logic: The final image should look like a clean sticker or decal that could be 3D printed with distinct color changes.

After the image, list the colors used in this exact format:
COLORS: #RRGGBB, #RRGGBB, #RRGGBB, #RRGGBB, #RRGGBB, #RRGGBB, #RRGGBB

Important: Generate the actual optimized image, not a description or placeholder.`;
/**
 * Analyze Gemini response for image and color data
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
 * Looks for the COLORS: format in the response
 */
function extractColorPalette(text) {
    if (!text)
        return [];
    // Look for COLORS: #RRGGBB, #RRGGBB, ... format
    const colorsMatch = text.match(/COLORS:\s*(#[0-9A-Fa-f]{6}(?:\s*,\s*#[0-9A-Fa-f]{6})*)/i);
    if (colorsMatch) {
        const colors = colorsMatch[1].match(/#[0-9A-Fa-f]{6}/gi);
        if (colors && colors.length > 0) {
            return colors.map(c => c.toUpperCase());
        }
    }
    // Fallback: find any hex colors in the text
    const hexColors = text.match(/#[0-9A-Fa-f]{6}/gi);
    if (hexColors && hexColors.length > 0) {
        // Remove duplicates and return up to 7 colors
        const uniqueColors = [...new Set(hexColors.map(c => c.toUpperCase()))];
        return uniqueColors.slice(0, 7);
    }
    return [];
}
/**
 * H2C Color Optimizer class
 * Handles image color reduction for multi-color 3D printing
 */
class H2CColorOptimizer {
    apiKey;
    constructor(apiKey) {
        this.apiKey = apiKey;
    }
    /**
     * Optimize an image for H2C 7-color printing
     *
     * @param imageBase64 - Base64 encoded input image
     * @param mimeType - MIME type of the input image (e.g., 'image/png')
     * @returns Optimized image with color palette
     */
    async optimize(imageBase64, mimeType) {
        functions.logger.info('Starting H2C color optimization', {
            model: MODEL,
            inputMimeType: mimeType,
        });
        const response = await axios_1.default.post(`${GEMINI_API_BASE}/${MODEL}:generateContent`, {
            contents: [
                {
                    parts: [
                        {
                            inline_data: {
                                mime_type: mimeType,
                                data: imageBase64,
                            },
                        },
                        {
                            text: H2C_OPTIMIZATION_PROMPT,
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
            timeout: 90000, // 90 second timeout for optimization
        });
        const analysis = analyzeGeminiResponse(response.data);
        functions.logger.info('H2C optimization response analysis', {
            hasImage: analysis.hasImage,
            hasText: !!analysis.textContent,
            textPreview: analysis.textContent?.substring(0, 300),
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
            throw new functions.https.HttpsError('invalid-argument', `Image optimization blocked due to safety concerns: ${analysis.safetyIssues.join(', ')}`);
        }
        if (!analysis.hasImage) {
            const textInfo = analysis.textContent
                ? ` Gemini responded: "${analysis.textContent.substring(0, 200)}"`
                : '';
            throw new functions.https.HttpsError('internal', `No optimized image returned from Gemini.${textInfo}`);
        }
        // Extract image data
        const candidates = response.data.candidates;
        const parts = candidates[0].content?.parts || [];
        const imagePart = parts.find((p) => p.inlineData?.data);
        const responseMimeType = imagePart.inlineData.mimeType;
        const validMimeTypes = ['image/png', 'image/jpeg', 'image/webp'];
        // Extract color palette from text response
        const colorPalette = extractColorPalette(analysis.textContent);
        functions.logger.info('H2C optimization complete', {
            outputMimeType: responseMimeType,
            colorPaletteCount: colorPalette.length,
            colorPalette,
        });
        // Warn if we didn't get exactly 7 colors
        if (colorPalette.length !== 7) {
            functions.logger.warn('Color palette count mismatch', {
                expected: 7,
                actual: colorPalette.length,
                colorPalette,
            });
        }
        return {
            imageBase64: imagePart.inlineData.data,
            mimeType: responseMimeType && validMimeTypes.includes(responseMimeType)
                ? responseMimeType
                : 'image/png',
            colorPalette,
        };
    }
}
exports.H2CColorOptimizer = H2CColorOptimizer;
/**
 * Create an H2CColorOptimizer instance with the API key from environment
 */
function createH2CColorOptimizer() {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
        throw new functions.https.HttpsError('failed-precondition', 'Gemini API key not configured');
    }
    return new H2CColorOptimizer(apiKey);
}
//# sourceMappingURL=h2c-optimizer.js.map