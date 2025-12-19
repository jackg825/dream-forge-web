'use client';

/**
 * OptimizePanel - 3D Print Optimization UI
 *
 * Provides controls for mesh optimization:
 * - Mesh simplification (reduce polygon count)
 * - Watertight repair (fill holes, fix normals)
 * - Size scaling (adjust dimensions for print bed)
 */

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import {
  Loader2,
  Wrench,
  Download,
  ChevronDown,
  AlertTriangle,
  CheckCircle,
  Ruler,
  Grid3X3,
  Droplets,
  ArrowRightLeft,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  useMeshOptimization,
  formatDimension,
  getPrintabilityColor,
  getPrintabilityLabel,
  type OptimizationOptions,
} from '@/hooks/useMeshOptimization';

interface OptimizePanelProps {
  /** URL to the model */
  modelUrl?: string;
  /** Pipeline ID for the model */
  pipelineId?: string;
  /** Legacy job ID */
  jobId?: string;
  /** Callback when optimization is complete */
  onOptimized?: (optimizedUrl: string) => void;
  /** Additional class names */
  className?: string;
}

export function OptimizePanel({
  modelUrl,
  pipelineId,
  jobId,
  onOptimized,
  className,
}: OptimizePanelProps) {
  const t = useTranslations('optimize');

  // Optimization hook
  const {
    isAnalyzing,
    isOptimizing,
    isLoading,
    error,
    analysis,
    preview,
    optimizedUrl,
    analyze,
    previewOptimization,
    optimize,
    reset,
  } = useMeshOptimization();

  // Options state
  const [simplifyEnabled, setSimplifyEnabled] = useState(true);
  const [simplifyRatio, setSimplifyRatio] = useState(0.5);
  const [repairEnabled, setRepairEnabled] = useState(true);
  const [fillHoles, setFillHoles] = useState(true);
  const [fixNormals, setFixNormals] = useState(true);
  const [makeWatertight, setMakeWatertight] = useState(true);
  const [scaleEnabled, setScaleEnabled] = useState(false);
  const [targetWidth, setTargetWidth] = useState<number | undefined>();
  const [targetHeight, setTargetHeight] = useState<number | undefined>();
  const [targetDepth, setTargetDepth] = useState<number | undefined>();

  // Collapsible state
  const [simplifyOpen, setSimplifyOpen] = useState(true);
  const [repairOpen, setRepairOpen] = useState(true);
  const [scaleOpen, setScaleOpen] = useState(false);

  // Auto-analyze on mount
  useEffect(() => {
    if (pipelineId || jobId || modelUrl) {
      analyze({ pipelineId, jobId, modelUrl });
    }
  }, [pipelineId, jobId, modelUrl, analyze]);

  // Notify parent when optimized
  useEffect(() => {
    if (optimizedUrl && onOptimized) {
      onOptimized(optimizedUrl);
    }
  }, [optimizedUrl, onOptimized]);

  // Build options object
  const buildOptions = (): OptimizationOptions => ({
    simplify: {
      enabled: simplifyEnabled,
      targetRatio: simplifyRatio,
      preserveTopology: true,
    },
    repair: {
      enabled: repairEnabled,
      fillHoles,
      fixNormals,
      makeWatertight,
    },
    scale: {
      enabled: scaleEnabled,
      targetSize:
        targetWidth || targetHeight || targetDepth
          ? { width: targetWidth, height: targetHeight, depth: targetDepth }
          : undefined,
    },
  });

  const handlePreview = async () => {
    await previewOptimization({
      pipelineId,
      jobId,
      modelUrl,
      options: buildOptions(),
      outputFormat: 'stl',
      previewOnly: true,
    });
  };

  const handleOptimize = async () => {
    const result = await optimize({
      pipelineId,
      jobId,
      modelUrl,
      options: buildOptions(),
      outputFormat: 'stl',
    });

    if (result.success && result.optimizedModelUrl && onOptimized) {
      onOptimized(result.optimizedModelUrl);
    }
  };

  const hasAnyOptionEnabled = simplifyEnabled || repairEnabled || scaleEnabled;

  return (
    <Card className={cn('w-full', className)}>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Wrench className="h-4 w-4" />
          {t('title')}
        </CardTitle>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Analysis Results */}
        {analysis && (
          <div className="p-3 bg-muted/50 rounded-lg space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">{t('analysis.title')}</span>
              <Badge
                variant="outline"
                className={cn(getPrintabilityColor(analysis.printabilityScore))}
              >
                {getPrintabilityLabel(analysis.printabilityScore)}
              </Badge>
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
              <div className="flex items-center gap-1">
                <Grid3X3 className="h-3 w-3" />
                <span>{analysis.faceCount.toLocaleString()} {t('analysis.faces')}</span>
              </div>
              <div className="flex items-center gap-1">
                <Droplets className="h-3 w-3" />
                <span>
                  {analysis.isWatertight ? t('analysis.watertight') : t('analysis.notWatertight')}
                </span>
              </div>
              <div className="col-span-2 flex items-center gap-1">
                <Ruler className="h-3 w-3" />
                <span>
                  {formatDimension(analysis.boundingBox.width)} ×{' '}
                  {formatDimension(analysis.boundingBox.height)} ×{' '}
                  {formatDimension(analysis.boundingBox.depth)}
                </span>
              </div>
            </div>

            {analysis.issues.length > 0 && (
              <div className="space-y-1">
                <div className="flex items-center gap-1 text-xs text-yellow-600">
                  <AlertTriangle className="h-3 w-3 shrink-0" />
                  <span>{analysis.issues.length} {t('analysis.issues')}</span>
                </div>
                <ul className="text-xs text-muted-foreground pl-4 space-y-0.5">
                  {analysis.issues.map((issue, i) => (
                    <li key={i}>• {issue}</li>
                  ))}
                </ul>
              </div>
            )}

            {analysis.recommendations && analysis.recommendations.length > 0 && (
              <ul className="text-xs text-blue-600 pl-4 space-y-0.5">
                {analysis.recommendations.map((rec, i) => (
                  <li key={i}>💡 {rec}</li>
                ))}
              </ul>
            )}
          </div>
        )}

        {/* Simplification Section */}
        <Collapsible open={simplifyOpen} onOpenChange={setSimplifyOpen}>
          <div className="flex items-center justify-between">
            <CollapsibleTrigger className="flex items-center gap-2 hover:opacity-80">
              <ChevronDown
                className={cn('h-4 w-4 transition-transform', simplifyOpen && 'rotate-180')}
              />
              <Label className="cursor-pointer">{t('simplify.title')}</Label>
            </CollapsibleTrigger>
            <Switch checked={simplifyEnabled} onCheckedChange={setSimplifyEnabled} />
          </div>

          <CollapsibleContent className="pt-2">
            {simplifyEnabled && (
              <div className="pl-6 space-y-3">
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">{t('simplify.ratio')}</span>
                    <span className="font-medium">{Math.round(simplifyRatio * 100)}%</span>
                  </div>
                  <Slider
                    value={[simplifyRatio]}
                    onValueChange={([v]) => setSimplifyRatio(v)}
                    min={0.1}
                    max={1.0}
                    step={0.1}
                    className="w-full"
                  />
                  <p className="text-xs text-muted-foreground">{t('simplify.description')}</p>
                </div>
              </div>
            )}
          </CollapsibleContent>
        </Collapsible>

        {/* Repair Section */}
        <Collapsible open={repairOpen} onOpenChange={setRepairOpen}>
          <div className="flex items-center justify-between">
            <CollapsibleTrigger className="flex items-center gap-2 hover:opacity-80">
              <ChevronDown
                className={cn('h-4 w-4 transition-transform', repairOpen && 'rotate-180')}
              />
              <Label className="cursor-pointer">{t('repair.title')}</Label>
            </CollapsibleTrigger>
            <Switch checked={repairEnabled} onCheckedChange={setRepairEnabled} />
          </div>

          <CollapsibleContent className="pt-2">
            {repairEnabled && (
              <div className="pl-6 space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-sm font-normal">{t('repair.fillHoles')}</Label>
                  <Switch checked={fillHoles} onCheckedChange={setFillHoles} />
                </div>
                <div className="flex items-center justify-between">
                  <Label className="text-sm font-normal">{t('repair.fixNormals')}</Label>
                  <Switch checked={fixNormals} onCheckedChange={setFixNormals} />
                </div>
                <div className="flex items-center justify-between">
                  <Label className="text-sm font-normal">{t('repair.makeWatertight')}</Label>
                  <Switch checked={makeWatertight} onCheckedChange={setMakeWatertight} />
                </div>
              </div>
            )}
          </CollapsibleContent>
        </Collapsible>

        {/* Scale Section */}
        <Collapsible open={scaleOpen} onOpenChange={setScaleOpen}>
          <div className="flex items-center justify-between">
            <CollapsibleTrigger className="flex items-center gap-2 hover:opacity-80">
              <ChevronDown
                className={cn('h-4 w-4 transition-transform', scaleOpen && 'rotate-180')}
              />
              <Label className="cursor-pointer">{t('scale.title')}</Label>
            </CollapsibleTrigger>
            <Switch checked={scaleEnabled} onCheckedChange={setScaleEnabled} />
          </div>

          <CollapsibleContent className="pt-2">
            {scaleEnabled && (
              <div className="pl-6 space-y-3">
                <p className="text-xs text-muted-foreground">{t('scale.description')}</p>
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <Label className="text-xs text-muted-foreground">W (mm)</Label>
                    <Input
                      type="number"
                      value={targetWidth ?? ''}
                      onChange={(e) =>
                        setTargetWidth(e.target.value ? Number(e.target.value) : undefined)
                      }
                      placeholder="Auto"
                      className="h-8 text-sm"
                    />
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">H (mm)</Label>
                    <Input
                      type="number"
                      value={targetHeight ?? ''}
                      onChange={(e) =>
                        setTargetHeight(e.target.value ? Number(e.target.value) : undefined)
                      }
                      placeholder="Auto"
                      className="h-8 text-sm"
                    />
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">D (mm)</Label>
                    <Input
                      type="number"
                      value={targetDepth ?? ''}
                      onChange={(e) =>
                        setTargetDepth(e.target.value ? Number(e.target.value) : undefined)
                      }
                      placeholder="Auto"
                      className="h-8 text-sm"
                    />
                  </div>
                </div>
              </div>
            )}
          </CollapsibleContent>
        </Collapsible>

        {/* Preview Stats */}
        {preview && (
          <div className="p-3 bg-muted/50 rounded-lg space-y-2">
            <div className="flex items-center gap-2 text-sm font-medium">
              <ArrowRightLeft className="h-4 w-4" />
              {t('preview.comparison')}
            </div>

            <div className="grid grid-cols-2 gap-4 text-xs">
              <div>
                <span className="text-muted-foreground">{t('preview.before')}</span>
                <p className="font-medium">
                  {preview.original.faceCount.toLocaleString()} {t('preview.faces')}
                </p>
              </div>
              <div>
                <span className="text-muted-foreground">{t('preview.after')}</span>
                <p className="font-medium">
                  {preview.optimized.faceCount.toLocaleString()} {t('preview.faces')}
                </p>
              </div>
            </div>

            {preview.reductionPercent > 0 && (
              <div className="flex items-center gap-2">
                <Progress value={100 - preview.reductionPercent} className="flex-1 h-2" />
                <span className="text-xs text-green-600 font-medium">
                  -{preview.reductionPercent}%
                </span>
              </div>
            )}

            {preview.optimized.isWatertight && !preview.original.isWatertight && (
              <div className="flex items-center gap-1 text-xs text-green-600">
                <CheckCircle className="h-3 w-3" />
                {t('preview.nowWatertight')}
              </div>
            )}

            {preview.warnings.length > 0 && (
              <div className="space-y-1">
                <div className="text-xs text-yellow-600">
                  <AlertTriangle className="h-3 w-3 inline mr-1" />
                  {preview.warnings.length} {t('preview.warnings')}
                </div>
                <ul className="text-xs text-muted-foreground pl-4 space-y-0.5">
                  {preview.warnings.map((warning, i) => (
                    <li key={i}>• {warning}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        {/* Error Alert */}
        {error && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* Action Buttons */}
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={handlePreview}
            disabled={isLoading || !hasAnyOptionEnabled}
            className="flex-1"
          >
            {isAnalyzing && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
            {t('preview.button')}
          </Button>
          <Button
            onClick={handleOptimize}
            disabled={isLoading || !hasAnyOptionEnabled}
            className="flex-1"
          >
            {isOptimizing && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
            {t('optimize.button')}
          </Button>
        </div>

        {/* Download Optimized */}
        {optimizedUrl && (
          <Button variant="secondary" className="w-full" asChild>
            <a href={optimizedUrl} download="optimized_model.stl">
              <Download className="h-4 w-4 mr-2" />
              {t('download.button')}
            </a>
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
