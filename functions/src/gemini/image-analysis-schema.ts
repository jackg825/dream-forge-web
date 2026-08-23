/** Structured output contract for Gemini image analysis. */
export const IMAGE_ANALYSIS_RESPONSE_SCHEMA = {
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
} as const;

export interface StructuredImageAnalysisResponse {
  promptDescription: string;
  styleHints: string[];
  description: string;
  colors: string[];
  score: number;
  colorSuggestions: string[];
  structuralConcerns: string[];
  materialRecommendations: string[];
  orientationTips: string[];
  materials: string[];
  objectType: string;
  earsPresent: boolean;
  earsDescription: string;
  tailPresent: boolean;
  tailDescription: string;
  limbs: string;
  accessories: string[];
  distinctiveMarks: string[];
  asymmetricFeatures: string[];
  surfaceTextures: string[];
  detectedView: 'front' | 'back' | 'left' | 'right' | 'top';
  recommendedStyle: 'bobblehead' | 'chibi' | 'cartoon' | 'emoji';
  styleConfidence: number;
  styleReasoning: string;
  styleSuitability?: number;
  styleSuitabilityReason?: string;
}

function requireString(record: Record<string, unknown>, key: string): string {
  const value = record[key];
  if (typeof value !== 'string') throw new Error(`Invalid image analysis field: ${key}`);
  return value;
}

function requireStringArray(record: Record<string, unknown>, key: string): string[] {
  const value = record[key];
  if (!Array.isArray(value) || value.some((item) => typeof item !== 'string')) {
    throw new Error(`Invalid image analysis field: ${key}`);
  }
  return value as string[];
}

function requireNumber(record: Record<string, unknown>, key: string): number {
  const value = record[key];
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new Error(`Invalid image analysis field: ${key}`);
  }
  return value;
}

function requireBoolean(record: Record<string, unknown>, key: string): boolean {
  const value = record[key];
  if (typeof value !== 'boolean') throw new Error(`Invalid image analysis field: ${key}`);
  return value;
}

export function parseStructuredImageAnalysis(text: string): StructuredImageAnalysisResponse {
  const normalized = text
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/, '');
  const value: unknown = JSON.parse(normalized);
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('Gemini image analysis did not return a JSON object');
  }

  const record = value as Record<string, unknown>;
  const detectedView = requireString(record, 'detectedView');
  const recommendedStyle = requireString(record, 'recommendedStyle');
  const validViews = ['front', 'back', 'left', 'right', 'top'] as const;
  const validStyles = ['bobblehead', 'chibi', 'cartoon', 'emoji'] as const;

  if (!validViews.includes(detectedView as typeof validViews[number])) {
    throw new Error('Invalid image analysis field: detectedView');
  }
  if (!validStyles.includes(recommendedStyle as typeof validStyles[number])) {
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
    detectedView: detectedView as StructuredImageAnalysisResponse['detectedView'],
    recommendedStyle: recommendedStyle as StructuredImageAnalysisResponse['recommendedStyle'],
    styleConfidence: requireNumber(record, 'styleConfidence'),
    styleReasoning: requireString(record, 'styleReasoning'),
    ...(styleSuitability !== undefined && { styleSuitability }),
    ...(styleSuitabilityReason !== undefined && { styleSuitabilityReason }),
  };
}
