import {
  ref,
  uploadBytesResumable,
  getDownloadURL,
  UploadTask,
} from 'firebase/storage';
import { storage, auth } from './firebase';
import { compressImage, type CompressionResult } from './imageCompression';

// Storage backend configuration
const STORAGE_BACKEND = process.env.NEXT_PUBLIC_STORAGE_BACKEND || 'firebase';
const R2_WORKER_URL = process.env.NEXT_PUBLIC_R2_WORKER_URL || 'https://r2-proxy.dreamforge.app';

export interface UploadProgress {
  progress: number; // 0-100
  bytesTransferred: number;
  totalBytes: number;
}

export interface UploadResult {
  downloadUrl: string;
  storagePath: string;
}

// ============================================
// R2 Upload Functions
// ============================================

interface PresignResponse {
  uploadUrl: string;
  downloadUrl: string;
  storagePath: string;
  expiresAt: string;
}

/**
 * Get Firebase ID token for R2 Worker authentication
 */
async function getIdToken(): Promise<string> {
  if (!auth) {
    throw new Error('Firebase Auth is not initialized');
  }
  const user = auth.currentUser;
  if (!user) {
    throw new Error('User not authenticated');
  }
  return user.getIdToken();
}

/**
 * Request a presigned upload URL from R2 Worker
 */
async function getPresignedUploadUrl(
  storagePath: string,
  contentType: string,
  contentLength: number
): Promise<PresignResponse> {
  const token = await getIdToken();

  const response = await fetch(`${R2_WORKER_URL}/upload/presign`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      path: storagePath,
      contentType,
      contentLength,
    }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: 'Unknown error' }));
    throw new Error(error.message || `Failed to get presigned URL: ${response.status}`);
  }

  return response.json();
}

/**
 * Confirm upload completion with R2 Worker
 */
async function confirmUpload(storagePath: string): Promise<{ downloadUrl: string }> {
  const token = await getIdToken();

  const response = await fetch(`${R2_WORKER_URL}/upload/confirm`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ path: storagePath }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: 'Unknown error' }));
    throw new Error(error.message || `Failed to confirm upload: ${response.status}`);
  }

  return response.json();
}

/**
 * Upload file to R2 using presigned URL
 */
async function uploadToR2(
  file: File,
  storagePath: string,
  onProgress?: (progress: UploadProgress) => void
): Promise<UploadResult> {
  // Get presigned URL
  const presign = await getPresignedUploadUrl(
    storagePath,
    file.type,
    file.size
  );

  // Upload using XMLHttpRequest for progress tracking
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();

    xhr.upload.addEventListener('progress', (event) => {
      if (event.lengthComputable && onProgress) {
        onProgress({
          progress: (event.loaded / event.total) * 100,
          bytesTransferred: event.loaded,
          totalBytes: event.total,
        });
      }
    });

    xhr.addEventListener('load', async () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          // Confirm upload and get final download URL
          const { downloadUrl } = await confirmUpload(storagePath);
          resolve({
            downloadUrl,
            storagePath: presign.storagePath,
          });
        } catch (error) {
          reject(error);
        }
      } else {
        reject(new Error(`Upload failed: ${xhr.status} ${xhr.statusText}`));
      }
    });

    xhr.addEventListener('error', () => {
      reject(new Error('Upload failed due to network error'));
    });

    xhr.addEventListener('abort', () => {
      reject(new Error('Upload was cancelled'));
    });

    xhr.open('PUT', presign.uploadUrl);
    xhr.setRequestHeader('Content-Type', file.type);
    xhr.send(file);
  });
}

// ============================================
// Firebase Upload Functions
// ============================================

/**
 * Upload file to Firebase Storage
 */
async function uploadToFirebase(
  file: File,
  storagePath: string,
  onProgress?: (progress: UploadProgress) => void
): Promise<UploadResult> {
  if (!storage) {
    throw new Error('Firebase Storage is not configured');
  }

  const storageRef = ref(storage, storagePath);
  const uploadTask: UploadTask = uploadBytesResumable(storageRef, file, {
    contentType: file.type,
  });

  return new Promise((resolve, reject) => {
    uploadTask.on(
      'state_changed',
      (snapshot) => {
        const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
        onProgress?.({
          progress,
          bytesTransferred: snapshot.bytesTransferred,
          totalBytes: snapshot.totalBytes,
        });
      },
      (error) => {
        console.error('Upload error:', error);
        reject(new Error(getUploadErrorMessage(error)));
      },
      async () => {
        try {
          const downloadUrl = await getDownloadURL(uploadTask.snapshot.ref);
          resolve({ downloadUrl, storagePath });
        } catch (error) {
          reject(error);
        }
      }
    );
  });
}

// ============================================
// Public API
// ============================================

/**
 * Get current storage backend
 */
export function getStorageBackend(): 'firebase' | 'r2' {
  return STORAGE_BACKEND as 'firebase' | 'r2';
}

/**
 * Upload an image to storage (Firebase or R2 based on configuration)
 *
 * @param file - The file to upload
 * @param userId - The user's ID for path organization
 * @param onProgress - Optional callback for upload progress
 * @returns Promise with download URL and storage path
 */
export async function uploadImage(
  file: File,
  userId: string,
  onProgress?: (progress: UploadProgress) => void
): Promise<UploadResult> {
  // Generate unique filename with timestamp
  const timestamp = Date.now();
  const sanitizedName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
  const storagePath = `uploads/${userId}/${timestamp}_${sanitizedName}`;

  // Use R2 or Firebase based on configuration
  if (STORAGE_BACKEND === 'r2') {
    return uploadToR2(file, storagePath, onProgress);
  }

  return uploadToFirebase(file, storagePath, onProgress);
}

/**
 * Validate an image file before upload
 */
export interface ValidationResult {
  valid: boolean;
  error?: string;
  file?: File;
  compressionResult?: CompressionResult;
}

/**
 * Check if a file type is supported (including HEIC for auto-conversion)
 */
function isHeicFormat(file: File): boolean {
  const type = file.type.toLowerCase();
  const name = file.name.toLowerCase();
  return (
    type === 'image/heic' ||
    type === 'image/heif' ||
    name.endsWith('.heic') ||
    name.endsWith('.heif')
  );
}

export async function validateImage(file: File): Promise<ValidationResult> {
  // Check file type (now including HEIC/HEIF for auto-conversion)
  const validTypes = ['image/jpeg', 'image/png', 'image/webp'];
  const isHeic = isHeicFormat(file);

  if (!validTypes.includes(file.type) && !isHeic) {
    return {
      valid: false,
      error: 'Please upload a JPG, PNG, WEBP, or HEIC image.',
    };
  }

  // Auto-compress the image (handles HEIC conversion, resizing, and WebP output)
  try {
    const compressionResult = await compressImage(file);
    const processedFile = compressionResult.file;

    // Check file size after compression
    const maxSize = 10 * 1024 * 1024;
    if (processedFile.size > maxSize) {
      return {
        valid: false,
        error: 'Image could not be compressed below 10MB. Please try a smaller image.',
      };
    }

    // Check dimensions after compression
    const minDim = 512;
    const { width, height } = compressionResult.finalDimensions;

    if (width < minDim || height < minDim) {
      return {
        valid: false,
        error: `Image is too small. Minimum size is ${minDim}x${minDim} pixels.`,
      };
    }

    return {
      valid: true,
      file: processedFile,
      compressionResult,
    };
  } catch (error) {
    console.error('Image processing error:', error);
    return {
      valid: false,
      error: error instanceof Error ? error.message : 'Could not process image.',
    };
  }
}

/**
 * Get image dimensions from a file
 */
function getImageDimensions(file: File): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      resolve({ width: img.width, height: img.height });
    };
    img.onerror = () => {
      reject(new Error('Failed to load image'));
    };
    img.src = URL.createObjectURL(file);
  });
}

/**
 * Upload a view image for a session
 * Uses a specific path structure for session views
 *
 * @param file - The file to upload
 * @param userId - The user's ID
 * @param sessionId - The session ID
 * @param angle - The view angle name
 * @returns Promise with download URL and storage path
 */
export async function uploadSessionView(
  file: File,
  userId: string,
  sessionId: string,
  angle: string
): Promise<UploadResult> {
  // Generate path for session view
  const timestamp = Date.now();
  const extension = file.type.split('/')[1] || 'png';
  const storagePath = `sessions/${userId}/${sessionId}/views/${angle}_${timestamp}.${extension}`;

  // Use R2 or Firebase based on configuration
  if (STORAGE_BACKEND === 'r2') {
    return uploadToR2(file, storagePath);
  }

  return uploadToFirebase(file, storagePath);
}

/**
 * Get human-readable error message for upload errors
 */
function getUploadErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    const code = (error as { code?: string }).code;

    switch (code) {
      case 'storage/unauthorized':
        return 'You do not have permission to upload files.';
      case 'storage/canceled':
        return 'Upload was cancelled.';
      case 'storage/quota-exceeded':
        return 'Storage quota exceeded.';
      case 'storage/invalid-checksum':
        return 'File checksum failed. Please try again.';
      case 'storage/retry-limit-exceeded':
        return 'Upload failed after multiple attempts. Please try again.';
      default:
        return error.message || 'Upload failed. Please try again.';
    }
  }
  return 'Upload failed. Please try again.';
}
