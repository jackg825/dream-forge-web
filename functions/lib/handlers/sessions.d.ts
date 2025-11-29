/**
 * Session Management Cloud Functions
 *
 * Handles the multi-step 3D model creation flow:
 * 1. createSession - Initialize a new workflow session
 * 2. getSession - Retrieve session state for resuming
 * 3. updateSession - Update session data (images, settings)
 * 4. deleteSession - Remove a session and its files
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
 * getSession - Retrieve session state
 *
 * Used for page refresh or resuming a session.
 */
export declare const getSession: functions.HttpsFunction & functions.Runnable<any>;
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
