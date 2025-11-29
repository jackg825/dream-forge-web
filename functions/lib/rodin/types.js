"use strict";
/**
 * Rodin Gen-2 API Types
 * Based on Hyper3D API documentation
 *
 * Optimized for 3D printing workflow:
 * - mesh_mode: 'Raw' for triangle meshes (required by slicers)
 * - format: 'stl' as the standard 3D printing format
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.MAX_USER_DRAFTS = exports.SESSION_CREDIT_COSTS = exports.QUALITY_FACE_COUNTS = exports.PRINT_QUALITY_FACE_COUNTS = exports.CREDIT_COSTS = exports.PRINTER_MATERIAL_MAP = void 0;
// Printer type to material mapping
exports.PRINTER_MATERIAL_MAP = {
    fdm: 'Shaded', // Mono prints don't need PBR textures
    sla: 'PBR', // SLA supports full-color printing
    resin: 'PBR', // Resin printers support color
};
// Credit costs based on input mode
exports.CREDIT_COSTS = {
    single: 1,
    multi: 1,
    'ai-generated': 2, // Extra cost for Gemini API usage
};
// Raw mode face counts optimized for 3D printing
// Raw mode range: 500 - 1,000,000 faces
exports.PRINT_QUALITY_FACE_COUNTS = {
    draft: 50000, // ~2.5 MB STL - 快速預覽列印
    standard: 150000, // ~7.5 MB STL - 一般 FDM 列印
    fine: 300000, // ~15 MB STL - 高品質 SLA 列印
};
// Legacy mapping for backwards compatibility
exports.QUALITY_FACE_COUNTS = {
    low: 50000,
    medium: 150000,
    high: 300000,
};
// Credit costs for multi-step flow
exports.SESSION_CREDIT_COSTS = {
    VIEW_GENERATION: 1, // Each view generation attempt
    MODEL_GENERATION: 1, // 3D model generation
};
// Maximum drafts per user
exports.MAX_USER_DRAFTS = 3;
//# sourceMappingURL=types.js.map