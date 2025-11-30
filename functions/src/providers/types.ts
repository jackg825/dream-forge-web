/**
 * Provider Abstraction Layer Types
 *
 * Defines common interfaces for 3D model generation providers.
 * Currently supports: Rodin Gen-2, Meshy AI
 */

// Supported 3D generation providers
export type ProviderType = 'rodin' | 'meshy';

// Unified status values across all providers
export type ProviderTaskStatus = 'pending' | 'processing' | 'completed' | 'failed';

// Quality levels (mapped to provider-specific values)
export type ProviderQuality = 'draft' | 'standard' | 'fine';

// Output formats supported across providers
export type ProviderOutputFormat = 'glb' | 'obj' | 'fbx' | 'stl' | 'usdz';

/**
 * Unified generation options (provider-agnostic)
 */
export interface GenerationOptions {
  quality: ProviderQuality;
  format: ProviderOutputFormat;
  enableTexture?: boolean;
  enablePBR?: boolean;
  prompt?: string;
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
   * Check API credit balance (optional)
   */
  checkBalance?(): Promise<number>;
}
