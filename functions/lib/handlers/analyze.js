"use strict";
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
exports.analyzeUploadedImage = void 0;
const functions = __importStar(require("firebase-functions/v1"));
const admin = __importStar(require("firebase-admin"));
const axios_1 = __importDefault(require("axios"));
const image_analyzer_1 = require("../gemini/image-analyzer");
// ============================================
// Helper Functions
// ============================================
/**
 * Download image and convert to base64
 */
async function downloadImageAsBase64(url) {
    const response = await axios_1.default.get(url, {
        responseType: 'arraybuffer',
        timeout: 30000,
    });
    const base64 = Buffer.from(response.data).toString('base64');
    const contentType = response.headers['content-type'] || 'image/png';
    return { base64, mimeType: contentType };
}
// ============================================
// Cloud Function: analyzeUploadedImage
// ============================================
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
exports.analyzeUploadedImage = functions
    .region('asia-east1')
    .runWith({
    timeoutSeconds: 120,
    memory: '512MB',
})
    .https.onCall(async (data, context) => {
    // Verify authentication
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'You must be logged in to analyze images');
    }
    const { imageUrl, colorCount = 7, printerType = 'fdm' } = data;
    // Validate input
    if (!imageUrl) {
        throw new functions.https.HttpsError('invalid-argument', 'imageUrl is required');
    }
    // Validate color count (3-12)
    const validColorCount = Math.min(12, Math.max(3, colorCount));
    functions.logger.info('Starting image analysis', {
        userId: context.auth.uid,
        colorCount: validColorCount,
        printerType,
    });
    try {
        // Download image
        const { base64, mimeType } = await downloadImageAsBase64(imageUrl);
        functions.logger.info('Image downloaded', {
            mimeType,
            base64Length: base64.length,
        });
        // Analyze image
        const analysisResult = await (0, image_analyzer_1.analyzeImage)(base64, mimeType, {
            colorCount: validColorCount,
            printerType,
        });
        // Add timestamp
        const analysis = {
            ...analysisResult,
            analyzedAt: admin.firestore.Timestamp.now(),
        };
        functions.logger.info('Image analysis complete', {
            userId: context.auth.uid,
            colorCount: analysis.colorPalette.length,
            objectType: analysis.objectType,
            printScore: analysis.printFriendliness.score,
        });
        return { analysis };
    }
    catch (error) {
        if (error instanceof functions.https.HttpsError) {
            throw error;
        }
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        functions.logger.error('Image analysis failed', {
            userId: context.auth.uid,
            error: errorMessage,
        });
        throw new functions.https.HttpsError('internal', `Image analysis failed: ${errorMessage}`);
    }
});
//# sourceMappingURL=analyze.js.map