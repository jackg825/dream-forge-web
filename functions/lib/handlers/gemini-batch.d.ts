/**
 * Gemini Batch API Handlers
 *
 * Cloud Functions for batch image generation:
 * - submitGeminiBatch: Submit a batch job for a pipeline
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
