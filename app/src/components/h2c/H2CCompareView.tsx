'use client';

import Image from 'next/image';

interface H2CCompareViewProps {
  originalUrl: string | null;
  optimizedUrl: string | null;
  isLoading?: boolean;
}

/**
 * Side-by-side comparison view of original and optimized images
 */
export function H2CCompareView({
  originalUrl,
  optimizedUrl,
  isLoading = false,
}: H2CCompareViewProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {/* Original Image */}
      <div className="space-y-2">
        <p className="text-sm font-medium text-muted-foreground">原始圖片</p>
        <div className="relative aspect-square rounded-lg overflow-hidden bg-muted border border-border">
          {originalUrl ? (
            <Image
              src={originalUrl}
              alt="Original image"
              fill
              className="object-contain"
              unoptimized
            />
          ) : (
            <div className="flex items-center justify-center h-full text-muted-foreground">
              尚未上傳
            </div>
          )}
        </div>
      </div>

      {/* Optimized Image */}
      <div className="space-y-2">
        <p className="text-sm font-medium text-muted-foreground">優化後 (七色)</p>
        <div className="relative aspect-square rounded-lg overflow-hidden bg-muted border border-border">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center h-full gap-3">
              <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
              <p className="text-sm text-muted-foreground">正在優化...</p>
            </div>
          ) : optimizedUrl ? (
            <Image
              src={optimizedUrl}
              alt="Optimized image"
              fill
              className="object-contain"
              unoptimized
            />
          ) : (
            <div className="flex items-center justify-center h-full text-muted-foreground">
              等待優化
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
