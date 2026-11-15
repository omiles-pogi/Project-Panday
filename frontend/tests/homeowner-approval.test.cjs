// Run with: node --test tests/homeowner-approval.test.cjs
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

function load(file, mocks, globals = {}) {
  const filename = path.join(__dirname, '..', file);
  const { outputText } = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
  });
  const exports = {};
  vm.runInNewContext(outputText, { exports, Error, ...globals, require(name) {
    if (name in mocks) return mocks[name];
    throw new Error(`Unexpected dependency ${name}`);
  } }, { filename });
  return exports;
}
const jsx = (type, props) => ({ type, props });
const runtime = { jsx, jsxs: jsx };
const tick = () => new Promise(resolve => setImmediate(resolve));
class ApiError extends Error {
  constructor(status) { super('Account unavailable'); this.data = { approval_status: status }; }
}
const fields = role => ({ name: 'Preview Account', email: 'preview@example.invalid', password: 'synthetic-test-password', password_confirmation: 'synthetic-test-password', role });

async function auth(options = {}) {
  const slots = [], effects = [], storage = new Map(options.token ? [['buildai_auth_token', options.token]] : []);
  const requests = []; let cursor = 0, installedToken = null;
  let response = options.response;
  const Provider = load('src/context/AuthContext.tsx', {
    react: {
      createContext: () => ({ Provider: 'Provider' }), useContext: () => null,
      useState(initial) { const i = cursor++; if (!(i in slots)) slots[i] = initial; return [slots[i], next => { slots[i] = typeof next === 'function' ? next(slots[i]) : next; }]; },
      useCallback: fn => fn,
      useEffect(fn) { const i = cursor++; if (!(i in slots)) { slots[i] = true; effects.push(fn); } },
    },
    'react/jsx-runtime': runtime,
    '@/utils/tokenStorage': { tokenStorage: { getItem: async key => storage.get(key), setItem: async (key, value) => storage.set(key, value), deleteItem: async key => storage.delete(key) } },
    '@/services/api/client': { ApiError, setAuthToken: token => { installedToken = token; } },
    '@/services/push': { disablePush: async () => {} },
    '@/services/api/auth': {
      registerRequest: async value => { requests.push(['register', value.role]); return response; },
      loginRequest: async value => { requests.push(['login', value.email]); if (response instanceof Error) throw response; return response; },
      meRequest: async () => { if (options.meError) throw options.meError; return options.me; },
      logoutRequest: async () => {}, updateNameRequest: async name => ({ name }),
    },
  }, { process: { env: {} }, __DEV__: false }).AuthProvider;
  const render = () => { cursor = 0; return Provider({ children: null }).props.value; };
  render(); effects.splice(0).forEach(fn => fn()); await tick();
  return { render, storage, requests, token: () => installedToken, respond: value => { response = value; } };
}

test('homeowner registration enters the app immediately and clears a previous approval waiting screen', async () => {
  const app = await auth({ response: { user: { role: 'contractor' }, message: 'Waiting' } });
  await app.render().register(fields('contractor'));
  assert.ok(app.render().pending);
  app.respond({ user: { id: 7, name: 'Preview Owner', role: 'homeowner' }, token: 'synthetic-issued-token' });
  await app.render().register(fields('homeowner'));
  const value = app.render();
  assert.equal(value.status, 'authed'); assert.equal(value.pending, null); assert.equal(value.user.id, 7);
  assert.equal(app.storage.get('buildai_auth_token'), 'synthetic-issued-token');
  assert.equal(app.token(), 'synthetic-issued-token');
  assert.deepEqual(app.requests.map(entry => entry[0]), ['register', 'register']);
});

test('contractor, worker and supplier registration still use the existing approval waiting flow', async () => {
  for (const role of ['contractor', 'worker', 'supplier']) {
    const app = await auth({ response: { user: { role }, message: 'Waiting' } });
    await app.render().register(fields(role));
    const value = app.render();
    assert.equal(value.status, 'guest'); assert.equal(value.user, null); assert.equal(value.pending.email, fields(role).email);
    assert.equal(app.storage.has('buildai_auth_token'), false);
    app.respond(new ApiError('pending'));
    await value.login(fields(role).email, fields(role).password);
    assert.equal(app.render().status, 'guest'); assert.ok(app.render().pending);
    app.respond({ user: { id: 8, role }, token: 'synthetic-approved-token' });
    await app.render().login(fields(role).email, fields(role).password);
    assert.equal(app.render().status, 'authed'); assert.equal(app.render().pending, null);
  }
});

test('existing eligible homeowner login enters the app; restricted status never opens the approval waiting screen', async () => {
  const app = await auth({ response: { user: { id: 9, role: 'homeowner' }, token: 'synthetic-login-token' } });
  await app.render().login(fields('homeowner').email, fields('homeowner').password);
  assert.equal(app.render().status, 'authed'); assert.equal(app.render().pending, null);
  for (const status of ['rejected', 'disabled', 'banned']) {
    const blocked = await auth({ response: new ApiError(status) });
    await assert.rejects(blocked.render().login(fields('homeowner').email, fields('homeowner').password));
    assert.equal(blocked.render().status, 'guest'); assert.equal(blocked.render().pending, null);
    assert.equal(blocked.storage.has('buildai_auth_token'), false);
  }
});

test('restart authenticates only a valid server-confirmed token and removes a revoked token', async () => {
  const owner = { id: 9, role: 'homeowner' };
  const app = await auth({ token: 'synthetic-valid-token', me: owner });
  assert.equal(app.render().status, 'authed'); assert.equal(app.render().user.id, 9);
  const revoked = await auth({ token: 'synthetic-revoked-token', meError: new Error('Unauthenticated') });
  assert.equal(revoked.render().status, 'guest'); assert.equal(revoked.render().user, null);
  assert.equal(revoked.storage.has('buildai_auth_token'), false); assert.equal(revoked.token(), null);
});
