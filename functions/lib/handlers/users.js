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
const functions = __importStar(require("firebase-functions"));
const admin = __importStar(require("firebase-admin"));
/**
 * Cloud Function: onUserCreate
 *
 * Triggered when a new user signs up via Firebase Auth.
 * Creates a user document in Firestore with 3 initial credits.
 */
exports.onUserCreate = functions
    .region('asia-east1')
    .auth.user()
    .onCreate(async (user) => {
    const db = admin.firestore();
    const now = admin.firestore.FieldValue.serverTimestamp();
    const userDoc = {
        uid: user.uid,
        email: user.email || '',
        displayName: user.displayName || 'User',
        photoURL: user.photoURL || null,
        credits: 3, // Initial free credits
        totalGenerated: 0,
        createdAt: now,
        updatedAt: now,
    };
    const transactionDoc = {
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
//# sourceMappingURL=users.js.map