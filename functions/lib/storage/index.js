"use strict";
/**
 * Storage Abstraction Layer
 *
 * 提供統一的儲存介面，支援 Firebase Storage 和 Cloudflare R2。
 * 透過環境變數 STORAGE_BACKEND 切換 ('firebase' | 'r2')
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
exports.R2_PUBLIC_URL = exports.STORAGE_BACKEND = void 0;
exports.uploadBuffer = uploadBuffer;
exports.uploadBase64 = uploadBase64;
exports.uploadFromUrl = uploadFromUrl;
exports.getDownloadUrl = getDownloadUrl;
exports.getSignedUrl = getSignedUrl;
exports.deleteFile = deleteFile;
exports.fileExists = fileExists;
exports.downloadFile = downloadFile;
exports.listFiles = listFiles;
exports.generateStoragePath = generateStoragePath;
exports.getStorageBackend = getStorageBackend;
const admin = __importStar(require("firebase-admin"));
const r2_client_1 = require("./r2-client");
// 從環境變數讀取，預設使用 Firebase
const STORAGE_BACKEND = process.env.STORAGE_BACKEND || 'firebase';
exports.STORAGE_BACKEND = STORAGE_BACKEND;
// R2 公開 URL (透過 Worker)
const R2_PUBLIC_URL = process.env.R2_PUBLIC_URL || 'https://storage.dreamforge.app';
exports.R2_PUBLIC_URL = R2_PUBLIC_URL;
/**
 * 上傳 Buffer 到儲存
 */
async function uploadBuffer(buffer, storagePath, contentType) {
    if (STORAGE_BACKEND === 'r2') {
        return uploadToR2(buffer, storagePath, contentType);
    }
    return uploadToFirebase(buffer, storagePath, contentType);
}
/**
 * 上傳 Base64 到儲存
 */
async function uploadBase64(base64, storagePath, contentType) {
    const buffer = Buffer.from(base64, 'base64');
    return uploadBuffer(buffer, storagePath, contentType);
}
/**
 * 從 URL 下載並上傳到儲存
 */
async function uploadFromUrl(url, storagePath, contentType) {
    if (STORAGE_BACKEND === 'r2') {
        const r2 = (0, r2_client_1.getR2Client)();
        await r2.uploadFromUrl(storagePath, url, contentType);
        return r2.getPublicUrl(storagePath);
    }
    // Firebase: 下載後上傳
    const axios = (await Promise.resolve().then(() => __importStar(require('axios')))).default;
    const response = await axios.get(url, {
        responseType: 'arraybuffer',
        timeout: 60000,
    });
    const buffer = Buffer.from(response.data);
    const type = contentType || response.headers['content-type'] || 'application/octet-stream';
    return uploadToFirebase(buffer, storagePath, type);
}
/**
 * 獲取檔案的公開 URL (或簽名 URL)
 */
async function getDownloadUrl(storagePath) {
    if (STORAGE_BACKEND === 'r2') {
        const r2 = (0, r2_client_1.getR2Client)();
        return r2.getPublicUrl(storagePath);
    }
    // Firebase: 生成簽名 URL
    const bucket = admin.storage().bucket();
    const file = bucket.file(storagePath);
    const [signedUrl] = await file.getSignedUrl({
        action: 'read',
        expires: Date.now() + 7 * 24 * 60 * 60 * 1000, // 7 days
    });
    return signedUrl;
}
/**
 * 獲取簽名 URL (用於臨時存取)
 */
async function getSignedUrl(storagePath, expiresIn = 3600) {
    if (STORAGE_BACKEND === 'r2') {
        const r2 = (0, r2_client_1.getR2Client)();
        return r2.getSignedDownloadUrl(storagePath, expiresIn);
    }
    const bucket = admin.storage().bucket();
    const file = bucket.file(storagePath);
    const [signedUrl] = await file.getSignedUrl({
        action: 'read',
        expires: Date.now() + expiresIn * 1000,
    });
    return signedUrl;
}
/**
 * 刪除檔案
 */
async function deleteFile(storagePath) {
    if (STORAGE_BACKEND === 'r2') {
        const r2 = (0, r2_client_1.getR2Client)();
        await r2.delete(storagePath);
        return;
    }
    const bucket = admin.storage().bucket();
    const file = bucket.file(storagePath);
    try {
        await file.delete();
    }
    catch (error) {
        // 忽略檔案不存在的錯誤
        if (error.code !== 404) {
            throw error;
        }
    }
}
/**
 * 檢查檔案是否存在
 */
async function fileExists(storagePath) {
    if (STORAGE_BACKEND === 'r2') {
        const r2 = (0, r2_client_1.getR2Client)();
        return r2.exists(storagePath);
    }
    const bucket = admin.storage().bucket();
    const file = bucket.file(storagePath);
    const [exists] = await file.exists();
    return exists;
}
/**
 * 下載檔案內容
 */
async function downloadFile(storagePath) {
    if (STORAGE_BACKEND === 'r2') {
        const r2 = (0, r2_client_1.getR2Client)();
        return r2.download(storagePath);
    }
    const bucket = admin.storage().bucket();
    const file = bucket.file(storagePath);
    const [buffer] = await file.download();
    return buffer;
}
/**
 * 列出指定前綴的檔案
 */
async function listFiles(prefix) {
    if (STORAGE_BACKEND === 'r2') {
        const r2 = (0, r2_client_1.getR2Client)();
        const files = await r2.list(prefix);
        return files.map((f) => ({ path: f.key, size: f.size }));
    }
    const bucket = admin.storage().bucket();
    const [files] = await bucket.getFiles({ prefix });
    return files.map((f) => ({
        path: f.name,
        size: parseInt(String(f.metadata.size || 0), 10),
    }));
}
/**
 * 生成儲存路徑
 */
function generateStoragePath(userId, prefix, filename) {
    const timestamp = Date.now();
    const sanitized = filename.replace(/[^a-zA-Z0-9._-]/g, '_');
    return `${prefix}/${userId}/${timestamp}_${sanitized}`;
}
/**
 * 獲取目前使用的儲存後端
 */
function getStorageBackend() {
    return STORAGE_BACKEND;
}
// ============================================
// 內部實作
// ============================================
/**
 * 上傳到 Firebase Storage
 */
async function uploadToFirebase(buffer, storagePath, contentType) {
    const bucket = admin.storage().bucket();
    const file = bucket.file(storagePath);
    await file.save(buffer, {
        metadata: { contentType },
    });
    const [signedUrl] = await file.getSignedUrl({
        action: 'read',
        expires: Date.now() + 7 * 24 * 60 * 60 * 1000, // 7 days
    });
    return signedUrl;
}
/**
 * 上傳到 Cloudflare R2
 */
async function uploadToR2(buffer, storagePath, contentType) {
    const r2 = (0, r2_client_1.getR2Client)();
    await r2.upload(storagePath, buffer, contentType);
    return r2.getPublicUrl(storagePath);
}
//# sourceMappingURL=index.js.map