'use client';

export type ClippingAxis = 'x' | 'y' | 'z';

interface ClippingPlaneControlsProps {
  enabled: boolean;
  onEnabledChange: (enabled: boolean) => void;
  axis: ClippingAxis;
  onAxisChange: (axis: ClippingAxis) => void;
  position: number; // 0-100 percentage
  onPositionChange: (position: number) => void;
  inverted: boolean;
  onInvertedChange: (inverted: boolean) => void;
  disabled?: boolean;
}

const AXIS_OPTIONS: { value: ClippingAxis; label: string; color: string }[] = [
  { value: 'x', label: 'X', color: 'bg-red-500' },
  { value: 'y', label: 'Y', color: 'bg-green-500' },
  { value: 'z', label: 'Z', color: 'bg-blue-500' },
];

export function ClippingPlaneControls({
  enabled,
  onEnabledChange,
  axis,
  onAxisChange,
  position,
  onPositionChange,
  inverted,
  onInvertedChange,
  disabled,
}: ClippingPlaneControlsProps) {
  return (
    <div className="bg-white rounded-lg shadow-sm p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-medium text-gray-900">切面預覽</h3>
        <label className="relative inline-flex items-center cursor-pointer">
          <input
            type="checkbox"
            checked={enabled}
            onChange={(e) => onEnabledChange(e.target.checked)}
            disabled={disabled}
            className="sr-only peer"
          />
          <div className="w-9 h-5 bg-gray-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-indigo-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-indigo-600 peer-disabled:opacity-50"></div>
        </label>
      </div>

      {enabled && (
        <div className="space-y-4">
          {/* Axis Selection */}
          <div>
            <label className="text-sm text-gray-600 mb-2 block">切割軸向</label>
            <div className="flex gap-2">
              {AXIS_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => onAxisChange(option.value)}
                  disabled={disabled}
                  className={`
                    flex-1 py-2 px-3 rounded-md text-sm font-medium transition-all
                    ${
                      axis === option.value
                        ? 'bg-gray-900 text-white'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }
                    disabled:opacity-50 disabled:cursor-not-allowed
                  `}
                >
                  <span
                    className={`inline-block w-2 h-2 rounded-full mr-1.5 ${option.color}`}
                  />
                  {option.label} 軸
                </button>
              ))}
            </div>
          </div>

          {/* Position Slider */}
          <div>
            <div className="flex justify-between items-center mb-2">
              <label className="text-sm text-gray-600">切割位置</label>
              <span className="text-sm text-gray-500">{position}%</span>
            </div>
            <input
              type="range"
              min="0"
              max="100"
              value={position}
              onChange={(e) => onPositionChange(Number(e.target.value))}
              disabled={disabled}
              className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-indigo-600 disabled:opacity-50 disabled:cursor-not-allowed"
            />
            <div className="flex justify-between text-xs text-gray-400 mt-1">
              <span>0%</span>
              <span>50%</span>
              <span>100%</span>
            </div>
          </div>

          {/* Invert Toggle */}
          <div className="flex items-center justify-between pt-2 border-t border-gray-100">
            <div>
              <label className="text-sm text-gray-600">反向切割</label>
              <p className="text-xs text-gray-400">
                {inverted ? '顯示切割後方' : '顯示切割前方'}
              </p>
            </div>
            <button
              type="button"
              onClick={() => onInvertedChange(!inverted)}
              disabled={disabled}
              className={`
                p-2 rounded-md transition-all
                ${inverted
                  ? 'bg-indigo-100 text-indigo-600'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }
                disabled:opacity-50 disabled:cursor-not-allowed
              `}
              title={inverted ? '切換為顯示前方' : '切換為顯示後方'}
            >
              <svg
                className={`w-5 h-5 transition-transform ${inverted ? 'rotate-180' : ''}`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4"
                />
              </svg>
            </button>
          </div>
        </div>
      )}

      {!enabled && (
        <p className="text-sm text-gray-500">
          啟用切面功能可查看模型內部結構
        </p>
      )}
    </div>
  );
}
