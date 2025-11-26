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
const types_1 = require("./types");
const RODIN_API_BASE = 'https://hyperhuman.deemos.com/api/v2';
/**
 * Rodin Gen-2 API Client
 *
 * Handles communication with the Hyper3D Rodin API for 3D model generation.
 */
class RodinClient {
    client;
    constructor(apiKey) {
        this.client = axios_1.default.create({
            baseURL: RODIN_API_BASE,
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json',
            },
            timeout: 30000, // 30 second timeout
        });
    }
    /**
     * Start a 3D model generation task
     *
     * @param imageUrl - URL of the input image
     * @param options - Generation options (quality, format, etc.)
     * @returns Task ID and subscription key for status polling
     */
    async generateModel(imageUrl, options) {
        const request = {
            images: [imageUrl],
            tier: options.tier,
            material: 'PBR',
            geometry_file_format: options.format,
            quality_override: types_1.QUALITY_FACE_COUNTS[options.quality],
            prompt: options.prompt,
        };
        try {
            const response = await this.client.post('/rodin', request);
            if (!response.data.uuid || !response.data.jobs?.subscription_key) {
                throw new Error('Invalid response from Rodin API');
            }
            functions.logger.info('Rodin generation started', {
                taskId: response.data.uuid,
                quality: options.quality,
                format: options.format,
            });
            return {
                taskId: response.data.uuid,
                subscriptionKey: response.data.jobs.subscription_key,
            };
        }
        catch (error) {
            this.handleError(error, 'generateModel');
            throw error; // TypeScript needs this
        }
    }
    /**
     * Check the status of a generation task
     *
     * @param taskId - The task UUID
     * @param subscriptionKey - The subscription key for this task
     * @returns Current status and result URL if complete
     */
    async checkStatus(taskId, subscriptionKey) {
        try {
            const response = await this.client.post('/status', { subscription_key: subscriptionKey });
            functions.logger.info('Rodin status check', {
                taskId,
                status: response.data.status,
                progress: response.data.progress,
            });
            return response.data;
        }
        catch (error) {
            this.handleError(error, 'checkStatus');
            throw error;
        }
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
     * Get supported output formats
     */
    static getSupportedFormats() {
        return ['glb', 'obj', 'fbx', 'stl'];
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
        functions.logger.error(`Unknown error in ${operation}`, { error });
        throw new functions.https.HttpsError('internal', 'An unexpected error occurred');
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