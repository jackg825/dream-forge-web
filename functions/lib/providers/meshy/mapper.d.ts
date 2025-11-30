/**
 * Meshy Status and Response Mappers
 *
 * Maps Meshy API responses to unified provider types.
 */
import type { MeshyStatus, MeshyTaskResponse } from './types';
import type { ProviderTaskStatus, TaskStatusResult, DownloadResult } from '../types';
/**
 * Map Meshy status to unified ProviderTaskStatus
 */
export declare function mapMeshyStatus(status: MeshyStatus): ProviderTaskStatus;
/**
 * Map Meshy task response to TaskStatusResult
 */
export declare function mapMeshyTaskStatus(task: MeshyTaskResponse): TaskStatusResult;
/**
 * Extract download URLs from Meshy task response
 */
export declare function extractMeshyDownloads(task: MeshyTaskResponse): DownloadResult;
