'use client';

import { useState, useCallback, useRef } from 'react';
import { useTranslations } from 'next-intl';
import { isSupported3DFormat } from '@/lib/modelAnalysis';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { Box } from 'lucide-react';

interface FileDropZoneProps {
  onFileSelect: (file: File) => void;
  disabled?: boolean;
}

const ACCEPTED_EXTENSIONS = '.stl,.obj,.glb,.gltf';

export function FileDropZone({ onFileSelect, disabled }: FileDropZoneProps) {
  const t = useTranslations('preview');
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback(
    (file: File) => {
      setError(null);

      if (!isSupported3DFormat(file.name)) {
        setError(t('unsupportedFormat'));
        return;
      }

      onFileSelect(file);
    },
    [onFileSelect, t]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);

      if (disabled) return;

      const file = e.dataTransfer.files[0];
      if (file) {
        handleFile(file);
      }
    },
    [handleFile, disabled]
  );

  const handleDragOver = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      if (!disabled) {
        setIsDragging(true);
      }
    },
    [disabled]
  );

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleFileInput = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
        handleFile(file);
      }
    },
    [handleFile]
  );

  const handleClick = useCallback(() => {
    if (!disabled) {
      fileInputRef.current?.click();
    }
  }, [disabled]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (!disabled && (e.key === 'Enter' || e.key === ' ')) {
        e.preventDefault();
        fileInputRef.current?.click();
      }
    },
    [disabled]
  );

  return (
    <Card
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      role="button"
      tabIndex={disabled ? -1 : 0}
      aria-disabled={disabled}
      aria-label={`${t('dropZone.clickToUpload')} ${t('dropZone.orDragDrop')}`}
      className={cn(
        'cursor-pointer border-0 py-0 transition-[background-color,box-shadow] duration-200 hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-4',
        isDragging && 'bg-primary/5 ring-2 ring-primary',
        error && 'bg-destructive/5 ring-1 ring-destructive/40',
        disabled && 'opacity-50 cursor-not-allowed'
      )}
    >
      <CardContent className="flex min-h-[420px] flex-col items-center justify-center px-6 py-12 text-center sm:min-h-[560px]">
        <input
          ref={fileInputRef}
          type="file"
          accept={ACCEPTED_EXTENSIONS}
          onChange={handleFileInput}
          className="hidden"
          disabled={disabled}
        />

        {/* 3D Model Icon */}
        <div
          className={cn(
            'mb-8 flex h-28 w-28 items-center justify-center rounded-[32px]',
            isDragging ? 'bg-primary/10' : 'bg-muted'
          )}
        >
          <Box
            className={cn(
              'h-12 w-12',
              isDragging ? 'text-primary' : 'text-muted-foreground'
            )}
          />
        </div>

        <p className="max-w-sm text-xl font-semibold leading-relaxed tracking-tight text-foreground">
          <span className="text-primary">{t('dropZone.clickToUpload')}</span>{' '}
          {t('dropZone.orDragDrop')}
        </p>
        <p className="mt-4 text-sm text-muted-foreground">
          {t('dropZone.supportedFormats')}
        </p>

        {error && (
          <p className="mt-2 text-sm text-destructive" role="alert">
            {error}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
