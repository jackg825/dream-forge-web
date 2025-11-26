/**
 * Rodin Gen-2 API Types
 * Based on Hyper3D API documentation
 *
 * Optimized for 3D printing workflow:
 * - mesh_mode: 'Raw' for triangle meshes (required by slicers)
 * - format: 'stl' as the standard 3D printing format
 */
export type MeshMode = 'Raw' | 'Quad';
export type PrintQuality = 'draft' | 'standard' | 'fine';
export type QualityLevel = 'low' | 'medium' | 'high';
export declare const PRINT_QUALITY_FACE_COUNTS: Record<PrintQuality, number>;
export declare const QUALITY_FACE_COUNTS: Record<QualityLevel, number>;
export type OutputFormat = 'glb' | 'obj' | 'fbx' | 'stl';
export interface GenerateOptions {
    tier: 'Gen-2';
    quality: PrintQuality | QualityLevel;
    format: OutputFormat;
    meshMode: MeshMode;
    prompt?: string;
}
export interface RodinGenerateRequest {
    images: string[];
    tier: 'Gen-2';
    material: 'PBR';
    geometry_file_format: OutputFormat;
    quality_override?: number;
    prompt?: string;
}
export interface RodinGenerateResponse {
    uuid: string;
    jobs: {
        uuids: string[];
        subscription_key: string;
    };
}
export type RodinTaskStatus = 'Waiting' | 'Generating' | 'Done' | 'Failed';
export interface RodinStatusRequest {
    subscription_key: string;
}
export interface RodinStatusResponse {
    error?: string;
    jobs: Array<{
        uuid: string;
        status: RodinTaskStatus;
    }>;
}
export interface RodinDownloadResponse {
    error?: string;
    list: Array<{
        url: string;
        name: string;
    }>;
}
export interface UserDocument {
    uid: string;
    email: string;
    displayName: string;
    photoURL: string | null;
    credits: number;
    totalGenerated: number;
    createdAt: FirebaseFirestore.Timestamp;
    updatedAt: FirebaseFirestore.Timestamp;
}
export type JobStatus = 'pending' | 'processing' | 'completed' | 'failed';
export interface JobDocument {
    userId: string;
    status: JobStatus;
    inputImageUrl: string;
    outputModelUrl: string | null;
    rodinTaskId: string;
    rodinSubscriptionKey: string;
    settings: {
        tier: 'Gen-2';
        quality: QualityLevel;
        format: OutputFormat;
    };
    error: string | null;
    createdAt: FirebaseFirestore.Timestamp;
    completedAt: FirebaseFirestore.Timestamp | null;
}
export type TransactionType = 'consume' | 'purchase' | 'bonus';
export interface TransactionDocument {
    userId: string;
    type: TransactionType;
    amount: number;
    jobId: string | null;
    createdAt: FirebaseFirestore.Timestamp;
}
