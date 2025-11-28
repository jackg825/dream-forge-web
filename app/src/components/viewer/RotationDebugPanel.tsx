'use client';

import { useState, useEffect } from 'react';

interface RotationDebugPanelProps {
  onRotationChange: (rotation: { x: number; y: number; z: number }) => void;
}

export function RotationDebugPanel({ onRotationChange }: RotationDebugPanelProps) {
  const [rotX, setRotX] = useState(0);
  const [rotY, setRotY] = useState(0);
  const [rotZ, setRotZ] = useState(0);

  useEffect(() => {
    onRotationChange({ x: rotX, y: rotY, z: rotZ });
  }, [rotX, rotY, rotZ, onRotationChange]);

  return (
    <div className="bg-yellow-500/90 text-black rounded-lg p-4 text-sm font-mono">
      <h3 className="font-bold mb-3 text-center">DEBUG: 模型旋轉調整</h3>

      {/* X Axis */}
      <div className="mb-3">
        <div className="flex justify-between mb-1">
          <span className="text-red-700 font-bold">X 軸</span>
          <span>{rotX}°</span>
        </div>
        <input
          type="range"
          min="-180"
          max="180"
          step="15"
          value={rotX}
          onChange={(e) => setRotX(Number(e.target.value))}
          className="w-full accent-red-600"
        />
        <div className="flex justify-between text-xs opacity-60">
          <span>-180°</span>
          <span>0°</span>
          <span>180°</span>
        </div>
      </div>

      {/* Y Axis */}
      <div className="mb-3">
        <div className="flex justify-between mb-1">
          <span className="text-green-700 font-bold">Y 軸</span>
          <span>{rotY}°</span>
        </div>
        <input
          type="range"
          min="-180"
          max="180"
          step="15"
          value={rotY}
          onChange={(e) => setRotY(Number(e.target.value))}
          className="w-full accent-green-600"
        />
        <div className="flex justify-between text-xs opacity-60">
          <span>-180°</span>
          <span>0°</span>
          <span>180°</span>
        </div>
      </div>

      {/* Z Axis */}
      <div className="mb-3">
        <div className="flex justify-between mb-1">
          <span className="text-blue-700 font-bold">Z 軸</span>
          <span>{rotZ}°</span>
        </div>
        <input
          type="range"
          min="-180"
          max="180"
          step="15"
          value={rotZ}
          onChange={(e) => setRotZ(Number(e.target.value))}
          className="w-full accent-blue-600"
        />
        <div className="flex justify-between text-xs opacity-60">
          <span>-180°</span>
          <span>0°</span>
          <span>180°</span>
        </div>
      </div>

      {/* Current values display */}
      <div className="bg-black/20 rounded p-2 text-center">
        <code>X: {rotX}° Y: {rotY}° Z: {rotZ}°</code>
      </div>

      {/* Quick presets */}
      <div className="mt-3 flex gap-2 flex-wrap">
        <button
          onClick={() => { setRotX(0); setRotY(0); setRotZ(0); }}
          className="px-2 py-1 bg-black/20 rounded text-xs hover:bg-black/30"
        >
          重置
        </button>
        <button
          onClick={() => { setRotX(90); setRotY(0); setRotZ(180); }}
          className="px-2 py-1 bg-black/20 rounded text-xs hover:bg-black/30"
        >
          目前設定
        </button>
      </div>
    </div>
  );
}
