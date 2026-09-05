import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '../src');
function sourceLoader(overrides = {}) {
  const cache = new Map();
  function load(file) {
    file = path.resolve(root, file);
    if (cache.has(file)) return cache.get(file).exports;
    const loadedModule = { exports: {} };
    cache.set(file, loadedModule);
    const realRequire = createRequire(file);
    const requireSource = (id) => {
      if (Object.hasOwn(overrides, id)) return overrides[id];
      const base = id.startsWith('@/') ? path.resolve(root, id.slice(2)) : id.startsWith('.') ? path.resolve(path.dirname(file), id) : null;
      if (base) {
        const target = [base + '.ts', base + '.tsx', path.join(base, 'index.ts')].find(fs.existsSync);
        if (target) return load(target);
      }
      return realRequire(id);
    };
    const output = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: {
      module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true,
    } }).outputText;
    vm.runInNewContext(output, {
      module: loadedModule, exports: loadedModule.exports, require: requireSource, Error, Date, Intl,
      console: { ...console, error() {} }, queueMicrotask,
      document: { visibilityState: 'visible', addEventListener() {}, removeEventListener() {} },
      setTimeout: () => 1, clearTimeout() {}, setInterval: () => 1, clearInterval() {},
    }, { filename: file });
    return loadedModule.exports;
  }
  return load;
}

// Deterministic hook host for unit-testing actual callback and state transitions.
// It deliberately does not claim to cover React DOM events or concurrent scheduling.
function hookHost() {
  const slots = [];
  let cursor = 0;
  let dirty = false;
  let effects = [];
  const equalDeps = (a, b) => a && b && a.length === b.length && a.every((value, i) => Object.is(value, b[i]));
  const hooks = {
    ...React,
    useState(initial) {
      const index = cursor++;
      if (!slots[index]) {
        const slot = { value: typeof initial === 'function' ? initial() : initial };
        slot.set = (next) => {
          const value = typeof next === 'function' ? next(slot.value) : next;
          if (!Object.is(slot.value, value)) { slot.value = value; dirty = true; }
        };
        slots[index] = slot;
      }
      return [slots[index].value, slots[index].set];
    },
    useRef(initial) {
      const index = cursor++;
      slots[index] ||= { current: initial };
      return slots[index];
    },
    useCallback(callback, deps) {
      const index = cursor++;
      if (!slots[index] || !equalDeps(slots[index].deps, deps)) slots[index] = { value: callback, deps };
      return slots[index].value;
    },
    useEffect(callback, deps) {
      const index = cursor++;
      if (!slots[index] || !equalDeps(slots[index].deps, deps)) {
        const previous = slots[index];
        const current = slots[index] = { deps };
        effects.push(() => { previous?.cleanup?.(); current.cleanup = callback(); });
      }
    },
  };
  return {
    hooks,
    render(component) {
      let output;
      for (let i = 0; i < 20; i++) {
        cursor = 0; dirty = false; effects = [];
        output = component();
        effects.forEach((effect) => effect());
        if (!dirty) return output;
      }
      throw new Error('Hook host did not settle');
    },
    unmount() { for (const slot of slots) slot?.cleanup?.(); },
  };
}

function pipelineHookFixture() {
  const host = hookHost();
  const calls = [];
  let shouldFail = false;
  let listener;
  const load = sourceLoader({
    react: host.hooks,
    '@/lib/firebase': { db: {}, functions: {} },
    '@/lib/refresh-pipeline-urls': { refreshPipelineUrls: async (pipeline) => pipeline },
    'firebase/firestore': { doc: () => ({}), onSnapshot: (_ref, next) => { listener = next; return () => {}; } },
    'firebase/functions': { httpsCallable: (_functions, name, options) => async (payload) => {
      calls.push({ name, options, payload });
      if (shouldFail) throw new Error('Network unavailable');
      return { data: { pipelineId: 'p1', status: 'images-ready' } };
    } },
  });
  const { usePipeline } = load('hooks/usePipeline.ts');
  const render = () => host.render(() => usePipeline('p1'));
  return { render, calls, host, fail: (value) => { shouldFail = value; }, snapshot: (pipeline) => listener({ id: 'p1', exists: () => true, data: () => pipeline }) };
}

for (const [action, args, callable] of [
  ['generateImages', [], 'generatePipelineImages'],
  ['createPipeline', [['photo']], 'createPipeline'],
  ['regenerateImage', ['mesh', 'front', 'keep the ears'], 'regeneratePipelineImage'],
  ['updateAnalysis', [{}], 'updatePipelineAnalysis'],
  ['resetStep', ['draft', true], 'resetPipelineStep'],
  ['checkStatus', [], 'checkPipelineStatus'],
  ['startMeshGeneration', ['hitem3d', { resolution: 512 }], 'startPipelineMesh'],
  ['startTextureGeneration', [], 'startPipelineTexture'],
]) {
  test(`${action}: successful retry clears a transient failure`, async () => {
    const fixture = pipelineHookFixture();
    let pipeline = fixture.render();
    // Finish the subscription's initial deferred state update before testing a failure.
    await Promise.resolve();
    fixture.fail(true);
    await assert.rejects(pipeline[action](...args), /Network unavailable/);
    pipeline = fixture.render();
    assert.equal(pipeline.error, 'Network unavailable');
    fixture.fail(false);
    await pipeline[action](...args);
    assert.equal(fixture.render().error, null);
    assert.equal(fixture.calls.at(-1).name, callable);
    fixture.host.unmount();
  });
}

test('image generation allows the 300-second server job to finish and uses the immediate pipeline ID', async () => {
  const fixture = pipelineHookFixture();
  await fixture.render().generateImages('newly-created');
  const call = fixture.calls[0];
  assert.equal(call.name, 'generatePipelineImages');
  assert.equal(call.payload.pipelineId, 'newly-created');
  assert.ok(call.options.timeout >= 300000, 'client must not time out before the backend execution budget');
  fixture.host.unmount();
});

test('single-view correction and provider requests allow their 120-second backend budget', async () => {
  const fixture = pipelineHookFixture();
  const hook = fixture.render();
  await hook.regenerateImage('mesh', 'front', 'keep the ears');
  await hook.startMeshGeneration('hitem3d');
  await hook.checkStatus();
  await hook.startTextureGeneration();
  for (const call of fixture.calls) assert.ok(call.options.timeout > 120000);
  assert.equal(fixture.calls[0].payload.hint, 'keep the ears');
  fixture.host.unmount();
});

test('a healthy Firestore snapshot restores the active workflow after a transient error', async () => {
  const fixture = pipelineHookFixture();
  const hook = fixture.render();
  await Promise.resolve();
  fixture.fail(true);
  await assert.rejects(hook.checkStatus());
  assert.equal(fixture.render().error, 'Network unavailable');
  fixture.snapshot({ status: 'mesh-ready', meshUrl: 'accepted-model', settings: {} });
  const recovered = fixture.render();
  assert.equal(recovered.error, null);
  assert.equal(recovered.pipeline.meshUrl, 'accepted-model');
  assert.equal(recovered.canProceed, true);
  fixture.host.unmount();
});

const t = (key, values) => values ? `${key} ${JSON.stringify(values)}` : key;
function leaf(name, tag = 'div') {
  const component = ({ children }) => React.createElement(tag, null, children);
  component.displayName = name;
  return component;
}
const Button = leaf('Button', 'button');
const Card = leaf('Card');
const CardContent = leaf('CardContent');
const Badge = leaf('Badge', 'span');
const sharedOverrides = {
  'next-intl': { useTranslations: () => t, useLocale: () => 'zh-TW' },
  '@/components/ui/card': { Card, CardContent },
  '@/components/ui/button': { Button },
  '@/components/ui/badge': { Badge },
  '@/components/ui/fill-image': { FillImage: leaf('FillImage', 'span') },
};

test('history renders views + mesh + texture charges, including old records without views', () => {
  const { PipelineCard } = sourceLoader({
    ...sharedOverrides,
    '@/components/ui/provider-badge': { ProviderBadge: leaf('ProviderBadge', 'span') },
    '@/i18n/navigation': { Link: leaf('Link', 'a') },
  })('components/history/PipelineCard.tsx');
  const base = { id: 'p1', status: 'completed', createdAt: new Date('2026-09-05'), inputImages: [], meshImages: {}, settings: { provider: 'hitem3d' } };
  for (const [creditsCharged, expected] of [
    [{ views: 3, mesh: 6, texture: 10 }, 19],
    [{ views: 5, mesh: 0, texture: 0 }, 5],
    [{ mesh: 6, texture: 0 }, 6],
  ]) {
    const markup = renderToStaticMarkup(React.createElement(PipelineCard, { pipeline: { ...base, creditsCharged } }));
    assert.ok(markup.includes(`${expected} pipeline.credits.points`), markup);
    assert.ok(!markup.includes('NaN'));
  }
});

function descendants(element, predicate) {
  const matches = [];
  function visit(node) {
    if (Array.isArray(node)) { node.forEach(visit); return; }
    if (!React.isValidElement(node)) return;
    if (predicate(node)) matches.push(node);
    visit(node.props.children);
  }
  visit(element);
  return matches;
}
function textOf(node) {
  if (Array.isArray(node)) return node.map(textOf).join(' ');
  if (React.isValidElement(node)) return textOf(node.props.children);
  return node == null || node === false ? '' : String(node);
}

function flowFixture() {
  const host = hookHost();
  const calls = [];
  const analysis = { description: 'Original subject', colorPalette: ['#112233', '#445566', '#778899'], analyzedAt: new Date(), analyzedWithStyle: 'chibi' };
  const pipeline = { id: 'p1', status: 'draft', settings: { selectedStyle: 'chibi', geminiModel: 'gemini-2.5-flash-image' }, imageAnalysis: analysis, inputImages: [{ url: 'photo' }], meshImages: {}, creditsCharged: { views: 0, mesh: 0, texture: 0 } };
  let localAnalysis = analysis;
  let finishAnalysis;
  const pendingAnalysis = new Promise((resolve, reject) => { finishAnalysis = { resolve, reject }; });
  const StyleSelector = leaf('StyleSelector');
  const updateAnalysis = async (...args) => { calls.push({ name: 'updateAnalysis', args }); };
  const hook = {
    pipeline, loading: false, error: null,
    createPipeline: async () => { calls.push({ name: 'createPipeline' }); return 'p2'; },
    generateImages: async () => { calls.push({ name: 'generateImages' }); },
    regenerateImage: async () => {}, startMeshGeneration: async () => {}, checkStatus: async () => {},
    startTextureGeneration: async () => {}, updateAnalysis, resetStep: async () => {}, isBatchProcessing: false,
  };
  const setAnalysis = (value) => { localAnalysis = value; };
  const overrides = {
    ...sharedOverrides,
    react: host.hooks,
    'next/navigation': { useRouter: () => ({ push() {} }), useSearchParams: () => ({ get: () => 'p1' }) },
    'next/dynamic': () => leaf('ModelViewer'),
    '@/hooks/useAuth': { useAuth: () => ({ user: { uid: 'u1', tier: 'free' }, loading: false }) },
    '@/hooks/useCredits': { useCredits: () => ({ credits: 100, loading: false }) },
    '@/hooks/usePipeline': { usePipeline: () => hook },
    '@/hooks/useImageAnalysis': { useImageAnalysis: () => ({
      analysis: localAnalysis, loading: false, error: null, setAnalysis,
      analyzeImage: async (...args) => { calls.push({ name: 'analyzeImage', args }); const result = await pendingAnalysis; localAnalysis = result; return result; },
      updateDescription() {}, updateColors() {}, addColor() {}, removeColor() {}, updateColor() {}, reset() {}, hasEdits: false,
    }) },
    '@/lib/download': { downloadFile: async () => {} },
    '@/lib/refresh-pipeline-urls': { refreshPipelineUrls: async (value) => value },
    '@/components/ui/skeleton': { Skeleton: leaf('Skeleton') },
    '@/components/ui/upgrade-prompt': { UpgradePrompt: leaf('UpgradePrompt') },
    '@/components/ui/dialog': Object.fromEntries(['Dialog', 'DialogContent', 'DialogHeader', 'DialogTitle', 'DialogTrigger'].map((name) => [name, leaf(name)])),
    '@/components/viewer/ModelViewerErrorBoundary': { TranslatedModelViewerErrorBoundary: leaf('ViewerBoundary') },
    '@/components/viewer/ViewerToolbar': { ViewerToolbar: leaf('ViewerToolbar') },
    '@/components/viewer/OptimizePanel': { OptimizePanel: leaf('OptimizePanel') },
    './StyleSelector': { StyleSelector },
  };
  for (const name of ['PipelineUploader', 'PreviousOutputs', 'RegenerateDialog', 'ResetStepDialog', 'PipelineErrorState', 'PipelineProgressBar', 'UnifiedProgressIndicator', 'ImageAnalysisPanel', 'MultiViewGrid', 'ProviderSelector', 'ProviderOptionsPanel', 'ViewModelSelector', 'ViewComparisonDialog']) overrides[`./${name}`] = { [name]: leaf(name) };
  const { PipelineFlow } = sourceLoader(overrides)('components/generate/PipelineFlow.tsx');
  const inner = PipelineFlow({ onNoCredits: () => calls.push({ name: 'noCredits' }) }).props.children;
  const render = () => host.render(() => inner.type(inner.props));
  return { render, host, calls, StyleSelector, finishAnalysis, analysis };
}

for (const outcome of ['success', 'failure']) {
  test(`changing style blocks paid generation until reanalysis ${outcome === 'success' ? 'succeeds' : 'and stays blocked on failure'}`, async () => {
    const fixture = flowFixture();
    let tree = fixture.render();
    let style = descendants(tree, (node) => node.type === fixture.StyleSelector)[0];
    assert.equal(style.props.locked, true);
    style.props.onRequestUnlock();
    tree = fixture.render();
    style = descendants(tree, (node) => node.type === fixture.StyleSelector)[0];
    style.props.onChange('bobblehead');
    tree = fixture.render();
    let generate = descendants(tree, (node) => node.type === Button && textOf(node).includes('buttons.generateViewsWithCredits'))[0];
    assert.ok(generate, 'draft retains a visible generate action');
    assert.equal(generate.props.disabled, true);
    // Invoke even a disabled callback to verify the handler itself protects credits.
    await generate.props.onClick();
    assert.equal(fixture.calls.filter((call) => call.name === 'generateImages').length, 0);
    const reanalyze = descendants(tree, (node) => node.type === Button && textOf(node).includes('styles.reanalyze'))[0];
    reanalyze.props.onClick();
    tree = fixture.render();
    generate = descendants(tree, (node) => node.type === Button && textOf(node).includes('buttons.generating'))[0];
    assert.ok(generate?.props.disabled, 'the request remains disabled during analysis');
    const cancel = descendants(tree, (node) => node.type === Button && textOf(node).includes('buttons.cancel'))[0];
    assert.equal(cancel?.props.disabled, true, 'cannot cancel a style change while its analysis is committing');
    assert.equal(fixture.calls[0].name, 'analyzeImage');
    assert.equal(fixture.calls[0].args[4], 'bobblehead');
    if (outcome === 'success') fixture.finishAnalysis.resolve({ ...fixture.analysis, analyzedWithStyle: 'bobblehead' });
    else fixture.finishAnalysis.reject(new Error('Analysis unavailable'));
    await new Promise((resolve) => setImmediate(resolve));
    tree = fixture.render();
    generate = descendants(tree, (node) => node.type === Button && textOf(node).includes('buttons.generateViewsWithCredits'))[0];
    assert.equal(generate.props.disabled, outcome === 'failure');
    await generate.props.onClick();
    assert.equal(fixture.calls.filter((call) => call.name === 'generateImages').length, outcome === 'success' ? 1 : 0);
    fixture.host.unmount();
  });
}
