/**
 * Image compression module for automatic resizing and format conversion
 * Uses browser-image-compression for memory-safe processing on mobile devices
 * Implements "dimension-first, quality-second" strategy to preserve image quality
 */

import imageCompression from 'browser-image-compression';

export interface CompressionOptions {
  maxEdge?: number;
  maxFileSize?: number;
  quality?: number;
}

export interface CompressionResult {
  file: File;
  wasCompressed: boolean;
  originalDimensions: { width: number; height: number };
  finalDimensions: { width: number; height: number };
}

// Conservative compression parameters optimized for AI model input
const DEFAULT_OPTIONS: Required<CompressionOptions> = {
  maxEdge: 2048,                      // Reduced from 4096 - sufficient for AI models
  maxFileSize: 10 * 1024 * 1024,      // 10MB
  quality: 0.85,                      // Starting quality
};

// Quality steps: conservative, never below 0.60 to avoid compression artifacts
const QUALITY_STEPS = [0.85, 0.78, 0.70, 0.65, 0.60];

// Dimension steps: try smaller sizes when quality reduction isn't enough
const DIMENSION_STEPS = [2048, 1536, 1280, 1024];

/**
 * Check if a file is HEIC/HEIF format
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

/**
 * Convert HEIC file to JPEG blob using dynamic import (for SSR compatibility)
 */
async function convertHeicToJpeg(file: File): Promise<Blob> {
  try {
    // Dynamic import to avoid SSR issues (heic2any uses window)
    const heic2any = (await import('heic2any')).default;
    const result = await heic2any({
      blob: file,
      toType: 'image/jpeg',
      quality: 0.92,
    });
    // heic2any can return an array for multi-frame HEIC
    return Array.isArray(result) ? result[0] : result;
  } catch (error) {
    console.error('HEIC conversion failed:', error);
    throw new Error('無法轉換 HEIC 圖片格式');
  }
}

/**
 * Load an image from a blob and get its dimensions
 */
function loadImage(blob: Blob): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(blob);

    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('無法讀取圖片'));
    };

    img.src = url;
  });
}

/**
 * Compress image using browser-image-compression with specified parameters
 */
async function compressWithParams(
  file: File,
  maxDimension: number,
  quality: number
): Promise<File> {
  const options = {
    maxSizeMB: 10,
    maxWidthOrHeight: maxDimension,
    initialQuality: quality,
    useWebWorker: true,
    fileType: 'image/webp' as const,
    alwaysKeepResolution: false,
  };

  return await imageCompression(file, options);
}

/**
 * Main compression function
 * Implements "dimension-first, quality-second" strategy:
 * 1. Try highest quality at each dimension level
 * 2. Only reduce quality if dimension reduction isn't enough
 * 3. Never go below 0.60 quality or 1024px to preserve AI model input quality
 */
export async function compressImage(
  file: File,
  options: CompressionOptions = {}
): Promise<CompressionResult> {
  const opts = { ...DEFAULT_OPTIONS, ...options };

  let processFile: File = file;
  let wasConverted = false;

  // Convert HEIC to JPEG first (browser-image-compression has limited HEIC support)
  if (isHeicFormat(file)) {
    try {
      const jpegBlob = await convertHeicToJpeg(file);
      processFile = new File(
        [jpegBlob],
        file.name.replace(/\.(heic|heif)$/i, '.jpg'),
        { type: 'image/jpeg' }
      );
      wasConverted = true;
    } catch (error) {
      console.error('HEIC conversion failed, trying direct compression:', error);
      // Continue with original file, let browser-image-compression try
    }
  }

  // Get original dimensions
  const originalImg = await loadImage(processFile);
  const originalDimensions = {
    width: originalImg.width,
    height: originalImg.height,
  };

  // Check if file already meets requirements
  if (
    processFile.size <= opts.maxFileSize &&
    originalImg.width <= opts.maxEdge &&
    originalImg.height <= opts.maxEdge &&
    processFile.type === 'image/webp'
  ) {
    return {
      file: processFile,
      wasCompressed: wasConverted,
      originalDimensions,
      finalDimensions: originalDimensions,
    };
  }

  // Try dimension-first, quality-second compression
  for (const maxDimension of DIMENSION_STEPS) {
    // Skip dimensions larger than needed
    if (maxDimension > opts.maxEdge) continue;

    for (const quality of QUALITY_STEPS) {
      try {
        const compressed = await compressWithParams(processFile, maxDimension, quality);

        if (compressed.size <= opts.maxFileSize) {
          // Success! Get final dimensions
          const finalImg = await loadImage(compressed);
          const finalDimensions = {
            width: finalImg.width,
            height: finalImg.height,
          };

          // Create file with .webp extension
          const newFileName = file.name.replace(/\.[^/.]+$/, '.webp');
          const resultFile = new File([compressed], newFileName, {
            type: 'image/webp',
          });

          return {
            file: resultFile,
            wasCompressed: true,
            originalDimensions,
            finalDimensions,
          };
        }
      } catch (error) {
        console.warn(`Compression failed at ${maxDimension}px, quality ${quality}:`, error);
        // Continue to next quality/dimension
      }
    }
  }

  // Final fallback: smallest dimension with lowest acceptable quality
  // This should always succeed for any reasonable image
  const finalCompressed = await compressWithParams(processFile, 1024, 0.60);
  const finalImg = await loadImage(finalCompressed);

  const newFileName = file.name.replace(/\.[^/.]+$/, '.webp');
  const resultFile = new File([finalCompressed], newFileName, {
    type: 'image/webp',
  });

  return {
    file: resultFile,
    wasCompressed: true,
    originalDimensions,
    finalDimensions: {
      width: finalImg.width,
      height: finalImg.height,
    },
  };
}

/**
 * Quick check if a file needs compression
 */
export async function needsCompression(file: File): Promise<boolean> {
  // HEIC always needs conversion
  if (isHeicFormat(file)) {
    return true;
  }

  // File size check
  if (file.size > DEFAULT_OPTIONS.maxFileSize) {
    return true;
  }

  // Check dimensions
  try {
    const img = await loadImage(file);
    return img.width > DEFAULT_OPTIONS.maxEdge || img.height > DEFAULT_OPTIONS.maxEdge;
  } catch {
    return false;
  }
}
