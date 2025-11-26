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
exports.hasCredits = hasCredits;
exports.deductCredits = deductCredits;
exports.refundCredits = refundCredits;
exports.incrementGenerationCount = incrementGenerationCount;
const admin = __importStar(require("firebase-admin"));
const functions = __importStar(require("firebase-functions"));
const db = admin.firestore();
/**
 * Check if a user has enough credits
 */
async function hasCredits(userId, amount = 1) {
    const userDoc = await db.collection('users').doc(userId).get();
    if (!userDoc.exists) {
        return false;
    }
    const credits = userDoc.data()?.credits || 0;
    return credits >= amount;
}
/**
 * Deduct credits from a user's account
 *
 * Uses a Firestore transaction to ensure atomicity.
 * Returns the job ID for the transaction record.
 */
async function deductCredits(userId, amount, jobId) {
    const userRef = db.collection('users').doc(userId);
    await db.runTransaction(async (transaction) => {
        const userDoc = await transaction.get(userRef);
        if (!userDoc.exists) {
            throw new functions.https.HttpsError('not-found', 'User not found');
        }
        const currentCredits = userDoc.data()?.credits || 0;
        if (currentCredits < amount) {
            throw new functions.https.HttpsError('resource-exhausted', 'Insufficient credits');
        }
        // Deduct credits
        transaction.update(userRef, {
            credits: admin.firestore.FieldValue.increment(-amount),
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
        // Create transaction record
        const txDoc = {
            userId,
            type: 'consume',
            amount: -amount,
            jobId,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
        };
        const txRef = db.collection('transactions').doc();
        transaction.set(txRef, txDoc);
    });
    functions.logger.info('Credits deducted', { userId, amount, jobId });
}
/**
 * Refund credits to a user's account
 *
 * Called when a job fails and needs to be rolled back.
 */
async function refundCredits(userId, amount, jobId) {
    const userRef = db.collection('users').doc(userId);
    await db.runTransaction(async (transaction) => {
        const userDoc = await transaction.get(userRef);
        if (!userDoc.exists) {
            functions.logger.warn('Cannot refund credits - user not found', {
                userId,
                jobId,
            });
            return;
        }
        // Refund credits
        transaction.update(userRef, {
            credits: admin.firestore.FieldValue.increment(amount),
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
        // Create transaction record
        const txDoc = {
            userId,
            type: 'bonus', // Refund is treated as a bonus
            amount: amount,
            jobId,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
        };
        const txRef = db.collection('transactions').doc();
        transaction.set(txRef, txDoc);
    });
    functions.logger.info('Credits refunded', { userId, amount, jobId });
}
/**
 * Increment the user's total generation count
 */
async function incrementGenerationCount(userId) {
    const userRef = db.collection('users').doc(userId);
    await userRef.update({
        totalGenerated: admin.firestore.FieldValue.increment(1),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
}
//# sourceMappingURL=credits.js.map