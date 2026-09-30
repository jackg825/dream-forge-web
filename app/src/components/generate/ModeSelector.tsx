'use client';

import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { useTranslations } from 'next-intl';
import {
  type GenerationModeId,
  GENERATION_MODE_OPTIONS,
  DEFAULT_GENERATION_MODE,
} from '@/types';

interface ModeSelectorProps {
  value: GenerationModeId;
  onChange: (mode: GenerationModeId) => void;
  disabled?: boolean;
}

/**
 * ModeSelector - Generation mode selector for A/B testing
 *
 * Displays two mode options:
 * - Mode A: Simplified mesh (7-color mesh, full color texture)
 * - Mode B: Simplified texture (full color mesh, 6-color texture)
 */
export function ModeSelector({ value, onChange, disabled }: ModeSelectorProps) {
  const t = useTranslations();
  const modes = Object.values(GENERATION_MODE_OPTIONS);

  return (
    <div className="space-y-4 rounded-[24px] bg-card p-5 sm:p-7">
      <div className="text-lg font-semibold tracking-tight">
        {t('selectors.imageProcessingMode')}
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {modes.map((mode) => {
          const isSelected = value === mode.id;
          const isDefault = mode.id === DEFAULT_GENERATION_MODE;

          return (
            <button
              key={mode.id}
              type="button"
              onClick={() => onChange(mode.id)}
              disabled={disabled}
              aria-pressed={isSelected}
              className={cn(
                'relative flex flex-col items-start gap-2 rounded-[18px] border-2 p-5 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:ring-offset-2',
                'hover:border-primary/50 hover:bg-muted/30',
                'disabled:cursor-not-allowed disabled:opacity-50',
                isSelected
                  ? 'border-primary bg-primary/[0.03]'
                  : 'border-border/70 bg-card'
              )}
            >
              {/* Mode name with default badge */}
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium">{mode.name}</span>
                {isDefault && (
                  <Badge variant="secondary" className="text-xs px-1.5 py-0">
                    {t('selectors.default')}
                  </Badge>
                )}
              </div>

              {/* Description */}
              <p className="text-xs text-muted-foreground leading-relaxed">
                {mode.description}
              </p>

              {/* Style indicators */}
              <div className="flex flex-wrap gap-1.5 mt-1">
                <Badge
                  variant="outline"
                  className={cn(
                    'text-xs',
                    mode.meshStyle.includes('簡化')
                      ? 'border-border text-muted-foreground'
                      : 'border-border text-muted-foreground'
                  )}
                >
                  {t('selectors.mesh')}: {mode.meshStyle}
                </Badge>
                <Badge
                  variant="outline"
                  className={cn(
                    'text-xs',
                    mode.textureStyle.includes('簡化')
                      ? 'border-border text-muted-foreground'
                      : 'border-border text-muted-foreground'
                  )}
                >
                  {t('selectors.texture')}: {mode.textureStyle}
                </Badge>
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
