/**
 * Image Analyzer for Pipeline Workflow
 *
 * Analyzes uploaded images using Gemini to extract:
 * - Object description (including all materials)
 * - Color palette (configurable count, 3D-print friendly)
 * - 3D print friendliness assessment
 * - Material detection
 * - Object type classification
 *
 * Results are used to optimize view generation prompts and Meshy texture prompts.
 */

import axios from 'axios';
import * as functions from 'firebase-functions';
import type { PrinterType } from '../rodin/types';

const GEMINI_API_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';
const MODEL = 'gemini-2.0-flash';

/**
 * 3D Print friendliness assessment
 */
export interface PrintFriendlinessAssessment {
  score: number;                      // 1-5 rating
  colorSuggestions: string[];         // Color-related suggestions
  structuralConcerns: string[];       // Structural issues (thin walls, overhangs)
  materialRecommendations: string[];  // Material suggestions (PLA, PETG, resin)
  orientationTips: string[];          // Printing orientation recommendations
}

/**
 * Image analysis result from Gemini
 */
export interface ImageAnalysisResult {
  description: string;                // AI-generated description (includes all materials)
  colorPalette: string[];             // Extracted HEX colors
  detectedMaterials: string[];        // Detected materials (fur, fabric, plastic)
  objectType: string;                 // Object classification (plush toy, figurine)
  printFriendliness: PrintFriendlinessAssessment;
  analyzedAt: FirebaseFirestore.Timestamp;
}

/**
 * Options for image analysis
 */
export interface AnalyzeImageOptions {
  colorCount: number;       // Number of colors to extract (3-12)
  printerType: PrinterType; // Printer type affects recommendations
}

/**
 * Raw Gemini response structure
 */
interface GeminiAnalysisResponse {
  candidates?: Array<{
    content?: {
      parts?: Array<{
        text?: string;
      }>;
    };
    finishReason?: string;
  }>;
  error?: {
    code: number;
    message: string;
  };
  promptFeedback?: {
    blockReason?: string;
  };
}

/**
 * Build the analysis prompt for Gemini
 */
function buildAnalysisPrompt(colorCount: number, printerType: PrinterType): string {
  const printerDescription = {
    fdm: 'FDM (熔融沉積)',
    sla: 'SLA (光固化)',
    resin: '樹脂',
  }[printerType];

  return `你是 3D 列印專家，分析這張參考圖片以用於 3D 模型生成。

請提供以下分析（全部使用繁體中文回覆）：

1. **物體描述** (DESCRIPTION)
   - 描述整體形狀、主要特徵、比例
   - 提及所有可見的表面材質（例如：「正面是毛茸茸的絨毛，背面是平滑的布料」）
   - 這段描述將用於統一風格的 3D 模型生成

2. **色號提取** (COLORS)
   - 提取正好 ${colorCount} 個主要顏色，格式為 HEX
   - 優先選擇：
     - 高對比度、容易區分的顏色
     - 3D 列印友善的實色
     - 避免過於相近的顏色

3. **3D 列印友善評估** (${printerDescription} 列印機)
   - 評分 (SCORE): 1-5 分（5分最容易列印）
   - 色彩建議 (COLOR_SUGGESTIONS): 哪些顏色適合列印、是否需要簡化漸層
   - 結構問題 (STRUCTURAL_CONCERNS): 薄壁部分、懸空結構、可能斷裂的細節
   - 材質推薦 (MATERIAL_RECOMMENDATIONS): 建議使用的列印材料
   - 列印方向 (ORIENTATION_TIPS): 最佳列印擺放方向

4. **材質清單** (MATERIALS)
   - 列出偵測到的表面材質類型（英文，如 fur, fabric, plastic）

5. **物體類型** (OBJECT_TYPE)
   - 單一分類詞（英文，如 plush toy, figurine, character）

嚴格按照以下格式輸出（每行一個欄位）：
DESCRIPTION: [你的描述，使用繁體中文]
COLORS: #RRGGBB, #RRGGBB, #RRGGBB...
SCORE: [1-5]
COLOR_SUGGESTIONS: [逗號分隔的建議清單，使用繁體中文]
STRUCTURAL_CONCERNS: [逗號分隔的問題清單，使用繁體中文，若無則填 none]
MATERIAL_RECOMMENDATIONS: [逗號分隔的材質建議清單，使用繁體中文]
ORIENTATION_TIPS: [逗號分隔的方向建議清單，使用繁體中文]
MATERIALS: [逗號分隔的英文材質清單]
OBJECT_TYPE: [英文分類詞]`;
}

/**
 * Parse the analysis response from Gemini
 */
function parseAnalysisResponse(
  text: string,
  expectedColorCount: number
): Omit<ImageAnalysisResult, 'analyzedAt'> {
  // Helper to extract a field value
  const extractField = (fieldName: string): string => {
    const regex = new RegExp(`${fieldName}:\\s*(.+?)(?=\\n[A-Z_]+:|$)`, 's');
    const match = text.match(regex);
    return match ? match[1].trim() : '';
  };

  // Helper to parse comma-separated list
  const parseList = (value: string): string[] => {
    if (!value || value.toLowerCase() === 'none') return [];
    return value.split(/[,，]/).map((s) => s.trim()).filter(Boolean);
  };

  // Extract description
  const description = extractField('DESCRIPTION') || '無法分析物體描述';

  // Extract colors
  const colorsRaw = extractField('COLORS');
  const hexColors = colorsRaw.match(/#[0-9A-Fa-f]{6}/gi) || [];
  const colorPalette = hexColors.map((c) => c.toUpperCase()).slice(0, expectedColorCount);

  // If we didn't get enough colors, log a warning but continue
  if (colorPalette.length < expectedColorCount) {
    functions.logger.warn('Color extraction returned fewer colors than expected', {
      expected: expectedColorCount,
      actual: colorPalette.length,
      rawColors: colorsRaw,
    });
  }

  // Extract score
  const scoreRaw = extractField('SCORE');
  const score = Math.min(5, Math.max(1, parseInt(scoreRaw, 10) || 3));

  // Extract print friendliness fields
  const colorSuggestions = parseList(extractField('COLOR_SUGGESTIONS'));
  const structuralConcerns = parseList(extractField('STRUCTURAL_CONCERNS'));
  const materialRecommendations = parseList(extractField('MATERIAL_RECOMMENDATIONS'));
  const orientationTips = parseList(extractField('ORIENTATION_TIPS'));

  // Extract materials and object type
  const detectedMaterials = parseList(extractField('MATERIALS'));
  const objectType = extractField('OBJECT_TYPE') || 'unknown';

  return {
    description,
    colorPalette,
    detectedMaterials,
    objectType,
    printFriendliness: {
      score,
      colorSuggestions,
      structuralConcerns,
      materialRecommendations,
      orientationTips,
    },
  };
}

/**
 * Analyze an image using Gemini
 *
 * @param imageBase64 - Base64 encoded image data
 * @param mimeType - MIME type of the image (e.g., 'image/png')
 * @param options - Analysis options (colorCount, printerType)
 * @returns Analysis result
 */
export async function analyzeImage(
  imageBase64: string,
  mimeType: string,
  options: AnalyzeImageOptions
): Promise<Omit<ImageAnalysisResult, 'analyzedAt'>> {
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    throw new functions.https.HttpsError(
      'failed-precondition',
      'Gemini API key not configured'
    );
  }

  // Validate color count
  const colorCount = Math.min(12, Math.max(3, options.colorCount));

  functions.logger.info('Starting image analysis', {
    model: MODEL,
    colorCount,
    printerType: options.printerType,
    mimeType,
  });

  const prompt = buildAnalysisPrompt(colorCount, options.printerType);

  try {
    const response = await axios.post<GeminiAnalysisResponse>(
      `${GEMINI_API_BASE}/${MODEL}:generateContent`,
      {
        contents: [
          {
            parts: [
              {
                inline_data: {
                  mime_type: mimeType,
                  data: imageBase64,
                },
              },
              {
                text: prompt,
              },
            ],
          },
        ],
        generationConfig: {
          temperature: 0.3,  // Lower temperature for more consistent output
          maxOutputTokens: 2048,
        },
      },
      {
        headers: {
          'Content-Type': 'application/json',
        },
        params: {
          key: apiKey,
        },
        timeout: 60000, // 60 second timeout
      }
    );

    // Handle errors
    if (response.data.error) {
      throw new functions.https.HttpsError(
        'internal',
        `Gemini API error: ${response.data.error.message}`
      );
    }

    if (response.data.promptFeedback?.blockReason) {
      throw new functions.https.HttpsError(
        'invalid-argument',
        `Image blocked by safety filters: ${response.data.promptFeedback.blockReason}`
      );
    }

    // Extract text response
    const candidate = response.data.candidates?.[0];
    const textPart = candidate?.content?.parts?.find((p) => p.text);

    if (!textPart?.text) {
      throw new functions.https.HttpsError(
        'internal',
        'No text response from Gemini analysis'
      );
    }

    functions.logger.info('Gemini analysis response received', {
      responseLength: textPart.text.length,
      finishReason: candidate?.finishReason,
    });

    // Parse the response
    const result = parseAnalysisResponse(textPart.text, colorCount);

    functions.logger.info('Image analysis complete', {
      colorCount: result.colorPalette.length,
      materialCount: result.detectedMaterials.length,
      objectType: result.objectType,
      printScore: result.printFriendliness.score,
    });

    return result;
  } catch (error) {
    if (error instanceof functions.https.HttpsError) {
      throw error;
    }

    const axiosError = error as { response?: { data?: unknown }; message?: string };
    functions.logger.error('Image analysis failed', {
      error: axiosError.message,
      responseData: axiosError.response?.data,
    });

    throw new functions.https.HttpsError(
      'internal',
      `Image analysis failed: ${axiosError.message || 'Unknown error'}`
    );
  }
}
