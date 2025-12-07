"use strict";
/**
 * Tripo3D Provider
 *
 * Implements I3DProvider interface for Tripo3D v3.0 API.
 * Features: Native multi-view support, fast generation, texture + PBR.
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
exports.TripoProvider = void 0;
const axios_1 = __importDefault(require("axios"));
const functions = __importStar(require("firebase-functions"));
const form_data_1 = __importDefault(require("form-data"));
const types_1 = require("./types");
const mapper_1 = require("./mapper");
class TripoProvider {
    providerType = 'tripo';
    apiKey;
    constructor(apiKey) {
        this.apiKey = apiKey;
    }
    /**
     * Upload image to Tripo and get file_token
     */
    async uploadImage(imageBuffer) {
        const formData = new form_data_1.default();
        formData.append('file', imageBuffer, {
            filename: 'image.png',
            contentType: 'image/png',
        });
        const response = await axios_1.default.post(`${types_1.TRIPO_API_BASE}/upload`, formData, {
            headers: {
                Authorization: `Bearer ${this.apiKey}`,
                ...formData.getHeaders(),
            },
            timeout: 60000, // 1 minute for upload
        });
        if (response.data.code !== 0) {
            throw new Error(`Tripo upload error: code ${response.data.code}`);
        }
        return response.data.data.image_token;
    }
    /**
     * Generate 3D model from single image
     */
    async generateFromImage(imageBuffer, options) {
        try {
            functions.logger.info('Starting Tripo single-image generation', {
                quality: options.quality,
                format: options.format,
            });
            // Upload image first
            const fileToken = await this.uploadImage(imageBuffer);
            // Texture configuration for 3D printing
            const request = {
                type: 'image_to_model',
                file: {
                    type: 'png',
                    file_token: fileToken,
                },
                texture: true,
                pbr: true,
                texture_quality: 'detailed',
                texture_alignment: 'original_image',
                geometry_quality: 'standard',
            };
            const response = await this.createTask(request);
            functions.logger.info('Tripo generation started', {
                taskId: response.data.task_id,
            });
            return { taskId: response.data.task_id };
        }
        catch (error) {
            this.handleError(error, 'generateFromImage');
        }
    }
    /**
     * Generate 3D model from multiple images
     *
     * Uses multiview_to_model when 2+ images are provided.
     * Pipeline order: [front, back, left, right]
     * Tripo order: [front, left, back, right]
     */
    async generateFromMultipleImages(imageBuffers, options) {
        try {
            functions.logger.info('Starting Tripo multi-image generation', {
                imageCount: imageBuffers.length,
                quality: options.quality,
                format: options.format,
            });
            // Use multiview if we have enough images
            if (imageBuffers.length >= 2) {
                // Upload all images in parallel
                const uploadPromises = [];
                // Pipeline order: [front, back, left, right]
                // We need to map to Tripo order: [front, left, back, right]
                for (let i = 0; i < 4; i++) {
                    const pipelineIndex = i === 1 ? 2 : i === 2 ? 1 : i; // Swap left(2) and back(1)
                    if (imageBuffers[pipelineIndex]) {
                        uploadPromises.push(this.uploadImage(imageBuffers[pipelineIndex]));
                    }
                    else {
                        uploadPromises.push(Promise.resolve(null));
                    }
                }
                const fileTokens = await Promise.all(uploadPromises);
                // Build files array in Tripo order: [front, left, back, right]
                const files = [
                    fileTokens[0] ? { type: 'png', file_token: fileTokens[0] } : {}, // front
                    fileTokens[1] ? { type: 'png', file_token: fileTokens[1] } : {}, // left (from pipeline[2])
                    fileTokens[2] ? { type: 'png', file_token: fileTokens[2] } : {}, // back (from pipeline[1])
                    fileTokens[3] ? { type: 'png', file_token: fileTokens[3] } : {}, // right
                ];
                // Texture configuration for 3D printing
                const request = {
                    type: 'multiview_to_model',
                    files,
                    texture: true,
                    pbr: true,
                    texture_quality: 'detailed',
                    texture_alignment: 'original_image',
                    geometry_quality: 'standard',
                    model_version: 'v3.0-20250812',
                    auto_size: true,
                    quad: false,
                    face_limit: 100000,
                    smart_low_poly: false,
                };
                const response = await this.createTask(request);
                functions.logger.info('Tripo multiview generation started', {
                    taskId: response.data.task_id,
                    imageCount: imageBuffers.length,
                    uploadedCount: fileTokens.filter(t => t !== null).length,
                });
                return { taskId: response.data.task_id };
            }
            // Fall back to single image
            return this.generateFromImage(imageBuffers[0], options);
        }
        catch (error) {
            this.handleError(error, 'generateFromMultipleImages');
        }
    }
    /**
     * Generate 3D model from image URLs (no upload needed)
     *
     * Passes R2/storage URLs directly to Tripo API, avoiding timeout issues
     * from downloading and re-uploading images.
     *
     * Pipeline order: [front, back, left, right]
     * Tripo order: [front, left, back, right]
     */
    async generateFromUrls(imageUrls, options) {
        try {
            functions.logger.info('Starting Tripo URL-based generation', {
                imageCount: imageUrls.length,
                quality: options.quality,
                format: options.format,
            });
            // Build files array in Tripo order: [front, left, back, right]
            // Pipeline order is [front, back, left, right], so we swap indices 1 and 2
            const files = [
                imageUrls[0] ? { type: 'png', url: imageUrls[0] } : {}, // front
                imageUrls[2] ? { type: 'png', url: imageUrls[2] } : {}, // left (from pipeline[2])
                imageUrls[1] ? { type: 'png', url: imageUrls[1] } : {}, // back (from pipeline[1])
                imageUrls[3] ? { type: 'png', url: imageUrls[3] } : {}, // right
            ];
            // Texture configuration for 3D printing
            const request = {
                type: 'multiview_to_model',
                files,
                texture: true,
                pbr: true,
                texture_quality: 'detailed',
                texture_alignment: 'original_image',
                geometry_quality: 'standard',
                model_version: 'v3.0-20250812',
                auto_size: true,
                quad: false,
                face_limit: 100000,
                smart_low_poly: false,
            };
            const response = await this.createTask(request);
            functions.logger.info('Tripo URL-based generation started', {
                taskId: response.data.task_id,
                imageCount: imageUrls.length,
            });
            return { taskId: response.data.task_id };
        }
        catch (error) {
            this.handleError(error, 'generateFromUrls');
        }
    }
    /**
     * Check status of a generation task
     */
    async checkStatus(taskId) {
        try {
            const response = await this.getTaskStatus(taskId);
            const result = (0, mapper_1.mapTripoTaskStatus)(response);
            functions.logger.info('Tripo status check', {
                taskId,
                status: result.status,
                progress: result.progress,
            });
            return result;
        }
        catch (error) {
            this.handleError(error, 'checkStatus');
        }
    }
    /**
     * Get download URLs for completed task
     */
    async getDownloadUrls(taskId, requiredFormat) {
        try {
            const response = await this.getTaskStatus(taskId);
            if (response.data.status !== 'success') {
                throw new Error(`Task not completed: ${response.data.status}`);
            }
            const result = (0, mapper_1.extractTripoDownloads)(response);
            // Check for required format
            if (requiredFormat) {
                const hasFormat = result.files.some((f) => f.format === requiredFormat);
                if (!hasFormat) {
                    functions.logger.warn('Required format not available', {
                        taskId,
                        requiredFormat,
                        availableFormats: result.files.map((f) => f.format),
                    });
                }
            }
            functions.logger.info('Tripo download URLs retrieved', {
                taskId,
                fileCount: result.files.length,
                files: result.files.map((f) => f.format),
                rawOutput: JSON.stringify(response.data.output), // Debug: capture actual response structure
            });
            return result;
        }
        catch (error) {
            this.handleError(error, 'getDownloadUrls');
        }
    }
    /**
     * Download model file from URL
     */
    async downloadModel(url) {
        try {
            const response = await axios_1.default.get(url, {
                responseType: 'arraybuffer',
                timeout: 120000, // 2 minute timeout for large files
            });
            functions.logger.info('Tripo model downloaded', {
                size: response.data.length,
            });
            return Buffer.from(response.data);
        }
        catch (error) {
            this.handleError(error, 'downloadModel');
        }
    }
    /**
     * Get supported output formats
     */
    getSupportedFormats() {
        return ['glb', 'obj'];
    }
    /**
     * Get provider capabilities for UI introspection
     */
    getCapabilities() {
        return {
            supportsMultiView: true,
            supportsPBR: true,
            supportedFormats: ['glb', 'obj'],
            estimatedTime: {
                draft: '~1 min',
                standard: '~2 min',
                fine: '~3 min',
            },
        };
    }
    /**
     * Check API credit balance
     * Returns the current available balance (conforms to I3DProvider interface)
     */
    async checkBalance() {
        try {
            const response = await axios_1.default.get(`${types_1.TRIPO_API_BASE}/user/balance`, {
                headers: {
                    Authorization: `Bearer ${this.apiKey}`,
                },
                timeout: 10000,
            });
            if (response.data.code !== 0) {
                throw new Error(`Tripo API error: code ${response.data.code}`);
            }
            functions.logger.info('Tripo balance checked', {
                balance: response.data.data.balance,
                frozen: response.data.data.frozen,
            });
            return response.data.data.balance;
        }
        catch (error) {
            this.handleError(error, 'checkBalance');
        }
    }
    /**
     * Check API credit balance with frozen amount
     * Returns both balance and frozen for admin dashboard
     */
    async checkBalanceWithFrozen() {
        try {
            const response = await axios_1.default.get(`${types_1.TRIPO_API_BASE}/user/balance`, {
                headers: {
                    Authorization: `Bearer ${this.apiKey}`,
                },
                timeout: 10000,
            });
            if (response.data.code !== 0) {
                throw new Error(`Tripo API error: code ${response.data.code}`);
            }
            return {
                balance: response.data.data.balance,
                frozen: response.data.data.frozen,
            };
        }
        catch (error) {
            this.handleError(error, 'checkBalance');
        }
    }
    /**
     * Create a new task
     */
    async createTask(request) {
        const response = await axios_1.default.post(`${types_1.TRIPO_API_BASE}/task`, request, {
            headers: {
                Authorization: `Bearer ${this.apiKey}`,
                'Content-Type': 'application/json',
            },
            timeout: 120000, // 2 minute timeout for task creation
        });
        if (response.data.code !== 0) {
            throw new Error(`Tripo API error: code ${response.data.code}`);
        }
        return response.data;
    }
    /**
     * Get task status
     */
    async getTaskStatus(taskId) {
        const response = await axios_1.default.get(`${types_1.TRIPO_API_BASE}/task/${taskId}`, {
            headers: {
                Authorization: `Bearer ${this.apiKey}`,
            },
            timeout: 30000,
        });
        if (response.data.code !== 0) {
            throw new Error(`Tripo API error: code ${response.data.code}`);
        }
        return response.data;
    }
    /**
     * Handle and log API errors
     */
    handleError(error, operation) {
        if (axios_1.default.isAxiosError(error)) {
            const axiosError = error;
            const status = axiosError.response?.status;
            const data = axiosError.response?.data;
            functions.logger.error(`Tripo API error in ${operation}`, {
                status,
                data: JSON.stringify(data),
                message: axiosError.message,
            });
            if (status === 401) {
                throw new functions.https.HttpsError('unauthenticated', 'Invalid Tripo API key');
            }
            if (status === 429) {
                throw new functions.https.HttpsError('resource-exhausted', 'Tripo API rate limit exceeded. Please try again later.');
            }
            if (status === 400) {
                throw new functions.https.HttpsError('invalid-argument', `Invalid request to Tripo API: ${JSON.stringify(data)}`);
            }
            throw new functions.https.HttpsError('internal', `Tripo API error: ${axiosError.message}`);
        }
        const errorMessage = error instanceof Error ? error.message : String(error);
        const errorStack = error instanceof Error ? error.stack : undefined;
        functions.logger.error(`Unknown error in ${operation}`, {
            error: errorMessage,
            stack: errorStack,
        });
        throw new functions.https.HttpsError('internal', `Unexpected error in ${operation}: ${errorMessage}`);
    }
}
exports.TripoProvider = TripoProvider;
//# sourceMappingURL=client.js.map