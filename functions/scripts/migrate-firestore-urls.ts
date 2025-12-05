#!/usr/bin/env npx ts-node
/**
 * Firestore URL Migration Script
 *
 * Updates all pipeline documents to use R2 URLs instead of Firebase Storage URLs.
 * This script converts Firebase Storage signed URLs to R2 public URLs based on
 * the storagePath field.
 *
 * Usage:
 *   npx ts-node scripts/migrate-firestore-urls.ts [options]
 *
 * Options:
 *   --dry-run        Preview changes without updating Firestore
 *   --pipeline <id>  Only migrate a specific pipeline
 *   --batch-size <n> Number of documents per batch (default: 50)
 *
 * Required Environment Variables:
 *   GOOGLE_APPLICATION_CREDENTIALS - Path to Firebase service account JSON
 */

import * as admin from 'firebase-admin';

// ============================================
// Configuration
// ============================================

const R2_PUBLIC_URL = 'https://dream-forge-r2-proxy.jackg825.workers.dev';

interface Config {
  dryRun: boolean;
  pipelineId: string | null;
  batchSize: number;
}

function parseArgs(): Config {
  const args = process.argv.slice(2);
  const config: Config = {
    dryRun: args.includes('--dry-run'),
    pipelineId: null,
    batchSize: 50,
  };

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--pipeline' && args[i + 1]) {
      config.pipelineId = args[++i];
    } else if (args[i] === '--batch-size' && args[i + 1]) {
      config.batchSize = parseInt(args[++i], 10);
    }
  }

  return config;
}

// ============================================
// URL Conversion
// ============================================

/**
 * Check if a URL is a Firebase Storage URL
 */
function isFirebaseStorageUrl(url: string): boolean {
  if (!url) return false;
  return (
    url.includes('firebasestorage.googleapis.com') ||
    url.includes('storage.googleapis.com') ||
    url.includes('firebasestorage.app')
  );
}

/**
 * Convert a storage path to R2 public URL
 */
function storagePathToR2Url(storagePath: string): string {
  return `${R2_PUBLIC_URL}/download/${storagePath}`;
}

// ============================================
// Migration Logic
// ============================================

interface MigrationResult {
  totalPipelines: number;
  updatedPipelines: number;
  skippedPipelines: number;
  totalUrlsUpdated: number;
  errors: { pipelineId: string; error: string }[];
}

interface UrlUpdate {
  field: string;
  oldUrl: string;
  newUrl: string;
}

/**
 * Process a single pipeline document and return the updates needed
 */
function processPipelineDoc(
  pipelineId: string,
  data: FirebaseFirestore.DocumentData
): { updates: Record<string, unknown>; urlChanges: UrlUpdate[] } | null {
  const updates: Record<string, unknown> = {};
  const urlChanges: UrlUpdate[] = [];

  // 1. Update inputImages[].url
  if (data.inputImages && Array.isArray(data.inputImages)) {
    const newInputImages = data.inputImages.map(
      (img: { url?: string; storagePath?: string }, idx: number) => {
        if (img.storagePath && isFirebaseStorageUrl(img.url || '')) {
          const newUrl = storagePathToR2Url(img.storagePath);
          urlChanges.push({
            field: `inputImages[${idx}].url`,
            oldUrl: img.url || '',
            newUrl,
          });
          return { ...img, url: newUrl };
        }
        return img;
      }
    );
    if (urlChanges.length > 0) {
      updates.inputImages = newInputImages;
    }
  }

  // 2. Update meshUrl
  if (data.meshStoragePath && isFirebaseStorageUrl(data.meshUrl || '')) {
    const newUrl = storagePathToR2Url(data.meshStoragePath);
    urlChanges.push({
      field: 'meshUrl',
      oldUrl: data.meshUrl || '',
      newUrl,
    });
    updates.meshUrl = newUrl;
  }

  // 3. Update texturedModelUrl
  if (
    data.texturedModelStoragePath &&
    isFirebaseStorageUrl(data.texturedModelUrl || '')
  ) {
    const newUrl = storagePathToR2Url(data.texturedModelStoragePath);
    urlChanges.push({
      field: 'texturedModelUrl',
      oldUrl: data.texturedModelUrl || '',
      newUrl,
    });
    updates.texturedModelUrl = newUrl;
  }

  // 4. Update meshImages
  if (data.meshImages && typeof data.meshImages === 'object') {
    const newMeshImages = { ...data.meshImages };
    let meshImagesUpdated = false;

    for (const [angle, img] of Object.entries(data.meshImages)) {
      const imgData = img as { url?: string; storagePath?: string };
      if (imgData?.storagePath && isFirebaseStorageUrl(imgData.url || '')) {
        const newUrl = storagePathToR2Url(imgData.storagePath);
        urlChanges.push({
          field: `meshImages.${angle}.url`,
          oldUrl: imgData.url || '',
          newUrl,
        });
        newMeshImages[angle] = { ...imgData, url: newUrl };
        meshImagesUpdated = true;
      }
    }

    if (meshImagesUpdated) {
      updates.meshImages = newMeshImages;
    }
  }

  // 5. Update textureImages
  if (data.textureImages && typeof data.textureImages === 'object') {
    const newTextureImages = { ...data.textureImages };
    let textureImagesUpdated = false;

    for (const [angle, img] of Object.entries(data.textureImages)) {
      const imgData = img as { url?: string; storagePath?: string };
      if (imgData?.storagePath && isFirebaseStorageUrl(imgData.url || '')) {
        const newUrl = storagePathToR2Url(imgData.storagePath);
        urlChanges.push({
          field: `textureImages.${angle}.url`,
          oldUrl: imgData.url || '',
          newUrl,
        });
        newTextureImages[angle] = { ...imgData, url: newUrl };
        textureImagesUpdated = true;
      }
    }

    if (textureImagesUpdated) {
      updates.textureImages = newTextureImages;
    }
  }

  // 6. Update meshDownloadFiles (log only, no auto-update)
  if (data.meshDownloadFiles && Array.isArray(data.meshDownloadFiles)) {
    data.meshDownloadFiles.forEach(
      (file: { url?: string; name?: string }, idx: number) => {
        if (file.url && isFirebaseStorageUrl(file.url)) {
          urlChanges.push({
            field: `meshDownloadFiles[${idx}].url`,
            oldUrl: file.url,
            newUrl: '[NEEDS_MANUAL_MIGRATION]',
          });
        }
      }
    );
  }

  // 7. Update texturedDownloadFiles (same as above)
  if (data.texturedDownloadFiles && Array.isArray(data.texturedDownloadFiles)) {
    data.texturedDownloadFiles.forEach(
      (file: { url?: string; name?: string }, idx: number) => {
        if (file.url && isFirebaseStorageUrl(file.url)) {
          urlChanges.push({
            field: `texturedDownloadFiles[${idx}].url`,
            oldUrl: file.url,
            newUrl: '[NEEDS_MANUAL_MIGRATION]',
          });
        }
      }
    );
  }

  if (Object.keys(updates).length === 0) {
    return null;
  }

  // Add updatedAt timestamp
  updates.updatedAt = admin.firestore.FieldValue.serverTimestamp();

  return { updates, urlChanges };
}

async function migrate(config: Config): Promise<MigrationResult> {
  // Initialize Firebase Admin
  if (!admin.apps.length) {
    admin.initializeApp({
      credential: admin.credential.applicationDefault(),
    });
  }

  const db = admin.firestore();
  const result: MigrationResult = {
    totalPipelines: 0,
    updatedPipelines: 0,
    skippedPipelines: 0,
    totalUrlsUpdated: 0,
    errors: [],
  };

  console.log('\n========================================');
  console.log('Firestore URL Migration');
  console.log('========================================\n');

  // Get pipelines to process
  let query: FirebaseFirestore.Query = db.collectionGroup('pipelines');

  if (config.pipelineId) {
    console.log(`Migrating single pipeline: ${config.pipelineId}\n`);
  }

  // Get all documents
  const snapshot = await query.get();
  result.totalPipelines = snapshot.size;

  console.log(`Found ${snapshot.size} pipeline documents\n`);

  if (config.dryRun) {
    console.log('=== DRY RUN MODE ===\n');
  }

  // Process in batches
  const docs = snapshot.docs;
  let batch = db.batch();
  let batchCount = 0;

  for (const doc of docs) {
    const pipelineId = doc.id;

    // Filter by specific pipeline if provided
    if (config.pipelineId && pipelineId !== config.pipelineId) {
      continue;
    }

    try {
      const data = doc.data();
      const processed = processPipelineDoc(pipelineId, data);

      if (!processed) {
        result.skippedPipelines++;
        continue;
      }

      const { updates, urlChanges } = processed;

      console.log(`\n[${pipelineId}] Found ${urlChanges.length} URLs to update:`);
      for (const change of urlChanges) {
        const shortOld =
          change.oldUrl.length > 60
            ? change.oldUrl.slice(0, 57) + '...'
            : change.oldUrl;
        console.log(`  ${change.field}:`);
        console.log(`    - ${shortOld}`);
        console.log(`    + ${change.newUrl}`);
      }

      if (!config.dryRun) {
        batch.update(doc.ref, updates);
        batchCount++;

        // Commit batch when reaching batch size
        if (batchCount >= config.batchSize) {
          await batch.commit();
          console.log(`\n  [Committed batch of ${batchCount} updates]`);
          batch = db.batch();
          batchCount = 0;
        }
      }

      result.updatedPipelines++;
      result.totalUrlsUpdated += urlChanges.length;
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      console.error(`  [ERROR] ${pipelineId}: ${errorMsg}`);
      result.errors.push({ pipelineId, error: errorMsg });
    }
  }

  // Commit remaining batch
  if (!config.dryRun && batchCount > 0) {
    await batch.commit();
    console.log(`\n  [Committed final batch of ${batchCount} updates]`);
  }

  return result;
}

// ============================================
// Main
// ============================================

async function main(): Promise<void> {
  const config = parseArgs();

  console.log('Configuration:');
  console.log(`  Mode: ${config.dryRun ? 'Dry Run' : 'Live Migration'}`);
  console.log(`  Pipeline: ${config.pipelineId || '(all)'}`);
  console.log(`  Batch Size: ${config.batchSize}`);
  console.log(`  R2 URL: ${R2_PUBLIC_URL}`);

  try {
    const result = await migrate(config);

    console.log('\n========================================');
    console.log('Migration Summary');
    console.log('========================================');
    console.log(`Total pipelines: ${result.totalPipelines}`);
    console.log(`Updated: ${result.updatedPipelines}`);
    console.log(`Skipped (no Firebase URLs): ${result.skippedPipelines}`);
    console.log(`Total URLs updated: ${result.totalUrlsUpdated}`);
    console.log(`Errors: ${result.errors.length}`);

    if (result.errors.length > 0) {
      console.log('\nFailed pipelines:');
      for (const err of result.errors.slice(0, 10)) {
        console.log(`  ${err.pipelineId}: ${err.error}`);
      }
    }

    if (config.dryRun) {
      console.log('\n*** This was a DRY RUN - no changes were made ***');
      console.log('Run without --dry-run to apply changes.');
    }

    process.exit(result.errors.length > 0 ? 1 : 0);
  } catch (error) {
    console.error('\nMigration failed:', error);
    process.exit(1);
  }
}

main();
