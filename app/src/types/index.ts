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

// 3D Model Generation Provider
export type ModelProvider = 'rodin' | 'meshy' | 'hunyuan' | 'tripo';

// Provider-specific options
export interface ProviderOptions {
  /** Hunyuan: Face count (40000-1500000) */
  faceCount?: number;
  /** Tripo: Generation mode */
  tripoMode?: 'image_to_model' | 'multiview_to_model';
}

// Credit costs based on input mode
export const CREDIT_COSTS: Record<InputMode, number> = {
  single: 1,
  multi: 1,
  'ai-generated': 2,
};

// Provider capability metadata
export interface ProviderCapability {
  id: ModelProvider;
  label: string;
  description: string;
  badge?: string;
  badgeVariant?: 'default' | 'secondary' | 'destructive' | 'outline';
  estimatedTime: string;
  creditCost: number;
  capabilities: {
    maxPolygons?: string;
    faceCountControl?: boolean;
    multiview?: boolean;
    texturedMesh?: boolean;  // Provider outputs mesh with embedded textures
  };
}

// Provider options for UI (extended with capabilities)
// Credit costs based on: Storage ($0.007) + Gemini ($0.24) + Provider API + 30% margin
// See docs/cost-analysis.md for detailed breakdown
export const PROVIDER_OPTIONS: Record<ModelProvider, ProviderCapability> = {
  meshy: {
    id: 'meshy',
    label: 'Meshy 6',
    description: '快速逼真的 3D 模型',
    badge: '推薦',
    badgeVariant: 'default',
    estimatedTime: '約 2-3 分鐘',
    creditCost: 5,  // API: $0.10 (5 credits) → Total: $0.35
    capabilities: { maxPolygons: '150K', multiview: true },
  },
  hunyuan: {
    id: 'hunyuan',
    label: 'Hunyuan3D v3.0',
    description: '騰訊雲精細多邊形控制',
    badge: '新功能',
    badgeVariant: 'secondary',
    estimatedTime: '約 3-6 分鐘',
    creditCost: 6,  // API: ¥2.40 (~$0.33) → Total: $0.58
    capabilities: { maxPolygons: '1.5M', faceCountControl: true, texturedMesh: true },
  },
  rodin: {
    id: 'rodin',
    label: 'Rodin Gen-2',
    description: 'Hyper3D 高品質模型',
    estimatedTime: '約 3-5 分鐘',
    creditCost: 8,  // API: $0.50 (0.5 credits) → Total: $0.75
    capabilities: { maxPolygons: '300K' },
  },
  tripo: {
    id: 'tripo',
    label: 'Tripo3D v3.0',
    description: '原生多視角支援',
    badge: '推薦',
    badgeVariant: 'default',
    estimatedTime: '約 2-4 分鐘',
    creditCost: 5,  // API: ~$0.16 (estimated) → Total: $0.41
    capabilities: { maxPolygons: '200K', multiview: true, texturedMesh: true },
  },
};

// Hunyuan face count presets for slider UI
export const HUNYUAN_FACE_COUNT_PRESETS = {
  low: { value: 40000, label: '40K', description: '快速預覽' },
  medium: { value: 200000, label: '200K', description: '標準品質' },
  high: { value: 500000, label: '500K', description: '高品質' },
  ultra: { value: 1000000, label: '1M', description: '超精細' },
  max: { value: 1500000, label: '1.5M', description: '最高品質' },
} as const;

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

// ============================================
// Admin Pipeline Regeneration Types
// ============================================

/**
 * Admin action types for audit trail
 */
export type AdminActionType =
  | 'regenerate-image'
  | 'regenerate-mesh'
  | 'regenerate-texture'
  | 'confirm-preview'
  | 'reject-preview'
  | 'change-provider';

/**
 * Admin action record for audit trail
 */
export interface AdminAction {
  adminId: string;
  adminEmail: string;
  actionType: AdminActionType;
  targetField: string;
  provider?: ModelProvider;
  previousValue?: string;
  timestamp: string;
  reason?: string;
}

/**
 * Admin preview data for "preview before overwrite" flow
 */
export interface AdminPreview {
  // Image previews
  meshImages?: Partial<Record<PipelineMeshAngle, PipelineProcessedImage>>;
  textureImages?: Partial<Record<PipelineTextureAngle, PipelineProcessedImage>>;

  // Mesh preview
  meshUrl?: string;
  meshStoragePath?: string;
  meshDownloadFiles?: DownloadFile[];

  // Texture preview
  texturedModelUrl?: string;
  texturedModelStoragePath?: string;
  texturedDownloadFiles?: DownloadFile[];

  // Provider tracking
  provider?: ModelProvider;
  taskId?: string;
  taskStatus?: 'pending' | 'processing' | 'completed' | 'failed';

  // Metadata
  createdAt?: string;
  createdBy?: string;
}

// Admin pipeline with user info
export interface AdminPipeline {
  id: string;
  userId: string;
  userDisplayName: string;
  userEmail: string;
  userPhotoURL: string | null;
  status: PipelineStatus;
  processingMode: ProcessingMode;
  generationMode: GenerationModeId;
  inputImages: Array<{ url: string; storagePath: string; uploadedAt: string }>;
  meshImages: Partial<Record<PipelineMeshAngle, PipelineProcessedImage>>;
  textureImages: Partial<Record<PipelineTextureAngle, PipelineProcessedImage>>;
  meshUrl: string | null;
  texturedModelUrl: string | null;
  creditsCharged: { mesh: number; texture: number };
  settings: PipelineSettings;
  userDescription: string | null;
  error: string | null;
  createdAt: string | null;
  updatedAt: string | null;
  completedAt: string | null;

  // Admin regeneration fields
  adminPreview?: AdminPreview;
  adminActions?: AdminAction[];
}

export interface ListAllPipelinesResponse {
  success: boolean;
  pipelines: AdminPipeline[];
  pagination: {
    total: number;
    limit: number;
    offset: number;
    hasMore: boolean;
  };
}

// Admin transaction types
export type AdminTransactionType = 'consume' | 'purchase' | 'bonus' | 'adjustment';

export interface AdminTransaction {
  id: string;
  userId: string;
  type: AdminTransactionType;
  amount: number;
  jobId: string | null;
  sessionId: string | null;
  pipelineId: string | null;
  reason: string | null;
  adminId: string | null;
  createdAt: string | null;
}

export interface GetUserTransactionsResponse {
  success: boolean;
  transactions: AdminTransaction[];
  pagination: {
    total: number;
    limit: number;
    offset: number;
    hasMore: boolean;
  };
}

// Provider balance types
export interface ProviderBalances {
  rodin: { balance: number | null; error?: string };
  meshy: { balance: number | null; error?: string };
  tripo: { balance: number | null; frozen: number | null; error?: string };
  hunyuan: { status: 'free-tier' };
}

export interface AllProviderBalancesResponse {
  success: boolean;
  balances: ProviderBalances;
  checkedAt: string;
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
  provider?: ModelProvider;
}

// Download file from Rodin API (GLB, textures, etc.)
export interface DownloadFile {
  url: string;
  name: string;
}

// View mode for 3D preview - matches printer type for accurate preview
export type ViewMode = 'clay' | 'textured' | 'wireframe';

export interface Job {
  id: string;
  userId: string;
  jobType: JobType;
  status: JobStatus;
  inputImageUrl: string;
  inputImageUrls?: string[];
  viewAngles?: ViewAngle[];
  outputModelUrl: string | null;
  downloadFiles?: DownloadFile[]; // All available files from provider
  settings: JobSettings;
  error: string | null;
  createdAt: Date;
  completedAt: Date | null;
  // Provider field
  provider?: ModelProvider;
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
  provider?: ModelProvider;       // 'rodin' | 'meshy' (default: 'meshy')
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

// Session status display messages
export const SESSION_STATUS_MESSAGES: Record<SessionStatus, string> = {
  'draft': '草稿',
  'generating-views': '生成視角中...',
  'views-ready': '視角已就緒',
  'generating-model': '生成模型中...',
  'completed': '已完成',
  'failed': '失敗',
};

// Credit costs for multi-step flow
export const SESSION_CREDIT_COSTS = {
  VIEW_GENERATION: 1,    // Each view generation attempt (regardless of angle count)
  MODEL_GENERATION: 1,   // 3D model generation
} as const;

// Maximum drafts per user
export const MAX_USER_DRAFTS = 3;

// View image with source tracking
export interface SessionViewImage {
  url: string;
  storagePath: string;
  source: 'ai' | 'upload';
  createdAt: Date;
}

// Session settings
export interface SessionSettings {
  quality: QualityLevel;
  printerType: PrinterType;
  format: OutputFormat;
}

// Session document structure
export interface Session {
  id: string;
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
  views: Record<ViewAngle, SessionViewImage>;

  // Generation settings
  settings: SessionSettings;

  // Step 4-5: Generated model
  jobId: string | null;
  outputModelUrl: string | null;

  // Billing tracking
  viewGenerationCount: number;
  totalCreditsUsed: number;

  // Timestamps
  createdAt: Date;
  updatedAt: Date;
}

// Session API request/response types
export interface CreateSessionResponse {
  sessionId: string;
  status: SessionStatus;
  currentStep: number;
}

export interface GetSessionResponse {
  session: Session;
}

export interface UpdateSessionRequest {
  sessionId: string;
  originalImageUrl?: string;
  originalStoragePath?: string;
  selectedAngles?: ViewAngle[];
  settings?: Partial<SessionSettings>;
}

export interface GenerateViewsRequest {
  sessionId: string;
  angles: ViewAngle[];
}

export interface GenerateViewsResponse {
  success: boolean;
  views: Record<ViewAngle, SessionViewImage>;
  creditsCharged: number;
}

export interface UploadCustomViewRequest {
  sessionId: string;
  angle: ViewAngle;
  imageUrl: string;
  storagePath: string;
}

export interface StartModelGenerationRequest {
  sessionId: string;
  provider?: ModelProvider;
}

export interface StartModelGenerationResponse {
  jobId: string;
  status: JobStatus;
  creditsCharged: number;
}

// ============================================
// H2C 7-Color Optimization Types
// (For Bambu Lab H2C multi-color printing)
// ============================================

// H2C optimization credit costs
export const H2C_CREDIT_COSTS = {
  OPTIMIZE: 1,    // Each color optimization
  GENERATE: 1,    // 3D model generation (uses existing cost)
} as const;

// H2C workflow step
export type H2CStep = 'upload' | 'optimize' | 'generate';

// H2C optimization status
export type H2COptimizeStatus = 'idle' | 'optimizing' | 'optimized' | 'error';

// H2C step display labels
export const H2C_STEP_LABELS: Record<H2CStep, string> = {
  upload: '上傳照片',
  optimize: '七色優化',
  generate: '生成 3D',
};

// H2C optimization request
export interface H2COptimizeRequest {
  imageUrl: string;
  storagePath?: string;
}

// H2C optimization response
export interface H2COptimizeResponse {
  success: boolean;
  optimizedImageUrl: string;
  optimizedStoragePath: string;
  colorPalette: string[];
  creditsCharged: number;
}

// H2C upload edited image request
export interface H2CUploadEditedRequest {
  imageBase64: string;
  mimeType: string;
}

// H2C upload edited image response
export interface H2CUploadEditedResponse {
  success: boolean;
  imageUrl: string;
  storagePath: string;
}

// ============================================
// Pipeline Types (New Simplified Generation Flow)
// ============================================

/**
 * Generation mode for A/B testing different image processing strategies
 */
export type GenerationModeId = 'simplified-mesh' | 'simplified-texture';

/**
 * Generation mode options for UI display
 */
export const GENERATION_MODE_OPTIONS: Record<GenerationModeId, {
  id: GenerationModeId;
  name: string;
  description: string;
  meshStyle: string;
  textureStyle: string;
}> = {
  'simplified-mesh': {
    id: 'simplified-mesh',
    name: '模式 A: 簡化貼圖',
    description: '網格用圖片保留全彩，貼圖用圖片 6 色簡化',
    meshStyle: '全彩',
    textureStyle: '6 色簡化',
  },
  'simplified-texture': {
    id: 'simplified-texture',
    name: '模式 B: 簡化網格',
    description: '網格用圖片 7 色簡化，貼圖用圖片保留全彩',
    meshStyle: '7 色簡化',
    textureStyle: '全彩',
  },
};

/**
 * Default generation mode
 */
export const DEFAULT_GENERATION_MODE: GenerationModeId = 'simplified-mesh';

/**
 * Gemini model selection for image generation
 * - gemini-3-pro: Higher quality, slower, more expensive
 * - gemini-2.5-flash: Faster, cheaper, good for testing
 */
export type GeminiModelId = 'gemini-3-pro' | 'gemini-2.5-flash';

/**
 * Gemini model options for UI display
 */
export const GEMINI_MODEL_OPTIONS: Record<GeminiModelId, {
  id: GeminiModelId;
  name: string;
  description: string;
  badge?: string;
  estimatedTime: string;
  creditCost: number;
}> = {
  'gemini-3-pro': {
    id: 'gemini-3-pro',
    name: 'Gemini 3.0 Pro',
    description: '高品質圖片生成，適合細節要求高的物件',
    estimatedTime: '約 2-3 分鐘',
    creditCost: 10,
  },
  'gemini-2.5-flash': {
    id: 'gemini-2.5-flash',
    name: 'Gemini 2.5 Flash',
    description: '快速生成，適合快速測試',
    badge: '推薦',
    estimatedTime: '約 1-2 分鐘',
    creditCost: 3,
  },
};

/**
 * Default Gemini model
 */
export const DEFAULT_GEMINI_MODEL: GeminiModelId = 'gemini-2.5-flash';

/**
 * Pipeline status for new simplified workflow
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
 * Default processing mode
 */
export const DEFAULT_PROCESSING_MODE: ProcessingMode = 'batch';

/**
 * Processing mode options for UI
 */
export const PROCESSING_MODE_OPTIONS: Record<ProcessingMode, {
  id: ProcessingMode;
  name: string;
  description: string;
  badge?: string;
  estimatedTime: string;
}> = {
  batch: {
    id: 'batch',
    name: '批次處理',
    description: '成本較低，適合不急用的情況',
    badge: '推薦',
    estimatedTime: '約 5-15 分鐘',
  },
  realtime: {
    id: 'realtime',
    name: '即時處理',
    description: '立即處理，但可能遇到超時錯誤',
    estimatedTime: '約 2-5 分鐘',
  },
};

/**
 * Pipeline status display messages
 */
export const PIPELINE_STATUS_MESSAGES: Record<PipelineStatus, string> = {
  'draft': '草稿',
  'batch-queued': '排隊中...',
  'batch-processing': '批次處理中...',
  'generating-images': '生成視角圖片中...',
  'images-ready': '圖片就緒',
  'generating-mesh': '生成 3D 網格中...',
  'mesh-ready': '網格就緒',
  'generating-texture': '生成貼圖中...',
  'completed': '已完成',
  'failed': '失敗',
};

/**
 * Credit costs for pipeline workflow
 * Total: 5 (mesh) + 10 (texture) = 15 credits max
 */
export const PIPELINE_CREDIT_COSTS = {
  IMAGE_PROCESSING: 0,   // Gemini processing is free
  MESH_GENERATION: 5,    // Meshy mesh-only
  TEXTURE_GENERATION: 10, // Meshy retexture
} as const;

/**
 * Pipeline mesh angle (4 views)
 */
export type PipelineMeshAngle = 'front' | 'back' | 'left' | 'right';

/**
 * Pipeline texture angle (2 views)
 */
export type PipelineTextureAngle = 'front' | 'back';

/**
 * Processed image from Gemini
 */
export interface PipelineProcessedImage {
  url: string;
  storagePath: string;
  source: 'gemini' | 'upload';
  colorPalette?: string[];
  generatedAt: Date;
}

/**
 * Mesh precision for 3D printing optimization
 * - 'high': Preserves original mesh topology (should_remesh=false)
 * - 'standard': Optimizes polycount for printing (should_remesh=true)
 */
export type MeshPrecision = 'high' | 'standard';

/**
 * Mesh precision display options for UI
 */
export const MESH_PRECISION_OPTIONS: Record<MeshPrecision, {
  id: MeshPrecision;
  name: string;
  description: string;
  badge?: string;
}> = {
  standard: {
    id: 'standard',
    name: '標準',
    description: '優化網格密度，適合一般 3D 列印',
    badge: '推薦',
  },
  high: {
    id: 'high',
    name: '高精度',
    description: '保留原始網格細節，檔案較大',
  },
};

/**
 * Default mesh precision
 */
export const DEFAULT_MESH_PRECISION: MeshPrecision = 'standard';

/**
 * Maximum number of image regenerations allowed per pipeline
 * Since credits are only charged once per pipeline, we limit regenerations
 */
export const MAX_REGENERATIONS = 4;

/**
 * Pipeline settings
 */
export interface PipelineSettings {
  quality: QualityLevel;
  printerType: PrinterType;
  format: OutputFormat;
  generationMode?: GenerationModeId;
  geminiModel?: GeminiModelId;    // Gemini model used for image generation
  meshPrecision?: MeshPrecision;  // 'high' = no remesh, 'standard' = remesh (default)
  colorCount?: number;            // Number of colors for analysis (3-12, default: 7)
  provider?: ModelProvider;       // 3D generation provider (default: 'meshy')
  providerOptions?: ProviderOptions;
}

/**
 * Batch progress tracking
 */
export interface BatchProgress {
  total: number;
  completed: number;
  failed: number;
}

/**
 * Pipeline document (frontend version)
 */
export interface Pipeline {
  id: string;
  userId: string;
  status: PipelineStatus;

  // Processing mode: realtime (sequential API) or batch (async Batch API)
  processingMode: ProcessingMode;

  // Batch processing tracking
  batchJobId?: string;
  batchProgress?: BatchProgress;
  estimatedCompletionTime?: Date;

  // Generation mode for A/B testing
  generationMode: GenerationModeId;

  // Input images
  inputImages: Array<{
    url: string;
    storagePath: string;
    uploadedAt: Date;
  }>;

  // Gemini-generated images
  meshImages: Partial<Record<PipelineMeshAngle, PipelineProcessedImage>>;
  textureImages: Partial<Record<PipelineTextureAngle, PipelineProcessedImage>>;

  // Aggregated color palette from mesh views (for texture consistency)
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

  // Meshy mesh generation
  meshyMeshTaskId?: string;
  meshUrl?: string;
  meshStoragePath?: string;
  meshDownloadFiles?: DownloadFile[];

  // Meshy texture generation
  meshyTextureTaskId?: string;
  texturedModelUrl?: string;
  texturedModelStoragePath?: string;
  texturedDownloadFiles?: DownloadFile[];

  // Credits
  creditsCharged: {
    mesh: number;
    texture: number;
  };

  // Regeneration tracking (max 4 per pipeline)
  regenerationsUsed?: number;

  // Settings
  settings: PipelineSettings;

  // User-provided description for better AI generation
  userDescription?: string;

  // Pre-analysis results from Gemini (before view generation)
  imageAnalysis?: ImageAnalysisResult;

  // Error
  error?: string;
  errorStep?: PipelineStatus;

  // Timestamps
  createdAt: Date;
  updatedAt: Date;
  completedAt?: Date;
}

// Pipeline API request/response types
export interface CreatePipelineRequest {
  imageUrls: string[];
  settings?: Partial<PipelineSettings>;
  generationMode?: GenerationModeId;
  processingMode?: ProcessingMode;  // Default: 'batch' (50% cheaper, async)
  userDescription?: string;  // Optional description of the object for better AI generation
}

export interface CreatePipelineResponse {
  pipelineId: string;
  status: PipelineStatus;
}

export interface GeneratePipelineImagesResponse {
  status: PipelineStatus;
  meshImages: Record<PipelineMeshAngle, PipelineProcessedImage>;
  textureImages: Record<PipelineTextureAngle, PipelineProcessedImage>;
}

export interface RegeneratePipelineImageRequest {
  pipelineId: string;
  viewType: 'mesh' | 'texture';
  angle: string;
}

export interface StartPipelineMeshResponse {
  status: PipelineStatus;
  meshyTaskId: string;
  creditsCharged: number;
}

export interface CheckPipelineStatusResponse {
  status: PipelineStatus;
  progress?: number;
  meshUrl?: string;
  texturedModelUrl?: string;
  downloadFiles?: DownloadFile[];
  error?: string;
}

export interface StartPipelineTextureResponse {
  status: PipelineStatus;
  meshyTextureTaskId: string;
  creditsCharged: number;
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
  analyzedAt: Date;
}

/**
 * Request for analyzing an uploaded image
 */
export interface AnalyzeImageRequest {
  imageUrl: string;
  colorCount?: number;      // 3-12, default: 7
  printerType?: PrinterType;
}

/**
 * Response from image analysis
 */
export interface AnalyzeImageResponse {
  analysis: ImageAnalysisResult;
}
