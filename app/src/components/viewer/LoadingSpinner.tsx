'use client';

interface LoadingSpinnerProps {
  message?: string;
  progress?: number;
}

/**
 * Loading spinner with optional progress indicator
 */
export function LoadingSpinner({ message, progress }: LoadingSpinnerProps) {
  return (
    <div className="flex flex-col items-center justify-center p-8">
      {/* Spinner */}
      <div className="relative w-16 h-16">
        {/* Background ring */}
        <div className="absolute inset-0 border-4 border-gray-200 rounded-full" />

        {/* Spinning ring */}
        <div className="absolute inset-0 border-4 border-transparent border-t-indigo-600 rounded-full animate-spin" />

        {/* Progress in center */}
        {progress !== undefined && (
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-sm font-medium text-gray-700">
              {Math.round(progress)}%
            </span>
          </div>
        )}
      </div>

      {/* Message */}
      {message && (
        <p className="mt-4 text-sm text-gray-600">{message}</p>
      )}

      {/* Progress bar (if progress provided) */}
      {progress !== undefined && (
        <div className="mt-4 w-48 h-1.5 bg-gray-200 rounded-full overflow-hidden">
          <div
            className="h-full bg-indigo-600 transition-all duration-300 ease-out"
            style={{ width: `${progress}%` }}
          />
        </div>
      )}
    </div>
  );
}
