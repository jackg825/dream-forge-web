# Dream Forge 成本分析

> 最後更新: 2025-12-03

本文件詳細記錄 Dream Forge 3D 生成流程的各環節成本，用於制定 Credit 定價策略。

---

## 匯率換算標準

> ⚠️ 匯率會波動，請定期更新

| 幣別 | 兌換率 | 備註 |
|------|--------|------|
| USD → TWD | 1 USD = 32 TWD | 美元 → 台幣 |
| RMB → TWD | 1 RMB = 4.4 TWD | 人民幣 → 台幣 |
| RMB → USD | 1 RMB = 0.137 USD | 人民幣 → 美元 |

---

## 流程概覽

```
[上傳圖片] → [Gemini 多視角] → [3D 生成] → [貼圖生成] → [3D 列印]
  Storage      Gemini API      Provider      Provider     Print Service
```

---

## 1. Firebase 基礎設施成本

### 1.1 Hosting (網站託管)

| 項目 | 免費額度 | 超額單價 (USD) | TWD |
|------|----------|----------------|-----|
| 儲存空間 | 10 GB | $0.026/GB | NT$0.83/GB |
| 頻寬傳輸 | 10 GB/月 | $0.15/GB | NT$4.8/GB |

來源: [Firebase Hosting Pricing](https://firebase.google.com/docs/hosting/usage-quotas-pricing)

### 1.2 Cloud Functions (雲端函數)

| 項目 | 免費額度 | 超額單價 (USD) | TWD |
|------|----------|----------------|-----|
| 調用次數 | 2M/月 | $0.40/百萬次 | NT$12.8/百萬次 |
| 計算時間 (GB-sec) | 400K/月 | $0.0000025/GB-sec | - |
| 計算時間 (CPU-sec) | 200K/月 | $0.00001/CPU-sec | - |
| 網路流出 | 5 GB/月 | $0.12/GB | NT$3.84/GB |

來源: [Firebase Functions Pricing](https://firebase.google.com/docs/projects/billing/firebase-pricing-plans)

### 1.3 Firestore (資料庫)

| 項目 | 免費額度 | 超額單價 (USD) | TWD |
|------|----------|----------------|-----|
| 讀取 | 50K/日 | $0.036/10萬次 | NT$1.15/10萬次 |
| 寫入 | 20K/日 | $0.108/10萬次 | NT$3.46/10萬次 |
| 刪除 | 20K/日 | $0.012/10萬次 | NT$0.38/10萬次 |
| 儲存 | 1 GB | $0.108/GB/月 | NT$3.46/GB/月 |

來源: [Firestore Pricing](https://firebase.google.com/docs/firestore/pricing)

### 1.4 Cloud Storage (檔案儲存)

| 項目 | 免費額度 | 超額單價 (USD) | TWD |
|------|----------|----------------|-----|
| 儲存空間 | 5 GB | $0.026/GB | NT$0.83/GB |
| 下載流量 | 1 GB/日 | $0.12/GB | NT$3.84/GB |
| 上傳操作 | 20K/日 | $0.05/萬次 | NT$1.6/萬次 |
| 下載操作 | 50K/日 | $0.004/萬次 | NT$0.13/萬次 |

來源: [Firebase Pricing](https://firebase.google.com/pricing)

### 1.5 Authentication (身份驗證)

| 項目 | 免費額度 | 超額單價 (USD) | TWD |
|------|----------|----------------|-----|
| Email/密碼 | 無限 | 免費 | 免費 |
| 手機簡訊 (SMS) | 10/日 | $0.01-0.06/則 | NT$0.32-1.92/則 |
| 多因素驗證 | 50/日 | $0.06/則 | NT$1.92/則 |

---

## 2. Storage 成本比較: Firebase vs Cloudflare R2

### Cloudflare R2 定價

| 項目 | 免費額度 | 超額單價 (USD) | TWD |
|------|----------|----------------|-----|
| 儲存空間 | 10 GB/月 | **$0.015/GB** | NT$0.48/GB |
| 下載流量 (Egress) | **無限** | **免費** | 免費 |
| Class A 操作 (寫入) | 1M/月 | $4.50/百萬次 | NT$144/百萬次 |
| Class B 操作 (讀取) | 10M/月 | $0.36/百萬次 | NT$11.5/百萬次 |

來源: [Cloudflare R2 Pricing](https://developers.cloudflare.com/r2/pricing/)

### 成本比較表

| 項目 | Firebase Storage | Cloudflare R2 | 節省幅度 |
|------|------------------|---------------|----------|
| 儲存 (/GB/月) | $0.026 (NT$0.83) | $0.015 (NT$0.48) | **42% ↓** |
| 下載流量 (/GB) | $0.12 (NT$3.84) | **$0 (免費)** | **100% ↓** |
| 上傳操作 (/萬次) | $0.05 (NT$1.6) | $0.045 (NT$1.44) | 10% ↓ |
| 下載操作 (/萬次) | $0.004 (NT$0.13) | $0.0036 (NT$0.12) | 10% ↓ |

### 每 Pipeline Storage 成本比較

| 項目 | 用量 | Firebase | Cloudflare R2 |
|------|------|----------|---------------|
| 輸入圖片 | ~2 MB | - | - |
| Gemini 生成圖 (6張) | ~6 MB | - | - |
| GLB 模型 | ~10 MB | - | - |
| **總儲存** | ~20 MB | $0.0005 | $0.0003 |
| **下載流量** (預覽+下載) | ~50 MB | $0.006 | **$0** |
| **每 Pipeline 小計** | - | **$0.007** | **$0.0003** |
| **每 Pipeline 小計 (TWD)** | - | **NT$0.22** | **NT$0.01** |

> 💡 **遷移至 Cloudflare R2 可節省約 95% 的 Storage 成本** (主要來自免費 Egress)

### 月度成本情境模擬

假設每月 1,000 個 Pipeline：

| 項目 | Firebase | Cloudflare R2 | 節省 |
|------|----------|---------------|------|
| 儲存 (20 GB) | $0.52 | $0.30 | $0.22 |
| 下載流量 (50 GB) | $6.00 | $0 | $6.00 |
| 操作費用 | ~$0.05 | ~$0.05 | - |
| **月度總計** | **$6.57** | **$0.35** | **$6.22 (95%)** |
| **月度總計 (TWD)** | **NT$210** | **NT$11** | **NT$199** |

假設每月 10,000 個 Pipeline：

| 項目 | Firebase | Cloudflare R2 | 節省 |
|------|----------|---------------|------|
| 儲存 (200 GB) | $5.20 | $3.00 | $2.20 |
| 下載流量 (500 GB) | $60.00 | $0 | $60.00 |
| 操作費用 | ~$0.50 | ~$0.50 | - |
| **月度總計** | **$65.70** | **$3.50** | **$62.20 (95%)** |
| **月度總計 (TWD)** | **NT$2,102** | **NT$112** | **NT$1,990** |

---

## 3. 完整 Firebase 月度成本估算

### 小型使用場景 (1,000 Pipeline/月)

| 服務 | 用量 | 免費額度 | 超額用量 | 成本 (USD) | TWD |
|------|------|----------|----------|------------|-----|
| Hosting 頻寬 | ~5 GB | 10 GB | 0 | $0 | NT$0 |
| Cloud Functions | ~3K 次 | 2M 次 | 0 | $0 | NT$0 |
| Firestore 讀取 | ~50K 次 | 50K/日 | 0 | $0 | NT$0 |
| Firestore 寫入 | ~5K 次 | 20K/日 | 0 | $0 | NT$0 |
| Cloud Storage | 20 GB | 5 GB | 15 GB | $0.39 | NT$12.5 |
| Storage 流量 | 50 GB | 30 GB/月 | 20 GB | $2.40 | NT$76.8 |
| **月度總計** | - | - | - | **$2.79** | **NT$89** |

### 中型使用場景 (10,000 Pipeline/月)

| 服務 | 用量 | 免費額度 | 超額用量 | 成本 (USD) | TWD |
|------|------|----------|----------|------------|-----|
| Hosting 頻寬 | ~20 GB | 10 GB | 10 GB | $1.50 | NT$48 |
| Cloud Functions | ~30K 次 | 2M 次 | 0 | $0 | NT$0 |
| Firestore 讀取 | ~500K 次 | 1.5M/月 | 0 | $0 | NT$0 |
| Firestore 寫入 | ~50K 次 | 600K/月 | 0 | $0 | NT$0 |
| Cloud Storage | 200 GB | 5 GB | 195 GB | $5.07 | NT$162 |
| Storage 流量 | 500 GB | 30 GB/月 | 470 GB | $56.40 | NT$1,805 |
| **月度總計** | - | - | - | **$62.97** | **NT$2,015** |

### 大型使用場景 (100,000 Pipeline/月)

| 服務 | 用量 | 成本 (USD) | TWD |
|------|------|------------|-----|
| Hosting 頻寬 | ~200 GB | $28.50 | NT$912 |
| Cloud Functions | ~300K 次 | $0 | NT$0 |
| Firestore 讀取 | ~5M 次 | $1.44 | NT$46 |
| Firestore 寫入 | ~500K 次 | $0.54 | NT$17 |
| Cloud Storage | 2 TB | $51.20 | NT$1,638 |
| Storage 流量 | 5 TB | $600.00 | NT$19,200 |
| **月度總計** | - | **$681.68** | **NT$21,813** |

### 使用 Cloudflare R2 優化後

| 場景 | Firebase 原成本 | R2 優化後 | 月省 | 年省 |
|------|-----------------|-----------|------|------|
| 小型 (1K/月) | $2.79 | $0.39 | $2.40 | $28.80 |
| 中型 (10K/月) | $62.97 | $6.57 | $56.40 | $676.80 |
| 大型 (100K/月) | $681.68 | $81.68 | $600.00 | $7,200.00 |

> ⚠️ **結論**: Storage 流量是最大成本來源，遷移 R2 後可節省 **85-95%** 基礎設施成本

---

## 4. Gemini 多視角生成

### 模型資訊

- 圖片分析: `gemini-3-pro-preview` (Gemini 3.0 Pro)
- 圖片生成: `gemini-3-pro-image` (Gemini 3 Pro Image)
- 輸出解析度: 1024x1024 (1K) / 2048x2048 (2K)
- 生成張數: 6 張 (4 mesh + 2 texture)

### 定價結構

#### 圖片分析模型比較

| 模型 | 輸入 (≤200K) | 輸入 (>200K) | 輸出 (≤200K) | 輸出 (>200K) |
|------|--------------|--------------|--------------|--------------|
| **Gemini 3.0 Pro** | $2.00/1M | $4.00/1M | $12.00/1M | $18.00/1M |
| Gemini 2.5 Pro | $1.25/1M | $2.50/1M | $10.00/1M | $15.00/1M |
| Gemini 2.5 Flash | $0.30/1M | - | $2.50/1M | - |

#### 圖片生成模型比較

| 模型 | 1K/2K 圖片 | 4K 圖片 | Batch (1K/2K) |
|------|------------|---------|---------------|
| **Gemini 3.0 Pro Image** | $0.134 | $0.24 | $0.067 |
| Gemini 2.5 Flash Image | $0.039 | - | $0.0195 |

來源: [Gemini API Pricing](https://ai.google.dev/gemini-api/docs/pricing?hl=zh-tw)

### 每 Pipeline 估算 (使用 Gemini 3.0)

| 項目 | 數量 | 成本 |
|------|------|------|
| 輸入分析 (3.0 Pro) | ~2K tokens × 6 | ~$0.024 |
| 輸出圖片 (3.0 Pro Image, 1K) | 6 張 | $0.804 |

**每 Pipeline 成本 (Gemini 3.0): ~$0.83 (約 NT$26)**

### 每 Pipeline 估算 (使用 Gemini 2.5)

| 項目 | 數量 | 成本 |
|------|------|------|
| 輸入分析 (2.5 Pro) | ~2K tokens × 6 | ~$0.015 |
| 輸出圖片 (2.5 Flash Image, 1K) | 6 張 | $0.234 |

**每 Pipeline 成本 (Gemini 2.5): ~$0.25 (約 NT$8)**

---

## 5. 3D 模型生成 (Provider 比較)

### Provider Credit 單價比較

| Provider | 原幣別單價 | USD 換算 | TWD 換算 | 備註 |
|----------|------------|----------|----------|------|
| **Meshy AI** | $0.02/credit | $0.02 | NT$0.64 | USD |
| **Hunyuan 3D** | ¥0.10/credit | $0.014 | NT$0.44 | RMB (預付費) |
| **Rodin Gen-2** | $1.00/credit | $1.00 | NT$32.00 | USD |
| **Tripo3D** | $0.01/credit | $0.01 | NT$0.32 | USD (API) |

### Provider API 定價詳情

#### Meshy AI (USD)

| 任務類型 | Credits | 原價 (USD) | TWD |
|----------|---------|------------|-----|
| Multi-Image-to-3D (mesh only) | 5 | $0.10 | NT$3.2 |
| Multi-Image-to-3D (with texture) | 15 | $0.30 | NT$9.6 |
| Retexture | 10 | $0.20 | NT$6.4 |

> Credit 換算: $20/月 = 1,000 credits → **$0.02/credit**

來源: [Meshy API Pricing](https://docs.meshy.ai/en/api/pricing)

#### Hunyuan 3D v3.0 (RMB)

| 版本 | 基礎積分 | 附加選項 | 總積分 | 原價 (RMB) | TWD |
|------|----------|----------|--------|------------|-----|
| Professional | 15-25 | +10 (多視角/PBR/自訂面數) | 15-55 | ¥1.50-5.50 | NT$6.6-24.2 |
| Express (超快版) | 15 | +10 (多視角/PBR/自訂面數) | 15-45 | ¥1.50-4.50 | NT$6.6-19.8 |

#### 積分價格方案

| 方案 | 原價 (RMB) | USD 換算 | TWD 換算 | 備註 |
|------|------------|----------|----------|------|
| 後付費 | ¥0.12/credit | $0.016 | NT$0.53 | 每日結算 |
| 預付費 1K | ¥0.10/credit | $0.014 | NT$0.44 | ¥100 |
| 預付費 10K | ¥0.098/credit | $0.013 | NT$0.43 | ¥980 |
| 預付費 50K | ¥0.095/credit | $0.013 | NT$0.42 | ¥4,750 |
| 預付費 100K | ¥0.09/credit | $0.012 | NT$0.40 | ¥9,000 |

> 首次開通贈送 100 積分 (1年有效期)

來源: [Hunyuan 3D 計費說明](https://cloud.tencent.com/document/product/1804/123461)

#### Rodin Gen-2 (USD)

| 配置 | Credits | 原價 (USD) | TWD |
|------|---------|------------|-----|
| Base generation | 0.5 | $0.50 | NT$16 |
| + HighPack (4K textures) | 1.5 | $1.50 | NT$48 |

> Credit 換算: $30/月 = 30 credits → **$1.00/credit**

來源: [Hyper3D Pricing](https://hyper3d.ai/subscribe)

#### Tripo3D v3.0 (USD)

| 配置 | Credits | 原價 (USD) | TWD |
|------|---------|------------|-----|
| Standard generation | ~20 | $0.20 | NT$6.4 |
| With texture/refine | ~30 | $0.30 | NT$9.6 |

> API Credit 單價: **$0.01 USD/credit** (NT$0.32/credit)
>
> 注意: Web APP credits 與 API credits 不同 (Web 約 $0.005/credit)

來源: [Tripo3D API Billing](https://platform.tripo3d.ai/docs/billing)

---

## 6. 貼圖生成 (Optional)

| Provider | 方式 | 成本 |
|----------|------|------|
| Meshy | Retexture API | 10 credits (~$0.20) |
| Hunyuan | 包含於 mesh 生成 | - |
| Rodin | 包含於 mesh 生成 | - |
| Tripo | 包含於 mesh 生成 | - |

---

## 7. 3D 列印成本 (Coming Soon)

### 外部服務參考價格

| 列印方式 | 材料成本 | 服務費 | 小型模型 (5cm) |
|----------|----------|--------|----------------|
| FDM (PLA) | $0.02/g | $5-15 | ~$8-15 |
| SLA (Resin) | $0.05/g | $10-25 | ~$15-30 |
| 全彩 (MJF/SLS) | $0.10/g | $20-50 | ~$30-60 |

---

## 8. 完整成本總表

### 每 Pipeline 成本 - Gemini 3.0 (無貼圖)

| 環節 | Meshy | Hunyuan | Rodin | Tripo |
|------|-------|---------|-------|-------|
| Storage | $0.007 | $0.007 | $0.007 | $0.007 |
| Gemini 3.0 (6 views) | $0.830 | $0.830 | $0.830 | $0.830 |
| 3D 生成 | $0.100 | $0.150 | $0.500 | $0.200 |
| **小計 (USD)** | **$0.937** | **$0.987** | **$1.337** | **$1.037** |
| **小計 (TWD)** | **NT$30.0** | **NT$31.6** | **NT$42.8** | **NT$33.2** |

### 每 Pipeline 成本 - Gemini 3.0 (含貼圖)

| 環節 | Meshy | Hunyuan | Rodin | Tripo |
|------|-------|---------|-------|-------|
| 基礎成本 | $0.937 | $0.987 | $1.337 | $1.037 |
| Texture | $0.200 | 包含 | 包含 | 包含 |
| **總計 (USD)** | **$1.137** | **$0.987** | **$1.337** | **$1.037** |
| **總計 (TWD)** | **NT$36.4** | **NT$31.6** | **NT$42.8** | **NT$33.2** |

### 每 Pipeline 成本 - Gemini 2.5 (無貼圖)

| 環節 | Meshy | Hunyuan | Rodin | Tripo |
|------|-------|---------|-------|-------|
| Storage | $0.007 | $0.007 | $0.007 | $0.007 |
| Gemini 2.5 (6 views) | $0.250 | $0.250 | $0.250 | $0.250 |
| 3D 生成 | $0.100 | $0.150 | $0.500 | $0.200 |
| **小計 (USD)** | **$0.357** | **$0.407** | **$0.757** | **$0.457** |
| **小計 (TWD)** | **NT$11.4** | **NT$13.0** | **NT$24.2** | **NT$14.6** |

### 每 Pipeline 成本 - Gemini 2.5 (含貼圖)

| 環節 | Meshy | Hunyuan | Rodin | Tripo |
|------|-------|---------|-------|-------|
| 基礎成本 | $0.357 | $0.407 | $0.757 | $0.457 |
| Texture | $0.200 | 包含 | 包含 | 包含 |
| **總計 (USD)** | **$0.557** | **$0.407** | **$0.757** | **$0.457** |
| **總計 (TWD)** | **NT$17.8** | **NT$13.0** | **NT$24.2** | **NT$14.6** |

### 橫向比較總覽 (每 Pipeline，含貼圖)

| Provider | Gemini 3.0 (USD) | Gemini 3.0 (TWD) | Gemini 2.5 (USD) | Gemini 2.5 (TWD) |
|----------|------------------|------------------|------------------|------------------|
| Meshy | $1.14 | NT$36.4 | $0.56 | NT$17.8 |
| **Hunyuan** | **$0.99** | **NT$31.6** | **$0.41** | **NT$13.0** |
| Rodin | $1.34 | NT$42.8 | $0.76 | NT$24.2 |
| Tripo | $1.04 | NT$33.2 | $0.46 | NT$14.6 |

> 💡 **成本最低**: Hunyuan (RMB 計價優勢) | **性價比推薦**: Tripo (品質/成本平衡)

---

## 9. Credit 定價策略

### 目標利潤率: 30% (基於 Gemini 3.0)

| Provider | 實際成本 (USD) | 實際成本 (TWD) | +30% (USD) | Credit 定價 |
|----------|----------------|----------------|------------|-------------|
| Meshy | $0.94 | NT$30.0 | $1.22 | 10 credits |
| Hunyuan | $0.99 | NT$31.6 | $1.29 | 10 credits |
| Rodin | $1.34 | NT$42.8 | $1.74 | 15 credits |
| Tripo | $1.04 | NT$33.2 | $1.35 | 11 credits |
| Texture (Meshy) | $0.20 | NT$6.4 | $0.26 | 3 credits |

### 建議 Credit 售價

| 數量 | 建議價格 (USD) | 建議價格 (TWD) | 單價 (USD) | 單價 (TWD) |
|------|----------------|----------------|------------|------------|
| 10 credits | $1.30 | NT$42 | $0.13 | NT$4.2 |
| 50 credits | $6.00 | NT$192 | $0.12 | NT$3.84 |
| 100 credits | $11.00 | NT$352 | $0.11 | NT$3.52 |
| 500 credits | $50.00 | NT$1,600 | $0.10 | NT$3.20 |

---

## 10. 程式碼對應

### Frontend Types (`app/src/types/index.ts`)

```typescript
// 基於 Gemini 3.0 成本計算
export const PROVIDER_OPTIONS: Record<ModelProvider, ProviderCapability> = {
  meshy: { creditCost: 10, ... },    // 實際成本 $0.94
  hunyuan: { creditCost: 12, ... },  // 實際成本 $1.09
  rodin: { creditCost: 15, ... },    // 實際成本 $1.34
  tripo: { creditCost: 11, ... },    // 實際成本 $1.04
};
```

### Backend Constants (`functions/src/handlers/pipeline.ts`)

```typescript
const PIPELINE_CREDITS = {
  MESH: 10-15,  // Base cost (varies by provider)
  TEXTURE: 3,   // Meshy Retexture only
} as const;
```

---

## 11. 參考資料

1. [Meshy API Pricing](https://docs.meshy.ai/en/api/pricing)
2. [Rodin Hyper3D Pricing](https://hyper3d.ai/subscribe)
3. [Hunyuan 3D v3.0 計費說明](https://cloud.tencent.com/document/product/1804/123461)
4. [Tripo3D API Billing](https://platform.tripo3d.ai/docs/billing)
5. [Gemini API Pricing](https://ai.google.dev/gemini-api/docs/pricing?hl=zh-tw)
6. [Firebase Pricing](https://firebase.google.com/pricing)
7. [Firebase Hosting Pricing](https://firebase.google.com/docs/hosting/usage-quotas-pricing)
8. [Firebase Functions Pricing](https://firebase.google.com/docs/projects/billing/firebase-pricing-plans)
9. [Firestore Pricing](https://firebase.google.com/docs/firestore/pricing)
10. [Cloudflare R2 Pricing](https://developers.cloudflare.com/r2/pricing/)

---

## 12. 更新歷史

| 日期 | 變更 |
|------|------|
| 2025-12-04 | 新增完整 Firebase 基礎設施成本分析 (Hosting/Functions/Firestore/Storage/Auth)、Cloudflare R2 比較與遷移成本效益分析 |
| 2025-12-03 | 新增匯率換算標準 (USD/RMB/TWD)、所有價格加入原幣別與台幣換算、橫向比較總覽表 |
| 2025-12-03 | 更新 Gemini 3.0/2.5 定價比較、Hunyuan 3D v3.0 積分制度、Tripo3D API $0.01/credit |
| 2025-12-03 | 初始版本，新增 Hunyuan 3D 和 Tripo3D 成本分析 |
