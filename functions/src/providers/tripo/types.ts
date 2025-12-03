/**
 * Tripo3D API Types
 *
 * Tripo3D v3.0 API type definitions.
 * API Base URL: https://api.tripo3d.ai/v2/openapi
 */

// API base configuration
export const TRIPO_API_BASE = 'https://api.tripo3d.ai/v2/openapi';

/**
 * Task type for creation
 */
export type TripoTaskType = 'image_to_model' | 'multiview_to_model' | 'text_to_model';

/**
 * File input for single image (supports base64 data)
 */
export interface TripoFileInput {
  type: 'png' | 'jpg' | 'jpeg' | 'webp';
  data?: string;        // Base64 encoded
  file_token?: string;  // From upload API
  url?: string;         // Direct URL
}

/**
 * Multiview file input (one of file_token, url, or empty object to skip)
 */
export interface TripoMultiviewFileInput {
  type?: 'png' | 'jpg' | 'jpeg' | 'webp';
  file_token?: string;
  url?: string;
}

/**
 * Create task request (image to model)
 */
export interface TripoImageToModelRequest {
  type: 'image_to_model';
  file: TripoFileInput;
  model_version?: string;
  texture?: boolean;
  pbr?: boolean;
  texture_quality?: 'standard' | 'detailed';
}

/**
 * Create task request (multiview to model)
 * files must be array of exactly 4 items: [front, left, back, right]
 */
export interface TripoMultiviewToModelRequest {
  type: 'multiview_to_model';
  files: [
    TripoMultiviewFileInput,  // front (required)
    TripoMultiviewFileInput,  // left
    TripoMultiviewFileInput,  // back
    TripoMultiviewFileInput   // right
  ];
  model_version?: string;
  texture?: boolean;
  pbr?: boolean;
  face_limit?: number;
  texture_quality?: 'standard' | 'detailed';
  auto_size?: boolean;
}

/**
 * Upload image response
 */
export interface TripoUploadResponse {
  code: number;
  data: {
    image_token: string;
  };
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
  type: string; // 'glb', 'obj', etc.
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
    progress: number; // 0-100
    output?: {
      model?: TripoModelOutput;
      rendered_image?: string;
      pbr_model?: TripoModelOutput;
      base_model?: TripoModelOutput;
    };
    create_time: number;
  };
}

/**
 * Tripo API error response
 */
export interface TripoError {
  code: number;
  message: string;
}
