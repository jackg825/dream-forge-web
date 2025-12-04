'use client';

import { useState } from 'react';
import {
  Eye,
  Sun,
  Grid3X3,
  Axis3D,
  RotateCw,
  Camera,
  Maximize,
  Minimize,
  RefreshCw,
  ChevronDown,
  Check,
  Box,
  Loader2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Toggle } from '@/components/ui/toggle';
import { Separator } from '@/components/ui/separator';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { LightingControls } from './LightingControls';
import type { ViewMode } from '@/types';
import type { LightingState, Position3D } from '@/types/lighting';
import { DEFAULT_LIGHTING } from '@/types/lighting';

interface UnifiedViewerToolbarProps {
  // View controls (optional - can hide for preview page)
  viewMode?: ViewMode;
  onViewModeChange?: (mode: ViewMode) => void;
  hasTextures?: boolean;
  showViewMode?: boolean;

  // Background
  backgroundColor: string;
  onBackgroundChange: (color: string) => void;

  // Display toggles
  showGrid?: boolean;
  onShowGridChange?: (show: boolean) => void;
  showAxes?: boolean;
  onShowAxesChange?: (show: boolean) => void;
  autoRotate?: boolean;
  onAutoRotateChange?: (rotate: boolean) => void;
  showDisplayToggles?: boolean;

  // Lighting controls (new)
  lighting?: LightingState;
  onSpotlightPositionChange?: (position: Position3D) => void;
  onSpotlightIntensityChange?: (intensity: number) => void;
  onSpotlightColorChange?: (color: string) => void;
  onAmbientIntensityChange?: (intensity: number) => void;
  onLightingReset?: () => void;
  showLightingControls?: boolean;

  // Actions
  onScreenshot: () => void;
  onFullscreen?: () => void;
  isFullscreen?: boolean;
  onReset: () => void;

  // AR (mobile only)
  onAR?: () => void;
  arLoading?: boolean;
  arSupported?: boolean;

  // Container for portals (needed for fullscreen mode)
  portalContainer?: HTMLElement | null;

  // Variant
  variant?: 'full' | 'compact';
}

const VIEW_MODES: { value: ViewMode; label: string; icon: string }[] = [
  { value: 'clay', label: '實色', icon: '◼' },
  { value: 'textured', label: '材質', icon: '◧' },
  { value: 'wireframe', label: '線框', icon: '▦' },
];

const BACKGROUND_COLORS = [
  { value: '#ffffff', label: '白', ring: 'ring-gray-300' },
  { value: '#f3f4f6', label: '灰', ring: 'ring-gray-400' },
  { value: '#1f2937', label: '深', ring: 'ring-gray-600' },
  { value: '#000000', label: '黑', ring: 'ring-gray-800' },
];

/**
 * UnifiedViewerToolbar - Combined toolbar for both Viewer and Preview pages
 *
 * Features:
 * - View mode selector (clay/textured/wireframe)
 * - Background color picker
 * - Display toggles (grid, axes, auto-rotate)
 * - Lighting controls panel (new)
 * - Screenshot, fullscreen, reset actions
 *
 * All features are optional and can be shown/hidden via props.
 *
 * @example
 * ```tsx
 * <UnifiedViewerToolbar
 *   backgroundColor={bgColor}
 *   onBackgroundChange={setBgColor}
 *   lighting={lighting}
 *   onSpotlightPositionChange={updatePosition}
 *   // ... other props
 * />
 * ```
 */
export function UnifiedViewerToolbar({
  // View mode
  viewMode = 'clay',
  onViewModeChange,
  hasTextures = false,
  showViewMode = true,

  // Background
  backgroundColor,
  onBackgroundChange,

  // Display toggles
  showGrid = false,
  onShowGridChange,
  showAxes = false,
  onShowAxesChange,
  autoRotate = false,
  onAutoRotateChange,
  showDisplayToggles = true,

  // Lighting
  lighting = DEFAULT_LIGHTING,
  onSpotlightPositionChange,
  onSpotlightIntensityChange,
  onSpotlightColorChange,
  onAmbientIntensityChange,
  onLightingReset,
  showLightingControls = true,

  // Actions
  onScreenshot,
  onFullscreen,
  isFullscreen = false,
  onReset,

  // AR
  onAR,
  arLoading = false,
  arSupported = false,

  // Portal
  portalContainer,

  // Variant
  variant = 'full',
}: UnifiedViewerToolbarProps) {
  const [viewModeOpen, setViewModeOpen] = useState(false);
  const [bgOpen, setBgOpen] = useState(false);
  const [lightingOpen, setLightingOpen] = useState(false);

  const isCompact = variant === 'compact';

  // Portal props for fullscreen compatibility
  const portalProps = portalContainer ? { container: portalContainer } : {};

  // Check if lighting has changed from defaults
  const hasLightingChanges =
    lighting.spotlight.intensity !== DEFAULT_LIGHTING.spotlight.intensity ||
    lighting.spotlight.color !== DEFAULT_LIGHTING.spotlight.color ||
    lighting.ambient.intensity !== DEFAULT_LIGHTING.ambient.intensity;

  return (
    <TooltipProvider delayDuration={200}>
      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-50">
        {/* Glassmorphism toolbar container */}
        <div
          className="flex items-center gap-1 px-2 py-1.5 rounded-xl
                     bg-black/70 backdrop-blur-xl border border-white/10
                     shadow-[0_8px_32px_rgba(0,0,0,0.4),inset_0_1px_0_rgba(255,255,255,0.1)]"
        >
          {/* View Mode Selector */}
          {showViewMode && onViewModeChange && (
            <Popover open={viewModeOpen} onOpenChange={setViewModeOpen}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <PopoverTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-9 px-3 gap-2 text-white/90 hover:text-white hover:bg-white/10
                                 font-mono text-xs tracking-wide"
                    >
                      <Eye className="w-4 h-4" />
                      {!isCompact && (
                        <span className="hidden sm:inline">
                          {VIEW_MODES.find((m) => m.value === viewMode)?.label}
                        </span>
                      )}
                      <ChevronDown className="w-3 h-3 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                </TooltipTrigger>
                <TooltipContent
                  side="top"
                  className="bg-black/90 text-white border-white/10"
                  {...portalProps}
                >
                  視圖模式
                </TooltipContent>
              </Tooltip>
              <PopoverContent
                className="w-36 p-1 bg-black/90 backdrop-blur-xl border-white/10"
                align="start"
                {...portalProps}
              >
                {VIEW_MODES.map((mode) => {
                  const isDisabled = mode.value === 'textured' && !hasTextures;
                  return (
                    <button
                      key={mode.value}
                      onClick={() => {
                        if (!isDisabled) {
                          onViewModeChange(mode.value);
                          setViewModeOpen(false);
                        }
                      }}
                      disabled={isDisabled}
                      className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm
                                 transition-colors
                                 ${
                                   viewMode === mode.value
                                     ? 'bg-white/20 text-white'
                                     : 'text-white/70 hover:bg-white/10 hover:text-white'
                                 }
                                 ${isDisabled ? 'opacity-40 cursor-not-allowed' : ''}`}
                    >
                      <span className="font-mono text-base">{mode.icon}</span>
                      <span>{mode.label}</span>
                      {viewMode === mode.value && <Check className="w-4 h-4 ml-auto" />}
                    </button>
                  );
                })}
                {!hasTextures && (
                  <p className="px-3 py-2 text-xs text-white/40 border-t border-white/10 mt-1">
                    無材質資料
                  </p>
                )}
              </PopoverContent>
            </Popover>
          )}

          {/* Background Color Selector */}
          <Popover open={bgOpen} onOpenChange={setBgOpen}>
            <Tooltip>
              <TooltipTrigger asChild>
                <PopoverTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-9 w-9 p-0 text-white/90 hover:text-white hover:bg-white/10"
                  >
                    <div
                      className="w-5 h-5 rounded-full ring-2 ring-white/30"
                      style={{ backgroundColor }}
                    />
                  </Button>
                </PopoverTrigger>
              </TooltipTrigger>
              <TooltipContent
                side="top"
                className="bg-black/90 text-white border-white/10"
                {...portalProps}
              >
                背景色
              </TooltipContent>
            </Tooltip>
            <PopoverContent
              className="w-auto p-2 bg-black/90 backdrop-blur-xl border-white/10"
              align="center"
              {...portalProps}
            >
              <div className="flex gap-2">
                {BACKGROUND_COLORS.map((color) => (
                  <button
                    key={color.value}
                    onClick={() => {
                      onBackgroundChange(color.value);
                      setBgOpen(false);
                    }}
                    className={`w-8 h-8 rounded-full transition-transform hover:scale-110
                               ring-2 ${
                                 backgroundColor === color.value
                                   ? 'ring-indigo-400 scale-110'
                                   : 'ring-white/20'
                               }`}
                    style={{ backgroundColor: color.value }}
                    title={color.label}
                  />
                ))}
              </div>
            </PopoverContent>
          </Popover>

          {/* Lighting Controls */}
          {showLightingControls && onSpotlightPositionChange && (
            <>
              <Separator orientation="vertical" className="h-6 bg-white/20 mx-1" />

              <Popover open={lightingOpen} onOpenChange={setLightingOpen}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <PopoverTrigger asChild>
                      <Button
                        variant="ghost"
                        size="sm"
                        className={`h-9 px-3 gap-2 text-white/90 hover:text-white hover:bg-white/10
                                   font-mono text-xs tracking-wide
                                   ${hasLightingChanges ? 'text-amber-400' : ''}`}
                      >
                        <Sun className="w-4 h-4" />
                        {!isCompact && <span className="hidden sm:inline">燈光</span>}
                        <ChevronDown className="w-3 h-3 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                  </TooltipTrigger>
                  <TooltipContent
                    side="top"
                    className="bg-black/90 text-white border-white/10"
                    {...portalProps}
                  >
                    燈光控制
                  </TooltipContent>
                </Tooltip>
                <PopoverContent
                  className="w-80 p-4 bg-black/90 backdrop-blur-xl border-white/10"
                  align="center"
                  {...portalProps}
                >
                  <LightingControls
                    lighting={lighting}
                    onSpotlightPositionChange={onSpotlightPositionChange}
                    onSpotlightIntensityChange={onSpotlightIntensityChange || (() => {})}
                    onSpotlightColorChange={onSpotlightColorChange || (() => {})}
                    onAmbientIntensityChange={onAmbientIntensityChange || (() => {})}
                    onReset={onLightingReset || (() => {})}
                    variant={isCompact ? 'compact' : 'default'}
                  />
                </PopoverContent>
              </Popover>
            </>
          )}

          {/* Display Toggles */}
          {showDisplayToggles && (
            <>
              <Separator orientation="vertical" className="h-6 bg-white/20 mx-1" />

              {/* Grid Toggle */}
              {onShowGridChange && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Toggle
                      pressed={showGrid}
                      onPressedChange={onShowGridChange}
                      size="sm"
                      className="h-9 w-9 p-0 text-white/70 hover:text-white hover:bg-white/10
                                 data-[state=on]:bg-white/20 data-[state=on]:text-white"
                    >
                      <Grid3X3 className="w-4 h-4" />
                    </Toggle>
                  </TooltipTrigger>
                  <TooltipContent
                    side="top"
                    className="bg-black/90 text-white border-white/10"
                    {...portalProps}
                  >
                    參考網格
                  </TooltipContent>
                </Tooltip>
              )}

              {/* Axes Toggle */}
              {onShowAxesChange && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Toggle
                      pressed={showAxes}
                      onPressedChange={onShowAxesChange}
                      size="sm"
                      className="h-9 w-9 p-0 text-white/70 hover:text-white hover:bg-white/10
                                 data-[state=on]:bg-white/20 data-[state=on]:text-white"
                    >
                      <Axis3D className="w-4 h-4" />
                    </Toggle>
                  </TooltipTrigger>
                  <TooltipContent
                    side="top"
                    className="bg-black/90 text-white border-white/10"
                    {...portalProps}
                  >
                    座標軸
                  </TooltipContent>
                </Tooltip>
              )}

              {/* Auto Rotate Toggle */}
              {onAutoRotateChange && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Toggle
                      pressed={autoRotate}
                      onPressedChange={onAutoRotateChange}
                      size="sm"
                      className="h-9 w-9 p-0 text-white/70 hover:text-white hover:bg-white/10
                                 data-[state=on]:bg-white/20 data-[state=on]:text-white"
                    >
                      <RotateCw
                        className={`w-4 h-4 ${autoRotate ? 'animate-spin' : ''}`}
                        style={{ animationDuration: '3s' }}
                      />
                    </Toggle>
                  </TooltipTrigger>
                  <TooltipContent
                    side="top"
                    className="bg-black/90 text-white border-white/10"
                    {...portalProps}
                  >
                    自動旋轉
                  </TooltipContent>
                </Tooltip>
              )}
            </>
          )}

          <Separator orientation="vertical" className="h-6 bg-white/20 mx-1" />

          {/* Screenshot */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                onClick={onScreenshot}
                className="h-9 w-9 p-0 text-white/70 hover:text-white hover:bg-white/10"
              >
                <Camera className="w-4 h-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent
              side="top"
              className="bg-black/90 text-white border-white/10"
              {...portalProps}
            >
              截圖
            </TooltipContent>
          </Tooltip>

          {/* AR Preview (mobile only) */}
          {arSupported && onAR && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={onAR}
                  disabled={arLoading}
                  className="h-9 w-9 p-0 text-white/70 hover:text-white hover:bg-white/10"
                >
                  {arLoading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Box className="w-4 h-4" />
                  )}
                </Button>
              </TooltipTrigger>
              <TooltipContent
                side="top"
                className="bg-black/90 text-white border-white/10"
                {...portalProps}
              >
                AR 預覽
              </TooltipContent>
            </Tooltip>
          )}

          {/* Fullscreen */}
          {onFullscreen && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={onFullscreen}
                  className="h-9 w-9 p-0 text-white/70 hover:text-white hover:bg-white/10"
                >
                  {isFullscreen ? (
                    <Minimize className="w-4 h-4" />
                  ) : (
                    <Maximize className="w-4 h-4" />
                  )}
                </Button>
              </TooltipTrigger>
              <TooltipContent
                side="top"
                className="bg-black/90 text-white border-white/10"
                {...portalProps}
              >
                {isFullscreen ? '退出全螢幕' : '全螢幕'}
              </TooltipContent>
            </Tooltip>
          )}

          {/* Reset Camera */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                onClick={onReset}
                className="h-9 w-9 p-0 text-white/70 hover:text-white hover:bg-white/10"
              >
                <RefreshCw className="w-4 h-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent
              side="top"
              className="bg-black/90 text-white border-white/10"
              {...portalProps}
            >
              重設視角
            </TooltipContent>
          </Tooltip>
        </div>

        {/* Keyboard hint */}
        <p className="text-center text-[10px] text-white/40 mt-2 font-mono tracking-wider">
          拖曳旋轉 • 滾輪縮放 • Shift+拖曳平移
        </p>
      </div>
    </TooltipProvider>
  );
}
