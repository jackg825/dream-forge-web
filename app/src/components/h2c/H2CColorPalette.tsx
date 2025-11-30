'use client';

interface H2CColorPaletteProps {
  colors: string[];
  size?: 'sm' | 'md' | 'lg';
}

/**
 * Display the 7-color palette extracted from the optimized image
 */
export function H2CColorPalette({ colors, size = 'md' }: H2CColorPaletteProps) {
  if (colors.length === 0) return null;

  const sizeClasses = {
    sm: 'w-6 h-6',
    md: 'w-8 h-8',
    lg: 'w-10 h-10',
  };

  return (
    <div className="space-y-2">
      <p className="text-sm text-muted-foreground">
        七色調色盤 ({colors.length} 色)
      </p>
      <div className="flex gap-2 flex-wrap">
        {colors.map((color, index) => (
          <div
            key={`${color}-${index}`}
            className="flex flex-col items-center gap-1"
          >
            <div
              className={`${sizeClasses[size]} rounded-md border border-border shadow-sm`}
              style={{ backgroundColor: color }}
              title={color}
            />
            <span className="text-xs font-mono text-muted-foreground">
              {color}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
