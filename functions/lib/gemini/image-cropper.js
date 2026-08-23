"use strict";
/**
 * Image Cropper for Composite View Generation
 *
 * Crops a 2×2 grid image into 4 separate view images.
 * Used with Gemini 3 Pro composite generation.
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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.cropCompositeView = cropCompositeView;
const sharp_1 = __importDefault(require("sharp"));
const functions = __importStar(require("firebase-functions"));
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
async function cropCompositeView(compositeImage) {
    // Get image metadata to determine dimensions
    const metadata = await (0, sharp_1.default)(compositeImage).metadata();
    const width = metadata.width || 2048;
    const height = metadata.height || 2048;
    if (Math.abs(width - height) / Math.max(width, height) > 0.02) {
        throw new functions.https.HttpsError('internal', `Composite image must be square, received ${width}x${height}`);
    }
    // Normalize supported square outputs before extracting quadrants.
    let normalizedImage = compositeImage;
    if (width !== 2048 || height !== 2048) {
        functions.logger.info('Resizing composite image to 2048×2048', {
            originalWidth: width,
            originalHeight: height,
        });
        normalizedImage = await (0, sharp_1.default)(compositeImage)
            .resize(2048, 2048, { fit: 'fill' })
            .toBuffer();
    }
    const halfSize = 1024;
    // Crop all 4 quadrants in parallel
    const [front, back, left, right] = await Promise.all([
        // Top-left: FRONT
        (0, sharp_1.default)(normalizedImage)
            .extract({ left: 0, top: 0, width: halfSize, height: halfSize })
            .png()
            .toBuffer(),
        // Top-right: BACK
        (0, sharp_1.default)(normalizedImage)
            .extract({ left: halfSize, top: 0, width: halfSize, height: halfSize })
            .png()
            .toBuffer(),
        // Bottom-left: LEFT
        (0, sharp_1.default)(normalizedImage)
            .extract({ left: 0, top: halfSize, width: halfSize, height: halfSize })
            .png()
            .toBuffer(),
        // Bottom-right: RIGHT
        (0, sharp_1.default)(normalizedImage)
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
//# sourceMappingURL=image-cropper.js.map