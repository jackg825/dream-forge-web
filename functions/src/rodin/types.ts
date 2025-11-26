/**
 * Rodin Gen-2 API Types
 * Based on Hyper3D API documentation
 */

// Quality settings map to mesh face counts
export type QualityLevel = 'low' | 'medium' | 'high';

export const QUALITY_FACE_COUNTS: Record<QualityLevel, number> = {
  low: 80000,
  medium: 180000,
  high: 500000,
};

export type OutputFormat = 'glb' | 'obj' | 'fbx' | 'stl';

export interface GenerateOptions {
  tier: 'Gen-2';
  quality: QualityLevel;
  format: OutputFormat;
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

export type RodinTaskStatus = 'Pending' | 'Processing' | 'Done' | 'Failed';

export interface RodinStatusRequest {
  subscription_key: string;
}

export interface RodinStatusResponse {
  status: RodinTaskStatus;
  progress?: number; // 0-100
  result?: {
    model_url: string;
  };
  error?: string;
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
