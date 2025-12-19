/**
 * Gemini Batch API Client
 *
 * Provides batch processing for multiple image generation requests.
 * Uses the Gemini Batch API for 50% cost savings over real-time API.
 *
 * Key features:
 * - Submit multiple generation requests in a single API call
 * - Poll for job completion
 * - Handle partial failures gracefully
 *
 * Reference: https://ai.google.dev/gemini-api/docs/batch-api
 */

import axios, { AxiosError } from 'axios';
import * as functions from 'firebase-functions/v1';
import type { PipelineMeshAngle } from '../rodin/types';
import { getMode, getMeshPrompt, type GenerationModeId } from './mode-configs';

const GEMINI_API_BASE = 'https://generativelanguage.googleapis.com/v1beta';
const MODEL = 'gemini-2.5-flash-image';

/**
 * Batch job status from Gemini API
 */
export type GeminiBatchJobState =
  | 'JOB_STATE_PENDING'
  | 'JOB_STATE_RUNNING'
  | 'JOB_STATE_SUCCEEDED'
  | 'JOB_STATE_FAILED'
  | 'JOB_STATE_CANCELLED';

/**
 * Individual request in a batch
 */
export interface BatchRequest {
  viewType: 'mesh' | 'texture';
  angle: string;
  prompt: string;
}

/**
 * Batch submission response
 */
export interface BatchSubmitResponse {
  name: string; // Operation name for polling
  metadata: {
    '@type': string;
    state: GeminiBatchJobState;
    createTime: string;
  };
}

/**
 * Individual inline response from batch processing
 */
interface InlineResponse {
  response?: {
    candidates?: Array<{
      content?: {
        parts?: Array<{
          text?: string;
          inlineData?: {
            mimeType: string;
            data: string;
          };
        }>;
      };
      finishReason?: string;
    }>;
  };
  error?: {
    code: number;
    message: string;
  };
}

/**
 * Batch job status response
 *
 * For inline requests, results are in dest.inlined_responses[]
 * Reference: https://ai.google.dev/gemini-api/docs/batch-api
 */
export interface BatchStatusResponse {
  name: string;
  metadata: {
    '@type': string;
    state: GeminiBatchJobState;
    createTime: string;
    updateTime?: string;
  };
  done?: boolean;
  /** Destination containing inline responses */
  dest?: {
    inlined_responses?: InlineResponse[];
  };
  /** Job-level error (if the entire batch failed) */
  error?: {
    code: number;
    message: string;
  };
}

/**
 * Individual result from batch processing
 */
export interface BatchResult {
  index: number;
  viewType: 'mesh' | 'texture';
  angle: string;
  success: boolean;
  imageBase64?: string;
  mimeType?: string;
  textContent?: string;
  colorPalette?: string[];
  error?: string;
}

/**
 * Gemini Batch API Client
 */
export class GeminiBatchClient {
  private apiKey: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  /**
   * Build batch requests for all 4 mesh views
   */
  buildBatchRequests(
    referenceImageBase64: string,
    mimeType: string,
    modeId: GenerationModeId,
    userDescription?: string
  ): BatchRequest[] {
    const modeConfig = getMode(modeId);
    const meshAngles: PipelineMeshAngle[] = ['front', 'back', 'left', 'right'];

    const requests: BatchRequest[] = [];

    // Add mesh view requests
    for (const angle of meshAngles) {
      requests.push({
        viewType: 'mesh',
        angle,
        prompt: getMeshPrompt(modeConfig, angle, userDescription),
      });
    }

    return requests;
  }

  /**
   * Submit a batch of generation requests
   *
   * Uses inline requests format (suitable for <20MB total request size)
   */
  async submitBatch(
    referenceImageBase64: string,
    mimeType: string,
    requests: BatchRequest[]
  ): Promise<BatchSubmitResponse> {
    // Build the batch request payload using camelCase per API spec
    const inlineRequests = requests.map((req) => ({
      contents: [
        {
          parts: [
            {
              inline_data: {
                mime_type: mimeType,
                data: referenceImageBase64,
              },
            },
            {
              text: req.prompt,
            },
          ],
        },
      ],
      generationConfig: {
        responseModalities: ['TEXT', 'IMAGE'],
        imageConfig: {
          aspectRatio: '1:1',
          imageSize: '1K',
        },
      },
    }));

    try {
      functions.logger.info('Submitting batch job', {
        requestCount: requests.length,
        viewTypes: requests.map((r) => `${r.viewType}-${r.angle}`),
      });

      const response = await axios.post<BatchSubmitResponse>(
        `${GEMINI_API_BASE}/models/${MODEL}:batchGenerateContent`,
        {
          batch: {
            model: `models/${MODEL}`,
            display_name: `dreamforge-batch-${Date.now()}`,
            input_config: {
              requests: {
                requests: inlineRequests.map((req, idx) => ({
                  request: req,
                  metadata: { key: `view-${idx}` },
                })),
              },
            },
          },
        },
        {
          headers: {
            'Content-Type': 'application/json',
          },
          params: {
            key: this.apiKey,
          },
          timeout: 60000, // 60 second timeout for submission
        }
      );

      functions.logger.info('Batch job submitted', {
        name: response.data.name,
        state: response.data.metadata?.state,
      });

      return response.data;
    } catch (error) {
      const axiosError = error as AxiosError;
      functions.logger.error('Batch submit failed', {
        status: axiosError.response?.status,
        data: axiosError.response?.data,
        message: axiosError.message,
      });

      throw new functions.https.HttpsError(
        'internal',
        `Failed to submit batch job: ${axiosError.message}`
      );
    }
  }

  /**
   * Check the status of a batch job
   */
  async checkStatus(operationName: string): Promise<BatchStatusResponse> {
    try {
      const response = await axios.get<BatchStatusResponse>(
        `${GEMINI_API_BASE}/${operationName}`,
        {
          params: {
            key: this.apiKey,
          },
          timeout: 30000,
        }
      );

      functions.logger.info('Batch status checked', {
        name: operationName,
        state: response.data.metadata?.state,
        done: response.data.done,
      });

      return response.data;
    } catch (error) {
      const axiosError = error as AxiosError;
      functions.logger.error('Batch status check failed', {
        operationName,
        status: axiosError.response?.status,
        message: axiosError.message,
      });

      throw new functions.https.HttpsError(
        'internal',
        `Failed to check batch status: ${axiosError.message}`
      );
    }
  }

  /**
   * Parse batch results into individual view results
   *
   * For inline requests, results are in dest.inlined_responses[]
   */
  parseResults(
    statusResponse: BatchStatusResponse,
    originalRequests: BatchRequest[]
  ): BatchResult[] {
    const results: BatchResult[] = [];
    // Use correct path: dest.inlined_responses for inline requests
    const inlinedResponses = statusResponse.dest?.inlined_responses || [];

    functions.logger.info('Parsing batch results', {
      hasDest: !!statusResponse.dest,
      inlinedCount: inlinedResponses.length,
      requestCount: originalRequests.length,
    });

    for (let i = 0; i < originalRequests.length; i++) {
      const request = originalRequests[i];
      const inlineResponse = inlinedResponses[i];

      if (!inlineResponse) {
        results.push({
          index: i,
          viewType: request.viewType,
          angle: request.angle,
          success: false,
          error: 'No response for this request',
        });
        continue;
      }

      // Check for error in this specific request
      if (inlineResponse.error) {
        results.push({
          index: i,
          viewType: request.viewType,
          angle: request.angle,
          success: false,
          error: `${inlineResponse.error.code}: ${inlineResponse.error.message}`,
        });
        continue;
      }

      // Extract image data from response
      const candidate = inlineResponse.response?.candidates?.[0];
      const parts = candidate?.content?.parts || [];
      const imagePart = parts.find((p) => p.inlineData?.data);
      const textParts = parts.filter((p) => p.text).map((p) => p.text).join('\n');

      if (!imagePart) {
        results.push({
          index: i,
          viewType: request.viewType,
          angle: request.angle,
          success: false,
          error: 'No image in response',
        });
        continue;
      }

      // Extract color palette from text if present
      let colorPalette: string[] | undefined;
      if (textParts) {
        const colorMatches = textParts.match(/#[0-9A-Fa-f]{6}/gi);
        if (colorMatches && colorMatches.length > 0) {
          colorPalette = colorMatches.map((c) => c.toUpperCase());
        }
      }

      results.push({
        index: i,
        viewType: request.viewType,
        angle: request.angle,
        success: true,
        imageBase64: imagePart.inlineData!.data,
        mimeType: imagePart.inlineData!.mimeType,
        textContent: textParts || undefined,
        colorPalette,
      });
    }

    return results;
  }

  /**
   * Map batch job state to our internal status
   */
  static mapJobState(state: GeminiBatchJobState): 'pending' | 'running' | 'succeeded' | 'failed' {
    switch (state) {
      case 'JOB_STATE_PENDING':
        return 'pending';
      case 'JOB_STATE_RUNNING':
        return 'running';
      case 'JOB_STATE_SUCCEEDED':
        return 'succeeded';
      case 'JOB_STATE_FAILED':
      case 'JOB_STATE_CANCELLED':
        return 'failed';
      default:
        return 'pending';
    }
  }
}

/**
 * Create a new batch client instance
 */
export function createBatchClient(apiKey: string): GeminiBatchClient {
  return new GeminiBatchClient(apiKey);
}
