'use client';

import { useState } from 'react';
import { ChevronDown, ChevronUp, Images, Box } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { Pipeline, PipelineMeshAngle, PipelineTextureAngle } from '@/types';

interface PreviousOutputsProps {
  pipeline: Pipeline;
  showImages?: boolean;
  showMesh?: boolean;
}

/**
 * Collapsible sidebar showing previous step outputs
 * Used during generation steps to provide context
 */
export function PreviousOutputs({
  pipeline,
  showImages = false,
  showMesh = false,
}: PreviousOutputsProps) {
  const [imagesExpanded, setImagesExpanded] = useState(true);
  const [meshExpanded, setMeshExpanded] = useState(true);

  const meshAngles: PipelineMeshAngle[] = ['front', 'back', 'left', 'right'];
  const textureAngles: PipelineTextureAngle[] = ['front', 'back'];

  const hasMeshImages = Object.keys(pipeline.meshImages || {}).length > 0;
  const hasTextureImages = Object.keys(pipeline.textureImages || {}).length > 0;
  const hasMesh = !!pipeline.meshUrl;

  if (!showImages && !showMesh) return null;
  if (showImages && !hasMeshImages && !hasTextureImages) return null;
  if (showMesh && !hasMesh) return null;

  return (
    <div className="space-y-4">
      {/* Generated Images Section */}
      {showImages && (hasMeshImages || hasTextureImages) && (
        <div className="bg-muted/30 rounded-xl border border-border/50 overflow-hidden">
          <Button
            variant="ghost"
            className="w-full flex items-center justify-between p-4 h-auto hover:bg-muted/50"
            onClick={() => setImagesExpanded(!imagesExpanded)}
          >
            <div className="flex items-center gap-2">
              <Images className="h-4 w-4 text-green-500" />
              <span className="text-sm font-medium">視角圖片</span>
            </div>
            {imagesExpanded ? (
              <ChevronUp className="h-4 w-4" />
            ) : (
              <ChevronDown className="h-4 w-4" />
            )}
          </Button>

          {imagesExpanded && (
            <div className="px-4 pb-4 space-y-3">
              {/* Mesh images - 2x2 grid */}
              {hasMeshImages && (
                <div>
                  <p className="text-xs text-muted-foreground mb-2">網格用圖片</p>
                  <div className="grid grid-cols-4 gap-1.5">
                    {meshAngles.map((angle) => {
                      const image = pipeline.meshImages[angle];
                      return image ? (
                        <div
                          key={angle}
                          className="relative aspect-square rounded-md overflow-hidden bg-muted"
                        >
                          <img
                            src={image.url}
                            alt={angle}
                            className="w-full h-full object-cover"
                          />
                        </div>
                      ) : null;
                    })}
                  </div>
                </div>
              )}

              {/* Texture images - 2 images */}
              {hasTextureImages && (
                <div>
                  <p className="text-xs text-muted-foreground mb-2">貼圖用圖片</p>
                  <div className="grid grid-cols-4 gap-1.5">
                    {textureAngles.map((angle) => {
                      const image = pipeline.textureImages[angle];
                      return image ? (
                        <div
                          key={angle}
                          className="relative aspect-square rounded-md overflow-hidden bg-muted"
                        >
                          <img
                            src={image.url}
                            alt={angle}
                            className="w-full h-full object-cover"
                          />
                        </div>
                      ) : null;
                    })}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* 3D Mesh Section */}
      {showMesh && hasMesh && (
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
    </div>
  );
}
