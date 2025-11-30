"use strict";
/**
 * Meshy Retexture API Client
 *
 * Adds textures to existing 3D meshes using Meshy's Retexture API.
 * Used in the pipeline workflow after mesh-only generation.
 *
 * API Docs: https://docs.meshy.ai/en/api/retexture
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
exports.MeshyRetextureClient = void 0;
exports.createMeshyRetextureClient = createMeshyRetextureClient;
const axios_1 = __importDefault(require("axios"));
const functions = __importStar(require("firebase-functions"));
const types_1 = require("./types");
/**
 * Meshy Retexture Client
 *
 * Handles texture generation for existing meshes
 */
class MeshyRetextureClient {
    apiKey;
    constructor(apiKey) {
        this.apiKey = apiKey;
    }
    /**
     * Create a retexture task from a completed mesh task
     *
     * @param meshTaskId - Task ID from completed mesh generation
     * @param options - Retexture options (style prompt or reference image)
     * @returns Task ID for polling
     */
    async createFromMeshTask(meshTaskId, options) {
        if (!options.textStylePrompt && !options.imageStyleUrl) {
            throw new functions.https.HttpsError('invalid-argument', 'Either textStylePrompt or imageStyleUrl is required for retexturing');
        }
        const requestBody = {
            input_task_id: meshTaskId,
            ai_model: 'latest',
            enable_original_uv: options.preserveOriginalUV ?? true,
            enable_pbr: options.enablePBR ?? true, // Enable PBR for better textures
        };
        if (options.textStylePrompt) {
            requestBody.text_style_prompt = options.textStylePrompt;
        }
        if (options.imageStyleUrl) {
            requestBody.image_style_url = options.imageStyleUrl;
        }
        functions.logger.info('Starting Meshy retexture task', {
            meshTaskId,
            hasTextPrompt: !!options.textStylePrompt,
            hasImageStyle: !!options.imageStyleUrl,
            enablePBR: options.enablePBR ?? true,
        });
        try {
            const response = await axios_1.default.post(`${types_1.MESHY_API_BASE}/retexture`, requestBody, {
                headers: {
                    Authorization: `Bearer ${this.apiKey}`,
                    'Content-Type': 'application/json',
                },
                timeout: 60000,
            });
            const taskId = response.data.result;
            functions.logger.info('Meshy retexture task created', { taskId, meshTaskId });
            return taskId;
        }
        catch (error) {
            this.handleError(error, 'createFromMeshTask');
        }
    }
    /**
     * Create a retexture task from a model URL
     *
     * @param modelUrl - URL or base64 data URI of 3D model
     * @param options - Retexture options
     * @returns Task ID for polling
     */
    async createFromModelUrl(modelUrl, options) {
        if (!options.textStylePrompt && !options.imageStyleUrl) {
            throw new functions.https.HttpsError('invalid-argument', 'Either textStylePrompt or imageStyleUrl is required for retexturing');
        }
        const requestBody = {
            model_url: modelUrl,
            ai_model: 'latest',
            enable_original_uv: options.preserveOriginalUV ?? true,
            enable_pbr: options.enablePBR ?? true,
        };
        if (options.textStylePrompt) {
            requestBody.text_style_prompt = options.textStylePrompt;
        }
        if (options.imageStyleUrl) {
            requestBody.image_style_url = options.imageStyleUrl;
        }
        functions.logger.info('Starting Meshy retexture from model URL', {
            hasTextPrompt: !!options.textStylePrompt,
            hasImageStyle: !!options.imageStyleUrl,
        });
        try {
            const response = await axios_1.default.post(`${types_1.MESHY_API_BASE}/retexture`, requestBody, {
                headers: {
                    Authorization: `Bearer ${this.apiKey}`,
                    'Content-Type': 'application/json',
                },
                timeout: 60000,
            });
            const taskId = response.data.result;
            functions.logger.info('Meshy retexture task created', { taskId });
            return taskId;
        }
        catch (error) {
            this.handleError(error, 'createFromModelUrl');
        }
    }
    /**
     * Check status of a retexture task
     */
    async checkStatus(taskId) {
        try {
            const response = await axios_1.default.get(`${types_1.MESHY_API_BASE}/retexture/${taskId}`, {
                headers: {
                    Authorization: `Bearer ${this.apiKey}`,
                },
                timeout: 30000,
            });
            const data = response.data;
            functions.logger.info('Meshy retexture status check', {
                taskId,
                status: data.status,
                progress: data.progress,
            });
            // Map Meshy status to our status
            let status;
            switch (data.status) {
                case 'PENDING':
                case 'IN_PROGRESS':
                    status = 'processing';
                    break;
                case 'SUCCEEDED':
                    status = 'completed';
                    break;
                case 'FAILED':
                case 'CANCELED':
                    status = 'failed';
                    break;
                default:
                    status = 'processing';
            }
            return {
                status,
                progress: data.progress,
                error: data.task_error?.message,
            };
        }
        catch (error) {
            this.handleError(error, 'checkStatus');
        }
    }
    /**
     * Get download URLs for completed retexture task
     */
    async getDownloadUrls(taskId) {
        try {
            const response = await axios_1.default.get(`${types_1.MESHY_API_BASE}/retexture/${taskId}`, {
                headers: {
                    Authorization: `Bearer ${this.apiKey}`,
                },
                timeout: 30000,
            });
            const data = response.data;
            if (data.status !== 'SUCCEEDED') {
                throw new functions.https.HttpsError('failed-precondition', `Retexture task not completed: ${data.status}`);
            }
            const files = [];
            // Add model URLs
            if (data.model_urls) {
                if (data.model_urls.glb) {
                    files.push({ url: data.model_urls.glb, format: 'glb', name: 'model.glb' });
                }
                if (data.model_urls.fbx) {
                    files.push({ url: data.model_urls.fbx, format: 'fbx', name: 'model.fbx' });
                }
                if (data.model_urls.obj) {
                    files.push({ url: data.model_urls.obj, format: 'obj', name: 'model.obj' });
                }
                if (data.model_urls.usdz) {
                    files.push({ url: data.model_urls.usdz, format: 'usdz', name: 'model.usdz' });
                }
            }
            // Add texture URLs if available
            if (data.texture_urls && data.texture_urls.length > 0) {
                const textures = data.texture_urls[0]; // Take first texture set
                if (textures.base_color) {
                    files.push({ url: textures.base_color, format: 'png', name: 'texture_base_color.png' });
                }
                if (textures.metallic) {
                    files.push({ url: textures.metallic, format: 'png', name: 'texture_metallic.png' });
                }
                if (textures.normal) {
                    files.push({ url: textures.normal, format: 'png', name: 'texture_normal.png' });
                }
                if (textures.roughness) {
                    files.push({ url: textures.roughness, format: 'png', name: 'texture_roughness.png' });
                }
            }
            functions.logger.info('Meshy retexture download URLs retrieved', {
                taskId,
                fileCount: files.length,
                formats: files.map((f) => f.format),
            });
            return {
                files,
                thumbnailUrl: data.thumbnail_url,
            };
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
            functions.logger.info('Meshy retextured model downloaded', {
                size: response.data.length,
            });
            return Buffer.from(response.data);
        }
        catch (error) {
            this.handleError(error, 'downloadModel');
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
            functions.logger.error(`Meshy Retexture API error in ${operation}`, {
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
                throw new functions.https.HttpsError('invalid-argument', `Invalid request to Meshy Retexture API: ${JSON.stringify(data)}`);
            }
            if (status === 402) {
                throw new functions.https.HttpsError('resource-exhausted', 'Insufficient Meshy API credits');
            }
            if (status === 404) {
                throw new functions.https.HttpsError('not-found', 'Retexture task not found');
            }
            throw new functions.https.HttpsError('internal', `Meshy Retexture API error: ${axiosError.message}`);
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
exports.MeshyRetextureClient = MeshyRetextureClient;
/**
 * Create a MeshyRetextureClient instance with API key from environment
 */
function createMeshyRetextureClient() {
    const apiKey = process.env.MESHY_API_KEY;
    if (!apiKey) {
        throw new functions.https.HttpsError('failed-precondition', 'Meshy API key not configured');
    }
    return new MeshyRetextureClient(apiKey);
}
//# sourceMappingURL=retexture.js.map