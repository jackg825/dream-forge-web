const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const test = require('node:test');
const ts = require('typescript');

// Run the real hook with explicitly scheduled renders/effect cleanups. This
// allows an old Firestore callback to arrive between an auth change and cleanup.
function createAuthHarness() {
  const slots = [];
  const effects = [];
  const subscriptions = [];
  let cursor = 0;
  let authCallback;
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
    useEffect(callback, dependencies) {
      const index = cursor++;
      const previous = effects[index];
      const changed = !previous || dependencies.some((value, i) => value !== previous.dependencies[i]);
      if (changed) effects[index] = { dependencies, callback, cleanup: previous?.cleanup, pending: true };
    },
  };
  const exports = {};
  vm.runInNewContext(ts.transpileModule(
    fs.readFileSync(path.join(__dirname, '../src/hooks/useAuth.ts'), 'utf8'),
    { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } },
  ).outputText, {
    exports, Error, Date, setTimeout, clearTimeout,
    console: { error() {} },
    require(id) {
      if (id === 'react') return react;
      if (id === 'firebase/auth') return {
        onAuthStateChanged(_, callback) { authCallback = callback; return () => {}; },
      };
      if (id === 'firebase/firestore') return {
        doc: (_, __, uid) => uid,
        onSnapshot(uid, next, error) {
          const subscription = { uid, next, error, closed: false };
          subscriptions.push(subscription);
          return () => { subscription.closed = true; };
        },
      };
      if (id === 'firebase/functions') return { httpsCallable: () => async () => ({ data: { granted: false } }) };
      if (id === '@/lib/firebase') return { auth: {}, db: {}, functions: {}, isFirebaseReady: () => true };
      if (id === '@/lib/defer-state-update') return { deferStateUpdate: (callback) => { callback(); return () => {}; } };
      if (id === '@/lib/auth') return {};
      throw new Error(`Unexpected import: ${id}`);
    },
  });
  function render() {
    cursor = 0;
    const result = exports.useAuth();
    for (const effect of effects) {
      if (!effect?.pending) continue;
      effect.cleanup?.();
      effect.pending = false;
      effect.cleanup = effect.callback();
    }
    return result;
  }
  return {
    render, subscriptions,
    authenticate(uid) { authCallback(uid ? { uid, email: `${uid}@example.com`, emailVerified: false } : null); },
    unmount() { effects.forEach((effect) => effect?.cleanup?.()); },
  };
}

const profile = (role = 'admin', extra = {}) => ({
  exists: () => true,
  data: () => ({ uid: 'untrusted-document-uid', role, displayName: 'Account', credits: 5, ...extra }),
});
function signedInAdministrator() {
  const harness = createAuthHarness();
  harness.render();
  harness.authenticate('administrator');
  harness.render();
  harness.subscriptions[0].next(profile());
  assert.equal(harness.render().user.role, 'admin');
  return harness;
}

test('identity changes clear the previous administrator before the new profile arrives', () => {
  const harness = signedInAdministrator();
  harness.authenticate('customer');
  const pending = harness.render();
  assert.equal(pending.firebaseUser.uid, 'customer');
  assert.equal(pending.user, null);
  assert.equal(pending.loading, true);
  harness.subscriptions[1].next(profile('user'));
  const current = harness.render();
  assert.equal(current.user.uid, 'customer');
  assert.equal(current.user.role, 'user');
  assert.equal(current.loading, false);
});

test('an old profile callback between auth change and effect cleanup cannot restore admin access', () => {
  const harness = signedInAdministrator();
  const old = harness.subscriptions[0];
  harness.authenticate('customer');
  // Auth state setters have run, but React has not rendered/cleaned up yet.
  old.next(profile('admin'));
  const current = harness.render();
  assert.equal(current.user, null);
  assert.equal(current.loading, true);
  assert.equal(current.firebaseUser.uid, 'customer');
});

test('sign-out ignores a previous administrator snapshot before effect cleanup', () => {
  const harness = signedInAdministrator();
  harness.authenticate(null);
  harness.subscriptions[0].next(profile('admin'));
  const current = harness.render();
  assert.equal(current.user, null);
  assert.equal(current.firebaseUser, null);
  assert.equal(current.loading, false);
});

test('current Firestore errors clear the administrator profile and expose the failure', () => {
  const harness = signedInAdministrator();
  harness.subscriptions[0].error(new Error('Permission denied'));
  const current = harness.render();
  assert.equal(current.user, null);
  assert.equal(current.loading, false);
  assert.equal(current.error, 'Permission denied');
});

test('stale success and error callbacks are ignored after subscription cleanup', () => {
  const harness = signedInAdministrator();
  const old = harness.subscriptions[0];
  harness.authenticate('customer');
  harness.render();
  assert.equal(old.closed, true);
  harness.subscriptions[1].next(profile('user'));
  old.next(profile('admin'));
  old.error(new Error('Stale error'));
  const current = harness.render();
  assert.equal(current.user.uid, 'customer');
  assert.equal(current.user.role, 'user');
  assert.equal(current.error, null);
  harness.unmount();
  assert.equal(harness.subscriptions[1].closed, true);
});

test('missing user documents use an unprivileged fallback tied to the auth identity', () => {
  const harness = signedInAdministrator();
  harness.subscriptions[0].next({ exists: () => false });
  const current = harness.render();
  assert.equal(current.user.role, 'user');
  assert.equal(current.user.uid, 'administrator');
  assert.equal(current.user.credits, 0);
});
