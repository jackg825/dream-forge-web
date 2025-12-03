"use strict";
/**
 * Hunyuan Status Mapper
 *
 * Maps Hunyuan API responses to unified provider types.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.mapHunyuanStatus = mapHunyuanStatus;
exports.mapHunyuanTaskStatus = mapHunyuanTaskStatus;
exports.extractHunyuanDownloads = extractHunyuanDownloads;
/**
 * Map Hunyuan task status to unified ProviderTaskStatus
 */
function mapHunyuanStatus(status) {
    switch (status) {
        case 'QUEUED':
            return 'pending';
        case 'PROCESSING':
            return 'processing';
        case 'SUCCEEDED':
            return 'completed';
        case 'FAILED':
            return 'failed';
        default:
            return 'pending';
    }
}
/**
 * Map Hunyuan query response to TaskStatusResult
 */
function mapHunyuanTaskStatus(response) {
    return {
        status: mapHunyuanStatus(response.Status),
        progress: response.Progress,
        error: response.ErrorMessage,
    };
}
/**
 * Extract download URLs from Hunyuan query response
 */
function extractHunyuanDownloads(response) {
    const files = response.ModelFiles?.map((file) => ({
        url: file.Url,
        name: file.Name,
        format: file.Format,
    })) || [];
    return {
        files,
        thumbnailUrl: response.ThumbnailUrl,
        textureUrls: response.TextureUrls ? {
            baseColor: response.TextureUrls.BaseColor,
            metallic: response.TextureUrls.Metallic,
            normal: response.TextureUrls.Normal,
            roughness: response.TextureUrls.Roughness,
        } : undefined,
    };
}
//# sourceMappingURL=mapper.js.map