'use client';

import { useCallback, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { H2CCompareView } from './H2CCompareView';
import { H2CColorPalette } from './H2CColorPalette';
import type { H2COptimizeStatus } from '@/types';

interface H2COptimizeStepProps {
  status: H2COptimizeStatus;
  originalUrl: string | null;
  optimizedUrl: string | null;
  colorPalette: string[];
  error: string | null;
  onReOptimize: () => Promise<boolean>;
  onDownload: () => Promise<void>;
  onUploadEdited: (file: File) => Promise<boolean>;
  onConfirm: () => void;
  onBack: () => void;
  credits: number;
}

/**
 * Step 2: Preview and confirm color optimization result
 */
export function H2COptimizeStep({
  status,
  originalUrl,
  optimizedUrl,
  colorPalette,
  error,
  onReOptimize,
  onDownload,
  onUploadEdited,
  onConfirm,
  onBack,
  credits,
}: H2COptimizeStepProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleUploadClick = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleFileInput = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
        await onUploadEdited(file);
      }
    },
    [onUploadEdited]
  );

  const isLoading = status === 'optimizing';
  const hasError = status === 'error';
  const isReady = status === 'optimized' && optimizedUrl;

  return (
    <div className="space-y-6">
      {/* Compare View */}
      <H2CCompareView
        originalUrl={originalUrl}
        optimizedUrl={optimizedUrl}
        isLoading={isLoading}
      />

      {/* Error Message */}
      {hasError && error && (
        <div className="p-4 rounded-lg bg-destructive/10 border border-destructive/20">
          <p className="text-sm text-destructive">{error}</p>
        </div>
      )}

      {/* Color Palette */}
      {isReady && colorPalette.length > 0 && (
        <H2CColorPalette colors={colorPalette} />
      )}

      {/* Hidden file input for uploading edited image */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        onChange={handleFileInput}
        className="hidden"
      />

      {/* Actions */}
      <div className="flex flex-wrap gap-3 justify-center">
        {/* Back button */}
        <Button variant="outline" onClick={onBack} disabled={isLoading}>
          返回上傳
        </Button>

        {/* Re-optimize button */}
        <Button
          variant="outline"
          onClick={onReOptimize}
          disabled={isLoading || credits < 1}
        >
          {credits < 1 ? '點數不足' : '重新優化 (1 點)'}
        </Button>

        {/* Download button */}
        {isReady && (
          <Button variant="outline" onClick={onDownload}>
            下載圖片
          </Button>
        )}

        {/* Upload edited button */}
        <Button variant="outline" onClick={handleUploadClick} disabled={isLoading}>
          上傳編輯後圖片
        </Button>

        {/* Confirm button */}
        {isReady && (
          <Button onClick={onConfirm}>
            確認使用
          </Button>
        )}
      </div>

      {/* Help text */}
      <p className="text-center text-sm text-muted-foreground">
        {isLoading
          ? '正在使用 AI 將圖片簡化為七色...'
          : isReady
            ? '滿意結果可直接確認，或下載圖片用外部工具編輯後重新上傳'
            : hasError
              ? '優化失敗，請嘗試其他圖片或重新優化'
              : '請等待優化完成'}
      </p>
    </div>
  );
}
