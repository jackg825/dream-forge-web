/**
 * Gemini Batch API Handlers
 *
 * Cloud Functions for batch image generation:
 * - submitGeminiBatch: Submit a batch job for a pipeline
 * - pollGeminiBatchJobs: Scheduled polling of pending jobs
 * - processGeminiBatchResults: Process completed batch results
 */
import * as functions from 'firebase-functions/v1';
/**
 * Submit a batch job for image generation
 *
 * Callable function that:
 * 1. Validates the pipeline
 * 2. Downloads reference image
 * 3. Submits batch request to Gemini
 * 4. Creates batch job document
 * 5. Updates pipeline status
 */
export declare const submitGeminiBatch: functions.HttpsFunction & functions.Runnable<any>;
/**
 * Poll pending batch jobs
 *
 * Scheduled function that runs every 5 minutes to:
 * 1. Find all pending/running batch jobs
 * 2. Check their status with Gemini API
 * 3. Update job status
 * 4. Process completed jobs
 */
export declare const pollGeminiBatchJobs: functions.CloudFunction<unknown>;
