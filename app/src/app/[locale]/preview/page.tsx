'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import dynamic from 'next/dynamic';
import { UserHeader } from '@/components/layout/headers';
import { FileDropZone } from '@/components/preview/FileDropZone';
import { ModelInfoPanel } from '@/components/preview/ModelInfoPanel';
import { ClippingPlaneControls, type ClippingAxis } from '@/components/preview/ClippingPlaneControls';
import { UnifiedViewerToolbar } from '@/components/viewer/UnifiedViewerToolbar';
import { useLighting } from '@/hooks/useLighting';
import { useModelLoader } from '@/hooks/useModelLoader';
import { useFullscreen } from '@/hooks/useFullscreen';
import { cn } from '@/lib/utils';
import { Link } from '@/i18n/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { AlertCircle, Loader2, Sparkles, RefreshCw, Minimize } from 'lucide-react';

// Dynamic import for PreviewViewer to avoid SSR issues with Three.js
const PreviewViewer = dynamic(
  () => import('@/components/preview/PreviewViewer').then((mod) => mod.PreviewViewer),
  {
    ssr: false,
    loading: () => (
      <div className="w-full h-[500px] bg-muted rounded-lg flex items-center justify-center">
        <div className="flex flex-col items-center">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          <p className="mt-2 text-sm text-muted-foreground">Loading viewer...</p>
        </div>
      </div>
    ),
  }
);

export default function PreviewPage() {
  const t = useTranslations();
  const { state, model, error, loadFile, reset } = useModelLoader();
  const viewerContainerRef = useRef<HTMLDivElement>(null);

  // Viewer state
  const [backgroundColor, setBackgroundColor] = useState('#1f2937');

  // Lighting state
  const {
    lighting,
    updateSpotlightPosition,
    updateSpotlightIntensity,
    updateSpotlightColor,
    updateAmbientIntensity,
    resetLighting,
  } = useLighting();

  // Clipping plane state
  const [clippingEnabled, setClippingEnabled] = useState(false);
  const [clippingAxis, setClippingAxis] = useState<ClippingAxis>('y');
  const [clippingPosition, setClippingPosition] = useState(50);
  const [clippingInverted, setClippingInverted] = useState(false);

  // Display toggles state
  const [showGrid, setShowGrid] = useState(false);
  const [showAxes, setShowAxes] = useState(false);
  const [autoRotate, setAutoRotate] = useState(false);

  // Fullscreen hook with iOS fallback
  const {
    isFullscreen,
    isPseudoFullscreen,
    toggleFullscreen,
  } = useFullscreen(viewerContainerRef);

  const handleFullscreen = toggleFullscreen;

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
    <div className="min-h-screen bg-background">
      <UserHeader />

      {/* Main Content */}
      <main className="container max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Page header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold tracking-tight">{t('preview.title')}</h1>
              <Badge variant="secondary" className="gap-1">
                {t('common.free')}
              </Badge>
            </div>
            <p className="text-muted-foreground">
              {t('preview.subtitle')}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Viewer Area */}
          <div className="lg:col-span-3 space-y-4">
            {/* File Drop Zone (shown when no model) */}
            {!hasModel && !isLoading && (
              <FileDropZone onFileSelect={handleFileSelect} />
            )}

            {/* Loading State */}
            {isLoading && (
              <Card>
                <CardContent className="flex flex-col items-center justify-center h-64 py-8">
                  <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
                  <p className="text-muted-foreground">{t('preview.loadingModel')}</p>
                </CardContent>
              </Card>
            )}

            {/* Error State */}
            {state === 'error' && error && (
              <Card className="border-destructive/50 bg-destructive/5">
                <CardContent className="flex items-start gap-3 py-4">
                  <AlertCircle className="h-5 w-5 text-destructive mt-0.5 flex-shrink-0" />
                  <div className="flex-1">
                    <h3 className="text-sm font-medium text-destructive">
                      {t('preview.failedToLoad')}
                    </h3>
                    <p className="mt-1 text-sm text-destructive/80">{error}</p>
                    <Button
                      variant="link"
                      onClick={handleReset}
                      className="h-auto p-0 mt-2 text-destructive hover:text-destructive/80"
                    >
                      <RefreshCw className="h-3 w-3 mr-1" />
                      {t('preview.tryAnotherFile')}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* 3D Viewer */}
            {hasModel && (
              <Card className={cn(
                'overflow-hidden',
                isPseudoFullscreen && 'pseudo-fullscreen pseudo-fullscreen-safe pseudo-fullscreen-animate border-0 rounded-none'
              )}>
                {/* Pseudo-fullscreen backdrop (iOS) */}
                {isPseudoFullscreen && (
                  <div
                    className="pseudo-fullscreen-backdrop"
                    onClick={toggleFullscreen}
                  />
                )}

                <div
                  ref={viewerContainerRef}
                  className={cn(
                    'relative',
                    isPseudoFullscreen ? 'h-full' : 'h-[500px]'
                  )}
                >
                  {/* Close button for pseudo-fullscreen (iOS) */}
                  {isPseudoFullscreen && (
                    <button
                      onClick={toggleFullscreen}
                      className="absolute top-4 right-4 z-[10000] p-2.5 rounded-full
                                 bg-black/60 hover:bg-black/80 transition-colors
                                 text-white/80 hover:text-white"
                      style={{
                        marginTop: 'env(safe-area-inset-top, 0)',
                        marginRight: 'env(safe-area-inset-right, 0)',
                      }}
                    >
                      <Minimize className="w-5 h-5" />
                    </button>
                  )}

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
                    lighting={lighting}
                    showGrid={showGrid}
                    showAxes={showAxes}
                    autoRotate={autoRotate}
                  />
                  {/* Floating Toolbar */}
                  <UnifiedViewerToolbar
                    backgroundColor={backgroundColor}
                    onBackgroundChange={setBackgroundColor}
                    lighting={lighting}
                    onSpotlightPositionChange={updateSpotlightPosition}
                    onSpotlightIntensityChange={updateSpotlightIntensity}
                    onSpotlightColorChange={updateSpotlightColor}
                    onAmbientIntensityChange={updateAmbientIntensity}
                    onLightingReset={resetLighting}
                    showLightingControls={true}
                    showViewMode={false}
                    showDisplayToggles={true}
                    showGrid={showGrid}
                    onShowGridChange={setShowGrid}
                    showAxes={showAxes}
                    onShowAxesChange={setShowAxes}
                    autoRotate={autoRotate}
                    onAutoRotateChange={setAutoRotate}
                    isFullscreen={isFullscreen}
                    onFullscreen={handleFullscreen}
                    onScreenshot={() => {
                      // TODO: Implement screenshot for preview
                    }}
                    onReset={handleReset}
                    portalContainer={viewerContainerRef.current}
                  />
                </div>
              </Card>
            )}

            {/* Upload another file hint */}
            {hasModel && (
              <div className="text-center">
                <Button
                  variant="link"
                  onClick={() => document.getElementById('hidden-file-input')?.click()}
                  className="gap-1"
                >
                  <RefreshCw className="h-3 w-3" />
                  {t('preview.uploadAnotherFile')}
                </Button>
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
            <Card className="bg-primary/5 border-primary/20">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">{t('preview.tips.title')}</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="text-sm text-muted-foreground space-y-1">
                  <li>• {t('preview.tips.rotate')}</li>
                  <li>• {t('preview.tips.zoom')}</li>
                  <li>• {t('preview.tips.pan')}</li>
                  <li>• {t('preview.tips.clipping')}</li>
                </ul>
              </CardContent>
            </Card>

            {/* CTA to main app */}
            <Card className="bg-gradient-to-br from-indigo-500 to-purple-600 text-white border-0">
              <CardContent className="pt-6">
                <h3 className="font-semibold mb-2 flex items-center gap-2">
                  <Sparkles className="h-4 w-4" />
                  {t('preview.cta.title')}
                </h3>
                <p className="text-sm text-indigo-100 mb-4">
                  {t('preview.cta.description')}
                </p>
                <Button asChild variant="secondary">
                  <Link href="/">{t('preview.cta.button')}</Link>
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
}
