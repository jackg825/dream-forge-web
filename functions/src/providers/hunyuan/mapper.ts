/**
 * Hunyuan Status Mapper
 *
 * Maps Hunyuan SDK responses to unified provider types.
 */

import type { ProviderTaskStatus, TaskStatusResult, DownloadResult } from '../types';

/**
 * SDK response status values
 * WAIT = waiting, RUN = executing, FAIL = failed, DONE = completed
 */
type HunyuanSDKStatus = 'WAIT' | 'RUN' | 'FAIL' | 'DONE' | string;

/**
 * SDK File3D structure
 */
interface SDKFile3D {
  Type?: string;
  Url?: string;
  PreviewImageUrl?: string;
}

/**
 * SDK QueryHunyuanTo3DProJobResponse structure
 */
export interface SDKQueryResponse {
  Status?: HunyuanSDKStatus;
  ErrorCode?: string;
  ErrorMessage?: string;
  ResultFile3Ds?: SDKFile3D[];
  RequestId?: string;
}

/**
 * Map SDK status to unified ProviderTaskStatus
 */
export function mapHunyuanStatus(status?: string): ProviderTaskStatus {
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
export function mapHunyuanTaskStatus(response: SDKQueryResponse): TaskStatusResult {
  return {
    status: mapHunyuanStatus(response.Status),
    progress: response.Status === 'RUN' ? 50 : response.Status === 'DONE' ? 100 : 0,
    error: response.ErrorMessage || response.ErrorCode,
  };
}

/**
 * Extract download URLs from SDK query response
 */
export function extractHunyuanDownloads(response: SDKQueryResponse): DownloadResult {
  const files = response.ResultFile3Ds?.map((file) => ({
    url: file.Url || '',
    name: file.Type ? `model.${file.Type.toLowerCase()}` : 'model',
    format: file.Type?.toLowerCase() || 'unknown',  // Normalize to lowercase for consistency
  })) || [];

  // Find thumbnail from first file's preview
  const thumbnailUrl = response.ResultFile3Ds?.[0]?.PreviewImageUrl;

  return {
    files,
    thumbnailUrl,
  };
}
