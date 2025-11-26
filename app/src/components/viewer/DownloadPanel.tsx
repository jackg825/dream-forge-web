'use client';

import { useState } from 'react';
import type { OutputFormat } from '@/types';

interface DownloadPanelProps {
  modelUrl: string;
  jobId: string;
  currentFormat: OutputFormat;
}

const FORMAT_INFO: Record<OutputFormat, { label: string; description: string }> = {
  glb: { label: 'GLB', description: 'Binary glTF - Best for web & general use' },
  obj: { label: 'OBJ', description: 'Wavefront OBJ - Wide compatibility' },
  fbx: { label: 'FBX', description: 'Autodesk FBX - Animation support' },
  stl: { label: 'STL', description: 'Stereolithography - 3D printing' },
};

/**
 * Download panel for completed models
 */
export function DownloadPanel({ modelUrl, jobId, currentFormat }: DownloadPanelProps) {
  const [downloading, setDownloading] = useState(false);

  const handleDownload = async () => {
    setDownloading(true);

    try {
      // Fetch the model
      const response = await fetch(modelUrl);
      const blob = await response.blob();

      // Create download link
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `model_${jobId}.${currentFormat}`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Download failed:', error);
    } finally {
      setDownloading(false);
    }
  };

  const formatInfo = FORMAT_INFO[currentFormat];

  return (
    <div className="bg-white rounded-lg shadow-sm p-4">
      <h3 className="font-medium text-gray-900 mb-3">Download Model</h3>

      {/* Current format info */}
      <div className="mb-4 p-3 bg-gray-50 rounded-md">
        <div className="flex items-center justify-between">
          <div>
            <span className="font-medium text-gray-900">{formatInfo.label}</span>
            <p className="text-sm text-gray-500">{formatInfo.description}</p>
          </div>
          <span className="text-xs text-gray-400 uppercase">.{currentFormat}</span>
        </div>
      </div>

      {/* Download button */}
      <button
        type="button"
        onClick={handleDownload}
        disabled={downloading}
        className="w-full flex items-center justify-center gap-2 py-2.5 px-4 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        {downloading ? (
          <>
            <svg
              className="animate-spin w-4 h-4"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              />
            </svg>
            Downloading...
          </>
        ) : (
          <>
            <svg
              className="w-4 h-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
              />
            </svg>
            Download {formatInfo.label}
          </>
        )}
      </button>

      {/* Note about other formats */}
      <p className="mt-3 text-xs text-gray-400 text-center">
        Need a different format? Generate a new model with your preferred format.
      </p>
    </div>
  );
}
