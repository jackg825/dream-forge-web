# 技術需求規格書 (Technical Requirements)

## 1. 技術棧

### 1.1 Frontend

| 技術 | 版本 | 用途 |
|------|------|------|
| Next.js | 16.x | React 框架 + App Router |
| React | 19.x | UI 函式庫 |
| TypeScript | 5.x | 型別安全 |
| Tailwind CSS | 4.x | 樣式框架 (PostCSS) |
| Three.js | 0.181+ | 3D 渲染 |
| @react-three/fiber | 9.x | React Three.js 封裝 |
| @react-three/drei | 10.x | Three.js 工具集 |
| Firebase SDK | 12.x | Auth, Storage, Firestore |
| Zustand | 5.x | 狀態管理 |
| React Query | 5.x | 伺服器狀態管理 |
| next-intl | 4.x | 國際化 (i18n) |
| Radix UI | latest | 無障礙 UI 元件 |

### 1.2 Backend (Firebase)

| 服務 | 版本 | 用途 |
|------|------|------|
| Firebase Auth | - | 用戶認證 |
| Cloud Firestore | - | 資料庫 |
| Cloud Storage | - | 檔案儲存 |
| Cloud Functions | Node.js 20 | 後端邏輯 |
| Firebase Hosting | - | 靜態託管 |
| firebase-admin | 13.x | Admin SDK |
| firebase-functions | 7.x | Functions SDK |

### 1.3 External Services

| 服務 | 用途 | 文檔 |
|------|------|------|
| Rodin Gen-2 API | 3D 模型生成 (主要) | https://developer.hyper3d.ai |
| Tripo API | 3D 模型生成 (備用) | https://www.tripo3d.ai |
| Meshy API | 3D 模型生成 (備用) | https://docs.meshy.ai |
| Google Gemini API | 圖像分析 | https://ai.google.dev |
| Tencent Hunyuan | 圖像分析 (中文) | https://cloud.tencent.com |
| AWS S3 | 外部檔案儲存 | - |

---

## 2. Firebase 配置

### 2.1 專案結構

```
dream-forge/
├── firebase.json
├── firestore.rules
├── firestore.indexes.json
├── storage.rules
├── .firebaserc
├── functions/                    # Cloud Functions (Node.js 20)
│   ├── package.json
│   ├── tsconfig.json
│   └── src/
│       ├── index.ts
│       ├── rodin/               # Rodin API client
│       │   ├── client.ts
│       │   └── types.ts
│       ├── gemini/              # Gemini API client
│       ├── providers/           # Multi-provider support
│       ├── storage/             # Storage utilities
│       ├── handlers/
│       │   ├── generate.ts
│       │   ├── jobs.ts
│       │   └── ...
│       └── utils/
├── workers/                      # Cloudflare Workers
└── app/                          # Next.js 16 App
    ├── package.json
    ├── next.config.ts
    └── src/
        ├── app/
        │   └── [locale]/        # i18n routing (en/zh)
        ├── components/
        │   └── ui/              # shadcn/ui components
        ├── lib/
        ├── hooks/
        ├── config/
        ├── i18n/
        ├── messages/            # Translation files
        └── types/
```

### 2.2 Firestore Security Rules

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    
    // 用戶資料 - 只能讀寫自己的
    match /users/{userId} {
      allow read: if request.auth != null && request.auth.uid == userId;
      allow create: if request.auth != null && request.auth.uid == userId;
      allow update: if request.auth != null && request.auth.uid == userId
                    && !request.resource.data.diff(resource.data).affectedKeys()
                       .hasAny(['credits', 'totalGenerated']); // 不能自己改積分
    }
    
    // Jobs - 只能讀自己的，建立需要驗證
    match /jobs/{jobId} {
      allow read: if request.auth != null 
                  && resource.data.userId == request.auth.uid;
      allow create: if request.auth != null 
                    && request.resource.data.userId == request.auth.uid
                    && request.resource.data.status == 'pending';
      // update 只能由 Cloud Functions 執行
      allow update: if false;
    }
    
    // Transactions - 只能讀自己的
    match /transactions/{transactionId} {
      allow read: if request.auth != null 
                  && resource.data.userId == request.auth.uid;
      // 只能由 Cloud Functions 建立
      allow write: if false;
    }
  }
}
```

### 2.3 Storage Security Rules

```javascript
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    
    // 用戶上傳的圖片
    match /uploads/{userId}/{imageId} {
      allow read: if request.auth != null && request.auth.uid == userId;
      allow write: if request.auth != null 
                   && request.auth.uid == userId
                   && request.resource.size < 10 * 1024 * 1024  // 10MB
                   && request.resource.contentType.matches('image/.*');
    }
    
    // 生成的模型 - 只能讀
    match /models/{userId}/{modelId} {
      allow read: if request.auth != null && request.auth.uid == userId;
      allow write: if false; // 只能由 Cloud Functions 寫入
    }
  }
}
```

---

## 3. Rodin Gen-2 API 整合規格

### 3.1 API 配置

```typescript
// functions/src/rodin/types.ts

export interface RodinConfig {
  apiKey: string;
  baseUrl: string;
  tier: 'Gen-2';
  timeout: number;
}

export interface RodinGenerateRequest {
  images: string[];           // Base64 或 URL
  tier: 'Gen-2';
  prompt?: string;            // 可選文字描述
  mesh_mode?: 'Raw' | 'Quad';
  mesh_simplify?: boolean;
  geometry_file_format?: 'glb' | 'fbx' | 'obj' | 'stl';
  material?: 'PBR' | 'Shaded';
  quality?: 'high' | 'medium' | 'low' | 'extra-low';
  seed?: number;
}

export interface RodinGenerateResponse {
  error: string | null;
  message: string;
  uuid: string;
  jobs: {
    uuids: string[];
    subscription_key: string;
  };
}

export interface RodinStatusResponse {
  uuid: string;
  status: 'Pending' | 'Processing' | 'Done' | 'Failed';
  progress?: number;
  result?: {
    model_url: string;
    texture_urls?: string[];
  };
  error?: string;
}
```

### 3.2 API 呼叫流程

```typescript
// functions/src/rodin/client.ts

import axios from 'axios';
import FormData from 'form-data';

export class RodinClient {
  private apiKey: string;
  private baseUrl = 'https://api.hyper3d.com/api/v2';
  
  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }
  
  /**
   * 啟動 3D 生成任務
   */
  async generateModel(imageBuffer: Buffer, options: {
    prompt?: string;
    quality?: 'high' | 'medium' | 'low';
    format?: 'glb' | 'obj' | 'fbx';
  }): Promise<{ taskId: string; subscriptionKey: string }> {
    const form = new FormData();
    form.append('images', imageBuffer, { filename: 'image.jpg' });
    form.append('tier', 'Gen-2');
    form.append('material', 'PBR');
    form.append('geometry_file_format', options.format || 'glb');
    
    // 品質對應面數
    const qualityMap = { high: 500000, medium: 180000, low: 80000 };
    form.append('quality_override', qualityMap[options.quality || 'medium'].toString());
    
    if (options.prompt) {
      form.append('prompt', options.prompt);
    }
    
    const response = await axios.post(`${this.baseUrl}/rodin`, form, {
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        ...form.getHeaders()
      },
      timeout: 30000
    });
    
    return {
      taskId: response.data.uuid,
      subscriptionKey: response.data.jobs.subscription_key
    };
  }
  
  /**
   * 輪詢任務狀態
   */
  async checkStatus(subscriptionKey: string): Promise<RodinStatusResponse> {
    const response = await axios.post(
      `${this.baseUrl}/status`,
      { subscription_key: subscriptionKey },
      {
        headers: { 'Authorization': `Bearer ${this.apiKey}` },
        timeout: 10000
      }
    );
    return response.data;
  }
  
  /**
   * 下載生成的模型
   */
  async downloadModel(taskId: string): Promise<Buffer> {
    const response = await axios.get(
      `${this.baseUrl}/download`,
      {
        params: { task_uuid: taskId },
        headers: { 'Authorization': `Bearer ${this.apiKey}` },
        responseType: 'arraybuffer',
        timeout: 60000
      }
    );
    return Buffer.from(response.data);
  }
}
```

### 3.3 生成參數對照表

| 參數 | 值 | 說明 |
|------|-----|------|
| `tier` | `Gen-2` | 使用最新模型 |
| `quality_override` | `500000` (high) / `180000` (medium) / `80000` (low) | 面數 |
| `geometry_file_format` | `glb` / `obj` / `fbx` / `stl` | 輸出格式 |
| `material` | `PBR` | 物理渲染材質 |
| `mesh_mode` | `Raw` / `Quad` | 網格類型 |
| `mesh_simplify` | `true` / `false` | 簡化網格 |

---

## 4. Cloud Functions 規格

### 4.1 函式清單

| 函式名稱 | 觸發方式 | 說明 |
|----------|----------|------|
| `onUserCreate` | Auth onCreate | 初始化用戶資料 |
| `generateModel` | HTTPS Callable | 啟動生成任務 (多供應商) |
| `checkJobStatus` | HTTPS Callable | 查詢任務狀態 |
| `analyzeImage` | HTTPS Callable | AI 圖像分析 |
| `regeneratePipeline` | HTTPS Callable | 管理員批次重新生成 |
| `processCompletion` | Firestore onUpdate | 處理完成任務 |
| `scheduledCleanup` | Pub/Sub (每日) | 清理過期資料 |

### 4.2 函式實作規格

```typescript
// functions/src/handlers/generate.ts

import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import { RodinClient } from '../rodin/client';

const db = admin.firestore();
const storage = admin.storage();

interface GenerateRequest {
  imageStoragePath: string;  // gs://bucket/uploads/userId/xxx.jpg
  settings: {
    quality: 'high' | 'medium' | 'low';
    format: 'glb' | 'obj' | 'stl';
    prompt?: string;
  };
}

export const generateModel = functions
  .region('asia-east1')
  .runWith({
    timeoutSeconds: 540,
    memory: '1GB',
    secrets: ['RODIN_API_KEY']
  })
  .https.onCall(async (data: GenerateRequest, context) => {
    // 1. 驗證用戶
    if (!context.auth) {
      throw new functions.https.HttpsError('unauthenticated', '請先登入');
    }
    
    const userId = context.auth.uid;
    
    // 2. 檢查積分
    const userDoc = await db.collection('users').doc(userId).get();
    const credits = userDoc.data()?.credits || 0;
    
    if (credits < 1) {
      throw new functions.https.HttpsError('resource-exhausted', '積分不足');
    }
    
    // 3. 建立 Job 記錄
    const jobRef = db.collection('jobs').doc();
    await jobRef.set({
      userId,
      status: 'pending',
      inputImageUrl: data.imageStoragePath,
      settings: data.settings,
      createdAt: admin.firestore.FieldValue.serverTimestamp()
    });
    
    try {
      // 4. 下載圖片
      const bucket = storage.bucket();
      const file = bucket.file(data.imageStoragePath.replace('gs://' + bucket.name + '/', ''));
      const [imageBuffer] = await file.download();
      
      // 5. 呼叫 Rodin API
      const rodin = new RodinClient(process.env.RODIN_API_KEY!);
      const { taskId, subscriptionKey } = await rodin.generateModel(imageBuffer, {
        quality: data.settings.quality,
        format: data.settings.format,
        prompt: data.settings.prompt
      });
      
      // 6. 更新 Job 狀態
      await jobRef.update({
        status: 'processing',
        rodinTaskId: taskId,
        rodinSubscriptionKey: subscriptionKey
      });
      
      // 7. 扣除積分
      await db.collection('users').doc(userId).update({
        credits: admin.firestore.FieldValue.increment(-1)
      });
      
      // 8. 記錄交易
      await db.collection('transactions').add({
        userId,
        type: 'consume',
        amount: -1,
        jobId: jobRef.id,
        createdAt: admin.firestore.FieldValue.serverTimestamp()
      });
      
      return {
        success: true,
        jobId: jobRef.id,
        estimatedTime: 180
      };
      
    } catch (error) {
      await jobRef.update({
        status: 'failed',
        error: error.message
      });
      throw new functions.https.HttpsError('internal', '生成失敗');
    }
  });
```

### 4.3 狀態輪詢函式

```typescript
// functions/src/handlers/jobs.ts

export const checkJobStatus = functions
  .region('asia-east1')
  .https.onCall(async (data: { jobId: string }, context) => {
    if (!context.auth) {
      throw new functions.https.HttpsError('unauthenticated', '請先登入');
    }
    
    const jobDoc = await db.collection('jobs').doc(data.jobId).get();
    
    if (!jobDoc.exists) {
      throw new functions.https.HttpsError('not-found', '任務不存在');
    }
    
    const job = jobDoc.data()!;
    
    if (job.userId !== context.auth.uid) {
      throw new functions.https.HttpsError('permission-denied', '無權限');
    }
    
    // 如果正在處理，查詢 Rodin 狀態
    if (job.status === 'processing' && job.rodinSubscriptionKey) {
      const rodin = new RodinClient(process.env.RODIN_API_KEY!);
      const status = await rodin.checkStatus(job.rodinSubscriptionKey);
      
      if (status.status === 'Done' && status.result?.model_url) {
        // 下載並儲存模型
        const modelBuffer = await rodin.downloadModel(job.rodinTaskId);
        const modelPath = `models/${job.userId}/${data.jobId}.${job.settings.format}`;
        
        await storage.bucket().file(modelPath).save(modelBuffer);
        
        const [modelUrl] = await storage.bucket().file(modelPath)
          .getSignedUrl({ action: 'read', expires: Date.now() + 7 * 24 * 60 * 60 * 1000 });
        
        await jobDoc.ref.update({
          status: 'completed',
          outputModelUrl: modelUrl,
          completedAt: admin.firestore.FieldValue.serverTimestamp()
        });
        
        return { status: 'completed', modelUrl };
      }
      
      if (status.status === 'Failed') {
        await jobDoc.ref.update({
          status: 'failed',
          error: status.error || 'Unknown error'
        });
        return { status: 'failed', error: status.error };
      }
      
      return { status: 'processing', progress: status.progress || 0 };
    }
    
    return {
      status: job.status,
      modelUrl: job.outputModelUrl,
      error: job.error
    };
  });
```

---

## 5. Frontend 組件規格

### 5.1 頁面結構

```
/                     # 首頁 - 上傳區塊
/auth                 # 登入/註冊
/dashboard            # 用戶儀表板
/dashboard/history    # 生成歷史
/viewer/[jobId]       # 3D 預覽頁
```

### 5.2 核心組件

| 組件 | 路徑 | 說明 |
|------|------|------|
| `ImageUploader` | `components/upload/` | 拖放上傳 |
| `ModelViewer` | `components/viewer/` | Three.js 3D 檢視器 |
| `GenerationProgress` | `components/progress/` | 生成進度顯示 |
| `CreditBadge` | `components/credits/` | 積分顯示 |
| `JobCard` | `components/history/` | 歷史記錄卡片 |

### 5.3 Three.js 3D Viewer 規格

```typescript
// components/viewer/ModelViewer.tsx

import { Canvas } from '@react-three/fiber';
import { OrbitControls, Environment, useGLTF, Center } from '@react-three/drei';
import { Suspense } from 'react';

interface ModelViewerProps {
  modelUrl: string;
  backgroundColor?: string;
}

function Model({ url }: { url: string }) {
  const { scene } = useGLTF(url);
  return <primitive object={scene} />;
}

export function ModelViewer({ modelUrl, backgroundColor = '#f5f5f5' }: ModelViewerProps) {
  return (
    <div className="w-full h-[500px] rounded-lg overflow-hidden">
      <Canvas
        camera={{ position: [0, 0, 5], fov: 50 }}
        style={{ background: backgroundColor }}
      >
        <ambientLight intensity={0.5} />
        <directionalLight position={[10, 10, 5]} intensity={1} />
        
        <Suspense fallback={null}>
          <Center>
            <Model url={modelUrl} />
          </Center>
          <Environment preset="studio" />
        </Suspense>
        
        <OrbitControls 
          enablePan={true}
          enableZoom={true}
          enableRotate={true}
          minDistance={1}
          maxDistance={20}
        />
      </Canvas>
    </div>
  );
}
```

---

## 6. 環境變數

### 6.1 Firebase Functions

```bash
# .env (functions/)
RODIN_API_KEY=your_rodin_api_key
GEMINI_API_KEY=your_gemini_api_key  # Optional
```

### 6.2 Next.js Frontend

```bash
# .env.local (app/)
NEXT_PUBLIC_FIREBASE_API_KEY=xxx
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=xxx.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=xxx
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=xxx.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=xxx
NEXT_PUBLIC_FIREBASE_APP_ID=xxx
```

---

## 7. 部署配置

### 7.1 firebase.json

```json
{
  "hosting": {
    "source": "app",
    "frameworksBackend": {
      "region": "asia-east1"
    },
    "ignore": ["firebase.json", "**/.*", "**/node_modules/**"]
  },
  "functions": {
    "source": "functions",
    "runtime": "nodejs20",
    "predeploy": ["npm --prefix \"$RESOURCE_DIR\" run build"]
  },
  "firestore": {
    "rules": "firestore.rules",
    "indexes": "firestore.indexes.json"
  },
  "storage": {
    "rules": "storage.rules"
  }
}
```

### 7.2 部署命令

```bash
# 部署全部
firebase deploy

# 僅部署 functions
firebase deploy --only functions

# 僅部署 hosting
firebase deploy --only hosting

# 僅部署 rules
firebase deploy --only firestore:rules,storage:rules
```
