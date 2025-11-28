import * as functionsV1 from 'firebase-functions/v1';
/**
 * Cloud Function: onUserCreate
 *
 * Triggered when a new user signs up via Firebase Auth.
 * Creates a user document in Firestore with 3 initial credits.
 *
 * Note: Using v1 auth trigger as v2 identity triggers have different behavior.
 */
export declare const onUserCreate: functionsV1.CloudFunction<import("firebase-admin/auth").UserRecord>;
