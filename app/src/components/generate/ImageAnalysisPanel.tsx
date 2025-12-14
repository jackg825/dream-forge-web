'use client';

/**
 * ImageAnalysisPanel Component
 *
 * Displays and allows editing of Gemini image analysis results.
 * Shows:
 * - Object description (editable)
 * - Color palette (editable, add/remove)
 * - 3D print friendliness assessment
 * - Material and object type info
 */

import { useState, useRef } from 'react';
import { Loader2, Sparkles, RefreshCw, Plus, X, Palette, AlertTriangle, Lightbulb, Package, RotateCcw, Star } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Slider } from '@/components/ui/slider';
import { Badge } from '@/components/ui/badge';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import type { ImageAnalysisResult, PrinterType } from '@/types';
import { STYLE_CONFIGS } from '@/config/styles';

interface ImageAnalysisPanelProps {
  analysis: ImageAnalysisResult | null;
  loading: boolean;
  error: string | null;
  colorCount: number;
  onColorCountChange: (count: number) => void;
  onDescriptionChange: (description: string) => void;
  onColorsChange: (colors: string[]) => void;
  onColorAdd: (color: string) => void;
  onColorRemove: (index: number) => void;
  onColorUpdate: (index: number, color: string) => void;
  onAnalyze: () => void;
  onReset?: () => void;
  hasEdits?: boolean;
  disabled?: boolean;
  printerType?: PrinterType;
}

/**
 * Render star rating
 */
function StarRating({ score }: { score: number }) {
  const stars = [];
  for (let i = 1; i <= 5; i++) {
    stars.push(
      <span
        key={i}
        className={i <= score ? 'text-yellow-500' : 'text-muted-foreground/50'}
      >
        ★
      </span>
    );
  }
  return <span className="text-lg">{stars}</span>;
}

/**
 * Color swatch component
 */
function ColorSwatch({
  color,
  onRemove,
  onUpdate,
  canRemove,
}: {
  color: string;
  index: number;
  onRemove: () => void;
  onUpdate: (color: string) => void;
  canRemove: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  const handleColorChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newColor = e.target.value.toUpperCase();
    onUpdate(newColor);
  };

  const handleClick = () => {
    inputRef.current?.click();
  };

  return (
    <div className="relative group">
      <div
        className="w-14 h-14 rounded-lg border-2 border-border cursor-pointer transition-all hover:scale-105 hover:shadow-md"
        style={{ backgroundColor: color }}
        onClick={handleClick}
      />
      {canRemove && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
          className="absolute -top-2 -right-2 w-5 h-5 bg-destructive text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"
        >
          <X className="w-3 h-3" />
        </button>
      )}
      <div className="text-xs text-center mt-1 font-mono text-muted-foreground">
        {color}
      </div>
      <input
        ref={inputRef}
        type="color"
        value={color}
        onChange={handleColorChange}
        className="sr-only"
      />
    </div>
  );
}

export function ImageAnalysisPanel({
  analysis,
  loading,
  error,
  colorCount,
  onColorCountChange,
  onDescriptionChange,
  onColorsChange,
  onColorAdd,
  onColorRemove,
  onColorUpdate,
  onAnalyze,
  onReset,
  hasEdits,
  disabled,
  printerType = 'fdm',
}: ImageAnalysisPanelProps) {
  const [printAssessmentOpen, setPrintAssessmentOpen] = useState(false);

  // Before analysis
  if (!analysis && !loading) {
    return (
      <div className="border border-dashed border-border rounded-lg p-6 bg-muted/50">
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
          <div className="flex-1">
            <h3 className="font-medium text-foreground flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-primary" />
              AI 圖片分析
            </h3>
            <p className="text-sm text-muted-foreground mt-1">
              分析圖片以提取色號、物體描述和 3D 列印建議
            </p>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">色號數量</span>
              <div className="w-24">
                <Slider
                  value={[colorCount]}
                  onValueChange={([value]) => onColorCountChange(value)}
                  min={3}
                  max={12}
                  step={1}
                  disabled={disabled}
                />
              </div>
              <span className="text-sm font-medium w-6">{colorCount}</span>
            </div>
            <Button
              onClick={onAnalyze}
              disabled={disabled}
            >
              <Sparkles className="w-4 h-4 mr-2" />
              分析圖片
            </Button>
          </div>
        </div>
        {error && (
          <div className="mt-4 p-3 bg-destructive/10 border border-destructive/20 rounded-lg text-destructive text-sm">
            {error}
          </div>
        )}
      </div>
    );
  }

  // Loading state
  if (loading) {
    return (
      <div className="border border-primary/20 rounded-lg p-6 bg-primary/10">
        <div className="flex items-center gap-3">
          <Loader2 className="w-5 h-5 animate-spin text-primary" />
          <span className="text-primary">正在分析圖片...</span>
        </div>
        <div className="mt-4 space-y-2">
          <div className="h-4 bg-primary/20 rounded animate-pulse" />
          <div className="h-4 bg-primary/20 rounded animate-pulse w-3/4" />
        </div>
      </div>
    );
  }

  // Analysis complete - show editable results
  return (
    <div className="border border-border rounded-lg bg-card shadow-sm">
      {/* Header */}
      <div className="px-4 py-3 border-b border-border/50 flex items-center justify-between">
        <h3 className="font-medium text-foreground flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-primary" />
          分析結果
          {hasEdits && (
            <Badge variant="secondary" className="text-xs">
              已編輯
            </Badge>
          )}
        </h3>
        <div className="flex items-center gap-2">
          {hasEdits && onReset && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onReset}
              className="text-muted-foreground"
            >
              <RotateCcw className="w-4 h-4 mr-1" />
              重置
            </Button>
          )}
          <Button
            variant="ghost"
            size="sm"
            onClick={onAnalyze}
            disabled={disabled || loading}
          >
            <RefreshCw className="w-4 h-4 mr-1" />
            重新分析
          </Button>
        </div>
      </div>

      <div className="p-4 space-y-6">
        {/* Description */}
        <div>
          <label className="block text-sm font-medium text-foreground mb-2">
            物體描述
          </label>
          <Textarea
            value={analysis?.description || ''}
            onChange={(e) => onDescriptionChange(e.target.value)}
            rows={3}
            className="resize-none"
            placeholder="AI 生成的物體描述..."
            disabled={disabled}
          />
        </div>

        {/* Color Palette */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-sm font-medium text-foreground flex items-center gap-2">
              <Palette className="w-4 h-4" />
              色板 ({analysis?.colorPalette.length || 0})
            </label>
            {(analysis?.colorPalette.length || 0) < 12 && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => onColorAdd('#808080')}
                disabled={disabled}
              >
                <Plus className="w-4 h-4 mr-1" />
                新增
              </Button>
            )}
          </div>
          <div className="flex flex-wrap gap-3">
            {analysis?.colorPalette.map((color, index) => (
              <ColorSwatch
                key={`${index}-${color}`}
                color={color}
                index={index}
                onRemove={() => onColorRemove(index)}
                onUpdate={(newColor) => onColorUpdate(index, newColor)}
                canRemove={(analysis?.colorPalette.length || 0) > 3}
              />
            ))}
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            點擊色塊可選擇新顏色，hover 可刪除
          </p>
        </div>

        {/* Style Recommendation */}
        {analysis?.recommendedStyle && (
          <div className="p-3 bg-primary/5 border border-primary/20 rounded-lg">
            <div className="flex items-center gap-2 mb-2">
              <Star className="w-4 h-4 text-primary fill-primary" />
              <span className="text-sm font-medium text-foreground">AI 推薦風格</span>
              {analysis.styleConfidence !== undefined && analysis.styleConfidence > 0.5 && (
                <span className="text-xs text-muted-foreground">
                  ({Math.round(analysis.styleConfidence * 100)}% 信心度)
                </span>
              )}
            </div>
            <div className="flex items-center gap-3">
              <Badge variant="default" className="text-sm">
                {STYLE_CONFIGS[analysis.recommendedStyle]?.nameZh || analysis.recommendedStyle}
              </Badge>
              <span className="text-xs text-muted-foreground">
                {STYLE_CONFIGS[analysis.recommendedStyle]?.name}
              </span>
            </div>
            {analysis.styleReasoning && (
              <p className="text-xs text-muted-foreground mt-2">
                {analysis.styleReasoning}
              </p>
            )}
          </div>
        )}

        {/* Print Friendliness Assessment */}
        <Collapsible open={printAssessmentOpen} onOpenChange={setPrintAssessmentOpen}>
          <CollapsibleTrigger asChild>
            <button className="w-full flex items-center justify-between p-3 bg-muted/50 rounded-lg hover:bg-muted transition-colors">
              <div className="flex items-center gap-2">
                <Package className="w-4 h-4 text-muted-foreground" />
                <span className="font-medium text-foreground">3D 列印評估</span>
                <StarRating score={analysis?.printFriendliness.score || 0} />
                <span className="text-sm text-muted-foreground">
                  ({analysis?.printFriendliness.score}/5)
                </span>
              </div>
              <span className="text-muted-foreground">
                {printAssessmentOpen ? '▲' : '▼'}
              </span>
            </button>
          </CollapsibleTrigger>
          <CollapsibleContent className="pt-4 space-y-4">
            {/* Color Suggestions */}
            {analysis?.printFriendliness.colorSuggestions.length ? (
              <div>
                <h4 className="text-sm font-medium text-foreground flex items-center gap-2 mb-2">
                  <Palette className="w-4 h-4 text-blue-500 dark:text-blue-400" />
                  色彩建議
                </h4>
                <ul className="list-disc list-inside text-sm text-muted-foreground space-y-1">
                  {analysis.printFriendliness.colorSuggestions.map((suggestion, i) => (
                    <li key={i}>{suggestion}</li>
                  ))}
                </ul>
              </div>
            ) : null}

            {/* Structural Concerns */}
            {analysis?.printFriendliness.structuralConcerns.length ? (
              <div>
                <h4 className="text-sm font-medium text-foreground flex items-center gap-2 mb-2">
                  <AlertTriangle className="w-4 h-4 text-yellow-500 dark:text-yellow-400" />
                  結構問題
                </h4>
                <ul className="list-disc list-inside text-sm text-muted-foreground space-y-1">
                  {analysis.printFriendliness.structuralConcerns.map((concern, i) => (
                    <li key={i}>{concern}</li>
                  ))}
                </ul>
              </div>
            ) : null}

            {/* Material Recommendations */}
            {analysis?.printFriendliness.materialRecommendations.length ? (
              <div>
                <h4 className="text-sm font-medium text-foreground flex items-center gap-2 mb-2">
                  <Package className="w-4 h-4 text-green-500 dark:text-green-400" />
                  材質推薦
                </h4>
                <ul className="list-disc list-inside text-sm text-muted-foreground space-y-1">
                  {analysis.printFriendliness.materialRecommendations.map((rec, i) => (
                    <li key={i}>{rec}</li>
                  ))}
                </ul>
              </div>
            ) : null}

            {/* Orientation Tips */}
            {analysis?.printFriendliness.orientationTips.length ? (
              <div>
                <h4 className="text-sm font-medium text-foreground flex items-center gap-2 mb-2">
                  <Lightbulb className="w-4 h-4 text-primary" />
                  列印方向
                </h4>
                <ul className="list-disc list-inside text-sm text-muted-foreground space-y-1">
                  {analysis.printFriendliness.orientationTips.map((tip, i) => (
                    <li key={i}>{tip}</li>
                  ))}
                </ul>
              </div>
            ) : null}
          </CollapsibleContent>
        </Collapsible>

        {/* Object Info */}
        <div className="flex flex-wrap gap-2">
          <Badge variant="outline" className="text-sm">
            類型: {analysis?.objectType || 'unknown'}
          </Badge>
          {analysis?.detectedMaterials.map((material) => (
            <Badge key={material} variant="secondary" className="text-sm">
              {material}
            </Badge>
          ))}
        </div>
      </div>
    </div>
  );
}
