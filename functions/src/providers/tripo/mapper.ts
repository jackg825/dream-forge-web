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
export function extractTripoDownloads(response: TripoTaskStatusResponse): DownloadResult {
  const files: Array<{ url: string; name: string; format: string }> = [];

  const output = response.data.output;
  if (output) {
    // Main model
    if (output.model) {
      files.push({
        url: output.model.url,
        name: `model.${output.model.type}`,
        format: output.model.type,
      });
    }

    // PBR model if available
    if (output.pbr_model) {
      files.push({
        url: output.pbr_model.url,
        name: `model_pbr.${output.pbr_model.type}`,
        format: output.pbr_model.type,
      });
    }

    // Base model if available
    if (output.base_model) {
      files.push({
        url: output.base_model.url,
        name: `model_base.${output.base_model.type}`,
        format: output.base_model.type,
      });
    }
  }

  return {
    files,
    thumbnailUrl: output?.rendered_image,
  };
}
