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
export declare function mapHunyuanStatus(status?: string): ProviderTaskStatus;
/**
 * Map SDK query response to TaskStatusResult
 */
export declare function mapHunyuanTaskStatus(response: SDKQueryResponse): TaskStatusResult;
/**
 * Extract download URLs from SDK query response
 */
export declare function extractHunyuanDownloads(response: SDKQueryResponse): DownloadResult;
export {};
