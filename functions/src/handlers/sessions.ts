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
import * as admin from 'firebase-admin';
import { listFiles, deleteFile } from '../storage';
import type {
  SessionDocument,
  SessionSettings,
  ViewAngle,
  PrintQuality,
  PrinterType,
  OutputFormat,
} from '../rodin/types';
import { MAX_USER_DRAFTS } from '../rodin/types';

const db = admin.firestore();

// Default session settings
const DEFAULT_SETTINGS: SessionSettings = {
  quality: 'standard' as PrintQuality,
  printerType: 'fdm' as PrinterType,
  format: 'stl' as OutputFormat,
};

/**
 * Enforce session limit - delete oldest draft if user has too many
 */
async function enforceSessionLimit(userId: string): Promise<void> {
  const draftsQuery = await db
    .collection('sessions')
    .where('userId', '==', userId)
    .where('status', '==', 'draft')
    .orderBy('createdAt', 'asc')
    .get();

  if (draftsQuery.size >= MAX_USER_DRAFTS) {
    // Delete oldest drafts until we're under the limit
    const toDelete = draftsQuery.size - MAX_USER_DRAFTS + 1;
    const batch = db.batch();

    for (let i = 0; i < toDelete; i++) {
      batch.delete(draftsQuery.docs[i].ref);
      functions.logger.info('Deleting old draft session', {
        sessionId: draftsQuery.docs[i].id,
        userId,
      });
    }

    await batch.commit();
  }
}

/**
 * createSession - Initialize a new workflow session
 *
 * Creates a new session document in 'draft' status.
 * Automatically cleans up old drafts if user exceeds limit.
 */
export const createSession = functions
  .region('asia-east1')
  .https.onCall(
    async (
      data: {
        settings?: Partial<SessionSettings>;
      },
      context: functions.https.CallableContext
    ) => {
      // Verify authentication
      if (!context.auth) {
        throw new functions.https.HttpsError(
          'unauthenticated',
          'Must be logged in to create a session'
        );
      }

      const userId = context.auth.uid;

      // Enforce session limit
      await enforceSessionLimit(userId);

      // Create new session
      const sessionRef = db.collection('sessions').doc();
      const now = admin.firestore.FieldValue.serverTimestamp();

      const sessionData: Omit<SessionDocument, 'createdAt' | 'updatedAt'> & {
        createdAt: FirebaseFirestore.FieldValue;
        updatedAt: FirebaseFirestore.FieldValue;
      } = {
        userId,
        status: 'draft',
        currentStep: 1,
        originalImage: null,
        selectedAngles: ['back', 'left', 'right'], // Default angles
        views: {},
        settings: {
          ...DEFAULT_SETTINGS,
          ...data.settings,
        },
        jobId: null,
        viewGenerationCount: 0,
        totalCreditsUsed: 0,
        createdAt: now,
        updatedAt: now,
      };

      await sessionRef.set(sessionData);

      functions.logger.info('Session created', {
        sessionId: sessionRef.id,
        userId,
      });

      return {
        sessionId: sessionRef.id,
        status: 'draft',
        currentStep: 1,
      };
    }
  );

/**
 * getSession - Retrieve session state
 *
 * Used for page refresh or resuming a session.
 */
export const getSession = functions
  .region('asia-east1')
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

      const sessionDoc = await db.collection('sessions').doc(sessionId).get();

      if (!sessionDoc.exists) {
        throw new functions.https.HttpsError('not-found', 'Session not found');
      }

      const session = sessionDoc.data() as SessionDocument;

      // Verify ownership
      if (session.userId !== context.auth.uid) {
        throw new functions.https.HttpsError(
          'permission-denied',
          'Not authorized to access this session'
        );
      }

      return {
        session: {
          id: sessionDoc.id,
          ...session,
          // Convert timestamps to ISO strings for client
          createdAt: session.createdAt?.toDate?.()?.toISOString() || null,
          updatedAt: session.updatedAt?.toDate?.()?.toISOString() || null,
        },
      };
    }
  );

/**
 * updateSession - Update session data
 *
 * Used to save original image, selected angles, and settings.
 */
export const updateSession = functions
  .region('asia-east1')
  .https.onCall(
    async (
      data: {
        sessionId: string;
        originalImageUrl?: string;
        originalStoragePath?: string;
        selectedAngles?: ViewAngle[];
        settings?: Partial<SessionSettings>;
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

      const { sessionId, originalImageUrl, originalStoragePath, selectedAngles, settings } =
        data;

      if (!sessionId) {
        throw new functions.https.HttpsError(
          'invalid-argument',
          'Session ID is required'
        );
      }

      const sessionRef = db.collection('sessions').doc(sessionId);
      const sessionDoc = await sessionRef.get();

      if (!sessionDoc.exists) {
        throw new functions.https.HttpsError('not-found', 'Session not found');
      }

      const session = sessionDoc.data() as SessionDocument;

      // Verify ownership
      if (session.userId !== context.auth.uid) {
        throw new functions.https.HttpsError(
          'permission-denied',
          'Not authorized to modify this session'
        );
      }

      // Build update object
      const updateData: Record<string, unknown> = {
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      };

      // Update original image
      if (originalImageUrl && originalStoragePath) {
        updateData.originalImage = {
          url: originalImageUrl,
          storagePath: originalStoragePath,
        };
        // Also add to views as 'front' angle
        updateData['views.front'] = {
          url: originalImageUrl,
          storagePath: originalStoragePath,
          source: 'upload',
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
        };
      }

      // Update selected angles
      if (selectedAngles) {
        updateData.selectedAngles = selectedAngles;
      }

      // Update settings
      if (settings) {
        if (settings.quality) updateData['settings.quality'] = settings.quality;
        if (settings.printerType)
          updateData['settings.printerType'] = settings.printerType;
        if (settings.format) updateData['settings.format'] = settings.format;
      }

      await sessionRef.update(updateData);

      functions.logger.info('Session updated', {
        sessionId,
        userId: context.auth.uid,
        updates: Object.keys(updateData),
      });

      return { success: true };
    }
  );

/**
 * deleteSession - Remove a session and its files
 */
export const deleteSession = functions
  .region('asia-east1')
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

      const sessionRef = db.collection('sessions').doc(sessionId);
      const sessionDoc = await sessionRef.get();

      if (!sessionDoc.exists) {
        throw new functions.https.HttpsError('not-found', 'Session not found');
      }

      const session = sessionDoc.data() as SessionDocument;

      // Verify ownership
      if (session.userId !== context.auth.uid) {
        throw new functions.https.HttpsError(
          'permission-denied',
          'Not authorized to delete this session'
        );
      }

      // Delete session files from Storage (Firebase or R2)
      const sessionPath = `sessions/${session.userId}/${sessionId}`;

      try {
        const files = await listFiles(sessionPath);
        await Promise.all(files.map((file) => deleteFile(file.path)));
        functions.logger.info('Deleted session files', {
          sessionId,
          fileCount: files.length,
        });
      } catch (error) {
        functions.logger.warn('Error deleting session files', {
          sessionId,
          error,
        });
      }

      // Delete session document
      await sessionRef.delete();

      functions.logger.info('Session deleted', {
        sessionId,
        userId: context.auth.uid,
      });

      return { success: true };
    }
  );

/**
 * getUserSessions - Get all sessions for a user
 */
export const getUserSessions = functions
  .region('asia-east1')
  .https.onCall(
    async (
      data: {
        limit?: number;
        status?: string;
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

      const userId = context.auth.uid;
      const limit = data.limit || 10;

      let query = db
        .collection('sessions')
        .where('userId', '==', userId)
        .orderBy('updatedAt', 'desc')
        .limit(limit);

      if (data.status) {
        query = query.where('status', '==', data.status);
      }

      const sessionsSnap = await query.get();

      const sessions = sessionsSnap.docs.map((doc) => {
        const session = doc.data() as SessionDocument;
        return {
          id: doc.id,
          ...session,
          createdAt: session.createdAt?.toDate?.()?.toISOString() || null,
          updatedAt: session.updatedAt?.toDate?.()?.toISOString() || null,
        };
      });

      return { sessions };
    }
  );
