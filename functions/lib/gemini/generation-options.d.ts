import type { PipelineMeshAngle, ViewAngle } from '../rodin/types';
export type GeminiImageModel = 'gemini-2.5-flash' | 'gemini-2.5-flash-image' | 'gemini-3-pro-image-preview';
export declare const DEFAULT_GEMINI_MODEL: GeminiImageModel;
export declare function resolveGeminiImageModel(model?: GeminiImageModel): string;
export interface GenerationColors {
    colorCount?: number;
    colorPalette?: string[];
}
export declare function resolveGenerationColors(options: GenerationColors): Required<GenerationColors>;
export declare function buildGenerationColorPrompt(options: GenerationColors): string;
export declare function assertSupportedReferenceAngle(angle: ViewAngle): asserts angle is PipelineMeshAngle;
