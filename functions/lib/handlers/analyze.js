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
Object.defineProperty(exports, "__esModule", { value: true });
exports.analyzeUploadedImage = void 0;
const functions = __importStar(require("firebase-functions/v1"));
const admin = __importStar(require("firebase-admin"));
const image_analyzer_1 = require("../gemini/image-analyzer");
const storage_validation_1 = require("../utils/storage-validation");
const styles_1 = require("../config/styles");
const MAX_ANALYSES_PER_UTC_DAY = 10;
const ANALYSIS_COOLDOWN_MS = 10_000;
const SUPPORTED_PRINTER_TYPES = new Set(['fdm', 'sla', 'resin']);
const SUPPORTED_LOCALES = new Set(['zh-TW', 'en']);
async function reserveAnalysisQuota(userId) {
    const db = admin.firestore();
    const userRef = db.collection('users').doc(userId);
    const now = admin.firestore.Timestamp.now();
    const quotaDay = now.toDate().toISOString().slice(0, 10);
    await db.runTransaction(async (transaction) => {
        const userSnapshot = await transaction.get(userRef);
        if (!userSnapshot.exists) {
            throw new functions.https.HttpsError('failed-precondition', 'User profile is not ready');
        }
        const user = userSnapshot.data() || {};
        const currentCount = user.analysisQuotaDay === quotaDay
            ? Number(user.analysisQuotaCount || 0)
            : 0;
        const lastAnalysisAt = user.lastAnalysisAt;
        if (lastAnalysisAt &&
            now.toMillis() - lastAnalysisAt.toMillis() < ANALYSIS_COOLDOWN_MS) {
            throw new functions.https.HttpsError('resource-exhausted', 'Please wait before analyzing another image');
        }
        if (currentCount >= MAX_ANALYSES_PER_UTC_DAY) {
            throw new functions.https.HttpsError('resource-exhausted', 'Daily image analysis limit reached');
        }
        transaction.update(userRef, {
            analysisQuotaDay: quotaDay,
            analysisQuotaCount: currentCount + 1,
            lastAnalysisAt: now,
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
    });
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
 * The analysis does not consume generation credits, but is email-verified and
 * rate-limited to protect the paid provider from automated abuse. It is used to:
 * - Pre-populate description for better AI generation
 * - Extract color palette for consistency
 * - Provide 3D print friendliness feedback
 */
exports.analyzeUploadedImage = functions
    .region('asia-east1')
    .runWith({
    timeoutSeconds: 120,
    memory: '512MB',
    secrets: ['GEMINI_API_KEY'],
})
    .https.onCall(async (data, context) => {
    // Verify authentication
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'You must be logged in to analyze images');
    }
    if (context.auth.token.email_verified !== true) {
        throw new functions.https.HttpsError('failed-precondition', 'Verify your email before analyzing images');
    }
    const userId = context.auth.uid;
    const { imageUrl, colorCount = 7, printerType = 'fdm', locale = 'zh-TW', selectedStyle } = data || {};
    // Validate input
    if (!imageUrl) {
        throw new functions.https.HttpsError('invalid-argument', 'imageUrl is required');
    }
    if (!Number.isInteger(colorCount) || colorCount < 3 || colorCount > 12) {
        throw new functions.https.HttpsError('invalid-argument', 'colorCount must be an integer from 3 to 12');
    }
    if (!SUPPORTED_PRINTER_TYPES.has(printerType)) {
        throw new functions.https.HttpsError('invalid-argument', 'Unsupported printer type');
    }
    if (!SUPPORTED_LOCALES.has(locale)) {
        throw new functions.https.HttpsError('invalid-argument', 'Unsupported locale');
    }
    if (selectedStyle !== undefined && !(0, styles_1.isValidStyleId)(selectedStyle)) {
        throw new functions.https.HttpsError('invalid-argument', 'Unsupported style');
    }
    await reserveAnalysisQuota(userId);
    functions.logger.info('Starting image analysis', {
        userId,
        colorCount,
        printerType,
        selectedStyle: selectedStyle || 'none',
    });
    try {
        // Download image
        const { base64, mimeType, storagePath } = await (0, storage_validation_1.downloadValidatedImageAsBase64)(imageUrl, userId, ['uploads']);
        functions.logger.info('Image downloaded', {
            mimeType,
            base64Length: base64.length,
            storagePath,
        });
        // Analyze image with optional style context
        const analysisResult = await (0, image_analyzer_1.analyzeImage)(base64, mimeType, {
            colorCount,
            printerType,
            locale,
            selectedStyle,
        });
        // Add timestamp
        const analysis = {
            ...analysisResult,
            analyzedAt: admin.firestore.Timestamp.now(),
        };
        functions.logger.info('Image analysis complete', {
            userId,
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
            userId,
            error: errorMessage,
        });
        throw new functions.https.HttpsError('internal', 'Image analysis failed');
    }
});
//# sourceMappingURL=analyze.js.map