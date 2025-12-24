/**
 * Provider Abstraction Layer Types
 *
 * Defines common interfaces for 3D model generation providers.
 * Supports: Rodin Gen-2, Meshy AI, Hunyuan 3D, Tripo3D, HiTem3D
 */

// Supported 3D generation providers
export type ProviderType = 'rodin' | 'meshy' | 'hunyuan' | 'tripo' | 'hitem3d';

// Unified status values across all providers
export type ProviderTaskStatus = 'pending' | 'processing' | 'completed' | 'failed';

// Quality levels (mapped to provider-specific values)
export type ProviderQuality = 'draft' | 'standard' | 'fine';

// Output formats supported across providers
export type ProviderOutputFormat = 'glb' | 'obj' | 'fbx' | 'stl' | 'usdz';

/**
 * Provider-specific options for Hunyuan 3D
 */
export interface HunyuanOptions {
  faceCount?: number;      // 40000-1500000 polygons
  generateType?: 'image' | 'multiview';
}

/**
 * Provider-specific options for Tripo3D
 */
export interface TripoOptions {
  mode?: 'image_to_model' | 'multiview_to_model';
}

/**
 * Provider-specific options for HiTem3D
 */
export interface Hitem3DOptions {
  resolution?: 512 | 1024 | 1536 | '1536pro';
  model?: 'hitem3dv1' | 'hitem3dv1.5' | 'scene-portraitv1.5';
}

/**
 * Container for all provider-specific options (nested format for API calls)
 */
export interface ProviderSpecificOptions {
  hunyuan?: HunyuanOptions;
  tripo?: TripoOptions;
  hitem3d?: Hitem3DOptions;
}

/**
 * Flat provider options (user-facing format from frontend)
 */
export interface ProviderOptions {
  /** Hunyuan: Face count (40000-1500000) */
  faceCount?: number;
  /** Tripo: Generation mode */
  tripoMode?: 'image_to_model' | 'multiview_to_model';
  /** HiTem3D: Output resolution (512, 1024) */
  resolution?: 512 | 1024;
}

/**
 * Unified generation options (provider-agnostic)
 */
export interface GenerationOptions {
  quality: ProviderQuality;
  format: ProviderOutputFormat;
  enableTexture?: boolean;
  enablePBR?: boolean;
  prompt?: string;
  providerOptions?: ProviderSpecificOptions;
}

/**
 * @deprecated Use GenerationOptions instead (now includes providerOptions)
 */
export type ExtendedGenerationOptions = GenerationOptions;

/**
 * Provider capabilities for UI introspection
 */
export interface ProviderCapabilities {
  supportsMultiView: boolean;
  supportsPBR: boolean;
  minFaceCount?: number;
  maxFaceCount?: number;
  supportedFormats: ProviderOutputFormat[];
  estimatedTime: Record<ProviderQuality, string>;
}

/**
 * Result of starting a generation task
 */
export interface GenerationTaskResult {
  taskId: string;
  subscriptionKey?: string; // Rodin-specific (for status polling)
  jobUuids?: string[];      // Rodin-specific (individual job UUIDs)
}

/**
 * Result of checking task status
 */
export interface TaskStatusResult {
  status: ProviderTaskStatus;
  progress?: number;  // 0-100 (Meshy provides this)
  error?: string;
  jobUuid?: string;   // Rodin-specific
}

/**
 * Downloadable file from completed task
 */
export interface DownloadableFile {
  url: string;
  name: string;
  format: string;
}

/**
 * Result of getting download URLs
 */
export interface DownloadResult {
  files: DownloadableFile[];
  thumbnailUrl?: string;
  textureUrls?: {
    baseColor?: string;
    metallic?: string;
    normal?: string;
    roughness?: string;
  };
}

/**
 * Core interface that all providers must implement
 */
export interface I3DProvider {
  readonly providerType: ProviderType;

  /**
   * Generate 3D model from single image
   */
  generateFromImage(
    imageBuffer: Buffer,
    options: GenerationOptions
  ): Promise<GenerationTaskResult>;

  /**
   * Generate 3D model from multiple images
   */
  generateFromMultipleImages(
    imageBuffers: Buffer[],
    options: GenerationOptions
  ): Promise<GenerationTaskResult>;

  /**
   * Check status of a generation task
   * @param taskId - Primary task identifier
   * @param subscriptionKey - Optional polling key (Rodin)
   */
  checkStatus(
    taskId: string,
    subscriptionKey?: string
  ): Promise<TaskStatusResult>;

  /**
   * Get download URLs for completed task
   * @param taskId - Primary task identifier
   * @param requiredFormat - Wait for specific format
   */
  getDownloadUrls(
    taskId: string,
    requiredFormat?: string
  ): Promise<DownloadResult>;

  /**
   * Download model file from URL
   */
  downloadModel(url: string): Promise<Buffer>;

  /**
   * Get supported output formats
   */
  getSupportedFormats(): ProviderOutputFormat[];

  /**
   * Get provider capabilities for UI introspection
   */
  getCapabilities(): ProviderCapabilities;

  /**
   * Check API credit balance (optional)
   */
  checkBalance?(): Promise<number>;
}
