'use client';

import { useState, type ReactNode } from 'react';
import { ChevronDown, ChevronUp, Images, Box } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ImageLightbox } from '@/components/ui/image-lightbox';
import { useTranslations } from 'next-intl';
import type { Pipeline, PipelineMeshAngle } from '@/types';
import { ProviderBadge } from '@/components/ui/provider-badge';

interface PreviousOutputsProps {
  pipeline: Pipeline;
  showImages?: boolean;
  showMesh?: boolean;
  defaultCollapsed?: boolean;
  children?: ReactNode; // Slot for action buttons, print service, etc.
}

/**
 * Collapsible sidebar showing previous step outputs
 * Used during generation steps to provide context
 */
export function PreviousOutputs({
  pipeline,
  showImages = false,
  showMesh = false,
  defaultCollapsed = false,
  children,
}: PreviousOutputsProps) {
  const t = useTranslations('pipeline.outputs');
  const [imagesExpanded, setImagesExpanded] = useState(!defaultCollapsed);
  const [meshExpanded, setMeshExpanded] = useState(!defaultCollapsed);

  // Lightbox state
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxImages, setLightboxImages] = useState<{ src: string; alt: string }[]>([]);
  const [lightboxIndex, setLightboxIndex] = useState(0);

  const meshAngles: PipelineMeshAngle[] = ['front', 'back', 'left', 'right'];

  const hasMeshImages = Object.keys(pipeline.meshImages || {}).length > 0;
  const hasMesh = !!pipeline.meshUrl;

  // Build all images for lightbox
  const allImages: { src: string; alt: string }[] = [];

  if (hasMeshImages) {
    meshAngles.forEach((angle) => {
      const image = pipeline.meshImages[angle];
      if (image) {
        allImages.push({ src: image.url, alt: `網格 - ${angle}` });
      }
    });
  }

  const handleImageClick = (imageUrl: string) => {
    const index = allImages.findIndex((img) => img.src === imageUrl);
    if (index !== -1) {
      setLightboxImages(allImages);
      setLightboxIndex(index);
      setLightboxOpen(true);
    }
  };

  const showImagesSection = showImages && hasMeshImages;
  const showMeshSection = showMesh && hasMesh;

  if (!showImagesSection && !showMeshSection && !children) return null;

  return (
    <div className="space-y-4">
      {/* Combined provider + images card */}
      {(pipeline.settings.provider || showImagesSection) && (
        <div className="bg-muted/30 rounded-xl border border-border/50 overflow-hidden">
          {/* Provider context header */}
          {pipeline.settings.provider && (
            <div className="flex items-center gap-2 px-4 pt-4 pb-2 text-sm text-muted-foreground">
              <span>{t('generatedBy')}</span>
              <ProviderBadge provider={pipeline.settings.provider} />
            </div>
          )}

          {/* Generated Images Section */}
          {showImagesSection && (
            <>
              <Button
                variant="ghost"
                className="w-full flex items-center justify-between px-4 py-3 h-auto hover:bg-muted/50 rounded-none"
                onClick={() => setImagesExpanded(!imagesExpanded)}
              >
                <div className="flex items-center gap-2">
                  <Images className="h-4 w-4 text-green-500" />
                  <span className="text-sm font-medium">{t('viewImages')}</span>
                </div>
                {imagesExpanded ? (
                  <ChevronUp className="h-4 w-4" />
                ) : (
                  <ChevronDown className="h-4 w-4" />
                )}
              </Button>

              {imagesExpanded && (
                <div className="px-4 pb-4 space-y-3">
                  {/* Mesh images - 4 columns */}
                  {hasMeshImages && (
                    <div>
                      <p className="text-xs text-muted-foreground mb-2">{t('meshImages')}</p>
                      <div className="grid grid-cols-4 gap-1.5">
                        {meshAngles.map((angle) => {
                          const image = pipeline.meshImages[angle];
                          return image ? (
                            <button
                              key={angle}
                              onClick={() => handleImageClick(image.url)}
                              className="relative aspect-square rounded-md overflow-hidden bg-muted
                                         ring-offset-background transition-all
                                         hover:ring-2 hover:ring-primary hover:ring-offset-2
                                         focus-visible:outline-none focus-visible:ring-2
                                         focus-visible:ring-primary focus-visible:ring-offset-2"
                            >
                              <img
                                src={image.url}
                                alt={angle}
                                className="w-full h-full object-cover"
                              />
                            </button>
                          ) : null;
                        })}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* 3D Mesh Section */}
      {showMeshSection && (
        <div className="bg-muted/30 rounded-xl border border-border/50 overflow-hidden">
          <Button
            variant="ghost"
            className="w-full flex items-center justify-between p-4 h-auto hover:bg-muted/50"
            onClick={() => setMeshExpanded(!meshExpanded)}
          >
            <div className="flex items-center gap-2">
              <Box className="h-4 w-4 text-green-500" />
              <span className="text-sm font-medium">3D 網格</span>
            </div>
            {meshExpanded ? (
              <ChevronUp className="h-4 w-4" />
            ) : (
              <ChevronDown className="h-4 w-4" />
            )}
          </Button>

          {meshExpanded && (
            <div className="px-4 pb-4">
              <div className="aspect-video bg-muted rounded-lg flex items-center justify-center">
                <a
                  href={pipeline.meshUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-primary hover:underline flex items-center gap-1"
                >
                  <Box className="h-3 w-3" />
                  查看 GLB 檔案
                </a>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Children slot for action buttons, print service promo, etc. */}
      {children}

      {/* Lightbox for full-screen image viewing */}
      <ImageLightbox
        images={lightboxImages}
        initialIndex={lightboxIndex}
        isOpen={lightboxOpen}
        onClose={() => setLightboxOpen(false)}
      />
    </div>
  );
}
