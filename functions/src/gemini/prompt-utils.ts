/**
 * Serialize user-controlled text as bounded prompt data.
 * JSON encoding preserves the text while preventing it from blending into
 * surrounding prompt instructions or delimiter blocks.
 */
export function formatPromptData(value: string, maxLength = 2000): string {
  return JSON.stringify(value.trim().slice(0, maxLength));
}
