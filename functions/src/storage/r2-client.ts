/**
 * Cloudflare R2 Storage Client
 * 使用 AWS SDK v3 的 S3 相容 API 與 R2 互動
 */

import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  HeadObjectCommand,
  ListObjectsV2Command,
  type _Object,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

// R2 配置 (從環境變數讀取)
const R2_ACCOUNT_ID = process.env.R2_ACCOUNT_ID;
const R2_ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID;
const R2_SECRET_ACCESS_KEY = process.env.R2_SECRET_ACCESS_KEY;
const R2_BUCKET_NAME = process.env.R2_BUCKET_NAME || 'dream-forge-storage';
const R2_PUBLIC_URL = process.env.R2_PUBLIC_URL || 'https://dream-forge-r2-proxy.jackg825.workers.dev';

// 驗證配置
function validateConfig(): void {
  if (!R2_ACCOUNT_ID || !R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY) {
    throw new Error(
      'R2 configuration missing. Set R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, and R2_SECRET_ACCESS_KEY'
    );
  }
}

// 創建 S3 Client (單例)
let s3Client: S3Client | null = null;

function getS3Client(): S3Client {
  if (!s3Client) {
    validateConfig();

    s3Client = new S3Client({
      region: 'auto',
      endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: R2_ACCESS_KEY_ID!,
        secretAccessKey: R2_SECRET_ACCESS_KEY!,
      },
    });
  }

  return s3Client;
}

/**
 * R2 Storage Client 類別
 */
export class R2Client {
  private client: S3Client;
  private bucket: string;
  private publicUrl: string;

  constructor() {
    this.client = getS3Client();
    this.bucket = R2_BUCKET_NAME;
    this.publicUrl = R2_PUBLIC_URL;
  }

  /**
   * 上傳檔案到 R2
   */
  async upload(
    key: string,
    body: Buffer | Uint8Array | string,
    contentType: string,
    metadata?: Record<string, string>
  ): Promise<void> {
    const command = new PutObjectCommand({
      Bucket: this.bucket,
      Key: key,
      Body: body,
      ContentType: contentType,
      Metadata: metadata,
    });

    await this.client.send(command);
  }

  /**
   * 從 URL 下載並上傳到 R2
   */
  async uploadFromUrl(
    key: string,
    url: string,
    contentType?: string
  ): Promise<void> {
    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`Failed to fetch from URL: ${response.status}`);
    }

    const buffer = Buffer.from(await response.arrayBuffer());
    const type = contentType || response.headers.get('content-type') || 'application/octet-stream';

    await this.upload(key, buffer, type);
  }

  /**
   * 下載檔案
   */
  async download(key: string): Promise<Buffer> {
    const command = new GetObjectCommand({
      Bucket: this.bucket,
      Key: key,
    });

    const response = await this.client.send(command);

    if (!response.Body) {
      throw new Error('Empty response body');
    }

    // 轉換 stream 為 buffer
    const chunks: Uint8Array[] = [];
    const stream = response.Body as AsyncIterable<Uint8Array>;

    for await (const chunk of stream) {
      chunks.push(chunk);
    }

    return Buffer.concat(chunks);
  }

  /**
   * 檢查檔案是否存在
   */
  async exists(key: string): Promise<boolean> {
    try {
      const command = new HeadObjectCommand({
        Bucket: this.bucket,
        Key: key,
      });

      await this.client.send(command);
      return true;
    } catch (error) {
      if ((error as { name?: string }).name === 'NotFound') {
        return false;
      }
      throw error;
    }
  }

  /**
   * 獲取檔案 metadata
   */
  async getMetadata(key: string): Promise<{
    contentType?: string;
    contentLength?: number;
    lastModified?: Date;
    metadata?: Record<string, string>;
  } | null> {
    try {
      const command = new HeadObjectCommand({
        Bucket: this.bucket,
        Key: key,
      });

      const response = await this.client.send(command);

      return {
        contentType: response.ContentType,
        contentLength: response.ContentLength,
        lastModified: response.LastModified,
        metadata: response.Metadata,
      };
    } catch (error) {
      if ((error as { name?: string }).name === 'NotFound') {
        return null;
      }
      throw error;
    }
  }

  /**
   * 刪除檔案
   */
  async delete(key: string): Promise<void> {
    const command = new DeleteObjectCommand({
      Bucket: this.bucket,
      Key: key,
    });

    await this.client.send(command);
  }

  /**
   * 列出檔案
   */
  async list(
    prefix: string,
    maxKeys: number = 1000
  ): Promise<{ key: string; size: number; lastModified?: Date }[]> {
    const command = new ListObjectsV2Command({
      Bucket: this.bucket,
      Prefix: prefix,
      MaxKeys: maxKeys,
    });

    const response = await this.client.send(command);

    return (response.Contents || []).map((item: _Object) => ({
      key: item.Key!,
      size: item.Size || 0,
      lastModified: item.LastModified,
    }));
  }

  /**
   * 生成 presigned GET URL
   */
  async getSignedDownloadUrl(key: string, expiresIn: number = 3600): Promise<string> {
    const command = new GetObjectCommand({
      Bucket: this.bucket,
      Key: key,
    });

    return getSignedUrl(this.client, command, { expiresIn });
  }

  /**
   * 生成 presigned PUT URL
   */
  async getSignedUploadUrl(
    key: string,
    contentType: string,
    expiresIn: number = 900
  ): Promise<string> {
    const command = new PutObjectCommand({
      Bucket: this.bucket,
      Key: key,
      ContentType: contentType,
    });

    return getSignedUrl(this.client, command, { expiresIn });
  }

  /**
   * 獲取公開 URL (透過 Worker 代理)
   */
  getPublicUrl(key: string): string {
    return `${this.publicUrl}/download/${key}`;
  }

  /**
   * 複製檔案
   */
  async copy(sourceKey: string, destinationKey: string): Promise<void> {
    // R2 不直接支持 CopyObject，需要下載再上傳
    const buffer = await this.download(sourceKey);
    const metadata = await this.getMetadata(sourceKey);

    await this.upload(
      destinationKey,
      buffer,
      metadata?.contentType || 'application/octet-stream',
      metadata?.metadata
    );
  }
}

// 導出單例
let r2Instance: R2Client | null = null;

export function getR2Client(): R2Client {
  if (!r2Instance) {
    r2Instance = new R2Client();
  }
  return r2Instance;
}

/**
 * 輔助函數：生成儲存路徑
 */
export function generateStoragePath(
  userId: string,
  prefix: string,
  filename: string
): string {
  const timestamp = Date.now();
  const sanitizedFilename = filename.replace(/[^a-zA-Z0-9._-]/g, '_');
  return `${prefix}/${userId}/${timestamp}_${sanitizedFilename}`;
}

/**
 * 輔助函數：從 Base64 上傳
 */
export async function uploadBase64ToR2(
  base64: string,
  path: string,
  contentType: string
): Promise<string> {
  const r2 = getR2Client();
  const buffer = Buffer.from(base64, 'base64');

  await r2.upload(path, buffer, contentType);

  return r2.getPublicUrl(path);
}
