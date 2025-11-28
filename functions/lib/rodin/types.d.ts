/**
 * Rodin Gen-2 API Types
 * Based on Hyper3D API documentation
 *
 * Optimized for 3D printing workflow:
 * - mesh_mode: 'Raw' for triangle meshes (required by slicers)
 * - format: 'stl' as the standard 3D printing format
 */
export type MeshMode = 'Raw' | 'Quad';
export type ViewAngle = 'front' | 'back' | 'left' | 'right' | 'top';
export type PrinterType = 'fdm' | 'sla' | 'resin';
export type InputMode = 'single' | 'multi' | 'ai-generated';
export type MaterialType = 'PBR' | 'Shaded';
export declare const PRINTER_MATERIAL_MAP: Record<PrinterType, MaterialType>;
export declare const CREDIT_COSTS: Record<InputMode, number>;
export type PrintQuality = 'draft' | 'standard' | 'fine';
export type QualityLevel = 'low' | 'medium' | 'high';
export declare const PRINT_QUALITY_FACE_COUNTS: Record<PrintQuality, number>;
export declare const QUALITY_FACE_COUNTS: Record<QualityLevel, number>;
export type OutputFormat = 'glb' | 'obj' | 'fbx' | 'stl' | 'usdz';
export interface GenerateOptions {
    tier: 'Gen-2';
    quality: PrintQuality | QualityLevel;
    format: OutputFormat;
    meshMode: MeshMode;
    printerType?: PrinterType;
    conditionMode?: 'concat';
    prompt?: string;
}
export type TextureResolution = 'Basic' | 'High';
export interface GenerateTextureOptions {
    format?: OutputFormat;
    material?: MaterialType;
    resolution?: TextureResolution;
    prompt?: string;
    seed?: number;
    referenceScale?: number;
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
export type UserRole = 'user' | 'admin';
export interface UserDocument {
    uid: string;
    email: string;
    displayName: string;
    photoURL: string | null;
    credits: number;
    totalGenerated: number;
    role: UserRole;
    createdAt: FirebaseFirestore.Timestamp;
    updatedAt: FirebaseFirestore.Timestamp;
}
export type JobStatus = 'pending' | 'processing' | 'completed' | 'failed';
export type JobType = 'model' | 'texture';
export interface JobSettings {
    tier: 'Gen-2';
    quality: QualityLevel | PrintQuality;
    format: OutputFormat;
    printerType: PrinterType;
    inputMode: InputMode;
    imageCount: number;
}
export interface JobDocument {
    userId: string;
    jobType: JobType;
    status: JobStatus;
    inputImageUrl: string;
    inputImageUrls?: string[];
    viewAngles?: ViewAngle[];
    outputModelUrl: string | null;
    rodinTaskId: string;
    rodinSubscriptionKey: string;
    rodinTaskUuid?: string;
    rodinJobUuids?: string[];
    settings: JobSettings;
    error: string | null;
    createdAt: FirebaseFirestore.Timestamp;
    completedAt: FirebaseFirestore.Timestamp | null;
    sourceJobId?: string;
    textureResolution?: TextureResolution;
}
export type TransactionType = 'consume' | 'purchase' | 'bonus';
export interface TransactionDocument {
    userId: string;
    type: TransactionType;
    amount: number;
    jobId: string | null;
    createdAt: FirebaseFirestore.Timestamp;
}
