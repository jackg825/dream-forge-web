"use strict";
/**
 * Gemini Batch API Client
 *
 * Provides batch processing for multiple image generation requests.
 * Uses the Gemini Batch API for 50% cost savings over real-time API.
 *
 * Key features:
 * - Submit multiple generation requests in a single API call
 * - Poll for job completion
 * - Handle partial failures gracefully
 *
 * Reference: https://ai.google.dev/gemini-api/docs/batch-api
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
exports.GeminiBatchClient = void 0;
exports.createBatchClient = createBatchClient;
const axios_1 = __importDefault(require("axios"));
const functions = __importStar(require("firebase-functions/v1"));
const mode_configs_1 = require("./mode-configs");
const GEMINI_API_BASE = 'https://generativelanguage.googleapis.com/v1beta';
const MODEL = 'gemini-2.5-flash-image';
/**
 * Gemini Batch API Client
 */
class GeminiBatchClient {
    apiKey;
    constructor(apiKey) {
        this.apiKey = apiKey;
    }
    /**
     * Build batch requests for all 4 mesh views
     */
    buildBatchRequests(referenceImageBase64, mimeType, modeId, userDescription) {
        const modeConfig = (0, mode_configs_1.getMode)(modeId);
        const meshAngles = ['front', 'back', 'left', 'right'];
        const requests = [];
        // Add mesh view requests
        for (const angle of meshAngles) {
            requests.push({
                viewType: 'mesh',
                angle,
                prompt: (0, mode_configs_1.getMeshPrompt)(modeConfig, angle, userDescription),
            });
        }
        return requests;
    }
    /**
     * Submit a batch of generation requests
     *
     * Uses inline requests format (suitable for <20MB total request size)
     */
    async submitBatch(referenceImageBase64, mimeType, requests) {
        // Build the batch request payload using camelCase per API spec
        const inlineRequests = requests.map((req) => ({
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
                            text: req.prompt,
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
        }));
        try {
            functions.logger.info('Submitting batch job', {
                requestCount: requests.length,
                viewTypes: requests.map((r) => `${r.viewType}-${r.angle}`),
            });
            const response = await axios_1.default.post(`${GEMINI_API_BASE}/models/${MODEL}:batchGenerateContent`, {
                batch: {
                    model: `models/${MODEL}`,
                    display_name: `dreamforge-batch-${Date.now()}`,
                    input_config: {
                        requests: {
                            requests: inlineRequests.map((req, idx) => ({
                                request: req,
                                metadata: { key: `view-${idx}` },
                            })),
                        },
                    },
                },
            }, {
                headers: {
                    'Content-Type': 'application/json',
                },
                params: {
                    key: this.apiKey,
                },
                timeout: 60000, // 60 second timeout for submission
            });
            functions.logger.info('Batch job submitted', {
                name: response.data.name,
                state: response.data.metadata?.state,
            });
            return response.data;
        }
        catch (error) {
            const axiosError = error;
            functions.logger.error('Batch submit failed', {
                status: axiosError.response?.status,
                data: axiosError.response?.data,
                message: axiosError.message,
            });
            throw new functions.https.HttpsError('internal', `Failed to submit batch job: ${axiosError.message}`);
        }
    }
    /**
     * Check the status of a batch job
     */
    async checkStatus(operationName) {
        try {
            const response = await axios_1.default.get(`${GEMINI_API_BASE}/${operationName}`, {
                params: {
                    key: this.apiKey,
                },
                timeout: 30000,
            });
            functions.logger.info('Batch status checked', {
                name: operationName,
                state: response.data.metadata?.state,
                done: response.data.done,
            });
            return response.data;
        }
        catch (error) {
            const axiosError = error;
            functions.logger.error('Batch status check failed', {
                operationName,
                status: axiosError.response?.status,
                message: axiosError.message,
            });
            throw new functions.https.HttpsError('internal', `Failed to check batch status: ${axiosError.message}`);
        }
    }
    /**
     * Parse batch results into individual view results
     *
     * For inline requests, results are in dest.inlined_responses[]
     */
    parseResults(statusResponse, originalRequests) {
        const results = [];
        // Use correct path: dest.inlined_responses for inline requests
        const inlinedResponses = statusResponse.dest?.inlined_responses || [];
        functions.logger.info('Parsing batch results', {
            hasDest: !!statusResponse.dest,
            inlinedCount: inlinedResponses.length,
            requestCount: originalRequests.length,
        });
        for (let i = 0; i < originalRequests.length; i++) {
            const request = originalRequests[i];
            const inlineResponse = inlinedResponses[i];
            if (!inlineResponse) {
                results.push({
                    index: i,
                    viewType: request.viewType,
                    angle: request.angle,
                    success: false,
                    error: 'No response for this request',
                });
                continue;
            }
            // Check for error in this specific request
            if (inlineResponse.error) {
                results.push({
                    index: i,
                    viewType: request.viewType,
                    angle: request.angle,
                    success: false,
                    error: `${inlineResponse.error.code}: ${inlineResponse.error.message}`,
                });
                continue;
            }
            // Extract image data from response
            const candidate = inlineResponse.response?.candidates?.[0];
            const parts = candidate?.content?.parts || [];
            const imagePart = parts.find((p) => p.inlineData?.data);
            const textParts = parts.filter((p) => p.text).map((p) => p.text).join('\n');
            if (!imagePart) {
                results.push({
                    index: i,
                    viewType: request.viewType,
                    angle: request.angle,
                    success: false,
                    error: 'No image in response',
                });
                continue;
            }
            // Extract color palette from text if present
            let colorPalette;
            if (textParts) {
                const colorMatches = textParts.match(/#[0-9A-Fa-f]{6}/gi);
                if (colorMatches && colorMatches.length > 0) {
                    colorPalette = colorMatches.map((c) => c.toUpperCase());
                }
            }
            results.push({
                index: i,
                viewType: request.viewType,
                angle: request.angle,
                success: true,
                imageBase64: imagePart.inlineData.data,
                mimeType: imagePart.inlineData.mimeType,
                textContent: textParts || undefined,
                colorPalette,
            });
        }
        return results;
    }
    /**
     * Map batch job state to our internal status
     */
    static mapJobState(state) {
        switch (state) {
            case 'JOB_STATE_PENDING':
                return 'pending';
            case 'JOB_STATE_RUNNING':
                return 'running';
            case 'JOB_STATE_SUCCEEDED':
                return 'succeeded';
            case 'JOB_STATE_FAILED':
            case 'JOB_STATE_CANCELLED':
                return 'failed';
            default:
                return 'pending';
        }
    }
}
exports.GeminiBatchClient = GeminiBatchClient;
/**
 * Create a new batch client instance
 */
function createBatchClient(apiKey) {
    return new GeminiBatchClient(apiKey);
}
//# sourceMappingURL=batch-client.js.map