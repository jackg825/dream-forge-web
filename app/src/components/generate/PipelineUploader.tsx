'use client';

import { useState, useCallback, useRef } from 'react';
import { uploadImage, validateImage } from '@/lib/storage';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Upload, X, Image as ImageIcon, AlertCircle } from 'lucide-react';

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
        setError(`最多只能上傳 ${maxImages} 張圖片`);
        return;
      }

      for (const file of fileArray) {
        // Validate and auto-compress
        const validation = await validateImage(file);
        if (!validation.valid) {
          setError(validation.error || '圖片格式不正確');
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
          setError(err instanceof Error ? err.message : '上傳失敗');
        } finally {
          setUploadProgress(null);
        }
      }
    },
    [userId, images, maxImages, disabled, onImagesChange]
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
                alt={`上傳的圖片 ${index + 1}`}
                className="w-full h-full object-cover"
              />
              {!disabled && (
                <button
                  type="button"
                  onClick={() => handleRemoveImage(index)}
                  className="absolute top-2 right-2 p-1.5 bg-black/60 hover:bg-black/80 rounded-full text-white opacity-0 group-hover:opacity-100 transition-opacity"
                  aria-label="移除圖片"
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
              <span className="text-xs">添加更多</span>
            </button>
          )}
        </div>
      )}

      {/* Upload dropzone (when no images) */}
      {images.length === 0 && (
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
              <p className="text-lg font-medium">拖放圖片到這裡</p>
              <p className="text-sm text-muted-foreground mt-1">
                或點擊選擇圖片 (最多 {maxImages} 張)
              </p>
            </div>
            <Button variant="secondary" size="sm" disabled={disabled}>
              <Upload className="h-4 w-4 mr-2" />
              選擇圖片
            </Button>
            <p className="text-xs text-muted-foreground">
              支援 JPG、PNG、WebP 格式
            </p>
          </div>
        </div>
      )}

      {/* Upload progress */}
      {uploadProgress !== null && (
        <div className="space-y-2">
          <Progress value={uploadProgress} />
          <p className="text-sm text-muted-foreground text-center">
            上傳中... {Math.round(uploadProgress)}%
          </p>
        </div>
      )}

      {/* Image count */}
      {images.length > 0 && (
        <p className="text-sm text-muted-foreground text-center">
          已上傳 {images.length} / {maxImages} 張圖片
        </p>
      )}
    </div>
  );
}
