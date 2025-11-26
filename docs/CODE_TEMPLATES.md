# 程式碼模板參考

> 此檔案包含關鍵程式碼範例，可直接用於開發參考

---

## 1. Firebase 初始化

```typescript
// app/src/lib/firebase.ts

import { initializeApp, getApps } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import { getFunctions } from 'firebase/functions';

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID
};

// 避免重複初始化
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];

export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);
export const functions = getFunctions(app, 'asia-east1');

export default app;
```

---

## 2. Auth Hook

```typescript
// app/src/hooks/useAuth.ts

import { useState, useEffect } from 'react';
import { User, onAuthStateChanged } from 'firebase/auth';
import { auth } from '@/lib/firebase';

interface AuthState {
  user: User | null;
  loading: boolean;
  error: Error | null;
}

export function useAuth(): AuthState {
  const [state, setState] = useState<AuthState>({
    user: null,
    loading: true,
    error: null
  });

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(
      auth,
      (user) => {
        setState({ user, loading: false, error: null });
      },
      (error) => {
        setState({ user: null, loading: false, error });
      }
    );

    return () => unsubscribe();
  }, []);

  return state;
}
```

---

## 3. Auth Functions

```typescript
// app/src/lib/auth.ts

import { 
  signInWithPopup, 
  GoogleAuthProvider,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut as firebaseSignOut,
  updateProfile
} from 'firebase/auth';
import { auth } from './firebase';

const googleProvider = new GoogleAuthProvider();

export async function signInWithGoogle() {
  try {
    const result = await signInWithPopup(auth, googleProvider);
    return { user: result.user, error: null };
  } catch (error) {
    return { user: null, error: error as Error };
  }
}

export async function signInWithEmail(email: string, password: string) {
  try {
    const result = await signInWithEmailAndPassword(auth, email, password);
    return { user: result.user, error: null };
  } catch (error) {
    return { user: null, error: error as Error };
  }
}

export async function signUpWithEmail(email: string, password: string, displayName?: string) {
  try {
    const result = await createUserWithEmailAndPassword(auth, email, password);
    if (displayName) {
      await updateProfile(result.user, { displayName });
    }
    return { user: result.user, error: null };
  } catch (error) {
    return { user: null, error: error as Error };
  }
}

export async function signOut() {
  try {
    await firebaseSignOut(auth);
    return { error: null };
  } catch (error) {
    return { error: error as Error };
  }
}
```

---

## 4. Storage Upload

```typescript
// app/src/lib/storage.ts

import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { storage } from './firebase';

interface UploadResult {
  url: string;
  path: string;
}

interface UploadProgress {
  progress: number;
  state: 'running' | 'paused' | 'success' | 'error';
}

export async function uploadImage(
  file: File,
  userId: string,
  onProgress?: (progress: UploadProgress) => void
): Promise<UploadResult> {
  // 驗證檔案類型
  const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
  if (!allowedTypes.includes(file.type)) {
    throw new Error('不支援的檔案格式，請上傳 JPG、PNG 或 WEBP');
  }

  // 驗證檔案大小 (10MB)
  const maxSize = 10 * 1024 * 1024;
  if (file.size > maxSize) {
    throw new Error('檔案大小超過 10MB 限制');
  }

  // 生成唯一檔名
  const timestamp = Date.now();
  const extension = file.name.split('.').pop();
  const fileName = `${timestamp}_${Math.random().toString(36).slice(2)}.${extension}`;
  const path = `uploads/${userId}/${fileName}`;

  // 上傳
  const storageRef = ref(storage, path);
  const uploadTask = uploadBytesResumable(storageRef, file);

  return new Promise((resolve, reject) => {
    uploadTask.on(
      'state_changed',
      (snapshot) => {
        const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
        onProgress?.({
          progress,
          state: snapshot.state as UploadProgress['state']
        });
      },
      (error) => {
        reject(error);
      },
      async () => {
        const url = await getDownloadURL(uploadTask.snapshot.ref);
        resolve({ url, path });
      }
    );
  });
}
```

---

## 5. Rodin Client (Cloud Functions)

```typescript
// functions/src/rodin/client.ts

import axios from 'axios';
import FormData from 'form-data';

export interface GenerateOptions {
  prompt?: string;
  quality?: 'high' | 'medium' | 'low';
  format?: 'glb' | 'obj' | 'fbx' | 'stl';
}

export interface GenerateResult {
  taskId: string;
  subscriptionKey: string;
}

export interface StatusResult {
  status: 'Pending' | 'Processing' | 'Done' | 'Failed';
  progress?: number;
  modelUrl?: string;
  error?: string;
}

export class RodinClient {
  private apiKey: string;
  private baseUrl = 'https://api.hyper3d.com/api/v2';

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  async generateModel(imageBuffer: Buffer, options: GenerateOptions = {}): Promise<GenerateResult> {
    const form = new FormData();
    form.append('images', imageBuffer, { filename: 'image.jpg', contentType: 'image/jpeg' });
    form.append('tier', 'Gen-2');
    form.append('material', 'PBR');
    form.append('geometry_file_format', options.format || 'glb');
    
    const qualityMap = { high: 500000, medium: 180000, low: 80000 };
    form.append('quality_override', String(qualityMap[options.quality || 'medium']));
    
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

    if (response.data.error) {
      throw new Error(response.data.error);
    }

    return {
      taskId: response.data.uuid,
      subscriptionKey: response.data.jobs.subscription_key
    };
  }

  async checkStatus(subscriptionKey: string): Promise<StatusResult> {
    const response = await axios.post(
      `${this.baseUrl}/status`,
      { subscription_key: subscriptionKey },
      {
        headers: { 'Authorization': `Bearer ${this.apiKey}` },
        timeout: 10000
      }
    );

    const data = response.data;
    
    return {
      status: data.status,
      progress: data.progress,
      modelUrl: data.result?.model_url,
      error: data.error
    };
  }

  async downloadModel(taskId: string): Promise<Buffer> {
    const response = await axios.get(`${this.baseUrl}/download`, {
      params: { task_uuid: taskId },
      headers: { 'Authorization': `Bearer ${this.apiKey}` },
      responseType: 'arraybuffer',
      timeout: 120000
    });

    return Buffer.from(response.data);
  }
}
```

---

## 6. Generate Cloud Function

```typescript
// functions/src/handlers/generate.ts

import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import { RodinClient } from '../rodin/client';

const db = admin.firestore();
const bucket = admin.storage().bucket();

interface GenerateRequest {
  imagePath: string;
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
    // 驗證用戶
    if (!context.auth) {
      throw new functions.https.HttpsError('unauthenticated', '請先登入');
    }
    const userId = context.auth.uid;

    // 檢查積分
    const userRef = db.collection('users').doc(userId);
    const userDoc = await userRef.get();
    
    if (!userDoc.exists) {
      throw new functions.https.HttpsError('not-found', '用戶不存在');
    }
    
    const credits = userDoc.data()?.credits || 0;
    if (credits < 1) {
      throw new functions.https.HttpsError('resource-exhausted', '積分不足');
    }

    // 建立 Job
    const jobRef = db.collection('jobs').doc();
    const jobData = {
      userId,
      status: 'pending',
      inputImagePath: data.imagePath,
      settings: data.settings,
      createdAt: admin.firestore.FieldValue.serverTimestamp()
    };
    
    await jobRef.set(jobData);

    try {
      // 下載圖片
      const file = bucket.file(data.imagePath);
      const [imageBuffer] = await file.download();

      // 呼叫 Rodin API
      const rodin = new RodinClient(process.env.RODIN_API_KEY!);
      const { taskId, subscriptionKey } = await rodin.generateModel(imageBuffer, {
        quality: data.settings.quality,
        format: data.settings.format,
        prompt: data.settings.prompt
      });

      // 更新 Job
      await jobRef.update({
        status: 'processing',
        rodinTaskId: taskId,
        rodinSubscriptionKey: subscriptionKey
      });

      // 扣除積分
      await userRef.update({
        credits: admin.firestore.FieldValue.increment(-1),
        totalGenerated: admin.firestore.FieldValue.increment(1)
      });

      // 記錄交易
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
        estimatedTime: data.settings.quality === 'high' ? 300 : 180
      };

    } catch (error: any) {
      await jobRef.update({
        status: 'failed',
        error: error.message || 'Unknown error'
      });
      
      throw new functions.https.HttpsError('internal', `生成失敗: ${error.message}`);
    }
  });
```

---

## 7. Check Status Cloud Function

```typescript
// functions/src/handlers/jobs.ts

import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import { RodinClient } from '../rodin/client';

const db = admin.firestore();
const bucket = admin.storage().bucket();

interface CheckStatusRequest {
  jobId: string;
}

export const checkJobStatus = functions
  .region('asia-east1')
  .runWith({ secrets: ['RODIN_API_KEY'] })
  .https.onCall(async (data: CheckStatusRequest, context) => {
    if (!context.auth) {
      throw new functions.https.HttpsError('unauthenticated', '請先登入');
    }

    const jobRef = db.collection('jobs').doc(data.jobId);
    const jobDoc = await jobRef.get();

    if (!jobDoc.exists) {
      throw new functions.https.HttpsError('not-found', '任務不存在');
    }

    const job = jobDoc.data()!;

    if (job.userId !== context.auth.uid) {
      throw new functions.https.HttpsError('permission-denied', '無權限');
    }

    // 已完成或失敗，直接返回
    if (job.status === 'completed' || job.status === 'failed') {
      return {
        status: job.status,
        modelUrl: job.outputModelUrl,
        error: job.error
      };
    }

    // 處理中，查詢 Rodin
    if (job.status === 'processing' && job.rodinSubscriptionKey) {
      const rodin = new RodinClient(process.env.RODIN_API_KEY!);
      const status = await rodin.checkStatus(job.rodinSubscriptionKey);

      if (status.status === 'Done' && status.modelUrl) {
        // 下載模型
        const modelBuffer = await rodin.downloadModel(job.rodinTaskId);
        
        // 儲存到 Storage
        const format = job.settings?.format || 'glb';
        const modelPath = `models/${job.userId}/${data.jobId}.${format}`;
        const modelFile = bucket.file(modelPath);
        
        await modelFile.save(modelBuffer, {
          contentType: format === 'glb' ? 'model/gltf-binary' : 'application/octet-stream'
        });

        // 生成 7 天有效的 URL
        const [signedUrl] = await modelFile.getSignedUrl({
          action: 'read',
          expires: Date.now() + 7 * 24 * 60 * 60 * 1000
        });

        // 更新 Job
        await jobRef.update({
          status: 'completed',
          outputModelUrl: signedUrl,
          outputModelPath: modelPath,
          completedAt: admin.firestore.FieldValue.serverTimestamp()
        });

        return {
          status: 'completed',
          modelUrl: signedUrl
        };
      }

      if (status.status === 'Failed') {
        await jobRef.update({
          status: 'failed',
          error: status.error || 'Generation failed'
        });

        return {
          status: 'failed',
          error: status.error
        };
      }

      return {
        status: 'processing',
        progress: status.progress || 0
      };
    }

    return {
      status: job.status,
      progress: 0
    };
  });
```

---

## 8. 3D Model Viewer Component

```tsx
// app/src/components/viewer/ModelViewer.tsx

'use client';

import { Suspense, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Environment, useGLTF, Center, Html } from '@react-three/drei';

interface ModelViewerProps {
  modelUrl: string;
  onLoad?: () => void;
  onError?: (error: Error) => void;
}

function Model({ url, onLoad, onError }: { url: string; onLoad?: () => void; onError?: (e: Error) => void }) {
  const { scene } = useGLTF(url, true, undefined, (loader) => {
    loader.manager.onLoad = () => onLoad?.();
    loader.manager.onError = (url) => onError?.(new Error(`Failed to load: ${url}`));
  });
  
  return <primitive object={scene} />;
}

function LoadingSpinner() {
  return (
    <Html center>
      <div className="flex flex-col items-center">
        <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
        <p className="mt-4 text-gray-600">載入模型中...</p>
      </div>
    </Html>
  );
}

export function ModelViewer({ modelUrl, onLoad, onError }: ModelViewerProps) {
  const [bgColor, setBgColor] = useState('#f5f5f5');

  const bgOptions = [
    { color: '#ffffff', label: '白' },
    { color: '#f5f5f5', label: '灰' },
    { color: '#1a1a1a', label: '黑' },
  ];

  return (
    <div className="relative w-full h-[500px] rounded-xl overflow-hidden border border-gray-200">
      {/* 背景色切換 */}
      <div className="absolute top-4 right-4 z-10 flex gap-2">
        {bgOptions.map((opt) => (
          <button
            key={opt.color}
            onClick={() => setBgColor(opt.color)}
            className={`w-8 h-8 rounded-full border-2 transition-all ${
              bgColor === opt.color ? 'border-blue-500 scale-110' : 'border-gray-300'
            }`}
            style={{ backgroundColor: opt.color }}
            title={opt.label}
          />
        ))}
      </div>

      <Canvas
        camera={{ position: [0, 0, 5], fov: 50 }}
        style={{ background: bgColor }}
      >
        <ambientLight intensity={0.5} />
        <directionalLight position={[10, 10, 5]} intensity={1} />
        <directionalLight position={[-10, -10, -5]} intensity={0.3} />

        <Suspense fallback={<LoadingSpinner />}>
          <Center>
            <Model url={modelUrl} onLoad={onLoad} onError={onError} />
          </Center>
          <Environment preset="studio" />
        </Suspense>

        <OrbitControls
          enablePan={true}
          enableZoom={true}
          enableRotate={true}
          minDistance={1}
          maxDistance={20}
          maxPolarAngle={Math.PI}
        />
      </Canvas>
    </div>
  );
}
```

---

## 9. Image Uploader Component

```tsx
// app/src/components/upload/ImageUploader.tsx

'use client';

import { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { Upload, X, Image as ImageIcon } from 'lucide-react';

interface ImageUploaderProps {
  onUpload: (file: File) => Promise<void>;
  onRemove?: () => void;
  maxSize?: number; // MB
  accept?: string[];
}

export function ImageUploader({ 
  onUpload, 
  onRemove,
  maxSize = 10,
  accept = ['image/jpeg', 'image/png', 'image/webp']
}: ImageUploaderProps) {
  const [preview, setPreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    const file = acceptedFiles[0];
    if (!file) return;

    // 驗證檔案類型
    if (!accept.includes(file.type)) {
      setError('不支援的檔案格式');
      return;
    }

    // 驗證檔案大小
    if (file.size > maxSize * 1024 * 1024) {
      setError(`檔案大小不能超過 ${maxSize}MB`);
      return;
    }

    setError(null);
    
    // 顯示預覽
    const reader = new FileReader();
    reader.onload = () => setPreview(reader.result as string);
    reader.readAsDataURL(file);

    // 上傳
    setUploading(true);
    try {
      await onUpload(file);
    } catch (err: any) {
      setError(err.message || '上傳失敗');
      setPreview(null);
    } finally {
      setUploading(false);
    }
  }, [onUpload, maxSize, accept]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: accept.reduce((acc, type) => ({ ...acc, [type]: [] }), {}),
    maxFiles: 1,
    disabled: uploading
  });

  const handleRemove = () => {
    setPreview(null);
    setError(null);
    onRemove?.();
  };

  if (preview) {
    return (
      <div className="relative w-full max-w-md mx-auto">
        <img
          src={preview}
          alt="Preview"
          className="w-full rounded-xl shadow-lg"
        />
        <button
          onClick={handleRemove}
          className="absolute top-2 right-2 p-2 bg-red-500 text-white rounded-full hover:bg-red-600 transition"
        >
          <X size={20} />
        </button>
        {uploading && (
          <div className="absolute inset-0 bg-black/50 flex items-center justify-center rounded-xl">
            <div className="text-white text-center">
              <div className="w-16 h-16 border-4 border-white border-t-transparent rounded-full animate-spin mx-auto" />
              <p className="mt-4">上傳中 {Math.round(progress)}%</p>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="w-full max-w-md mx-auto">
      <div
        {...getRootProps()}
        className={`
          p-8 border-2 border-dashed rounded-xl cursor-pointer transition-all
          ${isDragActive 
            ? 'border-blue-500 bg-blue-50' 
            : 'border-gray-300 hover:border-blue-400 hover:bg-gray-50'
          }
          ${uploading ? 'opacity-50 cursor-not-allowed' : ''}
        `}
      >
        <input {...getInputProps()} />
        <div className="flex flex-col items-center text-center">
          {isDragActive ? (
            <Upload className="w-12 h-12 text-blue-500 mb-4" />
          ) : (
            <ImageIcon className="w-12 h-12 text-gray-400 mb-4" />
          )}
          <p className="text-lg font-medium text-gray-700">
            {isDragActive ? '放開以上傳' : '拖放圖片到這裡'}
          </p>
          <p className="text-sm text-gray-500 mt-2">
            或點擊選擇檔案
          </p>
          <p className="text-xs text-gray-400 mt-4">
            支援 JPG、PNG、WEBP，最大 {maxSize}MB
          </p>
        </div>
      </div>
      
      {error && (
        <p className="mt-4 text-center text-red-500">{error}</p>
      )}
    </div>
  );
}
```

---

## 10. Firestore Rules

```javascript
// firestore.rules

rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    
    // 用戶只能讀寫自己的資料
    match /users/{userId} {
      allow read: if request.auth != null && request.auth.uid == userId;
      allow create: if request.auth != null && request.auth.uid == userId;
      // 用戶不能自己修改積分
      allow update: if request.auth != null 
                    && request.auth.uid == userId
                    && !request.resource.data.diff(resource.data).affectedKeys()
                       .hasAny(['credits', 'totalGenerated']);
    }
    
    // Jobs
    match /jobs/{jobId} {
      allow read: if request.auth != null 
                  && resource.data.userId == request.auth.uid;
      allow create: if request.auth != null 
                    && request.resource.data.userId == request.auth.uid
                    && request.resource.data.status == 'pending';
      allow update: if false; // 只能由 Functions 更新
      allow delete: if request.auth != null 
                    && resource.data.userId == request.auth.uid;
    }
    
    // Transactions - 只讀
    match /transactions/{transactionId} {
      allow read: if request.auth != null 
                  && resource.data.userId == request.auth.uid;
      allow write: if false;
    }
  }
}
```

---

## 11. Storage Rules

```javascript
// storage.rules

rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    
    // 用戶上傳的圖片
    match /uploads/{userId}/{imageId} {
      allow read: if request.auth != null && request.auth.uid == userId;
      allow write: if request.auth != null 
                   && request.auth.uid == userId
                   && request.resource.size < 10 * 1024 * 1024
                   && request.resource.contentType.matches('image/.*');
    }
    
    // 生成的模型
    match /models/{userId}/{modelId} {
      allow read: if request.auth != null && request.auth.uid == userId;
      allow write: if false; // 只能由 Functions 寫入
    }
  }
}
```
