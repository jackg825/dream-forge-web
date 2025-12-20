/**
 * HiTem3D Status and Response Mappers
 *
 * Maps HiTem3D API responses to unified provider types.
 */
import type { HitemTaskState, HitemQueryResponse } from './types';
import type { ProviderTaskStatus, TaskStatusResult, DownloadResult } from '../types';
/**
 * Map HiTem task state to unified ProviderTaskStatus
 */
export declare function mapHitemStatus(state: HitemTaskState): ProviderTaskStatus;
/**
 * Map HiTem query response to TaskStatusResult
 */
export declare function mapHitemTaskStatus(response: HitemQueryResponse): TaskStatusResult;
/**
 * Extract download URLs from HiTem query response
 *
 * Note: HiTem URLs have 1-hour validity
 */
export declare function extractHitemDownloads(response: HitemQueryResponse): DownloadResult;
