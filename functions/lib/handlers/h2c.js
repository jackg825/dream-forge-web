"use strict";
/**
 * H2C Color Optimization Cloud Functions
 *
 * Provides endpoints for optimizing images for Bambu Lab H2C
 * 7-color multi-material 3D printing
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
exports.uploadEditedH2CImage = exports.optimizeColorsForH2C = void 0;
const functions = __importStar(require("firebase-functions/v1"));
const axios_1 = __importDefault(require("axios"));
const h2c_optimizer_1 = require("../gemini/h2c-optimizer");
const credits_1 = require("../utils/credits");
const storage_1 = require("../storage");
// Credit cost for H2C operations
const H2C_CREDIT_COSTS = {
    OPTIMIZE: 1,
    // Note: 3D generation uses the existing generateModel function's credit cost
};
/**
 * Download image from URL and convert to base64
 */
async function downloadImageAsBase64(url) {
    const response = await axios_1.default.get(url, {
        responseType: 'arraybuffer',
        timeout: 30000,
    });
    const buffer = Buffer.from(response.data);
    const base64 = buffer.toString('base64');
    // Determine MIME type from content-type header or default to png
    const contentType = response.headers['content-type'] || 'image/png';
    const mimeType = contentType.split(';')[0].trim();
    return { base64, mimeType };
}
/**
 * Upload base64 image to storage (Firebase or R2)
 */
async function uploadImageToStorage(base64, mimeType, storagePath) {
    return (0, storage_1.uploadBase64)(base64, storagePath, mimeType);
}
/**
 * Cloud Function: optimizeColorsForH2C
 *
 * Optimizes an image to 7 solid colors for Bambu Lab H2C printing.
 *
 * Cost: 1 credit per optimization
 *
 * Steps:
 * 1. Verify authentication
 * 2. Deduct 1 credit
 * 3. Download original image
 * 4. Call Gemini for 7-color optimization
 * 5. Upload optimized image to Storage
 * 6. Return result with color palette
 */
exports.optimizeColorsForH2C = functions
    .region('asia-east1')
    .runWith({
    timeoutSeconds: 120,
    memory: '1GB',
    secrets: ['GEMINI_API_KEY'],
})
    .https.onCall(async (data, context) => {
    // 1. Verify authentication
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'You must be logged in to optimize images');
    }
    const userId = context.auth.uid;
    const { imageUrl, storagePath } = data;
    // Validate input
    if (!imageUrl) {
        throw new functions.https.HttpsError('invalid-argument', 'Image URL is required');
    }
    functions.logger.info('Starting H2C color optimization', {
        userId,
        hasStoragePath: !!storagePath,
    });
    // 2. Deduct credits first (fail fast if insufficient)
    // Generate a unique operation ID for tracking
    const operationId = `h2c_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    try {
        await (0, credits_1.deductCredits)(userId, H2C_CREDIT_COSTS.OPTIMIZE, operationId);
    }
    catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        functions.logger.error('Failed to deduct credits for H2C optimization', {
            userId,
            error: errorMessage,
        });
        throw new functions.https.HttpsError('failed-precondition', `Insufficient credits: ${errorMessage}`);
    }
    try {
        // 3. Download original image
        functions.logger.info('Downloading original image', { imageUrl });
        const { base64, mimeType } = await downloadImageAsBase64(imageUrl);
        // 4. Call Gemini for optimization
        functions.logger.info('Calling Gemini for H2C optimization');
        const optimizer = (0, h2c_optimizer_1.createH2CColorOptimizer)();
        const result = await optimizer.optimize(base64, mimeType);
        // 5. Upload optimized image to Storage
        const timestamp = Date.now();
        const extension = result.mimeType === 'image/jpeg' ? 'jpg' : 'png';
        const optimizedStoragePath = `h2c/${userId}/${timestamp}_optimized.${extension}`;
        functions.logger.info('Uploading optimized image to Storage', {
            storagePath: optimizedStoragePath,
        });
        const optimizedImageUrl = await uploadImageToStorage(result.imageBase64, result.mimeType, optimizedStoragePath);
        // 6. Log success and return result
        functions.logger.info('H2C optimization complete', {
            userId,
            operationId,
            colorPaletteCount: result.colorPalette.length,
            optimizedStoragePath,
        });
        return {
            success: true,
            optimizedImageUrl,
            optimizedStoragePath,
            colorPalette: result.colorPalette,
            creditsCharged: H2C_CREDIT_COSTS.OPTIMIZE,
        };
    }
    catch (error) {
        // Log error but don't refund (keep credit deduction for failed attempts)
        // This prevents abuse of free retries
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        functions.logger.error('H2C optimization failed', {
            userId,
            operationId,
            error: errorMessage,
        });
        // Re-throw HttpsError as-is, wrap other errors
        if (error instanceof functions.https.HttpsError) {
            throw error;
        }
        throw new functions.https.HttpsError('internal', `Color optimization failed: ${errorMessage}`);
    }
});
/**
 * Cloud Function: uploadEditedH2CImage
 *
 * Allows users to upload an externally edited image
 * to replace the AI-optimized version.
 *
 * Cost: Free (user provides their own edited image)
 */
exports.uploadEditedH2CImage = functions
    .region('asia-east1')
    .runWith({
    timeoutSeconds: 60,
    memory: '512MB',
})
    .https.onCall(async (data, context) => {
    // 1. Verify authentication
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'You must be logged in to upload images');
    }
    const userId = context.auth.uid;
    const { imageBase64, mimeType } = data;
    // Validate input
    if (!imageBase64) {
        throw new functions.https.HttpsError('invalid-argument', 'Image data is required');
    }
    const validMimeTypes = ['image/png', 'image/jpeg', 'image/webp'];
    const normalizedMimeType = validMimeTypes.includes(mimeType)
        ? mimeType
        : 'image/png';
    // Upload to Storage (no credit charge)
    const timestamp = Date.now();
    const extension = normalizedMimeType === 'image/jpeg'
        ? 'jpg'
        : normalizedMimeType === 'image/webp'
            ? 'webp'
            : 'png';
    const storagePath = `h2c/${userId}/${timestamp}_edited.${extension}`;
    functions.logger.info('Uploading user-edited H2C image', {
        userId,
        storagePath,
        mimeType: normalizedMimeType,
    });
    const imageUrl = await uploadImageToStorage(imageBase64, normalizedMimeType, storagePath);
    return {
        success: true,
        imageUrl,
        storagePath,
    };
});
//# sourceMappingURL=h2c.js.map