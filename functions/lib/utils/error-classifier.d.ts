/**
 * Error Classification System for Dream Forge Backend
 *
 * Classifies raw error messages into categorized errors with
 * user-friendly messages and recovery suggestions.
 *
 * This mirrors the frontend types but is used in Cloud Functions
 * to enrich error information before storing in Firestore.
 */
/**
 * Error categories
 */
export type ErrorCategory = 'network' | 'rate_limit' | 'safety' | 'validation' | 'resource' | 'service' | 'internal';
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
 * Classify a raw error into a categorized error
 */
export declare function classifyError(error: unknown): ClassifiedError;
/**
 * Extract error message from various error types
 */
export declare function extractErrorMessage(error: unknown): string;
/**
 * Create a user-friendly error message for Firestore storage
 */
export declare function createErrorForStorage(error: unknown, context?: {
    step?: string;
    operation?: string;
}): {
    error: string;
    errorCategory: ErrorCategory;
    errorCode: string;
    errorRetryable: boolean;
};
/**
 * Determine if an error should be retried automatically
 */
export declare function shouldAutoRetry(error: unknown, currentRetryCount: number, maxRetries?: number): {
    shouldRetry: boolean;
    delayMs: number;
};
