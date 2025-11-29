'use client';

import { useTranslations } from 'next-intl';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import type { ViewAngle } from '@/types';

// Available angles for AI generation (excluding 'front' which is the uploaded image)
const AVAILABLE_ANGLES: ViewAngle[] = ['back', 'left', 'right', 'top'];

interface AngleSelectorProps {
  selectedAngles: ViewAngle[];
  onChange: (angles: ViewAngle[]) => void;
  disabled?: boolean;
}

/**
 * Checkbox group for selecting which view angles to generate via AI
 *
 * The 'front' view is always the uploaded image, so it's not included here.
 * Users can select from: back, left, right, top
 */
export function AngleSelector({
  selectedAngles,
  onChange,
  disabled = false,
}: AngleSelectorProps) {
  const t = useTranslations('upload.viewAngles');

  const handleToggle = (angle: ViewAngle) => {
    if (selectedAngles.includes(angle)) {
      onChange(selectedAngles.filter((a) => a !== angle));
    } else {
      onChange([...selectedAngles, angle]);
    }
  };

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {AVAILABLE_ANGLES.map((angle) => (
          <div
            key={angle}
            className={`
              flex items-center space-x-2 rounded-lg border p-3 transition-colors
              ${selectedAngles.includes(angle)
                ? 'border-primary bg-primary/5'
                : 'border-border hover:border-primary/50'}
              ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
            `}
            onClick={() => !disabled && handleToggle(angle)}
          >
            <Checkbox
              id={`angle-${angle}`}
              checked={selectedAngles.includes(angle)}
              onCheckedChange={() => handleToggle(angle)}
              disabled={disabled}
            />
            <Label
              htmlFor={`angle-${angle}`}
              className={`text-sm font-medium ${disabled ? 'cursor-not-allowed' : 'cursor-pointer'}`}
            >
              {t(angle)}
            </Label>
          </div>
        ))}
      </div>

      {selectedAngles.length === 0 && (
        <p className="text-sm text-muted-foreground">
          請至少選擇一個視角
        </p>
      )}
    </div>
  );
}

export { AVAILABLE_ANGLES };
