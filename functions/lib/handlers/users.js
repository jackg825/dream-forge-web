"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.onUserCreate = void 0;
const functionsV1 = __importStar(require("firebase-functions/v1"));
const v2_1 = require("firebase-functions/v2");
const admin = __importStar(require("firebase-admin"));
/**
 * Cloud Function: onUserCreate
 *
 * Triggered when a new user signs up via Firebase Auth.
 * Creates a user document in Firestore with 3 initial credits.
 *
 * Note: Using v1 auth trigger as v2 identity triggers have different behavior.
 */
exports.onUserCreate = functionsV1
    .region('asia-east1')
    .auth.user()
    .onCreate(async (userRecord) => {
    const db = admin.firestore();
    const now = admin.firestore.FieldValue.serverTimestamp();
    const userDoc = {
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
    const transactionDoc = {
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
    v2_1.logger.info('Created user document and initial credits', {
        uid: userRecord.uid,
        email: userRecord.email,
    });
});
//# sourceMappingURL=users.js.map