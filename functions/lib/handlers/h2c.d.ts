/**
 * H2C Color Optimization Cloud Functions
 *
 * Provides endpoints for optimizing images for Bambu Lab H2C
 * 7-color multi-material 3D printing
 */
import * as functions from 'firebase-functions/v1';
/**
 * Cloud Function: optimizeColorsForH2C
 *
 * Optimizes an image to 7 solid colors for Bambu Lab H2C printing.
 *
 * Cost: 1 credit per optimization
 *
 * Steps:
 * 1. Verify authentication
 * 2. Deduct 1 credit
 * 3. Download original image
 * 4. Call Gemini for 7-color optimization
 * 5. Upload optimized image to Storage
 * 6. Return result with color palette
 */
export declare const optimizeColorsForH2C: functions.HttpsFunction & functions.Runnable<any>;
/**
 * Cloud Function: uploadEditedH2CImage
 *
 * Allows users to upload an externally edited image
 * to replace the AI-optimized version.
 *
 * Cost: Free (user provides their own edited image)
 */
export declare const uploadEditedH2CImage: functions.HttpsFunction & functions.Runnable<any>;
