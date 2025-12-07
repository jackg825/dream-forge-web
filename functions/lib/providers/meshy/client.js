"use strict";
/**
 * Meshy AI Provider
 *
 * Implements I3DProvider interface for Meshy AI API.
 * Uses meshy-6 (latest) by default for highest quality.
 *
 * API Docs: https://docs.meshy.ai/en/api/image-to-3d
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
exports.MeshyProvider = void 0;
const axios_1 = __importDefault(require("axios"));
const functions = __importStar(require("firebase-functions"));
const types_1 = require("./types");
const mapper_1 = require("./mapper");
class MeshyProvider {
    providerType = 'meshy';
    apiKey;
    constructor(apiKey) {
        this.apiKey = apiKey;
    }
    /**
     * Generate 3D model from single image
     */
    async generateFromImage(imageBuffer, options) {
        try {
            // Convert buffer to base64 data URI
            const base64 = imageBuffer.toString('base64');
            const dataUri = `data:image/png;base64,${base64}`;
            const polycount = types_1.MESHY_QUALITY_POLYCOUNT[options.quality] || 100000;
            functions.logger.info('Starting Meshy single-image generation', {
                quality: options.quality,
                polycount,
                format: options.format,
                enableTexture: options.enableTexture,
                enablePBR: options.enablePBR,
            });
            const response = await axios_1.default.post(`${types_1.MESHY_API_BASE}/image-to-3d`, {
                image_url: dataUri,
                ai_model: 'latest', // meshy-6
                topology: 'triangle',
                target_polycount: polycount,
                should_remesh: true,
                should_texture: options.enableTexture ?? true,
                enable_pbr: options.enablePBR ?? false,
                texture_prompt: options.prompt,
            }, {
                headers: {
                    Authorization: `Bearer ${this.apiKey}`,
                    'Content-Type': 'application/json',
                },
                timeout: 60000, // 60s for base64 upload
            });
            const taskId = response.data.result;
            functions.logger.info('Meshy generation started', {
                taskId,
                quality: options.quality,
                format: options.format,
            });
            return { taskId };
        }
        catch (error) {
            this.handleError(error, 'generateFromImage');
        }
    }
    /**
     * Generate 3D model from multiple images
     *
     * Meshy supports 1-4 images for multi-image mode.
     * Uses meshy-5 for mesh generation (required for multi-image).
     */
    async generateFromMultipleImages(imageBuffers, options) {
        try {
            // Meshy supports max 4 images
            const limitedBuffers = imageBuffers.slice(0, 4);
            // Convert buffers to base64 data URIs
            const imageUrls = limitedBuffers.map((buffer) => {
                const base64 = buffer.toString('base64');
                return `data:image/png;base64,${base64}`;
            });
            const polycount = types_1.MESHY_QUALITY_POLYCOUNT[options.quality] || 100000;
            functions.logger.info('Starting Meshy multi-image generation', {
                imageCount: imageUrls.length,
                quality: options.quality,
                polycount,
                format: options.format,
            });
            // For multi-image, use the appropriate endpoint
            const endpoint = imageUrls.length > 1
                ? `${types_1.MESHY_API_BASE}/multi-image-to-3d`
                : `${types_1.MESHY_API_BASE}/image-to-3d`;
            const requestBody = imageUrls.length > 1
                ? {
                    image_urls: imageUrls,
                    ai_model: 'meshy-5', // Multi-image requires meshy-5 for mesh
                    topology: 'triangle',
                    target_polycount: polycount,
                    should_remesh: true,
                    should_texture: options.enableTexture ?? true,
                    enable_pbr: options.enablePBR ?? false,
                }
                : {
                    image_url: imageUrls[0],
                    ai_model: 'latest',
                    topology: 'triangle',
                    target_polycount: polycount,
                    should_remesh: true,
                    should_texture: options.enableTexture ?? true,
                    enable_pbr: options.enablePBR ?? false,
                    texture_prompt: options.prompt,
                };
            const response = await axios_1.default.post(endpoint, requestBody, {
                headers: {
                    Authorization: `Bearer ${this.apiKey}`,
                    'Content-Type': 'application/json',
                },
                timeout: 60000,
            });
            const taskId = response.data.result;
            functions.logger.info('Meshy multi-image generation started', {
                taskId,
                imageCount: imageUrls.length,
            });
            return { taskId };
        }
        catch (error) {
            this.handleError(error, 'generateFromMultipleImages');
        }
    }
    /**
     * Generate 3D mesh only (no texture) from multiple images
     *
     * Used for the new pipeline workflow where texture is generated separately.
     * This costs 5 credits (mesh-only) vs 15 credits (with texture).
     *
     * Supports mesh precision option for 3D printing optimization:
     * - 'high' precision: should_remesh=false (preserves original mesh topology)
     * - 'standard' precision: should_remesh=true (optimizes polycount)
     *
     * @param imageBuffers - Array of image buffers (max 4)
     * @param options - Generation options (quality, format, precision)
     * @returns Task ID for polling
     */
    async generateMeshOnly(imageBuffers, options) {
        try {
            // Meshy supports max 4 images
            const limitedBuffers = imageBuffers.slice(0, 4);
            // Convert buffers to base64 data URIs
            const imageUrls = limitedBuffers.map((buffer) => {
                const base64 = buffer.toString('base64');
                return `data:image/png;base64,${base64}`;
            });
            // Determine remesh settings based on precision
            // 'high' = preserve original mesh (no remesh), 'standard' = optimize polycount
            const shouldRemesh = options.precision !== 'high';
            const polycount = shouldRemesh
                ? (types_1.MESHY_QUALITY_POLYCOUNT[options.quality] || 100000)
                : undefined;
            functions.logger.info('Starting Meshy mesh-only generation', {
                imageCount: imageUrls.length,
                quality: options.quality,
                precision: options.precision || 'standard',
                shouldRemesh,
                polycount,
                format: options.format,
                shouldTexture: false, // Key difference: no texture
            });
            // For multi-image, use the appropriate endpoint
            const endpoint = imageUrls.length > 1
                ? `${types_1.MESHY_API_BASE}/multi-image-to-3d`
                : `${types_1.MESHY_API_BASE}/image-to-3d`;
            const requestBody = imageUrls.length > 1
                ? {
                    image_urls: imageUrls,
                    ai_model: 'meshy-5',
                    topology: 'triangle',
                    ...(polycount && { target_polycount: polycount }),
                    should_remesh: shouldRemesh,
                    should_texture: false, // KEY: No texture generation
                    enable_pbr: false,
                }
                : {
                    image_url: imageUrls[0],
                    ai_model: 'latest',
                    topology: 'triangle',
                    ...(polycount && { target_polycount: polycount }),
                    should_remesh: shouldRemesh,
                    should_texture: false, // KEY: No texture generation
                    enable_pbr: false,
                };
            const response = await axios_1.default.post(endpoint, requestBody, {
                headers: {
                    Authorization: `Bearer ${this.apiKey}`,
                    'Content-Type': 'application/json',
                },
                timeout: 60000,
            });
            const taskId = response.data.result;
            functions.logger.info('Meshy mesh-only generation started', {
                taskId,
                imageCount: imageUrls.length,
            });
            return { taskId };
        }
        catch (error) {
            this.handleError(error, 'generateMeshOnly');
        }
    }
    /**
     * Generate 3D mesh only from image URLs (no upload needed)
     *
     * Passes R2/storage URLs directly to Meshy API, avoiding timeout issues
     * from downloading and re-uploading images.
     *
     * @param imageUrls - Array of image URLs (max 4)
     * @param options - Generation options (quality, format, precision)
     * @returns Task ID for polling
     */
    async generateMeshOnlyFromUrls(imageUrls, options) {
        try {
            // Meshy supports max 4 images
            const limitedUrls = imageUrls.slice(0, 4);
            // Determine remesh settings based on precision
            const shouldRemesh = options.precision !== 'high';
            const polycount = shouldRemesh
                ? (types_1.MESHY_QUALITY_POLYCOUNT[options.quality] || 100000)
                : undefined;
            functions.logger.info('Starting Meshy URL-based mesh-only generation', {
                imageCount: limitedUrls.length,
                quality: options.quality,
                precision: options.precision || 'standard',
                shouldRemesh,
                polycount,
                format: options.format,
            });
            // For multi-image, use the appropriate endpoint
            const endpoint = limitedUrls.length > 1
                ? `${types_1.MESHY_API_BASE}/multi-image-to-3d`
                : `${types_1.MESHY_API_BASE}/image-to-3d`;
            const requestBody = limitedUrls.length > 1
                ? {
                    image_urls: limitedUrls,
                    ai_model: 'meshy-5',
                    topology: 'triangle',
                    ...(polycount && { target_polycount: polycount }),
                    should_remesh: shouldRemesh,
                    should_texture: false,
                    enable_pbr: false,
                }
                : {
                    image_url: limitedUrls[0],
                    ai_model: 'latest',
                    topology: 'triangle',
                    ...(polycount && { target_polycount: polycount }),
                    should_remesh: shouldRemesh,
                    should_texture: false,
                    enable_pbr: false,
                };
            const response = await axios_1.default.post(endpoint, requestBody, {
                headers: {
                    Authorization: `Bearer ${this.apiKey}`,
                    'Content-Type': 'application/json',
                },
                timeout: 60000,
            });
            const taskId = response.data.result;
            functions.logger.info('Meshy URL-based mesh-only generation started', {
                taskId,
                imageCount: limitedUrls.length,
            });
            return { taskId };
        }
        catch (error) {
            this.handleError(error, 'generateMeshOnlyFromUrls');
        }
    }
    /**
     * Check status of a generation task
     */
    async checkStatus(taskId) {
        try {
            // Try image-to-3d endpoint first, fall back to multi-image if needed
            let response;
            try {
                response = await axios_1.default.get(`${types_1.MESHY_API_BASE}/image-to-3d/${taskId}`, {
                    headers: {
                        Authorization: `Bearer ${this.apiKey}`,
                    },
                    timeout: 30000,
                });
            }
            catch (err) {
                // If 404, try multi-image endpoint
                if (axios_1.default.isAxiosError(err) && err.response?.status === 404) {
                    response = await axios_1.default.get(`${types_1.MESHY_API_BASE}/multi-image-to-3d/${taskId}`, {
                        headers: {
                            Authorization: `Bearer ${this.apiKey}`,
                        },
                        timeout: 30000,
                    });
                }
                else {
                    throw err;
                }
            }
            const result = (0, mapper_1.mapMeshyTaskStatus)(response.data);
            functions.logger.info('Meshy status check', {
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
            // Try image-to-3d endpoint first
            let response;
            try {
                response = await axios_1.default.get(`${types_1.MESHY_API_BASE}/image-to-3d/${taskId}`, {
                    headers: {
                        Authorization: `Bearer ${this.apiKey}`,
                    },
                    timeout: 30000,
                });
            }
            catch (err) {
                // If 404, try multi-image endpoint
                if (axios_1.default.isAxiosError(err) && err.response?.status === 404) {
                    response = await axios_1.default.get(`${types_1.MESHY_API_BASE}/multi-image-to-3d/${taskId}`, {
                        headers: {
                            Authorization: `Bearer ${this.apiKey}`,
                        },
                        timeout: 30000,
                    });
                }
                else {
                    throw err;
                }
            }
            if (response.data.status !== 'SUCCEEDED') {
                throw new Error(`Task not completed: ${response.data.status}`);
            }
            const result = (0, mapper_1.extractMeshyDownloads)(response.data);
            // Check for required format
            if (requiredFormat) {
                const hasFormat = result.files.some((f) => f.format === requiredFormat);
                if (!hasFormat) {
                    functions.logger.warn('Required format not available', {
                        taskId,
                        requiredFormat,
                        availableFormats: result.files.map((f) => f.format),
                    });
                    // Don't throw - return what's available
                }
            }
            functions.logger.info('Meshy download URLs retrieved', {
                taskId,
                fileCount: result.files.length,
                files: result.files.map((f) => f.format),
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
            functions.logger.info('Meshy model downloaded', {
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
        return ['glb', 'fbx', 'obj', 'usdz'];
    }
    /**
     * Get provider capabilities for UI introspection
     */
    getCapabilities() {
        return {
            supportsMultiView: true,
            supportsPBR: true,
            supportedFormats: ['glb', 'fbx', 'obj', 'usdz'],
            estimatedTime: {
                draft: '~1 min',
                standard: '~2 min',
                fine: '~3 min',
            },
        };
    }
    /**
     * Check API credit balance
     * Returns the current credit balance for the authenticated user
     */
    async checkBalance() {
        try {
            const response = await axios_1.default.get(`${types_1.MESHY_API_BASE}/balance`, {
                headers: {
                    Authorization: `Bearer ${this.apiKey}`,
                },
                timeout: 10000,
            });
            functions.logger.info('Meshy balance checked', {
                balance: response.data.result,
            });
            return response.data.result;
        }
        catch (error) {
            this.handleError(error, 'checkBalance');
        }
    }
    /**
     * Handle and log API errors
     */
    handleError(error, operation) {
        if (axios_1.default.isAxiosError(error)) {
            const axiosError = error;
            const status = axiosError.response?.status;
            const data = axiosError.response?.data;
            functions.logger.error(`Meshy API error in ${operation}`, {
                status,
                data: JSON.stringify(data),
                message: axiosError.message,
            });
            if (status === 401) {
                throw new functions.https.HttpsError('unauthenticated', 'Invalid Meshy API key');
            }
            if (status === 429) {
                throw new functions.https.HttpsError('resource-exhausted', 'Meshy API rate limit exceeded. Please try again later.');
            }
            if (status === 400) {
                throw new functions.https.HttpsError('invalid-argument', `Invalid request to Meshy API: ${JSON.stringify(data)}`);
            }
            if (status === 402) {
                throw new functions.https.HttpsError('resource-exhausted', 'Insufficient Meshy API credits');
            }
            throw new functions.https.HttpsError('internal', `Meshy API error: ${axiosError.message}`);
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
exports.MeshyProvider = MeshyProvider;
//# sourceMappingURL=client.js.map