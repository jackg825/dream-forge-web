"use strict";
/**
 * HiTem3D API Types
 *
 * Based on: https://docs.hitem3d.ai/en/api/api-reference/
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.HITEM_ERROR_CODES = exports.HITEM_TOKEN_TTL_MS = exports.HITEM_DEFAULT_MODEL = exports.HITEM_API_BASE = exports.HITEM_FORMAT_CODE = exports.HITEM_QUALITY_RESOLUTION = void 0;
/**
 * Quality to resolution mapping
 *
 * Maps DreamForge quality levels to HiTem resolution values.
 */
exports.HITEM_QUALITY_RESOLUTION = {
    draft: 512,
    standard: 1024,
    fine: 1536,
};
/**
 * Format code mapping
 */
exports.HITEM_FORMAT_CODE = {
    obj: 1,
    glb: 2,
    stl: 3,
    fbx: 4,
};
/**
 * HiTem3D API base URL
 */
exports.HITEM_API_BASE = 'https://api.hitem3d.ai';
/**
 * Default model version
 */
exports.HITEM_DEFAULT_MODEL = 'hitem3dv1.5';
/**
 * Token cache TTL in milliseconds (23 hours - 1 hour buffer before 24h expiry)
 */
exports.HITEM_TOKEN_TTL_MS = 23 * 60 * 60 * 1000;
/**
 * Error codes from HiTem API
 */
exports.HITEM_ERROR_CODES = {
    INVALID_CREDENTIALS: '40010000',
    SYSTEM_ERROR: '10000000',
    GENERATE_FAILED: '50010001',
};
//# sourceMappingURL=types.js.map