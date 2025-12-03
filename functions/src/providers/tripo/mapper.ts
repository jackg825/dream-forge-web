/**
 * Tripo Status Mapper
 *
 * Maps Tripo API responses to unified provider types.
 */

import type { ProviderTaskStatus, TaskStatusResult, DownloadResult } from '../types';
import type { TripoTaskStatus, TripoTaskStatusResponse } from './types';

/**
 * Map Tripo task status to unified ProviderTaskStatus
 */
export function mapTripoStatus(status: TripoTaskStatus): ProviderTaskStatus {
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
export function mapTripoTaskStatus(response: TripoTaskStatusResponse): TaskStatusResult {
  return {
    status: mapTripoStatus(response.data.status),
    progress: response.data.progress,
    error: response.data.status === 'failed' ? 'Task failed' : undefined,
  };
}

/**
 * Extract download URLs from Tripo task status response
 */
/**
 * Helper to extract file extension from URL
 */
function getFormatFromUrl(url: string): string {
  try {
    const pathname = new URL(url).pathname;
    const ext = pathname.split('.').pop()?.toLowerCase();
    return ext || 'glb';  // Default to glb if can't determine
  } catch {
    return 'glb';
  }
}

export function extractTripoDownloads(response: TripoTaskStatusResponse): DownloadResult {
  const files: Array<{ url: string; name: string; format: string }> = [];

  const output = response.data.output;
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
          name: `model.${pbrType}`,  // Primary model name for download
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
        if (!hasPrimaryModel) hasPrimaryModel = true;
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
