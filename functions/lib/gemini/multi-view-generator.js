"use strict";
/**
 * Multi-View Generator for Pipeline Workflow
 *
 * Generates 6 images from a reference image using Gemini:
 * - 4 mesh views for 3D mesh generation
 * - 2 texture views for texture mapping
 *
 * Supports multiple generation modes for A/B testing different
 * image processing strategies.
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
const mode_configs_1 = require("./mode-configs");
const GEMINI_API_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';
const MODEL = 'gemini-3-pro-image-preview';
// Minimum delay between sequential API calls to avoid rate limiting
const MIN_DELAY_BETWEEN_CALLS_MS = 500;
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
function extractColorPalette(text, expectedCount) {
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
        return uniqueColors.slice(0, expectedCount);
    }
    return [];
}
/**
 * Multi-View Generator class
 * Generates 6 images from a reference image for 3D model generation
 *
 * Supports different generation modes for A/B testing
 */
class MultiViewGenerator {
    apiKey;
    modeConfig;
    userDescription;
    constructor(apiKey, modeId = mode_configs_1.DEFAULT_MODE, userDescription) {
        this.apiKey = apiKey;
        this.modeConfig = (0, mode_configs_1.getMode)(modeId);
        this.userDescription = userDescription;
    }
    /**
     * Get the current mode configuration
     */
    get mode() {
        return this.modeConfig;
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
            mode: this.modeConfig.id,
            modeName: this.modeConfig.name,
            totalViews: 6,
            meshViews: 4,
            textureViews: 2,
            meshSimplified: this.modeConfig.mesh.simplified,
            textureSimplified: this.modeConfig.texture.simplified,
        });
        const meshAngles = ['front', 'back', 'left', 'right'];
        const textureAngles = ['front', 'back'];
        const meshViews = {};
        const textureViews = {};
        let viewIndex = 0;
        // Generate mesh views
        for (const angle of meshAngles) {
            if (viewIndex > 0) {
                await new Promise((resolve) => setTimeout(resolve, MIN_DELAY_BETWEEN_CALLS_MS));
            }
            functions.logger.info(`Generating mesh view: ${angle}`, {
                viewIndex,
                type: 'mesh',
                simplified: this.modeConfig.mesh.simplified,
                hasUserDescription: !!this.userDescription,
            });
            const prompt = (0, mode_configs_1.getMeshPrompt)(this.modeConfig, angle, this.userDescription);
            const result = await this.generateSingleView(referenceImageBase64, mimeType, prompt, this.modeConfig.mesh.extractColors, this.modeConfig.mesh.colorCount);
            meshViews[angle] = result;
            viewIndex++;
        }
        // Generate texture views
        for (const angle of textureAngles) {
            await new Promise((resolve) => setTimeout(resolve, MIN_DELAY_BETWEEN_CALLS_MS));
            functions.logger.info(`Generating texture view: ${angle}`, {
                viewIndex,
                type: 'texture',
                simplified: this.modeConfig.texture.simplified,
                hasUserDescription: !!this.userDescription,
            });
            const prompt = (0, mode_configs_1.getTexturePrompt)(this.modeConfig, angle, this.userDescription);
            const result = await this.generateSingleView(referenceImageBase64, mimeType, prompt, this.modeConfig.texture.extractColors, this.modeConfig.texture.colorCount);
            textureViews[angle] = result;
            viewIndex++;
        }
        functions.logger.info('Multi-view generation complete', {
            mode: this.modeConfig.id,
            meshViewCount: Object.keys(meshViews).length,
            textureViewCount: Object.keys(textureViews).length,
        });
        return {
            meshViews: meshViews,
            textureViews: textureViews,
        };
    }
    /**
     * Aggregate color palettes from all mesh views
     * Combines colors from all 4 views, deduplicates, and sorts by frequency
     */
    aggregateColorPalettes(meshViews) {
        const colorFrequency = new Map();
        const byView = {};
        // Collect colors from each view
        for (const [angle, view] of Object.entries(meshViews)) {
            const viewColors = view.colorPalette || [];
            byView[angle] = viewColors;
            for (const color of viewColors) {
                const normalizedColor = color.toUpperCase();
                colorFrequency.set(normalizedColor, (colorFrequency.get(normalizedColor) || 0) + 1);
            }
        }
        // Sort by frequency (most common first)
        const sortedColors = [...colorFrequency.entries()]
            .sort((a, b) => b[1] - a[1])
            .map(([color]) => color);
        return {
            byView: byView,
            unified: sortedColors,
            dominantColors: sortedColors.slice(0, 7), // Top 7 colors
        };
    }
    /**
     * Generate all 6 views using staggered parallel execution
     *
     * This method respects the 500ms rate limit while maximizing parallelism:
     * - Phase 1: Start 4 mesh views with 0, 500, 1000, 1500ms delays
     * - Aggregate color palette from mesh views
     * - Phase 2: Start 2 texture views with 0, 500ms delays (with color hints)
     *
     * Expected time: ~18s (vs ~50s for sequential)
     *
     * @param referenceImageBase64 - Base64 encoded reference image
     * @param mimeType - MIME type of the input image
     * @param onProgress - Optional callback for progress updates
     * @returns All 6 generated views with aggregated color palette
     */
    async generateAllViewsParallel(referenceImageBase64, mimeType, onProgress) {
        const meshAngles = ['front', 'back', 'left', 'right'];
        const textureAngles = ['front', 'back'];
        functions.logger.info('Starting parallel multi-view generation', {
            model: MODEL,
            mode: this.modeConfig.id,
            modeName: this.modeConfig.name,
            strategy: 'staggered-parallel',
            totalViews: 6,
        });
        // Phase 1: Staggered parallel mesh view generation
        let meshCompleted = 0;
        const meshPromises = meshAngles.map((angle, index) => this.generateViewWithDelay(referenceImageBase64, mimeType, 'mesh', angle, index * MIN_DELAY_BETWEEN_CALLS_MS // 0, 500, 1000, 1500ms
        ).then(async (result) => {
            meshCompleted++;
            if (onProgress) {
                await onProgress('mesh', angle, meshCompleted, 4);
            }
            return { angle, result };
        }));
        const meshResults = await Promise.all(meshPromises);
        // Build meshViews record
        const meshViews = {};
        for (const { angle, result } of meshResults) {
            meshViews[angle] = result;
        }
        // Aggregate color palettes from all mesh views
        const aggregatedPalette = this.aggregateColorPalettes(meshViews);
        functions.logger.info('Mesh views complete, starting texture generation', {
            meshViewCount: meshResults.length,
            dominantColors: aggregatedPalette.dominantColors,
            totalUniqueColors: aggregatedPalette.unified.length,
        });
        // Phase 2: Staggered parallel texture view generation (with color hints)
        let textureCompleted = 0;
        const texturePromises = textureAngles.map((angle, index) => this.generateTextureViewWithColorHints(referenceImageBase64, mimeType, angle, aggregatedPalette.dominantColors, index * MIN_DELAY_BETWEEN_CALLS_MS // 0, 500ms
        ).then(async (result) => {
            textureCompleted++;
            if (onProgress) {
                await onProgress('texture', angle, textureCompleted, 2);
            }
            return { angle, result };
        }));
        const textureResults = await Promise.all(texturePromises);
        // Build textureViews record
        const textureViews = {};
        for (const { angle, result } of textureResults) {
            textureViews[angle] = result;
        }
        functions.logger.info('Parallel multi-view generation complete', {
            mode: this.modeConfig.id,
            meshViewCount: Object.keys(meshViews).length,
            textureViewCount: Object.keys(textureViews).length,
            dominantColorCount: aggregatedPalette.dominantColors.length,
        });
        return {
            meshViews: meshViews,
            textureViews: textureViews,
            aggregatedPalette,
        };
    }
    /**
     * Generate a single view with a delay (for staggered parallel execution)
     */
    async generateViewWithDelay(referenceImageBase64, mimeType, type, angle, delayMs) {
        if (delayMs > 0) {
            await new Promise((resolve) => setTimeout(resolve, delayMs));
        }
        functions.logger.info(`Generating ${type} view: ${angle}`, {
            type,
            angle,
            delayMs,
            simplified: type === 'mesh' ? this.modeConfig.mesh.simplified : this.modeConfig.texture.simplified,
        });
        if (type === 'mesh') {
            const prompt = (0, mode_configs_1.getMeshPrompt)(this.modeConfig, angle, this.userDescription);
            return this.generateSingleView(referenceImageBase64, mimeType, prompt, this.modeConfig.mesh.extractColors, this.modeConfig.mesh.colorCount);
        }
        else {
            const prompt = (0, mode_configs_1.getTexturePrompt)(this.modeConfig, angle, this.userDescription);
            return this.generateSingleView(referenceImageBase64, mimeType, prompt, this.modeConfig.texture.extractColors, this.modeConfig.texture.colorCount);
        }
    }
    /**
     * Generate a texture view with color hints from mesh views
     * Used during parallel generation to ensure color consistency
     */
    async generateTextureViewWithColorHints(referenceImageBase64, mimeType, angle, colorPalette, delayMs) {
        if (delayMs > 0) {
            await new Promise((resolve) => setTimeout(resolve, delayMs));
        }
        functions.logger.info(`Generating texture view with color hints: ${angle}`, {
            angle,
            delayMs,
            colorCount: colorPalette.length,
            simplified: this.modeConfig.texture.simplified,
        });
        // Use color-aware prompt if we have colors
        const prompt = colorPalette.length > 0
            ? (0, mode_configs_1.getTexturePromptWithColors)(this.modeConfig, angle, colorPalette, this.userDescription)
            : (0, mode_configs_1.getTexturePrompt)(this.modeConfig, angle, this.userDescription);
        return this.generateSingleView(referenceImageBase64, mimeType, prompt, this.modeConfig.texture.extractColors, this.modeConfig.texture.colorCount);
    }
    /**
     * Generate texture views with existing color palette
     * Used when regenerating mesh views and need to update texture views
     */
    async generateTextureViewsWithColors(referenceImageBase64, mimeType, colorPalette) {
        const textureAngles = ['front', 'back'];
        functions.logger.info('Generating texture views with color palette', {
            colorCount: colorPalette.length,
            colors: colorPalette,
        });
        // Staggered parallel generation
        const promises = textureAngles.map((angle, index) => this.generateTextureViewWithColorHints(referenceImageBase64, mimeType, angle, colorPalette, index * MIN_DELAY_BETWEEN_CALLS_MS).then((result) => ({ angle, result })));
        const results = await Promise.all(promises);
        const textureViews = {};
        for (const { angle, result } of results) {
            textureViews[angle] = result;
        }
        return textureViews;
    }
    /**
     * Generate a single mesh view
     * @param hint - Optional regeneration hint for adjustments
     */
    async generateMeshView(referenceImageBase64, mimeType, angle, hint) {
        const prompt = (0, mode_configs_1.getMeshPrompt)(this.modeConfig, angle, this.userDescription, hint);
        return this.generateSingleView(referenceImageBase64, mimeType, prompt, this.modeConfig.mesh.extractColors, this.modeConfig.mesh.colorCount);
    }
    /**
     * Generate a single texture view
     * @param hint - Optional regeneration hint for adjustments
     */
    async generateTextureView(referenceImageBase64, mimeType, angle, hint) {
        const prompt = (0, mode_configs_1.getTexturePrompt)(this.modeConfig, angle, this.userDescription, hint);
        return this.generateSingleView(referenceImageBase64, mimeType, prompt, this.modeConfig.texture.extractColors, this.modeConfig.texture.colorCount);
    }
    /**
     * Generate a single view with the given prompt
     */
    async generateSingleView(referenceImageBase64, mimeType, prompt, extractColors, expectedColorCount) {
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
            extractColors,
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
        // Extract color palette if requested
        if (extractColors) {
            result.colorPalette = extractColorPalette(analysis.textContent, expectedColorCount);
            if (result.colorPalette.length !== expectedColorCount) {
                functions.logger.warn('Color palette count mismatch', {
                    expected: expectedColorCount,
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
 *
 * @param modeId - Generation mode ID (default: 'simplified-mesh')
 * @param userDescription - Optional user-provided description of the object
 */
function createMultiViewGenerator(modeId = mode_configs_1.DEFAULT_MODE, userDescription) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
        throw new functions.https.HttpsError('failed-precondition', 'Gemini API key not configured');
    }
    return new MultiViewGenerator(apiKey, modeId, userDescription);
}
//# sourceMappingURL=multi-view-generator.js.map