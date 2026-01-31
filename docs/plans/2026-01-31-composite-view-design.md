# Composite View Generation Design

> 單圖多視角生成策略 — 提升 3D 列印成功率

**日期**: 2026-01-31
**狀態**: 已核准
**目標**: 以 Gemini 3 Pro 單次生成 2×2 網格圖，取代現行 4 次獨立呼叫，提升視角一致性

---

## 1. 背景與問題

### 現行架構問題

- 使用 Gemini 2.5 Flash **4 次獨立呼叫**生成 front/back/left/right 視角
- 每次呼叫獨立生成，導致：
  - 顏色偏差
  - 比例不一致
  - 細節差異
- 這些偏差影響 3D 重建品質，降低列印成功率（估計 ~70%）

### 目標

- 提升視角一致性 → 提升列印成功率至 ~85%
- 降低 API 成本 14%
- 減少 API 呼叫次數 75%

---

## 2. 解決方案

### 新架構

```
referenceImage
    ↓
┌─────────────────────────────────────────────┐
│  Gemini 3 Pro × 1 次呼叫                     │
│  └── generateCompositeView() → 2048×2048    │
│      ┌──────────┬──────────┐                │
│      │  FRONT   │  BACK    │                │
│      │  1024²   │  1024²   │                │
│      ├──────────┼──────────┤                │
│      │  LEFT    │  RIGHT   │                │
│      │  1024²   │  1024²   │                │
│      └──────────┴──────────┘                │
└─────────────────────────────────────────────┘
    ↓
裁切成 4 張 1024×1024 圖片（完美一致）
    ↓
Hunyuan3D / HiTem3D
```

### 成本對比

| 指標 | 現行 | 新方案 | 變化 |
|-----|-----|-------|-----|
| 單次成本 | $0.156 | $0.134 | **-14%** |
| API 呼叫 | 4 | 1 | **-75%** |
| 視角一致性 | 中 | 高 | **⬆️** |
| 每視角解析度 | 1024² | 1024² | 不變 |

---

## 3. 技術設計

### 3.1 Prompt 設計

```
Generate a 2×2 grid image showing 4 orthographic views of the SAME subject.

=== GRID LAYOUT (CRITICAL) ===

┌─────────────────┬─────────────────┐
│   TOP-LEFT      │   TOP-RIGHT     │
│   FRONT VIEW    │   BACK VIEW     │
│   (0°)          │   (180°)        │
├─────────────────┼─────────────────┤
│   BOTTOM-LEFT   │   BOTTOM-RIGHT  │
│   LEFT VIEW     │   RIGHT VIEW    │
│   (90°)         │   (270°)        │
└─────────────────┴─────────────────┘

Each quadrant is exactly 1024×1024 pixels.
Total image size: 2048×2048 pixels.

=== CONSISTENCY REQUIREMENTS ===

ALL 4 VIEWS MUST SHOW:
- The EXACT same subject (identical proportions, features, accessories)
- The EXACT same color palette (use identical hex colors)
- The EXACT same art style (cel-shaded, flat colors, no gradients)
- ONLY the camera angle changes between views

=== VIEW SPECIFICATIONS ===

FRONT (top-left): Face/front visible, camera at 6 o'clock
BACK (top-right): Back visible, NO face, camera at 12 o'clock
LEFT (bottom-left): Left profile, nose points LEFT, camera at 3 o'clock
RIGHT (bottom-right): Right profile, nose points RIGHT, camera at 9 o'clock

=== BACKGROUND ===

Each quadrant has pure white (#FFFFFF) background.
Add a 2-pixel light gray (#CCCCCC) border between quadrants for precise cropping.
```

### 3.2 裁切邏輯

```typescript
interface CropResult {
  front: Buffer;   // 左上 (0, 0) → (1024, 1024)
  back: Buffer;    // 右上 (1024, 0) → (2048, 1024)
  left: Buffer;    // 左下 (0, 1024) → (1024, 2048)
  right: Buffer;   // 右下 (1024, 1024) → (2048, 2048)
}

async function cropCompositeView(
  compositeImage: Buffer,
  expectedSize: number = 2048
): Promise<CropResult> {
  const halfSize = expectedSize / 2;  // 1024

  return {
    front: await sharp(compositeImage)
      .extract({ left: 0, top: 0, width: halfSize, height: halfSize })
      .toBuffer(),
    back: await sharp(compositeImage)
      .extract({ left: halfSize, top: 0, width: halfSize, height: halfSize })
      .toBuffer(),
    left: await sharp(compositeImage)
      .extract({ left: 0, top: halfSize, width: halfSize, height: halfSize })
      .toBuffer(),
    right: await sharp(compositeImage)
      .extract({ left: halfSize, top: halfSize, width: halfSize, height: halfSize })
      .toBuffer(),
  };
}
```

### 3.3 錯誤處理

**策略：單次嘗試，失敗即停**

| 錯誤類型 | 結果 |
|---------|------|
| Gemini API 錯誤 | ❌ 直接報錯 |
| 安全過濾 | ❌ 直接報錯 |
| 超時 | ❌ 直接報錯 |
| 尺寸不對 | ✅ 自動縮放（唯一自動修復）|

```typescript
async function generateCompositeView(
  reference: string,
  mimeType: string,
  options: GenerationOptions
): Promise<CropResult> {
  // 1. 生成 composite 圖片
  const composite = await callGemini3Pro(reference, mimeType, options);

  // 2. 驗證並調整尺寸（僅此一步自動修復）
  const metadata = await sharp(composite).metadata();
  let finalImage = composite;

  if (metadata.width !== 2048 || metadata.height !== 2048) {
    logger.info(`Resizing: ${metadata.width}×${metadata.height} → 2048×2048`);
    finalImage = await sharp(composite)
      .resize(2048, 2048, { fit: 'fill' })
      .toBuffer();
  }

  // 3. 裁切並返回
  return cropCompositeView(finalImage);
}
```

**成本控制**：每次請求固定 **$0.134**，無重試、無 fallback。

---

## 4. 檔案變更

### 新增檔案

| 檔案 | 用途 |
|-----|------|
| `functions/src/gemini/composite-view-generator.ts` | Gemini 3 Pro 2×2 網格生成 |
| `functions/src/gemini/image-cropper.ts` | Sharp 裁切邏輯 |

### 修改檔案

| 檔案 | 變更 |
|-----|------|
| `functions/src/handlers/pipeline.ts` | 呼叫 composite generator 取代 multi-view |
| `functions/src/gemini/mode-configs.ts` | 新增 composite prompt 模板 |

### 棄用檔案

| 檔案 | 狀態 |
|-----|------|
| `functions/src/gemini/multi-view-generator.ts` | 保留但不再使用（未來可刪除）|

---

## 5. 3D Provider 整合

### Hunyuan3D

- 輸入：4 張獨立 Buffer/URL（front + MultiViewImages: back/left/right）
- 無需修改整合邏輯，只改變圖片來源

### HiTem3D

- 輸入：4 張獨立 Buffer via `multi_images`
- 無需修改整合邏輯，只改變圖片來源

---

## 6. 預估工作量

```
composite-view-generator.ts  — 新增 ~150 行
image-cropper.ts             — 新增 ~50 行
pipeline.ts                  — 修改 ~30 行
mode-configs.ts              — 修改 ~50 行
─────────────────────────────────────────
總計                          ~280 行程式碼
```

---

## 7. 驗收標準

- [ ] Gemini 3 Pro 成功生成 2048×2048 的 2×2 網格圖
- [ ] 裁切後 4 張圖片尺寸均為 1024×1024
- [ ] 4 個視角風格、顏色、比例一致
- [ ] 成功送入 Hunyuan3D / HiTem3D 進行 3D 重建
- [ ] 單次 API 成本 ≤ $0.134

---

*設計完成於 2026-01-31*
