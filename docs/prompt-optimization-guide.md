# DreamForge 3D 生成 Prompt 優化指南

## 目錄
1. [系統概述](#系統概述)
2. [完整工作流程](#完整工作流程)
3. [Generation Modes（生成模式）](#generation-modes生成模式)
4. [所有 Prompt 清單](#所有-prompt-清單)
5. [已知問題](#已知問題)
6. [優化目標](#優化目標)

---

## 系統概述

DreamForge 是一個將 2D 圖片轉換為 3D 列印模型的服務，專為 Bambu Lab 多色 3D 列印（H2C）優化。

### 技術架構
- **前端**: Next.js 14 + React + TypeScript
- **後端**: Firebase Cloud Functions (Node.js)
- **AI 服務**:
  - Gemini 3 Pro Image Preview（圖片生成）
  - Meshy API（3D mesh 生成 + 貼圖）
- **目標輸出**: GLB/STL 格式，適用於 FDM 多色列印

### 核心流程
```
用戶上傳圖片 → Gemini 生成 6 張多角度視圖 → Meshy 生成 3D mesh → (可選) Meshy 添加貼圖
```

---

## 完整工作流程

### Step 1: 用戶上傳圖片
- 用戶上傳 1-4 張參考圖片
- 可選：輸入「物件描述」（userDescription，最多 300 字）
- 選擇生成模式（Mode A 或 Mode B）

### Step 2: Gemini 生成 6 張視角圖片
系統使用 Gemini 3 Pro Image Preview 從參考圖片生成 6 張不同角度的視圖：

| 圖片類型 | 角度 | 用途 |
|---------|------|------|
| Mesh 視圖 | front, back, left, right | 輸入 Meshy Multi-Image-to-3D |
| Texture 視圖 | front, back | 作為貼圖參考 |

**API 調用方式**:
- 依序調用 6 次 Gemini API（避免 rate limit）
- 每次調用間隔 500ms
- 單次調用 timeout: 90 秒

### Step 3: 用戶預覽與調整
- 用戶可以預覽 6 張生成的視角圖片
- 對不滿意的圖片可以「重新生成」
- 重新生成時可輸入「微調指示」（hint，最多 100 字）

### Step 4: Meshy 生成 3D Mesh（5 credits）
- 將 4 張 Mesh 視圖（front, back, left, right）傳送至 Meshy Multi-Image-to-3D API
- 設定 `should_texture: false`（僅生成網格）
- 等待約 2-5 分鐘
- 輸出：無貼圖的 GLB 模型

### Step 5: (可選) Meshy 添加貼圖（10 credits）
- 使用 Meshy Retexture API
- 以 front texture 視圖作為 style reference
- 設定 `enable_pbr: true`（生成 PBR 材質）
- 輸出：帶貼圖的 GLB 模型

---

## Generation Modes（生成模式）

系統提供兩種生成模式進行 A/B 測試：

### Mode A: Simplified Mesh（簡化網格）- 預設
| 圖片類型 | 處理方式 | 顏色數 |
|---------|---------|--------|
| Mesh 視圖 | 7 色簡化、無陰影、硬邊緣 | 7 |
| Texture 視圖 | 全彩、柔和光線 | 不限 |

**設計理念**: 網格生成需要清晰的形狀邊界，簡化顏色可以幫助 AI 更好地理解物體結構。

### Mode B: Simplified Texture（簡化貼圖）
| 圖片類型 | 處理方式 | 顏色數 |
|---------|---------|--------|
| Mesh 視圖 | 全彩、柔和光線 | 不限 |
| Texture 視圖 | 6 色簡化、無陰影、硬邊緣 | 6 |

**設計理念**: 保留 mesh 視圖細節以獲得更精確的幾何形狀，簡化貼圖以適應多色列印限制。

---

## 所有 Prompt 清單

### 動態注入區塊

以下區塊會根據用戶輸入動態添加到 prompt 中：

#### USER DESCRIPTION 區塊
**觸發條件**: 用戶在上傳時填寫了「物件描述」
```
**USER DESCRIPTION**
The user describes this object as: "{userDescription}"
Use this description to better understand and preserve the object's key features.
```

#### REGENERATION ADJUSTMENT 區塊
**觸發條件**: 用戶在重新生成時填寫了「微調指示」
```
**REGENERATION ADJUSTMENT**
The user requests the following adjustment: "{hint}"
Apply this adjustment while maintaining all other requirements.
```

---

### Prompt 1: Mesh View - Simplified Mode
**使用場景**: Mode A 的 Mesh 視圖（front, back, left, right）
**觸發條件**: `mode.mesh.simplified === true`

```
You are an expert at preparing reference images for 3D printing mesh generation.

**USER DESCRIPTION**
The user describes this object as: "{userDescription}"
Use this description to better understand and preserve the object's key features.

**REGENERATION ADJUSTMENT**
The user requests the following adjustment: "{hint}"
Apply this adjustment while maintaining all other requirements.

Generate a {ANGLE} VIEW of this object optimized for 3D mesh reconstruction.

CRITICAL REQUIREMENTS:
1. ORTHOGRAPHIC VIEW - No perspective distortion, show from directly {位置描述}
2. NO SHADOWS - Remove ALL shadows completely (no drop shadows, no cast shadows, no ambient occlusion)
3. FLAT LIGHTING - Use completely uniform, flat lighting with no highlights or shading gradients
4. Reduce to exactly 7 distinct SOLID colors (no gradients, no anti-aliasing, no soft edges)
5. HARD EDGES - All color boundaries must be pixel-sharp, no blending
6. Pure white background (#FFFFFF)
7. Object should fill 80-90% of the frame
8. Maintain accurate proportions and all structural details

The output image will be used by AI to generate a 3D printable mesh. Shadows and lighting variations will cause incorrect geometry.

After the image, list the 7 colors used: COLORS: #RRGGBB, #RRGGBB, #RRGGBB, #RRGGBB, #RRGGBB, #RRGGBB, #RRGGBB

Generate the actual image, not a description.
```

**變數說明**:
- `{ANGLE}`: FRONT / BACK (rotated 180°) / LEFT SIDE (rotated 90° counterclockwise) / RIGHT SIDE (rotated 90° clockwise)
- `{位置描述}`: in front, centered / behind (180° from front) / left side (90° CCW from front) / right side (90° CW from front)

---

### Prompt 2: Mesh View - Full Color Mode
**使用場景**: Mode B 的 Mesh 視圖（front, back, left, right）
**觸發條件**: `mode.mesh.simplified === false`

```
You are an expert at preparing reference images for 3D mesh generation.

**USER DESCRIPTION**
The user describes this object as: "{userDescription}"
Use this description to better understand and preserve the object's key features.

**REGENERATION ADJUSTMENT**
The user requests the following adjustment: "{hint}"
Apply this adjustment while maintaining all other requirements.

Generate a {ANGLE} VIEW of this object optimized for 3D mesh reconstruction.

REQUIREMENTS:
1. ORTHOGRAPHIC VIEW - No perspective distortion, show from directly {位置描述}
2. NO HARSH SHADOWS - Use soft, diffuse lighting only
3. PRESERVE COLORS - Keep full color detail and surface textures
4. Pure white background (#FFFFFF)
5. Object should fill 80-90% of the frame
6. High-resolution surface detail
7. Maintain accurate proportions matching other views

Generate the actual image, not a description.
```

---

### Prompt 3: Texture View - Simplified Mode
**使用場景**: Mode B 的 Texture 視圖（front, back）
**觸發條件**: `mode.texture.simplified === true`

```
You are an expert at preparing texture reference images for 3D printed models.

**USER DESCRIPTION**
The user describes this object as: "{userDescription}"
Use this description to better understand and preserve the object's key features.

**REGENERATION ADJUSTMENT**
The user requests the following adjustment: "{hint}"
Apply this adjustment while maintaining all other requirements.

Generate a {ANGLE} VIEW of this object optimized for texture mapping.

CRITICAL REQUIREMENTS:
1. ORTHOGRAPHIC VIEW - No perspective distortion, show from directly {位置描述}
2. NO SHADOWS - Remove ALL shadows completely
3. FLAT LIGHTING - Uniform lighting with no gradients
4. Reduce to exactly 6 distinct SOLID colors (no gradients)
5. HARD EDGES - All color boundaries must be pixel-sharp
6. Pure white background (#FFFFFF)
7. Object should fill 80-90% of the frame
8. Maintain exact proportions matching mesh views

After the image, list the 6 colors used: COLORS: #RRGGBB, #RRGGBB, #RRGGBB, #RRGGBB, #RRGGBB, #RRGGBB

Generate the actual image, not a description.
```

**變數說明**:
- `{ANGLE}`: FRONT / BACK (rotated 180°)
- `{位置描述}`: in front, centered / behind (180° from front)

---

### Prompt 4: Texture View - Full Color Mode
**使用場景**: Mode A 的 Texture 視圖（front, back）
**觸發條件**: `mode.texture.simplified === false`

```
You are an expert at preparing texture reference images for 3D printed models.

**USER DESCRIPTION**
The user describes this object as: "{userDescription}"
Use this description to better understand and preserve the object's key features.

**REGENERATION ADJUSTMENT**
The user requests the following adjustment: "{hint}"
Apply this adjustment while maintaining all other requirements.

Generate a {ANGLE} VIEW of this object optimized for texture mapping onto a 3D printed mesh.

REQUIREMENTS:
1. ORTHOGRAPHIC VIEW - No perspective distortion, show from directly {位置描述}
2. NO HARSH SHADOWS - Use soft, diffuse lighting only. Shadows would bake incorrectly into the texture
3. PRESERVE COLORS - Keep full color detail, natural gradients, and surface textures
4. High-resolution surface detail for quality texture mapping
5. Pure white background (#FFFFFF)
6. Object should fill 80-90% of the frame
7. Maintain exact proportions matching the reference image

The texture will be applied to a 3D printed model, so accurate colors without lighting artifacts are essential.

Generate the actual image, not a description.
```

---

### Prompt 5: H2C 7-Color Optimization
**使用場景**: 獨立的 H2C 優化功能（非 pipeline 主流程）
**檔案位置**: `functions/src/gemini/h2c-optimizer.ts`

```
You are an expert at preparing images for multi-color 3D printing on a Bambu Lab H2C printer.

Task: Simplify this image to exactly 7 solid colors optimized for FDM multi-color 3D printing.

Requirements:
1. Reduce the image to exactly 7 distinct solid colors (no gradients, no anti-aliasing between color regions)
2. Each color region should have clear, well-defined boundaries
3. Preserve the main subject's recognizable features and overall composition
4. Optimize for layer adhesion by avoiding very thin color regions (minimum ~2mm width at typical print scales)
5. Use colors that contrast well for visual appeal
6. Avoid colors that are too similar - each color should be distinctly different
7. Keep the image crisp and suitable for conversion to lithophane or color-mapped 3D model

Output requirements:
1. Generate the optimized image with exactly 7 solid colors
2. After the image, list the 7 colors used in this exact format:
   COLORS: #RRGGBB, #RRGGBB, #RRGGBB, #RRGGBB, #RRGGBB, #RRGGBB, #RRGGBB

Important: Generate the actual optimized image, not a description or placeholder.
```

---

### Meshy Retexture（無固定 Prompt）

Meshy Retexture API 不使用文字 prompt，而是透過以下方式指定貼圖風格：

**目前實作**: 使用 `imageStyleUrl` 參數，傳入 front texture 視圖的 URL

```typescript
{
  input_task_id: meshTaskId,        // 來自 mesh 生成的 task ID
  ai_model: 'latest',
  enable_original_uv: true,
  enable_pbr: true,                  // 生成 PBR 材質
  image_style_url: styleImageUrl,   // front texture 視圖 URL
}
```

---

## 已知問題

### 1. 生成品質不穩定
- 相同輸入圖片多次生成，結果差異大
- 細節容易遺失（如小配件、紋理）

### 2. 視角一致性問題（最嚴重）
- 不同角度看起來像不同物件
- 比例、特徵在不同視角間不一致
- 例如：正面的耳朵形狀與側面的耳朵形狀不符

### 3. 顏色簡化問題
- 7/6 色限制可能無法涵蓋物體重要特徵
- 顏色邊界有時不夠清晰
- 抗鋸齒效果導致顏色數超過預期

### 4. 幾何精度問題
- 陰影被誤判為幾何特徵
- 細長特徵（如尾巴、觸角）容易被簡化

---

## 優化目標

### 短期目標
1. **提高視角一致性**: 確保同一物體在不同角度的比例、特徵一致
2. **改善細節保留**: 在顏色簡化的同時保留重要細節
3. **穩定生成品質**: 減少隨機性，提高可預測性

### 中期目標
1. **優化 H2C 輸出**: 確保生成的模型適合 Bambu Lab 多色列印
2. **智能顏色分配**: 根據物體特徵自動選擇最佳顏色分配

### 長期目標
1. **用戶意圖理解**: 更好地理解 userDescription 並反映在生成結果中
2. **迭代式改進**: 根據 hint 有效調整生成結果

---

## Prompt 使用場景快速參考

| Mode | Mesh Prompt | Texture Prompt |
|------|-------------|----------------|
| **Mode A** (simplified-mesh) | Prompt 1 (7色簡化) | Prompt 4 (全彩) |
| **Mode B** (simplified-texture) | Prompt 2 (全彩) | Prompt 3 (6色簡化) |

---

## 附錄：Gemini API 調用參數

```typescript
{
  contents: [{
    parts: [
      { inline_data: { mime_type: mimeType, data: imageBase64 } },
      { text: prompt }
    ]
  }],
  generationConfig: {
    responseModalities: ['TEXT', 'IMAGE'],
    imageConfig: {
      aspectRatio: '1:1',
      imageSize: '1K'
    }
  }
}
```

---

*文件版本: 2024-12-01*
*適用於: DreamForge Pipeline v2*
