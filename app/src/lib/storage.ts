import {
  ref,
  uploadBytesResumable,
  getDownloadURL,
  UploadTask,
} from 'firebase/storage';
import { storage } from './firebase';

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
}

export async function validateImage(file: File): Promise<ValidationResult> {
  // Check file type
  const validTypes = ['image/jpeg', 'image/png', 'image/webp'];
  if (!validTypes.includes(file.type)) {
    return {
      valid: false,
      error: 'Please upload a JPG, PNG, or WEBP image.',
    };
  }

  // Check file size (max 10MB)
  const maxSize = 10 * 1024 * 1024;
  if (file.size > maxSize) {
    return {
      valid: false,
      error: `File is too large. Maximum size is 10MB.`,
    };
  }

  // Check image dimensions
  try {
    const dimensions = await getImageDimensions(file);
    const minDim = 512;
    const maxDim = 4096;

    if (dimensions.width < minDim || dimensions.height < minDim) {
      return {
        valid: false,
        error: `Image is too small. Minimum size is ${minDim}x${minDim} pixels.`,
      };
    }

    if (dimensions.width > maxDim || dimensions.height > maxDim) {
      return {
        valid: false,
        error: `Image is too large. Maximum size is ${maxDim}x${maxDim} pixels.`,
      };
    }
  } catch {
    return {
      valid: false,
      error: 'Could not read image dimensions.',
    };
  }

  return { valid: true };
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
