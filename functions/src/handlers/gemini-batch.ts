import * as functions from 'firebase-functions/v1';

/**
 * Kept as a fail-closed callable so older clients cannot trigger uncharged
 * Gemini batch jobs while the product uses realtime generation only.
 */
export const submitGeminiBatch = functions
  .region('asia-east1')
  .runWith({
    timeoutSeconds: 30,
    memory: '256MB',
  })
  .https.onCall(async (_data, context) => {
    if (!context.auth) {
      throw new functions.https.HttpsError(
        'unauthenticated',
        'User must be authenticated'
      );
    }

    throw new functions.https.HttpsError(
      'failed-precondition',
      'Batch generation is temporarily disabled'
    );
  });
