"use strict";
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
exports.extractStoragePathFromUrl = extractStoragePathFromUrl;
exports.assertUserStorageReference = assertUserStorageReference;
exports.assertUserStorageReferences = assertUserStorageReferences;
exports.downloadValidatedImageAsBase64 = downloadValidatedImageAsBase64;
const axios_1 = __importDefault(require("axios"));
const functions = __importStar(require("firebase-functions/v1"));
const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
const DEFAULT_ALLOWED_IMAGE_TYPES = new Set([
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/heic',
    'image/heif',
]);
function normalizeStoragePath(path) {
    if (!path)
        return null;
    let decodedPath;
    try {
        decodedPath = decodeURIComponent(path);
    }
    catch {
        return null;
    }
    const cleanPath = decodedPath.replace(/^\/+/, '');
    const segments = cleanPath.split('/').filter(Boolean);
    if (segments.length < 3 ||
        segments.some((segment) => segment === '.' || segment === '..') ||
        cleanPath.includes('\\')) {
        return null;
    }
    return segments.join('/');
}
/**
 * Extract a storage object path from Firebase Storage, Google Storage, or R2 proxy URLs.
 */
function extractStoragePathFromUrl(rawUrl) {
    const trimmedUrl = rawUrl.trim();
    if (!trimmedUrl)
        return null;
    if (trimmedUrl.startsWith('/download/')) {
        return normalizeStoragePath(trimmedUrl.slice('/download/'.length));
    }
    let parsedUrl;
    try {
        parsedUrl = new URL(trimmedUrl);
    }
    catch {
        return null;
    }
    if (parsedUrl.pathname.startsWith('/download/')) {
        return normalizeStoragePath(parsedUrl.pathname.slice('/download/'.length));
    }
    if (parsedUrl.hostname === 'firebasestorage.googleapis.com') {
        const objectMatch = parsedUrl.pathname.match(/\/o\/(.+)$/);
        return normalizeStoragePath(objectMatch?.[1] || null);
    }
    if (parsedUrl.hostname === 'storage.googleapis.com') {
        const segments = parsedUrl.pathname.split('/').filter(Boolean);
        if (segments.length < 2)
            return null;
        return normalizeStoragePath(segments.slice(1).join('/'));
    }
    return null;
}
function assertUserStorageReference(url, userId, allowedPrefixes = ['uploads']) {
    const storagePath = extractStoragePathFromUrl(url);
    const hasAllowedOwnerPrefix = storagePath
        ? allowedPrefixes.some((prefix) => storagePath.startsWith(`${prefix}/${userId}/`))
        : false;
    if (!storagePath || !hasAllowedOwnerPrefix) {
        throw new functions.https.HttpsError('invalid-argument', 'Image URL must point to a file owned by the current user');
    }
    return {
        url: url.trim(),
        storagePath,
    };
}
function assertUserStorageReferences(urls, userId, allowedPrefixes = ['uploads'], maxCount = 4) {
    if (!Array.isArray(urls) || urls.length === 0 || urls.length > maxCount) {
        throw new functions.https.HttpsError('invalid-argument', `Expected 1-${maxCount} uploaded image URL(s)`);
    }
    return urls.map((url) => assertUserStorageReference(url, userId, allowedPrefixes));
}
async function downloadValidatedImageAsBase64(url, userId, allowedPrefixes = ['uploads']) {
    const reference = assertUserStorageReference(url, userId, allowedPrefixes);
    const response = await axios_1.default.get(reference.url, {
        responseType: 'arraybuffer',
        timeout: 30000,
        maxContentLength: MAX_IMAGE_BYTES,
        maxBodyLength: MAX_IMAGE_BYTES,
        maxRedirects: 0,
        validateStatus: (status) => status >= 200 && status < 300,
    });
    const buffer = Buffer.from(response.data);
    const mimeType = String(response.headers['content-type'] || 'image/png').split(';')[0].trim();
    if (buffer.length > MAX_IMAGE_BYTES) {
        throw new functions.https.HttpsError('invalid-argument', 'Image is too large');
    }
    if (!DEFAULT_ALLOWED_IMAGE_TYPES.has(mimeType)) {
        throw new functions.https.HttpsError('invalid-argument', 'Image URL must return a supported image type');
    }
    return {
        ...reference,
        base64: buffer.toString('base64'),
        mimeType,
    };
}
//# sourceMappingURL=storage-validation.js.map