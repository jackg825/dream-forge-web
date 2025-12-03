/**
 * Hunyuan 3D API Types
 *
 * Tencent Cloud Hunyuan 3D v3.0 API type definitions.
 * API Domain: ai3d.tencentcloudapi.com
 */
export declare const HUNYUAN_API_HOST = "ai3d.tencentcloudapi.com";
export declare const HUNYUAN_API_VERSION = "2025-05-13";
export declare const HUNYUAN_SERVICE = "ai3d";
/**
 * Submit Hunyuan 3D generation job request
 */
export interface HunyuanSubmitRequest {
    /** Base64-encoded image data (mutually exclusive with ImageUrl) */
    ImageBase64?: string;
    /** Image URL reference (mutually exclusive with ImageBase64) */
    ImageUrl?: string;
    /** Enable PBR material generation (default: false) */
    EnablePBR?: boolean;
    /** Model polygon count: 40000-1500000 (default: 500000) */
    FaceCount?: number;
    /** Generation type: Normal, LowPoly, Geometry, Sketch */
    GenerateType?: 'Normal' | 'LowPoly' | 'Geometry' | 'Sketch';
    /** Polygon type for LowPoly mode: triangle or quad */
    PolygonType?: 'triangle' | 'quad';
    /** Multi-view images array (left, right, back views) */
    MultiViewImages?: Array<{
        ViewType: 'left' | 'right' | 'back';
        ImageBase64: string;
    }>;
}
/**
 * Submit job response
 */
export interface HunyuanSubmitResponse {
    /** Unique job identifier (24-hour validity) */
    JobId: string;
    /** Request tracking identifier */
    RequestId: string;
}
/**
 * Query job status request
 */
export interface HunyuanQueryRequest {
    /** Job ID from submit response */
    JobId: string;
}
/**
 * Hunyuan task status values
 */
export type HunyuanTaskStatus = 'QUEUED' | 'PROCESSING' | 'SUCCEEDED' | 'FAILED';
/**
 * Model output file
 */
export interface HunyuanModelFile {
    /** Download URL */
    Url: string;
    /** File name */
    Name: string;
    /** File format (glb, obj, fbx, etc.) */
    Format: string;
}
/**
 * Query job status response
 */
export interface HunyuanQueryResponse {
    /** Current task status */
    Status: HunyuanTaskStatus;
    /** Progress percentage (0-100) */
    Progress?: number;
    /** Error message if failed */
    ErrorMessage?: string;
    /** Model files when completed */
    ModelFiles?: HunyuanModelFile[];
    /** Thumbnail URL */
    ThumbnailUrl?: string;
    /** PBR texture URLs */
    TextureUrls?: {
        BaseColor?: string;
        Metallic?: string;
        Normal?: string;
        Roughness?: string;
    };
    /** Request tracking identifier */
    RequestId: string;
}
/**
 * Tencent Cloud API error response
 */
export interface TencentCloudError {
    Response: {
        Error: {
            Code: string;
            Message: string;
        };
        RequestId: string;
    };
}
/**
 * Quality to face count mapping
 */
export declare const HUNYUAN_QUALITY_FACE_COUNT: Record<string, number>;
