"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.resetPipelineStep = exports.updatePipelineAnalysis = exports.refreshPipelineAccessUrls = exports.startPipelineTexture = exports.checkPipelineStatus = exports.startPipelineMesh = exports.regeneratePipelineImage = exports.generatePipelineImages = exports.getUserPipelines = exports.getPipeline = exports.createPipeline = void 0;
const functions = __importStar(require("firebase-functions/v1"));
const admin = __importStar(require("firebase-admin"));
const multi_view_generator_1 = require("../gemini/multi-view-generator");
const composite_view_generator_1 = require("../gemini/composite-view-generator");
const styled_reference_generator_1 = require("../gemini/styled-reference-generator");
const generation_options_1 = require("../gemini/generation-options");
const retexture_1 = require("../providers/meshy/retexture");
const factory_1 = require("../providers/factory");
const credits_1 = require("../utils/credits");
const storage_validation_1 = require("../utils/storage-validation");
const storage_1 = require("../storage");
const mode_configs_1 = require("../gemini/mode-configs");
const tiers_1 = require("../config/tiers");
const styles_1 = require("../config/styles");
const db = admin.firestore();
// Product credits, not supplier API credits or actual generation costs.
// Version/parameter-specific API prices: docs/research/2026-09-05-3d-model-comparison.md
const PROVIDER_CREDIT_COSTS = {
    meshy: 5,
    hunyuan: 6,
    rodin: 8,
    tripo: 5,
    hitem3d: 6,
};
const PIPELINE_CREDITS = {
    MESH: 5, // Default (overridden by provider)
    TEXTURE: 10, // Meshy Retexture only
};
// Credit cost for Gemini view generation
// Supports both short names (backend) and full names (frontend)
const GEMINI_MODEL_CREDITS = {
    'gemini-2.5-flash': 3,
    'gemini-2.5-flash-image': 3, // Full ID from frontend
    'gemini-3-pro-image-preview': 5, // Premium model
};
// Maximum regenerations allowed per pipeline (credits only charged once)
const MAX_REGENERATIONS = 4;
const PIPELINE_ID_PATTERN = /^[A-Za-z0-9_-]{1,128}$/;
const FINALIZATION_LEASE_MS = 3 * 60 * 1000;
const REGENERATION_LEASE_MS = 3 * 60 * 1000;
function assertNoActiveRegeneration(pipeline) {
    if (pipeline.regenerationClaim && pipeline.regenerationClaim.expiresAt.toMillis() > Date.now()) {
        throw new functions.https.HttpsError('failed-precondition', 'Wait for the current view correction to finish');
    }
}
function getPipelineColors(pipeline) {
    return (0, generation_options_1.resolveGenerationColors)({
        colorCount: pipeline.settings?.colorCount,
        colorPalette: pipeline.imageAnalysis?.colorPalette,
    });
}
function validateImageGenerationInput(pipeline) {
    getPipelineColors(pipeline);
    const referenceAngle = pipeline.imageAnalysis?.detectedViewAngle;
    if (referenceAngle && pipeline.settings?.selectedStyle) {
        (0, generation_options_1.assertSupportedReferenceAngle)(referenceAngle);
    }
}
// ============================================
// Helper Functions
// ============================================
/**
 * Upload image to storage and get URL
 * Uses storage abstraction layer (Firebase or R2)
 */
async function uploadImageToStorage(base64, mimeType, storagePath) {
    return (0, storage_1.uploadBase64)(base64, storagePath, mimeType);
}
/**
 * Get file extension from MIME type
 */
function getExtensionFromMimeType(mimeType) {
    const mimeMap = {
        'image/png': 'png',
        'image/jpeg': 'jpg',
        'image/webp': 'webp',
    };
    return mimeMap[mimeType] || 'png';
}
function normalizeGeminiViewModel(model) {
    if (!model || model === 'gemini-2.5-flash') {
        return 'gemini-2.5-flash-image';
    }
    if (model === 'gemini-2.5-flash-image' || model === 'gemini-3-pro-image-preview') {
        return model;
    }
    throw new functions.https.HttpsError('invalid-argument', 'Invalid Gemini image model');
}
function validatePipelineId(pipelineId) {
    if (typeof pipelineId !== 'string' || !PIPELINE_ID_PATTERN.test(pipelineId)) {
        throw new functions.https.HttpsError('invalid-argument', 'Invalid pipeline ID');
    }
}
function requireVerifiedEmail(context) {
    if (context.auth?.token.email_verified !== true) {
        throw new functions.https.HttpsError('failed-precondition', 'Verify your email before using the generation pipeline');
    }
}
function normalizeProviderOptions(providerType, value) {
    if (value === undefined) {
        return providerType === 'hitem3d' ? { resolution: 512 } : {};
    }
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
        throw new functions.https.HttpsError('invalid-argument', 'Invalid provider options');
    }
    const raw = value;
    const allowedKeys = new Set(['faceCount', 'tripoMode', 'resolution']);
    if (Object.keys(raw).some((key) => !allowedKeys.has(key))) {
        throw new functions.https.HttpsError('invalid-argument', 'Invalid provider options');
    }
    if (raw.faceCount !== undefined && (typeof raw.faceCount !== 'number'
        || !Number.isInteger(raw.faceCount)
        || raw.faceCount < 40_000
        || raw.faceCount > 1_500_000)) {
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
            return { resolution: raw.resolution ?? 512 };
        case 'hunyuan':
            return raw.faceCount === undefined ? {} : { faceCount: raw.faceCount };
        case 'tripo':
            return raw.tripoMode === undefined
                ? {}
                : { tripoMode: raw.tripoMode };
        default:
            return {};
    }
}
async function getUserAccess(userId) {
    const userDoc = await db.collection('users').doc(userId).get();
    const userData = userDoc.data();
    return {
        userTier: userData?.tier || 'free',
        isAdmin: userData?.role === 'admin',
    };
}
async function claimPipelineStepAndDeductCredits(params) {
    const { pipelineRef, userId, pipelineId, credits, updateData, validatePipeline } = params;
    const userRef = db.collection('users').doc(userId);
    let claimedPipeline = null;
    await db.runTransaction(async (transaction) => {
        const pipelineDoc = await transaction.get(pipelineRef);
        const userDoc = await transaction.get(userRef);
        if (!pipelineDoc.exists) {
            throw new functions.https.HttpsError('not-found', 'Pipeline not found');
        }
        if (!userDoc.exists) {
            throw new functions.https.HttpsError('not-found', 'User not found');
        }
        const pipeline = pipelineDoc.data();
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
    return claimedPipeline;
}
async function failPipelineStepAndRefund(params) {
    const { pipelineRef, userId, pipelineId, expectedStatus, credits, error, } = params;
    const userRef = db.collection('users').doc(userId);
    const transactionRef = db.collection('transactions').doc();
    const chargedField = expectedStatus === 'generating-images'
        ? 'views'
        : expectedStatus === 'generating-mesh' ? 'mesh' : 'texture';
    return db.runTransaction(async (transaction) => {
        const pipelineDoc = await transaction.get(pipelineRef);
        const userDoc = await transaction.get(userRef);
        if (!pipelineDoc.exists) {
            throw new functions.https.HttpsError('not-found', 'Pipeline not found');
        }
        const pipeline = pipelineDoc.data();
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
async function claimPipelineFinalization(params) {
    const { pipelineRef, userId, expectedStatus, step } = params;
    const token = db.collection('_claimTokens').doc().id;
    const now = Date.now();
    return db.runTransaction(async (transaction) => {
        const pipelineDoc = await transaction.get(pipelineRef);
        if (!pipelineDoc.exists) {
            throw new functions.https.HttpsError('not-found', 'Pipeline not found');
        }
        const pipeline = pipelineDoc.data();
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
async function completePipelineFinalization(params) {
    const { pipelineRef, token, updateData } = params;
    await db.runTransaction(async (transaction) => {
        const pipelineDoc = await transaction.get(pipelineRef);
        const pipeline = pipelineDoc.data();
        if (!pipelineDoc.exists || pipeline?.finalizationClaim?.token !== token) {
            throw new functions.https.HttpsError('aborted', 'Pipeline finalization lease expired');
        }
        transaction.update(pipelineRef, {
            ...updateData,
            finalizationClaim: admin.firestore.FieldValue.delete(),
        });
    });
}
async function releasePipelineFinalization(pipelineRef, token) {
    await db.runTransaction(async (transaction) => {
        const pipelineDoc = await transaction.get(pipelineRef);
        const pipeline = pipelineDoc.data();
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
exports.createPipeline = functions
    .region('asia-east1')
    .runWith({ timeoutSeconds: 30 })
    .https.onCall(async (data, context) => {
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'You must be logged in to create a pipeline');
    }
    requireVerifiedEmail(context);
    const userId = context.auth.uid;
    const { imageUrls, settings, generationMode, processingMode = 'realtime', userDescription, imageAnalysis, geminiModel, selectedStyle: legacySelectedStyle, } = data;
    if (!imageUrls || imageUrls.length === 0) {
        throw new functions.https.HttpsError('invalid-argument', 'At least one image URL is required');
    }
    const validatedImages = (0, storage_validation_1.assertUserStorageReferences)(imageUrls, userId, ['uploads'], 1);
    const selectedGeminiModel = normalizeGeminiViewModel(geminiModel);
    const requestedStyle = legacySelectedStyle ?? settings?.selectedStyle;
    if (requestedStyle !== undefined && !(0, styles_1.isValidStyleId)(requestedStyle)) {
        throw new functions.https.HttpsError('invalid-argument', 'Invalid figure style');
    }
    if (processingMode !== 'realtime') {
        throw new functions.https.HttpsError('failed-precondition', 'Batch processing is temporarily disabled');
    }
    const selectedStyle = requestedStyle;
    const { userTier, isAdmin } = await getUserAccess(userId);
    if (!(0, tiers_1.canAccessViewModel)(userTier, selectedGeminiModel, isAdmin)) {
        throw new functions.https.HttpsError('permission-denied', (0, tiers_1.getTierValidationError)('viewModel', selectedGeminiModel));
    }
    const pipelineRef = db.collection('pipelines').doc();
    const pipelineId = pipelineRef.id;
    // Use serverTimestamp for top-level fields, regular Date for array items
    // (Firestore doesn't allow serverTimestamp() inside arrays)
    const now = admin.firestore.FieldValue.serverTimestamp();
    const uploadTime = admin.firestore.Timestamp.now();
    // Determine generation mode (default to simplified-mesh for backward compatibility)
    const modeId = generationMode || mode_configs_1.DEFAULT_MODE;
    const pipeline = {
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
        regenerationsUsed: 0, // Track regeneration count (max 4 per pipeline)
        settings: {
            quality: settings?.quality || 'standard',
            printerType: settings?.printerType || 'fdm',
            format: settings?.format || 'glb',
            generationMode: modeId,
            geminiModel: selectedGeminiModel, // Default to fast model
            ...(settings?.meshPrecision !== undefined && { meshPrecision: settings.meshPrecision }),
            ...(settings?.colorCount !== undefined && { colorCount: settings.colorCount }),
            ...(selectedStyle !== undefined && { selectedStyle }), // User-selected figure style
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
exports.getPipeline = functions
    .region('asia-east1')
    .runWith({ timeoutSeconds: 30 })
    .https.onCall(async (data, context) => {
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'Authentication required');
    }
    requireVerifiedEmail(context);
    const { pipelineId } = data;
    const pipelineDoc = await db.collection('pipelines').doc(pipelineId).get();
    if (!pipelineDoc.exists) {
        throw new functions.https.HttpsError('not-found', 'Pipeline not found');
    }
    const pipeline = pipelineDoc.data();
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
exports.getUserPipelines = functions
    .region('asia-east1')
    .runWith({ timeoutSeconds: 30 })
    .https.onCall(async (data, context) => {
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'Authentication required');
    }
    requireVerifiedEmail(context);
    const userId = context.auth.uid;
    const requestedLimit = data?.limit ?? 20;
    if (!Number.isInteger(requestedLimit) || requestedLimit < 1 || requestedLimit > 50) {
        throw new functions.https.HttpsError('invalid-argument', 'limit must be an integer between 1 and 50');
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
exports.generatePipelineImages = functions
    .region('asia-east1')
    .runWith({
    timeoutSeconds: 300, // 5 minutes for 6 Gemini calls
    memory: '1GB',
    secrets: ['GEMINI_API_KEY'],
})
    .https.onCall(async (data, context) => {
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
    const pipeline = pipelineDoc.data();
    if (pipeline.userId !== userId) {
        throw new functions.https.HttpsError('permission-denied', 'Not your pipeline');
    }
    // Allow retry from failed state if it failed during image generation
    const canRetry = pipeline.status === 'failed' && pipeline.errorStep === 'generating-images';
    if (pipeline.status !== 'draft' && pipeline.status !== 'images-ready' && !canRetry) {
        throw new functions.https.HttpsError('failed-precondition', `Cannot generate images in status: ${pipeline.status}`);
    }
    validateImageGenerationInput(pipeline);
    // Get Gemini model and calculate credits
    const geminiViewModel = normalizeGeminiViewModel(pipeline.settings?.geminiModel);
    const geminiModel = geminiViewModel;
    const viewCredits = GEMINI_MODEL_CREDITS[geminiModel];
    if (!viewCredits) {
        throw new functions.https.HttpsError('invalid-argument', 'Invalid Gemini image model');
    }
    const { userTier, isAdmin } = await getUserAccess(userId);
    if (!(0, tiers_1.canAccessViewModel)(userTier, geminiViewModel, isAdmin)) {
        throw new functions.https.HttpsError('permission-denied', (0, tiers_1.getTierValidationError)('viewModel', geminiViewModel));
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
            if (currentPipeline.status !== 'draft' &&
                currentPipeline.status !== 'images-ready' &&
                !retryingImages) {
                throw new functions.https.HttpsError('failed-precondition', `Cannot generate images in status: ${currentPipeline.status}`);
            }
        },
    });
    const generationId = db.collection('_claimTokens').doc().id;
    try {
        const colors = getPipelineColors(claimedPipeline);
        // Download reference image (use first uploaded image)
        const referenceImageUrl = claimedPipeline.inputImages[0].url;
        const { base64, mimeType } = await (0, storage_validation_1.downloadValidatedImageAsBase64)(referenceImageUrl, userId, ['uploads']);
        const modeId = claimedPipeline.generationMode || mode_configs_1.DEFAULT_MODE;
        const selectedStyle = claimedPipeline.settings?.selectedStyle;
        const generator = (0, multi_view_generator_1.createMultiViewGenerator)(modeId, claimedPipeline.userDescription, claimedPipeline.imageAnalysis, geminiModel, selectedStyle, colors);
        // Determine if we should use two-phase flow for style consistency
        // Two-phase is used when: image analysis detected a view angle AND a style is selected
        const detectedViewAngle = claimedPipeline.imageAnalysis?.detectedViewAngle;
        const useTwoPhaseFlow = detectedViewAngle && selectedStyle;
        const now = admin.firestore.FieldValue.serverTimestamp();
        const meshImages = {};
        let styledReferenceAngle;
        let aggregatedColorPalette;
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
                    phase: 'styled-reference',
                    meshViewsCompleted: 0,
                },
                updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            });
            const styledRef = await (0, styled_reference_generator_1.generateStyledReference)(base64, mimeType, {
                detectedAngle: detectedViewAngle,
                style: selectedStyle,
                geminiModel,
                ...colors,
                imageAnalysis: claimedPipeline.imageAnalysis,
                userDescription: claimedPipeline.userDescription,
            });
            styledReferenceAngle = styledRef.sourceAngle;
            // Upload styled reference as one of the mesh images
            const refAngle = styledRef.sourceAngle;
            const refExt = getExtensionFromMimeType(styledRef.mimeType);
            const refPath = `pipelines/${userId}/${pipelineId}/views/${generationId}/mesh_${refAngle}.${refExt}`;
            const refUrl = await uploadImageToStorage(styledRef.imageBase64, styledRef.mimeType, refPath);
            meshImages[refAngle] = {
                url: refUrl,
                storagePath: refPath,
                source: 'gemini-styled-reference',
                generatedAt: now,
                colorPalette: styledRef.colorPalette,
            };
            // Update progress: 1 of 4 complete
            await pipelineRef.update({
                generationProgress: {
                    phase: 'mesh-views',
                    meshViewsCompleted: 1,
                },
                updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            });
            // Phase 2: Generate remaining 3 views from styled reference
            const onProgress = async (_type, _angle, completed, _total) => {
                await pipelineRef.update({
                    generationProgress: {
                        phase: 'mesh-views',
                        meshViewsCompleted: 1 + completed, // +1 for styled reference
                    },
                    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
                });
            };
            const remainingViews = await generator.generateViewsFromStyledReference(styledRef.imageBase64, styledRef.mimeType, styledRef.sourceAngle, styledRef.colorPalette, onProgress);
            // Upload remaining views
            for (const [angle, view] of Object.entries(remainingViews)) {
                const ext = getExtensionFromMimeType(view.mimeType);
                const storagePath = `pipelines/${userId}/${pipelineId}/views/${generationId}/mesh_${angle}.${ext}`;
                const url = await uploadImageToStorage(view.imageBase64, view.mimeType, storagePath);
                const meshImage = {
                    url,
                    storagePath,
                    source: 'gemini-from-reference',
                    generatedAt: now,
                };
                if (view.colorPalette && view.colorPalette.length > 0) {
                    meshImage.colorPalette = view.colorPalette;
                }
                meshImages[angle] = meshImage;
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
        }
        else {
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
                    phase: 'composite-generation',
                    meshViewsCompleted: 0,
                },
                updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            });
            // Generate composite view (single API call)
            const compositeResult = await (0, composite_view_generator_1.generateCompositeView)(base64, mimeType, {
                userDescription: claimedPipeline.userDescription,
                imageAnalysis: claimedPipeline.imageAnalysis,
                selectedStyle,
                geminiModel,
                ...colors,
            });
            // Update progress: composite done, uploading
            await pipelineRef.update({
                generationProgress: {
                    phase: 'uploading',
                    meshViewsCompleted: 4,
                },
                updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            });
            // Upload all 4 views
            const viewEntries = [
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
                    generatedAt: now,
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
    }
    catch (error) {
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
        }
        catch (refundError) {
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
exports.regeneratePipelineImage = functions
    .region('asia-east1')
    .runWith({ timeoutSeconds: 120, memory: '512MB', secrets: ['GEMINI_API_KEY'] })
    .https.onCall(async (data, context) => {
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
    const meshAngle = angle;
    const pipelineRef = db.collection('pipelines').doc(pipelineId);
    const token = db.collection('_claimTokens').doc().id;
    // Reserve one correction at a time. The quota counts completed corrections;
    // failures release the reservation, and a timed-out lease can be reclaimed.
    const pipeline = await db.runTransaction(async (transaction) => {
        const snapshot = await transaction.get(pipelineRef);
        if (!snapshot.exists)
            throw new functions.https.HttpsError('not-found', 'Pipeline not found');
        const current = snapshot.data();
        if (current.userId !== userId)
            throw new functions.https.HttpsError('permission-denied', 'Not your pipeline');
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
        const generator = (0, multi_view_generator_1.createMultiViewGenerator)(pipeline.generationMode || mode_configs_1.DEFAULT_MODE, pipeline.userDescription, pipeline.imageAnalysis, normalizeGeminiViewModel(pipeline.settings?.geminiModel), pipeline.settings?.selectedStyle, colors);
        const referenceAngle = pipeline.styledReferenceAngle;
        if (referenceAngle)
            (0, generation_options_1.assertSupportedReferenceAngle)(referenceAngle);
        const reference = referenceAngle ? pipeline.meshImages[referenceAngle] : undefined;
        if (referenceAngle && !reference) {
            throw new functions.https.HttpsError('failed-precondition', 'Reference view is missing. Generate the view set again.');
        }
        const { base64, mimeType } = await (0, storage_validation_1.downloadValidatedImageAsBase64)(reference?.url || pipeline.inputImages[0].url, userId, reference ? ['pipelines'] : ['uploads']);
        // The reference angle is also corrected in place from its accepted image.
        // A single-view action never regenerates or replaces the other three views.
        const view = referenceAngle
            ? await generator.generateSingleViewFromReference(base64, mimeType, referenceAngle, meshAngle, colors.colorPalette.length ? colors.colorPalette : reference?.colorPalette || [], normalizedHint)
            : await generator.generateMeshView(base64, mimeType, meshAngle, normalizedHint);
        const storagePath = `pipelines/${userId}/${pipelineId}/views/${token}/mesh_${angle}.${getExtensionFromMimeType(view.mimeType)}`;
        const url = await uploadImageToStorage(view.imageBase64, view.mimeType, storagePath);
        const image = {
            url,
            storagePath,
            source: referenceAngle ? 'gemini-from-reference' : 'gemini',
            generatedAt: admin.firestore.Timestamp.now(),
            ...(view.colorPalette?.length && { colorPalette: view.colorPalette }),
        };
        await db.runTransaction(async (transaction) => {
            const snapshot = await transaction.get(pipelineRef);
            const current = snapshot.data();
            if (!current || current.regenerationClaim?.token !== token || current.status !== 'images-ready') {
                throw new functions.https.HttpsError('aborted', 'The view set changed. Your previous views have been preserved.');
            }
            const meshImages = { ...current.meshImages, [angle]: image };
            const palette = colors.colorPalette.length ? colors.colorPalette : [...new Set(Object.values(meshImages).flatMap((meshImage) => meshImage?.colorPalette || []))];
            transaction.update(pipelineRef, {
                [`meshImages.${angle}`]: image,
                aggregatedColorPalette: { unified: palette, dominantColors: palette.slice(0, colors.colorCount) },
                regenerationsUsed: (current.regenerationsUsed || 0) + 1,
                regenerationClaim: admin.firestore.FieldValue.delete(),
                updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            });
        });
        return { viewType, angle, image, regeneratedAllViews: false };
    }
    catch (error) {
        await db.runTransaction(async (transaction) => {
            const snapshot = await transaction.get(pipelineRef);
            const current = snapshot.data();
            if (current?.regenerationClaim?.token === token) {
                transaction.update(pipelineRef, {
                    regenerationClaim: admin.firestore.FieldValue.delete(),
                    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
                });
            }
        });
        functions.logger.error('Pipeline view correction failed', { pipelineId, angle, error: error instanceof Error ? error.message : 'Unknown error' });
        if (error instanceof functions.https.HttpsError)
            throw error;
        throw new functions.https.HttpsError('internal', 'View correction failed. Your previous views and correction allowance have been preserved.');
    }
});
/**
 * Start mesh generation (5 credits)
 *
 * Uses Meshy Multi-Image-to-3D with should_texture: false
 */
exports.startPipelineMesh = functions
    .region('asia-east1')
    .runWith({
    timeoutSeconds: 120,
    memory: '1GB',
})
    .https.onCall(async (data, context) => {
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
        && (typeof requestedProvider !== 'string' || !(0, factory_1.isValidProvider)(requestedProvider))) {
        throw new functions.https.HttpsError('invalid-argument', 'Invalid model provider');
    }
    const providerType = requestedProvider ?? 'meshy';
    const normalizedProviderOptions = normalizeProviderOptions(providerType, providerOptions);
    const { userTier, isAdmin } = await getUserAccess(userId);
    // Validate provider access based on tier
    if (!(0, tiers_1.canAccessProvider)(userTier, providerType, isAdmin)) {
        throw new functions.https.HttpsError('permission-denied', (0, tiers_1.getTierValidationError)('provider', providerType));
    }
    // Validate HiTem3D resolution if applicable
    if (providerType === 'hitem3d') {
        const resolution = normalizedProviderOptions.resolution;
        if (!(0, tiers_1.canAccessHiTem3DResolution)(userTier, resolution, isAdmin)) {
            throw new functions.https.HttpsError('permission-denied', (0, tiers_1.getTierValidationError)('resolution', `${resolution}`));
        }
    }
    // Get pipeline
    const pipelineRef = db.collection('pipelines').doc(pipelineId);
    const pipelineDoc = await pipelineRef.get();
    if (!pipelineDoc.exists) {
        throw new functions.https.HttpsError('not-found', 'Pipeline not found');
    }
    const pipeline = pipelineDoc.data();
    if (pipeline.userId !== userId) {
        throw new functions.https.HttpsError('permission-denied', 'Not your pipeline');
    }
    // Allow retry from failed state when mesh generation failed
    const canRetryMesh = pipeline.status === 'failed' && pipeline.errorStep === 'generating-mesh';
    if (pipeline.status !== 'images-ready' && !canRetryMesh) {
        throw new functions.https.HttpsError('failed-precondition', `Cannot start mesh generation in status: ${pipeline.status}`);
    }
    // Verify we have all 4 mesh images
    const meshAngles = ['front', 'back', 'left', 'right'];
    const missingAngles = meshAngles.filter((angle) => !pipeline.meshImages[angle]);
    if (missingAngles.length > 0) {
        throw new functions.https.HttpsError('failed-precondition', `Missing mesh images for: ${missingAngles.join(', ')}`);
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
                throw new functions.https.HttpsError('failed-precondition', `Cannot start mesh generation in status: ${currentPipeline.status}`);
            }
            const currentMissingAngles = meshAngles.filter((angle) => !currentPipeline.meshImages[angle]);
            if (currentMissingAngles.length > 0) {
                throw new functions.https.HttpsError('failed-precondition', `Missing mesh images for: ${currentMissingAngles.join(', ')}`);
            }
        },
    });
    try {
        // Get image URLs from pipeline (no need to download anymore!)
        const imageUrls = await Promise.all(meshAngles.map(async (angle) => {
            const imageUrl = claimedPipeline.meshImages[angle].url;
            const reference = (0, storage_validation_1.assertUserStorageReference)(imageUrl, userId, ['pipelines']);
            return (0, storage_1.getSignedUrlForReference)(reference.storagePath, imageUrl);
        }));
        // Get provider via factory pattern
        const provider = factory_1.ProviderFactory.getProvider(providerType);
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
            const tripoProvider = provider;
            result = await tripoProvider.generateFromUrls(imageUrls, {
                quality: claimedPipeline.settings.quality,
                format: claimedPipeline.settings.format,
                enableTexture: true,
                enablePBR: true,
                providerOptions: normalizedProviderOptions.tripoMode ? {
                    tripo: { mode: normalizedProviderOptions.tripoMode },
                } : undefined,
            });
        }
        else if (providerType === 'meshy') {
            // Meshy: use generateMeshOnlyFromUrls
            const meshyProvider = provider;
            const meshOptions = {
                quality: claimedPipeline.settings.quality,
                format: claimedPipeline.settings.format,
                precision: claimedPipeline.settings.meshPrecision || 'standard',
            };
            result = await meshyProvider.generateMeshOnlyFromUrls(imageUrls, meshOptions);
        }
        else if (providerType === 'hunyuan') {
            // Hunyuan: use generateFromUrls
            const hunyuanProvider = provider;
            result = await hunyuanProvider.generateFromUrls(imageUrls, {
                quality: claimedPipeline.settings.quality,
                format: claimedPipeline.settings.format,
                enablePBR: false,
                providerOptions: normalizedProviderOptions.faceCount ? {
                    hunyuan: { faceCount: normalizedProviderOptions.faceCount },
                } : undefined,
            });
        }
        else {
            // Fallback for unknown providers: download to buffers
            const imageBuffers = [];
            for (const url of imageUrls) {
                const image = await (0, storage_validation_1.downloadValidatedImageAsBase64)(url, userId, ['pipelines']);
                imageBuffers.push(Buffer.from(image.base64, 'base64'));
            }
            result = await provider.generateFromMultipleImages(imageBuffers, {
                quality: claimedPipeline.settings.quality,
                format: claimedPipeline.settings.format,
                enableTexture: false,
                enablePBR: false,
                providerOptions: providerType === 'hitem3d' ? {
                    hitem3d: { resolution: normalizedProviderOptions.resolution },
                } : undefined,
            });
        }
        // Update pipeline with task ID (provider settings already saved above)
        const updateData = {
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
            meshyTaskId: result.taskId, // Legacy field for backwards compatibility
            taskId: result.taskId, // Generic field
            provider: providerType,
            creditsCharged: meshCredits,
        };
    }
    catch (error) {
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
        }
        catch (refundError) {
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
exports.checkPipelineStatus = functions
    .region('asia-east1')
    .runWith({
    timeoutSeconds: 120,
    memory: '512MB',
})
    .https.onCall(async (data, context) => {
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
    const pipeline = pipelineDoc.data();
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
    const providerType = pipeline.settings.provider || 'meshy';
    let finalizationToken = null;
    try {
        // Check mesh generation status
        const taskId = pipeline.providerTaskId || pipeline.meshyMeshTaskId;
        if (pipeline.status === 'generating-mesh' && taskId) {
            const provider = factory_1.ProviderFactory.getProvider(providerType);
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
                const mimeTypes = {
                    glb: 'model/gltf-binary',
                    fbx: 'application/octet-stream',
                    obj: 'text/plain',
                    stl: 'application/sla',
                };
                const mimeType = mimeTypes[fileExt] || 'application/octet-stream';
                // Use storage abstraction layer
                const meshUrl = await (0, storage_1.uploadBuffer)(modelBuffer, storagePath, mimeType);
                await completePipelineFinalization({
                    pipelineRef,
                    token: finalizationToken,
                    updateData: {
                        status: 'mesh-ready',
                        meshUrl,
                        meshStoragePath: storagePath,
                        meshDownloadFiles: downloadResult.files,
                        meshFormat: fileExt, // Store the actual format
                        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
                    },
                });
                finalizationToken = null;
                await (0, credits_1.incrementGenerationCount)(userId);
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
            else if (status.status === 'failed') {
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
            const retextureClient = (0, retexture_1.createMeshyRetextureClient)();
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
                const texturedModelUrl = await (0, storage_1.uploadBuffer)(modelBuffer, storagePath, 'model/gltf-binary');
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
            }
            else if (status.status === 'failed') {
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
    }
    catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        functions.logger.error('Pipeline status check failed', { pipelineId, error: errorMessage });
        if (finalizationToken) {
            try {
                await releasePipelineFinalization(pipelineRef, finalizationToken);
            }
            catch (releaseError) {
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
exports.startPipelineTexture = functions
    .region('asia-east1')
    .runWith({
    timeoutSeconds: 120,
    memory: '512MB',
})
    .https.onCall(async (data, context) => {
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
    const pipeline = pipelineDoc.data();
    if (pipeline.userId !== userId) {
        throw new functions.https.HttpsError('permission-denied', 'Not your pipeline');
    }
    // Allow retry from failed state when texture generation failed
    const canRetryTexture = pipeline.status === 'failed' && pipeline.errorStep === 'generating-texture';
    if (pipeline.status !== 'mesh-ready' && !canRetryTexture) {
        throw new functions.https.HttpsError('failed-precondition', `Cannot start texture generation in status: ${pipeline.status}`);
    }
    if (!pipeline.meshyMeshTaskId) {
        throw new functions.https.HttpsError('failed-precondition', 'Mesh generation must complete before texturing');
    }
    // Verify we have mesh reference images for style reference
    if (!pipeline.meshImages.front) {
        throw new functions.https.HttpsError('failed-precondition', 'Missing front mesh reference image');
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
                throw new functions.https.HttpsError('failed-precondition', `Cannot start texture generation in status: ${currentPipeline.status}`);
            }
            if (!currentPipeline.meshyMeshTaskId) {
                throw new functions.https.HttpsError('failed-precondition', 'Mesh generation must complete before texturing');
            }
            if (!currentPipeline.meshImages.front) {
                throw new functions.https.HttpsError('failed-precondition', 'Missing front mesh reference image');
            }
        },
    });
    try {
        const frontMeshImage = claimedPipeline.meshImages.front;
        const meshyMeshTaskId = claimedPipeline.meshyMeshTaskId;
        if (!frontMeshImage || !meshyMeshTaskId) {
            throw new functions.https.HttpsError('failed-precondition', 'Mesh generation must complete before texturing');
        }
        // Use front mesh image as style reference
        const styleImageReference = (0, storage_validation_1.assertUserStorageReference)(frontMeshImage.url, userId, ['pipelines']);
        const styleImageUrl = await (0, storage_1.getSignedUrlForReference)(styleImageReference.storagePath, frontMeshImage.url);
        // Build texture prompt from image analysis (if available)
        // This enhances Meshy's texture generation with material context
        let textStylePrompt;
        if (claimedPipeline.imageAnalysis) {
            const materials = claimedPipeline.imageAnalysis.detectedMaterials.join(', ');
            textStylePrompt = claimedPipeline.userDescription
                ? `${claimedPipeline.userDescription}. Materials: ${materials}`
                : `Materials: ${materials}`;
        }
        // Create retexture task
        const retextureClient = (0, retexture_1.createMeshyRetextureClient)();
        const taskId = await retextureClient.createFromMeshTask(meshyMeshTaskId, {
            imageStyleUrl: styleImageUrl,
            textStylePrompt, // Enhanced with image analysis
            enablePBR: claimedPipeline.settings.printerType !== 'fdm', // PBR for SLA/resin
        });
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
    }
    catch (error) {
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
        }
        catch (refundError) {
            functions.logger.error('Failed to refund texture credits', { pipelineId, userId, refundError });
        }
        functions.logger.error('Pipeline texture generation failed', { pipelineId, error: errorMessage });
        throw new functions.https.HttpsError('internal', `Texture generation failed: ${errorMessage}`);
    }
});
async function refreshPipelineAssetUrl(url, storagePath) {
    if (!url || !storagePath)
        return null;
    try {
        return await (0, storage_1.getSignedUrlForReference)(storagePath, url);
    }
    catch (error) {
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
exports.refreshPipelineAccessUrls = functions
    .region('asia-east1')
    .runWith({
    timeoutSeconds: 60,
    memory: '512MB',
    secrets: ['R2_ACCOUNT_ID', 'R2_ACCESS_KEY_ID', 'R2_SECRET_ACCESS_KEY'],
})
    .https.onCall(async (data, context) => {
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'Authentication required');
    }
    requireVerifiedEmail(context);
    if (!Array.isArray(data?.pipelineIds)) {
        throw new functions.https.HttpsError('invalid-argument', 'pipelineIds must be an array');
    }
    const userId = context.auth.uid;
    const pipelineIds = [...new Set(data.pipelineIds)];
    if (pipelineIds.length === 0 ||
        pipelineIds.length > 50 ||
        pipelineIds.some((id) => typeof id !== 'string' || !PIPELINE_ID_PATTERN.test(id))) {
        throw new functions.https.HttpsError('invalid-argument', 'Expected 1-50 valid pipeline IDs');
    }
    const snapshots = await db.getAll(...pipelineIds.map((pipelineId) => db.collection('pipelines').doc(pipelineId)));
    const refreshedEntries = await Promise.all(snapshots.map(async (snapshot) => {
        if (!snapshot.exists) {
            throw new functions.https.HttpsError('not-found', 'Pipeline not found');
        }
        const pipeline = snapshot.data();
        if (pipeline.userId !== userId) {
            throw new functions.https.HttpsError('permission-denied', 'Pipeline access denied');
        }
        const inputImages = await Promise.all((pipeline.inputImages || []).map((image) => refreshPipelineAssetUrl(image.url, image.storagePath)));
        const meshImageEntries = await Promise.all(Object.entries(pipeline.meshImages || {}).map(async ([angle, image]) => [
            angle,
            image ? await refreshPipelineAssetUrl(image.url, image.storagePath) : null,
        ]));
        return [snapshot.id, {
                inputImages,
                meshImages: Object.fromEntries(meshImageEntries),
                meshUrl: await refreshPipelineAssetUrl(pipeline.meshUrl, pipeline.meshStoragePath),
                texturedModelUrl: await refreshPipelineAssetUrl(pipeline.texturedModelUrl, pipeline.texturedModelStoragePath),
            }];
    }));
    return {
        pipelines: Object.fromEntries(refreshedEntries),
        expiresAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
    };
});
/**
 * Update pipeline analysis results
 *
 * Allows users to update the image analysis and description
 * for a draft pipeline before starting generation.
 * Only works for pipelines in 'draft' status.
 */
exports.updatePipelineAnalysis = functions
    .region('asia-east1')
    .runWith({ timeoutSeconds: 30 })
    .https.onCall(async (data, context) => {
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'You must be logged in to update a pipeline');
    }
    requireVerifiedEmail(context);
    const userId = context.auth.uid;
    const { pipelineId, imageAnalysis, userDescription, selectedStyle, geminiModel } = data;
    if (selectedStyle !== undefined && !(0, styles_1.isValidStyleId)(selectedStyle)) {
        throw new functions.https.HttpsError('invalid-argument', 'Invalid figure style');
    }
    if (geminiModel !== undefined && !Object.prototype.hasOwnProperty.call(GEMINI_MODEL_CREDITS, geminiModel)) {
        throw new functions.https.HttpsError('invalid-argument', 'Invalid Gemini model');
    }
    if (!pipelineId) {
        throw new functions.https.HttpsError('invalid-argument', 'Pipeline ID is required');
    }
    if (!imageAnalysis) {
        throw new functions.https.HttpsError('invalid-argument', 'Image analysis data is required');
    }
    const pipelineRef = db.collection('pipelines').doc(pipelineId);
    const pipelineSnap = await pipelineRef.get();
    if (!pipelineSnap.exists) {
        throw new functions.https.HttpsError('not-found', 'Pipeline not found');
    }
    const pipeline = pipelineSnap.data();
    // Verify ownership
    if (pipeline.userId !== userId) {
        throw new functions.https.HttpsError('permission-denied', 'You do not have permission to update this pipeline');
    }
    // Only allow updates for draft pipelines
    if (pipeline.status !== 'draft') {
        throw new functions.https.HttpsError('failed-precondition', `Cannot update analysis for pipeline in '${pipeline.status}' status. Only draft pipelines can be updated.`);
    }
    if (geminiModel !== undefined) {
        const { userTier, isAdmin } = await getUserAccess(userId);
        if (!(0, tiers_1.canAccessViewModel)(userTier, geminiModel, isAdmin)) {
            throw new functions.https.HttpsError('permission-denied', (0, tiers_1.getTierValidationError)('viewModel', geminiModel));
        }
    }
    const colors = (0, generation_options_1.resolveGenerationColors)({ colorPalette: imageAnalysis.colorPalette });
    // Update the pipeline with new analysis
    const updateData = {
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
exports.resetPipelineStep = functions
    .region('asia-east1')
    .runWith({
    timeoutSeconds: 30,
    memory: '256MB',
})
    .https.onCall(async (data, context) => {
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'Authentication required');
    }
    requireVerifiedEmail(context);
    const userId = context.auth.uid;
    const { pipelineId, targetStep, keepResults } = data;
    if (!pipelineId) {
        throw new functions.https.HttpsError('invalid-argument', 'Pipeline ID is required');
    }
    const validTargetSteps = ['draft', 'images-ready', 'mesh-ready'];
    if (!validTargetSteps.includes(targetStep)) {
        throw new functions.https.HttpsError('invalid-argument', `Invalid target step: ${targetStep}. Must be one of: ${validTargetSteps.join(', ')}`);
    }
    // Get pipeline
    const pipelineRef = db.collection('pipelines').doc(pipelineId);
    const pipelineDoc = await pipelineRef.get();
    if (!pipelineDoc.exists) {
        throw new functions.https.HttpsError('not-found', 'Pipeline not found');
    }
    const pipeline = pipelineDoc.data();
    if (pipeline.userId !== userId) {
        throw new functions.https.HttpsError('permission-denied', 'Not your pipeline');
    }
    assertNoActiveRegeneration(pipeline);
    // Cannot reset if pipeline is currently generating
    const generatingStatuses = [
        'generating-images',
        'batch-queued',
        'batch-processing',
        'generating-mesh',
        'generating-texture',
    ];
    if (generatingStatuses.includes(pipeline.status)) {
        throw new functions.https.HttpsError('failed-precondition', `Cannot reset pipeline while in ${pipeline.status} status`);
    }
    // Prepare update data
    const updateData = {
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
    }
    else {
        // keepResults = true: Only clear error state
        // For mesh-ready, we might need to ensure mesh data is preserved
        // For images-ready, we need to ensure image data is preserved
        // The status change is the main action here
    }
    await db.runTransaction(async (transaction) => {
        const currentSnapshot = await transaction.get(pipelineRef);
        const current = currentSnapshot.data();
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
//# sourceMappingURL=pipeline.js.map