'use client';

import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Box,
  Palette,
  Clock,
  CheckCircle,
  AlertCircle,
  Loader2,
  Image as ImageIcon,
  ExternalLink,
  Settings,
  User,
} from 'lucide-react';
import type { AdminPipeline, PipelineStatus, PipelineMeshAngle, PipelineTextureAngle } from '@/types';
import { ProviderBadge } from '@/components/ui/provider-badge';

interface PipelineDetailModalProps {
  pipeline: AdminPipeline | null;
  open: boolean;
  onClose: () => void;
}

// Status display configuration
const STATUS_CONFIG: Record<
  PipelineStatus,
  { label: string; icon: typeof Box; variant: 'default' | 'secondary' | 'destructive' | 'outline' }
> = {
  draft: { label: '草稿', icon: Clock, variant: 'secondary' },
  'batch-queued': { label: '排隊中', icon: Clock, variant: 'secondary' },
  'batch-processing': { label: '批次處理中', icon: Loader2, variant: 'default' },
  'generating-images': { label: '生成圖片中', icon: Loader2, variant: 'default' },
  'images-ready': { label: '圖片就緒', icon: CheckCircle, variant: 'secondary' },
  'generating-mesh': { label: '生成網格中', icon: Loader2, variant: 'default' },
  'mesh-ready': { label: '網格就緒', icon: Box, variant: 'secondary' },
  'generating-texture': { label: '生成貼圖中', icon: Loader2, variant: 'default' },
  completed: { label: '完成', icon: CheckCircle, variant: 'default' },
  failed: { label: '失敗', icon: AlertCircle, variant: 'destructive' },
};

const MESH_ANGLES: PipelineMeshAngle[] = ['front', 'back', 'left', 'right'];
const TEXTURE_ANGLES: PipelineTextureAngle[] = ['front', 'back'];

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '—';
  return new Intl.DateTimeFormat('zh-TW', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(dateStr));
}

function ImageGallery({ images, title }: { images: { url: string; label: string }[]; title: string }) {
  const [selectedImage, setSelectedImage] = useState<string | null>(null);

  if (images.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <ImageIcon className="h-8 w-8 mx-auto mb-2 opacity-30" />
        <p>尚無{title}</p>
      </div>
    );
  }

  return (
    <div>
      {/* Selected image preview */}
      {selectedImage && (
        <div className="mb-4 bg-black rounded-lg overflow-hidden">
          <img
            src={selectedImage}
            alt="Preview"
            className="w-full h-64 object-contain"
          />
        </div>
      )}

      {/* Thumbnail grid */}
      <div className="grid grid-cols-4 gap-2">
        {images.map((img, idx) => (
          <button
            key={idx}
            onClick={() => setSelectedImage(img.url)}
            className={`aspect-square bg-black rounded-md overflow-hidden border-2 transition-colors ${
              selectedImage === img.url ? 'border-primary' : 'border-transparent hover:border-muted'
            }`}
          >
            <img
              src={img.url}
              alt={img.label}
              className="w-full h-full object-contain"
            />
          </button>
        ))}
      </div>
    </div>
  );
}

export function PipelineDetailModal({ pipeline, open, onClose }: PipelineDetailModalProps) {
  if (!pipeline) return null;

  const statusConfig = STATUS_CONFIG[pipeline.status] || STATUS_CONFIG.draft;
  const StatusIcon = statusConfig.icon;
  const isProcessing =
    pipeline.status === 'batch-queued' ||
    pipeline.status === 'batch-processing' ||
    pipeline.status === 'generating-images' ||
    pipeline.status === 'generating-mesh' ||
    pipeline.status === 'generating-texture';
  const totalCredits = pipeline.creditsCharged.mesh + pipeline.creditsCharged.texture;

  // Prepare image galleries
  const inputImages = pipeline.inputImages.map((img, idx) => ({
    url: img.url,
    label: `輸入圖片 ${idx + 1}`,
  }));

  const meshImages = MESH_ANGLES
    .filter((angle) => pipeline.meshImages[angle])
    .map((angle) => ({
      url: pipeline.meshImages[angle]!.url,
      label: angle,
    }));

  const textureImages = TEXTURE_ANGLES
    .filter((angle) => pipeline.textureImages[angle])
    .map((angle) => ({
      url: pipeline.textureImages[angle]!.url,
      label: angle,
    }));

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle className="flex items-center gap-3">
            <span>Pipeline 詳情</span>
            <Badge variant={statusConfig.variant} className="gap-1">
              <StatusIcon className={`h-3 w-3 ${isProcessing ? 'animate-spin' : ''}`} />
              {statusConfig.label}
            </Badge>
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto -mx-6 px-6">
          <div className="space-y-6 pb-4">
            {/* User info and metadata */}
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-3">
                <Avatar className="h-10 w-10">
                  <AvatarImage src={pipeline.userPhotoURL || undefined} />
                  <AvatarFallback>
                    {pipeline.userDisplayName?.[0] || '?'}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <p className="font-medium">{pipeline.userDisplayName}</p>
                  <p className="text-sm text-muted-foreground">{pipeline.userEmail}</p>
                </div>
              </div>

              <div className="text-right text-sm">
                <p className="text-muted-foreground">建立時間</p>
                <p>{formatDate(pipeline.createdAt)}</p>
                {pipeline.completedAt && (
                  <>
                    <p className="text-muted-foreground mt-2">完成時間</p>
                    <p>{formatDate(pipeline.completedAt)}</p>
                  </>
                )}
              </div>
            </div>

            {/* Error display */}
            {pipeline.status === 'failed' && pipeline.error && (
              <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-4">
                <div className="flex items-center gap-2 text-destructive mb-2">
                  <AlertCircle className="h-4 w-4" />
                  <span className="font-medium">錯誤</span>
                </div>
                <p className="text-sm text-destructive">{pipeline.error}</p>
              </div>
            )}

            {/* Settings summary */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div className="bg-muted/50 rounded-lg p-3">
                <p className="text-xs text-muted-foreground mb-1">供應商</p>
                <ProviderBadge provider={pipeline.settings.provider} />
              </div>
              <div className="bg-muted/50 rounded-lg p-3">
                <p className="text-xs text-muted-foreground mb-1">品質</p>
                <p className="font-medium capitalize">{pipeline.settings.quality}</p>
              </div>
              <div className="bg-muted/50 rounded-lg p-3">
                <p className="text-xs text-muted-foreground mb-1">點數消耗</p>
                <p className="font-medium">{totalCredits} 點</p>
              </div>
              <div className="bg-muted/50 rounded-lg p-3">
                <p className="text-xs text-muted-foreground mb-1">處理模式</p>
                <p className="font-medium capitalize">{pipeline.processingMode}</p>
              </div>
            </div>

            {/* User description */}
            {pipeline.userDescription && (
              <div className="bg-muted/50 rounded-lg p-4">
                <p className="text-xs text-muted-foreground mb-1">用戶描述</p>
                <p className="text-sm">{pipeline.userDescription}</p>
              </div>
            )}

            {/* Images tabs */}
            <Tabs defaultValue="input" className="w-full">
              <TabsList className="w-full grid grid-cols-3">
                <TabsTrigger value="input" className="gap-2">
                  <ImageIcon className="h-4 w-4" />
                  輸入圖片 ({inputImages.length})
                </TabsTrigger>
                <TabsTrigger value="mesh" className="gap-2">
                  <Box className="h-4 w-4" />
                  網格圖片 ({meshImages.length})
                </TabsTrigger>
                <TabsTrigger value="texture" className="gap-2">
                  <Palette className="h-4 w-4" />
                  貼圖圖片 ({textureImages.length})
                </TabsTrigger>
              </TabsList>

              <TabsContent value="input" className="mt-4">
                <ImageGallery images={inputImages} title="輸入圖片" />
              </TabsContent>

              <TabsContent value="mesh" className="mt-4">
                <ImageGallery images={meshImages} title="網格圖片" />
              </TabsContent>

              <TabsContent value="texture" className="mt-4">
                <ImageGallery images={textureImages} title="貼圖圖片" />
              </TabsContent>
            </Tabs>

            {/* 3D Model links */}
            {(pipeline.meshUrl || pipeline.texturedModelUrl) && (
              <div className="space-y-2">
                <p className="text-sm font-medium">3D 模型</p>
                <div className="flex flex-wrap gap-2">
                  {pipeline.meshUrl && (
                    <Button variant="outline" size="sm" asChild>
                      <a
                        href={pipeline.meshUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="gap-2"
                      >
                        <Box className="h-4 w-4" />
                        下載網格
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    </Button>
                  )}
                  {pipeline.texturedModelUrl && (
                    <Button variant="outline" size="sm" asChild>
                      <a
                        href={pipeline.texturedModelUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="gap-2"
                      >
                        <Palette className="h-4 w-4" />
                        下載貼圖模型
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    </Button>
                  )}
                </div>
              </div>
            )}

            {/* Pipeline ID */}
            <div className="text-xs text-muted-foreground pt-4 border-t">
              <p>Pipeline ID: {pipeline.id}</p>
              <p>User ID: {pipeline.userId}</p>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
