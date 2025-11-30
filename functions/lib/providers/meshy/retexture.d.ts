/**
 * Meshy Retexture API Client
 *
 * Adds textures to existing 3D meshes using Meshy's Retexture API.
 * Used in the pipeline workflow after mesh-only generation.
 *
 * API Docs: https://docs.meshy.ai/en/api/retexture
 */
import type { TaskStatusResult, DownloadResult } from '../types';
/**
 * Options for retexture generation
 */
export interface RetextureOptions {
    textStylePrompt?: string;
    imageStyleUrl?: string;
    enablePBR?: boolean;
    preserveOriginalUV?: boolean;
}
/**
 * Meshy Retexture Client
 *
 * Handles texture generation for existing meshes
 */
export declare class MeshyRetextureClient {
    private apiKey;
    constructor(apiKey: string);
    /**
     * Create a retexture task from a completed mesh task
     *
     * @param meshTaskId - Task ID from completed mesh generation
     * @param options - Retexture options (style prompt or reference image)
     * @returns Task ID for polling
     */
    createFromMeshTask(meshTaskId: string, options: RetextureOptions): Promise<string>;
    /**
     * Create a retexture task from a model URL
     *
     * @param modelUrl - URL or base64 data URI of 3D model
     * @param options - Retexture options
     * @returns Task ID for polling
     */
    createFromModelUrl(modelUrl: string, options: RetextureOptions): Promise<string>;
    /**
     * Check status of a retexture task
     */
    checkStatus(taskId: string): Promise<TaskStatusResult>;
    /**
     * Get download URLs for completed retexture task
     */
    getDownloadUrls(taskId: string): Promise<DownloadResult>;
    /**
     * Download model file from URL
     */
    downloadModel(url: string): Promise<Buffer>;
    /**
     * Handle and log API errors
     */
    private handleError;
}
/**
 * Create a MeshyRetextureClient instance with API key from environment
 */
export declare function createMeshyRetextureClient(): MeshyRetextureClient;
