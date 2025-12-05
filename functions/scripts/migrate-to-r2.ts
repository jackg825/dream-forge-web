#!/usr/bin/env npx ts-node
/**
 * Firebase Storage to Cloudflare R2 Migration Script
 *
 * This script migrates all files from Firebase Storage to Cloudflare R2.
 *
 * Features:
 * - Lists all files in Firebase Storage
 * - Downloads and uploads to R2 in batches
 * - Tracks progress and handles errors gracefully
 * - Supports resume from checkpoint
 * - Dry-run mode for testing
 *
 * Usage:
 *   npx ts-node scripts/migrate-to-r2.ts [options]
 *
 * Options:
 *   --dry-run        Preview files without migrating
 *   --prefix <path>  Only migrate files with this prefix (e.g., "uploads/")
 *   --batch-size <n> Number of concurrent uploads (default: 10)
 *   --checkpoint <f> Resume from checkpoint file
 *
 * Required Environment Variables:
 *   GOOGLE_APPLICATION_CREDENTIALS - Path to Firebase service account JSON
 *   FIREBASE_STORAGE_BUCKET - Firebase Storage bucket name (e.g., dreamforge-66998.firebasestorage.app)
 *   R2_ACCOUNT_ID - Cloudflare R2 account ID
 *   R2_ACCESS_KEY_ID - R2 access key ID
 *   R2_SECRET_ACCESS_KEY - R2 secret access key
 *   R2_BUCKET_NAME - Target R2 bucket name (default: dream-forge-storage)
 */

import * as admin from 'firebase-admin';
import type { Bucket, File } from '@google-cloud/storage';
import {
  S3Client,
  PutObjectCommand,
  HeadObjectCommand,
} from '@aws-sdk/client-s3';
import * as fs from 'fs';

// ============================================
// Configuration
// ============================================

interface Config {
  dryRun: boolean;
  prefix: string;
  batchSize: number;
  checkpointFile: string;
  firebaseBucket: string;
  r2: {
    accountId: string;
    accessKeyId: string;
    secretAccessKey: string;
    bucketName: string;
  };
}

function parseArgs(): Config {
  const args = process.argv.slice(2);
  const config: Config = {
    dryRun: args.includes('--dry-run'),
    prefix: '',
    batchSize: 10,
    checkpointFile: 'migration-checkpoint.json',
    firebaseBucket: process.env.FIREBASE_STORAGE_BUCKET || 'dreamforge-66998.firebasestorage.app',
    r2: {
      accountId: process.env.R2_ACCOUNT_ID || '',
      accessKeyId: process.env.R2_ACCESS_KEY_ID || '',
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY || '',
      bucketName: process.env.R2_BUCKET_NAME || 'dream-forge-storage',
    },
  };

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--prefix' && args[i + 1]) {
      config.prefix = args[++i];
    } else if (args[i] === '--batch-size' && args[i + 1]) {
      config.batchSize = parseInt(args[++i], 10);
    } else if (args[i] === '--checkpoint' && args[i + 1]) {
      config.checkpointFile = args[++i];
    }
  }

  return config;
}

function validateConfig(config: Config): void {
  if (!config.dryRun) {
    if (!config.r2.accountId) {
      throw new Error('R2_ACCOUNT_ID environment variable is required');
    }
    if (!config.r2.accessKeyId) {
      throw new Error('R2_ACCESS_KEY_ID environment variable is required');
    }
    if (!config.r2.secretAccessKey) {
      throw new Error('R2_SECRET_ACCESS_KEY environment variable is required');
    }
  }
}

// ============================================
// Checkpoint Management
// ============================================

interface Checkpoint {
  migratedFiles: string[];
  failedFiles: string[];
  lastUpdated: string;
}

function loadCheckpoint(file: string): Checkpoint {
  try {
    if (fs.existsSync(file)) {
      const data = fs.readFileSync(file, 'utf8');
      return JSON.parse(data);
    }
  } catch (error) {
    console.warn(`Warning: Could not load checkpoint file: ${error}`);
  }
  return { migratedFiles: [], failedFiles: [], lastUpdated: '' };
}

function saveCheckpoint(file: string, checkpoint: Checkpoint): void {
  checkpoint.lastUpdated = new Date().toISOString();
  fs.writeFileSync(file, JSON.stringify(checkpoint, null, 2));
}

// ============================================
// Migration Logic
// ============================================

interface MigrationResult {
  total: number;
  migrated: number;
  skipped: number;
  failed: number;
  errors: { path: string; error: string }[];
}

interface FileInfo {
  name: string;
  contentType: string;
  size: number;
}

async function listAllFiles(
  bucket: Bucket,
  prefix: string
): Promise<FileInfo[]> {
  console.log(`\nListing files with prefix: "${prefix || '(all)'}"...`);

  const [files] = await bucket.getFiles({ prefix });

  return files.map((file: File): FileInfo => ({
    name: file.name,
    contentType: (file.metadata.contentType as string) || 'application/octet-stream',
    size: parseInt(String(file.metadata.size || 0), 10),
  }));
}

async function migrateFile(
  bucket: Bucket,
  s3Client: S3Client,
  r2BucketName: string,
  filePath: string,
  contentType: string
): Promise<void> {
  // Download from Firebase
  const file = bucket.file(filePath);
  const [buffer] = await file.download();

  // Upload to R2
  const command = new PutObjectCommand({
    Bucket: r2BucketName,
    Key: filePath,
    Body: buffer,
    ContentType: contentType,
  });

  await s3Client.send(command);
}

async function checkFileExistsInR2(
  s3Client: S3Client,
  bucketName: string,
  key: string
): Promise<boolean> {
  try {
    await s3Client.send(
      new HeadObjectCommand({
        Bucket: bucketName,
        Key: key,
      })
    );
    return true;
  } catch (error) {
    if ((error as { name?: string }).name === 'NotFound') {
      return false;
    }
    throw error;
  }
}

async function migrate(config: Config): Promise<MigrationResult> {
  // Initialize Firebase Admin
  if (!admin.apps.length) {
    admin.initializeApp({
      credential: admin.credential.applicationDefault(),
      storageBucket: config.firebaseBucket,
    });
  }

  const bucket = admin.storage().bucket(config.firebaseBucket);
  const checkpoint = loadCheckpoint(config.checkpointFile);
  const migratedSet = new Set(checkpoint.migratedFiles);

  const result: MigrationResult = {
    total: 0,
    migrated: 0,
    skipped: 0,
    failed: 0,
    errors: [],
  };

  // List all files
  const files = await listAllFiles(bucket, config.prefix);
  result.total = files.length;

  console.log(`Found ${files.length} files to process\n`);

  if (config.dryRun) {
    console.log('=== DRY RUN MODE ===\n');
    console.log('Files that would be migrated:');

    for (const file of files) {
      const status = migratedSet.has(file.name) ? '[SKIP]' : '[MIGRATE]';
      const sizeKB = (file.size / 1024).toFixed(1);
      console.log(`  ${status} ${file.name} (${sizeKB} KB, ${file.contentType})`);

      if (migratedSet.has(file.name)) {
        result.skipped++;
      } else {
        result.migrated++;
      }
    }

    console.log('\n=== DRY RUN SUMMARY ===');
    console.log(`Total files: ${result.total}`);
    console.log(`Would migrate: ${result.migrated}`);
    console.log(`Would skip (already migrated): ${result.skipped}`);

    return result;
  }

  // Initialize R2 client
  const s3Client = new S3Client({
    region: 'auto',
    endpoint: `https://${config.r2.accountId}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: config.r2.accessKeyId,
      secretAccessKey: config.r2.secretAccessKey,
    },
  });

  // Process files in batches
  console.log(`Migrating files (batch size: ${config.batchSize})...\n`);

  for (let i = 0; i < files.length; i += config.batchSize) {
    const batch = files.slice(i, i + config.batchSize);

    const promises = batch.map(async (file) => {
      const shortPath = file.name.length > 60
        ? '...' + file.name.slice(-57)
        : file.name;

      // Skip if already migrated
      if (migratedSet.has(file.name)) {
        console.log(`  [SKIP] ${shortPath}`);
        result.skipped++;
        return;
      }

      // Check if file already exists in R2
      try {
        const exists = await checkFileExistsInR2(
          s3Client,
          config.r2.bucketName,
          file.name
        );

        if (exists) {
          console.log(`  [EXISTS] ${shortPath}`);
          migratedSet.add(file.name);
          checkpoint.migratedFiles.push(file.name);
          result.skipped++;
          return;
        }
      } catch {
        // Continue with migration if check fails
      }

      // Migrate the file
      try {
        await migrateFile(
          bucket,
          s3Client,
          config.r2.bucketName,
          file.name,
          file.contentType
        );

        console.log(`  [OK] ${shortPath}`);
        migratedSet.add(file.name);
        checkpoint.migratedFiles.push(file.name);
        result.migrated++;
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : 'Unknown error';
        console.error(`  [FAIL] ${shortPath}: ${errorMsg}`);
        checkpoint.failedFiles.push(file.name);
        result.failed++;
        result.errors.push({ path: file.name, error: errorMsg });
      }
    });

    await Promise.all(promises);

    // Save checkpoint after each batch
    saveCheckpoint(config.checkpointFile, checkpoint);

    // Progress update
    const progress = Math.min(100, Math.round(((i + batch.length) / files.length) * 100));
    console.log(`\n  Progress: ${progress}% (${i + batch.length}/${files.length})\n`);
  }

  return result;
}

// ============================================
// Main
// ============================================

async function main(): Promise<void> {
  console.log('====================================');
  console.log('Firebase Storage → R2 Migration Tool');
  console.log('====================================\n');

  const config = parseArgs();

  try {
    validateConfig(config);
  } catch (error) {
    console.error(`Configuration error: ${error}`);
    process.exit(1);
  }

  console.log('Configuration:');
  console.log(`  Mode: ${config.dryRun ? 'Dry Run' : 'Live Migration'}`);
  console.log(`  Prefix: ${config.prefix || '(all files)'}`);
  console.log(`  Batch Size: ${config.batchSize}`);
  console.log(`  Checkpoint File: ${config.checkpointFile}`);
  console.log(`  Firebase Bucket: ${config.firebaseBucket}`);
  console.log(`  R2 Bucket: ${config.r2.bucketName}`);

  try {
    const result = await migrate(config);

    console.log('\n====================================');
    console.log('Migration Complete');
    console.log('====================================');
    console.log(`Total files: ${result.total}`);
    console.log(`Migrated: ${result.migrated}`);
    console.log(`Skipped: ${result.skipped}`);
    console.log(`Failed: ${result.failed}`);

    if (result.errors.length > 0) {
      console.log('\nFailed files:');
      for (const err of result.errors.slice(0, 10)) {
        console.log(`  ${err.path}: ${err.error}`);
      }
      if (result.errors.length > 10) {
        console.log(`  ... and ${result.errors.length - 10} more`);
      }
    }

    process.exit(result.failed > 0 ? 1 : 0);
  } catch (error) {
    console.error('\nMigration failed:', error);
    process.exit(1);
  }
}

main();
