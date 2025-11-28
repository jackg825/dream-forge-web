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

  return (
    <Card
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onClick={handleClick}
      className={cn(
        'cursor-pointer transition-colors duration-200',
        isDragging && 'border-primary bg-primary/5',
        error && 'border-destructive bg-destructive/5',
        disabled && 'opacity-50 cursor-not-allowed'
      )}
    >
      <CardContent className="flex flex-col items-center justify-center p-8">
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
            'w-16 h-16 rounded-full flex items-center justify-center mb-4',
            isDragging ? 'bg-primary/10' : 'bg-muted'
          )}
        >
          <Box
            className={cn(
              'h-8 w-8',
              isDragging ? 'text-primary' : 'text-muted-foreground'
            )}
          />
        </div>

        <p className="text-foreground">
          <span className="text-primary font-medium">{t('dropZone.clickToUpload')}</span>{' '}
          {t('dropZone.orDragDrop')}
        </p>
        <p className="mt-1 text-sm text-muted-foreground">
          {t('dropZone.supportedFormats')}
        </p>

        {error && <p className="mt-2 text-sm text-destructive">{error}</p>}
      </CardContent>
    </Card>
  );
}
