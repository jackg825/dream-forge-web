"use strict";
/**
 * HiTem3D Provider
 *
 * Implements I3DProvider interface for HiTem3D API.
 * Uses hitem3dv1.5 model by default for high quality.
 *
 * API Docs: https://docs.hitem3d.ai/en/api/api-reference/
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
exports.Hitem3DProvider = void 0;
const axios_1 = __importDefault(require("axios"));
const form_data_1 = __importDefault(require("form-data"));
const functions = __importStar(require("firebase-functions"));
const types_1 = require("./types");
const auth_1 = require("./auth");
const mapper_1 = require("./mapper");
class Hitem3DProvider {
    providerType = 'hitem3d';
    authManager;
    constructor(clientId, clientSecret) {
        this.authManager = new auth_1.HitemAuthManager(clientId, clientSecret);
    }
    /**
     * Generate 3D model from single image
     */
    async generateFromImage(imageBuffer, options) {
        return this.generateFromMultipleImages([imageBuffer], options);
    }
    /**
     * Generate 3D model from multiple images
     *
     * HiTem supports multi-view generation with multi_images field.
     */
    async generateFromMultipleImages(imageBuffers, options) {
        try {
            const accessToken = await this.authManager.getAccessToken();
            const resolution = types_1.HITEM_QUALITY_RESOLUTION[options.quality] || 1024;
            const formatCode = this.getFormatCode(options.format);
            functions.logger.info('Starting HiTem3D generation', {
                imageCount: imageBuffers.length,
                quality: options.quality,
                resolution,
                format: options.format,
                formatCode,
            });
            // Build multipart form data
            const formData = new form_data_1.default();
            formData.append('request_type', '3'); // Both geometry and texture
            formData.append('model', types_1.HITEM_DEFAULT_MODEL);
            formData.append('resolution', String(resolution));
            formData.append('format', String(formatCode));
            // Add images
            if (imageBuffers.length === 1) {
                formData.append('images', imageBuffers[0], {
                    filename: 'image.png',
                    contentType: 'image/png',
                });
            }
            else {
                // Multi-image mode
                imageBuffers.forEach((buffer, index) => {
                    formData.append('multi_images', buffer, {
                        filename: `image_${index}.png`,
                        contentType: 'image/png',
                    });
                });
                // Generate bitmap string for multi_images_bit (indicates which views are present)
                // Default to all views present based on count
                const multiImagesBit = '1'.repeat(imageBuffers.length).padEnd(4, '0');
                formData.append('multi_images_bit', multiImagesBit);
            }
            const response = await axios_1.default.post(`${types_1.HITEM_API_BASE}/open-api/v1/submit-task`, formData, {
                headers: {
                    ...formData.getHeaders(),
                    Authorization: `Bearer ${accessToken}`,
                },
                timeout: 120000, // 2 minutes for file upload
                maxContentLength: Infinity,
                maxBodyLength: Infinity,
            });
            // Check response
            if (response.data.code !== 200 && response.data.code !== '200') {
                this.handleApiError(response.data.code, response.data.msg, 'generateFromMultipleImages');
            }
            if (!response.data.data?.task_id) {
                throw new functions.https.HttpsError('internal', 'HiTem3D response missing task_id');
            }
            const taskId = response.data.data.task_id;
            functions.logger.info('HiTem3D generation started', {
                taskId,
                imageCount: imageBuffers.length,
                resolution,
            });
            return { taskId };
        }
        catch (error) {
            this.handleError(error, 'generateFromMultipleImages');
        }
    }
    /**
     * Check status of a generation task
     */
    async checkStatus(taskId) {
        try {
            const accessToken = await this.authManager.getAccessToken();
            const response = await axios_1.default.get(`${types_1.HITEM_API_BASE}/open-api/v1/query-task`, {
                params: { task_id: taskId },
                headers: {
                    Authorization: `Bearer ${accessToken}`,
                    'Content-Type': 'application/json',
                },
                timeout: 30000,
            });
            const result = (0, mapper_1.mapHitemTaskStatus)(response.data);
            functions.logger.info('HiTem3D status check', {
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
            const accessToken = await this.authManager.getAccessToken();
            const response = await axios_1.default.get(`${types_1.HITEM_API_BASE}/open-api/v1/query-task`, {
                params: { task_id: taskId },
                headers: {
                    Authorization: `Bearer ${accessToken}`,
                    'Content-Type': 'application/json',
                },
                timeout: 30000,
            });
            // Verify task is complete
            if (response.data.data?.state !== 'success') {
                throw new Error(`Task not completed: ${response.data.data?.state}`);
            }
            const result = (0, mapper_1.extractHitemDownloads)(response.data);
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
            functions.logger.info('HiTem3D download URLs retrieved', {
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
            functions.logger.info('HiTem3D model downloaded', {
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
        return ['glb', 'obj', 'stl', 'fbx'];
    }
    /**
     * Get provider capabilities for UI introspection
     */
    getCapabilities() {
        return {
            supportsMultiView: true,
            supportsPBR: true,
            minFaceCount: 100000,
            maxFaceCount: 2000000,
            supportedFormats: ['glb', 'obj', 'stl', 'fbx'],
            estimatedTime: {
                draft: '~2 min',
                standard: '~3 min',
                fine: '~5 min',
            },
        };
    }
    /**
     * Get format code for HiTem API
     */
    getFormatCode(format) {
        return types_1.HITEM_FORMAT_CODE[format] || 2; // Default to glb (code 2)
    }
    /**
     * Handle API-level errors from response
     */
    handleApiError(code, msg, operation) {
        const codeStr = String(code);
        functions.logger.error(`HiTem3D API error in ${operation}`, {
            code: codeStr,
            message: msg,
        });
        if (codeStr === types_1.HITEM_ERROR_CODES.INVALID_CREDENTIALS) {
            throw new functions.https.HttpsError('unauthenticated', 'Invalid HiTem3D credentials');
        }
        if (codeStr === types_1.HITEM_ERROR_CODES.GENERATE_FAILED) {
            throw new functions.https.HttpsError('internal', `HiTem3D generation failed: ${msg}`);
        }
        // Check for insufficient balance (common pattern in Chinese APIs)
        if (msg.toLowerCase().includes('balance') || msg.includes('余额')) {
            throw new functions.https.HttpsError('resource-exhausted', 'Insufficient HiTem3D credits');
        }
        throw new functions.https.HttpsError('internal', `HiTem3D error: ${msg}`);
    }
    /**
     * Handle and log errors
     */
    handleError(error, operation) {
        // Re-throw HttpsErrors as-is
        if (error instanceof functions.https.HttpsError) {
            throw error;
        }
        if (axios_1.default.isAxiosError(error)) {
            const axiosError = error;
            const status = axiosError.response?.status;
            const data = axiosError.response?.data;
            functions.logger.error(`HiTem3D API error in ${operation}`, {
                status,
                data: JSON.stringify(data),
                message: axiosError.message,
            });
            if (status === 401) {
                throw new functions.https.HttpsError('unauthenticated', 'Invalid HiTem3D credentials');
            }
            if (status === 429) {
                throw new functions.https.HttpsError('resource-exhausted', 'HiTem3D API rate limit exceeded. Please try again later.');
            }
            if (status === 400) {
                throw new functions.https.HttpsError('invalid-argument', `Invalid request to HiTem3D API: ${JSON.stringify(data)}`);
            }
            throw new functions.https.HttpsError('internal', `HiTem3D API error: ${axiosError.message}`);
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
exports.Hitem3DProvider = Hitem3DProvider;
//# sourceMappingURL=client.js.map