const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const flush = () => new Promise((resolve) => setImmediate(resolve));
const plain = (value) => JSON.parse(JSON.stringify(value));
const jsx = (type, props, key) => ({ type, props, key });
const runtime = { jsx, jsxs: jsx };
const defaults = (value) => ({ __esModule: true, default: value });
const primitive = (names) => Object.fromEntries(names.map((n) => [n, n]));
const stockHelpers = load('src/utils/supplierStock.ts', {});
function deferred() { let resolve, reject; const promise = new Promise((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject }; }
function load(file, mocks) {
  const { outputText } = ts.transpileModule(fs.readFileSync(path.join(__dirname, '..', file), 'utf8'), {
    compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
  });
  const exports = {};
  vm.runInNewContext(outputText, { exports, Error, Map, Set, require(name) {
    if (name in mocks) return mocks[name];
    throw new Error(`Unexpected dependency: ${name}`);
  } }, { filename: file });
  return exports;
}
function hooks() {
  const slots = []; let cursor = 0, effects = [], dirty = false;
  const equal = (a, b) => a && b && a.length === b.length && a.every((v, i) => Object.is(v, b[i]));
  const react = {
    useState(initial) { const i = cursor++; if (!(i in slots)) slots[i] = typeof initial === 'function' ? initial() : initial;
      return [slots[i], (value) => { const next = typeof value === 'function' ? value(slots[i]) : value; if (!Object.is(next, slots[i])) { slots[i] = next; dirty = true; } }]; },
    useRef(value) { return slots[cursor++] ??= { current: value }; },
    useCallback(fn, deps) { const i = cursor++; if (!equal(slots[i]?.deps, deps)) slots[i] = { deps, fn }; return slots[i].fn; },
    useMemo(fn, deps) { const i = cursor++; if (!equal(slots[i]?.deps, deps)) slots[i] = { deps, value: fn() }; return slots[i].value; },
    useEffect(fn, deps) { const i = cursor++; if (!equal(slots[i]?.deps, deps)) effects.push(() => { slots[i]?.cleanup?.(); slots[i] = { deps, cleanup: fn() }; }); },
    createContext: () => ({ Provider: 'Provider' }),
  };
  return { react, async render(fn) {
    for (let i = 0; i < 20; i++) {
      cursor = 0; dirty = false; const tree = fn(); const pending = effects; effects = []; pending.forEach((e) => e()); await flush();
      if (!dirty) return tree;
    }
    throw new Error('Render failed to settle');
  } };
}
function nodes(node, type) {
  if (!node || typeof node !== 'object') return [];
  if (Array.isArray(node)) return node.flatMap((n) => nodes(n, type));
  if (node.type?.name === 'InventoryCard') return nodes(node.type(node.props), type);
  return [...(node.type === type || node.type?.name === type ? [node] : []), ...nodes(node.props?.children, type)];
}
const text = (node) => node == null ? '' : typeof node !== 'object' ? String(node) : Array.isArray(node) ? node.map(text).join('') : text(node.props?.children);
const product = (id, extra = {}) => ({ id, name: `Material ${id}`, category: 'Cement', description: '', unit: 'bag', price: 280,
  stock: 10, reserved: 0, availableQuantity: 10, minOrder: 1, isActive: false, stockStatus: 'in_stock', activationEligible: true, ...extra });
function inventory(initial) {
  const hook = hooks(); const calls = [], prompts = []; let wait = null, failure = null;
  let products = initial ?? [product(1), product(2, { isActive: true }), product(3, { stock: 0, availableQuantity: 0, stockStatus: 'out_of_stock', activationEligible: false, activationBlockReason: 'Restock before activation.' })];
  const api = {
    productsLoading: false, productsError: null, reloadProducts() {},
    async setAllProductsActive(active) {
      calls.push({ kind: 'bulk', active }); if (wait) await wait.promise; if (failure) throw failure;
      let updated = 0;
      products = products.map((p) => p.isActive === active || (active && !p.activationEligible) ? p : (updated++, { ...p, isActive: active }));
      return { total: products.length, updated, skipped: products.length - updated, failed: 0 };
    },
    async updateProduct(id, patch) {
      calls.push({ kind: 'single', id, patch: plain(patch) }); if (wait) await wait.promise; if (failure) throw failure;
      products = products.map((p) => p.id === id ? { ...p, ...patch } : p);
    },
    async confirmStock(reviewToken) {
      calls.push({ kind: 'confirm', reviewToken }); if (wait) await wait.promise; if (failure) throw failure;
      products = products.map((p) => ({ ...p, stockConfirmed: true, stockConfirmedAt: '2026-11-14T00:00:00Z',
        stockConfirmedQuantity: p.stock, stockConfirmedBy: 14, activationEligible: p.price > 0 && p.availableQuantity > 0,
        activationBlockReason: p.availableQuantity > 0 ? null : 'Restock before activation.' }));
      return { products, updated: products.length, skipped: 0, failed: 0 };
    },
  };
  const Pricing = load('src/screens/supplier/Pricing.tsx', {
    react: hook.react, 'react/jsx-runtime': runtime, 'react-native': primitive(['ActivityIndicator', 'Pressable', 'Text', 'View']),
    'expo-router': { useLocalSearchParams: () => ({}), router: {} }, '@expo/vector-icons': { Ionicons: 'Icon' },
    '@/components/ui': primitive(['Badge', 'Button', 'Card', 'ChipPicker', 'Field', 'PageHeader', 'Screen', 'SubmitButton']),
    '@/components/Sheet': defaults('Sheet'), '@/components/StockBadge': defaults('StockBadge'),
    '@/components/ConfirmDialog': { useConfirmDialog: () => ({ ask: (options) => prompts.push(options), dialog: jsx('ConfirmDialog', {}) }) },
    '@/utils/supplierStock': stockHelpers,
    '@/services/api/supplierProducts': { fetchStockConfirmationReview: async () => ({ review_token: 'signed-review', count: products.length,
      products: products.map((p) => ({ id: p.id, name: p.name, stock: p.stock, reserved: p.reserved, unit: p.unit, price: p.price, is_active: p.isActive })) }) },
    '@/context/SupplierContext': { useSupplier: () => ({ ...api, products }) },
    '@/context/ThemeContext': { useTheme: () => ({ chrome: { muted: '#eee', mutedForeground: '#555' } }) },
    '@/data/supplier': { CATEGORIES: ['Cement'], CAT_COLORS: { Cement: '#f59e0b' }, UNITS: ['bag'], MONO: '' },
    '@/utils/currency': { peso: (n) => `PHP ${n}` }, './InventoryStats': defaults('InventoryStats'),
  }).default;
  return { calls, prompts, api, render: () => hook.render(Pricing), wait(value) { wait = value; }, fail(error) { failure = error; },
    products: () => products, button: (tree, label) => nodes(tree, 'Pressable').find((n) => text(n) === label) };
}

test('bulk controls appear above Search and wait for explicit confirmation with accurate owner-wide counts', async () => {
  const a = inventory(); let tree = await a.render();
  const children = tree.props.children.flat(Infinity).filter(Boolean);
  assert.ok(children.findIndex((n) => n.type === 'View') < children.findIndex((n) => n.type === 'Field'));
  a.button(tree, 'Activate All').props.onPress();
  assert.equal(a.calls.length, 0); assert.equal(a.prompts[0].title, 'Activate All Materials?');
  assert.equal(a.prompts[0].detail, '1 eligible inactive materials');
  assert.match(a.prompts[0].message, /homeowners and PandAI/);
  // Dismissing the existing dialog never calls its onConfirm callback.
  tree = await a.render(); assert.equal(a.calls.length, 0);
  a.button(tree, 'Deactivate All').props.onPress(); assert.equal(a.prompts[1].detail, '1 active materials');
});

test('Activate All preserves search/category/stock filters and updates counts only after confirmation', async () => {
  const a = inventory(); let tree = await a.render();
  nodes(tree, 'Field')[0].props.onChangeText('Material 2'); nodes(tree, 'ChipPicker')[0].props.onChange('Cement');
  nodes(tree, 'ChipPicker')[1].props.onChange('In Stock'); tree = await a.render();
  a.button(tree, 'Activate All').props.onPress(); assert.equal(a.prompts[0].detail, '1 eligible inactive materials');
  a.prompts[0].onConfirm(); await flush(); tree = await a.render();
  assert.deepEqual(a.calls, [{ kind: 'bulk', active: true }]);
  assert.match(text(tree), /1 activated; 2 skipped; 0 failed/); assert.match(text(tree), /2 active \/ in stock/);
  assert.equal(nodes(tree, 'Field')[0].props.value, 'Material 2');
  assert.deepEqual(nodes(tree, 'ChipPicker').map((n) => n.props.value), ['Cement', 'In Stock']);
  assert.equal(a.products()[2].isActive, false);
});

test('Deactivate All and individual actions are distinct and preserve every other material', async () => {
  const a = inventory(); let tree = await a.render(); const before = plain(a.products());
  const inactiveCard = nodes(tree, 'Card').find((c) => nodes(c, 'Text').some((n) => text(n) === 'Material 1'));
  a.button(inactiveCard, 'Activate').props.onPress(); assert.equal(a.calls.length, 0); a.prompts[0].onConfirm();
  await flush(); tree = await a.render();
  assert.deepEqual(a.calls[0], { kind: 'single', id: 1, patch: { isActive: true } });
  assert.deepEqual(plain(a.products().slice(1)), before.slice(1));
  const activeCard = nodes(tree, 'Card').find((c) => nodes(c, 'Text').some((n) => text(n) === 'Material 1'));
  a.button(activeCard, 'Deactivate').props.onPress(); a.prompts[1].onConfirm(); await flush(); tree = await a.render();
  assert.deepEqual(a.calls[1], { kind: 'single', id: 1, patch: { isActive: false } });
  a.button(tree, 'Deactivate All').props.onPress(); a.prompts[2].onConfirm(); await flush();
  assert.deepEqual(a.calls[2], { kind: 'bulk', active: false }); assert.ok(a.products().every((p) => !p.isActive));
});

test('ineligible individual activation reports the backend eligibility reason without making a request', async () => {
  const a = inventory([product(1, { activationEligible: false, activationBlockReason: 'Availability is unconfirmed.' })]);
  let tree = await a.render(); a.button(tree, 'Activate').props.onPress(); tree = await a.render();
  assert.match(text(tree), /Availability is unconfirmed/); assert.equal(a.calls.length, 0); assert.equal(a.prompts.length, 0);
});

test('pending operations suppress double confirmations and disable bulk and individual actions', async () => {
  const a = inventory(); const wait = deferred(); a.wait(wait); let tree = await a.render();
  a.button(tree, 'Activate All').props.onPress(); const confirm = a.prompts[0].onConfirm;
  confirm(); confirm(); tree = await a.render(); assert.equal(a.calls.length, 1);
  assert.equal(a.button(tree, 'Activate All').props.disabled, true); assert.equal(a.button(tree, 'Deactivate All').props.disabled, true);
  assert.ok(nodes(tree, 'Pressable').filter((n) => ['Activate', 'Deactivate'].includes(text(n))).every((n) => n.props.disabled));
  assert.equal(a.products()[0].isActive, false, 'no optimistic success');
  wait.resolve(); await flush(); tree = await a.render(); assert.equal(a.button(tree, 'Activate All').props.disabled, false);
});

test('a failed operation shows an error, preserves records, and permits retry', async () => {
  const a = inventory(); const before = plain(a.products()); a.fail(new Error('Network unavailable')); let tree = await a.render();
  a.button(tree, 'Activate All').props.onPress(); a.prompts[0].onConfirm(); await flush(); tree = await a.render();
  assert.match(text(tree), /Network unavailable/); assert.equal(a.button(tree, 'Activate All').props.disabled, false);
  assert.deepEqual(plain(a.products()), before); a.fail(null);
  a.button(tree, 'Activate All').props.onPress(); a.prompts[1].onConfirm(); await flush(); assert.equal(a.products()[0].isActive, true);
});

test('empty and loading inventories disable bulk actions without adding a duplicate Add Material button', async () => {
  const a = inventory([]); let tree = await a.render();
  assert.equal(a.button(tree, 'Activate All').props.disabled, true); assert.equal(a.button(tree, 'Deactivate All').props.disabled, true);
  assert.equal(a.button(tree, '+ Add Material'), undefined);
  const loaded = inventory(); loaded.api.productsLoading = true; tree = await loaded.render();
  assert.equal(loaded.button(tree, 'Activate All').props.disabled, true);
});

test('active zero-stock cards retain the Out of Stock badge and prices, with a separate activation indicator', async () => {
  const p = product(1, { isActive: true, stock: 0, availableQuantity: 0, stockStatus: 'out_of_stock', activationEligible: false });
  const a = inventory([p]); const tree = await a.render();
  assert.equal(nodes(tree, 'StockBadge')[0].props.status, 'out_of_stock'); assert.match(nodes(tree, 'Text').map(text).join(' '), /PHP 280/);
  assert.equal(a.button(tree, 'Deactivate').props.children.props.children, 'Deactivate');
  const buttons = [a.button(tree, 'Activate All'), a.button(tree, 'Deactivate All')];
  assert.ok(buttons.every((b) => b.props.className.includes('flex-1') && b.props.className.includes('bg-primary')));
});

test('bulk API sends only the desired boolean to the authenticated-owner endpoint', async () => {
  const calls = [];
  const api = load('src/services/api/supplierProducts.ts', { '@/services/api/client': { apiFetch: async (url, options) => { calls.push({ url, options: plain(options) }); return { updated: 1 }; } } });
  await api.setAllSupplierProductsActive(true); await api.setAllSupplierProductsActive(false);
  assert.deepEqual(calls.map((c) => c.url), ['/api/supplier-products/activation', '/api/supplier-products/activation']);
  assert.deepEqual(calls.map((c) => JSON.parse(c.options.body)), [{ is_active: true }, { is_active: false }]);
  assert.ok(calls.every((c) => c.options.method === 'PATCH'));
});

test('unconfirmed placeholder stock is identified explicitly and never presented as available', async () => {
  const a = inventory([product(1, { isActive: true, activationEligible: false, description: 'Stock availability is unconfirmed.', activationBlockReason: 'Availability is unconfirmed.' })]);
  const tree = await a.render();
  assert.equal(nodes(tree, 'StockBadge').length, 0);
  assert.ok(nodes(tree, 'Badge').some((n) => n.props.label === 'Stock unconfirmed'));
  assert.ok(nodes(tree, 'Badge').some((n) => n.props.label === 'Unavailable'));
  assert.match(nodes(tree, 'Text').map(text).join(' '), /Unconfirmed quantity: 10 bag/);
  assert.match(text(tree), /0 active \/ in stock/);
});

test('inventory statistics preserve total records without counting unconfirmed placeholders as real stock', () => {
  const Stats = load('src/screens/supplier/InventoryStats.tsx', {
    'react/jsx-runtime': runtime, '@/components/ui': primitive(['StatGrid', 'StatTile']),
    '@/utils/supplierStock': stockHelpers,
    '@/components/StockBadge': { STOCK_COLORS: { in_stock: '#10b981', out_of_stock: '#ef4444' } },
  }).default;
  const tree = Stats({ products: [product(1), product(2, { stockStatus: 'out_of_stock', stock: 0, availableQuantity: 0 }), product(3, { description: 'Stock availability is unconfirmed.' })] });
  assert.deepEqual(nodes(tree, 'StatTile').map((n) => n.props.value), [3, 1, 1]);
});

test('stock review displays exact recorded names and quantities and Cancel performs no write', async () => {
  const a = inventory([product(1, { name: 'PVC pressure pipe 1/2 inch', description: 'Stock availability is unconfirmed.', activationEligible: false })]);
  let tree = await a.render(); a.button(tree, 'Confirm Stock for All').props.onPress(); await flush(); tree = await a.render();
  const sheet = nodes(tree, 'Sheet')[0]; assert.equal(sheet.props.title, 'Confirm Stock for All?');
  assert.match(text(sheet), /PVC pressure pipe 1\/2 inch/); assert.match(text(sheet), /Recorded quantity: 10 bag/);
  assert.match(text(sheet), /physically verified/); assert.match(text(sheet), /does not change quantities, prices, descriptions, or activation flags/);
  assert.equal(a.calls.length, 0); a.button(tree, 'Cancel').props.onPress(); tree = await a.render();
  assert.equal(nodes(tree, 'Sheet').length, 0); assert.equal(a.calls.length, 0);
});

test('explicit stock confirmation preserves descriptions and flags, then Activate All is a separate decision', async () => {
  const originalNote = 'Stock availability is unconfirmed. Preserve original CSV category.';
  const a = inventory([product(1, { description: originalNote, activationEligible: false })]); let tree = await a.render();
  a.button(tree, 'Confirm Stock for All').props.onPress(); await flush(); tree = await a.render();
  a.button(tree, 'I verified these quantities').props.onPress(); await flush(); tree = await a.render();
  assert.deepEqual(a.calls, [{ kind: 'confirm', reviewToken: 'signed-review' }]);
  assert.equal(a.products()[0].isActive, false); assert.equal(a.products()[0].stock, 10); assert.equal(a.products()[0].price, 280);
  assert.equal(a.products()[0].description, originalNote); assert.equal(a.products()[0].stockConfirmed, true);
  assert.match(nodes(tree, 'Text').map(text).join(' '), /Stock verified/);
  assert.equal(nodes(tree, 'Badge').some((b) => b.props.label === 'Stock unconfirmed'), false);
  a.button(tree, 'Activate All').props.onPress(); assert.equal(a.calls.length, 1);
  assert.equal(a.prompts[0].detail, '1 eligible inactive materials'); a.prompts[0].onConfirm(); await flush();
  assert.equal(a.products()[0].isActive, true);
});

test('pending stock confirmation blocks duplicates and server failures keep the review open for retry', async () => {
  const a = inventory([product(1, { stockConfirmed: false, activationEligible: false })]); let tree = await a.render();
  a.button(tree, 'Confirm Stock for All').props.onPress(); await flush(); tree = await a.render();
  const wait = deferred(); a.wait(wait); a.fail(new Error('Inventory changed since review. Review again.'));
  const confirm = a.button(tree, 'I verified these quantities').props.onPress; confirm(); confirm(); tree = await a.render();
  assert.equal(a.calls.length, 1); assert.equal(a.button(tree, 'Confirming…').props.disabled, true);
  wait.resolve(); await flush(); tree = await a.render();
  assert.match(text(nodes(tree, 'Sheet')[0]), /Inventory changed since review/); assert.equal(a.products()[0].stockConfirmed, false);
  a.fail(null); a.wait(null); a.button(tree, 'Refresh Review').props.onPress(); await flush(); tree = await a.render();
  a.button(tree, 'I verified these quantities').props.onPress(); await flush(); assert.equal(a.products()[0].stockConfirmed, true);
});

test('structured confirmation is authoritative even when historical import prose is retained or removed', () => {
  assert.equal(stockHelpers.isSupplierStockConfirmed({ description: 'Stock availability is unconfirmed.', stockConfirmed: true }), true);
  assert.equal(stockHelpers.isSupplierStockConfirmed({ description: 'No warning in this description', stockConfirmed: false }), false);
  assert.equal(stockHelpers.isSupplierStockConfirmed({ description: 'Stock availability is unconfirmed.' }), false);
});

test('confirmation API uses a read-only preview and sends only explicit assent plus its signed review', async () => {
  const calls = [];
  const api = load('src/services/api/supplierProducts.ts', { '@/services/api/client': { apiFetch: async (url, options) => { calls.push({ url, options }); return {}; } } });
  await api.fetchStockConfirmationReview(); await api.confirmSupplierStock('signed-review');
  assert.equal(calls[0].url, '/api/supplier-products/stock-confirmation'); assert.equal(calls[0].options, undefined);
  assert.equal(calls[1].options.method, 'PATCH');
  assert.deepEqual(JSON.parse(calls[1].options.body), { confirmed: true, review_token: 'signed-review' });
});

const dto = (id, active = false) => ({ id, supplier_id: 1, name: `Material ${id}`, category: 'Cement', description: '', unit: 'bag', price: 280,
  stock: 10, reserved: 0, available_quantity: 10, min_order: 1, is_active: active, stock_status: 'in_stock', activation_eligible: true, activation_block_reason: null });
function provider() {
  const hook = hooks(); const reads = [], mutations = [], writes = [], confirmations = []; let pending = deferred();
  const Provider = load('src/context/SupplierContext.tsx', {
    react: hook.react, 'react/jsx-runtime': runtime,
    '@/services/api/materialRequests': { fetchSupplierFulfillments: async () => [] },
    '@/services/api/supplierProducts': {
      fetchMySupplierProducts: () => { const d = deferred(); reads.push(d); return d.promise; },
      setAllSupplierProductsActive: (active) => { mutations.push(active); return pending.promise; },
      confirmSupplierStock: (token) => { confirmations.push(token); return pending.promise; },
      updateSupplierProduct: async (id, patch) => { writes.push({ id, patch: plain(patch) }); return dto(id, patch.is_active); },
      createSupplierProduct: async () => dto(4), deleteSupplierProduct: async () => {},
    },
  }).SupplierProvider;
  return { reads, mutations, writes, confirmations, result: () => pending, reset() { pending = deferred(); },
    render: async () => (await hook.render(() => Provider({ children: null }))).props.value };
}

test('provider waits for server confirmation and reconciles all rows without changing their visible order', async () => {
  const a = provider(); await a.render(); a.reads[0].resolve([dto(2), dto(1)]); await flush(); let state = await a.render();
  const action = state.setAllProductsActive(true); state = await a.render(); assert.equal(state.products[0].isActive, false);
  a.result().resolve({ updated: 2, skipped: 0, failed: 0, products: [dto(1, true), dto(2, true)] }); await action;
  state = await a.render(); assert.deepEqual(plain(state.products.map((p) => p.id)), [2, 1]);
  assert.ok(state.products.every((p) => p.isActive)); assert.equal(state.products[0].activationEligible, true);
});

test('provider rejects duplicate/conflicting writes and ignores GET replies started before or during the operation', async () => {
  const a = provider(); await a.render(); a.reads[0].resolve([dto(1)]); await flush(); let state = await a.render();
  const action = state.setAllProductsActive(true);
  await assert.rejects(state.setAllProductsActive(false), /already running/);
  await assert.rejects(state.updateProduct(1, { isActive: false }), /already running/);
  state.reloadProducts(); assert.equal(a.reads.length, 2);
  a.result().resolve({ products: [dto(1, true)], updated: 1, skipped: 0, failed: 0 }); await action;
  a.reads[1].resolve([dto(1, false)]); await flush(); state = await a.render();
  assert.equal(state.products[0].isActive, true); assert.deepEqual(a.mutations, [true]); assert.equal(a.writes.length, 0);
});

test('provider failed bulk request preserves the last successful list and releases the guard', async () => {
  const a = provider(); await a.render(); a.reads[0].resolve([dto(1)]); await flush(); let state = await a.render();
  const action = state.setAllProductsActive(true); const rejected = assert.rejects(action, /Offline/); a.result().reject(new Error('Offline')); await rejected;
  state = await a.render(); assert.equal(state.products[0].isActive, false);
  await state.updateProduct(1, { isActive: true }); state = await a.render();
  assert.equal(state.products[0].isActive, true); assert.deepEqual(a.writes, [{ id: 1, patch: { is_active: true } }]);
});

test('provider applies confirmed audit metadata only after success while preserving activation and stock', async () => {
  const a = provider(); await a.render(); a.reads[0].resolve([{ ...dto(1), description: 'Stock availability is unconfirmed.', stock_confirmed: false }]);
  await flush(); let state = await a.render(); const action = state.confirmStock('signed-review');
  await assert.rejects(state.setAllProductsActive(true), /already running/);
  state = await a.render(); assert.equal(state.products[0].stockConfirmed, false);
  a.result().resolve({ products: [{ ...dto(1), description: 'Stock availability is unconfirmed.', stock_confirmed: true,
    stock_confirmed_at: '2026-11-14T00:00:00Z', stock_confirmed_by: 14, stock_confirmed_quantity: 10 }], updated: 1, skipped: 0, failed: 0 });
  await action; state = await a.render(); assert.equal(state.products[0].stockConfirmed, true);
  assert.equal(state.products[0].isActive, false); assert.equal(state.products[0].stock, 10);
  assert.equal(state.products[0].description, 'Stock availability is unconfirmed.');
  assert.deepEqual(a.confirmations, ['signed-review']);
});
