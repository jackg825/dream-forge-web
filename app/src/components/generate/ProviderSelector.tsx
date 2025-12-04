'use client';

import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Clock, Coins } from 'lucide-react';
import {
  type ModelProvider,
  PROVIDER_OPTIONS,
} from '@/types';

interface ProviderSelectorProps {
  value: ModelProvider;
  onChange: (provider: ModelProvider) => void;
  disabled?: boolean;
  showCredits?: boolean;
  /** Optional filter to show only specific providers */
  providers?: ModelProvider[];
}

/**
 * ProviderSelector - 3D generation provider selector
 *
 * Displays provider options for 3D mesh generation.
 * Use the `providers` prop to filter which providers are shown.
 */
export function ProviderSelector({
  value,
  onChange,
  disabled,
  showCredits = true,
  providers: providerFilter,
}: ProviderSelectorProps) {
  // Filter providers if specified, otherwise show all
  const providers = providerFilter
    ? providerFilter.map(id => PROVIDER_OPTIONS[id])
    : Object.values(PROVIDER_OPTIONS);

  return (
    <div className="space-y-2">
      <div className="text-sm font-medium text-muted-foreground">
        3D 生成引擎
      </div>
      <div className="grid grid-cols-2 gap-3">
        {providers.map((provider) => {
          const isSelected = value === provider.id;

          return (
            <button
              key={provider.id}
              type="button"
              onClick={() => onChange(provider.id)}
              disabled={disabled}
              className={cn(
                'relative flex flex-col items-start gap-1.5 rounded-lg border-2 p-3 text-left transition-all',
                'hover:border-primary/50 hover:bg-accent/50',
                'disabled:cursor-not-allowed disabled:opacity-50',
                isSelected
                  ? 'border-primary bg-primary/5'
                  : 'border-border bg-background'
              )}
            >
              {/* Provider name with badge */}
              <div className="flex items-center gap-2 w-full">
                <span className="text-sm font-semibold">{provider.label}</span>
                {provider.badge && (
                  <Badge
                    variant={provider.badgeVariant as any || 'secondary'}
                    className="text-xs px-1.5 py-0"
                  >
                    {provider.badge}
                  </Badge>
                )}
              </div>

              {/* Description */}
              <p className="text-xs text-muted-foreground">
                {provider.description}
              </p>

              {/* Capabilities */}
              <div className="flex flex-wrap gap-1.5">
                {provider.capabilities.maxPolygons && (
                  <Badge variant="outline" className="text-xs">
                    {provider.capabilities.maxPolygons}
                  </Badge>
                )}
                {provider.capabilities.multiview && (
                  <Badge
                    variant="outline"
                    className="text-xs border-green-500/50 text-green-600 dark:text-green-400"
                  >
                    多視角
                  </Badge>
                )}
                {provider.capabilities.faceCountControl && (
                  <Badge
                    variant="outline"
                    className="text-xs border-purple-500/50 text-purple-600 dark:text-purple-400"
                  >
                    多邊形控制
                  </Badge>
                )}
              </div>

              {/* Time and credits */}
              <div className="flex items-center gap-3 text-xs text-muted-foreground mt-1">
                <span className="flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {provider.estimatedTime}
                </span>
                {showCredits && (
                  <span className="flex items-center gap-1 text-primary font-medium">
                    <Coins className="h-3 w-3" />
                    {provider.creditCost} 點
                  </span>
                )}
              </div>

              {/* Selection indicator */}
              {isSelected && (
                <div className="absolute right-2 top-2 h-2 w-2 rounded-full bg-primary" />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
