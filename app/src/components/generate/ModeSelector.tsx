'use client';

import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
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
  const modes = Object.values(GENERATION_MODE_OPTIONS);

  return (
    <div className="space-y-2">
      <div className="text-sm font-medium text-muted-foreground">
        圖片處理模式
      </div>
      <div className="grid grid-cols-2 gap-3">
        {modes.map((mode) => {
          const isSelected = value === mode.id;
          const isDefault = mode.id === DEFAULT_GENERATION_MODE;

          return (
            <button
              key={mode.id}
              type="button"
              onClick={() => onChange(mode.id)}
              disabled={disabled}
              className={cn(
                'relative flex flex-col items-start gap-1 rounded-lg border-2 p-3 text-left transition-all',
                'hover:border-primary/50 hover:bg-accent/50',
                'disabled:cursor-not-allowed disabled:opacity-50',
                isSelected
                  ? 'border-primary bg-primary/5'
                  : 'border-border bg-background'
              )}
            >
              {/* Mode name with default badge */}
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium">{mode.name}</span>
                {isDefault && (
                  <Badge variant="secondary" className="text-xs px-1.5 py-0">
                    預設
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
                      ? 'border-orange-500/50 text-orange-600'
                      : 'border-green-500/50 text-green-600'
                  )}
                >
                  網格: {mode.meshStyle}
                </Badge>
                <Badge
                  variant="outline"
                  className={cn(
                    'text-xs',
                    mode.textureStyle.includes('簡化')
                      ? 'border-orange-500/50 text-orange-600'
                      : 'border-green-500/50 text-green-600'
                  )}
                >
                  貼圖: {mode.textureStyle}
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
