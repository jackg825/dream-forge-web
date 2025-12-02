/**
 * Image Analysis Handler
 *
 * Cloud Function for analyzing uploaded images using Gemini.
 * Returns structured analysis including:
 * - Object description
 * - Color palette
 * - 3D print friendliness assessment
 * - Material detection
 */
import * as functions from 'firebase-functions/v1';
/**
 * Analyze an uploaded image using Gemini
 *
 * This function:
 * 1. Downloads the image from Firebase Storage
 * 2. Sends it to Gemini for analysis
 * 3. Returns structured analysis results
 *
 * The analysis is free (no credits charged) and is used to:
 * - Pre-populate description for better AI generation
 * - Extract color palette for consistency
 * - Provide 3D print friendliness feedback
 */
export declare const analyzeUploadedImage: functions.HttpsFunction & functions.Runnable<any>;
