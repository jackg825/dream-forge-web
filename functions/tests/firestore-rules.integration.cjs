// Run against a Firestore emulator started with this repository's firestore.rules:
// FIRESTORE_EMULATOR_HOST=127.0.0.1:8188 node --test functions/tests/firestore-rules.integration.cjs
// No SDK dependencies or service account credentials are needed.
const test = require('node:test');
const assert = require('node:assert/strict');

const host = process.env.FIRESTORE_EMULATOR_HOST;
if (!host || !/^(127\.0\.0\.1|localhost):\d+$/.test(host)) {
  throw new Error('Set FIRESTORE_EMULATOR_HOST to a local emulator; live services are never allowed');
}
const project = 'demo-dream-forge-admin-audit';
const origin = `http://${host}`;
const documentsUrl = `${origin}/v1/projects/${project}/databases/(default)/documents`;

function token(uid, extra = {}) {
  const now = Math.floor(Date.now() / 1000);
  const encode = (value) => Buffer.from(JSON.stringify(value)).toString('base64url');
  return `${encode({ alg: 'none', typ: 'JWT' })}.${encode({
    sub: uid, user_id: uid, aud: project, iss: `https://securetoken.google.com/${project}`,
    iat: now, exp: now + 3600, auth_time: now,
    firebase: { sign_in_provider: 'custom', identities: {} }, ...extra,
  })}.`;
}
async function request(path, { auth, method = 'GET', body } = {}) {
  return fetch(`${documentsUrl}/${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', ...(auth && { Authorization: `Bearer ${auth}` }) },
    ...(body && { body: JSON.stringify(body) }),
  });
}
async function expectStatus(response, expected) {
  const body = await response.text();
  assert.equal(response.status, expected, body);
  return body ? JSON.parse(body) : null;
}
const fields = (data) => Object.fromEntries(Object.entries(data).map(([key, value]) => [key,
  typeof value === 'number' ? { integerValue: String(value) } : { stringValue: value },
]));

test.before(async () => {
  const reset = await fetch(`${origin}/emulator/v1/projects/${project}/databases/(default)/documents`, { method: 'DELETE' });
  assert.equal(reset.status, 200, await reset.text());
  for (const [path, data] of Object.entries({
    'users/admin': { role: 'admin', credits: 10 },
    'users/customer': { role: 'user', credits: 10 },
    'users/other': { role: 'user', credits: 10 },
    'orders/order-1': { userId: 'customer', status: 'pending', adminNotes: 'Private billing review', qualityCheckNotes: 'Private fulfilment note' },
  })) {
    await expectStatus(await request(path, { auth: 'owner', method: 'PATCH', body: { fields: fields(data) } }), 200);
  }
});

test('anonymous clients cannot read or list orders', async () => {
  await expectStatus(await request('orders/order-1'), 403);
  await expectStatus(await request('orders'), 403);
});

test('order owner and other customers cannot bypass callable redaction with document reads or queries', async () => {
  for (const uid of ['customer', 'other', 'missing-profile']) {
    await expectStatus(await request('orders/order-1', { auth: token(uid) }), 403);
    await expectStatus(await request('orders', { auth: token(uid) }), 403);
  }
});

test('administrator role in Firestore can read and list complete fulfilment records', async () => {
  const order = await expectStatus(await request('orders/order-1', { auth: token('admin') }), 200);
  assert.equal(order.fields.adminNotes.stringValue, 'Private billing review');
  assert.equal(order.fields.qualityCheckNotes.stringValue, 'Private fulfilment note');
  const result = await expectStatus(await request('orders', { auth: token('admin') }), 200);
  assert.equal(result.documents.length, 1);
});

test('an admin claim alone does not grant access without an administrator Firestore profile', async () => {
  await expectStatus(await request('orders/order-1', { auth: token('customer', { role: 'admin', admin: true }) }), 403);
});

test('customers and administrators cannot write orders directly', async () => {
  for (const uid of ['customer', 'admin']) {
    await expectStatus(await request('orders/order-1', { auth: token(uid), method: 'PATCH', body: { fields: fields({ status: 'delivered' }) } }), 403);
    await expectStatus(await request('orders/order-1', { auth: token(uid), method: 'DELETE' }), 403);
    await expectStatus(await request('orders/unauthorized-new', { auth: token(uid), method: 'PATCH', body: { fields: fields({ userId: uid }) } }), 403);
  }
});

test('customers retain their own profile read access and cannot grant themselves administrator rights', async () => {
  await expectStatus(await request('users/customer', { auth: token('customer') }), 200);
  await expectStatus(await request('users/customer', {
    auth: token('customer'), method: 'PATCH', body: { fields: fields({ role: 'admin' }) },
  }), 403);
});
