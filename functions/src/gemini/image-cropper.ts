/**
 * Image Cropper for Composite View Generation
 *
 * Crops a 2×2 grid image into 4 separate view images.
 * Used with Gemini 3 Pro composite generation.
 */

import sharp from 'sharp';
import * as functions from 'firebase-functions';

/**
 * Result of cropping a composite 2×2 grid image
 */
export interface CropResult {
  front: Buffer;   // Top-left quadrant
  back: Buffer;    // Top-right quadrant
  left: Buffer;    // Bottom-left quadrant
  right: Buffer;   // Bottom-right quadrant
}

/**
 * Crop a 2×2 composite image into 4 separate view images
 *
 * Grid layout:
 * ┌──────────┬──────────┐
 * │  FRONT   │  BACK    │
 * │ (0,0)    │ (half,0) │
 * ├──────────┼──────────┤
 * │  LEFT    │  RIGHT   │
 * │ (0,half) │ (half,half)│
 * └──────────┴──────────┘
 *
 * @param compositeImage - The 2048×2048 composite image buffer
 * @returns 4 separate 1024×1024 view images
 */
export async function cropCompositeView(
  compositeImage: Buffer
): Promise<CropResult> {
  // Get image metadata to determine dimensions
  const metadata = await sharp(compositeImage).metadata();
  const width = metadata.width || 2048;
  const height = metadata.height || 2048;

  if (Math.abs(width - height) / Math.max(width, height) > 0.02) {
    throw new functions.https.HttpsError(
      'internal',
      `Composite image must be square, received ${width}x${height}`
    );
  }

  // Normalize supported square outputs before extracting quadrants.
  let normalizedImage = compositeImage;
  if (width !== 2048 || height !== 2048) {
    functions.logger.info('Resizing composite image to 2048×2048', {
      originalWidth: width,
      originalHeight: height,
    });
    normalizedImage = await sharp(compositeImage)
      .resize(2048, 2048, { fit: 'fill' })
      .toBuffer();
  }

  const halfSize = 1024;

  // Crop all 4 quadrants in parallel
  const [front, back, left, right] = await Promise.all([
    // Top-left: FRONT
    sharp(normalizedImage)
      .extract({ left: 0, top: 0, width: halfSize, height: halfSize })
      .png()
      .toBuffer(),
    // Top-right: BACK
    sharp(normalizedImage)
      .extract({ left: halfSize, top: 0, width: halfSize, height: halfSize })
      .png()
      .toBuffer(),
    // Bottom-left: LEFT
    sharp(normalizedImage)
      .extract({ left: 0, top: halfSize, width: halfSize, height: halfSize })
      .png()
      .toBuffer(),
    // Bottom-right: RIGHT
    sharp(normalizedImage)
      .extract({ left: halfSize, top: halfSize, width: halfSize, height: halfSize })
      .png()
      .toBuffer(),
  ]);

  functions.logger.info('Composite image cropped successfully', {
    frontSize: front.length,
    backSize: back.length,
    leftSize: left.length,
    rightSize: right.length,
  });

  return { front, back, left, right };
}
