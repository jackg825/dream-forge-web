'use client';

import { useState, useCallback, useRef } from 'react';
import { isSupported3DFormat } from '@/lib/modelAnalysis';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { Box, Upload } from 'lucide-react';

interface FileDropZoneProps {
  onFileSelect: (file: File) => void;
  disabled?: boolean;
}

const ACCEPTED_EXTENSIONS = '.stl,.obj,.glb,.gltf';

export function FileDropZone({ onFileSelect, disabled }: FileDropZoneProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback(
    (file: File) => {
      setError(null);

      if (!isSupported3DFormat(file.name)) {
        setError('Unsupported file format. Please upload STL, OBJ, GLB, or GLTF files.');
        return;
      }

      onFileSelect(file);
    },
    [onFileSelect]
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
          <span className="text-primary font-medium">Click to upload</span> or drag and drop
        </p>
        <p className="mt-1 text-sm text-muted-foreground">
          Supports STL, OBJ, GLB, GLTF (max 100MB)
        </p>

        {error && <p className="mt-2 text-sm text-destructive">{error}</p>}
      </CardContent>
    </Card>
  );
}
