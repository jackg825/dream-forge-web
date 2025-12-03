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
export declare function mapTripoStatus(status: TripoTaskStatus): ProviderTaskStatus;
/**
 * Map Tripo task status response to TaskStatusResult
 */
export declare function mapTripoTaskStatus(response: TripoTaskStatusResponse): TaskStatusResult;
export declare function extractTripoDownloads(response: TripoTaskStatusResponse): DownloadResult;
