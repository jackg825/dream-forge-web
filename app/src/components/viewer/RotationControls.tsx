'use client';

import type { ModelRotation } from '@/lib/modelOrientation';

interface RotationControlsProps {
  rotation: ModelRotation;
  onRotationChange: (rotation: ModelRotation) => void;
  onReset: () => void;
  disabled?: boolean;
}

const AXIS_CONFIG = [
  { axis: 'x' as const, label: 'X', color: 'bg-red-500' },
  { axis: 'y' as const, label: 'Y', color: 'bg-green-500' },
  { axis: 'z' as const, label: 'Z', color: 'bg-blue-500' },
];

export function RotationControls({
  rotation,
  onRotationChange,
  onReset,
  disabled,
}: RotationControlsProps) {
  const handleAxisChange = (axis: 'x' | 'y' | 'z', value: number) => {
    onRotationChange({ ...rotation, [axis]: value });
  };

  const handleQuickRotate = (axis: 'x' | 'y' | 'z', delta: number) => {
    const newValue = rotation[axis] + delta;
    // Normalize to -180 to 180
    const normalized = ((newValue + 180) % 360) - 180;
    onRotationChange({ ...rotation, [axis]: normalized });
  };

  const hasRotation = rotation.x !== 0 || rotation.y !== 0 || rotation.z !== 0;

  return (
    <div className="bg-white rounded-lg shadow-sm p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-medium text-gray-900">模型旋轉</h3>
        {hasRotation && (
          <button
            type="button"
            onClick={onReset}
            disabled={disabled}
            className="text-xs text-indigo-600 hover:text-indigo-700 disabled:opacity-50"
          >
            重設
          </button>
        )}
      </div>

      <div className="space-y-4">
        {AXIS_CONFIG.map(({ axis, label, color }) => (
          <div key={axis}>
            <div className="flex items-center justify-between mb-1.5">
              <div className="flex items-center gap-1.5">
                <span className={`inline-block w-2 h-2 rounded-full ${color}`} />
                <label className="text-sm text-gray-600">{label} 軸</label>
              </div>
              <div className="flex items-center gap-1">
                {/* Quick rotation buttons */}
                <button
                  type="button"
                  onClick={() => handleQuickRotate(axis, -90)}
                  disabled={disabled}
                  className="px-1.5 py-0.5 text-xs bg-gray-100 hover:bg-gray-200 rounded disabled:opacity-50"
                  title="-90°"
                >
                  -90°
                </button>
                <button
                  type="button"
                  onClick={() => handleQuickRotate(axis, 90)}
                  disabled={disabled}
                  className="px-1.5 py-0.5 text-xs bg-gray-100 hover:bg-gray-200 rounded disabled:opacity-50"
                  title="+90°"
                >
                  +90°
                </button>
                <span className="text-sm text-gray-500 w-12 text-right">
                  {rotation[axis]}°
                </span>
              </div>
            </div>
            <input
              type="range"
              min="-180"
              max="180"
              step="1"
              value={rotation[axis]}
              onChange={(e) => handleAxisChange(axis, Number(e.target.value))}
              disabled={disabled}
              className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-indigo-600 disabled:opacity-50 disabled:cursor-not-allowed"
            />
          </div>
        ))}
      </div>

      <p className="text-xs text-gray-400 mt-3">
        調整模型角度以正確顯示在預覽平面上
      </p>
    </div>
  );
}
