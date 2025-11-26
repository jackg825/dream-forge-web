# Photo-to-3D MVP 產品需求文檔 (PRD)

## 1. 產品概述

### 1.1 產品願景
建立一個 Web 應用程式，讓用戶能夠上傳照片並快速生成可 3D 列印的模型檔案。

### 1.2 目標用戶
- 3D 列印愛好者
- 設計師與創作者
- 電商賣家（客製化商品）
- 教育工作者

### 1.3 核心價值主張
**「一張照片，一個模型，一鍵下載」** - 從照片到可列印 3D 模型的最短路徑。

---

## 2. MVP 範圍定義

### 2.1 In Scope（必須實現）

| 功能 | 優先級 | 說明 |
|------|--------|------|
| 用戶註冊/登入 | P0 | Firebase Auth（Google/Email） |
| 照片上傳 | P0 | 單張照片，支援 JPG/PNG |
| Rodin Gen-2 整合 | P0 | 核心 3D 生成引擎 |
| 模型預覽 | P0 | 3D Viewer（Three.js） |
| 模型下載 | P0 | GLB/OBJ/STL 格式 |
| 生成歷史 | P1 | 查看過去生成的模型 |
| 基本計費 | P1 | Credit 系統 |

### 2.2 Out of Scope（後續版本）

- 多圖輸入生成
- LiDAR 掃描整合
- 即時列印機連接
- 進階模型編輯
- 社群功能
- Nano Banana Pro 整合（Optional Phase 2）

---

## 3. 用戶故事

### 3.1 核心流程

```
用戶故事 #1：照片上傳生成 3D 模型
作為：一個 3D 列印愛好者
我想要：上傳一張物品照片並獲得 3D 模型
以便於：我可以在家用 3D 印表機列印出來

驗收標準：
✅ 用戶可上傳 JPG/PNG 照片（<10MB）
✅ 系統在 2-5 分鐘內生成 3D 模型
✅ 用戶可 360° 預覽模型
✅ 用戶可下載 GLB/OBJ/STL 格式
```

```
用戶故事 #2：帳戶與積分管理
作為：一個註冊用戶
我想要：查看我的積分餘額和生成歷史
以便於：管理我的使用量

驗收標準：
✅ 新用戶獲得 3 次免費生成
✅ 可查看剩餘積分
✅ 可查看歷史生成記錄
✅ 可重新下載過去的模型
```

---

## 4. 功能規格

### 4.1 用戶認證

| 項目 | 規格 |
|------|------|
| 登入方式 | Google OAuth, Email/Password |
| Session | Firebase Auth Token |
| 權限等級 | Free User, Pro User (future) |

### 4.2 照片上傳

| 項目 | 規格 |
|------|------|
| 支援格式 | JPG, JPEG, PNG, WEBP |
| 最大尺寸 | 10MB |
| 最小解析度 | 512x512px |
| 最大解析度 | 4096x4096px |
| 儲存位置 | Firebase Storage |

### 4.3 3D 生成（Rodin Gen-2）

| 項目 | 規格 |
|------|------|
| API | Hyper3D Rodin API v2 |
| Tier | Gen-2 |
| 輸出格式 | GLB (primary), OBJ, FBX |
| 品質等級 | Medium (18k faces) - 可調 |
| 超時設定 | 10 分鐘 |
| 材質 | PBR |

### 4.4 模型預覽

| 項目 | 規格 |
|------|------|
| 渲染引擎 | Three.js |
| 功能 | 360° 旋轉, 縮放, 平移 |
| 光照 | 環境光 + 方向光 |
| 背景 | 可切換（白/灰/黑） |

### 4.5 積分系統

| 項目 | 規格 |
|------|------|
| 免費額度 | 3 credits（新用戶） |
| 生成消耗 | 1 credit / 次 |
| 付費方案 | Phase 2（Stripe 整合） |

---

## 5. 非功能需求

### 5.1 效能

| 指標 | 目標 |
|------|------|
| 頁面載入時間 | < 3 秒 |
| 3D 模型載入 | < 5 秒（<5MB） |
| API 回應時間 | < 500ms（不含生成） |
| 並發用戶 | 100（MVP） |

### 5.2 安全性

- Firebase Security Rules 保護用戶資料
- API Key 僅在後端使用（Cloud Functions）
- 檔案上傳類型驗證
- Rate Limiting（每用戶 10 次/小時）

### 5.3 可用性

- 響應式設計（Desktop + Mobile）
- 支援主流瀏覽器（Chrome, Firefox, Safari, Edge）
- 中英文介面

---

## 6. 技術架構

```
┌─────────────────────────────────────────────────────────────┐
│                      Frontend (React/Next.js)               │
│  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────────┐    │
│  │  Auth   │  │ Upload  │  │ Gallery │  │ 3D Viewer   │    │
│  │  Page   │  │  Page   │  │  Page   │  │ (Three.js)  │    │
│  └────┬────┘  └────┬────┘  └────┬────┘  └──────┬──────┘    │
└───────┼────────────┼────────────┼──────────────┼───────────┘
        │            │            │              │
        ▼            ▼            ▼              ▼
┌─────────────────────────────────────────────────────────────┐
│                    Firebase Services                         │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐  │
│  │    Auth     │  │   Storage   │  │     Firestore       │  │
│  │  (Users)    │  │  (Images/   │  │  (Users, Jobs,      │  │
│  │             │  │   Models)   │  │   Credits, History) │  │
│  └─────────────┘  └─────────────┘  └─────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
        │
        ▼
┌─────────────────────────────────────────────────────────────┐
│                  Cloud Functions (Node.js)                   │
│  ┌─────────────────┐  ┌─────────────────────────────────┐   │
│  │  generateModel  │  │     processRodinWebhook         │   │
│  │  (Trigger)      │  │     (Callback Handler)          │   │
│  └────────┬────────┘  └────────────────┬────────────────┘   │
└───────────┼────────────────────────────┼────────────────────┘
            │                            │
            ▼                            ▼
┌─────────────────────────────────────────────────────────────┐
│                   External APIs                              │
│  ┌─────────────────────────────────────────────────────┐    │
│  │              Rodin Gen-2 API (Hyper3D)              │    │
│  │              https://api.hyper3d.com/api/v2         │    │
│  └─────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────┘
```

---

## 7. 數據模型

### 7.1 Firestore Collections

```javascript
// users/{userId}
{
  uid: string,
  email: string,
  displayName: string,
  photoURL: string,
  credits: number,        // 剩餘積分
  totalGenerated: number, // 總生成數
  createdAt: timestamp,
  updatedAt: timestamp
}

// jobs/{jobId}
{
  userId: string,
  status: 'pending' | 'processing' | 'completed' | 'failed',
  inputImageUrl: string,    // Firebase Storage URL
  outputModelUrl: string,   // Generated model URL
  rodinTaskId: string,      // Rodin API task ID
  settings: {
    tier: 'Gen-2',
    quality: 'medium' | 'high' | 'low',
    format: 'glb' | 'obj' | 'fbx'
  },
  error: string | null,
  createdAt: timestamp,
  completedAt: timestamp | null
}

// transactions/{transactionId}
{
  userId: string,
  type: 'consume' | 'purchase' | 'bonus',
  amount: number,
  jobId: string | null,
  createdAt: timestamp
}
```

---

## 8. API 設計

### 8.1 Cloud Functions Endpoints

| Endpoint | Method | 說明 |
|----------|--------|------|
| `/api/generate` | POST | 啟動 3D 生成任務 |
| `/api/jobs/:id` | GET | 查詢任務狀態 |
| `/api/jobs/:id/download` | GET | 獲取下載連結 |
| `/api/user/credits` | GET | 查詢用戶積分 |
| `/webhook/rodin` | POST | Rodin 回調處理 |

### 8.2 Request/Response 範例

```javascript
// POST /api/generate
// Request
{
  "imageUrl": "gs://bucket/images/xxx.jpg",
  "settings": {
    "quality": "medium",
    "format": "glb"
  }
}

// Response
{
  "success": true,
  "jobId": "job_abc123",
  "estimatedTime": 180 // seconds
}
```

---

## 9. 里程碑與時程

### Phase 1: MVP Core（2 週）
- Week 1: Firebase 設置 + Auth + Storage
- Week 2: Rodin 整合 + 3D Viewer + 下載

### Phase 2: Enhancement（1 週）
- 積分系統完善
- UI/UX 優化
- 錯誤處理強化

### Phase 3: Optional Features（持續）
- Nano Banana Pro 整合
- 多圖生成
- Stripe 付費

---

## 10. 成功指標

| 指標 | 目標（上線 1 個月） |
|------|---------------------|
| 註冊用戶數 | 500 |
| 成功生成數 | 1,000 |
| 生成成功率 | > 90% |
| 平均生成時間 | < 3 分鐘 |
| 用戶回訪率 | > 30% |

---

## 11. 風險與緩解

| 風險 | 影響 | 緩解措施 |
|------|------|----------|
| Rodin API 不穩定 | 高 | 實作重試機制 + 備用提示 |
| 成本超支 | 中 | Rate limiting + 積分控制 |
| 生成品質不佳 | 中 | 提供上傳指南 + 品質提示 |
| 安全漏洞 | 高 | Security Rules + 輸入驗證 |
