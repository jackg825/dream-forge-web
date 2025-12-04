import * as functions from 'firebase-functions/v1';
/**
 * Cloud Function: addCredits
 *
 * Admin-only function to add credits to a user's account.
 *
 * Usage:
 * - Call from Firebase Console or via httpsCallable
 * - Requires admin authentication
 */
export declare const addCredits: functions.HttpsFunction & functions.Runnable<any>;
/**
 * Cloud Function: setUnlimitedCredits
 *
 * Admin-only function to give a user unlimited credits (or revoke).
 * Sets credits to a very high number (999999) as a flag.
 */
export declare const setUnlimitedCredits: functions.HttpsFunction & functions.Runnable<any>;
/**
 * Cloud Function: checkRodinBalance
 *
 * Admin-only function to check remaining Rodin API credits.
 * Useful for monitoring API usage on the admin dashboard.
 *
 * See: https://developer.hyper3d.ai/api-specification/check_balance
 */
export declare const checkRodinBalance: functions.HttpsFunction & functions.Runnable<any>;
/**
 * Cloud Function: getAdminStats
 *
 * Admin-only function to get system-wide statistics.
 */
export declare const getAdminStats: functions.HttpsFunction & functions.Runnable<any>;
/**
 * Cloud Function: listUsers
 *
 * Admin-only function to list all users with their credits and stats.
 */
export declare const listUsers: functions.HttpsFunction & functions.Runnable<any>;
/**
 * Cloud Function: listAllPipelines
 *
 * Admin-only function to list all pipelines across all users.
 * Supports filtering by status and userId.
 */
export declare const listAllPipelines: functions.HttpsFunction & functions.Runnable<any>;
/**
 * Cloud Function: deductCredits
 *
 * Admin-only function to deduct credits from a user's account.
 * Requires a reason for audit trail purposes.
 */
export declare const deductCredits: functions.HttpsFunction & functions.Runnable<any>;
/**
 * Cloud Function: getUserTransactions
 *
 * Admin-only function to get transaction history for a specific user.
 */
export declare const getUserTransactions: functions.HttpsFunction & functions.Runnable<any>;
