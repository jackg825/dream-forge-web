'use client';

import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Clock, Coins, Lock } from 'lucide-react';
import { useTranslations } from 'next-intl';
import {
  type ModelProvider,
  PROVIDER_OPTIONS,
} from '@/types';
import { useTierAccess } from '@/hooks/useTierAccess';

/** Map provider badges to translation keys */
const BADGE_KEY_BY_PROVIDER: Partial<Record<ModelProvider, string>> = {
  meshy: 'recommended',
  hunyuan: 'newFeature',
  tripo: 'recommended',
  hitem3d: 'newFeature',
};

interface ProviderSelectorProps {
  value: ModelProvider;
  onChange: (provider: ModelProvider) => void;
  disabled?: boolean;
  showCredits?: boolean;
  /** Optional filter to show only specific providers */
  providers?: ModelProvider[];
  /** Callback when user clicks a locked (Premium-only) provider */
  onUpgradeClick?: () => void;
}

/**
 * ProviderSelector - 3D generation provider selector
 *
 * Displays provider options for 3D mesh generation.
 * Use the `providers` prop to filter which providers are shown.
 * Locked providers (Premium-only) are displayed with a lock icon.
 */
export function ProviderSelector({
  value,
  onChange,
  disabled,
  showCredits = true,
  providers: providerFilter,
  onUpgradeClick,
}: ProviderSelectorProps) {
  const t = useTranslations('upload.provider');
  const { isProviderLocked } = useTierAccess();

  // Filter providers if specified, otherwise show all
  const providers = providerFilter
    ? providerFilter.map(id => PROVIDER_OPTIONS[id])
    : Object.values(PROVIDER_OPTIONS);

  const handleProviderClick = (providerId: ModelProvider) => {
    if (isProviderLocked(providerId)) {
      // Provider is locked, show upgrade prompt
      onUpgradeClick?.();
    } else {
      // Provider is accessible, select it
      onChange(providerId);
    }
  };

  return (
    <div className="space-y-4 rounded-[24px] bg-card p-5 sm:p-7">
      <div className="text-lg font-semibold tracking-tight">
        {t('title')}
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {providers.map((provider) => {
          const isSelected = value === provider.id;
          const isLocked = isProviderLocked(provider.id);

          return (
            <button
              key={provider.id}
              type="button"
              onClick={() => handleProviderClick(provider.id)}
              disabled={disabled}
              aria-pressed={isSelected && !isLocked}
              className={cn(
                'relative flex flex-col items-start gap-2 rounded-[18px] border-2 p-5 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:ring-offset-2',
                'disabled:cursor-not-allowed disabled:opacity-50',
                isLocked
                  ? 'opacity-70 cursor-pointer border-border bg-muted/30 hover:border-muted-foreground/30'
                  : 'hover:border-primary/50 hover:bg-muted/30',
                isSelected && !isLocked
                  ? 'border-primary bg-primary/[0.03]'
                  : !isLocked && 'border-border/70 bg-card'
              )}
            >
              {/* Provider name with badge */}
              <div className="flex items-center gap-2 w-full">
                <span className={cn(
                  'text-sm font-semibold',
                  isLocked && 'text-muted-foreground'
                )}>
                  {t(`${provider.id}.label`)}
                </span>
                {provider.badge && !isLocked && (
                  <Badge
                    variant={provider.badgeVariant || 'secondary'}
                    className="text-xs px-1.5 py-0"
                  >
                    {t(`badges.${BADGE_KEY_BY_PROVIDER[provider.id] || provider.badge}`)}
                  </Badge>
                )}
              </div>

              {/* Description */}
              <p className={cn(
                'text-xs text-muted-foreground',
                isLocked && 'opacity-70'
              )}>
                {t(`${provider.id}.description`)}
              </p>

              {/* Capabilities */}
              <div className={cn(
                'flex flex-wrap gap-1.5',
                isLocked && 'opacity-70'
              )}>
                {provider.capabilities.maxPolygons && (
                  <Badge variant="outline" className="text-xs">
                    {provider.capabilities.maxPolygons}
                  </Badge>
                )}
                {provider.capabilities.multiview && (
                  <Badge
                    variant="outline"
                    className="text-xs border-border text-muted-foreground"
                  >
                    {t('capabilities.multiview')}
                  </Badge>
                )}
                {provider.capabilities.faceCountControl && (
                  <Badge
                    variant="outline"
                    className="text-xs border-border text-muted-foreground"
                  >
                    {t('capabilities.faceCountControl')}
                  </Badge>
                )}
              </div>

              {/* Time and credits */}
              <div className={cn(
                'flex items-center gap-3 text-xs text-muted-foreground mt-1',
                isLocked && 'opacity-70'
              )}>
                <span className="flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {t(`${provider.id}.estimatedTime`)}
                </span>
                {showCredits && (
                  <span className="flex items-center gap-1 text-primary font-medium">
                    <Coins className="h-3 w-3" />
                    {t('credits', { count: provider.creditCost })}
                  </span>
                )}
              </div>

              {/* Lock indicator for Premium-only providers */}
              {isLocked && (
                <div className="absolute right-2 top-2 flex items-center gap-1 text-muted-foreground">
                  <Lock className="h-3.5 w-3.5" />
                  <span className="text-xs font-medium">Premium</span>
                </div>
              )}

              {/* Selection indicator */}
              {isSelected && !isLocked && (
                <div className="absolute right-2 top-2 h-2 w-2 rounded-full bg-primary" />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
