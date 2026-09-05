/**
 * Image Cropper for Composite View Generation
 *
 * Crops a 2×2 grid image into 4 separate view images.
 * Preserves the model's native output resolution.
 */
/**
 * Result of cropping a composite 2×2 grid image
 */
export interface CropResult {
    front: Buffer;
    back: Buffer;
    left: Buffer;
    right: Buffer;
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
export declare function cropCompositeView(compositeImage: Buffer): Promise<CropResult>;
