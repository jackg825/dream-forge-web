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
/**
 * optimizeMeshForPrint - Main optimization function
 *
 * Optimizes a 3D model for 3D printing with options for:
 * - Mesh simplification
 * - Watertight repair
 * - Size scaling
 */
export declare const optimizeMeshForPrint: functions.HttpsFunction & functions.Runnable<any>;
/**
 * getMeshAnalysis - Analyze mesh without modifying
 *
 * Returns mesh statistics and printability analysis.
 */
export declare const analyzeMeshForPrint: functions.HttpsFunction & functions.Runnable<any>;
