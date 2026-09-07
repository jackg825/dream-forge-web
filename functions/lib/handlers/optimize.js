"use strict";
/**
 * Cloud Functions for 3D Print Mesh Optimization (Admin Only)
 *
 * Provides server-side mesh optimization for 3D printing:
 * - Mesh simplification (reduce polygon count)
 * - Watertight repair (fill holes, fix normals)
 * - Size scaling (adjust dimensions for print bed)
 *
 * Uses gltfpack for simplification and Python Gen 2 Cloud Functions for repair/scaling.
 *
 * NOTE: These functions are admin-only features.
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
exports.analyzeMeshForPrint = exports.optimizeMeshForPrint = void 0;
const functions = __importStar(require("firebase-functions/v1"));
const admin = __importStar(require("firebase-admin"));
const node_crypto_1 = require("node:crypto");
const admin_validation_1 = require("../utils/admin-validation");
const mesh_optimizer_1 = require("../optimize/mesh-optimizer");
const storage_1 = require("../storage");
const storage_validation_1 = require("../utils/storage-validation");
const db = admin.firestore();
// ============================================
// Admin Check
// ============================================
/**
 * Check if the current user is an admin
 */
async function isAdmin(context) {
    if (!context.auth)
        return false;
    const userDoc = await db.collection('users').doc(context.auth.uid).get();
    if (!userDoc.exists)
        return false;
    const role = userDoc.data()?.role;
    return role === 'admin';
}
// ============================================
// Helper Functions
// ============================================
function validateModelSource(data) {
    (0, admin_validation_1.assertRecord)(data);
    if (data.pipelineId !== undefined)
        (0, admin_validation_1.assertDocumentId)(data.pipelineId, 'Pipeline ID');
    if (data.jobId !== undefined)
        (0, admin_validation_1.assertDocumentId)(data.jobId, 'Job ID');
    if (data.pipelineId && data.jobId) {
        throw new functions.https.HttpsError('invalid-argument', 'Provide only one pipeline or job');
    }
    if (data.modelUrl !== undefined && (typeof data.modelUrl !== 'string' || !(0, storage_validation_1.extractStorageReferenceFromUrl)(data.modelUrl))) {
        throw new functions.https.HttpsError('invalid-argument', 'Model URL must reference approved storage');
    }
    if (!data.pipelineId && !data.jobId && !data.modelUrl) {
        throw new functions.https.HttpsError('invalid-argument', 'Must provide pipelineId, jobId, or modelUrl');
    }
}
function validateOptimization(data) {
    validateModelSource(data);
    if (data.outputFormat !== undefined && !['stl', 'glb'].includes(data.outputFormat)) {
        throw new functions.https.HttpsError('invalid-argument', 'Output format must be stl or glb');
    }
    if (data.previewOnly !== undefined && typeof data.previewOnly !== 'boolean') {
        throw new functions.https.HttpsError('invalid-argument', 'previewOnly must be a boolean');
    }
    (0, admin_validation_1.assertRecord)(data.options, 'Optimization options');
    const { simplify, repair, scale } = data.options;
    for (const option of [simplify, repair, scale]) {
        if (option !== undefined) {
            (0, admin_validation_1.assertRecord)(option, 'Optimization option');
            if (typeof option.enabled !== 'boolean') {
                throw new functions.https.HttpsError('invalid-argument', 'Option enabled must be a boolean');
            }
        }
    }
    if (!simplify?.enabled && !repair?.enabled && !scale?.enabled) {
        throw new functions.https.HttpsError('invalid-argument', 'At least one optimization option must be enabled');
    }
    if (simplify?.targetRatio !== undefined &&
        (!Number.isFinite(simplify.targetRatio) || simplify.targetRatio < 0.1 || simplify.targetRatio > 1)) {
        throw new functions.https.HttpsError('invalid-argument', 'Simplification ratio must be between 0.1 and 1');
    }
    for (const value of [simplify?.preserveTopology, repair?.fillHoles, repair?.fixNormals, repair?.makeWatertight]) {
        if (value !== undefined && typeof value !== 'boolean') {
            throw new functions.https.HttpsError('invalid-argument', 'Optimization flags must be booleans');
        }
    }
    if (scale) {
        for (const dimensions of [scale.targetSize, scale.printBedSize]) {
            if (dimensions !== undefined) {
                (0, admin_validation_1.assertRecord)(dimensions, 'Dimensions');
                const values = [dimensions.width, dimensions.height, dimensions.depth];
                if (!values.some((value) => value !== undefined) ||
                    values.some((value) => value !== undefined && (typeof value !== 'number' || !Number.isFinite(value) || value <= 0)) ||
                    (dimensions === scale.printBedSize && values.some((value) => value === undefined))) {
                    throw new functions.https.HttpsError('invalid-argument', 'Dimensions must contain positive finite sizes');
                }
            }
        }
        if (scale.uniformScale !== undefined && (!Number.isFinite(scale.uniformScale) || scale.uniformScale <= 0)) {
            throw new functions.https.HttpsError('invalid-argument', 'Scale factor must be a positive finite number');
        }
        if (scale.enabled && !scale.targetSize && !scale.printBedSize && scale.uniformScale === undefined) {
            throw new functions.https.HttpsError('invalid-argument', 'Scaling requires a target size, print bed or scale factor');
        }
    }
}
/**
 * Get model buffer from various sources
 */
async function getModelBuffer(pipelineId, jobId, modelUrl) {
    // Priority: pipelineId > jobId > modelUrl
    if (pipelineId) {
        // Get from pipeline document
        const pipelineDoc = await db.collection('pipelines').doc(pipelineId).get();
        if (!pipelineDoc.exists) {
            return { error: 'Pipeline not found' };
        }
        const pipeline = pipelineDoc.data();
        const storedModels = [
            {
                sourceField: 'texturedModelUrl',
                storagePath: pipeline?.texturedModelStoragePath,
                url: pipeline?.texturedModelUrl,
            },
            {
                sourceField: 'meshUrl',
                storagePath: pipeline?.meshStoragePath,
                url: pipeline?.meshUrl,
            },
        ].filter((model) => typeof model.storagePath === 'string' && typeof model.url === 'string');
        if (storedModels.length === 0) {
            return { error: 'Pipeline has no model storage path' };
        }
        try {
            let selectedModel = storedModels[0];
            if (modelUrl) {
                const requestedReference = (0, storage_validation_1.extractStorageReferenceFromUrl)(modelUrl);
                if (!requestedReference) {
                    return { error: 'Model URL is not an approved storage URL' };
                }
                const matchingModel = storedModels.find((model) => model.storagePath === requestedReference.storagePath);
                if (!matchingModel) {
                    return { error: 'Model URL does not belong to this pipeline' };
                }
                selectedModel = matchingModel;
            }
            const reference = (0, storage_validation_1.extractStorageReferenceFromUrl)(selectedModel.url);
            if (!reference || reference.storagePath !== selectedModel.storagePath) {
                return { error: 'Stored model URL does not match its storage path' };
            }
            const buffer = await (0, storage_1.downloadFile)(reference.storagePath, reference.backend);
            return { buffer, storagePath: reference.storagePath, sourceField: selectedModel.sourceField, backend: reference.backend };
        }
        catch (e) {
            return { error: `Failed to download model: ${e}` };
        }
    }
    if (jobId) {
        // Get from legacy job document
        const jobDoc = await db.collection('jobs').doc(jobId).get();
        if (!jobDoc.exists) {
            return { error: 'Job not found' };
        }
        const job = jobDoc.data();
        const storedModelUrl = job?.outputModelUrl || job?.modelUrl || job?.result?.modelUrl;
        if (!storedModelUrl) {
            return { error: 'Job has no model URL' };
        }
        try {
            const reference = (0, storage_validation_1.extractStorageReferenceFromUrl)(storedModelUrl);
            if (!reference)
                return { error: 'Job model URL is not an approved storage URL' };
            if (modelUrl) {
                const requested = (0, storage_validation_1.extractStorageReferenceFromUrl)(modelUrl);
                if (!requested || requested.storagePath !== reference.storagePath || requested.backend !== reference.backend) {
                    return { error: 'Model URL does not belong to this job' };
                }
            }
            return {
                buffer: await (0, storage_1.downloadFile)(reference.storagePath, reference.backend),
                storagePath: reference.storagePath,
                sourceField: job?.outputModelUrl ? 'outputModelUrl' : job?.modelUrl ? 'modelUrl' : 'result.modelUrl',
                backend: reference.backend,
            };
        }
        catch (e) {
            return { error: `Failed to download model: ${e}` };
        }
    }
    if (modelUrl) {
        try {
            const reference = (0, storage_validation_1.extractStorageReferenceFromUrl)(modelUrl);
            if (!reference)
                return { error: 'Model URL is not an approved storage URL' };
            return {
                buffer: await (0, storage_1.downloadFile)(reference.storagePath, reference.backend),
                storagePath: reference.storagePath,
                backend: reference.backend,
            };
        }
        catch (e) {
            return { error: `Failed to download model: ${e}` };
        }
    }
    return { error: 'No model source specified (pipelineId, jobId, or modelUrl required)' };
}
// ============================================
// Cloud Functions
// ============================================
/**
 * optimizeMeshForPrint - Main optimization function
 *
 * Optimizes a 3D model for 3D printing with options for:
 * - Mesh simplification
 * - Watertight repair
 * - Size scaling
 */
exports.optimizeMeshForPrint = functions
    .region('asia-east1')
    .runWith({
    timeoutSeconds: 540, // 9 minutes for large meshes
    memory: '2GB',
    secrets: ['TRIMESH_INTERNAL_TOKEN'],
})
    .https.onCall(async (data, context) => {
    // 1. Verify authentication
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'You must be logged in to optimize models');
    }
    // 2. Verify admin role (this is an admin-only feature)
    if (!(await isAdmin(context))) {
        throw new functions.https.HttpsError('permission-denied', 'This feature is only available to administrators');
    }
    data = (0, admin_validation_1.normalizeCallableData)(data);
    validateOptimization(data);
    const userId = context.auth.uid;
    const { pipelineId, jobId, modelUrl, options, outputFormat = 'stl', previewOnly = false } = data;
    try {
        // 3. Get model buffer
        const modelResult = await getModelBuffer(pipelineId, jobId, modelUrl);
        if ('error' in modelResult) {
            return {
                success: false,
                error: modelResult.error,
                preview: {
                    original: {
                        vertexCount: 0,
                        faceCount: 0,
                        boundingBox: { width: 0, height: 0, depth: 0 },
                        isWatertight: false,
                        volume: null,
                    },
                    optimized: {
                        vertexCount: 0,
                        faceCount: 0,
                        boundingBox: { width: 0, height: 0, depth: 0 },
                        isWatertight: false,
                        volume: null,
                    },
                    reductionPercent: 0,
                    operations: [],
                    warnings: [modelResult.error],
                },
            };
        }
        const { buffer } = modelResult;
        // 4. If preview only, just analyze
        if (previewOnly) {
            const previewResult = await (0, mesh_optimizer_1.previewOptimization)(buffer, {
                simplify: options.simplify,
                repair: options.repair,
                scale: options.scale,
                outputFormat,
            });
            if (!previewResult.success || !previewResult.preview) {
                return {
                    success: false,
                    error: previewResult.error || 'Preview failed',
                    preview: {
                        original: {
                            vertexCount: 0,
                            faceCount: 0,
                            boundingBox: { width: 0, height: 0, depth: 0 },
                            isWatertight: false,
                            volume: null,
                        },
                        optimized: {
                            vertexCount: 0,
                            faceCount: 0,
                            boundingBox: { width: 0, height: 0, depth: 0 },
                            isWatertight: false,
                            volume: null,
                        },
                        reductionPercent: 0,
                        operations: [],
                        warnings: [],
                    },
                };
            }
            return {
                success: true,
                preview: {
                    original: previewResult.preview.original,
                    optimized: {
                        ...previewResult.preview.original,
                        faceCount: previewResult.preview.estimatedOptimized.faceCount,
                        isWatertight: previewResult.preview.estimatedOptimized.isWatertight,
                    },
                    reductionPercent: previewResult.preview.estimatedReductionPercent,
                    operations: [],
                    warnings: [],
                },
            };
        }
        // 5. Run full optimization
        const optimizationResult = await (0, mesh_optimizer_1.optimizeMesh)(buffer, {
            simplify: options.simplify,
            repair: options.repair,
            scale: options.scale,
            outputFormat,
        });
        if (!optimizationResult.success || !optimizationResult.buffer) {
            return {
                success: false,
                error: optimizationResult.error || 'Optimization failed',
                preview: optimizationResult.preview,
            };
        }
        // 6. Upload optimized model
        const extension = outputFormat;
        const storagePath = `optimized/${userId}/${(0, node_crypto_1.randomUUID)()}_optimized.${extension}`;
        const contentType = outputFormat === 'stl' ? 'model/stl' : 'model/gltf-binary';
        const optimizedUrl = await (0, storage_1.uploadBuffer)(optimizationResult.buffer, storagePath, contentType);
        // Save only if the source still points to the model that was optimized.
        // A confirmation during a long optimization must not attach the old result to a new mesh.
        if (pipelineId || jobId) {
            const sourceRef = db.collection(pipelineId ? 'pipelines' : 'jobs').doc((pipelineId || jobId));
            await db.runTransaction(async (transaction) => {
                const current = await transaction.get(sourceRef);
                const currentUrl = modelResult.sourceField ? current.get(modelResult.sourceField) : undefined;
                const reference = typeof currentUrl === 'string' ? (0, storage_validation_1.extractStorageReferenceFromUrl)(currentUrl) : null;
                if (!reference || reference.storagePath !== modelResult.storagePath || reference.backend !== modelResult.backend) {
                    throw new functions.https.HttpsError('aborted', 'The source model changed during optimization; optimize the current model again');
                }
                transaction.update(sourceRef, {
                    'optimization.status': 'completed',
                    'optimization.optimizedModelUrl': optimizedUrl,
                    'optimization.optimizedStoragePath': storagePath,
                    'optimization.preview': optimizationResult.preview,
                    'optimization.completedAt': admin.firestore.FieldValue.serverTimestamp(),
                });
            });
        }
        return {
            success: true,
            preview: optimizationResult.preview,
            optimizedModelUrl: optimizedUrl,
            optimizedStoragePath: storagePath,
        };
    }
    catch (error) {
        if (error instanceof functions.https.HttpsError)
            throw error;
        console.error('Optimization error:', error);
        throw new functions.https.HttpsError('internal', error instanceof Error ? error.message : 'Optimization failed');
    }
});
/**
 * getMeshAnalysis - Analyze mesh without modifying
 *
 * Returns mesh statistics and printability analysis.
 */
exports.analyzeMeshForPrint = functions
    .region('asia-east1')
    .runWith({
    timeoutSeconds: 120,
    memory: '1GB',
    secrets: ['TRIMESH_INTERNAL_TOKEN'],
})
    .https.onCall(async (data, context) => {
    // 1. Verify authentication
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'You must be logged in to analyze models');
    }
    // 2. Verify admin role (this is an admin-only feature)
    if (!(await isAdmin(context))) {
        throw new functions.https.HttpsError('permission-denied', 'This feature is only available to administrators');
    }
    data = (0, admin_validation_1.normalizeCallableData)(data);
    validateModelSource(data);
    const { pipelineId, jobId, modelUrl } = data;
    try {
        // 3. Get model buffer
        const modelResult = await getModelBuffer(pipelineId, jobId, modelUrl);
        if ('error' in modelResult) {
            return {
                success: false,
                error: modelResult.error,
            };
        }
        // 4. Analyze mesh
        const analysisResult = await (0, mesh_optimizer_1.getMeshAnalysis)(modelResult.buffer);
        if (!analysisResult.success || !analysisResult.analysis) {
            return {
                success: false,
                error: analysisResult.error || 'Analysis failed',
            };
        }
        return {
            success: true,
            analysis: analysisResult.analysis,
        };
    }
    catch (error) {
        if (error instanceof functions.https.HttpsError)
            throw error;
        console.error('Analysis error:', error);
        throw new functions.https.HttpsError('internal', error instanceof Error ? error.message : 'Analysis failed');
    }
});
//# sourceMappingURL=optimize.js.map