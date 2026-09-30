'use client';

import { useTranslations } from 'next-intl';
import { type ModelInfo, formatFileSize, formatNumber, formatDimension } from '@/lib/modelAnalysis';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';

interface ModelInfoPanelProps {
  info: ModelInfo | null;
  loading?: boolean;
}

export function ModelInfoPanel({ info, loading }: ModelInfoPanelProps) {
  const t = useTranslations('modelInfo');

  if (loading) {
    return (
      <Card>
        <CardHeader className="pb-0">
          <CardTitle className="text-base">{t('title')}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse space-y-3">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-4 bg-muted rounded w-3/4" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!info) {
    return (
      <Card>
        <CardHeader className="pb-0">
          <CardTitle className="text-base">{t('title')}</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">{t('uploadHint')}</p>
        </CardContent>
      </Card>
    );
  }

  const infoItems = [
    { label: t('fileName'), value: info.fileName },
    { label: t('fileSize'), value: formatFileSize(info.fileSize) },
    { label: t('vertices'), value: formatNumber(info.vertexCount) },
    { label: t('faces'), value: formatNumber(info.faceCount) },
  ];

  return (
    <Card>
      <CardHeader className="pb-0">
        <CardTitle className="text-base">{t('title')}</CardTitle>
      </CardHeader>
      <CardContent>
        <dl className="divide-y divide-border/60">
          {infoItems.map((item) => (
            <div key={item.label} className="flex items-baseline justify-between gap-3 py-3 text-sm first:pt-0">
              <dt className="text-muted-foreground">{item.label}</dt>
              <dd className="max-w-[60%] truncate text-right font-medium">
                {item.value}
              </dd>
            </div>
          ))}
        </dl>

        {/* Dimensions Section */}
        <Separator className="mb-5 mt-3" />
        <h4 className="mb-3 text-sm font-medium">{t('dimensions')}</h4>
        <div className="grid grid-cols-3 gap-2">
          <DimensionCard label={t('width')} value={info.boundingBox.width} color="text-red-500" />
          <DimensionCard label={t('height')} value={info.boundingBox.height} color="text-green-500" />
          <DimensionCard label={t('depth')} value={info.boundingBox.depth} color="text-blue-500" />
        </div>
      </CardContent>
    </Card>
  );
}

function DimensionCard({
  label,
  value,
  color,
}: {
  label: string;
  value: number;
  color: string;
}) {
  return (
    <div className="rounded-2xl bg-muted/80 px-2 py-3 text-center">
      <div className={`text-xs ${color} font-medium`}>{label}</div>
      <div className="mt-1 text-sm font-medium tabular-nums">
        {formatDimension(value)}
      </div>
    </div>
  );
}
