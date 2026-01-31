# Composite View Generation Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 將 4 次獨立 Gemini 呼叫替換為單次 2×2 網格生成，提升視角一致性

**Architecture:** 新增 `composite-view-generator.ts` 處理 Gemini 3 Pro 2K 圖片生成，新增 `image-cropper.ts` 處理 Sharp 裁切，修改 `pipeline.ts` 使用新模組

**Tech Stack:** Gemini 3 Pro API, Sharp (圖片處理), TypeScript

---

## Task 1: 安裝 Sharp 依賴

**Files:**
- Modify: `functions/package.json`

**Step 1: 安裝 sharp**

```bash
cd /Users/jackchung/Workspace/GitHub/dream-forge/functions && npm install sharp && npm install -D @types/sharp
```

**Step 2: 驗證安裝**

```bash
cd /Users/jackchung/Workspace/GitHub/dream-forge/functions && npm ls sharp
```

Expected: `sharp@0.x.x` 顯示在依賴樹中

**Step 3: Commit**

```bash
git add functions/package.json functions/package-lock.json
git commit -m "chore(functions): add sharp dependency for image cropping"
```

---

## Task 2: 建立 Image Cropper 模組

**Files:**
- Create: `functions/src/gemini/image-cropper.ts`

**Step 1: 建立裁切模組**

```typescript
/**
 * Image Cropper for Composite View Generation
 *
 * Crops a 2×2 grid image into 4 separate view images.
 * Used with Gemini 3 Pro composite generation.
 */

import sharp from 'sharp';
import * as functions from 'firebase-functions';

/**
 * Result of cropping a composite 2×2 grid image
 */
export interface CropResult {
  front: Buffer;   // Top-left quadrant
  back: Buffer;    // Top-right quadrant
  left: Buffer;    // Bottom-left quadrant
  right: Buffer;   // Bottom-right quadrant
}

/**
 * Crop a 2×2 composite image into 4 separate view images
 *
 * Grid layout:
 * ┌──────────┬──────────┐
 * │  FRONT   │  BACK    │
 * │ (0,0)    │ (half,0) │
 * ├──────────┼──────────┤
 * │  LEFT    │  RIGHT   │
 * │ (0,half) │ (half,half)│
 * └──────────┴──────────┘
 *
 * @param compositeImage - The 2048×2048 composite image buffer
 * @returns 4 separate 1024×1024 view images
 */
export async function cropCompositeView(
  compositeImage: Buffer
): Promise<CropResult> {
  // Get image metadata to determine dimensions
  const metadata = await sharp(compositeImage).metadata();
  const width = metadata.width || 2048;
  const height = metadata.height || 2048;

  // Handle non-2048 images by resizing first
  let normalizedImage = compositeImage;
  if (width !== 2048 || height !== 2048) {
    functions.logger.info('Resizing composite image to 2048×2048', {
      originalWidth: width,
      originalHeight: height,
    });
    normalizedImage = await sharp(compositeImage)
      .resize(2048, 2048, { fit: 'fill' })
      .toBuffer();
  }

  const halfSize = 1024;

  // Crop all 4 quadrants in parallel
  const [front, back, left, right] = await Promise.all([
    // Top-left: FRONT
    sharp(normalizedImage)
      .extract({ left: 0, top: 0, width: halfSize, height: halfSize })
      .png()
      .toBuffer(),
    // Top-right: BACK
    sharp(normalizedImage)
      .extract({ left: halfSize, top: 0, width: halfSize, height: halfSize })
      .png()
      .toBuffer(),
    // Bottom-left: LEFT
    sharp(normalizedImage)
      .extract({ left: 0, top: halfSize, width: halfSize, height: halfSize })
      .png()
      .toBuffer(),
    // Bottom-right: RIGHT
    sharp(normalizedImage)
      .extract({ left: halfSize, top: halfSize, width: halfSize, height: halfSize })
      .png()
      .toBuffer(),
  ]);

  functions.logger.info('Composite image cropped successfully', {
    frontSize: front.length,
    backSize: back.length,
    leftSize: left.length,
    rightSize: right.length,
  });

  return { front, back, left, right };
}
```

**Step 2: 驗證 TypeScript 編譯**

```bash
cd /Users/jackchung/Workspace/GitHub/dream-forge/functions && npx tsc --noEmit src/gemini/image-cropper.ts
```

Expected: 無錯誤輸出

**Step 3: Commit**

```bash
git add functions/src/gemini/image-cropper.ts
git commit -m "feat(gemini): add image cropper module for composite view"
```

---

## Task 3: 建立 Composite View Generator 模組

**Files:**
- Create: `functions/src/gemini/composite-view-generator.ts`

**Step 1: 建立 generator 模組**

```typescript
/**
 * Composite View Generator
 *
 * Generates a 2×2 grid image with 4 orthographic views using Gemini 3 Pro.
 * This replaces the multi-view generator's 4 separate API calls with a single call,
 * ensuring perfect consistency across all views.
 *
 * Output: 2048×2048 image containing:
 * - Top-left: FRONT view (0°)
 * - Top-right: BACK view (180°)
 * - Bottom-left: LEFT view (90°)
 * - Bottom-right: RIGHT view (270°)
 */

import axios from 'axios';
import * as functions from 'firebase-functions';
import type { GeminiResponse } from './types';
import type { ImageAnalysisResult } from '../rodin/types';
import { type StyleId, getStyleConfig, DEFAULT_STYLE } from '../config/styles';
import { cropCompositeView, type CropResult } from './image-cropper';

const GEMINI_API_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';
const COMPOSITE_MODEL = 'gemini-3-pro-image-preview';

/**
 * Options for composite view generation
 */
export interface CompositeViewOptions {
  userDescription?: string | null;
  imageAnalysis?: ImageAnalysisResult | null;
  selectedStyle?: StyleId;
}

/**
 * Result of composite view generation (after cropping)
 */
export interface CompositeViewResult {
  front: { imageBase64: string; mimeType: string };
  back: { imageBase64: string; mimeType: string };
  left: { imageBase64: string; mimeType: string };
  right: { imageBase64: string; mimeType: string };
}

/**
 * Build the composite view prompt
 */
function buildCompositePrompt(options: CompositeViewOptions): string {
  const style = getStyleConfig(options.selectedStyle || DEFAULT_STYLE);
  const { meshStyle, proportions, features } = style.promptModifiers;

  // Build subject description from analysis
  let subjectBlock = '';
  if (options.imageAnalysis?.promptDescription) {
    subjectBlock = `
=== SUBJECT DESCRIPTION ===

${options.imageAnalysis.promptDescription}

Maintain this exact subject identity across all 4 views.

=== END SUBJECT DESCRIPTION ===
`;
  } else if (options.userDescription) {
    subjectBlock = `
=== SUBJECT DESCRIPTION ===

This is ${options.userDescription}.

Maintain this exact subject identity across all 4 views.

=== END SUBJECT DESCRIPTION ===
`;
  }

  return `Generate a 2×2 grid image showing 4 orthographic views of the SAME subject.

=== GRID LAYOUT (CRITICAL) ===

The output image MUST be exactly 2048×2048 pixels, divided into 4 equal quadrants:

┌─────────────────┬─────────────────┐
│   TOP-LEFT      │   TOP-RIGHT     │
│   FRONT VIEW    │   BACK VIEW     │
│   (0°)          │   (180°)        │
│   1024×1024     │   1024×1024     │
├─────────────────┼─────────────────┤
│   BOTTOM-LEFT   │   BOTTOM-RIGHT  │
│   LEFT VIEW     │   RIGHT VIEW    │
│   (90°)         │   (270°)        │
│   1024×1024     │   1024×1024     │
└─────────────────┴─────────────────┘

=== END GRID LAYOUT ===
${subjectBlock}
=== FIGURE STYLE: ${style.name.toUpperCase()} ===

**Target Style**: ${meshStyle}

**Proportions**: ${proportions}

**Feature Emphasis**: ${features}

Render in cel-shaded style with approximately 7 distinct, high-contrast solid colors.
No gradients, no soft shadows - just clean blocks of flat color.
Each color zone has crisp, pixel-sharp edges.

=== END FIGURE STYLE ===

=== CONSISTENCY REQUIREMENTS (CRITICAL) ===

ALL 4 VIEWS MUST SHOW:
- The EXACT same subject (identical proportions, features, accessories)
- The EXACT same color palette (use identical hex colors across all views)
- The EXACT same art style (cel-shaded, flat colors, no gradients)
- The EXACT same level of detail and simplification
- ONLY the camera angle changes between views

DO NOT:
- Change any features between views
- Add or remove accessories between views
- Vary the color palette between views
- Change the art style between views

=== END CONSISTENCY REQUIREMENTS ===

=== VIEW SPECIFICATIONS ===

**FRONT (top-left quadrant)**:
- Camera at 6 o'clock position, looking at center
- Face and front body visible
- Both left and right sides symmetrically visible

**BACK (top-right quadrant)**:
- Camera at 12 o'clock position, looking at center
- Back of head/body visible
- NO face visible
- Tail visible if present

**LEFT (bottom-left quadrant)**:
- Camera at 3 o'clock position, looking at center
- Subject's LEFT side visible
- For characters: LEFT ear visible, nose points toward LEFT edge

**RIGHT (bottom-right quadrant)**:
- Camera at 9 o'clock position, looking at center
- Subject's RIGHT side visible
- For characters: RIGHT ear visible, nose points toward RIGHT edge

=== END VIEW SPECIFICATIONS ===

=== RENDERING REQUIREMENTS ===

- Each quadrant has pure white (#FFFFFF) background
- Add a 2-pixel light gray (#CCCCCC) border between quadrants
- Orthographic projection (no perspective distortion)
- Subject centered in each quadrant, fills 90% of quadrant
- Completely flat lighting - no cast shadows, no highlights
- Output exactly 2048×2048 pixels

=== END RENDERING REQUIREMENTS ===

Generate the 2×2 grid image now.`;
}

/**
 * Generate composite view using Gemini 3 Pro
 *
 * @param referenceImageBase64 - Base64 encoded reference image
 * @param mimeType - MIME type of the input image
 * @param options - Generation options
 * @returns Cropped view images ready for 3D generation
 */
export async function generateCompositeView(
  referenceImageBase64: string,
  mimeType: string,
  options: CompositeViewOptions = {}
): Promise<CompositeViewResult> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new functions.https.HttpsError(
      'failed-precondition',
      'Gemini API key not configured'
    );
  }

  functions.logger.info('Starting composite view generation', {
    model: COMPOSITE_MODEL,
    hasUserDescription: !!options.userDescription,
    hasImageAnalysis: !!options.imageAnalysis,
    selectedStyle: options.selectedStyle || DEFAULT_STYLE,
  });

  const prompt = buildCompositePrompt(options);

  // Call Gemini 3 Pro API
  const response = await axios.post<GeminiResponse>(
    `${GEMINI_API_BASE}/${COMPOSITE_MODEL}:generateContent`,
    {
      contents: [
        {
          parts: [
            {
              inline_data: {
                mime_type: mimeType,
                data: referenceImageBase64,
              },
            },
            {
              text: prompt,
            },
          ],
        },
      ],
      generationConfig: {
        responseModalities: ['IMAGE'],
      },
    },
    {
      headers: {
        'Content-Type': 'application/json',
      },
      params: {
        key: apiKey,
      },
      timeout: 120000, // 2 minute timeout for larger image
    }
  );

  // Check for errors
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

  // Extract image from response
  const candidate = response.data.candidates?.[0];
  if (!candidate) {
    throw new functions.https.HttpsError('internal', 'No candidates in response');
  }

  const parts = candidate.content?.parts || [];
  const imagePart = parts.find((p) => p.inlineData?.data);

  if (!imagePart) {
    const textPart = parts.find((p) => p.text);
    const textInfo = textPart ? ` Response: "${textPart.text?.substring(0, 200)}"` : '';
    throw new functions.https.HttpsError(
      'internal',
      `No image returned from Gemini.${textInfo}`
    );
  }

  const compositeBase64 = imagePart.inlineData!.data;
  const compositeBuffer = Buffer.from(compositeBase64, 'base64');

  functions.logger.info('Composite image received, cropping...', {
    bufferSize: compositeBuffer.length,
  });

  // Crop into 4 views
  const cropped: CropResult = await cropCompositeView(compositeBuffer);

  // Convert buffers back to base64
  const result: CompositeViewResult = {
    front: {
      imageBase64: cropped.front.toString('base64'),
      mimeType: 'image/png',
    },
    back: {
      imageBase64: cropped.back.toString('base64'),
      mimeType: 'image/png',
    },
    left: {
      imageBase64: cropped.left.toString('base64'),
      mimeType: 'image/png',
    },
    right: {
      imageBase64: cropped.right.toString('base64'),
      mimeType: 'image/png',
    },
  };

  functions.logger.info('Composite view generation complete', {
    frontSize: result.front.imageBase64.length,
    backSize: result.back.imageBase64.length,
    leftSize: result.left.imageBase64.length,
    rightSize: result.right.imageBase64.length,
  });

  return result;
}
```

**Step 2: 驗證 TypeScript 編譯**

```bash
cd /Users/jackchung/Workspace/GitHub/dream-forge/functions && npx tsc --noEmit src/gemini/composite-view-generator.ts
```

Expected: 無錯誤輸出

**Step 3: Commit**

```bash
git add functions/src/gemini/composite-view-generator.ts
git commit -m "feat(gemini): add composite view generator using Gemini 3 Pro"
```

---

## Task 4: 更新 Pipeline Handler

**Files:**
- Modify: `functions/src/handlers/pipeline.ts:16` (imports)
- Modify: `functions/src/handlers/pipeline.ts:59-63` (credits config)
- Modify: `functions/src/handlers/pipeline.ts:523-578` (single-phase flow)

**Step 1: 新增 import**

在 `pipeline.ts` 第 16 行後新增：

```typescript
import { generateCompositeView, type CompositeViewResult } from '../gemini/composite-view-generator';
```

**Step 2: 更新 credits 設定**

修改 `GEMINI_MODEL_CREDITS` (約第 59-63 行)：

```typescript
const GEMINI_MODEL_CREDITS: Record<string, number> = {
  'gemini-2.5-flash': 3,
  'gemini-2.5-flash-image': 3,
  'gemini-3-pro-image-preview': 5,    // Premium model - composite view
  'gemini-3-pro-composite': 5,        // Alias for composite mode
};
```

**Step 3: 修改 single-phase flow 使用 composite generator**

找到 `generatePipelineImages` 函數中的 single-phase flow 區塊 (約第 523-578 行)，替換為：

```typescript
      } else {
        // =====================================================
        // SINGLE-PHASE FLOW: Composite View Generation
        // Generate all 4 views in a single 2×2 grid image
        // =====================================================

        functions.logger.info('Using composite view generation (single API call)', {
          pipelineId,
          selectedStyle: selectedStyle || 'none',
        });

        // Update progress: starting
        await pipelineRef.update({
          generationProgress: {
            phase: 'composite-generation' as const,
            meshViewsCompleted: 0,
          },
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });

        // Generate composite view (single API call)
        const compositeResult = await generateCompositeView(base64, mimeType, {
          userDescription: pipeline.userDescription,
          imageAnalysis: pipeline.imageAnalysis,
          selectedStyle,
        });

        // Update progress: composite done, uploading
        await pipelineRef.update({
          generationProgress: {
            phase: 'uploading' as const,
            meshViewsCompleted: 4,
          },
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });

        // Upload all 4 views
        const viewEntries: [PipelineMeshAngle, { imageBase64: string; mimeType: string }][] = [
          ['front', compositeResult.front],
          ['back', compositeResult.back],
          ['left', compositeResult.left],
          ['right', compositeResult.right],
        ];

        for (const [angle, view] of viewEntries) {
          const ext = getExtensionFromMimeType(view.mimeType);
          const storagePath = `pipelines/${userId}/${pipelineId}/mesh_${angle}.${ext}`;
          const url = await uploadImageToStorage(view.imageBase64, view.mimeType, storagePath);

          meshImages[angle] = {
            url,
            storagePath,
            source: 'gemini-composite',
            generatedAt: now as unknown as FirebaseFirestore.Timestamp,
          };
        }

        // No aggregated color palette for composite mode (colors are consistent by design)
        aggregatedColorPalette = undefined;

        functions.logger.info('Composite view generation complete', {
          pipelineId,
          viewCount: Object.keys(meshImages).length,
        });
      }
```

**Step 4: 驗證 TypeScript 編譯**

```bash
cd /Users/jackchung/Workspace/GitHub/dream-forge/functions && npm run build
```

Expected: 編譯成功，無錯誤

**Step 5: Commit**

```bash
git add functions/src/handlers/pipeline.ts
git commit -m "feat(pipeline): integrate composite view generator for single-phase flow"
```

---

## Task 5: 測試與部署

**Step 1: 本地 build 驗證**

```bash
cd /Users/jackchung/Workspace/GitHub/dream-forge/functions && npm run build
```

Expected: 編譯成功

**Step 2: 檢查生成的 JS 檔案**

```bash
ls -la /Users/jackchung/Workspace/GitHub/dream-forge/functions/lib/gemini/
```

Expected: 包含 `composite-view-generator.js` 和 `image-cropper.js`

**Step 3: (Optional) 部署測試**

```bash
cd /Users/jackchung/Workspace/GitHub/dream-forge && firebase deploy --only functions:generatePipelineImages
```

**Step 4: Final Commit**

```bash
git add .
git commit -m "feat(composite-view): complete implementation of single-image multi-view generation

- Add sharp dependency for image processing
- Create image-cropper.ts for 2×2 grid cropping
- Create composite-view-generator.ts using Gemini 3 Pro
- Update pipeline.ts to use composite generation in single-phase flow

Cost: $0.134/generation (was $0.156)
API calls: 1 (was 4)
Expected improvement: +15% 3D print success rate"
```

---

## Verification Checklist

- [ ] `sharp` installed in functions/package.json
- [ ] `image-cropper.ts` compiles without errors
- [ ] `composite-view-generator.ts` compiles without errors
- [ ] `pipeline.ts` imports and uses new modules
- [ ] `npm run build` succeeds in functions/
- [ ] Generated JS files exist in functions/lib/gemini/

---

*Implementation plan created 2026-01-31*
