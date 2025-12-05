"use strict";
/**
 * View Generation Cloud Functions for Multi-Step Flow
 *
 * Handles AI-based view generation from the original uploaded image:
 * - generateSessionViews: Generate views for selected angles using Gemini
 * - regenerateView: Regenerate a single view (charges 1 credit)
 */
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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.uploadCustomView = exports.regenerateView = exports.generateSessionViews = void 0;
const functions = __importStar(require("firebase-functions/v1"));
const admin = __importStar(require("firebase-admin"));
const axios_1 = __importDefault(require("axios"));
const client_1 = require("../gemini/client");
const credits_1 = require("../utils/credits");
const storage_1 = require("../storage");
const types_1 = require("../rodin/types");
const db = admin.firestore();
/**
 * Download image from URL or Storage path
 */
async function downloadImage(url, storagePath) {
    // If we have a storage path, download from storage (Firebase or R2)
    if (storagePath) {
        const buffer = await (0, storage_1.downloadFile)(storagePath);
        // Infer mime type from extension
        const ext = storagePath.split('.').pop()?.toLowerCase();
        const mimeType = ext === 'jpg' || ext === 'jpeg'
            ? 'image/jpeg'
            : ext === 'png'
                ? 'image/png'
                : ext === 'webp'
                    ? 'image/webp'
                    : 'image/png';
        return { buffer, mimeType };
    }
    // Otherwise download from URL
    const response = await axios_1.default.get(url, {
        responseType: 'arraybuffer',
        timeout: 30000,
    });
    return {
        buffer: Buffer.from(response.data),
        mimeType: response.headers['content-type'] || 'image/png',
    };
}
/**
 * Upload generated view to storage (Firebase or R2)
 */
async function uploadGeneratedView(sessionId, userId, angle, imageBase64, mimeType) {
    const extension = mimeType.split('/')[1] || 'png';
    const storagePath = `sessions/${userId}/${sessionId}/views/${angle}.${extension}`;
    // Use storage abstraction layer
    const url = await (0, storage_1.uploadBase64)(imageBase64, storagePath, mimeType);
    return { url, storagePath };
}
/**
 * generateSessionViews - Generate AI views for a session
 *
 * Takes the original uploaded image and generates the selected view angles.
 * Charges VIEW_GENERATION credit cost (1 credit).
 */
exports.generateSessionViews = functions
    .region('asia-east1')
    .runWith({
    timeoutSeconds: 300, // 5 minutes for multiple view generation
    memory: '512MB',
})
    .https.onCall(async (data, context) => {
    // Verify authentication
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'Must be logged in');
    }
    const { sessionId } = data;
    if (!sessionId) {
        throw new functions.https.HttpsError('invalid-argument', 'Session ID is required');
    }
    const userId = context.auth.uid;
    // Get session
    const sessionRef = db.collection('sessions').doc(sessionId);
    const sessionDoc = await sessionRef.get();
    if (!sessionDoc.exists) {
        throw new functions.https.HttpsError('not-found', 'Session not found');
    }
    const session = sessionDoc.data();
    // Verify ownership
    if (session.userId !== userId) {
        throw new functions.https.HttpsError('permission-denied', 'Not authorized to access this session');
    }
    // Verify session has original image
    if (!session.originalImage) {
        throw new functions.https.HttpsError('failed-precondition', 'No original image uploaded');
    }
    // Verify session has selected angles
    if (!session.selectedAngles || session.selectedAngles.length === 0) {
        throw new functions.https.HttpsError('failed-precondition', 'No angles selected for generation');
    }
    // Deduct credits (throws if insufficient)
    await (0, credits_1.deductCredits)(userId, types_1.SESSION_CREDIT_COSTS.VIEW_GENERATION, `view_generation_${sessionId}`);
    // Update session status
    await sessionRef.update({
        status: 'generating-views',
        currentStep: 2,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    try {
        // Download original image
        const { buffer, mimeType } = await downloadImage(session.originalImage.url, session.originalImage.storagePath);
        functions.logger.info('Downloaded original image', {
            sessionId,
            mimeType,
            size: buffer.length,
        });
        // Generate views using Gemini
        const geminiClient = (0, client_1.createGeminiClient)();
        const base64 = buffer.toString('base64');
        const generatedViews = await geminiClient.generateViews(base64, mimeType, session.selectedAngles);
        functions.logger.info('Generated views', {
            sessionId,
            count: generatedViews.length,
            angles: generatedViews.map((v) => v.angle),
        });
        // Upload generated views to Storage and update session
        const viewsUpdate = {};
        for (const view of generatedViews) {
            const { url, storagePath } = await uploadGeneratedView(sessionId, userId, view.angle, view.imageBase64, view.mimeType);
            viewsUpdate[`views.${view.angle}`] = {
                url,
                storagePath,
                source: 'ai',
                createdAt: admin.firestore.FieldValue.serverTimestamp(),
            };
        }
        // Update session with generated views
        await sessionRef.update({
            ...viewsUpdate,
            status: 'views-ready',
            currentStep: 3,
            viewGenerationCount: admin.firestore.FieldValue.increment(1),
            totalCreditsUsed: admin.firestore.FieldValue.increment(types_1.SESSION_CREDIT_COSTS.VIEW_GENERATION),
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
        functions.logger.info('Session views generated successfully', {
            sessionId,
            userId,
            viewCount: generatedViews.length,
        });
        return {
            success: true,
            viewCount: generatedViews.length,
            angles: generatedViews.map((v) => v.angle),
        };
    }
    catch (error) {
        // Update session status to failed
        await sessionRef.update({
            status: 'failed',
            error: error instanceof Error ? error.message : 'View generation failed',
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
        functions.logger.error('View generation failed', {
            sessionId,
            error: error instanceof Error ? error.message : 'Unknown error',
        });
        throw new functions.https.HttpsError('internal', `View generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
});
/**
 * regenerateView - Regenerate a single view angle
 *
 * Allows users to regenerate a specific view if they're not satisfied.
 * Charges VIEW_GENERATION credit cost (1 credit) per regeneration.
 */
exports.regenerateView = functions
    .region('asia-east1')
    .runWith({
    timeoutSeconds: 120,
    memory: '512MB',
})
    .https.onCall(async (data, context) => {
    // Verify authentication
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'Must be logged in');
    }
    const { sessionId, angle } = data;
    if (!sessionId || !angle) {
        throw new functions.https.HttpsError('invalid-argument', 'Session ID and angle are required');
    }
    const validAngles = ['back', 'left', 'right', 'top'];
    if (!validAngles.includes(angle)) {
        throw new functions.https.HttpsError('invalid-argument', `Invalid angle: ${angle}`);
    }
    const userId = context.auth.uid;
    // Get session
    const sessionRef = db.collection('sessions').doc(sessionId);
    const sessionDoc = await sessionRef.get();
    if (!sessionDoc.exists) {
        throw new functions.https.HttpsError('not-found', 'Session not found');
    }
    const session = sessionDoc.data();
    // Verify ownership
    if (session.userId !== userId) {
        throw new functions.https.HttpsError('permission-denied', 'Not authorized to access this session');
    }
    // Verify session has original image
    if (!session.originalImage) {
        throw new functions.https.HttpsError('failed-precondition', 'No original image uploaded');
    }
    // Deduct credits for regeneration (throws if insufficient)
    await (0, credits_1.deductCredits)(userId, types_1.SESSION_CREDIT_COSTS.VIEW_GENERATION, `view_regeneration_${sessionId}_${angle}`);
    try {
        // Download original image
        const { buffer, mimeType } = await downloadImage(session.originalImage.url, session.originalImage.storagePath);
        // Generate single view using Gemini
        const geminiClient = (0, client_1.createGeminiClient)();
        const base64 = buffer.toString('base64');
        const generatedViews = await geminiClient.generateViews(base64, mimeType, [angle]);
        const view = generatedViews[0];
        // Upload to Storage
        const { url, storagePath } = await uploadGeneratedView(sessionId, userId, view.angle, view.imageBase64, view.mimeType);
        // Update session
        await sessionRef.update({
            [`views.${angle}`]: {
                url,
                storagePath,
                source: 'ai',
                createdAt: admin.firestore.FieldValue.serverTimestamp(),
            },
            viewGenerationCount: admin.firestore.FieldValue.increment(1),
            totalCreditsUsed: admin.firestore.FieldValue.increment(types_1.SESSION_CREDIT_COSTS.VIEW_GENERATION),
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
        functions.logger.info('View regenerated successfully', {
            sessionId,
            userId,
            angle,
        });
        return {
            success: true,
            angle,
            url,
        };
    }
    catch (error) {
        functions.logger.error('View regeneration failed', {
            sessionId,
            angle,
            error: error instanceof Error ? error.message : 'Unknown error',
        });
        throw new functions.https.HttpsError('internal', `View regeneration failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
});
/**
 * uploadCustomView - Allow user to upload a custom view image
 *
 * This doesn't charge credits - users can replace AI views with their own.
 */
exports.uploadCustomView = functions
    .region('asia-east1')
    .https.onCall(async (data, context) => {
    // Verify authentication
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'Must be logged in');
    }
    const { sessionId, angle, imageUrl, storagePath } = data;
    if (!sessionId || !angle || !imageUrl || !storagePath) {
        throw new functions.https.HttpsError('invalid-argument', 'Session ID, angle, imageUrl, and storagePath are required');
    }
    const validAngles = ['front', 'back', 'left', 'right', 'top'];
    if (!validAngles.includes(angle)) {
        throw new functions.https.HttpsError('invalid-argument', `Invalid angle: ${angle}`);
    }
    const userId = context.auth.uid;
    // Get session
    const sessionRef = db.collection('sessions').doc(sessionId);
    const sessionDoc = await sessionRef.get();
    if (!sessionDoc.exists) {
        throw new functions.https.HttpsError('not-found', 'Session not found');
    }
    const session = sessionDoc.data();
    // Verify ownership
    if (session.userId !== userId) {
        throw new functions.https.HttpsError('permission-denied', 'Not authorized to access this session');
    }
    // Update session with custom view
    await sessionRef.update({
        [`views.${angle}`]: {
            url: imageUrl,
            storagePath,
            source: 'upload',
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
        },
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    functions.logger.info('Custom view uploaded', {
        sessionId,
        userId,
        angle,
    });
    return {
        success: true,
        angle,
    };
});
//# sourceMappingURL=views.js.map