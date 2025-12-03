/**
 * Tripo3D Provider
 *
 * Implements I3DProvider interface for Tripo3D v3.0 API.
 * Features: Native multi-view support, fast generation.
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
import {
  TRIPO_API_BASE,
  type TripoImageToModelRequest,
  type TripoMultiviewToModelRequest,
  type TripoCreateTaskResponse,
  type TripoTaskStatusResponse,
} from './types';
import { mapTripoTaskStatus, extractTripoDownloads } from './mapper';

export class TripoProvider implements I3DProvider {
  readonly providerType: ProviderType = 'tripo';
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
      const base64 = imageBuffer.toString('base64');

      functions.logger.info('Starting Tripo single-image generation', {
        quality: options.quality,
        format: options.format,
      });

      const request: TripoImageToModelRequest = {
        type: 'image_to_model',
        file: {
          type: 'png',
          data: base64,
        },
      };

      const response = await this.createTask(request);

      functions.logger.info('Tripo generation started', {
        taskId: response.data.task_id,
      });

      return { taskId: response.data.task_id };
    } catch (error) {
      this.handleError(error, 'generateFromImage');
    }
  }

  /**
   * Generate 3D model from multiple images
   *
   * Uses multiview_to_model when 4 images are provided.
   * Order: front, left, right, back
   */
  async generateFromMultipleImages(
    imageBuffers: Buffer[],
    options: GenerationOptions
  ): Promise<GenerationTaskResult> {
    try {
      functions.logger.info('Starting Tripo multi-image generation', {
        imageCount: imageBuffers.length,
        quality: options.quality,
        format: options.format,
      });

      // Use multiview if we have enough images (at least front + one other)
      if (imageBuffers.length >= 2) {
        const request: TripoMultiviewToModelRequest = {
          type: 'multiview_to_model',
          files: {
            front: {
              type: 'png',
              data: imageBuffers[0].toString('base64'),
            },
          },
        };

        // Add additional views if available
        // Order: front, back, left, right (matching pipeline angles)
        if (imageBuffers[1]) {
          request.files.back = {
            type: 'png',
            data: imageBuffers[1].toString('base64'),
          };
        }
        if (imageBuffers[2]) {
          request.files.left = {
            type: 'png',
            data: imageBuffers[2].toString('base64'),
          };
        }
        if (imageBuffers[3]) {
          request.files.right = {
            type: 'png',
            data: imageBuffers[3].toString('base64'),
          };
        }

        const response = await this.createTask(request);

        functions.logger.info('Tripo multiview generation started', {
          taskId: response.data.task_id,
          imageCount: imageBuffers.length,
        });

        return { taskId: response.data.task_id };
      }

      // Fall back to single image
      return this.generateFromImage(imageBuffers[0], options);
    } catch (error) {
      this.handleError(error, 'generateFromMultipleImages');
    }
  }

  /**
   * Check status of a generation task
   */
  async checkStatus(taskId: string): Promise<TaskStatusResult> {
    try {
      const response = await this.getTaskStatus(taskId);
      const result = mapTripoTaskStatus(response);

      functions.logger.info('Tripo status check', {
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
      const response = await this.getTaskStatus(taskId);

      if (response.data.status !== 'success') {
        throw new Error(`Task not completed: ${response.data.status}`);
      }

      const result = extractTripoDownloads(response);

      // Check for required format
      if (requiredFormat) {
        const hasFormat = result.files.some((f) => f.format === requiredFormat);
        if (!hasFormat) {
          functions.logger.warn('Required format not available', {
            taskId,
            requiredFormat,
            availableFormats: result.files.map((f) => f.format),
          });
        }
      }

      functions.logger.info('Tripo download URLs retrieved', {
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
        timeout: 120000, // 2 minute timeout for large files
      });

      functions.logger.info('Tripo model downloaded', {
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
    return ['glb', 'obj'];
  }

  /**
   * Get provider capabilities for UI introspection
   */
  getCapabilities(): ProviderCapabilities {
    return {
      supportsMultiView: true,
      supportsPBR: true,
      supportedFormats: ['glb', 'obj'],
      estimatedTime: {
        draft: '~1 min',
        standard: '~2 min',
        fine: '~3 min',
      },
    };
  }

  /**
   * Create a new task
   */
  private async createTask(
    request: TripoImageToModelRequest | TripoMultiviewToModelRequest
  ): Promise<TripoCreateTaskResponse> {
    const response = await axios.post<TripoCreateTaskResponse>(
      `${TRIPO_API_BASE}/task`,
      request,
      {
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        timeout: 60000,
      }
    );

    if (response.data.code !== 0) {
      throw new Error(`Tripo API error: code ${response.data.code}`);
    }

    return response.data;
  }

  /**
   * Get task status
   */
  private async getTaskStatus(taskId: string): Promise<TripoTaskStatusResponse> {
    const response = await axios.get<TripoTaskStatusResponse>(
      `${TRIPO_API_BASE}/task/${taskId}`,
      {
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
        },
        timeout: 30000,
      }
    );

    if (response.data.code !== 0) {
      throw new Error(`Tripo API error: code ${response.data.code}`);
    }

    return response.data;
  }

  /**
   * Handle and log API errors
   */
  private handleError(error: unknown, operation: string): never {
    if (axios.isAxiosError(error)) {
      const axiosError = error as AxiosError;
      const status = axiosError.response?.status;
      const data = axiosError.response?.data;

      functions.logger.error(`Tripo API error in ${operation}`, {
        status,
        data: JSON.stringify(data),
        message: axiosError.message,
      });

      if (status === 401) {
        throw new functions.https.HttpsError(
          'unauthenticated',
          'Invalid Tripo API key'
        );
      }

      if (status === 429) {
        throw new functions.https.HttpsError(
          'resource-exhausted',
          'Tripo API rate limit exceeded. Please try again later.'
        );
      }

      if (status === 400) {
        throw new functions.https.HttpsError(
          'invalid-argument',
          `Invalid request to Tripo API: ${JSON.stringify(data)}`
        );
      }

      throw new functions.https.HttpsError(
        'internal',
        `Tripo API error: ${axiosError.message}`
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
