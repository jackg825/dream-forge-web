/**
 * Image Cropper for Composite View Generation
 *
 * Crops a 2×2 grid image into 4 separate view images.
 * Preserves the model's native output resolution.
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
 * @param compositeImage - A square composite image with even dimensions
 * @returns 4 separate view images, each half the board width and height
 */
export async function cropCompositeView(
  compositeImage: Buffer
): Promise<CropResult> {
  // Get image metadata to determine dimensions
  const metadata = await sharp(compositeImage).metadata();
  const { width, height } = metadata;
  if (!width || !height || width !== height || width % 2 !== 0) {
    throw new functions.https.HttpsError(
      'failed-precondition',
      'The generated view grid must be square with equal quadrants. Please generate the views again.'
    );
  }
  // Preserve native resolution: enlarging a 1K board does not create 2K detail.
  const halfSize = width / 2;

  // Crop all 4 quadrants in parallel
  const [front, back, left, right] = await Promise.all([
    // Top-left: FRONT
    sharp(compositeImage)
      .extract({ left: 0, top: 0, width: halfSize, height: halfSize })
      .png()
      .toBuffer(),
    // Top-right: BACK
    sharp(compositeImage)
      .extract({ left: halfSize, top: 0, width: halfSize, height: halfSize })
      .png()
      .toBuffer(),
    // Bottom-left: LEFT
    sharp(compositeImage)
      .extract({ left: 0, top: halfSize, width: halfSize, height: halfSize })
      .png()
      .toBuffer(),
    // Bottom-right: RIGHT
    sharp(compositeImage)
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
