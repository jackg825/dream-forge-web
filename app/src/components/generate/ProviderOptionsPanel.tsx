'use client';

import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Slider } from '@/components/ui/slider';
import { Lightbulb, Lock } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useTierAccess } from '@/hooks/useTierAccess';
import {
  type ModelProvider,
  type ProviderOptions,
  HUNYUAN_FACE_COUNT_PRESETS,
} from '@/types';
import {
  HITEM3D_RESOLUTION_OPTIONS,
  type HiTem3DResolution,
} from '@/config/tiers';

interface ProviderOptionsPanelProps {
  provider: ModelProvider;
  options: ProviderOptions;
  onChange: (options: ProviderOptions) => void;
  disabled?: boolean;
  onUpgradeClick?: () => void;
}

/**
 * ProviderOptionsPanel - Conditional provider-specific options
 *
 * Shows different options based on selected provider:
 * - Hunyuan: Face count slider (40K - 1.5M)
 * - HiTem3D: Resolution selector (512³ free, 1024³ premium)
 * - Meshy/Tripo/Rodin: No additional options
 */
export function ProviderOptionsPanel({
  provider,
  options,
  onChange,
  disabled,
  onUpgradeClick,
}: ProviderOptionsPanelProps) {
  const t = useTranslations('resolution');
  const { isResolutionLocked } = useTierAccess();

  // Providers with additional options
  if (provider !== 'hunyuan' && provider !== 'hitem3d') {
    return null;
  }

  // HiTem3D resolution selector
  if (provider === 'hitem3d') {
    const resolution = (options.resolution as HiTem3DResolution) || 512;
    const resolutions = Object.entries(HITEM3D_RESOLUTION_OPTIONS) as [
      string,
      typeof HITEM3D_RESOLUTION_OPTIONS[HiTem3DResolution]
    ][];

    const handleResolutionClick = (res: HiTem3DResolution) => {
      if (isResolutionLocked(res)) {
        onUpgradeClick?.();
      } else {
        onChange({ ...options, resolution: res });
      }
    };

    return (
      <div className="border border-border rounded-lg p-4 bg-muted/30 space-y-4">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">HiTem3D {t('title')}</span>
        </div>

        <div className="grid grid-cols-2 gap-3">
          {resolutions.map(([resKey, resInfo]) => {
            const resValue = Number(resKey) as HiTem3DResolution;
            const isSelected = resolution === resValue;
            const isLocked = isResolutionLocked(resValue);

            return (
              <button
                key={resKey}
                type="button"
                onClick={() => handleResolutionClick(resValue)}
                disabled={disabled}
                className={cn(
                  'relative flex flex-col items-start gap-1 rounded-lg border-2 p-3 text-left transition-all',
                  'disabled:cursor-not-allowed disabled:opacity-50',
                  isLocked
                    ? 'opacity-70 cursor-pointer border-border bg-muted/30 hover:border-muted-foreground/30'
                    : 'hover:border-primary/50 hover:bg-accent/50',
                  isSelected && !isLocked
                    ? 'border-primary bg-primary/5'
                    : !isLocked && 'border-border bg-background'
                )}
              >
                <span
                  className={cn(
                    'text-sm font-semibold',
                    isLocked && 'text-muted-foreground'
                  )}
                >
                  {t(`${resKey}.label`)}
                </span>
                <span
                  className={cn(
                    'text-xs text-muted-foreground',
                    isLocked && 'opacity-70'
                  )}
                >
                  {t(`${resKey}.description`)}
                </span>

                {/* Lock indicator for Premium-only resolution */}
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

        {/* Tip */}
        <div className="flex items-start gap-2 text-xs text-muted-foreground bg-muted/50 rounded-lg p-2.5">
          <Lightbulb className="h-3.5 w-3.5 mt-0.5 shrink-0 text-amber-500" />
          <span>
            {t('tip')}
          </span>
        </div>
      </div>
    );
  }

  const faceCount = options.faceCount || 200000;
  const presets = Object.values(HUNYUAN_FACE_COUNT_PRESETS);

  // Format face count for display
  const formatFaceCount = (value: number): string => {
    if (value >= 1000000) {
      return `${(value / 1000000).toFixed(1)}M`;
    }
    return `${(value / 1000).toFixed(0)}K`;
  };

  return (
    <div className="border border-border rounded-lg p-4 bg-muted/30 space-y-4">
      <div className="flex items-center gap-2">
        <span className="text-sm font-medium">Hunyuan 3D 設定</span>
        <Badge variant="outline" className="text-xs">
          多邊形控制
        </Badge>
      </div>

      <div className="space-y-3">
        {/* Face count header */}
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">多邊形數量</span>
          <span className="text-sm font-mono font-medium text-primary">
            {formatFaceCount(faceCount)}
          </span>
        </div>

        {/* Slider */}
        <Slider
          value={[faceCount]}
          onValueChange={([value]) => onChange({ ...options, faceCount: value })}
          min={40000}
          max={1500000}
          step={10000}
          disabled={disabled}
          className="w-full"
        />

        {/* Preset buttons */}
        <div className="flex flex-wrap gap-2">
          {presets.map((preset) => (
            <button
              key={preset.value}
              type="button"
              onClick={() => onChange({ ...options, faceCount: preset.value })}
              disabled={disabled}
              className={cn(
                'px-2.5 py-1 text-xs rounded-md border transition-colors',
                'disabled:cursor-not-allowed disabled:opacity-50',
                faceCount === preset.value
                  ? 'border-primary bg-primary/10 text-primary'
                  : 'border-border hover:border-primary/50 hover:bg-accent/50'
              )}
            >
              {preset.label}
            </button>
          ))}
        </div>

        {/* Tip */}
        <div className="flex items-start gap-2 text-xs text-muted-foreground bg-muted/50 rounded-lg p-2.5">
          <Lightbulb className="h-3.5 w-3.5 mt-0.5 shrink-0 text-amber-500" />
          <span>
            建議：3D 列印選擇 200K-500K，較高數值適合展示用途但檔案較大
          </span>
        </div>
      </div>
    </div>
  );
}
