/**
 * Rodin Gen-2 API Types
 * Based on Hyper3D API documentation
 *
 * Optimized for 3D printing workflow:
 * - mesh_mode: 'Raw' for triangle meshes (required by slicers)
 * - format: 'stl' as the standard 3D printing format
 */

// Mesh mode determines face type
export type MeshMode = 'Raw' | 'Quad';

// View angles for multi-image support
export type ViewAngle = 'front' | 'back' | 'left' | 'right' | 'top';

// Printer type determines material selection
export type PrinterType = 'fdm' | 'sla' | 'resin';

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
}

export type TransactionType = 'consume' | 'purchase' | 'bonus';

export interface TransactionDocument {
  userId: string;
  type: TransactionType;
  amount: number;
  jobId: string | null;
  createdAt: FirebaseFirestore.Timestamp;
}
