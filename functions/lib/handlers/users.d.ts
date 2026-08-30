import * as functionsV1 from 'firebase-functions/v1';
/**
 * Cloud Function: onUserCreate
 *
 * Triggered when a new user signs up via Firebase Auth.
 * Creates a user document. Email/password accounts receive welcome credits
 * only after proving control of the address.
 *
 * Note: Using v1 auth trigger as v2 identity triggers have different behavior.
 */
export declare const onUserCreate: functionsV1.CloudFunction<import("firebase-admin/auth").UserRecord>;
/** Idempotently grant welcome credits after email ownership is verified. */
export declare const claimWelcomeCredits: functionsV1.HttpsFunction & functionsV1.Runnable<any>;
