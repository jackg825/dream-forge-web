import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { preflight, buildRequest, runBenchmark, saveOutput } from './benchmark-images.mjs';

const sharp = createRequire(new URL('../functions/package.json', import.meta.url))('sharp');
const env = { OPENAI_API_KEY: 'test-openai-credential', GEMINI_API_KEY: 'test-gemini-credential', BYTEPLUS_API_KEY: 'test-byteplus-credential' };
const exists = async (filename) => fs.lstat(filename).then(() => true, () => false);
async function fixture(t, providers = ['openai', 'gemini', 'seedream']) {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'image-benchmark-test-'));
  t.after(() => fs.rm(directory, { recursive: true, force: true }));
  const bytes = await sharp({ create: { width: 32, height: 32, channels: 3, background: '#112233' } }).png().toBuffer();
  await fs.writeFile(path.join(directory, 'sample.png'), bytes);
  const config = { samples: [{ id: 'sample', path: 'sample.png' }], prompt: 'Same subject, same four views.', providers, outputDir: 'results' };
  return { directory, bytes, config, options: { env, baseDir: directory, execute: true, budgetUsd: 3, log() {} }, manifestPath: path.join(directory, 'results/manifest.json') };
}
const response = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'x-request-id': 'req-safe-1' } });

// All network operations are replaced with mocks. These tests never consume API credits.
test('dry-run hashes and measures inputs without credentials, network or output writes', async (t) => {
  const f = await fixture(t);
  let calls = 0;
  const summary = await runBenchmark(f.config, { baseDir: f.directory, fetchImpl: () => { calls++; }, log() {} });
  assert.equal(summary.mode, 'dry-run');
  assert.equal(summary.callCount, 3);
  assert.equal(summary.reservationUsd, 0.9);
  assert.equal(summary.samples[0].width, 32);
  assert.equal(summary.samples[0].height, 32);
  assert.match(summary.samples[0].sha256, /^[a-f0-9]{64}$/);
  assert.ok(summary.providers.every((provider) => provider.credentialPresent === false));
  assert.ok(!JSON.stringify(summary).includes('bytes'));
  assert.equal(calls, 0);
  assert.equal(await exists(path.join(f.directory, 'results')), false);
});

test('sample/prompt/provider caps and the complete budget reservation are enforced before spending', async (t) => {
  const f = await fixture(t);
  const threeSamples = ['one', 'two', 'three'].map((id) => ({ id, path: 'sample.png' }));
  const max = await preflight({ ...f.config, samples: threeSamples }, f.options);
  assert.equal(max.summary.callCount, 9);
  assert.equal(max.summary.reservationUsd, 2.7);
  for (const invalid of [
    { ...f.config, samples: [...threeSamples, { id: 'four', path: 'sample.png' }] },
    { ...f.config, samples: [f.config.samples[0], f.config.samples[0]] },
    { ...f.config, providers: ['openai', 'openai'] },
    { ...f.config, providers: ['unknown'] },
    { ...f.config, prompt: 'a'.repeat(8001) },
  ]) await assert.rejects(preflight(invalid, f.options));
  for (const budgetUsd of [undefined, NaN, Infinity, -1, 0, 0.89]) {
    let calls = 0;
    await assert.rejects(runBenchmark(f.config, { ...f.options, budgetUsd, fetchImpl: () => { calls++; } }), /authorized_budget/);
    assert.equal(calls, 0);
  }
  assert.equal(await exists(path.join(f.directory, 'results')), false);
});

test('missing even one selected credential prevents partial execution', async (t) => {
  const f = await fixture(t);
  let calls = 0;
  await assert.rejects(runBenchmark(f.config, { ...f.options, env: { OPENAI_API_KEY: env.OPENAI_API_KEY, GEMINI_API_KEY: env.GEMINI_API_KEY }, fetchImpl: () => { calls++; } }), /all_selected_provider_credentials_required/);
  assert.equal(calls, 0);
  assert.equal(await exists(path.join(f.directory, 'results')), false);
});

test('input limits reject unreadable/oversized files before creating a run', async (t) => {
  const f = await fixture(t);
  await fs.writeFile(path.join(f.directory, 'large.png'), Buffer.alloc(20 * 1024 * 1024 + 1));
  await assert.rejects(preflight({ ...f.config, samples: [{ id: 'large', path: 'large.png' }] }, f.options), /input_exceeds_20MB/);
  await assert.rejects(preflight({ ...f.config, samples: [{ id: 'missing', path: 'missing.png' }] }, f.options), /sample_unreadable/);
  assert.equal(await exists(path.join(f.directory, 'results')), false);
});

test('adapters send the identical original bytes and prompt with the verified one-image contracts', async (t) => {
  const f = await fixture(t);
  const { samples } = await preflight(f.config, f.options);
  const openai = buildRequest('openai', samples[0], f.config.prompt, env);
  assert.equal(openai.body.get('model'), 'gpt-image-2');
  assert.equal(openai.body.get('quality'), 'medium');
  assert.equal(openai.body.get('size'), '2048x2048');
  assert.equal(openai.body.get('n'), '1');
  assert.equal(openai.body.get('prompt'), f.config.prompt);
  assert.equal(openai.body.getAll('image[]').length, 1);
  assert.deepEqual(Buffer.from(await openai.body.get('image[]').arrayBuffer()), f.bytes);
  assert.equal(openai.body.has('input_fidelity'), false);
  const gemini = JSON.parse(buildRequest('gemini', samples[0], f.config.prompt, env).body);
  assert.equal(gemini.contents[0].parts[1].text, f.config.prompt);
  assert.deepEqual(Buffer.from(gemini.contents[0].parts[0].inlineData.data, 'base64'), f.bytes);
  assert.deepEqual(gemini.generationConfig.imageConfig, { aspectRatio: '1:1', imageSize: '2K' });
  assert.equal(gemini.generationConfig.maxOutputTokens, 8192);
  const seedream = JSON.parse(buildRequest('seedream', samples[0], f.config.prompt, env).body);
  assert.equal(seedream.model, 'seedream-5-0-lite-260128');
  assert.equal(seedream.prompt, f.config.prompt);
  assert.equal(seedream.size, '2048x2048');
  assert.equal(seedream.sequential_image_generation, 'disabled');
  assert.equal(seedream.response_format, 'b64_json');
  assert.deepEqual(Buffer.from(seedream.image.split(',')[1], 'base64'), f.bytes);
});

test('manifest reservation is durable before each request, and an existing output prevents duplicates', async (t) => {
  const f = await fixture(t, ['openai']);
  let calls = 0;
  const fetchImpl = async () => {
    calls++;
    const manifest = JSON.parse(await fs.readFile(f.manifestPath, 'utf8'));
    assert.equal(manifest.calls[0].status, 'reserved');
    assert.equal(manifest.reservedUsd, 0.3);
    assert.equal(manifest.prompt, f.config.prompt);
    assert.equal(manifest.calls[0].request.endpoint, 'https://api.openai.com/v1/images/edits');
    assert.equal(manifest.calls[0].request.apiVersion, 'v1');
    assert.deepEqual(manifest.calls[0].request.parameters, { model: 'gpt-image-2', size: '2048x2048', quality: 'medium', n: 1, output_format: 'png', background: 'opaque' });
    assert.deepEqual(await fs.readFile(path.join(f.directory, 'results', manifest.samples[0].inputFile)), f.bytes);
    assert.equal(await exists(`${f.manifestPath}.tmp`), false);
    return response({ data: [{ b64_json: f.bytes.toString('base64') }], usage: { input_tokens: 12, output_tokens: 30, total_tokens: 42 } });
  };
  const result = await runBenchmark(f.config, { ...f.options, fetchImpl });
  assert.equal(result.status, 'completed');
  assert.equal(result.calls[0].usage.total_tokens, 42);
  assert.equal(result.calls[0].requestId, 'req-safe-1');
  assert.equal(result.calls[0].status, 'succeeded');
  assert.equal(result.calls[0].returnedModel, 'unknown');
  assert.deepEqual(await fs.readFile(path.join(f.directory, 'results/sample-openai/original.png')), f.bytes);
  await assert.rejects(runBenchmark(f.config, { ...f.options, fetchImpl }), /output_directory_already_exists_no_resume/);
  assert.equal(calls, 1);
});

test('a hard HTTP error stops before another paid call and does not persist response bodies or credentials', async (t) => {
  const f = await fixture(t);
  const logs = [];
  let calls = 0;
  await assert.rejects(runBenchmark(f.config, { ...f.options, log: (line) => logs.push(line), fetchImpl: async () => {
    calls++;
    return response({ error: { message: `${env.OPENAI_API_KEY} data:image/png;base64,unsafe` }, usage: { total_tokens: 7 } }, 401);
  } }), /benchmark_stopped/);
  const raw = await fs.readFile(f.manifestPath, 'utf8');
  const manifest = JSON.parse(raw);
  assert.equal(calls, 1);
  assert.equal(manifest.status, 'stopped');
  assert.equal(manifest.calls[0].error, 'provider_http_failure');
  assert.equal(manifest.calls[0].httpStatus, 401);
  assert.equal(manifest.calls[0].status, 'failed');
  assert.equal(manifest.calls[0].usage.total_tokens, 7);
  assert.equal(manifest.reservedUsd, 0.3);
  for (const value of [...Object.values(env), 'data:image', 'unsafe']) assert.ok(![raw, ...logs].join().includes(value));
});

test('malformed JSON, no final image and uncertain network outcomes are sanitized and never retried', async (t) => {
  const f = await fixture(t, ['gemini']);
  for (const [id, fetchImpl, expected] of [
    ['json', async () => new Response('not-json'), 'invalid_provider_json'],
    ['thought', async () => response({ candidates: [{ finishReason: 'SAFETY', content: { parts: [{ thought: true, inlineData: { data: f.bytes.toString('base64') } }] } }], promptFeedback: { blockReason: 'SAFETY', blockReasonMessage: env.GEMINI_API_KEY }, usageMetadata: { totalTokenCount: 8 } }), 'expected_exactly_one_base64_image'],
    ['missing-usage', async () => response({ candidates: [] }), 'expected_exactly_one_base64_image'],
    ['network', async () => { throw new Error(`${env.GEMINI_API_KEY} private body`); }, 'request_failed_outcome_unknown'],
  ]) {
    let calls = 0;
    await assert.rejects(runBenchmark({ ...f.config, outputDir: id }, { ...f.options, fetchImpl: async (...args) => { calls++; return fetchImpl(...args); } }), /benchmark_stopped/);
    const raw = await fs.readFile(path.join(f.directory, id, 'manifest.json'), 'utf8');
    assert.equal(JSON.parse(raw).calls[0].error, expected);
    assert.equal(calls, 1);
    assert.ok(!raw.includes(env.GEMINI_API_KEY));
    if (id === 'thought') {
      assert.equal(JSON.parse(raw).calls[0].usage.totalTokenCount, 8);
      assert.equal(JSON.parse(raw).calls[0].finishReason, 'SAFETY');
      assert.equal(JSON.parse(raw).calls[0].blockReason, 'SAFETY');
    }
    if (id === 'missing-usage') assert.equal(JSON.parse(raw).calls[0].usage, null);
  }
});

test('all three success response shapes are supported and usage only retains numeric audit fields', async (t) => {
  const f = await fixture(t);
  const result = await runBenchmark(f.config, { ...f.options, fetchImpl: async (url) => {
    const b64 = f.bytes.toString('base64');
    if (url.includes('googleapis')) return response({ responseId: 'gemini-response', modelVersion: 'gemini-3-pro-image', candidates: [{ finishReason: 'STOP', content: { parts: [{ inlineData: { data: b64, mimeType: 'image/png' } }] } }], usageMetadata: { totalTokenCount: 55, secret: env.GEMINI_API_KEY, promptTokensDetails: [{ modality: 'IMAGE', tokenCount: 20, secret: env.GEMINI_API_KEY }, { modality: 'TEXT', tokenCount: 5 }, { modality: 'AUDIO', tokenCount: 10 }, { modality: 'TEXT', tokenCount: '15' }], candidatesTokensDetails: [{ modality: 'IMAGE', tokenCount: 30 }], cacheTokensDetails: [{ modality: 'TEXT', tokenCount: 2 }] } });
    return response({ data: [{ b64_json: b64 }], usage: { total_tokens: 55, input_tokens_details: { image_tokens: 22, secret: env.OPENAI_API_KEY }, secret: 'private-data' } });
  } });
  assert.equal(result.calls.length, 3);
  assert.equal(result.reservedUsd, 0.9);
  assert.equal(result.status, 'completed');
  assert.equal(result.calls[1].usage.totalTokenCount, 55);
  assert.deepEqual(result.calls[1].usage.promptTokensDetails, [{ modality: 'IMAGE', tokenCount: 20 }, { modality: 'TEXT', tokenCount: 5 }]);
  assert.deepEqual(result.calls[1].usage.candidatesTokensDetails, [{ modality: 'IMAGE', tokenCount: 30 }]);
  assert.deepEqual(result.calls[1].usage.cacheTokensDetails, [{ modality: 'TEXT', tokenCount: 2 }]);
  assert.equal(result.calls[1].finishReason, 'STOP');
  assert.equal(result.calls[1].returnedModel, 'gemini-3-pro-image');
  assert.equal(result.calls[1].request.apiVersion, 'v1beta');
  assert.equal(result.calls[1].request.parameters.generationConfig.imageConfig.imageSize, '2K');
  assert.equal(result.calls[2].request.apiVersion, 'v3');
  assert.equal(result.calls[2].request.parameters.sequential_image_generation, 'disabled');
  const raw = JSON.stringify(result);
  assert.ok(!raw.includes('private-data'));
  for (const value of Object.values(env)) assert.ok(!raw.includes(value));
});

test('native crop preserves quadrant pixels and saves odd/non-square originals as deviations', async (t) => {
  const f = await fixture(t);
  const colors = ['#FF0000', '#00FF00', '#0000FF', '#FFFF00'];
  const quadrants = await Promise.all(colors.map((background) => sharp({ create: { width: 8, height: 8, channels: 3, background } }).png().toBuffer()));
  const board = await sharp({ create: { width: 16, height: 16, channels: 3, background: '#000000' } }).composite(quadrants.map((input, i) => ({ input, left: i % 2 * 8, top: Math.floor(i / 2) * 8 }))).png().toBuffer();
  const saved = await saveOutput(board, path.join(f.directory, 'native'));
  assert.deepEqual(await fs.readFile(path.join(f.directory, 'native', saved.original)), board);
  assert.deepEqual(saved.deviations, ['output_dimensions_differ_from_2048x2048']);
  for (const [index, filename] of saved.crops.entries()) {
    const { data, info } = await sharp(path.join(f.directory, 'native', filename)).removeAlpha().raw().toBuffer({ resolveWithObject: true });
    assert.equal(info.width, 8);
    assert.equal(info.height, 8);
    assert.deepEqual(data, await sharp(quadrants[index]).raw().toBuffer());
  }
  for (const [width, height] of [[15, 15], [16, 8]]) {
    const bytes = await sharp({ create: { width, height, channels: 3, background: '#FFFFFF' } }).png().toBuffer();
    const output = await saveOutput(bytes, path.join(f.directory, `${width}-${height}`));
    assert.equal(output.crops.length, 0);
    assert.ok(output.deviations.includes('native_crop_skipped_not_even_square'));
    assert.deepEqual(await fs.readFile(path.join(f.directory, `${width}-${height}`, output.original)), bytes);
  }
});
