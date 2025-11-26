import axios, { AxiosInstance, AxiosError } from 'axios';
import * as functions from 'firebase-functions';
import {
  type GenerateOptions,
  type RodinGenerateRequest,
  type RodinGenerateResponse,
  type RodinStatusResponse,
  type OutputFormat,
  QUALITY_FACE_COUNTS,
} from './types';

const RODIN_API_BASE = 'https://hyperhuman.deemos.com/api/v2';

/**
 * Rodin Gen-2 API Client
 *
 * Handles communication with the Hyper3D Rodin API for 3D model generation.
 */
export class RodinClient {
  private client: AxiosInstance;

  constructor(apiKey: string) {
    this.client = axios.create({
      baseURL: RODIN_API_BASE,
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      timeout: 30000, // 30 second timeout
    });
  }

  /**
   * Start a 3D model generation task
   *
   * @param imageUrl - URL of the input image
   * @param options - Generation options (quality, format, etc.)
   * @returns Task ID and subscription key for status polling
   */
  async generateModel(
    imageUrl: string,
    options: GenerateOptions
  ): Promise<{ taskId: string; subscriptionKey: string }> {
    const request: RodinGenerateRequest = {
      images: [imageUrl],
      tier: options.tier,
      material: 'PBR',
      geometry_file_format: options.format,
      quality_override: QUALITY_FACE_COUNTS[options.quality],
      prompt: options.prompt,
    };

    try {
      const response = await this.client.post<RodinGenerateResponse>('/rodin', request);

      if (!response.data.uuid || !response.data.jobs?.subscription_key) {
        throw new Error('Invalid response from Rodin API');
      }

      functions.logger.info('Rodin generation started', {
        taskId: response.data.uuid,
        quality: options.quality,
        format: options.format,
      });

      return {
        taskId: response.data.uuid,
        subscriptionKey: response.data.jobs.subscription_key,
      };
    } catch (error) {
      this.handleError(error, 'generateModel');
      throw error; // TypeScript needs this
    }
  }

  /**
   * Check the status of a generation task
   *
   * @param taskId - The task UUID
   * @param subscriptionKey - The subscription key for this task
   * @returns Current status and result URL if complete
   */
  async checkStatus(
    taskId: string,
    subscriptionKey: string
  ): Promise<RodinStatusResponse> {
    try {
      const response = await this.client.post<RodinStatusResponse>(
        '/status',
        { subscription_key: subscriptionKey }
      );

      functions.logger.info('Rodin status check', {
        taskId,
        status: response.data.status,
        progress: response.data.progress,
      });

      return response.data;
    } catch (error) {
      this.handleError(error, 'checkStatus');
      throw error;
    }
  }

  /**
   * Download a completed model
   *
   * @param modelUrl - The URL of the completed model
   * @returns Model data as a Buffer
   */
  async downloadModel(modelUrl: string): Promise<Buffer> {
    try {
      const response = await axios.get(modelUrl, {
        responseType: 'arraybuffer',
        timeout: 120000, // 2 minute timeout for large files
      });

      functions.logger.info('Model downloaded', {
        size: response.data.length,
      });

      return Buffer.from(response.data);
    } catch (error) {
      this.handleError(error, 'downloadModel');
      throw error;
    }
  }

  /**
   * Get supported output formats
   */
  static getSupportedFormats(): OutputFormat[] {
    return ['glb', 'obj', 'fbx', 'stl'];
  }

  /**
   * Handle and log API errors
   */
  private handleError(error: unknown, operation: string): never {
    if (axios.isAxiosError(error)) {
      const axiosError = error as AxiosError;
      const status = axiosError.response?.status;
      const data = axiosError.response?.data;

      functions.logger.error(`Rodin API error in ${operation}`, {
        status,
        data,
        message: axiosError.message,
      });

      if (status === 401) {
        throw new functions.https.HttpsError(
          'unauthenticated',
          'Invalid Rodin API key'
        );
      }

      if (status === 429) {
        throw new functions.https.HttpsError(
          'resource-exhausted',
          'Rodin API rate limit exceeded. Please try again later.'
        );
      }

      if (status === 400) {
        throw new functions.https.HttpsError(
          'invalid-argument',
          'Invalid request to Rodin API'
        );
      }

      throw new functions.https.HttpsError(
        'internal',
        `Rodin API error: ${axiosError.message}`
      );
    }

    functions.logger.error(`Unknown error in ${operation}`, { error });
    throw new functions.https.HttpsError(
      'internal',
      'An unexpected error occurred'
    );
  }
}

/**
 * Create a RodinClient instance with the API key from environment
 */
export function createRodinClient(): RodinClient {
  const apiKey = process.env.RODIN_API_KEY;

  if (!apiKey) {
    throw new functions.https.HttpsError(
      'failed-precondition',
      'Rodin API key not configured'
    );
  }

  return new RodinClient(apiKey);
}
