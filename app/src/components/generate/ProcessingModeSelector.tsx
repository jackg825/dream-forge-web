'use client';

import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Clock, Zap } from 'lucide-react';
import { useTranslations } from 'next-intl';
import {
  type ProcessingMode,
  PROCESSING_MODE_OPTIONS,
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
  const t = useTranslations();
  const modes = Object.values(PROCESSING_MODE_OPTIONS);

  return (
    <div className="space-y-4 rounded-[24px] bg-card p-5 sm:p-7">
      <div className="text-lg font-semibold tracking-tight">
        {t('selectors.processingMode')}
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {modes.map((mode) => {
          const isSelected = value === mode.id;
          const isBatch = mode.id === 'batch';

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
              {/* Icon + Mode name */}
              <div className="flex items-center gap-2">
                {isBatch ? (
                  <Clock className="h-4 w-4 text-muted-foreground" />
                ) : (
                  <Zap className="h-4 w-4 text-muted-foreground" />
                )}
                <span className="text-sm font-medium">{mode.name}</span>
                {mode.badge && (
                  <Badge
                    variant="secondary"
                    className="text-xs px-1.5 py-0 bg-muted text-muted-foreground"
                  >
                    {mode.badge}
                  </Badge>
                )}
              </div>

              {/* Description */}
              <p className="text-xs text-muted-foreground leading-relaxed">
                {mode.description}
              </p>

              {/* Estimated time and cost */}
              <div className="flex items-center gap-1.5 mt-1">
                <Badge
                  variant="outline"
                  className={cn(
                    'text-xs',
                    isBatch
                      ? 'border-border text-muted-foreground'
                      : 'border-border text-muted-foreground'
                  )}
                >
                  {mode.estimatedTime}
                </Badge>
                <Badge
                  variant="outline"
                  className="text-xs border-border text-muted-foreground"
                >
                  {isBatch ? `5 ${t('pipeline.credits.points')}` : `10 ${t('pipeline.credits.points')}`}
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
