'use client';

import { useState, useCallback, useRef } from 'react';
import { uploadImage, validateImage, type UploadProgress } from '@/lib/storage';
import type { ViewAngle, InputMode, UploadedImage } from '@/types';
import { VIEW_ANGLE_LABELS, CREDIT_COSTS } from '@/types';

interface MultiImageUploaderProps {
  userId: string;
  onImagesChange: (images: UploadedImage[], mode: InputMode) => void;
  onError?: (error: string) => void;
}

type UploadState = 'idle' | 'validating' | 'uploading' | 'complete';

const INPUT_MODE_OPTIONS: Record<InputMode, { label: string; description: string; credit: number }> = {
  single: {
    label: '單張圖片',
    description: '上傳一張照片',
    credit: 1,
  },
  multi: {
    label: '多角度上傳',
    description: '上傳 2-5 張不同角度的照片',
    credit: 1,
  },
  'ai-generated': {
    label: 'AI 生成視角',
    description: 'AI 自動生成其他角度',
    credit: 2,
  },
};

const AVAILABLE_ANGLES: ViewAngle[] = ['front', 'back', 'left', 'right', 'top'];

export function MultiImageUploader({ userId, onImagesChange, onError }: MultiImageUploaderProps) {
  const [mode, setMode] = useState<InputMode>('single');
  const [images, setImages] = useState<Map<ViewAngle, UploadedImage>>(new Map());
  const [selectedAngles, setSelectedAngles] = useState<ViewAngle[]>(['back', 'left', 'right']);
  const [uploadingAngle, setUploadingAngle] = useState<ViewAngle | null>(null);
  const [progress, setProgress] = useState<UploadProgress | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const currentAngleRef = useRef<ViewAngle>('front');

  // Notify parent of changes
  const notifyChange = useCallback((newImages: Map<ViewAngle, UploadedImage>, newMode: InputMode) => {
    const imageArray = Array.from(newImages.values());
    onImagesChange(imageArray, newMode);
  }, [onImagesChange]);

  const handleFile = useCallback(
    async (file: File, angle: ViewAngle) => {
      setError(null);
      setUploadingAngle(angle);

      // Validate image
      const validation = await validateImage(file);
      if (!validation.valid) {
        setError(validation.error || 'Invalid image');
        setUploadingAngle(null);
        onError?.(validation.error || 'Invalid image');
        return;
      }

      // Create preview
      const previewUrl = URL.createObjectURL(file);

      // Upload
      try {
        const result = await uploadImage(file, userId, (p) => {
          setProgress(p);
        });

        const uploadedImage: UploadedImage = {
          url: result.downloadUrl,
          angle,
          file,
          isAiGenerated: false,
        };

        setImages((prev) => {
          const newMap = new Map(prev);
          newMap.set(angle, uploadedImage);
          notifyChange(newMap, mode);
          return newMap;
        });

        setUploadingAngle(null);
        setProgress(null);
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Upload failed';
        setError(errorMessage);
        setUploadingAngle(null);
        onError?.(errorMessage);
      }
    },
    [userId, mode, notifyChange, onError]
  );

  const handleModeChange = useCallback((newMode: InputMode) => {
    setMode(newMode);
    // Keep front image, clear others when switching modes
    const frontImage = images.get('front');
    if (frontImage) {
      const newMap = new Map<ViewAngle, UploadedImage>();
      newMap.set('front', frontImage);
      setImages(newMap);
      notifyChange(newMap, newMode);
    } else {
      setImages(new Map());
      notifyChange(new Map(), newMode);
    }
  }, [images, notifyChange]);

  const handleRemoveImage = useCallback((angle: ViewAngle) => {
    setImages((prev) => {
      const newMap = new Map(prev);
      newMap.delete(angle);
      notifyChange(newMap, mode);
      return newMap;
    });
  }, [mode, notifyChange]);

  const handleAngleToggle = useCallback((angle: ViewAngle) => {
    setSelectedAngles((prev) => {
      if (prev.includes(angle)) {
        return prev.filter((a) => a !== angle);
      }
      if (prev.length < 4) {
        return [...prev, angle];
      }
      return prev;
    });
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent, angle: ViewAngle) => {
      e.preventDefault();
      setIsDragging(false);

      const file = e.dataTransfer.files[0];
      if (file) {
        handleFile(file, angle);
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
        handleFile(file, currentAngleRef.current);
      }
      // Reset input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    },
    [handleFile]
  );

  const openFilePicker = useCallback((angle: ViewAngle) => {
    currentAngleRef.current = angle;
    fileInputRef.current?.click();
  }, []);

  // Get the angles to display based on mode
  const getDisplayAngles = (): ViewAngle[] => {
    if (mode === 'single') return ['front'];
    if (mode === 'ai-generated') return ['front'];
    return AVAILABLE_ANGLES;
  };

  // Render single dropzone
  const renderDropzone = (angle: ViewAngle, size: 'large' | 'small' = 'large') => {
    const image = images.get(angle);
    const isUploading = uploadingAngle === angle;
    const heightClass = size === 'large' ? 'h-64' : 'h-32';

    if (image) {
      return (
        <div className={`relative rounded-lg overflow-hidden border-2 border-green-500 bg-gray-50 ${heightClass}`}>
          <img
            src={URL.createObjectURL(image.file!) || image.url}
            alt={`${VIEW_ANGLE_LABELS[angle]} view`}
            className="w-full h-full object-contain"
          />
          <button
            type="button"
            onClick={() => handleRemoveImage(angle)}
            className="absolute top-2 right-2 p-1 bg-white rounded-full shadow hover:bg-gray-100"
            aria-label="Remove image"
          >
            <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
          <div className="absolute bottom-2 left-2 bg-green-500 text-white text-xs px-2 py-1 rounded">
            {VIEW_ANGLE_LABELS[angle]}
          </div>
        </div>
      );
    }

    if (isUploading) {
      return (
        <div className={`relative rounded-lg overflow-hidden border-2 border-indigo-500 bg-gray-100 ${heightClass}`}>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <div className="w-32 h-2 bg-gray-200 rounded-full overflow-hidden">
              <div
                className="h-full bg-indigo-600 transition-all duration-300"
                style={{ width: `${progress?.progress || 0}%` }}
              />
            </div>
            <p className="mt-2 text-gray-600 text-sm">
              {Math.round(progress?.progress || 0)}%
            </p>
          </div>
        </div>
      );
    }

    return (
      <div
        onDrop={(e) => handleDrop(e, angle)}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onClick={() => openFilePicker(angle)}
        className={`
          rounded-lg border-2 border-dashed p-4 text-center cursor-pointer
          transition-colors duration-200 ${heightClass}
          flex flex-col items-center justify-center
          ${isDragging ? 'border-indigo-500 bg-indigo-50' : 'border-gray-300 hover:border-gray-400 bg-gray-50'}
        `}
      >
        <svg className="w-8 h-8 text-gray-400 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
          />
        </svg>
        <p className="text-sm text-gray-600">{VIEW_ANGLE_LABELS[angle]}</p>
        {size === 'large' && (
          <p className="text-xs text-gray-400 mt-1">點擊或拖放上傳</p>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-4">
      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        onChange={handleFileInput}
        className="hidden"
      />

      {/* Mode selector tabs */}
      <div className="flex gap-2 p-1 bg-gray-100 rounded-lg">
        {(Object.entries(INPUT_MODE_OPTIONS) as [InputMode, typeof INPUT_MODE_OPTIONS[InputMode]][]).map(
          ([key, option]) => (
            <button
              key={key}
              type="button"
              onClick={() => handleModeChange(key)}
              className={`
                flex-1 py-2 px-3 rounded-md text-sm font-medium transition-colors
                ${mode === key
                  ? 'bg-white text-indigo-700 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
                }
              `}
            >
              <span>{option.label}</span>
              <span className="ml-1 text-xs opacity-70">({option.credit} 點)</span>
            </button>
          )
        )}
      </div>

      {/* Mode description */}
      <p className="text-sm text-gray-500">{INPUT_MODE_OPTIONS[mode].description}</p>

      {/* Error display */}
      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm">
          {error}
        </div>
      )}

      {/* Single mode */}
      {mode === 'single' && renderDropzone('front', 'large')}

      {/* Multi-upload mode */}
      {mode === 'multi' && (
        <div className="grid grid-cols-3 gap-3">
          {/* Front image (larger) */}
          <div className="col-span-2 row-span-2">
            {renderDropzone('front', 'large')}
          </div>
          {/* Other angles */}
          {(['back', 'left', 'right', 'top'] as ViewAngle[]).map((angle) => (
            <div key={angle}>
              {renderDropzone(angle, 'small')}
            </div>
          ))}
        </div>
      )}

      {/* AI-generated mode */}
      {mode === 'ai-generated' && (
        <div className="space-y-4">
          {/* Primary image upload */}
          {renderDropzone('front', 'large')}

          {/* Angle selector */}
          {images.has('front') && (
            <div className="p-4 bg-gray-50 rounded-lg">
              <p className="text-sm font-medium text-gray-700 mb-2">
                選擇 AI 生成的角度 (最多 4 個)
              </p>
              <div className="flex flex-wrap gap-2">
                {(['back', 'left', 'right', 'top'] as ViewAngle[]).map((angle) => (
                  <button
                    key={angle}
                    type="button"
                    onClick={() => handleAngleToggle(angle)}
                    className={`
                      px-3 py-1.5 rounded-full text-sm font-medium transition-colors
                      ${selectedAngles.includes(angle)
                        ? 'bg-indigo-600 text-white'
                        : 'bg-white text-gray-700 border border-gray-300 hover:border-indigo-500'
                      }
                    `}
                  >
                    {VIEW_ANGLE_LABELS[angle]}
                  </button>
                ))}
              </div>
              <p className="mt-2 text-xs text-gray-500">
                已選擇 {selectedAngles.length} 個角度，AI 將生成這些視角的圖片
              </p>
            </div>
          )}
        </div>
      )}

      {/* Image count summary */}
      {images.size > 0 && (
        <div className="flex items-center justify-between text-sm text-gray-600 pt-2 border-t">
          <span>
            已上傳 {images.size} 張圖片
            {mode === 'ai-generated' && selectedAngles.length > 0 && (
              <span className="text-indigo-600"> + AI 生成 {selectedAngles.length} 張</span>
            )}
          </span>
          <span className="font-medium">
            消耗 {CREDIT_COSTS[mode]} 點
          </span>
        </div>
      )}
    </div>
  );
}

// Export selected angles for parent component
export function useSelectedAngles() {
  const [selectedAngles, setSelectedAngles] = useState<ViewAngle[]>(['back', 'left', 'right']);
  return { selectedAngles, setSelectedAngles };
}
