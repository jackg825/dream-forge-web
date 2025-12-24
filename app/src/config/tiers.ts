/**
 * Tier Configuration
 *
 * Centralized configuration for Free/Premium membership tiers.
 * Defines feature access levels for each tier.
 */

import type { ModelProvider, UserTier } from '@/types';

// View generation model options (Gemini image generation)
export type ViewGenerationModel = 'gemini-2.5-flash-image' | 'gemini-3-pro-image-preview';

// HiTem3D resolution options
export type HiTem3DResolution = 512 | 1024;

// Tier feature configuration
export interface TierFeatureConfig {
  // View generation models available for this tier
  allowedViewModels: ViewGenerationModel[];

  // 3D generation providers available for this tier
  allowedProviders: ModelProvider[];

  // HiTem3D resolution options available for this tier
  allowedHiTem3DResolutions: HiTem3DResolution[];
}

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
export const TIER_FEATURES: Record<UserTier, TierFeatureConfig> = {
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

// Admin-only providers (not shown to regular users)
export const ADMIN_ONLY_PROVIDERS: ModelProvider[] = ['meshy', 'rodin'];

// All providers visible to non-admin users (includes locked ones)
export const USER_VISIBLE_PROVIDERS: ModelProvider[] = ['hunyuan', 'tripo', 'hitem3d'];

// View generation model display options
export const VIEW_MODEL_OPTIONS: Record<ViewGenerationModel, {
  label: string;
  description: string;
  badge?: string;
}> = {
  'gemini-2.5-flash-image': {
    label: 'Gemini 2.5 Flash',
    description: '快速生成，標準品質',
  },
  'gemini-3-pro-image-preview': {
    label: 'Gemini 3 Pro',
    description: '高品質生成，更精細',
    badge: 'Premium',
  },
};

// HiTem3D resolution display options
export const HITEM3D_RESOLUTION_OPTIONS: Record<HiTem3DResolution, {
  label: string;
  description: string;
  badge?: string;
}> = {
  512: {
    label: '512³',
    description: '標準解析度',
  },
  1024: {
    label: '1024³',
    description: '高解析度，更多細節',
    badge: 'Premium',
  },
};

/**
 * Check if a user tier can access a specific provider
 */
export function canAccessProvider(
  tier: UserTier,
  provider: ModelProvider,
  isAdmin: boolean
): boolean {
  if (isAdmin) return true;
  if (ADMIN_ONLY_PROVIDERS.includes(provider)) return false;
  return TIER_FEATURES[tier].allowedProviders.includes(provider);
}

/**
 * Check if a user tier can access a specific view generation model
 */
export function canAccessViewModel(
  tier: UserTier,
  model: ViewGenerationModel,
  isAdmin: boolean
): boolean {
  if (isAdmin) return true;
  return TIER_FEATURES[tier].allowedViewModels.includes(model);
}

/**
 * Check if a user tier can access a specific HiTem3D resolution
 */
export function canAccessHiTem3DResolution(
  tier: UserTier,
  resolution: HiTem3DResolution,
  isAdmin: boolean
): boolean {
  if (isAdmin) return true;
  return TIER_FEATURES[tier].allowedHiTem3DResolutions.includes(resolution);
}

/**
 * Get all providers visible to a user (based on role, not tier)
 * Tier restrictions are shown as locked states, not hidden
 */
export function getVisibleProviders(isAdmin: boolean): ModelProvider[] {
  if (isAdmin) {
    return [...ADMIN_ONLY_PROVIDERS, ...USER_VISIBLE_PROVIDERS];
  }
  return USER_VISIBLE_PROVIDERS;
}

/**
 * Check if a provider requires Premium tier
 */
export function isPremiumProvider(provider: ModelProvider): boolean {
  // If it's not in the free tier's allowed list, it's premium
  return !TIER_FEATURES.free.allowedProviders.includes(provider);
}

/**
 * Check if a view model requires Premium tier
 */
export function isPremiumViewModel(model: ViewGenerationModel): boolean {
  return !TIER_FEATURES.free.allowedViewModels.includes(model);
}

/**
 * Check if a HiTem3D resolution requires Premium tier
 */
export function isPremiumResolution(resolution: HiTem3DResolution): boolean {
  return !TIER_FEATURES.free.allowedHiTem3DResolutions.includes(resolution);
}
