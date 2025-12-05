"use strict";
/**
 * Tripo Status Mapper
 *
 * Maps Tripo API responses to unified provider types.
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.mapTripoStatus = mapTripoStatus;
exports.mapTripoTaskStatus = mapTripoTaskStatus;
exports.extractTripoDownloads = extractTripoDownloads;
const functions = __importStar(require("firebase-functions"));
/**
 * Map Tripo task status to unified ProviderTaskStatus
 */
function mapTripoStatus(status) {
    switch (status) {
        case 'queued':
            return 'pending';
        case 'running':
            return 'processing';
        case 'success':
            return 'completed';
        case 'failed':
        case 'cancelled':
            return 'failed';
        default:
            return 'pending';
    }
}
/**
 * Map Tripo task status response to TaskStatusResult
 */
function mapTripoTaskStatus(response) {
    const data = response.data;
    // Extract meaningful error message when task fails
    let error;
    if (data.status === 'failed') {
        // Log full response for debugging
        functions.logger.error('Tripo task failed', {
            taskId: data.task_id,
            errorCode: data.error_code,
            rawData: JSON.stringify(data),
        });
        // Build error message with available details
        if (data.error_code) {
            error = `Tripo error ${data.error_code}`;
        }
        else if (data.error_message) {
            error = `Tripo: ${data.error_message}`;
        }
        else if (data.failure_reason) {
            error = `Tripo: ${data.failure_reason}`;
        }
        else {
            error = 'Tripo task failed';
        }
    }
    return {
        status: mapTripoStatus(data.status),
        progress: data.progress,
        error,
    };
}
/**
 * Extract download URLs from Tripo task status response
 */
/**
 * Helper to extract file extension from URL
 * Handles various URL formats including signed URLs with query parameters
 */
function getFormatFromUrl(url) {
    try {
        const urlObj = new URL(url);
        const pathname = urlObj.pathname;
        // Try to extract extension from pathname
        const ext = pathname.split('.').pop()?.toLowerCase();
        if (ext && ['glb', 'gltf', 'obj', 'fbx', 'stl'].includes(ext)) {
            return ext;
        }
        // Fallback: check if URL contains format string anywhere
        if (url.includes('.glb'))
            return 'glb';
        if (url.includes('.gltf'))
            return 'gltf';
        if (url.includes('.obj'))
            return 'obj';
        if (url.includes('.fbx'))
            return 'fbx';
        if (url.includes('.stl'))
            return 'stl';
        return 'glb'; // Default to glb
    }
    catch {
        return 'glb';
    }
}
function extractTripoDownloads(response) {
    const files = [];
    const output = response.data.output;
    // Debug: Log the actual API response structure
    functions.logger.info('Tripo output structure', {
        hasOutput: !!output,
        hasModel: !!output?.model,
        hasPbrModel: !!output?.pbr_model,
        hasBaseModel: !!output?.base_model,
        modelType: typeof output?.model,
        pbrModelType: typeof output?.pbr_model,
        baseModelType: typeof output?.base_model,
        rawModel: output?.model ? JSON.stringify(output.model).substring(0, 300) : null,
        rawPbrModel: output?.pbr_model ? JSON.stringify(output.pbr_model).substring(0, 300) : null,
        rawBaseModel: output?.base_model ? JSON.stringify(output.base_model).substring(0, 300) : null,
    });
    if (output) {
        // Priority: pbr_model > model > base_model
        // pbr_model contains textures, model may be untextured base mesh
        let hasPrimaryModel = false;
        // PBR model (with textures) - use as primary if available
        if (output.pbr_model) {
            const pbrUrl = typeof output.pbr_model === 'string' ? output.pbr_model : output.pbr_model.url;
            const pbrType = typeof output.pbr_model === 'string'
                ? getFormatFromUrl(output.pbr_model)
                : (output.pbr_model.type || getFormatFromUrl(output.pbr_model.url));
            if (pbrUrl) {
                files.push({
                    url: pbrUrl,
                    name: `model.${pbrType}`, // Primary model name for download
                    format: pbrType,
                });
                hasPrimaryModel = true;
            }
        }
        // Main model - use as primary only if no pbr_model, otherwise as backup
        if (output.model) {
            const modelUrl = typeof output.model === 'string' ? output.model : output.model.url;
            const modelType = typeof output.model === 'string'
                ? getFormatFromUrl(output.model)
                : (output.model.type || getFormatFromUrl(output.model.url));
            if (modelUrl) {
                files.push({
                    url: modelUrl,
                    name: hasPrimaryModel ? `model_base.${modelType}` : `model.${modelType}`,
                    format: modelType,
                });
                if (!hasPrimaryModel)
                    hasPrimaryModel = true;
            }
        }
        // Base model if available (always as backup)
        if (output.base_model) {
            const baseUrl = typeof output.base_model === 'string' ? output.base_model : output.base_model.url;
            const baseType = typeof output.base_model === 'string'
                ? getFormatFromUrl(output.base_model)
                : (output.base_model.type || getFormatFromUrl(output.base_model.url));
            if (baseUrl) {
                files.push({
                    url: baseUrl,
                    name: hasPrimaryModel ? `model_untextured.${baseType}` : `model.${baseType}`,
                    format: baseType,
                });
            }
        }
    }
    return {
        files,
        thumbnailUrl: output?.rendered_image,
    };
}
//# sourceMappingURL=mapper.js.map