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
import { createMultiViewGenerator, type GeminiImageModel } from '../gemini/multi-view-generator';
import { generateCompositeView } from '../gemini/composite-view-generator';
import { generateStyledReference } from '../gemini/styled-reference-generator';
import { assertSupportedReferenceAngle, resolveGenerationColors } from '../gemini/generation-options';
import { MeshyProvider, type MeshGenerationOptions } from '../providers/meshy/client';
import { TripoProvider } from '../providers/tripo/client';
import { HunyuanProvider } from '../providers/hunyuan/client';
import { createMeshyRetextureClient } from '../providers/meshy/retexture';
import { ProviderFactory, isValidProvider } from '../providers/factory';
import { incrementGenerationCount } from '../utils/credits';
import {
  assertUserStorageReference,
  assertUserStorageReferences,
  downloadValidatedImageAsBase64,
} from '../utils/storage-validation';
import { getSignedUrlForReference, uploadBase64, uploadBuffer } from '../storage';
import type {
  PipelineDocument,
  PipelineSettings,
  PipelineProcessedImage,
  PipelineMeshAngle,
  PipelineStatus,
  GenerationModeId,
  ProviderType,
  ProviderOptions,
  ProcessingMode,
  ViewAngle,
} from '../rodin/types';
import { DEFAULT_MODE } from '../gemini/mode-configs';
import {
  canAccessProvider,
  canAccessHiTem3DResolution,
  canAccessViewModel,
  getTierValidationError,
  type HiTem3DResolution,
  type ViewGenerationModel,
} from '../config/tiers';
import type { UserTier } from '../rodin/types';
import { isValidStyleId, type StyleId } from '../config/styles';

const db = admin.firestore();

// Product credits, not supplier API credits or actual generation costs.
// Version/parameter-specific API prices: docs/research/2026-09-05-3d-model-comparison.md
const PROVIDER_CREDIT_COSTS: Record<ProviderType, number> = {
  meshy: 5,
  hunyuan: 6,
  rodin: 8,
  tripo: 5,
  hitem3d: 6,
};

const PIPELINE_CREDITS = {
  MESH: 5,      // Default (overridden by provider)
  TEXTURE: 10,  // Meshy Retexture only
} as const;

// Credit cost for Gemini view generation
// Supports both short names (backend) and full names (frontend)
const GEMINI_MODEL_CREDITS: Record<string, number> = {
  'gemini-2.5-flash': 3,
  'gemini-2.5-flash-image': 3,        // Full ID from frontend
  'gemini-3-pro-image-preview': 5,    // Premium model
};

// ============================================
// Request/Response Types
// ============================================

interface CreatePipelineData {
  imageUrls: string[];  // URLs of uploaded images in Firebase Storage
  settings?: Partial<PipelineSettings>;
  generationMode?: GenerationModeId;  // A/B testing mode
  processingMode?: ProcessingMode;
  userDescription?: string;  // Optional description of the object for better AI generation
  imageAnalysis?: import('../rodin/types').ImageAnalysisResult;  // Pre-analysis results from Gemini
  geminiModel?: 'gemini-2.5-flash-image' | 'gemini-3-pro-image-preview';  // Gemini model for image generation
  selectedStyle?: StyleId;  // Legacy top-level field; current clients use settings.selectedStyle
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

type PipelineFinalizationStep = 'mesh' | 'texture';

const PIPELINE_ID_PATTERN = /^[A-Za-z0-9_-]{1,128}$/;
const FINALIZATION_LEASE_MS = 3 * 60 * 1000;
const REGENERATION_LEASE_MS = 3 * 60 * 1000;
type PipelineWithRegeneration = PipelineDocument & {
  regenerationClaim?: { token: string; expiresAt: FirebaseFirestore.Timestamp };
};

function assertNoActiveRegeneration(pipeline: PipelineWithRegeneration): void {
  if (pipeline.regenerationClaim && pipeline.regenerationClaim.expiresAt.toMillis() > Date.now()) {
    throw new functions.https.HttpsError('failed-precondition', 'Wait for the current view correction to finish');
  }
}

function getPipelineColors(pipeline: PipelineDocument) {
  return resolveGenerationColors({
    colorCount: pipeline.settings?.colorCount,
    colorPalette: pipeline.imageAnalysis?.colorPalette,
  });
}

function validateImageGenerationInput(pipeline: PipelineDocument): void {
  getPipelineColors(pipeline);
  const referenceAngle = pipeline.imageAnalysis?.detectedViewAngle;
  if (referenceAngle && pipeline.settings?.selectedStyle) {
    assertSupportedReferenceAngle(referenceAngle);
  }
}


// ============================================
// Helper Functions
// ============================================

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

function normalizeGeminiViewModel(model?: string): ViewGenerationModel {
  if (!model || model === 'gemini-2.5-flash') {
    return 'gemini-2.5-flash-image';
  }

  if (model === 'gemini-2.5-flash-image' || model === 'gemini-3-pro-image-preview') {
    return model;
  }

  throw new functions.https.HttpsError(
    'invalid-argument',
    'Invalid Gemini image model'
  );
}

function validatePipelineId(pipelineId: unknown): asserts pipelineId is string {
  if (typeof pipelineId !== 'string' || !PIPELINE_ID_PATTERN.test(pipelineId)) {
    throw new functions.https.HttpsError('invalid-argument', 'Invalid pipeline ID');
  }
}

function requireVerifiedEmail(context: functions.https.CallableContext): void {
  if (context.auth?.token.email_verified !== true) {
    throw new functions.https.HttpsError(
      'failed-precondition',
      'Verify your email before using the generation pipeline'
    );
  }
}

function normalizeProviderOptions(providerType: ProviderType, value: unknown): ProviderOptions {
  if (value === undefined) {
    return providerType === 'hitem3d' ? { resolution: 512 } : {};
  }

  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new functions.https.HttpsError('invalid-argument', 'Invalid provider options');
  }

  const raw = value as Record<string, unknown>;
  const allowedKeys = new Set(['faceCount', 'tripoMode', 'resolution']);
  if (Object.keys(raw).some((key) => !allowedKeys.has(key))) {
    throw new functions.https.HttpsError('invalid-argument', 'Invalid provider options');
  }

  if (raw.faceCount !== undefined && (
    typeof raw.faceCount !== 'number'
    || !Number.isInteger(raw.faceCount)
    || raw.faceCount < 40_000
    || raw.faceCount > 1_500_000
  )) {
    throw new functions.https.HttpsError('invalid-argument', 'Invalid Hunyuan face count');
  }

  if (raw.tripoMode !== undefined
    && raw.tripoMode !== 'image_to_model'
    && raw.tripoMode !== 'multiview_to_model') {
    throw new functions.https.HttpsError('invalid-argument', 'Invalid Tripo generation mode');
  }

  if (raw.resolution !== undefined && raw.resolution !== 512 && raw.resolution !== 1024) {
    throw new functions.https.HttpsError('invalid-argument', 'Invalid HiTem3D resolution');
  }

  switch (providerType) {
    case 'hitem3d':
      return { resolution: (raw.resolution as HiTem3DResolution | undefined) ?? 512 };
    case 'hunyuan':
      return raw.faceCount === undefined ? {} : { faceCount: raw.faceCount as number };
    case 'tripo':
      return raw.tripoMode === undefined
        ? {}
        : { tripoMode: raw.tripoMode as ProviderOptions['tripoMode'] };
    default:
      return {};
  }
}

async function getUserAccess(userId: string): Promise<{ userTier: UserTier; isAdmin: boolean }> {
  const userDoc = await db.collection('users').doc(userId).get();
  const userData = userDoc.data();

  return {
    userTier: (userData?.tier as UserTier) || 'free',
    isAdmin: userData?.role === 'admin',
  };
}

async function claimPipelineStepAndDeductCredits(params: {
  pipelineRef: FirebaseFirestore.DocumentReference;
  userId: string;
  pipelineId: string;
  credits: number;
  updateData: Record<string, unknown>;
  validatePipeline: (pipeline: PipelineDocument) => void;
}): Promise<PipelineDocument> {
  const { pipelineRef, userId, pipelineId, credits, updateData, validatePipeline } = params;
  const userRef = db.collection('users').doc(userId);
  let claimedPipeline: PipelineDocument | null = null;

  await db.runTransaction(async (transaction) => {
    const pipelineDoc = await transaction.get(pipelineRef);
    const userDoc = await transaction.get(userRef);

    if (!pipelineDoc.exists) {
      throw new functions.https.HttpsError('not-found', 'Pipeline not found');
    }

    if (!userDoc.exists) {
      throw new functions.https.HttpsError('not-found', 'User not found');
    }

    const pipeline = pipelineDoc.data() as PipelineDocument;
    if (pipeline.userId !== userId) {
      throw new functions.https.HttpsError('permission-denied', 'Not your pipeline');
    }

    assertNoActiveRegeneration(pipeline);
    validatePipeline(pipeline);

    const currentCredits = userDoc.data()?.credits || 0;
    if (currentCredits < credits) {
      throw new functions.https.HttpsError('resource-exhausted', 'Insufficient credits');
    }

    transaction.update(userRef, {
      credits: admin.firestore.FieldValue.increment(-credits),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    transaction.set(db.collection('transactions').doc(), {
      userId,
      type: 'consume',
      amount: -credits,
      jobId: pipelineId,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    transaction.update(pipelineRef, updateData);
    claimedPipeline = pipeline;
  });

  return claimedPipeline!;
}

type RefundablePipelineStep = 'generating-images' | 'generating-mesh' | 'generating-texture';

async function failPipelineStepAndRefund(params: {
  pipelineRef: FirebaseFirestore.DocumentReference;
  userId: string;
  pipelineId: string;
  expectedStatus: RefundablePipelineStep;
  credits: number;
  error: string;
}): Promise<boolean> {
  const {
    pipelineRef,
    userId,
    pipelineId,
    expectedStatus,
    credits,
    error,
  } = params;
  const userRef = db.collection('users').doc(userId);
  const transactionRef = db.collection('transactions').doc();
  const chargedField = expectedStatus === 'generating-images'
    ? 'views'
    : expectedStatus === 'generating-mesh' ? 'mesh' : 'texture';

  return db.runTransaction(async (transaction): Promise<boolean> => {
    const pipelineDoc = await transaction.get(pipelineRef);
    const userDoc = await transaction.get(userRef);

    if (!pipelineDoc.exists) {
      throw new functions.https.HttpsError('not-found', 'Pipeline not found');
    }

    const pipeline = pipelineDoc.data() as PipelineDocument;
    if (pipeline.userId !== userId) {
      throw new functions.https.HttpsError('permission-denied', 'Not your pipeline');
    }
    if (pipeline.status !== expectedStatus) {
      return false;
    }
    if (!userDoc.exists) {
      throw new functions.https.HttpsError('not-found', 'User not found');
    }

    transaction.update(userRef, {
      credits: admin.firestore.FieldValue.increment(credits),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    transaction.set(transactionRef, {
      userId,
      type: 'bonus',
      amount: credits,
      jobId: pipelineId,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    transaction.update(pipelineRef, {
      status: 'failed',
      error,
      errorStep: expectedStatus,
      [`creditsCharged.${chargedField}`]: 0,
      finalizationClaim: admin.firestore.FieldValue.delete(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    return true;
  });
}

async function claimPipelineFinalization(params: {
  pipelineRef: FirebaseFirestore.DocumentReference;
  userId: string;
  expectedStatus: 'generating-mesh' | 'generating-texture';
  step: PipelineFinalizationStep;
}): Promise<string | null> {
  const { pipelineRef, userId, expectedStatus, step } = params;
  const token = db.collection('_claimTokens').doc().id;
  const now = Date.now();

  return db.runTransaction(async (transaction): Promise<string | null> => {
    const pipelineDoc = await transaction.get(pipelineRef);
    if (!pipelineDoc.exists) {
      throw new functions.https.HttpsError('not-found', 'Pipeline not found');
    }

    const pipeline = pipelineDoc.data() as PipelineDocument;
    if (pipeline.userId !== userId) {
      throw new functions.https.HttpsError('permission-denied', 'Not your pipeline');
    }
    if (pipeline.status !== expectedStatus) {
      return null;
    }

    const activeClaim = pipeline.finalizationClaim;
    const activeClaimStartedAt = activeClaim?.startedAt?.toMillis?.() ?? 0;
    if (activeClaim && now - activeClaimStartedAt < FINALIZATION_LEASE_MS) {
      return null;
    }

    transaction.update(pipelineRef, {
      finalizationClaim: {
        token,
        step,
        startedAt: admin.firestore.Timestamp.fromMillis(now),
      },
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    return token;
  });
}

async function completePipelineFinalization(params: {
  pipelineRef: FirebaseFirestore.DocumentReference;
  token: string;
  updateData: Record<string, unknown>;
}): Promise<void> {
  const { pipelineRef, token, updateData } = params;

  await db.runTransaction(async (transaction) => {
    const pipelineDoc = await transaction.get(pipelineRef);
    const pipeline = pipelineDoc.data() as PipelineDocument | undefined;
    if (!pipelineDoc.exists || pipeline?.finalizationClaim?.token !== token) {
      throw new functions.https.HttpsError('aborted', 'Pipeline finalization lease expired');
    }

    transaction.update(pipelineRef, {
      ...updateData,
      finalizationClaim: admin.firestore.FieldValue.delete(),
    });
  });
}

async function releasePipelineFinalization(
  pipelineRef: FirebaseFirestore.DocumentReference,
  token: string
): Promise<void> {
  await db.runTransaction(async (transaction) => {
    const pipelineDoc = await transaction.get(pipelineRef);
    const pipeline = pipelineDoc.data() as PipelineDocument | undefined;
    if (pipelineDoc.exists && pipeline?.finalizationClaim?.token === token) {
      transaction.update(pipelineRef, {
        finalizationClaim: admin.firestore.FieldValue.delete(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    }
  });
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
    requireVerifiedEmail(context);

    const userId = context.auth.uid;
    const {
      imageUrls,
      settings,
      generationMode,
      processingMode = 'realtime',
      userDescription,
      imageAnalysis,
      geminiModel,
      selectedStyle: legacySelectedStyle,
    } = data;

    if (!imageUrls || imageUrls.length === 0) {
      throw new functions.https.HttpsError(
        'invalid-argument',
        'At least one image URL is required'
      );
    }

    const validatedImages = assertUserStorageReferences(imageUrls, userId, ['uploads'], 1);
    const selectedGeminiModel = normalizeGeminiViewModel(geminiModel);
    const requestedStyle = legacySelectedStyle ?? settings?.selectedStyle;

    if (requestedStyle !== undefined && !isValidStyleId(requestedStyle)) {
      throw new functions.https.HttpsError('invalid-argument', 'Invalid figure style');
    }

    if (processingMode !== 'realtime') {
      throw new functions.https.HttpsError(
        'failed-precondition',
        'Batch processing is temporarily disabled'
      );
    }

    const selectedStyle = requestedStyle as StyleId | undefined;
    const { userTier, isAdmin } = await getUserAccess(userId);

    if (!canAccessViewModel(userTier, selectedGeminiModel, isAdmin)) {
      throw new functions.https.HttpsError(
        'permission-denied',
        getTierValidationError('viewModel', selectedGeminiModel)
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
      processingMode,
      generationMode: modeId,
      inputImages: validatedImages.map((image) => ({
        url: image.url,
        storagePath: image.storagePath,
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
        geminiModel: selectedGeminiModel,  // Default to fast model
        ...(settings?.meshPrecision !== undefined && { meshPrecision: settings.meshPrecision }),
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
      imageCount: validatedImages.length,
      generationMode: modeId,
      hasUserDescription: !!userDescription,
      hasImageAnalysis: !!imageAnalysis,
      analysisColorCount: imageAnalysis?.colorPalette?.length,
      geminiModel: selectedGeminiModel,
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
    requireVerifiedEmail(context);

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
    requireVerifiedEmail(context);

    const userId = context.auth.uid;
    const requestedLimit = data?.limit ?? 20;
    if (!Number.isInteger(requestedLimit) || requestedLimit < 1 || requestedLimit > 50) {
      throw new functions.https.HttpsError(
        'invalid-argument',
        'limit must be an integer between 1 and 50'
      );
    }
    const limit = requestedLimit;

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
    requireVerifiedEmail(context);

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

    validateImageGenerationInput(pipeline);

    // Get Gemini model and calculate credits
    const geminiViewModel = normalizeGeminiViewModel(pipeline.settings?.geminiModel);
    const geminiModel = geminiViewModel as GeminiImageModel;
    const viewCredits = GEMINI_MODEL_CREDITS[geminiModel];

    if (!viewCredits) {
      throw new functions.https.HttpsError(
        'invalid-argument',
        'Invalid Gemini image model'
      );
    }

    const { userTier, isAdmin } = await getUserAccess(userId);
    if (!canAccessViewModel(userTier, geminiViewModel, isAdmin)) {
      throw new functions.https.HttpsError(
        'permission-denied',
        getTierValidationError('viewModel', geminiViewModel)
      );
    }

    const claimedPipeline = await claimPipelineStepAndDeductCredits({
      pipelineRef,
      userId,
      pipelineId,
      credits: viewCredits,
      updateData: {
        status: 'generating-images',
        'creditsCharged.views': viewCredits,
        error: admin.firestore.FieldValue.delete(),
        errorStep: admin.firestore.FieldValue.delete(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      },
      validatePipeline: (currentPipeline) => {
        validateImageGenerationInput(currentPipeline);
        const retryingImages = currentPipeline.status === 'failed' && currentPipeline.errorStep === 'generating-images';
        if (
          currentPipeline.status !== 'draft' &&
          currentPipeline.status !== 'images-ready' &&
          !retryingImages
        ) {
          throw new functions.https.HttpsError(
            'failed-precondition',
            `Cannot generate images in status: ${currentPipeline.status}`
          );
        }
      },
    });

    const generationId = db.collection('_claimTokens').doc().id;
    try {
      const colors = getPipelineColors(claimedPipeline);
      // Download reference image (use first uploaded image)
      const referenceImageUrl = claimedPipeline.inputImages[0].url;
      const { base64, mimeType } = await downloadValidatedImageAsBase64(
        referenceImageUrl,
        userId,
        ['uploads']
      );

      const modeId = claimedPipeline.generationMode || DEFAULT_MODE;
      const selectedStyle = claimedPipeline.settings?.selectedStyle;
      const generator = createMultiViewGenerator(modeId, claimedPipeline.userDescription, claimedPipeline.imageAnalysis, geminiModel, selectedStyle, colors);

      // Determine if we should use two-phase flow for style consistency
      // Two-phase is used when: image analysis detected a view angle AND a style is selected
      const detectedViewAngle = claimedPipeline.imageAnalysis?.detectedViewAngle as ViewAngle | undefined;
      const useTwoPhaseFlow = detectedViewAngle && selectedStyle;

      const now = admin.firestore.FieldValue.serverTimestamp();
      const meshImages: Partial<Record<PipelineMeshAngle, PipelineProcessedImage>> = {};
      let styledReferenceAngle: ViewAngle | undefined;
      let aggregatedColorPalette: { unified: string[]; dominantColors: string[] } | undefined;

      if (useTwoPhaseFlow) {
        // =====================================================
        // TWO-PHASE FLOW: Styled Reference → Remaining Views
        // Ensures all 4 views have consistent styling
        // =====================================================

        functions.logger.info('Using two-phase flow for style consistency', {
          pipelineId,
          detectedViewAngle,
          selectedStyle,
        });

        // Phase 1: Generate styled reference at detected angle
        await pipelineRef.update({
          generationProgress: {
            phase: 'styled-reference' as const,
            meshViewsCompleted: 0,
          },
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });

        const styledRef = await generateStyledReference(base64, mimeType, {
          detectedAngle: detectedViewAngle,
          style: selectedStyle,
          geminiModel,
          ...colors,
          imageAnalysis: claimedPipeline.imageAnalysis,
          userDescription: claimedPipeline.userDescription,
        });

        styledReferenceAngle = styledRef.sourceAngle;

        // Upload styled reference as one of the mesh images
        const refAngle = styledRef.sourceAngle as PipelineMeshAngle;
        const refExt = getExtensionFromMimeType(styledRef.mimeType);
        const refPath = `pipelines/${userId}/${pipelineId}/views/${generationId}/mesh_${refAngle}.${refExt}`;
        const refUrl = await uploadImageToStorage(styledRef.imageBase64, styledRef.mimeType, refPath);

        meshImages[refAngle] = {
          url: refUrl,
          storagePath: refPath,
          source: 'gemini-styled-reference',
          generatedAt: now as unknown as FirebaseFirestore.Timestamp,
          colorPalette: styledRef.colorPalette,
        };

        // Update progress: 1 of 4 complete
        await pipelineRef.update({
          generationProgress: {
            phase: 'mesh-views' as const,
            meshViewsCompleted: 1,
          },
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });

        // Phase 2: Generate remaining 3 views from styled reference
        const onProgress = async (
          _type: 'mesh' | 'texture',
          _angle: string,
          completed: number,
          _total: number
        ) => {
          await pipelineRef.update({
            generationProgress: {
              phase: 'mesh-views' as const,
              meshViewsCompleted: 1 + completed, // +1 for styled reference
            },
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          });
        };

        const remainingViews = await generator.generateViewsFromStyledReference(
          styledRef.imageBase64,
          styledRef.mimeType,
          styledRef.sourceAngle,
          styledRef.colorPalette,
          onProgress
        );

        // Upload remaining views
        for (const [angle, view] of Object.entries(remainingViews)) {
          const ext = getExtensionFromMimeType(view.mimeType);
          const storagePath = `pipelines/${userId}/${pipelineId}/views/${generationId}/mesh_${angle}.${ext}`;
          const url = await uploadImageToStorage(view.imageBase64, view.mimeType, storagePath);

          const meshImage: PipelineProcessedImage = {
            url,
            storagePath,
            source: 'gemini-from-reference',
            generatedAt: now as unknown as FirebaseFirestore.Timestamp,
          };
          if (view.colorPalette && view.colorPalette.length > 0) {
            meshImage.colorPalette = view.colorPalette;
          }
          meshImages[angle as PipelineMeshAngle] = meshImage;
        }

        // Build aggregated color palette from styled reference (primary source)
        aggregatedColorPalette = {
          unified: styledRef.colorPalette,
          dominantColors: styledRef.colorPalette.slice(0, colors.colorCount),
        };

        functions.logger.info('Two-phase generation complete', {
          pipelineId,
          styledReferenceAngle,
          viewCount: Object.keys(meshImages).length,
          colorPaletteCount: styledRef.colorPalette.length,
        });

      } else {
        // =====================================================
        // SINGLE-PHASE FLOW: Composite View Generation
        // Generate all 4 views in a single 2×2 grid image
        // =====================================================

        functions.logger.info('Using composite view generation (single API call)', {
          pipelineId,
          selectedStyle: selectedStyle || 'none',
        });

        // Update progress: starting
        await pipelineRef.update({
          generationProgress: {
            phase: 'composite-generation' as const,
            meshViewsCompleted: 0,
          },
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });

        // Generate composite view (single API call)
        const compositeResult = await generateCompositeView(base64, mimeType, {
          userDescription: claimedPipeline.userDescription,
          imageAnalysis: claimedPipeline.imageAnalysis,
          selectedStyle,
          geminiModel,
          ...colors,
        });

        // Update progress: composite done, uploading
        await pipelineRef.update({
          generationProgress: {
            phase: 'uploading' as const,
            meshViewsCompleted: 4,
          },
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });

        // Upload all 4 views
        const viewEntries: [PipelineMeshAngle, { imageBase64: string; mimeType: string }][] = [
          ['front', compositeResult.front],
          ['back', compositeResult.back],
          ['left', compositeResult.left],
          ['right', compositeResult.right],
        ];

        for (const [angle, view] of viewEntries) {
          const ext = getExtensionFromMimeType(view.mimeType);
          const storagePath = `pipelines/${userId}/${pipelineId}/views/${generationId}/mesh_${angle}.${ext}`;
          const url = await uploadImageToStorage(view.imageBase64, view.mimeType, storagePath);

          meshImages[angle] = {
            url,
            storagePath,
            source: 'gemini-composite',
            generatedAt: now as unknown as FirebaseFirestore.Timestamp,
          };
        }

        aggregatedColorPalette = colors.colorPalette.length
          ? { unified: colors.colorPalette, dominantColors: colors.colorPalette }
          : undefined;

        functions.logger.info('Composite view generation complete', {
          pipelineId,
          viewCount: Object.keys(meshImages).length,
        });
      }

      // Update pipeline with generated images and color palette
      await pipelineRef.update({
        status: 'images-ready',
        meshImages,
        aggregatedColorPalette: aggregatedColorPalette || admin.firestore.FieldValue.delete(),
        styledReferenceAngle: styledReferenceAngle || admin.firestore.FieldValue.delete(),
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
        usedTwoPhaseFlow: !!useTwoPhaseFlow,
        styledReferenceAngle: styledReferenceAngle || 'none',
      });

      return {
        status: 'images-ready',
        meshImages,
        aggregatedColorPalette,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      try {
        const refunded = await failPipelineStepAndRefund({
          pipelineRef,
          userId,
          pipelineId,
          expectedStatus: 'generating-images',
          credits: viewCredits,
          error: errorMessage,
        });
        if (refunded) {
          functions.logger.info('Refunded credits after view generation failure', {
            pipelineId,
            credits: viewCredits,
          });
        }
      } catch (refundError) {
        functions.logger.error('Failed to refund credits', { pipelineId, refundError });
      }

      functions.logger.error('Pipeline image generation failed', { pipelineId, error: errorMessage });

      throw new functions.https.HttpsError('internal', `Image generation failed: ${errorMessage}`);
    }
  });

/**
 * Regenerate a single view
 *
 * Allows user to regenerate individual views without regenerating the other views.
 */
export const regeneratePipelineImage = functions
  .region('asia-east1')
  .runWith({ timeoutSeconds: 120, memory: '512MB', secrets: ['GEMINI_API_KEY'] })
  .https.onCall(async (data: RegeneratePipelineImageData, context) => {
    if (!context.auth) {
      throw new functions.https.HttpsError('unauthenticated', 'Authentication required');
    }
    requireVerifiedEmail(context);
    const userId = context.auth.uid;
    const { pipelineId, viewType, angle, hint } = data;
    validatePipelineId(pipelineId);
    if (viewType !== 'mesh' || !['front', 'back', 'left', 'right'].includes(angle)) {
      throw new functions.https.HttpsError('invalid-argument', 'Invalid mesh view');
    }
    if (hint !== undefined && (typeof hint !== 'string' || hint.length > 100)) {
      throw new functions.https.HttpsError('invalid-argument', 'Regeneration hint must be a string of at most 100 characters');
    }
    const normalizedHint = hint?.trim() || undefined;
    const meshAngle = angle as PipelineMeshAngle;
    const pipelineRef = db.collection('pipelines').doc(pipelineId);
    const token = db.collection('_claimTokens').doc().id;

    // Reserve one correction at a time. The quota counts completed corrections;
    // failures release the reservation, and a timed-out lease can be reclaimed.
    const pipeline = await db.runTransaction(async (transaction) => {
      const snapshot = await transaction.get(pipelineRef);
      if (!snapshot.exists) throw new functions.https.HttpsError('not-found', 'Pipeline not found');
      const current = snapshot.data() as PipelineWithRegeneration;
      if (current.userId !== userId) throw new functions.https.HttpsError('permission-denied', 'Not your pipeline');
      if (current.status !== 'images-ready') {
        throw new functions.https.HttpsError('failed-precondition', 'Can only correct views when images are ready');
      }
      assertNoActiveRegeneration(current);
      validateImageGenerationInput(current);
      if ((current.regenerationsUsed || 0) >= MAX_REGENERATIONS) {
        throw new functions.https.HttpsError('resource-exhausted', `已達重新生成上限 (${MAX_REGENERATIONS} 次)`);
      }
      transaction.update(pipelineRef, {
        regenerationClaim: { token, expiresAt: admin.firestore.Timestamp.fromMillis(Date.now() + REGENERATION_LEASE_MS) },
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
      return current;
    });

    try {
      const colors = getPipelineColors(pipeline);
      const generator = createMultiViewGenerator(
        pipeline.generationMode || DEFAULT_MODE,
        pipeline.userDescription,
        pipeline.imageAnalysis,
        normalizeGeminiViewModel(pipeline.settings?.geminiModel) as GeminiImageModel,
        pipeline.settings?.selectedStyle,
        colors
      );
      const referenceAngle = (pipeline as PipelineDocument & { styledReferenceAngle?: ViewAngle }).styledReferenceAngle;
      if (referenceAngle) assertSupportedReferenceAngle(referenceAngle);
      const reference = referenceAngle ? pipeline.meshImages[referenceAngle] : undefined;
      if (referenceAngle && !reference) {
        throw new functions.https.HttpsError('failed-precondition', 'Reference view is missing. Generate the view set again.');
      }
      const { base64, mimeType } = await downloadValidatedImageAsBase64(
        reference?.url || pipeline.inputImages[0].url,
        userId,
        reference ? ['pipelines'] : ['uploads']
      );
      // The reference angle is also corrected in place from its accepted image.
      // A single-view action never regenerates or replaces the other three views.
      const view = referenceAngle
        ? await generator.generateSingleViewFromReference(base64, mimeType, referenceAngle, meshAngle, colors.colorPalette.length ? colors.colorPalette : reference?.colorPalette || [], normalizedHint)
        : await generator.generateMeshView(base64, mimeType, meshAngle, normalizedHint);
      const storagePath = `pipelines/${userId}/${pipelineId}/views/${token}/mesh_${angle}.${getExtensionFromMimeType(view.mimeType)}`;
      const url = await uploadImageToStorage(view.imageBase64, view.mimeType, storagePath);
      const image: PipelineProcessedImage = {
        url,
        storagePath,
        source: referenceAngle ? 'gemini-from-reference' : 'gemini',
        generatedAt: admin.firestore.Timestamp.now(),
        ...(view.colorPalette?.length && { colorPalette: view.colorPalette }),
      };
      await db.runTransaction(async (transaction) => {
        const snapshot = await transaction.get(pipelineRef);
        const current = snapshot.data() as PipelineWithRegeneration | undefined;
        if (!current || current.regenerationClaim?.token !== token || current.status !== 'images-ready') {
          throw new functions.https.HttpsError('aborted', 'The view set changed. Your previous views have been preserved.');
        }
        const meshImages = { ...current.meshImages, [angle]: image };
        const palette = colors.colorPalette.length ? colors.colorPalette : [...new Set(
          Object.values(meshImages).flatMap((meshImage) => meshImage?.colorPalette || [])
        )];
        transaction.update(pipelineRef, {
          [`meshImages.${angle}`]: image,
          aggregatedColorPalette: { unified: palette, dominantColors: palette.slice(0, colors.colorCount) },
          regenerationsUsed: (current.regenerationsUsed || 0) + 1,
          regenerationClaim: admin.firestore.FieldValue.delete(),
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
      });
      return { viewType, angle, image, regeneratedAllViews: false };
    } catch (error) {
      await db.runTransaction(async (transaction) => {
        const snapshot = await transaction.get(pipelineRef);
        const current = snapshot.data() as PipelineWithRegeneration | undefined;
        if (current?.regenerationClaim?.token === token) {
          transaction.update(pipelineRef, {
            regenerationClaim: admin.firestore.FieldValue.delete(),
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          });
        }
      });
      functions.logger.error('Pipeline view correction failed', { pipelineId, angle, error: error instanceof Error ? error.message : 'Unknown error' });
      if (error instanceof functions.https.HttpsError) throw error;
      throw new functions.https.HttpsError('internal', 'View correction failed. Your previous views and correction allowance have been preserved.');
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
  })
  .https.onCall(async (data: StartPipelineMeshData, context) => {
    if (!context.auth) {
      throw new functions.https.HttpsError('unauthenticated', 'Authentication required');
    }
    requireVerifiedEmail(context);

    if (!data || typeof data !== 'object' || Array.isArray(data)) {
      throw new functions.https.HttpsError('invalid-argument', 'Invalid request');
    }

    const userId = context.auth.uid;
    const { pipelineId, provider: requestedProvider, providerOptions } = data;
    validatePipelineId(pipelineId);

    if (requestedProvider !== undefined
      && (typeof requestedProvider !== 'string' || !isValidProvider(requestedProvider))) {
      throw new functions.https.HttpsError('invalid-argument', 'Invalid model provider');
    }

    const providerType: ProviderType = requestedProvider ?? 'meshy';
    const normalizedProviderOptions = normalizeProviderOptions(providerType, providerOptions);

    const { userTier, isAdmin } = await getUserAccess(userId);

    // Validate provider access based on tier
    if (!canAccessProvider(userTier, providerType, isAdmin)) {
      throw new functions.https.HttpsError(
        'permission-denied',
        getTierValidationError('provider', providerType)
      );
    }

    // Validate HiTem3D resolution if applicable
    if (providerType === 'hitem3d') {
      const resolution = normalizedProviderOptions.resolution as HiTem3DResolution;
      if (!canAccessHiTem3DResolution(userTier, resolution, isAdmin)) {
        throw new functions.https.HttpsError(
          'permission-denied',
          getTierValidationError('resolution', `${resolution}`)
        );
      }
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

    // Allow retry from failed state when mesh generation failed
    const canRetryMesh = pipeline.status === 'failed' && pipeline.errorStep === 'generating-mesh';

    if (pipeline.status !== 'images-ready' && !canRetryMesh) {
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

    // Deduct credits (provider-specific)
    const meshCredits = PROVIDER_CREDIT_COSTS[providerType];
    const claimedPipeline = await claimPipelineStepAndDeductCredits({
      pipelineRef,
      userId,
      pipelineId,
      credits: meshCredits,
      updateData: {
        status: 'generating-mesh',
        'creditsCharged.mesh': meshCredits,
        'settings.provider': providerType,
        'settings.providerOptions': normalizedProviderOptions,
        finalizationClaim: admin.firestore.FieldValue.delete(),
        error: admin.firestore.FieldValue.delete(),
        errorStep: admin.firestore.FieldValue.delete(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      },
      validatePipeline: (currentPipeline) => {
        const retryingMesh = currentPipeline.status === 'failed' && currentPipeline.errorStep === 'generating-mesh';
        if (currentPipeline.status !== 'images-ready' && !retryingMesh) {
          throw new functions.https.HttpsError(
            'failed-precondition',
            `Cannot start mesh generation in status: ${currentPipeline.status}`
          );
        }

        const currentMissingAngles = meshAngles.filter((angle) => !currentPipeline.meshImages[angle]);
        if (currentMissingAngles.length > 0) {
          throw new functions.https.HttpsError(
            'failed-precondition',
            `Missing mesh images for: ${currentMissingAngles.join(', ')}`
          );
        }
      },
    });

    try {
      // Get image URLs from pipeline (no need to download anymore!)
      const imageUrls = await Promise.all(meshAngles.map(async (angle) => {
        const imageUrl = claimedPipeline.meshImages[angle]!.url;
        const reference = assertUserStorageReference(imageUrl, userId, ['pipelines']);
        return getSignedUrlForReference(reference.storagePath, imageUrl);
      }));

      // Get provider via factory pattern
      const provider = ProviderFactory.getProvider(providerType);

      functions.logger.info('Starting mesh generation with provider (URL-based)', {
        pipelineId,
        provider: providerType,
        providerOptions: normalizedProviderOptions,
        imageCount: imageUrls.length,
      });

      // Use URL-based methods to avoid timeout issues
      let result;
      if (providerType === 'tripo') {
        // Tripo: use generateFromUrls
        const tripoProvider = provider as TripoProvider;
        result = await tripoProvider.generateFromUrls(imageUrls, {
          quality: claimedPipeline.settings.quality as 'draft' | 'standard' | 'fine',
          format: claimedPipeline.settings.format as 'glb' | 'obj' | 'fbx' | 'stl' | 'usdz',
          enableTexture: true,
          enablePBR: true,
          providerOptions: normalizedProviderOptions.tripoMode ? {
            tripo: { mode: normalizedProviderOptions.tripoMode },
          } : undefined,
        });
      } else if (providerType === 'meshy') {
        // Meshy: use generateMeshOnlyFromUrls
        const meshyProvider = provider as MeshyProvider;
        const meshOptions: MeshGenerationOptions = {
          quality: claimedPipeline.settings.quality as 'draft' | 'standard' | 'fine',
          format: claimedPipeline.settings.format as 'glb' | 'obj' | 'fbx' | 'stl' | 'usdz',
          precision: claimedPipeline.settings.meshPrecision || 'standard',
        };
        result = await meshyProvider.generateMeshOnlyFromUrls(imageUrls, meshOptions);
      } else if (providerType === 'hunyuan') {
        // Hunyuan: use generateFromUrls
        const hunyuanProvider = provider as HunyuanProvider;
        result = await hunyuanProvider.generateFromUrls(imageUrls, {
          quality: claimedPipeline.settings.quality as 'draft' | 'standard' | 'fine',
          format: claimedPipeline.settings.format as 'glb' | 'obj' | 'fbx' | 'stl' | 'usdz',
          enablePBR: false,
          providerOptions: normalizedProviderOptions.faceCount ? {
            hunyuan: { faceCount: normalizedProviderOptions.faceCount },
          } : undefined,
        });
      } else {
        // Fallback for unknown providers: download to buffers
        const imageBuffers: Buffer[] = [];
        for (const url of imageUrls) {
          const image = await downloadValidatedImageAsBase64(url, userId, ['pipelines']);
          imageBuffers.push(Buffer.from(image.base64, 'base64'));
        }
        result = await provider.generateFromMultipleImages(imageBuffers, {
          quality: claimedPipeline.settings.quality as 'draft' | 'standard' | 'fine',
          format: claimedPipeline.settings.format as 'glb' | 'obj' | 'fbx' | 'stl' | 'usdz',
          enableTexture: false,
          enablePBR: false,
          providerOptions: providerType === 'hitem3d' ? {
            hitem3d: { resolution: normalizedProviderOptions.resolution },
          } : undefined,
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

      try {
        const refunded = await failPipelineStepAndRefund({
          pipelineRef,
          userId,
          pipelineId,
          expectedStatus: 'generating-mesh',
          credits: meshCredits,
          error: errorMessage,
        });
        if (refunded) {
          functions.logger.info('Refunded mesh credits after failure', {
            pipelineId,
            userId,
            provider: providerType,
            amount: meshCredits,
          });
        }
      } catch (refundError) {
        functions.logger.error('Failed to refund mesh credits', { pipelineId, userId, refundError });
      }

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
  })
  .https.onCall(async (data: CheckPipelineStatusData, context) => {
    if (!context.auth) {
      throw new functions.https.HttpsError('unauthenticated', 'Authentication required');
    }
    requireVerifiedEmail(context);

    if (!data || typeof data !== 'object' || Array.isArray(data)) {
      throw new functions.https.HttpsError('invalid-argument', 'Invalid request');
    }

    const userId = context.auth.uid;
    const { pipelineId } = data;
    validatePipelineId(pipelineId);

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
    let finalizationToken: string | null = null;

    try {
      // Check mesh generation status
      const taskId = pipeline.providerTaskId || pipeline.meshyMeshTaskId;
      if (pipeline.status === 'generating-mesh' && taskId) {
        const provider = ProviderFactory.getProvider(providerType);
        const status = await provider.checkStatus(taskId);

        if (status.status === 'completed') {
          finalizationToken = await claimPipelineFinalization({
            pipelineRef,
            userId,
            expectedStatus: 'generating-mesh',
            step: 'mesh',
          });
          if (!finalizationToken) {
            return { status: 'generating-mesh', progress: Math.max(status.progress ?? 0, 99) };
          }

          // Download and store mesh
          const downloadResult = await provider.getDownloadUrls(taskId);

          // Try to find the best model file: prefer GLB, then FBX, then first available
          const modelFile = downloadResult.files.find((f) => f.format === 'glb')
            || downloadResult.files.find((f) => f.format === 'fbx')
            || downloadResult.files[0];

          if (!modelFile) {
            throw new Error('Provider completed without a downloadable model');
          }

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

          await completePipelineFinalization({
            pipelineRef,
            token: finalizationToken,
            updateData: {
              status: 'mesh-ready',
              meshUrl,
              meshStoragePath: storagePath,
              meshDownloadFiles: downloadResult.files,
              meshFormat: fileExt,  // Store the actual format
              updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            },
          });
          finalizationToken = null;

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
        } else if (status.status === 'failed') {
          const errorMessage = status.error || 'Mesh generation failed';
          await failPipelineStepAndRefund({
            pipelineRef,
            userId,
            pipelineId,
            expectedStatus: 'generating-mesh',
            credits: PROVIDER_CREDIT_COSTS[providerType],
            error: errorMessage,
          });

          return { status: 'failed', error: errorMessage };
        }

        return { status: 'generating-mesh', progress: status.progress };
      }

      if (pipeline.status === 'generating-texture' && pipeline.meshyTextureTaskId) {
        const retextureClient = createMeshyRetextureClient();
        const status = await retextureClient.checkStatus(pipeline.meshyTextureTaskId);

        if (status.status === 'completed') {
          finalizationToken = await claimPipelineFinalization({
            pipelineRef,
            userId,
            expectedStatus: 'generating-texture',
            step: 'texture',
          });
          if (!finalizationToken) {
            return { status: 'generating-texture', progress: Math.max(status.progress ?? 0, 99) };
          }

          // Download and store textured model
          const downloadResult = await retextureClient.getDownloadUrls(pipeline.meshyTextureTaskId);
          const glbFile = downloadResult.files.find((f) => f.format === 'glb');

          if (!glbFile) {
            throw new Error('Provider completed without a GLB texture model');
          }

          const modelBuffer = await retextureClient.downloadModel(glbFile.url);
          const storagePath = `pipelines/${userId}/${pipelineId}/textured.glb`;

          // Use storage abstraction layer
          const texturedModelUrl = await uploadBuffer(modelBuffer, storagePath, 'model/gltf-binary');

          await completePipelineFinalization({
            pipelineRef,
            token: finalizationToken,
            updateData: {
              status: 'completed',
              texturedModelUrl,
              texturedModelStoragePath: storagePath,
              texturedDownloadFiles: downloadResult.files,
              completedAt: admin.firestore.FieldValue.serverTimestamp(),
              updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            },
          });
          finalizationToken = null;

          return {
            status: 'completed',
            texturedModelUrl,
            downloadFiles: downloadResult.files,
          };
        } else if (status.status === 'failed') {
          const errorMessage = status.error || 'Texture generation failed';
          await failPipelineStepAndRefund({
            pipelineRef,
            userId,
            pipelineId,
            expectedStatus: 'generating-texture',
            credits: PIPELINE_CREDITS.TEXTURE,
            error: errorMessage,
          });

          return { status: 'failed', error: errorMessage };
        }

        return { status: 'generating-texture', progress: status.progress };
      }

      return { status: pipeline.status };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      functions.logger.error('Pipeline status check failed', { pipelineId, error: errorMessage });
      if (finalizationToken) {
        try {
          await releasePipelineFinalization(pipelineRef, finalizationToken);
        } catch (releaseError) {
          functions.logger.error('Failed to release pipeline finalization lease', {
            pipelineId,
            releaseError,
          });
        }
      }
      throw new functions.https.HttpsError('internal', 'Unable to refresh generation status');
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
  })
  .https.onCall(async (data: StartPipelineTextureData, context) => {
    if (!context.auth) {
      throw new functions.https.HttpsError('unauthenticated', 'Authentication required');
    }
    requireVerifiedEmail(context);

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

    const claimedPipeline = await claimPipelineStepAndDeductCredits({
      pipelineRef,
      userId,
      pipelineId,
      credits: PIPELINE_CREDITS.TEXTURE,
      updateData: {
        status: 'generating-texture',
        'creditsCharged.texture': PIPELINE_CREDITS.TEXTURE,
        finalizationClaim: admin.firestore.FieldValue.delete(),
        error: admin.firestore.FieldValue.delete(),
        errorStep: admin.firestore.FieldValue.delete(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      },
      validatePipeline: (currentPipeline) => {
        const retryingTexture = currentPipeline.status === 'failed' && currentPipeline.errorStep === 'generating-texture';
        if (currentPipeline.status !== 'mesh-ready' && !retryingTexture) {
          throw new functions.https.HttpsError(
            'failed-precondition',
            `Cannot start texture generation in status: ${currentPipeline.status}`
          );
        }

        if (!currentPipeline.meshyMeshTaskId) {
          throw new functions.https.HttpsError(
            'failed-precondition',
            'Mesh generation must complete before texturing'
          );
        }

        if (!currentPipeline.meshImages.front) {
          throw new functions.https.HttpsError(
            'failed-precondition',
            'Missing front mesh reference image'
          );
        }
      },
    });

    try {
      const frontMeshImage = claimedPipeline.meshImages.front;
      const meshyMeshTaskId = claimedPipeline.meshyMeshTaskId;
      if (!frontMeshImage || !meshyMeshTaskId) {
        throw new functions.https.HttpsError(
          'failed-precondition',
          'Mesh generation must complete before texturing'
        );
      }

      // Use front mesh image as style reference
      const styleImageReference = assertUserStorageReference(
        frontMeshImage.url,
        userId,
        ['pipelines']
      );
      const styleImageUrl = await getSignedUrlForReference(
        styleImageReference.storagePath,
        frontMeshImage.url
      );

      // Build texture prompt from image analysis (if available)
      // This enhances Meshy's texture generation with material context
      let textStylePrompt: string | undefined;
      if (claimedPipeline.imageAnalysis) {
        const materials = claimedPipeline.imageAnalysis.detectedMaterials.join(', ');
        textStylePrompt = claimedPipeline.userDescription
          ? `${claimedPipeline.userDescription}. Materials: ${materials}`
          : `Materials: ${materials}`;
      }

      // Create retexture task
      const retextureClient = createMeshyRetextureClient();
      const taskId = await retextureClient.createFromMeshTask(
        meshyMeshTaskId,
        {
          imageStyleUrl: styleImageUrl,
          textStylePrompt, // Enhanced with image analysis
          enablePBR: claimedPipeline.settings.printerType !== 'fdm', // PBR for SLA/resin
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

      try {
        const refunded = await failPipelineStepAndRefund({
          pipelineRef,
          userId,
          pipelineId,
          expectedStatus: 'generating-texture',
          credits: PIPELINE_CREDITS.TEXTURE,
          error: errorMessage,
        });
        if (refunded) {
          functions.logger.info('Refunded texture credits after failure', {
            pipelineId,
            userId,
            amount: PIPELINE_CREDITS.TEXTURE,
          });
        }
      } catch (refundError) {
        functions.logger.error('Failed to refund texture credits', { pipelineId, userId, refundError });
      }

      functions.logger.error('Pipeline texture generation failed', { pipelineId, error: errorMessage });
      throw new functions.https.HttpsError('internal', `Texture generation failed: ${errorMessage}`);
    }
  });

// ============================================
// Refresh Pipeline Access URLs
// ============================================

interface RefreshPipelineAccessUrlsData {
  pipelineIds: string[];
}

async function refreshPipelineAssetUrl(
  url: string | undefined,
  storagePath: string | undefined
): Promise<string | null> {
  if (!url || !storagePath) return null;

  try {
    return await getSignedUrlForReference(storagePath, url);
  } catch (error) {
    functions.logger.warn('Could not refresh a pipeline storage URL', {
      storagePath,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    return null;
  }
}

/**
 * Mint fresh Firebase/R2 URLs from server-owned pipeline records. Clients send
 * document IDs only, so they cannot ask the signer to authorize arbitrary
 * storage paths.
 */
export const refreshPipelineAccessUrls = functions
  .region('asia-east1')
  .runWith({
    timeoutSeconds: 60,
    memory: '512MB',
    secrets: ['R2_ACCOUNT_ID', 'R2_ACCESS_KEY_ID', 'R2_SECRET_ACCESS_KEY'],
  })
  .https.onCall(async (data: RefreshPipelineAccessUrlsData, context) => {
    if (!context.auth) {
      throw new functions.https.HttpsError('unauthenticated', 'Authentication required');
    }
    requireVerifiedEmail(context);

    if (!Array.isArray(data?.pipelineIds)) {
      throw new functions.https.HttpsError('invalid-argument', 'pipelineIds must be an array');
    }

    const userId = context.auth.uid;
    const pipelineIds = [...new Set(data.pipelineIds)];
    if (
      pipelineIds.length === 0 ||
      pipelineIds.length > 50 ||
      pipelineIds.some((id) => typeof id !== 'string' || !PIPELINE_ID_PATTERN.test(id))
    ) {
      throw new functions.https.HttpsError('invalid-argument', 'Expected 1-50 valid pipeline IDs');
    }

    const snapshots = await db.getAll(
      ...pipelineIds.map((pipelineId) => db.collection('pipelines').doc(pipelineId))
    );
    const refreshedEntries = await Promise.all(snapshots.map(async (snapshot) => {
      if (!snapshot.exists) {
        throw new functions.https.HttpsError('not-found', 'Pipeline not found');
      }

      const pipeline = snapshot.data() as PipelineDocument;
      if (pipeline.userId !== userId) {
        throw new functions.https.HttpsError('permission-denied', 'Pipeline access denied');
      }

      const inputImages = await Promise.all(
        (pipeline.inputImages || []).map((image) =>
          refreshPipelineAssetUrl(image.url, image.storagePath)
        )
      );
      const meshImageEntries = await Promise.all(
        Object.entries(pipeline.meshImages || {}).map(async ([angle, image]) => [
          angle,
          image ? await refreshPipelineAssetUrl(image.url, image.storagePath) : null,
        ] as const)
      );

      return [snapshot.id, {
        inputImages,
        meshImages: Object.fromEntries(meshImageEntries),
        meshUrl: await refreshPipelineAssetUrl(pipeline.meshUrl, pipeline.meshStoragePath),
        texturedModelUrl: await refreshPipelineAssetUrl(
          pipeline.texturedModelUrl,
          pipeline.texturedModelStoragePath
        ),
      }] as const;
    }));

    return {
      pipelines: Object.fromEntries(refreshedEntries),
      expiresAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
    };
  });

// ============================================
// Update Pipeline Analysis
// ============================================

interface UpdatePipelineAnalysisData {
  pipelineId: string;
  imageAnalysis: import('../rodin/types').ImageAnalysisResult;
  userDescription?: string;
  selectedStyle?: StyleId;
  geminiModel?: ViewGenerationModel;
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
    requireVerifiedEmail(context);

    const userId = context.auth.uid;
    const { pipelineId, imageAnalysis, userDescription, selectedStyle, geminiModel } = data;

    if (selectedStyle !== undefined && !isValidStyleId(selectedStyle)) {
      throw new functions.https.HttpsError('invalid-argument', 'Invalid figure style');
    }
    if (geminiModel !== undefined && !Object.prototype.hasOwnProperty.call(GEMINI_MODEL_CREDITS, geminiModel)) {
      throw new functions.https.HttpsError('invalid-argument', 'Invalid Gemini model');
    }

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

    if (geminiModel !== undefined) {
      const { userTier, isAdmin } = await getUserAccess(userId);
      if (!canAccessViewModel(userTier, geminiModel, isAdmin)) {
        throw new functions.https.HttpsError(
          'permission-denied',
          getTierValidationError('viewModel', geminiModel)
        );
      }
    }

    const colors = resolveGenerationColors({ colorPalette: imageAnalysis.colorPalette });

    // Update the pipeline with new analysis
    const updateData: Record<string, unknown> = {
      imageAnalysis,
      'settings.colorCount': colors.colorCount,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    };

    // Also update userDescription if provided
    if (userDescription !== undefined) {
      updateData.userDescription = userDescription || null;
    }
    if (selectedStyle !== undefined) {
      updateData['settings.selectedStyle'] = selectedStyle;
    }
    if (geminiModel !== undefined) {
      updateData['settings.geminiModel'] = geminiModel;
    }

    await pipelineRef.update(updateData);

    functions.logger.info('Pipeline analysis updated', {
      pipelineId,
      userId,
      colorCount: imageAnalysis.colorPalette?.length,
      hasDescription: !!userDescription,
      selectedStyle: selectedStyle || pipeline.settings?.selectedStyle || 'none',
      geminiModel: geminiModel || pipeline.settings?.geminiModel || 'default',
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
    requireVerifiedEmail(context);

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

    assertNoActiveRegeneration(pipeline);

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
      finalizationClaim: admin.firestore.FieldValue.delete(),
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
          updateData.styledReferenceAngle = admin.firestore.FieldValue.delete();
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

    await db.runTransaction(async (transaction) => {
      const currentSnapshot = await transaction.get(pipelineRef);
      const current = currentSnapshot.data() as PipelineDocument | undefined;
      if (!current || current.userId !== userId) {
        throw new functions.https.HttpsError('not-found', 'Pipeline not found');
      }
      assertNoActiveRegeneration(current);
      if (generatingStatuses.includes(current.status)) {
        throw new functions.https.HttpsError('failed-precondition', 'Wait for the current generation to finish');
      }
      transaction.update(pipelineRef, updateData);
    });

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
