'use client';

import { useTranslations } from 'next-intl';
import type { ModelProvider } from '@/types';

interface ProviderSelectorProps {
  value: ModelProvider;
  onChange: (provider: ModelProvider) => void;
  disabled?: boolean;
}

const PROVIDERS: ModelProvider[] = ['meshy', 'rodin'];

export function ProviderSelector({ value, onChange, disabled }: ProviderSelectorProps) {
  const t = useTranslations('upload.provider');

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {PROVIDERS.map((key) => {
          const isSelected = value === key;
          const isRecommended = key === 'meshy';

          return (
            <button
              key={key}
              type="button"
              onClick={() => onChange(key)}
              disabled={disabled}
              className={`
                relative rounded-lg border-2 p-4 text-left transition-all
                ${isSelected
                  ? 'border-indigo-600 bg-indigo-50 dark:bg-indigo-950 ring-1 ring-indigo-600'
                  : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:border-gray-300 dark:hover:border-gray-600'
                }
                ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
              `}
            >
              {/* Badge for recommended */}
              {isRecommended && (
                <span className="absolute -top-2 left-3 px-2 py-0.5 text-xs font-medium bg-indigo-600 text-white rounded-full">
                  {t('recommended')}
                </span>
              )}

              {/* Selection indicator */}
              <div
                className={`
                  absolute top-3 right-3 w-4 h-4 rounded-full border-2
                  ${isSelected ? 'border-indigo-600 bg-indigo-600' : 'border-gray-300 dark:border-gray-600'}
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
              <div className="pr-6 mt-1">
                <h3
                  className={`font-medium ${isSelected ? 'text-indigo-900 dark:text-indigo-100' : 'text-gray-900 dark:text-gray-100'}`}
                >
                  {t(`${key}.label`)}
                </h3>
                <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                  {t(`${key}.description`)}
                </p>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
