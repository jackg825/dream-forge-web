/**
 * Hunyuan 3D Provider
 *
 * Implements I3DProvider interface for Tencent Cloud Hunyuan 3D v3.0 API.
 * Features: High polygon count control (40K-1.5M), PBR materials, multi-view support.
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
  HunyuanOptions,
} from '../types';
import {
  HUNYUAN_API_HOST,
  HUNYUAN_API_VERSION,
  HUNYUAN_SERVICE,
  HUNYUAN_QUALITY_FACE_COUNT,
  type HunyuanSubmitRequest,
  type HunyuanSubmitResponse,
  type HunyuanQueryRequest,
  type HunyuanQueryResponse,
  type TencentCloudError,
} from './types';
import { signRequest } from './auth';
import { mapHunyuanTaskStatus, extractHunyuanDownloads } from './mapper';

export class HunyuanProvider implements I3DProvider {
  readonly providerType: ProviderType = 'hunyuan';
  private secretId: string;
  private secretKey: string;
  private region: string;

  constructor(secretId: string, secretKey: string, region: string = 'ap-guangzhou') {
    this.secretId = secretId;
    this.secretKey = secretKey;
    this.region = region;
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
      const faceCount = this.getFaceCount(options);

      functions.logger.info('Starting Hunyuan single-image generation', {
        quality: options.quality,
        faceCount,
        format: options.format,
        enablePBR: options.enablePBR,
      });

      const request: HunyuanSubmitRequest = {
        ImageBase64: base64,
        EnablePBR: options.enablePBR ?? false,
        FaceCount: faceCount,
        GenerateType: 'Normal',
      };

      const response = await this.callAPI<HunyuanSubmitResponse>(
        'SubmitHunyuanTo3DProJob',
        request
      );

      functions.logger.info('Hunyuan generation started', {
        jobId: response.JobId,
        requestId: response.RequestId,
      });

      return { taskId: response.JobId };
    } catch (error) {
      this.handleError(error, 'generateFromImage');
    }
  }

  /**
   * Generate 3D model from multiple images
   */
  async generateFromMultipleImages(
    imageBuffers: Buffer[],
    options: GenerationOptions
  ): Promise<GenerationTaskResult> {
    try {
      // Use first image as primary, others as multi-view
      const primaryBase64 = imageBuffers[0].toString('base64');
      const faceCount = this.getFaceCount(options);

      functions.logger.info('Starting Hunyuan multi-image generation', {
        imageCount: imageBuffers.length,
        quality: options.quality,
        faceCount,
        format: options.format,
      });

      const request: HunyuanSubmitRequest = {
        ImageBase64: primaryBase64,
        EnablePBR: options.enablePBR ?? false,
        FaceCount: faceCount,
        GenerateType: 'Normal',
      };

      // Add multi-view images if available
      if (imageBuffers.length > 1) {
        request.MultiViewImages = {};
        if (imageBuffers[1]) {
          request.MultiViewImages.Left = imageBuffers[1].toString('base64');
        }
        if (imageBuffers[2]) {
          request.MultiViewImages.Right = imageBuffers[2].toString('base64');
        }
        if (imageBuffers[3]) {
          request.MultiViewImages.Back = imageBuffers[3].toString('base64');
        }
      }

      const response = await this.callAPI<HunyuanSubmitResponse>(
        'SubmitHunyuanTo3DProJob',
        request
      );

      functions.logger.info('Hunyuan multi-image generation started', {
        jobId: response.JobId,
        imageCount: imageBuffers.length,
      });

      return { taskId: response.JobId };
    } catch (error) {
      this.handleError(error, 'generateFromMultipleImages');
    }
  }

  /**
   * Check status of a generation task
   */
  async checkStatus(taskId: string): Promise<TaskStatusResult> {
    try {
      const request: HunyuanQueryRequest = { JobId: taskId };
      const response = await this.callAPI<HunyuanQueryResponse>(
        'QueryHunyuanTo3DProJob',
        request
      );

      const result = mapHunyuanTaskStatus(response);

      functions.logger.info('Hunyuan status check', {
        jobId: taskId,
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
      const request: HunyuanQueryRequest = { JobId: taskId };
      const response = await this.callAPI<HunyuanQueryResponse>(
        'QueryHunyuanTo3DProJob',
        request
      );

      if (response.Status !== 'SUCCEEDED') {
        throw new Error(`Task not completed: ${response.Status}`);
      }

      const result = extractHunyuanDownloads(response);

      // Check for required format
      if (requiredFormat) {
        const hasFormat = result.files.some((f) => f.format === requiredFormat);
        if (!hasFormat) {
          functions.logger.warn('Required format not available', {
            jobId: taskId,
            requiredFormat,
            availableFormats: result.files.map((f) => f.format),
          });
        }
      }

      functions.logger.info('Hunyuan download URLs retrieved', {
        jobId: taskId,
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

      functions.logger.info('Hunyuan model downloaded', {
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
    return ['glb', 'obj', 'fbx'];
  }

  /**
   * Get provider capabilities for UI introspection
   */
  getCapabilities(): ProviderCapabilities {
    return {
      supportsMultiView: true,
      supportsPBR: true,
      minFaceCount: 40000,
      maxFaceCount: 1500000,
      supportedFormats: ['glb', 'obj', 'fbx'],
      estimatedTime: {
        draft: '~2 min',
        standard: '~4 min',
        fine: '~6 min',
      },
    };
  }

  /**
   * Get face count from options
   */
  private getFaceCount(options: GenerationOptions): number {
    // Check for provider-specific options
    const providerOpts = (options as any).providerOptions?.hunyuan as HunyuanOptions | undefined;
    if (providerOpts?.faceCount) {
      return providerOpts.faceCount;
    }
    // Fall back to quality mapping
    return HUNYUAN_QUALITY_FACE_COUNT[options.quality] ?? 200000;
  }

  /**
   * Call Tencent Cloud API with TC3 signature
   */
  private async callAPI<T>(action: string, body: object): Promise<T> {
    const payload = JSON.stringify(body);

    const headers = signRequest({
      secretId: this.secretId,
      secretKey: this.secretKey,
      service: HUNYUAN_SERVICE,
      host: HUNYUAN_API_HOST,
      action,
      version: HUNYUAN_API_VERSION,
      region: this.region,
      payload,
    });

    try {
      const response = await axios.post(
        `https://${HUNYUAN_API_HOST}`,
        payload,
        {
          headers,
          timeout: 60000,
        }
      );

      // Tencent Cloud wraps response in Response object
      if (response.data.Response?.Error) {
        const tcError = response.data as TencentCloudError;
        throw new Error(
          `Tencent Cloud API Error [${tcError.Response.Error.Code}]: ${tcError.Response.Error.Message}`
        );
      }

      return response.data.Response as T;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        const axiosError = error as AxiosError;
        // Check for Tencent Cloud error in response
        const tcError = axiosError.response?.data as TencentCloudError | undefined;
        if (tcError?.Response?.Error) {
          throw new Error(
            `Tencent Cloud API Error [${tcError.Response.Error.Code}]: ${tcError.Response.Error.Message}`
          );
        }
      }
      throw error;
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

      functions.logger.error(`Hunyuan API error in ${operation}`, {
        status,
        data: JSON.stringify(data),
        message: axiosError.message,
      });

      if (status === 401 || status === 403) {
        throw new functions.https.HttpsError(
          'unauthenticated',
          'Invalid Tencent Cloud credentials'
        );
      }

      if (status === 429) {
        throw new functions.https.HttpsError(
          'resource-exhausted',
          'Hunyuan API rate limit exceeded. Please try again later.'
        );
      }

      if (status === 400) {
        throw new functions.https.HttpsError(
          'invalid-argument',
          `Invalid request to Hunyuan API: ${JSON.stringify(data)}`
        );
      }

      throw new functions.https.HttpsError(
        'internal',
        `Hunyuan API error: ${axiosError.message}`
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
