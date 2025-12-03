import {
  ref,
  uploadBytesResumable,
  getDownloadURL,
  UploadTask,
} from 'firebase/storage';
import { storage } from './firebase';
import { compressImage, type CompressionResult } from './imageCompression';

export interface UploadProgress {
  progress: number; // 0-100
  bytesTransferred: number;
  totalBytes: number;
}

export interface UploadResult {
  downloadUrl: string;
  storagePath: string;
}

/**
 * Upload an image to Firebase Storage
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
  if (!storage) {
    throw new Error('Firebase Storage is not configured');
  }

  // Generate unique filename with timestamp
  const timestamp = Date.now();
  const sanitizedName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
  const storagePath = `uploads/${userId}/${timestamp}_${sanitizedName}`;

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
  if (!storage) {
    throw new Error('Firebase Storage is not configured');
  }

  // Generate path for session view
  const timestamp = Date.now();
  const extension = file.type.split('/')[1] || 'png';
  const storagePath = `sessions/${userId}/${sessionId}/views/${angle}_${timestamp}.${extension}`;

  const storageRef = ref(storage, storagePath);
  const uploadTask: UploadTask = uploadBytesResumable(storageRef, file, {
    contentType: file.type,
  });

  return new Promise((resolve, reject) => {
    uploadTask.on(
      'state_changed',
      undefined,
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
