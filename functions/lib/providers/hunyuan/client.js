"use strict";
/**
 * Hunyuan 3D Provider
 *
 * Implements I3DProvider interface for Tencent Cloud Hunyuan 3D v3.0 API.
 * Features: High polygon count control (40K-1.5M), PBR materials, multi-view support.
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
exports.HunyuanProvider = void 0;
const axios_1 = __importDefault(require("axios"));
const functions = __importStar(require("firebase-functions"));
const types_1 = require("./types");
const auth_1 = require("./auth");
const mapper_1 = require("./mapper");
class HunyuanProvider {
    providerType = 'hunyuan';
    secretId;
    secretKey;
    region;
    constructor(secretId, secretKey, region = 'ap-guangzhou') {
        this.secretId = secretId;
        this.secretKey = secretKey;
        this.region = region;
    }
    /**
     * Generate 3D model from single image
     */
    async generateFromImage(imageBuffer, options) {
        try {
            const base64 = imageBuffer.toString('base64');
            const faceCount = this.getFaceCount(options);
            functions.logger.info('Starting Hunyuan single-image generation', {
                quality: options.quality,
                faceCount,
                format: options.format,
                enablePBR: options.enablePBR,
            });
            const request = {
                ImageBase64: base64,
                EnablePBR: options.enablePBR ?? false,
                FaceCount: faceCount,
                GenerateType: 'Normal',
            };
            const response = await this.callAPI('SubmitHunyuanTo3DProJob', request);
            functions.logger.info('Hunyuan generation started', {
                jobId: response.JobId,
                requestId: response.RequestId,
            });
            return { taskId: response.JobId };
        }
        catch (error) {
            this.handleError(error, 'generateFromImage');
        }
    }
    /**
     * Generate 3D model from multiple images
     */
    async generateFromMultipleImages(imageBuffers, options) {
        try {
            // Use first image as primary, others as multi-view
            const primaryBase64 = imageBuffers[0].toString('base64');
            const faceCount = this.getFaceCount(options);
            functions.logger.info('Starting Hunyuan multi-image generation', {
                imageCount: imageBuffers.length,
                quality: options.quality,
                faceCount,
                format: options.format,
            });
            const request = {
                ImageBase64: primaryBase64,
                EnablePBR: options.enablePBR ?? false,
                FaceCount: faceCount,
                GenerateType: 'Normal',
            };
            // Add multi-view images if available
            if (imageBuffers.length > 1) {
                request.MultiViewImages = {};
                if (imageBuffers[1]) {
                    request.MultiViewImages.Left = imageBuffers[1].toString('base64');
                }
                if (imageBuffers[2]) {
                    request.MultiViewImages.Right = imageBuffers[2].toString('base64');
                }
                if (imageBuffers[3]) {
                    request.MultiViewImages.Back = imageBuffers[3].toString('base64');
                }
            }
            const response = await this.callAPI('SubmitHunyuanTo3DProJob', request);
            functions.logger.info('Hunyuan multi-image generation started', {
                jobId: response.JobId,
                imageCount: imageBuffers.length,
            });
            return { taskId: response.JobId };
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
            const request = { JobId: taskId };
            const response = await this.callAPI('QueryHunyuanTo3DProJob', request);
            const result = (0, mapper_1.mapHunyuanTaskStatus)(response);
            functions.logger.info('Hunyuan status check', {
                jobId: taskId,
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
            const request = { JobId: taskId };
            const response = await this.callAPI('QueryHunyuanTo3DProJob', request);
            if (response.Status !== 'SUCCEEDED') {
                throw new Error(`Task not completed: ${response.Status}`);
            }
            const result = (0, mapper_1.extractHunyuanDownloads)(response);
            // Check for required format
            if (requiredFormat) {
                const hasFormat = result.files.some((f) => f.format === requiredFormat);
                if (!hasFormat) {
                    functions.logger.warn('Required format not available', {
                        jobId: taskId,
                        requiredFormat,
                        availableFormats: result.files.map((f) => f.format),
                    });
                }
            }
            functions.logger.info('Hunyuan download URLs retrieved', {
                jobId: taskId,
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
            functions.logger.info('Hunyuan model downloaded', {
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
        return ['glb', 'obj', 'fbx'];
    }
    /**
     * Get provider capabilities for UI introspection
     */
    getCapabilities() {
        return {
            supportsMultiView: true,
            supportsPBR: true,
            minFaceCount: 40000,
            maxFaceCount: 1500000,
            supportedFormats: ['glb', 'obj', 'fbx'],
            estimatedTime: {
                draft: '~2 min',
                standard: '~4 min',
                fine: '~6 min',
            },
        };
    }
    /**
     * Get face count from options
     */
    getFaceCount(options) {
        // Check for provider-specific options
        const providerOpts = options.providerOptions?.hunyuan;
        if (providerOpts?.faceCount) {
            return providerOpts.faceCount;
        }
        // Fall back to quality mapping
        return types_1.HUNYUAN_QUALITY_FACE_COUNT[options.quality] ?? 200000;
    }
    /**
     * Call Tencent Cloud API with TC3 signature
     */
    async callAPI(action, body) {
        const payload = JSON.stringify(body);
        const headers = (0, auth_1.signRequest)({
            secretId: this.secretId,
            secretKey: this.secretKey,
            service: types_1.HUNYUAN_SERVICE,
            host: types_1.HUNYUAN_API_HOST,
            action,
            version: types_1.HUNYUAN_API_VERSION,
            region: this.region,
            payload,
        });
        try {
            const response = await axios_1.default.post(`https://${types_1.HUNYUAN_API_HOST}`, payload, {
                headers,
                timeout: 60000,
            });
            // Tencent Cloud wraps response in Response object
            if (response.data.Response?.Error) {
                const tcError = response.data;
                throw new Error(`Tencent Cloud API Error [${tcError.Response.Error.Code}]: ${tcError.Response.Error.Message}`);
            }
            return response.data.Response;
        }
        catch (error) {
            if (axios_1.default.isAxiosError(error)) {
                const axiosError = error;
                // Check for Tencent Cloud error in response
                const tcError = axiosError.response?.data;
                if (tcError?.Response?.Error) {
                    throw new Error(`Tencent Cloud API Error [${tcError.Response.Error.Code}]: ${tcError.Response.Error.Message}`);
                }
            }
            throw error;
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
            functions.logger.error(`Hunyuan API error in ${operation}`, {
                status,
                data: JSON.stringify(data),
                message: axiosError.message,
            });
            if (status === 401 || status === 403) {
                throw new functions.https.HttpsError('unauthenticated', 'Invalid Tencent Cloud credentials');
            }
            if (status === 429) {
                throw new functions.https.HttpsError('resource-exhausted', 'Hunyuan API rate limit exceeded. Please try again later.');
            }
            if (status === 400) {
                throw new functions.https.HttpsError('invalid-argument', `Invalid request to Hunyuan API: ${JSON.stringify(data)}`);
            }
            throw new functions.https.HttpsError('internal', `Hunyuan API error: ${axiosError.message}`);
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
exports.HunyuanProvider = HunyuanProvider;
//# sourceMappingURL=client.js.map