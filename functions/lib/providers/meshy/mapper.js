"use strict";
/**
 * Meshy Status and Response Mappers
 *
 * Maps Meshy API responses to unified provider types.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.mapMeshyStatus = mapMeshyStatus;
exports.mapMeshyTaskStatus = mapMeshyTaskStatus;
exports.extractMeshyDownloads = extractMeshyDownloads;
/**
 * Map Meshy status to unified ProviderTaskStatus
 */
function mapMeshyStatus(status) {
    switch (status) {
        case 'PENDING':
            return 'pending';
        case 'IN_PROGRESS':
            return 'processing';
        case 'SUCCEEDED':
            return 'completed';
        case 'FAILED':
        case 'CANCELED':
            return 'failed';
        default:
            return 'pending';
    }
}
/**
 * Map Meshy task response to TaskStatusResult
 */
function mapMeshyTaskStatus(task) {
    return {
        status: mapMeshyStatus(task.status),
        progress: task.progress,
        error: task.task_error?.message,
    };
}
/**
 * Extract download URLs from Meshy task response
 */
function extractMeshyDownloads(task) {
    const files = [];
    if (task.model_urls) {
        const urls = task.model_urls;
        if (urls.glb)
            files.push({ url: urls.glb, name: 'model.glb', format: 'glb' });
        if (urls.fbx)
            files.push({ url: urls.fbx, name: 'model.fbx', format: 'fbx' });
        if (urls.obj)
            files.push({ url: urls.obj, name: 'model.obj', format: 'obj' });
        if (urls.usdz)
            files.push({ url: urls.usdz, name: 'model.usdz', format: 'usdz' });
    }
    return {
        files,
        thumbnailUrl: task.thumbnail_url,
        textureUrls: task.texture_urls
            ? {
                baseColor: task.texture_urls.base_color,
                metallic: task.texture_urls.metallic,
                normal: task.texture_urls.normal,
                roughness: task.texture_urls.roughness,
            }
            : undefined,
    };
}
//# sourceMappingURL=mapper.js.map