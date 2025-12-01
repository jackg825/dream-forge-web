/**
 * Error Classification System for Dream Forge
 *
 * Provides user-friendly error categorization and recovery guidance
 * for the 3D model generation pipeline.
 */

/**
 * Error categories for classification
 */
export type ErrorCategory =
  | 'network'      // Connection issues, timeouts
  | 'rate_limit'   // API rate limiting (429)
  | 'safety'       // Content filtered by AI safety systems
  | 'validation'   // Invalid input (bad image, unsupported format)
  | 'resource'     // Insufficient credits, quota exceeded
  | 'service'      // External service errors (Gemini, Meshy)
  | 'internal';    // Unexpected system errors

/**
 * Error severity levels
 */
export type ErrorSeverity = 'warning' | 'error' | 'critical';

/**
 * Recovery action types
 */
export type RecoveryActionType =
  | 'retry'           // Retry the same operation
  | 'retry_batch'     // Switch to batch mode and retry
  | 'wait'            // Wait and retry later
  | 'change_input'    // Change input image
  | 'purchase'        // Purchase more credits
  | 'contact_support' // Contact support
  | 'resume';         // Resume from history page

/**
 * Recovery action configuration
 */
export interface RecoveryAction {
  type: RecoveryActionType;
  label: string;           // Chinese button label
  description: string;     // Chinese explanation
  primary?: boolean;       // Is this the primary action?
  waitTimeMs?: number;     // Suggested wait time for 'wait' type
}

/**
 * Categorized error with user-friendly messaging
 */
export interface CategorizedError {
  category: ErrorCategory;
  severity: ErrorSeverity;
  code: string;                     // e.g., 'GEMINI_TIMEOUT', 'MESHY_RATE_LIMIT'
  userMessage: string;              // Chinese user-facing message
  technicalMessage: string;         // English technical details (for debugging)
  recoveryActions: RecoveryAction[];
  retryable: boolean;
  suggestedRetryDelayMs?: number;   // Suggested delay before retry
}

/**
 * Error code definitions
 */
export const ERROR_CODES = {
  // Network errors
  NETWORK_TIMEOUT: 'NETWORK_TIMEOUT',
  NETWORK_CONNECTION: 'NETWORK_CONNECTION',

  // Rate limit errors
  GEMINI_RATE_LIMIT: 'GEMINI_RATE_LIMIT',
  MESHY_RATE_LIMIT: 'MESHY_RATE_LIMIT',

  // Safety errors
  CONTENT_FILTERED: 'CONTENT_FILTERED',
  SAFETY_BLOCKED: 'SAFETY_BLOCKED',

  // Validation errors
  INVALID_IMAGE: 'INVALID_IMAGE',
  IMAGE_TOO_LARGE: 'IMAGE_TOO_LARGE',
  UNSUPPORTED_FORMAT: 'UNSUPPORTED_FORMAT',

  // Resource errors
  INSUFFICIENT_CREDITS: 'INSUFFICIENT_CREDITS',
  QUOTA_EXCEEDED: 'QUOTA_EXCEEDED',

  // Service errors
  GEMINI_SERVICE_ERROR: 'GEMINI_SERVICE_ERROR',
  MESHY_SERVICE_ERROR: 'MESHY_SERVICE_ERROR',
  STORAGE_ERROR: 'STORAGE_ERROR',

  // Internal errors
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  UNKNOWN_ERROR: 'UNKNOWN_ERROR',
} as const;

export type ErrorCode = typeof ERROR_CODES[keyof typeof ERROR_CODES];

/**
 * Error category display information
 */
export const ERROR_CATEGORY_INFO: Record<ErrorCategory, {
  label: string;
  icon: string;
  color: string;
}> = {
  network: {
    label: '網路問題',
    icon: 'Wifi',
    color: 'amber',
  },
  rate_limit: {
    label: '系統繁忙',
    icon: 'Clock',
    color: 'amber',
  },
  safety: {
    label: '內容限制',
    icon: 'ShieldAlert',
    color: 'orange',
  },
  validation: {
    label: '輸入錯誤',
    icon: 'ImageOff',
    color: 'red',
  },
  resource: {
    label: '資源不足',
    icon: 'CreditCard',
    color: 'red',
  },
  service: {
    label: '服務錯誤',
    icon: 'ServerCrash',
    color: 'red',
  },
  internal: {
    label: '系統錯誤',
    icon: 'AlertTriangle',
    color: 'red',
  },
};

/**
 * Pipeline step display names (Chinese)
 */
export const PIPELINE_STEP_LABELS: Record<string, string> = {
  'draft': '準備中',
  'generating-images': '生成視角圖片',
  'images-ready': '圖片預覽',
  'generating-mesh': '生成 3D 網格',
  'mesh-ready': '網格預覽',
  'generating-texture': '生成貼圖',
  'completed': '完成',
  'failed': '失敗',
  // Batch statuses (future)
  'batch-queued': '批次排隊中',
  'batch-processing': '批次處理中',
};

/**
 * Default recovery actions by category
 */
export const DEFAULT_RECOVERY_ACTIONS: Record<ErrorCategory, RecoveryAction[]> = {
  network: [
    {
      type: 'retry',
      label: '重試',
      description: '重新嘗試此操作',
      primary: true,
    },
    {
      type: 'retry_batch',
      label: '切換批次處理',
      description: '使用批次模式處理，更穩定',
    },
  ],
  rate_limit: [
    {
      type: 'wait',
      label: '稍後重試',
      description: '等待 1-2 分鐘後再試',
      waitTimeMs: 60000,
      primary: true,
    },
    {
      type: 'retry_batch',
      label: '切換批次處理',
      description: '使用批次模式可避免速率限制',
    },
  ],
  safety: [
    {
      type: 'change_input',
      label: '更換圖片',
      description: 'AI 安全系統判定此圖片不適合處理，請嘗試其他圖片',
      primary: true,
    },
  ],
  validation: [
    {
      type: 'change_input',
      label: '更換圖片',
      description: '請上傳有效的圖片檔案',
      primary: true,
    },
  ],
  resource: [
    {
      type: 'purchase',
      label: '購買點數',
      description: '前往購買更多點數',
      primary: true,
    },
  ],
  service: [
    {
      type: 'retry',
      label: '重試',
      description: '服務暫時異常，請稍後重試',
      primary: true,
    },
    {
      type: 'resume',
      label: '稍後繼續',
      description: '可從歷史紀錄頁面繼續',
    },
  ],
  internal: [
    {
      type: 'retry',
      label: '重試',
      description: '發生未預期的錯誤，請重試',
      primary: true,
    },
    {
      type: 'contact_support',
      label: '聯繫支援',
      description: '如果問題持續發生，請聯繫我們',
    },
  ],
};

/**
 * Error classification patterns
 * Used to match raw error strings to categorized errors
 */
export interface ErrorPattern {
  pattern: RegExp;
  category: ErrorCategory;
  code: ErrorCode;
  severity: ErrorSeverity;
  userMessage: string;
  retryable: boolean;
  suggestedRetryDelayMs?: number;
  recoveryActions?: RecoveryAction[];
}

export const ERROR_PATTERNS: ErrorPattern[] = [
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
    userMessage: '網路連線失敗，請檢查網路狀態',
    retryable: true,
    suggestedRetryDelayMs: 5000,
  },

  // Rate limit errors
  {
    pattern: /rate.?limit|429|too many requests|quota/i,
    category: 'rate_limit',
    code: 'GEMINI_RATE_LIMIT',
    severity: 'warning',
    userMessage: '系統繁忙，請求次數過多',
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
    userMessage: '圖片檔案太大，請壓縮後重試',
    retryable: false,
  },

  // Resource errors
  {
    pattern: /insufficient.?credits|not enough credits|credits.*required/i,
    category: 'resource',
    code: 'INSUFFICIENT_CREDITS',
    severity: 'error',
    userMessage: '點數不足，無法繼續',
    retryable: false,
  },

  // Service errors
  {
    pattern: /gemini.*(error|fail)|google.*(error|fail)/i,
    category: 'service',
    code: 'GEMINI_SERVICE_ERROR',
    severity: 'error',
    userMessage: 'AI 圖片生成服務暫時異常',
    retryable: true,
    suggestedRetryDelayMs: 10000,
  },
  {
    pattern: /meshy.*(error|fail)|mesh.*(generation|processing).*(fail|error)/i,
    category: 'service',
    code: 'MESHY_SERVICE_ERROR',
    severity: 'error',
    userMessage: '3D 模型生成服務暫時異常',
    retryable: true,
    suggestedRetryDelayMs: 10000,
  },
  {
    pattern: /storage.*(error|fail)|upload.*(error|fail)/i,
    category: 'service',
    code: 'STORAGE_ERROR',
    severity: 'error',
    userMessage: '檔案儲存失敗',
    retryable: true,
    suggestedRetryDelayMs: 5000,
  },

  // 500 errors (catch-all for server errors)
  {
    pattern: /500|internal.?server.?error|server.*error/i,
    category: 'service',
    code: 'GEMINI_SERVICE_ERROR',
    severity: 'error',
    userMessage: '伺服器發生錯誤，請稍後重試',
    retryable: true,
    suggestedRetryDelayMs: 5000,
  },
];

/**
 * Classify a raw error string into a categorized error
 */
export function classifyError(
  rawError: string,
  errorStep?: string,
  additionalContext?: Record<string, unknown>
): CategorizedError {
  // Try to match against known patterns
  for (const pattern of ERROR_PATTERNS) {
    if (pattern.pattern.test(rawError)) {
      return {
        category: pattern.category,
        severity: pattern.severity,
        code: pattern.code,
        userMessage: pattern.userMessage,
        technicalMessage: rawError,
        recoveryActions: pattern.recoveryActions ?? DEFAULT_RECOVERY_ACTIONS[pattern.category],
        retryable: pattern.retryable,
        suggestedRetryDelayMs: pattern.suggestedRetryDelayMs,
      };
    }
  }

  // Default to internal error for unmatched patterns
  return {
    category: 'internal',
    severity: 'error',
    code: 'UNKNOWN_ERROR',
    userMessage: '發生未預期的錯誤',
    technicalMessage: rawError,
    recoveryActions: DEFAULT_RECOVERY_ACTIONS.internal,
    retryable: true,
    suggestedRetryDelayMs: 3000,
  };
}

/**
 * Get step label in Chinese
 */
export function getStepLabel(step?: string): string {
  if (!step) return '';
  return PIPELINE_STEP_LABELS[step] ?? step;
}

/**
 * Format error for display
 */
export function formatErrorDisplay(
  error: string | null | undefined,
  errorStep?: string | null
): {
  categorized: CategorizedError;
  stepLabel: string;
  fullMessage: string;
} | null {
  if (!error) return null;

  const categorized = classifyError(error, errorStep ?? undefined);
  const stepLabel = getStepLabel(errorStep ?? undefined);
  const fullMessage = stepLabel
    ? `${stepLabel}時發生錯誤：${categorized.userMessage}`
    : categorized.userMessage;

  return {
    categorized,
    stepLabel,
    fullMessage,
  };
}
