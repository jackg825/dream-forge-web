/**
 * Image compression module for automatic resizing and format conversion
 * Handles HEIC conversion, dimension constraints, and WebP output
 */

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

const DEFAULT_OPTIONS: Required<CompressionOptions> = {
  maxEdge: 4096,
  maxFileSize: 10 * 1024 * 1024, // 10MB
  quality: 0.88,
};

const QUALITY_STEPS = [0.88, 0.82, 0.75, 0.65, 0.55];
const MAX_CANVAS_SIZE = 16000;

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
 * Calculate new dimensions maintaining aspect ratio
 */
function calculateTargetDimensions(
  width: number,
  height: number,
  maxEdge: number
): { width: number; height: number; needsResize: boolean } {
  if (width <= maxEdge && height <= maxEdge) {
    return { width, height, needsResize: false };
  }

  const ratio = Math.min(maxEdge / width, maxEdge / height);
  return {
    width: Math.round(width * ratio),
    height: Math.round(height * ratio),
    needsResize: true,
  };
}

/**
 * Resize image using canvas and convert to WebP
 */
async function resizeAndConvert(
  img: HTMLImageElement,
  targetWidth: number,
  targetHeight: number,
  quality: number
): Promise<Blob> {
  const canvas = document.createElement('canvas');
  canvas.width = targetWidth;
  canvas.height = targetHeight;

  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Canvas context not available');
  }

  // Use high-quality image smoothing
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';

  ctx.drawImage(img, 0, 0, targetWidth, targetHeight);

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) {
          resolve(blob);
        } else {
          reject(new Error('Failed to create blob'));
        }
      },
      'image/webp',
      quality
    );
  });
}

/**
 * Multi-pass resize for very large images
 */
async function multiPassResize(
  img: HTMLImageElement,
  targetWidth: number,
  targetHeight: number,
  quality: number
): Promise<Blob> {
  let currentWidth = img.width;
  let currentHeight = img.height;
  let currentSource: HTMLImageElement | HTMLCanvasElement = img;

  // Calculate how many passes we need
  while (currentWidth > MAX_CANVAS_SIZE || currentHeight > MAX_CANVAS_SIZE) {
    // Halve the dimensions
    currentWidth = Math.round(currentWidth / 2);
    currentHeight = Math.round(currentHeight / 2);

    const canvas = document.createElement('canvas');
    canvas.width = currentWidth;
    canvas.height = currentHeight;

    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas context not available');

    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(currentSource, 0, 0, currentWidth, currentHeight);

    currentSource = canvas;
  }

  // Final resize to target dimensions
  const finalCanvas = document.createElement('canvas');
  finalCanvas.width = targetWidth;
  finalCanvas.height = targetHeight;

  const ctx = finalCanvas.getContext('2d');
  if (!ctx) throw new Error('Canvas context not available');

  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(currentSource, 0, 0, targetWidth, targetHeight);

  return new Promise((resolve, reject) => {
    finalCanvas.toBlob(
      (blob) => {
        if (blob) {
          resolve(blob);
        } else {
          reject(new Error('Failed to create blob'));
        }
      },
      'image/webp',
      quality
    );
  });
}

/**
 * Compress blob to fit within file size limit
 */
async function compressToSize(
  img: HTMLImageElement,
  targetWidth: number,
  targetHeight: number,
  maxSize: number
): Promise<Blob> {
  for (const quality of QUALITY_STEPS) {
    let blob: Blob;

    if (img.width > MAX_CANVAS_SIZE || img.height > MAX_CANVAS_SIZE) {
      blob = await multiPassResize(img, targetWidth, targetHeight, quality);
    } else {
      blob = await resizeAndConvert(img, targetWidth, targetHeight, quality);
    }

    if (blob.size <= maxSize) {
      return blob;
    }
  }

  // Return lowest quality if still over size
  if (img.width > MAX_CANVAS_SIZE || img.height > MAX_CANVAS_SIZE) {
    return multiPassResize(img, targetWidth, targetHeight, QUALITY_STEPS[QUALITY_STEPS.length - 1]);
  }
  return resizeAndConvert(img, targetWidth, targetHeight, QUALITY_STEPS[QUALITY_STEPS.length - 1]);
}

/**
 * Main compression function
 * Automatically handles HEIC conversion, resizing, and WebP output
 */
export async function compressImage(
  file: File,
  options: CompressionOptions = {}
): Promise<CompressionResult> {
  const opts = { ...DEFAULT_OPTIONS, ...options };

  let blob: Blob = file;
  let wasConverted = false;

  // Convert HEIC to JPEG first
  if (isHeicFormat(file)) {
    blob = await convertHeicToJpeg(file);
    wasConverted = true;
  }

  // Load image to get dimensions
  const img = await loadImage(blob);
  const originalDimensions = { width: img.width, height: img.height };

  // Calculate target dimensions
  const { width: targetWidth, height: targetHeight, needsResize } = calculateTargetDimensions(
    img.width,
    img.height,
    opts.maxEdge
  );

  // Check if processing is needed
  const needsProcessing = wasConverted || needsResize || file.size > opts.maxFileSize || file.type !== 'image/webp';

  if (!needsProcessing) {
    // No processing needed, but still convert to WebP for consistency
    const webpBlob = await resizeAndConvert(img, img.width, img.height, opts.quality);

    // Only use WebP if it's actually smaller
    if (webpBlob.size < file.size) {
      const webpFile = new File([webpBlob], file.name.replace(/\.[^/.]+$/, '.webp'), {
        type: 'image/webp',
      });
      return {
        file: webpFile,
        wasCompressed: true,
        originalDimensions,
        finalDimensions: { width: img.width, height: img.height },
      };
    }

    return {
      file,
      wasCompressed: false,
      originalDimensions,
      finalDimensions: originalDimensions,
    };
  }

  // Compress to size
  const compressedBlob = await compressToSize(img, targetWidth, targetHeight, opts.maxFileSize);

  // Create new file with WebP extension
  const newFileName = file.name.replace(/\.[^/.]+$/, '.webp');
  const compressedFile = new File([compressedBlob], newFileName, {
    type: 'image/webp',
  });

  return {
    file: compressedFile,
    wasCompressed: true,
    originalDimensions,
    finalDimensions: { width: targetWidth, height: targetHeight },
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
