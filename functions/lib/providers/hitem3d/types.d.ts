/**
 * HiTem3D API Types
 *
 * Based on: https://docs.hitem3d.ai/en/api/api-reference/
 */
export type HitemModel = 'hitem3dv1' | 'hitem3dv1.5' | 'scene-portraitv1.5';
export type HitemRequestType = 1 | 2 | 3;
export type HitemFormatCode = 1 | 2 | 3 | 4;
export type HitemResolution = 512 | 1024 | 1536 | '1536pro';
export type HitemTaskState = 'created' | 'queueing' | 'processing' | 'success' | 'failed';
/**
 * Token response from authentication
 * POST /open-api/v1/auth/token
 */
export interface HitemTokenResponse {
    code: number | string;
    data?: {
        accessToken: string;
        tokenType: string;
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
        id?: string;
        url?: string;
        cover_url?: string;
    };
    msg: string;
}
/**
 * Quality to resolution mapping
 *
 * Maps DreamForge quality levels to HiTem resolution values.
 */
export declare const HITEM_QUALITY_RESOLUTION: Record<string, HitemResolution>;
/**
 * Quality to face count mapping
 *
 * Maps DreamForge quality levels to HiTem face values.
 * Valid range: 100,000 - 2,000,000
 *
 * Recommended by HiTem docs:
 * - 512³: 500,000
 * - 1024³: 1,000,000
 * - 1536³: 2,000,000
 */
export declare const HITEM_QUALITY_FACE_COUNT: Record<string, number>;
/**
 * Format code mapping
 */
export declare const HITEM_FORMAT_CODE: Record<string, HitemFormatCode>;
/**
 * HiTem3D API base URL
 */
export declare const HITEM_API_BASE = "https://api.hitem3d.ai";
/**
 * Default model version
 */
export declare const HITEM_DEFAULT_MODEL: HitemModel;
/**
 * Token cache TTL in milliseconds (23 hours - 1 hour buffer before 24h expiry)
 */
export declare const HITEM_TOKEN_TTL_MS: number;
/**
 * Error codes from HiTem API
 */
export declare const HITEM_ERROR_CODES: {
    readonly INVALID_CREDENTIALS: "40010000";
    readonly SYSTEM_ERROR: "10000000";
    readonly GENERATE_FAILED: "50010001";
};
