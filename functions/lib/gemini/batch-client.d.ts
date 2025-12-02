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
import { type GenerationModeId } from './mode-configs';
/**
 * Batch job status from Gemini API
 */
export type GeminiBatchJobState = 'JOB_STATE_PENDING' | 'JOB_STATE_RUNNING' | 'JOB_STATE_SUCCEEDED' | 'JOB_STATE_FAILED' | 'JOB_STATE_CANCELLED';
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
    name: string;
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
export declare class GeminiBatchClient {
    private apiKey;
    constructor(apiKey: string);
    /**
     * Build batch requests for all 6 views
     */
    buildBatchRequests(referenceImageBase64: string, mimeType: string, modeId: GenerationModeId, userDescription?: string): BatchRequest[];
    /**
     * Submit a batch of generation requests
     *
     * Uses inline requests format (suitable for <20MB total request size)
     */
    submitBatch(referenceImageBase64: string, mimeType: string, requests: BatchRequest[]): Promise<BatchSubmitResponse>;
    /**
     * Check the status of a batch job
     */
    checkStatus(operationName: string): Promise<BatchStatusResponse>;
    /**
     * Parse batch results into individual view results
     *
     * For inline requests, results are in dest.inlined_responses[]
     */
    parseResults(statusResponse: BatchStatusResponse, originalRequests: BatchRequest[]): BatchResult[];
    /**
     * Map batch job state to our internal status
     */
    static mapJobState(state: GeminiBatchJobState): 'pending' | 'running' | 'succeeded' | 'failed';
}
/**
 * Create a new batch client instance
 */
export declare function createBatchClient(apiKey: string): GeminiBatchClient;
export {};
