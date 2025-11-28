/**
 * Shared TypeScript types for Dream Forge frontend
 *
 * Optimized for 3D printing workflow:
 * - Quality levels aligned with printing use cases
 * - STL as default output format
 * - Multi-angle image support for better 3D generation
 */

// Print-oriented quality settings
export type QualityLevel = 'draft' | 'standard' | 'fine';
export type OutputFormat = 'glb' | 'obj' | 'fbx' | 'stl' | 'usdz';

// User roles
export type UserRole = 'user' | 'admin';

// View angles for multi-image support
export type ViewAngle = 'front' | 'back' | 'left' | 'right' | 'top';

// Printer type determines material selection
export type PrinterType = 'fdm' | 'sla' | 'resin';

// Input mode for generation
export type InputMode = 'single' | 'multi' | 'ai-generated';

// Credit costs based on input mode
export const CREDIT_COSTS: Record<InputMode, number> = {
  single: 1,
  multi: 1,
  'ai-generated': 2,
};

// View angle display labels
export const VIEW_ANGLE_LABELS: Record<ViewAngle, string> = {
  front: '正面',
  back: '背面',
  left: '左側',
  right: '右側',
  top: '俯視',
};

// Printer type options for UI
export const PRINTER_TYPE_OPTIONS: Record<PrinterType, {
  label: string;
  description: string;
  material: string;
}> = {
  fdm: {
    label: 'FDM',
    description: '熔融沉積成型',
    material: '單色',
  },
  sla: {
    label: 'SLA',
    description: '光固化成型',
    material: '彩色',
  },
  resin: {
    label: 'Resin',
    description: '樹脂列印',
    material: '彩色',
  },
};

// Uploaded image with metadata
export interface UploadedImage {
  url: string;
  angle: ViewAngle;
  file?: File;
  isAiGenerated: boolean;
}

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
  role: UserRole;
  createdAt: Date;
  updatedAt: Date;
}

// Admin types
export interface AdminUser {
  uid: string;
  email: string;
  displayName: string;
  photoURL: string | null;
  credits: number;
  totalGenerated: number;
  role: UserRole;
  createdAt: string | null;
}

export interface AdminStats {
  totalUsers: number;
  jobs: {
    total: number;
    pending: number;
    processing: number;
    completed: number;
    failed: number;
  };
  totalCreditsDistributed: number;
}

export interface RodinBalanceResponse {
  success: boolean;
  balance: number;
  checkedAt: string;
}

export interface AdminStatsResponse {
  success: boolean;
  stats: AdminStats;
  fetchedAt: string;
}

export interface ListUsersResponse {
  success: boolean;
  users: AdminUser[];
  pagination: {
    total: number;
    limit: number;
    offset: number;
    hasMore: boolean;
  };
}

// Job types - Granular status stages for progress tracking
export type JobStatus =
  | 'pending'           // Job queued, waiting to start
  | 'generating-views'  // Gemini generating AI views
  | 'generating-model'  // Rodin API processing
  | 'downloading-model' // Downloading from Rodin API
  | 'uploading-storage' // Uploading to Firebase Storage
  | 'completed'         // Ready to view/download
  | 'failed';           // Error with refund

// Status display messages (Chinese)
export const JOB_STATUS_MESSAGES: Record<JobStatus, string> = {
  'pending': '排隊中...',
  'generating-views': '生成視角中...',
  'generating-model': '生成3D模型中...',
  'downloading-model': '下載模型中...',
  'uploading-storage': '準備下載連結...',
  'completed': '完成',
  'failed': '失敗',
};
export type JobType = 'model' | 'texture';
export type TextureResolution = 'Basic' | 'High';

// Texture generation cost
export const TEXTURE_CREDIT_COST = 0.5;

// Job settings interface
export interface JobSettings {
  tier: 'Gen-2';
  quality: QualityLevel;
  format: OutputFormat;
  printerType: PrinterType;
  inputMode: InputMode;
  imageCount: number;
}

export interface Job {
  id: string;
  userId: string;
  jobType: JobType;
  status: JobStatus;
  inputImageUrl: string;
  inputImageUrls?: string[];
  viewAngles?: ViewAngle[];
  outputModelUrl: string | null;
  settings: JobSettings;
  error: string | null;
  createdAt: Date;
  completedAt: Date | null;
  // Texture generation fields
  sourceJobId?: string;
  textureResolution?: TextureResolution;
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
  imageUrls?: string[];
  viewAngles?: ViewAngle[];
  quality: QualityLevel;
  printerType: PrinterType;
  inputMode: InputMode;
  generateAngles?: ViewAngle[];  // For AI mode
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

// Texture generation types
export interface GenerateTextureRequest {
  sourceJobId: string;          // Job ID of the model to apply texture to
  imageUrl: string;             // Reference image for texture style
  resolution?: TextureResolution;
  format?: OutputFormat;
  prompt?: string;
}

export interface GenerateTextureResponse {
  jobId: string;
  status: JobStatus;
}

// Texture resolution options for UI
export const TEXTURE_RESOLUTION_OPTIONS: Record<TextureResolution, {
  label: string;
  description: string;
  credits: string;
}> = {
  Basic: {
    label: '基本',
    description: '標準解析度貼圖',
    credits: '0.5 credits',
  },
  High: {
    label: '高畫質',
    description: '高解析度 PBR 貼圖',
    credits: '0.5 credits',
  },
};
