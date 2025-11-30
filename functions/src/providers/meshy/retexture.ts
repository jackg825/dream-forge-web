/**
 * Meshy Retexture API Client
 *
 * Adds textures to existing 3D meshes using Meshy's Retexture API.
 * Used in the pipeline workflow after mesh-only generation.
 *
 * API Docs: https://docs.meshy.ai/en/api/retexture
 */

import axios, { AxiosError } from 'axios';
import * as functions from 'firebase-functions';
import type { TaskStatusResult, DownloadResult, DownloadableFile } from '../types';
import type {
  MeshyCreateTaskResponse,
  MeshyRetextureRequest,
  MeshyRetextureResponse,
} from './types';
import { MESHY_API_BASE } from './types';

/**
 * Options for retexture generation
 */
export interface RetextureOptions {
  // One of these is required
  textStylePrompt?: string;      // Text description for texture style
  imageStyleUrl?: string;        // Reference image for texture style

  // Optional settings
  enablePBR?: boolean;           // Generate PBR maps (metallic, roughness, normal)
  preserveOriginalUV?: boolean;  // Keep existing UV mapping
}

/**
 * Meshy Retexture Client
 *
 * Handles texture generation for existing meshes
 */
export class MeshyRetextureClient {
  private apiKey: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  /**
   * Create a retexture task from a completed mesh task
   *
   * @param meshTaskId - Task ID from completed mesh generation
   * @param options - Retexture options (style prompt or reference image)
   * @returns Task ID for polling
   */
  async createFromMeshTask(
    meshTaskId: string,
    options: RetextureOptions
  ): Promise<string> {
    if (!options.textStylePrompt && !options.imageStyleUrl) {
      throw new functions.https.HttpsError(
        'invalid-argument',
        'Either textStylePrompt or imageStyleUrl is required for retexturing'
      );
    }

    const requestBody: MeshyRetextureRequest = {
      input_task_id: meshTaskId,
      ai_model: 'latest',
      enable_original_uv: options.preserveOriginalUV ?? true,
      enable_pbr: options.enablePBR ?? true, // Enable PBR for better textures
    };

    if (options.textStylePrompt) {
      requestBody.text_style_prompt = options.textStylePrompt;
    }

    if (options.imageStyleUrl) {
      requestBody.image_style_url = options.imageStyleUrl;
    }

    functions.logger.info('Starting Meshy retexture task', {
      meshTaskId,
      hasTextPrompt: !!options.textStylePrompt,
      hasImageStyle: !!options.imageStyleUrl,
      enablePBR: options.enablePBR ?? true,
    });

    try {
      const response = await axios.post<MeshyCreateTaskResponse>(
        `${MESHY_API_BASE}/retexture`,
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

      functions.logger.info('Meshy retexture task created', { taskId, meshTaskId });

      return taskId;
    } catch (error) {
      this.handleError(error, 'createFromMeshTask');
    }
  }

  /**
   * Create a retexture task from a model URL
   *
   * @param modelUrl - URL or base64 data URI of 3D model
   * @param options - Retexture options
   * @returns Task ID for polling
   */
  async createFromModelUrl(
    modelUrl: string,
    options: RetextureOptions
  ): Promise<string> {
    if (!options.textStylePrompt && !options.imageStyleUrl) {
      throw new functions.https.HttpsError(
        'invalid-argument',
        'Either textStylePrompt or imageStyleUrl is required for retexturing'
      );
    }

    const requestBody: MeshyRetextureRequest = {
      model_url: modelUrl,
      ai_model: 'latest',
      enable_original_uv: options.preserveOriginalUV ?? true,
      enable_pbr: options.enablePBR ?? true,
    };

    if (options.textStylePrompt) {
      requestBody.text_style_prompt = options.textStylePrompt;
    }

    if (options.imageStyleUrl) {
      requestBody.image_style_url = options.imageStyleUrl;
    }

    functions.logger.info('Starting Meshy retexture from model URL', {
      hasTextPrompt: !!options.textStylePrompt,
      hasImageStyle: !!options.imageStyleUrl,
    });

    try {
      const response = await axios.post<MeshyCreateTaskResponse>(
        `${MESHY_API_BASE}/retexture`,
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

      functions.logger.info('Meshy retexture task created', { taskId });

      return taskId;
    } catch (error) {
      this.handleError(error, 'createFromModelUrl');
    }
  }

  /**
   * Check status of a retexture task
   */
  async checkStatus(taskId: string): Promise<TaskStatusResult> {
    try {
      const response = await axios.get<MeshyRetextureResponse>(
        `${MESHY_API_BASE}/retexture/${taskId}`,
        {
          headers: {
            Authorization: `Bearer ${this.apiKey}`,
          },
          timeout: 30000,
        }
      );

      const data = response.data;

      functions.logger.info('Meshy retexture status check', {
        taskId,
        status: data.status,
        progress: data.progress,
      });

      // Map Meshy status to our status
      let status: TaskStatusResult['status'];
      switch (data.status) {
        case 'PENDING':
        case 'IN_PROGRESS':
          status = 'processing';
          break;
        case 'SUCCEEDED':
          status = 'completed';
          break;
        case 'FAILED':
        case 'CANCELED':
          status = 'failed';
          break;
        default:
          status = 'processing';
      }

      return {
        status,
        progress: data.progress,
        error: data.task_error?.message,
      };
    } catch (error) {
      this.handleError(error, 'checkStatus');
    }
  }

  /**
   * Get download URLs for completed retexture task
   */
  async getDownloadUrls(taskId: string): Promise<DownloadResult> {
    try {
      const response = await axios.get<MeshyRetextureResponse>(
        `${MESHY_API_BASE}/retexture/${taskId}`,
        {
          headers: {
            Authorization: `Bearer ${this.apiKey}`,
          },
          timeout: 30000,
        }
      );

      const data = response.data;

      if (data.status !== 'SUCCEEDED') {
        throw new functions.https.HttpsError(
          'failed-precondition',
          `Retexture task not completed: ${data.status}`
        );
      }

      const files: DownloadableFile[] = [];

      // Add model URLs
      if (data.model_urls) {
        if (data.model_urls.glb) {
          files.push({ url: data.model_urls.glb, format: 'glb', name: 'model.glb' });
        }
        if (data.model_urls.fbx) {
          files.push({ url: data.model_urls.fbx, format: 'fbx', name: 'model.fbx' });
        }
        if (data.model_urls.obj) {
          files.push({ url: data.model_urls.obj, format: 'obj', name: 'model.obj' });
        }
        if (data.model_urls.usdz) {
          files.push({ url: data.model_urls.usdz, format: 'usdz', name: 'model.usdz' });
        }
      }

      // Add texture URLs if available
      if (data.texture_urls && data.texture_urls.length > 0) {
        const textures = data.texture_urls[0]; // Take first texture set
        if (textures.base_color) {
          files.push({ url: textures.base_color, format: 'png', name: 'texture_base_color.png' });
        }
        if (textures.metallic) {
          files.push({ url: textures.metallic, format: 'png', name: 'texture_metallic.png' });
        }
        if (textures.normal) {
          files.push({ url: textures.normal, format: 'png', name: 'texture_normal.png' });
        }
        if (textures.roughness) {
          files.push({ url: textures.roughness, format: 'png', name: 'texture_roughness.png' });
        }
      }

      functions.logger.info('Meshy retexture download URLs retrieved', {
        taskId,
        fileCount: files.length,
        formats: files.map((f) => f.format),
      });

      return {
        files,
        thumbnailUrl: data.thumbnail_url,
      };
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
        timeout: 120000, // 2 minute timeout for large files
      });

      functions.logger.info('Meshy retextured model downloaded', {
        size: response.data.length,
      });

      return Buffer.from(response.data);
    } catch (error) {
      this.handleError(error, 'downloadModel');
    }
  }

  /**
   * Handle and log API errors
   */
  private handleError(error: unknown, operation: string): never {
    if (axios.isAxiosError(error)) {
      const axiosError = error as AxiosError;
      const status = axiosError.response?.status;
      const data = axiosError.response?.data;

      functions.logger.error(`Meshy Retexture API error in ${operation}`, {
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
          `Invalid request to Meshy Retexture API: ${JSON.stringify(data)}`
        );
      }

      if (status === 402) {
        throw new functions.https.HttpsError(
          'resource-exhausted',
          'Insufficient Meshy API credits'
        );
      }

      if (status === 404) {
        throw new functions.https.HttpsError(
          'not-found',
          'Retexture task not found'
        );
      }

      throw new functions.https.HttpsError(
        'internal',
        `Meshy Retexture API error: ${axiosError.message}`
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

/**
 * Create a MeshyRetextureClient instance with API key from environment
 */
export function createMeshyRetextureClient(): MeshyRetextureClient {
  const apiKey = process.env.MESHY_API_KEY;

  if (!apiKey) {
    throw new functions.https.HttpsError(
      'failed-precondition',
      'Meshy API key not configured'
    );
  }

  return new MeshyRetextureClient(apiKey);
}
