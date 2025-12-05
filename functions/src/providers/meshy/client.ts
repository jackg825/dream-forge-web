/**
 * Meshy AI Provider
 *
 * Implements I3DProvider interface for Meshy AI API.
 * Uses meshy-6 (latest) by default for highest quality.
 *
 * API Docs: https://docs.meshy.ai/en/api/image-to-3d
 */

import axios, { AxiosError } from 'axios';
import * as functions from 'firebase-functions';
import type {
  I3DProvider,
  ProviderType,
  ProviderOutputFormat,
  ProviderCapabilities,
  GenerationOptions,
  GenerationTaskResult,
  TaskStatusResult,
  DownloadResult,
} from '../types';
import type { MeshPrecision } from '../../rodin/types';

/**
 * Extended generation options with mesh precision for 3D printing
 */
export interface MeshGenerationOptions extends GenerationOptions {
  precision?: MeshPrecision;  // 'high' = no remesh, 'standard' = remesh (default)
}
import type { MeshyTaskResponse, MeshyCreateTaskResponse } from './types';
import { MESHY_API_BASE, MESHY_QUALITY_POLYCOUNT } from './types';
import { mapMeshyTaskStatus, extractMeshyDownloads } from './mapper';

export class MeshyProvider implements I3DProvider {
  readonly providerType: ProviderType = 'meshy';
  private apiKey: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  /**
   * Generate 3D model from single image
   */
  async generateFromImage(
    imageBuffer: Buffer,
    options: GenerationOptions
  ): Promise<GenerationTaskResult> {
    try {
      // Convert buffer to base64 data URI
      const base64 = imageBuffer.toString('base64');
      const dataUri = `data:image/png;base64,${base64}`;

      const polycount = MESHY_QUALITY_POLYCOUNT[options.quality] || 100000;

      functions.logger.info('Starting Meshy single-image generation', {
        quality: options.quality,
        polycount,
        format: options.format,
        enableTexture: options.enableTexture,
        enablePBR: options.enablePBR,
      });

      const response = await axios.post<MeshyCreateTaskResponse>(
        `${MESHY_API_BASE}/image-to-3d`,
        {
          image_url: dataUri,
          ai_model: 'latest',  // meshy-6
          topology: 'triangle',
          target_polycount: polycount,
          should_remesh: true,
          should_texture: options.enableTexture ?? true,
          enable_pbr: options.enablePBR ?? false,
          texture_prompt: options.prompt,
        },
        {
          headers: {
            Authorization: `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json',
          },
          timeout: 60000,  // 60s for base64 upload
        }
      );

      const taskId = response.data.result;

      functions.logger.info('Meshy generation started', {
        taskId,
        quality: options.quality,
        format: options.format,
      });

      return { taskId };
    } catch (error) {
      this.handleError(error, 'generateFromImage');
    }
  }

  /**
   * Generate 3D model from multiple images
   *
   * Meshy supports 1-4 images for multi-image mode.
   * Uses meshy-5 for mesh generation (required for multi-image).
   */
  async generateFromMultipleImages(
    imageBuffers: Buffer[],
    options: GenerationOptions
  ): Promise<GenerationTaskResult> {
    try {
      // Meshy supports max 4 images
      const limitedBuffers = imageBuffers.slice(0, 4);

      // Convert buffers to base64 data URIs
      const imageUrls = limitedBuffers.map((buffer) => {
        const base64 = buffer.toString('base64');
        return `data:image/png;base64,${base64}`;
      });

      const polycount = MESHY_QUALITY_POLYCOUNT[options.quality] || 100000;

      functions.logger.info('Starting Meshy multi-image generation', {
        imageCount: imageUrls.length,
        quality: options.quality,
        polycount,
        format: options.format,
      });

      // For multi-image, use the appropriate endpoint
      const endpoint = imageUrls.length > 1
        ? `${MESHY_API_BASE}/multi-image-to-3d`
        : `${MESHY_API_BASE}/image-to-3d`;

      const requestBody = imageUrls.length > 1
        ? {
            image_urls: imageUrls,
            ai_model: 'meshy-5',  // Multi-image requires meshy-5 for mesh
            topology: 'triangle',
            target_polycount: polycount,
            should_remesh: true,
            should_texture: options.enableTexture ?? true,
            enable_pbr: options.enablePBR ?? false,
          }
        : {
            image_url: imageUrls[0],
            ai_model: 'latest',
            topology: 'triangle',
            target_polycount: polycount,
            should_remesh: true,
            should_texture: options.enableTexture ?? true,
            enable_pbr: options.enablePBR ?? false,
            texture_prompt: options.prompt,
          };

      const response = await axios.post<MeshyCreateTaskResponse>(
        endpoint,
        requestBody,
        {
          headers: {
            Authorization: `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json',
          },
          timeout: 60000,
        }
      );

      const taskId = response.data.result;

      functions.logger.info('Meshy multi-image generation started', {
        taskId,
        imageCount: imageUrls.length,
      });

      return { taskId };
    } catch (error) {
      this.handleError(error, 'generateFromMultipleImages');
    }
  }

  /**
   * Generate 3D mesh only (no texture) from multiple images
   *
   * Used for the new pipeline workflow where texture is generated separately.
   * This costs 5 credits (mesh-only) vs 15 credits (with texture).
   *
   * Supports mesh precision option for 3D printing optimization:
   * - 'high' precision: should_remesh=false (preserves original mesh topology)
   * - 'standard' precision: should_remesh=true (optimizes polycount)
   *
   * @param imageBuffers - Array of image buffers (max 4)
   * @param options - Generation options (quality, format, precision)
   * @returns Task ID for polling
   */
  async generateMeshOnly(
    imageBuffers: Buffer[],
    options: MeshGenerationOptions
  ): Promise<GenerationTaskResult> {
    try {
      // Meshy supports max 4 images
      const limitedBuffers = imageBuffers.slice(0, 4);

      // Convert buffers to base64 data URIs
      const imageUrls = limitedBuffers.map((buffer) => {
        const base64 = buffer.toString('base64');
        return `data:image/png;base64,${base64}`;
      });

      // Determine remesh settings based on precision
      // 'high' = preserve original mesh (no remesh), 'standard' = optimize polycount
      const shouldRemesh = options.precision !== 'high';
      const polycount = shouldRemesh
        ? (MESHY_QUALITY_POLYCOUNT[options.quality] || 100000)
        : undefined;

      functions.logger.info('Starting Meshy mesh-only generation', {
        imageCount: imageUrls.length,
        quality: options.quality,
        precision: options.precision || 'standard',
        shouldRemesh,
        polycount,
        format: options.format,
        shouldTexture: false, // Key difference: no texture
      });

      // For multi-image, use the appropriate endpoint
      const endpoint = imageUrls.length > 1
        ? `${MESHY_API_BASE}/multi-image-to-3d`
        : `${MESHY_API_BASE}/image-to-3d`;

      const requestBody = imageUrls.length > 1
        ? {
            image_urls: imageUrls,
            ai_model: 'meshy-5',
            topology: 'triangle',
            ...(polycount && { target_polycount: polycount }),
            should_remesh: shouldRemesh,
            should_texture: false, // KEY: No texture generation
            enable_pbr: false,
          }
        : {
            image_url: imageUrls[0],
            ai_model: 'latest',
            topology: 'triangle',
            ...(polycount && { target_polycount: polycount }),
            should_remesh: shouldRemesh,
            should_texture: false, // KEY: No texture generation
            enable_pbr: false,
          };

      const response = await axios.post<MeshyCreateTaskResponse>(
        endpoint,
        requestBody,
        {
          headers: {
            Authorization: `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json',
          },
          timeout: 60000,
        }
      );

      const taskId = response.data.result;

      functions.logger.info('Meshy mesh-only generation started', {
        taskId,
        imageCount: imageUrls.length,
      });

      return { taskId };
    } catch (error) {
      this.handleError(error, 'generateMeshOnly');
    }
  }

  /**
   * Generate 3D mesh only from image URLs (no upload needed)
   *
   * Passes R2/storage URLs directly to Meshy API, avoiding timeout issues
   * from downloading and re-uploading images.
   *
   * @param imageUrls - Array of image URLs (max 4)
   * @param options - Generation options (quality, format, precision)
   * @returns Task ID for polling
   */
  async generateMeshOnlyFromUrls(
    imageUrls: string[],
    options: MeshGenerationOptions
  ): Promise<GenerationTaskResult> {
    try {
      // Meshy supports max 4 images
      const limitedUrls = imageUrls.slice(0, 4);

      // Determine remesh settings based on precision
      const shouldRemesh = options.precision !== 'high';
      const polycount = shouldRemesh
        ? (MESHY_QUALITY_POLYCOUNT[options.quality] || 100000)
        : undefined;

      functions.logger.info('Starting Meshy URL-based mesh-only generation', {
        imageCount: limitedUrls.length,
        quality: options.quality,
        precision: options.precision || 'standard',
        shouldRemesh,
        polycount,
        format: options.format,
      });

      // For multi-image, use the appropriate endpoint
      const endpoint = limitedUrls.length > 1
        ? `${MESHY_API_BASE}/multi-image-to-3d`
        : `${MESHY_API_BASE}/image-to-3d`;

      const requestBody = limitedUrls.length > 1
        ? {
            image_urls: limitedUrls,
            ai_model: 'meshy-5',
            topology: 'triangle',
            ...(polycount && { target_polycount: polycount }),
            should_remesh: shouldRemesh,
            should_texture: false,
            enable_pbr: false,
          }
        : {
            image_url: limitedUrls[0],
            ai_model: 'latest',
            topology: 'triangle',
            ...(polycount && { target_polycount: polycount }),
            should_remesh: shouldRemesh,
            should_texture: false,
            enable_pbr: false,
          };

      const response = await axios.post<MeshyCreateTaskResponse>(
        endpoint,
        requestBody,
        {
          headers: {
            Authorization: `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json',
          },
          timeout: 60000,
        }
      );

      const taskId = response.data.result;

      functions.logger.info('Meshy URL-based mesh-only generation started', {
        taskId,
        imageCount: limitedUrls.length,
      });

      return { taskId };
    } catch (error) {
      this.handleError(error, 'generateMeshOnlyFromUrls');
    }
  }

  /**
   * Check status of a generation task
   */
  async checkStatus(taskId: string): Promise<TaskStatusResult> {
    try {
      // Try image-to-3d endpoint first, fall back to multi-image if needed
      let response: { data: MeshyTaskResponse };

      try {
        response = await axios.get<MeshyTaskResponse>(
          `${MESHY_API_BASE}/image-to-3d/${taskId}`,
          {
            headers: {
              Authorization: `Bearer ${this.apiKey}`,
            },
            timeout: 30000,
          }
        );
      } catch (err) {
        // If 404, try multi-image endpoint
        if (axios.isAxiosError(err) && err.response?.status === 404) {
          response = await axios.get<MeshyTaskResponse>(
            `${MESHY_API_BASE}/multi-image-to-3d/${taskId}`,
            {
              headers: {
                Authorization: `Bearer ${this.apiKey}`,
              },
              timeout: 30000,
            }
          );
        } else {
          throw err;
        }
      }

      const result = mapMeshyTaskStatus(response.data);

      functions.logger.info('Meshy status check', {
        taskId,
        status: result.status,
        progress: result.progress,
      });

      return result;
    } catch (error) {
      this.handleError(error, 'checkStatus');
    }
  }

  /**
   * Get download URLs for completed task
   */
  async getDownloadUrls(
    taskId: string,
    requiredFormat?: string
  ): Promise<DownloadResult> {
    try {
      // Try image-to-3d endpoint first
      let response: { data: MeshyTaskResponse };

      try {
        response = await axios.get<MeshyTaskResponse>(
          `${MESHY_API_BASE}/image-to-3d/${taskId}`,
          {
            headers: {
              Authorization: `Bearer ${this.apiKey}`,
            },
            timeout: 30000,
          }
        );
      } catch (err) {
        // If 404, try multi-image endpoint
        if (axios.isAxiosError(err) && err.response?.status === 404) {
          response = await axios.get<MeshyTaskResponse>(
            `${MESHY_API_BASE}/multi-image-to-3d/${taskId}`,
            {
              headers: {
                Authorization: `Bearer ${this.apiKey}`,
              },
              timeout: 30000,
            }
          );
        } else {
          throw err;
        }
      }

      if (response.data.status !== 'SUCCEEDED') {
        throw new Error(`Task not completed: ${response.data.status}`);
      }

      const result = extractMeshyDownloads(response.data);

      // Check for required format
      if (requiredFormat) {
        const hasFormat = result.files.some((f) => f.format === requiredFormat);
        if (!hasFormat) {
          functions.logger.warn('Required format not available', {
            taskId,
            requiredFormat,
            availableFormats: result.files.map((f) => f.format),
          });
          // Don't throw - return what's available
        }
      }

      functions.logger.info('Meshy download URLs retrieved', {
        taskId,
        fileCount: result.files.length,
        files: result.files.map((f) => f.format),
      });

      return result;
    } catch (error) {
      this.handleError(error, 'getDownloadUrls');
    }
  }

  /**
   * Download model file from URL
   */
  async downloadModel(url: string): Promise<Buffer> {
    try {
      const response = await axios.get(url, {
        responseType: 'arraybuffer',
        timeout: 120000,  // 2 minute timeout for large files
      });

      functions.logger.info('Meshy model downloaded', {
        size: response.data.length,
      });

      return Buffer.from(response.data);
    } catch (error) {
      this.handleError(error, 'downloadModel');
    }
  }

  /**
   * Get supported output formats
   */
  getSupportedFormats(): ProviderOutputFormat[] {
    return ['glb', 'fbx', 'obj', 'usdz'];
  }

  /**
   * Get provider capabilities for UI introspection
   */
  getCapabilities(): ProviderCapabilities {
    return {
      supportsMultiView: true,
      supportsPBR: true,
      supportedFormats: ['glb', 'fbx', 'obj', 'usdz'],
      estimatedTime: {
        draft: '~1 min',
        standard: '~2 min',
        fine: '~3 min',
      },
    };
  }

  /**
   * Handle and log API errors
   */
  private handleError(error: unknown, operation: string): never {
    if (axios.isAxiosError(error)) {
      const axiosError = error as AxiosError;
      const status = axiosError.response?.status;
      const data = axiosError.response?.data;

      functions.logger.error(`Meshy API error in ${operation}`, {
        status,
        data: JSON.stringify(data),
        message: axiosError.message,
      });

      if (status === 401) {
        throw new functions.https.HttpsError(
          'unauthenticated',
          'Invalid Meshy API key'
        );
      }

      if (status === 429) {
        throw new functions.https.HttpsError(
          'resource-exhausted',
          'Meshy API rate limit exceeded. Please try again later.'
        );
      }

      if (status === 400) {
        throw new functions.https.HttpsError(
          'invalid-argument',
          `Invalid request to Meshy API: ${JSON.stringify(data)}`
        );
      }

      if (status === 402) {
        throw new functions.https.HttpsError(
          'resource-exhausted',
          'Insufficient Meshy API credits'
        );
      }

      throw new functions.https.HttpsError(
        'internal',
        `Meshy API error: ${axiosError.message}`
      );
    }

    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorStack = error instanceof Error ? error.stack : undefined;

    functions.logger.error(`Unknown error in ${operation}`, {
      error: errorMessage,
      stack: errorStack,
    });

    throw new functions.https.HttpsError(
      'internal',
      `Unexpected error in ${operation}: ${errorMessage}`
    );
  }
}
