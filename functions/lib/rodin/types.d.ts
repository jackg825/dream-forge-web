/**
 * Rodin Gen-2 API Types
 * Based on Hyper3D API documentation
 *
 * Optimized for 3D printing workflow:
 * - mesh_mode: 'Raw' for triangle meshes (required by slicers)
 * - format: 'stl' as the standard 3D printing format
 */
export type { ProviderType } from '../providers/types';
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
export type JobStatus = 'pending' | 'generating-views' | 'generating-model' | 'downloading-model' | 'uploading-storage' | 'completed' | 'failed';
export type JobType = 'model' | 'texture';
export interface JobSettings {
    tier: 'Gen-2';
    quality: QualityLevel | PrintQuality;
    format: OutputFormat;
    printerType: PrinterType;
    inputMode: InputMode;
    imageCount: number;
    provider?: import('../providers/types').ProviderType;
}
export interface DownloadFile {
    url: string;
    name: string;
}
export interface JobDocument {
    userId: string;
    jobType: JobType;
    status: JobStatus;
    inputImageUrl: string;
    inputImageUrls?: string[];
    viewAngles?: ViewAngle[];
    outputModelUrl: string | null;
    downloadFiles?: DownloadFile[];
    provider?: import('../providers/types').ProviderType;
    providerTaskId?: string;
    providerSubscriptionKey?: string;
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
    downloadRetryCount?: number;
}
export type TransactionType = 'consume' | 'purchase' | 'bonus';
export interface TransactionDocument {
    userId: string;
    type: TransactionType;
    amount: number;
    jobId: string | null;
    sessionId?: string | null;
    createdAt: FirebaseFirestore.Timestamp;
}
export type SessionStatus = 'draft' | 'generating-views' | 'views-ready' | 'generating-model' | 'completed' | 'failed';
export declare const SESSION_CREDIT_COSTS: {
    readonly VIEW_GENERATION: 1;
    readonly MODEL_GENERATION: 1;
};
export declare const MAX_USER_DRAFTS = 3;
export interface SessionViewImage {
    url: string;
    storagePath: string;
    source: 'ai' | 'upload';
    createdAt: FirebaseFirestore.Timestamp;
}
export interface SessionSettings {
    quality: PrintQuality;
    printerType: PrinterType;
    format: OutputFormat;
}
export interface SessionDocument {
    userId: string;
    status: SessionStatus;
    currentStep: 1 | 2 | 3 | 4 | 5;
    originalImage: {
        url: string;
        storagePath: string;
    } | null;
    selectedAngles: ViewAngle[];
    views: Partial<Record<ViewAngle, SessionViewImage>>;
    settings: SessionSettings;
    jobId: string | null;
    viewGenerationCount: number;
    totalCreditsUsed: number;
    createdAt: FirebaseFirestore.Timestamp;
    updatedAt: FirebaseFirestore.Timestamp;
}
