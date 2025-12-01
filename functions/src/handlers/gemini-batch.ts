/**
 * Gemini Batch API Handlers
 *
 * Cloud Functions for batch image generation:
 * - submitGeminiBatch: Submit a batch job for a pipeline
 * - pollGeminiBatchJobs: Scheduled polling of pending jobs
 * - processGeminiBatchResults: Process completed batch results
 */

import * as functions from 'firebase-functions/v1';
import * as admin from 'firebase-admin';
import axios from 'axios';
import {
  createBatchClient,
  GeminiBatchClient,
  type BatchRequest,
  type BatchStatusResponse,
} from '../gemini/batch-client';
import type {
  PipelineDocument,
  GeminiBatchJobDocument,
  GeminiBatchResult,
  PipelineMeshAngle,
  PipelineTextureAngle,
  PipelineProcessedImage,
} from '../rodin/types';
import { defineSecret } from 'firebase-functions/params';

const db = admin.firestore();
const storage = admin.storage();

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

/**
 * Poll pending batch jobs
 *
 * Scheduled function that runs every 5 minutes to:
 * 1. Find all pending/running batch jobs
 * 2. Check their status with Gemini API
 * 3. Update job status
 * 4. Process completed jobs
 */
export const pollGeminiBatchJobs = functions
  .region('asia-east1')
  .runWith({
    timeoutSeconds: 300,
    memory: '1GB',
    secrets: [geminiApiKey],
  })
  .pubsub.schedule('every 5 minutes')
  .onRun(async () => {
    const client = createBatchClient(geminiApiKey.value());

    // Query pending/running jobs
    const jobsSnapshot = await db
      .collection('geminiBatchJobs')
      .where('batchJobStatus', 'in', ['pending', 'running'])
      .limit(50) // Process up to 50 jobs per run
      .get();

    if (jobsSnapshot.empty) {
      functions.logger.info('No pending batch jobs to poll');
      return;
    }

    functions.logger.info(`Polling ${jobsSnapshot.size} batch jobs`);

    // Process each job
    for (const jobDoc of jobsSnapshot.docs) {
      const job = jobDoc.data() as GeminiBatchJobDocument;

      try {
        // Check status with Gemini
        const status = await client.checkStatus(job.batchJobName);

        // Map Gemini state to our status
        const newStatus = GeminiBatchClient.mapJobState(status.metadata.state);

        // Update job status
        const updateData: Record<string, unknown> = {
          batchJobStatus: newStatus,
          lastPolledAt: admin.firestore.FieldValue.serverTimestamp(),
        };

        if (newStatus === 'running' && job.batchJobStatus === 'pending') {
          updateData.startedAt = admin.firestore.FieldValue.serverTimestamp();
        }

        await jobDoc.ref.update(updateData);

        // Update pipeline status if changed
        if (newStatus === 'running' && job.batchJobStatus !== 'running') {
          await db.collection('pipelines').doc(job.pipelineId).update({
            status: 'batch-processing',
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          });
        }

        // If completed, process results
        if (status.done && status.response) {
          await processCompletedBatchJob(
            jobDoc.ref,
            job,
            status,
            client
          );
        }

        // If failed, update pipeline
        if (newStatus === 'failed') {
          await handleFailedBatchJob(jobDoc.ref, job, status.error?.message);
        }
      } catch (error) {
        functions.logger.error('Error polling batch job', {
          batchJobId: jobDoc.id,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }
  });

/**
 * Process a completed batch job
 */
async function processCompletedBatchJob(
  jobRef: admin.firestore.DocumentReference,
  job: GeminiBatchJobDocument,
  statusResponse: BatchStatusResponse,
  client: GeminiBatchClient
): Promise<void> {
  functions.logger.info('Processing completed batch job', {
    batchJobId: jobRef.id,
    pipelineId: job.pipelineId,
  });

  // Parse results
  const results = client.parseResults(statusResponse, job.requests as BatchRequest[]);

  // Upload successful images to Storage
  const processedResults: GeminiBatchResult[] = [];
  const meshImages: Partial<Record<PipelineMeshAngle, PipelineProcessedImage>> = {};
  const textureImages: Partial<Record<PipelineTextureAngle, PipelineProcessedImage>> = {};

  let completedCount = 0;
  let failedCount = 0;

  for (const result of results) {
    if (result.success && result.imageBase64) {
      try {
        // Upload to Storage
        const storagePath = `pipelines/${job.pipelineId}/${result.viewType}_${result.angle}.png`;
        const bucket = storage.bucket();
        const file = bucket.file(storagePath);

        const imageBuffer = Buffer.from(result.imageBase64, 'base64');
        await file.save(imageBuffer, {
          metadata: {
            contentType: result.mimeType || 'image/png',
          },
        });

        // Get signed URL (7 days)
        const [url] = await file.getSignedUrl({
          action: 'read',
          expires: Date.now() + 7 * 24 * 60 * 60 * 1000,
        });

        // Build processed image record
        const processedImage: PipelineProcessedImage = {
          url,
          storagePath,
          source: 'gemini',
          colorPalette: result.colorPalette,
          generatedAt: admin.firestore.Timestamp.now(),
        };

        // Add to appropriate collection
        if (result.viewType === 'mesh') {
          meshImages[result.angle as PipelineMeshAngle] = processedImage;
        } else {
          textureImages[result.angle as PipelineTextureAngle] = processedImage;
        }

        processedResults.push({
          index: result.index,
          viewType: result.viewType,
          angle: result.angle,
          status: 'success',
          imageBase64: result.imageBase64,
          mimeType: result.mimeType,
          colorPalette: result.colorPalette,
          storagePath,
          storageUrl: url,
        });

        completedCount++;
      } catch (uploadError) {
        functions.logger.error('Failed to upload image', {
          batchJobId: jobRef.id,
          viewType: result.viewType,
          angle: result.angle,
          error: uploadError instanceof Error ? uploadError.message : 'Unknown',
        });

        processedResults.push({
          index: result.index,
          viewType: result.viewType,
          angle: result.angle,
          status: 'failed',
          error: 'Failed to upload to storage',
        });
        failedCount++;
      }
    } else {
      processedResults.push({
        index: result.index,
        viewType: result.viewType,
        angle: result.angle,
        status: 'failed',
        error: result.error || 'Generation failed',
      });
      failedCount++;
    }
  }

  // Update batch job
  await jobRef.update({
    batchJobStatus: failedCount === 6 ? 'failed' : 'succeeded',
    results: processedResults,
    failedRequestCount: failedCount,
    completedAt: admin.firestore.FieldValue.serverTimestamp(),
  });

  // Update pipeline
  const pipelineRef = db.collection('pipelines').doc(job.pipelineId);

  if (failedCount === 6) {
    // All failed
    await pipelineRef.update({
      status: 'failed',
      error: 'All image generations failed',
      errorStep: 'batch-processing',
      batchProgress: { total: 6, completed: 0, failed: 6 },
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
  } else {
    // At least some succeeded
    await pipelineRef.update({
      status: 'images-ready',
      meshImages,
      textureImages,
      batchProgress: { total: 6, completed: completedCount, failed: failedCount },
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
  }

  functions.logger.info('Batch job processed', {
    batchJobId: jobRef.id,
    completed: completedCount,
    failed: failedCount,
  });
}

/**
 * Handle a failed batch job
 */
async function handleFailedBatchJob(
  jobRef: admin.firestore.DocumentReference,
  job: GeminiBatchJobDocument,
  errorMessage?: string
): Promise<void> {
  functions.logger.error('Batch job failed', {
    batchJobId: jobRef.id,
    pipelineId: job.pipelineId,
    error: errorMessage,
  });

  // Update batch job
  await jobRef.update({
    batchJobStatus: 'failed',
    error: errorMessage || 'Batch job failed',
    completedAt: admin.firestore.FieldValue.serverTimestamp(),
  });

  // Update pipeline
  await db.collection('pipelines').doc(job.pipelineId).update({
    status: 'failed',
    error: errorMessage || 'Batch image generation failed',
    errorStep: 'batch-processing',
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  });
}
