/**
 * HiTem3D Status and Response Mappers
 *
 * Maps HiTem3D API responses to unified provider types.
 */

import type { HitemTaskState, HitemQueryResponse } from './types';
import type {
  ProviderTaskStatus,
  TaskStatusResult,
  DownloadResult,
  DownloadableFile,
} from '../types';

/**
 * Map HiTem task state to unified ProviderTaskStatus
 */
export function mapHitemStatus(state: HitemTaskState): ProviderTaskStatus {
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
export function mapHitemTaskStatus(response: HitemQueryResponse): TaskStatusResult {
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
  let progress: number | undefined;
  switch (state) {
    case 'created':
      progress = 5;
      break;
    case 'queueing':
      progress = 10;
      break;
    case 'processing':
      progress = 50;  // Approximate middle of processing
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
export function extractHitemDownloads(response: HitemQueryResponse): DownloadResult {
  const files: DownloadableFile[] = [];

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
function extractFormatFromUrl(url: string): string {
  try {
    const pathname = new URL(url).pathname;
    const extension = pathname.split('.').pop()?.toLowerCase();
    if (extension && ['glb', 'obj', 'stl', 'fbx'].includes(extension)) {
      return extension;
    }
  } catch {
    // URL parsing failed, fall back to glb
  }
  return 'glb';  // Default to glb
}
