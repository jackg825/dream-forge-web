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
 * 6. Call Rodin API with multi-image support
 * 7. Update job with Rodin task ID
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
 * Cloud Function: generateTexture
 *
 * Generates PBR textures for an existing 3D model.
 *
 * Workflow:
 * 1. User generates a model (generateModel)
 * 2. User previews the model
 * 3. User uploads a reference image and calls generateTexture
 * 4. Rodin applies textures based on the reference image
 *
 * Steps:
 * 1. Verify authentication and job ownership
 * 2. Validate source job exists and is completed
 * 3. Deduct 0.5 credits
 * 4. Download the existing model from Storage
 * 5. Download the reference image
 * 6. Call Rodin texture API
 * 7. Create texture job document
 * 8. Return job ID for status polling
 */
export declare const generateTexture: functions.HttpsFunction & functions.Runnable<any>;
