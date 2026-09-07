const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const test = require('node:test');
const ts = require('typescript');

const payloadExports = {};
vm.runInNewContext(ts.transpileModule(
  fs.readFileSync(path.join(__dirname, '../src/lib/callable-payload.ts'), 'utf8'),
  { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } },
).outputText, { exports: payloadExports });

// Match the installed Firebase Functions SDK encoder: explicitly present
// undefined values become null, including values nested inside request objects.
function encodeCallable(value) {
  if (value == null) return null;
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.map(encodeCallable);
  if (typeof value === 'object') return Object.fromEntries(
    Object.entries(value).map(([key, field]) => [key, encodeCallable(field)])
  );
  return value;
}

// Exercise the actual hooks against deferred callable responses. The small
// React adapter retains state/ref slots between explicit renders; no account
// or live Firebase project is used.
function loadHook(name, callable, ...args) {
  const slots = [];
  let cursor = 0;
  const react = {
    useState(initial) {
      const index = cursor++;
      if (!(index in slots)) slots[index] = typeof initial === 'function' ? initial() : initial;
      return [slots[index], (value) => {
        slots[index] = typeof value === 'function' ? value(slots[index]) : value;
      }];
    },
    useRef(initial) {
      const index = cursor++;
      if (!(index in slots)) slots[index] = { current: initial };
      return slots[index];
    },
    useCallback(callback) { return callback; },
  };
  const exports = {};
  const code = ts.transpileModule(
    fs.readFileSync(path.join(__dirname, `../src/hooks/${name}.ts`), 'utf8'),
    { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } },
  ).outputText;
  vm.runInNewContext(code, {
    exports,
    console: { error() {} },
    Error,
    require(id) {
      if (id === 'react') return react;
      if (id === '@/lib/firebase') return { functions: {} };
      if (id === '@/lib/callable-payload') return payloadExports;
      if (id === 'firebase/functions') return { httpsCallable: (_, functionName) => (data) => callable(functionName, encodeCallable(data)) };
      throw new Error(`Unexpected import: ${id}`);
    },
  });
  return () => {
    cursor = 0;
    return exports[name](...args);
  };
}

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
}

function page(key, records, limit = records.length, offset = 0, hasMore = false) {
  return { data: { [key]: records, pagination: { total: 100, limit, offset, hasMore } } };
}

test('user load more retains earlier rows; credit/tier updates preserve the loaded page', async () => {
  const calls = [];
  const render = loadHook('useAdmin', async (name, input) => {
    calls.push(name);
    if (name === 'listUsers') return input.offset === 0
      ? page('users', [{ uid: 'first', credits: 4, tier: 'free' }], 1, 0, true)
      : page('users', [{ uid: 'second', credits: 2, tier: 'free' }], 1, 1, true);
    if (name === 'addCredits') return { data: { success: true, newBalance: 12 } };
    if (name === 'updateUserTier') return { data: { success: true, newTier: 'premium' } };
    throw new Error(name);
  });
  await render().fetchUsers(1, 0);
  await render().fetchUsers(1, 1);
  assert.equal(render().users.length, 2);
  assert.equal(await render().addCredits('second', 10), true);
  assert.equal(await render().updateUserTier('second', 'premium'), true);
  assert.equal(render().users[0].uid, 'first');
  assert.equal(render().users[1].credits, 12);
  assert.equal(render().users[1].tier, 'premium');
  assert.equal(render().usersPagination.offset, 1);
  assert.equal(calls.filter((name) => name === 'listUsers').length, 2);
});

test('credit actions reject repeated/concurrent submissions until the first operation settles', async () => {
  const pending = deferred();
  let requests = 0;
  const render = loadHook('useAdmin', () => { requests++; return pending.promise; });
  const first = render().addCredits('user', 10);
  assert.equal(render().addingCredits, true);
  assert.equal(await render().addCredits('user', 10), false);
  assert.equal(await render().deductCredits('user', 10, 'adjust'), false);
  assert.equal(await render().updateUserTier('user', 'premium'), false);
  assert.equal(requests, 1);
  pending.resolve({ data: { success: true, newBalance: 10 } });
  assert.equal(await first, true);
  assert.equal(render().addingCredits, false);
});

test('switching users invalidates earlier transactions and ignores stale failures', async () => {
  const requests = [];
  const render = loadHook('useAdmin', () => {
    const pending = deferred();
    requests.push(pending);
    return pending.promise;
  });
  const first = render().fetchUserTransactions('first');
  render().resetUserTransactions();
  const second = render().fetchUserTransactions('second');
  requests[0].reject(new Error('old user request failed'));
  await first;
  assert.equal(render().transactionsLoading, true);
  assert.equal(render().error, null);
  requests[1].resolve(page('transactions', [{ id: 'second-tx' }], 1, 0, true));
  await second;
  const more = render().fetchUserTransactions('second', 1, 1);
  requests[2].resolve(page('transactions', [{ id: 'older-tx' }], 1, 1));
  await more;
  assert.equal(render().transactions.map((tx) => tx.id).join(','), 'second-tx,older-tx');
  const stale = render().fetchUserTransactions('second');
  render().resetUserTransactions();
  requests[3].resolve(page('transactions', [{ id: 'must-not-return' }]));
  await stale;
  assert.equal(render().transactions.length, 0);
});

test('pipeline filters reject out-of-order results and clear the previous filter while loading', async () => {
  const requests = [];
  const render = loadHook('useAdminPipelines', () => {
    const pending = deferred();
    requests.push(pending);
    return pending.promise;
  });
  const first = render().fetchPipelines(20, 0, { status: 'completed' });
  requests[0].resolve(page('pipelines', [{ id: 'completed' }]));
  await first;
  const oldFilter = render().fetchPipelines(20, 0, { status: 'failed' });
  assert.equal(render().pipelines.length, 0);
  const newFilter = render().fetchPipelines(20, 0, { userId: 'target' });
  requests[2].resolve(page('pipelines', [{ id: 'target-pipeline' }]));
  await newFilter;
  requests[1].resolve(page('pipelines', [{ id: 'wrong-filter' }]));
  await oldFilter;
  assert.equal(render().pipelines[0].id, 'target-pipeline');
  assert.equal(render().loading, false);
});

test('pipeline refresh beyond 50 rows retains the selected later page within the server limit', async () => {
  const requests = [];
  const render = loadHook('useAdminPipelines', async (_, input) => {
    requests.push(input);
    return page('pipelines', Array.from({ length: input.limit }, (_, index) => ({ id: `${input.offset + index}` })), input.limit, input.offset, true);
  });
  await render().fetchPipelines(65, 0, { userId: 'target' });
  assert.equal(requests.map((input) => `${input.offset}:${input.limit}`).join(','), '0:50,50:15');
  assert.equal(render().pipelines.length, 65);
  assert.equal(render().pipelines[64].id, '64');
  assert.equal(render().pagination.offset + render().pagination.limit, 65);
});

test('reopened pending previews resume processing and expired tasks stop polling', async () => {
  const render = loadHook('useAdminPipelineRegeneration', async () => ({ data: { success: true, status: 'no-active-task', preview: null } }), {
    provider: 'meshy', taskId: 'pending', taskStatus: 'pending',
  });
  assert.equal(render().previewStatus, 'processing');
  await render().checkPreviewStatus('pipeline');
  assert.equal(render().previewStatus, 'idle');
  assert.equal(render().previewData, null);
});

test('preview approval is exclusive and never mutates the pipeline prop image previews', async () => {
  const pending = deferred();
  let requests = 0;
  const original = { meshImages: { front: { url: 'front', storagePath: 'preview/version-one/front.png' }, back: { url: 'back' } } };
  let confirmation;
  const render = loadHook('useAdminPipelineRegeneration', (_, input) => { requests++; confirmation = input; return pending.promise; }, original);
  const first = render().confirmPreview('pipeline', 'meshImages', 'front');
  assert.equal(render().isRegenerating, true);
  assert.equal(await render().confirmPreview('pipeline', 'meshImages', 'front'), false);
  assert.equal(await render().rejectPreview('pipeline', 'all'), false);
  assert.equal(requests, 1);
  pending.resolve({ data: { success: true } });
  assert.equal(await first, true);
  assert.equal(confirmation.expectedStoragePath, 'preview/version-one/front.png');
  assert.equal(original.meshImages.front.url, 'front');
  assert.equal(render().previewData.meshImages.front, undefined);
  assert.equal(render().previewData.meshImages.back.url, 'back');
  assert.equal(render().isRegenerating, false);
});

test('starting another mesh clears the previous confirmable model until the replacement is ready', async () => {
  const render = loadHook('useAdminPipelineRegeneration', async () => ({ data: { success: true, taskId: 'new-task', provider: 'meshy' } }), {
    meshUrl: 'old-preview', meshStoragePath: 'old-path', taskStatus: 'completed',
  });
  await render().regenerateMesh('pipeline', 'meshy');
  assert.equal(render().previewStatus, 'processing');
  assert.equal(render().previewData.meshUrl, undefined);
  assert.equal(render().previewData.meshStoragePath, undefined);
  assert.equal(render().previewData.taskId, 'new-task');
});


test('mesh confirmation carries the exact preview path returned by the completed task', async () => {
  let confirmation;
  const render = loadHook('useAdminPipelineRegeneration', async (name, input) => {
    if (name === 'adminCheckPreviewStatus') return { data: { success: true, status: 'completed', meshUrl: 'signed-preview', meshStoragePath: 'preview/version-two/model.glb' } };
    confirmation = input;
    return { data: { success: true } };
  }, { taskId: 'pending', provider: 'meshy', taskStatus: 'processing' });
  await render().checkPreviewStatus('pipeline');
  await render().confirmPreview('pipeline', 'mesh');
  assert.equal(confirmation.expectedStoragePath, 'preview/version-two/model.glb');
});


test('optional admin arguments stay absent after Firebase callable wire encoding', async () => {
  const requests = new Map();
  const callable = async (name, input) => {
    requests.set(name, input);
    if (name === 'listAllPipelines') return page('pipelines', []);
    if (name === 'addCredits') return { data: { success: true, newBalance: 10 } };
    if (name === 'adminRegeneratePipelineImage') return { data: { success: true, previewImage: { url: 'preview' } } };
    if (name === 'adminStartPipelineMesh') return { data: { success: true, taskId: 'task', provider: 'meshy' } };
    return { data: { success: true } };
  };
  await loadHook('useAdmin', callable)().addCredits('user', 10);
  await loadHook('useAdminPipelines', callable)().fetchPipelines();
  const regeneration = loadHook('useAdminPipelineRegeneration', callable);
  await regeneration().regenerateImage('pipeline', 'mesh', 'front');
  await regeneration().regenerateMesh('pipeline', 'meshy');
  await regeneration().confirmPreview('pipeline', 'mesh');
  await regeneration().rejectPreview('pipeline', 'mesh');
  for (const [name, omitted] of [
    ['addCredits', ['reason']],
    ['listAllPipelines', ['status', 'userId']],
    ['adminRegeneratePipelineImage', ['hint']],
    ['adminStartPipelineMesh', ['providerOptions']],
    ['adminConfirmPreview', ['angle', 'expectedStoragePath']],
    ['adminRejectPreview', ['angle']],
  ]) {
    for (const field of omitted) assert.equal(Object.hasOwn(requests.get(name), field), false, `${name}.${field}`);
  }
});

test('optimization omits unused model selectors and partially entered dimensions on the wire', async () => {
  const requests = [];
  const render = loadHook('useMeshOptimization', async (name, input) => {
    requests.push({ name, input });
    return { data: { success: true, analysis: {}, preview: {} } };
  });
  const source = { pipelineId: 'pipeline', jobId: undefined, modelUrl: 'model' };
  await render().analyze(source);
  await render().previewOptimization({
    ...source,
    options: { scale: { enabled: true, targetSize: { width: 10, height: undefined, depth: undefined } }, simplify: undefined },
  });
  await render().optimize({
    ...source,
    options: { repair: { enabled: true }, scale: { enabled: false, targetSize: undefined } },
  });
  for (const { input } of requests) assert.equal(Object.hasOwn(input, 'jobId'), false);
  assert.deepEqual(requests[1].input.options.scale.targetSize, { width: 10 });
  assert.equal(Object.hasOwn(requests[1].input.options, 'simplify'), false);
  assert.equal(Object.hasOwn(requests[2].input.options.scale, 'targetSize'), false);
});

test('omitting undefined does not erase explicit nulls or change array positions', () => {
  const input = { required: null, omitted: undefined, nested: { omitted: undefined, nullable: null }, list: [1, undefined, null, 4] };
  const wire = encodeCallable(payloadExports.omitUndefinedFields(input));
  assert.deepEqual(wire, { required: null, nested: { nullable: null }, list: [1, null, null, 4] });
  assert.equal(Object.hasOwn(input, 'omitted'), true);
});


test('a stale-preview conflict can reload every preview field without automatically confirming', async () => {
  const calls = [];
  const original = { meshImages: { front: { url: 'old-image', storagePath: 'preview/p1/front.png' } }, meshUrl: 'old-mesh', meshStoragePath: 'preview/p1/mesh.glb', taskStatus: 'completed' };
  const replacement = { meshImages: { front: { url: 'new-image', storagePath: 'preview/p2/front.png' }, back: { url: 'new-back', storagePath: 'preview/p2/back.png' } }, meshUrl: 'new-mesh', meshStoragePath: 'preview/p2/mesh.glb', taskStatus: 'completed' };
  const render = loadHook('useAdminPipelineRegeneration', async (name, input) => {
    calls.push({ name, input });
    if (name === 'adminCheckPreviewStatus') {
      assert.equal(input.readOnly, true);
      return { data: { success: true, status: 'snapshot', preview: replacement } };
    }
    if (input.expectedStoragePath === 'preview/p1/front.png') {
      throw new Error('Preview changed; review the new preview before confirming');
    }
    return { data: { success: true } };
  }, original);
  assert.equal(await render().confirmPreview('pipeline', 'meshImages', 'front'), false);
  assert.equal(render().isRegenerating, false);
  assert.equal(render().previewData.meshImages.front.url, 'old-image');
  assert.equal(await render().reloadPreview('pipeline'), true);
  assert.equal(render().error, null);
  assert.equal(render().previewData.meshImages.front.url, 'new-image');
  assert.equal(render().previewData.meshImages.back.url, 'new-back');
  assert.equal(render().previewData.meshStoragePath, 'preview/p2/mesh.glb');
  assert.equal(calls.filter((call) => call.name === 'adminConfirmPreview').length, 1);
  assert.equal(await render().confirmPreview('pipeline', 'meshImages', 'front'), true);
  assert.equal(calls.at(-1).input.expectedStoragePath, 'preview/p2/front.png');
});

test('a failed preview reload retains the reviewed preview and can be retried', async () => {
  const original = { meshUrl: 'reviewed-model', meshStoragePath: 'preview/p1/mesh.glb', taskStatus: 'completed' };
  let attempts = 0;
  const render = loadHook('useAdminPipelineRegeneration', async () => {
    if (++attempts === 1) throw new Error('Network unavailable');
    return { data: { success: true, status: 'snapshot', preview: null } };
  }, original);
  assert.equal(await render().reloadPreview('pipeline'), false);
  assert.equal(render().previewData.meshUrl, 'reviewed-model');
  assert.equal(render().isRegenerating, false);
  assert.equal(await render().reloadPreview('pipeline'), true);
  assert.equal(render().previewData, null);
  assert.equal(render().previewStatus, 'idle');
});
