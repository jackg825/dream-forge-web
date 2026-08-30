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
import { analyzeImage, type ImageAnalysisResult } from '../gemini/image-analyzer';
import type { PrinterType } from '../rodin/types';
import type { StyleId } from '../config/styles';
import { downloadValidatedImageAsBase64 } from '../utils/storage-validation';
import { isValidStyleId } from '../config/styles';

const MAX_ANALYSES_PER_UTC_DAY = 10;
const ANALYSIS_COOLDOWN_MS = 10_000;
const SUPPORTED_PRINTER_TYPES = new Set<PrinterType>(['fdm', 'sla', 'resin']);
const SUPPORTED_LOCALES = new Set(['zh-TW', 'en']);

async function reserveAnalysisQuota(userId: string): Promise<void> {
  const db = admin.firestore();
  const userRef = db.collection('users').doc(userId);
  const now = admin.firestore.Timestamp.now();
  const quotaDay = now.toDate().toISOString().slice(0, 10);

  await db.runTransaction(async (transaction) => {
    const userSnapshot = await transaction.get(userRef);
    if (!userSnapshot.exists) {
      throw new functions.https.HttpsError('failed-precondition', 'User profile is not ready');
    }

    const user = userSnapshot.data() || {};
    const currentCount = user.analysisQuotaDay === quotaDay
      ? Number(user.analysisQuotaCount || 0)
      : 0;
    const lastAnalysisAt = user.lastAnalysisAt as admin.firestore.Timestamp | undefined;

    if (
      lastAnalysisAt &&
      now.toMillis() - lastAnalysisAt.toMillis() < ANALYSIS_COOLDOWN_MS
    ) {
      throw new functions.https.HttpsError(
        'resource-exhausted',
        'Please wait before analyzing another image'
      );
    }
    if (currentCount >= MAX_ANALYSES_PER_UTC_DAY) {
      throw new functions.https.HttpsError(
        'resource-exhausted',
        'Daily image analysis limit reached'
      );
    }

    transaction.update(userRef, {
      analysisQuotaDay: quotaDay,
      analysisQuotaCount: currentCount + 1,
      lastAnalysisAt: now,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
  });
}

// ============================================
// Request/Response Types
// ============================================

interface AnalyzeUploadedImageData {
  imageUrl: string;        // URL of uploaded image in Firebase Storage
  colorCount?: number;     // Number of colors to extract (3-12, default: 7)
  printerType?: PrinterType; // Printer type for recommendations (default: 'fdm')
  locale?: string;         // User's locale for response language (default: 'zh-TW')
  selectedStyle?: StyleId; // User-selected figure style for context-aware analysis
}

interface AnalyzeUploadedImageResponse {
  analysis: ImageAnalysisResult;
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
 * The analysis does not consume generation credits, but is email-verified and
 * rate-limited to protect the paid provider from automated abuse. It is used to:
 * - Pre-populate description for better AI generation
 * - Extract color palette for consistency
 * - Provide 3D print friendliness feedback
 */
export const analyzeUploadedImage = functions
  .region('asia-east1')
  .runWith({
    timeoutSeconds: 120,
    memory: '512MB',
    secrets: ['GEMINI_API_KEY'],
  })
  .https.onCall(async (data: AnalyzeUploadedImageData, context): Promise<AnalyzeUploadedImageResponse> => {
    // Verify authentication
    if (!context.auth) {
      throw new functions.https.HttpsError(
        'unauthenticated',
        'You must be logged in to analyze images'
      );
    }
    if (context.auth.token.email_verified !== true) {
      throw new functions.https.HttpsError(
        'failed-precondition',
        'Verify your email before analyzing images'
      );
    }

    const userId = context.auth.uid;
    const { imageUrl, colorCount = 7, printerType = 'fdm', locale = 'zh-TW', selectedStyle } = data || {};

    // Validate input
    if (!imageUrl) {
      throw new functions.https.HttpsError(
        'invalid-argument',
        'imageUrl is required'
      );
    }

    if (!Number.isInteger(colorCount) || colorCount < 3 || colorCount > 12) {
      throw new functions.https.HttpsError('invalid-argument', 'colorCount must be an integer from 3 to 12');
    }
    if (!SUPPORTED_PRINTER_TYPES.has(printerType)) {
      throw new functions.https.HttpsError('invalid-argument', 'Unsupported printer type');
    }
    if (!SUPPORTED_LOCALES.has(locale)) {
      throw new functions.https.HttpsError('invalid-argument', 'Unsupported locale');
    }
    if (selectedStyle !== undefined && !isValidStyleId(selectedStyle)) {
      throw new functions.https.HttpsError('invalid-argument', 'Unsupported style');
    }

    await reserveAnalysisQuota(userId);

    functions.logger.info('Starting image analysis', {
      userId,
      colorCount,
      printerType,
      selectedStyle: selectedStyle || 'none',
    });

    try {
      // Download image
      const { base64, mimeType, storagePath } = await downloadValidatedImageAsBase64(
        imageUrl,
        userId,
        ['uploads']
      );

      functions.logger.info('Image downloaded', {
        mimeType,
        base64Length: base64.length,
        storagePath,
      });

      // Analyze image with optional style context
      const analysisResult = await analyzeImage(base64, mimeType, {
        colorCount,
        printerType,
        locale,
        selectedStyle,
      });

      // Add timestamp
      const analysis: ImageAnalysisResult = {
        ...analysisResult,
        analyzedAt: admin.firestore.Timestamp.now(),
      };

      functions.logger.info('Image analysis complete', {
        userId,
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
        userId,
        error: errorMessage,
      });

      throw new functions.https.HttpsError(
        'internal',
        'Image analysis failed'
      );
    }
  });
