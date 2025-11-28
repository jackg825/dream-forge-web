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
const MODEL = 'gemini-2.0-flash-exp';
// Prompts for generating different view angles
// These prompts instruct Gemini to generate consistent views of the same object
const VIEW_PROMPTS = {
    front: 'Generate a front view of this exact object. Show the object from directly in front, centered, maintaining the same style, colors, and details. Use a clean, plain background.',
    back: 'Generate a back view of this exact object. Rotate the object 180 degrees to show the rear side. Maintain consistent lighting, style, colors, and all details. Use a clean, plain background.',
    left: 'Generate a left side view of this exact object. Rotate the object 90 degrees counterclockwise to show the left profile. Maintain consistent lighting, style, colors, and all details. Use a clean, plain background.',
    right: 'Generate a right side view of this exact object. Rotate the object 90 degrees clockwise to show the right profile. Maintain consistent lighting, style, colors, and all details. Use a clean, plain background.',
    top: 'Generate a top-down view of this exact object. Show the object from directly above, maintaining the same proportions and all details. Use a clean, plain background.',
};
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
        });
        for (const angle of angles) {
            try {
                const generated = await this.generateSingleView(referenceImageBase64, mimeType, angle);
                results.push(generated);
                functions.logger.info(`Generated ${angle} view`, {
                    angle,
                    mimeType: generated.mimeType,
                });
            }
            catch (error) {
                const errorMessage = error instanceof Error ? error.message : 'Unknown error';
                functions.logger.error(`Failed to generate ${angle} view`, {
                    error: errorMessage,
                    angle,
                });
                throw new functions.https.HttpsError('internal', `Failed to generate ${angle} view: ${errorMessage}`);
            }
        }
        functions.logger.info('Multi-view generation complete', {
            generatedCount: results.length,
        });
        return results;
    }
    /**
     * Generate a single view of the object
     */
    async generateSingleView(referenceImageBase64, mimeType, angle) {
        const prompt = VIEW_PROMPTS[angle];
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
        // Extract generated image from response
        const candidates = response.data.candidates;
        if (!candidates || candidates.length === 0) {
            throw new Error('No candidates in Gemini response');
        }
        const parts = candidates[0].content?.parts || [];
        const imagePart = parts.find((p) => p.inline_data?.data);
        if (!imagePart || !imagePart.inline_data) {
            throw new Error('No image data in Gemini response');
        }
        return {
            angle,
            imageBase64: imagePart.inline_data.data,
            mimeType: imagePart.inline_data.mime_type || 'image/png',
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