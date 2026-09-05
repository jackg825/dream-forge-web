"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.DEFAULT_GEMINI_MODEL = void 0;
exports.resolveGeminiImageModel = resolveGeminiImageModel;
exports.resolveGenerationColors = resolveGenerationColors;
exports.buildGenerationColorPrompt = buildGenerationColorPrompt;
exports.assertSupportedReferenceAngle = assertSupportedReferenceAngle;
const functions = __importStar(require("firebase-functions"));
exports.DEFAULT_GEMINI_MODEL = 'gemini-2.5-flash-image';
function resolveGeminiImageModel(model = exports.DEFAULT_GEMINI_MODEL) {
    if (model === 'gemini-2.5-flash')
        return 'gemini-2.5-flash-image';
    if (model === 'gemini-2.5-flash-image')
        return model;
    // Preserve saved UI settings while using the stable replacement for the retired preview.
    if (model === 'gemini-3-pro-image-preview')
        return 'gemini-3-pro-image';
    throw new functions.https.HttpsError('invalid-argument', 'Invalid Gemini image model');
}
function resolveGenerationColors(options) {
    const palette = options.colorPalette ?? [];
    if (!Array.isArray(palette) || palette.length > 12 || palette.some((color) => typeof color !== 'string' || !/^#[0-9a-f]{6}$/i.test(color))) {
        throw new functions.https.HttpsError('invalid-argument', 'Use up to 12 valid HEX colors');
    }
    const colorCount = options.colorCount ?? 7;
    if (!Number.isInteger(colorCount) || colorCount < (palette.length ? 1 : 3) || colorCount > 12) {
        throw new functions.https.HttpsError('invalid-argument', 'Color count must be between 3 and 12');
    }
    // Edited swatches are the final choice; adding/removing a swatch changes the count.
    const colorPalette = [...new Set(palette.map((color) => color.toUpperCase()))];
    return { colorCount: colorPalette.length || colorCount, colorPalette };
}
function buildGenerationColorPrompt(options) {
    const { colorCount, colorPalette } = resolveGenerationColors(options);
    return `=== USER COLOR REQUIREMENTS ===
Use ${colorCount} subject colors.${colorPalette.length ? ` Use ONLY these subject colors: ${colorPalette.join(', ')}. Preserve their assignments to the subject's features.` : ''}
The white background is separate from the subject palette.
These user-selected colors take precedence over colors inferred from the reference photo.
=== END USER COLOR REQUIREMENTS ===`;
}
function assertSupportedReferenceAngle(angle) {
    if (!['front', 'back', 'left', 'right'].includes(angle)) {
        throw new functions.https.HttpsError('failed-precondition', 'Top-view references are not supported yet. Upload a front or side photo and analyze it again.');
    }
}
//# sourceMappingURL=generation-options.js.map