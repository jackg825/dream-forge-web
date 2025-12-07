"use strict";
/**
 * Gemini Batch API Handlers
 *
 * Cloud Functions for batch image generation:
 * - submitGeminiBatch: Submit a batch job for a pipeline
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
exports.submitGeminiBatch = void 0;
const functions = __importStar(require("firebase-functions/v1"));
const admin = __importStar(require("firebase-admin"));
const axios_1 = __importDefault(require("axios"));
const batch_client_1 = require("../gemini/batch-client");
const params_1 = require("firebase-functions/params");
const db = admin.firestore();
// Define secret for Gemini API key
const geminiApiKey = (0, params_1.defineSecret)('GEMINI_API_KEY');
/**
 * Submit a batch job for image generation
 *
 * Callable function that:
 * 1. Validates the pipeline
 * 2. Downloads reference image
 * 3. Submits batch request to Gemini
 * 4. Creates batch job document
 * 5. Updates pipeline status
 */
exports.submitGeminiBatch = functions
    .region('asia-east1')
    .runWith({
    timeoutSeconds: 120,
    memory: '512MB',
    secrets: [geminiApiKey],
})
    .https.onCall(async (data, context) => {
    // Validate auth
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
    }
    const userId = context.auth.uid;
    const { pipelineId } = data;
    if (!pipelineId) {
        throw new functions.https.HttpsError('invalid-argument', 'pipelineId is required');
    }
    // Get pipeline document
    const pipelineRef = db.collection('pipelines').doc(pipelineId);
    const pipelineDoc = await pipelineRef.get();
    if (!pipelineDoc.exists) {
        throw new functions.https.HttpsError('not-found', 'Pipeline not found');
    }
    const pipeline = pipelineDoc.data();
    // Validate ownership
    if (pipeline.userId !== userId) {
        throw new functions.https.HttpsError('permission-denied', 'You do not own this pipeline');
    }
    // Validate status
    if (pipeline.status !== 'draft' && pipeline.status !== 'failed') {
        throw new functions.https.HttpsError('failed-precondition', `Cannot submit batch in status: ${pipeline.status}`);
    }
    // Get reference image
    const inputImage = pipeline.inputImages[0];
    if (!inputImage?.url) {
        throw new functions.https.HttpsError('failed-precondition', 'No input image found');
    }
    // Download reference image
    const imageResponse = await axios_1.default.get(inputImage.url, {
        responseType: 'arraybuffer',
        timeout: 30000,
    });
    const imageBuffer = Buffer.from(imageResponse.data);
    const imageBase64 = imageBuffer.toString('base64');
    const mimeType = imageResponse.headers['content-type'] || 'image/png';
    // Create batch client
    const client = (0, batch_client_1.createBatchClient)(geminiApiKey.value());
    // Build batch requests
    const requests = client.buildBatchRequests(imageBase64, mimeType, pipeline.generationMode, pipeline.userDescription || undefined);
    // Submit batch
    const batchResponse = await client.submitBatch(imageBase64, mimeType, requests);
    // Create batch job document
    const batchJobRef = db.collection('geminiBatchJobs').doc();
    const batchJob = {
        pipelineId,
        userId,
        batchJobName: batchResponse.name,
        batchJobStatus: 'pending',
        requests: requests.map((req, idx) => ({
            index: idx,
            viewType: req.viewType,
            angle: req.angle,
            prompt: req.prompt,
            status: 'pending',
        })),
        results: [],
        submittedAt: admin.firestore.FieldValue.serverTimestamp(),
        failedRequestCount: 0,
        retryCount: 0,
        maxRetries: 3,
    };
    await batchJobRef.set(batchJob);
    // Update pipeline status
    await pipelineRef.update({
        status: 'batch-queued',
        batchJobId: batchJobRef.id,
        batchProgress: {
            total: 6,
            completed: 0,
            failed: 0,
        },
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    functions.logger.info('Batch job submitted', {
        pipelineId,
        batchJobId: batchJobRef.id,
        batchJobName: batchResponse.name,
    });
    return {
        success: true,
        batchJobId: batchJobRef.id,
        status: 'batch-queued',
    };
});
//# sourceMappingURL=gemini-batch.js.map