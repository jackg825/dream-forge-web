/**
 * Pipeline Handlers
 *
 * Cloud Functions for the new simplified 3D generation workflow:
 * 1. createPipeline - Initialize pipeline with uploaded images
 * 2. generatePipelineImages - Generate 6 views via Gemini
 * 3. regeneratePipelineImage - Regenerate a single view
 * 4. startPipelineMesh - Start Meshy mesh generation (5 credits)
 * 5. checkPipelineStatus - Poll status
 * 6. startPipelineTexture - Start texture generation (10 credits)
 */

import * as functions from 'firebase-functions/v1';
import * as admin from 'firebase-admin';
import axios from 'axios';
import { createMultiViewGenerator } from '../gemini/multi-view-generator';
import { MeshyProvider } from '../providers/meshy/client';
import { createMeshyRetextureClient } from '../providers/meshy/retexture';
import { deductCredits, incrementGenerationCount } from '../utils/credits';
import type {
  PipelineDocument,
  PipelineSettings,
  PipelineProcessedImage,
  PipelineMeshAngle,
  PipelineTextureAngle,
} from '../rodin/types';

const db = admin.firestore();
const storage = admin.storage();

// Credit costs
const PIPELINE_CREDITS = {
  MESH: 5,
  TEXTURE: 10,
} as const;

// ============================================
// Request/Response Types
// ============================================

interface CreatePipelineData {
  imageUrls: string[];  // URLs of uploaded images in Firebase Storage
  settings?: Partial<PipelineSettings>;
}

interface GeneratePipelineImagesData {
  pipelineId: string;
}

interface RegeneratePipelineImageData {
  pipelineId: string;
  viewType: 'mesh' | 'texture';
  angle: string;
}

interface StartPipelineMeshData {
  pipelineId: string;
}

interface CheckPipelineStatusData {
  pipelineId: string;
}

interface StartPipelineTextureData {
  pipelineId: string;
}

interface GetPipelineData {
  pipelineId: string;
}

// ============================================
// Helper Functions
// ============================================

/**
 * Download image and convert to base64
 */
async function downloadImageAsBase64(url: string): Promise<{ base64: string; mimeType: string }> {
  const response = await axios.get(url, {
    responseType: 'arraybuffer',
    timeout: 30000,
  });

  const base64 = Buffer.from(response.data).toString('base64');
  const contentType = response.headers['content-type'] || 'image/png';

  return { base64, mimeType: contentType };
}

/**
 * Upload image to Firebase Storage and get signed URL
 */
async function uploadImageToStorage(
  base64: string,
  mimeType: string,
  storagePath: string
): Promise<string> {
  const bucket = storage.bucket();
  const file = bucket.file(storagePath);

  const buffer = Buffer.from(base64, 'base64');

  await file.save(buffer, {
    metadata: {
      contentType: mimeType,
    },
  });

  const [signedUrl] = await file.getSignedUrl({
    action: 'read',
    expires: Date.now() + 7 * 24 * 60 * 60 * 1000, // 7 days
  });

  return signedUrl;
}

/**
 * Get file extension from MIME type
 */
function getExtensionFromMimeType(mimeType: string): string {
  const mimeMap: Record<string, string> = {
    'image/png': 'png',
    'image/jpeg': 'jpg',
    'image/webp': 'webp',
  };
  return mimeMap[mimeType] || 'png';
}

// ============================================
// Cloud Functions
// ============================================

/**
 * Create a new pipeline
 *
 * Initializes a pipeline document with uploaded images.
 * No credits charged at this stage.
 */
export const createPipeline = functions
  .region('asia-east1')
  .runWith({ timeoutSeconds: 30 })
  .https.onCall(async (data: CreatePipelineData, context) => {
    if (!context.auth) {
      throw new functions.https.HttpsError(
        'unauthenticated',
        'You must be logged in to create a pipeline'
      );
    }

    const userId = context.auth.uid;
    const { imageUrls, settings } = data;

    if (!imageUrls || imageUrls.length === 0) {
      throw new functions.https.HttpsError(
        'invalid-argument',
        'At least one image URL is required'
      );
    }

    const pipelineRef = db.collection('pipelines').doc();
    const pipelineId = pipelineRef.id;

    // Use serverTimestamp for top-level fields, regular Date for array items
    // (Firestore doesn't allow serverTimestamp() inside arrays)
    const now = admin.firestore.FieldValue.serverTimestamp();
    const uploadTime = admin.firestore.Timestamp.now();

    const pipeline: Omit<PipelineDocument, 'createdAt' | 'updatedAt'> & {
      createdAt: admin.firestore.FieldValue;
      updatedAt: admin.firestore.FieldValue;
    } = {
      userId,
      status: 'draft',
      inputImages: imageUrls.map((url) => ({
        url,
        storagePath: '', // Will be extracted from URL if needed
        uploadedAt: uploadTime,
      })),
      meshImages: {},
      textureImages: {},
      creditsCharged: {
        mesh: 0,
        texture: 0,
      },
      settings: {
        quality: settings?.quality || 'standard',
        printerType: settings?.printerType || 'fdm',
        format: settings?.format || 'glb',
      },
      createdAt: now,
      updatedAt: now,
    };

    await pipelineRef.set(pipeline);

    functions.logger.info('Pipeline created', { pipelineId, userId, imageCount: imageUrls.length });

    return {
      pipelineId,
      status: 'draft',
    };
  });

/**
 * Get pipeline details
 */
export const getPipeline = functions
  .region('asia-east1')
  .runWith({ timeoutSeconds: 30 })
  .https.onCall(async (data: GetPipelineData, context) => {
    if (!context.auth) {
      throw new functions.https.HttpsError('unauthenticated', 'Authentication required');
    }

    const { pipelineId } = data;
    const pipelineDoc = await db.collection('pipelines').doc(pipelineId).get();

    if (!pipelineDoc.exists) {
      throw new functions.https.HttpsError('not-found', 'Pipeline not found');
    }

    const pipeline = pipelineDoc.data() as PipelineDocument;

    if (pipeline.userId !== context.auth.uid) {
      throw new functions.https.HttpsError('permission-denied', 'Not your pipeline');
    }

    return {
      id: pipelineId,
      ...pipeline,
    };
  });

/**
 * Generate all 6 views using Gemini
 *
 * Generates:
 * - 4 mesh-optimized views (7-color H2C style)
 * - 2 texture-ready views (full color)
 *
 * No credits charged (Gemini cost absorbed).
 */
export const generatePipelineImages = functions
  .region('asia-east1')
  .runWith({
    timeoutSeconds: 300, // 5 minutes for 6 Gemini calls
    memory: '1GB',
    secrets: ['GEMINI_API_KEY'],
  })
  .https.onCall(async (data: GeneratePipelineImagesData, context) => {
    if (!context.auth) {
      throw new functions.https.HttpsError('unauthenticated', 'Authentication required');
    }

    const userId = context.auth.uid;
    const { pipelineId } = data;

    // Get pipeline
    const pipelineRef = db.collection('pipelines').doc(pipelineId);
    const pipelineDoc = await pipelineRef.get();

    if (!pipelineDoc.exists) {
      throw new functions.https.HttpsError('not-found', 'Pipeline not found');
    }

    const pipeline = pipelineDoc.data() as PipelineDocument;

    if (pipeline.userId !== userId) {
      throw new functions.https.HttpsError('permission-denied', 'Not your pipeline');
    }

    if (pipeline.status !== 'draft' && pipeline.status !== 'images-ready') {
      throw new functions.https.HttpsError(
        'failed-precondition',
        `Cannot generate images in status: ${pipeline.status}`
      );
    }

    // Update status
    await pipelineRef.update({
      status: 'generating-images',
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    try {
      // Download reference image (use first uploaded image)
      const referenceImageUrl = pipeline.inputImages[0].url;
      const { base64, mimeType } = await downloadImageAsBase64(referenceImageUrl);

      // Generate all 6 views
      const generator = createMultiViewGenerator();
      const views = await generator.generateAllViews(base64, mimeType);

      const now = admin.firestore.FieldValue.serverTimestamp();
      const meshImages: Partial<Record<PipelineMeshAngle, PipelineProcessedImage>> = {};
      const textureImages: Partial<Record<PipelineTextureAngle, PipelineProcessedImage>> = {};

      // Upload mesh views
      for (const [angle, view] of Object.entries(views.meshViews)) {
        const ext = getExtensionFromMimeType(view.mimeType);
        const storagePath = `pipelines/${userId}/${pipelineId}/mesh_${angle}.${ext}`;
        const url = await uploadImageToStorage(view.imageBase64, view.mimeType, storagePath);

        meshImages[angle as PipelineMeshAngle] = {
          url,
          storagePath,
          source: 'gemini',
          colorPalette: view.colorPalette,
          generatedAt: now as unknown as FirebaseFirestore.Timestamp,
        };
      }

      // Upload texture views
      for (const [angle, view] of Object.entries(views.textureViews)) {
        const ext = getExtensionFromMimeType(view.mimeType);
        const storagePath = `pipelines/${userId}/${pipelineId}/texture_${angle}.${ext}`;
        const url = await uploadImageToStorage(view.imageBase64, view.mimeType, storagePath);

        textureImages[angle as PipelineTextureAngle] = {
          url,
          storagePath,
          source: 'gemini',
          generatedAt: now as unknown as FirebaseFirestore.Timestamp,
        };
      }

      // Update pipeline with generated images
      await pipelineRef.update({
        status: 'images-ready',
        meshImages,
        textureImages,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      functions.logger.info('Pipeline images generated', {
        pipelineId,
        meshViewCount: Object.keys(meshImages).length,
        textureViewCount: Object.keys(textureImages).length,
      });

      return {
        status: 'images-ready',
        meshImages,
        textureImages,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      await pipelineRef.update({
        status: 'failed',
        error: errorMessage,
        errorStep: 'generating-images',
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      functions.logger.error('Pipeline image generation failed', { pipelineId, error: errorMessage });

      throw new functions.https.HttpsError('internal', `Image generation failed: ${errorMessage}`);
    }
  });

/**
 * Regenerate a single view
 *
 * Allows user to regenerate individual views without regenerating all 6.
 */
export const regeneratePipelineImage = functions
  .region('asia-east1')
  .runWith({
    timeoutSeconds: 120,
    memory: '512MB',
    secrets: ['GEMINI_API_KEY'],
  })
  .https.onCall(async (data: RegeneratePipelineImageData, context) => {
    if (!context.auth) {
      throw new functions.https.HttpsError('unauthenticated', 'Authentication required');
    }

    const userId = context.auth.uid;
    const { pipelineId, viewType, angle } = data;

    // Validate viewType and angle
    const validMeshAngles: PipelineMeshAngle[] = ['front', 'back', 'left', 'right'];
    const validTextureAngles: PipelineTextureAngle[] = ['front', 'back'];

    if (viewType === 'mesh' && !validMeshAngles.includes(angle as PipelineMeshAngle)) {
      throw new functions.https.HttpsError('invalid-argument', 'Invalid mesh angle');
    }

    if (viewType === 'texture' && !validTextureAngles.includes(angle as PipelineTextureAngle)) {
      throw new functions.https.HttpsError('invalid-argument', 'Invalid texture angle');
    }

    // Get pipeline
    const pipelineRef = db.collection('pipelines').doc(pipelineId);
    const pipelineDoc = await pipelineRef.get();

    if (!pipelineDoc.exists) {
      throw new functions.https.HttpsError('not-found', 'Pipeline not found');
    }

    const pipeline = pipelineDoc.data() as PipelineDocument;

    if (pipeline.userId !== userId) {
      throw new functions.https.HttpsError('permission-denied', 'Not your pipeline');
    }

    if (pipeline.status !== 'images-ready') {
      throw new functions.https.HttpsError(
        'failed-precondition',
        'Can only regenerate images when status is images-ready'
      );
    }

    try {
      // Download reference image
      const referenceImageUrl = pipeline.inputImages[0].url;
      const { base64, mimeType } = await downloadImageAsBase64(referenceImageUrl);

      // Generate single view
      const generator = createMultiViewGenerator();
      let view;

      if (viewType === 'mesh') {
        view = await generator.generateMeshView(base64, mimeType, angle as PipelineMeshAngle);
      } else {
        view = await generator.generateTextureView(base64, mimeType, angle as PipelineTextureAngle);
      }

      // Upload to storage
      const ext = getExtensionFromMimeType(view.mimeType);
      const storagePath = `pipelines/${userId}/${pipelineId}/${viewType}_${angle}.${ext}`;
      const url = await uploadImageToStorage(view.imageBase64, view.mimeType, storagePath);

      const now = admin.firestore.FieldValue.serverTimestamp();
      const processedImage: PipelineProcessedImage = {
        url,
        storagePath,
        source: 'gemini',
        colorPalette: view.colorPalette,
        generatedAt: now as unknown as FirebaseFirestore.Timestamp,
      };

      // Update pipeline
      const updateField = viewType === 'mesh' ? `meshImages.${angle}` : `textureImages.${angle}`;
      await pipelineRef.update({
        [updateField]: processedImage,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      functions.logger.info('Pipeline image regenerated', { pipelineId, viewType, angle });

      return {
        viewType,
        angle,
        image: processedImage,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      functions.logger.error('Pipeline image regeneration failed', { pipelineId, viewType, angle, error: errorMessage });
      throw new functions.https.HttpsError('internal', `Regeneration failed: ${errorMessage}`);
    }
  });

/**
 * Start mesh generation (5 credits)
 *
 * Uses Meshy Multi-Image-to-3D with should_texture: false
 */
export const startPipelineMesh = functions
  .region('asia-east1')
  .runWith({
    timeoutSeconds: 120,
    memory: '1GB',
    secrets: ['MESHY_API_KEY'],
  })
  .https.onCall(async (data: StartPipelineMeshData, context) => {
    if (!context.auth) {
      throw new functions.https.HttpsError('unauthenticated', 'Authentication required');
    }

    const userId = context.auth.uid;
    const { pipelineId } = data;

    // Get pipeline
    const pipelineRef = db.collection('pipelines').doc(pipelineId);
    const pipelineDoc = await pipelineRef.get();

    if (!pipelineDoc.exists) {
      throw new functions.https.HttpsError('not-found', 'Pipeline not found');
    }

    const pipeline = pipelineDoc.data() as PipelineDocument;

    if (pipeline.userId !== userId) {
      throw new functions.https.HttpsError('permission-denied', 'Not your pipeline');
    }

    if (pipeline.status !== 'images-ready') {
      throw new functions.https.HttpsError(
        'failed-precondition',
        `Cannot start mesh generation in status: ${pipeline.status}`
      );
    }

    // Verify we have all 4 mesh images
    const meshAngles: PipelineMeshAngle[] = ['front', 'back', 'left', 'right'];
    const missingAngles = meshAngles.filter((angle) => !pipeline.meshImages[angle]);

    if (missingAngles.length > 0) {
      throw new functions.https.HttpsError(
        'failed-precondition',
        `Missing mesh images for: ${missingAngles.join(', ')}`
      );
    }

    // Deduct credits
    try {
      await deductCredits(userId, PIPELINE_CREDITS.MESH, pipelineId);
    } catch (error) {
      throw new functions.https.HttpsError(
        'resource-exhausted',
        'Insufficient credits for mesh generation (5 credits required)'
      );
    }

    // Update status
    await pipelineRef.update({
      status: 'generating-mesh',
      'creditsCharged.mesh': PIPELINE_CREDITS.MESH,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    try {
      // Download mesh images
      const imageBuffers: Buffer[] = [];

      for (const angle of meshAngles) {
        const imageUrl = pipeline.meshImages[angle]!.url;
        const response = await axios.get(imageUrl, {
          responseType: 'arraybuffer',
          timeout: 30000,
        });
        imageBuffers.push(Buffer.from(response.data));
      }

      // Create Meshy provider and generate mesh only
      const meshyApiKey = process.env.MESHY_API_KEY;
      if (!meshyApiKey) {
        throw new Error('Meshy API key not configured');
      }

      const meshyProvider = new MeshyProvider(meshyApiKey);
      const result = await meshyProvider.generateMeshOnly(imageBuffers, {
        quality: pipeline.settings.quality as 'draft' | 'standard' | 'fine',
        format: pipeline.settings.format as 'glb' | 'obj' | 'fbx' | 'stl' | 'usdz',
      });

      // Update pipeline with task ID
      await pipelineRef.update({
        meshyMeshTaskId: result.taskId,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      functions.logger.info('Pipeline mesh generation started', {
        pipelineId,
        meshyTaskId: result.taskId,
      });

      return {
        status: 'generating-mesh',
        meshyTaskId: result.taskId,
        creditsCharged: PIPELINE_CREDITS.MESH,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      await pipelineRef.update({
        status: 'failed',
        error: errorMessage,
        errorStep: 'generating-mesh',
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      functions.logger.error('Pipeline mesh generation failed', { pipelineId, error: errorMessage });
      throw new functions.https.HttpsError('internal', `Mesh generation failed: ${errorMessage}`);
    }
  });

/**
 * Check pipeline status
 *
 * Polls Meshy for mesh/texture generation status and downloads completed models.
 */
export const checkPipelineStatus = functions
  .region('asia-east1')
  .runWith({
    timeoutSeconds: 120,
    memory: '512MB',
    secrets: ['MESHY_API_KEY'],
  })
  .https.onCall(async (data: CheckPipelineStatusData, context) => {
    if (!context.auth) {
      throw new functions.https.HttpsError('unauthenticated', 'Authentication required');
    }

    const userId = context.auth.uid;
    const { pipelineId } = data;

    // Get pipeline
    const pipelineRef = db.collection('pipelines').doc(pipelineId);
    const pipelineDoc = await pipelineRef.get();

    if (!pipelineDoc.exists) {
      throw new functions.https.HttpsError('not-found', 'Pipeline not found');
    }

    const pipeline = pipelineDoc.data() as PipelineDocument;

    if (pipeline.userId !== userId) {
      throw new functions.https.HttpsError('permission-denied', 'Not your pipeline');
    }

    // Return current status if not generating
    if (pipeline.status !== 'generating-mesh' && pipeline.status !== 'generating-texture') {
      return {
        status: pipeline.status,
        meshUrl: pipeline.meshUrl,
        texturedModelUrl: pipeline.texturedModelUrl,
      };
    }

    // Check Meshy status
    const meshyApiKey = process.env.MESHY_API_KEY;
    if (!meshyApiKey) {
      throw new functions.https.HttpsError('internal', 'Meshy API key not configured');
    }

    const meshyProvider = new MeshyProvider(meshyApiKey);

    try {
      if (pipeline.status === 'generating-mesh' && pipeline.meshyMeshTaskId) {
        const status = await meshyProvider.checkStatus(pipeline.meshyMeshTaskId);

        if (status.status === 'completed') {
          // Download and store mesh
          const downloadResult = await meshyProvider.getDownloadUrls(pipeline.meshyMeshTaskId);
          const glbFile = downloadResult.files.find((f) => f.format === 'glb');

          if (glbFile) {
            const modelBuffer = await meshyProvider.downloadModel(glbFile.url);
            const storagePath = `pipelines/${userId}/${pipelineId}/mesh.glb`;
            const bucket = storage.bucket();
            const file = bucket.file(storagePath);

            await file.save(modelBuffer, {
              metadata: { contentType: 'model/gltf-binary' },
            });

            const [signedUrl] = await file.getSignedUrl({
              action: 'read',
              expires: Date.now() + 7 * 24 * 60 * 60 * 1000,
            });

            await pipelineRef.update({
              status: 'mesh-ready',
              meshUrl: signedUrl,
              meshStoragePath: storagePath,
              meshDownloadFiles: downloadResult.files,
              updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            });

            await incrementGenerationCount(userId);

            return {
              status: 'mesh-ready',
              meshUrl: signedUrl,
              downloadFiles: downloadResult.files,
            };
          }
        } else if (status.status === 'failed') {
          await pipelineRef.update({
            status: 'failed',
            error: status.error || 'Mesh generation failed',
            errorStep: 'generating-mesh',
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          });

          return { status: 'failed', error: status.error };
        }

        return { status: 'generating-mesh', progress: status.progress };
      }

      if (pipeline.status === 'generating-texture' && pipeline.meshyTextureTaskId) {
        const retextureClient = createMeshyRetextureClient();
        const status = await retextureClient.checkStatus(pipeline.meshyTextureTaskId);

        if (status.status === 'completed') {
          // Download and store textured model
          const downloadResult = await retextureClient.getDownloadUrls(pipeline.meshyTextureTaskId);
          const glbFile = downloadResult.files.find((f) => f.format === 'glb');

          if (glbFile) {
            const modelBuffer = await retextureClient.downloadModel(glbFile.url);
            const storagePath = `pipelines/${userId}/${pipelineId}/textured.glb`;
            const bucket = storage.bucket();
            const file = bucket.file(storagePath);

            await file.save(modelBuffer, {
              metadata: { contentType: 'model/gltf-binary' },
            });

            const [signedUrl] = await file.getSignedUrl({
              action: 'read',
              expires: Date.now() + 7 * 24 * 60 * 60 * 1000,
            });

            await pipelineRef.update({
              status: 'completed',
              texturedModelUrl: signedUrl,
              texturedModelStoragePath: storagePath,
              texturedDownloadFiles: downloadResult.files,
              completedAt: admin.firestore.FieldValue.serverTimestamp(),
              updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            });

            return {
              status: 'completed',
              texturedModelUrl: signedUrl,
              downloadFiles: downloadResult.files,
            };
          }
        } else if (status.status === 'failed') {
          await pipelineRef.update({
            status: 'failed',
            error: status.error || 'Texture generation failed',
            errorStep: 'generating-texture',
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          });

          return { status: 'failed', error: status.error };
        }

        return { status: 'generating-texture', progress: status.progress };
      }

      return { status: pipeline.status };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      functions.logger.error('Pipeline status check failed', { pipelineId, error: errorMessage });
      throw new functions.https.HttpsError('internal', `Status check failed: ${errorMessage}`);
    }
  });

/**
 * Start texture generation (10 credits)
 *
 * Uses Meshy Retexture API with texture reference images
 */
export const startPipelineTexture = functions
  .region('asia-east1')
  .runWith({
    timeoutSeconds: 120,
    memory: '512MB',
    secrets: ['MESHY_API_KEY'],
  })
  .https.onCall(async (data: StartPipelineTextureData, context) => {
    if (!context.auth) {
      throw new functions.https.HttpsError('unauthenticated', 'Authentication required');
    }

    const userId = context.auth.uid;
    const { pipelineId } = data;

    // Get pipeline
    const pipelineRef = db.collection('pipelines').doc(pipelineId);
    const pipelineDoc = await pipelineRef.get();

    if (!pipelineDoc.exists) {
      throw new functions.https.HttpsError('not-found', 'Pipeline not found');
    }

    const pipeline = pipelineDoc.data() as PipelineDocument;

    if (pipeline.userId !== userId) {
      throw new functions.https.HttpsError('permission-denied', 'Not your pipeline');
    }

    if (pipeline.status !== 'mesh-ready') {
      throw new functions.https.HttpsError(
        'failed-precondition',
        `Cannot start texture generation in status: ${pipeline.status}`
      );
    }

    if (!pipeline.meshyMeshTaskId) {
      throw new functions.https.HttpsError(
        'failed-precondition',
        'Mesh generation must complete before texturing'
      );
    }

    // Verify we have texture reference images
    if (!pipeline.textureImages.front) {
      throw new functions.https.HttpsError(
        'failed-precondition',
        'Missing front texture reference image'
      );
    }

    // Deduct credits
    try {
      await deductCredits(userId, PIPELINE_CREDITS.TEXTURE, pipelineId);
    } catch (error) {
      throw new functions.https.HttpsError(
        'resource-exhausted',
        'Insufficient credits for texture generation (10 credits required)'
      );
    }

    // Update status
    await pipelineRef.update({
      status: 'generating-texture',
      'creditsCharged.texture': PIPELINE_CREDITS.TEXTURE,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    try {
      // Use front texture image as style reference
      const styleImageUrl = pipeline.textureImages.front.url;

      // Create retexture task
      const retextureClient = createMeshyRetextureClient();
      const taskId = await retextureClient.createFromMeshTask(
        pipeline.meshyMeshTaskId,
        {
          imageStyleUrl: styleImageUrl,
          enablePBR: pipeline.settings.printerType !== 'fdm', // PBR for SLA/resin
        }
      );

      // Update pipeline
      await pipelineRef.update({
        meshyTextureTaskId: taskId,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      functions.logger.info('Pipeline texture generation started', {
        pipelineId,
        meshyTextureTaskId: taskId,
      });

      return {
        status: 'generating-texture',
        meshyTextureTaskId: taskId,
        creditsCharged: PIPELINE_CREDITS.TEXTURE,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      await pipelineRef.update({
        status: 'failed',
        error: errorMessage,
        errorStep: 'generating-texture',
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      functions.logger.error('Pipeline texture generation failed', { pipelineId, error: errorMessage });
      throw new functions.https.HttpsError('internal', `Texture generation failed: ${errorMessage}`);
    }
  });
