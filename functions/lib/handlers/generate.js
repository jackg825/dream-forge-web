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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.retryFailedJob = exports.checkJobStatus = exports.generateModel = void 0;
const functions = __importStar(require("firebase-functions/v1"));
const admin = __importStar(require("firebase-admin"));
const axios_1 = __importDefault(require("axios"));
const client_1 = require("../gemini/client");
const factory_1 = require("../providers/factory");
const credits_1 = require("../utils/credits");
const storage_1 = require("../storage");
const db = admin.firestore();
// Credit costs based on input mode
const creditCosts = {
    single: 1,
    multi: 1,
    'ai-generated': 2,
};
/**
 * Cloud Function: generateModel
 *
 * Starts a new 3D model generation job with support for:
 * - Single image mode (1 credit)
 * - Multi-image upload mode (1 credit)
 * - AI-generated views mode using Gemini (2 credits)
 *
 * Steps:
 * 1. Verify authentication
 * 2. Calculate credit cost based on input mode
 * 3. Deduct credits
 * 4. Create job document
 * 5. Prepare images (download uploaded or generate via Gemini)
 * 6. Call provider API (Rodin or Meshy)
 * 7. Update job with provider task ID
 * 8. Return job ID to client
 */
exports.generateModel = functions
    .region('asia-east1')
    .runWith({
    timeoutSeconds: 120, // Increased for Gemini + provider API
    memory: '1GB', // Increased for image processing
    secrets: ['RODIN_API_KEY', 'GEMINI_API_KEY', 'MESHY_API_KEY'],
})
    .https.onCall(async (data, context) => {
    // 1. Verify authentication
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'You must be logged in to generate models');
    }
    const userId = context.auth.uid;
    const { imageUrl, imageUrls, viewAngles, quality = 'standard', printerType = 'fdm', inputMode = 'single', generateAngles, provider = 'meshy', // Default to Meshy-6
     } = data;
    // Validate input
    if (!imageUrl) {
        throw new functions.https.HttpsError('invalid-argument', 'Image URL is required');
    }
    // Validate provider
    if (!(0, factory_1.isValidProvider)(provider)) {
        throw new functions.https.HttpsError('invalid-argument', 'Invalid provider. Use: rodin, meshy');
    }
    // Validate quality
    const validQualities = ['draft', 'standard', 'fine', 'low', 'medium', 'high'];
    if (!validQualities.includes(quality)) {
        throw new functions.https.HttpsError('invalid-argument', 'Invalid quality level. Use: draft, standard, fine');
    }
    // Validate printer type
    const validPrinterTypes = ['fdm', 'sla', 'resin'];
    if (!validPrinterTypes.includes(printerType)) {
        throw new functions.https.HttpsError('invalid-argument', 'Invalid printer type. Use: fdm, sla, resin');
    }
    // Validate input mode
    const validInputModes = ['single', 'multi', 'ai-generated'];
    if (!validInputModes.includes(inputMode)) {
        throw new functions.https.HttpsError('invalid-argument', 'Invalid input mode. Use: single, multi, ai-generated');
    }
    // 2. Calculate credit cost based on input mode
    const creditCost = creditCosts[inputMode];
    // 3. Check credits and deduct
    const jobRef = db.collection('jobs').doc();
    const jobId = jobRef.id;
    try {
        await (0, credits_1.deductCredits)(userId, creditCost, jobId);
    }
    catch (error) {
        if (error instanceof functions.https.HttpsError &&
            error.code === 'resource-exhausted') {
            throw new functions.https.HttpsError('resource-exhausted', `You need ${creditCost} credit(s) for this generation mode.`);
        }
        throw error;
    }
    // 4. Create job document
    const now = admin.firestore.FieldValue.serverTimestamp();
    const jobSettings = {
        tier: 'Gen-2',
        quality: quality,
        format: 'glb', // GLB for preview with PBR materials
        printerType,
        inputMode,
        imageCount: 1, // Will be updated after image processing
        provider, // Track which provider is used
    };
    const jobDoc = {
        userId,
        jobType: 'model',
        status: 'pending',
        inputImageUrl: imageUrl,
        inputImageUrls: [imageUrl],
        viewAngles: ['front'],
        outputModelUrl: null,
        // Provider abstraction fields
        provider,
        providerTaskId: '',
        providerSubscriptionKey: '',
        // Legacy Rodin fields (for backwards compatibility)
        rodinTaskId: '',
        rodinSubscriptionKey: '',
        settings: jobSettings,
        error: null,
        createdAt: now,
        completedAt: null,
    };
    await jobRef.set(jobDoc);
    // 5. Prepare images based on input mode
    try {
        const imageBuffers = [];
        const finalViewAngles = ['front'];
        // Download primary image
        const primaryResponse = await axios_1.default.get(imageUrl, {
            responseType: 'arraybuffer',
            timeout: 30000,
        });
        const primaryBuffer = Buffer.from(primaryResponse.data);
        imageBuffers.push(primaryBuffer);
        functions.logger.info('Primary image downloaded', {
            size: primaryBuffer.length,
            jobId,
            inputMode,
        });
        // Handle AI-generated views
        if (inputMode === 'ai-generated' && generateAngles && generateAngles.length > 0) {
            // Update status to generating-views
            await jobRef.update({ status: 'generating-views' });
            functions.logger.info('Generating AI views', {
                angles: generateAngles,
                jobId,
            });
            const geminiClient = (0, client_1.createGeminiClient)();
            const base64 = primaryBuffer.toString('base64');
            const generatedViews = await geminiClient.generateViews(base64, 'image/png', generateAngles);
            // Add generated images to buffers
            for (const view of generatedViews) {
                const buffer = Buffer.from(view.imageBase64, 'base64');
                imageBuffers.push(buffer);
                finalViewAngles.push(view.angle);
                functions.logger.info('AI view generated', {
                    angle: view.angle,
                    size: buffer.length,
                    jobId,
                });
            }
        }
        // Handle multi-upload mode
        else if (inputMode === 'multi' && imageUrls && imageUrls.length > 1) {
            // Download additional user-uploaded images (skip first as it's already downloaded)
            for (let i = 1; i < imageUrls.length; i++) {
                const response = await axios_1.default.get(imageUrls[i], {
                    responseType: 'arraybuffer',
                    timeout: 30000,
                });
                const buffer = Buffer.from(response.data);
                imageBuffers.push(buffer);
                finalViewAngles.push(viewAngles?.[i] || 'front');
            }
            functions.logger.info('Multi-upload images downloaded', {
                count: imageBuffers.length,
                jobId,
            });
        }
        // Update job with final image count
        await jobRef.update({
            inputImageUrls: inputMode === 'multi' ? imageUrls : [imageUrl],
            viewAngles: finalViewAngles,
            'settings.imageCount': imageBuffers.length,
        });
        // 6. Update status to generating-model before calling provider API
        await jobRef.update({ status: 'generating-model' });
        // Call provider API (Rodin or Meshy)
        const generationProvider = (0, factory_1.createProvider)(provider);
        const generationResult = await generationProvider.generateFromMultipleImages(imageBuffers, {
            quality: quality,
            format: 'glb',
            enableTexture: true,
            enablePBR: printerType !== 'fdm',
        });
        // 7. Update job with provider task IDs
        const updateData = {
            // Provider abstraction fields
            providerTaskId: generationResult.taskId,
            providerSubscriptionKey: generationResult.subscriptionKey || '',
        };
        // Also update legacy Rodin fields if using Rodin (for backwards compatibility)
        if (provider === 'rodin') {
            updateData.rodinTaskId = generationResult.taskId;
            updateData.rodinTaskUuid = generationResult.taskId;
            updateData.rodinJobUuids = generationResult.jobUuids || [];
            updateData.rodinSubscriptionKey = generationResult.subscriptionKey || '';
        }
        await jobRef.update(updateData);
        functions.logger.info('Generation started', {
            jobId,
            userId,
            provider,
            taskId: generationResult.taskId,
            quality,
            printerType,
            inputMode,
            imageCount: imageBuffers.length,
        });
        // 8. Return job ID
        return { jobId, status: 'generating-model' };
    }
    catch (error) {
        // Mark job as failed (auto-refund temporarily disabled)
        // await refundCredits(userId, creditCost, jobId);
        await jobRef.update({
            status: 'failed',
            error: error instanceof Error ? error.message : 'Unknown error',
        });
        functions.logger.error('Generation failed', {
            jobId,
            error: error instanceof Error ? error.message : 'Unknown error',
            inputMode,
        });
        throw error;
    }
});
/**
 * Cloud Function: checkJobStatus
 *
 * Polls the status of a generation job.
 *
 * Steps:
 * 1. Verify authentication and job ownership
 * 2. Poll Rodin status API
 * 3. If 'Done': Download model, upload to Storage, update job
 * 4. If 'Failed': Update job with error, refund credit
 * 5. Return current status
 */
exports.checkJobStatus = functions
    .region('asia-east1')
    .runWith({
    timeoutSeconds: 540, // 9 minutes for model download/upload
    memory: '1GB',
    secrets: ['RODIN_API_KEY', 'MESHY_API_KEY'],
})
    .https.onCall(async (data, context) => {
    // 1. Verify authentication
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'You must be logged in');
    }
    const userId = context.auth.uid;
    const { jobId } = data;
    if (!jobId) {
        throw new functions.https.HttpsError('invalid-argument', 'Job ID is required');
    }
    // Get job document
    const jobRef = db.collection('jobs').doc(jobId);
    const jobDoc = await jobRef.get();
    if (!jobDoc.exists) {
        throw new functions.https.HttpsError('not-found', 'Job not found');
    }
    const job = jobDoc.data();
    // Verify ownership
    if (job.userId !== userId) {
        throw new functions.https.HttpsError('permission-denied', 'You do not have access to this job');
    }
    // If already completed or failed, return cached status
    if (job.status === 'completed') {
        return {
            status: 'completed',
            outputModelUrl: job.outputModelUrl,
        };
    }
    if (job.status === 'failed') {
        return {
            status: 'failed',
            error: job.error,
        };
    }
    // 2. Determine provider and poll status
    // Backwards compatibility: jobs without provider field are Rodin jobs
    const provider = job.provider || job.settings?.provider || 'rodin';
    const generationProvider = (0, factory_1.createProvider)(provider);
    // Get task ID and subscription key (use new fields with fallback to legacy)
    const taskId = job.providerTaskId || job.rodinTaskUuid || job.rodinTaskId;
    const subscriptionKey = job.providerSubscriptionKey || job.rodinSubscriptionKey;
    const statusResult = await generationProvider.checkStatus(taskId, subscriptionKey);
    functions.logger.info('Provider status polled', {
        jobId,
        provider,
        status: statusResult.status,
        progress: statusResult.progress,
    });
    // 3. Handle completion
    if (statusResult.status === 'completed') {
        // Update status to downloading-model
        if (job.status !== 'downloading-model') {
            await jobRef.update({ status: 'downloading-model' });
        }
        // Track download retry attempts (frontend polls every ~5 seconds)
        const downloadRetryCount = (job.downloadRetryCount || 0) + 1;
        const maxDownloadRetries = 60; // ~5 minutes with 5 second polling
        functions.logger.info('Attempting download', {
            jobId,
            provider,
            taskId,
            downloadRetryCount,
            maxDownloadRetries,
        });
        try {
            // Get download URLs from provider
            const downloadResult = await generationProvider.getDownloadUrls(taskId, job.settings.format // requiredFormat
            );
            // Convert to legacy format for consistency
            const downloadList = downloadResult.files.map(f => ({ url: f.url, name: f.name }));
            // Find the model file with the requested format (should exist now)
            const modelFile = downloadList.find((file) => file.name.endsWith(`.${job.settings.format}`));
            if (!modelFile) {
                // This shouldn't happen since getDownloadUrls now checks for required format
                throw new Error(`No ${job.settings.format} file in download list`);
            }
            // Download model from provider
            const modelBuffer = await generationProvider.downloadModel(modelFile.url);
            // Update status to uploading-storage
            await jobRef.update({ status: 'uploading-storage' });
            // Upload to storage (Firebase or R2)
            const modelPath = `models/${userId}/${jobId}.${job.settings.format}`;
            const signedUrl = await (0, storage_1.uploadBuffer)(modelBuffer, modelPath, getContentType(job.settings.format));
            // Update job with signed URL and all available download files for preview
            await jobRef.update({
                status: 'completed',
                outputModelUrl: signedUrl,
                downloadFiles: downloadList, // Save all Rodin files (GLB, textures, etc.) for preview
                completedAt: admin.firestore.FieldValue.serverTimestamp(),
            });
            // Increment generation count
            await (0, credits_1.incrementGenerationCount)(userId);
            functions.logger.info('Job completed', {
                jobId,
                modelPath,
                downloadFilesCount: downloadList.length,
                downloadFileNames: downloadList.map((f) => f.name),
            });
            return {
                status: 'completed',
                outputModelUrl: signedUrl,
                downloadFiles: downloadList,
            };
        }
        catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Failed to process model';
            const isDownloadNotReady = errorMessage.includes('No download URLs') ||
                errorMessage.includes('empty');
            // If download URLs not ready yet, keep polling (don't fail)
            if (isDownloadNotReady && downloadRetryCount < maxDownloadRetries) {
                await jobRef.update({ downloadRetryCount });
                functions.logger.info('Download URLs not ready, will retry on next poll', {
                    jobId,
                    downloadRetryCount,
                    maxDownloadRetries,
                    error: errorMessage,
                });
                return {
                    status: 'downloading-model',
                };
            }
            // Either non-recoverable error or max retries exceeded
            functions.logger.error('Failed to process completed model', {
                jobId,
                error: errorMessage,
                downloadRetryCount,
                isDownloadNotReady,
            });
            await jobRef.update({
                status: 'failed',
                error: isDownloadNotReady
                    ? `Download URLs not available after ${downloadRetryCount} attempts (~${Math.round(downloadRetryCount * 5 / 60)} minutes)`
                    : errorMessage,
            });
            // Auto-refund temporarily disabled
            // const refundAmount = creditCosts[job.settings.inputMode] || 1;
            // await refundCredits(userId, refundAmount, jobId);
            return {
                status: 'failed',
                error: errorMessage,
            };
        }
    }
    // 4. Handle failure
    if (statusResult.status === 'failed') {
        await jobRef.update({
            status: 'failed',
            error: 'Generation failed',
        });
        // Auto-refund temporarily disabled
        // const refundAmount = creditCosts[job.settings.inputMode] || 1;
        // await refundCredits(userId, refundAmount, jobId);
        functions.logger.warn('Job failed', { jobId });
        return {
            status: 'failed',
            error: 'Generation failed',
        };
    }
    // 5. Still processing
    // Map provider status to our granular internal status
    const mappedStatus = statusResult.status === 'pending' ? 'pending' : 'generating-model';
    return {
        status: mappedStatus,
        progress: statusResult.progress, // Meshy provides 0-100 progress
    };
});
/**
 * Get MIME type for output format
 */
function getContentType(format) {
    switch (format) {
        case 'glb':
            return 'model/gltf-binary';
        case 'obj':
            return 'text/plain';
        case 'fbx':
            return 'application/octet-stream';
        case 'stl':
            return 'application/sla';
        default:
            return 'application/octet-stream';
    }
}
/**
 * Cloud Function: retryFailedJob
 *
 * Retries a failed job by re-attempting the download process.
 * Only works for jobs that failed during the download phase
 * (i.e., have a valid rodinTaskUuid but failed to get download URLs).
 *
 * @param jobId - The ID of the failed job to retry
 */
exports.retryFailedJob = functions
    .region('asia-east1')
    .runWith({
    timeoutSeconds: 540,
    memory: '1GB',
    secrets: ['RODIN_API_KEY', 'MESHY_API_KEY'],
})
    .https.onCall(async (data, context) => {
    // 1. Verify authentication
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'You must be logged in');
    }
    const userId = context.auth.uid;
    const { jobId } = data;
    if (!jobId) {
        throw new functions.https.HttpsError('invalid-argument', 'Job ID is required');
    }
    // Get job document
    const jobRef = db.collection('jobs').doc(jobId);
    const jobDoc = await jobRef.get();
    if (!jobDoc.exists) {
        throw new functions.https.HttpsError('not-found', 'Job not found');
    }
    const job = jobDoc.data();
    // Verify ownership
    if (job.userId !== userId) {
        throw new functions.https.HttpsError('permission-denied', 'You do not have access to this job');
    }
    // Only retry failed jobs
    if (job.status !== 'failed') {
        throw new functions.https.HttpsError('failed-precondition', `Job is not in failed state (current: ${job.status})`);
    }
    // Need task ID to retry
    const taskId = job.providerTaskId || job.rodinTaskUuid || job.rodinTaskId;
    if (!taskId) {
        throw new functions.https.HttpsError('failed-precondition', 'Job has no provider task ID - cannot retry');
    }
    // Determine provider (backwards compat: default to rodin for old jobs)
    const provider = job.provider || job.settings?.provider || 'rodin';
    functions.logger.info('Retrying failed job', {
        jobId,
        provider,
        taskId,
        previousError: job.error,
    });
    // Reset job status to downloading-model (retrying from download phase)
    await jobRef.update({
        status: 'downloading-model',
        error: null,
    });
    try {
        const generationProvider = (0, factory_1.createProvider)(provider);
        // Try to get download URLs
        const downloadResult = await generationProvider.getDownloadUrls(taskId, job.settings.format // requiredFormat
        );
        const downloadList = downloadResult.files.map(f => ({ url: f.url, name: f.name }));
        // Find the model file (should exist now)
        const modelFile = downloadList.find((file) => file.name.endsWith(`.${job.settings.format}`));
        if (!modelFile) {
            throw new Error(`No ${job.settings.format} file in download list`);
        }
        // Download model from provider
        const modelBuffer = await generationProvider.downloadModel(modelFile.url);
        // Update status to uploading-storage
        await jobRef.update({ status: 'uploading-storage' });
        // Upload to storage (Firebase or R2)
        const modelPath = `models/${userId}/${jobId}.${job.settings.format}`;
        const signedUrl = await (0, storage_1.uploadBuffer)(modelBuffer, modelPath, getContentType(job.settings.format));
        // Update job as completed with all download files for preview
        await jobRef.update({
            status: 'completed',
            outputModelUrl: signedUrl,
            downloadFiles: downloadList, // Save all Rodin files for preview
            completedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
        // Increment generation count
        await (0, credits_1.incrementGenerationCount)(userId);
        functions.logger.info('Retry successful', {
            jobId,
            modelPath,
            downloadFilesCount: downloadList.length,
        });
        return {
            status: 'completed',
            outputModelUrl: signedUrl,
            downloadFiles: downloadList,
        };
    }
    catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Retry failed';
        functions.logger.error('Retry failed', {
            jobId,
            error: errorMessage,
        });
        await jobRef.update({
            status: 'failed',
            error: errorMessage,
        });
        return {
            status: 'failed',
            error: errorMessage,
        };
    }
});
//# sourceMappingURL=generate.js.map