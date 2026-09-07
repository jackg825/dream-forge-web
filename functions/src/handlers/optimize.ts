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

import * as functions from 'firebase-functions/v1';
import * as admin from 'firebase-admin';
import { randomUUID } from 'node:crypto';
import { assertRecord, assertDocumentId, normalizeCallableData } from '../utils/admin-validation';
import {
  optimizeMesh,
  getMeshAnalysis,
  previewOptimization,
  type MeshStats,
} from '../optimize/mesh-optimizer';
import { uploadBuffer, downloadFile } from '../storage';
import { extractStorageReferenceFromUrl } from '../utils/storage-validation';

const db = admin.firestore();

// ============================================
// Admin Check
// ============================================

/**
 * Check if the current user is an admin
 */
async function isAdmin(context: functions.https.CallableContext): Promise<boolean> {
  if (!context.auth) return false;

  const userDoc = await db.collection('users').doc(context.auth.uid).get();
  if (!userDoc.exists) return false;

  const role = userDoc.data()?.role;
  return role === 'admin';
}

// ============================================
// Types
// ============================================

interface OptimizeMeshRequest {
  /** Pipeline ID to optimize (from new pipeline system) */
  pipelineId?: string;
  /** Legacy job ID to optimize */
  jobId?: string;
  /** Direct URL to model (Firebase Storage or R2) */
  modelUrl?: string;

  /** Optimization options */
  options: {
    simplify?: {
      enabled: boolean;
      targetRatio?: number; // 0.1 - 1.0
      preserveTopology?: boolean;
    };
    repair?: {
      enabled: boolean;
      fillHoles?: boolean;
      fixNormals?: boolean;
      makeWatertight?: boolean;
    };
    scale?: {
      enabled: boolean;
      targetSize?: {
        width?: number;
        height?: number;
        depth?: number;
      };
      uniformScale?: number;
      printBedSize?: {
        width: number;
        height: number;
        depth: number;
      };
    };
  };

  /** Output format (default: stl for printing) */
  outputFormat?: 'glb' | 'stl';
  /** Only analyze and return preview, don't save */
  previewOnly?: boolean;
}

interface OptimizeMeshResponse {
  success: boolean;
  /** Preview of optimization results */
  preview: {
    original: MeshStats;
    optimized: MeshStats;
    reductionPercent: number;
    operations: string[];
    warnings: string[];
  };
  /** URL to optimized model (only if previewOnly=false) */
  optimizedModelUrl?: string;
  /** Storage path for optimized model */
  optimizedStoragePath?: string;
  /** Error message if failed */
  error?: string;
}

interface GetMeshAnalysisRequest {
  /** Pipeline ID to analyze */
  pipelineId?: string;
  /** Legacy job ID to analyze */
  jobId?: string;
  /** Direct URL to model */
  modelUrl?: string;
}

interface GetMeshAnalysisResponse {
  success: boolean;
  analysis?: MeshStats & {
    issues: string[];
    recommendations: string[];
    printabilityScore: number;
  };
  error?: string;
}

// ============================================
// Helper Functions
// ============================================

function validateModelSource(data: GetMeshAnalysisRequest): void {
  assertRecord(data);
  if (data.pipelineId !== undefined) assertDocumentId(data.pipelineId, 'Pipeline ID');
  if (data.jobId !== undefined) assertDocumentId(data.jobId, 'Job ID');
  if (data.pipelineId && data.jobId) {
    throw new functions.https.HttpsError('invalid-argument', 'Provide only one pipeline or job');
  }
  if (data.modelUrl !== undefined && (typeof data.modelUrl !== 'string' || !extractStorageReferenceFromUrl(data.modelUrl))) {
    throw new functions.https.HttpsError('invalid-argument', 'Model URL must reference approved storage');
  }
  if (!data.pipelineId && !data.jobId && !data.modelUrl) {
    throw new functions.https.HttpsError('invalid-argument', 'Must provide pipelineId, jobId, or modelUrl');
  }
}

function validateOptimization(data: OptimizeMeshRequest): void {
  validateModelSource(data);
  if (data.outputFormat !== undefined && !['stl', 'glb'].includes(data.outputFormat)) {
    throw new functions.https.HttpsError('invalid-argument', 'Output format must be stl or glb');
  }
  if (data.previewOnly !== undefined && typeof data.previewOnly !== 'boolean') {
    throw new functions.https.HttpsError('invalid-argument', 'previewOnly must be a boolean');
  }
  assertRecord(data.options, 'Optimization options');
  const { simplify, repair, scale } = data.options;
  for (const option of [simplify, repair, scale]) {
    if (option !== undefined) {
      assertRecord(option, 'Optimization option');
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
        assertRecord(dimensions, 'Dimensions');
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
async function getModelBuffer(
  pipelineId?: string,
  jobId?: string,
  modelUrl?: string
): Promise<{ buffer: Buffer; storagePath: string; sourceField?: string; backend: string } | { error: string }> {
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
        const requestedReference = extractStorageReferenceFromUrl(modelUrl);
        if (!requestedReference) {
          return { error: 'Model URL is not an approved storage URL' };
        }
        const matchingModel = storedModels.find(
          (model) => model.storagePath === requestedReference.storagePath
        );
        if (!matchingModel) {
          return { error: 'Model URL does not belong to this pipeline' };
        }
        selectedModel = matchingModel;
      }

      const reference = extractStorageReferenceFromUrl(selectedModel.url as string);
      if (!reference || reference.storagePath !== selectedModel.storagePath) {
        return { error: 'Stored model URL does not match its storage path' };
      }

      const buffer = await downloadFile(reference.storagePath, reference.backend);
      return { buffer, storagePath: reference.storagePath, sourceField: selectedModel.sourceField, backend: reference.backend };
    } catch (e) {
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
      const reference = extractStorageReferenceFromUrl(storedModelUrl);
      if (!reference) return { error: 'Job model URL is not an approved storage URL' };
      if (modelUrl) {
        const requested = extractStorageReferenceFromUrl(modelUrl);
        if (!requested || requested.storagePath !== reference.storagePath || requested.backend !== reference.backend) {
          return { error: 'Model URL does not belong to this job' };
        }
      }
      return {
        buffer: await downloadFile(reference.storagePath, reference.backend),
        storagePath: reference.storagePath,
        sourceField: job?.outputModelUrl ? 'outputModelUrl' : job?.modelUrl ? 'modelUrl' : 'result.modelUrl',
        backend: reference.backend,
      };
    } catch (e) {
      return { error: `Failed to download model: ${e}` };
    }
  }

  if (modelUrl) {
    try {
      const reference = extractStorageReferenceFromUrl(modelUrl);
      if (!reference) return { error: 'Model URL is not an approved storage URL' };
      return {
        buffer: await downloadFile(reference.storagePath, reference.backend),
        storagePath: reference.storagePath,
        backend: reference.backend,
      };
    } catch (e) {
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
export const optimizeMeshForPrint = functions
  .region('asia-east1')
  .runWith({
    timeoutSeconds: 540, // 9 minutes for large meshes
    memory: '2GB',
    secrets: ['TRIMESH_INTERNAL_TOKEN'],
  })
  .https.onCall(
    async (
      data: OptimizeMeshRequest,
      context: functions.https.CallableContext
    ): Promise<OptimizeMeshResponse> => {
      // 1. Verify authentication
      if (!context.auth) {
        throw new functions.https.HttpsError(
          'unauthenticated',
          'You must be logged in to optimize models'
        );
      }

      // 2. Verify admin role (this is an admin-only feature)
      if (!(await isAdmin(context))) {
        throw new functions.https.HttpsError(
          'permission-denied',
          'This feature is only available to administrators'
        );
      }

      data = normalizeCallableData(data);
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
          const previewResult = await previewOptimization(buffer, {
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
        const optimizationResult = await optimizeMesh(buffer, {
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
        const storagePath = `optimized/${userId}/${randomUUID()}_optimized.${extension}`;
        const contentType = outputFormat === 'stl' ? 'model/stl' : 'model/gltf-binary';

        const optimizedUrl = await uploadBuffer(
          optimizationResult.buffer,
          storagePath,
          contentType
        );

        // Save only if the source still points to the model that was optimized.
        // A confirmation during a long optimization must not attach the old result to a new mesh.
        if (pipelineId || jobId) {
          const sourceRef = db.collection(pipelineId ? 'pipelines' : 'jobs').doc((pipelineId || jobId)!);
          await db.runTransaction(async (transaction) => {
            const current = await transaction.get(sourceRef);
            const currentUrl = modelResult.sourceField ? current.get(modelResult.sourceField) : undefined;
            const reference = typeof currentUrl === 'string' ? extractStorageReferenceFromUrl(currentUrl) : null;
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
      } catch (error) {
        if (error instanceof functions.https.HttpsError) throw error;
        console.error('Optimization error:', error);

        throw new functions.https.HttpsError(
          'internal',
          error instanceof Error ? error.message : 'Optimization failed'
        );
      }
    }
  );

/**
 * getMeshAnalysis - Analyze mesh without modifying
 *
 * Returns mesh statistics and printability analysis.
 */
export const analyzeMeshForPrint = functions
  .region('asia-east1')
  .runWith({
    timeoutSeconds: 120,
    memory: '1GB',
    secrets: ['TRIMESH_INTERNAL_TOKEN'],
  })
  .https.onCall(
    async (
      data: GetMeshAnalysisRequest,
      context: functions.https.CallableContext
    ): Promise<GetMeshAnalysisResponse> => {
      // 1. Verify authentication
      if (!context.auth) {
        throw new functions.https.HttpsError(
          'unauthenticated',
          'You must be logged in to analyze models'
        );
      }

      // 2. Verify admin role (this is an admin-only feature)
      if (!(await isAdmin(context))) {
        throw new functions.https.HttpsError(
          'permission-denied',
          'This feature is only available to administrators'
        );
      }

      data = normalizeCallableData(data);
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
        const analysisResult = await getMeshAnalysis(modelResult.buffer);

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
      } catch (error) {
        if (error instanceof functions.https.HttpsError) throw error;
        console.error('Analysis error:', error);

        throw new functions.https.HttpsError(
          'internal',
          error instanceof Error ? error.message : 'Analysis failed'
        );
      }
    }
  );
