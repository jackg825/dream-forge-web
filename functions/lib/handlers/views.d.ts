/**
 * View Generation Cloud Functions for Multi-Step Flow
 *
 * Handles AI-based view generation from the original uploaded image:
 * - generateSessionViews: Generate views for selected angles using Gemini
 * - regenerateView: Regenerate a single view (charges 1 credit)
 */
import * as functions from 'firebase-functions/v1';
/**
 * generateSessionViews - Generate AI views for a session
 *
 * Takes the original uploaded image and generates the selected view angles.
 * Charges VIEW_GENERATION credit cost (1 credit).
 */
export declare const generateSessionViews: functions.HttpsFunction & functions.Runnable<any>;
/**
 * regenerateView - Regenerate a single view angle
 *
 * Allows users to regenerate a specific view if they're not satisfied.
 * Charges VIEW_GENERATION credit cost (1 credit) per regeneration.
 */
export declare const regenerateView: functions.HttpsFunction & functions.Runnable<any>;
/**
 * uploadCustomView - Allow user to upload a custom view image
 *
 * This doesn't charge credits - users can replace AI views with their own.
 */
export declare const uploadCustomView: functions.HttpsFunction & functions.Runnable<any>;
