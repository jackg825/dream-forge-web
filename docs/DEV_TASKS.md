# 開發任務清單 (Development Tasks)

> 🎯 **使用指南**：此文檔設計為可直接用於 Claude Code 開發。每個任務包含明確的輸入/輸出和驗收標準。

---

## Phase 0: 專案初始化

### Task 0.1: Firebase 專案設置
```
優先級: P0
預估時間: 30 分鐘
依賴: 無

輸入:
- Firebase Console 存取權限
- Google Cloud 帳號

輸出:
- Firebase 專案已建立
- 啟用服務: Auth, Firestore, Storage, Functions, Hosting
- 專案 ID 和配置

指令:
1. 前往 https://console.firebase.google.com
2. 建立新專案 "photo-to-3d-mvp"
3. 啟用以下服務:
   - Authentication (Google + Email/Password)
   - Cloud Firestore (asia-east1)
   - Cloud Storage (asia-east1)
   - Cloud Functions (Node.js 18)
   - Hosting

驗收標準:
✅ 可以獲取 Firebase 配置
✅ 可以在本地使用 firebase-tools CLI
```

### Task 0.2: 本地開發環境初始化
```
優先級: P0
預估時間: 45 分鐘
依賴: Task 0.1

指令給 Claude Code:
---
請幫我初始化 Firebase + Next.js 專案結構：

1. 建立專案目錄結構：
photo-to-3d-mvp/
├── app/                    # Next.js 14 App Router
├── functions/              # Cloud Functions
├── firebase.json
├── firestore.rules
├── storage.rules
└── .firebaserc

2. 初始化 Next.js (app/ 目錄):
- 使用 TypeScript
- 使用 Tailwind CSS
- 使用 App Router
- 安裝依賴: firebase, @react-three/fiber, @react-three/drei, three, zustand, @tanstack/react-query

3. 初始化 Cloud Functions (functions/ 目錄):
- 使用 TypeScript
- 安裝依賴: firebase-admin, firebase-functions, axios, form-data

4. 設置 Firebase 配置文件

請生成所有必要的配置檔案。
---

驗收標準:
✅ npm run dev 可以啟動 Next.js
✅ cd functions && npm run build 無錯誤
✅ firebase emulators:start 可以啟動
```

---

## Phase 1: 認證與用戶系統

### Task 1.1: Firebase Auth 設置
```
優先級: P0
預估時間: 1 小時
依賴: Task 0.2

指令給 Claude Code:
---
請實作 Firebase Authentication 整合：

1. 建立 lib/firebase.ts - Firebase 初始化
2. 建立 lib/auth.ts - Auth 相關函式
3. 建立 hooks/useAuth.ts - Auth React Hook
4. 建立 context/AuthContext.tsx - Auth Provider

需要功能：
- Google 登入
- Email/Password 登入
- 登出
- 監聽 auth state 變化
- 自動重導向（未登入 -> /auth）

請使用 Firebase SDK v10+ 的 modular API。
---

驗收標準:
✅ 可以使用 Google 登入
✅ 可以使用 Email 註冊/登入
✅ useAuth() hook 返回正確的用戶狀態
✅ 未登入時自動導向登入頁
```

### Task 1.2: 登入/註冊頁面 UI
```
優先級: P0
預估時間: 1.5 小時
依賴: Task 1.1

指令給 Claude Code:
---
請建立登入/註冊頁面 app/auth/page.tsx：

設計要求：
- 簡潔現代風格，使用 Tailwind CSS
- 居中卡片式設計
- 包含：
  1. Logo/標題區
  2. Google 登入按鈕（主要）
  3. 分隔線 "或使用 Email"
  4. Email 輸入框
  5. Password 輸入框
  6. 登入/註冊切換
  7. 錯誤訊息顯示
- 響應式設計
- 載入狀態處理

請同時建立相關的 UI 組件。
---

驗收標準:
✅ 頁面視覺美觀
✅ 可以切換登入/註冊模式
✅ 表單驗證正常
✅ 錯誤訊息正確顯示
✅ 載入時顯示 loading 狀態
```

### Task 1.3: 用戶初始化 Cloud Function
```
優先級: P0
預估時間: 45 分鐘
依賴: Task 1.1

指令給 Claude Code:
---
請建立 Cloud Function 在用戶首次註冊時初始化用戶資料：

functions/src/handlers/users.ts:

1. onUserCreate - Auth onCreate 觸發器
   - 在 Firestore users/{uid} 建立文檔
   - 初始化資料：
     {
       uid: string,
       email: string,
       displayName: string,
       photoURL: string,
       credits: 3,           // 免費積分
       totalGenerated: 0,
       createdAt: timestamp,
       updatedAt: timestamp
     }

2. 錯誤處理與日誌

請同時更新 functions/src/index.ts 匯出此函式。
---

驗收標準:
✅ 新用戶註冊後自動建立 Firestore 文檔
✅ 預設 3 積分
✅ 函式日誌正常
```

---

## Phase 2: 圖片上傳

### Task 2.1: 上傳組件開發
```
優先級: P0
預估時間: 2 小時
依賴: Task 1.2

指令給 Claude Code:
---
請建立圖片上傳組件 components/upload/ImageUploader.tsx：

功能需求：
1. 拖放上傳區域
2. 點擊選擇檔案
3. 支援 JPG/PNG/WEBP
4. 檔案大小限制 10MB
5. 最小解析度檢查 512x512
6. 上傳前預覽
7. 上傳進度顯示
8. 上傳到 Firebase Storage (uploads/{userId}/{timestamp}_{filename})
9. 上傳完成回調，返回 storage path

UI 要求：
- 虛線邊框上傳區
- 圖標 + 文字提示
- 拖放時高亮
- 預覽圖顯示
- 進度條動畫
- 錯誤提示

請同時建立相關的工具函式 lib/storage.ts。
---

驗收標準:
✅ 可以拖放上傳圖片
✅ 可以點擊選擇檔案
✅ 顯示上傳進度
✅ 上傳完成顯示預覽
✅ 檔案驗證正常
✅ 錯誤訊息友善
```

### Task 2.2: 首頁上傳區塊
```
優先級: P0  
預估時間: 1 小時
依賴: Task 2.1

指令給 Claude Code:
---
請建立首頁 app/page.tsx，整合上傳功能：

頁面結構：
1. Header
   - Logo
   - 用戶頭像/登入按鈕
   - 積分顯示

2. Hero Section
   - 標題: "一張照片，一個 3D 模型"
   - 副標題
   - ImageUploader 組件

3. 流程說明區
   - 3 步驟圖示說明

4. Footer

上傳後流程：
- 顯示已上傳圖片
- 顯示品質選項（High/Medium/Low）
- "開始生成" 按鈕
- 導向生成進度頁

請確保響應式設計。
---

驗收標準:
✅ 首頁視覺完整
✅ 上傳流程順暢
✅ 可以選擇品質選項
✅ 點擊生成後正確導向
```

---

## Phase 3: Rodin API 整合

### Task 3.1: Rodin Client 實作
```
優先級: P0
預估時間: 2 小時
依賴: Task 0.2

指令給 Claude Code:
---
請實作 Rodin Gen-2 API 客戶端 functions/src/rodin/client.ts：

類別: RodinClient

方法:
1. constructor(apiKey: string)

2. async generateModel(imageBuffer: Buffer, options: {
     prompt?: string;
     quality?: 'high' | 'medium' | 'low';
     format?: 'glb' | 'obj' | 'fbx' | 'stl';
   }): Promise<{ taskId: string; subscriptionKey: string }>
   
   - 使用 multipart/form-data
   - tier = 'Gen-2'
   - material = 'PBR'
   - quality_override 對應面數

3. async checkStatus(subscriptionKey: string): Promise<{
     status: 'Pending' | 'Processing' | 'Done' | 'Failed';
     progress?: number;
     result?: { model_url: string };
     error?: string;
   }>

4. async downloadModel(taskId: string): Promise<Buffer>

API 端點: https://api.hyper3d.com/api/v2

請同時建立 types.ts 定義所有型別。
包含錯誤處理和重試邏輯。
---

驗收標準:
✅ 可以呼叫 Rodin API 生成模型
✅ 可以查詢任務狀態
✅ 可以下載生成的模型
✅ 錯誤處理完善
✅ TypeScript 型別完整
```

### Task 3.2: generateModel Cloud Function
```
優先級: P0
預估時間: 2 小時
依賴: Task 3.1

指令給 Claude Code:
---
請實作 generateModel Cloud Function：

functions/src/handlers/generate.ts

1. 驗證用戶身份
2. 檢查積分是否足夠
3. 建立 jobs/{jobId} 文檔
4. 從 Storage 下載用戶上傳的圖片
5. 呼叫 Rodin API 啟動生成
6. 更新 job 狀態為 'processing'
7. 扣除 1 積分
8. 建立 transaction 記錄
9. 返回 jobId

使用 Firebase Functions Callable:
- Region: asia-east1
- Timeout: 540 seconds
- Memory: 1GB
- Secrets: RODIN_API_KEY

錯誤處理:
- 未認證 -> unauthenticated
- 積分不足 -> resource-exhausted
- API 錯誤 -> internal

請同時更新 index.ts。
---

驗收標準:
✅ 可以從前端呼叫 generateModel
✅ 積分正確扣除
✅ Job 記錄正確建立
✅ 錯誤時回滾積分
```

### Task 3.3: checkJobStatus Cloud Function
```
優先級: P0
預估時間: 1.5 小時
依賴: Task 3.2

指令給 Claude Code:
---
請實作 checkJobStatus Cloud Function：

functions/src/handlers/jobs.ts

功能:
1. 驗證用戶身份和 job 所有權
2. 如果 job.status === 'processing':
   - 呼叫 Rodin API 查詢狀態
   - 如果 Done:
     - 下載模型
     - 儲存到 Storage (models/{userId}/{jobId}.{format})
     - 生成 signed URL (7天有效)
     - 更新 job 為 'completed'
   - 如果 Failed:
     - 更新 job 為 'failed'
   - 如果仍在處理:
     - 返回 progress
3. 返回最新狀態

返回格式:
{
  status: 'pending' | 'processing' | 'completed' | 'failed',
  progress?: number,       // 0-100
  modelUrl?: string,       // 完成時
  error?: string           // 失敗時
}
---

驗收標準:
✅ 可以查詢任務狀態
✅ 完成時自動下載並儲存模型
✅ 返回正確的進度資訊
```

---

## Phase 4: 3D 預覽器

### Task 4.1: Three.js Viewer 組件
```
優先級: P0
預估時間: 2.5 小時
依賴: Task 0.2

指令給 Claude Code:
---
請建立 3D 模型預覽組件 components/viewer/ModelViewer.tsx：

使用 @react-three/fiber 和 @react-three/drei

功能:
1. 載入 GLB/OBJ 模型
2. 360° 軌道控制 (OrbitControls)
3. 縮放限制 (1-20)
4. 平移支援
5. 環境光 + 方向光
6. Studio 環境貼圖
7. 模型自動置中 (Center)
8. 載入中顯示 Loading
9. 背景色切換 (白/灰/黑)
10. 全螢幕模式

Props:
- modelUrl: string
- backgroundColor?: string
- onLoad?: () => void
- onError?: (error: Error) => void

請同時建立:
- components/viewer/ViewerControls.tsx (背景切換、全螢幕按鈕)
- components/viewer/LoadingSpinner.tsx
---

驗收標準:
✅ 可以載入和顯示 GLB 模型
✅ 可以旋轉、縮放、平移
✅ 背景色可切換
✅ 全螢幕模式正常
✅ 載入動畫流暢
```

### Task 4.2: 生成進度頁面
```
優先級: P0
預估時間: 2 小時
依賴: Task 3.3, Task 4.1

指令給 Claude Code:
---
請建立生成進度頁面 app/viewer/[jobId]/page.tsx：

頁面狀態:
1. Loading - 載入 job 資料
2. Pending - 等待開始
3. Processing - 生成中 (顯示進度)
4. Completed - 完成 (顯示 3D 預覽 + 下載)
5. Failed - 失敗 (顯示錯誤 + 重試)

Processing 狀態 UI:
- 動畫進度環
- 進度百分比
- 預估剩餘時間
- 原圖預覽
- "生成中，請稍候..."

Completed 狀態 UI:
- ModelViewer 組件
- ViewerControls
- 下載按鈕 (GLB/OBJ/STL)
- 返回首頁按鈕
- 分享按鈕（複製連結）

輪詢邏輯:
- 每 5 秒查詢一次 checkJobStatus
- 完成或失敗時停止輪詢
- 使用 React Query 的 polling

請確保良好的錯誤處理。
---

驗收標準:
✅ 正確顯示各狀態 UI
✅ 進度更新流暢
✅ 完成後正確顯示 3D 模型
✅ 可以下載模型
✅ 錯誤處理友善
```

---

## Phase 5: 用戶儀表板

### Task 5.1: 儀表板頁面
```
優先級: P1
預估時間: 2 小時
依賴: Phase 4

指令給 Claude Code:
---
請建立用戶儀表板 app/dashboard/page.tsx：

頁面區塊:
1. Header (同首頁)

2. 用戶資訊卡片
   - 頭像、名稱、Email
   - 當前積分
   - 總生成數
   - 加入日期

3. 快速操作
   - "新增生成" 按鈕
   - "查看歷史" 按鈕

4. 最近生成 (3個)
   - 縮圖 + 狀態 + 日期
   - 點擊進入預覽頁

5. 統計圖表 (可選)
   - 本週生成數量

佈局:
- 左側: 用戶資訊
- 右側: 快速操作 + 最近生成
- 響應式: 小螢幕為上下排列
---

驗收標準:
✅ 正確顯示用戶資訊
✅ 積分即時更新
✅ 最近生成正確顯示
✅ 導航連結正常
```

### Task 5.2: 生成歷史頁面
```
優先級: P1
預估時間: 1.5 小時
依賴: Task 5.1

指令給 Claude Code:
---
請建立生成歷史頁面 app/dashboard/history/page.tsx：

功能:
1. 分頁載入 jobs 列表
2. 按日期降序排列
3. 篩選: 全部/已完成/處理中/失敗

Job 卡片:
- 縮圖（原圖）
- 狀態標籤（顏色區分）
- 建立時間
- 設定（品質、格式）
- 操作按鈕:
  - 查看 (->預覽頁)
  - 下載 (completed only)
  - 刪除

空狀態:
- 無記錄時顯示引導

使用 Firestore 查詢:
- where userId == currentUser.uid
- orderBy createdAt desc
- limit 10 + 分頁
---

驗收標準:
✅ 正確載入歷史記錄
✅ 分頁正常工作
✅ 篩選功能正常
✅ 操作按鈕功能正確
```

---

## Phase 6: 積分系統

### Task 6.1: 積分顯示組件
```
優先級: P1
預估時間: 45 分鐘
依賴: Task 1.3

指令給 Claude Code:
---
請建立積分顯示組件 components/credits/CreditBadge.tsx：

功能:
1. 顯示當前積分數量
2. 即時監聽 Firestore 更新
3. 積分變化時動畫效果
4. 點擊展開積分詳情

UI:
- 硬幣圖標 + 數字
- 低積分時警告色（≤1）
- 無積分時禁用色 + 提示

使用 Firestore onSnapshot 監聽。

請同時建立 hooks/useCredits.ts。
---

驗收標準:
✅ 即時顯示積分
✅ 積分變化時有動畫
✅ 低積分/無積分提示正常
```

### Task 6.2: 積分不足處理
```
優先級: P1
預估時間: 1 小時
依賴: Task 6.1

指令給 Claude Code:
---
請實作積分不足時的處理流程：

1. 建立 components/credits/NoCreditsModal.tsx
   - 顯示積分不足訊息
   - "稍後開放購買" 提示
   - 關閉按鈕

2. 修改生成流程
   - 點擊生成前檢查積分
   - 積分不足時顯示 Modal
   - 禁用生成按鈕

3. generateModel 返回 resource-exhausted 時
   - 顯示友善錯誤訊息
   - 不扣除積分

UI 要求:
- Modal 背景半透明遮罩
- 居中卡片
- 適當動畫
---

驗收標準:
✅ 積分不足時無法生成
✅ 友善的提示訊息
✅ 不會誤扣積分
```

---

## Phase 7: 部署與測試

### Task 7.1: 環境變數配置
```
優先級: P0
預估時間: 30 分鐘
依賴: Task 3.1

指令給 Claude Code:
---
請設置生產環境變數:

1. Firebase Functions 密鑰設置:
firebase functions:secrets:set RODIN_API_KEY

2. 建立 app/.env.local.example 範本

3. 建立 app/.env.production 配置

4. 更新 .gitignore 確保不提交敏感資訊

5. 建立 README 說明環境變數設置
---

驗收標準:
✅ 本地開發可正常使用 API
✅ 部署後 Functions 可讀取密鑰
✅ 敏感資訊不在版控中
```

### Task 7.2: 部署腳本
```
優先級: P1
預估時間: 1 小時
依賴: All previous tasks

指令給 Claude Code:
---
請建立部署腳本和文檔:

1. scripts/deploy.sh
   - 建置 Functions
   - 建置 Next.js
   - 部署到 Firebase

2. scripts/deploy-functions.sh
   - 僅部署 Functions

3. scripts/deploy-hosting.sh
   - 僅部署 Hosting

4. package.json scripts:
   - "deploy": "sh scripts/deploy.sh"
   - "deploy:functions": "..."
   - "deploy:hosting": "..."

5. DEPLOYMENT.md 文檔
   - 前置要求
   - 步驟說明
   - 常見問題

6. GitHub Actions workflow (可選)
   - main 分支自動部署
---

驗收標準:
✅ 一鍵部署腳本可用
✅ 部署文檔完整
✅ 部署後網站可訪問
```

### Task 7.3: 測試清單
```
優先級: P1
預估時間: 2 小時

手動測試清單:

認證流程:
□ Google 登入
□ Email 註冊
□ Email 登入
□ 登出
□ 未登入重導向

上傳功能:
□ 拖放上傳
□ 點擊上傳
□ 檔案類型驗證
□ 檔案大小驗證
□ 上傳進度顯示
□ 上傳成功預覽

生成流程:
□ 積分檢查
□ 生成啟動
□ 進度顯示
□ 完成通知
□ 失敗處理
□ 積分扣除

3D 預覽:
□ 模型載入
□ 旋轉控制
□ 縮放控制
□ 背景切換
□ 下載 GLB
□ 下載 OBJ

用戶功能:
□ 積分顯示
□ 歷史記錄
□ 重新下載

響應式:
□ Desktop (1920x1080)
□ Tablet (768x1024)
□ Mobile (375x812)

效能:
□ 首頁載入 < 3秒
□ 模型載入 < 5秒
```

---

## 可選: Phase 8 - Gemini/Nano Banana Pro 整合

### Task 8.1: Gemini API 整合（圖像預處理）
```
優先級: P2 (Optional)
預估時間: 3 小時
依賴: Phase 3

指令給 Claude Code:
---
請整合 Gemini 3 Pro (Nano Banana Pro) 用於圖像預處理：

functions/src/gemini/client.ts

功能:
1. 圖像背景移除
2. 生成多視角參考圖（正面、45°、側面）
3. 圖像品質增強

用途:
- 在發送給 Rodin 前預處理用戶圖片
- 改善單張圖片的 3D 生成品質

API: https://generativelanguage.googleapis.com/v1beta/models/gemini-3-pro

注意: 這是可選功能，先確保核心流程穩定。
---
```

### Task 8.2: 進階設置 UI
```
優先級: P2 (Optional)
預估時間: 2 小時

指令給 Claude Code:
---
請新增進階生成設置 UI：

components/upload/AdvancedSettings.tsx

可選設置:
1. AI 引擎選擇
   - Rodin Gen-2 (預設)
   - Rodin + Gemini 預處理

2. 品質設置
   - 快速 (Low, ~1分鐘)
   - 標準 (Medium, ~3分鐘)
   - 精細 (High, ~5分鐘)

3. 輸出格式
   - GLB (推薦)
   - OBJ + MTL
   - STL (純幾何)
   - FBX

4. 文字提示 (可選)
   - 描述物體材質、風格等

摺疊式面板，預設收起。
---
```

---

## 快速啟動命令

### 給 Claude Code 的初始化指令

```
我要建立一個 Photo-to-3D MVP 專案，使用 Firebase + Next.js + Rodin Gen-2 API。

請按照以下步驟幫我初始化專案：

1. 建立專案結構:
photo-to-3d-mvp/
├── app/                    # Next.js 14
├── functions/              # Cloud Functions
├── firebase.json
├── firestore.rules
├── storage.rules

2. 初始化 Next.js (TypeScript + Tailwind + App Router)

3. 初始化 Cloud Functions (TypeScript)

4. 設置 Firebase 配置

5. 建立基本的目錄結構:
- app/src/lib/          # 工具函式
- app/src/hooks/        # React Hooks
- app/src/components/   # UI 組件
- app/src/app/          # 頁面路由
- functions/src/rodin/  # Rodin API 客戶端
- functions/src/handlers/ # Cloud Functions

完成後，請告訴我下一步需要做什麼。
```

---

## 任務追蹤表

| 任務 | 狀態 | 開始日期 | 完成日期 | 備註 |
|------|------|----------|----------|------|
| Task 0.1 | ⬜ | | | |
| Task 0.2 | ⬜ | | | |
| Task 1.1 | ⬜ | | | |
| Task 1.2 | ⬜ | | | |
| Task 1.3 | ⬜ | | | |
| Task 2.1 | ⬜ | | | |
| Task 2.2 | ⬜ | | | |
| Task 3.1 | ⬜ | | | |
| Task 3.2 | ⬜ | | | |
| Task 3.3 | ⬜ | | | |
| Task 4.1 | ⬜ | | | |
| Task 4.2 | ⬜ | | | |
| Task 5.1 | ⬜ | | | |
| Task 5.2 | ⬜ | | | |
| Task 6.1 | ⬜ | | | |
| Task 6.2 | ⬜ | | | |
| Task 7.1 | ⬜ | | | |
| Task 7.2 | ⬜ | | | |
| Task 7.3 | ⬜ | | | |

狀態圖例: ⬜ 待開始 | 🔄 進行中 | ✅ 完成 | ❌ 阻塞
