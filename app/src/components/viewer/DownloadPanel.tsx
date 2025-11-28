'use client';

import { useState, useCallback } from 'react';
import type { OutputFormat, DownloadFile } from '@/types';

interface DownloadPanelProps {
  modelUrl: string;
  downloadFiles?: DownloadFile[];
  jobId: string;
  currentFormat: OutputFormat;
}

// STL conversion status
type ConversionStatus = 'idle' | 'loading' | 'converting' | 'done' | 'error';

const FORMAT_INFO: Record<string, { label: string; description: string }> = {
  glb: { label: 'GLB', description: '3D模型 - 含材質貼圖' },
  obj: { label: 'OBJ', description: '3D模型 - 通用格式' },
  fbx: { label: 'FBX', description: '3D模型 - 動畫支援' },
  stl: { label: 'STL', description: '3D模型 - 3D列印推薦' },
  usdz: { label: 'USDZ', description: '3D模型 - iOS AR' },
  // Texture files
  png: { label: 'PNG', description: '貼圖檔案' },
  jpg: { label: 'JPG', description: '貼圖檔案' },
  jpeg: { label: 'JPEG', description: '貼圖檔案' },
};

// Texture name mapping for display
const TEXTURE_LABELS: Record<string, string> = {
  albedo: '色彩貼圖',
  diffuse: '色彩貼圖',
  basecolor: '色彩貼圖',
  normal: '法線貼圖',
  metallic: '金屬度貼圖',
  roughness: '粗糙度貼圖',
  ao: '環境遮蔽貼圖',
  occlusion: '環境遮蔽貼圖',
};

function getFileInfo(fileName: string): { label: string; isTexture: boolean; textureType?: string } {
  const ext = fileName.split('.').pop()?.toLowerCase() || '';
  const baseName = fileName.split('.').slice(0, -1).join('.').toLowerCase();

  // Check if it's a texture file
  const isTexture = ['png', 'jpg', 'jpeg'].includes(ext) && !fileName.includes('preview');

  // Try to identify texture type from filename
  let textureType: string | undefined;
  for (const [key, label] of Object.entries(TEXTURE_LABELS)) {
    if (baseName.includes(key)) {
      textureType = label;
      break;
    }
  }

  return {
    label: FORMAT_INFO[ext]?.label || ext.toUpperCase(),
    isTexture,
    textureType,
  };
}

/**
 * Convert GLB to STL using Three.js
 * Loads GLB, extracts geometry, exports as binary STL
 */
async function convertGlbToStl(glbUrl: string): Promise<Blob> {
  // Dynamic imports to avoid SSR issues
  const THREE = await import('three');
  const { GLTFLoader } = await import('three/examples/jsm/loaders/GLTFLoader.js');
  const { STLExporter } = await import('three/examples/jsm/exporters/STLExporter.js');

  return new Promise((resolve, reject) => {
    const loader = new GLTFLoader();

    loader.load(
      glbUrl,
      (gltf) => {
        try {
          const exporter = new STLExporter();
          // Export as binary STL (smaller file size)
          const result = exporter.parse(gltf.scene, { binary: true });
          const blob = new Blob([result], { type: 'model/stl' });
          resolve(blob);
        } catch (error) {
          reject(error);
        }
      },
      undefined,
      (error) => {
        reject(error);
      }
    );
  });
}

/**
 * Download panel for completed models
 * Shows all available files from Rodin API (models + textures)
 * Supports GLB to STL conversion for 3D printing
 */
export function DownloadPanel({
  modelUrl,
  downloadFiles,
  jobId,
  currentFormat,
}: DownloadPanelProps) {
  const [downloadingFile, setDownloadingFile] = useState<string | null>(null);
  const [showTextures, setShowTextures] = useState(false);
  const [stlConversionStatus, setStlConversionStatus] = useState<ConversionStatus>('idle');

  const handleDownload = async (url: string, fileName: string) => {
    setDownloadingFile(fileName);

    try {
      const response = await fetch(url);
      const blob = await response.blob();

      const downloadUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(downloadUrl);
    } catch (error) {
      console.error('Download failed:', error);
    } finally {
      setDownloadingFile(null);
    }
  };

  // Find GLB URL for STL conversion
  const glbUrl = modelUrl.includes('.glb')
    ? modelUrl
    : downloadFiles?.find((f) => f.name.endsWith('.glb'))?.url;

  // Handle STL conversion and download
  const handleStlDownload = useCallback(async () => {
    if (!glbUrl) return;

    setStlConversionStatus('loading');

    try {
      setStlConversionStatus('converting');
      const stlBlob = await convertGlbToStl(glbUrl);

      // Trigger download
      const downloadUrl = window.URL.createObjectURL(stlBlob);
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.download = `model_${jobId}.stl`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(downloadUrl);

      setStlConversionStatus('done');
      // Reset after a short delay
      setTimeout(() => setStlConversionStatus('idle'), 2000);
    } catch (error) {
      console.error('STL conversion failed:', error);
      setStlConversionStatus('error');
      setTimeout(() => setStlConversionStatus('idle'), 3000);
    }
  }, [glbUrl, jobId]);

  // Separate model files from texture files
  const modelFiles =
    downloadFiles?.filter((f) => {
      const ext = f.name.split('.').pop()?.toLowerCase();
      return ['glb', 'gltf', 'obj', 'fbx', 'stl', 'usdz'].includes(ext || '');
    }) || [];

  const textureFiles =
    downloadFiles?.filter((f) => {
      const ext = f.name.split('.').pop()?.toLowerCase();
      return ['png', 'jpg', 'jpeg'].includes(ext || '');
    }) || [];

  const formatInfo = FORMAT_INFO[currentFormat] || { label: currentFormat.toUpperCase(), description: '' };

  // Check if current format is GLB (our new default)
  const isGlbFormat = currentFormat === 'glb' || modelUrl.includes('.glb');

  // STL conversion button text based on status
  const getStlButtonContent = () => {
    switch (stlConversionStatus) {
      case 'loading':
        return (
          <>
            <LoadingIcon />
            載入模型中...
          </>
        );
      case 'converting':
        return (
          <>
            <LoadingIcon />
            轉換中...
          </>
        );
      case 'done':
        return (
          <>
            <CheckIcon />
            下載完成
          </>
        );
      case 'error':
        return (
          <>
            <ErrorIcon />
            轉換失敗
          </>
        );
      default:
        return (
          <>
            <PrinterIcon />
            下載 STL (3D列印)
          </>
        );
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-sm p-4">
      <h3 className="font-medium text-gray-900 mb-3">下載模型</h3>

      {/* Primary download - GLB with materials */}
      <div className="mb-3 p-3 bg-indigo-50 rounded-md border border-indigo-100">
        <div className="flex items-center justify-between mb-2">
          <div>
            <span className="font-medium text-indigo-900">{formatInfo.label}</span>
            <p className="text-sm text-indigo-600">{formatInfo.description}</p>
          </div>
          <span className="text-xs text-indigo-400 uppercase">.{currentFormat}</span>
        </div>
        <button
          type="button"
          onClick={() => handleDownload(modelUrl, `model_${jobId}.${currentFormat}`)}
          disabled={downloadingFile !== null}
          className="w-full flex items-center justify-center gap-2 py-2 px-4 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm"
        >
          {downloadingFile === `model_${jobId}.${currentFormat}` ? (
            <LoadingIcon />
          ) : (
            <DownloadIcon />
          )}
          下載 {formatInfo.label}
        </button>
      </div>

      {/* STL conversion download - for 3D printing */}
      {isGlbFormat && glbUrl && (
        <div className="mb-3 p-3 bg-gray-50 rounded-md border border-gray-200">
          <div className="flex items-center justify-between mb-2">
            <div>
              <span className="font-medium text-gray-900">STL</span>
              <p className="text-sm text-gray-500">3D列印格式（前端轉換）</p>
            </div>
            <span className="text-xs text-gray-400 uppercase">.stl</span>
          </div>
          <button
            type="button"
            onClick={handleStlDownload}
            disabled={stlConversionStatus !== 'idle' && stlConversionStatus !== 'done' && stlConversionStatus !== 'error'}
            className={`w-full flex items-center justify-center gap-2 py-2 px-4 rounded-md transition-colors text-sm ${
              stlConversionStatus === 'done'
                ? 'bg-green-600 text-white'
                : stlConversionStatus === 'error'
                ? 'bg-red-600 text-white'
                : 'bg-gray-700 text-white hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed'
            }`}
          >
            {getStlButtonContent()}
          </button>
        </div>
      )}

      {/* Other model formats from Rodin (if any) */}
      {modelFiles.length > 1 && (
        <div className="mb-3">
          <p className="text-xs text-gray-500 mb-2">其他格式</p>
          <div className="space-y-1">
            {modelFiles
              .filter((f) => !f.name.toLowerCase().endsWith(`.${currentFormat}`) && !f.name.endsWith('.stl'))
              .map((file) => {
                const info = getFileInfo(file.name);
                return (
                  <button
                    key={file.name}
                    type="button"
                    onClick={() => handleDownload(file.url, file.name)}
                    disabled={downloadingFile !== null}
                    className="w-full flex items-center justify-between py-2 px-3 text-sm text-gray-700 hover:bg-gray-50 rounded-md disabled:opacity-50 transition-colors"
                  >
                    <span className="flex items-center gap-2">
                      {downloadingFile === file.name ? <LoadingIcon /> : <DownloadIcon />}
                      {info.label}
                    </span>
                    <span className="text-xs text-gray-400">{file.name}</span>
                  </button>
                );
              })}
          </div>
        </div>
      )}

      {/* Texture files section */}
      {textureFiles.length > 0 && (
        <div className="border-t border-gray-100 pt-3">
          <button
            type="button"
            onClick={() => setShowTextures(!showTextures)}
            className="w-full flex items-center justify-between py-1 text-sm text-gray-600 hover:text-gray-900"
          >
            <span className="flex items-center gap-2">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                />
              </svg>
              材質貼圖 ({textureFiles.length})
            </span>
            <svg
              className={`w-4 h-4 transition-transform ${showTextures ? 'rotate-180' : ''}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          {showTextures && (
            <div className="mt-2 space-y-1">
              {textureFiles.map((file) => {
                const info = getFileInfo(file.name);
                return (
                  <button
                    key={file.name}
                    type="button"
                    onClick={() => handleDownload(file.url, file.name)}
                    disabled={downloadingFile !== null}
                    className="w-full flex items-center justify-between py-2 px-3 text-sm text-gray-600 hover:bg-gray-50 rounded-md disabled:opacity-50 transition-colors"
                  >
                    <span className="flex items-center gap-2">
                      {downloadingFile === file.name ? <LoadingIcon /> : <DownloadIcon />}
                      {info.textureType || file.name}
                    </span>
                    <span className="text-xs text-gray-400">{info.label}</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function DownloadIcon() {
  return (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
      />
    </svg>
  );
}

function LoadingIcon() {
  return (
    <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
      />
    </svg>
  );
}

function PrinterIcon() {
  return (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z"
      />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
    </svg>
  );
}

function ErrorIcon() {
  return (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
    </svg>
  );
}
