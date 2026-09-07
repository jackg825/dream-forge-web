const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const test = require('node:test');
const ts = require('typescript');

function hook(callable, { available = true, includeUnavailable } = {}) {
  const slots = [];
  let cursor = 0;
  const react = {
    useState(initial) {
      const index = cursor++;
      if (!(index in slots)) slots[index] = initial;
      return [slots[index], (value) => { slots[index] = typeof value === 'function' ? value(slots[index]) : value; }];
    },
    useRef(initial) {
      const index = cursor++;
      if (!(index in slots)) slots[index] = { current: initial };
      return slots[index];
    },
    useCallback: (callback) => callback,
    useEffect() {}, // Refresh calls are scheduled explicitly by each test.
  };
  const exports = {};
  vm.runInNewContext(ts.transpileModule(
    fs.readFileSync(path.join(__dirname, '../src/hooks/useOrders.ts'), 'utf8'),
    { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } },
  ).outputText, {
    exports, Error, console,
    require(id) {
      if (id === 'react') return react;
      if (id === '@/lib/firebase') return { functions: available ? {} : null };
      if (id === 'firebase/functions') return { httpsCallable: (_, name) => (data) => callable(name, data) };
      throw new Error(id);
    },
  });
  return () => { cursor = 0; return exports.usePrintConfig(includeUnavailable); };
}
const config = (price = 100) => ({ data: {
  success: true,
  materials: [{ id: 'resin', available: false }],
  sizes: [{ id: '5x5x5', available: false }],
  colors: [{ id: 'red', available: false }],
  pricing: { resin: { '5x5x5': price } },
} });
const deferred = () => {
  let resolve, reject;
  const promise = new Promise((a, b) => { resolve = a; reject = b; });
  return { promise, resolve, reject };
};

test('admin print config requests unavailable entries while the default requests available entries', async () => {
  for (const [includeUnavailable, expected] of [[true, true], [undefined, false]]) {
    const calls = [];
    const render = hook(async (name, input) => { calls.push({ name, input }); return config(); }, { includeUnavailable });
    assert.equal(await render().refresh(), true);
    assert.equal(calls.length, 1);
    assert.equal(calls[0].name, 'getPrintConfig');
    assert.equal(calls[0].input.includeUnavailable, expected);
    assert.equal(render().materials[0].available, false, 'the hook preserves the authorized response');
    assert.equal(render().loading, false);
  }
});

test('missing Firebase ends the initial loading state and reports an actionable failure', async () => {
  const render = hook(() => { throw new Error('Unexpected call'); }, { available: false });
  assert.equal(render().loading, true);
  assert.equal(await render().refresh(), false);
  assert.equal(render().loading, false);
  assert.match(render().error, /Firebase/);
});

test('an earlier refresh cannot overwrite newer prices or end its loading state', async () => {
  const oldRequest = deferred();
  const newRequest = deferred();
  let calls = 0;
  const render = hook(() => ++calls === 1 ? oldRequest.promise : newRequest.promise, { includeUnavailable: true });
  const old = render().refresh();
  const latest = render().refresh();
  oldRequest.resolve(config(100));
  assert.equal(await old, false);
  assert.equal(render().loading, true);
  newRequest.resolve(config(250));
  assert.equal(await latest, true);
  assert.equal(render().getPrice('resin', '5x5x5'), 250);
  assert.equal(render().loading, false);
});

test('late stale responses and failures cannot replace a successful pricing refresh', async () => {
  for (const fails of [false, true]) {
    const oldRequest = deferred();
    let calls = 0;
    const render = hook(() => ++calls === 1 ? oldRequest.promise : Promise.resolve(config(250)));
    const old = render().refresh();
    assert.equal(await render().refresh(), true);
    if (fails) oldRequest.reject(new Error('Stale error'));
    else oldRequest.resolve(config(100));
    assert.equal(await old, false);
    assert.equal(render().getPrice('resin', '5x5x5'), 250);
    assert.equal(render().loading, false);
    assert.equal(render().error, null);
  }
});
