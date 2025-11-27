'use client';

interface PreviewControlsProps {
  backgroundColor: string;
  onBackgroundChange: (color: string) => void;
  onReset: () => void;
  hasModel: boolean;
}

const BACKGROUND_OPTIONS = [
  { value: '#ffffff', label: '白色', preview: 'bg-white' },
  { value: '#f3f4f6', label: '灰色', preview: 'bg-gray-100' },
  { value: '#1f2937', label: '深色', preview: 'bg-gray-800' },
  { value: '#000000', label: '黑色', preview: 'bg-black' },
];

export function PreviewControls({
  backgroundColor,
  onBackgroundChange,
  onReset,
  hasModel,
}: PreviewControlsProps) {
  return (
    <div className="flex items-center gap-4 p-4 bg-white rounded-lg shadow-sm">
      {/* Background Color */}
      <div className="flex items-center gap-2">
        <span className="text-sm text-gray-600">背景：</span>
        <div className="flex gap-1">
          {BACKGROUND_OPTIONS.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => onBackgroundChange(option.value)}
              className={`
                w-6 h-6 rounded-full border-2 transition-all
                ${option.preview}
                ${
                  backgroundColor === option.value
                    ? 'border-indigo-600 ring-2 ring-indigo-200'
                    : 'border-gray-300 hover:border-gray-400'
                }
              `}
              title={option.label}
              aria-label={`設定背景為${option.label}`}
            />
          ))}
        </div>
      </div>

      {/* Divider */}
      <div className="h-6 w-px bg-gray-200" />

      {/* Clear Model */}
      {hasModel && (
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
              d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
            />
          </svg>
          清除模型
        </button>
      )}

      {/* Help text */}
      <div className="ml-auto text-xs text-gray-400">
        拖曳旋轉 • 滾輪縮放 • Shift+拖曳平移
      </div>
    </div>
  );
}
