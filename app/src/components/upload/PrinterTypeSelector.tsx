'use client';

import { PRINTER_TYPE_OPTIONS, type PrinterType } from '@/types';

interface PrinterTypeSelectorProps {
  value: PrinterType;
  onChange: (printerType: PrinterType) => void;
  disabled?: boolean;
}

// Icon components for each printer type
const PrinterIcon = ({ type }: { type: PrinterType }) => {
  switch (type) {
    case 'fdm':
      return (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
            d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
          />
        </svg>
      );
    case 'sla':
      return (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
            d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"
          />
        </svg>
      );
    case 'resin':
      return (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
            d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z"
          />
        </svg>
      );
    default:
      return null;
  }
};

export function PrinterTypeSelector({ value, onChange, disabled }: PrinterTypeSelectorProps) {
  const options = Object.entries(PRINTER_TYPE_OPTIONS) as [PrinterType, typeof PRINTER_TYPE_OPTIONS[PrinterType]][];

  return (
    <div className="space-y-3">
      <label className="block text-sm font-medium text-gray-700">
        列印機類型
      </label>
      <p className="text-xs text-gray-500">
        根據列印機類型自動選擇最佳材質設定
      </p>

      <div className="grid grid-cols-3 gap-3">
        {options.map(([key, option]) => {
          const isSelected = value === key;

          return (
            <button
              key={key}
              type="button"
              onClick={() => onChange(key)}
              disabled={disabled}
              className={`
                relative rounded-lg border-2 p-3 text-center transition-all
                ${isSelected
                  ? 'border-indigo-600 bg-indigo-50 ring-1 ring-indigo-600'
                  : 'border-gray-200 bg-white hover:border-gray-300'
                }
                ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
              `}
            >
              {/* Selection indicator */}
              {isSelected && (
                <div className="absolute top-2 right-2 w-3 h-3 rounded-full bg-indigo-600">
                  <svg className="w-full h-full text-white" fill="currentColor" viewBox="0 0 20 20">
                    <path
                      fillRule="evenodd"
                      d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                      clipRule="evenodd"
                    />
                  </svg>
                </div>
              )}

              {/* Icon */}
              <div
                className={`
                  mx-auto w-10 h-10 rounded-full flex items-center justify-center mb-2
                  ${isSelected ? 'bg-indigo-100 text-indigo-600' : 'bg-gray-100 text-gray-500'}
                `}
              >
                <PrinterIcon type={key} />
              </div>

              {/* Content */}
              <h3
                className={`font-medium text-sm ${isSelected ? 'text-indigo-900' : 'text-gray-900'}`}
              >
                {option.label}
              </h3>
              <p className="text-xs text-gray-500 mt-0.5">{option.description}</p>

              {/* Material badge */}
              <div
                className={`
                  mt-2 inline-block px-2 py-0.5 rounded-full text-xs
                  ${isSelected
                    ? 'bg-indigo-100 text-indigo-700'
                    : 'bg-gray-100 text-gray-600'
                  }
                `}
              >
                {option.material}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
