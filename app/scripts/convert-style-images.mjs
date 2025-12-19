/**
 * Convert style preview images to WebP format
 *
 * This script:
 * - Reads PNG images (currently named .jpg)
 * - Resizes to 400x400px
 * - Converts to WebP with optimized quality
 * - Targets <200KB per file
 */

import sharp from 'sharp';
import { stat } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const STYLES_DIR = join(__dirname, '../public/styles');
const STYLES = ['bobblehead', 'chibi', 'cartoon', 'emoji'];
const TARGET_SIZE = 400;
const WEBP_QUALITY = 85;

async function convertImage(inputPath, outputPath) {
  const inputStats = await stat(inputPath);

  await sharp(inputPath)
    .resize(TARGET_SIZE, TARGET_SIZE, {
      fit: 'cover',
      position: 'center'
    })
    .webp({ quality: WEBP_QUALITY })
    .toFile(outputPath);

  const outputStats = await stat(outputPath);

  return {
    input: inputStats.size,
    output: outputStats.size,
    reduction: ((1 - outputStats.size / inputStats.size) * 100).toFixed(1)
  };
}

async function main() {
  console.log('Starting style images conversion to WebP...\n');

  let totalInput = 0;
  let totalOutput = 0;
  let converted = 0;

  for (const style of STYLES) {
    const styleDir = join(STYLES_DIR, style);
    console.log(`Processing ${style}/`);

    for (let i = 1; i <= 6; i++) {
      const inputFile = join(styleDir, `preview-${i}.jpg`);
      const outputFile = join(styleDir, `preview-${i}.webp`);

      try {
        const stats = await convertImage(inputFile, outputFile);
        totalInput += stats.input;
        totalOutput += stats.output;
        converted++;

        const inputKB = (stats.input / 1024).toFixed(0);
        const outputKB = (stats.output / 1024).toFixed(0);
        console.log(`  preview-${i}: ${inputKB}KB → ${outputKB}KB (${stats.reduction}% reduction)`);
      } catch (err) {
        console.error(`  preview-${i}: Error - ${err.message}`);
      }
    }
    console.log('');
  }

  const totalInputMB = (totalInput / 1024 / 1024).toFixed(2);
  const totalOutputMB = (totalOutput / 1024 / 1024).toFixed(2);
  const totalReduction = ((1 - totalOutput / totalInput) * 100).toFixed(1);

  console.log('='.repeat(50));
  console.log(`Converted: ${converted} images`);
  console.log(`Total: ${totalInputMB}MB → ${totalOutputMB}MB (${totalReduction}% reduction)`);
}

main().catch(console.error);
