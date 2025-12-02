'use client';

import { useState, useEffect, Suspense, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Upload,
  Images,
  Box,
  Palette,
  CheckCircle,
  RefreshCw,
  Loader2,
  AlertCircle,
  ChevronRight,
  Printer,
  RotateCcw,
  Eye,
} from 'lucide-react';
import { ModelViewer, type ModelViewerRef } from '@/components/viewer/ModelViewer';
import { ModelViewerErrorBoundary } from '@/components/viewer/ModelViewerErrorBoundary';
import { ViewerToolbar } from '@/components/viewer/ViewerToolbar';
import { usePipeline } from '@/hooks/usePipeline';
import type { ViewMode } from '@/types';
import { useAuth } from '@/hooks/useAuth';
import { useCredits } from '@/hooks/useCredits';
import { PipelineUploader } from './PipelineUploader';
import { ModeSelector } from './ModeSelector';
import { ProcessingModeSelector } from './ProcessingModeSelector';
import { PrecisionSelector } from './PrecisionSelector';
import { PreviousOutputs } from './PreviousOutputs';
import { RegenerateDialog } from './RegenerateDialog';
import { PipelineErrorState } from './PipelineErrorState';
import { PipelineProgressBar } from './PipelineProgressBar';
import { UnifiedProgressIndicator } from './UnifiedProgressIndicator';
import { ImageAnalysisPanel } from './ImageAnalysisPanel';
import { useImageAnalysis } from '@/hooks/useImageAnalysis';
import type {
  PipelineMeshAngle,
  PipelineTextureAngle,
  GenerationModeId,
  ProcessingMode,
  MeshPrecision,
} from '@/types';
import {
  GENERATION_MODE_OPTIONS,
  DEFAULT_GENERATION_MODE,
  DEFAULT_PROCESSING_MODE,
  DEFAULT_MESH_PRECISION,
} from '@/types';

interface PipelineFlowProps {
  onNoCredits: () => void;
}

// Map pipeline status to step
const getStepFromStatus = (status: string | undefined, hasId: boolean): number => {
  if (!hasId) return 1;
  // Draft stays on step 1 - user can preview analysis and click "Start Generation"
  if (status === 'draft') return 1;
  if (status === 'batch-queued' || status === 'batch-processing' || status === 'generating-images') return 2;
  if (status === 'images-ready') return 2;
  if (status === 'generating-mesh' || status === 'mesh-ready' || status === 'generating-texture') return 3;
  if (status === 'completed') return 4;
  return 1;
};

// Loading fallback for Suspense
function PipelineFlowLoading() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-12 w-full" />
      <Skeleton className="h-96 w-full" />
    </div>
  );
}

/**
 * PipelineFlow - Multi-step 3D generation wizard
 *
 * Flow:
 * 1. Upload images
 * 2. Gemini generates 6 views
 * 3. Preview images (can regenerate)
 * 4. Generate mesh (5 credits)
 * 5. Preview mesh
 * 6. Generate texture (10 credits) - optional
 * 7. Complete
 */
export function PipelineFlow({ onNoCredits }: PipelineFlowProps) {
  return (
    <Suspense fallback={<PipelineFlowLoading />}>
      <PipelineFlowInner onNoCredits={onNoCredits} />
    </Suspense>
  );
}

// Inner component that uses useSearchParams
function PipelineFlowInner({ onNoCredits }: PipelineFlowProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const pipelineIdParam = searchParams.get('id');

  const { user, loading: authLoading } = useAuth();
  const { credits, loading: creditsLoading } = useCredits(user?.uid);

  const [pipelineId, setPipelineId] = useState<string | null>(pipelineIdParam);
  const [uploadedImages, setUploadedImages] = useState<Array<{ url: string; file?: File }>>([]);
  const [actionLoading, setActionLoading] = useState(false);
  const [pollingInterval, setPollingInterval] = useState<NodeJS.Timeout | null>(null);
  const [generationMode, setGenerationMode] = useState<GenerationModeId>(DEFAULT_GENERATION_MODE);
  const [processingMode, setProcessingMode] = useState<ProcessingMode>(DEFAULT_PROCESSING_MODE);
  const [meshPrecision, setMeshPrecision] = useState<MeshPrecision>(DEFAULT_MESH_PRECISION);
  const [userDescription, setUserDescription] = useState<string>('');
  const [colorCount, setColorCount] = useState<number>(7);

  // Image analysis hook
  const {
    analysis: imageAnalysis,
    loading: analysisLoading,
    error: analysisError,
    analyzeImage,
    setAnalysis,
    updateDescription,
    updateColors,
    addColor,
    removeColor,
    updateColor,
    reset: resetAnalysis,
    hasEdits: analysisHasEdits,
  } = useImageAnalysis();

  // 3D Viewer state - mesh preview (Step 5)
  const meshViewerRef = useRef<ModelViewerRef>(null);
  const meshContainerRef = useRef<HTMLDivElement>(null);
  const [meshViewMode, setMeshViewMode] = useState<ViewMode>('clay');
  const [meshBgColor, setMeshBgColor] = useState('#1f2937');
  const [meshShowGrid, setMeshShowGrid] = useState(true);
  const [meshShowAxes, setMeshShowAxes] = useState(false);
  const [meshAutoRotate, setMeshAutoRotate] = useState(false);
  const [meshFullscreen, setMeshFullscreen] = useState(false);

  // 3D Viewer state - textured/complete preview (Step 7)
  const texturedViewerRef = useRef<ModelViewerRef>(null);
  const texturedContainerRef = useRef<HTMLDivElement>(null);
  const [texturedViewMode, setTexturedViewMode] = useState<ViewMode>('textured');
  const [texturedBgColor, setTexturedBgColor] = useState('#1f2937');
  const [texturedShowGrid, setTexturedShowGrid] = useState(true);
  const [texturedShowAxes, setTexturedShowAxes] = useState(false);
  const [texturedAutoRotate, setTexturedAutoRotate] = useState(false);
  const [texturedFullscreen, setTexturedFullscreen] = useState(false);

  // Regenerate dialog state
  const [regenerateDialogOpen, setRegenerateDialogOpen] = useState(false);
  const [regenerateTarget, setRegenerateTarget] = useState<{
    viewType: 'mesh' | 'texture';
    angle: string;
  } | null>(null);
  const [regenerateLoading, setRegenerateLoading] = useState(false);

  const {
    pipeline,
    loading: pipelineLoading,
    error,
    createPipeline,
    generateImages,
    submitBatch,
    regenerateImage,
    startMeshGeneration,
    checkStatus,
    startTextureGeneration,
    updateAnalysis,
    currentStep,
    isBatchProcessing,
  } = usePipeline(pipelineId);

  // Credit costs
  const MESH_COST = 5;
  const TEXTURE_COST = 10;

  // Cleanup polling on unmount
  useEffect(() => {
    return () => {
      if (pollingInterval) {
        clearInterval(pollingInterval);
      }
    };
  }, [pollingInterval]);

  // Restore analysis when loading a draft pipeline
  useEffect(() => {
    if (pipeline?.status === 'draft' && pipeline.imageAnalysis && !imageAnalysis) {
      // Convert Firestore timestamp to Date if needed
      const analysis = {
        ...pipeline.imageAnalysis,
        analyzedAt: pipeline.imageAnalysis.analyzedAt instanceof Date
          ? pipeline.imageAnalysis.analyzedAt
          : new Date((pipeline.imageAnalysis.analyzedAt as unknown as { seconds: number }).seconds * 1000),
      };
      setAnalysis(analysis);
      // Also restore userDescription if present
      if (pipeline.userDescription) {
        setUserDescription(pipeline.userDescription);
      }
      // Restore uploaded images from pipeline
      if (pipeline.inputImages && pipeline.inputImages.length > 0 && uploadedImages.length === 0) {
        setUploadedImages(pipeline.inputImages.map(img => ({ url: img.url })));
      }
    }
  }, [pipeline, imageAnalysis, setAnalysis, uploadedImages.length]);

  // Start polling when generating
  useEffect(() => {
    if (pipeline?.status === 'generating-mesh' || pipeline?.status === 'generating-texture') {
      const interval = setInterval(async () => {
        try {
          await checkStatus();
        } catch (err) {
          console.error('Status check failed:', err);
        }
      }, 3000); // Poll every 3 seconds

      setPollingInterval(interval);

      return () => clearInterval(interval);
    } else {
      if (pollingInterval) {
        clearInterval(pollingInterval);
        setPollingInterval(null);
      }
    }
  }, [pipeline?.status, checkStatus]);

  // Handle image upload and pipeline creation
  // Uses fire-and-forget pattern: release UI immediately after createPipeline,
  // let Firestore subscription handle updates from submitBatch/generateImages
  const handleStartPipeline = async () => {
    if (!user) {
      router.push('/auth');
      return;
    }

    if (uploadedImages.length === 0) {
      return;
    }

    setActionLoading(true);
    try {
      // Check if we already have a draft pipeline (from analysis)
      if (pipelineId && pipeline?.status === 'draft') {
        // Update analysis if user made edits
        if (analysisHasEdits && imageAnalysis) {
          await updateAnalysis(imageAnalysis, imageAnalysis.description);
        }

        // Release button immediately - Firestore subscription handles updates
        setActionLoading(false);

        // Start generation on existing pipeline
        if (processingMode === 'batch') {
          submitBatch(pipelineId).catch((err) => {
            console.error('Batch submission failed:', err);
          });
        } else {
          generateImages(pipelineId).catch((err) => {
            console.error('Image generation failed:', err);
          });
        }
        return;
      }

      // Create new pipeline (no prior analysis)
      const imageUrls = uploadedImages.map((img) => img.url);
      const finalDescription = imageAnalysis?.description || userDescription.trim() || undefined;
      const newPipelineId = await createPipeline(
        imageUrls,
        { meshPrecision, colorCount },
        generationMode,
        processingMode,
        finalDescription,
        imageAnalysis || undefined
      );
      setPipelineId(newPipelineId);

      // Update URL with pipeline ID
      router.push(`?id=${newPipelineId}`, { scroll: false });

      // Release button immediately - Firestore subscription handles updates
      setActionLoading(false);

      // Fire-and-forget: Start image generation based on processing mode
      if (processingMode === 'batch') {
        submitBatch(newPipelineId).catch((err) => {
          console.error('Batch submission failed:', err);
        });
      } else {
        generateImages(newPipelineId).catch((err) => {
          console.error('Image generation failed:', err);
        });
      }
    } catch (err) {
      console.error('Failed to create pipeline:', err);
      setActionLoading(false);
    }
  };

  // Handle image analysis - creates draft pipeline after analysis completes
  const handleAnalyze = async () => {
    if (!user || uploadedImages.length === 0) return;

    try {
      // Run analysis
      const result = await analyzeImage(uploadedImages[0].url, colorCount, 'fdm');

      // Create draft pipeline with analysis results
      const imageUrls = uploadedImages.map((img) => img.url);
      const newPipelineId = await createPipeline(
        imageUrls,
        { meshPrecision, colorCount },
        generationMode,
        processingMode,
        result.description,
        result
      );

      // Update state and URL so user can return to this draft
      setPipelineId(newPipelineId);
      router.push(`?id=${newPipelineId}`, { scroll: false });
    } catch (err) {
      console.error('Analysis failed:', err);
      // Error is handled by useImageAnalysis hook
    }
  };

  // Handle mesh generation
  const handleStartMesh = async () => {
    if (credits < MESH_COST) {
      onNoCredits();
      return;
    }

    setActionLoading(true);
    try {
      await startMeshGeneration();
    } catch (err) {
      console.error('Failed to start mesh generation:', err);
    } finally {
      setActionLoading(false);
    }
  };

  // Handle texture generation
  const handleStartTexture = async () => {
    if (credits < TEXTURE_COST) {
      onNoCredits();
      return;
    }

    setActionLoading(true);
    try {
      await startTextureGeneration();
    } catch (err) {
      console.error('Failed to start texture generation:', err);
    } finally {
      setActionLoading(false);
    }
  };

  // Open regenerate dialog
  const openRegenerateDialog = (viewType: 'mesh' | 'texture', angle: string) => {
    setRegenerateTarget({ viewType, angle });
    setRegenerateDialogOpen(true);
  };

  // Handle image regeneration with optional hint
  const handleRegenerateConfirm = async (hint?: string) => {
    if (!regenerateTarget) return;

    setRegenerateLoading(true);
    try {
      await regenerateImage(regenerateTarget.viewType, regenerateTarget.angle, hint);
      setRegenerateDialogOpen(false);
      setRegenerateTarget(null);
    } catch (err) {
      console.error('Failed to regenerate image:', err);
    } finally {
      setRegenerateLoading(false);
    }
  };

  // Calculate current step from status
  const displayStep = getStepFromStatus(pipeline?.status, !!pipelineId);
  const isFailed = pipeline?.status === 'failed';

  // Step 1: Upload - cleaner without card wrapper
  const renderUploadStep = () => (
    <div className="space-y-6">
      {user ? (
        <>
          {/* Processing mode selector - batch (default) or realtime */}
          <ProcessingModeSelector
            value={processingMode}
            onChange={setProcessingMode}
            disabled={actionLoading}
          />

          {/* Generation mode selector - show before upload */}
          <ModeSelector
            value={generationMode}
            onChange={setGenerationMode}
            disabled={actionLoading}
          />

          {/* Mesh precision selector - for 3D printing optimization */}
          <PrecisionSelector
            value={meshPrecision}
            onChange={setMeshPrecision}
            disabled={actionLoading}
          />

          <PipelineUploader
            userId={user.uid}
            images={uploadedImages}
            onImagesChange={setUploadedImages}
            maxImages={4}
            disabled={actionLoading}
          />

          {/* Image Analysis Panel - shows after images uploaded */}
          {uploadedImages.length > 0 && (
            <ImageAnalysisPanel
              analysis={imageAnalysis}
              loading={analysisLoading}
              error={analysisError}
              colorCount={colorCount}
              onColorCountChange={setColorCount}
              onDescriptionChange={(desc) => {
                updateDescription(desc);
                setUserDescription(desc);
              }}
              onColorsChange={updateColors}
              onColorAdd={addColor}
              onColorRemove={removeColor}
              onColorUpdate={updateColor}
              onAnalyze={handleAnalyze}
              onReset={resetAnalysis}
              hasEdits={analysisHasEdits}
              disabled={actionLoading}
            />
          )}

          <div className="flex justify-center">
            <Button
              size="lg"
              onClick={handleStartPipeline}
              disabled={uploadedImages.length === 0 || actionLoading || authLoading}
              className="px-8"
            >
              {actionLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  處理中...
                </>
              ) : (
                <>
                  開始生成
                  <ChevronRight className="ml-2 h-4 w-4" />
                </>
              )}
            </Button>
          </div>
        </>
      ) : (
        <Card>
          <CardContent className="py-12 text-center">
            <Upload className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground mb-4">請先登入以上傳圖片</p>
            <Button onClick={() => router.push('/auth')}>
              登入
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );

  // Step 2: Processing - shows batch or realtime progress
  // Uses UnifiedProgressIndicator for consistent UX across all processing states
  const renderProcessingStep = () => {
    const isBatch = pipeline?.processingMode === 'batch' || isBatchProcessing;
    const progress = pipeline?.generationProgress;

    // Progress values: mesh (0-4), texture (0-2)
    const meshCompleted = progress?.meshViewsCompleted ?? 0;
    const textureCompleted = progress?.textureViewsCompleted ?? 0;
    const phase = progress?.phase ?? 'mesh-views';

    // View labels for display (used in realtime mode grid)
    const meshLabels = ['正面', '背面', '左側', '右側'];
    const textureLabels = ['正面', '背面'];

    // For submitting (draft) and batch modes, use the unified indicator
    if (pipeline?.status === 'draft' || isBatch) {
      return (
        <div className="py-16">
          <UnifiedProgressIndicator
            status={pipeline?.status || 'batch-queued'}
            processingMode={pipeline?.processingMode || 'batch'}
            progress={{
              meshViewsCompleted: meshCompleted,
              textureViewsCompleted: textureCompleted,
              phase,
              batchProgress: pipeline?.batchProgress,
            }}
            estimatedCompletionTime={pipeline?.estimatedCompletionTime}
            onViewHistory={() => router.push('/dashboard/history')}
          />
        </div>
      );
    }

    // Realtime mode: show detailed visual grid for granular progress
    return (
      <div className="flex flex-col items-center justify-center py-16">
        <div className="relative">
          <div className="absolute inset-0 bg-primary/20 rounded-full animate-ping" />
          <div className="relative bg-primary/10 p-6 rounded-full">
            <Loader2 className="h-10 w-10 animate-spin text-primary" />
          </div>
        </div>
        <p className="text-lg font-medium mt-6">正在生成視角圖片</p>
        <p className="text-sm text-muted-foreground mt-2">
          {phase === 'mesh-views'
            ? `正在生成網格用圖片 (${meshCompleted}/4)...`
            : phase === 'texture-views'
              ? `正在生成貼圖用圖片 (${textureCompleted}/2)...`
              : 'AI 正在分析您的圖片並生成多角度視圖'}
        </p>

        {/* Visual progress grid - 6 boxes: 4 green (mesh) + 2 blue (texture) */}
        <div className="w-full max-w-lg mt-8">
          {/* Mesh views - green theme */}
          <div className="mb-4">
            <div className="flex items-center gap-2 mb-2">
              <Box className="h-4 w-4 text-green-500" />
              <span className="text-sm font-medium">網格視圖</span>
              <span className="text-xs text-muted-foreground">({meshCompleted}/4)</span>
            </div>
            <div className="grid grid-cols-4 gap-2">
              {meshLabels.map((label, index) => {
                const isCompleted = index < meshCompleted;
                const isProcessingView = index === meshCompleted && phase === 'mesh-views';
                return (
                  <div
                    key={`mesh-${index}`}
                    className={`
                      aspect-square rounded-lg border-2 flex flex-col items-center justify-center
                      transition-all duration-300
                      ${isCompleted
                        ? 'border-green-500 bg-green-500/10'
                        : isProcessingView
                          ? 'border-green-500/50 bg-green-500/5 animate-pulse'
                          : 'border-border bg-muted/30'}
                    `}
                  >
                    {isCompleted ? (
                      <CheckCircle className="h-6 w-6 text-green-500" />
                    ) : isProcessingView ? (
                      <Loader2 className="h-5 w-5 text-green-500 animate-spin" />
                    ) : (
                      <div className="h-6 w-6 rounded-full border-2 border-dashed border-muted-foreground/30" />
                    )}
                    <span className="text-xs text-muted-foreground mt-1">{label}</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Texture views - blue theme */}
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Palette className="h-4 w-4 text-blue-500" />
              <span className="text-sm font-medium">貼圖視圖</span>
              <span className="text-xs text-muted-foreground">({textureCompleted}/2)</span>
            </div>
            <div className="grid grid-cols-4 gap-2">
              {textureLabels.map((label, index) => {
                const isCompleted = index < textureCompleted;
                const isProcessingView = index === textureCompleted && phase === 'texture-views';
                return (
                  <div
                    key={`texture-${index}`}
                    className={`
                      aspect-square rounded-lg border-2 flex flex-col items-center justify-center
                      transition-all duration-300
                      ${isCompleted
                        ? 'border-blue-500 bg-blue-500/10'
                        : isProcessingView
                          ? 'border-blue-500/50 bg-blue-500/5 animate-pulse'
                          : 'border-border bg-muted/30'}
                    `}
                  >
                    {isCompleted ? (
                      <CheckCircle className="h-6 w-6 text-blue-500" />
                    ) : isProcessingView ? (
                      <Loader2 className="h-5 w-5 text-blue-500 animate-spin" />
                    ) : (
                      <div className="h-6 w-6 rounded-full border-2 border-dashed border-muted-foreground/30" />
                    )}
                    <span className="text-xs text-muted-foreground mt-1">{label}</span>
                  </div>
                );
              })}
              {/* Empty slots to maintain grid alignment */}
              <div className="aspect-square" />
              <div className="aspect-square" />
            </div>
          </div>
        </div>
      </div>
    );
  };

  // Step 3: Image Preview - cleaner grid layout
  const renderImagePreviewStep = () => {
    const meshAngles: PipelineMeshAngle[] = ['front', 'back', 'left', 'right'];
    const textureAngles: PipelineTextureAngle[] = ['front', 'back'];

    // Get mode info for display
    const currentMode = pipeline?.generationMode || generationMode;
    const modeInfo = GENERATION_MODE_OPTIONS[currentMode];

    return (
      <div className="space-y-8">
        {/* Mesh images */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h4 className="text-sm font-medium">網格用圖片</h4>
            <Badge variant="outline" className="text-xs">{modeInfo?.meshStyle || '7色優化'}</Badge>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {meshAngles.map((angle) => {
              const image = pipeline?.meshImages[angle];
              return (
                <div key={angle} className="relative group rounded-xl overflow-hidden bg-muted">
                  {image ? (
                    <img
                      src={image.url}
                      alt={`${angle} view`}
                      className="w-full aspect-square object-cover"
                    />
                  ) : (
                    <Skeleton className="w-full aspect-square" />
                  )}
                  <div className="absolute inset-0 flex items-center justify-center bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => openRegenerateDialog('mesh', angle)}
                      disabled={actionLoading || regenerateLoading}
                    >
                      <RefreshCw className="h-4 w-4 mr-1" />
                      重新生成
                    </Button>
                  </div>
                  <span className="absolute bottom-2 left-2 text-xs font-medium text-white bg-black/50 px-2 py-0.5 rounded">
                    {angle === 'front' ? '正面' : angle === 'back' ? '背面' : angle === 'left' ? '左側' : '右側'}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Texture images */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h4 className="text-sm font-medium">貼圖用圖片</h4>
            <Badge variant="outline" className="text-xs">{modeInfo?.textureStyle || '全彩'}</Badge>
          </div>
          <div className="grid grid-cols-2 gap-3 max-w-sm">
            {textureAngles.map((angle) => {
              const image = pipeline?.textureImages[angle];
              return (
                <div key={angle} className="relative group rounded-xl overflow-hidden bg-muted">
                  {image ? (
                    <img
                      src={image.url}
                      alt={`${angle} texture view`}
                      className="w-full aspect-square object-cover"
                    />
                  ) : (
                    <Skeleton className="w-full aspect-square" />
                  )}
                  <div className="absolute inset-0 flex items-center justify-center bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => openRegenerateDialog('texture', angle)}
                      disabled={actionLoading || regenerateLoading}
                    >
                      <RefreshCw className="h-4 w-4 mr-1" />
                      重新生成
                    </Button>
                  </div>
                  <span className="absolute bottom-2 left-2 text-xs font-medium text-white bg-black/50 px-2 py-0.5 rounded">
                    {angle === 'front' ? '正面' : '背面'}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        <div className="flex justify-center pt-4">
          <Button size="lg" onClick={handleStartMesh} disabled={actionLoading} className="px-8">
            {actionLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                處理中...
              </>
            ) : (
              <>
                <Box className="mr-2 h-4 w-4" />
                生成 3D 網格 ({MESH_COST} 點)
              </>
            )}
          </Button>
        </div>
      </div>
    );
  };

  // Step 4: Mesh generation - with previous outputs sidebar
  // Uses UnifiedProgressIndicator for consistent progress display
  const renderMeshGeneratingStep = () => (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Main content - unified progress indicator */}
      <div className="lg:col-span-2 py-16">
        <UnifiedProgressIndicator
          status="generating-mesh"
          processingMode={pipeline?.processingMode || 'batch'}
        />
      </div>

      {/* Sidebar - previous outputs */}
      {pipeline && (
        <div className="lg:col-span-1">
          <PreviousOutputs pipeline={pipeline} showImages={true} />
        </div>
      )}
    </div>
  );

  // Fullscreen toggle handlers
  const handleMeshFullscreen = () => {
    if (!meshContainerRef.current) return;
    if (!meshFullscreen) {
      meshContainerRef.current.requestFullscreen?.();
      setMeshFullscreen(true);
    } else {
      document.exitFullscreen?.();
      setMeshFullscreen(false);
    }
  };

  const handleTexturedFullscreen = () => {
    if (!texturedContainerRef.current) return;
    if (!texturedFullscreen) {
      texturedContainerRef.current.requestFullscreen?.();
      setTexturedFullscreen(true);
    } else {
      document.exitFullscreen?.();
      setTexturedFullscreen(false);
    }
  };

  // Screenshot handlers
  const handleMeshScreenshot = () => {
    const dataUrl = meshViewerRef.current?.takeScreenshot();
    if (dataUrl) {
      const link = document.createElement('a');
      link.download = `mesh-preview-${Date.now()}.png`;
      link.href = dataUrl;
      link.click();
    }
  };

  const handleTexturedScreenshot = () => {
    const dataUrl = texturedViewerRef.current?.takeScreenshot();
    if (dataUrl) {
      const link = document.createElement('a');
      link.download = `model-preview-${Date.now()}.png`;
      link.href = dataUrl;
      link.click();
    }
  };

  // Step 5: Mesh preview - with 3D viewer and sidebar
  const renderMeshPreviewStep = () => (
    <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
      {/* Main content - 3D viewer */}
      <div className="lg:col-span-3 space-y-4">
        {pipeline?.meshUrl ? (
          <>
            {/* 3D Viewer with Toolbar */}
            <div
              ref={meshContainerRef}
              className="relative aspect-[4/3] bg-muted/30 rounded-2xl overflow-hidden border border-border/50"
            >
              <ModelViewerErrorBoundary>
                <ModelViewer
                  ref={meshViewerRef}
                  modelUrl={pipeline.meshUrl}
                  viewMode={meshViewMode}
                  backgroundColor={meshBgColor}
                  showGrid={meshShowGrid}
                  showAxes={meshShowAxes}
                  autoRotate={meshAutoRotate}
                />
              </ModelViewerErrorBoundary>
              <ViewerToolbar
                viewMode={meshViewMode}
                onViewModeChange={setMeshViewMode}
                hasTextures={false}
                backgroundColor={meshBgColor}
                onBackgroundChange={setMeshBgColor}
                showGrid={meshShowGrid}
                onShowGridChange={setMeshShowGrid}
                showAxes={meshShowAxes}
                onShowAxesChange={setMeshShowAxes}
                autoRotate={meshAutoRotate}
                onAutoRotateChange={setMeshAutoRotate}
                onScreenshot={handleMeshScreenshot}
                onFullscreen={handleMeshFullscreen}
                isFullscreen={meshFullscreen}
                onReset={() => meshViewerRef.current?.resetCamera()}
                portalContainer={meshContainerRef.current}
              />
            </div>

            {/* Download link */}
            <div className="text-center">
              <a
                href={pipeline.meshUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:underline text-sm inline-flex items-center gap-1"
              >
                <Box className="h-3 w-3" />
                下載 GLB 檔案
              </a>
            </div>
          </>
        ) : (
          <Skeleton className="aspect-[4/3] rounded-2xl" />
        )}
      </div>

      {/* Sidebar - previous outputs + actions */}
      {pipeline && (
        <div className="lg:col-span-1">
          <PreviousOutputs pipeline={pipeline} showImages={true} defaultCollapsed={false}>
            {/* Action buttons in sidebar */}
            <div className="space-y-3 pt-4">
              <Button
                className="w-full"
                size="lg"
                onClick={handleStartTexture}
                disabled={actionLoading}
              >
                {actionLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    處理中...
                  </>
                ) : (
                  <>
                    <Palette className="mr-2 h-4 w-4" />
                    添加貼圖 (+{TEXTURE_COST} 點)
                  </>
                )}
              </Button>
              <Button
                variant="outline"
                className="w-full"
                onClick={() => router.push('/dashboard')}
              >
                <CheckCircle className="mr-2 h-4 w-4" />
                完成 (僅網格)
              </Button>
            </div>
          </PreviousOutputs>
        </div>
      )}
    </div>
  );

  // Step 6: Texture generation - with previous outputs sidebar
  // Uses UnifiedProgressIndicator for consistent progress display
  const renderTextureGeneratingStep = () => (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Main content - unified progress indicator */}
      <div className="lg:col-span-2 py-16">
        <UnifiedProgressIndicator
          status="generating-texture"
          processingMode={pipeline?.processingMode || 'batch'}
        />
      </div>

      {/* Sidebar - previous outputs (images + mesh) */}
      {pipeline && (
        <div className="lg:col-span-1">
          <PreviousOutputs pipeline={pipeline} showImages={true} showMesh={true} />
        </div>
      )}
    </div>
  );

  // Step 7: Complete - with 3D viewer and sidebar
  const renderCompleteStep = () => {
    const modelUrl = pipeline?.texturedModelUrl || pipeline?.meshUrl;
    const hasTexture = !!pipeline?.texturedModelUrl;

    return (
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Main content - 3D viewer */}
        <div className="lg:col-span-3 space-y-4">
          {modelUrl ? (
            <>
              {/* 3D Viewer with Toolbar */}
              <div
                ref={texturedContainerRef}
                className="relative aspect-[4/3] bg-muted/30 rounded-2xl overflow-hidden border border-green-500/20"
              >
                <ModelViewerErrorBoundary>
                  <ModelViewer
                    ref={texturedViewerRef}
                    modelUrl={modelUrl}
                    viewMode={texturedViewMode}
                    backgroundColor={texturedBgColor}
                    showGrid={texturedShowGrid}
                    showAxes={texturedShowAxes}
                    autoRotate={texturedAutoRotate}
                  />
                </ModelViewerErrorBoundary>
                <ViewerToolbar
                  viewMode={texturedViewMode}
                  onViewModeChange={setTexturedViewMode}
                  hasTextures={hasTexture}
                  backgroundColor={texturedBgColor}
                  onBackgroundChange={setTexturedBgColor}
                  showGrid={texturedShowGrid}
                  onShowGridChange={setTexturedShowGrid}
                  showAxes={texturedShowAxes}
                  onShowAxesChange={setTexturedShowAxes}
                  autoRotate={texturedAutoRotate}
                  onAutoRotateChange={setTexturedAutoRotate}
                  onScreenshot={handleTexturedScreenshot}
                  onFullscreen={handleTexturedFullscreen}
                  isFullscreen={texturedFullscreen}
                  onReset={() => texturedViewerRef.current?.resetCamera()}
                  portalContainer={texturedContainerRef.current}
                />
              </div>

              {/* Download link */}
              <div className="text-center">
                <a
                  href={modelUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline text-sm inline-flex items-center gap-1"
                >
                  {hasTexture ? <Palette className="h-3 w-3" /> : <Box className="h-3 w-3" />}
                  下載 GLB 檔案
                </a>
              </div>
            </>
          ) : (
            <div className="aspect-[4/3] bg-gradient-to-br from-green-500/5 to-green-500/10 rounded-2xl flex items-center justify-center border border-green-500/20">
              <div className="text-center">
                <div className="bg-green-500/10 p-5 rounded-full inline-block mb-4">
                  <CheckCircle className="h-14 w-14 text-green-500" />
                </div>
                <p className="text-xl font-semibold">
                  {hasTexture ? '3D 模型已完成' : '3D 網格已完成'}
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Sidebar - previous outputs + print service + actions */}
        {pipeline && (
          <div className="lg:col-span-1">
            <PreviousOutputs pipeline={pipeline} showImages={true} defaultCollapsed={true}>
              {/* Print service coming soon */}
              <div className="bg-muted/30 rounded-xl p-4 text-center border border-border/50">
                <Printer className="h-6 w-6 mx-auto text-muted-foreground mb-2" />
                <h4 className="text-sm font-medium">3D 列印服務即將推出</h4>
                <p className="text-xs text-muted-foreground mt-1">
                  很快你就可以直接訂購 3D 列印成品並寄送到府
                </p>
              </div>

              {/* Action buttons */}
              <div className="space-y-3 pt-4">
                <Button
                  className="w-full"
                  onClick={() => {
                    setPipelineId(null);
                    setUploadedImages([]);
                    router.push('/generate', { scroll: false });
                  }}
                >
                  創建新作品
                </Button>
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => router.push('/dashboard')}
                >
                  查看我的作品
                </Button>
              </div>
            </PreviousOutputs>
          </div>
        )}
      </div>
    );
  };

  // Handle retry for failed pipelines
  const handleRetry = async () => {
    if (!pipelineId || !pipeline) return;

    setActionLoading(true);
    try {
      // Retry based on which step failed
      if (pipeline.errorStep === 'generating-images') {
        await generateImages(pipelineId);
      } else if (pipeline.errorStep === 'generating-mesh') {
        await startMeshGeneration();
      } else if (pipeline.errorStep === 'generating-texture') {
        await startTextureGeneration();
      }
    } catch (err) {
      console.error('Retry failed:', err);
    } finally {
      setActionLoading(false);
    }
  };

  // Render error state - cleaner design
  const renderErrorState = () => {
    const errorStep = pipeline?.errorStep;
    const canRetry = errorStep === 'generating-images' ||
                     errorStep === 'generating-mesh' ||
                     errorStep === 'generating-texture';

    return (
      <div className="flex flex-col items-center justify-center py-16">
        <div className="bg-destructive/10 p-4 rounded-full mb-4">
          <AlertCircle className="h-10 w-10 text-destructive" />
        </div>
        <p className="text-lg font-medium mb-2">處理失敗</p>
        <p className="text-sm text-muted-foreground text-center max-w-md mb-2">
          {error || pipeline?.error || '發生錯誤，請重試'}
        </p>
        {errorStep && (
          <p className="text-xs text-muted-foreground mb-6">
            失敗步驟: {errorStep === 'generating-images' ? '生成視角圖片' :
                     errorStep === 'generating-mesh' ? '生成 3D 網格' :
                     errorStep === 'generating-texture' ? '生成貼圖' : errorStep}
          </p>
        )}
        <div className="flex justify-center gap-4">
          {canRetry && (
            <Button
              onClick={handleRetry}
              disabled={actionLoading}
              variant="default"
            >
              {actionLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  重試中...
                </>
              ) : (
                <>
                  <RefreshCw className="mr-2 h-4 w-4" />
                  重試
                </>
              )}
            </Button>
          )}
          <Button
            variant="outline"
            onClick={() => {
              setPipelineId(null);
              setUploadedImages([]);
              router.push('/generate', { scroll: false });
            }}
          >
            重新開始
          </Button>
        </div>
      </div>
    );
  };

  // Main render
  if (pipelineLoading && pipelineId) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  // Check if currently processing (includes draft when pipelineId exists for submitting state)
  const isProcessing = pipeline?.status?.includes('generating') ||
    pipeline?.status === 'batch-queued' ||
    pipeline?.status === 'batch-processing' ||
    (!!pipelineId && pipeline?.status === 'draft');

  return (
    <div className="space-y-6">
      <PipelineProgressBar
        currentStep={displayStep}
        isFailed={isFailed}
        isProcessing={isProcessing}
        credits={credits}
        creditsLoading={creditsLoading}
      />

      {pipeline?.status === 'failed' || error ? (
        <PipelineErrorState
          pipeline={pipeline}
          error={error}
          onRetry={handleRetry}
          onReset={() => {
            setPipelineId(null);
            setUploadedImages([]);
            router.push('/generate', { scroll: false });
          }}
          isRetrying={actionLoading}
        />
      ) : !pipelineId ? (
        renderUploadStep()
      ) : pipeline?.status === 'draft' || pipeline?.status === 'batch-queued' || pipeline?.status === 'batch-processing' || pipeline?.status === 'generating-images' ? (
        renderProcessingStep()
      ) : pipeline?.status === 'images-ready' ? (
        renderImagePreviewStep()
      ) : pipeline?.status === 'generating-mesh' ? (
        renderMeshGeneratingStep()
      ) : pipeline?.status === 'mesh-ready' ? (
        renderMeshPreviewStep()
      ) : pipeline?.status === 'generating-texture' ? (
        renderTextureGeneratingStep()
      ) : pipeline?.status === 'completed' ? (
        renderCompleteStep()
      ) : (
        renderUploadStep()
      )}

      {/* Regenerate dialog */}
      <RegenerateDialog
        open={regenerateDialogOpen}
        onOpenChange={(open) => {
          setRegenerateDialogOpen(open);
          if (!open) setRegenerateTarget(null);
        }}
        viewType={regenerateTarget?.viewType || 'mesh'}
        angle={regenerateTarget?.angle || 'front'}
        onConfirm={handleRegenerateConfirm}
        loading={regenerateLoading}
      />
    </div>
  );
}
