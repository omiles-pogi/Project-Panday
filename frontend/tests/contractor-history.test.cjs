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
  vm.runInNewContext(outputText, { exports, require(name) { if (name in mocks) return mocks[name]; throw new Error(`Unexpected dependency ${name}`); } }, { filename });
  return exports;
}
const jsx = (type, props) => ({ type, props });
const runtime = { jsx, jsxs: jsx };
const defaults = (value) => ({ __esModule: true, default: value });
const primitive = (names) => Object.fromEntries(names.map((name) => [name, name]));
const colors = load('src/theme/colors.ts');
function nodes(node, type) {
  if (!node || typeof node !== 'object') return [];
  if (Array.isArray(node)) return node.flatMap((value) => nodes(value, type));
  return [...(node.type === type || node.type?.name === type ? [node] : []), ...nodes(node.props?.children, type)];
}
const flat = (style) => Array.isArray(style) ? Object.assign({}, ...style.filter(Boolean).map(flat)) : style;

const status = load('src/utils/projectStatus.ts');
const utils = load('src/utils/contractorHistory.ts', { '@/utils/projectStatus': status });
const completed = { id: 7, title: 'Approved Residence', homeownerName: 'Recorded Owner', status: 'completed', startedAt: '2026-01-05', completedAt: '2026-10-20T04:00:00Z' };

test('Dashboard counts assigned projects and distinct associated people, including pending confirmation as ongoing', () => {
  const project = (id, state, contractors, workers) => ({ id, status: state, contractors: contractors.map(id => ({ id })), workers: workers.map(id => ({ id })) });
  const result = utils.contractorDashboardData([
    project(1, 'active', [10, 11], [20, 21]), project(2, 'pending_confirmation', [10], [20]),
    project(3, 'completed', [10], [21, 22]), project(4, 'active', [99], [10]),
  ], 10);
  assert.deepEqual(Array.from(result.assigned, p => p.id), [1, 2, 3]);
  assert.equal(result.active.length, 2); assert.equal(result.completed.length, 1); assert.equal(result.teamCount, 4);
  assert.equal(utils.contractorDashboardData([], 10).teamCount, 0);
});

test('History search uses actual project and homeowner names, excluding unfinished projects', () => {
  const list = [completed, { ...completed, id: 8, title: 'Other', homeownerName: 'Second Owner' }, { ...completed, id: 9, status: 'active' }];
  assert.deepEqual(Array.from(utils.contractorHistorySearch(list, '  APPROVED  '), p => p.id), [7]);
  assert.deepEqual(Array.from(utils.contractorHistorySearch(list, 'second owner'), p => p.id), [8]);
  assert.equal(utils.contractorHistorySearch(list, '').length, 2);
  assert.equal(utils.contractorDate(null), 'Not recorded'); assert.equal(utils.contractorDate('invalid'), 'Not recorded');
  assert.match(utils.contractorDate('2026-10-20'), /Oct.*20.*2026/);
});

test('Dashboard renders backend progress exactly and retains its project calendar and original management link', () => {
  const project = { id: 11, title: 'Backend Project', ownerName: 'Recorded Owner', status: 'active', budget: 1200000,
    location: 'Recorded location', startedAt: '2026-01-05', overallProgressPct: 65, contractors: [{ id: 10 }], workers: [{ id: 20 }] };
  const destinations = [];
  const Dashboard = load('src/screens/contractor/Dashboard.tsx', {
    'react/jsx-runtime': runtime, react: { useState: value => [value, () => {}] },
    'react-native': primitive(['Pressable', 'ScrollView', 'Text', 'View', 'ActivityIndicator']), '@expo/vector-icons': { Ionicons: 'Icon' },
    'expo-router': { router: { push: path => destinations.push(path) } }, '@/components/ui': primitive(['Badge', 'Card', 'PageHeader', 'Screen']),
    '@/components/contractor/DashboardStats': defaults('ContractorDashboardStats'), '@/context/AuthContext': { useAuth: () => ({ user: { id: 10 } }) },
    '@/utils/contractorHistory': utils, '@/services/api/projects': {}, '@/hooks/useFocusedResource': { useFocusedResource: () => ({ data: [project] }) },
    '@/context/ThemeContext': { useTheme: () => ({ chrome: colors.lightChrome }) }, '@/screens/timeline/ProjectCalendar': defaults('ProjectCalendar'),
    '@/utils/currency': { peso: n => `PHP ${n}` }, '@/utils/projectStatus': status,
  }).default;
  const tree = Dashboard(), stats = nodes(tree, 'ContractorDashboardStats')[0].props;
  assert.deepEqual([stats.total, stats.ongoing, stats.completed, stats.team], [1, 1, 0, 1]);
  const progress = nodes(tree, 'View').find(v => v.props.accessibilityRole === 'progressbar');
  assert.equal(progress.props.accessibilityValue.now, 65); assert.equal(progress.props.children.props.style.width, '65%');
  assert.equal(nodes(tree, 'ProjectCalendar')[0].props.projectId, 11);
  nodes(tree, 'Pressable').find(p => p.props.children?.type === 'Card').props.onPress();
  assert.equal(destinations.at(-1), '/contractor/projects?projectId=11');
});

test('History client rejects malformed IDs without requests and sanitizes server failures', async () => {
  const calls = []; let failing = false;
  const api = load('src/services/api/contractorHistory.ts', { '@/services/api/client': { apiFetch: async path => { calls.push(path); if (failing) throw new Error('private database details'); return completed; } } });
  for (const id of [0, -1, 1.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1]) await assert.rejects(api.fetchContractorHistoryDetails(id));
  assert.equal(calls.length, 0);
  await api.fetchContractorHistory(); await api.fetchContractorHistoryDetails(7);
  assert.deepEqual(calls, ['/api/contractor-history', '/api/contractor-history/7']);
  failing = true;
  await assert.rejects(api.fetchContractorHistoryDetails(7), error => !error.message.includes('private database') && error.message.includes('assigned, completed'));
});

function footer() {
  const state = { pathname: '/contractor', width: 320, insets: { top: 24, bottom: 36, left: 0, right: 0 }, mode: 'light' };
  const navigations = [];
  const Bar = load('src/components/ContractorFloatingTabBar.tsx', {
    'react/jsx-runtime': runtime, 'react-native': { ...primitive(['Pressable', 'Text', 'View']), StyleSheet: { create: s => s }, useWindowDimensions: () => ({ width: state.width }) },
    'expo-router': { usePathname: () => state.pathname, router: { navigate: destination => navigations.push(destination) } },
    '@expo/vector-icons': { Ionicons: 'Icon' }, 'react-native-safe-area-context': { useSafeAreaInsets: () => state.insets },
    '@/context/ThemeContext': { useTheme: () => ({ mode: state.mode, chrome: state.mode === 'light' ? colors.lightChrome : colors.darkChrome }) },
  }).default;
  return { state, navigations, render: Bar };
}

test('Contractor footer retains real destinations and Create opens only the existing material request chooser', () => {
  const app = footer();
  for (const button of nodes(app.render(), 'Pressable')) button.props.onPress();
  // Already-selected Home does not navigate again.
  assert.deepEqual(app.navigations.map(v => typeof v === 'string' ? v : v.pathname), ['/contractor/projects', '/contractor/material-requests', '/contractor/history', '/contractor/profile']);
  assert.equal(app.navigations[1].params.create, '1');
  for (const [path, label] of [['/contractor', 'Home'], ['/contractor/projects', 'Projects'], ['/contractor/history/7', 'History'], ['/contractor/profile', 'Account'], ['/contractor/material-requests', 'Create']]) {
    app.state.pathname = path;
    assert.equal(nodes(app.render(), 'Pressable').find(b => b.props.accessibilityState?.selected).props.accessibilityLabel, label);
  }
});

test('Footer geometry reserves safe areas and equal side sections at narrow phone/tablet widths in both themes', () => {
  const app = footer();
  for (const width of [320, 360, 390, 600]) for (const mode of ['light', 'dark']) {
    Object.assign(app.state, { width, mode });
    const tree = app.render(), frame = tree.props.children, [pill, row] = frame.props.children;
    assert.equal(tree.props.style.paddingBottom, 44); assert.equal(tree.props.style.position, undefined);
    const chrome = mode === 'light' ? colors.lightChrome : colors.darkChrome;
    assert.equal(flat(pill.props.style).backgroundColor, chrome.card);
    assert.equal(flat(pill.props.style).borderColor, chrome.border);
    const buttons = nodes(tree, 'Pressable');
    assert.equal(nodes(buttons[0], 'Icon')[0].props.color, mode === 'light' ? '#d97706' : '#fbbf24');
    assert.equal(nodes(buttons[1], 'Icon')[0].props.color, mode === 'light' ? chrome.mutedForeground : chrome.secondaryForeground);
    const create = buttons.find(b => b.props.accessibilityLabel === 'Create');
    assert.equal(nodes(create, 'Icon')[0].props.color, '#0f1117');
    const circle = nodes(create, 'View').find(v => flat(v.props.style).borderRadius === 26);
    assert.equal(flat(circle.props.style).borderColor, chrome.card);
    assert.equal(flat(circle.props.style).backgroundColor, '#f59e0b');
    const [left, center, right] = row.props.children;
    assert.equal(left.props.style, right.props.style);
    assert.ok((Math.min(560, width - 24) - 8 - center.props.style.width) / 4 >= 44);
    assert.equal(nodes(tree, 'Pressable').length, 5);
    for (const text of nodes(tree, 'Text')) assert.equal(text.props.numberOfLines, 1);
  }
});

test('Completed details keep the final approved description immediately after project type and show actual dates/budget', () => {
  const details = { ...completed, budget: 1200000, location: 'Recorded location', projectType: '2-storey project', description: 'Final approved description.', finalReportAvailable: false };
  const Screen = load('src/screens/contractor/CompletedProject.tsx', {
    'react/jsx-runtime': runtime, react: { useCallback: fn => fn }, 'react-native': primitive(['ActivityIndicator', 'ScrollView', 'Text', 'View']),
    'expo-router': { useLocalSearchParams: () => ({ id: '7' }) }, '@/components/contractor/HistoryUI': { ...primitive(['CompletedBadge', 'ProjectPlaceholder', 'ContractorInfoRow']), useContractorContentStyle: () => ({ paddingBottom: 24 }) },
    '@/components/history/HistoryUI': primitive(['HistoryFeedback']), '@/hooks/useFocusedResource': { useFocusedResource: () => ({ data: details, loading: false }) },
    '@/context/ThemeContext': { useTheme: () => ({ chrome: colors.lightChrome }) }, '@/services/api/contractorHistory': {},
    '@/utils/contractorHistory': utils, '@/utils/currency': { peso: n => `PHP ${n}` },
  }).default;
  const rows = nodes(Screen(), 'ContractorInfoRow').map(n => n.props);
  const index = rows.findIndex(r => r.label === 'Project Type');
  assert.equal(rows[index + 1].label, 'Description'); assert.equal(rows[index + 1].value, details.description);
  assert.equal(rows.find(r => r.label === 'Total Budget').value, 'PHP 1200000');
  assert.match(rows.find(r => r.label === 'Duration').value, /2026/);
  details.description = null; details.budget = null;
  const missing = nodes(Screen(), 'ContractorInfoRow').map(n => n.props);
  assert.equal(missing.find(r => r.label === 'Description').value, 'Final project description unavailable.');
  assert.equal(missing.find(r => r.label === 'Total Budget').value, 'Not recorded');
});

test('Create shortcut reuses the existing chooser and does not affect homeowner request screens', () => {
  const state = []; let cursor = 0, handled = 0, writes = 0;
  const List = load('src/screens/materialRequests/RequestList.tsx', {
    'react/jsx-runtime': runtime,
    react: { useCallback: fn => fn, useEffect: fn => fn(), useState: initial => { const i = cursor++; if (!(i in state)) state[i] = initial; return [state[i], value => { state[i] = value; }]; } },
    'react-native': primitive(['ActivityIndicator', 'Pressable', 'Text', 'View']), 'expo-router': { useFocusEffect: () => {}, router: {} },
    '@/components/ui': primitive(['Badge', 'Button', 'Card', 'ChipPicker', 'PageHeader', 'Screen']), '@/components/Sheet': defaults('Sheet'),
    '@/components/RoleFloatingTabBar': { ROLE_FLOATING_TAB_BAR_CLEARANCE: 64 }, '@/components/MaterialStatusBadge': primitive(['RequestStatusBadge']),
    '@/screens/materialRequests/MaterialPlanSection': defaults('MaterialPlanSection'),
    '@/services/api/materialRequests': { createMaterialRequest: () => writes++, fetchMaterialRequests: async () => [] }, '@/services/api/projects': {}, '@/utils/currency': {},
  }).default;
  const props = { viewer: 'contractor', detailPath: id => `/contractor/material-request/${id}`, createRequested: true, onCreateHandled: () => { handled++; props.createRequested = false; } };
  const render = () => { cursor = 0; return List(props); };
  const chooser = nodes(render(), 'CreateSheet')[0]; assert.ok(chooser); assert.equal(handled, 0); assert.equal(writes, 0);
  chooser.props.onClose(); assert.equal(nodes(render(), 'CreateSheet').length, 0);
  props.viewer = 'homeowner'; props.createRequested = true;
  assert.equal(nodes(render(), 'CreateSheet').length, 0); assert.equal(handled, 1); assert.equal(writes, 0);
});
