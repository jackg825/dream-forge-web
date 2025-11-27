'use client';

import { useState, useCallback, useRef } from 'react';
import { isSupported3DFormat } from '@/lib/modelAnalysis';

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
        setError('不支援的檔案格式。請上傳 STL、OBJ、GLB 或 GLTF 檔案。');
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
        ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
      `}
    >
      <input
        ref={fileInputRef}
        type="file"
        accept={ACCEPTED_EXTENSIONS}
        onChange={handleFileInput}
        className="hidden"
        disabled={disabled}
      />

      <div className="flex flex-col items-center">
        {/* 3D Model Icon */}
        <div
          className={`
            w-16 h-16 rounded-full flex items-center justify-center mb-4
            ${isDragging ? 'bg-indigo-100' : 'bg-gray-100'}
          `}
        >
          <svg
            className={`w-8 h-8 ${isDragging ? 'text-indigo-600' : 'text-gray-400'}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            {/* 3D Cube Icon */}
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z"
            />
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M3.27 6.96L12 12.01l8.73-5.05"
            />
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M12 22.08V12"
            />
          </svg>
        </div>

        <p className="text-gray-600">
          <span className="text-indigo-600 font-medium">點擊上傳</span> 或拖放檔案
        </p>
        <p className="mt-1 text-sm text-gray-500">
          支援 STL、OBJ、GLB、GLTF（最大 100MB）
        </p>

        {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
      </div>
    </div>
  );
}
