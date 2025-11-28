import * as functionsV1 from 'firebase-functions/v1';
import { logger } from 'firebase-functions/v2';
import * as admin from 'firebase-admin';
import type { UserDocument, TransactionDocument } from '../rodin/types';

/**
 * Cloud Function: onUserCreate
 *
 * Triggered when a new user signs up via Firebase Auth.
 * Creates a user document in Firestore with 3 initial credits.
 *
 * Note: Using v1 auth trigger as v2 identity triggers have different behavior.
 */
export const onUserCreate = functionsV1
  .region('asia-east1')
  .auth.user()
  .onCreate(async (userRecord: functionsV1.auth.UserRecord) => {
    const db = admin.firestore();
    const now = admin.firestore.FieldValue.serverTimestamp();

    const userDoc: Omit<UserDocument, 'createdAt' | 'updatedAt'> & {
      createdAt: FirebaseFirestore.FieldValue;
      updatedAt: FirebaseFirestore.FieldValue;
    } = {
      uid: userRecord.uid,
      email: userRecord.email || '',
      displayName: userRecord.displayName || 'User',
      photoURL: userRecord.photoURL || null,
      credits: 3, // Initial free credits
      totalGenerated: 0,
      role: 'user', // Default role, set to 'admin' in Firestore to grant admin access
      createdAt: now,
      updatedAt: now,
    };

    const transactionDoc: Omit<TransactionDocument, 'createdAt'> & {
      createdAt: FirebaseFirestore.FieldValue;
    } = {
      userId: userRecord.uid,
      type: 'bonus',
      amount: 3,
      jobId: null,
      createdAt: now,
    };

    // Use batch write to ensure atomicity
    const batch = db.batch();

    // Create user document
    const userRef = db.collection('users').doc(userRecord.uid);
    batch.set(userRef, userDoc);

    // Create transaction record for initial credits
    const txRef = db.collection('transactions').doc();
    batch.set(txRef, transactionDoc);

    await batch.commit();

    logger.info('Created user document and initial credits', {
      uid: userRecord.uid,
      email: userRecord.email,
    });
  });
