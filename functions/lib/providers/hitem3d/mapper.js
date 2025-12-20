"use strict";
/**
 * HiTem3D Status and Response Mappers
 *
 * Maps HiTem3D API responses to unified provider types.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.mapHitemStatus = mapHitemStatus;
exports.mapHitemTaskStatus = mapHitemTaskStatus;
exports.extractHitemDownloads = extractHitemDownloads;
/**
 * Map HiTem task state to unified ProviderTaskStatus
 */
function mapHitemStatus(state) {
    switch (state) {
        case 'created':
        case 'queueing':
            return 'pending';
        case 'processing':
            return 'processing';
        case 'success':
            return 'completed';
        case 'failed':
            return 'failed';
        default:
            return 'pending';
    }
}
/**
 * Map HiTem query response to TaskStatusResult
 */
function mapHitemTaskStatus(response) {
    // Handle error responses
    if (response.code !== 200 && response.code !== '200') {
        return {
            status: 'failed',
            error: response.msg,
        };
    }
    if (!response.data) {
        return {
            status: 'failed',
            error: 'No data in response',
        };
    }
    const state = response.data.state;
    const status = mapHitemStatus(state);
    // Calculate approximate progress based on state
    let progress;
    switch (state) {
        case 'created':
            progress = 5;
            break;
        case 'queueing':
            progress = 10;
            break;
        case 'processing':
            progress = 50; // Approximate middle of processing
            break;
        case 'success':
            progress = 100;
            break;
        case 'failed':
            progress = undefined;
            break;
    }
    return {
        status,
        progress,
        error: state === 'failed' ? response.msg : undefined,
    };
}
/**
 * Extract download URLs from HiTem query response
 *
 * Note: HiTem URLs have 1-hour validity
 */
function extractHitemDownloads(response) {
    const files = [];
    if (response.data?.url) {
        // HiTem returns a single URL; determine format from URL extension
        const url = response.data.url;
        const format = extractFormatFromUrl(url);
        files.push({
            url,
            name: `model.${format}`,
            format,
        });
    }
    return {
        files,
        thumbnailUrl: response.data?.cover_url,
    };
}
/**
 * Extract format from URL path
 */
function extractFormatFromUrl(url) {
    try {
        const pathname = new URL(url).pathname;
        const extension = pathname.split('.').pop()?.toLowerCase();
        if (extension && ['glb', 'obj', 'stl', 'fbx'].includes(extension)) {
            return extension;
        }
    }
    catch {
        // URL parsing failed, fall back to glb
    }
    return 'glb'; // Default to glb
}
//# sourceMappingURL=mapper.js.map