"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.IMAGE_ANALYSIS_RESPONSE_SCHEMA = void 0;
exports.parseStructuredImageAnalysis = parseStructuredImageAnalysis;
/** Structured output contract for Gemini image analysis. */
exports.IMAGE_ANALYSIS_RESPONSE_SCHEMA = {
    type: 'OBJECT',
    properties: {
        promptDescription: {
            type: 'STRING',
            description: 'Three to five English narrative sentences for downstream image generation.',
        },
        styleHints: {
            type: 'ARRAY',
            items: { type: 'STRING' },
            description: 'Three to five concise English style hints.',
        },
        description: { type: 'STRING', description: 'Human-readable object description in the requested UI language.' },
        colors: {
            type: 'ARRAY',
            items: { type: 'STRING' },
            description: 'Dominant solid colors as #RRGGBB values.',
        },
        score: { type: 'INTEGER', minimum: 1, maximum: 5 },
        colorSuggestions: { type: 'ARRAY', items: { type: 'STRING' } },
        structuralConcerns: { type: 'ARRAY', items: { type: 'STRING' } },
        materialRecommendations: { type: 'ARRAY', items: { type: 'STRING' } },
        orientationTips: { type: 'ARRAY', items: { type: 'STRING' } },
        materials: { type: 'ARRAY', items: { type: 'STRING' } },
        objectType: { type: 'STRING' },
        earsPresent: { type: 'BOOLEAN' },
        earsDescription: { type: 'STRING' },
        tailPresent: { type: 'BOOLEAN' },
        tailDescription: { type: 'STRING' },
        limbs: { type: 'STRING' },
        accessories: { type: 'ARRAY', items: { type: 'STRING' } },
        distinctiveMarks: { type: 'ARRAY', items: { type: 'STRING' } },
        asymmetricFeatures: { type: 'ARRAY', items: { type: 'STRING' } },
        surfaceTextures: { type: 'ARRAY', items: { type: 'STRING' } },
        detectedView: { type: 'STRING', enum: ['front', 'back', 'left', 'right', 'top'] },
        recommendedStyle: { type: 'STRING', enum: ['bobblehead', 'chibi', 'cartoon', 'emoji'] },
        styleConfidence: { type: 'NUMBER', minimum: 0, maximum: 1 },
        styleReasoning: { type: 'STRING' },
        styleSuitability: { type: 'NUMBER', minimum: 0, maximum: 1 },
        styleSuitabilityReason: { type: 'STRING' },
    },
    required: [
        'promptDescription',
        'styleHints',
        'description',
        'colors',
        'score',
        'colorSuggestions',
        'structuralConcerns',
        'materialRecommendations',
        'orientationTips',
        'materials',
        'objectType',
        'earsPresent',
        'earsDescription',
        'tailPresent',
        'tailDescription',
        'limbs',
        'accessories',
        'distinctiveMarks',
        'asymmetricFeatures',
        'surfaceTextures',
        'detectedView',
        'recommendedStyle',
        'styleConfidence',
        'styleReasoning',
    ],
};
function requireString(record, key) {
    const value = record[key];
    if (typeof value !== 'string')
        throw new Error(`Invalid image analysis field: ${key}`);
    return value;
}
function requireStringArray(record, key) {
    const value = record[key];
    if (!Array.isArray(value) || value.some((item) => typeof item !== 'string')) {
        throw new Error(`Invalid image analysis field: ${key}`);
    }
    return value;
}
function requireNumber(record, key) {
    const value = record[key];
    if (typeof value !== 'number' || !Number.isFinite(value)) {
        throw new Error(`Invalid image analysis field: ${key}`);
    }
    return value;
}
function requireBoolean(record, key) {
    const value = record[key];
    if (typeof value !== 'boolean')
        throw new Error(`Invalid image analysis field: ${key}`);
    return value;
}
function parseStructuredImageAnalysis(text) {
    const normalized = text
        .trim()
        .replace(/^```(?:json)?\s*/i, '')
        .replace(/\s*```$/, '');
    const value = JSON.parse(normalized);
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
        throw new Error('Gemini image analysis did not return a JSON object');
    }
    const record = value;
    const detectedView = requireString(record, 'detectedView');
    const recommendedStyle = requireString(record, 'recommendedStyle');
    const validViews = ['front', 'back', 'left', 'right', 'top'];
    const validStyles = ['bobblehead', 'chibi', 'cartoon', 'emoji'];
    if (!validViews.includes(detectedView)) {
        throw new Error('Invalid image analysis field: detectedView');
    }
    if (!validStyles.includes(recommendedStyle)) {
        throw new Error('Invalid image analysis field: recommendedStyle');
    }
    const styleSuitability = record.styleSuitability;
    const styleSuitabilityReason = record.styleSuitabilityReason;
    if (styleSuitability !== undefined && (typeof styleSuitability !== 'number' || !Number.isFinite(styleSuitability))) {
        throw new Error('Invalid image analysis field: styleSuitability');
    }
    if (styleSuitabilityReason !== undefined && typeof styleSuitabilityReason !== 'string') {
        throw new Error('Invalid image analysis field: styleSuitabilityReason');
    }
    return {
        promptDescription: requireString(record, 'promptDescription'),
        styleHints: requireStringArray(record, 'styleHints'),
        description: requireString(record, 'description'),
        colors: requireStringArray(record, 'colors'),
        score: requireNumber(record, 'score'),
        colorSuggestions: requireStringArray(record, 'colorSuggestions'),
        structuralConcerns: requireStringArray(record, 'structuralConcerns'),
        materialRecommendations: requireStringArray(record, 'materialRecommendations'),
        orientationTips: requireStringArray(record, 'orientationTips'),
        materials: requireStringArray(record, 'materials'),
        objectType: requireString(record, 'objectType'),
        earsPresent: requireBoolean(record, 'earsPresent'),
        earsDescription: requireString(record, 'earsDescription'),
        tailPresent: requireBoolean(record, 'tailPresent'),
        tailDescription: requireString(record, 'tailDescription'),
        limbs: requireString(record, 'limbs'),
        accessories: requireStringArray(record, 'accessories'),
        distinctiveMarks: requireStringArray(record, 'distinctiveMarks'),
        asymmetricFeatures: requireStringArray(record, 'asymmetricFeatures'),
        surfaceTextures: requireStringArray(record, 'surfaceTextures'),
        detectedView: detectedView,
        recommendedStyle: recommendedStyle,
        styleConfidence: requireNumber(record, 'styleConfidence'),
        styleReasoning: requireString(record, 'styleReasoning'),
        ...(styleSuitability !== undefined && { styleSuitability }),
        ...(styleSuitabilityReason !== undefined && { styleSuitabilityReason }),
    };
}
//# sourceMappingURL=image-analysis-schema.js.map