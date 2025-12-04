import * as functions from 'firebase-functions/v1';
import * as admin from 'firebase-admin';
import type { TransactionDocument } from '../rodin/types';
import { createRodinClient } from '../rodin/client';

const db = admin.firestore();

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

interface SetUnlimitedCreditsData {
  targetUserId: string;
  unlimited: boolean;  // true to enable, false to disable
}

/**
 * Cloud Function: setUnlimitedCredits
 *
 * Admin-only function to give a user unlimited credits (or revoke).
 * Sets credits to a very high number (999999) as a flag.
 */
export const setUnlimitedCredits = functions
  .region('asia-east1')
  .https.onCall(async (data: SetUnlimitedCreditsData, context) => {
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

    const { targetUserId, unlimited } = data;

    if (!targetUserId) {
      throw new functions.https.HttpsError(
        'invalid-argument',
        'Target user ID is required'
      );
    }

    const userRef = db.collection('users').doc(targetUserId);
    const userDoc = await userRef.get();

    if (!userDoc.exists) {
      throw new functions.https.HttpsError(
        'not-found',
        'Target user not found'
      );
    }

    const newCredits = unlimited ? 999999 : 3; // Reset to default if disabling

    await userRef.update({
      credits: newCredits,
      isAdmin: unlimited, // Optional: flag user as admin
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    functions.logger.info('Admin set unlimited credits', {
      adminId: context.auth.uid,
      targetUserId,
      unlimited,
    });

    return {
      success: true,
      targetUserId,
      unlimited,
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
          textureImages: pipelineData.textureImages || {},
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
