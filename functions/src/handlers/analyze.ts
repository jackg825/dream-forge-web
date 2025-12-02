/**
 * Image Analysis Handler
 *
 * Cloud Function for analyzing uploaded images using Gemini.
 * Returns structured analysis including:
 * - Object description
 * - Color palette
 * - 3D print friendliness assessment
 * - Material detection
 */

import * as functions from 'firebase-functions/v1';
import * as admin from 'firebase-admin';
import axios from 'axios';
import { analyzeImage, type ImageAnalysisResult } from '../gemini/image-analyzer';
import type { PrinterType } from '../rodin/types';

// ============================================
// Request/Response Types
// ============================================

interface AnalyzeUploadedImageData {
  imageUrl: string;        // URL of uploaded image in Firebase Storage
  colorCount?: number;     // Number of colors to extract (3-12, default: 7)
  printerType?: PrinterType; // Printer type for recommendations (default: 'fdm')
}

interface AnalyzeUploadedImageResponse {
  analysis: ImageAnalysisResult;
}

// ============================================
// Helper Functions
// ============================================

/**
 * Download image and convert to base64
 */
async function downloadImageAsBase64(url: string): Promise<{ base64: string; mimeType: string }> {
  const response = await axios.get(url, {
    responseType: 'arraybuffer',
    timeout: 30000,
  });

  const base64 = Buffer.from(response.data).toString('base64');
  const contentType = response.headers['content-type'] || 'image/png';

  return { base64, mimeType: contentType };
}

// ============================================
// Cloud Function: analyzeUploadedImage
// ============================================

/**
 * Analyze an uploaded image using Gemini
 *
 * This function:
 * 1. Downloads the image from Firebase Storage
 * 2. Sends it to Gemini for analysis
 * 3. Returns structured analysis results
 *
 * The analysis is free (no credits charged) and is used to:
 * - Pre-populate description for better AI generation
 * - Extract color palette for consistency
 * - Provide 3D print friendliness feedback
 */
export const analyzeUploadedImage = functions
  .region('asia-east1')
  .runWith({
    timeoutSeconds: 120,
    memory: '512MB',
  })
  .https.onCall(async (data: AnalyzeUploadedImageData, context): Promise<AnalyzeUploadedImageResponse> => {
    // Verify authentication
    if (!context.auth) {
      throw new functions.https.HttpsError(
        'unauthenticated',
        'You must be logged in to analyze images'
      );
    }

    const { imageUrl, colorCount = 7, printerType = 'fdm' } = data;

    // Validate input
    if (!imageUrl) {
      throw new functions.https.HttpsError(
        'invalid-argument',
        'imageUrl is required'
      );
    }

    // Validate color count (3-12)
    const validColorCount = Math.min(12, Math.max(3, colorCount));

    functions.logger.info('Starting image analysis', {
      userId: context.auth.uid,
      colorCount: validColorCount,
      printerType,
    });

    try {
      // Download image
      const { base64, mimeType } = await downloadImageAsBase64(imageUrl);

      functions.logger.info('Image downloaded', {
        mimeType,
        base64Length: base64.length,
      });

      // Analyze image
      const analysisResult = await analyzeImage(base64, mimeType, {
        colorCount: validColorCount,
        printerType,
      });

      // Add timestamp
      const analysis: ImageAnalysisResult = {
        ...analysisResult,
        analyzedAt: admin.firestore.Timestamp.now(),
      };

      functions.logger.info('Image analysis complete', {
        userId: context.auth.uid,
        colorCount: analysis.colorPalette.length,
        objectType: analysis.objectType,
        printScore: analysis.printFriendliness.score,
      });

      return { analysis };
    } catch (error) {
      if (error instanceof functions.https.HttpsError) {
        throw error;
      }

      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      functions.logger.error('Image analysis failed', {
        userId: context.auth.uid,
        error: errorMessage,
      });

      throw new functions.https.HttpsError(
        'internal',
        `Image analysis failed: ${errorMessage}`
      );
    }
  });
