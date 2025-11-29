"use strict";
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
exports.RodinClient = void 0;
exports.createRodinClient = createRodinClient;
const axios_1 = __importDefault(require("axios"));
const functions = __importStar(require("firebase-functions"));
const form_data_1 = __importDefault(require("form-data"));
const types_1 = require("./types");
// Correct API base URL per official documentation
const RODIN_API_BASE = 'https://api.hyper3d.com/api/v2';
/**
 * Rodin Gen-2 API Client
 *
 * Handles communication with the Hyper3D Rodin API for 3D model generation.
 * Updated to match official API documentation:
 * - https://developer.hyper3d.ai/api-specification/rodin-generation-gen2
 */
class RodinClient {
    apiKey;
    constructor(apiKey) {
        this.apiKey = apiKey;
    }
    /**
     * Start a 3D model generation task
     *
     * API requires multipart/form-data with image as binary file upload.
     * See: https://developer.hyper3d.ai/api-specification/rodin-generation-gen2
     *
     * @param imageBuffer - Image data as Buffer (downloaded from Storage)
     * @param options - Generation options (quality, format, etc.)
     * @returns Task ID and subscription key for status polling
     */
    async generateModel(imageBuffer, options) {
        try {
            // Build multipart form data as required by Rodin API
            const form = new form_data_1.default();
            form.append('images', imageBuffer, {
                filename: 'input.png',
                contentType: 'image/png',
            });
            form.append('tier', options.tier);
            form.append('material', 'PBR');
            // 3D model generation:
            // - mesh_mode: 'Raw' produces triangle meshes (required by slicers)
            // - geometry_file_format: 'glb' for preview with PBR materials
            //   (STL can be converted client-side for 3D printing)
            form.append('mesh_mode', options.meshMode || 'Raw');
            form.append('geometry_file_format', options.format || 'glb');
            // Get face count from print quality or legacy quality mapping
            const faceCount = types_1.PRINT_QUALITY_FACE_COUNTS[options.quality]
                || types_1.QUALITY_FACE_COUNTS[options.quality]
                || 150000;
            form.append('quality_override', String(faceCount));
            if (options.prompt) {
                form.append('prompt', options.prompt);
            }
            const response = await axios_1.default.post(`${RODIN_API_BASE}/rodin`, form, {
                headers: {
                    ...form.getHeaders(),
                    Authorization: `Bearer ${this.apiKey}`,
                },
                timeout: 30000,
            });
            if (!response.data.uuid || !response.data.jobs?.subscription_key) {
                throw new Error('Invalid response from Rodin API');
            }
            functions.logger.info('Rodin generation started', {
                taskUuid: response.data.uuid,
                jobUuids: response.data.jobs.uuids,
                quality: options.quality,
                format: options.format,
            });
            // Return all UUIDs for flexible usage:
            // - taskUuid: Main task UUID (required for download API)
            // - jobUuids: Individual job UUIDs (for potential future use)
            return {
                taskUuid: response.data.uuid,
                jobUuids: response.data.jobs.uuids || [],
                subscriptionKey: response.data.jobs.subscription_key,
            };
        }
        catch (error) {
            this.handleError(error, 'generateModel');
            throw error;
        }
    }
    /**
     * Start a 3D model generation task with multiple images
     *
     * Uses Rodin's multi-view mode (condition_mode: 'concat') for better
     * 3D reconstruction from multiple angles.
     *
     * @param imageBuffers - Array of image data buffers (up to 5 images)
     * @param options - Generation options including printer type for material selection
     * @returns Task ID and subscription key for status polling
     */
    async generateModelMulti(imageBuffers, options) {
        try {
            const form = new form_data_1.default();
            // Append each image - Rodin accepts up to 5 images
            imageBuffers.forEach((buffer, index) => {
                form.append('images', buffer, {
                    filename: `input_${index}.png`,
                    contentType: 'image/png',
                });
            });
            form.append('tier', options.tier);
            // Determine material from printer type
            const material = options.printerType
                ? types_1.PRINTER_MATERIAL_MAP[options.printerType]
                : 'PBR';
            form.append('material', material);
            // Enable concat mode for multi-view processing
            if (imageBuffers.length > 1 || options.conditionMode === 'concat') {
                form.append('condition_mode', 'concat');
            }
            // 3D Printing optimizations
            form.append('mesh_mode', options.meshMode || 'Raw');
            form.append('geometry_file_format', options.format || 'stl');
            // Get face count from quality setting
            const faceCount = types_1.PRINT_QUALITY_FACE_COUNTS[options.quality]
                || types_1.QUALITY_FACE_COUNTS[options.quality]
                || 150000;
            form.append('quality_override', String(faceCount));
            if (options.prompt) {
                form.append('prompt', options.prompt);
            }
            functions.logger.info('Starting multi-image generation', {
                imageCount: imageBuffers.length,
                material,
                quality: options.quality,
                format: options.format,
                meshMode: options.meshMode,
                conditionMode: imageBuffers.length > 1 ? 'concat' : 'single',
                apiUrl: `${RODIN_API_BASE}/rodin`,
            });
            let response;
            try {
                response = await axios_1.default.post(`${RODIN_API_BASE}/rodin`, form, {
                    headers: {
                        ...form.getHeaders(),
                        Authorization: `Bearer ${this.apiKey}`,
                    },
                    timeout: 30000,
                });
            }
            catch (axiosErr) {
                // Log the actual axios error with response details
                if (axios_1.default.isAxiosError(axiosErr)) {
                    functions.logger.error('Axios error calling Rodin API', {
                        status: axiosErr.response?.status,
                        statusText: axiosErr.response?.statusText,
                        responseData: JSON.stringify(axiosErr.response?.data),
                        message: axiosErr.message,
                    });
                }
                throw axiosErr;
            }
            // Log full response for debugging
            functions.logger.info('Rodin API raw response', {
                status: response.status,
                data: JSON.stringify(response.data),
                hasUuid: !!response.data.uuid,
                hasJobs: !!response.data.jobs,
                hasSubscriptionKey: !!response.data.jobs?.subscription_key,
            });
            if (!response.data.uuid || !response.data.jobs?.subscription_key) {
                functions.logger.error('Invalid Rodin API response structure', {
                    responseData: JSON.stringify(response.data),
                });
                throw new Error('Invalid response from Rodin API');
            }
            functions.logger.info('Multi-image generation started', {
                taskUuid: response.data.uuid,
                jobUuids: response.data.jobs.uuids,
                imageCount: imageBuffers.length,
            });
            // Return all UUIDs for flexible usage:
            // - taskUuid: Main task UUID (required for download API)
            // - jobUuids: Individual job UUIDs (for potential future use)
            return {
                taskUuid: response.data.uuid,
                jobUuids: response.data.jobs.uuids || [],
                subscriptionKey: response.data.jobs.subscription_key,
            };
        }
        catch (error) {
            this.handleError(error, 'generateModelMulti');
            throw error;
        }
    }
    /**
     * Generate texture for an existing 3D model
     *
     * Uses the texture-only endpoint to add PBR textures to a model.
     * See: https://developer.hyper3d.ai/api-specification/generate-texture
     *
     * @param imageBuffer - Reference image for texture style
     * @param modelBuffer - Existing 3D model file (max 10MB)
     * @param options - Texture generation options
     * @returns Task UUID and subscription key for status polling
     */
    async generateTexture(imageBuffer, modelBuffer, options = {}) {
        try {
            const form = new form_data_1.default();
            // Reference image for texture style
            form.append('image', imageBuffer, {
                filename: 'reference.png',
                contentType: 'image/png',
            });
            // Model file to apply texture to
            form.append('model', modelBuffer, {
                filename: `model.${options.format || 'glb'}`,
                contentType: 'application/octet-stream',
            });
            // Optional parameters
            if (options.format) {
                form.append('geometry_file_format', options.format);
            }
            if (options.material) {
                form.append('material', options.material);
            }
            if (options.resolution) {
                form.append('resolution', options.resolution);
            }
            if (options.prompt) {
                form.append('prompt', options.prompt);
            }
            if (options.seed !== undefined) {
                form.append('seed', String(options.seed));
            }
            if (options.referenceScale !== undefined) {
                form.append('reference_scale', String(options.referenceScale));
            }
            functions.logger.info('Starting texture generation', {
                format: options.format || 'glb',
                material: options.material || 'PBR',
                resolution: options.resolution || 'Basic',
                modelSize: modelBuffer.length,
            });
            const response = await axios_1.default.post(`${RODIN_API_BASE}/rodin_texture_only`, form, {
                headers: {
                    ...form.getHeaders(),
                    Authorization: `Bearer ${this.apiKey}`,
                },
                timeout: 30000,
            });
            if (!response.data.uuid || !response.data.jobs?.subscription_key) {
                throw new Error('Invalid response from Rodin Texture API');
            }
            functions.logger.info('Texture generation started', {
                taskUuid: response.data.uuid,
                jobUuids: response.data.jobs.uuids,
            });
            return {
                taskUuid: response.data.uuid,
                jobUuids: response.data.jobs.uuids || [],
                subscriptionKey: response.data.jobs.subscription_key,
            };
        }
        catch (error) {
            this.handleError(error, 'generateTexture');
            throw error;
        }
    }
    /**
     * Check the status of a generation task
     *
     * See: https://developer.hyper3d.ai/api-specification/check-status
     *
     * @param subscriptionKey - The subscription key for this task
     * @returns Current status and job UUID
     */
    async checkStatus(subscriptionKey) {
        try {
            const response = await axios_1.default.post(`${RODIN_API_BASE}/status`, { subscription_key: subscriptionKey }, {
                headers: {
                    Authorization: `Bearer ${this.apiKey}`,
                    'Content-Type': 'application/json',
                },
                timeout: 30000,
            });
            // API returns jobs array, we need the first job's status
            const job = response.data.jobs?.[0];
            if (!job) {
                throw new Error('Invalid status response: no jobs found');
            }
            functions.logger.info('Rodin status check', {
                status: job.status,
                jobUuid: job.uuid,
            });
            return {
                status: job.status,
                jobUuid: job.uuid,
            };
        }
        catch (error) {
            this.handleError(error, 'checkStatus');
            throw error;
        }
    }
    /**
     * Get download URLs for a completed task
     *
     * See: https://developer.hyper3d.ai/api-specification/download-results
     *
     * Includes retry logic to handle timing delays between status=Done
     * and files being available for download.
     *
     * @param taskUuid - The task UUID (from generateModel response)
     * @param maxRetries - Number of retry attempts (default: 5)
     * @param retryDelayMs - Delay between retries in ms (default: 3000)
     * @param requiredFormat - Optional: wait for a file with this extension (e.g., 'glb')
     * @returns List of downloadable files with URLs and names
     */
    async getDownloadUrls(taskUuid, maxRetries = 5, retryDelayMs = 3000, requiredFormat) {
        functions.logger.info('Fetching download URLs', {
            taskUuid,
            maxRetries,
            retryDelayMs,
            requiredFormat: requiredFormat || 'any',
        });
        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                const response = await axios_1.default.post(`${RODIN_API_BASE}/download`, { task_uuid: taskUuid }, {
                    headers: {
                        Authorization: `Bearer ${this.apiKey}`,
                        'Content-Type': 'application/json',
                    },
                    timeout: 30000,
                });
                const responseData = response.data;
                functions.logger.info('Download API raw response', {
                    taskUuid,
                    attempt,
                    httpStatus: response.status,
                    hasError: !!responseData.error,
                    errorValue: responseData.error,
                    hasList: !!responseData.list,
                    listLength: responseData.list?.length ?? 0,
                    listContents: responseData.list?.map((f) => f.name) ?? [],
                });
                // If list is empty, retry (files may not be ready yet)
                if (!responseData.list || responseData.list.length === 0) {
                    if (attempt < maxRetries) {
                        functions.logger.warn('Download list empty, retrying...', {
                            taskUuid,
                            attempt,
                            maxRetries,
                            nextRetryIn: retryDelayMs,
                        });
                        await new Promise(resolve => setTimeout(resolve, retryDelayMs));
                        continue;
                    }
                    throw new Error(`No download URLs after ${maxRetries} attempts. API error: ${responseData.error || 'none'}`);
                }
                // If requiredFormat specified, check if it's in the list
                if (requiredFormat) {
                    const hasRequiredFile = responseData.list.some((f) => f.name.endsWith(`.${requiredFormat}`));
                    if (!hasRequiredFile) {
                        if (attempt < maxRetries) {
                            functions.logger.warn(`Required format .${requiredFormat} not in list yet, retrying...`, {
                                taskUuid,
                                attempt,
                                maxRetries,
                                currentFiles: responseData.list.map((f) => f.name),
                                nextRetryIn: retryDelayMs,
                            });
                            await new Promise(resolve => setTimeout(resolve, retryDelayMs));
                            continue;
                        }
                        throw new Error(`No .${requiredFormat} file after ${maxRetries} attempts. Available: ${responseData.list.map((f) => f.name).join(', ')}`);
                    }
                }
                functions.logger.info('Rodin download URLs retrieved', {
                    taskUuid,
                    attempt,
                    fileCount: response.data.list.length,
                    files: response.data.list.map((f) => f.name),
                });
                return response.data.list;
            }
            catch (error) {
                // Only retry on empty list or missing format, not on actual errors
                if (attempt >= maxRetries) {
                    this.handleError(error, 'getDownloadUrls');
                    throw error;
                }
                // If it's an axios error (network/API), don't retry
                if (axios_1.default.isAxiosError(error)) {
                    this.handleError(error, 'getDownloadUrls');
                    throw error;
                }
                // Otherwise, it's our "empty list" or "missing format" error - retry
                functions.logger.warn('Retrying after error...', {
                    taskUuid,
                    attempt,
                    error: error instanceof Error ? error.message : 'Unknown',
                });
                await new Promise(resolve => setTimeout(resolve, retryDelayMs));
            }
        }
        throw new Error(`Failed to get download URLs after ${maxRetries} attempts`);
    }
    /**
     * Download a completed model
     *
     * @param modelUrl - The URL of the completed model
     * @returns Model data as a Buffer
     */
    async downloadModel(modelUrl) {
        try {
            const response = await axios_1.default.get(modelUrl, {
                responseType: 'arraybuffer',
                timeout: 120000, // 2 minute timeout for large files
            });
            functions.logger.info('Model downloaded', {
                size: response.data.length,
            });
            return Buffer.from(response.data);
        }
        catch (error) {
            this.handleError(error, 'downloadModel');
            throw error;
        }
    }
    /**
     * Check remaining Rodin API credits
     *
     * See: https://developer.hyper3d.ai/api-specification/check_balance
     *
     * @returns Current credit balance
     */
    async checkBalance() {
        try {
            const response = await axios_1.default.get(`${RODIN_API_BASE}/check_balance`, {
                headers: {
                    Authorization: `Bearer ${this.apiKey}`,
                },
                timeout: 10000,
            });
            functions.logger.info('Rodin balance checked', {
                balance: response.data.balance,
            });
            return response.data.balance;
        }
        catch (error) {
            this.handleError(error, 'checkBalance');
            throw error;
        }
    }
    /**
     * Get supported output formats
     */
    static getSupportedFormats() {
        return ['glb', 'obj', 'fbx', 'stl', 'usdz'];
    }
    /**
     * Handle and log API errors
     */
    handleError(error, operation) {
        if (axios_1.default.isAxiosError(error)) {
            const axiosError = error;
            const status = axiosError.response?.status;
            const data = axiosError.response?.data;
            functions.logger.error(`Rodin API error in ${operation}`, {
                status,
                data,
                message: axiosError.message,
            });
            if (status === 401) {
                throw new functions.https.HttpsError('unauthenticated', 'Invalid Rodin API key');
            }
            if (status === 429) {
                throw new functions.https.HttpsError('resource-exhausted', 'Rodin API rate limit exceeded. Please try again later.');
            }
            if (status === 400) {
                throw new functions.https.HttpsError('invalid-argument', 'Invalid request to Rodin API');
            }
            throw new functions.https.HttpsError('internal', `Rodin API error: ${axiosError.message}`);
        }
        // Log the full error for debugging
        const errorMessage = error instanceof Error ? error.message : String(error);
        const errorStack = error instanceof Error ? error.stack : undefined;
        functions.logger.error(`Unknown error in ${operation}`, {
            error: errorMessage,
            stack: errorStack,
            type: typeof error,
        });
        throw new functions.https.HttpsError('internal', `Unexpected error in ${operation}: ${errorMessage}`);
    }
}
exports.RodinClient = RodinClient;
/**
 * Create a RodinClient instance with the API key from environment
 */
function createRodinClient() {
    const apiKey = process.env.RODIN_API_KEY;
    if (!apiKey) {
        throw new functions.https.HttpsError('failed-precondition', 'Rodin API key not configured');
    }
    return new RodinClient(apiKey);
}
//# sourceMappingURL=client.js.map