'use client';

interface ViewerControlsProps {
  backgroundColor: string;
  onBackgroundChange: (color: string) => void;
  onReset?: () => void;
}

const BACKGROUND_OPTIONS = [
  { value: '#ffffff', label: 'White', preview: 'bg-white' },
  { value: '#f3f4f6', label: 'Gray', preview: 'bg-gray-100' },
  { value: '#1f2937', label: 'Dark', preview: 'bg-gray-800' },
  { value: '#000000', label: 'Black', preview: 'bg-black' },
];

/**
 * Controls panel for the 3D viewer
 */
export function ViewerControls({
  backgroundColor,
  onBackgroundChange,
  onReset,
}: ViewerControlsProps) {
  return (
    <div className="flex items-center gap-4 p-4 bg-white rounded-lg shadow-sm">
      {/* Background Color */}
      <div className="flex items-center gap-2">
        <span className="text-sm text-gray-600">Background:</span>
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
      <div className="h-6 w-px bg-gray-200" />

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
          Reset View
        </button>
      )}

      {/* Help text */}
      <div className="ml-auto text-xs text-gray-400">
        Drag to rotate • Scroll to zoom • Shift+drag to pan
      </div>
    </div>
  );
}
