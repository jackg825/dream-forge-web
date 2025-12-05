"use strict";
/**
 * Hunyuan 3D Provider
 *
 * Implements I3DProvider interface for Tencent Cloud Hunyuan 3D v3.0 API.
 * Uses official tencentcloud-sdk-nodejs for API calls.
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
const tencentcloud = __importStar(require("tencentcloud-sdk-nodejs"));
const axios_1 = __importDefault(require("axios"));
const functions = __importStar(require("firebase-functions"));
const types_1 = require("./types");
const mapper_1 = require("./mapper");
// Get the AI3D client from SDK
const Ai3dClient = tencentcloud.ai3d.v20250513.Client;
class HunyuanProvider {
    providerType = 'hunyuan';
    client;
    constructor(secretId, secretKey, region = 'ap-guangzhou') {
        this.client = new Ai3dClient({
            credential: {
                secretId,
                secretKey,
            },
            region,
            profile: {
                httpProfile: {
                    endpoint: 'ai3d.tencentcloudapi.com',
                    reqTimeout: 120, // 2 minute timeout
                },
            },
        });
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
            const response = await this.client.SubmitHunyuanTo3DProJob({
                ImageBase64: base64,
                EnablePBR: options.enablePBR ?? false,
                FaceCount: faceCount,
                GenerateType: 'Normal',
            });
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
            // Build multi-view images array (SDK format)
            // Pipeline image order: [front, back, left, right]
            const multiViewImages = [];
            if (imageBuffers[1]) {
                multiViewImages.push({
                    ViewType: 'back',
                    ViewImageBase64: imageBuffers[1].toString('base64'),
                });
            }
            if (imageBuffers[2]) {
                multiViewImages.push({
                    ViewType: 'left',
                    ViewImageBase64: imageBuffers[2].toString('base64'),
                });
            }
            if (imageBuffers[3]) {
                multiViewImages.push({
                    ViewType: 'right',
                    ViewImageBase64: imageBuffers[3].toString('base64'),
                });
            }
            const response = await this.client.SubmitHunyuanTo3DProJob({
                ImageBase64: primaryBase64,
                EnablePBR: options.enablePBR ?? false,
                FaceCount: faceCount,
                GenerateType: 'Normal',
                MultiViewImages: multiViewImages.length > 0 ? multiViewImages : undefined,
            });
            functions.logger.info('Hunyuan multi-image generation started', {
                jobId: response.JobId,
                imageCount: imageBuffers.length,
                multiViewCount: multiViewImages.length,
            });
            return { taskId: response.JobId };
        }
        catch (error) {
            this.handleError(error, 'generateFromMultipleImages');
        }
    }
    /**
     * Generate 3D model from image URLs (no upload needed)
     *
     * Passes R2/storage URLs directly to Hunyuan API, avoiding timeout issues
     * from downloading and re-uploading images.
     *
     * Pipeline image order: [front, back, left, right]
     */
    async generateFromUrls(imageUrls, options) {
        try {
            const faceCount = this.getFaceCount(options);
            functions.logger.info('Starting Hunyuan URL-based generation', {
                imageCount: imageUrls.length,
                quality: options.quality,
                faceCount,
                format: options.format,
            });
            // Build multi-view images array using URLs
            // Pipeline image order: [front, back, left, right]
            const multiViewImages = [];
            if (imageUrls[1]) {
                multiViewImages.push({
                    ViewType: 'back',
                    ViewImageUrl: imageUrls[1],
                });
            }
            if (imageUrls[2]) {
                multiViewImages.push({
                    ViewType: 'left',
                    ViewImageUrl: imageUrls[2],
                });
            }
            if (imageUrls[3]) {
                multiViewImages.push({
                    ViewType: 'right',
                    ViewImageUrl: imageUrls[3],
                });
            }
            const response = await this.client.SubmitHunyuanTo3DProJob({
                ImageUrl: imageUrls[0], // Primary image (front)
                EnablePBR: options.enablePBR ?? false,
                FaceCount: faceCount,
                GenerateType: 'Normal',
                MultiViewImages: multiViewImages.length > 0 ? multiViewImages : undefined,
            });
            functions.logger.info('Hunyuan URL-based generation started', {
                jobId: response.JobId,
                imageCount: imageUrls.length,
                multiViewCount: multiViewImages.length,
            });
            return { taskId: response.JobId };
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
            const response = await this.client.QueryHunyuanTo3DProJob({
                JobId: taskId,
            });
            // Map SDK response to our internal format
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
            const response = await this.client.QueryHunyuanTo3DProJob({
                JobId: taskId,
            });
            if (response.Status !== 'DONE') {
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
     * Handle and log API errors
     */
    handleError(error, operation) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        const errorStack = error instanceof Error ? error.stack : undefined;
        functions.logger.error(`Hunyuan API error in ${operation}`, {
            error: errorMessage,
            stack: errorStack,
        });
        // Check for specific Tencent Cloud error codes in message
        if (errorMessage.includes('AuthFailure')) {
            throw new functions.https.HttpsError('unauthenticated', 'Invalid Tencent Cloud credentials');
        }
        if (errorMessage.includes('RequestLimitExceeded') || errorMessage.includes('RateLimitExceeded')) {
            throw new functions.https.HttpsError('resource-exhausted', 'Hunyuan API rate limit exceeded. Please try again later.');
        }
        if (errorMessage.includes('InvalidParameter')) {
            throw new functions.https.HttpsError('invalid-argument', `Invalid request to Hunyuan API: ${errorMessage}`);
        }
        throw new functions.https.HttpsError('internal', `Unexpected error in ${operation}: ${errorMessage}`);
    }
}
exports.HunyuanProvider = HunyuanProvider;
//# sourceMappingURL=client.js.map