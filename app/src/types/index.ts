/**
 * Shared TypeScript types for Dream Forge frontend
 *
 * Optimized for 3D printing workflow:
 * - Quality levels aligned with printing use cases
 * - STL as default output format
 */

// Print-oriented quality settings
export type QualityLevel = 'draft' | 'standard' | 'fine';
export type OutputFormat = 'glb' | 'obj' | 'fbx' | 'stl';

// 3D Printing optimized quality options
export const QUALITY_OPTIONS: Record<QualityLevel, {
  label: string;
  description: string;
  time: string;
  faces: string;
}> = {
  draft: {
    label: '草稿',
    description: '快速預覽，適合測試列印',
    time: '~1 min',
    faces: '50K faces',
  },
  standard: {
    label: '標準',
    description: '適合 FDM 列印',
    time: '~2 min',
    faces: '150K faces',
  },
  fine: {
    label: '精細',
    description: '適合 SLA 高品質列印',
    time: '~3 min',
    faces: '300K faces',
  },
};

// User types
export interface User {
  uid: string;
  email: string;
  displayName: string;
  photoURL: string | null;
  credits: number;
  totalGenerated: number;
  createdAt: Date;
  updatedAt: Date;
}

// Job types
export type JobStatus = 'pending' | 'processing' | 'completed' | 'failed';

export interface Job {
  id: string;
  userId: string;
  status: JobStatus;
  inputImageUrl: string;
  outputModelUrl: string | null;
  settings: {
    tier: 'Gen-2';
    quality: QualityLevel;
    format: OutputFormat;
  };
  error: string | null;
  createdAt: Date;
  completedAt: Date | null;
}

// Transaction types
export type TransactionType = 'consume' | 'purchase' | 'bonus';

export interface Transaction {
  id: string;
  userId: string;
  type: TransactionType;
  amount: number;
  jobId: string | null;
  createdAt: Date;
}

// API response types
export interface GenerateModelRequest {
  imageUrl: string;
  quality: QualityLevel;
  format?: OutputFormat;
}

export interface GenerateModelResponse {
  jobId: string;
  status: JobStatus;
}

export interface CheckJobStatusResponse {
  status: JobStatus;
  progress?: number;
  outputModelUrl?: string;
  error?: string;
}
