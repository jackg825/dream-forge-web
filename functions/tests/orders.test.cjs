const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const test = require('node:test');
const ts = require('typescript');
const { https } = require('firebase-functions/v1');

const timestamp = new Date('2026-08-01T12:00:00Z');
const clone = (value) => structuredClone(value);
const originalOrder = (status = 'shipping') => ({
  id: 'order-1', userId: 'customer-1', status,
  statusHistory: [{ from: 'quality_check', to: status, changedBy: 'admin:first', changedAt: timestamp }],
  items: [{ id: 'item-1', quantity: 2, material: 'resin', size: '5x5x5' }],
  payment: { status: 'completed', method: 'stripe', currency: 'TWD', subtotal: 10000, shippingCost: 100, totalAmount: 10100 },
  tracking: { carrier: 'Carrier', trackingNumber: 'TRACK-1', shippedAt: timestamp },
  createdAt: timestamp, updatedAt: timestamp,
});

function environment(status = 'shipping') {
  const docs = new Map([
    ['orders/order-1', originalOrder(status)],
    ['users/customer-1', { credits: 10 }],
  ]);
  let version = 0;
  let failedCommit = false;
  let transactionAttempts = 0;
  const snapshot = (id, data) => ({ id: id.split('/').at(-1), exists: !!data, data: () => clone(data) });
  const db = {
    collection: (name) => ({ doc: (id) => ({ path: `${name}/${id}` }) }),
    async runTransaction(callback) {
      for (;;) {
        transactionAttempts++;
        const startVersion = version;
        const initial = new Map([...docs].map(([key, value]) => [key, clone(value)]));
        const writes = [];
        const transaction = {
          get: async (ref) => snapshot(ref.path, initial.get(ref.path)),
          update: (ref, value) => writes.push([ref.path, value, true]),
          set: (ref, value) => writes.push([ref.path, value, false]),
        };
        const result = await callback(transaction);
        if (version !== startVersion) continue;
        if (failedCommit) throw new Error('Simulated commit failure');
        const next = new Map(docs);
        for (const [key, value, merge] of writes) {
          const existing = next.get(key) || {};
          const record = merge ? { ...existing } : {};
          for (const [field, entry] of Object.entries(value)) {
            record[field] = entry?.increment !== undefined ? (existing[field] || 0) + entry.increment : clone(entry);
          }
          // Firestore rejects undefined in optional fields and status history.
          const check = (data) => {
            if (data === undefined) throw new Error('Undefined Firestore value');
            if (data && typeof data === 'object' && !(data instanceof Date)) Object.values(data).forEach(check);
          };
          check(record);
          next.set(key, record);
        }
        for (const [key, value] of next) docs.set(key, value);
        version++;
        return result;
      }
    },
  };
  const cache = new Map();
  function load(relative) {
    const filename = path.resolve(__dirname, '../src', relative);
    if (cache.has(filename)) return cache.get(filename).exports;
    const module = new Module(filename);
    module.paths = Module._nodeModulePaths(path.dirname(filename));
    cache.set(filename, module);
    const originalRequire = module.require.bind(module);
    module.require = (id) => {
      if (id === 'firebase-admin') return { firestore: Object.assign(() => db, {
        FieldValue: { increment: (amount) => ({ increment: amount }), serverTimestamp: () => timestamp },
      }) };
      if (id === 'firebase-functions' || id === 'firebase-functions/v1') return {
        https, logger: { info() {}, warn() {}, error() {} },
      };
      if (id.startsWith('.')) {
        const base = path.resolve(path.dirname(filename), id);
        const source = fs.existsSync(`${base}.ts`) ? `${base}.ts` : path.join(base, 'index.ts');
        return load(path.relative(path.resolve(__dirname, '../src'), source));
      }
      return originalRequire(id);
    };
    module._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    }).outputText, filename);
    return module.exports;
  }
  const { FirestoreOrderRepository } = load('infrastructure/repositories/OrderRepository.ts');
  const { UpdateOrderStatusUseCase } = load('application/orders/UpdateOrderStatusUseCase.ts');
  const { CancelOrderUseCase } = load('application/orders/CancelOrderUseCase.ts');
  const notifications = [];
  const notifier = { sendOrderStatusNotification: async (payload) => notifications.push(payload) };
  const repository = new FirestoreOrderRepository();
  return {
    docs, load, notifications, repository,
    status: new UpdateOrderStatusUseCase(repository, notifier),
    cancel: new CancelOrderUseCase(repository, notifier),
    failCommit: () => { failedCommit = true; },
    attempts: () => transactionAttempts,
  };
}

const deliver = { orderId: 'order-1', newStatus: 'delivered', adminId: 'admin-1' };

test('concurrent delivery requests commit one status history entry, bonus and ledger record', async () => {
  const env = environment();
  const results = await Promise.allSettled([env.status.execute(deliver), env.status.execute(deliver)]);
  assert.equal(results.filter((result) => result.status === 'fulfilled').length, 1);
  const failure = results.find((result) => result.status === 'rejected');
  assert.equal(failure.reason.code, 'failed-precondition');
  assert.ok(env.attempts() >= 3, 'concurrent transaction retries with the latest order');
  const order = env.docs.get('orders/order-1');
  assert.equal(order.status, 'delivered');
  assert.equal(order.statusHistory.length, 2);
  assert.equal(env.docs.get('users/customer-1').credits, 10 + order.bonusCreditsAwarded);
  assert.equal(env.docs.get('transactions/delivery-bonus:order-1').amount, order.bonusCreditsAwarded);
  assert.equal(env.notifications.length, 1);
});

test('failed delivery persistence does not award credits or report a successful notification', async () => {
  const env = environment();
  env.failCommit();
  await assert.rejects(env.status.execute(deliver), /Simulated commit failure/);
  assert.equal(env.docs.get('users/customer-1').credits, 10);
  assert.equal(env.docs.get('orders/order-1').status, 'shipping');
  assert.equal(env.docs.size, 2);
  assert.equal(env.notifications.length, 0);
});

test('refund records payment status, timestamps, reason and internal notes together', async () => {
  const env = environment('delivered');
  await env.status.execute({ ...deliver, newStatus: 'refunded', reason: 'Returned', adminNotes: 'Reviewed receipt' });
  const order = env.docs.get('orders/order-1');
  assert.equal(order.payment.status, 'refunded');
  assert.ok(order.payment.refundedAt instanceof Date);
  assert.ok(order.refundedAt instanceof Date);
  assert.equal(order.statusHistory.at(-1).reason, 'Returned');
  assert.equal(order.statusHistory.at(-1).adminNotes, 'Reviewed receipt');
  assert.equal(env.docs.get('users/customer-1').credits, 10);
});

test('cancellation cannot overwrite a concurrent delivery or its history', async () => {
  const env = environment();
  const results = await Promise.allSettled([
    env.status.execute(deliver),
    env.cancel.execute({ orderId: 'order-1', userId: 'customer-1', reason: 'Cancel' }),
  ]);
  assert.equal(results.filter((result) => result.status === 'fulfilled').length, 1);
  assert.equal(env.docs.get('orders/order-1').statusHistory.length, 2);
  assert.equal(env.notifications.length, 1);
});

test('customer cannot cancel someone else’s order; administrator can cancel a confirmed order', async () => {
  const env = environment('confirmed');
  await assert.rejects(env.cancel.execute({ orderId: 'order-1', userId: 'other', reason: 'Cancel' }), { code: 'permission-denied' });
  await env.cancel.execute({ orderId: 'order-1', userId: 'admin-1', isAdmin: true, reason: 'Cancel' });
  assert.equal(env.docs.get('orders/order-1').status, 'cancelled');
});

test('unknown states, invalid tracking URLs and malformed material configuration are rejected', () => {
  const env = environment();
  const validation = env.load('utils/order-validation.ts');
  for (const value of ['bogus', 'constructor', '__proto__', 7]) {
    assert.throws(() => validation.orderStatus(value), { code: 'invalid-argument' });
  }
  for (const input of [{}, { carrier: ' ', trackingNumber: '123' }, { carrier: 'A', trackingNumber: 123 },
    { carrier: 'A', trackingNumber: '123', trackingUrl: 'javascript:alert(1)' },
    { carrier: 'A', trackingNumber: '123', estimatedDelivery: 'invalid' }]) {
    assert.throws(() => validation.orderTracking(input), { code: 'invalid-argument' });
  }
  assert.deepEqual(validation.orderTracking({ carrier: ' A ', trackingNumber: ' 123 ', trackingUrl: ' https://example.com/track ' }), {
    carrier: 'A', trackingNumber: '123', trackingUrl: 'https://example.com/track',
  });
  const { MATERIAL_CONFIGS } = env.load('domain/order/types.ts');
  assert.equal(validation.orderMaterial(MATERIAL_CONFIGS.resin).id, 'resin');
  for (const change of [{ id: '__proto__' }, { available: 'yes' }, { maxColors: 4 }, { estimatedDays: -1 }]) {
    assert.throws(() => validation.orderMaterial({ ...MATERIAL_CONFIGS.resin, ...change }), { code: 'invalid-argument' });
  }
});

test('customer order responses exclude internal notes without changing administrator data', () => {
  const env = environment();
  const { customerOrder } = env.load('utils/order-visibility.ts');
  const order = originalOrder();
  order.adminNotes = 'Internal billing review';
  order.qualityCheckNotes = 'Internal inspection';
  order.statusHistory[0].adminNotes = 'Staff only';
  const visible = customerOrder(order);
  assert.equal('adminNotes' in visible, false);
  assert.equal('qualityCheckNotes' in visible, false);
  assert.equal('adminNotes' in visible.statusHistory[0], false);
  assert.equal(visible.tracking.trackingNumber, 'TRACK-1');
  assert.equal(order.adminNotes, 'Internal billing review');
  assert.equal(order.statusHistory[0].adminNotes, 'Staff only');
});

test('optional callable null fields behave like omission while required values stay strict', () => {
  const env = environment();
  const validation = env.load('utils/order-validation.ts');
  // Firebase callable encoding converts explicitly undefined payload fields to null.
  for (const absent of [undefined, null]) {
    assert.equal(validation.optionalOrderStatusFilter(absent), undefined);
    assert.equal(validation.optionalOrderTracking(absent), undefined);
    for (const field of ['Reason', 'Admin notes', 'User ID']) {
      assert.equal(validation.optionalOrderText(absent, field), undefined);
    }
    for (const field of ['start date', 'end date', 'estimated delivery']) {
      assert.equal(validation.orderDate(absent, field), undefined);
    }
    assert.deepEqual(validation.orderTracking({ carrier: 'A', trackingNumber: '123', trackingUrl: absent, estimatedDelivery: absent }), {
      carrier: 'A', trackingNumber: '123',
    });
    assert.throws(() => validation.orderId(absent), { code: 'invalid-argument' });
    assert.throws(() => validation.orderStatus(absent), { code: 'invalid-argument' });
    assert.throws(() => validation.orderTracking(absent), { code: 'invalid-argument' });
    assert.throws(() => validation.orderTracking({ carrier: absent, trackingNumber: '123' }), { code: 'invalid-argument' });
  }
  assert.equal(validation.optionalOrderStatusFilter('shipping'), 'shipping');
  assert.deepEqual(validation.optionalOrderStatusFilter(['shipping', 'pending']), ['shipping', 'pending']);
  assert.throws(() => validation.optionalOrderStatusFilter([null]), { code: 'invalid-argument' });
  assert.throws(() => validation.optionalOrderText(0, 'Reason'), { code: 'invalid-argument' });
});
