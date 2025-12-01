'use client';

import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Clock, Zap } from 'lucide-react';
import {
  type ProcessingMode,
  PROCESSING_MODE_OPTIONS,
  DEFAULT_PROCESSING_MODE,
} from '@/types';

interface ProcessingModeSelectorProps {
  value: ProcessingMode;
  onChange: (mode: ProcessingMode) => void;
  disabled?: boolean;
}

/**
 * ProcessingModeSelector - Choose between batch and realtime processing
 *
 * - Batch (default): Uses Gemini Batch API, 50% cheaper, async processing
 * - Realtime: Sequential API calls, faster but prone to timeout errors
 */
export function ProcessingModeSelector({
  value,
  onChange,
  disabled,
}: ProcessingModeSelectorProps) {
  const modes = Object.values(PROCESSING_MODE_OPTIONS);

  return (
    <div className="space-y-2">
      <div className="text-sm font-medium text-muted-foreground">
        處理模式
      </div>
      <div className="grid grid-cols-2 gap-3">
        {modes.map((mode) => {
          const isSelected = value === mode.id;
          const isDefault = mode.id === DEFAULT_PROCESSING_MODE;
          const isBatch = mode.id === 'batch';

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
              {/* Icon + Mode name */}
              <div className="flex items-center gap-2">
                {isBatch ? (
                  <Clock className="h-4 w-4 text-blue-500" />
                ) : (
                  <Zap className="h-4 w-4 text-amber-500" />
                )}
                <span className="text-sm font-medium">{mode.name}</span>
                {mode.badge && (
                  <Badge
                    variant="secondary"
                    className="text-xs px-1.5 py-0 bg-blue-100 text-blue-700"
                  >
                    {mode.badge}
                  </Badge>
                )}
              </div>

              {/* Description */}
              <p className="text-xs text-muted-foreground leading-relaxed">
                {mode.description}
              </p>

              {/* Estimated time */}
              <div className="flex items-center gap-1 mt-1">
                <Badge
                  variant="outline"
                  className={cn(
                    'text-xs',
                    isBatch
                      ? 'border-blue-500/50 text-blue-600'
                      : 'border-amber-500/50 text-amber-600'
                  )}
                >
                  {mode.estimatedTime}
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
