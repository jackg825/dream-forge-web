import * as admin from 'firebase-admin';
import * as functions from 'firebase-functions';
import type { TransactionDocument } from '../rodin/types';

const db = admin.firestore();

/**
 * Check if a user has enough credits
 */
export async function hasCredits(userId: string, amount: number = 1): Promise<boolean> {
  const userDoc = await db.collection('users').doc(userId).get();

  if (!userDoc.exists) {
    return false;
  }

  const credits = userDoc.data()?.credits || 0;
  return credits >= amount;
}

/**
 * Deduct credits from a user's account
 *
 * Uses a Firestore transaction to ensure atomicity.
 * Returns the job ID for the transaction record.
 */
export async function deductCredits(
  userId: string,
  amount: number,
  jobId: string
): Promise<void> {
  const userRef = db.collection('users').doc(userId);

  await db.runTransaction(async (transaction) => {
    const userDoc = await transaction.get(userRef);

    if (!userDoc.exists) {
      throw new functions.https.HttpsError(
        'not-found',
        'User not found'
      );
    }

    const currentCredits = userDoc.data()?.credits || 0;

    if (currentCredits < amount) {
      throw new functions.https.HttpsError(
        'resource-exhausted',
        'Insufficient credits'
      );
    }

    // Deduct credits
    transaction.update(userRef, {
      credits: admin.firestore.FieldValue.increment(-amount),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    // Create transaction record
    const txDoc: Omit<TransactionDocument, 'createdAt'> & {
      createdAt: FirebaseFirestore.FieldValue;
    } = {
      userId,
      type: 'consume',
      amount: -amount,
      jobId,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    };

    const txRef = db.collection('transactions').doc();
    transaction.set(txRef, txDoc);
  });

  functions.logger.info('Credits deducted', { userId, amount, jobId });
}

/**
 * Refund credits to a user's account
 *
 * Called when a job fails and needs to be rolled back.
 */
export async function refundCredits(
  userId: string,
  amount: number,
  jobId: string
): Promise<void> {
  const userRef = db.collection('users').doc(userId);

  await db.runTransaction(async (transaction) => {
    const userDoc = await transaction.get(userRef);

    if (!userDoc.exists) {
      functions.logger.warn('Cannot refund credits - user not found', {
        userId,
        jobId,
      });
      return;
    }

    // Refund credits
    transaction.update(userRef, {
      credits: admin.firestore.FieldValue.increment(amount),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    // Create transaction record
    const txDoc: Omit<TransactionDocument, 'createdAt'> & {
      createdAt: FirebaseFirestore.FieldValue;
    } = {
      userId,
      type: 'bonus', // Refund is treated as a bonus
      amount: amount,
      jobId,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    };

    const txRef = db.collection('transactions').doc();
    transaction.set(txRef, txDoc);
  });

  functions.logger.info('Credits refunded', { userId, amount, jobId });
}

/**
 * Increment the user's total generation count
 */
export async function incrementGenerationCount(userId: string): Promise<void> {
  const userRef = db.collection('users').doc(userId);

  await userRef.update({
    totalGenerated: admin.firestore.FieldValue.increment(1),
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  });
}
