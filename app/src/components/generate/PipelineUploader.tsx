'use client';

import { useState, useCallback, useRef } from 'react';
import { uploadImage, validateImage } from '@/lib/storage';
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
 * Supports drag-and-drop and click-to-upload within the configured limit.
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

      const nextImages = [...images];

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

          nextImages.push(newImage);
          onImagesChange([...nextImages]);
        } catch (err) {
          URL.revokeObjectURL(previewUrl);
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
    <div className="space-y-5">
      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/heic,image/heif,.heic,.heif"
        multiple={maxImages > 1}
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
        <div className={maxImages === 1 ? "mx-auto max-w-xs" : "grid grid-cols-2 gap-4 md:grid-cols-4"}>
          {images.map((image, index) => (
            <div
              key={index}
              className="group relative aspect-square overflow-hidden rounded-[20px] bg-muted"
            >
              {/* eslint-disable-next-line @next/next/no-img-element -- Local object URL previews are not reliably supported by next/image. */}
              <img
                src={image.previewUrl || image.url}
                alt={t('uploadedImage', { index: index + 1 })}
                className="w-full h-full object-cover"
              />
              {!disabled && (
                <button
                  type="button"
                  onClick={() => handleRemoveImage(index)}
                  className="absolute top-2 right-2 p-1.5 bg-black/60 hover:bg-black/80 rounded-full text-white opacity-100 md:opacity-0 md:group-hover:opacity-100 group-focus-within:opacity-100 focus-visible:opacity-100 transition-opacity"
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
              className="flex aspect-square flex-col items-center justify-center gap-2 rounded-[20px] border border-dashed border-border bg-card text-muted-foreground transition-colors hover:border-primary hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
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
          {/* Dropzone */}
          <div
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            className={`
              relative rounded-[28px] border border-dashed p-8 text-center sm:p-12
              transition-colors duration-200
              ${isDragging ? 'border-primary bg-primary/5' : 'border-border bg-card hover:border-primary/50'}
              ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
            `}
          >
            <button
              type="button"
              onClick={() => canUploadMore && fileInputRef.current?.click()}
              disabled={disabled}
              aria-label={t('dropzone.button')}
              className="absolute inset-0 rounded-[28px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-4 disabled:cursor-not-allowed"
            />
            <div className="pointer-events-none relative flex flex-col items-center gap-5">
              <div className="rounded-[22px] bg-muted p-5">
                <ImageIcon className="h-10 w-10 text-foreground/60" strokeWidth={1.5} />
              </div>
              <div>
                <p className="text-2xl font-semibold tracking-tight">{t('dropzone.title')}</p>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  {t('dropzone.subtitle', { max: maxImages })}
                </p>
              </div>
              <span className="inline-flex min-h-11 items-center rounded-full bg-primary px-6 py-2.5 text-sm font-medium text-primary-foreground">
                <Upload className="mr-2 h-4 w-4" />
                {t('dropzone.button')}
              </span>
              <p className="text-xs text-muted-foreground">
                {t('dropzone.formats')}
              </p>
            </div>
          </div>
          {/* Photo tips */}
          <div className="rounded-[20px] bg-card px-5 py-5 sm:px-7">
            <div className="flex items-start gap-3">
              <Camera className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground" />
              <div>
                <p className="text-sm font-semibold text-foreground">{t('photoTips.title')}</p>
                <ul className="mt-2 space-y-1.5 text-sm leading-relaxed text-muted-foreground">
                  <li><span className="font-medium text-foreground">{t('photoTips.frontView')}</span>：{t('photoTips.frontViewDesc')}</li>
                  <li><span className="font-medium text-foreground">{t('photoTips.clearComplete')}</span>：{t('photoTips.clearCompleteDesc')}</li>
                  <li><span className="font-medium text-foreground">{t('photoTips.simpleBackground')}</span>：{t('photoTips.simpleBackgroundDesc')}</li>
                </ul>
              </div>
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
