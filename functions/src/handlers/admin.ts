import * as functions from 'firebase-functions/v1';
import * as admin from 'firebase-admin';
import axios from 'axios';
import type {
  TransactionDocument,
  PipelineDocument,
  PipelineMeshAngle,
  PipelineProcessedImage,
  AdminAction,
} from '../rodin/types';
import type { ProviderType, ProviderOptions } from '../providers/types';
import { createRodinClient } from '../rodin/client';
import { MeshyProvider } from '../providers/meshy/client';
import { TripoProvider } from '../providers/tripo/client';
import { HunyuanProvider } from '../providers/hunyuan/client';
import { ProviderFactory } from '../providers/factory';
import { createMultiViewGenerator } from '../gemini/multi-view-generator';
import type { GeminiImageModel } from '../gemini/multi-view-generator';
import { uploadBase64 } from '../storage';

const db = admin.firestore();

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

    const { targetUserId, amount, reason } = data;

    // Validate input
    if (!targetUserId) {
      throw new functions.https.HttpsError(
        'invalid-argument',
        'Target user ID is required'
      );
    }

    if (!amount || amount <= 0) {
      throw new functions.https.HttpsError(
        'invalid-argument',
        'Amount must be a positive number'
      );
    }

    // Check target user exists
    const userRef = db.collection('users').doc(targetUserId);
    const userDoc = await userRef.get();

    if (!userDoc.exists) {
      throw new functions.https.HttpsError(
        'not-found',
        'Target user not found'
      );
    }

    // Add credits using transaction
    await db.runTransaction(async (transaction) => {
      // Update user credits
      transaction.update(userRef, {
        credits: admin.firestore.FieldValue.increment(amount),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      // Create transaction record
      const txDoc: Omit<TransactionDocument, 'createdAt'> & {
        createdAt: FirebaseFirestore.FieldValue;
        adminId?: string;
        reason?: string;
      } = {
        userId: targetUserId,
        type: 'bonus',
        amount: amount,
        jobId: null,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        adminId: context.auth!.uid,
        reason: reason || 'Admin credit addition',
      };

      const txRef = db.collection('transactions').doc();
      transaction.set(txRef, txDoc);
    });

    const newCredits = (userDoc.data()?.credits || 0) + amount;

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
  .runWith({
    secrets: ['RODIN_API_KEY'],
  })
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
      // Get user count
      const usersSnapshot = await db.collection('users').count().get();
      const totalUsers = usersSnapshot.data().count;

      // Get job counts by status
      const jobsSnapshot = await db.collection('jobs').get();
      const jobStats = {
        total: 0,
        pending: 0,
        processing: 0,
        completed: 0,
        failed: 0,
      };

      jobsSnapshot.forEach((doc) => {
        const status = doc.data().status as keyof typeof jobStats;
        jobStats.total++;
        if (status in jobStats) {
          jobStats[status]++;
        }
      });

      // Get total credits distributed
      const transactionsSnapshot = await db
        .collection('transactions')
        .where('type', '==', 'bonus')
        .get();

      let totalCreditsDistributed = 0;
      transactionsSnapshot.forEach((doc) => {
        totalCreditsDistributed += doc.data().amount || 0;
      });

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

    const limit = Math.min(data.limit || 50, 100);
    const offset = data.offset || 0;

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

    const limit = Math.min(data.limit || 20, 50);
    const offset = data.offset || 0;
    const { status, userId } = data;

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

      const pipelines = pipelinesSnapshot.docs.map((doc) => {
        const pipelineData = doc.data();
        const userData = userMap.get(pipelineData.userId);

        return {
          id: doc.id,
          userId: pipelineData.userId,
          userDisplayName: userData?.displayName || 'Unknown',
          userEmail: userData?.email || 'Unknown',
          userPhotoURL: userData?.photoURL || null,
          status: pipelineData.status,
          processingMode: pipelineData.processingMode,
          generationMode: pipelineData.generationMode,
          inputImages: pipelineData.inputImages || [],
          meshImages: pipelineData.meshImages || {},
          meshUrl: pipelineData.meshUrl || null,
          texturedModelUrl: pipelineData.texturedModelUrl || null,
          creditsCharged: pipelineData.creditsCharged || { mesh: 0, texture: 0 },
          settings: pipelineData.settings || {},
          userDescription: pipelineData.userDescription || null,
          error: pipelineData.error || null,
          createdAt: pipelineData.createdAt?.toDate?.()?.toISOString() || null,
          updatedAt: pipelineData.updatedAt?.toDate?.()?.toISOString() || null,
          completedAt: pipelineData.completedAt?.toDate?.()?.toISOString() || null,
        };
      });

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

    const { targetUserId, amount, reason } = data;

    // Validate input
    if (!targetUserId) {
      throw new functions.https.HttpsError(
        'invalid-argument',
        'Target user ID is required'
      );
    }

    if (!amount || amount <= 0) {
      throw new functions.https.HttpsError(
        'invalid-argument',
        'Amount must be a positive number'
      );
    }

    if (!reason || reason.trim().length === 0) {
      throw new functions.https.HttpsError(
        'invalid-argument',
        'Reason is required for deductions'
      );
    }

    // Check target user exists and has enough credits
    const userRef = db.collection('users').doc(targetUserId);
    const userDoc = await userRef.get();

    if (!userDoc.exists) {
      throw new functions.https.HttpsError(
        'not-found',
        'Target user not found'
      );
    }

    const currentCredits = userDoc.data()?.credits || 0;
    if (currentCredits < amount) {
      throw new functions.https.HttpsError(
        'failed-precondition',
        `User only has ${currentCredits} credits, cannot deduct ${amount}`
      );
    }

    // Deduct credits using transaction
    await db.runTransaction(async (transaction) => {
      // Update user credits
      transaction.update(userRef, {
        credits: admin.firestore.FieldValue.increment(-amount),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      // Create transaction record with type 'adjustment' (negative amount)
      const txDoc = {
        userId: targetUserId,
        type: 'adjustment',
        amount: -amount,  // Negative to indicate deduction
        jobId: null,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        adminId: context.auth!.uid,
        reason: reason.trim(),
      };

      const txRef = db.collection('transactions').doc();
      transaction.set(txRef, txDoc);
    });

    const newCredits = currentCredits - amount;

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

    const { targetUserId } = data;
    const limit = Math.min(data.limit || 50, 100);
    const offset = data.offset || 0;

    if (!targetUserId) {
      throw new functions.https.HttpsError(
        'invalid-argument',
        'Target user ID is required'
      );
    }

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
  .runWith({
    secrets: ['RODIN_API_KEY', 'MESHY_API_KEY', 'TRIPO_API_KEY', 'HITEM_ACCESS_KEY', 'HITEM_SECRET_KEY'],
  })
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
async function addAdminAction(
  pipelineRef: FirebaseFirestore.DocumentReference,
  action: Omit<AdminAction, 'timestamp'>
): Promise<void> {
  const actionWithTimestamp: AdminAction = {
    ...action,
    timestamp: admin.firestore.Timestamp.now(),
  };

  await pipelineRef.update({
    adminActions: admin.firestore.FieldValue.arrayUnion(actionWithTimestamp),
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
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
    const { pipelineId, viewType, angle, hint } = data;

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

    try {
      // Download reference image
      const referenceImageUrl = pipeline.inputImages[0].url;
      const { base64, mimeType } = await downloadImageAsBase64(referenceImageUrl);

      // Generate view using pipeline's settings
      const modeId = pipeline.generationMode || 'simplified-texture';
      const geminiModel = (pipeline.settings?.geminiModel || 'gemini-2.5-flash') as GeminiImageModel;
      const generator = createMultiViewGenerator(modeId, pipeline.userDescription, pipeline.imageAnalysis, geminiModel);
      const now = admin.firestore.FieldValue.serverTimestamp();

      // Only mesh views can be regenerated
      if (viewType !== 'mesh') {
        throw new functions.https.HttpsError(
          'invalid-argument',
          'Texture view regeneration is not supported. Only mesh views can be regenerated.'
        );
      }

      const previousUrl = pipeline.meshImages[angle as PipelineMeshAngle]?.url;

      const view = await generator.generateMeshView(base64, mimeType, angle as PipelineMeshAngle, hint);
      const ext = getExtensionFromMimeType(view.mimeType);
      // Store in preview/ subdirectory
      const storagePath = `pipelines/${pipeline.userId}/${pipelineId}/preview/mesh_${angle}.${ext}`;
      const url = await uploadImageToStorage(view.imageBase64, view.mimeType, storagePath);

      const processedImage: PipelineProcessedImage = {
        url,
        storagePath,
        source: 'gemini',
        generatedAt: now as unknown as FirebaseFirestore.Timestamp,
      };
      if (view.colorPalette?.length) {
        processedImage.colorPalette = view.colorPalette;
      }

      // Update adminPreview
      await pipelineRef.update({
        [`adminPreview.meshImages.${angle}`]: processedImage,
        'adminPreview.createdAt': now,
        'adminPreview.createdBy': adminId,
        updatedAt: now,
      });

      // Add audit trail
      await addAdminAction(pipelineRef, {
        adminId,
        adminEmail,
        actionType: 'regenerate-image',
        targetField: `${viewType}Images.${angle}`,
        previousValue: previousUrl || null,
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
    secrets: ['MESHY_API_KEY', 'RODIN_API_KEY', 'TRIPO_API_KEY', 'TENCENT_SECRET_ID', 'TENCENT_SECRET_KEY', 'HITEM_ACCESS_KEY', 'HITEM_SECRET_KEY'],
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
    const { pipelineId, provider: requestedProvider, providerOptions } = data;

    const pipelineRef = db.collection('pipelines').doc(pipelineId);
    const pipelineDoc = await pipelineRef.get();

    if (!pipelineDoc.exists) {
      throw new functions.https.HttpsError('not-found', 'Pipeline not found');
    }

    const pipeline = pipelineDoc.data() as PipelineDocument;

    // Check pipeline has images ready
    if (!pipeline.meshImages || Object.keys(pipeline.meshImages).length < 4) {
      throw new functions.https.HttpsError('failed-precondition', 'Pipeline images not ready');
    }

    try {
      // Collect mesh image URLs
      const meshAngles: PipelineMeshAngle[] = ['front', 'back', 'left', 'right'];
      const imageUrls = meshAngles
        .map((angle) => pipeline.meshImages[angle]?.url)
        .filter((url): url is string => !!url);

      if (imageUrls.length < 4) {
        throw new functions.https.HttpsError('failed-precondition', 'Not all mesh images available');
      }

      // Get provider
      const providerType = requestedProvider || pipeline.settings?.provider || 'meshy';
      const provider = ProviderFactory.getProvider(providerType);

      // Start mesh generation (no credits deducted) - provider-specific handling
      let result;
      if (providerType === 'tripo') {
        const tripoProvider = provider as TripoProvider;
        result = await tripoProvider.generateFromUrls(imageUrls, {
          quality: (pipeline.settings?.quality as 'draft' | 'standard' | 'fine') || 'standard',
          format: (pipeline.settings?.format as 'glb' | 'obj' | 'fbx' | 'stl' | 'usdz') || 'glb',
          enableTexture: true,
          enablePBR: true,
        });
      } else if (providerType === 'meshy') {
        const meshyProvider = provider as MeshyProvider;
        result = await meshyProvider.generateMeshOnlyFromUrls(imageUrls, {
          quality: (pipeline.settings?.quality as 'draft' | 'standard' | 'fine') || 'standard',
          format: (pipeline.settings?.format as 'glb' | 'obj' | 'fbx' | 'stl' | 'usdz') || 'glb',
          precision: pipeline.settings?.meshPrecision || 'standard',
        });
      } else if (providerType === 'hunyuan') {
        const hunyuanProvider = provider as HunyuanProvider;
        result = await hunyuanProvider.generateFromUrls(imageUrls, {
          quality: (pipeline.settings?.quality as 'draft' | 'standard' | 'fine') || 'standard',
          format: (pipeline.settings?.format as 'glb' | 'obj' | 'fbx' | 'stl' | 'usdz') || 'glb',
          enablePBR: false,
          providerOptions: providerOptions?.faceCount ? {
            hunyuan: { faceCount: providerOptions.faceCount },
          } : undefined,
        });
      } else {
        // Fallback: download images and use generateFromMultipleImages
        const imageBuffers: Buffer[] = [];
        for (const url of imageUrls) {
          const response = await axios.get(url, {
            responseType: 'arraybuffer',
            timeout: 30000,
          });
          imageBuffers.push(Buffer.from(response.data));
        }
        result = await provider.generateFromMultipleImages(imageBuffers, {
          quality: (pipeline.settings?.quality as 'draft' | 'standard' | 'fine') || 'standard',
          format: (pipeline.settings?.format as 'glb' | 'obj' | 'fbx' | 'stl' | 'usdz') || 'glb',
          enableTexture: true,
          enablePBR: true,
        });
      }

      const now = admin.firestore.FieldValue.serverTimestamp();

      // Store task info in adminPreview
      await pipelineRef.update({
        'adminPreview.provider': providerType,
        'adminPreview.taskId': result.taskId,
        'adminPreview.taskStatus': 'pending',
        'adminPreview.createdAt': now,
        'adminPreview.createdBy': adminId,
        updatedAt: now,
      });

      // Add audit trail
      const previousProvider = pipeline.settings?.provider;
      await addAdminAction(pipelineRef, {
        adminId,
        adminEmail,
        actionType: previousProvider !== providerType ? 'change-provider' : 'regenerate-mesh',
        targetField: 'mesh',
        provider: providerType,
        previousValue: pipeline.meshUrl || null,
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
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      functions.logger.error('Admin mesh regeneration failed', { pipelineId, error: errorMessage });
      throw new functions.https.HttpsError('internal', `Mesh regeneration failed: ${errorMessage}`);
    }
  });

interface AdminCheckPreviewStatusData {
  pipelineId: string;
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
    secrets: ['MESHY_API_KEY', 'RODIN_API_KEY', 'TRIPO_API_KEY', 'TENCENT_SECRET_ID', 'TENCENT_SECRET_KEY', 'HITEM_ACCESS_KEY', 'HITEM_SECRET_KEY'],
  })
  .https.onCall(async (data: AdminCheckPreviewStatusData, context) => {
    if (!context.auth) {
      throw new functions.https.HttpsError('unauthenticated', 'Must be logged in');
    }

    if (!(await isAdmin(context))) {
      throw new functions.https.HttpsError('permission-denied', 'Admin access required');
    }

    const { pipelineId } = data;
    const pipelineRef = db.collection('pipelines').doc(pipelineId);
    const pipelineDoc = await pipelineRef.get();

    if (!pipelineDoc.exists) {
      throw new functions.https.HttpsError('not-found', 'Pipeline not found');
    }

    const pipeline = pipelineDoc.data() as PipelineDocument;
    const preview = pipeline.adminPreview;

    if (!preview?.taskId || !preview?.provider) {
      return {
        success: true,
        status: 'no-active-task',
        preview: preview || null,
      };
    }

    try {
      const providerInstance = ProviderFactory.getProvider(preview.provider);
      const status = await providerInstance.checkStatus(preview.taskId);

      if (status.status === 'completed') {
        // Download model to preview storage
        const downloadUrls = await providerInstance.getDownloadUrls(preview.taskId);
        const glbFile = downloadUrls.files.find((f) => f.name.endsWith('.glb'));

        if (glbFile) {
          const modelBuffer = await providerInstance.downloadModel(glbFile.url);
          const storagePath = `pipelines/${pipeline.userId}/${pipelineId}/preview/model.glb`;
          const bucket = admin.storage().bucket();
          const file = bucket.file(storagePath);
          await file.save(modelBuffer, { contentType: 'model/gltf-binary' });
          await file.makePublic();
          const meshUrl = `https://storage.googleapis.com/${bucket.name}/${storagePath}`;

          await pipelineRef.update({
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
            downloadFiles: downloadUrls.files,
          };
        }
      } else if (status.status === 'failed') {
        await pipelineRef.update({
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
      await pipelineRef.update({
        'adminPreview.taskStatus': 'processing',
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      return {
        success: true,
        status: 'processing',
        progress: status.progress,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      functions.logger.error('Admin preview status check failed', { pipelineId, error: errorMessage });
      throw new functions.https.HttpsError('internal', `Status check failed: ${errorMessage}`);
    }
  });

interface AdminConfirmPreviewData {
  pipelineId: string;
  targetField: 'meshImages' | 'mesh';
  angle?: string; // Required for meshImages
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
    const { pipelineId, targetField, angle } = data;

    const pipelineRef = db.collection('pipelines').doc(pipelineId);
    const pipelineDoc = await pipelineRef.get();

    if (!pipelineDoc.exists) {
      throw new functions.https.HttpsError('not-found', 'Pipeline not found');
    }

    const pipeline = pipelineDoc.data() as PipelineDocument;
    const preview = pipeline.adminPreview;

    if (!preview) {
      throw new functions.https.HttpsError('failed-precondition', 'No preview to confirm');
    }

    const updates: Record<string, unknown> = {
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    };

    let confirmedField: string = targetField;

    if (targetField === 'meshImages' && angle) {
      const previewImage = preview.meshImages?.[angle as PipelineMeshAngle];
      if (!previewImage) {
        throw new functions.https.HttpsError('failed-precondition', `No preview for meshImages.${angle}`);
      }
      updates[`meshImages.${angle}`] = previewImage;
      updates[`adminPreview.meshImages.${angle}`] = admin.firestore.FieldValue.delete();
      confirmedField = `meshImages.${angle}`;
    } else if (targetField === 'mesh') {
      if (!preview.meshUrl) {
        throw new functions.https.HttpsError('failed-precondition', 'No mesh preview to confirm');
      }
      updates['meshUrl'] = preview.meshUrl;
      updates['meshStoragePath'] = preview.meshStoragePath;
      updates['meshDownloadFiles'] = preview.meshDownloadFiles;
      if (preview.provider) {
        updates['settings.provider'] = preview.provider;
      }
      // Clear mesh preview fields
      updates['adminPreview.meshUrl'] = admin.firestore.FieldValue.delete();
      updates['adminPreview.meshStoragePath'] = admin.firestore.FieldValue.delete();
      updates['adminPreview.meshDownloadFiles'] = admin.firestore.FieldValue.delete();
      updates['adminPreview.taskId'] = admin.firestore.FieldValue.delete();
      updates['adminPreview.taskStatus'] = admin.firestore.FieldValue.delete();
      updates['adminPreview.provider'] = admin.firestore.FieldValue.delete();
    }

    await pipelineRef.update(updates);

    // Add audit trail
    await addAdminAction(pipelineRef, {
      adminId,
      adminEmail,
      actionType: 'confirm-preview',
      targetField: confirmedField,
    });

    functions.logger.info('Admin confirmed preview', {
      adminId,
      pipelineId,
      targetField: confirmedField,
      userId: pipeline.userId,
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
    const { pipelineId, targetField, angle } = data;

    const pipelineRef = db.collection('pipelines').doc(pipelineId);
    const pipelineDoc = await pipelineRef.get();

    if (!pipelineDoc.exists) {
      throw new functions.https.HttpsError('not-found', 'Pipeline not found');
    }

    const pipeline = pipelineDoc.data() as PipelineDocument;
    const updates: Record<string, unknown> = {
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    };

    let rejectedField: string = targetField;

    if (targetField === 'all') {
      updates['adminPreview'] = admin.firestore.FieldValue.delete();
      rejectedField = 'all';
    } else if (targetField === 'meshImages' && angle) {
      updates[`adminPreview.meshImages.${angle}`] = admin.firestore.FieldValue.delete();
      rejectedField = `meshImages.${angle}`;
    } else if (targetField === 'mesh') {
      updates['adminPreview.meshUrl'] = admin.firestore.FieldValue.delete();
      updates['adminPreview.meshStoragePath'] = admin.firestore.FieldValue.delete();
      updates['adminPreview.meshDownloadFiles'] = admin.firestore.FieldValue.delete();
      updates['adminPreview.taskId'] = admin.firestore.FieldValue.delete();
      updates['adminPreview.taskStatus'] = admin.firestore.FieldValue.delete();
      updates['adminPreview.provider'] = admin.firestore.FieldValue.delete();
    }

    await pipelineRef.update(updates);

    // Add audit trail
    await addAdminAction(pipelineRef, {
      adminId,
      adminEmail,
      actionType: 'reject-preview',
      targetField: rejectedField,
    });

    functions.logger.info('Admin rejected preview', {
      adminId,
      pipelineId,
      targetField: rejectedField,
      userId: pipeline.userId,
    });

    return {
      success: true,
      rejectedField,
    };
  });
