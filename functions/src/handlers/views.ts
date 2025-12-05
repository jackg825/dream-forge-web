/**
 * View Generation Cloud Functions for Multi-Step Flow
 *
 * Handles AI-based view generation from the original uploaded image:
 * - generateSessionViews: Generate views for selected angles using Gemini
 * - regenerateView: Regenerate a single view (charges 1 credit)
 */

import * as functions from 'firebase-functions/v1';
import * as admin from 'firebase-admin';
import axios from 'axios';
import { createGeminiClient } from '../gemini/client';
import { deductCredits } from '../utils/credits';
import { uploadBase64, downloadFile } from '../storage';
import type { SessionDocument, ViewAngle } from '../rodin/types';
import { SESSION_CREDIT_COSTS } from '../rodin/types';

const db = admin.firestore();

/**
 * Download image from URL or Storage path
 */
async function downloadImage(
  url: string,
  storagePath?: string
): Promise<{ buffer: Buffer; mimeType: string }> {
  // If we have a storage path, download from storage (Firebase or R2)
  if (storagePath) {
    const buffer = await downloadFile(storagePath);
    // Infer mime type from extension
    const ext = storagePath.split('.').pop()?.toLowerCase();
    const mimeType =
      ext === 'jpg' || ext === 'jpeg'
        ? 'image/jpeg'
        : ext === 'png'
          ? 'image/png'
          : ext === 'webp'
            ? 'image/webp'
            : 'image/png';
    return { buffer, mimeType };
  }

  // Otherwise download from URL
  const response = await axios.get(url, {
    responseType: 'arraybuffer',
    timeout: 30000,
  });

  return {
    buffer: Buffer.from(response.data),
    mimeType: response.headers['content-type'] || 'image/png',
  };
}

/**
 * Upload generated view to storage (Firebase or R2)
 */
async function uploadGeneratedView(
  sessionId: string,
  userId: string,
  angle: ViewAngle,
  imageBase64: string,
  mimeType: string
): Promise<{ url: string; storagePath: string }> {
  const extension = mimeType.split('/')[1] || 'png';
  const storagePath = `sessions/${userId}/${sessionId}/views/${angle}.${extension}`;

  // Use storage abstraction layer
  const url = await uploadBase64(imageBase64, storagePath, mimeType);

  return { url, storagePath };
}

/**
 * generateSessionViews - Generate AI views for a session
 *
 * Takes the original uploaded image and generates the selected view angles.
 * Charges VIEW_GENERATION credit cost (1 credit).
 */
export const generateSessionViews = functions
  .region('asia-east1')
  .runWith({
    timeoutSeconds: 300, // 5 minutes for multiple view generation
    memory: '512MB',
  })
  .https.onCall(
    async (
      data: {
        sessionId: string;
      },
      context: functions.https.CallableContext
    ) => {
      // Verify authentication
      if (!context.auth) {
        throw new functions.https.HttpsError(
          'unauthenticated',
          'Must be logged in'
        );
      }

      const { sessionId } = data;
      if (!sessionId) {
        throw new functions.https.HttpsError(
          'invalid-argument',
          'Session ID is required'
        );
      }

      const userId = context.auth.uid;

      // Get session
      const sessionRef = db.collection('sessions').doc(sessionId);
      const sessionDoc = await sessionRef.get();

      if (!sessionDoc.exists) {
        throw new functions.https.HttpsError('not-found', 'Session not found');
      }

      const session = sessionDoc.data() as SessionDocument;

      // Verify ownership
      if (session.userId !== userId) {
        throw new functions.https.HttpsError(
          'permission-denied',
          'Not authorized to access this session'
        );
      }

      // Verify session has original image
      if (!session.originalImage) {
        throw new functions.https.HttpsError(
          'failed-precondition',
          'No original image uploaded'
        );
      }

      // Verify session has selected angles
      if (!session.selectedAngles || session.selectedAngles.length === 0) {
        throw new functions.https.HttpsError(
          'failed-precondition',
          'No angles selected for generation'
        );
      }

      // Deduct credits (throws if insufficient)
      await deductCredits(
        userId,
        SESSION_CREDIT_COSTS.VIEW_GENERATION,
        `view_generation_${sessionId}`
      );

      // Update session status
      await sessionRef.update({
        status: 'generating-views',
        currentStep: 2,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      try {
        // Download original image
        const { buffer, mimeType } = await downloadImage(
          session.originalImage.url,
          session.originalImage.storagePath
        );

        functions.logger.info('Downloaded original image', {
          sessionId,
          mimeType,
          size: buffer.length,
        });

        // Generate views using Gemini
        const geminiClient = createGeminiClient();
        const base64 = buffer.toString('base64');

        const generatedViews = await geminiClient.generateViews(
          base64,
          mimeType,
          session.selectedAngles
        );

        functions.logger.info('Generated views', {
          sessionId,
          count: generatedViews.length,
          angles: generatedViews.map((v) => v.angle),
        });

        // Upload generated views to Storage and update session
        const viewsUpdate: Record<string, unknown> = {};

        for (const view of generatedViews) {
          const { url, storagePath } = await uploadGeneratedView(
            sessionId,
            userId,
            view.angle,
            view.imageBase64,
            view.mimeType
          );

          viewsUpdate[`views.${view.angle}`] = {
            url,
            storagePath,
            source: 'ai',
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
          };
        }

        // Update session with generated views
        await sessionRef.update({
          ...viewsUpdate,
          status: 'views-ready',
          currentStep: 3,
          viewGenerationCount: admin.firestore.FieldValue.increment(1),
          totalCreditsUsed: admin.firestore.FieldValue.increment(
            SESSION_CREDIT_COSTS.VIEW_GENERATION
          ),
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });

        functions.logger.info('Session views generated successfully', {
          sessionId,
          userId,
          viewCount: generatedViews.length,
        });

        return {
          success: true,
          viewCount: generatedViews.length,
          angles: generatedViews.map((v) => v.angle),
        };
      } catch (error) {
        // Update session status to failed
        await sessionRef.update({
          status: 'failed',
          error: error instanceof Error ? error.message : 'View generation failed',
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });

        functions.logger.error('View generation failed', {
          sessionId,
          error: error instanceof Error ? error.message : 'Unknown error',
        });

        throw new functions.https.HttpsError(
          'internal',
          `View generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`
        );
      }
    }
  );

/**
 * regenerateView - Regenerate a single view angle
 *
 * Allows users to regenerate a specific view if they're not satisfied.
 * Charges VIEW_GENERATION credit cost (1 credit) per regeneration.
 */
export const regenerateView = functions
  .region('asia-east1')
  .runWith({
    timeoutSeconds: 120,
    memory: '512MB',
  })
  .https.onCall(
    async (
      data: {
        sessionId: string;
        angle: ViewAngle;
      },
      context: functions.https.CallableContext
    ) => {
      // Verify authentication
      if (!context.auth) {
        throw new functions.https.HttpsError(
          'unauthenticated',
          'Must be logged in'
        );
      }

      const { sessionId, angle } = data;
      if (!sessionId || !angle) {
        throw new functions.https.HttpsError(
          'invalid-argument',
          'Session ID and angle are required'
        );
      }

      const validAngles: ViewAngle[] = ['back', 'left', 'right', 'top'];
      if (!validAngles.includes(angle)) {
        throw new functions.https.HttpsError(
          'invalid-argument',
          `Invalid angle: ${angle}`
        );
      }

      const userId = context.auth.uid;

      // Get session
      const sessionRef = db.collection('sessions').doc(sessionId);
      const sessionDoc = await sessionRef.get();

      if (!sessionDoc.exists) {
        throw new functions.https.HttpsError('not-found', 'Session not found');
      }

      const session = sessionDoc.data() as SessionDocument;

      // Verify ownership
      if (session.userId !== userId) {
        throw new functions.https.HttpsError(
          'permission-denied',
          'Not authorized to access this session'
        );
      }

      // Verify session has original image
      if (!session.originalImage) {
        throw new functions.https.HttpsError(
          'failed-precondition',
          'No original image uploaded'
        );
      }

      // Deduct credits for regeneration (throws if insufficient)
      await deductCredits(
        userId,
        SESSION_CREDIT_COSTS.VIEW_GENERATION,
        `view_regeneration_${sessionId}_${angle}`
      );

      try {
        // Download original image
        const { buffer, mimeType } = await downloadImage(
          session.originalImage.url,
          session.originalImage.storagePath
        );

        // Generate single view using Gemini
        const geminiClient = createGeminiClient();
        const base64 = buffer.toString('base64');

        const generatedViews = await geminiClient.generateViews(
          base64,
          mimeType,
          [angle]
        );

        const view = generatedViews[0];

        // Upload to Storage
        const { url, storagePath } = await uploadGeneratedView(
          sessionId,
          userId,
          view.angle,
          view.imageBase64,
          view.mimeType
        );

        // Update session
        await sessionRef.update({
          [`views.${angle}`]: {
            url,
            storagePath,
            source: 'ai',
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
          },
          viewGenerationCount: admin.firestore.FieldValue.increment(1),
          totalCreditsUsed: admin.firestore.FieldValue.increment(
            SESSION_CREDIT_COSTS.VIEW_GENERATION
          ),
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });

        functions.logger.info('View regenerated successfully', {
          sessionId,
          userId,
          angle,
        });

        return {
          success: true,
          angle,
          url,
        };
      } catch (error) {
        functions.logger.error('View regeneration failed', {
          sessionId,
          angle,
          error: error instanceof Error ? error.message : 'Unknown error',
        });

        throw new functions.https.HttpsError(
          'internal',
          `View regeneration failed: ${error instanceof Error ? error.message : 'Unknown error'}`
        );
      }
    }
  );

/**
 * uploadCustomView - Allow user to upload a custom view image
 *
 * This doesn't charge credits - users can replace AI views with their own.
 */
export const uploadCustomView = functions
  .region('asia-east1')
  .https.onCall(
    async (
      data: {
        sessionId: string;
        angle: ViewAngle;
        imageUrl: string;
        storagePath: string;
      },
      context: functions.https.CallableContext
    ) => {
      // Verify authentication
      if (!context.auth) {
        throw new functions.https.HttpsError(
          'unauthenticated',
          'Must be logged in'
        );
      }

      const { sessionId, angle, imageUrl, storagePath } = data;
      if (!sessionId || !angle || !imageUrl || !storagePath) {
        throw new functions.https.HttpsError(
          'invalid-argument',
          'Session ID, angle, imageUrl, and storagePath are required'
        );
      }

      const validAngles: ViewAngle[] = ['front', 'back', 'left', 'right', 'top'];
      if (!validAngles.includes(angle)) {
        throw new functions.https.HttpsError(
          'invalid-argument',
          `Invalid angle: ${angle}`
        );
      }

      const userId = context.auth.uid;

      // Get session
      const sessionRef = db.collection('sessions').doc(sessionId);
      const sessionDoc = await sessionRef.get();

      if (!sessionDoc.exists) {
        throw new functions.https.HttpsError('not-found', 'Session not found');
      }

      const session = sessionDoc.data() as SessionDocument;

      // Verify ownership
      if (session.userId !== userId) {
        throw new functions.https.HttpsError(
          'permission-denied',
          'Not authorized to access this session'
        );
      }

      // Update session with custom view
      await sessionRef.update({
        [`views.${angle}`]: {
          url: imageUrl,
          storagePath,
          source: 'upload',
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
        },
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      functions.logger.info('Custom view uploaded', {
        sessionId,
        userId,
        angle,
      });

      return {
        success: true,
        angle,
      };
    }
  );
