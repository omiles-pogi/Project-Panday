const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
function load(file, mocks = {}) {
  const filename = path.join(__dirname, '..', file);
  const { outputText } = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
  });
  const exports = {};
  vm.runInNewContext(outputText, { exports, Error, require(name) { if (name in mocks) return mocks[name]; throw new Error(`Unexpected dependency ${name}`); } }, { filename });
  return exports;
}
const jsx = (type, props) => ({ type, props });
const runtime = { jsx, jsxs: jsx };
const defaults = (value) => ({ __esModule: true, default: value });
const primitives = (names) => Object.fromEntries(names.map((name) => [name, name]));
const utils = load('src/utils/supplierHistory.ts');
const colors = load('src/theme/colors.ts');
const tick = () => new Promise((resolve) => setImmediate(resolve));
function nodes(node, type) {
  if (!node || typeof node !== 'object') return [];
  if (Array.isArray(node)) return node.flatMap((value) => nodes(value, type));
  return [...(node.type === type || node.type?.name === type ? [node] : []), ...nodes(node.props?.children, type)];
}
function text(node) {
  if (node == null || typeof node === 'boolean') return '';
  if (Array.isArray(node)) return node.map(text).join(' ');
  return typeof node === 'object' ? text(node.props?.children) : String(node);
}
const project = { id: 7, title: 'Recorded house', homeownerName: 'Recorded owner', lastReceivedAt: '2026-11-11T02:00:00Z',
  receiptCount: 2, lineCount: 2, totalAmount: 4300, knownSubtotal: 4300, missingPriceCount: 0 };
const details = { ...project, projectType: '2-storey house', location: 'Dagupan', description: 'Private construction description', items: [
  { id: 1, fulfillmentId: 10, materialRequestId: 20, receivedAt: project.lastReceivedAt, name: 'Recorded cement', quantity: 10, unit: 'bag', unitPrice: 280, lineTotal: 2800 },
  { id: 2, fulfillmentId: 11, materialRequestId: 21, receivedAt: '2026-11-10T02:00:00Z', name: 'Recorded cement', quantity: 5, unit: 'bag', unitPrice: 300, lineTotal: 1500 },
] };

test('supplier History API is GET-only, rejects invalid IDs before requests and sanitizes backend errors', async () => {
  const calls = []; let fail = false;
  const api = load('src/services/api/supplierHistory.ts', { '@/services/api/client': { apiFetch: async (...args) => {
    calls.push(args); if (fail) throw new Error('SQLSTATE private credential'); return [];
  } } });
  await api.fetchSupplierHistory(); await api.fetchSupplierHistoryDetails(7);
  assert.deepEqual(calls, [['/api/supplier-history'], ['/api/supplier-history/7']]);
  for (const id of [0, -1, NaN, 1.5]) await assert.rejects(api.fetchSupplierHistoryDetails(id), /invalid/);
  assert.equal(calls.length, 2); fail = true;
  await assert.rejects(api.fetchSupplierHistory(), (error) => /Couldn't load supply history/.test(error.message) && !/SQLSTATE|credential/.test(error.message));
});

test('receipt grouping uses device-local calendar days and does not invent dates or prices', () => {
  const today = new Date(2026, 0, 1, 12);
  const projects = [
    { ...project, id: 1, lastReceivedAt: new Date(2026, 0, 1, 1).toISOString() },
    { ...project, id: 2, lastReceivedAt: new Date(2025, 11, 31, 23).toISOString() },
    { ...project, id: 3, lastReceivedAt: new Date(2025, 11, 20, 12).toISOString() },
    { ...project, id: 4, lastReceivedAt: null },
  ];
  const groups = utils.supplyHistorySections(projects, today);
  assert.equal(groups[0].title, 'Today'); assert.equal(groups[1].title, 'Yesterday');
  assert.match(groups[2].title, /2025/); assert.equal(groups[3].title, 'Date not recorded');
  assert.deepEqual([...groups].map((group) => [...group.data].map((row) => row.id)), [[1], [2], [3], [4]]);
  assert.equal(utils.supplyMoney(null), 'Not recorded'); assert.match(utils.supplyMoney(0), /0\.00/);
  assert.match(utils.supplyMoney(4300), /4,300\.00/); assert.equal(utils.supplyDate('invalid'), 'Date not recorded');
});

function screen(file, data) {
  const slots = []; let cursor = 0; let mode = 'light'; let refreshed = 0; let loader;
  const pushes = [];
  const resource = { data, loading: false, error: null, refresh: async () => { refreshed++; } };
  const Screen = load(file, {
    react: { useState(initial) { const i = cursor++; if (!(i in slots)) slots[i] = initial;
      return [slots[i], (value) => { slots[i] = value; }]; }, useCallback: (fn) => fn },
    'react/jsx-runtime': runtime,
    'react-native': primitives(['ActivityIndicator', 'FlatList', 'SectionList', 'Pressable', 'RefreshControl', 'ScrollView', 'Text', 'View']),
    'expo-router': { router: { push: (route) => pushes.push(route) }, Stack: { Screen: 'StackScreen' }, useLocalSearchParams: () => ({ id: '7' }) },
    '@expo/vector-icons': { Ionicons: 'Icon' },
    '@/components/supplierHistory/SupplierHistoryUI': { ...primitives(['SupplierHistoryHeader', 'SupplierProjectSummary', 'SupplyCard', 'SupplyHistoryFeedback', 'SupplyRow']),
      styles: { action: {} }, useSupplierHistorySpacing: () => ({ paddingBottom: 40, maxWidth: 880 }) },
    '@/context/ThemeContext': { useTheme: () => ({ chrome: mode === 'light' ? colors.lightChrome : colors.darkChrome }) },
    '@/hooks/useFocusedResource': { useFocusedResource: (load) => { loader = load; return resource; } },
    '@/services/api/supplierHistory': { fetchSupplierHistory: async () => data, fetchSupplierHistoryDetails: async (id) => ({ id }) },
    '@/utils/supplierHistory': utils,
  }).default;
  return { resource, pushes, mode: (next) => { mode = next; }, render() { cursor = 0; return Screen(); }, refreshed: () => refreshed, load: () => loader() };
}

test('supplier list supports true empty/loading/retry states and opens the actual project without filters', async () => {
  const app = screen('src/screens/supplier/History.tsx', []);
  for (const mode of ['light', 'dark']) {
    app.mode(mode); let tree = app.render();
    assert.equal(tree.type, 'SectionList'); assert.equal(tree.props.ListEmptyComponent.props.title, 'No project history yet');
    assert.equal(tree.props.ListEmptyComponent.props.message, 'Homeowner projects that receive materials from your shop will appear here.');
    assert.equal(nodes(tree.props.ListHeaderComponent, 'TextInput').length, 0);
    assert.doesNotMatch(text(tree.props.ListHeaderComponent), /Pending|Active|Completed|All filter|Description/);
    app.resource.loading = true; tree = app.render(); assert.equal(tree.props.ListEmptyComponent.type, 'ActivityIndicator');
    app.resource.loading = false; app.resource.error = 'Offline'; tree = app.render();
    nodes(tree.props.ListHeaderComponent, 'SupplyHistoryFeedback')[0].props.retry(); await tick(); app.resource.error = null;
  }
  assert.equal(app.refreshed(), 2); app.resource.data = [project];
  const list = app.render(); assert.equal(list.props.sections[0].data[0].id, 7);
  list.props.renderItem({ item: project }).props.onPress(); assert.equal(app.pushes[0], '/supplier/history/7');
  list.props.refreshControl.props.onRefresh(); await tick(); assert.equal(app.refreshed(), 3);
});

test('project details omit construction descriptions and preserve the supplied-items destination and counting rule', async () => {
  const app = screen('src/screens/supplier/HistoryDetails.tsx', details);
  for (const mode of ['light', 'dark']) {
    app.mode(mode); const tree = app.render();
    const rows = nodes(tree, 'SupplyRow');
    assert.equal(rows.find((row) => row.props.label === 'Project Type').props.value, '2-storey house');
    assert.equal(rows.find((row) => row.props.label === 'Location').props.value, 'Dagupan');
    assert.equal(rows.find((row) => row.props.label === 'Supplied line items').props.value, '2');
    assert.doesNotMatch(text(tree), /Description|Private construction/);
    assert.match(text(tree), /Each line on each receipt counts once/);
    nodes(tree, 'Pressable')[0].props.onPress();
  }
  assert.deepEqual(app.pushes, ['/supplier/history/7/items', '/supplier/history/7/items']);
  assert.equal((await app.load()).id, 7);
});

test('supplied lines preserve repeated materials and distinct historical prices, and unknown totals remain unknown', () => {
  const app = screen('src/screens/supplier/SuppliesProvided.tsx', details);
  let tree = app.render(); let list = nodes(tree, 'FlatList')[0];
  assert.equal(list.props.data.length, 2);
  assert.equal(nodes(tree, 'StackScreen')[0].props.options.header().props.subtitle, 'Recorded house');
  const first = list.props.renderItem({ item: details.items[0] }); const second = list.props.renderItem({ item: details.items[1] });
  assert.equal(nodes(first, 'SupplyRow').find((row) => row.props.label === 'Quantity').props.value, '10 bag');
  assert.match(nodes(first, 'SupplyRow').find((row) => row.props.label === 'Recorded unit price').props.value, /280\.00/);
  assert.match(nodes(second, 'SupplyRow').find((row) => row.props.label === 'Recorded unit price').props.value, /300\.00/);
  assert.match(nodes(list.props.ListFooterComponent, 'SupplyRow')[0].props.value, /4,300\.00/);
  app.resource.data = { ...details, totalAmount: null, knownSubtotal: 2800, missingPriceCount: 1 };
  tree = app.render(); list = nodes(tree, 'FlatList')[0];
  assert.equal(nodes(list.props.ListFooterComponent, 'SupplyRow')[0].props.value, 'Not recorded');
  assert.match(text(list.props.ListFooterComponent), /No estimated or current inventory price is substituted/);
  assert.equal(nodes(first, 'Pressable').length, 0);
});

test('only supplier accounts can enter all three History routes and existing supplier navigation stays intact', () => {
  let role = 'supplier';
  const Stack = { Screen: 'StackScreen' };
  const Layout = load('src/app/(app)/supplier/history/_layout.tsx', {
    'react/jsx-runtime': runtime, 'expo-router': { Stack, Redirect: 'Redirect' },
    '@/context/AuthContext': { useAuth: () => ({ user: { role } }) },
    '@/context/ThemeContext': { useTheme: () => ({ chrome: colors.lightChrome }) },
    '@/components/supplierHistory/SupplierHistoryUI': { SupplierHistoryHeader: 'HistoryHeader' },
  }).default;
  assert.equal(Layout().type, Stack); assert.equal(nodes(Layout(), 'StackScreen').length, 3);
  for (role of ['homeowner', 'contractor', 'worker', 'admin', 'superadmin']) assert.equal(Layout().props.href, '/');
  const Supplier = load('src/app/(app)/supplier/_layout.tsx', {
    'react/jsx-runtime': runtime, '@/components/RoleDrawer': defaults('RoleDrawer'), '@/context/SupplierContext': { SupplierProvider: 'SupplierProvider' },
    '@/components/SupplierFloatingTabBar': defaults('SupplierFloatingTabBar'),
  }).default;
  const drawer = nodes(Supplier(), 'RoleDrawer')[0];
  assert.deepEqual([...drawer.props.items].map((item) => item.label), ['Dashboard', 'Inventory', 'Material Fulfillment', 'History', 'Profile']);
  assert.equal(drawer.props.items.find((item) => item.label === 'History').matchChildren, true);
  assert.equal(drawer.props.pages.find((page) => page.name === 'history').headerShown, false);
});

test('supplier summaries adapt to narrow screens and the shared header uses existing back navigation', () => {
  let width = 390; let back = false; const navigation = [];
  const ui = load('src/components/supplierHistory/SupplierHistoryUI.tsx', {
    'react/jsx-runtime': runtime, 'react-native': { ...primitives(['Pressable', 'Text', 'View']), StyleSheet: { create: (styles) => styles }, useWindowDimensions: () => ({ width, fontScale: 1 }) },
    'expo-router': { router: { canGoBack: () => back, back: () => navigation.push('back'), replace: (route) => navigation.push(route) } },
    '@expo/vector-icons': { Ionicons: 'Icon' }, 'react-native-safe-area-context': { useSafeAreaInsets: () => ({ bottom: 36, left: 4, right: 8 }) },
    '@/components/HomeownerHeader': defaults('Header'), '@/context/ThemeContext': { useTheme: () => ({ chrome: colors.lightChrome }) },
    '@/components/ui': { MAX_CONTENT_WIDTH: 880 }, '@/utils/supplierHistory': utils,
  });
  const row = ui.SupplierProjectSummary({ project }); assert.equal(row.props.children.props.style.flexDirection, 'row');
  width = 320; assert.equal(ui.SupplierProjectSummary({ project }).props.children.props.style.flexDirection, 'column');
  assert.equal(ui.useSupplierHistorySpacing().paddingBottom, 52);
  const header = ui.SupplierHistoryHeader({ title: 'Supplies Provided', backTo: '/supplier/history/7' });
  header.props.left.props.onPress(); back = true; header.props.left.props.onPress();
  assert.deepEqual(navigation, ['/supplier/history/7', 'back']);
});
