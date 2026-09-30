'use client';

import { CheckCircle, Loader2, Coins, Image, Box, Truck, RotateCcw } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { useTranslations } from 'next-intl';
import type { ResetTargetStep } from '@/hooks/usePipeline';

// Step icons and reset targets (labels come from translations)
// Note: Generate Texture step removed - texture is now generated with mesh
const STEP_CONFIG = [
  { id: 1, labelKey: 'prepareImages', icon: Image, resetTarget: 'images-ready' as ResetTargetStep },
  { id: 2, labelKey: 'generateMesh', icon: Box, resetTarget: 'mesh-ready' as ResetTargetStep },
  { id: 3, labelKey: 'printDelivery', icon: Truck, comingSoon: true, resetTarget: null },
] as const;

interface PipelineProgressBarProps {
  currentStep: number;
  isFailed: boolean;
  isProcessing?: boolean;
  credits: number | null;
  creditsLoading: boolean;
  onStepClick?: (targetStep: ResetTargetStep) => void;
}

export function PipelineProgressBar({
  currentStep,
  isFailed,
  isProcessing = false,
  credits,
  creditsLoading,
  onStepClick,
}: PipelineProgressBarProps) {
  const t = useTranslations();

  return (
    <div className="rounded-[24px] bg-card px-4 py-5 sm:px-7">
      <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
        {/* Left: Step Progress */}
        <ol className="flex flex-1 items-center justify-between gap-1 sm:justify-start sm:gap-3">
          {STEP_CONFIG.map((step, index) => {
            const stepLabel = t(`pipeline.steps.${step.labelKey}`);
            const isCompleted = currentStep > step.id;
            const isActive = currentStep === step.id;
            const isPending = currentStep < step.id;
            const isComingSoon = 'comingSoon' in step && step.comingSoon;
            const StepIcon = step.icon;
            // Step is clickable if completed, not processing, has a reset target, and callback exists
            const isClickable = isCompleted && !isProcessing && step.resetTarget && onStepClick;

            const handleClick = () => {
              if (isClickable && step.resetTarget) {
                onStepClick(step.resetTarget);
              }
            };

            return (
              <li key={step.id} className="flex min-w-0 items-center">
                {/* Step indicator */}
                <button
                  type="button"
                  onClick={handleClick}
                  disabled={!isClickable}
                  aria-current={isActive ? 'step' : undefined}
                  aria-label={isComingSoon
                    ? `${stepLabel} (${t('pipeline.progressBar.soon')})`
                    : stepLabel}
                  className={cn(
                    'flex flex-col items-center gap-2 rounded-xl px-1 py-1 text-xs font-medium transition-colors sm:flex-row sm:gap-2.5 sm:px-2',
                    'whitespace-nowrap border-0 bg-transparent',
                    isComingSoon && 'text-muted-foreground/60',
                    isCompleted && !isComingSoon && 'text-foreground',
                    isActive && !isFailed && !isComingSoon && 'text-primary',
                    isActive && isFailed && 'text-destructive',
                    isPending && 'text-muted-foreground',
                    // Clickable styles
                    isClickable && 'group cursor-pointer hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50',
                    !isClickable && 'cursor-default'
                  )}
                  title={isClickable ? t('pipeline.progressBar.returnToStep', { step: stepLabel }) : undefined}
                >
                  <span className={cn(
                    'flex h-8 w-8 shrink-0 items-center justify-center rounded-full',
                    isActive && !isFailed && !isComingSoon ? 'bg-primary text-white' : 'bg-muted text-muted-foreground',
                    isCompleted && !isComingSoon && 'bg-foreground text-background',
                    isActive && isFailed && 'bg-destructive text-white'
                  )}>
                    {isCompleted && !isComingSoon ? (
                      isClickable ? <RotateCcw className="h-4 w-4" /> : <CheckCircle className="h-4 w-4" />
                    ) : isActive && isProcessing ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <StepIcon className="h-4 w-4" />
                    )}
                  </span>
                  <span className="max-w-[4.25rem] whitespace-normal text-[11px] leading-tight text-center sm:max-w-none sm:text-sm">
                    {stepLabel}
                  </span>
                  {isComingSoon && (
                    <Badge variant="outline" className="ml-1 text-[10px] px-1 py-0 h-4 hidden md:inline-flex">
                      {t('pipeline.progressBar.soon')}
                    </Badge>
                  )}
                </button>

                {/* Connector */}
                {index < STEP_CONFIG.length - 1 && (
                  <div
                    className={cn(
                      'mx-1 h-px w-3 sm:mx-3 sm:w-8',
                      currentStep > step.id ? 'bg-foreground/40' : 'bg-border'
                    )}
                  />
                )}
              </li>
            );
          })}
        </ol>

        {/* Right: Credits Info */}
        <div className="flex items-center gap-3 shrink-0">
          {/* Credits balance */}
          <div className="flex items-center gap-2 rounded-full bg-muted px-3.5 py-2 sm:px-4">
            <Coins className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-semibold tabular-nums">
              {creditsLoading ? '...' : credits ?? 0}
            </span>
            <span className="text-xs text-muted-foreground">{t('pipeline.credits.points')}</span>
          </div>
        </div>
      </div>

      {/* Progress bar */}
      <div className="mt-5 h-0.5 overflow-hidden rounded-full bg-muted">
        <div
          className={cn(
            'h-full rounded-full transition-all duration-500',
            isFailed ? 'bg-destructive' : 'bg-primary'
          )}
          style={{ width: `${((currentStep - 1) / (STEP_CONFIG.length - 1)) * 100}%` }}
        />
      </div>
    </div>
  );
}
