const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

// Exercise actual callable handlers without provider credentials or live Firestore.
// Transactions serialize isolated snapshots and commit writes only on success.
const adminContext = { auth: { uid: 'admin' } };
class HttpsError extends Error {
  constructor(code, message) { super(message); this.code = code; }
}
class Timestamp {
  constructor(millis = Date.now()) { this.millis = millis; }
  toMillis() { return this.millis; }
  toDate() { return new Date(this.millis); }
  static now() { return new Timestamp(); }
}
function clone(value) {
  if (value instanceof Timestamp) return new Timestamp(value.millis);
  if (Array.isArray(value)) return value.map(clone);
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, clone(v)]));
  return value;
}
function deferred() {
  let resolve;
  const promise = new Promise((r) => { resolve = r; });
  return { promise, resolve };
}
function harness(seed = {}) {
  const documents = new Map(Object.entries({
    'users/admin': { role: 'admin', email: 'admin@example.test' },
    'users/user': { role: 'user', credits: 10, tier: 'free' },
    ...seed,
  }).map(([key, value]) => [key, clone(value)]));
  const uploads = [];
  const calls = { providerStarts: 0, providerChecks: 0, downloads: 0, optimizations: 0 };
  let sequence = 0;
  let queue = Promise.resolve();
  const snapshot = (key) => {
    const value = clone(documents.get(key));
    return { id: key.split('/').at(-1), exists: value !== undefined, data: () => clone(value), get: (field) => field.split('.').reduce((object, part) => object?.[part], value) };
  };
  const apply = (key, updates) => {
    const value = clone(documents.get(key));
    if (!value) throw new Error('Document not found');
    for (const [field, update] of Object.entries(updates)) {
      const segments = field.split('.');
      const leaf = segments.pop();
      let parent = value;
      for (const segment of segments) parent = parent[segment] ||= {};
      if (update?.__op === 'delete') delete parent[leaf];
      else if (update?.__op === 'increment') parent[leaf] = (parent[leaf] || 0) + update.value;
      else if (update?.__op === 'arrayUnion') parent[leaf] = [...(parent[leaf] || []), ...clone(update.values)];
      else parent[leaf] = clone(update);
    }
    documents.set(key, value);
  };
  const query = (collection, filters = []) => {
    const values = () => [...documents.entries()]
      .filter(([key, value]) => key.startsWith(`${collection}/`) && filters.every(([field, expected]) => value[field] === expected))
      .map(([, value]) => value);
    return {
      doc: (id = `generated-${++sequence}`) => {
        const key = `${collection}/${id}`;
        return { key, id, get: async () => snapshot(key), update: async (updates) => apply(key, updates) };
      },
      where: (field, _operator, expected) => query(collection, [...filters, [field, expected]]),
      count: () => ({ get: async () => ({ data: () => ({ count: values().length }) }) }),
      aggregate: (fields) => ({ get: async () => ({ data: () => Object.fromEntries(Object.entries(fields).map(([key, field]) => [key, values().reduce((sum, value) => sum + (typeof value[field] === 'number' ? value[field] : 0), 0)])) }) }),
      orderBy() { return this; },
      limit() { return this; },
      offset() { return this; },
      get: async () => {
        calls.queryReads = (calls.queryReads || 0) + 1;
        return { docs: [...documents.keys()].filter((key) => key.startsWith(`${collection}/`) && filters.every(([field, expected]) => documents.get(key)[field] === expected)).map(snapshot) };
      },
    };
  };
  const db = {
    collection: (collection) => query(collection),
    runTransaction: (callback) => {
      const execution = queue.then(async () => {
        const writes = [];
        const result = await callback({
          get: async (ref) => snapshot(ref.key),
          update: (ref, updates) => writes.push(() => apply(ref.key, updates)),
          set: (ref, value) => writes.push(() => documents.set(ref.key, clone(value))),
        });
        writes.forEach((write) => write());
        return result;
      });
      queue = execution.catch(() => {});
      return execution;
    },
  };
  const firestore = Object.assign(() => db, {
    Timestamp,
    AggregateField: { sum: (field) => field },
    FieldValue: {
      serverTimestamp: () => Timestamp.now(),
      delete: () => ({ __op: 'delete' }),
      increment: (value) => ({ __op: 'increment', value }),
      arrayUnion: (...values) => ({ __op: 'arrayUnion', values }),
    },
  });
  const builder = { runWith: () => builder, https: { onCall: (handler) => handler } };
  const functions = { region: () => builder, https: { HttpsError }, logger: { info() {}, warn() {}, error() {} } };
  const provider = {
    generateFromUrls: async () => { calls.providerStarts++; return { taskId: `task-${calls.providerStarts}`, subscriptionKey: 'rodin-key' }; },
    generateMeshOnlyFromUrls: async (...args) => provider.generateFromUrls(...args),
    generateFromMultipleImages: async (...args) => provider.generateFromUrls(...args),
    checkStatus: async (_taskId, subscriptionKey) => { calls.providerChecks++; calls.subscriptionKey = subscriptionKey; return { status: 'completed' }; },
    getDownloadUrls: async () => ({ files: [{ name: 'model.glb', url: 'https://provider.test/model.glb', format: 'glb' }] }),
    downloadModel: async () => { calls.downloads++; return Buffer.from('glb'); },
  };
  const generator = { generateMeshView: async () => ({ imageBase64: 'aW1hZ2U=', mimeType: 'image/png' }) };
  const parseReference = (url) => typeof url === 'string' && url.startsWith('https://storage.test/')
    ? { storagePath: url.slice('https://storage.test/'.length).split('?')[0], backend: 'r2' } : null;
  const storage = {
    getSignedUrlForReference: async (storagePath) => `https://storage.test/${storagePath}?fresh`,
    uploadBuffer: async (_buffer, storagePath) => { uploads.push(storagePath); return `https://storage.test/${storagePath}`; },
    uploadBase64: async (_buffer, storagePath) => { uploads.push(storagePath); return `https://storage.test/${storagePath}`; },
    downloadFile: async () => { calls.downloads++; return Buffer.from('glb'); },
  };
  const stats = { vertexCount: 10, faceCount: 20, boundingBox: { width: 10, height: 10, depth: 10 }, isWatertight: true, volume: 1000 };
  const meshOptimizer = {
    optimizeMesh: async () => { calls.optimizations++; return { success: true, buffer: Buffer.from('glb'), preview: { original: stats, optimized: stats, reductionPercent: 0, operations: [], warnings: [] } }; },
    getMeshAnalysis: async () => ({ success: true, analysis: stats }),
    previewOptimization: async () => ({ success: true, preview: { original: stats, estimatedOptimized: stats, estimatedReductionPercent: 0 } }),
  };
  const stubs = {
    'firebase-functions/v1': functions,
    'firebase-admin': { firestore },
    '../rodin/client': { createRodinClient: () => ({ checkBalance: async () => 42 }) },
    '../providers/meshy/client': { MeshyProvider: class {} },
    '../providers/tripo/client': { TripoProvider: class {} },
    '../providers/hunyuan/client': { HunyuanProvider: class {} },
    '../providers/factory': { ProviderFactory: { getProvider: () => provider }, isValidProvider: (value) => ['rodin', 'meshy', 'hunyuan', 'tripo', 'hitem3d'].includes(value) },
    '../gemini/multi-view-generator': { createMultiViewGenerator: () => generator },
    '../storage': storage,
    '../utils/storage-validation': {
      extractStorageReferenceFromUrl: parseReference,
      assertUserStorageReference: (url) => { const reference = parseReference(url); if (!reference) throw new HttpsError('invalid-argument', 'Invalid URL'); return reference; },
      downloadValidatedImageAsBase64: async () => ({ base64: 'aW1hZ2U=', mimeType: 'image/png' }),
    },
    '../optimize/mesh-optimizer': meshOptimizer,
  };
  const cache = new Map();
  const load = (file) => {
    const filename = path.resolve(__dirname, '../src', file);
    if (cache.has(filename)) return cache.get(filename);
    const output = ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
    const module = { exports: {} };
    vm.runInThisContext(`(function(require, module, exports) {${output}\n})`, { filename })(
      (name) => name in stubs ? stubs[name] : name === '../utils/admin-validation' ? load('utils/admin-validation.ts') : require(name),
      module,
      module.exports
    );
    cache.set(filename, module.exports);
    return module.exports;
  };
  return { handlers: { ...load('handlers/admin.ts'), ...load('handlers/optimize.ts') }, documents, uploads, calls, provider, generator, storage, meshOptimizer };
}
function pipeline(overrides = {}) {
  const images = Object.fromEntries(['front', 'back', 'left', 'right'].map((angle) => [angle, {
    url: `https://storage.test/pipelines/user/p1/mesh_${angle}.png`, storagePath: `pipelines/user/p1/mesh_${angle}.png`,
  }]));
  return {
    userId: 'user', status: 'completed', inputImages: [{ url: 'https://storage.test/uploads/user/source.png' }],
    meshImages: images, settings: { provider: 'meshy', quality: 'standard', format: 'glb' },
    meshUrl: 'https://storage.test/pipelines/user/p1/original.glb', meshStoragePath: 'pipelines/user/p1/original.glb',
    ...overrides,
  };
}

test('all admin and print optimization callables reject unauthenticated and ordinary users', async () => {
  const h = harness();
  for (const [name, handler] of Object.entries(h.handlers)) {
    await assert.rejects(handler(null, {}), { code: 'unauthenticated' }, name);
    await assert.rejects(handler(null, { auth: { uid: 'user' } }), { code: 'permission-denied' }, name);
    await assert.rejects(handler(null, { auth: { uid: 'missing' } }), { code: 'permission-denied' }, name);
  }
  assert.equal(h.uploads.length, 0);
  assert.equal(h.calls.providerStarts, 0);
});

test('credit mutations reject malformed amounts, IDs and reasons without changing balance', async () => {
  const h = harness();
  for (const name of ['addCredits', 'deductCredits']) {
    for (const amount of ['5', 1.5, NaN, Infinity, 0, -1, Number.MAX_SAFE_INTEGER + 1]) {
      await assert.rejects(h.handlers[name]({ targetUserId: 'user', amount, reason: 'audit' }, adminContext), { code: 'invalid-argument' });
    }
    for (const targetUserId of ['', '   ', 'user/child', '.', 123]) {
      await assert.rejects(h.handlers[name]({ targetUserId, amount: 1, reason: 'audit' }, adminContext), { code: 'invalid-argument' });
    }
    await assert.rejects(h.handlers[name](null, adminContext), { code: 'invalid-argument' });
    await assert.rejects(h.handlers[name]({ targetUserId: 'user', amount: 1, reason: {} }, adminContext), { code: 'invalid-argument' });
  }
  await assert.rejects(h.handlers.deductCredits({ targetUserId: 'user', amount: 1, reason: '  ' }, adminContext), { code: 'invalid-argument' });
  assert.equal(h.documents.get('users/user').credits, 10);
  assert.equal([...h.documents.keys()].filter((key) => key.startsWith('transactions/')).length, 0);
});

test('concurrent deductions cannot overspend and the audit record matches the committed balance', async () => {
  const h = harness();
  const results = await Promise.allSettled([1, 2].map(() => h.handlers.deductCredits({ targetUserId: 'user', amount: 7, reason: '  refund correction  ' }, adminContext)));
  assert.equal(results.filter((result) => result.status === 'fulfilled').length, 1);
  assert.equal(results.find((result) => result.status === 'rejected').reason.code, 'failed-precondition');
  assert.equal(h.documents.get('users/user').credits, 3);
  const records = [...h.documents.entries()].filter(([key]) => key.startsWith('transactions/')).map(([, value]) => value);
  assert.equal(records.length, 1);
  assert.equal(records[0].amount, -7);
  assert.equal(records[0].adminId, 'admin');
  assert.equal(records[0].reason, 'refund correction');
  assert.equal(results.find((result) => result.status === 'fulfilled').value.newBalance, 3);
});

test('concurrent additions return committed balances and reject unsafe resulting totals', async () => {
  const h = harness();
  const results = await Promise.all([1, 2].map(() => h.handlers.addCredits({ targetUserId: 'user', amount: 5 }, adminContext)));
  assert.deepEqual(results.map((result) => result.newBalance).sort((a, b) => a - b), [15, 20]);
  h.documents.set('users/user', { credits: Number.MAX_SAFE_INTEGER });
  await assert.rejects(h.handlers.addCredits({ targetUserId: 'user', amount: 1 }, adminContext), { code: 'failed-precondition' });
  h.documents.set('users/user', { credits: '10' });
  await assert.rejects(h.handlers.addCredits({ targetUserId: 'user', amount: 1 }, adminContext), { code: 'failed-precondition' });
});

test('tier changes preserve an existing subscription on no-op and clear it on downgrade', async () => {
  const h = harness();
  await h.handlers.updateUserTier({ targetUserId: 'user', tier: 'premium' }, adminContext);
  const subscription = clone(h.documents.get('users/user').subscription);
  await h.handlers.updateUserTier({ targetUserId: 'user', tier: 'premium' }, adminContext);
  assert.deepEqual(h.documents.get('users/user').subscription, subscription);
  await h.handlers.updateUserTier({ targetUserId: 'user', tier: 'free' }, adminContext);
  assert.equal(h.documents.get('users/user').subscription, undefined);
  await assert.rejects(h.handlers.updateUserTier({ targetUserId: 'missing', tier: 'premium' }, adminContext), { code: 'not-found' });
});

test('invalid preview targets and angles never claim success or write audit records', async () => {
  const h = harness({ 'pipelines/p1': pipeline({ adminPreview: {} }) });
  for (const name of ['adminConfirmPreview', 'adminRejectPreview']) {
    for (const request of [{ targetField: 'invalid' }, { targetField: 'meshImages' }, { targetField: 'meshImages', angle: 'front.url' }]) {
      await assert.rejects(h.handlers[name]({ pipelineId: 'p1', ...request }, adminContext), { code: 'invalid-argument' });
    }
    await assert.rejects(h.handlers[name](null, adminContext), { code: 'invalid-argument' });
  }
  assert.equal(h.documents.get('pipelines/p1').adminActions, undefined);
});

test('confirmed image storage is immutable across later regenerations', async () => {
  const h = harness({ 'pipelines/p1': pipeline() });
  const request = { pipelineId: 'p1', viewType: 'mesh', angle: 'front' };
  await h.handlers.adminRegeneratePipelineImage(request, adminContext);
  await h.handlers.adminConfirmPreview({ pipelineId: 'p1', targetField: 'meshImages', angle: 'front' }, adminContext);
  const confirmed = h.documents.get('pipelines/p1').meshImages.front.storagePath;
  await h.handlers.adminRegeneratePipelineImage(request, adminContext);
  assert.equal(h.documents.get('pipelines/p1').meshImages.front.storagePath, confirmed);
  assert.notEqual(h.documents.get('pipelines/p1').adminPreview.meshImages.front.storagePath, confirmed);
  assert.equal(new Set(h.uploads).size, 2);
});

test('discarding an image while generation is running prevents the late result from restoring it', async () => {
  const h = harness({ 'pipelines/p1': pipeline() });
  const entered = deferred();
  const finish = deferred();
  h.generator.generateMeshView = async () => { entered.resolve(); await finish.promise; return { imageBase64: 'aW1hZ2U=', mimeType: 'image/png' }; };
  const pending = h.handlers.adminRegeneratePipelineImage({ pipelineId: 'p1', viewType: 'mesh', angle: 'front' }, adminContext);
  await entered.promise;
  await h.handlers.adminRejectPreview({ pipelineId: 'p1', targetField: 'all' }, adminContext);
  finish.resolve();
  await assert.rejects(pending, { code: 'aborted' });
  assert.equal(h.documents.get('pipelines/p1').adminPreview, undefined);
});

test('only one concurrent mesh request reaches a paid provider and Rodin polling retains its subscription key', async () => {
  const h = harness({ 'pipelines/p1': pipeline() });
  const results = await Promise.allSettled([1, 2].map(() => h.handlers.adminStartPipelineMesh({ pipelineId: 'p1', provider: 'rodin' }, adminContext)));
  assert.equal(results.filter((result) => result.status === 'fulfilled').length, 1);
  assert.equal(h.calls.providerStarts, 1);
  await h.handlers.adminCheckPreviewStatus({ pipelineId: 'p1' }, adminContext);
  assert.equal(h.calls.subscriptionKey, 'rodin-key');
  await h.handlers.adminCheckPreviewStatus({ pipelineId: 'p1' }, adminContext);
  assert.equal(h.calls.providerChecks, 1);
  assert.equal(h.calls.downloads, 1);
});

test('discarding a mesh during polling cannot resurrect the discarded preview', async () => {
  const h = harness({ 'pipelines/p1': pipeline({ adminPreview: { taskId: 'old', provider: 'meshy', taskStatus: 'processing' } }) });
  const entered = deferred();
  const finish = deferred();
  h.provider.checkStatus = async () => { entered.resolve(); await finish.promise; return { status: 'completed' }; };
  const pending = h.handlers.adminCheckPreviewStatus({ pipelineId: 'p1' }, adminContext);
  await entered.promise;
  await h.handlers.adminRejectPreview({ pipelineId: 'p1', targetField: 'mesh' }, adminContext);
  finish.resolve();
  await assert.rejects(pending, { code: 'aborted' });
  assert.equal(h.documents.get('pipelines/p1').adminPreview.meshUrl, undefined);
});

test('confirming a new mesh clears stale derived results and later previews cannot overwrite it', async () => {
  const h = harness({ 'pipelines/p1': pipeline({ texturedModelUrl: 'old-texture', optimization: { optimizedModelUrl: 'old-optimized' } }) });
  await h.handlers.adminStartPipelineMesh({ pipelineId: 'p1', provider: 'meshy' }, adminContext);
  await h.handlers.adminCheckPreviewStatus({ pipelineId: 'p1' }, adminContext);
  await h.handlers.adminConfirmPreview({ pipelineId: 'p1', targetField: 'mesh' }, adminContext);
  const confirmed = h.documents.get('pipelines/p1');
  assert.equal(confirmed.status, 'mesh-ready');
  assert.equal(confirmed.texturedModelUrl, undefined);
  assert.equal(confirmed.optimization, undefined);
  assert.equal(confirmed.adminPreview.taskId, undefined);
  assert.equal(confirmed.meshyMeshTaskId, 'task-1');
  assert.equal(confirmed.providerTaskId, 'task-1');
  assert.equal(confirmed.meshFormat, 'glb');
  await h.handlers.adminStartPipelineMesh({ pipelineId: 'p1', provider: 'meshy' }, adminContext);
  await h.handlers.adminCheckPreviewStatus({ pipelineId: 'p1' }, adminContext);
  assert.equal(h.documents.get('pipelines/p1').meshStoragePath, confirmed.meshStoragePath);
  assert.notEqual(h.documents.get('pipelines/p1').adminPreview.meshStoragePath, confirmed.meshStoragePath);
});

test('confirmation rejects incomplete previews and an active user generation', async () => {
  const h = harness({ 'pipelines/p1': pipeline({ adminPreview: { meshUrl: 'old-preview', taskStatus: 'processing' } }) });
  await assert.rejects(h.handlers.adminConfirmPreview({ pipelineId: 'p1', targetField: 'mesh' }, adminContext), { code: 'failed-precondition' });
  h.documents.get('pipelines/p1').status = 'generating-mesh';
  await assert.rejects(h.handlers.adminConfirmPreview({ pipelineId: 'p1', targetField: 'meshImages', angle: 'front' }, adminContext), { code: 'failed-precondition' });
  assert.equal(h.documents.get('pipelines/p1').adminActions, undefined);
});

test('optimization rejects ambiguous sources, invalid formats and unsafe numeric options before downloading', async () => {
  const h = harness({ 'pipelines/p1': pipeline() });
  const valid = { pipelineId: 'p1', options: { simplify: { enabled: true, targetRatio: 0.5 } } };
  const invalid = [
    null, { ...valid, jobId: 'j1' }, { ...valid, pipelineId: '../p1' },
    { ...valid, outputFormat: '../txt' }, { ...valid, previewOnly: 'false' },
    { ...valid, options: { simplify: { enabled: 'yes' } } },
    { ...valid, options: { simplify: { enabled: true, targetRatio: Infinity } } },
    { ...valid, options: { scale: { enabled: true, uniformScale: -1 } } },
    { ...valid, options: { scale: { enabled: true, targetSize: {} } } },
    { ...valid, options: { scale: { enabled: true, printBedSize: { width: 10 } } } },
  ];
  for (const request of invalid) await assert.rejects(h.handlers.optimizeMeshForPrint(request, adminContext), { code: 'invalid-argument' });
  assert.equal(h.calls.downloads, 0);
  assert.equal(h.calls.optimizations, 0);
  const preview = await h.handlers.optimizeMeshForPrint({ ...valid, previewOnly: true }, adminContext);
  assert.equal(preview.success, true);
  assert.equal(h.uploads.length, 0);
  const optimized = await h.handlers.optimizeMeshForPrint(valid, adminContext);
  assert.equal(optimized.success, true);
  assert.equal(h.documents.get('pipelines/p1').optimization.optimizedModelUrl, optimized.optimizedModelUrl);
});

test('legacy job analysis rejects a selected model from another job', async () => {
  const h = harness({ 'jobs/j1': { outputModelUrl: 'https://storage.test/models/user/j1.glb' } });
  const result = await h.handlers.analyzeMeshForPrint({ jobId: 'j1', modelUrl: 'https://storage.test/models/user/j2.glb' }, adminContext);
  assert.equal(result.success, false);
  assert.match(result.error, /does not belong/);
  assert.equal(h.calls.downloads, 0);
  const valid = await h.handlers.analyzeMeshForPrint({ jobId: 'j1' }, adminContext);
  assert.equal(valid.success, true);
});


test('statistics aggregate known job statuses and bonus credits without downloading collections', async () => {
  const h = harness({
    'jobs/j1': { status: 'pending' }, 'jobs/j2': { status: 'processing' },
    'jobs/j3': { status: 'completed' }, 'jobs/j4': { status: 'failed' },
    'jobs/j5': { status: 'total' },
    'transactions/t1': { type: 'bonus', amount: 10 },
    'transactions/t2': { type: 'bonus', amount: 20 },
    'transactions/t3': { type: 'consume', amount: -5 },
  });
  const { stats } = await h.handlers.getAdminStats({}, adminContext);
  assert.equal(stats.totalUsers, 2);
  assert.deepEqual(stats.jobs, { total: 5, pending: 1, processing: 1, completed: 1, failed: 1 });
  assert.equal(stats.totalCreditsDistributed, 30);
  assert.equal(h.calls.queryReads || 0, 0);
});

test('confirmation rejects a preview replaced since the administrator reviewed it', async () => {
  const h = harness({ 'pipelines/p1': pipeline({ adminPreview: {
    taskStatus: 'completed', meshUrl: 'https://storage.test/new.glb', meshStoragePath: 'new.glb',
  } }) });
  await assert.rejects(h.handlers.adminConfirmPreview({
    pipelineId: 'p1', targetField: 'mesh', expectedStoragePath: 'previous.glb',
  }, adminContext), { code: 'aborted' });
  assert.equal(h.documents.get('pipelines/p1').meshStoragePath, 'pipelines/user/p1/original.glb');
  await h.handlers.adminConfirmPreview({
    pipelineId: 'p1', targetField: 'mesh', expectedStoragePath: 'new.glb',
  }, adminContext);
  assert.equal(h.documents.get('pipelines/p1').meshStoragePath, 'new.glb');
});


test('an optimization cannot attach an obsolete result after its source model is replaced', async () => {
  const h = harness({ 'pipelines/p1': pipeline() });
  const entered = deferred();
  const finish = deferred();
  const optimize = h.meshOptimizer.optimizeMesh;
  h.meshOptimizer.optimizeMesh = async (...args) => { entered.resolve(); await finish.promise; return optimize(...args); };
  const pending = h.handlers.optimizeMeshForPrint({ pipelineId: 'p1', options: { simplify: { enabled: true } } }, adminContext);
  await entered.promise;
  h.documents.get('pipelines/p1').meshUrl = 'https://storage.test/pipelines/user/p1/replaced.glb';
  h.documents.get('pipelines/p1').meshStoragePath = 'pipelines/user/p1/replaced.glb';
  finish.resolve();
  await assert.rejects(pending, { code: 'aborted' });
  assert.equal(h.documents.get('pipelines/p1').optimization, undefined);
});


test('a completed provider task without a GLB exits processing so the administrator can retry', async () => {
  const h = harness({ 'pipelines/p1': pipeline({ adminPreview: { taskId: 'old', provider: 'meshy', taskStatus: 'processing' } }) });
  h.provider.getDownloadUrls = async () => ({ files: [{ name: 'model.fbx', format: 'fbx', url: 'https://provider.test/model.fbx' }] });
  const result = await h.handlers.adminCheckPreviewStatus({ pipelineId: 'p1' }, adminContext);
  assert.equal(result.status, 'failed');
  assert.equal(h.documents.get('pipelines/p1').adminPreview.taskStatus, 'failed');
  const retry = await h.handlers.adminStartPipelineMesh({ pipelineId: 'p1', provider: 'meshy' }, adminContext);
  assert.equal(retry.success, true);
});


test('polling an unexpired startup claim keeps polling until the provider task is recorded', async () => {
  const h = harness({ 'pipelines/p1': pipeline() });
  const entered = deferred();
  const finish = deferred();
  h.provider.generateFromUrls = async () => { entered.resolve(); await finish.promise; return { taskId: 'new-task' }; };
  const pending = h.handlers.adminStartPipelineMesh({ pipelineId: 'p1', provider: 'tripo' }, adminContext);
  await entered.promise;
  const starting = await h.handlers.adminCheckPreviewStatus({ pipelineId: 'p1' }, adminContext);
  assert.equal(starting.status, 'processing');
  assert.equal(h.calls.providerChecks, 0);
  assert.equal(h.documents.get('pipelines/p1').adminPreview.taskStatus, 'pending');
  finish.resolve();
  await pending;
  const completed = await h.handlers.adminCheckPreviewStatus({ pipelineId: 'p1' }, adminContext);
  assert.equal(completed.status, 'completed');
});

test('expired startup claims fail atomically, preserve image previews, and ignore a late provider callback', async () => {
  const image = { url: 'https://storage.test/preview.png', storagePath: 'preview.png' };
  const h = harness({ 'pipelines/p1': pipeline({ adminPreview: { meshImages: { front: image } } }) });
  const entered = deferred();
  const finish = deferred();
  h.provider.generateFromUrls = async () => { entered.resolve(); await finish.promise; return { taskId: 'late-task' }; };
  const pending = h.handlers.adminStartPipelineMesh({ pipelineId: 'p1', provider: 'tripo' }, adminContext);
  await entered.promise;
  h.documents.get('pipelines/p1').adminPreview.createdAt = new Timestamp(Date.now() - 11 * 60 * 1000);
  const expired = await h.handlers.adminCheckPreviewStatus({ pipelineId: 'p1' }, adminContext);
  assert.equal(expired.status, 'failed');
  assert.equal(h.documents.get('pipelines/p1').adminPreview.operationId, undefined);
  assert.deepEqual(h.documents.get('pipelines/p1').adminPreview.meshImages.front, image);
  finish.resolve();
  await assert.rejects(pending, { code: 'aborted' });
  assert.equal(h.documents.get('pipelines/p1').adminPreview.taskId, undefined);
  h.provider.generateFromUrls = async () => ({ taskId: 'retry-task' });
  assert.equal((await h.handlers.adminStartPipelineMesh({ pipelineId: 'p1', provider: 'tripo' }, adminContext)).success, true);
});

test('old completed previews without provider metadata are retained instead of treated as expired claims', async () => {
  const h = harness({ 'pipelines/p1': pipeline({ adminPreview: {
    meshUrl: 'https://storage.test/legacy.glb', meshStoragePath: 'legacy.glb',
    taskStatus: 'completed', createdAt: new Timestamp(1),
  } }) });
  const result = await h.handlers.adminCheckPreviewStatus({ pipelineId: 'p1' }, adminContext);
  assert.equal(result.status, 'no-active-task');
  assert.equal(result.preview.meshStoragePath, 'legacy.glb');
  assert.equal(h.documents.get('pipelines/p1').adminPreview.taskStatus, 'completed');
});

test('optional null fields from older callable clients behave as omitted while required nulls fail', async () => {
  const h = harness({ 'pipelines/p1': pipeline() });
  await h.handlers.addCredits({ targetUserId: 'user', amount: 1, reason: null }, adminContext);
  await h.handlers.updateUserTier({ targetUserId: 'user', tier: 'premium', reason: null }, adminContext);
  await h.handlers.adminRegeneratePipelineImage({ pipelineId: 'p1', viewType: 'mesh', angle: 'front', hint: null }, adminContext);
  await h.handlers.adminConfirmPreview({ pipelineId: 'p1', targetField: 'meshImages', angle: 'front', expectedStoragePath: null }, adminContext);
  await h.handlers.adminStartPipelineMesh({ pipelineId: 'p1', provider: 'meshy', providerOptions: null }, adminContext);
  const optimized = await h.handlers.optimizeMeshForPrint({
    pipelineId: 'p1', jobId: null, modelUrl: null, outputFormat: null, previewOnly: true,
    options: {
      simplify: { enabled: true, targetRatio: null, preserveTopology: null }, repair: null,
      scale: { enabled: true, targetSize: { width: 10, height: null, depth: null }, printBedSize: null, uniformScale: null },
    },
  }, adminContext);
  assert.equal(optimized.success, true);
  assert.equal((await h.handlers.analyzeMeshForPrint({ pipelineId: 'p1', jobId: null, modelUrl: null }, adminContext)).success, true);
  const empty = harness();
  assert.equal((await empty.handlers.listAllPipelines({ status: null, userId: null, limit: null, offset: null }, adminContext)).success, true);
  await assert.rejects(h.handlers.deductCredits({ targetUserId: 'user', amount: 1, reason: null }, adminContext), { code: 'invalid-argument' });
  await assert.rejects(h.handlers.addCredits({ targetUserId: null, amount: 1 }, adminContext), { code: 'invalid-argument' });
  await assert.rejects(h.handlers.optimizeMeshForPrint({ pipelineId: 'p1', options: { simplify: { enabled: null } } }, adminContext), { code: 'invalid-argument' });
});

test('read-only preview refresh returns all current URLs without provider calls or claim mutation', async () => {
  const preview = {
    meshImages: { front: { url: 'https://storage.test/front.png?expired', storagePath: 'front.png' } },
    meshUrl: 'https://storage.test/model.glb?expired', meshStoragePath: 'model.glb',
    taskStatus: 'pending', operationId: 'abandoned', createdAt: new Timestamp(1),
  };
  const h = harness({ 'pipelines/p1': pipeline({ adminPreview: preview }) });
  const result = await h.handlers.adminCheckPreviewStatus({ pipelineId: 'p1', readOnly: true }, adminContext);
  assert.equal(result.status, 'snapshot');
  assert.equal(result.preview.meshImages.front.url, 'https://storage.test/front.png?fresh');
  assert.equal(result.preview.meshUrl, 'https://storage.test/model.glb?fresh');
  assert.equal(h.calls.providerChecks, 0);
  assert.equal(h.uploads.length, 0);
  assert.deepEqual(h.documents.get('pipelines/p1').adminPreview, preview);
});
