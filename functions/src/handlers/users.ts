import * as functionsV1 from 'firebase-functions/v1';
import { logger } from 'firebase-functions/v2';
import * as admin from 'firebase-admin';
import type { UserDocument, TransactionDocument } from '../rodin/types';

/**
 * Cloud Function: onUserCreate
 *
 * Triggered when a new user signs up via Firebase Auth.
 * Creates a user document. Email/password accounts receive welcome credits
 * only after proving control of the address.
 *
 * Note: Using v1 auth trigger as v2 identity triggers have different behavior.
 */
export const onUserCreate = functionsV1
  .region('asia-east1')
  .auth.user()
  .onCreate(async (userRecord: functionsV1.auth.UserRecord) => {
    const db = admin.firestore();
    const now = admin.firestore.FieldValue.serverTimestamp();

    const initialCredits = userRecord.emailVerified ? 3 : 0;
    const userDoc: Omit<UserDocument, 'createdAt' | 'updatedAt'> & {
      createdAt: FirebaseFirestore.FieldValue;
      updatedAt: FirebaseFirestore.FieldValue;
      welcomeCreditsGranted: boolean;
    } = {
      uid: userRecord.uid,
      email: userRecord.email || '',
      displayName: userRecord.displayName || 'User',
      photoURL: userRecord.photoURL || null,
      credits: initialCredits,
      welcomeCreditsGranted: initialCredits > 0,
      totalGenerated: 0,
      role: 'user', // Default role, set to 'admin' in Firestore to grant admin access
      tier: 'free', // Default tier, upgrade via admin panel
      createdAt: now,
      updatedAt: now,
    };

    // Use batch write to ensure atomicity
    const batch = db.batch();

    // Create user document
    const userRef = db.collection('users').doc(userRecord.uid);
    batch.set(userRef, userDoc);

    // Create transaction record for initial credits
    if (initialCredits > 0) {
      const transactionDoc: Omit<TransactionDocument, 'createdAt'> & {
        createdAt: FirebaseFirestore.FieldValue;
      } = {
        userId: userRecord.uid,
        type: 'bonus',
        amount: initialCredits,
        jobId: null,
        createdAt: now,
      };
      const txRef = db.collection('transactions').doc();
      batch.set(txRef, transactionDoc);
    }

    await batch.commit();

    logger.info('Created user document', {
      uid: userRecord.uid,
      email: userRecord.email,
      initialCredits,
    });
  });

/** Idempotently grant welcome credits after email ownership is verified. */
export const claimWelcomeCredits = functionsV1
  .region('asia-east1')
  .https.onCall(async (_data, context) => {
    if (!context.auth) {
      throw new functionsV1.https.HttpsError('unauthenticated', 'Authentication required');
    }
    if (context.auth.token.email_verified !== true) {
      throw new functionsV1.https.HttpsError(
        'failed-precondition',
        'Verify your email before claiming welcome credits'
      );
    }

    const db = admin.firestore();
    const userRef = db.collection('users').doc(context.auth.uid);
    const transactionRef = db.collection('transactions').doc();

    const granted = await db.runTransaction(async (transaction) => {
      const userSnapshot = await transaction.get(userRef);
      if (!userSnapshot.exists) {
        throw new functionsV1.https.HttpsError('failed-precondition', 'User profile is not ready');
      }
      const welcomeCreditsGranted = userSnapshot.data()?.welcomeCreditsGranted;
      if (welcomeCreditsGranted === true) return false;
      // Legacy profiles were already granted credits by onUserCreate. Mark
      // them migrated without adding a second bonus.
      if (welcomeCreditsGranted === undefined) {
        transaction.update(userRef, {
          welcomeCreditsGranted: true,
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
        return false;
      }

      transaction.update(userRef, {
        credits: admin.firestore.FieldValue.increment(3),
        welcomeCreditsGranted: true,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
      transaction.set(transactionRef, {
        userId: context.auth!.uid,
        type: 'bonus',
        amount: 3,
        jobId: null,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });
      return true;
    });

    return { granted };
  });
