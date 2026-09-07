import * as functions from 'firebase-functions/v1';

export function assertRecord(value: unknown, field = 'Request'): asserts value is Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new functions.https.HttpsError('invalid-argument', `${field} must be an object`);
  }
}

export function assertDocumentId(value: unknown, field: string): asserts value is string {
  if (typeof value !== 'string' || !value.trim() || value.length > 128 || value.includes('/') || value === '.' || value === '..') {
    throw new functions.https.HttpsError('invalid-argument', `${field} must be a valid document ID`);
  }
}

export function validateCreditAmount(amount: unknown): asserts amount is number {
  if (!Number.isSafeInteger(amount) || (amount as number) <= 0) {
    throw new functions.https.HttpsError('invalid-argument', 'Amount must be a positive safe integer');
  }
}

export function validateReason(reason: unknown, required = false): string | undefined {
  if (reason === undefined && !required) return undefined;
  if (typeof reason !== 'string' || reason.length > 1000 || (required && !reason.trim())) {
    throw new functions.https.HttpsError('invalid-argument', 'Reason must be text of at most 1000 characters and is required for deductions');
  }
  return reason.trim() || undefined;
}

export function readCreditBalance(value: unknown): number {
  const credits = value ?? 0;
  if (!Number.isSafeInteger(credits) || (credits as number) < 0) {
    throw new functions.https.HttpsError('failed-precondition', 'User credit balance is invalid');
  }
  return credits as number;
}

export function validatePreviewTarget(target: unknown, angle: unknown, allowAll = false): void {
  if (target !== 'mesh' && target !== 'meshImages' && !(allowAll && target === 'all')) {
    throw new functions.https.HttpsError('invalid-argument', 'Invalid preview target');
  }
  if (target === 'meshImages' && !['front', 'back', 'left', 'right'].includes(angle as string)) {
    throw new functions.https.HttpsError('invalid-argument', 'A valid mesh angle is required');
  }
}


/** Older callable clients serialize optional undefined properties as null. */
export function normalizeCallableData<T>(data: T): T {
  assertRecord(data);
  const omitNullFields = (value: unknown): unknown => {
    if (Array.isArray(value)) return value.map(omitNullFields);
    if (value && typeof value === 'object') {
      return Object.fromEntries(Object.entries(value)
        .filter(([, field]) => field !== null && field !== undefined)
        .map(([key, field]) => [key, omitNullFields(field)]));
    }
    return value;
  };
  return omitNullFields(data) as T;
}
