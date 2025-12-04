'use client';

import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Clock, Coins, Sparkles, Zap } from 'lucide-react';
import { useTranslations } from 'next-intl';
import {
  type GeminiModelId,
  GEMINI_MODEL_OPTIONS,
} from '@/types';

interface GeminiModelSelectorProps {
  value: GeminiModelId;
  onChange: (model: GeminiModelId) => void;
  disabled?: boolean;
}

/**
 * GeminiModelSelector - Gemini model selector for image generation
 *
 * Displays two model options:
 * - Gemini 3.0 Pro (recommended, higher quality)
 * - Gemini 2.5 Flash (faster, cheaper)
 */
export function GeminiModelSelector({
  value,
  onChange,
  disabled,
}: GeminiModelSelectorProps) {
  const t = useTranslations();
  const models = Object.values(GEMINI_MODEL_OPTIONS);

  return (
    <div className="space-y-2">
      <div className="text-sm font-medium text-muted-foreground">
        {t('selectors.imageGenModel')}
      </div>
      <div className="grid grid-cols-2 gap-3">
        {models.map((model) => {
          const isSelected = value === model.id;
          const Icon = model.id === 'gemini-3-pro' ? Sparkles : Zap;

          return (
            <button
              key={model.id}
              type="button"
              onClick={() => onChange(model.id)}
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
              {/* Model name with badge */}
              <div className="flex items-center gap-2 w-full">
                <Icon className="h-4 w-4 text-primary" />
                <span className="text-sm font-semibold">{model.name}</span>
                {model.badge && (
                  <Badge
                    variant="secondary"
                    className="text-xs px-1.5 py-0"
                  >
                    {model.badge}
                  </Badge>
                )}
              </div>

              {/* Description */}
              <p className="text-xs text-muted-foreground">
                {model.description}
              </p>

              {/* Estimated time and credits */}
              <div className="flex items-center gap-3 text-xs text-muted-foreground mt-1">
                <span className="flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {model.estimatedTime}
                </span>
                <span className="flex items-center gap-1 text-primary font-medium">
                  <Coins className="h-3 w-3" />
                  {model.creditCost} {t('pipeline.credits.points')}
                </span>
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
