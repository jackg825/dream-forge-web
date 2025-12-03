"use strict";
/**
 * Error Classification System for Dream Forge Backend
 *
 * Classifies raw error messages into categorized errors with
 * user-friendly messages and recovery suggestions.
 *
 * This mirrors the frontend types but is used in Cloud Functions
 * to enrich error information before storing in Firestore.
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.classifyError = classifyError;
exports.extractErrorMessage = extractErrorMessage;
exports.createErrorForStorage = createErrorForStorage;
exports.shouldAutoRetry = shouldAutoRetry;
const functions = __importStar(require("firebase-functions/v1"));
const ERROR_PATTERNS = [
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
    // Rate limit errors - provider specific patterns first
    {
        pattern: /hunyuan.*rate.?limit|tencent.*rate.?limit/i,
        category: 'rate_limit',
        code: 'HUNYUAN_RATE_LIMIT',
        severity: 'warning',
        userMessage: 'Hunyuan 3D 服務繁忙，請稍後重試',
        retryable: true,
        suggestedRetryDelayMs: 60000,
    },
    {
        pattern: /tripo.*rate.?limit/i,
        category: 'rate_limit',
        code: 'TRIPO_RATE_LIMIT',
        severity: 'warning',
        userMessage: 'Tripo3D 服務繁忙，請稍後重試',
        retryable: true,
        suggestedRetryDelayMs: 60000,
    },
    {
        pattern: /meshy.*rate.?limit/i,
        category: 'rate_limit',
        code: 'MESHY_RATE_LIMIT',
        severity: 'warning',
        userMessage: 'Meshy 服務繁忙，請稍後重試',
        retryable: true,
        suggestedRetryDelayMs: 60000,
    },
    // Generic rate limit (fallback)
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
    // Service errors - Hunyuan (must be before generic mesh error)
    {
        pattern: /hunyuan.*(error|fail)|tencent.*(cloud)?.*(error|fail)|ai3d.*(error|fail)|AuthFailure/i,
        category: 'service',
        code: 'HUNYUAN_SERVICE_ERROR',
        severity: 'error',
        userMessage: 'Hunyuan 3D 服務暫時異常',
        retryable: true,
        suggestedRetryDelayMs: 10000,
    },
    // Service errors - Tripo (must be before generic mesh error)
    {
        pattern: /tripo.*(error|fail)|tripo3d.*(error|fail)/i,
        category: 'service',
        code: 'TRIPO_SERVICE_ERROR',
        severity: 'error',
        userMessage: 'Tripo3D 服務暫時異常',
        retryable: true,
        suggestedRetryDelayMs: 10000,
    },
    // Service errors - Meshy (only matches explicit "meshy" keyword)
    {
        pattern: /meshy.*(error|fail)/i,
        category: 'service',
        code: 'MESHY_SERVICE_ERROR',
        severity: 'error',
        userMessage: 'Meshy 3D 服務暫時異常',
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
function classifyError(error) {
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
function extractErrorMessage(error) {
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
        const axiosError = error;
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
        const obj = error;
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
function isAxiosError(error) {
    return (typeof error === 'object' &&
        error !== null &&
        'isAxiosError' in error &&
        error.isAxiosError === true);
}
/**
 * Create a user-friendly error message for Firestore storage
 */
function createErrorForStorage(error, context) {
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
function shouldAutoRetry(error, currentRetryCount, maxRetries = 3) {
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
//# sourceMappingURL=error-classifier.js.map