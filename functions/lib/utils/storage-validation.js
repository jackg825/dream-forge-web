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
Object.defineProperty(exports, "__esModule", { value: true });
exports.extractStorageReferenceFromUrl = extractStorageReferenceFromUrl;
exports.extractStoragePathFromUrl = extractStoragePathFromUrl;
exports.assertUserStorageReference = assertUserStorageReference;
exports.assertUserStorageReferences = assertUserStorageReferences;
exports.downloadValidatedImageAsBase64 = downloadValidatedImageAsBase64;
const functions = __importStar(require("firebase-functions/v1"));
const admin = __importStar(require("firebase-admin"));
const r2_client_1 = require("../storage/r2-client");
const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
const DEFAULT_ALLOWED_IMAGE_TYPES = new Set([
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/heic',
    'image/heif',
]);
function hasBytes(buffer, offset, expected) {
    return expected.every((byte, index) => buffer[offset + index] === byte);
}
/** Validate actual image signatures for both Firebase and R2 objects. */
function hasValidImageSignature(buffer, mimeType) {
    switch (mimeType) {
        case 'image/jpeg':
            return hasBytes(buffer, 0, [0xff, 0xd8, 0xff]);
        case 'image/png':
            return hasBytes(buffer, 0, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
        case 'image/webp':
            return hasBytes(buffer, 0, [0x52, 0x49, 0x46, 0x46]) &&
                hasBytes(buffer, 8, [0x57, 0x45, 0x42, 0x50]);
        case 'image/heic':
        case 'image/heif': {
            if (!hasBytes(buffer, 4, [0x66, 0x74, 0x79, 0x70]))
                return false;
            const brand = buffer.subarray(8, 12).toString('ascii');
            return ['heic', 'heix', 'hevc', 'hevx', 'mif1', 'msf1'].includes(brand);
        }
        default:
            return false;
    }
}
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
function isAllowedR2ProxyHost(hostname) {
    const hosts = new Set([
        'dream-forge-r2-proxy.jackg825.workers.dev',
        'r2-proxy.dreamforge.app',
    ]);
    if (process.env.R2_PUBLIC_URL) {
        try {
            hosts.add(new URL(process.env.R2_PUBLIC_URL).hostname);
        }
        catch {
            // A malformed deployment variable must not broaden the allowlist.
        }
    }
    return hosts.has(hostname);
}
/**
 * Extract a storage object path from Firebase Storage, Google Storage, or R2 proxy URLs.
 */
function extractStorageReferenceFromUrl(rawUrl) {
    const trimmedUrl = rawUrl.trim();
    if (!trimmedUrl)
        return null;
    let parsedUrl;
    try {
        parsedUrl = new URL(trimmedUrl);
    }
    catch {
        return null;
    }
    if (parsedUrl.protocol !== 'https:')
        return null;
    if (parsedUrl.pathname.startsWith('/download/') && isAllowedR2ProxyHost(parsedUrl.hostname)) {
        const storagePath = normalizeStoragePath(parsedUrl.pathname.slice('/download/'.length));
        return storagePath ? { storagePath, backend: 'r2' } : null;
    }
    const r2AccountId = process.env.R2_ACCOUNT_ID;
    const r2BucketName = process.env.R2_BUCKET_NAME || 'dream-forge-storage';
    if (r2AccountId && parsedUrl.hostname === `${r2BucketName}.${r2AccountId}.r2.cloudflarestorage.com`) {
        const storagePath = normalizeStoragePath(parsedUrl.pathname);
        return storagePath ? { storagePath, backend: 'r2' } : null;
    }
    if (r2AccountId && parsedUrl.hostname === `${r2AccountId}.r2.cloudflarestorage.com`) {
        const segments = parsedUrl.pathname.split('/').filter(Boolean);
        if (segments.length < 4 || segments[0] !== r2BucketName)
            return null;
        const storagePath = normalizeStoragePath(segments.slice(1).join('/'));
        return storagePath ? { storagePath, backend: 'r2' } : null;
    }
    if (parsedUrl.hostname === 'firebasestorage.googleapis.com') {
        const bucketMatch = parsedUrl.pathname.match(/^\/v0\/b\/([^/]+)\/o\//);
        if (!bucketMatch || bucketMatch[1] !== admin.storage().bucket().name)
            return null;
        const objectMatch = parsedUrl.pathname.match(/\/o\/(.+)$/);
        const storagePath = normalizeStoragePath(objectMatch?.[1] || null);
        return storagePath ? { storagePath, backend: 'firebase' } : null;
    }
    if (parsedUrl.hostname === 'storage.googleapis.com') {
        const segments = parsedUrl.pathname.split('/').filter(Boolean);
        if (segments.length < 2 || segments[0] !== admin.storage().bucket().name)
            return null;
        const storagePath = normalizeStoragePath(segments.slice(1).join('/'));
        return storagePath ? { storagePath, backend: 'firebase' } : null;
    }
    return null;
}
function extractStoragePathFromUrl(rawUrl) {
    return extractStorageReferenceFromUrl(rawUrl)?.storagePath || null;
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
    const parsedReference = extractStorageReferenceFromUrl(reference.url);
    if (!parsedReference) {
        throw new functions.https.HttpsError('invalid-argument', 'Invalid storage URL');
    }
    let buffer;
    let mimeType;
    if (parsedReference.backend === 'r2') {
        const r2 = (0, r2_client_1.getR2Client)();
        const metadata = await r2.getMetadata(reference.storagePath);
        if (!metadata || typeof metadata.contentLength !== 'number' || metadata.contentLength > MAX_IMAGE_BYTES) {
            throw new functions.https.HttpsError('invalid-argument', 'Image is missing or too large');
        }
        buffer = await r2.download(reference.storagePath);
        mimeType = metadata.contentType || 'application/octet-stream';
    }
    else {
        const file = admin.storage().bucket().file(reference.storagePath);
        const [metadata] = await file.getMetadata();
        if (Number(metadata.size || 0) > MAX_IMAGE_BYTES) {
            throw new functions.https.HttpsError('invalid-argument', 'Image is too large');
        }
        [buffer] = await file.download();
        mimeType = metadata.contentType || 'application/octet-stream';
    }
    mimeType = mimeType.split(';')[0].trim().toLowerCase();
    if (buffer.length > MAX_IMAGE_BYTES) {
        throw new functions.https.HttpsError('invalid-argument', 'Image is too large');
    }
    if (!DEFAULT_ALLOWED_IMAGE_TYPES.has(mimeType)) {
        throw new functions.https.HttpsError('invalid-argument', 'Image URL must return a supported image type');
    }
    if (!hasValidImageSignature(buffer, mimeType)) {
        throw new functions.https.HttpsError('invalid-argument', 'Image content does not match its declared type');
    }
    return {
        ...reference,
        base64: buffer.toString('base64'),
        mimeType,
    };
}
//# sourceMappingURL=storage-validation.js.map