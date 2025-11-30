/**
 * H2C Color Optimization Cloud Functions
 *
 * Provides endpoints for optimizing images for Bambu Lab H2C
 * 7-color multi-material 3D printing
 */

import * as functions from 'firebase-functions/v1';
import * as admin from 'firebase-admin';
import axios from 'axios';
import { createH2CColorOptimizer } from '../gemini/h2c-optimizer';
import { deductCredits } from '../utils/credits';

const storage = admin.storage();

// Credit cost for H2C operations
const H2C_CREDIT_COSTS = {
  OPTIMIZE: 1,
  // Note: 3D generation uses the existing generateModel function's credit cost
} as const;

/**
 * Request data for color optimization
 */
interface OptimizeColorsRequest {
  /** Firebase Storage URL of the original image */
  imageUrl: string;
  /** Storage path of the original image (for reference) */
  storagePath?: string;
}

/**
 * Response data for color optimization
 */
interface OptimizeColorsResponse {
  success: boolean;
  /** URL of the optimized image in Firebase Storage */
  optimizedImageUrl: string;
  /** Storage path of the optimized image */
  optimizedStoragePath: string;
  /** Array of 7 HEX color values */
  colorPalette: string[];
  /** Number of credits charged */
  creditsCharged: number;
}

/**
 * Download image from URL and convert to base64
 */
async function downloadImageAsBase64(
  url: string
): Promise<{ base64: string; mimeType: string }> {
  const response = await axios.get(url, {
    responseType: 'arraybuffer',
    timeout: 30000,
  });

  const buffer = Buffer.from(response.data);
  const base64 = buffer.toString('base64');

  // Determine MIME type from content-type header or default to png
  const contentType = response.headers['content-type'] || 'image/png';
  const mimeType = contentType.split(';')[0].trim();

  return { base64, mimeType };
}

/**
 * Upload base64 image to Firebase Storage
 */
async function uploadImageToStorage(
  base64: string,
  mimeType: string,
  storagePath: string
): Promise<string> {
  const bucket = storage.bucket();
  const file = bucket.file(storagePath);

  const buffer = Buffer.from(base64, 'base64');

  await file.save(buffer, {
    metadata: {
      contentType: mimeType,
    },
  });

  // Generate a signed URL valid for 7 days
  const [signedUrl] = await file.getSignedUrl({
    action: 'read',
    expires: Date.now() + 7 * 24 * 60 * 60 * 1000,
  });

  return signedUrl;
}

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
export const optimizeColorsForH2C = functions
  .region('asia-east1')
  .runWith({
    timeoutSeconds: 120,
    memory: '1GB',
    secrets: ['GEMINI_API_KEY'],
  })
  .https.onCall(
    async (
      data: OptimizeColorsRequest,
      context: functions.https.CallableContext
    ): Promise<OptimizeColorsResponse> => {
      // 1. Verify authentication
      if (!context.auth) {
        throw new functions.https.HttpsError(
          'unauthenticated',
          'You must be logged in to optimize images'
        );
      }

      const userId = context.auth.uid;
      const { imageUrl, storagePath } = data;

      // Validate input
      if (!imageUrl) {
        throw new functions.https.HttpsError(
          'invalid-argument',
          'Image URL is required'
        );
      }

      functions.logger.info('Starting H2C color optimization', {
        userId,
        hasStoragePath: !!storagePath,
      });

      // 2. Deduct credits first (fail fast if insufficient)
      // Generate a unique operation ID for tracking
      const operationId = `h2c_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      try {
        await deductCredits(userId, H2C_CREDIT_COSTS.OPTIMIZE, operationId);
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : 'Unknown error';
        functions.logger.error('Failed to deduct credits for H2C optimization', {
          userId,
          error: errorMessage,
        });
        throw new functions.https.HttpsError(
          'failed-precondition',
          `Insufficient credits: ${errorMessage}`
        );
      }

      try {
        // 3. Download original image
        functions.logger.info('Downloading original image', { imageUrl });
        const { base64, mimeType } = await downloadImageAsBase64(imageUrl);

        // 4. Call Gemini for optimization
        functions.logger.info('Calling Gemini for H2C optimization');
        const optimizer = createH2CColorOptimizer();
        const result = await optimizer.optimize(base64, mimeType);

        // 5. Upload optimized image to Storage
        const timestamp = Date.now();
        const extension = result.mimeType === 'image/jpeg' ? 'jpg' : 'png';
        const optimizedStoragePath = `h2c/${userId}/${timestamp}_optimized.${extension}`;

        functions.logger.info('Uploading optimized image to Storage', {
          storagePath: optimizedStoragePath,
        });

        const optimizedImageUrl = await uploadImageToStorage(
          result.imageBase64,
          result.mimeType,
          optimizedStoragePath
        );

        // 6. Log success and return result
        functions.logger.info('H2C optimization complete', {
          userId,
          operationId,
          colorPaletteCount: result.colorPalette.length,
          optimizedStoragePath,
        });

        return {
          success: true,
          optimizedImageUrl,
          optimizedStoragePath,
          colorPalette: result.colorPalette,
          creditsCharged: H2C_CREDIT_COSTS.OPTIMIZE,
        };
      } catch (error) {
        // Log error but don't refund (keep credit deduction for failed attempts)
        // This prevents abuse of free retries
        const errorMessage =
          error instanceof Error ? error.message : 'Unknown error';

        functions.logger.error('H2C optimization failed', {
          userId,
          operationId,
          error: errorMessage,
        });

        // Re-throw HttpsError as-is, wrap other errors
        if (error instanceof functions.https.HttpsError) {
          throw error;
        }

        throw new functions.https.HttpsError(
          'internal',
          `Color optimization failed: ${errorMessage}`
        );
      }
    }
  );

/**
 * Request data for uploading edited image
 */
interface UploadEditedImageRequest {
  /** Base64 encoded edited image */
  imageBase64: string;
  /** MIME type of the image */
  mimeType: string;
}

/**
 * Response data for uploaded image
 */
interface UploadEditedImageResponse {
  success: boolean;
  imageUrl: string;
  storagePath: string;
}

/**
 * Cloud Function: uploadEditedH2CImage
 *
 * Allows users to upload an externally edited image
 * to replace the AI-optimized version.
 *
 * Cost: Free (user provides their own edited image)
 */
export const uploadEditedH2CImage = functions
  .region('asia-east1')
  .runWith({
    timeoutSeconds: 60,
    memory: '512MB',
  })
  .https.onCall(
    async (
      data: UploadEditedImageRequest,
      context: functions.https.CallableContext
    ): Promise<UploadEditedImageResponse> => {
      // 1. Verify authentication
      if (!context.auth) {
        throw new functions.https.HttpsError(
          'unauthenticated',
          'You must be logged in to upload images'
        );
      }

      const userId = context.auth.uid;
      const { imageBase64, mimeType } = data;

      // Validate input
      if (!imageBase64) {
        throw new functions.https.HttpsError(
          'invalid-argument',
          'Image data is required'
        );
      }

      const validMimeTypes = ['image/png', 'image/jpeg', 'image/webp'];
      const normalizedMimeType = validMimeTypes.includes(mimeType)
        ? mimeType
        : 'image/png';

      // Upload to Storage (no credit charge)
      const timestamp = Date.now();
      const extension =
        normalizedMimeType === 'image/jpeg'
          ? 'jpg'
          : normalizedMimeType === 'image/webp'
            ? 'webp'
            : 'png';
      const storagePath = `h2c/${userId}/${timestamp}_edited.${extension}`;

      functions.logger.info('Uploading user-edited H2C image', {
        userId,
        storagePath,
        mimeType: normalizedMimeType,
      });

      const imageUrl = await uploadImageToStorage(
        imageBase64,
        normalizedMimeType,
        storagePath
      );

      return {
        success: true,
        imageUrl,
        storagePath,
      };
    }
  );
