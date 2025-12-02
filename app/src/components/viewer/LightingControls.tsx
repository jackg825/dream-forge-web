'use client';

import { useState, useCallback } from 'react';
import { Sun, SunDim, RotateCcw, Check, ChevronDown } from 'lucide-react';
import { Slider } from '@/components/ui/slider';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { AngleSphereWidget } from './AngleSphereWidget';
import type { LightingState, Position3D } from '@/types/lighting';
import { DEFAULT_LIGHTING, LIGHT_COLOR_PRESETS } from '@/types/lighting';

interface LightingControlsProps {
  /** Current lighting state */
  lighting: LightingState;
  /** Update spotlight position */
  onSpotlightPositionChange: (position: Position3D) => void;
  /** Update spotlight intensity */
  onSpotlightIntensityChange: (intensity: number) => void;
  /** Update spotlight color */
  onSpotlightColorChange: (color: string) => void;
  /** Update ambient intensity */
  onAmbientIntensityChange: (intensity: number) => void;
  /** Reset to defaults */
  onReset: () => void;
  /** Disabled state */
  disabled?: boolean;
  /** Size variant */
  variant?: 'default' | 'compact';
}

/**
 * LightingControls - Complete lighting control panel
 *
 * Provides UI for adjusting:
 * - Spotlight direction (via AngleSphereWidget)
 * - Spotlight intensity slider
 * - Spotlight color picker
 * - Ambient light intensity slider
 * - Reset to defaults button
 *
 * @example
 * ```tsx
 * <LightingControls
 *   lighting={lighting}
 *   onSpotlightPositionChange={updateSpotlightPosition}
 *   onSpotlightIntensityChange={updateSpotlightIntensity}
 *   onSpotlightColorChange={updateSpotlightColor}
 *   onAmbientIntensityChange={updateAmbientIntensity}
 *   onReset={resetLighting}
 * />
 * ```
 */
export function LightingControls({
  lighting,
  onSpotlightPositionChange,
  onSpotlightIntensityChange,
  onSpotlightColorChange,
  onAmbientIntensityChange,
  onReset,
  disabled = false,
  variant = 'default',
}: LightingControlsProps) {
  const [colorOpen, setColorOpen] = useState(false);

  const isCompact = variant === 'compact';
  const sphereSize = isCompact ? 100 : 120;

  // Handle intensity slider change (convert from 0-100 to 0-2)
  const handleSpotlightIntensityChange = useCallback(
    (values: number[]) => {
      onSpotlightIntensityChange(values[0] / 50); // 0-100 -> 0-2
    },
    [onSpotlightIntensityChange]
  );

  // Handle ambient slider change (convert from 0-100 to 0-1)
  const handleAmbientIntensityChange = useCallback(
    (values: number[]) => {
      onAmbientIntensityChange(values[0] / 100); // 0-100 -> 0-1
    },
    [onAmbientIntensityChange]
  );

  // Check if current values differ from defaults
  const hasChanges =
    lighting.spotlight.intensity !== DEFAULT_LIGHTING.spotlight.intensity ||
    lighting.spotlight.color !== DEFAULT_LIGHTING.spotlight.color ||
    lighting.ambient.intensity !== DEFAULT_LIGHTING.ambient.intensity ||
    lighting.spotlight.position.x !== DEFAULT_LIGHTING.spotlight.position.x ||
    lighting.spotlight.position.y !== DEFAULT_LIGHTING.spotlight.position.y ||
    lighting.spotlight.position.z !== DEFAULT_LIGHTING.spotlight.position.z;

  return (
    <div className={`flex ${isCompact ? 'gap-3' : 'gap-4'}`}>
      {/* Angle Sphere */}
      <div className="flex-shrink-0">
        <AngleSphereWidget
          position={lighting.spotlight.position}
          onPositionChange={onSpotlightPositionChange}
          size={sphereSize}
          disabled={disabled}
        />
      </div>

      {/* Controls */}
      <div className={`flex-1 min-w-0 space-y-${isCompact ? '3' : '4'}`}>
        {/* Spotlight Intensity */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <label className="flex items-center gap-1.5 text-xs text-white/70">
              <Sun className="w-3.5 h-3.5" />
              聚光燈
            </label>
            <span className="text-xs text-white/50 font-mono">
              {lighting.spotlight.intensity.toFixed(1)}x
            </span>
          </div>
          <Slider
            value={[lighting.spotlight.intensity * 50]}
            onValueChange={handleSpotlightIntensityChange}
            min={0}
            max={100}
            step={5}
            disabled={disabled}
            className="[&_[data-slot=slider-track]]:bg-white/10 [&_[data-slot=slider-range]]:bg-amber-400/80 [&_[data-slot=slider-thumb]]:border-amber-400"
          />
        </div>

        {/* Ambient Intensity */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <label className="flex items-center gap-1.5 text-xs text-white/70">
              <SunDim className="w-3.5 h-3.5" />
              環境光
            </label>
            <span className="text-xs text-white/50 font-mono">
              {lighting.ambient.intensity.toFixed(1)}x
            </span>
          </div>
          <Slider
            value={[lighting.ambient.intensity * 100]}
            onValueChange={handleAmbientIntensityChange}
            min={0}
            max={100}
            step={5}
            disabled={disabled}
            className="[&_[data-slot=slider-track]]:bg-white/10 [&_[data-slot=slider-range]]:bg-blue-400/80 [&_[data-slot=slider-thumb]]:border-blue-400"
          />
        </div>

        {/* Color Picker + Reset Row */}
        <div className="flex items-center justify-between gap-2">
          {/* Color Picker */}
          <Popover open={colorOpen} onOpenChange={setColorOpen}>
            <PopoverTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                disabled={disabled}
                className="h-8 px-2 gap-2 text-white/70 hover:text-white hover:bg-white/10"
              >
                <div
                  className="w-4 h-4 rounded-full ring-1 ring-white/30"
                  style={{ backgroundColor: lighting.spotlight.color }}
                />
                <span className="text-xs">色彩</span>
                <ChevronDown className="w-3 h-3 opacity-50" />
              </Button>
            </PopoverTrigger>
            <PopoverContent
              className="w-auto p-3 bg-black/90 backdrop-blur-xl border-white/10"
              align="start"
            >
              <div className="space-y-2">
                <p className="text-xs text-white/50 mb-2">預設色彩</p>
                <div className="flex gap-2">
                  {LIGHT_COLOR_PRESETS.map((preset) => (
                    <button
                      key={preset.value}
                      onClick={() => {
                        onSpotlightColorChange(preset.value);
                        setColorOpen(false);
                      }}
                      className={`
                        group relative w-8 h-8 rounded-full transition-transform hover:scale-110
                        ring-2 ${lighting.spotlight.color === preset.value
                          ? 'ring-amber-400 scale-110'
                          : 'ring-white/20'}
                      `}
                      style={{ backgroundColor: preset.value }}
                      title={preset.label}
                    >
                      {lighting.spotlight.color === preset.value && (
                        <Check className="absolute inset-0 m-auto w-4 h-4 text-black/60" />
                      )}
                    </button>
                  ))}
                </div>

                {/* Custom color input */}
                <div className="flex items-center gap-2 pt-2 border-t border-white/10">
                  <span className="text-xs text-white/50">自訂:</span>
                  <input
                    type="color"
                    value={lighting.spotlight.color}
                    onChange={(e) => onSpotlightColorChange(e.target.value)}
                    className="w-8 h-8 rounded cursor-pointer bg-transparent border-0"
                  />
                  <span className="text-xs font-mono text-white/50">
                    {lighting.spotlight.color.toUpperCase()}
                  </span>
                </div>
              </div>
            </PopoverContent>
          </Popover>

          {/* Reset Button */}
          <Button
            variant="ghost"
            size="sm"
            onClick={onReset}
            disabled={disabled || !hasChanges}
            className={`
              h-8 px-2 gap-1.5 text-white/50 hover:text-white hover:bg-white/10
              ${!hasChanges ? 'opacity-30' : ''}
            `}
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span className="text-xs">重設</span>
          </Button>
        </div>
      </div>
    </div>
  );
}
