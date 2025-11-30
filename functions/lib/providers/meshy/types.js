"use strict";
/**
 * Meshy AI API Types
 *
 * Based on: https://docs.meshy.ai/en/api/image-to-3d
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.MESHY_API_BASE = exports.MESHY_QUALITY_POLYCOUNT = void 0;
/**
 * Quality to polycount mapping
 *
 * Maps DreamForge quality levels to Meshy polycount values.
 * Meshy supports 100-300,000 polycounts.
 */
exports.MESHY_QUALITY_POLYCOUNT = {
    draft: 30000, // Fast preview
    standard: 100000, // Balanced quality
    fine: 200000, // High detail
    // Legacy mappings
    low: 30000,
    medium: 100000,
    high: 200000,
};
/**
 * Meshy API base URL
 */
exports.MESHY_API_BASE = 'https://api.meshy.ai/openapi/v1';
//# sourceMappingURL=types.js.map