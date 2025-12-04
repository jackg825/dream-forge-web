'use client';

import { useState, useCallback, useRef } from 'react';
import { uploadImage, validateImage, type UploadProgress } from '@/lib/storage';
import { useTranslations } from 'next-intl';

interface ImageUploaderProps {
  userId: string;
  onUploadComplete: (imageUrl: string) => void;
  onError?: (error: string) => void;
}

type UploadState = 'idle' | 'validating' | 'uploading' | 'complete';

export function ImageUploader({ userId, onUploadComplete, onError }: ImageUploaderProps) {
  const t = useTranslations();
  const [state, setState] = useState<UploadState>('idle');
  const [progress, setProgress] = useState<UploadProgress | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback(
    async (file: File) => {
      setError(null);
      setState('validating');

      // Validate and auto-compress image
      const validation = await validateImage(file);
      if (!validation.valid) {
        setError(validation.error || 'Invalid image');
        setState('idle');
        onError?.(validation.error || 'Invalid image');
        return;
      }

      // Use the processed file (may be compressed/converted)
      const processedFile = validation.file || file;

      // Create preview
      const previewUrl = URL.createObjectURL(processedFile);
      setPreview(previewUrl);

      // Upload
      setState('uploading');
      try {
        const result = await uploadImage(processedFile, userId, (p) => {
          setProgress(p);
        });
        setState('complete');
        onUploadComplete(result.downloadUrl);
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Upload failed';
        setError(errorMessage);
        setState('idle');
        setPreview(null);
        onError?.(errorMessage);
      }
    },
    [userId, onUploadComplete, onError]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);

      const file = e.dataTransfer.files[0];
      if (file) {
        handleFile(file);
      }
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
      if (file) {
        handleFile(file);
      }
    },
    [handleFile]
  );

  const handleClick = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleRemove = useCallback(() => {
    setState('idle');
    setPreview(null);
    setProgress(null);
    setError(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, []);

  // Preview state
  if (state === 'complete' && preview) {
    return (
      <div className="relative rounded-lg overflow-hidden border-2 border-green-500 bg-gray-50">
        <img
          src={preview}
          alt={t('imageUploader.uploadedPreview')}
          className="w-full h-64 object-contain"
        />
        <button
          type="button"
          onClick={handleRemove}
          className="absolute top-2 right-2 p-1 bg-white rounded-full shadow hover:bg-gray-100"
          aria-label={t('imageUploader.removeImage')}
        >
          <svg
            className="w-5 h-5 text-gray-600"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </button>
        <div className="absolute bottom-2 left-2 bg-green-500 text-white text-xs px-2 py-1 rounded">
          {t('imageUploader.readyToGenerate')}
        </div>
      </div>
    );
  }

  // Uploading state
  if (state === 'uploading' && preview) {
    return (
      <div className="relative rounded-lg overflow-hidden border-2 border-indigo-500 bg-gray-50">
        <img
          src={preview}
          alt={t('imageUploader.uploadingPreview')}
          className="w-full h-64 object-contain opacity-50"
        />
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/30">
          <div className="w-48 h-2 bg-gray-200 rounded-full overflow-hidden">
            <div
              className="h-full bg-indigo-600 transition-all duration-300"
              style={{ width: `${progress?.progress || 0}%` }}
            />
          </div>
          <p className="mt-2 text-white text-sm">
            {t('imageUploader.uploading', { progress: Math.round(progress?.progress || 0) })}
          </p>
        </div>
      </div>
    );
  }

  // Default drop zone
  return (
    <div
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onClick={handleClick}
      className={`
        relative rounded-lg border-2 border-dashed p-8 text-center cursor-pointer
        transition-colors duration-200
        ${isDragging ? 'border-indigo-500 bg-indigo-50' : 'border-gray-300 hover:border-gray-400 bg-gray-50'}
        ${error ? 'border-red-300 bg-red-50' : ''}
      `}
    >
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/heic,image/heif,.heic,.heif"
        onChange={handleFileInput}
        className="hidden"
      />

      <div className="flex flex-col items-center">
        {/* Upload icon */}
        <div
          className={`
            w-12 h-12 rounded-full flex items-center justify-center mb-4
            ${isDragging ? 'bg-indigo-100' : 'bg-gray-100'}
          `}
        >
          <svg
            className={`w-6 h-6 ${isDragging ? 'text-indigo-600' : 'text-gray-400'}`}
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

        {state === 'validating' ? (
          <p className="text-gray-600">{t('imageUploader.validating')}</p>
        ) : (
          <>
            <p className="text-gray-600">
              <span className="text-indigo-600 font-medium">{t('imageUploader.clickToUpload')}</span>
            </p>
            <p className="mt-1 text-sm text-gray-500">
              {t('imageUploader.supportedFormats')}
            </p>
          </>
        )}

        {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
      </div>
    </div>
  );
}
