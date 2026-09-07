const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const test = require('node:test');
const ts = require('typescript');

function hook(callable, available = true) {
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
  };
  const exports = {};
  const source = fs.readFileSync(path.join(__dirname, '../src/hooks/useOrders.ts'), 'utf8');
  vm.runInNewContext(ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText, {
    exports, Error, console,
    require(id) {
      if (id === 'react') return react;
      if (id === '@/lib/firebase') return { functions: available ? {} : null };
      if (id === 'firebase/functions') return { httpsCallable: (_, name) => (data) => callable(name, data) };
      throw new Error(id);
    },
  });
  return () => { cursor = 0; return exports.useAdminOrders(); };
}
const deferred = () => {
  let resolve, reject;
  const promise = new Promise((a, b) => { resolve = a; reject = b; });
  return { promise, resolve, reject };
};
const page = (id, offset = 0) => ({ data: {
  orders: [{ id }], pagination: { total: 200, limit: 50, offset, hasMore: true },
} });

test('an older order filter response cannot replace the latest filtered page', async () => {
  const earlier = deferred();
  const latest = deferred();
  const render = hook((_, input) => input.status === 'pending' ? earlier.promise : latest.promise);
  const first = render().fetchOrders({ status: 'pending' });
  const second = render().fetchOrders({ status: 'shipping', offset: 50 });
  latest.resolve(page('latest', 50));
  await second;
  earlier.resolve(page('stale'));
  await first;
  assert.equal(render().orders[0].id, 'latest');
  assert.equal(render().pagination.offset, 50);
  assert.equal(render().loading, false);
});

test('stale order load failures do not overwrite a successful newer filter', async () => {
  const earlier = deferred();
  const render = hook((_, input) => input.status === 'pending' ? earlier.promise : Promise.resolve(page('latest')));
  const first = render().fetchOrders({ status: 'pending' });
  await render().fetchOrders({ status: 'delivered' });
  earlier.reject(new Error('Stale failure'));
  await first;
  assert.equal(render().error, null);
  assert.equal(render().orders[0].id, 'latest');
});

test('status/tracking mutations reject duplicate clicks and preserve the current page', async () => {
  const pending = deferred();
  const calls = [];
  const render = hook((name) => {
    calls.push(name);
    return name === 'listAllOrders' ? Promise.resolve(page('existing', 100)) : pending.promise;
  });
  await render().fetchOrders({ offset: 100, status: 'shipping' });
  const first = render().updateOrderStatus({ orderId: 'existing', newStatus: 'delivered' });
  assert.equal(await render().updateOrderStatus({ orderId: 'existing', newStatus: 'delivered' }), null);
  assert.equal(await render().updateTracking('existing', { carrier: 'A', trackingNumber: '123' }), false);
  pending.resolve({ data: { success: true } });
  await first;
  assert.deepEqual(calls, ['listAllOrders', 'updateOrderStatus']);
  assert.equal(render().pagination.offset, 100);
  assert.equal(render().updatingStatus, false);
});

test('missing service and mutation failures are visible and leave orders intact', async () => {
  const unavailable = hook(() => { throw new Error('Should not call'); }, false);
  await unavailable().fetchOrders();
  await unavailable().fetchStats();
  assert.match(unavailable().error, /unavailable/);
  assert.match(unavailable().statsError, /unavailable/);
  const render = hook((name) => name === 'listAllOrders'
    ? Promise.resolve(page('existing')) : Promise.reject(new Error('Status changed by another admin')));
  await render().fetchOrders();
  assert.equal(await render().updateOrderStatus({ orderId: 'existing', newStatus: 'confirmed' }), null);
  assert.equal(render().orders[0].id, 'existing');
  assert.match(render().error, /another admin/);
  assert.equal(render().updatingStatus, false);
});

test('the status picker workflow agrees with server transition rules', () => {
  function transitions(filename) {
    const exports = {};
    vm.runInNewContext(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    }).outputText, { exports });
    return JSON.parse(JSON.stringify(exports.ORDER_STATUS_TRANSITIONS));
  }
  assert.deepEqual(
    transitions(path.join(__dirname, '../src/types/order.ts')),
    transitions(path.join(__dirname, '../../functions/src/domain/order/types.ts')),
  );
});
