"use strict";
/**
 * Convert Handlers
 *
 * Cloud Functions for 3D model format conversion.
 * Primary use case: GLB to USDZ conversion for iOS AR Quick Look.
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
exports.checkUsdzAvailability = exports.convertToUsdz = void 0;
const functions = __importStar(require("firebase-functions/v1"));
const admin = __importStar(require("firebase-admin"));
const axios_1 = __importDefault(require("axios"));
const db = admin.firestore();
const storage = admin.storage();
// ============================================
// Helper Functions
// ============================================
/**
 * Check if USDZ file already exists in storage
 */
async function checkUsdzExists(userId, pipelineId) {
    const bucket = storage.bucket();
    const usdzPath = `pipelines/${userId}/${pipelineId}/mesh.usdz`;
    const file = bucket.file(usdzPath);
    const [exists] = await file.exists();
    if (!exists) {
        return { exists: false };
    }
    const [signedUrl] = await file.getSignedUrl({
        action: 'read',
        expires: Date.now() + 7 * 24 * 60 * 60 * 1000, // 7 days
    });
    return { exists: true, signedUrl };
}
/**
 * Download file from URL to buffer
 */
async function downloadFile(url) {
    const response = await axios_1.default.get(url, {
        responseType: 'arraybuffer',
        timeout: 60000, // 60 second timeout
    });
    return Buffer.from(response.data);
}
/**
 * Convert GLB to USDZ using external service
 *
 * Options:
 * 1. Cloudinary - Upload GLB, fetch as USDZ
 * 2. Self-hosted conversion service
 * 3. Third-party API
 *
 * For now, this returns an error indicating conversion is not yet implemented.
 * The actual implementation depends on which service you choose.
 */
async function convertGlbToUsdz(glbBuffer, _outputPath) {
    // TODO: Implement actual conversion using one of these options:
    //
    // Option 1: Cloudinary (recommended for simplicity)
    // - Upload GLB to Cloudinary
    // - Fetch with f_usdz transformation
    // - Download result
    //
    // Option 2: Cloud Run service with Docker
    // - Deploy gltf-to-usdz-service to Cloud Run
    // - Call the conversion API
    //
    // Option 3: Third-party API
    // - Use a service like Aspose.3D API
    // For now, throw an error indicating this needs implementation
    throw new functions.https.HttpsError('unimplemented', 'USDZ conversion is not yet implemented. Android AR is available using GLB format.');
}
// ============================================
// Cloud Functions
// ============================================
/**
 * Convert a pipeline's GLB model to USDZ format for iOS AR Quick Look.
 *
 * This function:
 * 1. Checks if USDZ already exists (returns cached URL if so)
 * 2. Downloads the GLB file
 * 3. Converts to USDZ
 * 4. Uploads to storage
 * 5. Returns signed URL
 *
 * @param pipelineId - The pipeline ID containing the GLB model
 * @returns Object containing usdzUrl and cached flag
 */
exports.convertToUsdz = functions
    .region('asia-east1')
    .runWith({
    timeoutSeconds: 120,
    memory: '1GB',
})
    .https.onCall(async (data, context) => {
    // Auth check
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'Authentication required');
    }
    const userId = context.auth.uid;
    const { pipelineId } = data;
    if (!pipelineId) {
        throw new functions.https.HttpsError('invalid-argument', 'pipelineId is required');
    }
    // Get pipeline document
    const pipelineRef = db.collection('pipelines').doc(pipelineId);
    const pipelineDoc = await pipelineRef.get();
    if (!pipelineDoc.exists) {
        throw new functions.https.HttpsError('not-found', 'Pipeline not found');
    }
    const pipeline = pipelineDoc.data();
    // Verify ownership
    if (pipeline?.userId !== userId) {
        throw new functions.https.HttpsError('permission-denied', 'You do not have access to this pipeline');
    }
    // Check if mesh URL exists
    const meshUrl = pipeline?.meshUrl;
    if (!meshUrl) {
        throw new functions.https.HttpsError('failed-precondition', 'Pipeline does not have a generated mesh');
    }
    // Check if USDZ already exists (cached)
    const cachedResult = await checkUsdzExists(userId, pipelineId);
    if (cachedResult.exists && cachedResult.signedUrl) {
        return {
            usdzUrl: cachedResult.signedUrl,
            cached: true,
        };
    }
    // Download GLB file
    let glbBuffer;
    try {
        glbBuffer = await downloadFile(meshUrl);
    }
    catch (error) {
        console.error('Failed to download GLB:', error);
        throw new functions.https.HttpsError('internal', 'Failed to download model file');
    }
    // Convert to USDZ
    const usdzPath = `pipelines/${userId}/${pipelineId}/mesh.usdz`;
    let usdzBuffer;
    try {
        usdzBuffer = await convertGlbToUsdz(glbBuffer, usdzPath);
    }
    catch (error) {
        // Re-throw HttpsError as-is
        if (error instanceof functions.https.HttpsError) {
            throw error;
        }
        console.error('USDZ conversion failed:', error);
        throw new functions.https.HttpsError('internal', 'Failed to convert model to USDZ format');
    }
    // Upload to storage
    const bucket = storage.bucket();
    const usdzFile = bucket.file(usdzPath);
    await usdzFile.save(usdzBuffer, {
        metadata: {
            contentType: 'model/vnd.usdz+zip',
        },
    });
    // Generate signed URL
    const [signedUrl] = await usdzFile.getSignedUrl({
        action: 'read',
        expires: Date.now() + 7 * 24 * 60 * 60 * 1000, // 7 days
    });
    // Update pipeline document with USDZ URL
    await pipelineRef.update({
        usdzUrl: signedUrl,
        usdzStoragePath: usdzPath,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    return {
        usdzUrl: signedUrl,
        cached: false,
    };
});
/**
 * Check if USDZ is available for a pipeline (without triggering conversion).
 *
 * Useful for checking availability before showing AR button on iOS.
 */
exports.checkUsdzAvailability = functions
    .region('asia-east1')
    .https.onCall(async (data, context) => {
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'Authentication required');
    }
    const userId = context.auth.uid;
    const { pipelineId } = data;
    if (!pipelineId) {
        throw new functions.https.HttpsError('invalid-argument', 'pipelineId is required');
    }
    const result = await checkUsdzExists(userId, pipelineId);
    return {
        available: result.exists,
        usdzUrl: result.signedUrl,
    };
});
//# sourceMappingURL=convert.js.map