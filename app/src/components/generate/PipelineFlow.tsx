'use client';

import { useState, useEffect, useCallback, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
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
} from 'lucide-react';
import { usePipeline } from '@/hooks/usePipeline';
import { useAuth } from '@/hooks/useAuth';
import { useCredits } from '@/hooks/useCredits';
import { PipelineUploader } from './PipelineUploader';
import type {
  PipelineMeshAngle,
  PipelineTextureAngle,
} from '@/types';

interface PipelineFlowProps {
  onNoCredits: () => void;
}

// Step configuration
const STEPS = [
  { id: 1, key: 'upload', icon: Upload, label: '上傳圖片' },
  { id: 2, key: 'processing', icon: Images, label: '生成視角' },
  { id: 3, key: 'preview', icon: Images, label: '預覽圖片' },
  { id: 4, key: 'mesh', icon: Box, label: '生成網格' },
  { id: 5, key: 'meshPreview', icon: Box, label: '預覽網格' },
  { id: 6, key: 'texture', icon: Palette, label: '生成貼圖' },
  { id: 7, key: 'complete', icon: CheckCircle, label: '完成' },
] as const;

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

  const {
    pipeline,
    loading: pipelineLoading,
    error,
    createPipeline,
    generateImages,
    regenerateImage,
    startMeshGeneration,
    checkStatus,
    startTextureGeneration,
    currentStep,
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
      // Create pipeline with image URLs
      const imageUrls = uploadedImages.map((img) => img.url);
      const newPipelineId = await createPipeline(imageUrls);
      setPipelineId(newPipelineId);

      // Update URL with pipeline ID
      router.push(`?id=${newPipelineId}`, { scroll: false });

      // Start generating images immediately (pass ID directly since state not yet updated)
      await generateImages(newPipelineId);
    } catch (err) {
      console.error('Failed to start pipeline:', err);
    } finally {
      setActionLoading(false);
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

  // Handle image regeneration
  const handleRegenerateImage = async (viewType: 'mesh' | 'texture', angle: string) => {
    setActionLoading(true);
    try {
      await regenerateImage(viewType, angle);
    } catch (err) {
      console.error('Failed to regenerate image:', err);
    } finally {
      setActionLoading(false);
    }
  };

  // Render step indicator
  const renderStepper = () => (
    <div className="flex items-center justify-center gap-2 mb-8 overflow-x-auto py-2">
      {STEPS.map((step, index) => {
        const Icon = step.icon;
        const isActive = currentStep === step.id;
        const isCompleted = currentStep > step.id;
        const isFailed = pipeline?.status === 'failed';

        return (
          <div key={step.id} className="flex items-center">
            <div
              className={`
                flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium
                ${isActive ? 'bg-primary text-primary-foreground' : ''}
                ${isCompleted ? 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300' : ''}
                ${!isActive && !isCompleted ? 'bg-muted text-muted-foreground' : ''}
                ${isFailed && isActive ? 'bg-destructive text-destructive-foreground' : ''}
              `}
            >
              <Icon className="h-4 w-4" />
              <span className="hidden sm:inline">{step.label}</span>
            </div>
            {index < STEPS.length - 1 && (
              <ChevronRight className="h-4 w-4 mx-1 text-muted-foreground" />
            )}
          </div>
        );
      })}
    </div>
  );

  // Render credit display
  const renderCredits = () => (
    <div className="flex items-center justify-center gap-4 mb-6">
      <Badge variant="outline" className="text-sm">
        你的點數: {creditsLoading ? '...' : credits}
      </Badge>
      <div className="text-sm text-muted-foreground">
        網格: {MESH_COST} 點 | 貼圖: +{TEXTURE_COST} 點
      </div>
    </div>
  );

  // Step 1: Upload
  const renderUploadStep = () => (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Upload className="h-5 w-5" />
          上傳圖片
        </CardTitle>
        <CardDescription>
          上傳一張或多張圖片，我們將生成多角度視角圖片用於 3D 模型生成
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {user ? (
          <PipelineUploader
            userId={user.uid}
            images={uploadedImages}
            onImagesChange={setUploadedImages}
            maxImages={4}
            disabled={actionLoading}
          />
        ) : (
          <div className="text-center py-8">
            <p className="text-muted-foreground mb-4">請先登入以上傳圖片</p>
            <Button onClick={() => router.push('/auth')}>
              登入
            </Button>
          </div>
        )}

        {user && (
          <div className="flex justify-end">
            <Button
              size="lg"
              onClick={handleStartPipeline}
              disabled={uploadedImages.length === 0 || actionLoading || authLoading}
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
        )}
      </CardContent>
    </Card>
  );

  // Step 2: Processing
  const renderProcessingStep = () => (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Images className="h-5 w-5" />
          生成視角圖片
        </CardTitle>
        <CardDescription>
          正在使用 AI 生成 6 張多角度視角圖片...
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="flex flex-col items-center justify-center py-12">
          <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
          <p className="text-lg font-medium">生成中...</p>
          <p className="text-sm text-muted-foreground mt-2">
            這可能需要 30-60 秒
          </p>
        </div>
      </CardContent>
    </Card>
  );

  // Step 3: Image Preview
  const renderImagePreviewStep = () => {
    const meshAngles: PipelineMeshAngle[] = ['front', 'back', 'left', 'right'];
    const textureAngles: PipelineTextureAngle[] = ['front', 'back'];

    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Images className="h-5 w-5" />
            預覽生成的圖片
          </CardTitle>
          <CardDescription>
            查看生成的視角圖片，可以重新生成不滿意的圖片
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Mesh images */}
          <div>
            <h4 className="text-sm font-medium mb-3">網格用圖片 (7色優化)</h4>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {meshAngles.map((angle) => {
                const image = pipeline?.meshImages[angle];
                return (
                  <div key={angle} className="relative group">
                    {image ? (
                      <img
                        src={image.url}
                        alt={`${angle} view`}
                        className="w-full aspect-square object-cover rounded-lg border"
                      />
                    ) : (
                      <Skeleton className="w-full aspect-square rounded-lg" />
                    )}
                    <div className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity rounded-lg">
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => handleRegenerateImage('mesh', angle)}
                        disabled={actionLoading}
                      >
                        <RefreshCw className="h-4 w-4 mr-1" />
                        重新生成
                      </Button>
                    </div>
                    <Badge className="absolute bottom-2 left-2" variant="secondary">
                      {angle === 'front' ? '正面' : angle === 'back' ? '背面' : angle === 'left' ? '左側' : '右側'}
                    </Badge>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Texture images */}
          <div>
            <h4 className="text-sm font-medium mb-3">貼圖用圖片 (全彩)</h4>
            <div className="grid grid-cols-2 gap-4 max-w-md">
              {textureAngles.map((angle) => {
                const image = pipeline?.textureImages[angle];
                return (
                  <div key={angle} className="relative group">
                    {image ? (
                      <img
                        src={image.url}
                        alt={`${angle} texture view`}
                        className="w-full aspect-square object-cover rounded-lg border"
                      />
                    ) : (
                      <Skeleton className="w-full aspect-square rounded-lg" />
                    )}
                    <div className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity rounded-lg">
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => handleRegenerateImage('texture', angle)}
                        disabled={actionLoading}
                      >
                        <RefreshCw className="h-4 w-4 mr-1" />
                        重新生成
                      </Button>
                    </div>
                    <Badge className="absolute bottom-2 left-2" variant="secondary">
                      {angle === 'front' ? '正面' : '背面'}
                    </Badge>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="flex justify-end">
            <Button size="lg" onClick={handleStartMesh} disabled={actionLoading}>
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
        </CardContent>
      </Card>
    );
  };

  // Step 4: Mesh generation
  const renderMeshGeneratingStep = () => (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Box className="h-5 w-5" />
          生成 3D 網格
        </CardTitle>
        <CardDescription>
          正在使用 Meshy AI 生成 3D 模型網格...
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="flex flex-col items-center justify-center py-12">
          <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
          <p className="text-lg font-medium">生成網格中...</p>
          <p className="text-sm text-muted-foreground mt-2">
            這可能需要 2-5 分鐘
          </p>
          <Progress className="w-full max-w-xs mt-4" value={50} />
        </div>
      </CardContent>
    </Card>
  );

  // Step 5: Mesh preview
  const renderMeshPreviewStep = () => (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Box className="h-5 w-5" />
          網格預覽
        </CardTitle>
        <CardDescription>
          3D 網格已生成完成！你可以選擇添加貼圖或直接完成
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {pipeline?.meshUrl ? (
          <div className="aspect-video bg-muted rounded-lg flex items-center justify-center">
            {/* TODO: Add 3D viewer component */}
            <div className="text-center">
              <Box className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground">3D 模型預覽</p>
              <a
                href={pipeline.meshUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:underline mt-2 inline-block"
              >
                下載 GLB 檔案
              </a>
            </div>
          </div>
        ) : (
          <Skeleton className="aspect-video rounded-lg" />
        )}

        <div className="flex justify-between">
          <Button variant="outline" onClick={() => router.push('/dashboard')}>
            <CheckCircle className="mr-2 h-4 w-4" />
            完成 (僅網格)
          </Button>
          <Button size="lg" onClick={handleStartTexture} disabled={actionLoading}>
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
        </div>
      </CardContent>
    </Card>
  );

  // Step 6: Texture generation
  const renderTextureGeneratingStep = () => (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Palette className="h-5 w-5" />
          生成貼圖
        </CardTitle>
        <CardDescription>
          正在為 3D 模型添加貼圖...
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="flex flex-col items-center justify-center py-12">
          <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
          <p className="text-lg font-medium">生成貼圖中...</p>
          <p className="text-sm text-muted-foreground mt-2">
            這可能需要 2-5 分鐘
          </p>
          <Progress className="w-full max-w-xs mt-4" value={50} />
        </div>
      </CardContent>
    </Card>
  );

  // Step 7: Complete
  const renderCompleteStep = () => (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CheckCircle className="h-5 w-5 text-green-500" />
          完成！
        </CardTitle>
        <CardDescription>
          你的 3D 模型已生成完成
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {pipeline?.texturedModelUrl ? (
          <div className="aspect-video bg-muted rounded-lg flex items-center justify-center">
            {/* TODO: Add 3D viewer component */}
            <div className="text-center">
              <Box className="h-16 w-16 mx-auto text-green-500 mb-4" />
              <p className="text-lg font-medium">3D 模型已就緒</p>
              <a
                href={pipeline.texturedModelUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:underline mt-2 inline-block"
              >
                下載 GLB 檔案
              </a>
            </div>
          </div>
        ) : (
          <div className="aspect-video bg-muted rounded-lg flex items-center justify-center">
            <div className="text-center">
              <Box className="h-16 w-16 mx-auto text-green-500 mb-4" />
              <p className="text-lg font-medium">3D 網格已就緒</p>
              {pipeline?.meshUrl && (
                <a
                  href={pipeline.meshUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline mt-2 inline-block"
                >
                  下載 GLB 檔案
                </a>
              )}
            </div>
          </div>
        )}

        {/* Coming soon placeholder */}
        <div className="bg-muted/50 rounded-lg p-6 text-center">
          <Printer className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
          <h4 className="font-medium">訂購 3D 列印 (即將推出)</h4>
          <p className="text-sm text-muted-foreground mt-1">
            很快你就可以直接訂購 3D 列印成品並寄送到府
          </p>
        </div>

        <div className="flex justify-center gap-4">
          <Button variant="outline" onClick={() => router.push('/dashboard')}>
            查看我的作品
          </Button>
          <Button onClick={() => {
            setPipelineId(null);
            setUploadedImages([]);
            router.push('/generate', { scroll: false });
          }}>
            創建新作品
          </Button>
        </div>
      </CardContent>
    </Card>
  );

  // Render error state
  const renderErrorState = () => (
    <Card>
      <CardContent className="py-12">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            {error || pipeline?.error || '發生錯誤'}
          </AlertDescription>
        </Alert>
        <div className="flex justify-center mt-6">
          <Button onClick={() => {
            setPipelineId(null);
            setUploadedImages([]);
          }}>
            重新開始
          </Button>
        </div>
      </CardContent>
    </Card>
  );

  // Main render
  if (pipelineLoading && pipelineId) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {renderStepper()}
      {renderCredits()}

      {pipeline?.status === 'failed' || error ? (
        renderErrorState()
      ) : !pipelineId ? (
        renderUploadStep()
      ) : pipeline?.status === 'generating-images' ? (
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
    </div>
  );
}
