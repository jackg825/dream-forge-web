/**
 * Tripo3D API Types
 *
 * Tripo3D v3.0 API type definitions.
 * API Base URL: https://api.tripo3d.ai/v2
 */
export declare const TRIPO_API_BASE = "https://api.tripo3d.ai/v2";
/**
 * Task type for creation
 */
export type TripoTaskType = 'image_to_model' | 'multiview_to_model' | 'text_to_model';
/**
 * Create task request (image to model)
 */
export interface TripoImageToModelRequest {
    type: 'image_to_model';
    file: {
        type: 'png' | 'jpg' | 'jpeg' | 'webp';
        data: string;
    };
    model_version?: string;
}
/**
 * Create task request (multiview to model)
 */
export interface TripoMultiviewToModelRequest {
    type: 'multiview_to_model';
    files: {
        front: {
            type: 'png' | 'jpg' | 'jpeg' | 'webp';
            data: string;
        };
        left?: {
            type: 'png' | 'jpg' | 'jpeg' | 'webp';
            data: string;
        };
        right?: {
            type: 'png' | 'jpg' | 'jpeg' | 'webp';
            data: string;
        };
        back?: {
            type: 'png' | 'jpg' | 'jpeg' | 'webp';
            data: string;
        };
    };
    model_version?: string;
}
/**
 * Create task response
 */
export interface TripoCreateTaskResponse {
    code: number;
    data: {
        task_id: string;
    };
}
/**
 * Tripo task status values
 */
export type TripoTaskStatus = 'queued' | 'running' | 'success' | 'failed' | 'cancelled' | 'unknown';
/**
 * Model output in task result
 */
export interface TripoModelOutput {
    type: string;
    url: string;
}
/**
 * Get task status response
 */
export interface TripoTaskStatusResponse {
    code: number;
    data: {
        task_id: string;
        type: string;
        status: TripoTaskStatus;
        progress: number;
        output?: {
            model: TripoModelOutput;
            rendered_image?: string;
            pbr_model?: TripoModelOutput;
            base_model?: TripoModelOutput;
        };
        create_time: number;
    };
}
/**
 * Download task models response
 */
export interface TripoDownloadResponse {
    code: number;
    data: {
        model: {
            type: string;
            url: string;
        };
    };
}
/**
 * Tripo API error response
 */
export interface TripoError {
    code: number;
    message: string;
}
/**
 * Quality to model version mapping (if needed)
 */
export declare const TRIPO_MODEL_VERSIONS: Record<string, string>;
