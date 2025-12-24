"use strict";
/**
 * Tier Configuration (Backend)
 *
 * Centralized configuration for Free/Premium membership tiers.
 * Used for server-side validation of tier-restricted features.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.ADMIN_ONLY_PROVIDERS = exports.TIER_FEATURES = void 0;
exports.canAccessProvider = canAccessProvider;
exports.canAccessViewModel = canAccessViewModel;
exports.canAccessHiTem3DResolution = canAccessHiTem3DResolution;
exports.getTierValidationError = getTierValidationError;
/**
 * Feature access by tier
 *
 * Free tier:
 * - View generation: gemini-2.5-flash-image only
 * - Providers: HiTem3D only
 * - HiTem3D resolution: 512 only
 *
 * Premium tier:
 * - View generation: All models
 * - Providers: Hunyuan, Tripo, HiTem3D
 * - HiTem3D resolution: 512 and 1024
 */
exports.TIER_FEATURES = {
    free: {
        allowedViewModels: ['gemini-2.5-flash-image'],
        allowedProviders: ['hitem3d'],
        allowedHiTem3DResolutions: [512],
    },
    premium: {
        allowedViewModels: ['gemini-2.5-flash-image', 'gemini-3-pro-image-preview'],
        allowedProviders: ['hunyuan', 'tripo', 'hitem3d'],
        allowedHiTem3DResolutions: [512, 1024],
    },
};
// Admin-only providers
exports.ADMIN_ONLY_PROVIDERS = ['meshy', 'rodin'];
/**
 * Check if a user tier can access a specific provider
 */
function canAccessProvider(tier, provider, isAdmin) {
    if (isAdmin)
        return true;
    if (exports.ADMIN_ONLY_PROVIDERS.includes(provider))
        return false;
    return exports.TIER_FEATURES[tier].allowedProviders.includes(provider);
}
/**
 * Check if a user tier can access a specific view generation model
 */
function canAccessViewModel(tier, model, isAdmin) {
    if (isAdmin)
        return true;
    return exports.TIER_FEATURES[tier].allowedViewModels.includes(model);
}
/**
 * Check if a user tier can access a specific HiTem3D resolution
 */
function canAccessHiTem3DResolution(tier, resolution, isAdmin) {
    if (isAdmin)
        return true;
    return exports.TIER_FEATURES[tier].allowedHiTem3DResolutions.includes(resolution);
}
/**
 * Get tier validation error message
 */
function getTierValidationError(feature, value) {
    const messages = {
        provider: `Premium subscription required to use ${value} provider`,
        viewModel: `Premium subscription required for ${value} view generation`,
        resolution: `Premium subscription required for ${value} resolution`,
    };
    return messages[feature];
}
//# sourceMappingURL=tiers.js.map