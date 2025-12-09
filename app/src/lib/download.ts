/**
 * 檔案下載工具
 *
 * 使用 fetch + Blob 方式下載，避免 target="_blank" 導致的
 * Referer header 遺失問題（會觸發 R2 proxy 的 HOTLINK_BLOCKED）
 */

export interface DownloadOptions {
  onStart?: () => void;
  onComplete?: () => void;
  onError?: (error: Error) => void;
}

/**
 * 下載檔案
 * @param url - 檔案 URL
 * @param fileName - 下載後的檔案名稱
 * @param options - 可選的回呼函數
 */
export async function downloadFile(
  url: string,
  fileName: string,
  options?: DownloadOptions
): Promise<void> {
  options?.onStart?.();

  try {
    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`Download failed: ${response.status} ${response.statusText}`);
    }

    const blob = await response.blob();
    const downloadUrl = window.URL.createObjectURL(blob);

    const link = document.createElement('a');
    link.href = downloadUrl;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    window.URL.revokeObjectURL(downloadUrl);
    options?.onComplete?.();
  } catch (error) {
    const err = error instanceof Error ? error : new Error('Download failed');
    options?.onError?.(err);
    throw err;
  }
}

/**
 * 從 URL 中提取檔案名稱
 */
export function extractFileName(url: string, fallback = 'download'): string {
  try {
    const urlObj = new URL(url);
    const pathname = urlObj.pathname;
    const fileName = pathname.split('/').pop();
    return fileName || fallback;
  } catch {
    return fallback;
  }
}
