'use client';

import { useState } from 'react';
import {
  Eye,
  Grid3X3,
  Axis3D,
  RotateCw,
  Camera,
  Maximize,
  Minimize,
  RefreshCw,
  ChevronDown,
  Check,
} from 'lucide-react';
import { useTranslations } from 'next-intl';
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
import type { ViewMode } from '@/types';

interface ViewerToolbarProps {
  // View controls
  viewMode: ViewMode;
  onViewModeChange: (mode: ViewMode) => void;
  hasTextures: boolean;

  // Background
  backgroundColor: string;
  onBackgroundChange: (color: string) => void;

  // Display toggles
  showGrid: boolean;
  onShowGridChange: (show: boolean) => void;
  showAxes: boolean;
  onShowAxesChange: (show: boolean) => void;
  autoRotate: boolean;
  onAutoRotateChange: (rotate: boolean) => void;

  // Actions
  onScreenshot: () => void;
  onFullscreen: () => void;
  isFullscreen: boolean;
  onReset: () => void;

  // Container for portals (needed for fullscreen mode)
  portalContainer?: HTMLElement | null;
}

const VIEW_MODES = [
  { value: 'clay' as ViewMode, labelKey: 'viewMode.clay', icon: '◼' },
  { value: 'textured' as ViewMode, labelKey: 'viewMode.textured', icon: '◧' },
  { value: 'wireframe' as ViewMode, labelKey: 'viewMode.wireframe', icon: '▦' },
] as const;

const BACKGROUND_COLORS = [
  { value: '#ffffff', labelKey: 'backgroundColor.white', ring: 'ring-gray-300' },
  { value: '#f3f4f6', labelKey: 'backgroundColor.gray', ring: 'ring-gray-400' },
  { value: '#1f2937', labelKey: 'backgroundColor.dark', ring: 'ring-gray-600' },
  { value: '#000000', labelKey: 'backgroundColor.black', ring: 'ring-gray-800' },
] as const;

export function ViewerToolbar({
  viewMode,
  onViewModeChange,
  hasTextures,
  backgroundColor,
  onBackgroundChange,
  showGrid,
  onShowGridChange,
  showAxes,
  onShowAxesChange,
  autoRotate,
  onAutoRotateChange,
  onScreenshot,
  onFullscreen,
  isFullscreen,
  onReset,
  portalContainer,
}: ViewerToolbarProps) {
  const t = useTranslations('controls');
  const [viewModeOpen, setViewModeOpen] = useState(false);
  const [bgOpen, setBgOpen] = useState(false);

  // Portal props for fullscreen compatibility
  const portalProps = portalContainer ? { container: portalContainer } : {};

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
                    <span className="hidden sm:inline">
                      {t(VIEW_MODES.find(m => m.value === viewMode)?.labelKey ?? 'viewMode.clay')}
                    </span>
                    <ChevronDown className="w-3 h-3 opacity-50" />
                  </Button>
                </PopoverTrigger>
              </TooltipTrigger>
              <TooltipContent side="top" className="bg-black/90 text-white border-white/10" container={portalContainer}>
                {t('viewMode.textured')}
              </TooltipContent>
            </Tooltip>
            <PopoverContent
              className="w-36 p-1 bg-black/90 backdrop-blur-xl border-white/10"
              align="start"
              container={portalContainer}
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
                               ${viewMode === mode.value
                                 ? 'bg-white/20 text-white'
                                 : 'text-white/70 hover:bg-white/10 hover:text-white'}
                               ${isDisabled ? 'opacity-40 cursor-not-allowed' : ''}`}
                  >
                    <span className="font-mono text-base">{mode.icon}</span>
                    <span>{t(mode.labelKey)}</span>
                    {viewMode === mode.value && (
                      <Check className="w-4 h-4 ml-auto" />
                    )}
                  </button>
                );
              })}
              {!hasTextures && (
                <p className="px-3 py-2 text-xs text-white/40 border-t border-white/10 mt-1">
                  {t('noTextureData')}
                </p>
              )}
            </PopoverContent>
          </Popover>

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
              <TooltipContent side="top" className="bg-black/90 text-white border-white/10" container={portalContainer}>
                {t('background')}
              </TooltipContent>
            </Tooltip>
            <PopoverContent
              className="w-auto p-2 bg-black/90 backdrop-blur-xl border-white/10"
              align="center"
              container={portalContainer}
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
                               ring-2 ${backgroundColor === color.value
                                 ? 'ring-indigo-400 scale-110'
                                 : 'ring-white/20'}`}
                    style={{ backgroundColor: color.value }}
                    title={t(color.labelKey)}
                  />
                ))}
              </div>
            </PopoverContent>
          </Popover>

          <Separator orientation="vertical" className="h-6 bg-white/20 mx-1" />

          {/* Grid Toggle */}
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
            <TooltipContent side="top" className="bg-black/90 text-white border-white/10" container={portalContainer}>
              {t('grid')}
            </TooltipContent>
          </Tooltip>

          {/* Axes Toggle */}
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
            <TooltipContent side="top" className="bg-black/90 text-white border-white/10" container={portalContainer}>
              {t('axes')}
            </TooltipContent>
          </Tooltip>

          {/* Auto Rotate Toggle */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Toggle
                pressed={autoRotate}
                onPressedChange={onAutoRotateChange}
                size="sm"
                className="h-9 w-9 p-0 text-white/70 hover:text-white hover:bg-white/10
                           data-[state=on]:bg-white/20 data-[state=on]:text-white"
              >
                <RotateCw className={`w-4 h-4 ${autoRotate ? 'animate-spin' : ''}`}
                          style={{ animationDuration: '3s' }} />
              </Toggle>
            </TooltipTrigger>
            <TooltipContent side="top" className="bg-black/90 text-white border-white/10" container={portalContainer}>
              {t('autoRotate')}
            </TooltipContent>
          </Tooltip>

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
            <TooltipContent side="top" className="bg-black/90 text-white border-white/10" container={portalContainer}>
              {t('screenshot')}
            </TooltipContent>
          </Tooltip>

          {/* Fullscreen */}
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
            <TooltipContent side="top" className="bg-black/90 text-white border-white/10" container={portalContainer}>
              {isFullscreen ? t('exitFullscreen') : t('fullscreen')}
            </TooltipContent>
          </Tooltip>

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
            <TooltipContent side="top" className="bg-black/90 text-white border-white/10" container={portalContainer}>
              {t('resetCamera')}
            </TooltipContent>
          </Tooltip>
        </div>

        {/* Keyboard hint */}
        <p className="text-center text-[10px] text-white/40 mt-2 font-mono tracking-wider">
          {t('helpText')}
        </p>
      </div>
    </TooltipProvider>
  );
}
