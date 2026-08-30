import * as functions from 'firebase-functions/v1';
/**
 * Kept as a fail-closed callable so older clients cannot trigger uncharged
 * Gemini batch jobs while the product uses realtime generation only.
 */
export declare const submitGeminiBatch: functions.HttpsFunction & functions.Runnable<any>;
