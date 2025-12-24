/**
 * HiTem3D Provider
 *
 * Implements I3DProvider interface for HiTem3D API.
 * Uses hitem3dv1.5 model by default for high quality.
 *
 * API Docs: https://docs.hitem3d.ai/en/api/api-reference/
 */

import axios, { AxiosError } from 'axios';
import FormData from 'form-data';
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
import type { HitemCreateTaskResponse, HitemQueryResponse, HitemFormatCode } from './types';
import {
  HITEM_API_BASE,
  HITEM_DEFAULT_MODEL,
  HITEM_QUALITY_RESOLUTION,
  HITEM_QUALITY_FACE_COUNT,
  HITEM_FORMAT_CODE,
  HITEM_ERROR_CODES,
} from './types';
import { HitemAuthManager } from './auth';
import { mapHitemTaskStatus, extractHitemDownloads } from './mapper';

export class Hitem3DProvider implements I3DProvider {
  readonly providerType: ProviderType = 'hitem3d';
  private authManager: HitemAuthManager;

  constructor(clientId: string, clientSecret: string) {
    this.authManager = new HitemAuthManager(clientId, clientSecret);
  }

  /**
   * Generate 3D model from single image
   */
  async generateFromImage(
    imageBuffer: Buffer,
    options: GenerationOptions
  ): Promise<GenerationTaskResult> {
    return this.generateFromMultipleImages([imageBuffer], options);
  }

  /**
   * Generate 3D model from multiple images
   *
   * HiTem supports multi-view generation with multi_images field.
   */
  async generateFromMultipleImages(
    imageBuffers: Buffer[],
    options: GenerationOptions
  ): Promise<GenerationTaskResult> {
    try {
      const accessToken = await this.authManager.getAccessToken();
      const resolution = HITEM_QUALITY_RESOLUTION[options.quality] || 1024;
      const faceCount = HITEM_QUALITY_FACE_COUNT[options.quality] || 1000000;
      const formatCode = this.getFormatCode(options.format);

      functions.logger.info('Starting HiTem3D generation', {
        imageCount: imageBuffers.length,
        quality: options.quality,
        resolution,
        faceCount,
        format: options.format,
        formatCode,
      });

      // Build multipart form data
      const formData = new FormData();
      formData.append('request_type', '3');  // Both geometry and texture
      formData.append('model', HITEM_DEFAULT_MODEL);
      formData.append('resolution', String(resolution));
      formData.append('face', String(faceCount));  // Face count (100k-2M)
      formData.append('format', String(formatCode));

      // Add images
      if (imageBuffers.length === 1) {
        formData.append('images', imageBuffers[0], {
          filename: 'image.png',
          contentType: 'image/png',
        });
      } else {
        // Multi-image mode
        imageBuffers.forEach((buffer, index) => {
          formData.append('multi_images', buffer, {
            filename: `image_${index}.png`,
            contentType: 'image/png',
          });
        });
        // Generate bitmap string for multi_images_bit (indicates which views are present)
        // Default to all views present based on count
        const multiImagesBit = '1'.repeat(imageBuffers.length).padEnd(4, '0');
        formData.append('multi_images_bit', multiImagesBit);
      }

      const response = await axios.post<HitemCreateTaskResponse>(
        `${HITEM_API_BASE}/open-api/v1/submit-task`,
        formData,
        {
          headers: {
            ...formData.getHeaders(),
            Authorization: `Bearer ${accessToken}`,
          },
          timeout: 120000,  // 2 minutes for file upload
          maxContentLength: Infinity,
          maxBodyLength: Infinity,
        }
      );

      // Check response
      if (response.data.code !== 200 && response.data.code !== '200') {
        this.handleApiError(response.data.code, response.data.msg, 'generateFromMultipleImages');
      }

      if (!response.data.data?.task_id) {
        throw new functions.https.HttpsError(
          'internal',
          'HiTem3D response missing task_id'
        );
      }

      const taskId = response.data.data.task_id;

      functions.logger.info('HiTem3D generation started', {
        taskId,
        imageCount: imageBuffers.length,
        resolution,
      });

      return { taskId };
    } catch (error) {
      this.handleError(error, 'generateFromMultipleImages');
    }
  }

  /**
   * Check status of a generation task
   */
  async checkStatus(taskId: string): Promise<TaskStatusResult> {
    try {
      const accessToken = await this.authManager.getAccessToken();

      const response = await axios.get<HitemQueryResponse>(
        `${HITEM_API_BASE}/open-api/v1/query-task`,
        {
          params: { task_id: taskId },
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          timeout: 30000,
        }
      );

      const result = mapHitemTaskStatus(response.data);

      functions.logger.info('HiTem3D status check', {
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
      const accessToken = await this.authManager.getAccessToken();

      const response = await axios.get<HitemQueryResponse>(
        `${HITEM_API_BASE}/open-api/v1/query-task`,
        {
          params: { task_id: taskId },
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          timeout: 30000,
        }
      );

      // Verify task is complete
      if (response.data.data?.state !== 'success') {
        throw new Error(`Task not completed: ${response.data.data?.state}`);
      }

      const result = extractHitemDownloads(response.data);

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

      functions.logger.info('HiTem3D download URLs retrieved', {
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

      functions.logger.info('HiTem3D model downloaded', {
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
    return ['glb', 'obj', 'stl', 'fbx'];
  }

  /**
   * Get provider capabilities for UI introspection
   */
  getCapabilities(): ProviderCapabilities {
    return {
      supportsMultiView: true,
      supportsPBR: true,
      minFaceCount: 100000,
      maxFaceCount: 2000000,
      supportedFormats: ['glb', 'obj', 'stl', 'fbx'],
      estimatedTime: {
        draft: '~2 min',
        standard: '~3 min',
        fine: '~5 min',
      },
    };
  }

  /**
   * Get format code for HiTem API
   */
  private getFormatCode(format: ProviderOutputFormat): HitemFormatCode {
    return HITEM_FORMAT_CODE[format] || 2;  // Default to glb (code 2)
  }

  /**
   * Handle API-level errors from response
   */
  private handleApiError(code: number | string, msg: string, operation: string): never {
    const codeStr = String(code);

    functions.logger.error(`HiTem3D API error in ${operation}`, {
      code: codeStr,
      message: msg,
    });

    if (codeStr === HITEM_ERROR_CODES.INVALID_CREDENTIALS) {
      throw new functions.https.HttpsError(
        'unauthenticated',
        'Invalid HiTem3D credentials'
      );
    }

    if (codeStr === HITEM_ERROR_CODES.GENERATE_FAILED) {
      throw new functions.https.HttpsError(
        'internal',
        `HiTem3D generation failed: ${msg}`
      );
    }

    // Check for insufficient balance (common pattern in Chinese APIs)
    if (msg.toLowerCase().includes('balance') || msg.includes('余额')) {
      throw new functions.https.HttpsError(
        'resource-exhausted',
        'Insufficient HiTem3D credits'
      );
    }

    throw new functions.https.HttpsError(
      'internal',
      `HiTem3D error: ${msg}`
    );
  }

  /**
   * Handle and log errors
   */
  private handleError(error: unknown, operation: string): never {
    // Re-throw HttpsErrors as-is
    if (error instanceof functions.https.HttpsError) {
      throw error;
    }

    if (axios.isAxiosError(error)) {
      const axiosError = error as AxiosError;
      const status = axiosError.response?.status;
      const data = axiosError.response?.data;

      functions.logger.error(`HiTem3D API error in ${operation}`, {
        status,
        data: JSON.stringify(data),
        message: axiosError.message,
      });

      if (status === 401) {
        throw new functions.https.HttpsError(
          'unauthenticated',
          'Invalid HiTem3D credentials'
        );
      }

      if (status === 429) {
        throw new functions.https.HttpsError(
          'resource-exhausted',
          'HiTem3D API rate limit exceeded. Please try again later.'
        );
      }

      if (status === 400) {
        throw new functions.https.HttpsError(
          'invalid-argument',
          `Invalid request to HiTem3D API: ${JSON.stringify(data)}`
        );
      }

      throw new functions.https.HttpsError(
        'internal',
        `HiTem3D API error: ${axiosError.message}`
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
