import * as functions from 'firebase-functions';
/**
 * Cloud Function: generateModel
 *
 * Starts a new 3D model generation job.
 *
 * Steps:
 * 1. Verify authentication
 * 2. Check user has sufficient credits
 * 3. Deduct 1 credit
 * 4. Create job document
 * 5. Call Rodin API to start generation
 * 6. Update job with Rodin task ID
 * 7. Return job ID to client
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
