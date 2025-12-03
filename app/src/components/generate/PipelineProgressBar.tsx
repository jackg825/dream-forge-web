'use client';

import { CheckCircle, Circle, Loader2, Coins, Image, Box, Palette, Truck, RotateCcw } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import type { ResetTargetStep } from '@/hooks/usePipeline';

const STEPS = [
  { id: 1, label: '準備圖片', icon: Image, resetTarget: 'images-ready' as ResetTargetStep },
  { id: 2, label: '生成網格', icon: Box, resetTarget: 'mesh-ready' as ResetTargetStep },
  { id: 3, label: '生成貼圖', icon: Palette, resetTarget: null },
  { id: 4, label: '打印配送', icon: Truck, comingSoon: true, resetTarget: null },
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
  return (
    <div className="bg-muted/30 rounded-xl border border-border/50 p-4 mb-6">
      <div className="flex items-center justify-between gap-4">
        {/* Left: Step Progress */}
        <div className="flex items-center gap-1 sm:gap-2 flex-1 min-w-0">
          {STEPS.map((step, index) => {
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
              <div key={step.id} className="flex items-center min-w-0">
                {/* Step indicator */}
                <button
                  type="button"
                  onClick={handleClick}
                  disabled={!isClickable}
                  className={cn(
                    'flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium transition-all',
                    'whitespace-nowrap border-0 bg-transparent',
                    isComingSoon && 'opacity-50',
                    isCompleted && !isComingSoon && 'bg-green-500/20 text-green-500',
                    isActive && !isFailed && !isComingSoon && 'bg-primary/20 text-primary',
                    isActive && isFailed && 'bg-destructive/20 text-destructive',
                    isPending && 'text-muted-foreground',
                    // Clickable styles
                    isClickable && 'cursor-pointer hover:bg-green-500/30 hover:ring-2 hover:ring-green-500/30 group',
                    !isClickable && 'cursor-default'
                  )}
                  title={isClickable ? `返回「${step.label}」步驟` : undefined}
                >
                  {isCompleted && !isComingSoon ? (
                    isClickable ? (
                      <RotateCcw className="h-3.5 w-3.5 shrink-0 group-hover:animate-spin-slow" />
                    ) : (
                      <CheckCircle className="h-3.5 w-3.5 shrink-0" />
                    )
                  ) : isActive && isProcessing ? (
                    <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin" />
                  ) : (
                    <StepIcon className="h-3.5 w-3.5 shrink-0" />
                  )}
                  <span className="hidden sm:inline">{step.label}</span>
                  {isComingSoon && (
                    <Badge variant="outline" className="ml-1 text-[10px] px-1 py-0 h-4 hidden md:inline-flex">
                      Soon
                    </Badge>
                  )}
                </button>

                {/* Connector */}
                {index < STEPS.length - 1 && (
                  <div
                    className={cn(
                      'w-4 sm:w-6 h-0.5 mx-1',
                      currentStep > step.id ? 'bg-green-500' : 'bg-border'
                    )}
                  />
                )}
              </div>
            );
          })}
        </div>

        {/* Divider */}
        <div className="h-8 w-px bg-border hidden sm:block" />

        {/* Right: Credits Info */}
        <div className="flex items-center gap-3 shrink-0">
          {/* Credits balance */}
          <div className="flex items-center gap-1.5">
            <Coins className="h-4 w-4 text-yellow-500" />
            <span className="text-base font-semibold">
              {creditsLoading ? '...' : credits ?? 0}
            </span>
            <span className="text-xs text-muted-foreground">點</span>
          </div>
        </div>
      </div>

      {/* Progress bar */}
      <div className="mt-3 h-1 bg-border rounded-full overflow-hidden">
        <div
          className={cn(
            'h-full rounded-full transition-all duration-500',
            isFailed ? 'bg-destructive' : 'bg-green-500'
          )}
          style={{ width: `${((currentStep - 1) / (STEPS.length - 1)) * 100}%` }}
        />
      </div>
    </div>
  );
}
