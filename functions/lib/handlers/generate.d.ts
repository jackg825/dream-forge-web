import * as functions from 'firebase-functions/v1';
/**
 * Cloud Function: generateModel
 *
 * Starts a new 3D model generation job with support for:
 * - Single image mode (1 credit)
 * - Multi-image upload mode (1 credit)
 * - AI-generated views mode using Gemini (2 credits)
 *
 * Steps:
 * 1. Verify authentication
 * 2. Calculate credit cost based on input mode
 * 3. Deduct credits
 * 4. Create job document
 * 5. Prepare images (download uploaded or generate via Gemini)
 * 6. Call provider API (Rodin or Meshy)
 * 7. Update job with provider task ID
 * 8. Return job ID to client
 */
export declare const generateModel: functions.HttpsFunction & functions.Runnable<any>;
/**
 * Cloud Function: checkJobStatus
 *
 * Polls the status of a generation job.
 *
 * Steps:
 * 1. Verify authentication and job ownership
 * 2. Poll Rodin status API
 * 3. If 'Done': Download model, upload to Storage, update job
 * 4. If 'Failed': Update job with error, refund credit
 * 5. Return current status
 */
export declare const checkJobStatus: functions.HttpsFunction & functions.Runnable<any>;
/**
 * Cloud Function: retryFailedJob
 *
 * Retries a failed job by re-attempting the download process.
 * Only works for jobs that failed during the download phase
 * (i.e., have a valid rodinTaskUuid but failed to get download URLs).
 *
 * @param jobId - The ID of the failed job to retry
 */
export declare const retryFailedJob: functions.HttpsFunction & functions.Runnable<any>;
