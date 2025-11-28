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
exports.listUsers = exports.getAdminStats = exports.checkRodinBalance = exports.setUnlimitedCredits = exports.addCredits = void 0;
const functions = __importStar(require("firebase-functions/v1"));
const admin = __importStar(require("firebase-admin"));
const client_1 = require("../rodin/client");
const db = admin.firestore();
/**
 * Check if the current user is an admin by checking their role in Firestore
 *
 * User document should have: { role: 'admin' | 'user' }
 * Set role to 'admin' directly in Firebase Console to grant admin access
 */
async function isAdmin(context) {
    if (!context.auth)
        return false;
    const userDoc = await db.collection('users').doc(context.auth.uid).get();
    if (!userDoc.exists)
        return false;
    const role = userDoc.data()?.role;
    return role === 'admin';
}
/**
 * Cloud Function: addCredits
 *
 * Admin-only function to add credits to a user's account.
 *
 * Usage:
 * - Call from Firebase Console or via httpsCallable
 * - Requires admin authentication
 */
exports.addCredits = functions
    .region('asia-east1')
    .https.onCall(async (data, context) => {
    // Check authentication
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'Must be logged in');
    }
    // Check admin permission
    if (!(await isAdmin(context))) {
        throw new functions.https.HttpsError('permission-denied', 'Admin access required');
    }
    const { targetUserId, amount, reason } = data;
    // Validate input
    if (!targetUserId) {
        throw new functions.https.HttpsError('invalid-argument', 'Target user ID is required');
    }
    if (!amount || amount <= 0) {
        throw new functions.https.HttpsError('invalid-argument', 'Amount must be a positive number');
    }
    // Check target user exists
    const userRef = db.collection('users').doc(targetUserId);
    const userDoc = await userRef.get();
    if (!userDoc.exists) {
        throw new functions.https.HttpsError('not-found', 'Target user not found');
    }
    // Add credits using transaction
    await db.runTransaction(async (transaction) => {
        // Update user credits
        transaction.update(userRef, {
            credits: admin.firestore.FieldValue.increment(amount),
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
        // Create transaction record
        const txDoc = {
            userId: targetUserId,
            type: 'bonus',
            amount: amount,
            jobId: null,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            adminId: context.auth.uid,
            reason: reason || 'Admin credit addition',
        };
        const txRef = db.collection('transactions').doc();
        transaction.set(txRef, txDoc);
    });
    const newCredits = (userDoc.data()?.credits || 0) + amount;
    functions.logger.info('Admin added credits', {
        adminId: context.auth.uid,
        targetUserId,
        amount,
        reason,
        newCredits,
    });
    return {
        success: true,
        targetUserId,
        creditsAdded: amount,
        newBalance: newCredits,
    };
});
/**
 * Cloud Function: setUnlimitedCredits
 *
 * Admin-only function to give a user unlimited credits (or revoke).
 * Sets credits to a very high number (999999) as a flag.
 */
exports.setUnlimitedCredits = functions
    .region('asia-east1')
    .https.onCall(async (data, context) => {
    // Check authentication
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'Must be logged in');
    }
    // Check admin permission
    if (!(await isAdmin(context))) {
        throw new functions.https.HttpsError('permission-denied', 'Admin access required');
    }
    const { targetUserId, unlimited } = data;
    if (!targetUserId) {
        throw new functions.https.HttpsError('invalid-argument', 'Target user ID is required');
    }
    const userRef = db.collection('users').doc(targetUserId);
    const userDoc = await userRef.get();
    if (!userDoc.exists) {
        throw new functions.https.HttpsError('not-found', 'Target user not found');
    }
    const newCredits = unlimited ? 999999 : 3; // Reset to default if disabling
    await userRef.update({
        credits: newCredits,
        isAdmin: unlimited, // Optional: flag user as admin
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    functions.logger.info('Admin set unlimited credits', {
        adminId: context.auth.uid,
        targetUserId,
        unlimited,
    });
    return {
        success: true,
        targetUserId,
        unlimited,
        newBalance: newCredits,
    };
});
/**
 * Cloud Function: checkRodinBalance
 *
 * Admin-only function to check remaining Rodin API credits.
 * Useful for monitoring API usage on the admin dashboard.
 *
 * See: https://developer.hyper3d.ai/api-specification/check_balance
 */
exports.checkRodinBalance = functions
    .region('asia-east1')
    .runWith({
    secrets: ['RODIN_API_KEY'],
})
    .https.onCall(async (_data, context) => {
    // Check authentication
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'Must be logged in');
    }
    // Check admin permission
    if (!(await isAdmin(context))) {
        throw new functions.https.HttpsError('permission-denied', 'Admin access required');
    }
    try {
        const rodinClient = (0, client_1.createRodinClient)();
        const balance = await rodinClient.checkBalance();
        functions.logger.info('Admin checked Rodin balance', {
            adminId: context.auth.uid,
            balance,
        });
        return {
            success: true,
            balance,
            checkedAt: new Date().toISOString(),
        };
    }
    catch (error) {
        functions.logger.error('Failed to check Rodin balance', { error });
        throw new functions.https.HttpsError('internal', 'Failed to check Rodin API balance');
    }
});
/**
 * Cloud Function: getAdminStats
 *
 * Admin-only function to get system-wide statistics.
 */
exports.getAdminStats = functions
    .region('asia-east1')
    .https.onCall(async (_data, context) => {
    // Check authentication
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'Must be logged in');
    }
    // Check admin permission
    if (!(await isAdmin(context))) {
        throw new functions.https.HttpsError('permission-denied', 'Admin access required');
    }
    try {
        // Get user count
        const usersSnapshot = await db.collection('users').count().get();
        const totalUsers = usersSnapshot.data().count;
        // Get job counts by status
        const jobsSnapshot = await db.collection('jobs').get();
        const jobStats = {
            total: 0,
            pending: 0,
            processing: 0,
            completed: 0,
            failed: 0,
        };
        jobsSnapshot.forEach((doc) => {
            const status = doc.data().status;
            jobStats.total++;
            if (status in jobStats) {
                jobStats[status]++;
            }
        });
        // Get total credits distributed
        const transactionsSnapshot = await db
            .collection('transactions')
            .where('type', '==', 'bonus')
            .get();
        let totalCreditsDistributed = 0;
        transactionsSnapshot.forEach((doc) => {
            totalCreditsDistributed += doc.data().amount || 0;
        });
        functions.logger.info('Admin fetched stats', {
            adminId: context.auth.uid,
        });
        return {
            success: true,
            stats: {
                totalUsers,
                jobs: jobStats,
                totalCreditsDistributed,
            },
            fetchedAt: new Date().toISOString(),
        };
    }
    catch (error) {
        functions.logger.error('Failed to fetch admin stats', { error });
        throw new functions.https.HttpsError('internal', 'Failed to fetch admin statistics');
    }
});
/**
 * Cloud Function: listUsers
 *
 * Admin-only function to list all users with their credits and stats.
 */
exports.listUsers = functions
    .region('asia-east1')
    .https.onCall(async (data, context) => {
    // Check authentication
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'Must be logged in');
    }
    // Check admin permission
    if (!(await isAdmin(context))) {
        throw new functions.https.HttpsError('permission-denied', 'Admin access required');
    }
    const limit = Math.min(data.limit || 50, 100);
    const offset = data.offset || 0;
    try {
        const usersSnapshot = await db
            .collection('users')
            .orderBy('createdAt', 'desc')
            .limit(limit)
            .offset(offset)
            .get();
        const users = usersSnapshot.docs.map((doc) => {
            const userData = doc.data();
            return {
                uid: doc.id,
                email: userData.email,
                displayName: userData.displayName,
                photoURL: userData.photoURL,
                credits: userData.credits,
                totalGenerated: userData.totalGenerated,
                role: userData.role || 'user',
                createdAt: userData.createdAt?.toDate?.()?.toISOString() || null,
            };
        });
        // Get total count
        const countSnapshot = await db.collection('users').count().get();
        const totalCount = countSnapshot.data().count;
        return {
            success: true,
            users,
            pagination: {
                total: totalCount,
                limit,
                offset,
                hasMore: offset + users.length < totalCount,
            },
        };
    }
    catch (error) {
        functions.logger.error('Failed to list users', { error });
        throw new functions.https.HttpsError('internal', 'Failed to list users');
    }
});
//# sourceMappingURL=admin.js.map