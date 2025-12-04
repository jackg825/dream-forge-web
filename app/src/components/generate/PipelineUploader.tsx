'use client';

import { useState, useCallback, useRef } from 'react';
import { uploadImage, validateImage } from '@/lib/storage';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Upload, X, Image as ImageIcon, AlertCircle, Camera } from 'lucide-react';
import { useTranslations } from 'next-intl';

interface UploadedImage {
  url: string;
  file?: File;
  previewUrl?: string;
}

interface PipelineUploaderProps {
  userId: string;
  images: UploadedImage[];
  onImagesChange: (images: UploadedImage[]) => void;
  maxImages?: number;
  disabled?: boolean;
}

/**
 * PipelineUploader - Simple multi-image uploader for the pipeline flow
 *
 * Supports drag-and-drop and click-to-upload for 1-4 images.
 * Images are uploaded to Firebase Storage immediately.
 */
export function PipelineUploader({
  userId,
  images,
  onImagesChange,
  maxImages = 4,
  disabled = false,
}: PipelineUploaderProps) {
  const t = useTranslations('pipelineUploader');
  const [isDragging, setIsDragging] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFiles = useCallback(
    async (files: FileList) => {
      if (disabled) return;

      setError(null);
      const fileArray = Array.from(files);
      const remainingSlots = maxImages - images.length;

      if (fileArray.length > remainingSlots) {
        setError(t('maxImagesError', { max: maxImages }));
        return;
      }

      for (const file of fileArray) {
        // Validate and auto-compress
        const validation = await validateImage(file);
        if (!validation.valid) {
          setError(validation.error || t('invalidFormat'));
          continue;
        }

        // Use the processed file (may be compressed/converted)
        const processedFile = validation.file || file;

        // Create preview
        const previewUrl = URL.createObjectURL(processedFile);

        // Upload
        try {
          setUploadProgress(0);
          const result = await uploadImage(processedFile, userId, (p) => {
            setUploadProgress(p.progress);
          });

          const newImage: UploadedImage = {
            url: result.downloadUrl,
            file: processedFile,
            previewUrl,
          };

          onImagesChange([...images, newImage]);
        } catch (err) {
          setError(err instanceof Error ? err.message : t('uploadFailed'));
        } finally {
          setUploadProgress(null);
        }
      }
    },
    [userId, images, maxImages, disabled, onImagesChange, t]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);

      if (e.dataTransfer.files.length > 0) {
        handleFiles(e.dataTransfer.files);
      }
    },
    [handleFiles]
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
      if (e.target.files && e.target.files.length > 0) {
        handleFiles(e.target.files);
      }
      // Reset input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    },
    [handleFiles]
  );

  const handleRemoveImage = useCallback(
    (index: number) => {
      const newImages = [...images];
      // Revoke preview URL to prevent memory leaks
      if (newImages[index].previewUrl) {
        URL.revokeObjectURL(newImages[index].previewUrl!);
      }
      newImages.splice(index, 1);
      onImagesChange(newImages);
    },
    [images, onImagesChange]
  );

  const canUploadMore = images.length < maxImages && !disabled;

  return (
    <div className="space-y-4">
      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/heic,image/heif,.heic,.heif"
        multiple
        onChange={handleFileInput}
        className="hidden"
        disabled={disabled}
      />

      {/* Error display */}
      {error && (
        <div className="flex items-center gap-2 p-3 bg-destructive/10 border border-destructive/20 rounded-lg text-destructive text-sm">
          <AlertCircle className="h-4 w-4 flex-shrink-0" />
          {error}
        </div>
      )}

      {/* Image grid */}
      {images.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {images.map((image, index) => (
            <div
              key={index}
              className="relative group aspect-square rounded-lg overflow-hidden border bg-muted"
            >
              <img
                src={image.previewUrl || image.url}
                alt={t('uploadedImage', { index: index + 1 })}
                className="w-full h-full object-cover"
              />
              {!disabled && (
                <button
                  type="button"
                  onClick={() => handleRemoveImage(index)}
                  className="absolute top-2 right-2 p-1.5 bg-black/60 hover:bg-black/80 rounded-full text-white opacity-0 group-hover:opacity-100 transition-opacity"
                  aria-label={t('removeImage')}
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
          ))}

          {/* Add more button (inline) */}
          {canUploadMore && (
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="aspect-square rounded-lg border-2 border-dashed border-muted-foreground/25 hover:border-primary/50 flex flex-col items-center justify-center gap-2 text-muted-foreground hover:text-primary transition-colors"
            >
              <Upload className="h-8 w-8" />
              <span className="text-xs">{t('addMore')}</span>
            </button>
          )}
        </div>
      )}

      {/* Upload dropzone (when no images) */}
      {images.length === 0 && (
        <>
          {/* Photo tips */}
          <div className="p-4 bg-blue-50 dark:bg-blue-950/30 rounded-lg border border-blue-200 dark:border-blue-800">
            <div className="flex items-start gap-3">
              <Camera className="w-5 h-5 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
              <div>
                <p className="font-medium text-blue-900 dark:text-blue-100">{t('photoTips.title')}</p>
                <ul className="text-sm text-blue-700 dark:text-blue-300 mt-1.5 space-y-1">
                  <li>• <strong>{t('photoTips.frontView')}</strong>：{t('photoTips.frontViewDesc')}</li>
                  <li>• <strong>{t('photoTips.clearComplete')}</strong>：{t('photoTips.clearCompleteDesc')}</li>
                  <li>• <strong>{t('photoTips.simpleBackground')}</strong>：{t('photoTips.simpleBackgroundDesc')}</li>
                </ul>
              </div>
            </div>
          </div>

          {/* Dropzone */}
          <div
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onClick={() => canUploadMore && fileInputRef.current?.click()}
            className={`
              relative border-2 border-dashed rounded-xl p-8 text-center cursor-pointer
              transition-all duration-200
              ${isDragging ? 'border-primary bg-primary/5' : 'border-muted-foreground/25 hover:border-primary/50'}
              ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
            `}
          >
            <div className="flex flex-col items-center gap-4">
              <div className="p-4 rounded-full bg-muted">
                <ImageIcon className="h-10 w-10 text-muted-foreground" />
              </div>
              <div>
                <p className="text-lg font-medium">{t('dropzone.title')}</p>
                <p className="text-sm text-muted-foreground mt-1">
                  {t('dropzone.subtitle', { max: maxImages })}
                </p>
              </div>
              <Button variant="secondary" size="sm" disabled={disabled}>
                <Upload className="h-4 w-4 mr-2" />
                {t('dropzone.button')}
              </Button>
              <p className="text-xs text-muted-foreground">
                {t('dropzone.formats')}
              </p>
            </div>
          </div>
        </>
      )}

      {/* Upload progress */}
      {uploadProgress !== null && (
        <div className="space-y-2">
          <Progress value={uploadProgress} />
          <p className="text-sm text-muted-foreground text-center">
            {t('uploading', { progress: Math.round(uploadProgress) })}
          </p>
        </div>
      )}

      {/* Image count */}
      {images.length > 0 && (
        <p className="text-sm text-muted-foreground text-center">
          {t('imageCount', { count: images.length, max: maxImages })}
        </p>
      )}
    </div>
  );
}
