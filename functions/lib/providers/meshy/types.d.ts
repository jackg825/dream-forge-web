/**
 * Meshy AI API Types
 *
 * Based on: https://docs.meshy.ai/en/api/image-to-3d
 */
export type MeshyModel = 'meshy-4' | 'meshy-5' | 'latest';
export type MeshyTopology = 'quad' | 'triangle';
export type MeshySymmetryMode = 'off' | 'auto' | 'on';
export type MeshyStatus = 'PENDING' | 'IN_PROGRESS' | 'SUCCEEDED' | 'FAILED' | 'CANCELED';
/**
 * Request body for single image-to-3D
 * POST /openapi/v1/image-to-3d
 */
export interface MeshyImageTo3DRequest {
    image_url: string;
    ai_model?: MeshyModel;
    topology?: MeshyTopology;
    target_polycount?: number;
    symmetry_mode?: MeshySymmetryMode;
    should_remesh?: boolean;
    should_texture?: boolean;
    enable_pbr?: boolean;
    texture_prompt?: string;
    moderation?: boolean;
}
/**
 * Request body for multi-image-to-3D
 * POST /openapi/v1/multi-image-to-3d
 */
export interface MeshyMultiImageTo3DRequest {
    image_urls: string[];
    ai_model?: MeshyModel;
    topology?: MeshyTopology;
    target_polycount?: number;
    should_remesh?: boolean;
    should_texture?: boolean;
    enable_pbr?: boolean;
}
/**
 * Response from creating a task
 */
export interface MeshyCreateTaskResponse {
    result: string;
}
/**
 * Model URLs in task response
 */
export interface MeshyModelUrls {
    glb?: string;
    fbx?: string;
    obj?: string;
    usdz?: string;
    mtl?: string;
}
/**
 * Texture URLs in task response (when PBR enabled)
 */
export interface MeshyTextureUrls {
    base_color?: string;
    metallic?: string;
    normal?: string;
    roughness?: string;
}
/**
 * Full task response from status check
 * GET /openapi/v1/image-to-3d/:id
 */
export interface MeshyTaskResponse {
    id: string;
    status: MeshyStatus;
    progress: number;
    model_urls?: MeshyModelUrls;
    texture_urls?: MeshyTextureUrls;
    thumbnail_url?: string;
    created_at: number;
    started_at?: number;
    finished_at?: number;
    expires_at?: number;
    task_error?: {
        message: string;
    };
}
/**
 * Quality to polycount mapping
 *
 * Maps DreamForge quality levels to Meshy polycount values.
 * Meshy supports 100-300,000 polycounts.
 */
export declare const MESHY_QUALITY_POLYCOUNT: Record<string, number>;
/**
 * Meshy API base URL
 */
export declare const MESHY_API_BASE = "https://api.meshy.ai/openapi/v1";
/**
 * Request body for retexture task
 * POST /openapi/v1/retexture
 *
 * Requires one of: input_task_id OR model_url
 * Requires one of: text_style_prompt OR image_style_url
 */
export interface MeshyRetextureRequest {
    input_task_id?: string;
    model_url?: string;
    text_style_prompt?: string;
    image_style_url?: string;
    ai_model?: MeshyModel;
    enable_original_uv?: boolean;
    enable_pbr?: boolean;
}
/**
 * Retexture task response
 * GET /openapi/v1/retexture/:id
 */
export interface MeshyRetextureResponse {
    id: string;
    status: MeshyStatus;
    progress: number;
    model_urls?: MeshyModelUrls;
    texture_urls?: MeshyTextureUrls[];
    thumbnail_url?: string;
    created_at: number;
    started_at?: number;
    finished_at?: number;
    expires_at?: number;
    task_error?: {
        message: string;
    };
}
