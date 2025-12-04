"use strict";
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
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.analyzeImage = analyzeImage;
const axios_1 = __importDefault(require("axios"));
const functions = __importStar(require("firebase-functions"));
const GEMINI_API_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';
const MODEL = 'gemini-2.0-flash';
/**
 * Build the analysis prompt for Gemini
 */
function buildAnalysisPrompt(colorCount, printerType) {
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

6. **關鍵特徵** (KEY_FEATURES) - 用於確保多視角圖片的一致性
   - EARS: 是否有耳朵？[yes/no]，若有請描述形狀和位置
   - TAIL: 是否有尾巴？[yes/no]，若有請描述形狀和方向
   - LIMBS: 描述四肢姿態（若適用）
   - ACCESSORIES: 列出所有配件（蝴蝶結、項圈、帽子等），若無則填 none
   - DISTINCTIVE_MARKS: 任何獨特的圖案、花紋、標記，若無則填 none
   - ASYMMETRIC: 任何左右不對稱的特徵，若無則填 none
   - SURFACE_TEXTURES: 表面質感描述（如：毛茸茸、光滑、粗糙）

嚴格按照以下格式輸出（每行一個欄位）：
DESCRIPTION: [你的描述，使用繁體中文]
COLORS: #RRGGBB, #RRGGBB, #RRGGBB...
SCORE: [1-5]
COLOR_SUGGESTIONS: [逗號分隔的建議清單，使用繁體中文]
STRUCTURAL_CONCERNS: [逗號分隔的問題清單，使用繁體中文，若無則填 none]
MATERIAL_RECOMMENDATIONS: [逗號分隔的材質建議清單，使用繁體中文]
ORIENTATION_TIPS: [逗號分隔的方向建議清單，使用繁體中文]
MATERIALS: [逗號分隔的英文材質清單]
OBJECT_TYPE: [英文分類詞]
EARS: [yes/no], [描述，使用繁體中文]
TAIL: [yes/no], [描述，使用繁體中文]
LIMBS: [描述，使用繁體中文，若無則填 none]
ACCESSORIES: [逗號分隔的配件清單，使用繁體中文，若無則填 none]
DISTINCTIVE_MARKS: [逗號分隔的標記清單，使用繁體中文，若無則填 none]
ASYMMETRIC: [逗號分隔的不對稱特徵清單，使用繁體中文，若無則填 none]
SURFACE_TEXTURES: [逗號分隔的質感描述，使用繁體中文]`;
}
/**
 * Parse the analysis response from Gemini
 */
function parseAnalysisResponse(text, expectedColorCount) {
    // Helper to extract a field value
    const extractField = (fieldName) => {
        const regex = new RegExp(`${fieldName}:\\s*(.+?)(?=\\n[A-Z_]+:|$)`, 's');
        const match = text.match(regex);
        return match ? match[1].trim() : '';
    };
    // Helper to parse comma-separated list
    const parseList = (value) => {
        if (!value || value.toLowerCase() === 'none')
            return [];
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
    // Extract key features for multi-view consistency
    const parseYesNoField = (fieldName) => {
        const raw = extractField(fieldName);
        if (!raw)
            return undefined;
        const yesNoMatch = raw.match(/^(yes|no)/i);
        if (!yesNoMatch)
            return undefined;
        const present = yesNoMatch[1].toLowerCase() === 'yes';
        if (!present)
            return { present: false };
        // Extract description after the yes/no
        const descMatch = raw.match(/^(?:yes|no)[,，]?\s*(.+)/i);
        const description = descMatch?.[1]?.trim();
        return {
            present: true,
            description: description && description.toLowerCase() !== 'none' ? description : undefined,
        };
    };
    const ears = parseYesNoField('EARS');
    const tail = parseYesNoField('TAIL');
    const limbs = extractField('LIMBS');
    const accessories = parseList(extractField('ACCESSORIES'));
    const distinctiveMarks = parseList(extractField('DISTINCTIVE_MARKS'));
    const asymmetricFeatures = parseList(extractField('ASYMMETRIC'));
    const surfaceTextures = parseList(extractField('SURFACE_TEXTURES'));
    // Build keyFeatures object (only include non-empty fields)
    const keyFeatures = {};
    if (ears)
        keyFeatures.ears = ears;
    if (tail)
        keyFeatures.tail = tail;
    if (limbs && limbs.toLowerCase() !== 'none')
        keyFeatures.limbs = limbs;
    if (accessories.length > 0)
        keyFeatures.accessories = accessories;
    if (distinctiveMarks.length > 0)
        keyFeatures.distinctiveMarks = distinctiveMarks;
    if (asymmetricFeatures.length > 0)
        keyFeatures.asymmetricFeatures = asymmetricFeatures;
    if (surfaceTextures.length > 0)
        keyFeatures.surfaceTextures = surfaceTextures;
    // Only include keyFeatures if it has any content
    const hasKeyFeatures = Object.keys(keyFeatures).length > 0;
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
        ...(hasKeyFeatures && { keyFeatures }),
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
async function analyzeImage(imageBase64, mimeType, options) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
        throw new functions.https.HttpsError('failed-precondition', 'Gemini API key not configured');
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
        const response = await axios_1.default.post(`${GEMINI_API_BASE}/${MODEL}:generateContent`, {
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
                temperature: 0.3, // Lower temperature for more consistent output
                maxOutputTokens: 2048,
            },
        }, {
            headers: {
                'Content-Type': 'application/json',
            },
            params: {
                key: apiKey,
            },
            timeout: 60000, // 60 second timeout
        });
        // Handle errors
        if (response.data.error) {
            throw new functions.https.HttpsError('internal', `Gemini API error: ${response.data.error.message}`);
        }
        if (response.data.promptFeedback?.blockReason) {
            throw new functions.https.HttpsError('invalid-argument', `Image blocked by safety filters: ${response.data.promptFeedback.blockReason}`);
        }
        // Extract text response
        const candidate = response.data.candidates?.[0];
        const textPart = candidate?.content?.parts?.find((p) => p.text);
        if (!textPart?.text) {
            throw new functions.https.HttpsError('internal', 'No text response from Gemini analysis');
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
            hasKeyFeatures: !!result.keyFeatures,
            keyFeaturesCount: result.keyFeatures ? Object.keys(result.keyFeatures).length : 0,
        });
        return result;
    }
    catch (error) {
        if (error instanceof functions.https.HttpsError) {
            throw error;
        }
        const axiosError = error;
        functions.logger.error('Image analysis failed', {
            error: axiosError.message,
            responseData: axiosError.response?.data,
        });
        throw new functions.https.HttpsError('internal', `Image analysis failed: ${axiosError.message || 'Unknown error'}`);
    }
}
//# sourceMappingURL=image-analyzer.js.map