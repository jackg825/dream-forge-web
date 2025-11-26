'use client';

import { QUALITY_OPTIONS, type QualityLevel } from '@/types';

interface QualitySelectorProps {
  value: QualityLevel;
  onChange: (quality: QualityLevel) => void;
  disabled?: boolean;
}

export function QualitySelector({ value, onChange, disabled }: QualitySelectorProps) {
  const options = Object.entries(QUALITY_OPTIONS) as [QualityLevel, typeof QUALITY_OPTIONS[QualityLevel]][];

  return (
    <div className="space-y-3">
      <label className="block text-sm font-medium text-gray-700">
        Generation Quality
      </label>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {options.map(([key, option]) => {
          const isSelected = value === key;

          return (
            <button
              key={key}
              type="button"
              onClick={() => onChange(key)}
              disabled={disabled}
              className={`
                relative rounded-lg border-2 p-4 text-left transition-all
                ${isSelected
                  ? 'border-indigo-600 bg-indigo-50 ring-1 ring-indigo-600'
                  : 'border-gray-200 bg-white hover:border-gray-300'
                }
                ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
              `}
            >
              {/* Selection indicator */}
              <div
                className={`
                  absolute top-3 right-3 w-4 h-4 rounded-full border-2
                  ${isSelected ? 'border-indigo-600 bg-indigo-600' : 'border-gray-300'}
                `}
              >
                {isSelected && (
                  <svg
                    className="w-full h-full text-white"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path
                      fillRule="evenodd"
                      d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                      clipRule="evenodd"
                    />
                  </svg>
                )}
              </div>

              {/* Content */}
              <div className="pr-6">
                <h3
                  className={`font-medium ${isSelected ? 'text-indigo-900' : 'text-gray-900'}`}
                >
                  {option.label}
                </h3>
                <p className="mt-1 text-sm text-gray-500">{option.description}</p>

                {/* Stats */}
                <div className="mt-3 flex items-center gap-3 text-xs">
                  <span
                    className={`
                      inline-flex items-center gap-1
                      ${isSelected ? 'text-indigo-700' : 'text-gray-500'}
                    `}
                  >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                      />
                    </svg>
                    {option.time}
                  </span>
                  <span
                    className={`
                      inline-flex items-center gap-1
                      ${isSelected ? 'text-indigo-700' : 'text-gray-500'}
                    `}
                  >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z"
                      />
                    </svg>
                    {option.faces}
                  </span>
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
