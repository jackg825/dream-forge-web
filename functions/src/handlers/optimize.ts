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
import axios from 'axios';
import {
  optimizeMesh,
  getMeshAnalysis,
  previewOptimization,
  type MeshStats,
} from '../optimize/mesh-optimizer';
import { uploadBuffer, downloadFile } from '../storage';

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

/**
 * Get model buffer from various sources
 */
async function getModelBuffer(
  pipelineId?: string,
  jobId?: string,
  modelUrl?: string
): Promise<{ buffer: Buffer; storagePath?: string } | { error: string }> {
  // Priority: pipelineId > jobId > modelUrl

  if (pipelineId) {
    // Get from pipeline document
    const pipelineDoc = await db.collection('pipelines').doc(pipelineId).get();
    if (!pipelineDoc.exists) {
      return { error: 'Pipeline not found' };
    }

    const pipeline = pipelineDoc.data();
    const modelPath = pipeline?.result?.modelPath || pipeline?.steps?.generation?.result?.modelPath;

    if (!modelPath) {
      return { error: 'Pipeline has no model' };
    }

    try {
      const buffer = await downloadFile(modelPath);
      return { buffer, storagePath: modelPath };
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
    const modelUrl = job?.modelUrl || job?.result?.modelUrl;

    if (!modelUrl) {
      return { error: 'Job has no model URL' };
    }

    try {
      // Download from URL
      const response = await axios.get(modelUrl, {
        responseType: 'arraybuffer',
        timeout: 120000,
      });
      return { buffer: Buffer.from(response.data) };
    } catch (e) {
      return { error: `Failed to download model: ${e}` };
    }
  }

  if (modelUrl) {
    try {
      // Download from direct URL
      const response = await axios.get(modelUrl, {
        responseType: 'arraybuffer',
        timeout: 120000,
      });
      return { buffer: Buffer.from(response.data) };
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

      const userId = context.auth.uid;
      const { pipelineId, jobId, modelUrl, options, outputFormat = 'stl', previewOnly = false } = data;

      // 3. Validate request
      if (!pipelineId && !jobId && !modelUrl) {
        throw new functions.https.HttpsError(
          'invalid-argument',
          'Must provide pipelineId, jobId, or modelUrl'
        );
      }

      if (!options || (!options.simplify?.enabled && !options.repair?.enabled && !options.scale?.enabled)) {
        throw new functions.https.HttpsError(
          'invalid-argument',
          'At least one optimization option must be enabled'
        );
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
        const timestamp = Date.now();
        const extension = outputFormat;
        const storagePath = `optimized/${userId}/${timestamp}_optimized.${extension}`;
        const contentType = outputFormat === 'stl' ? 'model/stl' : 'model/gltf-binary';

        const optimizedUrl = await uploadBuffer(
          optimizationResult.buffer,
          storagePath,
          contentType
        );

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
      } catch (error) {
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

      const { pipelineId, jobId, modelUrl } = data;

      // 3. Validate request
      if (!pipelineId && !jobId && !modelUrl) {
        throw new functions.https.HttpsError(
          'invalid-argument',
          'Must provide pipelineId, jobId, or modelUrl'
        );
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
        console.error('Analysis error:', error);

        throw new functions.https.HttpsError(
          'internal',
          error instanceof Error ? error.message : 'Analysis failed'
        );
      }
    }
  );
