'use client';

import { useTranslations } from 'next-intl';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { ArrowUpDown } from 'lucide-react';
import { cn } from '@/lib/utils';

export type ClippingAxis = 'x' | 'y' | 'z';

interface ClippingPlaneControlsProps {
  enabled: boolean;
  onEnabledChange: (enabled: boolean) => void;
  axis: ClippingAxis;
  onAxisChange: (axis: ClippingAxis) => void;
  position: number; // 0-100 percentage
  onPositionChange: (position: number) => void;
  inverted: boolean;
  onInvertedChange: (inverted: boolean) => void;
  disabled?: boolean;
}

const AXIS_OPTIONS: { value: ClippingAxis; color: string }[] = [
  { value: 'x', color: 'bg-red-500' },
  { value: 'y', color: 'bg-green-500' },
  { value: 'z', color: 'bg-blue-500' },
];

export function ClippingPlaneControls({
  enabled,
  onEnabledChange,
  axis,
  onAxisChange,
  position,
  onPositionChange,
  inverted,
  onInvertedChange,
  disabled,
}: ClippingPlaneControlsProps) {
  const t = useTranslations('clipping');

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm">{t('title')}</CardTitle>
          <Switch
            checked={enabled}
            onCheckedChange={onEnabledChange}
            disabled={disabled}
          />
        </div>
      </CardHeader>
      <CardContent>
        {enabled ? (
          <div className="space-y-4">
            {/* Axis Selection */}
            <div>
              <Label className="text-sm text-muted-foreground mb-2 block">{t('axis')}</Label>
              <div className="flex gap-2">
                {AXIS_OPTIONS.map((option) => (
                  <Button
                    key={option.value}
                    variant={axis === option.value ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => onAxisChange(option.value)}
                    disabled={disabled}
                    className="flex-1"
                  >
                    <span
                      className={cn(
                        'inline-block w-2 h-2 rounded-full mr-1.5',
                        option.color
                      )}
                    />
                    {t('axisLabel', { axis: option.value.toUpperCase() })}
                  </Button>
                ))}
              </div>
            </div>

            {/* Position Slider */}
            <div>
              <div className="flex justify-between items-center mb-2">
                <Label className="text-sm text-muted-foreground">{t('position')}</Label>
                <span className="text-sm text-muted-foreground">{position}%</span>
              </div>
              <Slider
                value={[position]}
                onValueChange={([value]) => onPositionChange(value)}
                max={100}
                step={1}
                disabled={disabled}
              />
              <div className="flex justify-between text-xs text-muted-foreground mt-1">
                <span>0%</span>
                <span>50%</span>
                <span>100%</span>
              </div>
            </div>

            {/* Invert Toggle */}
            <div className="flex items-center justify-between pt-2 border-t">
              <div>
                <Label className="text-sm">{t('invert')}</Label>
                <p className="text-xs text-muted-foreground">
                  {inverted ? t('invertDescription.inverted') : t('invertDescription.normal')}
                </p>
              </div>
              <Button
                variant={inverted ? 'secondary' : 'outline'}
                size="icon"
                onClick={() => onInvertedChange(!inverted)}
                disabled={disabled}
              >
                <ArrowUpDown className={cn('h-4 w-4', inverted && 'rotate-180')} />
              </Button>
            </div>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            {t('disabledHint')}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
