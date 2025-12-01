'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  AlertCircle,
  ChevronDown,
  ChevronUp,
  Clock,
  CreditCard,
  ImageOff,
  Loader2,
  RefreshCw,
  ServerCrash,
  ShieldAlert,
  Wifi,
  ExternalLink,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
  type CategorizedError,
  type ErrorCategory,
  type RecoveryAction,
  formatErrorDisplay,
  ERROR_CATEGORY_INFO,
} from '@/types/errors';
import type { Pipeline, PipelineStatus } from '@/types';

interface PipelineErrorStateProps {
  pipeline: Pipeline | null;
  error?: string | null;
  onRetry: () => Promise<void>;
  onReset: () => void;
  isRetrying?: boolean;
}

/**
 * Icon mapping for error categories
 */
const CategoryIcon: Record<ErrorCategory, React.ComponentType<{ className?: string }>> = {
  network: Wifi,
  rate_limit: Clock,
  safety: ShieldAlert,
  validation: ImageOff,
  resource: CreditCard,
  service: ServerCrash,
  internal: AlertCircle,
};

/**
 * Color classes for error categories
 */
const CategoryColors: Record<ErrorCategory, {
  bg: string;
  text: string;
  badge: string;
}> = {
  network: {
    bg: 'bg-amber-100 dark:bg-amber-950',
    text: 'text-amber-600 dark:text-amber-400',
    badge: 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-300',
  },
  rate_limit: {
    bg: 'bg-amber-100 dark:bg-amber-950',
    text: 'text-amber-600 dark:text-amber-400',
    badge: 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-300',
  },
  safety: {
    bg: 'bg-orange-100 dark:bg-orange-950',
    text: 'text-orange-600 dark:text-orange-400',
    badge: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-300',
  },
  validation: {
    bg: 'bg-red-100 dark:bg-red-950',
    text: 'text-red-600 dark:text-red-400',
    badge: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300',
  },
  resource: {
    bg: 'bg-red-100 dark:bg-red-950',
    text: 'text-red-600 dark:text-red-400',
    badge: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300',
  },
  service: {
    bg: 'bg-red-100 dark:bg-red-950',
    text: 'text-red-600 dark:text-red-400',
    badge: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300',
  },
  internal: {
    bg: 'bg-red-100 dark:bg-red-950',
    text: 'text-red-600 dark:text-red-400',
    badge: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300',
  },
};

/**
 * Check if error step is retryable
 */
function isRetryableStep(errorStep?: PipelineStatus): boolean {
  return (
    errorStep === 'generating-images' ||
    errorStep === 'generating-mesh' ||
    errorStep === 'generating-texture'
  );
}

/**
 * PipelineErrorState component
 *
 * Displays classified error information with:
 * - Category-specific icon and coloring
 * - User-friendly error message
 * - Failed step indication
 * - Recovery action buttons
 * - Collapsible technical details
 */
export function PipelineErrorState({
  pipeline,
  error,
  onRetry,
  onReset,
  isRetrying = false,
}: PipelineErrorStateProps) {
  const router = useRouter();
  const [showDetails, setShowDetails] = useState(false);

  // Get error info
  const rawError = error || pipeline?.error;
  const errorStep = pipeline?.errorStep;
  const errorDisplay = formatErrorDisplay(rawError, errorStep);

  if (!errorDisplay) {
    // Fallback for null error
    return (
      <div className="flex flex-col items-center justify-center py-16">
        <div className="bg-destructive/10 p-4 rounded-full mb-4">
          <AlertCircle className="h-10 w-10 text-destructive" />
        </div>
        <p className="text-lg font-medium mb-2">發生錯誤</p>
        <p className="text-sm text-muted-foreground mb-6">請重試或重新開始</p>
        <div className="flex gap-4">
          <Button variant="outline" onClick={onReset}>
            重新開始
          </Button>
        </div>
      </div>
    );
  }

  const { categorized, stepLabel, fullMessage } = errorDisplay;
  const Icon = CategoryIcon[categorized.category];
  const colors = CategoryColors[categorized.category];
  const categoryInfo = ERROR_CATEGORY_INFO[categorized.category];
  const canRetry = categorized.retryable && isRetryableStep(errorStep);

  // Handle recovery action clicks
  const handleRecoveryAction = async (action: RecoveryAction) => {
    switch (action.type) {
      case 'retry':
        await onRetry();
        break;
      case 'retry_batch':
        // TODO: Implement batch mode switch
        await onRetry();
        break;
      case 'wait':
        // Show wait message, could add a timer
        break;
      case 'change_input':
        onReset();
        break;
      case 'purchase':
        router.push('/pricing');
        break;
      case 'contact_support':
        window.open('mailto:support@dreamforge.com', '_blank');
        break;
      case 'resume':
        router.push('/dashboard/history');
        break;
      default:
        break;
    }
  };

  return (
    <div className="flex flex-col items-center justify-center py-12">
      {/* Icon */}
      <div className={`p-4 rounded-full mb-4 ${colors.bg}`}>
        <Icon className={`h-10 w-10 ${colors.text}`} />
      </div>

      {/* Category badge */}
      <Badge variant="secondary" className={`mb-3 ${colors.badge}`}>
        {categoryInfo.label}
      </Badge>

      {/* Main error message */}
      <p className="text-lg font-medium mb-2 text-center">
        {categorized.userMessage}
      </p>

      {/* Step info */}
      {stepLabel && (
        <p className="text-sm text-muted-foreground text-center mb-1">
          失敗步驟：{stepLabel}
        </p>
      )}

      {/* Severity indicator for non-retryable errors */}
      {!categorized.retryable && (
        <p className="text-xs text-muted-foreground mb-4">
          此錯誤無法自動恢復
        </p>
      )}

      {/* Recovery actions */}
      <div className="flex flex-wrap justify-center gap-3 mt-4 mb-4">
        {/* Primary: Retry button if retryable */}
        {canRetry && (
          <Button
            onClick={onRetry}
            disabled={isRetrying}
            variant="default"
          >
            {isRetrying ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                重試中...
              </>
            ) : (
              <>
                <RefreshCw className="mr-2 h-4 w-4" />
                重試
              </>
            )}
          </Button>
        )}

        {/* Category-specific actions */}
        {categorized.recoveryActions
          .filter((action) => {
            // Skip retry if we already show it
            if (action.type === 'retry' && canRetry) return false;
            // Skip certain actions based on context
            if (action.type === 'retry_batch') return true; // TODO: Enable when batch mode is ready
            return true;
          })
          .slice(0, 2) // Limit to 2 additional actions
          .map((action, idx) => (
            <Button
              key={idx}
              variant={action.primary && !canRetry ? 'default' : 'outline'}
              onClick={() => handleRecoveryAction(action)}
              disabled={isRetrying}
            >
              {action.type === 'purchase' && <CreditCard className="mr-2 h-4 w-4" />}
              {action.type === 'resume' && <ExternalLink className="mr-2 h-4 w-4" />}
              {action.label}
            </Button>
          ))}

        {/* Always show reset */}
        <Button
          variant="outline"
          onClick={onReset}
          disabled={isRetrying}
        >
          重新開始
        </Button>
      </div>

      {/* Collapsible technical details */}
      <Collapsible open={showDetails} onOpenChange={setShowDetails}>
        <CollapsibleTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className="text-muted-foreground hover:text-foreground"
          >
            {showDetails ? (
              <>
                <ChevronUp className="mr-1 h-4 w-4" />
                隱藏技術詳情
              </>
            ) : (
              <>
                <ChevronDown className="mr-1 h-4 w-4" />
                查看技術詳情
              </>
            )}
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent className="mt-3">
          <div className="bg-muted/50 rounded-lg p-4 text-xs font-mono max-w-md">
            <div className="space-y-1 text-muted-foreground">
              <p><span className="font-semibold">錯誤代碼：</span>{categorized.code}</p>
              <p><span className="font-semibold">類別：</span>{categorized.category}</p>
              <p><span className="font-semibold">可重試：</span>{categorized.retryable ? '是' : '否'}</p>
              {errorStep && <p><span className="font-semibold">失敗步驟：</span>{errorStep}</p>}
              <p className="break-all">
                <span className="font-semibold">原始錯誤：</span>
                {categorized.technicalMessage}
              </p>
            </div>
          </div>
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}
