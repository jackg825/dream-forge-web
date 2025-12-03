"use strict";
/**
 * Hunyuan Status Mapper
 *
 * Maps Hunyuan SDK responses to unified provider types.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.mapHunyuanStatus = mapHunyuanStatus;
exports.mapHunyuanTaskStatus = mapHunyuanTaskStatus;
exports.extractHunyuanDownloads = extractHunyuanDownloads;
/**
 * Map SDK status to unified ProviderTaskStatus
 */
function mapHunyuanStatus(status) {
    switch (status) {
        case 'WAIT':
            return 'pending';
        case 'RUN':
            return 'processing';
        case 'DONE':
            return 'completed';
        case 'FAIL':
            return 'failed';
        default:
            return 'pending';
    }
}
/**
 * Map SDK query response to TaskStatusResult
 */
function mapHunyuanTaskStatus(response) {
    return {
        status: mapHunyuanStatus(response.Status),
        progress: response.Status === 'RUN' ? 50 : response.Status === 'DONE' ? 100 : 0,
        error: response.ErrorMessage || response.ErrorCode,
    };
}
/**
 * Extract download URLs from SDK query response
 */
function extractHunyuanDownloads(response) {
    const files = response.ResultFile3Ds?.map((file) => ({
        url: file.Url || '',
        name: file.Type ? `model.${file.Type.toLowerCase()}` : 'model',
        format: file.Type?.toLowerCase() || 'unknown', // Normalize to lowercase for consistency
    })) || [];
    // Find thumbnail from first file's preview
    const thumbnailUrl = response.ResultFile3Ds?.[0]?.PreviewImageUrl;
    return {
        files,
        thumbnailUrl,
    };
}
//# sourceMappingURL=mapper.js.map