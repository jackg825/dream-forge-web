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
exports.QUALITY_FACE_COUNTS = exports.PRINT_QUALITY_FACE_COUNTS = void 0;
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
//# sourceMappingURL=types.js.map