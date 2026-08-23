/**
 * Serialize user-controlled text as bounded prompt data.
 * JSON encoding preserves the text while preventing it from blending into
 * surrounding prompt instructions or delimiter blocks.
 */
export declare function formatPromptData(value: string, maxLength?: number): string;
