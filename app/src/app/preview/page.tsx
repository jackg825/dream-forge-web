'use client';

import { useState, useCallback } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { FileDropZone } from '@/components/preview/FileDropZone';
import { ModelInfoPanel } from '@/components/preview/ModelInfoPanel';
import { ClippingPlaneControls, type ClippingAxis } from '@/components/preview/ClippingPlaneControls';
import { PreviewControls } from '@/components/preview/PreviewControls';
import { useModelLoader } from '@/hooks/useModelLoader';

// Dynamic import for PreviewViewer to avoid SSR issues with Three.js
const PreviewViewer = dynamic(
  () => import('@/components/preview/PreviewViewer').then((mod) => mod.PreviewViewer),
  {
    ssr: false,
    loading: () => (
      <div className="w-full h-[500px] bg-gray-100 rounded-lg flex items-center justify-center">
        <div className="flex flex-col items-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
          <p className="mt-2 text-sm text-gray-500">載入檢視器...</p>
        </div>
      </div>
    ),
  }
);

export default function PreviewPage() {
  const { state, model, error, loadFile, reset } = useModelLoader();

  // Viewer state
  const [backgroundColor, setBackgroundColor] = useState('#f3f4f6');

  // Clipping plane state
  const [clippingEnabled, setClippingEnabled] = useState(false);
  const [clippingAxis, setClippingAxis] = useState<ClippingAxis>('y');
  const [clippingPosition, setClippingPosition] = useState(50);
  const [clippingInverted, setClippingInverted] = useState(false);

  const handleFileSelect = useCallback(
    (file: File) => {
      // Reset clipping when loading new model
      setClippingEnabled(false);
      setClippingPosition(50);
      setClippingInverted(false);
      loadFile(file);
    },
    [loadFile]
  );

  const handleReset = useCallback(() => {
    reset();
    setClippingEnabled(false);
    setClippingPosition(50);
    setClippingInverted(false);
  }, [reset]);

  const hasModel = state === 'ready' && model;
  const isLoading = state === 'loading';

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link href="/" className="text-gray-500 hover:text-gray-700">
                <svg
                  className="w-6 h-6"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M10 19l-7-7m0 0l7-7m-7 7h18"
                  />
                </svg>
              </Link>
              <div>
                <h1 className="text-xl font-semibold text-gray-900">
                  3D 模型預覽工具
                </h1>
                <p className="text-sm text-gray-500">
                  上傳 STL、OBJ、GLB、GLTF 檔案進行預覽
                </p>
              </div>
            </div>

            {/* Badge */}
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
              免費工具
            </span>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Viewer Area */}
          <div className="lg:col-span-3 space-y-4">
            {/* File Drop Zone (shown when no model) */}
            {!hasModel && !isLoading && (
              <FileDropZone onFileSelect={handleFileSelect} />
            )}

            {/* Loading State */}
            {isLoading && (
              <div className="bg-white rounded-lg shadow-sm p-8">
                <div className="flex flex-col items-center justify-center h-64">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
                  <p className="mt-4 text-gray-600">正在載入模型...</p>
                </div>
              </div>
            )}

            {/* Error State */}
            {state === 'error' && error && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <div className="flex items-start gap-3">
                  <svg
                    className="w-5 h-5 text-red-500 mt-0.5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                  <div>
                    <h3 className="text-sm font-medium text-red-800">
                      載入失敗
                    </h3>
                    <p className="mt-1 text-sm text-red-700">{error}</p>
                    <button
                      onClick={handleReset}
                      className="mt-2 text-sm text-red-600 hover:text-red-800 underline"
                    >
                      重新選擇檔案
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* 3D Viewer */}
            {hasModel && (
              <div className="bg-white rounded-lg shadow-sm overflow-hidden">
                <div className="h-[500px]">
                  <PreviewViewer
                    geometry={model.geometry}
                    group={model.group}
                    backgroundColor={backgroundColor}
                    clippingEnabled={clippingEnabled}
                    clippingAxis={clippingAxis}
                    clippingPosition={clippingPosition}
                    clippingInverted={clippingInverted}
                    boundingBox={model.info?.boundingBox}
                    autoOrient={true}
                  />
                </div>
              </div>
            )}

            {/* Viewer Controls */}
            {(hasModel || isLoading) && (
              <PreviewControls
                backgroundColor={backgroundColor}
                onBackgroundChange={setBackgroundColor}
                onReset={handleReset}
                hasModel={!!hasModel}
              />
            )}

            {/* Upload another file hint */}
            {hasModel && (
              <div className="text-center">
                <button
                  onClick={() => document.getElementById('hidden-file-input')?.click()}
                  className="text-sm text-indigo-600 hover:text-indigo-700"
                >
                  上傳其他檔案
                </button>
                <input
                  id="hidden-file-input"
                  type="file"
                  accept=".stl,.obj,.glb,.gltf"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleFileSelect(file);
                    e.target.value = '';
                  }}
                  className="hidden"
                />
              </div>
            )}
          </div>

          {/* Sidebar */}
          <div className="space-y-4">
            {/* Model Info */}
            <ModelInfoPanel info={model?.info ?? null} loading={isLoading} />

            {/* Clipping Plane Controls */}
            <ClippingPlaneControls
              enabled={clippingEnabled}
              onEnabledChange={setClippingEnabled}
              axis={clippingAxis}
              onAxisChange={setClippingAxis}
              position={clippingPosition}
              onPositionChange={setClippingPosition}
              inverted={clippingInverted}
              onInvertedChange={setClippingInverted}
              disabled={!hasModel}
            />

            {/* Tips */}
            <div className="bg-blue-50 rounded-lg p-4">
              <h3 className="font-medium text-blue-900 mb-2">使用提示</h3>
              <ul className="text-sm text-blue-700 space-y-1">
                <li>• 滑鼠左鍵拖曳：旋轉視角</li>
                <li>• 滾輪：縮放</li>
                <li>• Shift + 左鍵拖曳：平移</li>
                <li>• 切面功能可查看內部結構</li>
              </ul>
            </div>

            {/* CTA to main app */}
            <div className="bg-gradient-to-r from-indigo-500 to-purple-600 rounded-lg p-4 text-white">
              <h3 className="font-medium mb-2">需要生成 3D 模型？</h3>
              <p className="text-sm text-indigo-100 mb-3">
                使用 AI 從照片自動生成 3D 列印模型
              </p>
              <Link
                href="/"
                className="inline-block px-4 py-2 bg-white text-indigo-600 rounded-md text-sm font-medium hover:bg-indigo-50 transition-colors"
              >
                開始生成
              </Link>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
