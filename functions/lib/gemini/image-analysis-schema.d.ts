/** Structured output contract for Gemini image analysis. */
export declare const IMAGE_ANALYSIS_RESPONSE_SCHEMA: {
    readonly type: "OBJECT";
    readonly properties: {
        readonly promptDescription: {
            readonly type: "STRING";
            readonly description: "Three to five English narrative sentences for downstream image generation.";
        };
        readonly styleHints: {
            readonly type: "ARRAY";
            readonly items: {
                readonly type: "STRING";
            };
            readonly description: "Three to five concise English style hints.";
        };
        readonly description: {
            readonly type: "STRING";
            readonly description: "Human-readable object description in the requested UI language.";
        };
        readonly colors: {
            readonly type: "ARRAY";
            readonly items: {
                readonly type: "STRING";
            };
            readonly description: "Dominant solid colors as #RRGGBB values.";
        };
        readonly score: {
            readonly type: "INTEGER";
            readonly minimum: 1;
            readonly maximum: 5;
        };
        readonly colorSuggestions: {
            readonly type: "ARRAY";
            readonly items: {
                readonly type: "STRING";
            };
        };
        readonly structuralConcerns: {
            readonly type: "ARRAY";
            readonly items: {
                readonly type: "STRING";
            };
        };
        readonly materialRecommendations: {
            readonly type: "ARRAY";
            readonly items: {
                readonly type: "STRING";
            };
        };
        readonly orientationTips: {
            readonly type: "ARRAY";
            readonly items: {
                readonly type: "STRING";
            };
        };
        readonly materials: {
            readonly type: "ARRAY";
            readonly items: {
                readonly type: "STRING";
            };
        };
        readonly objectType: {
            readonly type: "STRING";
        };
        readonly earsPresent: {
            readonly type: "BOOLEAN";
        };
        readonly earsDescription: {
            readonly type: "STRING";
        };
        readonly tailPresent: {
            readonly type: "BOOLEAN";
        };
        readonly tailDescription: {
            readonly type: "STRING";
        };
        readonly limbs: {
            readonly type: "STRING";
        };
        readonly accessories: {
            readonly type: "ARRAY";
            readonly items: {
                readonly type: "STRING";
            };
        };
        readonly distinctiveMarks: {
            readonly type: "ARRAY";
            readonly items: {
                readonly type: "STRING";
            };
        };
        readonly asymmetricFeatures: {
            readonly type: "ARRAY";
            readonly items: {
                readonly type: "STRING";
            };
        };
        readonly surfaceTextures: {
            readonly type: "ARRAY";
            readonly items: {
                readonly type: "STRING";
            };
        };
        readonly detectedView: {
            readonly type: "STRING";
            readonly enum: readonly ["front", "back", "left", "right", "top"];
        };
        readonly recommendedStyle: {
            readonly type: "STRING";
            readonly enum: readonly ["bobblehead", "chibi", "cartoon", "emoji"];
        };
        readonly styleConfidence: {
            readonly type: "NUMBER";
            readonly minimum: 0;
            readonly maximum: 1;
        };
        readonly styleReasoning: {
            readonly type: "STRING";
        };
        readonly styleSuitability: {
            readonly type: "NUMBER";
            readonly minimum: 0;
            readonly maximum: 1;
        };
        readonly styleSuitabilityReason: {
            readonly type: "STRING";
        };
    };
    readonly required: readonly ["promptDescription", "styleHints", "description", "colors", "score", "colorSuggestions", "structuralConcerns", "materialRecommendations", "orientationTips", "materials", "objectType", "earsPresent", "earsDescription", "tailPresent", "tailDescription", "limbs", "accessories", "distinctiveMarks", "asymmetricFeatures", "surfaceTextures", "detectedView", "recommendedStyle", "styleConfidence", "styleReasoning"];
};
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
export declare function parseStructuredImageAnalysis(text: string): StructuredImageAnalysisResponse;
