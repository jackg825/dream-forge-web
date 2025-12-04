/**
 * Convert Handlers
 *
 * Cloud Functions for 3D model format conversion.
 * Primary use case: GLB to USDZ conversion for iOS AR Quick Look.
 */
import * as functions from 'firebase-functions/v1';
/**
 * Convert a pipeline's GLB model to USDZ format for iOS AR Quick Look.
 *
 * This function:
 * 1. Checks if USDZ already exists (returns cached URL if so)
 * 2. Downloads the GLB file
 * 3. Converts to USDZ
 * 4. Uploads to storage
 * 5. Returns signed URL
 *
 * @param pipelineId - The pipeline ID containing the GLB model
 * @returns Object containing usdzUrl and cached flag
 */
export declare const convertToUsdz: functions.HttpsFunction & functions.Runnable<any>;
/**
 * Check if USDZ is available for a pipeline (without triggering conversion).
 *
 * Useful for checking availability before showing AR button on iOS.
 */
export declare const checkUsdzAvailability: functions.HttpsFunction & functions.Runnable<any>;
