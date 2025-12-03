# Dream Forge 成本分析

> 最後更新: 2025-12-03

本文件詳細記錄 Dream Forge 3D 生成流程的各環節成本，用於制定 Credit 定價策略。

## 流程概覽

```
[上傳圖片] → [Gemini 多視角] → [3D 生成] → [貼圖生成] → [3D 列印]
  Storage      Gemini API      Provider      Provider     Print Service
```

---

## 1. Storage (Firebase Cloud Storage)

### 定價結構

| 項目 | 單價 | 來源 |
|------|------|------|
| 儲存空間 | $0.026/GB | [Firebase Pricing](https://firebase.google.com/pricing) |
| 下載流量 | $0.12/GB | [Firebase Pricing](https://firebase.google.com/pricing) |
| 上傳操作 | $0.05/10K ops | [Firebase Pricing](https://firebase.google.com/pricing) |
| 下載操作 | $0.004/10K ops | [Firebase Pricing](https://firebase.google.com/pricing) |

### 每 Pipeline 估算

| 項目 | 用量 | 成本 |
|------|------|------|
| 輸入圖片 | ~2 MB | - |
| Gemini 生成圖 (6張) | ~6 MB | - |
| GLB 模型 | ~10 MB | - |
| **總儲存** | ~20 MB | $0.0005 |
| **下載流量** (預覽+下載) | ~50 MB | $0.006 |

**每 Pipeline 成本: ~$0.007 (約 NT$0.22)**

---

## 2. Gemini 多視角生成

### 模型資訊

- 使用模型: `gemini-3-pro-image-preview` (Gemini 2.5 Flash Image)
- 輸出解析度: 1024x1024 (1K)
- 生成張數: 6 張 (4 mesh + 2 texture)

### 定價結構

| 項目 | Token 數 | 單價 | 每圖成本 |
|------|----------|------|----------|
| 輸入圖片 | 560 tokens | $0.002/1K tokens | $0.0011 |
| 輸出圖片 (1K) | 1,290 tokens | $30/1M tokens | $0.039 |

來源: [Gemini API Pricing](https://ai.google.dev/gemini-api/docs/pricing)

### 每 Pipeline 估算

| 項目 | 數量 | 成本 |
|------|------|------|
| 輸入 (參考圖 × 6 次呼叫) | 6 | $0.0066 |
| 輸出 (生成圖) | 6 | $0.234 |

**每 Pipeline 成本: ~$0.24 (約 NT$7.5)**

---

## 3. 3D 模型生成 (Provider 比較)

### Provider API 定價

#### Meshy AI

| 任務類型 | Credits | 估算 USD |
|----------|---------|----------|
| Multi-Image-to-3D (mesh only) | 5 | $0.10 |
| Multi-Image-to-3D (with texture) | 15 | $0.30 |
| Retexture | 10 | $0.20 |

> Credit 換算: $20/月 = 1,000 credits → $0.02/credit

來源: [Meshy API Pricing](https://docs.meshy.ai/en/api/pricing)

#### Hunyuan 3D (騰訊雲)

| 版本 | 積分 | 價格 (RMB) | 估算 USD |
|------|------|------------|----------|
| Professional + Standard | 20 | ¥2.40 | $0.33 |
| Professional + PBR | 30 | ¥3.60 | $0.50 |
| Express | 15 | ¥1.80 | $0.25 |

> 積分價格: ¥0.12/point (後付費) 或 ¥0.10/point (預付費)

來源: [Hunyuan 3D 計費說明](https://cloud.tencent.com/document/product/1804/123461)

#### Rodin Gen-2 (Hyper3D)

| 配置 | Credits | 估算 USD |
|------|---------|----------|
| Base generation | 0.5 | $0.50 |
| + HighPack (4K textures) | 1.5 | $1.50 |

> Credit 換算: $30/月 = 30 credits → $1.00/credit

來源: [Hyper3D Pricing](https://hyper3d.ai/subscribe)

#### Tripo3D

| 配置 | Credits | 估算 USD |
|------|---------|----------|
| Standard generation | ~30 | ~$0.16 |

> 注意: API 定價未公開，基於 $15.9/月 = 3,000 credits 估算

來源: [Tripo3D Pricing](https://www.tripo3d.ai/pricing)

---

## 4. 貼圖生成 (Optional)

| Provider | 方式 | 成本 |
|----------|------|------|
| Meshy | Retexture API | 10 credits (~$0.20) |
| Hunyuan | 包含於 mesh 生成 | - |
| Rodin | 包含於 mesh 生成 | - |
| Tripo | 包含於 mesh 生成 | - |

---

## 5. 3D 列印成本 (Coming Soon)

### 外部服務參考價格

| 列印方式 | 材料成本 | 服務費 | 小型模型 (5cm) |
|----------|----------|--------|----------------|
| FDM (PLA) | $0.02/g | $5-15 | ~$8-15 |
| SLA (Resin) | $0.05/g | $10-25 | ~$15-30 |
| 全彩 (MJF/SLS) | $0.10/g | $20-50 | ~$30-60 |

---

## 完整成本總表

### 每 Pipeline 成本 (無貼圖)

| 環節 | Meshy | Hunyuan | Rodin | Tripo |
|------|-------|---------|-------|-------|
| Storage | $0.007 | $0.007 | $0.007 | $0.007 |
| Gemini (6 views) | $0.240 | $0.240 | $0.240 | $0.240 |
| 3D 生成 | $0.100 | $0.330 | $0.500 | $0.160 |
| **小計** | **$0.347** | **$0.577** | **$0.747** | **$0.407** |

### 每 Pipeline 成本 (含貼圖)

| 環節 | Meshy | Hunyuan | Rodin | Tripo |
|------|-------|---------|-------|-------|
| 基礎成本 | $0.347 | $0.577 | $0.747 | $0.407 |
| Texture | $0.200 | 包含 | 包含 | 包含 |
| **總計** | **$0.547** | **$0.577** | **$0.747** | **$0.407** |

---

## Credit 定價策略

### 目標利潤率: 30%

| Provider | 實際成本 | +30% | Credit 定價 | Credit 單價 |
|----------|----------|------|-------------|-------------|
| Meshy | $0.35 | $0.455 | 5 | $0.091 |
| Hunyuan | $0.58 | $0.754 | 6 | $0.126 |
| Rodin | $0.75 | $0.975 | 8 | $0.122 |
| Tripo | $0.41 | $0.533 | 5 | $0.107 |
| Texture (Meshy) | $0.20 | $0.260 | 10 | $0.026 |

### 建議 Credit 售價

| 數量 | 建議價格 | 單價 |
|------|----------|------|
| 10 credits | $1.00 | $0.10 |
| 50 credits | $4.50 | $0.09 |
| 100 credits | $8.00 | $0.08 |
| 500 credits | $35.00 | $0.07 |

---

## 程式碼對應

### Frontend Types (`app/src/types/index.ts`)

```typescript
export const PROVIDER_OPTIONS: Record<ModelProvider, ProviderCapability> = {
  meshy: { creditCost: 5, ... },    // 實際成本 $0.35
  hunyuan: { creditCost: 6, ... },  // 實際成本 $0.58
  rodin: { creditCost: 8, ... },    // 實際成本 $0.75
  tripo: { creditCost: 5, ... },    // 實際成本 $0.41
};
```

### Backend Constants (`functions/src/handlers/pipeline.ts`)

```typescript
const PIPELINE_CREDITS = {
  MESH: 5,      // Base cost (varies by provider)
  TEXTURE: 10,  // Meshy Retexture only
} as const;
```

---

## 參考資料

1. [Meshy API Pricing](https://docs.meshy.ai/en/api/pricing)
2. [Rodin Hyper3D Pricing](https://hyper3d.ai/subscribe)
3. [Hunyuan 3D 計費說明](https://cloud.tencent.com/document/product/1804/123461)
4. [Tripo3D Pricing](https://www.tripo3d.ai/pricing)
5. [Gemini API Pricing](https://ai.google.dev/gemini-api/docs/pricing)
6. [Firebase Pricing](https://firebase.google.com/pricing)

---

## 更新歷史

| 日期 | 變更 |
|------|------|
| 2025-12-03 | 初始版本，新增 Hunyuan 3D 和 Tripo3D 成本分析 |
