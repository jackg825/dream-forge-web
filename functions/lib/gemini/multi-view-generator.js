"use strict";
/**
 * Multi-View Generator for Pipeline Workflow
 *
 * Generates 4 mesh view images from a reference image using Gemini
 * for 3D mesh generation.
 *
 * Supports multiple generation modes for A/B testing different
 * image processing strategies.
 *
 * Uses Gemini 2.5 Flash Image for consistent multi-view generation
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
const styles_1 = require("../config/styles");
const GEMINI_API_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';
// Maps model keys to actual Gemini API model IDs
const GEMINI_MODEL_IDS = {
    'gemini-2.5-flash': 'gemini-2.5-flash-image', // Legacy -> same API model
    'gemini-2.5-flash-image': 'gemini-2.5-flash-image', // Direct mapping
    'gemini-3-pro-image-preview': 'gemini-2.5-flash-image', // TODO: Update when Pro image model available
};
const DEFAULT_GEMINI_MODEL = 'gemini-2.5-flash-image';
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
    imageAnalysis; // Full image analysis for feature extraction
    geminiModel; // Selected Gemini model for image generation
    selectedStyle; // User-selected figure style
    constructor(apiKey, modeId = mode_configs_1.DEFAULT_MODE, userDescription, imageAnalysis, geminiModel = DEFAULT_GEMINI_MODEL, selectedStyle) {
        this.apiKey = apiKey;
        this.modeConfig = (0, mode_configs_1.getMode)(modeId);
        this.userDescription = userDescription;
        this.imageAnalysis = imageAnalysis;
        this.geminiModel = geminiModel;
        this.selectedStyle = selectedStyle;
    }
    /**
     * Get the current mode configuration
     */
    get mode() {
        return this.modeConfig;
    }
    /**
     * Generate all 4 mesh views from a reference image
     *
     * @param referenceImageBase64 - Base64 encoded reference image
     * @param mimeType - MIME type of the input image
     * @returns All 4 generated mesh views
     */
    async generateAllViews(referenceImageBase64, mimeType) {
        functions.logger.info('Starting multi-view generation', {
            model: GEMINI_MODEL_IDS[this.geminiModel],
            geminiModel: this.geminiModel,
            mode: this.modeConfig.id,
            modeName: this.modeConfig.name,
            totalViews: 4,
            meshSimplified: this.modeConfig.mesh.simplified,
        });
        const meshAngles = ['front', 'back', 'left', 'right'];
        const meshViews = {};
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
            const prompt = (0, mode_configs_1.getMeshPrompt)(this.modeConfig, angle, this.userDescription, undefined, this.imageAnalysis, this.selectedStyle);
            const result = await this.generateSingleView(referenceImageBase64, mimeType, prompt, this.modeConfig.mesh.extractColors, this.modeConfig.mesh.colorCount);
            meshViews[angle] = result;
            viewIndex++;
        }
        functions.logger.info('Multi-view generation complete', {
            mode: this.modeConfig.id,
            meshViewCount: Object.keys(meshViews).length,
        });
        return {
            meshViews: meshViews,
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
     * Generate all 4 mesh views using staggered parallel execution
     *
     * This method respects the 500ms rate limit while maximizing parallelism:
     * - Start 4 mesh views with 0, 500, 1000, 1500ms delays
     * - Aggregate color palette from mesh views
     *
     * Expected time: ~12s (vs ~32s for sequential)
     *
     * @param referenceImageBase64 - Base64 encoded reference image
     * @param mimeType - MIME type of the input image
     * @param onProgress - Optional callback for progress updates
     * @returns All 4 generated mesh views with aggregated color palette
     */
    async generateAllViewsParallel(referenceImageBase64, mimeType, onProgress) {
        const meshAngles = ['front', 'back', 'left', 'right'];
        functions.logger.info('Starting parallel multi-view generation', {
            model: GEMINI_MODEL_IDS[this.geminiModel],
            geminiModel: this.geminiModel,
            mode: this.modeConfig.id,
            modeName: this.modeConfig.name,
            strategy: 'staggered-parallel',
            totalViews: 4,
        });
        // Staggered parallel mesh view generation
        let meshCompleted = 0;
        const meshPromises = meshAngles.map((angle, index) => this.generateMeshViewWithDelay(referenceImageBase64, mimeType, angle, index * MIN_DELAY_BETWEEN_CALLS_MS // 0, 500, 1000, 1500ms
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
        functions.logger.info('Parallel multi-view generation complete', {
            mode: this.modeConfig.id,
            meshViewCount: Object.keys(meshViews).length,
            dominantColorCount: aggregatedPalette.dominantColors.length,
        });
        return {
            meshViews: meshViews,
            aggregatedPalette,
        };
    }
    /**
     * Generate a single mesh view with a delay (for staggered parallel execution)
     */
    async generateMeshViewWithDelay(referenceImageBase64, mimeType, angle, delayMs) {
        if (delayMs > 0) {
            await new Promise((resolve) => setTimeout(resolve, delayMs));
        }
        functions.logger.info(`Generating mesh view: ${angle}`, {
            type: 'mesh',
            angle,
            delayMs,
            simplified: this.modeConfig.mesh.simplified,
        });
        const prompt = (0, mode_configs_1.getMeshPrompt)(this.modeConfig, angle, this.userDescription, undefined, this.imageAnalysis, this.selectedStyle);
        return this.generateSingleView(referenceImageBase64, mimeType, prompt, this.modeConfig.mesh.extractColors, this.modeConfig.mesh.colorCount);
    }
    /**
     * Generate a single mesh view
     * @param hint - Optional regeneration hint for adjustments
     */
    async generateMeshView(referenceImageBase64, mimeType, angle, hint) {
        const prompt = (0, mode_configs_1.getMeshPrompt)(this.modeConfig, angle, this.userDescription, hint, this.imageAnalysis, this.selectedStyle);
        return this.generateSingleView(referenceImageBase64, mimeType, prompt, this.modeConfig.mesh.extractColors, this.modeConfig.mesh.colorCount);
    }
    /**
     * Generate remaining view angles from a styled reference image
     *
     * This is Phase 2 of the two-phase generation flow:
     * - Phase 1 generates a styled reference at the detected angle
     * - Phase 2 (this method) generates the remaining 3 angles from that reference
     *
     * The key difference from generateAllViews: the prompt emphasizes maintaining
     * EXACT style consistency with the reference, not applying style transformation.
     *
     * @param styledReferenceBase64 - Base64 encoded styled reference image
     * @param mimeType - MIME type of the reference image
     * @param sourceAngle - The angle of the styled reference (will be excluded)
     * @param referenceColorPalette - Color palette from the styled reference
     * @param onProgress - Optional callback for progress updates
     * @returns Views for the 3 remaining angles (excluding sourceAngle)
     */
    async generateViewsFromStyledReference(styledReferenceBase64, mimeType, sourceAngle, referenceColorPalette, onProgress) {
        // Determine which angles to generate (all except sourceAngle)
        const allAngles = ['front', 'back', 'left', 'right'];
        const targetAngles = allAngles.filter((a) => a !== sourceAngle);
        functions.logger.info('Starting views from styled reference', {
            model: GEMINI_MODEL_IDS[this.geminiModel],
            sourceAngle,
            targetAngles,
            colorPaletteCount: referenceColorPalette.length,
            selectedStyle: this.selectedStyle,
        });
        // Staggered parallel generation
        let completed = 0;
        const promises = targetAngles.map((angle, index) => this.generateViewFromReferenceWithDelay(styledReferenceBase64, mimeType, sourceAngle, angle, referenceColorPalette, index * MIN_DELAY_BETWEEN_CALLS_MS // 0, 500, 1000ms
        ).then(async (result) => {
            completed++;
            if (onProgress) {
                await onProgress('mesh', angle, completed, targetAngles.length);
            }
            return { angle, result };
        }));
        const results = await Promise.all(promises);
        // Build result record
        const views = {};
        for (const { angle, result } of results) {
            views[angle] = result;
        }
        functions.logger.info('Views from styled reference complete', {
            sourceAngle,
            generatedViews: Object.keys(views),
            viewCount: Object.keys(views).length,
        });
        return views;
    }
    /**
     * Generate a single view from styled reference with delay
     */
    async generateViewFromReferenceWithDelay(styledReferenceBase64, mimeType, sourceAngle, targetAngle, referenceColorPalette, delayMs) {
        if (delayMs > 0) {
            await new Promise((resolve) => setTimeout(resolve, delayMs));
        }
        functions.logger.info(`Generating view from reference: ${targetAngle}`, {
            sourceAngle,
            targetAngle,
            delayMs,
        });
        const prompt = this.buildFromReferencePrompt(sourceAngle, targetAngle, referenceColorPalette);
        return this.generateSingleView(styledReferenceBase64, mimeType, prompt, true, // Always extract colors for consistency
        7);
    }
    /**
     * Generate a single view from styled reference (for regeneration)
     *
     * @param styledReferenceBase64 - Base64 encoded styled reference image
     * @param mimeType - MIME type of the reference image
     * @param sourceAngle - The angle of the styled reference
     * @param targetAngle - The angle to generate
     * @param referenceColorPalette - Color palette from the styled reference
     * @param hint - Optional regeneration hint
     */
    async generateSingleViewFromReference(styledReferenceBase64, mimeType, sourceAngle, targetAngle, referenceColorPalette, hint) {
        const prompt = this.buildFromReferencePrompt(sourceAngle, targetAngle, referenceColorPalette, hint);
        return this.generateSingleView(styledReferenceBase64, mimeType, prompt, true, 7);
    }
    /**
     * Build prompt for generating a view from styled reference
     *
     * Key differences from regular mesh prompt:
     * - Input is already styled (no style transformation needed)
     * - Emphasizes EXACT consistency with reference (same style, proportions, colors)
     * - Only changes camera angle
     */
    buildFromReferencePrompt(sourceAngle, targetAngle, referenceColorPalette, hint) {
        const styleConfig = this.selectedStyle ? (0, styles_1.getStyleConfig)(this.selectedStyle) : null;
        const styleName = styleConfig?.name || 'styled';
        // Get view info for target angle
        const targetInfo = this.getAngleInfo(targetAngle);
        const sourceInfo = this.getAngleInfo(sourceAngle);
        // Build color reference block
        const colorBlock = referenceColorPalette.length > 0
            ? `\nREFERENCE COLORS (use EXACTLY these colors):\n${referenceColorPalette.join(', ')}\n`
            : '';
        // Build hint block if provided
        const hintBlock = hint
            ? `\n=== USER ADJUSTMENT ===\nThe user requests: "${hint}"\nApply this adjustment while maintaining style consistency and correct angle.\n=== END USER ADJUSTMENT ===\n`
            : '';
        return `You are generating the ${targetAngle.toUpperCase()} VIEW from a styled reference image.

=== CRITICAL: STYLE CONSISTENCY ===

The reference image shows a ${styleName} figure from the ${sourceAngle.toUpperCase()} view.
You must generate the ${targetAngle.toUpperCase()} view of the EXACT SAME figure.

DO NOT CHANGE:
- The overall style or proportions
- The color palette (use exactly the same colors)
- Any distinctive features or accessories
- The level of detail or simplification

ONLY CHANGE:
- The camera angle: rotate from ${sourceAngle} (${sourceInfo.degrees}°) to ${targetAngle} (${targetInfo.degrees}°)

=== END STYLE CONSISTENCY ===
${colorBlock}
=== CAMERA POSITION ===

**SOURCE VIEW**: ${sourceAngle.toUpperCase()} (${sourceInfo.degrees}° - this is the reference image)
**TARGET VIEW**: ${targetAngle.toUpperCase()} (${targetInfo.degrees}° - generate this view)
**ROTATION**: ${Math.abs(targetInfo.degrees - sourceInfo.degrees)}° rotation

${targetInfo.description}

${targetInfo.sideCheck || ''}

=== END CAMERA POSITION ===

=== REQUIREMENTS ===

1. EXACT same figure appearance as the reference - same style, same colors, same proportions
2. Pure white background (#FFFFFF) - no shadows, no ground plane
3. Orthographic projection from ${targetAngle} position
4. Subject centered, fills 90% of frame
5. Completely flat lighting - no cast shadows
${hintBlock}
=== END REQUIREMENTS ===

After generating the image, output the colors used:
COLORS: #RRGGBB, #RRGGBB, #RRGGBB, #RRGGBB, #RRGGBB, #RRGGBB, #RRGGBB

Generate the ${targetAngle.toUpperCase()} view now.`;
    }
    /**
     * Get angle information for prompt building
     */
    getAngleInfo(angle) {
        switch (angle) {
            case 'front':
                return {
                    degrees: 0,
                    description: 'Front view: Face and front body visible, camera at 6 o\'clock position.',
                };
            case 'back':
                return {
                    degrees: 180,
                    description: 'Back view: Back of head/body visible, NO face visible, camera at 12 o\'clock position.',
                };
            case 'left':
                return {
                    degrees: 90,
                    description: 'Left side view: Subject\'s LEFT side visible, camera at 3 o\'clock position.',
                    sideCheck: '⚠️ For characters: LEFT ear visible, nose points toward LEFT edge of image.',
                };
            case 'right':
                return {
                    degrees: 270,
                    description: 'Right side view: Subject\'s RIGHT side visible, camera at 9 o\'clock position.',
                    sideCheck: '⚠️ For characters: RIGHT ear visible, nose points toward RIGHT edge of image.',
                };
        }
    }
    /**
     * Generate a single view with the given prompt
     */
    async generateSingleView(referenceImageBase64, mimeType, prompt, extractColors, expectedColorCount) {
        const modelId = GEMINI_MODEL_IDS[this.geminiModel];
        // Build generation config for Flash model
        const generationConfig = {
            responseModalities: ['TEXT', 'IMAGE'],
        };
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
            generationConfig,
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
            model: modelId,
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
 * @param imageAnalysis - Optional full image analysis result with key features
 * @param geminiModel - Gemini model for image generation (default: 'gemini-2.5-flash')
 * @param selectedStyle - User-selected figure style (bobblehead, chibi, cartoon, emoji)
 */
function createMultiViewGenerator(modeId = mode_configs_1.DEFAULT_MODE, userDescription, imageAnalysis, geminiModel = DEFAULT_GEMINI_MODEL, selectedStyle) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
        throw new functions.https.HttpsError('failed-precondition', 'Gemini API key not configured');
    }
    return new MultiViewGenerator(apiKey, modeId, userDescription, imageAnalysis, geminiModel, selectedStyle);
}
//# sourceMappingURL=multi-view-generator.js.map