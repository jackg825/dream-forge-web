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
const styles_1 = require("../config/styles");
const GEMINI_API_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';
const MODEL = 'gemini-3-flash-preview';
/**
 * Get language-specific strings for prompts
 */
function getLanguageStrings(locale) {
    const isEnglish = locale === 'en' || locale.startsWith('en-');
    if (isEnglish) {
        return {
            languageName: 'English',
            printerTypes: {
                fdm: 'FDM (Fused Deposition Modeling)',
                sla: 'SLA (Stereolithography)',
                resin: 'Resin',
            },
            instructions: {
                intro: `You are a 3D printing expert and AI image generation prompt specialist. Analyze this reference image for multi-view 3D model generation.

Please provide the following analysis (respond in English unless otherwise specified):`,
                promptDescription: `1. **Narrative Description for Image Generation** (PROMPT_DESCRIPTION) - Most Important!
   This description will be used directly for AI image generation. Follow these principles:
   - Use "narrative paragraphs" instead of "keyword lists"
   - Write 3-5 fluent English sentences, describing the scene
   - Include: subject identification, overall form, surface texture, color mood
   - Use photography/art terminology (e.g., soft matte finish, rounded forms, warm tones)
   - Example format: "A charming plush teddy bear with soft, velvety brown fur that catches the light with a subtle sheen. The bear features large, expressive black button eyes and a friendly embroidered smile. Its rounded, huggable form has stubby limbs with lighter tan paw pads."`,
                styleHints: `2. **Style Hints** (STYLE_HINTS)
   - 3-5 English style keywords for image generation
   - Example: kawaii, vinyl toy, soft plush, warm tones, friendly character`,
                description: `3. **Object Description** (DESCRIPTION)
   - Describe overall shape, main features, proportions (in English)
   - Mention all visible surface materials`,
                colors: `4. **Color Extraction** (COLORS)
   - Extract exactly {colorCount} main colors in HEX format
   - Prioritize high-contrast, distinguishable, 3D-print friendly solid colors`,
                printFriendliness: `5. **3D Print Friendliness Assessment** ({printerDescription} printer)
   - Score (SCORE): 1-5 (5 being easiest to print)
   - Color Suggestions (COLOR_SUGGESTIONS): Which colors are suitable for printing, whether gradients need simplification
   - Structural Concerns (STRUCTURAL_CONCERNS): Thin walls, overhangs, potentially fragile details
   - Material Recommendations (MATERIAL_RECOMMENDATIONS): Suggested printing materials
   - Orientation Tips (ORIENTATION_TIPS): Best printing orientation`,
                materials: `6. **Material List** (MATERIALS)
   - List detected surface material types (in English, e.g., fur, fabric, plastic)`,
                objectType: `7. **Object Type** (OBJECT_TYPE)
   - Single classification word (in English, e.g., plush toy, figurine, character)`,
                keyFeatures: `8. **Key Features** (KEY_FEATURES) - For multi-view consistency
   - EARS: Has ears? [yes/no], if yes describe shape and position
   - TAIL: Has tail? [yes/no], if yes describe shape and direction
   - LIMBS: Describe limb posture (if applicable)
   - ACCESSORIES: List all accessories (bow, collar, hat, etc.), if none write "none"
   - DISTINCTIVE_MARKS: Any unique patterns, markings, if none write "none"
   - ASYMMETRIC: Any asymmetrical features, if none write "none"
   - SURFACE_TEXTURES: Surface texture description (e.g., fluffy, smooth, rough)`,
                viewDetection: `9. **View Angle Detection** (DETECTED_VIEW)
   Determine which view angle the camera is positioned at in this image:
   - front: Subject is facing directly toward the camera
   - back: Subject is facing away from the camera (we see the back)
   - left: Camera is positioned to the subject's left side
   - right: Camera is positioned to the subject's right side
   - top: Camera is looking down from above

   Choose the SINGLE best matching angle. If the angle is oblique (e.g., front-left), choose the dominant component.`,
                styleRecommendation: `10. **Style Recommendation** (RECOMMENDED_STYLE) - Suggest the best 3D figure style
   Based on the image content, recommend ONE style from these options:
   - bobblehead: Best for people/celebrities with distinctive faces, larger head proportions (3-4x body)
   - chibi: Best for anime characters, cute mascots, fantasy characters (2-3 head proportion)
   - cartoon: Best for characters with personality, animals, stylized figures (Pixar/Disney style)
   - emoji: Best for simple objects, expressions, icons, minimalist subjects (spherical/iconic)

   Consider: subject type, existing proportions, level of detail, and target audience.
   - RECOMMENDED_STYLE: [bobblehead|chibi|cartoon|emoji]
   - STYLE_CONFIDENCE: [0.0-1.0] (how confident you are in this recommendation)
   - STYLE_REASONING: [Brief 1-2 sentence explanation why this style fits best]`,
                outputFormat: `Output strictly in the following format (one field per line):
PROMPT_DESCRIPTION: [3-5 English narrative sentences for image generation]
STYLE_HINTS: [comma-separated English style keywords]
DESCRIPTION: [your description in English]
COLORS: #RRGGBB, #RRGGBB, #RRGGBB...
SCORE: [1-5]
COLOR_SUGGESTIONS: [comma-separated suggestions in English]
STRUCTURAL_CONCERNS: [comma-separated issues in English, or "none"]
MATERIAL_RECOMMENDATIONS: [comma-separated material suggestions in English]
ORIENTATION_TIPS: [comma-separated orientation suggestions in English]
MATERIALS: [comma-separated English material list]
OBJECT_TYPE: [English classification word]
EARS: [yes/no], [description in English]
TAIL: [yes/no], [description in English]
LIMBS: [description in English, or "none"]
ACCESSORIES: [comma-separated accessory list in English, or "none"]
DISTINCTIVE_MARKS: [comma-separated marks in English, or "none"]
ASYMMETRIC: [comma-separated asymmetric features in English, or "none"]
SURFACE_TEXTURES: [comma-separated texture descriptions in English]
DETECTED_VIEW: [front|back|left|right|top]
RECOMMENDED_STYLE: [bobblehead|chibi|cartoon|emoji]
STYLE_CONFIDENCE: [0.0-1.0]
STYLE_REASONING: [Brief explanation in English]
STYLE_SUITABILITY: [0.0-1.0, only if target style was specified]
STYLE_SUITABILITY_REASON: [Brief explanation if suitability < 0.5, or "none"]`,
            },
        };
    }
    // Default: Traditional Chinese (zh-TW)
    return {
        languageName: '繁體中文',
        printerTypes: {
            fdm: 'FDM (熔融沉積)',
            sla: 'SLA (光固化)',
            resin: '樹脂',
        },
        instructions: {
            intro: `你是 3D 列印專家和 AI 圖片生成 prompt 專家，分析這張參考圖片以用於多視角 3D 模型生成。

請提供以下分析（除特別標註外，使用繁體中文回覆）：`,
            promptDescription: `1. **圖片生成用敘事描述** (PROMPT_DESCRIPTION) - 最重要！
   這段描述將直接用於 AI 圖片生成，請遵循以下原則：
   - 使用「敘事型段落」而非「關鍵字列表」
   - 寫 3-5 句流暢的英文描述，像在描述一個場景
   - 包含：主體識別、整體造型、表面材質質感、色調氛圍
   - 使用攝影/藝術術語（如 soft matte finish, rounded forms, warm tones）
   - 範例格式："A charming plush teddy bear with soft, velvety brown fur that catches the light with a subtle sheen. The bear features large, expressive black button eyes and a friendly embroidered smile. Its rounded, huggable form has stubby limbs with lighter tan paw pads."`,
            styleHints: `2. **風格提示** (STYLE_HINTS)
   - 3-5 個英文風格關鍵詞，用於輔助圖片生成
   - 例如：kawaii, vinyl toy, soft plush, warm tones, friendly character`,
            description: `3. **物體描述** (DESCRIPTION)
   - 描述整體形狀、主要特徵、比例（繁體中文）
   - 提及所有可見的表面材質`,
            colors: `4. **色號提取** (COLORS)
   - 提取正好 {colorCount} 個主要顏色，格式為 HEX
   - 優先選擇高對比度、容易區分的 3D 列印友善實色`,
            printFriendliness: `5. **3D 列印友善評估** ({printerDescription} 列印機)
   - 評分 (SCORE): 1-5 分（5分最容易列印）
   - 色彩建議 (COLOR_SUGGESTIONS): 哪些顏色適合列印、是否需要簡化漸層
   - 結構問題 (STRUCTURAL_CONCERNS): 薄壁部分、懸空結構、可能斷裂的細節
   - 材質推薦 (MATERIAL_RECOMMENDATIONS): 建議使用的列印材料
   - 列印方向 (ORIENTATION_TIPS): 最佳列印擺放方向`,
            materials: `6. **材質清單** (MATERIALS)
   - 列出偵測到的表面材質類型（英文，如 fur, fabric, plastic）`,
            objectType: `7. **物體類型** (OBJECT_TYPE)
   - 單一分類詞（英文，如 plush toy, figurine, character）`,
            keyFeatures: `8. **關鍵特徵** (KEY_FEATURES) - 用於確保多視角圖片的一致性
   - EARS: 是否有耳朵？[yes/no]，若有請描述形狀和位置
   - TAIL: 是否有尾巴？[yes/no]，若有請描述形狀和方向
   - LIMBS: 描述四肢姿態（若適用）
   - ACCESSORIES: 列出所有配件（蝴蝶結、項圈、帽子等），若無則填 none
   - DISTINCTIVE_MARKS: 任何獨特的圖案、花紋、標記，若無則填 none
   - ASYMMETRIC: 任何左右不對稱的特徵，若無則填 none
   - SURFACE_TEXTURES: 表面質感描述（如：毛茸茸、光滑、粗糙）`,
            viewDetection: `9. **視角偵測** (DETECTED_VIEW)
   判斷這張圖片的拍攝角度：
   - front: 主體正面朝向相機
   - back: 主體背對相機（看到背面）
   - left: 相機在主體的左側
   - right: 相機在主體的右側
   - top: 相機從上方俯視

   選擇最接近的單一角度。若為斜角（如左前方），請選擇主要成分。`,
            styleRecommendation: `10. **風格推薦** (RECOMMENDED_STYLE) - 推薦最適合的 3D 公仔風格
   根據圖片內容，從以下選項中推薦一種最適合的風格：
   - bobblehead: 最適合人物/名人、有鮮明臉部特徵者（頭身比 3-4 倍）
   - chibi: 最適合動漫角色、可愛吉祥物、奇幻角色（2-3 頭身比例）
   - cartoon: 最適合有個性的角色、動物、風格化人物（皮克斯/迪士尼風格）
   - emoji: 最適合簡單物體、表情、圖標、極簡主題（球形/圖標化）

   考慮：主體類型、現有比例、細節程度、目標受眾
   - RECOMMENDED_STYLE: [bobblehead|chibi|cartoon|emoji]
   - STYLE_CONFIDENCE: [0.0-1.0]（對此推薦的信心程度）
   - STYLE_REASONING: [簡短 1-2 句解釋為何推薦此風格，使用繁體中文]`,
            outputFormat: `嚴格按照以下格式輸出（每行一個欄位）：
PROMPT_DESCRIPTION: [3-5 句英文敘事描述，適合直接用於圖片生成]
STYLE_HINTS: [逗號分隔的英文風格關鍵詞]
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
SURFACE_TEXTURES: [逗號分隔的質感描述，使用繁體中文]
DETECTED_VIEW: [front|back|left|right|top]
RECOMMENDED_STYLE: [bobblehead|chibi|cartoon|emoji]
STYLE_CONFIDENCE: [0.0-1.0]
STYLE_REASONING: [簡短解釋，使用繁體中文]
STYLE_SUITABILITY: [0.0-1.0，僅當指定了目標風格時填寫]
STYLE_SUITABILITY_REASON: [如果適合度 < 0.5 請簡短說明原因，使用繁體中文，否則填 none]`,
        },
    };
}
/**
 * Build style context block for the prompt when user has selected a style
 */
function buildStyleContextBlock(selectedStyle, locale) {
    const styleConfig = (0, styles_1.getStyleConfig)(selectedStyle);
    const { meshStyle, proportions, features } = styleConfig.promptModifiers;
    const isEnglish = locale === 'en' || locale.startsWith('en-');
    if (isEnglish) {
        return `
=== TARGET STYLE: ${styleConfig.name.toUpperCase()} ===
The user has selected the "${styleConfig.name}" style for their 3D figure.

**Style Characteristics:**
- Mesh Style: ${meshStyle}
- Proportions: ${proportions}
- Feature Emphasis: ${features}

**IMPORTANT Instructions:**
1. Generate your PROMPT_DESCRIPTION specifically tailored for this ${styleConfig.name} style
2. Your STYLE_HINTS should complement the ${styleConfig.name} aesthetic
3. Assess STYLE_SUITABILITY: How well does this image subject fit the ${styleConfig.name} style? (0.0-1.0)
4. If suitability < 0.5, explain why in STYLE_SUITABILITY_REASON

=== END TARGET STYLE ===
`;
    }
    // Traditional Chinese
    return `
=== 目標風格: ${styleConfig.name.toUpperCase()} ===
用戶已選擇「${styleConfig.name}」風格來生成 3D 公仔。

**風格特徵：**
- 網格風格: ${meshStyle}
- 比例特徵: ${proportions}
- 強調特點: ${features}

**重要指示：**
1. 請根據 ${styleConfig.name} 風格特點來生成 PROMPT_DESCRIPTION
2. STYLE_HINTS 應該配合 ${styleConfig.name} 的美學風格
3. 評估 STYLE_SUITABILITY：這張圖片的主體有多適合 ${styleConfig.name} 風格？(0.0-1.0)
4. 如果適合度 < 0.5，請在 STYLE_SUITABILITY_REASON 中說明原因

=== 目標風格結束 ===
`;
}
/**
 * Build the analysis prompt for Gemini
 */
function buildAnalysisPrompt(colorCount, printerType, locale = 'zh-TW', selectedStyle) {
    const lang = getLanguageStrings(locale);
    const printerDescription = lang.printerTypes[printerType] || lang.printerTypes.fdm;
    const i = lang.instructions;
    // Build style context block if user selected a style
    const styleContext = selectedStyle ? buildStyleContextBlock(selectedStyle, locale) : '';
    return `${i.intro}
${styleContext}
${i.promptDescription}

${i.styleHints}

${i.description}

${i.colors.replace('{colorCount}', colorCount.toString())}

${i.printFriendliness.replace('{printerDescription}', printerDescription)}

${i.materials}

${i.objectType}

${i.keyFeatures}

${i.viewDetection}

${i.styleRecommendation}

${i.outputFormat}`;
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
    // Extract prompt description (narrative description for image generation)
    const promptDescription = extractField('PROMPT_DESCRIPTION') || undefined;
    // Extract style hints
    const styleHintsRaw = extractField('STYLE_HINTS');
    const styleHints = styleHintsRaw ? parseList(styleHintsRaw) : undefined;
    // Extract description (Chinese description)
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
    // Extract detected view angle
    const validViewAngles = ['front', 'back', 'left', 'right', 'top'];
    const detectedViewRaw = extractField('DETECTED_VIEW').toLowerCase().trim();
    const detectedViewAngle = validViewAngles.includes(detectedViewRaw)
        ? detectedViewRaw
        : undefined;
    // Extract style recommendation (new in v2)
    const recommendedStyleRaw = extractField('RECOMMENDED_STYLE').toLowerCase().trim();
    const recommendedStyle = (0, styles_1.isValidStyleId)(recommendedStyleRaw) ? recommendedStyleRaw : undefined;
    const styleConfidenceRaw = extractField('STYLE_CONFIDENCE');
    const styleConfidence = styleConfidenceRaw
        ? Math.min(1, Math.max(0, parseFloat(styleConfidenceRaw) || 0))
        : undefined;
    const styleReasoning = extractField('STYLE_REASONING') || undefined;
    // Extract style suitability (when user selected a target style)
    const styleSuitabilityRaw = extractField('STYLE_SUITABILITY');
    const styleSuitability = styleSuitabilityRaw
        ? Math.min(1, Math.max(0, parseFloat(styleSuitabilityRaw) || 0))
        : undefined;
    const styleSuitabilityReasonRaw = extractField('STYLE_SUITABILITY_REASON');
    const styleSuitabilityReason = styleSuitabilityReasonRaw && styleSuitabilityReasonRaw.toLowerCase() !== 'none'
        ? styleSuitabilityReasonRaw
        : undefined;
    return {
        description,
        ...(promptDescription && { promptDescription }),
        ...(styleHints && styleHints.length > 0 && { styleHints }),
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
        // View angle detection (for styled reference generation)
        ...(detectedViewAngle && { detectedViewAngle }),
        // Style recommendation fields
        ...(recommendedStyle && { recommendedStyle }),
        ...(styleConfidence !== undefined && { styleConfidence }),
        ...(styleReasoning && { styleReasoning }),
        // Style suitability fields (when target style was specified)
        ...(styleSuitability !== undefined && { styleSuitability }),
        ...(styleSuitabilityReason && { styleSuitabilityReason }),
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
    const locale = options.locale || 'zh-TW';
    const selectedStyle = options.selectedStyle;
    functions.logger.info('Starting image analysis', {
        model: MODEL,
        colorCount,
        printerType: options.printerType,
        locale,
        mimeType,
        selectedStyle: selectedStyle || 'none',
    });
    const prompt = buildAnalysisPrompt(colorCount, options.printerType, locale, selectedStyle);
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
            hasPromptDescription: !!result.promptDescription,
            styleHintsCount: result.styleHints?.length ?? 0,
            // View angle detection
            detectedViewAngle: result.detectedViewAngle ?? 'none',
            // Style recommendation logging
            recommendedStyle: result.recommendedStyle ?? 'none',
            styleConfidence: result.styleConfidence ?? 0,
            // Style context logging (when user selected a style)
            analyzedWithStyle: selectedStyle ?? 'none',
            styleSuitability: result.styleSuitability ?? 'n/a',
        });
        // Include analyzedWithStyle in result if style was provided
        return {
            ...result,
            ...(selectedStyle && { analyzedWithStyle: selectedStyle }),
        };
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