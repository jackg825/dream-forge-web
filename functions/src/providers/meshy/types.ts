/**
 * Meshy AI API Types
 *
 * Based on: https://docs.meshy.ai/en/api/image-to-3d
 */

// Meshy AI model versions
export type MeshyModel = 'meshy-4' | 'meshy-5' | 'latest';

// Mesh topology options
export type MeshyTopology = 'quad' | 'triangle';

// Symmetry mode options
export type MeshySymmetryMode = 'off' | 'auto' | 'on';

// Task status values from Meshy API
export type MeshyStatus = 'PENDING' | 'IN_PROGRESS' | 'SUCCEEDED' | 'FAILED' | 'CANCELED';

/**
 * Request body for single image-to-3D
 * POST /openapi/v1/image-to-3d
 */
export interface MeshyImageTo3DRequest {
  image_url: string;              // URL or base64 data URI
  ai_model?: MeshyModel;          // Default: 'latest' (meshy-6)
  topology?: MeshyTopology;       // Default: 'triangle'
  target_polycount?: number;      // 100-300,000, default 30,000
  symmetry_mode?: MeshySymmetryMode;
  should_remesh?: boolean;        // Default: true
  should_texture?: boolean;       // Default: true
  enable_pbr?: boolean;           // Generate PBR maps
  texture_prompt?: string;        // Max 600 chars
  moderation?: boolean;           // Screen for harmful content
}

/**
 * Request body for multi-image-to-3D
 * POST /openapi/v1/multi-image-to-3d
 */
export interface MeshyMultiImageTo3DRequest {
  image_urls: string[];           // 1-4 images
  ai_model?: MeshyModel;          // meshy-5 for mesh generation
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
  result: string;  // Task ID
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
  progress: number;               // 0-100
  model_urls?: MeshyModelUrls;
  texture_urls?: MeshyTextureUrls;
  thumbnail_url?: string;
  created_at: number;             // Unix timestamp
  started_at?: number;
  finished_at?: number;
  expires_at?: number;            // 3 days for standard users
  task_error?: { message: string };
}

/**
 * Quality to polycount mapping
 *
 * Maps DreamForge quality levels to Meshy polycount values.
 * Meshy supports 100-300,000 polycounts.
 */
export const MESHY_QUALITY_POLYCOUNT: Record<string, number> = {
  draft: 30000,      // Fast preview
  standard: 100000,  // Balanced quality
  fine: 200000,      // High detail
  // Legacy mappings
  low: 30000,
  medium: 100000,
  high: 200000,
};

/**
 * Meshy API base URL
 */
export const MESHY_API_BASE = 'https://api.meshy.ai/openapi/v1';

// ============================================
// Retexture API Types
// ============================================

/**
 * Request body for retexture task
 * POST /openapi/v1/retexture
 *
 * Requires one of: input_task_id OR model_url
 * Requires one of: text_style_prompt OR image_style_url
 */
export interface MeshyRetextureRequest {
  // Model source (choose one)
  input_task_id?: string;           // Task ID from completed mesh generation
  model_url?: string;               // URL or base64 data URI of 3D model

  // Texture reference (choose one)
  text_style_prompt?: string;       // Text description (max 600 chars)
  image_style_url?: string;         // Reference image URL or base64 data URI

  // Optional settings
  ai_model?: MeshyModel;            // Default: 'latest'
  enable_original_uv?: boolean;     // Preserve existing UV mapping, default true
  enable_pbr?: boolean;             // Generate PBR maps, default false
}

/**
 * Retexture task response
 * GET /openapi/v1/retexture/:id
 */
export interface MeshyRetextureResponse {
  id: string;
  status: MeshyStatus;
  progress: number;                 // 0-100
  model_urls?: MeshyModelUrls;
  texture_urls?: MeshyTextureUrls[];  // Array of texture sets
  thumbnail_url?: string;
  created_at: number;
  started_at?: number;
  finished_at?: number;
  expires_at?: number;
  task_error?: { message: string };
}
