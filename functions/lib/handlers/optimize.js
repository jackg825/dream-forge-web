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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.analyzeMeshForPrint = exports.optimizeMeshForPrint = void 0;
const functions = __importStar(require("firebase-functions/v1"));
const admin = __importStar(require("firebase-admin"));
const axios_1 = __importDefault(require("axios"));
const mesh_optimizer_1 = require("../optimize/mesh-optimizer");
const storage_1 = require("../storage");
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
        // Use meshUrl or texturedModelUrl from the Pipeline document
        const pipelineModelUrl = pipeline?.meshUrl || pipeline?.texturedModelUrl;
        if (!pipelineModelUrl) {
            return { error: 'Pipeline has no model' };
        }
        try {
            // Download from URL
            const response = await axios_1.default.get(pipelineModelUrl, {
                responseType: 'arraybuffer',
                timeout: 120000,
            });
            return { buffer: Buffer.from(response.data) };
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
        const modelUrl = job?.modelUrl || job?.result?.modelUrl;
        if (!modelUrl) {
            return { error: 'Job has no model URL' };
        }
        try {
            // Download from URL
            const response = await axios_1.default.get(modelUrl, {
                responseType: 'arraybuffer',
                timeout: 120000,
            });
            return { buffer: Buffer.from(response.data) };
        }
        catch (e) {
            return { error: `Failed to download model: ${e}` };
        }
    }
    if (modelUrl) {
        try {
            // Download from direct URL
            const response = await axios_1.default.get(modelUrl, {
                responseType: 'arraybuffer',
                timeout: 120000,
            });
            return { buffer: Buffer.from(response.data) };
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
    const userId = context.auth.uid;
    const { pipelineId, jobId, modelUrl, options, outputFormat = 'stl', previewOnly = false } = data;
    // 3. Validate request
    if (!pipelineId && !jobId && !modelUrl) {
        throw new functions.https.HttpsError('invalid-argument', 'Must provide pipelineId, jobId, or modelUrl');
    }
    if (!options || (!options.simplify?.enabled && !options.repair?.enabled && !options.scale?.enabled)) {
        throw new functions.https.HttpsError('invalid-argument', 'At least one optimization option must be enabled');
    }
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
        const timestamp = Date.now();
        const extension = outputFormat;
        const storagePath = `optimized/${userId}/${timestamp}_optimized.${extension}`;
        const contentType = outputFormat === 'stl' ? 'model/stl' : 'model/gltf-binary';
        const optimizedUrl = await (0, storage_1.uploadBuffer)(optimizationResult.buffer, storagePath, contentType);
        // 7. Update pipeline/job document with optimized model info
        if (pipelineId) {
            await db.collection('pipelines').doc(pipelineId).update({
                'optimization.status': 'completed',
                'optimization.optimizedModelUrl': optimizedUrl,
                'optimization.optimizedStoragePath': storagePath,
                'optimization.preview': optimizationResult.preview,
                'optimization.completedAt': admin.firestore.FieldValue.serverTimestamp(),
            });
        }
        if (jobId) {
            await db.collection('jobs').doc(jobId).update({
                'optimization.status': 'completed',
                'optimization.optimizedModelUrl': optimizedUrl,
                'optimization.optimizedStoragePath': storagePath,
                'optimization.preview': optimizationResult.preview,
                'optimization.completedAt': admin.firestore.FieldValue.serverTimestamp(),
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
    const { pipelineId, jobId, modelUrl } = data;
    // 3. Validate request
    if (!pipelineId && !jobId && !modelUrl) {
        throw new functions.https.HttpsError('invalid-argument', 'Must provide pipelineId, jobId, or modelUrl');
    }
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
        console.error('Analysis error:', error);
        throw new functions.https.HttpsError('internal', error instanceof Error ? error.message : 'Analysis failed');
    }
});
//# sourceMappingURL=optimize.js.map