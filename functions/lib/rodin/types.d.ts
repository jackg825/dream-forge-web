/**
 * Rodin Gen-2 API Types
 * Based on Hyper3D API documentation
 *
 * Optimized for 3D printing workflow:
 * - mesh_mode: 'Raw' for triangle meshes (required by slicers)
 * - format: 'stl' as the standard 3D printing format
 */
import type { ProviderType as _ProviderType, ProviderOptions as _ProviderOptions } from '../providers/types';
export type { ProviderType, ProviderOptions } from '../providers/types';
type ProviderType = _ProviderType;
type ProviderOptions = _ProviderOptions;
export type MeshMode = 'Raw' | 'Quad';
export type ViewAngle = 'front' | 'back' | 'left' | 'right' | 'top';
export type PrinterType = 'fdm' | 'sla' | 'resin';
export type MeshPrecision = 'high' | 'standard';
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
/**
 * Pipeline Status for new simplified 3D generation workflow
 * Single flow: Upload → Gemini 6 images → Meshy mesh → Optional texture
 */
export type PipelineStatus = 'draft' | 'batch-queued' | 'batch-processing' | 'generating-images' | 'images-ready' | 'generating-mesh' | 'mesh-ready' | 'generating-texture' | 'completed' | 'failed';
/**
 * Processing mode for image generation
 * - realtime: Sequential Gemini API calls (faster but less reliable)
 * - batch: Gemini Batch API (50% cheaper, async, more reliable)
 */
export type ProcessingMode = 'realtime' | 'batch';
/**
 * Credit costs for pipeline workflow
 * Total: 5 (mesh) + 10 (texture) = 15 credits max
 */
export declare const PIPELINE_CREDIT_COSTS: {
    readonly IMAGE_PROCESSING: 0;
    readonly MESH_GENERATION: 5;
    readonly TEXTURE_GENERATION: 10;
};
/**
 * Processed image from Gemini
 */
export interface PipelineProcessedImage {
    url: string;
    storagePath: string;
    source: 'gemini' | 'upload';
    colorPalette?: string[];
    generatedAt: FirebaseFirestore.Timestamp;
}
/**
 * View types for pipeline images
 */
export type PipelineMeshAngle = 'front' | 'back' | 'left' | 'right';
export type PipelineTextureAngle = 'front' | 'back';
/**
 * Generation mode for A/B testing different image processing strategies
 */
export type GenerationModeId = 'simplified-mesh' | 'simplified-texture';
/**
 * Pipeline settings
 */
export interface PipelineSettings {
    quality: PrintQuality;
    printerType: PrinterType;
    format: OutputFormat;
    generationMode?: GenerationModeId;
    meshPrecision?: MeshPrecision;
    colorCount?: number;
    provider?: ProviderType;
    providerOptions?: ProviderOptions;
}
/**
 * Pipeline document for new simplified 3D generation workflow
 *
 * Flow:
 * 1. User uploads 1+ images
 * 2. Gemini generates 6 images:
 *    - 4 mesh-optimized (7-color H2C style) for front/back/left/right
 *    - 2 texture-ready (full color) for front/back
 * 3. User previews images, can regenerate individual views
 * 4. Meshy Multi-Image-to-3D generates mesh (5 credits)
 * 5. User previews mesh
 * 6. Optional: Meshy Retexture generates texture (10 credits)
 * 7. Final model ready with download options
 */
export interface PipelineDocument {
    userId: string;
    status: PipelineStatus;
    processingMode: ProcessingMode;
    generationMode: GenerationModeId;
    batchJobId?: string;
    batchProgress?: {
        total: number;
        completed: number;
        failed: number;
    };
    estimatedCompletionTime?: FirebaseFirestore.Timestamp;
    inputImages: Array<{
        url: string;
        storagePath: string;
        uploadedAt: FirebaseFirestore.Timestamp;
    }>;
    meshImages: Partial<Record<PipelineMeshAngle, PipelineProcessedImage>>;
    textureImages: Partial<Record<PipelineTextureAngle, PipelineProcessedImage>>;
    aggregatedColorPalette?: {
        unified: string[];
        dominantColors: string[];
    };
    generationProgress?: {
        phase: 'mesh-views' | 'texture-views' | 'complete';
        meshViewsCompleted: number;
        textureViewsCompleted: number;
    };
    providerTaskId?: string;
    meshyMeshTaskId?: string;
    meshUrl?: string;
    meshStoragePath?: string;
    meshDownloadFiles?: DownloadFile[];
    meshyTextureTaskId?: string;
    texturedModelUrl?: string;
    texturedModelStoragePath?: string;
    texturedDownloadFiles?: DownloadFile[];
    creditsCharged: {
        mesh: number;
        texture: number;
    };
    settings: PipelineSettings;
    userDescription?: string | null;
    imageAnalysis?: ImageAnalysisResult;
    error?: string;
    errorStep?: PipelineStatus;
    createdAt: FirebaseFirestore.Timestamp;
    updatedAt: FirebaseFirestore.Timestamp;
    completedAt?: FirebaseFirestore.Timestamp;
}
/**
 * Batch job status
 */
export type GeminiBatchJobStatus = 'pending' | 'running' | 'succeeded' | 'failed';
/**
 * Individual batch request tracking
 */
export interface GeminiBatchRequest {
    index: number;
    viewType: 'mesh' | 'texture';
    angle: string;
    prompt: string;
    status: 'pending' | 'processing' | 'completed' | 'failed';
}
/**
 * Individual batch result
 */
export interface GeminiBatchResult {
    index: number;
    viewType: 'mesh' | 'texture';
    angle: string;
    status: 'success' | 'failed';
    imageBase64?: string;
    mimeType?: string;
    colorPalette?: string[];
    storagePath?: string;
    storageUrl?: string;
    error?: string;
}
/**
 * Gemini Batch Job document
 *
 * Stored in the 'geminiBatchJobs' collection.
 * Tracks the state of a batch image generation job.
 */
export interface GeminiBatchJobDocument {
    pipelineId: string;
    userId: string;
    batchJobName: string;
    batchJobStatus: GeminiBatchJobStatus;
    requests: GeminiBatchRequest[];
    results: GeminiBatchResult[];
    submittedAt: FirebaseFirestore.Timestamp;
    startedAt?: FirebaseFirestore.Timestamp;
    completedAt?: FirebaseFirestore.Timestamp;
    lastPolledAt?: FirebaseFirestore.Timestamp;
    error?: string;
    failedRequestCount: number;
    retryCount: number;
    maxRetries: number;
}
/**
 * 3D Print friendliness assessment from Gemini analysis
 */
export interface PrintFriendlinessAssessment {
    score: number;
    colorSuggestions: string[];
    structuralConcerns: string[];
    materialRecommendations: string[];
    orientationTips: string[];
}
/**
 * Image analysis result from Gemini
 * Used to optimize view generation and Meshy texture prompts
 */
export interface ImageAnalysisResult {
    description: string;
    colorPalette: string[];
    detectedMaterials: string[];
    objectType: string;
    printFriendliness: PrintFriendlinessAssessment;
    analyzedAt: FirebaseFirestore.Timestamp;
}
