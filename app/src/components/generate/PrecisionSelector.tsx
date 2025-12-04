'use client';

import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { useTranslations } from 'next-intl';
import {
  type MeshPrecision,
  MESH_PRECISION_OPTIONS,
  DEFAULT_MESH_PRECISION,
} from '@/types';

interface PrecisionSelectorProps {
  value: MeshPrecision;
  onChange: (precision: MeshPrecision) => void;
  disabled?: boolean;
}

/**
 * PrecisionSelector - Mesh precision selector for 3D printing optimization
 *
 * Displays two precision options:
 * - Standard: Optimized polycount, recommended for most 3D prints
 * - High: Preserves original mesh topology, for high-detail requirements
 */
export function PrecisionSelector({ value, onChange, disabled }: PrecisionSelectorProps) {
  const t = useTranslations();
  const precisions = Object.values(MESH_PRECISION_OPTIONS);

  return (
    <div className="space-y-2">
      <div className="text-sm font-medium text-muted-foreground">
        {t('selectors.meshPrecision')}
      </div>
      <div className="grid grid-cols-2 gap-3">
        {precisions.map((precision) => {
          const isSelected = value === precision.id;
          const isDefault = precision.id === DEFAULT_MESH_PRECISION;

          return (
            <button
              key={precision.id}
              type="button"
              onClick={() => onChange(precision.id)}
              disabled={disabled}
              className={cn(
                'relative flex flex-col items-start gap-1 rounded-lg border-2 p-3 text-left transition-all',
                'hover:border-primary/50 hover:bg-accent/50',
                'disabled:cursor-not-allowed disabled:opacity-50',
                isSelected
                  ? 'border-primary bg-primary/5'
                  : 'border-border bg-background'
              )}
            >
              {/* Precision name with badge */}
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium">{precision.name}</span>
                {precision.badge && (
                  <Badge variant="secondary" className="text-xs px-1.5 py-0">
                    {precision.badge}
                  </Badge>
                )}
              </div>

              {/* Description */}
              <p className="text-xs text-muted-foreground leading-relaxed">
                {precision.description}
              </p>

              {/* Selection indicator */}
              {isSelected && (
                <div className="absolute right-2 top-2 h-2 w-2 rounded-full bg-primary" />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
