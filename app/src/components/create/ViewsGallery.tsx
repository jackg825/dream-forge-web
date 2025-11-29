'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Download, Loader2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { ViewCard } from './ViewCard';

import type { ViewAngle, SessionViewImage } from '@/types';

// Display order for views (front first, then the AI-generated angles)
const VIEW_ORDER: ViewAngle[] = ['front', 'back', 'left', 'right', 'top'];

interface ViewsGalleryProps {
  views: Record<ViewAngle, SessionViewImage>;
  selectedAngles: ViewAngle[];
  onRegenerate?: (angle: ViewAngle) => Promise<void>;
  onUploadCustom?: (angle: ViewAngle, file: File) => Promise<void>;
  regeneratingAngle?: ViewAngle | null;
  uploadingAngle?: ViewAngle | null;
  disabled?: boolean;
}

/**
 * ViewsGallery - Grid display of all session view images
 *
 * Shows the front (uploaded) image plus all AI-generated views.
 * Provides bulk download functionality.
 */
export function ViewsGallery({
  views,
  selectedAngles,
  onRegenerate,
  onUploadCustom,
  regeneratingAngle,
  uploadingAngle,
  disabled = false,
}: ViewsGalleryProps) {
  const tPreview = useTranslations('create.preview');
  const [isDownloadingAll, setIsDownloadingAll] = useState(false);

  // Get angles to display (front + selected angles)
  const displayAngles = VIEW_ORDER.filter(
    (angle) => angle === 'front' || selectedAngles.includes(angle)
  );

  // Download all views as a zip (simplified: downloads individually)
  const handleDownloadAll = async () => {
    setIsDownloadingAll(true);
    try {
      for (const angle of displayAngles) {
        const view = views[angle];
        if (!view?.url) continue;

        const response = await fetch(view.url);
        const blob = await response.blob();
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `${angle}-view.png`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);

        // Small delay between downloads
        await new Promise((resolve) => setTimeout(resolve, 200));
      }
    } catch (error) {
      console.error('Download all failed:', error);
    } finally {
      setIsDownloadingAll(false);
    }
  };

  // Count how many views are available
  const availableViewCount = displayAngles.filter((angle) => views[angle]?.url).length;

  return (
    <div className="space-y-4">
      {/* Gallery header */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {availableViewCount} / {displayAngles.length} views available
        </p>
        <Button
          variant="outline"
          size="sm"
          onClick={handleDownloadAll}
          disabled={isDownloadingAll || availableViewCount === 0 || disabled}
        >
          {isDownloadingAll ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Downloading...
            </>
          ) : (
            <>
              <Download className="mr-2 h-4 w-4" />
              {tPreview('downloadAll')}
            </>
          )}
        </Button>
      </div>

      {/* Views grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
        {displayAngles.map((angle) => (
          <ViewCard
            key={angle}
            angle={angle}
            view={views[angle]}
            onRegenerate={onRegenerate}
            onUploadCustom={onUploadCustom}
            isRegenerating={regeneratingAngle === angle}
            isUploading={uploadingAngle === angle}
            disabled={disabled}
          />
        ))}
      </div>
    </div>
  );
}
