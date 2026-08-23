"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.formatPromptData = formatPromptData;
/**
 * Serialize user-controlled text as bounded prompt data.
 * JSON encoding preserves the text while preventing it from blending into
 * surrounding prompt instructions or delimiter blocks.
 */
function formatPromptData(value, maxLength = 2000) {
    return JSON.stringify(value.trim().slice(0, maxLength));
}
//# sourceMappingURL=prompt-utils.js.map