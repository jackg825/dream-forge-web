import axios from 'axios';
import * as functions from 'firebase-functions/v1';

const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
const DEFAULT_ALLOWED_IMAGE_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/heic',
  'image/heif',
]);

export interface ValidatedStorageReference {
  url: string;
  storagePath: string;
}

export interface DownloadedValidatedImage extends ValidatedStorageReference {
  base64: string;
  mimeType: string;
}

type AllowedPrefix = 'uploads' | 'pipelines' | string;

function normalizeStoragePath(path: string | null): string | null {
  if (!path) return null;

  let decodedPath: string;
  try {
    decodedPath = decodeURIComponent(path);
  } catch {
    return null;
  }

  const cleanPath = decodedPath.replace(/^\/+/, '');
  const segments = cleanPath.split('/').filter(Boolean);

  if (
    segments.length < 3 ||
    segments.some((segment) => segment === '.' || segment === '..') ||
    cleanPath.includes('\\')
  ) {
    return null;
  }

  return segments.join('/');
}

/**
 * Extract a storage object path from Firebase Storage, Google Storage, or R2 proxy URLs.
 */
export function extractStoragePathFromUrl(rawUrl: string): string | null {
  const trimmedUrl = rawUrl.trim();
  if (!trimmedUrl) return null;

  if (trimmedUrl.startsWith('/download/')) {
    return normalizeStoragePath(trimmedUrl.slice('/download/'.length));
  }

  let parsedUrl: URL;
  try {
    parsedUrl = new URL(trimmedUrl);
  } catch {
    return null;
  }

  if (parsedUrl.pathname.startsWith('/download/')) {
    return normalizeStoragePath(parsedUrl.pathname.slice('/download/'.length));
  }

  if (parsedUrl.hostname === 'firebasestorage.googleapis.com') {
    const objectMatch = parsedUrl.pathname.match(/\/o\/(.+)$/);
    return normalizeStoragePath(objectMatch?.[1] || null);
  }

  if (parsedUrl.hostname === 'storage.googleapis.com') {
    const segments = parsedUrl.pathname.split('/').filter(Boolean);
    if (segments.length < 2) return null;
    return normalizeStoragePath(segments.slice(1).join('/'));
  }

  return null;
}

export function assertUserStorageReference(
  url: string,
  userId: string,
  allowedPrefixes: AllowedPrefix[] = ['uploads']
): ValidatedStorageReference {
  const storagePath = extractStoragePathFromUrl(url);
  const hasAllowedOwnerPrefix = storagePath
    ? allowedPrefixes.some((prefix) => storagePath.startsWith(`${prefix}/${userId}/`))
    : false;

  if (!storagePath || !hasAllowedOwnerPrefix) {
    throw new functions.https.HttpsError(
      'invalid-argument',
      'Image URL must point to a file owned by the current user'
    );
  }

  return {
    url: url.trim(),
    storagePath,
  };
}

export function assertUserStorageReferences(
  urls: string[],
  userId: string,
  allowedPrefixes: AllowedPrefix[] = ['uploads'],
  maxCount = 4
): ValidatedStorageReference[] {
  if (!Array.isArray(urls) || urls.length === 0 || urls.length > maxCount) {
    throw new functions.https.HttpsError(
      'invalid-argument',
      `Expected 1-${maxCount} uploaded image URL(s)`
    );
  }

  return urls.map((url) => assertUserStorageReference(url, userId, allowedPrefixes));
}

export async function downloadValidatedImageAsBase64(
  url: string,
  userId: string,
  allowedPrefixes: AllowedPrefix[] = ['uploads']
): Promise<DownloadedValidatedImage> {
  const reference = assertUserStorageReference(url, userId, allowedPrefixes);
  const response = await axios.get(reference.url, {
    responseType: 'arraybuffer',
    timeout: 30000,
    maxContentLength: MAX_IMAGE_BYTES,
    maxBodyLength: MAX_IMAGE_BYTES,
    maxRedirects: 0,
    validateStatus: (status) => status >= 200 && status < 300,
  });

  const buffer = Buffer.from(response.data);
  const mimeType = String(response.headers['content-type'] || 'image/png').split(';')[0].trim();

  if (buffer.length > MAX_IMAGE_BYTES) {
    throw new functions.https.HttpsError(
      'invalid-argument',
      'Image is too large'
    );
  }

  if (!DEFAULT_ALLOWED_IMAGE_TYPES.has(mimeType)) {
    throw new functions.https.HttpsError(
      'invalid-argument',
      'Image URL must return a supported image type'
    );
  }

  return {
    ...reference,
    base64: buffer.toString('base64'),
    mimeType,
  };
}
