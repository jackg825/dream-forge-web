'use client';

/**
 * ViewModelSelector - Gemini view generation model selector
 *
 * Allows users to select which Gemini model to use for generating
 * multi-angle view images. Premium users can access additional models.
 */

import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Lock, Sparkles, Zap } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useTierAccess } from '@/hooks/useTierAccess';
import {
  VIEW_MODEL_OPTIONS,
  type ViewGenerationModel,
} from '@/config/tiers';

interface ViewModelSelectorProps {
  value: ViewGenerationModel;
  onChange: (model: ViewGenerationModel) => void;
  disabled?: boolean;
  onUpgradeClick?: () => void;
}

/**
 * ViewModelSelector - Select Gemini model for view generation
 *
 * Free tier: gemini-2.5-flash-image only
 * Premium tier: + gemini-3-pro-image-preview
 */
export function ViewModelSelector({
  value,
  onChange,
  disabled,
  onUpgradeClick,
}: ViewModelSelectorProps) {
  const t = useTranslations('viewModel');
  const { isViewModelLocked } = useTierAccess();

  const models = Object.entries(VIEW_MODEL_OPTIONS) as [ViewGenerationModel, typeof VIEW_MODEL_OPTIONS[ViewGenerationModel]][];

  const handleModelClick = (modelId: ViewGenerationModel) => {
    if (isViewModelLocked(modelId)) {
      onUpgradeClick?.();
    } else {
      onChange(modelId);
    }
  };

  // Icon mapping for each model
  const getModelIcon = (modelId: ViewGenerationModel) => {
    switch (modelId) {
      case 'gemini-2.5-flash-image':
        return <Zap className="h-4 w-4 text-blue-500" />;
      case 'gemini-3-pro-image-preview':
        return <Sparkles className="h-4 w-4 text-yellow-500" />;
      default:
        return null;
    }
  };

  return (
    <div className="space-y-2">
      <div className="text-sm font-medium text-muted-foreground">
        {t('title')}
      </div>
      <div className="grid grid-cols-2 gap-3">
        {models.map(([modelId, modelInfo]) => {
          const isSelected = value === modelId;
          const isLocked = isViewModelLocked(modelId);

          return (
            <button
              key={modelId}
              type="button"
              onClick={() => handleModelClick(modelId)}
              disabled={disabled}
              className={cn(
                'relative flex flex-col items-start gap-1.5 rounded-lg border-2 p-3 text-left transition-all',
                'disabled:cursor-not-allowed disabled:opacity-50',
                isLocked
                  ? 'opacity-70 cursor-pointer border-border bg-muted/30 hover:border-muted-foreground/30'
                  : 'hover:border-primary/50 hover:bg-accent/50',
                isSelected && !isLocked
                  ? 'border-primary bg-primary/5'
                  : !isLocked && 'border-border bg-background'
              )}
            >
              {/* Model name with icon */}
              <div className="flex items-center gap-2 w-full">
                {getModelIcon(modelId)}
                <span className={cn(
                  'text-sm font-semibold',
                  isLocked && 'text-muted-foreground'
                )}>
                  {t(`${modelId}.label`)}
                </span>
              </div>

              {/* Description */}
              <p className={cn(
                'text-xs text-muted-foreground',
                isLocked && 'opacity-70'
              )}>
                {t(`${modelId}.description`)}
              </p>

              {/* Lock indicator for Premium-only models */}
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

              {/* Premium badge */}
              {modelInfo.badge && !isLocked && (
                <Badge
                  variant="secondary"
                  className="absolute right-2 top-2 text-xs px-1.5 py-0 bg-yellow-500/10 text-yellow-600 dark:text-yellow-400"
                >
                  {modelInfo.badge}
                </Badge>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
