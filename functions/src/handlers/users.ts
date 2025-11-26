import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import type { UserDocument, TransactionDocument } from '../rodin/types';

/**
 * Cloud Function: onUserCreate
 *
 * Triggered when a new user signs up via Firebase Auth.
 * Creates a user document in Firestore with 3 initial credits.
 */
export const onUserCreate = functions
  .region('asia-east1')
  .auth.user()
  .onCreate(async (user) => {
    const db = admin.firestore();
    const now = admin.firestore.FieldValue.serverTimestamp();

    const userDoc: Omit<UserDocument, 'createdAt' | 'updatedAt'> & {
      createdAt: FirebaseFirestore.FieldValue;
      updatedAt: FirebaseFirestore.FieldValue;
    } = {
      uid: user.uid,
      email: user.email || '',
      displayName: user.displayName || 'User',
      photoURL: user.photoURL || null,
      credits: 3, // Initial free credits
      totalGenerated: 0,
      createdAt: now,
      updatedAt: now,
    };

    const transactionDoc: Omit<TransactionDocument, 'createdAt'> & {
      createdAt: FirebaseFirestore.FieldValue;
    } = {
      userId: user.uid,
      type: 'bonus',
      amount: 3,
      jobId: null,
      createdAt: now,
    };

    // Use batch write to ensure atomicity
    const batch = db.batch();

    // Create user document
    const userRef = db.collection('users').doc(user.uid);
    batch.set(userRef, userDoc);

    // Create transaction record for initial credits
    const txRef = db.collection('transactions').doc();
    batch.set(txRef, transactionDoc);

    await batch.commit();

    functions.logger.info('Created user document and initial credits', {
      uid: user.uid,
      email: user.email,
    });
  });
