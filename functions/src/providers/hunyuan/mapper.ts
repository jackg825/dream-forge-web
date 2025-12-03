/**
 * Hunyuan Status Mapper
 *
 * Maps Hunyuan API responses to unified provider types.
 */

import type { ProviderTaskStatus, TaskStatusResult, DownloadResult } from '../types';
import type { HunyuanTaskStatus, HunyuanQueryResponse } from './types';

/**
 * Map Hunyuan task status to unified ProviderTaskStatus
 */
export function mapHunyuanStatus(status: HunyuanTaskStatus): ProviderTaskStatus {
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
export function mapHunyuanTaskStatus(response: HunyuanQueryResponse): TaskStatusResult {
  return {
    status: mapHunyuanStatus(response.Status),
    progress: response.Progress,
    error: response.ErrorMessage,
  };
}

/**
 * Extract download URLs from Hunyuan query response
 */
export function extractHunyuanDownloads(response: HunyuanQueryResponse): DownloadResult {
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
