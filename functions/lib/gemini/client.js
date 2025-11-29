"use strict";
/**
 * Gemini API Client
 * Generates multi-view images from a reference image using Gemini 2.5 Flash Image
 *
 * API Documentation: https://ai.google.dev/gemini-api/docs/image-generation
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
exports.GeminiClient = void 0;
exports.createGeminiClient = createGeminiClient;
const axios_1 = __importDefault(require("axios"));
const functions = __importStar(require("firebase-functions"));
const GEMINI_API_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';
const MODEL = 'gemini-3-pro-image-preview';
// Minimum delay between sequential API calls to avoid rate limiting
const MIN_DELAY_BETWEEN_CALLS_MS = 500;
// Prompts for generating different view angles
// These prompts instruct Gemini to generate consistent views of the same object
const VIEW_PROMPTS = {
    front: 'Generate a front view of this exact object. Show the object from directly in front, centered, maintaining the same style, colors, and details. Use a clean, plain background.',
    back: 'Generate a back view of this exact object. Rotate the object 180 degrees to show the rear side. Maintain consistent lighting, style, colors, and all details. Use a clean, plain background.',
    left: 'Generate a left side view of this exact object. Rotate the object 90 degrees counterclockwise to show the left profile. Maintain consistent lighting, style, colors, and all details. Use a clean, plain background.',
    right: 'Generate a right side view of this exact object. Rotate the object 90 degrees clockwise to show the right profile. Maintain consistent lighting, style, colors, and all details. Use a clean, plain background.',
    top: 'Generate a top-down view of this exact object. Show the object from directly above, maintaining the same proportions and all details. Use a clean, plain background.',
};
/**
 * Extract text content from Gemini response parts
 * Used for debugging when image generation fails
 */
function extractTextFromParts(parts) {
    return parts
        .filter((p) => p.text)
        .map((p) => p.text)
        .join('\n');
}
/**
 * Analyze Gemini response for detailed error information
 * Returns structured analysis of what the API returned
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
    // Check for API-level errors
    if (response.error) {
        result.errorMessage = `API Error ${response.error.code}: ${response.error.message}`;
        return result;
    }
    // Check for prompt blocking
    if (response.promptFeedback?.blockReason) {
        result.blockReason = response.promptFeedback.blockReason;
        if (response.promptFeedback.safetyRatings) {
            result.safetyIssues = response.promptFeedback.safetyRatings
                .filter((r) => r.probability !== 'NEGLIGIBLE')
                .map((r) => `${r.category}: ${r.probability}`);
        }
        return result;
    }
    // Analyze candidates
    const candidate = response.candidates?.[0];
    if (!candidate) {
        result.errorMessage = 'No candidates in response';
        return result;
    }
    result.finishReason = candidate.finishReason || null;
    // Check safety ratings on candidate
    if (candidate.safetyRatings) {
        result.safetyIssues = candidate.safetyRatings
            .filter((r) => r.probability !== 'NEGLIGIBLE' && r.probability !== 'LOW')
            .map((r) => `${r.category}: ${r.probability}`);
    }
    // Extract content
    const parts = candidate.content?.parts || [];
    // Check for image
    const imagePart = parts.find((p) => p.inline_data?.data);
    result.hasImage = !!imagePart;
    // Extract text (may explain why image wasn't generated)
    const textContent = extractTextFromParts(parts);
    if (textContent) {
        result.textContent = textContent;
    }
    return result;
}
class GeminiClient {
    apiKey;
    constructor(apiKey) {
        this.apiKey = apiKey;
    }
    /**
     * Generate additional views from a reference image
     *
     * @param referenceImageBase64 - Base64 encoded reference image
     * @param mimeType - MIME type of the image (e.g., 'image/png')
     * @param angles - Array of view angles to generate
     * @returns Array of generated views with base64 image data
     */
    async generateViews(referenceImageBase64, mimeType, angles) {
        const results = [];
        functions.logger.info('Starting multi-view generation', {
            angleCount: angles.length,
            angles,
            model: MODEL,
            delayBetweenCalls: MIN_DELAY_BETWEEN_CALLS_MS,
        });
        for (let i = 0; i < angles.length; i++) {
            const angle = angles[i];
            try {
                // Add delay between calls to avoid rate limiting (except for first call)
                if (i > 0) {
                    await new Promise((resolve) => setTimeout(resolve, MIN_DELAY_BETWEEN_CALLS_MS));
                }
                const generated = await this.generateSingleView(referenceImageBase64, mimeType, angle);
                results.push(generated);
                functions.logger.info(`Generated ${angle} view`, {
                    angle,
                    mimeType: generated.mimeType,
                    progress: `${i + 1}/${angles.length}`,
                });
            }
            catch (error) {
                const errorMessage = error instanceof Error ? error.message : 'Unknown error';
                functions.logger.error(`Failed to generate ${angle} view`, {
                    error: errorMessage,
                    angle,
                    completedViews: results.map((r) => r.angle),
                    remainingViews: angles.slice(i + 1),
                });
                throw new functions.https.HttpsError('internal', `Failed to generate ${angle} view: ${errorMessage}`);
            }
        }
        functions.logger.info('Multi-view generation complete', {
            generatedCount: results.length,
            angles: results.map((r) => r.angle),
        });
        return results;
    }
    /**
     * Generate a single view of the object
     */
    async generateSingleView(referenceImageBase64, mimeType, angle) {
        const prompt = VIEW_PROMPTS[angle];
        functions.logger.info(`Generating ${angle} view with Gemini`, {
            angle,
            model: MODEL,
            promptLength: prompt.length,
        });
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
                responseModalities: ['IMAGE', 'TEXT'],
            },
        }, {
            headers: {
                'Content-Type': 'application/json',
            },
            params: {
                key: this.apiKey,
            },
            timeout: 60000, // 60 second timeout per image
        });
        // Analyze the response comprehensively
        const analysis = analyzeGeminiResponse(response.data);
        // Log detailed analysis for debugging
        functions.logger.info('Gemini response analysis', {
            angle,
            hasImage: analysis.hasImage,
            hasText: !!analysis.textContent,
            textPreview: analysis.textContent?.substring(0, 200),
            blockReason: analysis.blockReason,
            finishReason: analysis.finishReason,
            safetyIssues: analysis.safetyIssues,
            errorMessage: analysis.errorMessage,
        });
        // Handle various failure cases with detailed error messages
        if (analysis.errorMessage) {
            throw new Error(`Gemini API error for ${angle} view: ${analysis.errorMessage}`);
        }
        if (analysis.blockReason) {
            throw new Error(`Content blocked by Gemini for ${angle} view: ${analysis.blockReason}. ` +
                `Safety issues: ${analysis.safetyIssues.join(', ') || 'none reported'}`);
        }
        if (analysis.safetyIssues.length > 0 && !analysis.hasImage) {
            throw new Error(`Image generation blocked for ${angle} view due to safety concerns: ${analysis.safetyIssues.join(', ')}`);
        }
        if (!analysis.hasImage) {
            // Include text response in error for debugging
            const textInfo = analysis.textContent
                ? ` Gemini responded with text: "${analysis.textContent.substring(0, 500)}"`
                : ' No text explanation provided.';
            throw new Error(`No image data in Gemini response for ${angle} view.` +
                ` Finish reason: ${analysis.finishReason || 'unknown'}.` +
                textInfo);
        }
        // Extract the image data (we know it exists from analysis)
        const candidates = response.data.candidates;
        const parts = candidates[0].content?.parts || [];
        const imagePart = parts.find((p) => p.inline_data?.data);
        // Validate MIME type
        const responseMimeType = imagePart.inline_data.mime_type;
        const validMimeTypes = ['image/png', 'image/jpeg', 'image/webp'];
        if (responseMimeType && !validMimeTypes.includes(responseMimeType)) {
            functions.logger.warn('Unexpected MIME type from Gemini', {
                angle,
                receivedMimeType: responseMimeType,
                defaultingTo: 'image/png',
            });
        }
        return {
            angle,
            imageBase64: imagePart.inline_data.data,
            mimeType: responseMimeType && validMimeTypes.includes(responseMimeType)
                ? responseMimeType
                : 'image/png',
        };
    }
}
exports.GeminiClient = GeminiClient;
/**
 * Create a GeminiClient instance with the API key from environment
 */
function createGeminiClient() {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
        throw new functions.https.HttpsError('failed-precondition', 'Gemini API key not configured');
    }
    return new GeminiClient(apiKey);
}
//# sourceMappingURL=client.js.map