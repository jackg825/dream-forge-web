/**
 * Error Classification System for Dream Forge Backend
 *
 * Classifies raw error messages into categorized errors with
 * user-friendly messages and recovery suggestions.
 *
 * This mirrors the frontend types but is used in Cloud Functions
 * to enrich error information before storing in Firestore.
 */

import * as functions from 'firebase-functions/v1';

/**
 * Error categories
 */
export type ErrorCategory =
  | 'network'
  | 'rate_limit'
  | 'safety'
  | 'validation'
  | 'resource'
  | 'service'
  | 'internal';

/**
 * Error severity
 */
export type ErrorSeverity = 'warning' | 'error' | 'critical';

/**
 * Classified error result
 */
export interface ClassifiedError {
  category: ErrorCategory;
  severity: ErrorSeverity;
  code: string;
  userMessage: string;
  technicalMessage: string;
  retryable: boolean;
  suggestedRetryDelayMs?: number;
}

/**
 * Error patterns for classification
 */
interface ErrorPattern {
  pattern: RegExp;
  category: ErrorCategory;
  code: string;
  severity: ErrorSeverity;
  userMessage: string;
  retryable: boolean;
  suggestedRetryDelayMs?: number;
}

const ERROR_PATTERNS: ErrorPattern[] = [
  // Network errors
  {
    pattern: /timeout|ETIMEDOUT|ECONNRESET|timed?\s*out/i,
    category: 'network',
    code: 'NETWORK_TIMEOUT',
    severity: 'error',
    userMessage: '請求逾時，伺服器回應太慢',
    retryable: true,
    suggestedRetryDelayMs: 3000,
  },
  {
    pattern: /network|ECONNREFUSED|ENOTFOUND|connection/i,
    category: 'network',
    code: 'NETWORK_CONNECTION',
    severity: 'error',
    userMessage: '網路連線失敗',
    retryable: true,
    suggestedRetryDelayMs: 5000,
  },

  // Rate limit errors
  {
    pattern: /rate.?limit|429|too many requests|quota.*exceeded/i,
    category: 'rate_limit',
    code: 'RATE_LIMITED',
    severity: 'warning',
    userMessage: '系統繁忙，請稍後重試',
    retryable: true,
    suggestedRetryDelayMs: 60000,
  },

  // Safety errors
  {
    pattern: /blocked.*(safety|filter)|safety.*(block|filter)|HARM_CATEGORY|prompt.*block/i,
    category: 'safety',
    code: 'CONTENT_FILTERED',
    severity: 'warning',
    userMessage: 'AI 安全系統認為此圖片不適合處理',
    retryable: false,
  },
  {
    pattern: /safety|inappropriate|harmful|offensive/i,
    category: 'safety',
    code: 'SAFETY_BLOCKED',
    severity: 'warning',
    userMessage: '圖片內容未通過安全檢查',
    retryable: false,
  },

  // Validation errors
  {
    pattern: /invalid.*(image|file)|unsupported.*(format|type)|not.*valid/i,
    category: 'validation',
    code: 'INVALID_IMAGE',
    severity: 'error',
    userMessage: '圖片格式無效或損壞',
    retryable: false,
  },
  {
    pattern: /too.*(large|big)|size.*exceed|maximum.*size/i,
    category: 'validation',
    code: 'IMAGE_TOO_LARGE',
    severity: 'error',
    userMessage: '圖片檔案太大',
    retryable: false,
  },

  // Resource errors
  {
    pattern: /insufficient.?credits|not enough credits|credits.*required/i,
    category: 'resource',
    code: 'INSUFFICIENT_CREDITS',
    severity: 'error',
    userMessage: '點數不足',
    retryable: false,
  },
  {
    pattern: /resource-exhausted|quota/i,
    category: 'resource',
    code: 'QUOTA_EXCEEDED',
    severity: 'error',
    userMessage: '資源配額已用盡',
    retryable: false,
  },

  // Service errors - Gemini
  {
    pattern: /gemini.*(error|fail)|google.*(error|fail)/i,
    category: 'service',
    code: 'GEMINI_SERVICE_ERROR',
    severity: 'error',
    userMessage: 'AI 圖片生成服務暫時異常',
    retryable: true,
    suggestedRetryDelayMs: 10000,
  },

  // Service errors - Meshy
  {
    pattern: /meshy.*(error|fail)|mesh.*(generation|processing).*(fail|error)/i,
    category: 'service',
    code: 'MESHY_SERVICE_ERROR',
    severity: 'error',
    userMessage: '3D 模型生成服務暫時異常',
    retryable: true,
    suggestedRetryDelayMs: 10000,
  },

  // Service errors - Storage
  {
    pattern: /storage.*(error|fail)|upload.*(error|fail)/i,
    category: 'service',
    code: 'STORAGE_ERROR',
    severity: 'error',
    userMessage: '檔案儲存失敗',
    retryable: true,
    suggestedRetryDelayMs: 5000,
  },

  // Generic 500 errors
  {
    pattern: /500|internal.?server.?error|server.*error/i,
    category: 'service',
    code: 'SERVER_ERROR',
    severity: 'error',
    userMessage: '伺服器發生錯誤',
    retryable: true,
    suggestedRetryDelayMs: 5000,
  },
];

/**
 * Classify a raw error into a categorized error
 */
export function classifyError(error: unknown): ClassifiedError {
  const errorMessage = extractErrorMessage(error);

  // Try to match against known patterns
  for (const pattern of ERROR_PATTERNS) {
    if (pattern.pattern.test(errorMessage)) {
      return {
        category: pattern.category,
        severity: pattern.severity,
        code: pattern.code,
        userMessage: pattern.userMessage,
        technicalMessage: errorMessage,
        retryable: pattern.retryable,
        suggestedRetryDelayMs: pattern.suggestedRetryDelayMs,
      };
    }
  }

  // Default to internal error
  return {
    category: 'internal',
    severity: 'error',
    code: 'UNKNOWN_ERROR',
    userMessage: '發生未預期的錯誤',
    technicalMessage: errorMessage,
    retryable: true,
    suggestedRetryDelayMs: 3000,
  };
}

/**
 * Extract error message from various error types
 */
export function extractErrorMessage(error: unknown): string {
  if (typeof error === 'string') {
    return error;
  }

  if (error instanceof Error) {
    return error.message;
  }

  if (error instanceof functions.https.HttpsError) {
    return error.message;
  }

  // Axios error
  if (isAxiosError(error)) {
    const axiosError = error as {
      response?: { data?: { error?: string; message?: string }; status?: number };
      message?: string;
      code?: string;
    };

    if (axiosError.response?.data?.error) {
      return axiosError.response.data.error;
    }
    if (axiosError.response?.data?.message) {
      return axiosError.response.data.message;
    }
    if (axiosError.code) {
      return `${axiosError.code}: ${axiosError.message || 'Network error'}`;
    }
    if (axiosError.message) {
      return axiosError.message;
    }
  }

  // Generic object with message
  if (typeof error === 'object' && error !== null) {
    const obj = error as Record<string, unknown>;
    if (typeof obj.message === 'string') {
      return obj.message;
    }
    if (typeof obj.error === 'string') {
      return obj.error;
    }
  }

  return 'Unknown error';
}

/**
 * Check if error is an Axios error
 */
function isAxiosError(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'isAxiosError' in error &&
    (error as { isAxiosError: boolean }).isAxiosError === true
  );
}

/**
 * Create a user-friendly error message for Firestore storage
 */
export function createErrorForStorage(
  error: unknown,
  context?: { step?: string; operation?: string }
): {
  error: string;
  errorCategory: ErrorCategory;
  errorCode: string;
  errorRetryable: boolean;
} {
  const classified = classifyError(error);

  // Log for debugging
  functions.logger.error('Pipeline error classified', {
    ...context,
    category: classified.category,
    code: classified.code,
    userMessage: classified.userMessage,
    technicalMessage: classified.technicalMessage,
    retryable: classified.retryable,
  });

  return {
    error: classified.userMessage,
    errorCategory: classified.category,
    errorCode: classified.code,
    errorRetryable: classified.retryable,
  };
}

/**
 * Determine if an error should be retried automatically
 */
export function shouldAutoRetry(
  error: unknown,
  currentRetryCount: number,
  maxRetries: number = 3
): { shouldRetry: boolean; delayMs: number } {
  if (currentRetryCount >= maxRetries) {
    return { shouldRetry: false, delayMs: 0 };
  }

  const classified = classifyError(error);

  if (!classified.retryable) {
    return { shouldRetry: false, delayMs: 0 };
  }

  // Exponential backoff
  const baseDelay = classified.suggestedRetryDelayMs ?? 3000;
  const delayMs = Math.min(baseDelay * Math.pow(2, currentRetryCount), 60000);

  return { shouldRetry: true, delayMs };
}
