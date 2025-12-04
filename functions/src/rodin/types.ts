/**
 * Rodin Gen-2 API Types
 * Based on Hyper3D API documentation
 *
 * Optimized for 3D printing workflow:
 * - mesh_mode: 'Raw' for triangle meshes (required by slicers)
 * - format: 'stl' as the standard 3D printing format
 */

// Import and re-export provider types for convenience
import type { ProviderType as _ProviderType, ProviderOptions as _ProviderOptions } from '../providers/types';
export type { ProviderType, ProviderOptions } from '../providers/types';

// Local type aliases for internal use
type ProviderType = _ProviderType;
type ProviderOptions = _ProviderOptions;

// Mesh mode determines face type
export type MeshMode = 'Raw' | 'Quad';

// View angles for multi-image support
export type ViewAngle = 'front' | 'back' | 'left' | 'right' | 'top';

// Printer type determines material selection
export type PrinterType = 'fdm' | 'sla' | 'resin';

// Mesh precision for 3D printing optimization
// 'high' = should_remesh: false (preserves original mesh topology)
// 'standard' = should_remesh: true (optimized polycount)
export type MeshPrecision = 'high' | 'standard';

// Input mode for generation
export type InputMode = 'single' | 'multi' | 'ai-generated';

// Material type for Rodin API
export type MaterialType = 'PBR' | 'Shaded';

// Printer type to material mapping
export const PRINTER_MATERIAL_MAP: Record<PrinterType, MaterialType> = {
  fdm: 'Shaded',  // Mono prints don't need PBR textures
  sla: 'PBR',     // SLA supports full-color printing
  resin: 'PBR',   // Resin printers support color
};

// Credit costs based on input mode
export const CREDIT_COSTS: Record<InputMode, number> = {
  single: 1,
  multi: 1,
  'ai-generated': 2,  // Extra cost for Gemini API usage
};

// Print-oriented quality levels (replaces low/medium/high)
export type PrintQuality = 'draft' | 'standard' | 'fine';

// Legacy quality type for backwards compatibility
export type QualityLevel = 'low' | 'medium' | 'high';

// Raw mode face counts optimized for 3D printing
// Raw mode range: 500 - 1,000,000 faces
export const PRINT_QUALITY_FACE_COUNTS: Record<PrintQuality, number> = {
  draft: 50000,     // ~2.5 MB STL - 快速預覽列印
  standard: 150000, // ~7.5 MB STL - 一般 FDM 列印
  fine: 300000,     // ~15 MB STL - 高品質 SLA 列印
};

// Legacy mapping for backwards compatibility
export const QUALITY_FACE_COUNTS: Record<QualityLevel, number> = {
  low: 50000,
  medium: 150000,
  high: 300000,
};

export type OutputFormat = 'glb' | 'obj' | 'fbx' | 'stl' | 'usdz';

export interface GenerateOptions {
  tier: 'Gen-2';
  quality: PrintQuality | QualityLevel;
  format: OutputFormat;
  meshMode: MeshMode;
  printerType?: PrinterType;
  conditionMode?: 'concat';  // For multi-view processing
  prompt?: string;
}

// Texture resolution for texture-only generation
export type TextureResolution = 'Basic' | 'High';

// Options for texture-only generation (after model exists)
export interface GenerateTextureOptions {
  format?: OutputFormat;
  material?: MaterialType;
  resolution?: TextureResolution;
  prompt?: string;
  seed?: number;
  referenceScale?: number;
}

export interface RodinGenerateRequest {
  images: string[]; // Base64 or URLs
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

// API status values (from official docs)
export type RodinTaskStatus = 'Waiting' | 'Generating' | 'Done' | 'Failed';

export interface RodinStatusRequest {
  subscription_key: string;
}

// Updated to match actual API response structure
export interface RodinStatusResponse {
  error?: string;
  jobs: Array<{
    uuid: string;
    status: RodinTaskStatus;
  }>;
}

// New: Separate download endpoint response
export interface RodinDownloadResponse {
  error?: string;
  list: Array<{
    url: string;
    name: string;
  }>;
}

// User roles
export type UserRole = 'user' | 'admin';

// Firestore Document Types
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

// Granular status stages for progress tracking
export type JobStatus =
  | 'pending'           // Job queued, waiting to start
  | 'generating-views'  // Gemini generating AI views
  | 'generating-model'  // Rodin API processing
  | 'downloading-model' // Downloading from Rodin API
  | 'uploading-storage' // Uploading to Firebase Storage
  | 'completed'         // Ready to view/download
  | 'failed';           // Error with refund

// Job type distinguishes model generation from texture generation
export type JobType = 'model' | 'texture';

// Job settings with multi-image support
export interface JobSettings {
  tier: 'Gen-2';
  quality: QualityLevel | PrintQuality;
  format: OutputFormat;
  printerType: PrinterType;
  inputMode: InputMode;
  imageCount: number;
  provider?: import('../providers/types').ProviderType;  // 'rodin' | 'meshy'
}

// Download file from Rodin API
export interface DownloadFile {
  url: string;
  name: string;
}

export interface JobDocument {
  userId: string;
  jobType: JobType;               // 'model' or 'texture'
  status: JobStatus;
  inputImageUrl: string;
  inputImageUrls?: string[];      // All image URLs for multi-view
  viewAngles?: ViewAngle[];       // Corresponding angles
  outputModelUrl: string | null;
  downloadFiles?: DownloadFile[]; // All available download files (GLB, textures, etc.)

  // Provider abstraction fields
  provider?: import('../providers/types').ProviderType;  // 'rodin' | 'meshy'
  providerTaskId?: string;        // Unified task ID
  providerSubscriptionKey?: string; // For Rodin polling

  // Legacy Rodin fields (kept for backwards compatibility)
  rodinTaskId: string;            // Legacy: kept for backwards compat (= taskUuid)
  rodinSubscriptionKey: string;
  rodinTaskUuid?: string;         // Main task UUID (required for download API)
  rodinJobUuids?: string[];       // Individual job UUIDs (for future API features)

  settings: JobSettings;
  error: string | null;
  createdAt: FirebaseFirestore.Timestamp;
  completedAt: FirebaseFirestore.Timestamp | null;
  // Texture generation fields
  sourceJobId?: string;           // For texture jobs: reference to original model job
  textureResolution?: TextureResolution;
  // Download retry tracking
  downloadRetryCount?: number;    // Tracks download API retry attempts
}

export type TransactionType = 'consume' | 'purchase' | 'bonus';

export interface TransactionDocument {
  userId: string;
  type: TransactionType;
  amount: number;
  jobId: string | null;
  sessionId?: string | null;  // For multi-step flow transactions
  createdAt: FirebaseFirestore.Timestamp;
}

// ============================================
// Multi-step Creation Flow Types (Sessions)
// ============================================

// Session status for multi-step creation flow
export type SessionStatus =
  | 'draft'             // Initial state, user is filling in data
  | 'generating-views'  // Gemini is generating AI views
  | 'views-ready'       // Views are ready for preview/edit
  | 'generating-model'  // Rodin is generating 3D model
  | 'completed'         // Model ready
  | 'failed';           // Error occurred

// Credit costs for multi-step flow
export const SESSION_CREDIT_COSTS = {
  VIEW_GENERATION: 1,    // Each view generation attempt
  MODEL_GENERATION: 1,   // 3D model generation
} as const;

// Maximum drafts per user
export const MAX_USER_DRAFTS = 3;

// View image with source tracking
export interface SessionViewImage {
  url: string;
  storagePath: string;
  source: 'ai' | 'upload';
  createdAt: FirebaseFirestore.Timestamp;
}

// Session settings
export interface SessionSettings {
  quality: PrintQuality;
  printerType: PrinterType;
  format: OutputFormat;
}

// Session document structure
export interface SessionDocument {
  userId: string;

  // Status tracking
  status: SessionStatus;
  currentStep: 1 | 2 | 3 | 4 | 5;

  // Step 1: Original image
  originalImage: {
    url: string;
    storagePath: string;
  } | null;

  // User selected angles to generate (Step 1)
  selectedAngles: ViewAngle[];

  // Step 2-3: View images (keyed by angle)
  views: Partial<Record<ViewAngle, SessionViewImage>>;

  // Generation settings
  settings: SessionSettings;

  // Step 4-5: Generated model
  jobId: string | null;

  // Billing tracking
  viewGenerationCount: number;
  totalCreditsUsed: number;

  // Timestamps
  createdAt: FirebaseFirestore.Timestamp;
  updatedAt: FirebaseFirestore.Timestamp;
}

// ============================================
// Pipeline Types (New Simplified Generation Flow)
// ============================================

/**
 * Pipeline Status for new simplified 3D generation workflow
 * Single flow: Upload → Gemini 6 images → Meshy mesh → Optional texture
 */
export type PipelineStatus =
  | 'draft'              // Initial state, user uploading images
  | 'batch-queued'       // Batch job submitted, waiting to process
  | 'batch-processing'   // Batch job running on Gemini
  | 'generating-images'  // Gemini generating 6 views (real-time mode)
  | 'images-ready'       // 6 images ready for preview
  | 'generating-mesh'    // Meshy generating mesh (no texture)
  | 'mesh-ready'         // Mesh complete, texture optional
  | 'generating-texture' // Meshy generating texture
  | 'completed'          // All done
  | 'failed';            // Error occurred

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
export const PIPELINE_CREDIT_COSTS = {
  IMAGE_PROCESSING: 0,   // Gemini processing is free (absorbed cost)
  MESH_GENERATION: 5,    // Meshy mesh-only generation
  TEXTURE_GENERATION: 10, // Meshy texture/retexture
} as const;

/**
 * Processed image from Gemini
 */
export interface PipelineProcessedImage {
  url: string;
  storagePath: string;
  source: 'gemini' | 'upload';  // AI-generated or user-uploaded
  colorPalette?: string[];       // 7 HEX colors for H2C mesh images
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

// ProviderType and ProviderOptions are re-exported from '../providers/types' at the top of this file

/**
 * Pipeline settings
 */
export interface PipelineSettings {
  quality: PrintQuality;
  printerType: PrinterType;
  format: OutputFormat;
  generationMode?: GenerationModeId;
  geminiModel?: 'gemini-3-pro' | 'gemini-2.5-flash';  // Gemini model for image generation
  meshPrecision?: MeshPrecision;  // 'high' = no remesh, 'standard' = remesh (default)
  colorCount?: number;            // Number of colors for analysis (3-12, default: 7)
  provider?: ProviderType;        // 3D generation provider (default: 'meshy')
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

  // Processing mode (realtime or batch)
  processingMode: ProcessingMode;

  // Generation mode for A/B testing
  generationMode: GenerationModeId;

  // Batch processing fields (only if processingMode === 'batch')
  batchJobId?: string;              // Reference to geminiBatchJobs document
  batchProgress?: {
    total: number;                  // 6 (number of views)
    completed: number;              // 0-6
    failed: number;
  };
  estimatedCompletionTime?: FirebaseFirestore.Timestamp;

  // Step 1: User-uploaded input images
  inputImages: Array<{
    url: string;
    storagePath: string;
    uploadedAt: FirebaseFirestore.Timestamp;
  }>;

  // Step 2-3: Gemini-generated images
  // 4 mesh-optimized images (7-color simplified for 3D mesh)
  meshImages: Partial<Record<PipelineMeshAngle, PipelineProcessedImage>>;
  // 2 texture-ready images (full color for texture mapping)
  textureImages: Partial<Record<PipelineTextureAngle, PipelineProcessedImage>>;

  // Aggregated color palette from all mesh views (for texture consistency)
  aggregatedColorPalette?: {
    unified: string[];        // All unique colors, sorted by frequency
    dominantColors: string[]; // Top 7 most frequent colors
  };

  // Real-time generation progress tracking
  generationProgress?: {
    phase: 'mesh-views' | 'texture-views' | 'complete';
    meshViewsCompleted: number;     // 0-4
    textureViewsCompleted: number;  // 0-2
  };

  // Step 4-5: Mesh generation (provider-agnostic)
  providerTaskId?: string;         // Generic task ID for any provider
  meshyMeshTaskId?: string;        // Legacy: Meshy-specific task ID
  meshUrl?: string;
  meshStoragePath?: string;
  meshDownloadFiles?: DownloadFile[];

  // Step 6-7: Meshy texture generation (optional)
  meshyTextureTaskId?: string;
  texturedModelUrl?: string;
  texturedModelStoragePath?: string;
  texturedDownloadFiles?: DownloadFile[];

  // Credit tracking
  creditsCharged: {
    mesh: number;     // 5 when mesh generated
    texture: number;  // 10 when texture generated
  };

  // Regeneration tracking (max 4 per pipeline since credits only charged once)
  regenerationsUsed?: number;

  // Generation settings
  settings: PipelineSettings;

  // User-provided description for better AI generation
  userDescription?: string | null;

  // Pre-analysis results from Gemini (before view generation)
  imageAnalysis?: ImageAnalysisResult;

  // Error handling
  error?: string;
  errorStep?: PipelineStatus;

  // Timestamps
  createdAt: FirebaseFirestore.Timestamp;
  updatedAt: FirebaseFirestore.Timestamp;
  completedAt?: FirebaseFirestore.Timestamp;
}

// ============================================
// Gemini Batch Job Types
// ============================================

/**
 * Batch job status
 */
export type GeminiBatchJobStatus = 'pending' | 'running' | 'succeeded' | 'failed';

/**
 * Individual batch request tracking
 */
export interface GeminiBatchRequest {
  index: number;                       // 0-5 for 6 views
  viewType: 'mesh' | 'texture';
  angle: string;                       // front, back, left, right
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
  // Identity
  pipelineId: string;                  // Reference to parent pipeline
  userId: string;                      // Owner

  // Gemini Batch API fields
  batchJobName: string;                // Gemini operation name for polling
  batchJobStatus: GeminiBatchJobStatus;

  // Request tracking (6 requests per batch)
  requests: GeminiBatchRequest[];

  // Results (populated when complete)
  results: GeminiBatchResult[];

  // Timing
  submittedAt: FirebaseFirestore.Timestamp;
  startedAt?: FirebaseFirestore.Timestamp;
  completedAt?: FirebaseFirestore.Timestamp;
  lastPolledAt?: FirebaseFirestore.Timestamp;

  // Error tracking
  error?: string;
  failedRequestCount: number;

  // Retry tracking
  retryCount: number;
  maxRetries: number;
}

// ============================================
// Image Analysis Types
// ============================================

/**
 * 3D Print friendliness assessment from Gemini analysis
 */
export interface PrintFriendlinessAssessment {
  score: number;                      // 1-5 rating (5 = easiest to print)
  colorSuggestions: string[];         // Color-related suggestions
  structuralConcerns: string[];       // Structural issues (thin walls, overhangs)
  materialRecommendations: string[];  // Material suggestions (PLA, PETG, resin)
  orientationTips: string[];          // Printing orientation recommendations
}

/**
 * Image analysis result from Gemini
 * Used to optimize view generation and Meshy texture prompts
 */
export interface ImageAnalysisResult {
  description: string;                // AI-generated description (includes all materials)
  colorPalette: string[];             // Extracted HEX colors (configurable count)
  detectedMaterials: string[];        // Detected materials (fur, fabric, plastic)
  objectType: string;                 // Object classification (plush toy, figurine)
  printFriendliness: PrintFriendlinessAssessment;
  analyzedAt: FirebaseFirestore.Timestamp;
}
