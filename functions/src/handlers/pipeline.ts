/**
 * Pipeline Handlers
 *
 * Cloud Functions for the new simplified 3D generation workflow:
 * 1. createPipeline - Initialize pipeline with uploaded images
 * 2. generatePipelineImages - Generate 4 mesh views via Gemini (3 credits)
 * 3. regeneratePipelineImage - Regenerate a single mesh view (free, max 4 times)
 * 4. startPipelineMesh - Start mesh generation (5-8 credits depending on provider)
 * 5. checkPipelineStatus - Poll status
 * 6. startPipelineTexture - Start texture generation on model (10 credits)
 */

import * as functions from 'firebase-functions/v1';
import * as admin from 'firebase-admin';
import axios from 'axios';
import { createMultiViewGenerator, type GeminiImageModel } from '../gemini/multi-view-generator';
import { MeshyProvider, type MeshGenerationOptions } from '../providers/meshy/client';
import { TripoProvider } from '../providers/tripo/client';
import { HunyuanProvider } from '../providers/hunyuan/client';
import { createMeshyRetextureClient } from '../providers/meshy/retexture';
import { ProviderFactory, isValidProvider } from '../providers/factory';
import { deductCredits, refundCredits, incrementGenerationCount } from '../utils/credits';
import { uploadBase64, uploadBuffer } from '../storage';
import type {
  PipelineDocument,
  PipelineSettings,
  PipelineProcessedImage,
  PipelineMeshAngle,
  PipelineStatus,
  GenerationModeId,
  ProviderType,
  ProviderOptions,
} from '../rodin/types';
import { DEFAULT_MODE } from '../gemini/mode-configs';

const db = admin.firestore();

// Credit costs per provider
// See docs/cost-analysis.md for detailed breakdown
const PROVIDER_CREDIT_COSTS: Record<ProviderType, number> = {
  meshy: 5,    // API: $0.10 → Total: $0.35
  hunyuan: 6,  // API: ¥2.40 (~$0.33) → Total: $0.58
  rodin: 8,    // API: $0.50 → Total: $0.75
  tripo: 5,    // API: ~$0.16 → Total: $0.41
  hitem3d: 6,  // API: TBD → Estimated similar to Hunyuan
};

const PIPELINE_CREDITS = {
  MESH: 5,      // Default (overridden by provider)
  TEXTURE: 10,  // Meshy Retexture only
} as const;

// Credit cost for Gemini view generation (single model)
const GEMINI_MODEL_CREDITS: Record<GeminiImageModel, number> = {
  'gemini-2.5-flash': 3,
};

// ============================================
// Request/Response Types
// ============================================

interface CreatePipelineData {
  imageUrls: string[];  // URLs of uploaded images in Firebase Storage
  settings?: Partial<PipelineSettings>;
  generationMode?: GenerationModeId;  // A/B testing mode
  userDescription?: string;  // Optional description of the object for better AI generation
  imageAnalysis?: import('../rodin/types').ImageAnalysisResult;  // Pre-analysis results from Gemini
  geminiModel?: 'gemini-3-pro' | 'gemini-2.5-flash';  // Gemini model for image generation
  selectedStyle?: import('../config/styles').StyleId;  // User-selected figure style
}

// Maximum regenerations allowed per pipeline (credits only charged once)
const MAX_REGENERATIONS = 4;

interface GeneratePipelineImagesData {
  pipelineId: string;
}

interface RegeneratePipelineImageData {
  pipelineId: string;
  viewType: 'mesh';  // Only mesh views can be regenerated
  angle: string;
  hint?: string;  // Optional hint for regeneration adjustments
}

interface StartPipelineMeshData {
  pipelineId: string;
  provider?: ProviderType;        // 3D generation provider (default: 'meshy')
  providerOptions?: ProviderOptions;
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

interface GetUserPipelinesData {
  limit?: number;
  status?: string;
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
 * Upload image to storage and get URL
 * Uses storage abstraction layer (Firebase or R2)
 */
async function uploadImageToStorage(
  base64: string,
  mimeType: string,
  storagePath: string
): Promise<string> {
  return uploadBase64(base64, storagePath, mimeType);
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
    const { imageUrls, settings, generationMode, userDescription, imageAnalysis, geminiModel, selectedStyle } = data;

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

    // Determine generation mode (default to simplified-mesh for backward compatibility)
    const modeId: GenerationModeId = generationMode || DEFAULT_MODE;

    const pipeline: Omit<PipelineDocument, 'createdAt' | 'updatedAt'> & {
      createdAt: admin.firestore.FieldValue;
      updatedAt: admin.firestore.FieldValue;
    } = {
      userId,
      status: 'draft',
      processingMode: 'batch', // Default to batch mode (50% cost savings)
      generationMode: modeId,
      inputImages: imageUrls.map((url) => ({
        url,
        storagePath: '', // Will be extracted from URL if needed
        uploadedAt: uploadTime,
      })),
      meshImages: {},
      creditsCharged: {
        mesh: 0,
        texture: 0,
      },
      regenerationsUsed: 0,  // Track regeneration count (max 4 per pipeline)
      settings: {
        quality: settings?.quality || 'standard',
        printerType: settings?.printerType || 'fdm',
        format: settings?.format || 'glb',
        generationMode: modeId,
        geminiModel: geminiModel || 'gemini-2.5-flash',  // Default to fast model
        ...(settings?.colorCount !== undefined && { colorCount: settings.colorCount }),
        ...(selectedStyle !== undefined && { selectedStyle }),  // User-selected figure style
      },
      userDescription: userDescription || null,
      ...(imageAnalysis !== undefined && { imageAnalysis }),
      createdAt: now,
      updatedAt: now,
    };

    await pipelineRef.set(pipeline);

    functions.logger.info('Pipeline created', {
      pipelineId,
      userId,
      imageCount: imageUrls.length,
      generationMode: modeId,
      hasUserDescription: !!userDescription,
      hasImageAnalysis: !!imageAnalysis,
      analysisColorCount: imageAnalysis?.colorPalette?.length,
    });

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
 * Get user's pipelines for dashboard
 */
export const getUserPipelines = functions
  .region('asia-east1')
  .runWith({ timeoutSeconds: 30 })
  .https.onCall(async (data: GetUserPipelinesData, context) => {
    if (!context.auth) {
      throw new functions.https.HttpsError('unauthenticated', 'Authentication required');
    }

    const userId = context.auth.uid;
    const limit = Math.min(data.limit || 20, 50); // Max 50

    let query = db
      .collection('pipelines')
      .where('userId', '==', userId)
      .orderBy('createdAt', 'desc')
      .limit(limit);

    // Optional status filter
    if (data.status) {
      query = db
        .collection('pipelines')
        .where('userId', '==', userId)
        .where('status', '==', data.status)
        .orderBy('createdAt', 'desc')
        .limit(limit);
    }

    const snapshot = await query.get();

    const pipelines = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));

    return { pipelines };
  });

/**
 * Generate all 6 views using Gemini
 *
 * Generates:
 * - 4 mesh-optimized views (7-color H2C style)
 * - 2 texture-ready views (full color)
 *
 * Credit costs:
 * - gemini-3-pro: 10 credits
 * - gemini-2.5-flash: 3 credits
 *
 * Credits are refunded on failure.
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

    // Allow retry from failed state if it failed during image generation
    const canRetry = pipeline.status === 'failed' && pipeline.errorStep === 'generating-images';
    if (pipeline.status !== 'draft' && pipeline.status !== 'images-ready' && !canRetry) {
      throw new functions.https.HttpsError(
        'failed-precondition',
        `Cannot generate images in status: ${pipeline.status}`
      );
    }

    // Get Gemini model and calculate credits
    const geminiModel = (pipeline.settings?.geminiModel || 'gemini-2.5-flash') as GeminiImageModel;
    const viewCredits = GEMINI_MODEL_CREDITS[geminiModel];

    // Deduct credits (throws if insufficient)
    try {
      await deductCredits(userId, viewCredits, pipelineId);
    } catch (error) {
      throw new functions.https.HttpsError(
        'resource-exhausted',
        `Insufficient credits for view generation (${viewCredits} credits required for ${geminiModel})`
      );
    }

    // Update status (clear error if retrying)
    await pipelineRef.update({
      status: 'generating-images',
      'creditsCharged.views': viewCredits,
      error: admin.firestore.FieldValue.delete(),
      errorStep: admin.firestore.FieldValue.delete(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    try {
      // Download reference image (use first uploaded image)
      const referenceImageUrl = pipeline.inputImages[0].url;
      const { base64, mimeType } = await downloadImageAsBase64(referenceImageUrl);

      // Generate all 6 views using the pipeline's generation mode and user description
      // Uses staggered parallel execution for better performance (~18s vs ~50s)
      // If imageAnalysis exists, use its key features for consistency
      const modeId = pipeline.generationMode || DEFAULT_MODE;
      // geminiModel is already declared above for credit calculation
      const selectedStyle = pipeline.settings?.selectedStyle;
      const generator = createMultiViewGenerator(modeId, pipeline.userDescription, pipeline.imageAnalysis, geminiModel, selectedStyle);

      // Create progress callback to update Firestore in real-time
      const onProgress = async (
        type: 'mesh' | 'texture',
        angle: string,
        completed: number,
        total: number
      ) => {
        const progress = type === 'mesh'
          ? { phase: 'mesh-views' as const, meshViewsCompleted: completed, textureViewsCompleted: 0 }
          : { phase: 'texture-views' as const, meshViewsCompleted: 4, textureViewsCompleted: completed };

        await pipelineRef.update({
          generationProgress: progress,
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
      };

      const views = await generator.generateAllViewsParallel(base64, mimeType, onProgress);

      functions.logger.info('Using generation mode with parallel execution', {
        pipelineId,
        mode: modeId,
        hasUserDescription: !!pipeline.userDescription,
        dominantColors: views.aggregatedPalette?.dominantColors?.length || 0,
      });

      const now = admin.firestore.FieldValue.serverTimestamp();
      const meshImages: Partial<Record<PipelineMeshAngle, PipelineProcessedImage>> = {};

      // Upload mesh views
      for (const [angle, view] of Object.entries(views.meshViews)) {
        const ext = getExtensionFromMimeType(view.mimeType);
        const storagePath = `pipelines/${userId}/${pipelineId}/mesh_${angle}.${ext}`;
        const url = await uploadImageToStorage(view.imageBase64, view.mimeType, storagePath);

        // Build mesh image object, only include colorPalette if it exists
        const meshImage: PipelineProcessedImage = {
          url,
          storagePath,
          source: 'gemini',
          generatedAt: now as unknown as FirebaseFirestore.Timestamp,
        };
        if (view.colorPalette && view.colorPalette.length > 0) {
          meshImage.colorPalette = view.colorPalette;
        }
        meshImages[angle as PipelineMeshAngle] = meshImage;
      }

      // Build aggregated color palette for Firestore
      const aggregatedColorPalette = views.aggregatedPalette
        ? {
            unified: views.aggregatedPalette.unified,
            dominantColors: views.aggregatedPalette.dominantColors,
          }
        : undefined;

      // Update pipeline with generated images and color palette
      await pipelineRef.update({
        status: 'images-ready',
        meshImages,
        ...(aggregatedColorPalette && { aggregatedColorPalette }),
        generationProgress: {
          phase: 'complete',
          meshViewsCompleted: 4,
        },
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      functions.logger.info('Pipeline images generated', {
        pipelineId,
        meshViewCount: Object.keys(meshImages).length,
        dominantColorCount: aggregatedColorPalette?.dominantColors?.length || 0,
      });

      return {
        status: 'images-ready',
        meshImages,
        aggregatedColorPalette,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      // Refund credits on failure (viewCredits is available in outer scope)
      try {
        await refundCredits(userId, viewCredits, pipelineId);
        functions.logger.info('Refunded credits after view generation failure', {
          pipelineId,
          credits: viewCredits,
        });
      } catch (refundError) {
        functions.logger.error('Failed to refund credits', { pipelineId, refundError });
      }

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
    const { pipelineId, viewType, angle, hint } = data;

    // Validate viewType and angle
    const validMeshAngles: PipelineMeshAngle[] = ['front', 'back', 'left', 'right'];

    if (viewType !== 'mesh') {
      throw new functions.https.HttpsError('invalid-argument', 'Only mesh view regeneration is supported');
    }

    if (!validMeshAngles.includes(angle as PipelineMeshAngle)) {
      throw new functions.https.HttpsError('invalid-argument', 'Invalid mesh angle');
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

    // Check regeneration limit
    const regenerationsUsed = pipeline.regenerationsUsed || 0;
    if (regenerationsUsed >= MAX_REGENERATIONS) {
      throw new functions.https.HttpsError(
        'resource-exhausted',
        `已達重新生成上限 (${MAX_REGENERATIONS} 次)`
      );
    }

    try {
      // Download reference image
      const referenceImageUrl = pipeline.inputImages[0].url;
      const { base64, mimeType } = await downloadImageAsBase64(referenceImageUrl);

      // Generate single view using the pipeline's generation mode
      // Pass userDescription from pipeline, imageAnalysis, and optional hint for adjustments
      // Use the same geminiModel that was selected when creating the pipeline
      const modeId = pipeline.generationMode || DEFAULT_MODE;
      const geminiModel = (pipeline.settings?.geminiModel || 'gemini-2.5-flash') as GeminiImageModel;
      const selectedStyle = pipeline.settings?.selectedStyle;
      const generator = createMultiViewGenerator(modeId, pipeline.userDescription, pipeline.imageAnalysis, geminiModel, selectedStyle);
      const now = admin.firestore.FieldValue.serverTimestamp();

      if (viewType === 'mesh') {
        // Regenerate mesh view
        const view = await generator.generateMeshView(base64, mimeType, angle as PipelineMeshAngle, hint);

        // Upload mesh image
        const ext = getExtensionFromMimeType(view.mimeType);
        const storagePath = `pipelines/${userId}/${pipelineId}/mesh_${angle}.${ext}`;
        const url = await uploadImageToStorage(view.imageBase64, view.mimeType, storagePath);

        const processedMeshImage: PipelineProcessedImage = {
          url,
          storagePath,
          source: 'gemini',
          generatedAt: now as unknown as FirebaseFirestore.Timestamp,
        };
        if (view.colorPalette && view.colorPalette.length > 0) {
          processedMeshImage.colorPalette = view.colorPalette;
        }

        // Re-aggregate color palette from all mesh views (including the new one)
        const updatedPipelineDoc = await pipelineRef.get();
        const updatedPipeline = updatedPipelineDoc.data() as PipelineDocument;

        // Collect colors from all mesh views
        const colorFrequency = new Map<string, number>();
        const meshAngles: PipelineMeshAngle[] = ['front', 'back', 'left', 'right'];
        for (const meshAngle of meshAngles) {
          const meshImage = updatedPipeline.meshImages[meshAngle];
          if (meshImage?.colorPalette) {
            for (const color of meshImage.colorPalette) {
              const normalizedColor = color.toUpperCase();
              colorFrequency.set(normalizedColor, (colorFrequency.get(normalizedColor) || 0) + 1);
            }
          }
        }

        const sortedColors = [...colorFrequency.entries()]
          .sort((a, b) => b[1] - a[1])
          .map(([color]) => color);

        const newAggregatedPalette = {
          unified: sortedColors,
          dominantColors: sortedColors.slice(0, 7),
        };

        // Update the mesh image, color palette, and increment regeneration counter
        await pipelineRef.update({
          [`meshImages.${angle}`]: processedMeshImage,
          aggregatedColorPalette: newAggregatedPalette,
          regenerationsUsed: admin.firestore.FieldValue.increment(1),
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });

        functions.logger.info('Pipeline mesh image regenerated', {
          pipelineId,
          angle,
        });

        return {
          viewType,
          angle,
          image: processedMeshImage,
          aggregatedColorPalette: newAggregatedPalette,
        };
      } else {
        // Texture view regeneration is no longer supported
        throw new functions.https.HttpsError(
          'invalid-argument',
          'Texture view regeneration is not supported. Only mesh views can be regenerated.'
        );
      }
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
    secrets: ['MESHY_API_KEY', 'RODIN_API_KEY', 'TRIPO_API_KEY', 'TENCENT_SECRET_ID', 'TENCENT_SECRET_KEY', 'HITEM_ACCESS_KEY', 'HITEM_SECRET_KEY'],
  })
  .https.onCall(async (data: StartPipelineMeshData, context) => {
    if (!context.auth) {
      throw new functions.https.HttpsError('unauthenticated', 'Authentication required');
    }

    const userId = context.auth.uid;
    const { pipelineId, provider: requestedProvider, providerOptions } = data;

    // Validate provider if specified
    const providerType: ProviderType = requestedProvider && isValidProvider(requestedProvider)
      ? requestedProvider
      : 'meshy';

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

    // Allow retry from failed state when mesh generation failed
    const canRetryMesh = pipeline.status === 'failed' && pipeline.errorStep === 'generating-mesh';

    if (pipeline.status !== 'images-ready' && !canRetryMesh) {
      throw new functions.https.HttpsError(
        'failed-precondition',
        `Cannot start mesh generation in status: ${pipeline.status}`
      );
    }

    // Clear error state when retrying
    if (canRetryMesh) {
      await pipelineRef.update({
        error: admin.firestore.FieldValue.delete(),
        errorStep: admin.firestore.FieldValue.delete(),
      });
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

    // Deduct credits (provider-specific)
    const meshCredits = PROVIDER_CREDIT_COSTS[providerType];
    try {
      await deductCredits(userId, meshCredits, pipelineId);
    } catch (error) {
      throw new functions.https.HttpsError(
        'resource-exhausted',
        `Insufficient credits for mesh generation (${meshCredits} credits required for ${providerType})`
      );
    }

    // Update status and save provider settings BEFORE API call
    // This ensures retry uses the correct provider even if API fails
    await pipelineRef.update({
      status: 'generating-mesh',
      'creditsCharged.mesh': meshCredits,
      'settings.provider': providerType,
      'settings.providerOptions': providerOptions || {},
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    try {
      // Get image URLs from pipeline (no need to download anymore!)
      const imageUrls = meshAngles.map(angle => pipeline.meshImages[angle]!.url);

      // Get provider via factory pattern
      const provider = ProviderFactory.getProvider(providerType);

      functions.logger.info('Starting mesh generation with provider (URL-based)', {
        pipelineId,
        provider: providerType,
        providerOptions,
        imageCount: imageUrls.length,
      });

      // Use URL-based methods to avoid timeout issues
      let result;
      if (providerType === 'tripo') {
        // Tripo: use generateFromUrls
        const tripoProvider = provider as TripoProvider;
        result = await tripoProvider.generateFromUrls(imageUrls, {
          quality: pipeline.settings.quality as 'draft' | 'standard' | 'fine',
          format: pipeline.settings.format as 'glb' | 'obj' | 'fbx' | 'stl' | 'usdz',
          enableTexture: true,
          enablePBR: true,
        });
      } else if (providerType === 'meshy') {
        // Meshy: use generateMeshOnlyFromUrls
        const meshyProvider = provider as MeshyProvider;
        const meshOptions: MeshGenerationOptions = {
          quality: pipeline.settings.quality as 'draft' | 'standard' | 'fine',
          format: pipeline.settings.format as 'glb' | 'obj' | 'fbx' | 'stl' | 'usdz',
          precision: pipeline.settings.meshPrecision || 'standard',
        };
        result = await meshyProvider.generateMeshOnlyFromUrls(imageUrls, meshOptions);
      } else if (providerType === 'hunyuan') {
        // Hunyuan: use generateFromUrls
        const hunyuanProvider = provider as HunyuanProvider;
        result = await hunyuanProvider.generateFromUrls(imageUrls, {
          quality: pipeline.settings.quality as 'draft' | 'standard' | 'fine',
          format: pipeline.settings.format as 'glb' | 'obj' | 'fbx' | 'stl' | 'usdz',
          enablePBR: false,
          providerOptions: providerOptions ? {
            hunyuan: providerOptions.faceCount ? { faceCount: providerOptions.faceCount } : undefined,
          } : undefined,
        });
      } else {
        // Fallback for unknown providers: download to buffers
        const imageBuffers: Buffer[] = [];
        for (const url of imageUrls) {
          const response = await axios.get(url, {
            responseType: 'arraybuffer',
            timeout: 30000,
          });
          imageBuffers.push(Buffer.from(response.data));
        }
        result = await provider.generateFromMultipleImages(imageBuffers, {
          quality: pipeline.settings.quality as 'draft' | 'standard' | 'fine',
          format: pipeline.settings.format as 'glb' | 'obj' | 'fbx' | 'stl' | 'usdz',
          enableTexture: false,
          enablePBR: false,
        });
      }

      // Update pipeline with task ID (provider settings already saved above)
      const updateData: Record<string, any> = {
        providerTaskId: result.taskId,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      };

      // Also store in legacy field for backwards compatibility
      if (providerType === 'meshy') {
        updateData.meshyMeshTaskId = result.taskId;
      }

      await pipelineRef.update(updateData);

      functions.logger.info('Pipeline mesh generation started', {
        pipelineId,
        provider: providerType,
        taskId: result.taskId,
      });

      return {
        status: 'generating-mesh',
        meshyTaskId: result.taskId,  // Legacy field for backwards compatibility
        taskId: result.taskId,       // Generic field
        provider: providerType,
        creditsCharged: meshCredits,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      // Refund credits on failure
      try {
        await refundCredits(userId, meshCredits, pipelineId);
        functions.logger.info('Refunded mesh credits after failure', { pipelineId, userId, provider: providerType, amount: meshCredits });
      } catch (refundError) {
        functions.logger.error('Failed to refund mesh credits', { pipelineId, userId, refundError });
      }

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
    secrets: [
      'MESHY_API_KEY', 'RODIN_API_KEY', 'TRIPO_API_KEY', 'TENCENT_SECRET_ID', 'TENCENT_SECRET_KEY',
      'STORAGE_BACKEND', 'R2_ACCESS_KEY_ID', 'R2_SECRET_ACCESS_KEY', 'R2_ACCOUNT_ID', 'R2_BUCKET_NAME', 'R2_PUBLIC_URL',
    ],
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

    // Get the provider type from settings, default to meshy for backwards compatibility
    const providerType: ProviderType = pipeline.settings.provider || 'meshy';

    try {
      // Check mesh generation status
      const taskId = pipeline.providerTaskId || pipeline.meshyMeshTaskId;
      if (pipeline.status === 'generating-mesh' && taskId) {
        const provider = ProviderFactory.getProvider(providerType);
        const status = await provider.checkStatus(taskId);

        if (status.status === 'completed') {
          // Download and store mesh
          const downloadResult = await provider.getDownloadUrls(taskId);

          // Try to find the best model file: prefer GLB, then FBX, then first available
          const modelFile = downloadResult.files.find((f) => f.format === 'glb')
            || downloadResult.files.find((f) => f.format === 'fbx')
            || downloadResult.files[0];

          if (modelFile) {
            const modelBuffer = await provider.downloadModel(modelFile.url);
            const fileExt = modelFile.format || 'glb';
            const storagePath = `pipelines/${userId}/${pipelineId}/mesh.${fileExt}`;

            // Determine MIME type based on format
            const mimeTypes: Record<string, string> = {
              glb: 'model/gltf-binary',
              fbx: 'application/octet-stream',
              obj: 'text/plain',
              stl: 'application/sla',
            };
            const mimeType = mimeTypes[fileExt] || 'application/octet-stream';

            // Use storage abstraction layer
            const meshUrl = await uploadBuffer(modelBuffer, storagePath, mimeType);

            await pipelineRef.update({
              status: 'mesh-ready',
              meshUrl,
              meshStoragePath: storagePath,
              meshDownloadFiles: downloadResult.files,
              meshFormat: fileExt,  // Store the actual format
              updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            });

            await incrementGenerationCount(userId);

            functions.logger.info('Mesh stored successfully', {
              pipelineId,
              format: fileExt,
              availableFormats: downloadResult.files.map(f => f.format),
            });

            return {
              status: 'mesh-ready',
              meshUrl,
              meshFormat: fileExt,
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

            // Use storage abstraction layer
            const texturedModelUrl = await uploadBuffer(modelBuffer, storagePath, 'model/gltf-binary');

            await pipelineRef.update({
              status: 'completed',
              texturedModelUrl,
              texturedModelStoragePath: storagePath,
              texturedDownloadFiles: downloadResult.files,
              completedAt: admin.firestore.FieldValue.serverTimestamp(),
              updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            });

            return {
              status: 'completed',
              texturedModelUrl,
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

    // Allow retry from failed state when texture generation failed
    const canRetryTexture = pipeline.status === 'failed' && pipeline.errorStep === 'generating-texture';

    if (pipeline.status !== 'mesh-ready' && !canRetryTexture) {
      throw new functions.https.HttpsError(
        'failed-precondition',
        `Cannot start texture generation in status: ${pipeline.status}`
      );
    }

    // Clear error state when retrying
    if (canRetryTexture) {
      await pipelineRef.update({
        error: admin.firestore.FieldValue.delete(),
        errorStep: admin.firestore.FieldValue.delete(),
      });
    }

    if (!pipeline.meshyMeshTaskId) {
      throw new functions.https.HttpsError(
        'failed-precondition',
        'Mesh generation must complete before texturing'
      );
    }

    // Verify we have mesh reference images for style reference
    if (!pipeline.meshImages.front) {
      throw new functions.https.HttpsError(
        'failed-precondition',
        'Missing front mesh reference image'
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
      // Use front mesh image as style reference
      const styleImageUrl = pipeline.meshImages.front.url;

      // Build texture prompt from image analysis (if available)
      // This enhances Meshy's texture generation with material context
      let textStylePrompt: string | undefined;
      if (pipeline.imageAnalysis) {
        const materials = pipeline.imageAnalysis.detectedMaterials.join(', ');
        textStylePrompt = pipeline.userDescription
          ? `${pipeline.userDescription}. Materials: ${materials}`
          : `Materials: ${materials}`;
      }

      // Create retexture task
      const retextureClient = createMeshyRetextureClient();
      const taskId = await retextureClient.createFromMeshTask(
        pipeline.meshyMeshTaskId,
        {
          imageStyleUrl: styleImageUrl,
          textStylePrompt, // Enhanced with image analysis
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

      // Refund credits on failure
      try {
        await refundCredits(userId, PIPELINE_CREDITS.TEXTURE, pipelineId);
        functions.logger.info('Refunded texture credits after failure', { pipelineId, userId, amount: PIPELINE_CREDITS.TEXTURE });
      } catch (refundError) {
        functions.logger.error('Failed to refund texture credits', { pipelineId, userId, refundError });
      }

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

// ============================================
// Update Pipeline Analysis
// ============================================

interface UpdatePipelineAnalysisData {
  pipelineId: string;
  imageAnalysis: import('../rodin/types').ImageAnalysisResult;
  userDescription?: string;
}

/**
 * Update pipeline analysis results
 *
 * Allows users to update the image analysis and description
 * for a draft pipeline before starting generation.
 * Only works for pipelines in 'draft' status.
 */
export const updatePipelineAnalysis = functions
  .region('asia-east1')
  .runWith({ timeoutSeconds: 30 })
  .https.onCall(async (data: UpdatePipelineAnalysisData, context) => {
    if (!context.auth) {
      throw new functions.https.HttpsError(
        'unauthenticated',
        'You must be logged in to update a pipeline'
      );
    }

    const userId = context.auth.uid;
    const { pipelineId, imageAnalysis, userDescription } = data;

    if (!pipelineId) {
      throw new functions.https.HttpsError(
        'invalid-argument',
        'Pipeline ID is required'
      );
    }

    if (!imageAnalysis) {
      throw new functions.https.HttpsError(
        'invalid-argument',
        'Image analysis data is required'
      );
    }

    const pipelineRef = db.collection('pipelines').doc(pipelineId);
    const pipelineSnap = await pipelineRef.get();

    if (!pipelineSnap.exists) {
      throw new functions.https.HttpsError(
        'not-found',
        'Pipeline not found'
      );
    }

    const pipeline = pipelineSnap.data() as PipelineDocument;

    // Verify ownership
    if (pipeline.userId !== userId) {
      throw new functions.https.HttpsError(
        'permission-denied',
        'You do not have permission to update this pipeline'
      );
    }

    // Only allow updates for draft pipelines
    if (pipeline.status !== 'draft') {
      throw new functions.https.HttpsError(
        'failed-precondition',
        `Cannot update analysis for pipeline in '${pipeline.status}' status. Only draft pipelines can be updated.`
      );
    }

    // Update the pipeline with new analysis
    const updateData: Record<string, unknown> = {
      imageAnalysis,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    };

    // Also update userDescription if provided
    if (userDescription !== undefined) {
      updateData.userDescription = userDescription || null;
    }

    await pipelineRef.update(updateData);

    functions.logger.info('Pipeline analysis updated', {
      pipelineId,
      userId,
      colorCount: imageAnalysis.colorPalette?.length,
      hasDescription: !!userDescription,
    });

    return {
      success: true,
      pipelineId,
    };
  });

/**
 * Target steps for reset operation
 */
type ResetTargetStep = 'draft' | 'images-ready' | 'mesh-ready';

/**
 * Reset pipeline to a previous step
 * Allows users to go back and retry with different settings
 */
interface ResetPipelineStepData {
  pipelineId: string;
  targetStep: ResetTargetStep;
  keepResults: boolean;  // If true, keep generated results; if false, clear them
}

export const resetPipelineStep = functions
  .region('asia-east1')
  .runWith({
    timeoutSeconds: 30,
    memory: '256MB',
  })
  .https.onCall(async (data: ResetPipelineStepData, context) => {
    if (!context.auth) {
      throw new functions.https.HttpsError('unauthenticated', 'Authentication required');
    }

    const userId = context.auth.uid;
    const { pipelineId, targetStep, keepResults } = data;

    if (!pipelineId) {
      throw new functions.https.HttpsError('invalid-argument', 'Pipeline ID is required');
    }

    const validTargetSteps: ResetTargetStep[] = ['draft', 'images-ready', 'mesh-ready'];
    if (!validTargetSteps.includes(targetStep)) {
      throw new functions.https.HttpsError(
        'invalid-argument',
        `Invalid target step: ${targetStep}. Must be one of: ${validTargetSteps.join(', ')}`
      );
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

    // Cannot reset if pipeline is currently generating
    const generatingStatuses: PipelineStatus[] = [
      'generating-images',
      'batch-queued',
      'batch-processing',
      'generating-mesh',
      'generating-texture',
    ];

    if (generatingStatuses.includes(pipeline.status)) {
      throw new functions.https.HttpsError(
        'failed-precondition',
        `Cannot reset pipeline while in ${pipeline.status} status`
      );
    }

    // Prepare update data
    const updateData: Record<string, any> = {
      status: targetStep,
      error: admin.firestore.FieldValue.delete(),
      errorStep: admin.firestore.FieldValue.delete(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    };

    // Clear fields based on target step and keepResults flag
    if (!keepResults) {
      switch (targetStep) {
        case 'draft':
          // Clear all generated content
          updateData.meshImages = {};
          updateData.aggregatedColorPalette = admin.firestore.FieldValue.delete();
          updateData.generationProgress = admin.firestore.FieldValue.delete();
          /* falls through */
        case 'images-ready':
          // Clear mesh generation results
          updateData.providerTaskId = admin.firestore.FieldValue.delete();
          updateData.meshyMeshTaskId = admin.firestore.FieldValue.delete();
          updateData.meshUrl = admin.firestore.FieldValue.delete();
          updateData.meshStoragePath = admin.firestore.FieldValue.delete();
          updateData.meshDownloadFiles = admin.firestore.FieldValue.delete();
          // Reset mesh credits (generation hasn't happened in reset state)
          updateData['creditsCharged.mesh'] = 0;
          /* falls through */
        case 'mesh-ready':
          // Clear texture generation results
          updateData.meshyTextureTaskId = admin.firestore.FieldValue.delete();
          updateData.texturedModelUrl = admin.firestore.FieldValue.delete();
          updateData.texturedModelStoragePath = admin.firestore.FieldValue.delete();
          updateData.texturedDownloadFiles = admin.firestore.FieldValue.delete();
          // Reset texture credits
          updateData['creditsCharged.texture'] = 0;
          updateData.completedAt = admin.firestore.FieldValue.delete();
          break;
      }
    } else {
      // keepResults = true: Only clear error state
      // For mesh-ready, we might need to ensure mesh data is preserved
      // For images-ready, we need to ensure image data is preserved
      // The status change is the main action here
    }

    await pipelineRef.update(updateData);

    functions.logger.info('Pipeline reset to step', {
      pipelineId,
      targetStep,
      keepResults,
      userId,
      previousStatus: pipeline.status,
    });

    return {
      success: true,
      pipelineId,
      newStatus: targetStep,
    };
  });
