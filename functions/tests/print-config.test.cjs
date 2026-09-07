const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const test = require('node:test');
const ts = require('typescript');
const { https } = require('firebase-functions/v1');

function endpoint(role = 'admin') {
  const materials = [{ id: 'pla-single', available: true }, { id: 'resin', available: false }];
  const sizes = [{ id: '5x5x5', available: true }, { id: '15x15x15', available: false }];
  const colors = [{ id: 'white', available: true }, { id: 'red', available: false }];
  const pricing = { 'pla-single': { '5x5x5': 100 }, resin: { '15x15x15': 1000 } };
  const reads = [];
  const orderRepository = {
    async getMaterials() { reads.push('materials'); return materials; },
    async getSizes() { reads.push('sizes'); return sizes; },
    async getColors() { reads.push('colors'); return colors; },
    async getPricingMatrix() { reads.push('pricing'); return pricing; },
  };
  const exports = {};
  const unusedDependencies = new Set([
    '../infrastructure/notification/WebhookNotificationAdapter', '../application/orders',
    '../storage', '../utils/storage-validation', '../utils/order-validation', '../utils/order-visibility',
  ]);
  vm.runInNewContext(ts.transpileModule(
    fs.readFileSync(path.join(__dirname, '../src/handlers/orders.ts'), 'utf8'),
    { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } },
  ).outputText, {
    exports, Error, Date,
    require(id) {
      if (id === 'firebase-functions/v1') return {
        https, logger: { error() {} }, region: () => ({ https: { onCall: (handler) => handler } }),
      };
      if (id === 'firebase-admin') return { firestore: () => ({
        collection(name) {
          assert.equal(name, 'users');
          return { doc: (uid) => ({ get: async () => {
            reads.push(`role:${uid}`);
            return { data: () => ({ role }) };
          } }) };
        },
      }) };
      if (id === '../infrastructure/repositories/OrderRepository') return { orderRepository };
      if (unusedDependencies.has(id)) return {};
      throw new Error(`Unexpected import: ${id}`);
    },
  });
  return { call: exports.getPrintConfig, materials, sizes, colors, pricing, reads };
}
const context = { auth: { uid: 'signed-in-user' } };

test('administrators can read disabled materials, sizes and colors for complete configuration editing', async () => {
  const env = endpoint('admin');
  const result = await env.call({ includeUnavailable: true }, context);
  assert.equal(result.success, true);
  assert.deepEqual(result.materials, env.materials);
  assert.deepEqual(result.sizes, env.sizes);
  assert.deepEqual(result.colors, env.colors);
  assert.deepEqual(result.pricing, env.pricing);
  assert.equal(env.reads[0], 'role:signed-in-user');
});

test('ordinary users retain available-only configuration for omitted, false and null flags', async () => {
  for (const input of [undefined, {}, { includeUnavailable: false }, { includeUnavailable: null }]) {
    const env = endpoint('user');
    const result = await env.call(input, context);
    assert.deepEqual(result.materials.map(({ id }) => id), ['pla-single']);
    assert.deepEqual(result.sizes.map(({ id }) => id), ['5x5x5']);
    assert.deepEqual(result.colors.map(({ id }) => id), ['white']);
    assert.deepEqual(result.pricing, env.pricing);
    assert.equal(env.reads.some((read) => read.startsWith('role:')), false);
  }
});

test('non-admins cannot request disabled configuration even with an admin token claim', async () => {
  const env = endpoint('user');
  await assert.rejects(env.call({ includeUnavailable: true }, {
    auth: { uid: 'signed-in-user', token: { role: 'admin' } },
  }), { code: 'permission-denied' });
  assert.deepEqual(env.reads, ['role:signed-in-user']);
});

test('unauthenticated and malformed includeUnavailable requests fail before configuration reads', async () => {
  const unauthenticated = endpoint();
  await assert.rejects(unauthenticated.call({ includeUnavailable: true }, {}), { code: 'unauthenticated' });
  assert.equal(unauthenticated.reads.length, 0);
  for (const flag of ['true', 1, {}, []]) {
    const env = endpoint();
    await assert.rejects(env.call({ includeUnavailable: flag }, context), { code: 'invalid-argument' });
    assert.equal(env.reads.length, 0);
  }
});
