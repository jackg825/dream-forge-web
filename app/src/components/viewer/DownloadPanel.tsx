'use client';

import { useState, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import type { OutputFormat, DownloadFile } from '@/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Download, Loader2, Check, X, Printer, ChevronDown, ImageIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

interface DownloadPanelProps {
  modelUrl: string;
  downloadFiles?: DownloadFile[];
  jobId: string;
  currentFormat: OutputFormat;
}

// STL conversion status
type ConversionStatus = 'idle' | 'loading' | 'converting' | 'done' | 'error';

// Texture name mapping keys
const TEXTURE_TYPE_KEYS = ['albedo', 'diffuse', 'basecolor', 'normal', 'metallic', 'roughness', 'ao', 'occlusion'] as const;

function getTextureTypeKey(fileName: string): string | undefined {
  const baseName = fileName.split('.').slice(0, -1).join('.').toLowerCase();
  for (const key of TEXTURE_TYPE_KEYS) {
    if (baseName.includes(key)) {
      return key;
    }
  }
  return undefined;
}

/**
 * Convert GLB to STL using Three.js
 * Loads GLB, extracts geometry, exports as binary STL
 */
async function convertGlbToStl(glbUrl: string): Promise<Blob> {
  // Dynamic imports to avoid SSR issues
  const THREE = await import('three');
  const { GLTFLoader } = await import('three/examples/jsm/loaders/GLTFLoader.js');
  const { STLExporter } = await import('three/examples/jsm/exporters/STLExporter.js');

  return new Promise((resolve, reject) => {
    const loader = new GLTFLoader();

    loader.load(
      glbUrl,
      (gltf) => {
        try {
          const exporter = new STLExporter();
          // Export as binary STL (smaller file size)
          const result = exporter.parse(gltf.scene, { binary: true });
          const blob = new Blob([result], { type: 'model/stl' });
          resolve(blob);
        } catch (error) {
          reject(error);
        }
      },
      undefined,
      (error) => {
        reject(error);
      }
    );
  });
}

/**
 * Download panel for completed models
 * Shows all available files from Rodin API (models + textures)
 * Supports GLB to STL conversion for 3D printing
 */
export function DownloadPanel({
  modelUrl,
  downloadFiles,
  jobId,
  currentFormat,
}: DownloadPanelProps) {
  const t = useTranslations('download');
  const [downloadingFile, setDownloadingFile] = useState<string | null>(null);
  const [showTextures, setShowTextures] = useState(false);
  const [stlConversionStatus, setStlConversionStatus] = useState<ConversionStatus>('idle');

  const handleDownload = async (url: string, fileName: string) => {
    setDownloadingFile(fileName);

    try {
      const response = await fetch(url);
      const blob = await response.blob();

      const downloadUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(downloadUrl);
    } catch (error) {
      console.error('Download failed:', error);
    } finally {
      setDownloadingFile(null);
    }
  };

  // Find GLB URL for STL conversion
  const glbUrl = modelUrl.includes('.glb')
    ? modelUrl
    : downloadFiles?.find((f) => f.name.endsWith('.glb'))?.url;

  // Handle STL conversion and download
  const handleStlDownload = useCallback(async () => {
    if (!glbUrl) return;

    setStlConversionStatus('loading');

    try {
      setStlConversionStatus('converting');
      const stlBlob = await convertGlbToStl(glbUrl);

      // Trigger download
      const downloadUrl = window.URL.createObjectURL(stlBlob);
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.download = `model_${jobId}.stl`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(downloadUrl);

      setStlConversionStatus('done');
      // Reset after a short delay
      setTimeout(() => setStlConversionStatus('idle'), 2000);
    } catch (error) {
      console.error('STL conversion failed:', error);
      setStlConversionStatus('error');
      setTimeout(() => setStlConversionStatus('idle'), 3000);
    }
  }, [glbUrl, jobId]);

  // Separate model files from texture files
  const modelFiles =
    downloadFiles?.filter((f) => {
      const ext = f.name.split('.').pop()?.toLowerCase();
      return ['glb', 'gltf', 'obj', 'fbx', 'stl', 'usdz'].includes(ext || '');
    }) || [];

  const textureFiles =
    downloadFiles?.filter((f) => {
      const ext = f.name.split('.').pop()?.toLowerCase();
      return ['png', 'jpg', 'jpeg'].includes(ext || '');
    }) || [];

  // Get format info from translations
  const formatKey = currentFormat as 'glb' | 'obj' | 'fbx' | 'stl' | 'usdz';
  const formatLabel = t(`format.${formatKey}.label`);
  const formatDescription = t(`format.${formatKey}.description`);

  // Check if current format is GLB (our new default)
  const isGlbFormat = currentFormat === 'glb' || modelUrl.includes('.glb');

  // STL conversion button content based on status
  const getStlButtonContent = () => {
    switch (stlConversionStatus) {
      case 'loading':
        return (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            {t('loadingModel')}
          </>
        );
      case 'converting':
        return (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            {t('converting')}
          </>
        );
      case 'done':
        return (
          <>
            <Check className="h-4 w-4" />
            {t('downloadComplete')}
          </>
        );
      case 'error':
        return (
          <>
            <X className="h-4 w-4" />
            {t('conversionFailed')}
          </>
        );
      default:
        return (
          <>
            <Printer className="h-4 w-4" />
            {t('downloadStl')}
          </>
        );
    }
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">{t('title')}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Primary download - GLB with materials */}
        <div className="p-3 bg-primary/5 rounded-lg border border-primary/20">
          <div className="flex items-center justify-between mb-2">
            <div>
              <span className="font-medium text-foreground">{formatLabel}</span>
              <p className="text-sm text-muted-foreground">{formatDescription}</p>
            </div>
            <span className="text-xs text-muted-foreground uppercase">.{currentFormat}</span>
          </div>
          <Button
            onClick={() => handleDownload(modelUrl, `model_${jobId}.${currentFormat}`)}
            disabled={downloadingFile !== null}
            className="w-full"
          >
            {downloadingFile === `model_${jobId}.${currentFormat}` ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : (
              <Download className="h-4 w-4 mr-2" />
            )}
            {t('downloadButton')} {formatLabel}
          </Button>
        </div>

        {/* STL conversion download - for 3D printing */}
        {isGlbFormat && glbUrl && (
          <div className="p-3 bg-muted rounded-lg border">
            <div className="flex items-center justify-between mb-2">
              <div>
                <span className="font-medium text-foreground">STL</span>
                <p className="text-sm text-muted-foreground">{t('stlFormat')}</p>
              </div>
              <span className="text-xs text-muted-foreground uppercase">.stl</span>
            </div>
            <Button
              variant={stlConversionStatus === 'done' ? 'default' : stlConversionStatus === 'error' ? 'destructive' : 'secondary'}
              onClick={handleStlDownload}
              disabled={stlConversionStatus !== 'idle' && stlConversionStatus !== 'done' && stlConversionStatus !== 'error'}
              className="w-full"
            >
              {getStlButtonContent()}
            </Button>
          </div>
        )}

        {/* Other model formats from Rodin (if any) */}
        {modelFiles.length > 1 && (
          <div>
            <p className="text-xs text-muted-foreground mb-2">{t('otherFormats')}</p>
            <div className="space-y-1">
              {modelFiles
                .filter((f) => !f.name.toLowerCase().endsWith(`.${currentFormat}`) && !f.name.endsWith('.stl'))
                .map((file) => {
                  const ext = file.name.split('.').pop()?.toLowerCase() as 'glb' | 'obj' | 'fbx' | 'stl' | 'usdz';
                  const label = t(`format.${ext}.label`);
                  return (
                    <Button
                      key={file.name}
                      variant="ghost"
                      onClick={() => handleDownload(file.url, file.name)}
                      disabled={downloadingFile !== null}
                      className="w-full justify-between h-auto py-2"
                    >
                      <span className="flex items-center gap-2">
                        {downloadingFile === file.name ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Download className="h-4 w-4" />
                        )}
                        {label}
                      </span>
                      <span className="text-xs text-muted-foreground">{file.name}</span>
                    </Button>
                  );
                })}
            </div>
          </div>
        )}

        {/* Texture files section */}
        {textureFiles.length > 0 && (
          <Collapsible open={showTextures} onOpenChange={setShowTextures}>
            <CollapsibleTrigger asChild>
              <Button variant="ghost" className="w-full justify-between">
                <span className="flex items-center gap-2">
                  <ImageIcon className="h-4 w-4" />
                  {t('textures')} ({textureFiles.length})
                </span>
                <ChevronDown className={cn('h-4 w-4 transition-transform', showTextures && 'rotate-180')} />
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="mt-2 space-y-1">
              {textureFiles.map((file) => {
                const textureKey = getTextureTypeKey(file.name);
                const ext = file.name.split('.').pop()?.toUpperCase();
                return (
                  <Button
                    key={file.name}
                    variant="ghost"
                    onClick={() => handleDownload(file.url, file.name)}
                    disabled={downloadingFile !== null}
                    className="w-full justify-between h-auto py-2"
                  >
                    <span className="flex items-center gap-2">
                      {downloadingFile === file.name ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Download className="h-4 w-4" />
                      )}
                      {textureKey ? t(`textureType.${textureKey}`) : file.name}
                    </span>
                    <span className="text-xs text-muted-foreground">{ext}</span>
                  </Button>
                );
              })}
            </CollapsibleContent>
          </Collapsible>
        )}
      </CardContent>
    </Card>
  );
}
