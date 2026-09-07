import * as functions from 'firebase-functions/v1';
import * as admin from 'firebase-admin';
import { randomUUID } from 'node:crypto';
import type {
  PipelineDocument,
  PipelineMeshAngle,
  PipelineProcessedImage,
  AdminAction,
  UserTier,
} from '../rodin/types';
import type { ProviderType, ProviderOptions } from '../providers/types';
import { createRodinClient } from '../rodin/client';
import { MeshyProvider } from '../providers/meshy/client';
import { TripoProvider } from '../providers/tripo/client';
import { HunyuanProvider } from '../providers/hunyuan/client';
import { ProviderFactory, isValidProvider } from '../providers/factory';
import { createMultiViewGenerator } from '../gemini/multi-view-generator';
import type { GeminiImageModel } from '../gemini/multi-view-generator';
import { getSignedUrlForReference, uploadBase64, uploadBuffer } from '../storage';
import {
  assertUserStorageReference,
  downloadValidatedImageAsBase64,
} from '../utils/storage-validation';

import {
  assertRecord,
  normalizeCallableData,
  assertDocumentId,
  validateCreditAmount,
  validateReason,
  readCreditBalance,
  validatePreviewTarget,
} from '../utils/admin-validation';

const db = admin.firestore();

function parsePaginationValue(
  value: unknown,
  fallback: number,
  minimum: number,
  maximum: number,
  field: string
): number {
  if (value === undefined || value === null) return fallback;
  if (!Number.isInteger(value) || (value as number) < minimum || (value as number) > maximum) {
    throw new functions.https.HttpsError(
      'invalid-argument',
      `${field} must be an integer between ${minimum} and ${maximum}`
    );
  }
  return value as number;
}

// ============================================
// Helper Functions
// ============================================

/**
 * Upload image to storage and get URL
 */
async function uploadImageToStorage(
  base64: string,
  mimeType: string,
  storagePath: string
): Promise<string> {
  return uploadBase64(base64, storagePath, mimeType);
}

/**
 * Get file extension from MIME type
 */
function getExtensionFromMimeType(mimeType: string): string {
  const mimeMap: Record<string, string> = {
    'image/png': 'png',
    'image/jpeg': 'jpg',
    'image/webp': 'webp',
  };
  return mimeMap[mimeType] || 'png';
}

/**
 * Check if the current user is an admin by checking their role in Firestore
 *
 * User document should have: { role: 'admin' | 'user' }
 * Set role to 'admin' directly in Firebase Console to grant admin access
 */
async function isAdmin(context: functions.https.CallableContext): Promise<boolean> {
  if (!context.auth) return false;

  const userDoc = await db.collection('users').doc(context.auth.uid).get();
  if (!userDoc.exists) return false;

  const role = userDoc.data()?.role;
  return role === 'admin';
}

interface AddCreditsData {
  targetUserId: string;  // User ID to add credits to
  amount: number;        // Number of credits to add
  reason?: string;       // Optional reason for the credit addition
}

/**
 * Cloud Function: addCredits
 *
 * Admin-only function to add credits to a user's account.
 *
 * Usage:
 * - Call from Firebase Console or via httpsCallable
 * - Requires admin authentication
 */
export const addCredits = functions
  .region('asia-east1')
  .https.onCall(async (data: AddCreditsData, context) => {
    // Check authentication
    if (!context.auth) {
      throw new functions.https.HttpsError(
        'unauthenticated',
        'Must be logged in'
      );
    }

    // Check admin permission
    if (!(await isAdmin(context))) {
      throw new functions.https.HttpsError(
        'permission-denied',
        'Admin access required'
      );
    }

    data = normalizeCallableData(data);
    const { targetUserId, amount } = data;
    assertDocumentId(targetUserId, 'Target user ID');
    validateCreditAmount(amount);
    const reason = validateReason(data.reason);
    const userRef = db.collection('users').doc(targetUserId);
    const txRef = db.collection('transactions').doc();

    const newCredits = await db.runTransaction(async (transaction) => {
      const userDoc = await transaction.get(userRef);
      if (!userDoc.exists) {
        throw new functions.https.HttpsError('not-found', 'Target user not found');
      }
      const currentCredits = readCreditBalance(userDoc.data()?.credits);
      const newBalance = currentCredits + amount;
      if (!Number.isSafeInteger(newBalance)) {
        throw new functions.https.HttpsError('failed-precondition', 'Credit balance would exceed the supported limit');
      }
      transaction.update(userRef, {
        credits: newBalance,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
      transaction.set(txRef, {
        userId: targetUserId,
        type: 'bonus',
        amount,
        jobId: null,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        adminId: context.auth!.uid,
        reason: reason || 'Admin credit addition',
      });
      return newBalance;
    });

    functions.logger.info('Admin added credits', {
      adminId: context.auth.uid,
      targetUserId,
      amount,
      reason,
      newCredits,
    });

    return {
      success: true,
      targetUserId,
      creditsAdded: amount,
      newBalance: newCredits,
    };
  });

// ============================================
// User Tier Management
// ============================================

interface UpdateUserTierData {
  targetUserId: string;
  tier: UserTier;
  reason?: string;
}

/**
 * Cloud Function: updateUserTier
 *
 * Admin-only function to update a user's membership tier.
 * Supports upgrading to Premium or downgrading to Free.
 *
 * When upgrading to Premium:
 * - Sets tier to 'premium'
 * - Records subscription.startedAt and paymentProvider: 'manual'
 *
 * When downgrading to Free:
 * - Sets tier to 'free'
 * - Clears subscription metadata
 */
export const updateUserTier = functions
  .region('asia-east1')
  .https.onCall(async (data: UpdateUserTierData, context) => {
    // Check authentication
    if (!context.auth) {
      throw new functions.https.HttpsError(
        'unauthenticated',
        'Must be logged in'
      );
    }

    // Check admin permission
    if (!(await isAdmin(context))) {
      throw new functions.https.HttpsError(
        'permission-denied',
        'Admin access required'
      );
    }

    data = normalizeCallableData(data);
    const { targetUserId, tier } = data;
    assertDocumentId(targetUserId, 'Target user ID');
    const reason = validateReason(data.reason);
    if (tier !== 'free' && tier !== 'premium') {
      throw new functions.https.HttpsError('invalid-argument', 'Tier must be "free" or "premium"');
    }
    const userRef = db.collection('users').doc(targetUserId);
    const previousTier = await db.runTransaction(async (transaction) => {
      const userDoc = await transaction.get(userRef);
      if (!userDoc.exists) {
        throw new functions.https.HttpsError('not-found', 'Target user not found');
      }
      const previousTier = userDoc.data()?.tier || 'free';
      if (previousTier !== tier) {
        transaction.update(userRef, {
          tier,
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          subscription: tier === 'premium'
            ? { startedAt: admin.firestore.FieldValue.serverTimestamp(), paymentProvider: 'manual' }
            : admin.firestore.FieldValue.delete(),
        });
      }
      return previousTier;
    });

    functions.logger.info('Admin updated user tier', {
      adminId: context.auth.uid,
      targetUserId,
      previousTier,
      newTier: tier,
      reason: reason || 'Admin tier change',
    });

    return {
      success: true,
      targetUserId,
      previousTier,
      newTier: tier,
    };
  });

/**
 * Cloud Function: checkRodinBalance
 *
 * Admin-only function to check remaining Rodin API credits.
 * Useful for monitoring API usage on the admin dashboard.
 *
 * See: https://developer.hyper3d.ai/api-specification/check_balance
 */
export const checkRodinBalance = functions
  .region('asia-east1')
  .https.onCall(async (_data, context) => {
    // Check authentication
    if (!context.auth) {
      throw new functions.https.HttpsError(
        'unauthenticated',
        'Must be logged in'
      );
    }

    // Check admin permission
    if (!(await isAdmin(context))) {
      throw new functions.https.HttpsError(
        'permission-denied',
        'Admin access required'
      );
    }

    try {
      const rodinClient = createRodinClient();
      const balance = await rodinClient.checkBalance();

      functions.logger.info('Admin checked Rodin balance', {
        adminId: context.auth.uid,
        balance,
      });

      return {
        success: true,
        balance,
        checkedAt: new Date().toISOString(),
      };
    } catch (error) {
      functions.logger.error('Failed to check Rodin balance', { error });
      throw new functions.https.HttpsError(
        'internal',
        'Failed to check Rodin API balance'
      );
    }
  });

/**
 * Cloud Function: getAdminStats
 *
 * Admin-only function to get system-wide statistics.
 */
export const getAdminStats = functions
  .region('asia-east1')
  .https.onCall(async (_data, context) => {
    // Check authentication
    if (!context.auth) {
      throw new functions.https.HttpsError(
        'unauthenticated',
        'Must be logged in'
      );
    }

    // Check admin permission
    if (!(await isAdmin(context))) {
      throw new functions.https.HttpsError(
        'permission-denied',
        'Admin access required'
      );
    }

    try {
      // Aggregate on the server instead of downloading every job and transaction.
      const jobs = db.collection('jobs');
      const [usersCount, jobsCount, pendingCount, processingCount, completedCount, failedCount, creditsSum] = await Promise.all([
        db.collection('users').count().get(),
        jobs.count().get(),
        jobs.where('status', '==', 'pending').count().get(),
        jobs.where('status', '==', 'processing').count().get(),
        jobs.where('status', '==', 'completed').count().get(),
        jobs.where('status', '==', 'failed').count().get(),
        db.collection('transactions').where('type', '==', 'bonus')
          .aggregate({ total: admin.firestore.AggregateField.sum('amount') }).get(),
      ]);
      const totalUsers = usersCount.data().count;
      const jobStats = {
        total: jobsCount.data().count,
        pending: pendingCount.data().count,
        processing: processingCount.data().count,
        completed: completedCount.data().count,
        failed: failedCount.data().count,
      };
      const totalCreditsDistributed = creditsSum.data().total;

      functions.logger.info('Admin fetched stats', {
        adminId: context.auth.uid,
      });

      return {
        success: true,
        stats: {
          totalUsers,
          jobs: jobStats,
          totalCreditsDistributed,
        },
        fetchedAt: new Date().toISOString(),
      };
    } catch (error) {
      functions.logger.error('Failed to fetch admin stats', { error });
      throw new functions.https.HttpsError(
        'internal',
        'Failed to fetch admin statistics'
      );
    }
  });

/**
 * Cloud Function: listUsers
 *
 * Admin-only function to list all users with their credits and stats.
 */
export const listUsers = functions
  .region('asia-east1')
  .https.onCall(async (data: { limit?: number; offset?: number }, context) => {
    // Check authentication
    if (!context.auth) {
      throw new functions.https.HttpsError(
        'unauthenticated',
        'Must be logged in'
      );
    }

    // Check admin permission
    if (!(await isAdmin(context))) {
      throw new functions.https.HttpsError(
        'permission-denied',
        'Admin access required'
      );
    }

    data = normalizeCallableData(data ?? {});
    const limit = parsePaginationValue(data?.limit, 50, 1, 100, 'limit');
    const offset = parsePaginationValue(data?.offset, 0, 0, 1000, 'offset');

    try {
      const usersSnapshot = await db
        .collection('users')
        .orderBy('createdAt', 'desc')
        .limit(limit)
        .offset(offset)
        .get();

      const users = usersSnapshot.docs.map((doc) => {
        const userData = doc.data();
        return {
          uid: doc.id,
          email: userData.email,
          displayName: userData.displayName,
          photoURL: userData.photoURL,
          credits: userData.credits,
          totalGenerated: userData.totalGenerated,
          role: userData.role || 'user',
          tier: userData.tier || 'free',
          createdAt: userData.createdAt?.toDate?.()?.toISOString() || null,
        };
      });

      // Get total count
      const countSnapshot = await db.collection('users').count().get();
      const totalCount = countSnapshot.data().count;

      return {
        success: true,
        users,
        pagination: {
          total: totalCount,
          limit,
          offset,
          hasMore: offset + users.length < totalCount,
        },
      };
    } catch (error) {
      functions.logger.error('Failed to list users', { error });
      throw new functions.https.HttpsError(
        'internal',
        'Failed to list users'
      );
    }
  });

// ============================================
// Pipeline Management Functions
// ============================================

interface ListAllPipelinesData {
  limit?: number;
  offset?: number;
  status?: string;
  userId?: string;
}

const VALID_PIPELINE_STATUSES = new Set([
  'draft',
  'batch-queued',
  'batch-processing',
  'generating-images',
  'images-ready',
  'generating-mesh',
  'mesh-ready',
  'generating-texture',
  'completed',
  'failed',
]);

async function refreshStoredAdminUrl(
  url: unknown,
  storagePath: unknown
): Promise<string | null> {
  if (typeof url !== 'string') return null;
  if (typeof storagePath !== 'string' || !storagePath) return url;

  try {
    return await getSignedUrlForReference(storagePath, url);
  } catch (error) {
    functions.logger.warn('Could not refresh an admin storage URL', {
      storagePath,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    return url;
  }
}

async function refreshStoredAdminImages(
  images: unknown
): Promise<Record<string, unknown>> {
  if (!images || typeof images !== 'object') return {};

  const entries = await Promise.all(
    Object.entries(images as Record<string, Record<string, unknown>>).map(async ([key, image]) => [
      key,
      {
        ...image,
        url: await refreshStoredAdminUrl(image?.url, image?.storagePath),
      },
    ] as const)
  );
  return Object.fromEntries(entries);
}

async function refreshAdminPreview(
  preview: PipelineDocument['adminPreview']
): Promise<Record<string, unknown> | null> {
  if (!preview) return null;
  return {
    ...preview,
    meshImages: await refreshStoredAdminImages(preview.meshImages),
    meshUrl: await refreshStoredAdminUrl(preview.meshUrl, preview.meshStoragePath),
    texturedModelUrl: await refreshStoredAdminUrl(preview.texturedModelUrl, preview.texturedModelStoragePath),
  };
}

/**
 * Cloud Function: listAllPipelines
 *
 * Admin-only function to list all pipelines across all users.
 * Supports filtering by status and userId.
 */
export const listAllPipelines = functions
  .region('asia-east1')
  .https.onCall(async (data: ListAllPipelinesData, context) => {
    // Check authentication
    if (!context.auth) {
      throw new functions.https.HttpsError(
        'unauthenticated',
        'Must be logged in'
      );
    }

    // Check admin permission
    if (!(await isAdmin(context))) {
      throw new functions.https.HttpsError(
        'permission-denied',
        'Admin access required'
      );
    }

    data = normalizeCallableData(data ?? {});
    const limit = parsePaginationValue(data?.limit, 20, 1, 50, 'limit');
    const offset = parsePaginationValue(data?.offset, 0, 0, 1000, 'offset');
    const { status, userId } = data || {};
    if (status !== undefined && (typeof status !== 'string' || !VALID_PIPELINE_STATUSES.has(status))) {
      throw new functions.https.HttpsError('invalid-argument', 'Invalid pipeline status');
    }
    if (
      userId !== undefined &&
      (typeof userId !== 'string' || !userId || userId.length > 128 || userId.includes('/'))
    ) {
      throw new functions.https.HttpsError('invalid-argument', 'Invalid user ID');
    }

    try {
      // Build query with optional filters
      let query: FirebaseFirestore.Query = db.collection('pipelines');

      if (status) {
        query = query.where('status', '==', status);
      }

      if (userId) {
        query = query.where('userId', '==', userId);
      }

      query = query.orderBy('createdAt', 'desc').limit(limit).offset(offset);

      const pipelinesSnapshot = await query.get();

      // Get user info for each pipeline
      const userIds = [...new Set(pipelinesSnapshot.docs.map((doc) => doc.data().userId))];
      const userDocs = await Promise.all(
        userIds.map((uid) => db.collection('users').doc(uid).get())
      );
      const userMap = new Map(
        userDocs.filter((doc) => doc.exists).map((doc) => [doc.id, doc.data()])
      );

      const pipelines = await Promise.all(pipelinesSnapshot.docs.map(async (doc) => {
        const pipelineData = doc.data();
        const userData = userMap.get(pipelineData.userId);
        const inputImages = await Promise.all((pipelineData.inputImages || []).map(
          async (image: Record<string, unknown>) => ({
            ...image,
            url: await refreshStoredAdminUrl(image.url, image.storagePath),
          })
        ));
        const meshImages = await refreshStoredAdminImages(pipelineData.meshImages);
        const adminPreview = pipelineData.adminPreview
          ? {
              ...pipelineData.adminPreview,
              meshImages: await refreshStoredAdminImages(pipelineData.adminPreview.meshImages),
              meshUrl: await refreshStoredAdminUrl(
                pipelineData.adminPreview.meshUrl,
                pipelineData.adminPreview.meshStoragePath
              ),
              texturedModelUrl: await refreshStoredAdminUrl(
                pipelineData.adminPreview.texturedModelUrl,
                pipelineData.adminPreview.texturedModelStoragePath
              ),
            }
          : null;

        return {
          id: doc.id,
          userId: pipelineData.userId,
          userDisplayName: userData?.displayName || 'Unknown',
          userEmail: userData?.email || 'Unknown',
          userPhotoURL: userData?.photoURL || null,
          status: pipelineData.status,
          processingMode: pipelineData.processingMode,
          generationMode: pipelineData.generationMode,
          inputImages,
          meshImages,
          meshUrl: await refreshStoredAdminUrl(pipelineData.meshUrl, pipelineData.meshStoragePath),
          meshStoragePath: pipelineData.meshStoragePath || null,
          texturedModelUrl: await refreshStoredAdminUrl(
            pipelineData.texturedModelUrl,
            pipelineData.texturedModelStoragePath
          ),
          texturedModelStoragePath: pipelineData.texturedModelStoragePath || null,
          creditsCharged: pipelineData.creditsCharged || { mesh: 0, texture: 0 },
          settings: pipelineData.settings || {},
          userDescription: pipelineData.userDescription || null,
          error: pipelineData.error || null,
          adminPreview,
          adminActions: pipelineData.adminActions || [],
          createdAt: pipelineData.createdAt?.toDate?.()?.toISOString() || null,
          updatedAt: pipelineData.updatedAt?.toDate?.()?.toISOString() || null,
          completedAt: pipelineData.completedAt?.toDate?.()?.toISOString() || null,
        };
      }));

      // Get total count (with filters if applied)
      let countQuery: FirebaseFirestore.Query = db.collection('pipelines');
      if (status) {
        countQuery = countQuery.where('status', '==', status);
      }
      if (userId) {
        countQuery = countQuery.where('userId', '==', userId);
      }
      const countSnapshot = await countQuery.count().get();
      const totalCount = countSnapshot.data().count;

      functions.logger.info('Admin listed pipelines', {
        adminId: context.auth.uid,
        filters: { status, userId },
        resultCount: pipelines.length,
      });

      return {
        success: true,
        pipelines,
        pagination: {
          total: totalCount,
          limit,
          offset,
          hasMore: offset + pipelines.length < totalCount,
        },
      };
    } catch (error) {
      functions.logger.error('Failed to list pipelines', { error });
      throw new functions.https.HttpsError(
        'internal',
        'Failed to list pipelines'
      );
    }
  });

// ============================================
// Credit Management Functions
// ============================================

interface DeductCreditsData {
  targetUserId: string;
  amount: number;
  reason: string;  // Required for audit trail
}

/**
 * Cloud Function: deductCredits
 *
 * Admin-only function to deduct credits from a user's account.
 * Requires a reason for audit trail purposes.
 */
export const deductCredits = functions
  .region('asia-east1')
  .https.onCall(async (data: DeductCreditsData, context) => {
    // Check authentication
    if (!context.auth) {
      throw new functions.https.HttpsError(
        'unauthenticated',
        'Must be logged in'
      );
    }

    // Check admin permission
    if (!(await isAdmin(context))) {
      throw new functions.https.HttpsError(
        'permission-denied',
        'Admin access required'
      );
    }

    data = normalizeCallableData(data);
    const { targetUserId, amount } = data;
    assertDocumentId(targetUserId, 'Target user ID');
    validateCreditAmount(amount);
    const reason = validateReason(data.reason, true)!;
    const userRef = db.collection('users').doc(targetUserId);
    const txRef = db.collection('transactions').doc();

    const { currentCredits, newCredits } = await db.runTransaction(async (transaction) => {
      const userDoc = await transaction.get(userRef);
      if (!userDoc.exists) {
        throw new functions.https.HttpsError('not-found', 'Target user not found');
      }
      const currentCredits = readCreditBalance(userDoc.data()?.credits);
      if (currentCredits < amount) {
        throw new functions.https.HttpsError('failed-precondition', `User only has ${currentCredits} credits, cannot deduct ${amount}`);
      }
      const newCredits = currentCredits - amount;
      transaction.update(userRef, {
        credits: newCredits,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
      transaction.set(txRef, {
        userId: targetUserId,
        type: 'adjustment',
        amount: -amount,
        jobId: null,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        adminId: context.auth!.uid,
        reason,
      });
      return { currentCredits, newCredits };
    });

    functions.logger.info('Admin deducted credits', {
      adminId: context.auth.uid,
      targetUserId,
      amount,
      reason,
      previousCredits: currentCredits,
      newCredits,
    });

    return {
      success: true,
      targetUserId,
      creditsDeducted: amount,
      previousBalance: currentCredits,
      newBalance: newCredits,
    };
  });

interface GetUserTransactionsData {
  targetUserId: string;
  limit?: number;
  offset?: number;
}

/**
 * Cloud Function: getUserTransactions
 *
 * Admin-only function to get transaction history for a specific user.
 */
export const getUserTransactions = functions
  .region('asia-east1')
  .https.onCall(async (data: GetUserTransactionsData, context) => {
    // Check authentication
    if (!context.auth) {
      throw new functions.https.HttpsError(
        'unauthenticated',
        'Must be logged in'
      );
    }

    // Check admin permission
    if (!(await isAdmin(context))) {
      throw new functions.https.HttpsError(
        'permission-denied',
        'Admin access required'
      );
    }

    data = normalizeCallableData(data);
    const targetUserId = data?.targetUserId;
    const limit = parsePaginationValue(data?.limit, 50, 1, 100, 'limit');
    const offset = parsePaginationValue(data?.offset, 0, 0, 1000, 'offset');

    assertDocumentId(targetUserId, 'Target user ID');

    try {
      // Verify user exists
      const userDoc = await db.collection('users').doc(targetUserId).get();
      if (!userDoc.exists) {
        throw new functions.https.HttpsError(
          'not-found',
          'Target user not found'
        );
      }

      // Query transactions for user
      const transactionsSnapshot = await db
        .collection('transactions')
        .where('userId', '==', targetUserId)
        .orderBy('createdAt', 'desc')
        .limit(limit)
        .offset(offset)
        .get();

      const transactions = transactionsSnapshot.docs.map((doc) => {
        const txData = doc.data();
        return {
          id: doc.id,
          userId: txData.userId,
          type: txData.type,
          amount: txData.amount,
          jobId: txData.jobId || null,
          sessionId: txData.sessionId || null,
          pipelineId: txData.pipelineId || null,
          reason: txData.reason || null,
          adminId: txData.adminId || null,
          createdAt: txData.createdAt?.toDate?.()?.toISOString() || null,
        };
      });

      // Get total count for this user
      const countSnapshot = await db
        .collection('transactions')
        .where('userId', '==', targetUserId)
        .count()
        .get();
      const totalCount = countSnapshot.data().count;

      functions.logger.info('Admin fetched user transactions', {
        adminId: context.auth.uid,
        targetUserId,
        resultCount: transactions.length,
      });

      return {
        success: true,
        transactions,
        pagination: {
          total: totalCount,
          limit,
          offset,
          hasMore: offset + transactions.length < totalCount,
        },
      };
    } catch (error) {
      if (error instanceof functions.https.HttpsError) {
        throw error;
      }
      functions.logger.error('Failed to get user transactions', { error });
      throw new functions.https.HttpsError(
        'internal',
        'Failed to get user transactions'
      );
    }
  });

// ============================================
// Provider Balance Functions
// ============================================

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
export const checkAllProviderBalances = functions
  .region('asia-east1')
  .https.onCall(async (_data, context) => {
    // Check authentication
    if (!context.auth) {
      throw new functions.https.HttpsError(
        'unauthenticated',
        'Must be logged in'
      );
    }

    // Check admin permission
    if (!(await isAdmin(context))) {
      throw new functions.https.HttpsError(
        'permission-denied',
        'Admin access required'
      );
    }

    const results: {
      rodin: { balance: number | null; error?: string };
      meshy: { balance: number | null; error?: string };
      tripo: { balance: number | null; frozen: number | null; error?: string };
      hunyuan: { status: 'free-tier' };
    } = {
      rodin: { balance: null },
      meshy: { balance: null },
      tripo: { balance: null, frozen: null },
      hunyuan: { status: 'free-tier' },
    };

    // Check Rodin balance
    try {
      const rodinClient = createRodinClient();
      results.rodin.balance = await rodinClient.checkBalance();
    } catch (error) {
      results.rodin.error = 'Failed to check balance';
      functions.logger.error('Failed to check Rodin balance', { error });
    }

    // Check Meshy balance
    try {
      const meshyKey = process.env.MESHY_API_KEY;
      if (meshyKey) {
        const meshyProvider = new MeshyProvider(meshyKey);
        results.meshy.balance = await meshyProvider.checkBalance();
      } else {
        results.meshy.error = 'API key not configured';
      }
    } catch (error) {
      results.meshy.error = 'Failed to check balance';
      functions.logger.error('Failed to check Meshy balance', { error });
    }

    // Check Tripo balance
    try {
      const tripoKey = process.env.TRIPO_API_KEY;
      if (tripoKey) {
        const tripoProvider = new TripoProvider(tripoKey);
        const tripoBalance = await tripoProvider.checkBalanceWithFrozen();
        results.tripo.balance = tripoBalance.balance;
        results.tripo.frozen = tripoBalance.frozen;
      } else {
        results.tripo.error = 'API key not configured';
      }
    } catch (error) {
      results.tripo.error = 'Failed to check balance';
      functions.logger.error('Failed to check Tripo balance', { error });
    }

    functions.logger.info('Admin checked all provider balances', {
      adminId: context.auth.uid,
      rodin: results.rodin.balance,
      meshy: results.meshy.balance,
      tripo: results.tripo.balance,
    });

    return {
      success: true,
      balances: results,
      checkedAt: new Date().toISOString(),
    };
  });

// ============================================
// Admin Pipeline Regeneration Functions
// ============================================

/**
 * Helper: Get admin email for audit trail
 */
async function getAdminEmail(adminId: string): Promise<string> {
  const adminDoc = await db.collection('users').doc(adminId).get();
  return adminDoc.data()?.email || 'unknown';
}

/**
 * Helper: Add admin action to pipeline audit trail
 * Note: Using Timestamp.now() instead of serverTimestamp() because
 * serverTimestamp() cannot be used inside arrayUnion operations
 */
function adminActionFields(action: Omit<AdminAction, 'timestamp'>): Record<string, unknown> {
  return {
    adminActions: admin.firestore.FieldValue.arrayUnion({
      ...action,
      timestamp: admin.firestore.Timestamp.now(),
    }),
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  };
}

const ADMIN_PREVIEW_START_LEASE_MS = 10 * 60 * 1000;

const MESH_PREVIEW_FIELDS = [
  'meshUrl', 'meshStoragePath', 'meshDownloadFiles', 'taskId', 'taskStatus',
  'provider', 'subscriptionKey', 'operationId',
] as const;

function clearMeshPreview(): Record<string, FirebaseFirestore.FieldValue> {
  return Object.fromEntries(MESH_PREVIEW_FIELDS.map((field) => [
    `adminPreview.${field}`, admin.firestore.FieldValue.delete(),
  ]));
}

async function updateCurrentPreviewTask(
  pipelineRef: FirebaseFirestore.DocumentReference,
  taskId: string,
  updates: Record<string, unknown>
): Promise<void> {
  await db.runTransaction(async (transaction) => {
    const current = await transaction.get(pipelineRef);
    if (current.data()?.adminPreview?.taskId !== taskId) {
      throw new functions.https.HttpsError('aborted', 'Preview changed; refresh before continuing');
    }
    // A slower poll must not downgrade or overwrite an already finalized result.
    if (current.data()?.adminPreview?.taskStatus === 'completed') {
      throw new functions.https.HttpsError('aborted', 'Preview was finalized by another request; refresh its status');
    }
    transaction.update(pipelineRef, updates);
  });
}

interface AdminRegeneratePipelineImageData {
  pipelineId: string;
  viewType: 'mesh' | 'texture';
  angle: string;
  hint?: string;
}

/**
 * Cloud Function: adminRegeneratePipelineImage
 *
 * Admin-only function to regenerate a pipeline image without credit deduction.
 * Stores result in adminPreview for confirmation before overwriting.
 */
export const adminRegeneratePipelineImage = functions
  .region('asia-east1')
  .runWith({
    timeoutSeconds: 120,
    memory: '512MB',
    secrets: ['GEMINI_API_KEY'],
  })
  .https.onCall(async (data: AdminRegeneratePipelineImageData, context) => {
    if (!context.auth) {
      throw new functions.https.HttpsError('unauthenticated', 'Must be logged in');
    }

    if (!(await isAdmin(context))) {
      throw new functions.https.HttpsError('permission-denied', 'Admin access required');
    }

    const adminId = context.auth.uid;
    const adminEmail = await getAdminEmail(adminId);
    data = normalizeCallableData(data);
    const { pipelineId, viewType, angle, hint } = data;
    assertDocumentId(pipelineId, 'Pipeline ID');
    if (hint !== undefined && (typeof hint !== 'string' || hint.length > 2000)) {
      throw new functions.https.HttpsError('invalid-argument', 'Hint must be text of at most 2000 characters');
    }

    // Validate viewType and angle - only mesh views can be regenerated
    const validMeshAngles: PipelineMeshAngle[] = ['front', 'back', 'left', 'right'];

    if (viewType !== 'mesh') {
      throw new functions.https.HttpsError('invalid-argument', 'Only mesh views can be regenerated');
    }

    if (!validMeshAngles.includes(angle as PipelineMeshAngle)) {
      throw new functions.https.HttpsError('invalid-argument', 'Invalid mesh angle');
    }

    // Get pipeline (no ownership check - admin can access any pipeline)
    const pipelineRef = db.collection('pipelines').doc(pipelineId);
    const pipelineDoc = await pipelineRef.get();

    if (!pipelineDoc.exists) {
      throw new functions.https.HttpsError('not-found', 'Pipeline not found');
    }

    const pipeline = pipelineDoc.data() as PipelineDocument;
    const operationId = randomUUID();
    await pipelineRef.update({ [`adminPreview.imageOperationIds.${angle}`]: operationId });

    try {
      // Download reference image
      const referenceImageUrl = pipeline.inputImages?.[0]?.url;
      if (!referenceImageUrl) {
        throw new functions.https.HttpsError('failed-precondition', 'Pipeline has no reference image');
      }
      const { base64, mimeType } = await downloadValidatedImageAsBase64(
        referenceImageUrl,
        pipeline.userId,
        ['uploads']
      );

      // Generate view using pipeline's settings
      const modeId = pipeline.generationMode || 'simplified-texture';
      const geminiModel = (pipeline.settings?.geminiModel || 'gemini-2.5-flash-image') as GeminiImageModel;
      const generator = createMultiViewGenerator(modeId, pipeline.userDescription, pipeline.imageAnalysis, geminiModel);
      const now = admin.firestore.FieldValue.serverTimestamp();

      const previousUrl = pipeline.meshImages?.[angle as PipelineMeshAngle]?.url;

      const view = await generator.generateMeshView(base64, mimeType, angle as PipelineMeshAngle, hint);
      const ext = getExtensionFromMimeType(view.mimeType);
      // Store in preview/ subdirectory
      const storagePath = `pipelines/${pipeline.userId}/${pipelineId}/preview/${randomUUID()}/mesh_${angle}.${ext}`;
      const url = await uploadImageToStorage(view.imageBase64, view.mimeType, storagePath);

      const processedImage: PipelineProcessedImage = {
        url,
        storagePath,
        source: 'gemini',
        generatedAt: admin.firestore.Timestamp.now(),
      };
      if (view.colorPalette?.length) {
        processedImage.colorPalette = view.colorPalette;
      }

      await db.runTransaction(async (transaction) => {
        const current = await transaction.get(pipelineRef);
        if (current.data()?.adminPreview?.imageOperationIds?.[angle] !== operationId) {
          throw new functions.https.HttpsError('aborted', 'Image preview changed; refresh before continuing');
        }
        transaction.update(pipelineRef, {
          [`adminPreview.meshImages.${angle}`]: processedImage,
          [`adminPreview.imageOperationIds.${angle}`]: admin.firestore.FieldValue.delete(),
          'adminPreview.createdAt': now,
          'adminPreview.createdBy': adminId,
          ...adminActionFields({
            adminId, adminEmail, actionType: 'regenerate-image',
            targetField: `${viewType}Images.${angle}`, previousValue: previousUrl || null,
          }),
        });
      });

      functions.logger.info('Admin regenerated pipeline image to preview', {
        adminId,
        pipelineId,
        viewType,
        angle,
        userId: pipeline.userId,
      });

      return {
        success: true,
        viewType,
        angle,
        previewImage: processedImage,
      };
    } catch (error) {
      await db.runTransaction(async (transaction) => {
        const current = await transaction.get(pipelineRef);
        if (current.data()?.adminPreview?.imageOperationIds?.[angle] === operationId) {
          transaction.update(pipelineRef, {
            [`adminPreview.imageOperationIds.${angle}`]: admin.firestore.FieldValue.delete(),
          });
        }
      });
      if (error instanceof functions.https.HttpsError) throw error;
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      functions.logger.error('Admin image regeneration failed', { pipelineId, viewType, angle, error: errorMessage });
      throw new functions.https.HttpsError('internal', `Regeneration failed: ${errorMessage}`);
    }
  });

interface AdminStartPipelineMeshData {
  pipelineId: string;
  provider: ProviderType;
  providerOptions?: ProviderOptions;
}

/**
 * Cloud Function: adminStartPipelineMesh
 *
 * Admin-only function to regenerate mesh with optional provider change.
 * No credit deduction. Stores result in adminPreview.
 */
export const adminStartPipelineMesh = functions
  .region('asia-east1')
  .runWith({
    timeoutSeconds: 180,
    memory: '1GB',
  })
  .https.onCall(async (data: AdminStartPipelineMeshData, context) => {
    if (!context.auth) {
      throw new functions.https.HttpsError('unauthenticated', 'Must be logged in');
    }

    if (!(await isAdmin(context))) {
      throw new functions.https.HttpsError('permission-denied', 'Admin access required');
    }

    const adminId = context.auth.uid;
    const adminEmail = await getAdminEmail(adminId);
    data = normalizeCallableData(data);
    const { pipelineId, provider: requestedProvider, providerOptions } = data;
    assertDocumentId(pipelineId, 'Pipeline ID');
    if (requestedProvider !== undefined && (typeof requestedProvider !== 'string' || !isValidProvider(requestedProvider))) {
      throw new functions.https.HttpsError('invalid-argument', 'Invalid provider');
    }
    if (providerOptions !== undefined) {
      assertRecord(providerOptions, 'Provider options');
      if (providerOptions.faceCount !== undefined && (typeof providerOptions.faceCount !== 'number' || !Number.isInteger(providerOptions.faceCount) || providerOptions.faceCount < 40000 || providerOptions.faceCount > 1500000)) {
        throw new functions.https.HttpsError('invalid-argument', 'Face count must be an integer between 40000 and 1500000');
      }
    }

    const pipelineRef = db.collection('pipelines').doc(pipelineId);
    const operationId = randomUUID();
    const pipeline = await db.runTransaction(async (transaction) => {
      const pipelineDoc = await transaction.get(pipelineRef);
      if (!pipelineDoc.exists) {
        throw new functions.https.HttpsError('not-found', 'Pipeline not found');
      }
      const pipeline = pipelineDoc.data() as PipelineDocument;
      if (!['front', 'back', 'left', 'right'].every((angle) => pipeline.meshImages?.[angle as PipelineMeshAngle]?.url)) {
        throw new functions.https.HttpsError('failed-precondition', 'Pipeline images not ready');
      }
      const preview = pipeline.adminPreview;
      if (preview && ['pending', 'processing'].includes(preview.taskStatus || '') &&
          (preview.taskId || (preview.createdAt?.toMillis?.() || 0) > Date.now() - ADMIN_PREVIEW_START_LEASE_MS)) {
        throw new functions.https.HttpsError('failed-precondition', 'A mesh preview is already being generated');
      }
      transaction.update(pipelineRef, {
        ...clearMeshPreview(),
        'adminPreview.operationId': operationId,
        'adminPreview.taskStatus': 'pending',
        'adminPreview.createdAt': admin.firestore.FieldValue.serverTimestamp(),
        'adminPreview.createdBy': adminId,
      });
      return pipeline;
    });

    try {
      // Collect mesh image URLs
      const meshAngles: PipelineMeshAngle[] = ['front', 'back', 'left', 'right'];
      const imageUrls = await Promise.all(meshAngles.map(async (angle) => {
        const imageUrl = pipeline.meshImages[angle]?.url;
        if (!imageUrl) return null;
        const reference = assertUserStorageReference(imageUrl, pipeline.userId, ['pipelines']);
        return getSignedUrlForReference(reference.storagePath, imageUrl);
      }));

      if (imageUrls.some((url) => !url)) {
        throw new functions.https.HttpsError('failed-precondition', 'Not all mesh images available');
      }
      const validatedImageUrls = imageUrls.filter((url): url is string => Boolean(url));

      // Get provider
      const providerType = requestedProvider || pipeline.settings?.provider || 'meshy';
      const provider = ProviderFactory.getProvider(providerType);

      // Start mesh generation (no credits deducted) - provider-specific handling
      let result;
      if (providerType === 'tripo') {
        const tripoProvider = provider as TripoProvider;
        result = await tripoProvider.generateFromUrls(validatedImageUrls, {
          quality: (pipeline.settings?.quality as 'draft' | 'standard' | 'fine') || 'standard',
          format: 'glb',
          enableTexture: true,
          enablePBR: true,
        });
      } else if (providerType === 'meshy') {
        const meshyProvider = provider as MeshyProvider;
        result = await meshyProvider.generateMeshOnlyFromUrls(validatedImageUrls, {
          quality: (pipeline.settings?.quality as 'draft' | 'standard' | 'fine') || 'standard',
          format: 'glb',
          precision: pipeline.settings?.meshPrecision || 'standard',
        });
      } else if (providerType === 'hunyuan') {
        const hunyuanProvider = provider as HunyuanProvider;
        result = await hunyuanProvider.generateFromUrls(validatedImageUrls, {
          quality: (pipeline.settings?.quality as 'draft' | 'standard' | 'fine') || 'standard',
          format: 'glb',
          enablePBR: false,
          providerOptions: typeof providerOptions?.faceCount === 'number' ? {
            hunyuan: { faceCount: providerOptions.faceCount },
          } : undefined,
        });
      } else {
        // Fallback: download images and use generateFromMultipleImages
        const imageBuffers: Buffer[] = [];
        for (const url of validatedImageUrls) {
          const image = await downloadValidatedImageAsBase64(url, pipeline.userId, ['pipelines']);
          imageBuffers.push(Buffer.from(image.base64, 'base64'));
        }
        result = await provider.generateFromMultipleImages(imageBuffers, {
          quality: (pipeline.settings?.quality as 'draft' | 'standard' | 'fine') || 'standard',
          format: 'glb',
          enableTexture: true,
          enablePBR: true,
        });
      }

      const now = admin.firestore.FieldValue.serverTimestamp();

      await db.runTransaction(async (transaction) => {
        const current = await transaction.get(pipelineRef);
        if (current.data()?.adminPreview?.operationId !== operationId) {
          throw new functions.https.HttpsError('aborted', 'Mesh preview was discarded or replaced');
        }
        transaction.update(pipelineRef, {
          'adminPreview.provider': providerType,
          'adminPreview.taskId': result.taskId,
          'adminPreview.subscriptionKey': result.subscriptionKey || admin.firestore.FieldValue.delete(),
          'adminPreview.taskStatus': 'pending',
          'adminPreview.createdAt': now,
          'adminPreview.createdBy': adminId,
          ...adminActionFields({
            adminId, adminEmail,
            actionType: pipeline.settings?.provider !== providerType ? 'change-provider' : 'regenerate-mesh',
            targetField: 'mesh', provider: providerType, previousValue: pipeline.meshUrl || null,
          }),
        });
      });

      functions.logger.info('Admin started mesh regeneration', {
        adminId,
        pipelineId,
        provider: providerType,
        taskId: result.taskId,
        userId: pipeline.userId,
      });

      return {
        success: true,
        taskId: result.taskId,
        provider: providerType,
      };
    } catch (error) {
      await db.runTransaction(async (transaction) => {
        const current = await transaction.get(pipelineRef);
        if (current.data()?.adminPreview?.operationId === operationId) {
          transaction.update(pipelineRef, { 'adminPreview.taskStatus': 'failed' });
        }
      });
      if (error instanceof functions.https.HttpsError) throw error;
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      functions.logger.error('Admin mesh regeneration failed', { pipelineId, error: errorMessage });
      throw new functions.https.HttpsError('internal', `Mesh regeneration failed: ${errorMessage}`);
    }
  });

interface AdminCheckPreviewStatusData {
  pipelineId: string;
  readOnly?: boolean;
}

/**
 * Cloud Function: adminCheckPreviewStatus
 *
 * Admin-only function to check status of mesh/texture regeneration in preview.
 */
export const adminCheckPreviewStatus = functions
  .region('asia-east1')
  .runWith({
    timeoutSeconds: 60,
    memory: '512MB',
  })
  .https.onCall(async (data: AdminCheckPreviewStatusData, context) => {
    if (!context.auth) {
      throw new functions.https.HttpsError('unauthenticated', 'Must be logged in');
    }

    if (!(await isAdmin(context))) {
      throw new functions.https.HttpsError('permission-denied', 'Admin access required');
    }

    data = normalizeCallableData(data);
    const { pipelineId } = data;
    if (data.readOnly !== undefined && typeof data.readOnly !== 'boolean') {
      throw new functions.https.HttpsError('invalid-argument', 'readOnly must be a boolean');
    }
    assertDocumentId(pipelineId, 'Pipeline ID');
    const pipelineRef = db.collection('pipelines').doc(pipelineId);
    const pipelineDoc = await pipelineRef.get();

    if (!pipelineDoc.exists) {
      throw new functions.https.HttpsError('not-found', 'Pipeline not found');
    }

    const pipeline = pipelineDoc.data() as PipelineDocument;
    let preview = pipeline.adminPreview;

    if (data.readOnly) {
      return { success: true, status: 'snapshot', preview: await refreshAdminPreview(preview) };
    }

    // Startup reserves a preview before a provider task ID is available. Keep
    // polling that claim, and release abandoned claims after the startup lease.
    if ((!preview?.taskId || !preview?.provider) &&
        ['pending', 'processing'].includes(preview?.taskStatus || '')) {
      preview = await db.runTransaction(async (transaction) => {
        const currentDoc = await transaction.get(pipelineRef);
        if (!currentDoc.exists) {
          throw new functions.https.HttpsError('not-found', 'Pipeline not found');
        }
        const current = (currentDoc.data() as PipelineDocument).adminPreview;
        if (current && (!current.taskId || !current.provider) &&
            ['pending', 'processing'].includes(current.taskStatus || '') &&
            (current.createdAt?.toMillis?.() || 0) <= Date.now() - ADMIN_PREVIEW_START_LEASE_MS) {
          transaction.update(pipelineRef, {
            'adminPreview.taskStatus': 'failed',
            'adminPreview.operationId': admin.firestore.FieldValue.delete(),
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          });
          const failedPreview = { ...current, taskStatus: 'failed' as const };
          delete failedPreview.operationId;
          return failedPreview;
        }
        return current;
      });
    }

    if (!preview?.taskId || !preview?.provider) {
      const refreshedPreview = await refreshAdminPreview(preview);
      return {
        success: true,
        status: ['pending', 'processing'].includes(preview?.taskStatus || '')
          ? 'processing' : preview?.taskStatus === 'failed' ? 'failed' : 'no-active-task',
        ...(preview?.taskStatus === 'failed' && { error: 'Preview startup failed or expired; please retry generation' }),
        preview: refreshedPreview,
      };
    }

    if (preview.taskStatus === 'completed' && preview.meshUrl) {
      return {
        success: true,
        status: 'completed',
        meshUrl: await refreshStoredAdminUrl(preview.meshUrl, preview.meshStoragePath),
        meshStoragePath: preview.meshStoragePath,
        downloadFiles: preview.meshDownloadFiles || [],
      };
    }

    try {
      const providerInstance = ProviderFactory.getProvider(preview.provider);
      const status = await providerInstance.checkStatus(preview.taskId, preview.subscriptionKey);

      if (status.status === 'completed') {
        // Download model to preview storage
        const downloadUrls = await providerInstance.getDownloadUrls(preview.taskId, 'glb');
        const glbFile = downloadUrls.files.find((file) => file.format.toLowerCase() === 'glb' || file.name.toLowerCase().endsWith('.glb'));

        if (!glbFile) {
          await updateCurrentPreviewTask(pipelineRef, preview.taskId, {
            'adminPreview.taskStatus': 'failed',
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          });
          return { success: true, status: 'failed', error: 'The completed preview has no GLB model' };
        }

        if (glbFile) {
          const modelBuffer = await providerInstance.downloadModel(glbFile.url);
          const storagePath = `pipelines/${pipeline.userId}/${pipelineId}/preview/${randomUUID()}/model.glb`;
          const meshUrl = await uploadBuffer(modelBuffer, storagePath, 'model/gltf-binary');

          await updateCurrentPreviewTask(pipelineRef, preview.taskId, {
            'adminPreview.meshUrl': meshUrl,
            'adminPreview.meshStoragePath': storagePath,
            'adminPreview.meshDownloadFiles': downloadUrls.files,
            'adminPreview.taskStatus': 'completed',
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          });

          return {
            success: true,
            status: 'completed',
            meshUrl,
            meshStoragePath: storagePath,
            downloadFiles: downloadUrls.files,
          };
        }
      } else if (status.status === 'failed') {
        await updateCurrentPreviewTask(pipelineRef, preview.taskId, {
          'adminPreview.taskStatus': 'failed',
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });

        return {
          success: true,
          status: 'failed',
          error: status.error,
        };
      }

      // Still processing
      await updateCurrentPreviewTask(pipelineRef, preview.taskId, {
        'adminPreview.taskStatus': 'processing',
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      return {
        success: true,
        status: 'processing',
        progress: status.progress,
      };
    } catch (error) {
      if (error instanceof functions.https.HttpsError) throw error;
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      functions.logger.error('Admin preview status check failed', { pipelineId, error: errorMessage });
      throw new functions.https.HttpsError('internal', `Status check failed: ${errorMessage}`);
    }
  });

interface AdminConfirmPreviewData {
  pipelineId: string;
  targetField: 'meshImages' | 'mesh';
  angle?: string; // Required for meshImages
  expectedStoragePath?: string; // Preview shown to the administrator
}

/**
 * Cloud Function: adminConfirmPreview
 *
 * Admin-only function to confirm preview and overwrite production data.
 */
export const adminConfirmPreview = functions
  .region('asia-east1')
  .runWith({
    timeoutSeconds: 60,
    memory: '256MB',
  })
  .https.onCall(async (data: AdminConfirmPreviewData, context) => {
    if (!context.auth) {
      throw new functions.https.HttpsError('unauthenticated', 'Must be logged in');
    }

    if (!(await isAdmin(context))) {
      throw new functions.https.HttpsError('permission-denied', 'Admin access required');
    }

    const adminId = context.auth.uid;
    const adminEmail = await getAdminEmail(adminId);
    data = normalizeCallableData(data);
    const { pipelineId, targetField, angle } = data;
    assertDocumentId(pipelineId, 'Pipeline ID');
    validatePreviewTarget(targetField, angle, false);
    if (data.expectedStoragePath !== undefined && (typeof data.expectedStoragePath !== 'string' || !data.expectedStoragePath)) {
      throw new functions.https.HttpsError('invalid-argument', 'Expected preview storage path must be text');
    }

    const pipelineRef = db.collection('pipelines').doc(pipelineId);
    const confirmedField = targetField === 'meshImages' ? `meshImages.${angle}` : 'mesh';
    const userId = await db.runTransaction(async (transaction) => {
      const pipelineDoc = await transaction.get(pipelineRef);
      if (!pipelineDoc.exists) {
        throw new functions.https.HttpsError('not-found', 'Pipeline not found');
      }
      const pipeline = pipelineDoc.data() as PipelineDocument;
      const preview = pipeline.adminPreview;
      if (!preview) {
        throw new functions.https.HttpsError('failed-precondition', 'No preview to confirm');
      }
      const currentStoragePath = targetField === 'meshImages'
        ? preview.meshImages?.[angle as PipelineMeshAngle]?.storagePath
        : preview.meshStoragePath;
      if (data.expectedStoragePath !== undefined && data.expectedStoragePath !== currentStoragePath) {
        throw new functions.https.HttpsError('aborted', 'Preview changed; review the new preview before confirming');
      }
      if (['batch-queued', 'batch-processing', 'generating-images', 'generating-mesh', 'generating-texture'].includes(pipeline.status)) {
        throw new functions.https.HttpsError('failed-precondition', 'Wait for the active pipeline generation to finish');
      }
      const updates: Record<string, unknown> = adminActionFields({
        adminId, adminEmail, actionType: 'confirm-preview', targetField: confirmedField,
      });
      if (targetField === 'meshImages') {
        const previewImage = preview.meshImages?.[angle as PipelineMeshAngle];
        if (!previewImage || preview.imageOperationIds?.[angle as PipelineMeshAngle]) {
          throw new functions.https.HttpsError('failed-precondition', 'No completed image preview to confirm');
        }
        updates[`meshImages.${angle}`] = previewImage;
        updates[`adminPreview.meshImages.${angle}`] = admin.firestore.FieldValue.delete();
      } else {
        if (!preview.meshUrl || !preview.meshStoragePath || preview.taskStatus !== 'completed') {
          throw new functions.https.HttpsError('failed-precondition', 'No completed mesh preview to confirm');
        }
        Object.assign(updates, clearMeshPreview(), {
          meshUrl: preview.meshUrl,
          meshStoragePath: preview.meshStoragePath,
          meshDownloadFiles: preview.meshDownloadFiles || [],
          meshFormat: 'glb',
          status: 'mesh-ready',
          // Replace derived results and task metadata that belonged to the previous mesh.
          texturedModelUrl: admin.firestore.FieldValue.delete(),
          texturedModelStoragePath: admin.firestore.FieldValue.delete(),
          texturedDownloadFiles: admin.firestore.FieldValue.delete(),
          meshyTextureTaskId: admin.firestore.FieldValue.delete(),
          providerTaskId: preview.taskId || admin.firestore.FieldValue.delete(),
          meshyMeshTaskId: preview.provider === 'meshy' && preview.taskId
            ? preview.taskId : admin.firestore.FieldValue.delete(),
          finalizationClaim: admin.firestore.FieldValue.delete(),
          optimization: admin.firestore.FieldValue.delete(),
          completedAt: admin.firestore.FieldValue.delete(),
          error: admin.firestore.FieldValue.delete(),
          errorStep: admin.firestore.FieldValue.delete(),
        });
        if (preview.provider) updates['settings.provider'] = preview.provider;
      }
      transaction.update(pipelineRef, updates);
      return pipeline.userId;
    });

    functions.logger.info('Admin confirmed preview', {
      adminId,
      pipelineId,
      targetField: confirmedField,
      userId,
    });

    return {
      success: true,
      confirmedField,
    };
  });

interface AdminRejectPreviewData {
  pipelineId: string;
  targetField: 'meshImages' | 'mesh' | 'all';
  angle?: string;
}

/**
 * Cloud Function: adminRejectPreview
 *
 * Admin-only function to reject preview and discard changes.
 */
export const adminRejectPreview = functions
  .region('asia-east1')
  .runWith({
    timeoutSeconds: 60,
    memory: '256MB',
  })
  .https.onCall(async (data: AdminRejectPreviewData, context) => {
    if (!context.auth) {
      throw new functions.https.HttpsError('unauthenticated', 'Must be logged in');
    }

    if (!(await isAdmin(context))) {
      throw new functions.https.HttpsError('permission-denied', 'Admin access required');
    }

    const adminId = context.auth.uid;
    const adminEmail = await getAdminEmail(adminId);
    data = normalizeCallableData(data);
    const { pipelineId, targetField, angle } = data;
    assertDocumentId(pipelineId, 'Pipeline ID');
    validatePreviewTarget(targetField, angle, true);

    const pipelineRef = db.collection('pipelines').doc(pipelineId);
    const rejectedField = targetField === 'meshImages' ? `meshImages.${angle}` : targetField;
    const userId = await db.runTransaction(async (transaction) => {
      const pipelineDoc = await transaction.get(pipelineRef);
      if (!pipelineDoc.exists) {
        throw new functions.https.HttpsError('not-found', 'Pipeline not found');
      }
      const pipeline = pipelineDoc.data() as PipelineDocument;
      const updates: Record<string, unknown> = adminActionFields({
        adminId, adminEmail, actionType: 'reject-preview', targetField: rejectedField,
      });
      if (targetField === 'all') {
        updates.adminPreview = admin.firestore.FieldValue.delete();
      } else if (targetField === 'meshImages') {
        updates[`adminPreview.meshImages.${angle}`] = admin.firestore.FieldValue.delete();
        updates[`adminPreview.imageOperationIds.${angle}`] = admin.firestore.FieldValue.delete();
      } else {
        Object.assign(updates, clearMeshPreview());
      }
      transaction.update(pipelineRef, updates);
      return pipeline.userId;
    });

    functions.logger.info('Admin rejected preview', {
      adminId,
      pipelineId,
      targetField: rejectedField,
      userId,
    });

    return {
      success: true,
      rejectedField,
    };
  });
