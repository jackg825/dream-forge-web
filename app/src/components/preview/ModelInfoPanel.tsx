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
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">{t('title')}</CardTitle>
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
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">{t('title')}</CardTitle>
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
      <CardHeader className="pb-2">
        <CardTitle className="text-sm">{t('title')}</CardTitle>
      </CardHeader>
      <CardContent>
        <dl className="space-y-2">
          {infoItems.map((item) => (
            <div key={item.label} className="flex justify-between text-sm">
              <dt className="text-muted-foreground">{item.label}</dt>
              <dd className="font-medium truncate ml-2 max-w-[60%] text-right">
                {item.value}
              </dd>
            </div>
          ))}
        </dl>

        {/* Dimensions Section */}
        <Separator className="my-4" />
        <h4 className="text-sm font-medium mb-2">{t('dimensions')}</h4>
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
    <div className="bg-muted rounded p-2 text-center">
      <div className={`text-xs ${color} font-medium`}>{label}</div>
      <div className="text-sm mt-0.5">
        {formatDimension(value)}
      </div>
    </div>
  );
}
