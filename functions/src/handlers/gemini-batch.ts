/**
 * Gemini Batch API Handlers
 *
 * Cloud Functions for batch image generation:
 * - submitGeminiBatch: Submit a batch job for a pipeline
 */

import * as functions from 'firebase-functions/v1';
import * as admin from 'firebase-admin';
import axios from 'axios';
import { createBatchClient } from '../gemini/batch-client';
import type {
  PipelineDocument,
  GeminiBatchJobDocument,
} from '../rodin/types';
import { defineSecret } from 'firebase-functions/params';

const db = admin.firestore();

// Define secret for Gemini API key
const geminiApiKey = defineSecret('GEMINI_API_KEY');

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
export const submitGeminiBatch = functions
  .region('asia-east1')
  .runWith({
    timeoutSeconds: 120,
    memory: '512MB',
    secrets: [geminiApiKey],
  })
  .https.onCall(async (data: { pipelineId: string }, context) => {
    // Validate auth
    if (!context.auth) {
      throw new functions.https.HttpsError(
        'unauthenticated',
        'User must be authenticated'
      );
    }

    const userId = context.auth.uid;
    const { pipelineId } = data;

    if (!pipelineId) {
      throw new functions.https.HttpsError(
        'invalid-argument',
        'pipelineId is required'
      );
    }

    // Get pipeline document
    const pipelineRef = db.collection('pipelines').doc(pipelineId);
    const pipelineDoc = await pipelineRef.get();

    if (!pipelineDoc.exists) {
      throw new functions.https.HttpsError(
        'not-found',
        'Pipeline not found'
      );
    }

    const pipeline = pipelineDoc.data() as PipelineDocument;

    // Validate ownership
    if (pipeline.userId !== userId) {
      throw new functions.https.HttpsError(
        'permission-denied',
        'You do not own this pipeline'
      );
    }

    // Validate status
    if (pipeline.status !== 'draft' && pipeline.status !== 'failed') {
      throw new functions.https.HttpsError(
        'failed-precondition',
        `Cannot submit batch in status: ${pipeline.status}`
      );
    }

    // Get reference image
    const inputImage = pipeline.inputImages[0];
    if (!inputImage?.url) {
      throw new functions.https.HttpsError(
        'failed-precondition',
        'No input image found'
      );
    }

    // Download reference image
    const imageResponse = await axios.get(inputImage.url, {
      responseType: 'arraybuffer',
      timeout: 30000,
    });

    const imageBuffer = Buffer.from(imageResponse.data);
    const imageBase64 = imageBuffer.toString('base64');
    const mimeType = imageResponse.headers['content-type'] || 'image/png';

    // Create batch client
    const client = createBatchClient(geminiApiKey.value());

    // Build batch requests
    const requests = client.buildBatchRequests(
      imageBase64,
      mimeType,
      pipeline.generationMode,
      pipeline.userDescription || undefined
    );

    // Submit batch
    const batchResponse = await client.submitBatch(imageBase64, mimeType, requests);

    // Create batch job document
    const batchJobRef = db.collection('geminiBatchJobs').doc();
    const batchJob: Omit<GeminiBatchJobDocument, 'submittedAt'> & {
      submittedAt: admin.firestore.FieldValue;
    } = {
      pipelineId,
      userId,
      batchJobName: batchResponse.name,
      batchJobStatus: 'pending',
      requests: requests.map((req, idx) => ({
        index: idx,
        viewType: req.viewType,
        angle: req.angle,
        prompt: req.prompt,
        status: 'pending' as const,
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
