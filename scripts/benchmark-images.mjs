#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';

const sharp = createRequire(new URL('../functions/package.json', import.meta.url))('sharp');
export const RESERVATION_USD = 0.30; // Planning estimate, never a provider-enforced billing cap.
export const PROVIDERS = {
  openai: { model: 'gpt-image-2', credential: 'OPENAI_API_KEY', url: 'https://api.openai.com/v1/images/edits' },
  gemini: { model: 'gemini-3-pro-image', credential: 'GEMINI_API_KEY', url: 'https://generativelanguage.googleapis.com/v1beta/models/gemini-3-pro-image:generateContent' },
  seedream: { model: 'seedream-5-0-lite-260128', credential: 'BYTEPLUS_API_KEY', url: 'https://ark.ap-southeast.bytepluses.com/api/v3/images/generations' },
};
const hash = (value) => createHash('sha256').update(value).digest('hex');
const failure = (code) => Object.assign(new Error(code), { benchmarkCode: code });
const mimeTypes = { png: 'image/png', jpeg: 'image/jpeg', webp: 'image/webp' };
const modalityUsageKeys = new Set(['promptTokensDetails', 'candidatesTokensDetails', 'cacheTokensDetails']);
const usageKeys = new Set(['input_tokens', 'output_tokens', 'total_tokens', 'input_tokens_details', 'output_tokens_details', 'image_tokens', 'text_tokens', 'cached_tokens', 'generated_images', 'promptTokenCount', 'candidatesTokenCount', 'totalTokenCount', 'thoughtsTokenCount', 'cachedContentTokenCount']);
function numericUsage(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const entries = Object.entries(value).flatMap(([key, child]) => {
    if (modalityUsageKeys.has(key) && Array.isArray(child)) {
      const items = child.filter((item) => item && ['IMAGE', 'TEXT'].includes(item.modality) && Number.isFinite(item.tokenCount))
        .map(({ modality, tokenCount }) => ({ modality, tokenCount }));
      return items.length ? [[key, items]] : [];
    }
    if (!usageKeys.has(key)) return [];
    if (Number.isFinite(child)) return [[key, child]];
    const nested = numericUsage(child);
    return nested ? [[key, nested]] : [];
  });
  return entries.length ? Object.fromEntries(entries) : null;
}
function safeIdentifier(value, env) {
  if (typeof value !== 'string' || !/^[\w.:-]{1,160}$/.test(value)) return undefined;
  return Object.values(PROVIDERS).some(({ credential }) => env[credential] && value.includes(env[credential])) ? undefined : value;
}

export async function preflight(config, { execute = false, budgetUsd, env = {}, baseDir = process.cwd() } = {}) {
  if (!config || !Array.isArray(config.samples) || config.samples.length < 1 || config.samples.length > 3) throw failure('expected_one_to_three_samples');
  if (!Array.isArray(config.providers) || config.providers.length < 1 || config.providers.some((provider) => !Object.hasOwn(PROVIDERS, provider)) || new Set(config.providers).size !== config.providers.length) throw failure('invalid_or_duplicate_providers');
  if (typeof config.prompt !== 'string' || !config.prompt.trim() || config.prompt.length > 8000) throw failure('prompt_must_contain_one_to_8000_characters');
  if (typeof config.outputDir !== 'string' || !config.outputDir.trim()) throw failure('output_directory_required');
  const callCount = config.samples.length * config.providers.length;
  if (callCount > 9) throw failure('maximum_nine_calls');
  const reservationUsd = Math.round(callCount * RESERVATION_USD * 100) / 100;
  if (execute && (!Number.isFinite(budgetUsd) || budgetUsd <= 0 || budgetUsd + 1e-9 < reservationUsd)) throw failure('authorized_budget_below_reservation_or_missing');
  const credentials = Object.fromEntries(config.providers.map((provider) => [provider, Boolean(env[PROVIDERS[provider].credential]?.trim())]));
  if (execute && Object.values(credentials).some((present) => !present)) throw failure('all_selected_provider_credentials_required');
  const outputDir = path.resolve(baseDir, config.outputDir);
  try { await fs.lstat(outputDir); throw failure('output_directory_already_exists_no_resume'); }
  catch (error) { if (error.code !== 'ENOENT') throw error; }
  const ids = new Set();
  const samples = [];
  for (const sample of config.samples) {
    if (!sample || typeof sample.id !== 'string' || !/^[A-Za-z0-9_-]{1,64}$/.test(sample.id) || ids.has(sample.id) || typeof sample.path !== 'string') throw failure('invalid_or_duplicate_sample');
    ids.add(sample.id);
    let bytes;
    try { const inputPath = path.resolve(baseDir, sample.path); const stat = await fs.stat(inputPath); if (!stat.isFile() || stat.size > 20 * 1024 * 1024) throw failure('input_exceeds_20MB'); bytes = await fs.readFile(inputPath); }
    catch (error) { throw error.benchmarkCode ? error : failure('sample_unreadable'); }
    if (bytes.length > 20 * 1024 * 1024) throw failure('input_exceeds_20MB');
    let metadata;
    try { metadata = await sharp(bytes, { limitInputPixels: 36_000_000 }).metadata(); } catch { throw failure('invalid_image_or_input_exceeds_36MP'); }
    if (!mimeTypes[metadata.format] || !Number.isInteger(metadata.width) || !Number.isInteger(metadata.height) || metadata.width < 1 || metadata.height < 1 || metadata.width * metadata.height > 36_000_000 || (metadata.pages || 1) > 1) throw failure('expected_single_png_jpeg_or_webp');
    samples.push({ id: sample.id, sha256: hash(bytes), width: metadata.width, height: metadata.height, byteLength: bytes.length, mimeType: mimeTypes[metadata.format], bytes });
  }
  return {
    samples, outputDir,
    summary: { mode: execute ? 'execute' : 'dry-run', samples: samples.map(({ bytes: _bytes, ...sample }) => sample), providers: config.providers.map((provider) => ({ provider, model: PROVIDERS[provider].model, credentialPresent: credentials[provider] })), promptSha256: hash(config.prompt), callCount, reservationUsd, authorizedBudgetUsd: execute ? budgetUsd : null, reservationNote: 'USD 0.30 per call is a planning reservation, not a billing guarantee or provider spending limit.', outputDir },
  };
}

export function requestMetadata(provider) {
  const { model, url } = PROVIDERS[provider];
  const parameters = provider === 'openai'
    ? { model, size: '2048x2048', quality: 'medium', n: 1, output_format: 'png', background: 'opaque' }
    : provider === 'gemini'
      ? { generationConfig: { responseModalities: ['IMAGE'], maxOutputTokens: 8192, imageConfig: { aspectRatio: '1:1', imageSize: '2K' } } }
      : { model, size: '2048x2048', sequential_image_generation: 'disabled', stream: false, response_format: 'b64_json', output_format: 'png', watermark: false };
  return { method: 'POST', endpoint: url, apiVersion: provider === 'openai' ? 'v1' : provider === 'gemini' ? 'v1beta' : 'v3', parameters };
}

export function buildRequest(provider, sample, prompt, env) {
  const { credential } = PROVIDERS[provider];
  const { parameters } = requestMetadata(provider);
  if (provider === 'openai') {
    const body = new FormData();
    for (const [key, value] of Object.entries({ ...parameters, prompt })) body.set(key, String(value));
    body.append('image[]', new Blob([sample.bytes], { type: sample.mimeType }), `${sample.id}.${sample.mimeType.split('/')[1]}`);
    return { method: 'POST', headers: { Authorization: `Bearer ${env[credential]}` }, body };
  }
  const data = sample.bytes.toString('base64');
  const body = provider === 'gemini'
    ? { ...parameters, contents: [{ role: 'user', parts: [{ inlineData: { mimeType: sample.mimeType, data } }, { text: prompt }] }] }
    : { ...parameters, prompt, image: `data:${sample.mimeType};base64,${data}` };
  return { method: 'POST', headers: { 'Content-Type': 'application/json', ...(provider === 'gemini' ? { 'x-goog-api-key': env[credential] } : { Authorization: `Bearer ${env[credential]}` }) }, body: JSON.stringify(body) };
}

function decodeResponse(provider, payload) {
  if (!payload || typeof payload !== 'object' || payload.error) throw failure('provider_error_response');
  const images = provider === 'gemini'
    ? (payload.candidates || []).flatMap((candidate) => (candidate.content?.parts || []).filter((part) => !part.thought && part.inlineData?.data).map((part) => part.inlineData.data))
    : (payload.data || []).map((item) => item.error ? null : item.b64_json);
  if (images.length !== 1 || typeof images[0] !== 'string' || !images[0] || !/^[A-Za-z0-9+/]+={0,2}$/.test(images[0]) || images[0].length % 4 !== 0) throw failure('expected_exactly_one_base64_image');
  return Buffer.from(images[0], 'base64');
}

export async function saveOutput(bytes, directory) {
  await fs.mkdir(directory);
  // Always save the original returned bytes before attempting inspection or cropping.
  await fs.writeFile(path.join(directory, 'original.bin'), bytes, { flag: 'wx' });
  let metadata;
  try { metadata = await sharp(bytes).metadata(); } catch { throw failure('returned_bytes_are_not_a_valid_image'); }
  const { width, height, format } = metadata;
  if (!mimeTypes[format] || !Number.isInteger(width) || !Number.isInteger(height) || width < 1 || height < 1) throw failure('unsupported_output_image');
  const original = `original.${format === 'jpeg' ? 'jpg' : format}`;
  await fs.rename(path.join(directory, 'original.bin'), path.join(directory, original));
  const deviations = width === 2048 && height === 2048 ? [] : ['output_dimensions_differ_from_2048x2048'];
  const crops = [];
  if (width === height && width % 2 === 0) {
    for (const [index, angle] of ['front', 'back', 'left', 'right'].entries()) {
      const filename = `${angle}.png`;
      await sharp(bytes).extract({ left: index % 2 * width / 2, top: Math.floor(index / 2) * height / 2, width: width / 2, height: height / 2 }).png().toFile(path.join(directory, filename));
      crops.push(filename);
    }
  } else deviations.push('native_crop_skipped_not_even_square');
  return { original, sha256: hash(bytes), byteLength: bytes.length, width, height, format, crops, deviations };
}

async function writeManifest(filename, manifest) {
  const temporary = `${filename}.tmp`;
  const handle = await fs.open(temporary, 'w');
  try { await handle.writeFile(JSON.stringify(manifest, null, 2)); await handle.sync(); } finally { await handle.close(); }
  await fs.rename(temporary, filename);
}

export async function runBenchmark(config, { execute = false, budgetUsd, env = {}, baseDir = process.cwd(), fetchImpl = fetch, log = console.log } = {}) {
  const prepared = await preflight(config, { execute, budgetUsd, env, baseDir });
  log(JSON.stringify(prepared.summary, null, 2));
  if (!execute) return prepared.summary;
  // The exclusive directory creation is a second race-safe guard against duplicate runs.
  await fs.mkdir(path.dirname(prepared.outputDir), { recursive: true });
  try { await fs.mkdir(prepared.outputDir); } catch { throw failure('output_directory_already_exists_or_unwritable'); }
  const manifestPath = path.join(prepared.outputDir, 'manifest.json');
  const manifest = { ...prepared.summary, prompt: config.prompt, startedAt: new Date().toISOString(), status: 'running', reservedUsd: 0, calls: [] };
  await fs.mkdir(path.join(prepared.outputDir, 'inputs'));
  for (const [index, sample] of prepared.samples.entries()) {
    const inputFile = `inputs/${sample.id}.${sample.mimeType.split('/')[1]}`;
    await fs.writeFile(path.join(prepared.outputDir, inputFile), sample.bytes, { flag: 'wx' });
    manifest.samples[index].inputFile = inputFile;
  }
  await writeManifest(manifestPath, manifest);
  for (const sample of prepared.samples) for (const provider of config.providers) {
    const record = { sampleId: sample.id, provider, model: PROVIDERS[provider].model, request: requestMetadata(provider), status: 'reserved', reservedUsd: RESERVATION_USD, startedAt: new Date().toISOString() };
    manifest.reservedUsd = Math.round((manifest.reservedUsd + RESERVATION_USD) * 100) / 100;
    manifest.calls.push(record);
    await writeManifest(manifestPath, manifest); // Durable reservation before the paid request.
    log(JSON.stringify({ event: 'call-started', sampleId: sample.id, provider, reservedUsd: manifest.reservedUsd }));
    const started = Date.now();
    try {
      const response = await fetchImpl(PROVIDERS[provider].url, { ...buildRequest(provider, sample, config.prompt, env), signal: AbortSignal.timeout(180_000), redirect: 'error' });
      record.httpStatus = response.status;
      record.requestId = safeIdentifier(response.headers.get('x-request-id'), env);
      let payload;
      try { payload = await response.json(); } catch { throw failure(response.ok ? 'invalid_provider_json' : 'provider_http_failure'); }
      record.requestId ||= safeIdentifier(payload?.responseId || response.headers.get('x-tt-logid'), env);
      record.returnedModel = safeIdentifier(payload?.modelVersion || payload?.model, env) || 'unknown';
      record.finishReason = safeIdentifier(payload?.candidates?.[0]?.finishReason, env) || null;
      record.blockReason = safeIdentifier(payload?.promptFeedback?.blockReason, env) || null;
      record.usage = numericUsage(payload?.usage || payload?.usageMetadata);
      if (!response.ok) throw failure('provider_http_failure');
      const bytes = decodeResponse(provider, payload);
      record.outputDirectory = `${sample.id}-${provider}`;
      record.output = await saveOutput(bytes, path.join(prepared.outputDir, record.outputDirectory));
      record.status = 'succeeded';
      record.elapsedMs = Date.now() - started;
      await writeManifest(manifestPath, manifest);
      log(JSON.stringify({ event: 'call-completed', sampleId: sample.id, provider, elapsedMs: record.elapsedMs, deviations: record.output.deviations }));
    } catch (error) {
      record.status = 'failed';
      record.elapsedMs = Date.now() - started;
      record.error = error.benchmarkCode || (error.name === 'TimeoutError' || error.name === 'AbortError' ? 'request_timeout_outcome_unknown' : 'request_failed_outcome_unknown');
      manifest.status = 'stopped';
      await writeManifest(manifestPath, manifest);
      log(JSON.stringify({ event: 'benchmark-stopped', sampleId: sample.id, provider, error: record.error }));
      throw failure('benchmark_stopped_inspect_manifest_no_automatic_retry');
    }
  }
  manifest.status = 'completed';
  manifest.completedAt = new Date().toISOString();
  await writeManifest(manifestPath, manifest);
  return manifest;
}

async function main(args) {
  if (args.includes('--help')) { console.log('node scripts/benchmark-images.mjs --config CONFIG.json [--execute --budget-usd AMOUNT]\nDefaults to dry-run. Sample paths and outputDir resolve from the current directory.'); return; }
  let configPath; let execute = false; let budgetUsd;
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--config') configPath = args[++i];
    else if (args[i] === '--execute') execute = true;
    else if (args[i] === '--budget-usd') budgetUsd = Number(args[++i]);
    else throw failure('unknown_argument');
  }
  if (!configPath) throw failure('config_path_required');
  let config;
  try { config = JSON.parse(await fs.readFile(configPath, 'utf8')); } catch { throw failure('invalid_or_unreadable_config_json'); }
  await runBenchmark(config, { execute, budgetUsd, env: process.env });
}
if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  main(process.argv.slice(2)).catch((error) => { console.error(error.benchmarkCode || 'benchmark_failed'); process.exitCode = 1; });
}
