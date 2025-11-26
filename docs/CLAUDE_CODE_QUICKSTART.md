# Claude Code 快速啟動指南

## 專案概述
Photo-to-3D MVP: 用戶上傳照片，透過 Rodin Gen-2 API 生成可列印的 3D 模型

## 技術棧
- Frontend: Next.js 14 + TypeScript + Tailwind CSS + Three.js
- Backend: Firebase (Auth, Firestore, Storage, Functions)
- AI API: Rodin Gen-2 (Hyper3D)

---

## 🚀 快速啟動

### Step 1: 複製以下指令給 Claude Code

```
請幫我建立 Photo-to-3D MVP 專案。

技術需求:
- Next.js 14 with App Router + TypeScript
- Tailwind CSS
- Firebase SDK v10+
- Three.js via @react-three/fiber
- Cloud Functions with TypeScript

專案結構:
photo-to-3d-mvp/
├── app/                      # Next.js
│   ├── src/
│   │   ├── app/              # Pages
│   │   │   ├── page.tsx      # 首頁（上傳）
│   │   │   ├── auth/         # 登入
│   │   │   ├── dashboard/    # 儀表板
│   │   │   └── viewer/[id]/  # 3D 預覽
│   │   ├── components/
│   │   │   ├── upload/
│   │   │   ├── viewer/
│   │   │   └── ui/
│   │   ├── lib/
│   │   │   ├── firebase.ts
│   │   │   └── auth.ts
│   │   └── hooks/
│   ├── package.json
│   └── tailwind.config.js
├── functions/
│   ├── src/
│   │   ├── index.ts
│   │   ├── rodin/
│   │   │   ├── client.ts
│   │   │   └── types.ts
│   │   └── handlers/
│   │       ├── generate.ts
│   │       └── jobs.ts
│   └── package.json
├── firebase.json
├── firestore.rules
└── storage.rules

請生成:
1. 所有配置檔案 (package.json, tsconfig, firebase.json, rules)
2. Firebase 初始化 (lib/firebase.ts)
3. Auth hook (hooks/useAuth.ts)
4. 基本頁面框架

先不要實作完整功能，只建立骨架結構。
```

---

### Step 2: Firebase 設置完成後

```
Firebase 專案已建立，配置如下：
- Project ID: [your-project-id]
- API Key: [your-api-key]
- Auth Domain: [your-project-id].firebaseapp.com

請:
1. 更新 app/src/lib/firebase.ts 使用這些配置
2. 確保 .env.local 範本正確
3. 測試 Firebase 連接
```

---

### Step 3: 實作認證系統

```
請實作完整的 Firebase 認證系統：

1. app/src/lib/auth.ts
   - signInWithGoogle()
   - signInWithEmail(email, password)
   - signUpWithEmail(email, password)
   - signOut()

2. app/src/hooks/useAuth.ts
   - 監聽 auth state
   - 返回 { user, loading, error }

3. app/src/context/AuthContext.tsx
   - AuthProvider
   - useAuthContext hook

4. app/src/app/auth/page.tsx
   - Google 登入按鈕
   - Email 表單
   - 登入/註冊切換
   - 錯誤顯示

5. functions/src/handlers/users.ts
   - onUserCreate 觸發器
   - 初始化用戶資料（3 積分）

UI 使用 Tailwind，風格簡潔現代。
```

---

### Step 4: 實作圖片上傳

```
請實作圖片上傳功能：

1. app/src/lib/storage.ts
   - uploadImage(file, userId) -> Promise<string>
   - 驗證檔案類型 (jpg, png, webp)
   - 驗證大小 (<10MB)
   - 上傳到 uploads/{userId}/{timestamp}_{filename}

2. app/src/components/upload/ImageUploader.tsx
   - 拖放區域
   - 點擊選擇
   - 預覽圖片
   - 上傳進度
   - 錯誤處理

3. 更新首頁使用 ImageUploader
   - 上傳後顯示預覽
   - 品質選擇 (High/Medium/Low)
   - "開始生成" 按鈕
```

---

### Step 5: 實作 Rodin API 整合

```
請實作 Rodin Gen-2 API 整合：

1. functions/src/rodin/types.ts
   - 所有 API 型別定義

2. functions/src/rodin/client.ts
   class RodinClient:
   - generateModel(imageBuffer, options)
   - checkStatus(subscriptionKey)
   - downloadModel(taskId)
   
   API Base: https://api.hyper3d.com/api/v2
   使用 multipart/form-data
   
3. functions/src/handlers/generate.ts
   - 驗證用戶
   - 檢查積分
   - 建立 job
   - 呼叫 Rodin
   - 扣除積分
   - 處理錯誤

4. functions/src/handlers/jobs.ts
   - checkJobStatus
   - 輪詢 Rodin 狀態
   - 下載並儲存模型
   - 生成 signed URL

環境變數: RODIN_API_KEY
```

---

### Step 6: 實作 3D 預覽器

```
請實作 3D 模型預覽器：

1. app/src/components/viewer/ModelViewer.tsx
   使用 @react-three/fiber + @react-three/drei
   
   功能:
   - 載入 GLB 模型
   - OrbitControls (旋轉/縮放/平移)
   - 環境光 + 方向光
   - Studio 環境
   - 自動置中
   - 背景色切換

2. app/src/components/viewer/ViewerControls.tsx
   - 背景色切換按鈕
   - 全螢幕按鈕
   - 下載按鈕

3. app/src/app/viewer/[jobId]/page.tsx
   狀態:
   - pending: 等待開始
   - processing: 顯示進度
   - completed: 顯示 3D + 下載
   - failed: 顯示錯誤
   
   每 5 秒輪詢 checkJobStatus
```

---

### Step 7: 完善用戶功能

```
請完善用戶儀表板：

1. app/src/components/credits/CreditBadge.tsx
   - 顯示積分
   - 監聽即時更新
   - 低積分警告

2. app/src/app/dashboard/page.tsx
   - 用戶資訊卡片
   - 積分顯示
   - 快速操作
   - 最近 3 個生成

3. app/src/app/dashboard/history/page.tsx
   - 分頁載入
   - 狀態篩選
   - 卡片列表
   - 操作按鈕

4. app/src/components/credits/NoCreditsModal.tsx
   - 積分不足提示
```

---

## 🔧 常用命令

```bash
# 本地開發
cd app && npm run dev
cd functions && npm run build && npm run serve

# Firebase Emulator
firebase emulators:start

# 部署
firebase deploy

# 僅部署 Functions
firebase deploy --only functions

# 設置密鑰
firebase functions:secrets:set RODIN_API_KEY
```

---

## 📝 檢查清單

開發前確認:
- [ ] Firebase 專案已建立
- [ ] 取得 Rodin API Key (https://hyper3d.ai)
- [ ] Node.js 18+ 已安裝
- [ ] Firebase CLI 已安裝

功能完成確認:
- [ ] Google 登入可用
- [ ] Email 註冊/登入可用
- [ ] 圖片上傳可用
- [ ] 3D 生成可用
- [ ] 模型預覽可用
- [ ] 模型下載可用
- [ ] 積分系統可用
- [ ] 歷史記錄可用

---

## 🐛 常見問題

**Q: Firebase Functions 部署失敗**
A: 確認 Node.js 版本 18+，確認 functions/package.json 的 engines 設定

**Q: Rodin API 返回 401**
A: 確認 API Key 正確設置在 Firebase Secrets

**Q: 3D 模型載入失敗**
A: 確認 CORS 設定，確認 Storage 權限

**Q: 積分沒有扣除**
A: 檢查 Firestore Security Rules 是否阻擋了 Functions 的寫入
