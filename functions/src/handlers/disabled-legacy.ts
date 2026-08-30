import * as functions from 'firebase-functions/v1';

function disabledLegacyCallable(
  message = 'This legacy workflow has been disabled. Use the pipeline workflow instead.'
) {
  return functions
    .region('asia-east1')
    .https.onCall(async () => {
      throw new functions.https.HttpsError(
        'failed-precondition',
        message
      );
    });
}

// Keep these names deployed as fail-closed stubs for one migration cycle so a
// normal deploy overwrites any older vulnerable implementation.
export const createSession = disabledLegacyCallable();
export const updateSession = disabledLegacyCallable();
export const deleteSession = disabledLegacyCallable();
export const getUserSessions = disabledLegacyCallable();
export const generateSessionViews = disabledLegacyCallable();
export const regenerateView = disabledLegacyCallable();
export const uploadCustomView = disabledLegacyCallable();
export const startSessionModelGeneration = disabledLegacyCallable();
export const checkSessionModelStatus = disabledLegacyCallable();
export const optimizeColorsForH2C = disabledLegacyCallable();
export const uploadEditedH2CImage = disabledLegacyCallable();
export const generateModel = disabledLegacyCallable();
export const checkJobStatus = disabledLegacyCallable();
export const retryFailedJob = disabledLegacyCallable();
export const createOrder = disabledLegacyCallable(
  'Print ordering is not available yet.'
);
export const saveShippingAddress = disabledLegacyCallable(
  'Print ordering is not available yet.'
);
export const deleteShippingAddress = disabledLegacyCallable(
  'Print ordering is not available yet.'
);
