'use client';

import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { AlertTriangle, Loader2, RotateCcw, Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useTranslations } from 'next-intl';
import type { ResetTargetStep } from '@/hooks/usePipeline';

interface ResetStepDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  targetStep: ResetTargetStep;
  currentStep: string;
  onConfirm: (keepResults: boolean) => void;
  loading?: boolean;
}

const STEP_KEYS: Record<ResetTargetStep, string> = {
  draft: 'draft',
  'images-ready': 'imagesReady',
  'mesh-ready': 'meshReady',
};

/**
 * ResetStepDialog - Modal for resetting pipeline to a previous step
 *
 * Allows users to go back in the pipeline with options to:
 * - Keep existing results (just change status)
 * - Clear results and start fresh from that step
 */
export function ResetStepDialog({
  open,
  onOpenChange,
  targetStep,
  onConfirm,
  loading = false,
}: ResetStepDialogProps) {
  const t = useTranslations('resetDialog');
  const [keepResults, setKeepResults] = useState(true);

  const handleConfirm = () => {
    onConfirm(keepResults);
  };

  const handleClose = () => {
    if (!loading) {
      setKeepResults(true); // Reset to default
      onOpenChange(false);
    }
  };

  const stepKey = STEP_KEYS[targetStep];
  const stepLabel = t(`steps.${stepKey}.label`);
  const stepDescription = t(`steps.${stepKey}.description`);

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[450px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <RotateCcw className="h-5 w-5" />
            {t('title', { step: stepLabel })}
          </DialogTitle>
          <DialogDescription>
            {stepDescription}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-4">
          {/* Keep results option */}
          <button
            type="button"
            onClick={() => setKeepResults(true)}
            className={cn(
              'w-full flex items-start space-x-3 p-3 rounded-lg border text-left transition-colors',
              keepResults
                ? 'border-primary bg-primary/5'
                : 'border-border hover:bg-muted/50'
            )}
          >
            <div className={cn(
              'mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border',
              keepResults
                ? 'border-primary bg-primary text-primary-foreground'
                : 'border-muted-foreground'
            )}>
              {keepResults && <Check className="h-3 w-3" />}
            </div>
            <div className="space-y-1">
              <p className="font-medium text-sm">{t('keepResults.title')}</p>
              <p className="text-xs text-muted-foreground">
                {t('keepResults.description')}
              </p>
            </div>
          </button>

          {/* Clear results option */}
          <button
            type="button"
            onClick={() => setKeepResults(false)}
            className={cn(
              'w-full flex items-start space-x-3 p-3 rounded-lg border text-left transition-colors',
              !keepResults
                ? 'border-primary bg-primary/5'
                : 'border-border hover:bg-muted/50'
            )}
          >
            <div className={cn(
              'mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border',
              !keepResults
                ? 'border-primary bg-primary text-primary-foreground'
                : 'border-muted-foreground'
            )}>
              {!keepResults && <Check className="h-3 w-3" />}
            </div>
            <div className="space-y-1">
              <p className="font-medium text-sm">{t('clearResults.title')}</p>
              <p className="text-xs text-muted-foreground">
                {t('clearResults.description')}
              </p>
            </div>
          </button>

          {!keepResults && (
            <div className="flex items-start gap-2 p-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg">
              <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400 mt-0.5 flex-shrink-0" />
              <p className="text-sm text-amber-800 dark:text-amber-200">
                {t('clearWarning')}
              </p>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={handleClose}
            disabled={loading}
          >
            {t('cancel')}
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={loading}
          >
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {t('processing')}
              </>
            ) : (
              <>
                <RotateCcw className="mr-2 h-4 w-4" />
                {t('confirm')}
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
