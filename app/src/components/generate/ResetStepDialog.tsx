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
import type { ResetTargetStep } from '@/hooks/usePipeline';

interface ResetStepDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  targetStep: ResetTargetStep;
  currentStep: string;
  onConfirm: (keepResults: boolean) => void;
  loading?: boolean;
}

const STEP_LABELS: Record<ResetTargetStep, string> = {
  'draft': '上傳圖片',
  'images-ready': '圖片預覽',
  'mesh-ready': '網格預覽',
};

const STEP_DESCRIPTIONS: Record<ResetTargetStep, string> = {
  'draft': '返回上傳圖片步驟，可以重新上傳或修改圖片分析設定',
  'images-ready': '返回圖片預覽步驟，可以重新生成視角或選擇不同的 provider',
  'mesh-ready': '返回網格預覽步驟，可以重新生成貼圖',
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
  currentStep,
  onConfirm,
  loading = false,
}: ResetStepDialogProps) {
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

  const stepLabel = STEP_LABELS[targetStep];
  const stepDescription = STEP_DESCRIPTIONS[targetStep];

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[450px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <RotateCcw className="h-5 w-5" />
            返回「{stepLabel}」步驟
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
              <p className="font-medium text-sm">保留已生成的結果</p>
              <p className="text-xs text-muted-foreground">
                僅變更狀態，已生成的內容仍可查看
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
              <p className="font-medium text-sm">清除並重新開始</p>
              <p className="text-xs text-muted-foreground">
                清除該步驟之後的所有生成結果
              </p>
            </div>
          </button>

          {!keepResults && (
            <div className="flex items-start gap-2 p-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg">
              <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400 mt-0.5 flex-shrink-0" />
              <p className="text-sm text-amber-800 dark:text-amber-200">
                注意：清除結果後無法恢復，且已扣除的積分不會退還。
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
            取消
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={loading}
          >
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                處理中...
              </>
            ) : (
              <>
                <RotateCcw className="mr-2 h-4 w-4" />
                確認返回
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
