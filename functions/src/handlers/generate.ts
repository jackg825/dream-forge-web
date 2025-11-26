import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import { createRodinClient } from '../rodin/client';
import { deductCredits, refundCredits, incrementGenerationCount } from '../utils/credits';
import type { JobDocument, QualityLevel, OutputFormat } from '../rodin/types';

const db = admin.firestore();
const storage = admin.storage();

interface GenerateModelData {
  imageUrl: string;
  quality: QualityLevel;
  format?: OutputFormat;
}

interface CheckJobStatusData {
  jobId: string;
}

/**
 * Cloud Function: generateModel
 *
 * Starts a new 3D model generation job.
 *
 * Steps:
 * 1. Verify authentication
 * 2. Check user has sufficient credits
 * 3. Deduct 1 credit
 * 4. Create job document
 * 5. Call Rodin API to start generation
 * 6. Update job with Rodin task ID
 * 7. Return job ID to client
 */
export const generateModel = functions
  .region('asia-east1')
  .runWith({
    timeoutSeconds: 60,
    memory: '512MB',
    secrets: ['RODIN_API_KEY'],
  })
  .https.onCall(async (data: GenerateModelData, context) => {
    // 1. Verify authentication
    if (!context.auth) {
      throw new functions.https.HttpsError(
        'unauthenticated',
        'You must be logged in to generate models'
      );
    }

    const userId = context.auth.uid;
    const { imageUrl, quality = 'medium', format = 'glb' } = data;

    // Validate input
    if (!imageUrl) {
      throw new functions.https.HttpsError(
        'invalid-argument',
        'Image URL is required'
      );
    }

    if (!['low', 'medium', 'high'].includes(quality)) {
      throw new functions.https.HttpsError(
        'invalid-argument',
        'Invalid quality level'
      );
    }

    // 2 & 3. Check credits and deduct
    const jobRef = db.collection('jobs').doc();
    const jobId = jobRef.id;

    try {
      await deductCredits(userId, 1, jobId);
    } catch (error) {
      if (
        error instanceof functions.https.HttpsError &&
        error.code === 'resource-exhausted'
      ) {
        throw new functions.https.HttpsError(
          'resource-exhausted',
          'You have no credits remaining. Each generation costs 1 credit.'
        );
      }
      throw error;
    }

    // 4. Create job document
    const now = admin.firestore.FieldValue.serverTimestamp();
    const jobDoc: Omit<JobDocument, 'createdAt' | 'completedAt'> & {
      createdAt: FirebaseFirestore.FieldValue;
      completedAt: null;
    } = {
      userId,
      status: 'pending',
      inputImageUrl: imageUrl,
      outputModelUrl: null,
      rodinTaskId: '',
      rodinSubscriptionKey: '',
      settings: {
        tier: 'Gen-2',
        quality: quality as QualityLevel,
        format: format as OutputFormat,
      },
      error: null,
      createdAt: now,
      completedAt: null,
    };

    await jobRef.set(jobDoc);

    // 5. Call Rodin API
    try {
      const rodinClient = createRodinClient();
      const { taskId, subscriptionKey } = await rodinClient.generateModel(imageUrl, {
        tier: 'Gen-2',
        quality: quality as QualityLevel,
        format: format as OutputFormat,
      });

      // 6. Update job with Rodin task ID
      await jobRef.update({
        rodinTaskId: taskId,
        rodinSubscriptionKey: subscriptionKey,
        status: 'processing',
      });

      functions.logger.info('Generation started', {
        jobId,
        userId,
        taskId,
        quality,
      });

      // 7. Return job ID
      return { jobId, status: 'processing' };
    } catch (error) {
      // Rollback: Refund credits and mark job as failed
      await refundCredits(userId, 1, jobId);
      await jobRef.update({
        status: 'failed',
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      functions.logger.error('Generation failed', { jobId, error });

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
export const checkJobStatus = functions
  .region('asia-east1')
  .runWith({
    timeoutSeconds: 540, // 9 minutes for model download/upload
    memory: '1GB',
    secrets: ['RODIN_API_KEY'],
  })
  .https.onCall(async (data: CheckJobStatusData, context) => {
    // 1. Verify authentication
    if (!context.auth) {
      throw new functions.https.HttpsError(
        'unauthenticated',
        'You must be logged in'
      );
    }

    const userId = context.auth.uid;
    const { jobId } = data;

    if (!jobId) {
      throw new functions.https.HttpsError(
        'invalid-argument',
        'Job ID is required'
      );
    }

    // Get job document
    const jobRef = db.collection('jobs').doc(jobId);
    const jobDoc = await jobRef.get();

    if (!jobDoc.exists) {
      throw new functions.https.HttpsError(
        'not-found',
        'Job not found'
      );
    }

    const job = jobDoc.data() as JobDocument;

    // Verify ownership
    if (job.userId !== userId) {
      throw new functions.https.HttpsError(
        'permission-denied',
        'You do not have access to this job'
      );
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

    // 2. Poll Rodin status
    const rodinClient = createRodinClient();
    const rodinStatus = await rodinClient.checkStatus(
      job.rodinTaskId,
      job.rodinSubscriptionKey
    );

    // 3. Handle completion
    if (rodinStatus.status === 'Done' && rodinStatus.result?.model_url) {
      try {
        // Download model from Rodin
        const modelBuffer = await rodinClient.downloadModel(rodinStatus.result.model_url);

        // Upload to Firebase Storage
        const bucket = storage.bucket();
        const modelPath = `models/${userId}/${jobId}.${job.settings.format}`;
        const file = bucket.file(modelPath);

        await file.save(modelBuffer, {
          metadata: {
            contentType: getContentType(job.settings.format),
          },
        });

        // Generate signed URL (valid for 7 days)
        const [signedUrl] = await file.getSignedUrl({
          action: 'read',
          expires: Date.now() + 7 * 24 * 60 * 60 * 1000, // 7 days
        });

        // Update job
        await jobRef.update({
          status: 'completed',
          outputModelUrl: signedUrl,
          completedAt: admin.firestore.FieldValue.serverTimestamp(),
        });

        // Increment generation count
        await incrementGenerationCount(userId);

        functions.logger.info('Job completed', { jobId, modelPath });

        return {
          status: 'completed',
          outputModelUrl: signedUrl,
        };
      } catch (error) {
        functions.logger.error('Failed to process completed model', {
          jobId,
          error,
        });

        await jobRef.update({
          status: 'failed',
          error: 'Failed to process model',
        });

        // Refund credit
        await refundCredits(userId, 1, jobId);

        return {
          status: 'failed',
          error: 'Failed to process model',
        };
      }
    }

    // 4. Handle failure
    if (rodinStatus.status === 'Failed') {
      await jobRef.update({
        status: 'failed',
        error: rodinStatus.error || 'Generation failed',
      });

      // Refund credit
      await refundCredits(userId, 1, jobId);

      functions.logger.warn('Job failed', {
        jobId,
        error: rodinStatus.error,
      });

      return {
        status: 'failed',
        error: rodinStatus.error || 'Generation failed',
      };
    }

    // 5. Still processing
    return {
      status: job.status,
      progress: rodinStatus.progress,
    };
  });

/**
 * Get MIME type for output format
 */
function getContentType(format: OutputFormat): string {
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
