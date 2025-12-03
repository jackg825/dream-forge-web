/**
 * Hunyuan 3D Provider
 *
 * Implements I3DProvider interface for Tencent Cloud Hunyuan 3D v3.0 API.
 * Uses official tencentcloud-sdk-nodejs for API calls.
 * Features: High polygon count control (40K-1.5M), PBR materials, multi-view support.
 */

import * as tencentcloud from 'tencentcloud-sdk-nodejs';
import axios from 'axios';
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
import { HUNYUAN_QUALITY_FACE_COUNT } from './types';
import { mapHunyuanTaskStatus, extractHunyuanDownloads, type SDKQueryResponse } from './mapper';

// Get the AI3D client from SDK
const Ai3dClient = tencentcloud.ai3d.v20250513.Client;

export class HunyuanProvider implements I3DProvider {
  readonly providerType: ProviderType = 'hunyuan';
  private client: InstanceType<typeof Ai3dClient>;

  constructor(secretId: string, secretKey: string, region: string = 'ap-guangzhou') {
    this.client = new Ai3dClient({
      credential: {
        secretId,
        secretKey,
      },
      region,
      profile: {
        httpProfile: {
          endpoint: 'ai3d.tencentcloudapi.com',
          reqTimeout: 120, // 2 minute timeout
        },
      },
    });
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

      const response = await this.client.SubmitHunyuanTo3DProJob({
        ImageBase64: base64,
        EnablePBR: options.enablePBR ?? false,
        FaceCount: faceCount,
        GenerateType: 'Normal',
      });

      functions.logger.info('Hunyuan generation started', {
        jobId: response.JobId,
        requestId: response.RequestId,
      });

      return { taskId: response.JobId! };
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

      // Build multi-view images array (SDK format)
      // Pipeline image order: [front, back, left, right]
      const multiViewImages: Array<{
        ViewType: string;
        ViewImageBase64: string;
      }> = [];

      if (imageBuffers[1]) {
        multiViewImages.push({
          ViewType: 'back',
          ViewImageBase64: imageBuffers[1].toString('base64'),
        });
      }
      if (imageBuffers[2]) {
        multiViewImages.push({
          ViewType: 'left',
          ViewImageBase64: imageBuffers[2].toString('base64'),
        });
      }
      if (imageBuffers[3]) {
        multiViewImages.push({
          ViewType: 'right',
          ViewImageBase64: imageBuffers[3].toString('base64'),
        });
      }

      const response = await this.client.SubmitHunyuanTo3DProJob({
        ImageBase64: primaryBase64,
        EnablePBR: options.enablePBR ?? false,
        FaceCount: faceCount,
        GenerateType: 'Normal',
        MultiViewImages: multiViewImages.length > 0 ? multiViewImages : undefined,
      });

      functions.logger.info('Hunyuan multi-image generation started', {
        jobId: response.JobId,
        imageCount: imageBuffers.length,
        multiViewCount: multiViewImages.length,
      });

      return { taskId: response.JobId! };
    } catch (error) {
      this.handleError(error, 'generateFromMultipleImages');
    }
  }

  /**
   * Check status of a generation task
   */
  async checkStatus(taskId: string): Promise<TaskStatusResult> {
    try {
      const response = await this.client.QueryHunyuanTo3DProJob({
        JobId: taskId,
      });

      // Map SDK response to our internal format
      const result = mapHunyuanTaskStatus(response as SDKQueryResponse);

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
      const response = await this.client.QueryHunyuanTo3DProJob({
        JobId: taskId,
      });

      if (response.Status !== 'DONE') {
        throw new Error(`Task not completed: ${response.Status}`);
      }

      const result = extractHunyuanDownloads(response as SDKQueryResponse);

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
   * Handle and log API errors
   */
  private handleError(error: unknown, operation: string): never {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorStack = error instanceof Error ? error.stack : undefined;

    functions.logger.error(`Hunyuan API error in ${operation}`, {
      error: errorMessage,
      stack: errorStack,
    });

    // Check for specific Tencent Cloud error codes in message
    if (errorMessage.includes('AuthFailure')) {
      throw new functions.https.HttpsError(
        'unauthenticated',
        'Invalid Tencent Cloud credentials'
      );
    }

    if (errorMessage.includes('RequestLimitExceeded') || errorMessage.includes('RateLimitExceeded')) {
      throw new functions.https.HttpsError(
        'resource-exhausted',
        'Hunyuan API rate limit exceeded. Please try again later.'
      );
    }

    if (errorMessage.includes('InvalidParameter')) {
      throw new functions.https.HttpsError(
        'invalid-argument',
        `Invalid request to Hunyuan API: ${errorMessage}`
      );
    }

    throw new functions.https.HttpsError(
      'internal',
      `Unexpected error in ${operation}: ${errorMessage}`
    );
  }
}
