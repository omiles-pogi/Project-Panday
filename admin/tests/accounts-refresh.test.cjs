// Dependency-free runtime tests, following the mobile app's hook-test convention.
// Timers, document visibility, and deferred API replies are controlled explicitly.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

const flush = () => new Promise((resolve) => setImmediate(resolve));
const plain = (value) => JSON.parse(JSON.stringify(value));
function deferred() {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}
function load(file, mocks, globals = {}, extra = '') {
  let source = fs.readFileSync(path.join(__dirname, '..', file), 'utf8');
  source = source.replace('import.meta.env.VITE_API_BASE_URL', 'undefined');
  const { outputText } = ts.transpileModule(source + extra, {
    compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
  });
  const exports = {};
  vm.runInNewContext(outputText, { exports, AbortController, Error, URLSearchParams, ...globals, require(name) {
    if (name in mocks) return mocks[name];
    throw new Error(`Unexpected import: ${name}`);
  } }, { filename: file });
  return exports;
}
function hooks() {
  const slots = [];
  let cursor = 0, effects = [], dirty = false, mounted = true;
  const equal = (a, b) => a && b && a.length === b.length && a.every((v, i) => Object.is(v, b[i]));
  const react = {
    useState(initial) {
      const i = cursor++;
      if (!(i in slots)) slots[i] = typeof initial === 'function' ? initial() : initial;
      return [slots[i], (value) => {
        assert.ok(mounted, 'no state updates after unmount');
        const next = typeof value === 'function' ? value(slots[i]) : value;
        if (!Object.is(next, slots[i])) { slots[i] = next; dirty = true; }
      }];
    },
    useRef(value) { return slots[cursor++] ??= { current: value }; },
    useCallback(callback, deps) {
      const i = cursor++;
      if (!equal(slots[i]?.deps, deps)) slots[i] = { deps, callback };
      return slots[i].callback;
    },
    useEffect(effect, deps) {
      const i = cursor++;
      if (!equal(slots[i]?.deps, deps)) effects.push(() => {
        slots[i]?.cleanup?.();
        slots[i] = { deps, effect, cleanup: effect() };
      });
    },
  };
  return {
    react,
    async render(fn) {
      for (let i = 0; i < 20; i++) {
        cursor = 0; dirty = false;
        const result = fn();
        const pending = effects; effects = []; pending.forEach((effect) => effect());
        await flush();
        if (!dirty) return result;
      }
      throw new Error('Render did not settle');
    },
    replayEffects() {
      const active = slots.filter((slot) => slot?.effect);
      active.forEach((slot) => slot.cleanup?.());
      active.forEach((slot) => { slot.cleanup = slot.effect(); });
    },
    unmount() { slots.forEach((slot) => slot?.cleanup?.()); mounted = false; },
  };
}
class UnauthorizedError extends Error {}
const account = (id, role = 'contractor', status = 'pending') => ({ id, name: `Account ${id}`, email: `account${id}@example.test`, role, approval_status: status, created_at: '2026-11-14T00:00:00Z', business_name: null, license_number: null });

function app(initial = {}) {
  const hook = hooks();
  const reads = [], stats = [], actions = [], errors = [], pending = [], timers = new Map(), listeners = new Set();
  let now = 0, nextTimer = 0, filters = { status: 'pending', role: '', q: '', ...initial };
  const document = { hidden: false, addEventListener(type, fn) { assert.equal(type, 'visibilitychange'); listeners.add(fn); }, removeEventListener(_type, fn) { listeners.delete(fn); } };
  const api = {
    UnauthorizedError,
    fetchUsers(params, signal) { const d = deferred(); reads.push({ params, signal, ...d }); return d.promise; },
    fetchStats(signal) { const d = deferred(); stats.push({ signal, ...d }); return d.promise; },
    setApproval(id, status) { const d = deferred(); actions.push({ id, status, ...d }); return d.promise; },
  };
  const { useAccounts } = load('src/useAccounts.ts', { react: hook.react, './api': api }, {
    document,
    setTimeout(fn, delay = 0) { const id = ++nextTimer; timers.set(id, { fn, at: now + delay }); return id; },
    clearTimeout(id) { timers.delete(id); },
  });
  const onError = (error) => errors.push(error);
  const onPendingCount = (count) => pending.push(count);
  const render = () => hook.render(() => useAccounts(filters, onError, onPendingCount));
  return {
    hook, reads, stats, actions, errors, pending, timers, listeners, render,
    async advance(ms) {
      const end = now + ms;
      for (;;) {
        const due = [...timers].filter(([, t]) => t.at <= end).sort((a, b) => a[1].at - b[1].at)[0];
        if (!due) break;
        now = due[1].at; timers.delete(due[0]); due[1].fn(); await flush();
      }
      now = end; return render();
    },
    async reply(i, rows, count = rows.length) {
      reads[i].resolve(rows); stats[i].resolve({ totals: { pending: count } });
      await flush(); return render();
    },
    async filters(next) { filters = { ...filters, ...next }; return render(); },
    async visible(value) { document.hidden = !value; listeners.forEach((fn) => fn()); await flush(); return render(); },
    hideBeforeMount() { document.hidden = true; },
    stop() { hook.unmount(); },
  };
}

test('initial fetch and quiet five-second polling keep filters and last rows', async () => {
  const a = app();
  assert.equal((await a.render()).users, null);
  await a.advance(0);
  assert.equal(a.reads.length, 1);
  const first = [account(1)];
  await a.reply(0, first, 1);
  await a.advance(4999);
  assert.equal(a.reads.length, 1);
  const refreshing = await a.advance(1);
  assert.equal(a.reads.length, 2);
  assert.equal(refreshing.users, first, 'background refresh never clears the table');
  const updated = await a.reply(1, [...first, account(2)], 2);
  assert.equal(updated.users.length, 2);
  assert.deepEqual(a.pending, [1, 2]);
  assert.deepEqual(plain(a.reads[1].params), { status: 'pending', role: '', q: '' });
  a.stop();
});

test('slow reads never overlap and the next interval starts after completion', async () => {
  const a = app(); await a.render(); await a.advance(0); await a.advance(30_000);
  assert.equal(a.reads.length, 1); assert.equal(a.stats.length, 1);
  a.reads[0].resolve([account(1)]); await flush(); await a.advance(10_000);
  assert.equal(a.reads.length, 1, 'wait for both endpoints before the next poll');
  a.stats[0].resolve({ totals: { pending: 1 } }); await flush();
  await a.advance(5000); assert.equal(a.reads.length, 2); a.stop();
});

test('filter changes abort obsolete reads and ignore late replies from the older filter', async () => {
  const a = app(); await a.render(); await a.advance(0);
  await a.filters({ status: 'approved', role: 'homeowner', q: 'house' });
  assert.equal(a.reads[0].signal.aborted, true); assert.equal(a.stats[0].signal.aborted, true);
  await a.advance(249); assert.equal(a.reads.length, 1);
  await a.advance(1); assert.equal(a.reads.length, 2);
  const expected = [account(2, 'homeowner', 'approved')]; await a.reply(1, expected);
  assert.equal((await a.reply(0, [account(1)])).users, expected);
  await a.advance(5000);
  assert.deepEqual(plain(a.reads[2].params), { status: 'approved', role: 'homeowner', q: 'house' }); a.stop();
});

test('search input remains debounced during rapid typing', async () => {
  const a = app(); await a.render(); await a.filters({ q: 'a' }); await a.advance(100);
  await a.filters({ q: 'ab' }); await a.advance(100); await a.filters({ q: 'abc' });
  await a.advance(249); assert.equal(a.reads.length, 0);
  await a.advance(1); assert.equal(a.reads.length, 1); assert.equal(a.reads[0].params.q, 'abc'); a.stop();
});

test('hidden tabs cancel requests and timers; returning visible fetches immediately', async () => {
  const a = app(); await a.render(); await a.advance(0); await a.reply(0, [account(1)]);
  await a.advance(5000); await a.visible(false);
  assert.equal(a.reads[1].signal.aborted, true); assert.equal(a.timers.size, 0);
  await a.advance(60_000); assert.equal(a.reads.length, 2);
  const visible = await a.visible(true); assert.equal(a.reads.length, 3); assert.equal(visible.users.length, 1);
  await a.reply(2, [account(2)]); await a.reply(1, [account(99)]);
  assert.equal((await a.render()).users[0].id, 2); a.stop();
});

test('a screen mounted while hidden waits until it is visible', async () => {
  const a = app(); a.hideBeforeMount(); await a.render(); await a.advance(30_000);
  assert.equal(a.reads.length, 0); await a.visible(true); assert.equal(a.reads.length, 1); a.stop();
});

test('unmount cleans listeners and timers, aborts requests, and ignores late results', async () => {
  const a = app(); await a.render(); await a.advance(0); a.stop();
  assert.equal(a.listeners.size, 0); assert.equal(a.timers.size, 0); assert.equal(a.reads[0].signal.aborted, true);
  a.reads[0].resolve([account(1)]); a.stats[0].resolve({ totals: { pending: 1 } }); await flush();
  assert.deepEqual(a.pending, []); assert.equal(a.timers.size, 0);
});

test('StrictMode setup/cleanup creates one live polling loop and one visibility listener', async () => {
  const a = app(); await a.render(); a.hook.replayEffects();
  await a.advance(0); assert.equal(a.reads.length, 1); assert.equal(a.listeners.size, 1);
  await a.reply(0, []); await a.advance(5000); assert.equal(a.reads.length, 2); a.stop();
});

test('temporary network failure preserves data, retries, and clears the error on recovery', async () => {
  const a = app(); await a.render(); await a.advance(0); const saved = [account(1)]; await a.reply(0, saved);
  await a.advance(5000); a.reads[1].reject(new Error('Offline')); a.stats[1].reject(new Error('Offline')); await flush();
  const failed = await a.render(); assert.equal(failed.users, saved); assert.match(failed.refreshError, /retrying automatically/);
  await a.advance(5000); const recovered = await a.reply(2, [account(2)]);
  assert.equal(recovered.refreshError, null); assert.equal(recovered.users[0].id, 2); a.stop();
});

test('a pending-count failure does not discard a successful account response', async () => {
  const a = app(); await a.render(); await a.advance(0);
  a.reads[0].resolve([account(2)]); a.stats[0].reject(new Error('Unavailable')); await flush();
  assert.equal((await a.render()).users[0].id, 2); assert.deepEqual(a.pending, []); a.stop();
});

test('expired polling sessions invoke the existing auth handler and stop polling', async () => {
  const a = app(); await a.render(); await a.advance(0);
  const expired = new UnauthorizedError('Session expired'); a.reads[0].reject(expired);
  a.stats[0].resolve({ totals: { pending: 0 } }); await flush();
  assert.equal(a.errors[0], expired); await a.advance(60_000); assert.equal(a.reads.length, 1); a.stop();
});

test('approval blocks duplicate submissions and reports success only after confirmation', async () => {
  const a = app(); await a.render(); await a.advance(0); const user = account(1); const rows = [user]; await a.reply(0, rows);
  const view = await a.render(); const action = view.decide(user, 'approved'); await view.decide(user, 'approved');
  assert.equal(a.actions.length, 1); assert.equal((await a.render()).busy, true); assert.equal((await a.render()).message, null);
  await a.advance(15_000); assert.equal(a.reads.length, 1, 'polling pauses during writes');
  a.actions[0].resolve({ ...user, approval_status: 'approved' }); await action;
  const confirmed = await a.render(); assert.equal(confirmed.busy, false); assert.equal(confirmed.message.success, true);
  assert.equal(a.reads.length, 2, 'immediate refresh uses current pending filter');
  assert.equal((await a.reply(1, [])).users.length, 0); a.stop();
});

for (const [status, expected] of [['pending', 'Account rejected.'], ['approved', 'Account access revoked.']]) {
  test(`${status === 'approved' ? 'revocation' : 'rejection'} refreshes after server confirmation`, async () => {
    const a = app(); await a.render(); await a.advance(0); const user = account(1, 'supplier', status); await a.reply(0, [user]);
    const action = (await a.render()).decide(user, 'rejected'); a.actions[0].resolve({ ...user, approval_status: 'rejected' }); await action;
    assert.equal((await a.render()).message.text, expected); assert.equal(a.reads.length, 2); a.stop();
  });
}

test('failed actions retain rows, show error feedback, and release the submission guard', async () => {
  const a = app(); await a.render(); await a.advance(0); const user = account(1); const rows = [user]; await a.reply(0, rows);
  const action = (await a.render()).decide(user, 'approved'); a.actions[0].reject(new Error('Update failed')); await action;
  const failed = await a.render(); assert.equal(failed.users, rows); assert.equal(failed.message.success, false); assert.equal(failed.busy, false);
  const retry = failed.decide(user, 'approved'); assert.equal(a.actions.length, 2); a.actions[1].resolve(user); await retry; a.stop();
});

test('changes made to filters during an action are used by its subsequent refresh', async () => {
  const a = app(); await a.render(); await a.advance(0); const user = account(1); await a.reply(0, [user]);
  const action = (await a.render()).decide(user, 'approved'); await a.filters({ status: 'approved', role: 'contractor', q: 'Account' }); await a.advance(250);
  assert.equal(a.reads.length, 1); a.actions[0].resolve(user); await action;
  assert.deepEqual(plain(a.reads[1].params), { status: 'approved', role: 'contractor', q: 'Account' }); a.stop();
});

test('an action cancels an older poll so stale status replies cannot replace the new list', async () => {
  const a = app(); await a.render(); await a.advance(0); const user = account(1); await a.reply(0, [user]); await a.advance(5000);
  const action = (await a.render()).decide(user, 'approved'); assert.equal(a.reads[1].signal.aborted, true);
  a.actions[0].resolve(user); await action; await a.reply(2, []); await a.reply(1, [user]);
  assert.equal((await a.render()).users.length, 0); a.stop();
});

test('an action settling after unmount cannot update state or restart polling', async () => {
  const a = app(); await a.render(); await a.advance(0); const user = account(1); await a.reply(0, [user]);
  const action = (await a.render()).decide(user, 'approved'); a.stop(); a.actions[0].resolve(user); await action;
  assert.equal(a.reads.length, 1); assert.equal(a.timers.size, 0);
});

test('an expired session during an action signs out without starting another refresh', async () => {
  const a = app(); await a.render(); await a.advance(0); const user = account(1); await a.reply(0, [user]);
  const action = (await a.render()).decide(user, 'approved'); const expired = new UnauthorizedError('Expired');
  a.actions[0].reject(expired); await action; assert.equal(a.errors[0], expired);
  await a.advance(30_000); assert.equal(a.reads.length, 1); a.stop();
});

test('the API client forwards cancellation and the selected filters without changing endpoints', async () => {
  const calls = [];
  const api = load('src/api.ts', {}, { fetch: async (url, options) => { calls.push({ url, options }); return { ok: true, status: 200, json: async () => [] }; } });
  const controller = new AbortController();
  await api.fetchUsers({ status: 'approved', role: 'homeowner', q: 'name@example.test' }, controller.signal);
  await api.fetchStats(controller.signal);
  const qs = new URL(calls[0].url, 'http://localhost').searchParams;
  assert.equal(qs.get('status'), 'approved'); assert.equal(qs.get('role'), 'homeowner'); assert.equal(qs.get('q'), 'name@example.test');
  assert.equal(calls[0].options.signal, controller.signal); assert.equal(calls[1].options.signal, controller.signal);
  assert.equal(calls[1].url, '/api/admin/stats');
});

for (const status of [401, 403]) {
  test(`HTTP ${status} remains an UnauthorizedError for the session handler`, async () => {
    const api = load('src/api.ts', {}, { fetch: async () => ({ ok: false, status, json: async () => ({ error: 'Not authorized' }) }) });
    await assert.rejects(api.fetchUsers({}), api.UnauthorizedError);
  });
}

test('Accounts retains filter controls and disables both account actions during a submission', async () => {
  const hook = hooks(); let busy = false, selected;
  const jsx = (type, props, key) => ({ type, props, key });
  const { Accounts } = load('src/AdminApp.tsx', {
    react: hook.react, 'react/jsx-runtime': { jsx, jsxs: jsx }, './api': {},
    './useAccounts': { useAccounts(filters) { selected = filters; return { users: [account(1)], refreshError: null, message: null, busy, decide() {} }; } },
  }, {}, '\nexport { Accounts };');
  const nodes = (node, type) => !node || typeof node !== 'object' ? [] : Array.isArray(node) ? node.flatMap((n) => nodes(n, type)) : [...(node.type === type ? [node] : []), ...nodes(node.props?.children, type)];
  const render = () => hook.render(() => Accounts({ onError() {}, onPendingCount() {} }));
  let tree = await render();
  assert.deepEqual(nodes(tree, 'button').slice(0, 4).map((n) => n.props.children), ['Pending', 'Approved', 'Rejected', 'All']);
  nodes(tree, 'button')[1].props.onClick(); nodes(tree, 'select')[0].props.onChange({ target: { value: 'supplier' } });
  nodes(tree, 'input')[0].props.onChange({ target: { value: 'search' } });
  busy = true; tree = await render(); assert.deepEqual(plain(selected), { status: 'approved', role: 'supplier', q: 'search' });
  assert.ok(nodes(tree, 'button').slice(-2).every((n) => n.props.disabled));
  assert.equal(nodes(tree, 'table').length, 1); hook.unmount();
});
