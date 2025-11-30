/**
 * Rodin Provider
 *
 * Wraps existing RodinClient to implement I3DProvider interface.
 * Delegates to the original implementation for API calls.
 */

import type {
  I3DProvider,
  ProviderType,
  ProviderOutputFormat,
  GenerationOptions,
  GenerationTaskResult,
  TaskStatusResult,
  DownloadResult,
} from '../types';
import { RodinClient } from '../../rodin/client';
import type { RodinTaskStatus, PrintQuality } from '../../rodin/types';

/**
 * Map Rodin status to unified ProviderTaskStatus
 */
function mapRodinStatus(status: RodinTaskStatus): 'pending' | 'processing' | 'completed' | 'failed' {
  switch (status) {
    case 'Waiting':
      return 'pending';
    case 'Generating':
      return 'processing';
    case 'Done':
      return 'completed';
    case 'Failed':
      return 'failed';
    default:
      return 'pending';
  }
}

export class RodinProvider implements I3DProvider {
  readonly providerType: ProviderType = 'rodin';
  private client: RodinClient;

  constructor(apiKey: string) {
    this.client = new RodinClient(apiKey);
  }

  /**
   * Generate 3D model from single image
   */
  async generateFromImage(
    imageBuffer: Buffer,
    options: GenerationOptions
  ): Promise<GenerationTaskResult> {
    const result = await this.client.generateModel(imageBuffer, {
      tier: 'Gen-2',
      quality: options.quality as PrintQuality,
      format: options.format,
      meshMode: 'Raw',
    });

    return {
      taskId: result.taskUuid,
      subscriptionKey: result.subscriptionKey,
      jobUuids: result.jobUuids,
    };
  }

  /**
   * Generate 3D model from multiple images
   */
  async generateFromMultipleImages(
    imageBuffers: Buffer[],
    options: GenerationOptions
  ): Promise<GenerationTaskResult> {
    const result = await this.client.generateModelMulti(imageBuffers, {
      tier: 'Gen-2',
      quality: options.quality as PrintQuality,
      format: options.format,
      meshMode: 'Raw',
      conditionMode: imageBuffers.length > 1 ? 'concat' : undefined,
    });

    return {
      taskId: result.taskUuid,
      subscriptionKey: result.subscriptionKey,
      jobUuids: result.jobUuids,
    };
  }

  /**
   * Check status of a generation task
   *
   * Rodin requires subscriptionKey for status polling.
   */
  async checkStatus(
    taskId: string,
    subscriptionKey?: string
  ): Promise<TaskStatusResult> {
    if (!subscriptionKey) {
      throw new Error('Rodin requires subscriptionKey for status check');
    }

    const result = await this.client.checkStatus(subscriptionKey);

    return {
      status: mapRodinStatus(result.status as RodinTaskStatus),
      jobUuid: result.jobUuid,
    };
  }

  /**
   * Get download URLs for completed task
   */
  async getDownloadUrls(
    taskId: string,
    requiredFormat?: string
  ): Promise<DownloadResult> {
    const files = await this.client.getDownloadUrls(
      taskId,
      5,      // maxRetries
      3000,   // retryDelayMs
      requiredFormat
    );

    return {
      files: files.map((f) => ({
        url: f.url,
        name: f.name,
        format: f.name.split('.').pop() || 'unknown',
      })),
    };
  }

  /**
   * Download model file from URL
   */
  async downloadModel(url: string): Promise<Buffer> {
    return this.client.downloadModel(url);
  }

  /**
   * Get supported output formats
   */
  getSupportedFormats(): ProviderOutputFormat[] {
    return ['glb', 'obj', 'fbx', 'stl', 'usdz'];
  }

  /**
   * Check API credit balance
   */
  async checkBalance(): Promise<number> {
    return this.client.checkBalance();
  }
}
