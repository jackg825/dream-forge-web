const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { createRequire } = require('node:module');
const ts = require('typescript');
const sharp = require('sharp');

const sourceRoot = path.join(__dirname, '../src');
class HttpsError extends Error {
  constructor(code, message) { super(message); this.code = code; }
}
const callable = { runWith() { return this; }, https: { onCall: (handler) => handler } };
const firebaseFunctions = {
  region: () => callable,
  https: { HttpsError },
  logger: { info() {}, warn() {}, error() {} },
};

// Load current TypeScript, not checked-in build output; provider calls are always mocked.
function sourceLoader(overrides = {}) {
  const cache = new Map();
  function load(filename) {
    filename = path.resolve(sourceRoot, filename);
    if (cache.has(filename)) return cache.get(filename).exports;
    const module = { exports: {} };
    cache.set(filename, module);
    const requireFromFile = createRequire(filename);
    const requireSource = (id) => {
      if (Object.hasOwn(overrides, id)) return overrides[id];
      if (id === 'firebase-functions' || id === 'firebase-functions/v1') return firebaseFunctions;
      if (id.startsWith('.')) {
        const target = path.resolve(path.dirname(filename), `${id}.ts`);
        if (fs.existsSync(target)) return load(target);
      }
      return requireFromFile(id);
    };
    const output = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
    }).outputText;
    vm.runInNewContext(output, {
      module, exports: module.exports, require: requireSource,
      Buffer, console, process: { env: { GEMINI_API_KEY: 'test-key' } }, setTimeout, clearTimeout,
    }, { filename });
    return module.exports;
  }
  return load;
}

const palette = ['#112233', '#445566', '#778899'];
async function imageResponse() {
  const data = await sharp({ create: { width: 1024, height: 1024, channels: 3, background: '#112233' } }).png().toBuffer();
  return { data: { candidates: [{ content: { parts: [
    { inlineData: { data: data.toString('base64'), mimeType: 'image/png' } },
    { text: 'COLORS: #000000, #FFFFFF, #999999' },
  ] } }] } };
}

for (const [model, apiModel] of [
  ['gemini-2.5-flash-image', 'gemini-2.5-flash-image'],
  ['gemini-3-pro-image-preview', 'gemini-3-pro-image'],
]) {
  test(`${model}: every generation path honors the model and edited palette`, async () => {
    const requests = [];
    const load = sourceLoader({ axios: { post: async (...args) => { requests.push(args); return imageResponse(); } } });
    const options = { geminiModel: model, colorCount: 7, colorPalette: palette, style: 'none', detectedAngle: 'front', hint: 'Make the left ear shorter' };
    const { generateStyledReference } = load('gemini/styled-reference-generator.ts');
    const result = await generateStyledReference('source', 'image/png', options);
    assert.deepEqual(Array.from(result.colorPalette), palette);
    const { generateCompositeView } = load('gemini/composite-view-generator.ts');
    const composite = await generateCompositeView('source', 'image/png', { ...options, selectedStyle: 'none', userDescription: 'Edited description', imageAnalysis: { promptDescription: 'Old description', colorPalette: palette } });
    assert.equal((await sharp(Buffer.from(composite.front.imageBase64, 'base64')).metadata()).width, 512);
    const { MultiViewGenerator } = load('gemini/multi-view-generator.ts');
    const generator = new MultiViewGenerator('test-key', 'simplified-mesh', 'Subject', undefined, model, 'none', options);
    await generator.generateSingleViewFromReference('source', 'image/png', 'front', 'front', palette, options.hint);
    await generator.generateMeshView('source', 'image/png', 'left', options.hint);
    assert.equal(requests.length, 4);
    for (const [url, body] of requests) {
      assert.ok(url.endsWith(`/${apiModel}:generateContent`));
      const prompt = body.contents[0].parts.find((part) => part.text).text;
      assert.match(prompt, /Use 3 subject colors/);
      for (const color of palette) assert.ok(prompt.includes(color));
    }
    assert.match(requests[0][1].contents[0].parts[1].text, /Make the left ear shorter/);
    assert.match(requests[2][1].contents[0].parts[1].text, /Make the left ear shorter/);
    assert.match(requests[3][1].contents[0].parts[1].text, /Make the left ear shorter/);
    const compositePrompt = requests[1][1].contents[0].parts[1].text;
    assert.match(compositePrompt, /Edited description/);
    assert.doesNotMatch(compositePrompt, /Old description/);
    assert.equal(requests[1][1].generationConfig.imageConfig.aspectRatio, '1:1');
    assert.equal(requests[1][1].generationConfig.imageConfig.imageSize, model.includes('pro') ? '2K' : undefined);
  });
}

test('top references fail before any image API call', async () => {
  let calls = 0;
  const load = sourceLoader({ axios: { post: async () => { calls++; return imageResponse(); } } });
  const { generateStyledReference } = load('gemini/styled-reference-generator.ts');
  await assert.rejects(generateStyledReference('source', 'image/png', { detectedAngle: 'top', style: 'none' }), { code: 'failed-precondition' });
  const { MultiViewGenerator } = load('gemini/multi-view-generator.ts');
  const generator = new MultiViewGenerator('test-key');
  await assert.rejects(generator.generateViewsFromStyledReference('source', 'image/png', 'top', []), { code: 'failed-precondition' });
  assert.equal(calls, 0);
});

test('crop preserves native pixels, quadrant order and rejects distorted boards', async () => {
  const { cropCompositeView } = sourceLoader()('gemini/image-cropper.ts');
  const colors = ['#FF0000', '#00FF00', '#0000FF', '#FFFF00'];
  const quadrants = await Promise.all(colors.map((background) => sharp({ create: { width: 16, height: 16, channels: 3, background } }).png().toBuffer()));
  const board = await sharp({ create: { width: 32, height: 32, channels: 3, background: '#000000' } }).composite(quadrants.map((input, i) => ({ input, left: i % 2 * 16, top: Math.floor(i / 2) * 16 }))).png().toBuffer();
  const crops = await cropCompositeView(board);
  for (const [index, angle] of ['front', 'back', 'left', 'right'].entries()) {
    const { data, info } = await sharp(crops[angle]).removeAlpha().raw().toBuffer({ resolveWithObject: true });
    const expected = await sharp(quadrants[index]).raw().toBuffer();
    assert.equal(info.width, 16);
    assert.equal(info.height, 16);
    assert.deepEqual(data, expected);
  }
  for (const [width, height] of [[31, 31], [64, 32]]) {
    const malformed = await sharp({ create: { width, height, channels: 3, background: '#FFFFFF' } }).png().toBuffer();
    await assert.rejects(cropCompositeView(malformed), { code: 'failed-precondition' });
  }
});

function firestoreFixture(pipeline) {
  const docs = new Map([['pipelines/p1', pipeline], ['users/u1', { credits: 100, tier: 'premium' }]]);
  let nextId = 0;
  let transactionQueue = Promise.resolve();
  const timestamp = (millis) => ({ toMillis: () => millis });
  function copy(value) {
    if (!value || typeof value !== 'object' || value.toMillis) return value;
    if (Array.isArray(value)) return value.map(copy);
    return Object.fromEntries(Object.entries(value).map(([key, child]) => [key, copy(child)]));
  }
  function update(id, changes) {
    const doc = copy(docs.get(id) || {});
    for (const [key, value] of Object.entries(changes)) {
      const parts = key.split('.');
      let target = doc;
      for (const part of parts.slice(0, -1)) target = target[part] ||= {};
      const last = parts.at(-1);
      if (value?.deleteField) delete target[last];
      else if (value?.increment !== undefined) target[last] = (target[last] || 0) + value.increment;
      else target[last] = copy(value);
    }
    docs.set(id, doc);
  }
  const db = {
    collection: (collection) => ({ doc: (id = `attempt${++nextId}`) => ({
      id, path: `${collection}/${id}`,
      get: async () => ({ exists: docs.has(`${collection}/${id}`), data: () => copy(docs.get(`${collection}/${id}`)) }),
      update: async (changes) => update(`${collection}/${id}`, changes),
      set: async (value) => docs.set(`${collection}/${id}`, copy(value)),
    }) }),
    runTransaction(fn) {
      const result = transactionQueue.then(async () => {
        const writes = [];
        const transaction = {
          get: (ref) => ref.get(),
          update: (ref, changes) => writes.push(() => update(ref.path, changes)),
          set: (ref, value) => writes.push(() => docs.set(ref.path, copy(value))),
        };
        const value = await fn(transaction);
        writes.forEach((write) => write());
        return value;
      });
      transactionQueue = result.catch(() => {});
      return result;
    },
  };
  const firestore = Object.assign(() => db, {
    Timestamp: { now: () => timestamp(Date.now()), fromMillis: timestamp },
    FieldValue: { serverTimestamp: () => timestamp(Date.now()), delete: () => ({ deleteField: true }), increment: (increment) => ({ increment }) },
  });
  return { docs, db, firestore };
}

function pipelineFixture(overrides = {}) {
  const meshImages = Object.fromEntries(['front', 'back', 'left', 'right'].map((angle) => [angle, { url: `old-${angle}`, storagePath: `original/${angle}.png`, colorPalette: palette }]));
  return { userId: 'u1', status: 'images-ready', settings: { selectedStyle: 'none', geminiModel: 'gemini-3-pro-image-preview', colorCount: 3 }, inputImages: [{ url: 'original' }], imageAnalysis: { detectedViewAngle: 'front', colorPalette: palette }, meshImages, styledReferenceAngle: 'front', regenerationsUsed: 0, ...overrides };
}
const context = { auth: { uid: 'u1', token: { email_verified: true } } };
function pipelineHarness(pipeline, generateView = async () => ({ imageBase64: 'new', mimeType: 'image/png', colorPalette: palette }), dependencyOverrides = {}) {
  const fixture = firestoreFixture(pipeline);
  const calls = [];
  const uploads = [];
  const generator = { generateSingleViewFromReference: async (...args) => { calls.push(args); return generateView(...args); }, generateMeshView: async (...args) => { calls.push(args); return generateView(...args); } };
  const unusedProvider = {};
  const overrides = {
    'firebase-admin': { firestore: fixture.firestore },
    '../gemini/multi-view-generator': { createMultiViewGenerator: () => generator },
    '../gemini/styled-reference-generator': { generateStyledReference: async () => { throw new Error('Unexpected whole-reference generation'); } },
    '../gemini/composite-view-generator': { generateCompositeView: async () => { throw new Error('Unexpected composite generation'); } },
    '../providers/meshy/client': unusedProvider,
    '../providers/tripo/client': unusedProvider,
    '../providers/hunyuan/client': unusedProvider,
    '../providers/meshy/retexture': unusedProvider,
    '../providers/factory': unusedProvider,
    '../utils/credits': { refundCredits: async () => { throw new Error('Unexpected credit operation'); } },
    '../utils/storage-validation': { downloadValidatedImageAsBase64: async (url) => ({ base64: url, mimeType: 'image/png' }) },
    '../storage': { uploadBase64: async (base64, storagePath) => { uploads.push(storagePath); return `new-${storagePath}`; } },
    ...dependencyOverrides,
  };
  return { ...fixture, calls, uploads, api: sourceLoader(overrides)('handlers/pipeline.ts') };
}

test('top pipeline is rejected before debit, preserving a recoverable draft', async () => {
  const harness = pipelineHarness(pipelineFixture({ status: 'draft', imageAnalysis: { detectedViewAngle: 'top', colorPalette: palette } }));
  await assert.rejects(harness.api.generatePipelineImages({ pipelineId: 'p1' }, context), { code: 'failed-precondition' });
  assert.equal(harness.docs.get('users/u1').credits, 100);
  assert.equal(harness.docs.get('pipelines/p1').status, 'draft');
  assert.equal(harness.calls.length, 0);
});

test('correcting the reference changes only that view and passes its hint', async () => {
  const original = pipelineFixture();
  const harness = pipelineHarness(original);
  const result = await harness.api.regeneratePipelineImage({ pipelineId: 'p1', viewType: 'mesh', angle: 'front', hint: 'Shorten left ear' }, context);
  const current = harness.docs.get('pipelines/p1');
  assert.equal(harness.calls.length, 1);
  assert.equal(harness.calls[0][0], 'old-front');
  assert.equal(harness.calls[0][2], 'front');
  assert.equal(harness.calls[0][3], 'front');
  assert.equal(harness.calls[0][5], 'Shorten left ear');
  assert.equal(result.regeneratedAllViews, false);
  assert.equal(current.regenerationsUsed, 1);
  assert.equal(current.regenerationClaim, undefined);
  assert.match(harness.uploads[0], /\/views\/attempt\d+\/mesh_front\.png$/);
  for (const angle of ['back', 'left', 'right']) assert.deepEqual(current.meshImages[angle], original.meshImages[angle]);
});

test('technical failure preserves existing images and all correction allowance', async () => {
  const original = pipelineFixture({ regenerationsUsed: 3 });
  const harness = pipelineHarness(original, async () => { throw new Error('Provider unavailable'); });
  await assert.rejects(harness.api.regeneratePipelineImage({ pipelineId: 'p1', viewType: 'mesh', angle: 'left' }, context), { code: 'internal' });
  const current = harness.docs.get('pipelines/p1');
  assert.equal(current.regenerationsUsed, 3);
  assert.equal(current.regenerationClaim, undefined);
  assert.deepEqual(current.meshImages, original.meshImages);
  assert.equal(harness.uploads.length, 0);
});

test('active correction blocks another correction and full generation/reset actions until commit', async () => {
  let finish;
  const waiting = new Promise((resolve) => { finish = resolve; });
  const harness = pipelineHarness(pipelineFixture(), async () => { await waiting; return { imageBase64: 'new', mimeType: 'image/png' }; });
  const first = harness.api.regeneratePipelineImage({ pipelineId: 'p1', viewType: 'mesh', angle: 'front' }, context);
  while (!harness.calls.length) await new Promise((resolve) => setImmediate(resolve));
  await assert.rejects(harness.api.regeneratePipelineImage({ pipelineId: 'p1', viewType: 'mesh', angle: 'left' }, context), { code: 'failed-precondition' });
  await assert.rejects(harness.api.generatePipelineImages({ pipelineId: 'p1' }, context), { code: 'failed-precondition' });
  await assert.rejects(harness.api.resetPipelineStep({ pipelineId: 'p1', targetStep: 'draft', keepResults: false }, context), { code: 'failed-precondition' });
  assert.equal(harness.docs.get('users/u1').credits, 100);
  finish();
  await first;
  assert.equal(harness.docs.get('pipelines/p1').regenerationsUsed, 1);
});

test('failed correction can be retried and only successful completion uses its last slot', async () => {
  let attempts = 0;
  const harness = pipelineHarness(pipelineFixture({ regenerationsUsed: 3 }), async () => {
    if (++attempts === 1) throw new Error('Temporary provider failure');
    return { imageBase64: 'new', mimeType: 'image/png', colorPalette: palette };
  });
  const request = { pipelineId: 'p1', viewType: 'mesh', angle: 'left' };
  await assert.rejects(harness.api.regeneratePipelineImage(request, context));
  await harness.api.regeneratePipelineImage(request, context);
  assert.equal(harness.docs.get('pipelines/p1').regenerationsUsed, 4);
  await assert.rejects(harness.api.regeneratePipelineImage(request, context), { code: 'resource-exhausted' });
  assert.equal(harness.calls.length, 2);
});

test('expired correction lease is reclaimable without consuming an extra slot', async () => {
  const harness = pipelineHarness(pipelineFixture({ regenerationClaim: { token: 'crashed-request', expiresAt: { toMillis: () => Date.now() - 1000 } } }));
  await harness.api.regeneratePipelineImage({ pipelineId: 'p1', viewType: 'mesh', angle: 'back' }, context);
  assert.equal(harness.docs.get('pipelines/p1').regenerationsUsed, 1);
  assert.equal(harness.docs.get('pipelines/p1').regenerationClaim, undefined);
});

test('late correction cannot overwrite images after losing its reservation', async () => {
  let finish;
  const waiting = new Promise((resolve) => { finish = resolve; });
  const original = pipelineFixture();
  const harness = pipelineHarness(original, async () => { await waiting; return { imageBase64: 'new', mimeType: 'image/png' }; });
  const attempt = harness.api.regeneratePipelineImage({ pipelineId: 'p1', viewType: 'mesh', angle: 'front' }, context);
  while (!harness.calls.length) await new Promise((resolve) => setImmediate(resolve));
  const current = harness.docs.get('pipelines/p1');
  current.regenerationClaim = { token: 'new-request', expiresAt: { toMillis: () => Date.now() + 1000 } };
  finish();
  await assert.rejects(attempt, { code: 'aborted' });
  assert.equal(harness.docs.get('pipelines/p1').regenerationClaim.token, 'new-request');
  assert.deepEqual(harness.docs.get('pipelines/p1').meshImages, original.meshImages);
  assert.equal(harness.docs.get('pipelines/p1').regenerationsUsed, 0);
});

test('failed image generation refunds once and a successful retry charges only its completed attempt', async () => {
  let attempts = 0;
  const original = pipelineFixture({ status: 'draft', imageAnalysis: { colorPalette: palette }, creditsCharged: { mesh: 6, texture: 10 } });
  const harness = pipelineHarness(original, undefined, {
    '../gemini/composite-view-generator': {
      generateCompositeView: async () => {
        if (++attempts === 1) throw new Error('Provider unavailable');
        return Object.fromEntries(['front', 'back', 'left', 'right'].map((angle) => [angle, { imageBase64: angle, mimeType: 'image/png' }]));
      },
    },
  });
  await assert.rejects(harness.api.generatePipelineImages({ pipelineId: 'p1' }, context), { code: 'internal' });
  const failed = harness.docs.get('pipelines/p1');
  assert.equal(harness.docs.get('users/u1').credits, 100);
  assert.equal(failed.status, 'failed');
  assert.equal(failed.errorStep, 'generating-images');
  assert.deepEqual(failed.creditsCharged, { views: 0, mesh: 6, texture: 10 });
  assert.deepEqual(failed.meshImages, original.meshImages);
  await harness.api.generatePipelineImages({ pipelineId: 'p1' }, context);
  const completed = harness.docs.get('pipelines/p1');
  assert.equal(harness.docs.get('users/u1').credits, 95);
  assert.equal(completed.status, 'images-ready');
  assert.equal(completed.error, undefined);
  assert.equal(completed.creditsCharged.views, 5);
  const receipts = [...harness.docs.entries()].filter(([key]) => key.startsWith('transactions/')).map(([, receipt]) => receipt);
  assert.deepEqual(receipts.map(({ type, amount }) => ({ type, amount })), [
    { type: 'consume', amount: -5 }, { type: 'bonus', amount: 5 }, { type: 'consume', amount: -5 },
  ]);
});

test('late image failure cannot refund or overwrite a step that already changed status', async () => {
  const harness = pipelineHarness(pipelineFixture({ status: 'draft', imageAnalysis: { colorPalette: palette }, creditsCharged: { mesh: 0, texture: 0 } }), undefined, {
    '../gemini/composite-view-generator': {
      generateCompositeView: async () => {
        harness.docs.get('pipelines/p1').status = 'images-ready';
        throw new Error('Late failure after another worker completed');
      },
    },
  });
  await assert.rejects(harness.api.generatePipelineImages({ pipelineId: 'p1' }, context), { code: 'internal' });
  const current = harness.docs.get('pipelines/p1');
  assert.equal(current.status, 'images-ready');
  assert.equal(current.creditsCharged.views, 5);
  assert.equal(harness.docs.get('users/u1').credits, 95);
  assert.equal([...harness.docs.values()].filter((doc) => doc.type === 'bonus').length, 0);
});

test('an unavailable refund transaction preserves the debit and charged state for reconciliation', async () => {
  const harness = pipelineHarness(pipelineFixture({ status: 'draft', imageAnalysis: { colorPalette: palette }, creditsCharged: { mesh: 0, texture: 0 } }));
  const runTransaction = harness.db.runTransaction.bind(harness.db);
  let transactions = 0;
  harness.db.runTransaction = (callback) => {
    if (++transactions === 2) return Promise.reject(new Error('Refund transaction unavailable'));
    return runTransaction(callback);
  };
  await assert.rejects(harness.api.generatePipelineImages({ pipelineId: 'p1' }, context), { code: 'internal' });
  const current = harness.docs.get('pipelines/p1');
  assert.equal(harness.docs.get('users/u1').credits, 95);
  assert.equal(current.creditsCharged.views, 5);
  assert.equal(current.status, 'generating-images');
  assert.equal([...harness.docs.values()].filter((doc) => doc.type === 'bonus').length, 0);
});

for (const [step, field, amount] of [['mesh', 'mesh', 6], ['texture', 'texture', 10]]) {
  test(`${step} failure refunds and clears only its own charged field`, async () => {
    const harness = pipelineHarness(pipelineFixture({
      status: step === 'mesh' ? 'images-ready' : 'mesh-ready',
      creditsCharged: { views: 5, mesh: 6, texture: 10 },
      meshyMeshTaskId: 'completed-mesh',
      imageAnalysis: undefined,
    }), undefined, {
      '../utils/storage-validation': { assertUserStorageReference: (url) => ({ storagePath: url }) },
      '../storage': { getSignedUrlForReference: async (storagePath) => storagePath },
      '../providers/factory': {
        isValidProvider: (provider) => provider === 'hitem3d',
        ProviderFactory: { getProvider: () => { throw new Error('Mesh provider unavailable'); } },
      },
      '../providers/meshy/retexture': {
        createMeshyRetextureClient: () => ({ createFromMeshTask: async () => { throw new Error('Texture provider unavailable'); } }),
      },
    });
    const request = () => step === 'mesh'
      ? harness.api.startPipelineMesh({ pipelineId: 'p1', provider: 'hitem3d' }, context)
      : harness.api.startPipelineTexture({ pipelineId: 'p1' }, context);
    await assert.rejects(request(), { code: 'internal' });
    const current = harness.docs.get('pipelines/p1');
    assert.equal(current.status, 'failed');
    assert.equal(current.errorStep, `generating-${step}`);
    assert.deepEqual(current.creditsCharged, { views: 5, mesh: 6, texture: 10, [field]: 0 });
    assert.equal(harness.docs.get('users/u1').credits, 100);
    const refunds = [...harness.docs.values()].filter((doc) => doc.type === 'bonus');
    assert.equal(refunds.length, 1);
    assert.equal(refunds[0].amount, amount);
  });
}
