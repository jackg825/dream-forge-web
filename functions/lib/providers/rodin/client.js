"use strict";
/**
 * Rodin Provider
 *
 * Wraps existing RodinClient to implement I3DProvider interface.
 * Delegates to the original implementation for API calls.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.RodinProvider = void 0;
const client_1 = require("../../rodin/client");
/**
 * Map Rodin status to unified ProviderTaskStatus
 */
function mapRodinStatus(status) {
    switch (status) {
        case 'Waiting':
            return 'pending';
        case 'Generating':
            return 'processing';
        case 'Done':
            return 'completed';
        case 'Failed':
            return 'failed';
        default:
            return 'pending';
    }
}
class RodinProvider {
    providerType = 'rodin';
    client;
    constructor(apiKey) {
        this.client = new client_1.RodinClient(apiKey);
    }
    /**
     * Generate 3D model from single image
     */
    async generateFromImage(imageBuffer, options) {
        const result = await this.client.generateModel(imageBuffer, {
            tier: 'Gen-2',
            quality: options.quality,
            format: options.format,
            meshMode: 'Raw',
        });
        return {
            taskId: result.taskUuid,
            subscriptionKey: result.subscriptionKey,
            jobUuids: result.jobUuids,
        };
    }
    /**
     * Generate 3D model from multiple images
     */
    async generateFromMultipleImages(imageBuffers, options) {
        const result = await this.client.generateModelMulti(imageBuffers, {
            tier: 'Gen-2',
            quality: options.quality,
            format: options.format,
            meshMode: 'Raw',
            conditionMode: imageBuffers.length > 1 ? 'concat' : undefined,
        });
        return {
            taskId: result.taskUuid,
            subscriptionKey: result.subscriptionKey,
            jobUuids: result.jobUuids,
        };
    }
    /**
     * Check status of a generation task
     *
     * Rodin requires subscriptionKey for status polling.
     */
    async checkStatus(taskId, subscriptionKey) {
        if (!subscriptionKey) {
            throw new Error('Rodin requires subscriptionKey for status check');
        }
        const result = await this.client.checkStatus(subscriptionKey);
        return {
            status: mapRodinStatus(result.status),
            jobUuid: result.jobUuid,
        };
    }
    /**
     * Get download URLs for completed task
     */
    async getDownloadUrls(taskId, requiredFormat) {
        const files = await this.client.getDownloadUrls(taskId, 5, // maxRetries
        3000, // retryDelayMs
        requiredFormat);
        return {
            files: files.map((f) => ({
                url: f.url,
                name: f.name,
                format: f.name.split('.').pop() || 'unknown',
            })),
        };
    }
    /**
     * Download model file from URL
     */
    async downloadModel(url) {
        return this.client.downloadModel(url);
    }
    /**
     * Get supported output formats
     */
    getSupportedFormats() {
        return ['glb', 'obj', 'fbx', 'stl', 'usdz'];
    }
    /**
     * Check API credit balance
     */
    async checkBalance() {
        return this.client.checkBalance();
    }
}
exports.RodinProvider = RodinProvider;
//# sourceMappingURL=client.js.map