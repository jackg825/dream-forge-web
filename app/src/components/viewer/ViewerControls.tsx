'use client';

import type { ViewMode } from '@/types';

interface ViewerControlsProps {
  backgroundColor: string;
  onBackgroundChange: (color: string) => void;
  viewMode: ViewMode;
  onViewModeChange: (mode: ViewMode) => void;
  hasTextures?: boolean; // Whether GLB/textures are available
  onReset?: () => void;
}

const BACKGROUND_OPTIONS = [
  { value: '#ffffff', label: 'White', preview: 'bg-white' },
  { value: '#f3f4f6', label: 'Gray', preview: 'bg-gray-100' },
  { value: '#1f2937', label: 'Dark', preview: 'bg-gray-800' },
  { value: '#000000', label: 'Black', preview: 'bg-black' },
];

const VIEW_MODE_OPTIONS: { value: ViewMode; label: string; description: string }[] = [
  { value: 'clay', label: '實色', description: '單色預覽 (FDM)' },
  { value: 'textured', label: '材質', description: 'PBR 材質 (彩色列印)' },
  { value: 'wireframe', label: '線框', description: '網格檢視' },
];

/**
 * Controls panel for the 3D viewer
 * Includes view mode selector for preview accuracy
 */
export function ViewerControls({
  backgroundColor,
  onBackgroundChange,
  viewMode,
  onViewModeChange,
  hasTextures = false,
  onReset,
}: ViewerControlsProps) {
  return (
    <div className="flex flex-wrap items-center gap-4 p-4 bg-white rounded-lg shadow-sm">
      {/* View Mode Selector */}
      <div className="flex items-center gap-2">
        <span className="text-sm text-gray-600">預覽模式:</span>
        <div className="flex rounded-lg border border-gray-200 overflow-hidden">
          {VIEW_MODE_OPTIONS.map((option) => {
            const isDisabled = option.value === 'textured' && !hasTextures;
            const isActive = viewMode === option.value;

            return (
              <button
                key={option.value}
                type="button"
                onClick={() => !isDisabled && onViewModeChange(option.value)}
                disabled={isDisabled}
                className={`
                  px-3 py-1.5 text-sm font-medium transition-colors
                  ${isActive
                    ? 'bg-indigo-600 text-white'
                    : isDisabled
                    ? 'bg-gray-50 text-gray-300 cursor-not-allowed'
                    : 'bg-white text-gray-700 hover:bg-gray-50'
                  }
                  ${option.value !== 'clay' ? 'border-l border-gray-200' : ''}
                `}
                title={option.description}
              >
                {option.label}
              </button>
            );
          })}
        </div>
        {!hasTextures && viewMode !== 'textured' && (
          <span className="text-xs text-gray-400">(無材質資料)</span>
        )}
      </div>

      {/* Divider */}
      <div className="h-6 w-px bg-gray-200" />

      {/* Background Color */}
      <div className="flex items-center gap-2">
        <span className="text-sm text-gray-600">背景:</span>
        <div className="flex gap-1">
          {BACKGROUND_OPTIONS.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => onBackgroundChange(option.value)}
              className={`
                w-6 h-6 rounded-full border-2 transition-all
                ${option.preview}
                ${backgroundColor === option.value
                  ? 'border-indigo-600 ring-2 ring-indigo-200'
                  : 'border-gray-300 hover:border-gray-400'
                }
              `}
              title={option.label}
              aria-label={`Set background to ${option.label}`}
            />
          ))}
        </div>
      </div>

      {/* Divider */}
      {onReset && <div className="h-6 w-px bg-gray-200" />}

      {/* Reset Camera */}
      {onReset && (
        <button
          type="button"
          onClick={onReset}
          className="flex items-center gap-1 px-3 py-1.5 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded transition-colors"
        >
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
              d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
            />
          </svg>
          重設視角
        </button>
      )}

      {/* Help text */}
      <div className="ml-auto text-xs text-gray-400 hidden sm:block">
        拖曳旋轉 • 滾輪縮放 • Shift+拖曳平移
      </div>
    </div>
  );
}
