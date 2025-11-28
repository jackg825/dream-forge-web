import * as functions from 'firebase-functions/v1';
import * as admin from 'firebase-admin';
import axios from 'axios';
import { createRodinClient } from '../rodin/client';
import { createGeminiClient } from '../gemini/client';
import { deductCredits, refundCredits, incrementGenerationCount } from '../utils/credits';
import type {
  JobDocument,
  JobSettings,
  QualityLevel,
  OutputFormat,
  PrintQuality,
  MeshMode,
  ViewAngle,
  PrinterType,
  InputMode,
  TextureResolution,
} from '../rodin/types';

const db = admin.firestore();
const storage = admin.storage();

// Credit costs based on input mode
const creditCosts: Record<InputMode, number> = {
  single: 1,
  multi: 1,
  'ai-generated': 2,
};

interface GenerateModelData {
  imageUrl: string;
  imageUrls?: string[];           // All images for multi-view
  viewAngles?: ViewAngle[];       // Corresponding angles
  quality: PrintQuality | QualityLevel;
  printerType?: PrinterType;      // Determines material
  inputMode?: InputMode;          // single | multi | ai-generated
  generateAngles?: ViewAngle[];   // Angles to generate via Gemini
  format?: OutputFormat;
}

interface CheckJobStatusData {
  jobId: string;
}

interface RetryFailedJobData {
  jobId: string;
}

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
 * 6. Call Rodin API with multi-image support
 * 7. Update job with Rodin task ID
 * 8. Return job ID to client
 */
export const generateModel = functions
  .region('asia-east1')
  .runWith({
    timeoutSeconds: 120,  // Increased for Gemini + Rodin
    memory: '1GB',        // Increased for image processing
    secrets: ['RODIN_API_KEY', 'GEMINI_API_KEY'],
  })
  .https.onCall(async (data: GenerateModelData, context: functions.https.CallableContext) => {
    // 1. Verify authentication
    if (!context.auth) {
      throw new functions.https.HttpsError(
        'unauthenticated',
        'You must be logged in to generate models'
      );
    }

    const userId = context.auth.uid;
    const {
      imageUrl,
      imageUrls,
      viewAngles,
      quality = 'standard',
      printerType = 'fdm',
      inputMode = 'single',
      generateAngles,
    } = data;

    // Validate input
    if (!imageUrl) {
      throw new functions.https.HttpsError(
        'invalid-argument',
        'Image URL is required'
      );
    }

    // Validate quality
    const validQualities = ['draft', 'standard', 'fine', 'low', 'medium', 'high'];
    if (!validQualities.includes(quality)) {
      throw new functions.https.HttpsError(
        'invalid-argument',
        'Invalid quality level. Use: draft, standard, fine'
      );
    }

    // Validate printer type
    const validPrinterTypes: PrinterType[] = ['fdm', 'sla', 'resin'];
    if (!validPrinterTypes.includes(printerType)) {
      throw new functions.https.HttpsError(
        'invalid-argument',
        'Invalid printer type. Use: fdm, sla, resin'
      );
    }

    // Validate input mode
    const validInputModes: InputMode[] = ['single', 'multi', 'ai-generated'];
    if (!validInputModes.includes(inputMode)) {
      throw new functions.https.HttpsError(
        'invalid-argument',
        'Invalid input mode. Use: single, multi, ai-generated'
      );
    }

    // 2. Calculate credit cost based on input mode
    const creditCost = creditCosts[inputMode];

    // 3. Check credits and deduct
    const jobRef = db.collection('jobs').doc();
    const jobId = jobRef.id;

    try {
      await deductCredits(userId, creditCost, jobId);
    } catch (error) {
      if (
        error instanceof functions.https.HttpsError &&
        error.code === 'resource-exhausted'
      ) {
        throw new functions.https.HttpsError(
          'resource-exhausted',
          `You need ${creditCost} credit(s) for this generation mode.`
        );
      }
      throw error;
    }

    // 4. Create job document
    const now = admin.firestore.FieldValue.serverTimestamp();
    const jobSettings: JobSettings = {
      tier: 'Gen-2',
      quality: quality as QualityLevel,
      format: 'glb' as OutputFormat,  // GLB for preview with PBR materials
      printerType,
      inputMode,
      imageCount: 1, // Will be updated after image processing
    };

    const jobDoc: Omit<JobDocument, 'createdAt' | 'completedAt'> & {
      createdAt: FirebaseFirestore.FieldValue;
      completedAt: null;
    } = {
      userId,
      jobType: 'model',
      status: 'pending',
      inputImageUrl: imageUrl,
      inputImageUrls: [imageUrl],
      viewAngles: ['front'],
      outputModelUrl: null,
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
      const imageBuffers: Buffer[] = [];
      const finalViewAngles: ViewAngle[] = ['front'];

      // Download primary image
      const primaryResponse = await axios.get(imageUrl, {
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

        const geminiClient = createGeminiClient();
        const base64 = primaryBuffer.toString('base64');

        const generatedViews = await geminiClient.generateViews(
          base64,
          'image/png',
          generateAngles
        );

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
          const response = await axios.get(imageUrls[i], {
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

      // 6. Update status to generating-model before calling Rodin API
      await jobRef.update({ status: 'generating-model' });

      // Call Rodin API with multi-image support
      const rodinClient = createRodinClient();
      const { taskUuid, jobUuids, subscriptionKey } = await rodinClient.generateModelMulti(
        imageBuffers,
        {
          tier: 'Gen-2',
          quality: quality as PrintQuality | QualityLevel,
          format: 'stl' as OutputFormat,
          meshMode: 'Raw' as MeshMode,
          printerType,
          conditionMode: imageBuffers.length > 1 ? 'concat' : undefined,
        }
      );

      // 7. Update job with all Rodin IDs for flexibility (status already 'generating-model')
      await jobRef.update({
        rodinTaskId: taskUuid,           // Legacy field for backwards compat
        rodinTaskUuid: taskUuid,         // Main UUID (required for download API)
        rodinJobUuids: jobUuids,         // Individual job UUIDs
        rodinSubscriptionKey: subscriptionKey,
      });

      functions.logger.info('Generation started', {
        jobId,
        userId,
        taskUuid,
        jobUuids,
        quality,
        printerType,
        inputMode,
        imageCount: imageBuffers.length,
      });

      // 8. Return job ID
      return { jobId, status: 'generating-model' };
    } catch (error) {
      // Rollback: Refund credits and mark job as failed
      await refundCredits(userId, creditCost, jobId);
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
export const checkJobStatus = functions
  .region('asia-east1')
  .runWith({
    timeoutSeconds: 540, // 9 minutes for model download/upload
    memory: '1GB',
    secrets: ['RODIN_API_KEY'],
  })
  .https.onCall(async (data: CheckJobStatusData, context: functions.https.CallableContext) => {
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

    // 2. Poll Rodin status (API changed: only needs subscriptionKey)
    const rodinClient = createRodinClient();
    const rodinStatus = await rodinClient.checkStatus(job.rodinSubscriptionKey);

    functions.logger.info('Rodin status polled', {
      jobId,
      status: rodinStatus.status,
      jobUuid: rodinStatus.jobUuid,
    });

    // 3. Handle completion (status is 'Done' per API docs)
    if (rodinStatus.status === 'Done') {
      try {
        // Update status to downloading-model
        await jobRef.update({ status: 'downloading-model' });

        // Get download URLs using the main task UUID
        // Use rodinTaskUuid (new field) with fallback to rodinTaskId (legacy field)
        const downloadTaskUuid = job.rodinTaskUuid || job.rodinTaskId;
        functions.logger.info('Attempting download', {
          jobId,
          rodinTaskUuid: job.rodinTaskUuid,
          rodinTaskId: job.rodinTaskId,
          usingUuid: downloadTaskUuid,
        });
        const downloadList = await rodinClient.getDownloadUrls(downloadTaskUuid);

        // Find the model file with the requested format
        const modelFile = downloadList.find((file) =>
          file.name.endsWith(`.${job.settings.format}`)
        );

        if (!modelFile) {
          throw new Error(`No ${job.settings.format} file in download list`);
        }

        // Download model from Rodin
        const modelBuffer = await rodinClient.downloadModel(modelFile.url);

        // Update status to uploading-storage
        await jobRef.update({ status: 'uploading-storage' });

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

        // Update job with signed URL and all available download files for preview
        await jobRef.update({
          status: 'completed',
          outputModelUrl: signedUrl,
          downloadFiles: downloadList, // Save all Rodin files (GLB, textures, etc.) for preview
          completedAt: admin.firestore.FieldValue.serverTimestamp(),
        });

        // Increment generation count
        await incrementGenerationCount(userId);

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
      } catch (error) {
        // Preserve actual error message for debugging
        const errorMessage = error instanceof Error ? error.message : 'Failed to process model';

        functions.logger.error('Failed to process completed model', {
          jobId,
          error: errorMessage,
        });

        await jobRef.update({
          status: 'failed',
          error: errorMessage,
        });

        // Refund credits based on input mode
        const refundAmount = creditCosts[job.settings.inputMode] || 1;
        await refundCredits(userId, refundAmount, jobId);

        return {
          status: 'failed',
          error: errorMessage,
        };
      }
    }

    // 4. Handle failure
    if (rodinStatus.status === 'Failed') {
      await jobRef.update({
        status: 'failed',
        error: 'Generation failed',
      });

      // Refund credits based on input mode
      const refundAmount = creditCosts[job.settings.inputMode] || 1;
      await refundCredits(userId, refundAmount, jobId);

      functions.logger.warn('Job failed', { jobId });

      return {
        status: 'failed',
        error: 'Generation failed',
      };
    }

    // 5. Still processing (status is 'Waiting' or 'Generating')
    // Map Rodin statuses to our granular internal status
    const mappedStatus = rodinStatus.status === 'Waiting' ? 'pending' : 'generating-model';

    return {
      status: mappedStatus,
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

// Texture generation cost (per Rodin API: 0.5 credits)
const TEXTURE_CREDIT_COST = 0.5;

interface GenerateTextureData {
  sourceJobId: string;          // Job ID of the model to apply texture to
  imageUrl: string;             // Reference image for texture style
  resolution?: TextureResolution;
  format?: OutputFormat;
  prompt?: string;
}

/**
 * Cloud Function: generateTexture
 *
 * Generates PBR textures for an existing 3D model.
 *
 * Workflow:
 * 1. User generates a model (generateModel)
 * 2. User previews the model
 * 3. User uploads a reference image and calls generateTexture
 * 4. Rodin applies textures based on the reference image
 *
 * Steps:
 * 1. Verify authentication and job ownership
 * 2. Validate source job exists and is completed
 * 3. Deduct 0.5 credits
 * 4. Download the existing model from Storage
 * 5. Download the reference image
 * 6. Call Rodin texture API
 * 7. Create texture job document
 * 8. Return job ID for status polling
 */
export const generateTexture = functions
  .region('asia-east1')
  .runWith({
    timeoutSeconds: 120,
    memory: '1GB',
    secrets: ['RODIN_API_KEY'],
  })
  .https.onCall(async (data: GenerateTextureData, context: functions.https.CallableContext) => {
    // 1. Verify authentication
    if (!context.auth) {
      throw new functions.https.HttpsError(
        'unauthenticated',
        'You must be logged in to generate textures'
      );
    }

    const userId = context.auth.uid;
    const {
      sourceJobId,
      imageUrl,
      resolution = 'Basic',
      format = 'glb',
      prompt,
    } = data;

    // Validate input
    if (!sourceJobId) {
      throw new functions.https.HttpsError(
        'invalid-argument',
        'Source job ID is required'
      );
    }

    if (!imageUrl) {
      throw new functions.https.HttpsError(
        'invalid-argument',
        'Reference image URL is required'
      );
    }

    // 2. Validate source job
    const sourceJobRef = db.collection('jobs').doc(sourceJobId);
    const sourceJobDoc = await sourceJobRef.get();

    if (!sourceJobDoc.exists) {
      throw new functions.https.HttpsError(
        'not-found',
        'Source model job not found'
      );
    }

    const sourceJob = sourceJobDoc.data() as JobDocument;

    // Verify ownership
    if (sourceJob.userId !== userId) {
      throw new functions.https.HttpsError(
        'permission-denied',
        'You do not have access to this model'
      );
    }

    // Verify source job is completed
    if (sourceJob.status !== 'completed' || !sourceJob.outputModelUrl) {
      throw new functions.https.HttpsError(
        'failed-precondition',
        'Source model must be completed before generating textures'
      );
    }

    // 3. Create texture job document first
    const jobRef = db.collection('jobs').doc();
    const jobId = jobRef.id;

    // Deduct credits (0.5 for texture generation)
    try {
      await deductCredits(userId, TEXTURE_CREDIT_COST, jobId);
    } catch (error) {
      if (
        error instanceof functions.https.HttpsError &&
        error.code === 'resource-exhausted'
      ) {
        throw new functions.https.HttpsError(
          'resource-exhausted',
          `You need ${TEXTURE_CREDIT_COST} credit(s) for texture generation.`
        );
      }
      throw error;
    }

    // 4. Create job document
    const now = admin.firestore.FieldValue.serverTimestamp();
    const jobSettings: JobSettings = {
      tier: 'Gen-2',
      quality: sourceJob.settings.quality,
      format: format as OutputFormat,
      printerType: sourceJob.settings.printerType,
      inputMode: 'single',
      imageCount: 1,
    };

    const jobDoc: Omit<JobDocument, 'createdAt' | 'completedAt'> & {
      createdAt: FirebaseFirestore.FieldValue;
      completedAt: null;
    } = {
      userId,
      jobType: 'texture',
      status: 'pending',
      inputImageUrl: imageUrl,
      outputModelUrl: null,
      rodinTaskId: '',
      rodinSubscriptionKey: '',
      settings: jobSettings,
      error: null,
      createdAt: now,
      completedAt: null,
      sourceJobId,
      textureResolution: resolution,
    };

    await jobRef.set(jobDoc);

    try {
      // 5. Download the existing model from Storage
      functions.logger.info('Downloading source model', {
        jobId,
        sourceJobId,
        modelUrl: sourceJob.outputModelUrl,
      });

      const modelResponse = await axios.get(sourceJob.outputModelUrl, {
        responseType: 'arraybuffer',
        timeout: 60000,
      });
      const modelBuffer = Buffer.from(modelResponse.data);

      // 6. Download the reference image
      functions.logger.info('Downloading reference image', {
        jobId,
        imageUrl,
      });

      const imageResponse = await axios.get(imageUrl, {
        responseType: 'arraybuffer',
        timeout: 30000,
      });
      const imageBuffer = Buffer.from(imageResponse.data);

      // 7. Call Rodin texture API
      const rodinClient = createRodinClient();
      const { taskUuid, jobUuids, subscriptionKey } = await rodinClient.generateTexture(
        imageBuffer,
        modelBuffer,
        {
          format,
          material: 'PBR',
          resolution,
          prompt,
        }
      );

      // 8. Update job with Rodin task IDs
      await jobRef.update({
        rodinTaskId: taskUuid,
        rodinTaskUuid: taskUuid,
        rodinJobUuids: jobUuids,
        rodinSubscriptionKey: subscriptionKey,
        status: 'processing',
      });

      functions.logger.info('Texture generation started', {
        jobId,
        userId,
        sourceJobId,
        taskUuid,
        resolution,
        format,
      });

      return { jobId, status: 'processing' };
    } catch (error) {
      // Rollback: Refund credits and mark job as failed
      await refundCredits(userId, TEXTURE_CREDIT_COST, jobId);
      await jobRef.update({
        status: 'failed',
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      functions.logger.error('Texture generation failed', {
        jobId,
        sourceJobId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      throw error;
    }
  });

/**
 * Cloud Function: retryFailedJob
 *
 * Retries a failed job by re-attempting the download process.
 * Only works for jobs that failed during the download phase
 * (i.e., have a valid rodinTaskUuid but failed to get download URLs).
 *
 * @param jobId - The ID of the failed job to retry
 */
export const retryFailedJob = functions
  .region('asia-east1')
  .runWith({
    timeoutSeconds: 540,
    memory: '1GB',
    secrets: ['RODIN_API_KEY'],
  })
  .https.onCall(async (data: RetryFailedJobData, context: functions.https.CallableContext) => {
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

    // Only retry failed jobs
    if (job.status !== 'failed') {
      throw new functions.https.HttpsError(
        'failed-precondition',
        `Job is not in failed state (current: ${job.status})`
      );
    }

    // Need rodinTaskUuid to retry
    const downloadTaskUuid = job.rodinTaskUuid || job.rodinTaskId;
    if (!downloadTaskUuid) {
      throw new functions.https.HttpsError(
        'failed-precondition',
        'Job has no Rodin task UUID - cannot retry'
      );
    }

    functions.logger.info('Retrying failed job', {
      jobId,
      downloadTaskUuid,
      previousError: job.error,
    });

    // Reset job status to downloading-model (retrying from download phase)
    await jobRef.update({
      status: 'downloading-model',
      error: null,
    });

    try {
      const rodinClient = createRodinClient();

      // Try to get download URLs (with retry logic)
      const downloadList = await rodinClient.getDownloadUrls(downloadTaskUuid);

      // Find the model file
      const modelFile = downloadList.find((file) =>
        file.name.endsWith(`.${job.settings.format}`)
      );

      if (!modelFile) {
        throw new Error(`No ${job.settings.format} file in download list`);
      }

      // Download model from Rodin
      const modelBuffer = await rodinClient.downloadModel(modelFile.url);

      // Update status to uploading-storage
      await jobRef.update({ status: 'uploading-storage' });

      // Upload to Firebase Storage
      const bucket = storage.bucket();
      const modelPath = `models/${userId}/${jobId}.${job.settings.format}`;
      const file = bucket.file(modelPath);

      await file.save(modelBuffer, {
        metadata: {
          contentType: getContentType(job.settings.format),
        },
      });

      // Generate signed URL
      const [signedUrl] = await file.getSignedUrl({
        action: 'read',
        expires: Date.now() + 7 * 24 * 60 * 60 * 1000,
      });

      // Update job as completed with all download files for preview
      await jobRef.update({
        status: 'completed',
        outputModelUrl: signedUrl,
        downloadFiles: downloadList, // Save all Rodin files for preview
        completedAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      // Increment generation count
      await incrementGenerationCount(userId);

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
    } catch (error) {
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
