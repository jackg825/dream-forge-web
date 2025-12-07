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
/**
 * Cloud Function: checkAllProviderBalances
 *
 * Admin-only function to check all provider balances at once.
 * More efficient than calling each balance check individually.
 *
 * Returns:
 * - rodin: number (balance)
 * - meshy: number (credits)
 * - tripo: { balance: number, frozen: number }
 * - hunyuan: 'free-tier' (no API available)
 */
export declare const checkAllProviderBalances: functions.HttpsFunction & functions.Runnable<any>;
/**
 * Cloud Function: adminRegeneratePipelineImage
 *
 * Admin-only function to regenerate a pipeline image without credit deduction.
 * Stores result in adminPreview for confirmation before overwriting.
 */
export declare const adminRegeneratePipelineImage: functions.HttpsFunction & functions.Runnable<any>;
/**
 * Cloud Function: adminStartPipelineMesh
 *
 * Admin-only function to regenerate mesh with optional provider change.
 * No credit deduction. Stores result in adminPreview.
 */
export declare const adminStartPipelineMesh: functions.HttpsFunction & functions.Runnable<any>;
/**
 * Cloud Function: adminCheckPreviewStatus
 *
 * Admin-only function to check status of mesh/texture regeneration in preview.
 */
export declare const adminCheckPreviewStatus: functions.HttpsFunction & functions.Runnable<any>;
/**
 * Cloud Function: adminConfirmPreview
 *
 * Admin-only function to confirm preview and overwrite production data.
 */
export declare const adminConfirmPreview: functions.HttpsFunction & functions.Runnable<any>;
/**
 * Cloud Function: adminRejectPreview
 *
 * Admin-only function to reject preview and discard changes.
 */
export declare const adminRejectPreview: functions.HttpsFunction & functions.Runnable<any>;
