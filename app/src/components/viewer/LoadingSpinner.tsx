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
      <div className="relative h-11 w-11">
        {/* Background ring */}
        <div className="absolute inset-0 rounded-full border-[3px] border-border" />

        {/* Spinning ring */}
        <div className="absolute inset-0 animate-spin rounded-full border-[3px] border-transparent border-t-primary" />

        {/* Progress in center */}
        {progress !== undefined && (
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-xs font-medium text-foreground">
              {Math.round(progress)}%
            </span>
          </div>
        )}
      </div>

      {/* Message */}
      {message && (
        <p className="mt-5 text-sm text-muted-foreground">{message}</p>
      )}

      {/* Progress bar (if progress provided) */}
      {progress !== undefined && (
        <div className="mt-5 h-1 w-48 overflow-hidden rounded-full bg-muted">
          <div
            className="h-full bg-primary transition-all duration-300 ease-out"
            style={{ width: `${progress}%` }}
          />
        </div>
      )}
    </div>
  );
}
