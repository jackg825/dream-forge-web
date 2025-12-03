'use client';

import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Slider } from '@/components/ui/slider';
import { Lightbulb } from 'lucide-react';
import {
  type ModelProvider,
  type ProviderOptions,
  HUNYUAN_FACE_COUNT_PRESETS,
} from '@/types';

interface ProviderOptionsPanelProps {
  provider: ModelProvider;
  options: ProviderOptions;
  onChange: (options: ProviderOptions) => void;
  disabled?: boolean;
}

/**
 * ProviderOptionsPanel - Conditional provider-specific options
 *
 * Shows different options based on selected provider:
 * - Hunyuan: Face count slider (40K - 1.5M)
 * - Meshy/Tripo/Rodin: No additional options
 */
export function ProviderOptionsPanel({
  provider,
  options,
  onChange,
  disabled,
}: ProviderOptionsPanelProps) {
  // Only Hunyuan has additional options for now
  if (provider !== 'hunyuan') {
    return null;
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
