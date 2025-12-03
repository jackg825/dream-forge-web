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
export declare function mapHunyuanStatus(status: HunyuanTaskStatus): ProviderTaskStatus;
/**
 * Map Hunyuan query response to TaskStatusResult
 */
export declare function mapHunyuanTaskStatus(response: HunyuanQueryResponse): TaskStatusResult;
/**
 * Extract download URLs from Hunyuan query response
 */
export declare function extractHunyuanDownloads(response: HunyuanQueryResponse): DownloadResult;
