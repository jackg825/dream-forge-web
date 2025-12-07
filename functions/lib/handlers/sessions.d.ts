/**
 * Session Management Cloud Functions
 *
 * Handles the multi-step 3D model creation flow:
 * 1. createSession - Initialize a new workflow session
 * 2. updateSession - Update session data (images, settings)
 * 3. deleteSession - Remove a session and its files
 * 4. getUserSessions - List all user sessions
 */
import * as functions from 'firebase-functions/v1';
/**
 * createSession - Initialize a new workflow session
 *
 * Creates a new session document in 'draft' status.
 * Automatically cleans up old drafts if user exceeds limit.
 */
export declare const createSession: functions.HttpsFunction & functions.Runnable<any>;
/**
 * updateSession - Update session data
 *
 * Used to save original image, selected angles, and settings.
 */
export declare const updateSession: functions.HttpsFunction & functions.Runnable<any>;
/**
 * deleteSession - Remove a session and its files
 */
export declare const deleteSession: functions.HttpsFunction & functions.Runnable<any>;
/**
 * getUserSessions - Get all sessions for a user
 */
export declare const getUserSessions: functions.HttpsFunction & functions.Runnable<any>;
