export declare function assertRecord(value: unknown, field?: string): asserts value is Record<string, unknown>;
export declare function assertDocumentId(value: unknown, field: string): asserts value is string;
export declare function validateCreditAmount(amount: unknown): asserts amount is number;
export declare function validateReason(reason: unknown, required?: boolean): string | undefined;
export declare function readCreditBalance(value: unknown): number;
export declare function validatePreviewTarget(target: unknown, angle: unknown, allowAll?: boolean): void;
/** Older callable clients serialize optional undefined properties as null. */
export declare function normalizeCallableData<T>(data: T): T;
