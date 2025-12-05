"use strict";
/**
 * Model Generation Cloud Functions for Multi-Step Flow
 *
 * Handles 3D model generation from session view images:
 * - startSessionModelGeneration: Start generation using session views
 * - checkSessionModelStatus: Poll status and update session when complete
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
exports.checkSessionModelStatus = exports.startSessionModelGeneration = void 0;
const functions = __importStar(require("firebase-functions/v1"));
const admin = __importStar(require("firebase-admin"));
const axios_1 = __importDefault(require("axios"));
const factory_1 = require("../providers/factory");
const credits_1 = require("../utils/credits");
const storage_1 = require("../storage");
const types_1 = require("../rodin/types");
const db = admin.firestore();
// View angles in order of importance for Rodin
const VIEW_ORDER = ['front', 'back', 'left', 'right', 'top'];
/**
 * Download image from URL
 */
async function downloadImage(url) {
    const response = await axios_1.default.get(url, {
        responseType: 'arraybuffer',
        timeout: 30000,
    });
    return Buffer.from(response.data);
}
/**
 * startSessionModelGeneration - Start 3D model generation from session views
 *
 * Takes view images from a session and starts Rodin generation.
 * Charges MODEL_GENERATION credit cost (1 credit).
 */
exports.startSessionModelGeneration = functions
    .region('asia-east1')
    .runWith({
    timeoutSeconds: 300,
    memory: '1GB',
    secrets: ['RODIN_API_KEY', 'MESHY_API_KEY'],
})
    .https.onCall(async (data, context) => {
    // Verify authentication
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'Must be logged in');
    }
    const { sessionId, provider = 'meshy' } = data;
    if (!sessionId) {
        throw new functions.https.HttpsError('invalid-argument', 'Session ID is required');
    }
    const userId = context.auth.uid;
    const selectedProvider = provider;
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
    // Verify session has views
    const views = session.views || {};
    const availableAngles = VIEW_ORDER.filter((angle) => views[angle]?.url);
    if (availableAngles.length === 0) {
        throw new functions.https.HttpsError('failed-precondition', 'No view images available for generation');
    }
    // Deduct credits (throws if insufficient)
    await (0, credits_1.deductCredits)(userId, types_1.SESSION_CREDIT_COSTS.MODEL_GENERATION, `model_generation_${sessionId}`);
    // Update session status
    await sessionRef.update({
        status: 'generating-model',
        currentStep: 4,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    try {
        // Download all view images
        const imageBuffers = [];
        const viewAngles = [];
        for (const angle of availableAngles) {
            const view = views[angle];
            if (!view?.url)
                continue;
            const buffer = await downloadImage(view.url);
            imageBuffers.push(buffer);
            viewAngles.push(angle);
            functions.logger.info(`Downloaded ${angle} view`, {
                sessionId,
                size: buffer.length,
            });
        }
        functions.logger.info('All views downloaded', {
            sessionId,
            count: imageBuffers.length,
            angles: viewAngles,
        });
        // Get quality settings from session
        const quality = session.settings?.quality || 'standard';
        const printerType = session.settings?.printerType || 'fdm';
        // Call provider API
        const generationProvider = (0, factory_1.createProvider)(selectedProvider);
        const generationResult = await generationProvider.generateFromMultipleImages(imageBuffers, {
            quality: quality,
            format: 'stl', // STL for 3D printing
            enableTexture: false,
            enablePBR: false,
        });
        // Create a job document for tracking
        const jobRef = db.collection('jobs').doc();
        const jobId = jobRef.id;
        const jobData = {
            userId,
            jobType: 'model',
            status: 'generating-model',
            inputImageUrls: availableAngles.map((a) => views[a]?.url),
            viewAngles,
            outputModelUrl: null,
            // Provider abstraction fields
            provider: selectedProvider,
            providerTaskId: generationResult.taskId,
            providerSubscriptionKey: generationResult.subscriptionKey || '',
            sessionId, // Link back to session
            settings: {
                tier: 'Gen-2',
                quality,
                format: 'stl',
                printerType,
                inputMode: 'multi',
                imageCount: imageBuffers.length,
                provider: selectedProvider,
            },
            error: null,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            completedAt: null,
        };
        // Add legacy Rodin fields for backwards compatibility
        if (selectedProvider === 'rodin') {
            jobData.rodinTaskId = generationResult.taskId;
            jobData.rodinTaskUuid = generationResult.taskId;
            jobData.rodinJobUuids = generationResult.jobUuids || [];
            jobData.rodinSubscriptionKey = generationResult.subscriptionKey || '';
        }
        await jobRef.set(jobData);
        // Update session with job reference
        await sessionRef.update({
            jobId,
            totalCreditsUsed: admin.firestore.FieldValue.increment(types_1.SESSION_CREDIT_COSTS.MODEL_GENERATION),
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
        functions.logger.info('Model generation started', {
            sessionId,
            jobId,
            provider: selectedProvider,
            taskId: generationResult.taskId,
            quality,
            imageCount: imageBuffers.length,
        });
        return {
            success: true,
            jobId,
            status: 'generating-model',
        };
    }
    catch (error) {
        // Update session status to failed
        await sessionRef.update({
            status: 'failed',
            error: error instanceof Error ? error.message : 'Model generation failed',
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
        functions.logger.error('Model generation failed', {
            sessionId,
            error: error instanceof Error ? error.message : 'Unknown error',
        });
        throw new functions.https.HttpsError('internal', `Model generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
});
/**
 * checkSessionModelStatus - Check model generation status and update session
 *
 * Polls Rodin status and updates session when complete.
 */
exports.checkSessionModelStatus = functions
    .region('asia-east1')
    .runWith({
    timeoutSeconds: 540, // 9 minutes for model download
    memory: '1GB',
    secrets: ['RODIN_API_KEY', 'MESHY_API_KEY'],
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
    // Get job document
    if (!session.jobId) {
        throw new functions.https.HttpsError('failed-precondition', 'No generation job found for this session');
    }
    const jobRef = db.collection('jobs').doc(session.jobId);
    const jobDoc = await jobRef.get();
    if (!jobDoc.exists) {
        throw new functions.https.HttpsError('not-found', 'Job not found');
    }
    const job = jobDoc.data();
    // If already completed, return status
    if (job?.status === 'completed') {
        return {
            status: 'completed',
            outputModelUrl: job.outputModelUrl,
        };
    }
    if (job?.status === 'failed') {
        return {
            status: 'failed',
            error: job.error,
        };
    }
    // Determine provider (backwards compat: default to rodin for old jobs)
    const provider = (job?.provider || job?.settings?.provider || 'rodin');
    const generationProvider = (0, factory_1.createProvider)(provider);
    // Get task ID and subscription key
    const taskId = job?.providerTaskId || job?.rodinTaskUuid || job?.rodinTaskId;
    const subscriptionKey = job?.providerSubscriptionKey || job?.rodinSubscriptionKey;
    const statusResult = await generationProvider.checkStatus(taskId, subscriptionKey);
    functions.logger.info('Provider status polled', {
        sessionId,
        jobId: session.jobId,
        provider,
        status: statusResult.status,
        progress: statusResult.progress,
    });
    if (statusResult.status === 'completed') {
        // Download and upload model
        try {
            const downloadResult = await generationProvider.getDownloadUrls(taskId, 'stl' // requiredFormat
            );
            if (downloadResult.files.length === 0) {
                throw new Error('No download URLs available');
            }
            // Download the model
            const modelBuffer = await generationProvider.downloadModel(downloadResult.files[0].url);
            // Upload to Storage (Firebase or R2)
            const storagePath = `sessions/${userId}/${sessionId}/model.stl`;
            const outputModelUrl = await (0, storage_1.uploadBuffer)(modelBuffer, storagePath, 'application/sla');
            // Update job
            await jobRef.update({
                status: 'completed',
                outputModelUrl,
                completedAt: admin.firestore.FieldValue.serverTimestamp(),
            });
            // Update session
            await sessionRef.update({
                status: 'completed',
                currentStep: 5,
                outputModelUrl,
                updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            });
            // Increment generation count
            await (0, credits_1.incrementGenerationCount)(userId);
            functions.logger.info('Model generation completed', {
                sessionId,
                jobId: session.jobId,
                outputModelUrl,
            });
            return {
                status: 'completed',
                outputModelUrl,
            };
        }
        catch (error) {
            const errorMsg = error instanceof Error ? error.message : 'Download failed';
            await jobRef.update({
                status: 'failed',
                error: errorMsg,
            });
            await sessionRef.update({
                status: 'failed',
                error: errorMsg,
                updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            });
            throw new functions.https.HttpsError('internal', errorMsg);
        }
    }
    if (statusResult.status === 'failed') {
        await jobRef.update({
            status: 'failed',
            error: statusResult.error || 'Model generation failed',
        });
        await sessionRef.update({
            status: 'failed',
            error: 'Model generation failed',
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
        return {
            status: 'failed',
            error: statusResult.error || 'Model generation failed',
        };
    }
    // Still processing
    return {
        status: statusResult.status === 'pending' ? 'pending' : 'generating-model',
        progress: statusResult.progress,
    };
});
//# sourceMappingURL=model.js.map