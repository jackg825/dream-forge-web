'use client';

import { useCallback, useRef, useState } from 'react';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';

interface H2CUploadStepProps {
  originalImage: {
    file: File | null;
    url: string | null;
  };
  uploadProgress: number;
  uploadError: string | null;
  onUpload: (file: File) => Promise<boolean>;
  onNext: () => Promise<boolean>;
  canOptimize: boolean;
  credits: number;
}

/**
 * Step 1: Upload original image for H2C optimization
 */
export function H2CUploadStep({
  originalImage,
  uploadProgress,
  uploadError,
  onUpload,
  onNext,
  canOptimize,
  credits,
}: H2CUploadStepProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isOptimizing, setIsOptimizing] = useState(false);

  const handleFile = useCallback(
    async (file: File) => {
      setIsUploading(true);
      await onUpload(file);
      setIsUploading(false);
    },
    [onUpload]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      const file = e.dataTransfer.files[0];
      if (file) handleFile(file);
    },
    [handleFile]
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleFileInput = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) handleFile(file);
    },
    [handleFile]
  );

  const handleClick = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleStartOptimize = useCallback(async () => {
    setIsOptimizing(true);
    await onNext();
    setIsOptimizing(false);
  }, [onNext]);

  // Show uploaded image preview
  if (originalImage.url) {
    return (
      <div className="space-y-4">
        <div className="relative aspect-square max-w-md mx-auto rounded-lg overflow-hidden border-2 border-primary bg-muted">
          <Image
            src={originalImage.url}
            alt="Uploaded image"
            fill
            className="object-contain"
            unoptimized
          />
          <button
            type="button"
            onClick={handleClick}
            className="absolute top-2 right-2 p-2 bg-background/80 rounded-full shadow hover:bg-background transition-colors"
            aria-label="Change image"
          >
            <svg
              className="w-4 h-4 text-foreground"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
              />
            </svg>
          </button>
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          onChange={handleFileInput}
          className="hidden"
        />

        <div className="flex justify-center">
          <Button
            onClick={handleStartOptimize}
            disabled={!canOptimize || isOptimizing}
            size="lg"
            className="min-w-[200px]"
          >
            {isOptimizing ? (
              <>
                <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin mr-2" />
                優化中...
              </>
            ) : credits < 1 ? (
              '點數不足'
            ) : (
              <>開始優化 (1 點)</>
            )}
          </Button>
        </div>
      </div>
    );
  }

  // Show uploading progress
  if (isUploading) {
    return (
      <div className="space-y-4">
        <div className="flex flex-col items-center justify-center p-8 rounded-lg border-2 border-dashed border-primary bg-primary/5">
          <p className="text-foreground mb-4">上傳中...</p>
          <div className="w-full max-w-xs">
            <Progress value={uploadProgress} className="h-2" />
          </div>
          <p className="text-sm text-muted-foreground mt-2">
            {Math.round(uploadProgress)}%
          </p>
        </div>
      </div>
    );
  }

  // Show drop zone
  return (
    <div className="space-y-4">
      <div
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onClick={handleClick}
        className={`
          relative rounded-lg border-2 border-dashed p-12 text-center cursor-pointer
          transition-colors duration-200
          ${isDragging ? 'border-primary bg-primary/10' : 'border-border hover:border-primary/50 bg-muted/50'}
          ${uploadError ? 'border-destructive bg-destructive/5' : ''}
        `}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          onChange={handleFileInput}
          className="hidden"
        />

        <div className="flex flex-col items-center">
          <div
            className={`
              w-16 h-16 rounded-full flex items-center justify-center mb-4
              ${isDragging ? 'bg-primary/20' : 'bg-muted'}
            `}
          >
            <svg
              className={`w-8 h-8 ${isDragging ? 'text-primary' : 'text-muted-foreground'}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
              />
            </svg>
          </div>

          <p className="text-foreground">
            <span className="text-primary font-medium">點擊上傳</span> 或拖放圖片
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            JPG, PNG, WEBP (最大 10MB)
          </p>

          {uploadError && (
            <p className="mt-3 text-sm text-destructive">{uploadError}</p>
          )}
        </div>
      </div>

      <p className="text-center text-sm text-muted-foreground">
        上傳照片後，系統將自動簡化為 7 種顏色，適合拓竹 H2C 多色打印
      </p>
    </div>
  );
}
