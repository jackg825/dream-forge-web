/**
 * Pipeline Handlers
 *
 * Cloud Functions for the new simplified 3D generation workflow:
 * 1. createPipeline - Initialize pipeline with uploaded images
 * 2. generatePipelineImages - Generate 6 views via Gemini (10 credits for Pro / 3 credits for Flash)
 * 3. regeneratePipelineImage - Regenerate a single view (free, max 4 times)
 * 4. startPipelineMesh - Start mesh generation (5-8 credits depending on provider)
 * 5. checkPipelineStatus - Poll status
 * 6. startPipelineTexture - Start texture generation (10 credits)
 */
import * as functions from 'firebase-functions/v1';
/**
 * Create a new pipeline
 *
 * Initializes a pipeline document with uploaded images.
 * No credits charged at this stage.
 */
export declare const createPipeline: functions.HttpsFunction & functions.Runnable<any>;
/**
 * Get pipeline details
 */
export declare const getPipeline: functions.HttpsFunction & functions.Runnable<any>;
/**
 * Get user's pipelines for dashboard
 */
export declare const getUserPipelines: functions.HttpsFunction & functions.Runnable<any>;
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
export declare const generatePipelineImages: functions.HttpsFunction & functions.Runnable<any>;
/**
 * Regenerate a single view
 *
 * Allows user to regenerate individual views without regenerating all 6.
 */
export declare const regeneratePipelineImage: functions.HttpsFunction & functions.Runnable<any>;
/**
 * Start mesh generation (5 credits)
 *
 * Uses Meshy Multi-Image-to-3D with should_texture: false
 */
export declare const startPipelineMesh: functions.HttpsFunction & functions.Runnable<any>;
/**
 * Check pipeline status
 *
 * Polls Meshy for mesh/texture generation status and downloads completed models.
 */
export declare const checkPipelineStatus: functions.HttpsFunction & functions.Runnable<any>;
/**
 * Start texture generation (10 credits)
 *
 * Uses Meshy Retexture API with texture reference images
 */
export declare const startPipelineTexture: functions.HttpsFunction & functions.Runnable<any>;
/**
 * Update pipeline analysis results
 *
 * Allows users to update the image analysis and description
 * for a draft pipeline before starting generation.
 * Only works for pipelines in 'draft' status.
 */
export declare const updatePipelineAnalysis: functions.HttpsFunction & functions.Runnable<any>;
export declare const resetPipelineStep: functions.HttpsFunction & functions.Runnable<any>;
