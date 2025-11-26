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

export type OutputFormat = 'glb' | 'obj' | 'fbx' | 'stl';

export interface GenerateOptions {
  tier: 'Gen-2';
  quality: PrintQuality | QualityLevel;
  format: OutputFormat;
  meshMode: MeshMode;
  prompt?: string;
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

// Firestore Document Types
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
