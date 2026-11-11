// Run with: node --test tests/project-history.test.cjs
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

function load(file, mocks = {}) {
  const filename = path.join(__dirname, '..', file);
  const { outputText } = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
  });
  const exports = {};
  vm.runInNewContext(outputText, { exports, require(name) {
    if (name in mocks) return mocks[name];
    throw new Error(`Unexpected dependency: ${name}`);
  } }, { filename });
  return exports;
}
const jsx = (type, props) => ({ type, props });
const runtime = { jsx, jsxs: jsx };
const history = load('src/utils/history.ts');
const colors = load('src/theme/colors.ts');
const primitive = (names) => Object.fromEntries(names.map((name) => [name, name]));
function nodes(node, type) {
  if (!node || typeof node !== 'object') return [];
  if (Array.isArray(node)) return node.flatMap((item) => nodes(item, type));
  if (typeof node.type === 'function') return nodes(node.type(node.props), type);
  return [...(node.type === type ? [node] : []), ...nodes(node.props?.children, type)];
}
const text = (node) => {
  if (node == null || typeof node === 'boolean') return '';
  if (Array.isArray(node)) return node.map(text).filter(Boolean).join(' ').replace(/\s+/g, ' ').trim();
  if (typeof node !== 'object') return String(node).trim();
  if (typeof node.type === 'function') return text(node.type(node.props));
  return text(node.props?.children);
};
const fixtures = [
  { id: 3, title: 'North Residence', status: 'completed', floors: 2, areaSqm: 200, designStyle: 'Modern', startedAt: '2026-01-01', completedAt: '2026-06-10T10:00:00Z' },
  { id: 2, title: 'South House', status: 'completed', floors: null, areaSqm: null, designStyle: null, startedAt: '2024-01-01', completedAt: '2025-05-10T10:00:00Z' },
  { id: 1, title: '', status: 'completed', floors: null, areaSqm: null, designStyle: null, startedAt: null, completedAt: null },
];

test('History uses recorded Philippines dates and preserves unknown legacy metadata', () => {
  assert.match(history.historyDate('2025-12-31T18:00:00Z'), /Jan 1, 2026/);
  assert.match(history.historyDate('2026-01-01'), /Jan 1, 2026/);
  assert.equal(history.historyDate(null), 'Not recorded');
  assert.equal(history.historyDate('invalid'), 'Not recorded');
  assert.equal(history.historyProjectType(null), null);
  assert.equal(history.historyProjectType(2), '2-storey house');
  assert.equal(history.historyTitle({ id: 8, title: ' ' }), 'Project #8');
});

test('history API uses only GET reads, rejects invalid links, and sanitizes backend failures', async () => {
  const calls = [];
  let fail = false;
  const api = load('src/services/api/history.ts', { '@/services/api/client': { apiFetch: async (...args) => {
    calls.push(args);
    if (fail) throw new Error('SQLSTATE password=private-value');
    return fixtures;
  } } });
  await api.fetchProjectHistory();
  await api.fetchProjectHistoryDetails(3);
  assert.deepEqual(calls, [['/api/project-history'], ['/api/project-history/3']]);
  await assert.rejects(api.fetchProjectHistoryDetails(0), /invalid/);
  await assert.rejects(api.fetchProjectHistoryDetails(NaN), /invalid/);
  assert.equal(calls.length, 2);
  fail = true;
  await assert.rejects(api.fetchProjectHistory(), (error) => /Couldn't load project history/.test(error.message) && !/SQLSTATE|password/.test(error.message));
});

function screenHarness(file, data) {
  const slots = []; let cursor = 0; let refreshes = 0; let lastLoad;
  const resource = { data, loading: false, error: null, refresh: async () => { refreshes++; } };
  let mode = 'light'; let dimensions = { width: 390, fontScale: 1 }; const navigations = [];
  const mocks = {
    react: { useState: (initial) => { const i = cursor++; if (!(i in slots)) slots[i] = initial; return [slots[i], (next) => { slots[i] = next; }]; }, useCallback: (fn) => fn },
    'react/jsx-runtime': runtime,
    'react-native': { ...primitive(['ActivityIndicator', 'FlatList', 'Image', 'Pressable', 'RefreshControl', 'ScrollView', 'Text', 'TextInput', 'View']),
      StyleSheet: { create: (styles) => styles }, useWindowDimensions: () => dimensions },
    'expo-linear-gradient': { LinearGradient: 'Gradient' }, '../../../assets/home-hero-house.png': 1,
    'expo-router': { router: { push: (value) => navigations.push(value) }, useLocalSearchParams: () => ({ id: '3' }) },
    '@expo/vector-icons': { Ionicons: 'Icon' },
    'react-native-safe-area-context': { useSafeAreaInsets: () => ({ top: 24, bottom: 24, left: 0, right: 0 }) },
    '@/components/ui': { ...primitive(['Badge', 'Card', 'PageHeader']), MAX_CONTENT_WIDTH: 880 },
    '@/components/history/HistoryUI': primitive(['HistoryFeedback', 'HistoryRow']),
    '@/context/ThemeContext': { useTheme: () => ({ mode, chrome: mode === 'light' ? colors.lightChrome : colors.darkChrome }) },
    '@/hooks/useFocusedResource': { useFocusedResource: (fn) => { lastLoad = fn; return resource; } },
    '@/services/api/history': { fetchProjectHistory: async () => data, fetchProjectHistoryDetails: async (id) => ({ id }) },
    '@/utils/history': history,
    '@/utils/currency': { peso: (value) => `PHP ${value}` },
    '@/utils/timeline': { timelineLabel: (value, unit) => `${value} ${unit}` },
  };
  const Screen = load(file, mocks).default;
  return { resource, navigations, theme: (next) => { mode = next; }, dimensions: (next) => { dimensions = next; },
    render: () => { cursor = 0; return Screen(); }, refreshes: () => refreshes, load: () => lastLoad() };
}

test('History renders its banner, true empty state, loading and retry without search, filters or tab-bar padding', async () => {
  const harness = screenHarness('src/screens/homeowner/History.tsx', null);
  for (const mode of ['light', 'dark']) {
    harness.theme(mode); harness.resource.loading = true;
    let list = harness.render();
    assert.equal(list.type, 'FlatList');
    assert.equal(nodes(list.props.ListEmptyComponent, 'ActivityIndicator').length, 1);
    assert.equal(list.props.contentContainerStyle.paddingBottom, 40);
    assert.equal(list.props.contentContainerStyle.width, '100%');
    assert.equal(list.props.contentContainerStyle.maxWidth, 880);
    harness.resource.loading = false; harness.resource.data = [];
    list = harness.render();
    assert.equal(list.props.ListEmptyComponent.props.title, 'No completed projects yet');
    assert.equal(list.props.ListEmptyComponent.props.message, 'Your completed construction projects will appear here.');
    assert.match(text(list.props.ListHeaderComponent), /A record of all your finished construction projects/);
    assert.equal(nodes(list.props.ListHeaderComponent, 'ScrollView').length, 0);
    assert.equal(nodes(list.props.ListHeaderComponent, 'TextInput').length, 0);
    assert.equal(nodes(list.props.ListHeaderComponent, 'Pressable').length, 0);
    assert.doesNotMatch(text(list.props.ListHeaderComponent), /Total Completed|Estimated Budget|All years|Completion year|Search/);
    harness.resource.error = 'Connection unavailable';
    list = harness.render();
    const feedback = nodes(list.props.ListHeaderComponent, 'HistoryFeedback')[0];
    assert.equal(feedback.props.title, 'History unavailable');
    feedback.props.retry();
    await new Promise((resolve) => setImmediate(resolve));
    harness.resource.error = null;
  }
  assert.equal(harness.refreshes(), 2);
});

test('all officially completed cards retain server order, real metadata, details navigation and refresh', async () => {
  const harness = screenHarness('src/screens/homeowner/History.tsx', [...fixtures, { ...fixtures[0], id: 9, status: 'active' }]);
  const list = harness.render();
  assert.deepEqual([...list.props.data].map((row) => row.id), [3, 2, 1]);
  const card = list.props.renderItem({ item: list.props.data[0] });
  const button = nodes(card, 'Pressable')[0];
  assert.match(text(button), /North Residence/);
  assert.match(text(button), /200 sqm/);
  assert.match(text(button), /2-storey house/);
  assert.match(text(button), /Jun 10, 2026/);
  assert.match(text(button), /Completed/);
  assert.equal(nodes(button, 'Image').length, 0);
  button.props.onPress();
  assert.equal(harness.navigations[0].pathname, '/homeowner/history/[id]');
  assert.equal(harness.navigations[0].params.id, '3');
  const legacy = list.props.renderItem({ item: fixtures[2] });
  assert.match(text(legacy), /Project #1/);
  assert.match(text(legacy), /Not recorded/);
  assert.doesNotMatch(text(legacy), /null sqm|undefined|Invalid Date/);
  list.props.refreshControl.props.onRefresh();
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(harness.refreshes(), 1);
});

test('History cards and banner stack on small screens and large font scales in both themes', () => {
  const harness = screenHarness('src/screens/homeowner/History.tsx', fixtures);
  for (const mode of ['light', 'dark']) for (const dimensions of [{ width: 320, fontScale: 1 }, { width: 430, fontScale: 1.8 }]) {
    harness.theme(mode); harness.dimensions(dimensions);
    const list = harness.render();
    const card = list.props.renderItem({ item: fixtures[0] });
    const press = nodes(card, 'Pressable')[0];
    assert.equal(press.props.children.props.style.flexDirection, 'column');
    assert.equal(nodes(list.props.ListHeaderComponent, 'Image')[0].props.style.width, '100%');
    assert.equal(press.props.style[2].backgroundColor, mode === 'light' ? colors.lightChrome.card : colors.darkChrome.card);
  }
});

test('details show recorded costs, unknown payments, and phases without editing controls', async () => {
  const data = { ...fixtures[0], plannedEndAt: '2026-06-30', project: {
    location: 'Dagupan', budget: 900000, planEstimate: 850000, totalEstimate: 850000, timelineValue: 6, timelineUnit: 'months',
    completion: { submittedAt: '2026-06-10', submittedBy: 'Recorded contractor' },
    approvedPlan: { exteriorConcept: 'Saved exterior' },
    budgetRecords: { confirmedMaterialTotal: 2800, agreedWageTotal: 5000, automaticWageTotal: 0, paidTotal: null,
      fulfillmentLines: [{ id: 7, material: 'Historical cement', supplierName: 'Saved supplier', qty: 10, unit: 'bag', unitPrice: 280, total: 2800, priceConfirmed: true, status: 'received' }] },
    workers: [{ id: 4, name: 'Recorded worker', trade: 'Carpenter' }], contractors: [],
    phases: [{ id: 5, name: 'Construction', tasks: [{ id: 6, description: 'Final inspection', isDone: true }] }],
  } };
  const harness = screenHarness('src/screens/homeowner/HistoryDetails.tsx', data);
  for (const mode of ['light', 'dark']) {
    harness.theme(mode);
    const screen = harness.render();
    assert.equal(screen.type, 'ScrollView');
    assert.equal(nodes(screen, 'TextInput').length, 0);
    assert.equal(nodes(screen, 'Pressable').length, 0);
    const rows = nodes(screen, 'HistoryRow');
    assert.equal(rows.find((node) => node.props.label === 'Recorded payments').props.value, 'Not recorded');
    assert.equal(rows.find((node) => node.props.label === 'Supplier-confirmed material commitments').props.value, 'PHP 2800');
    assert.match(text(screen), /Historical cement/);
    assert.match(text(screen), /Final inspection/);
    assert.equal((await harness.load()).id, 3);
  }
  harness.resource.data = null; harness.resource.error = 'Unavailable';
  assert.equal(nodes(harness.render(), 'HistoryFeedback')[0].props.title, 'Project history unavailable');
});

test('homeowner History menu opens the section and stays highlighted on nested details', () => {
  let role = 'homeowner';
  const Drawer = load('src/components/HomeownerDrawerContent.tsx', {
    'react/jsx-runtime': runtime, '@/components/RoleDrawerContent': { default: 'RoleDrawer' },
    '@/context/AuthContext': { useAuth: () => ({ user: { role } }) },
  }).default;
  const items = Drawer({}).props.items;
  const item = items.find((entry) => entry.label === 'History');
  assert.equal(item.href, '/homeowner/history');
  assert.equal(item.icon, 'time-outline');
  assert.equal(item.matchChildren, true);
  let current = '/homeowner/history/3'; let pushed; let closed = 0;
  const Content = load('src/components/RoleDrawerContent.tsx', {
    'react/jsx-runtime': runtime, 'react-native': primitive(['Text', 'View', 'Pressable', 'ScrollView']),
    'react-native-safe-area-context': { useSafeAreaInsets: () => ({ top: 24 }) },
    'expo-router': { usePathname: () => current, router: { push: (route) => { pushed = route; } } },
    '@expo/vector-icons': { Ionicons: 'Icon' },
    '@/components/AdminSwitch': { default: 'AdminSwitch' }, '@/components/TourButton': { default: 'TourButton' }, '@/components/Logo': { default: 'Logo' },
    '@/context/AuthContext': { useAuth: () => ({ user: { name: 'Test owner' }, logout: () => {} }) },
    '@/context/ChatContext': { useChat: () => ({ unreadCount: 0 }) },
    '@/context/ThemeContext': { useTheme: () => ({ chrome: colors.lightChrome }) }, '@/theme/colors': colors,
  }).default;
  const render = () => Content({ role: 'homeowner', items, navigation: { closeDrawer: () => { closed++; } } });
  const historyButton = nodes(render(), 'Pressable').find((node) => text(node) === 'History');
  assert.ok(historyButton.props.style);
  historyButton.props.onPress();
  assert.equal(pushed, '/homeowner/history'); assert.equal(closed, 1);
  current = '/homeowner/history-other';
  assert.equal(nodes(render(), 'Pressable').find((node) => text(node) === 'History').props.style, undefined);
  role = 'supplier';
  assert.equal(Drawer({}).props.items.some((entry) => entry.label === 'History'), false);
});

test('direct History links render only for homeowners and redirect all other roles', () => {
  let role = 'homeowner';
  const Stack = () => {}; Stack.Screen = 'StackScreen';
  const Layout = load('src/app/(app)/homeowner/history/_layout.tsx', {
    'react/jsx-runtime': runtime, 'expo-router': { Stack, Redirect: 'Redirect', router: {} },
    'expo-router/drawer': { DrawerToggleButton: 'DrawerToggleButton' },
    'react-native': { Pressable: 'Pressable' }, '@expo/vector-icons': { Ionicons: 'Icon' },
    '@/context/ThemeContext': { useTheme: () => ({ chrome: colors.lightChrome }) },
    '@/context/AuthContext': { useAuth: () => ({ user: { role } }) },
    '@/components/HomeownerHeader': { __esModule: true, default: 'HomeownerHeader' },
  }).default;
  assert.equal(Layout().type, Stack);
  const listRoute = Layout().props.children.find((screen) => screen.props.name === 'index');
  assert.equal(listRoute.props.options.header().type, 'HomeownerHeader');
  for (role of ['contractor', 'worker', 'supplier', 'admin', 'superadmin']) {
    assert.equal(Layout().type, 'Redirect');
    assert.equal(Layout().props.href, '/');
  }
});
