/**
 * Model Generation Cloud Functions for Multi-Step Flow
 *
 * Handles 3D model generation from session view images:
 * - startSessionModelGeneration: Start Rodin generation using session views
 * - checkSessionModelStatus: Poll status and update session when complete
 */
import * as functions from 'firebase-functions/v1';
/**
 * startSessionModelGeneration - Start 3D model generation from session views
 *
 * Takes view images from a session and starts Rodin generation.
 * Charges MODEL_GENERATION credit cost (1 credit).
 */
export declare const startSessionModelGeneration: functions.HttpsFunction & functions.Runnable<any>;
/**
 * checkSessionModelStatus - Check model generation status and update session
 *
 * Polls Rodin status and updates session when complete.
 */
export declare const checkSessionModelStatus: functions.HttpsFunction & functions.Runnable<any>;
