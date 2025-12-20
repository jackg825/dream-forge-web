/**
 * HiTem3D API Types
 *
 * Based on: https://docs.hitem3d.ai/en/api/api-reference/
 */

// HiTem3D model versions
export type HitemModel = 'hitem3dv1' | 'hitem3dv1.5' | 'scene-portraitv1.5';

// Generation request type
export type HitemRequestType = 1 | 2 | 3; // 1=geometry only, 2=texture only, 3=both

// Output format codes
export type HitemFormatCode = 1 | 2 | 3 | 4; // 1=obj, 2=glb, 3=stl, 4=fbx

// Resolution options
export type HitemResolution = 512 | 1024 | 1536 | '1536pro';

// Task status values from HiTem API
export type HitemTaskState = 'created' | 'queueing' | 'processing' | 'success' | 'failed';

/**
 * Token response from authentication
 * POST /open-api/v1/auth/token
 */
export interface HitemTokenResponse {
  code: number | string;
  data?: {
    accessToken: string;
    tokenType: string;  // "Bearer"
    nonce: string;
  };
  msg: string;
}

/**
 * Create task response
 * POST /open-api/v1/submit-task
 */
export interface HitemCreateTaskResponse {
  code: number | string;
  data?: {
    task_id: string;
  };
  msg: string;
}

/**
 * Query task response
 * GET /open-api/v1/query-task
 */
export interface HitemQueryResponse {
  code: number | string;
  data?: {
    task_id: string;
    state: HitemTaskState;
    id?: string;           // Generated content ID
    url?: string;          // Model download URL (1-hour validity)
    cover_url?: string;    // Thumbnail URL (1-hour validity)
  };
  msg: string;
}

/**
 * Quality to resolution mapping
 *
 * Maps DreamForge quality levels to HiTem resolution values.
 */
export const HITEM_QUALITY_RESOLUTION: Record<string, HitemResolution> = {
  draft: 512,
  standard: 1024,
  fine: 1536,
};

/**
 * Format code mapping
 */
export const HITEM_FORMAT_CODE: Record<string, HitemFormatCode> = {
  obj: 1,
  glb: 2,
  stl: 3,
  fbx: 4,
};

/**
 * HiTem3D API base URL
 */
export const HITEM_API_BASE = 'https://api.hitem3d.ai';

/**
 * Default model version
 */
export const HITEM_DEFAULT_MODEL: HitemModel = 'hitem3dv1.5';

/**
 * Token cache TTL in milliseconds (23 hours - 1 hour buffer before 24h expiry)
 */
export const HITEM_TOKEN_TTL_MS = 23 * 60 * 60 * 1000;

/**
 * Error codes from HiTem API
 */
export const HITEM_ERROR_CODES = {
  INVALID_CREDENTIALS: '40010000',
  SYSTEM_ERROR: '10000000',
  GENERATE_FAILED: '50010001',
} as const;
