/**
 * Image Cropper for Composite View Generation
 *
 * Crops a 2×2 grid image into 4 separate view images.
 * Used with Gemini 3 Pro composite generation.
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
 * @param compositeImage - The 2048×2048 composite image buffer
 * @returns 4 separate 1024×1024 view images
 */
export declare function cropCompositeView(compositeImage: Buffer): Promise<CropResult>;
