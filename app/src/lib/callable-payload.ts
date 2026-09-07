/**
 * Firebase callable encoding turns explicit undefined values into null. Omit
 * absent object fields before encoding so optional server arguments stay absent.
 * Keep explicit nulls and array positions unchanged.
 */
export function omitUndefinedFields<T>(value: T): T {
  if (Array.isArray(value)) {
    return value.map(omitUndefinedFields) as T;
  }
  if (typeof value === 'object' && value !== null && Object.prototype.toString.call(value) === '[object Object]') {
    return Object.fromEntries(
      Object.entries(value)
        .filter(([, field]) => field !== undefined)
        .map(([key, field]) => [key, omitUndefinedFields(field)])
    ) as T;
  }
  return value;
}
