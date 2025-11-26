/**
 * Shared TypeScript types for Dream Forge frontend
 */

// Quality settings
export type QualityLevel = 'low' | 'medium' | 'high';
export type OutputFormat = 'glb' | 'obj' | 'fbx' | 'stl';

export const QUALITY_OPTIONS: Record<QualityLevel, {
  label: string;
  description: string;
  time: string;
  faces: string;
}> = {
  low: {
    label: 'Quick',
    description: 'Fast generation, basic detail',
    time: '~1 min',
    faces: '80K faces',
  },
  medium: {
    label: 'Balanced',
    description: 'Good quality, reasonable time',
    time: '~3 min',
    faces: '180K faces',
  },
  high: {
    label: 'Premium',
    description: 'Maximum detail and quality',
    time: '~5 min',
    faces: '500K faces',
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
