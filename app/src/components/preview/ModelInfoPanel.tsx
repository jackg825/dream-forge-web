'use client';

import { type ModelInfo, formatFileSize, formatNumber, formatDimension } from '@/lib/modelAnalysis';

interface ModelInfoPanelProps {
  info: ModelInfo | null;
  loading?: boolean;
}

export function ModelInfoPanel({ info, loading }: ModelInfoPanelProps) {
  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow-sm p-4">
        <h3 className="font-medium text-gray-900 mb-3">模型資訊</h3>
        <div className="animate-pulse space-y-3">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-4 bg-gray-200 rounded w-3/4" />
          ))}
        </div>
      </div>
    );
  }

  if (!info) {
    return (
      <div className="bg-white rounded-lg shadow-sm p-4">
        <h3 className="font-medium text-gray-900 mb-3">模型資訊</h3>
        <p className="text-sm text-gray-500">上傳模型後顯示資訊</p>
      </div>
    );
  }

  const infoItems = [
    { label: '檔案名稱', value: info.fileName },
    { label: '檔案大小', value: formatFileSize(info.fileSize) },
    { label: '頂點數', value: formatNumber(info.vertexCount) },
    { label: '面數', value: formatNumber(info.faceCount) },
  ];

  return (
    <div className="bg-white rounded-lg shadow-sm p-4">
      <h3 className="font-medium text-gray-900 mb-3">模型資訊</h3>

      <dl className="space-y-2">
        {infoItems.map((item) => (
          <div key={item.label} className="flex justify-between text-sm">
            <dt className="text-gray-500">{item.label}</dt>
            <dd className="text-gray-900 font-medium truncate ml-2 max-w-[60%] text-right">
              {item.value}
            </dd>
          </div>
        ))}
      </dl>

      {/* Dimensions Section */}
      <div className="mt-4 pt-4 border-t border-gray-100">
        <h4 className="text-sm font-medium text-gray-700 mb-2">尺寸</h4>
        <div className="grid grid-cols-3 gap-2">
          <DimensionCard label="X (寬)" value={info.boundingBox.width} color="text-red-600" />
          <DimensionCard label="Y (高)" value={info.boundingBox.height} color="text-green-600" />
          <DimensionCard label="Z (深)" value={info.boundingBox.depth} color="text-blue-600" />
        </div>
      </div>
    </div>
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
    <div className="bg-gray-50 rounded p-2 text-center">
      <div className={`text-xs ${color} font-medium`}>{label}</div>
      <div className="text-sm text-gray-900 mt-0.5">
        {formatDimension(value)}
      </div>
    </div>
  );
}
