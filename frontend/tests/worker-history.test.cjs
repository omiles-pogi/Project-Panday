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
const utils = load('src/utils/workerHistory.ts', { '@/utils/projectStatus': status });
const completed = { id: 7, title: 'Recorded Residence', homeownerName: 'Recorded Owner', workerRole: 'Mason', status: 'completed', startedAt: '2026-01-05', completedAt: '2026-10-20T04:00:00Z' };

test('Worker Dashboard filters by actual worker pivots, keeping ongoing and completed counts separate', () => {
  const project = (id, state, workers) => ({ id, status: state, workers: workers.map(id => ({ id })) });
  const result = utils.workerDashboardData([project(1, 'active', [10]), project(2, 'pending_confirmation', [10]), project(3, 'completed', [10]), project(4, 'active', [99])], 10);
  assert.deepEqual(Array.from(result.assigned, p => p.id), [1, 2, 3]); assert.equal(result.active.length, 2); assert.equal(result.completed.length, 1);
  assert.equal(utils.workerDashboardData([], 10).active.length, 0);
});

test('Dashboard preserves Attendance then Assigned Projects then Daily Work Log, with actual greeting and project links', () => {
  let projects = [{ id: 11, title: 'Assigned Project', ownerName: 'Recorded Owner', location: null, startedAt: '2026-01-05',
    status: 'active', overallProgressPct: 65, workers: [{ id: 10 }] }, { id: 7, status: 'completed', workers: [{ id: 10 }] }];
  const destinations = [];
  const Dashboard = load('src/screens/worker/Dashboard.tsx', {
    'react/jsx-runtime': runtime, 'react-native': primitive(['Pressable', 'Text', 'View', 'ActivityIndicator']),
    'expo-router': { router: { push: value => destinations.push(value) } }, '@/components/ui': primitive(['Card', 'PageHeader', 'Screen']),
    '@/components/worker/DashboardStats': defaults('WorkerDashboardStats'), '@/context/AuthContext': { useAuth: () => ({ user: { id: 10, name: 'Recorded Worker' } }) },
    '@/context/ThemeContext': { useTheme: () => ({ chrome: colors.lightChrome }) }, '@/services/api/projects': {},
    '@/hooks/useFocusedResource': { useFocusedResource: () => ({ data: projects }) }, '@/utils/workerHistory': utils,
    '@/screens/worker/AttendanceSection': defaults('AttendanceSection'), '@/screens/worker/DailyLogSection': defaults('DailyLogSection'),
  }).default;
  const tree = Dashboard();
  assert.deepEqual(Array.from(tree.props.children.filter(n => n && ['AttendanceSection', 'Card', 'DailyLogSection'].includes(n.type)), n => n.type), ['AttendanceSection', 'Card', 'DailyLogSection']);
  assert.equal(nodes(tree, 'Card')[0].props.title, 'Assigned Projects');
  assert.equal(nodes(tree, 'PageHeader')[0].props.title, 'Good day, Recorded Worker!');
  assert.equal(nodes(tree, 'WorkerDashboardStats')[0].props.active, 1); assert.equal(nodes(tree, 'WorkerDashboardStats')[0].props.completed, 1);
  const row = nodes(tree, 'Pressable').find(n => n.props.className?.includes('p-3.5')); row.props.onPress();
  assert.equal(destinations.at(-1), '/worker/assignments?projectId=11');
  const progress = nodes(tree, 'View').find(n => n.props.accessibilityRole === 'progressbar'); assert.equal(progress.props.accessibilityValue.now, 65);
  projects = []; const empty = Dashboard();
  assert.ok(JSON.stringify(empty).includes('No active assignments yet')); assert.equal(nodes(empty, 'AttendanceSection').length, 1); assert.equal(nodes(empty, 'DailyLogSection').length, 1);
});

test('Worker History searches project/homeowner names and leaves unknown completion dates explicit', () => {
  const list = [completed, { ...completed, id: 8, title: 'Other project', homeownerName: 'Second Owner' }, { ...completed, id: 9, status: 'active' }];
  assert.deepEqual(Array.from(utils.workerHistorySearch(list, ' RECORDED RESIDENCE '), p => p.id), [7]);
  assert.deepEqual(Array.from(utils.workerHistorySearch(list, 'second owner'), p => p.id), [8]);
  assert.equal(utils.workerHistorySearch(list, '').length, 2); assert.equal(utils.workerHistoryDate(null), 'Not recorded');
  assert.equal(utils.workerHistoryDate('invalid'), 'Not recorded'); assert.match(utils.workerHistoryDate('2026-10-20'), /Oct.*20.*2026/);
});

test('Worker History client validates IDs before fetching and never displays private server diagnostics', async () => {
  const calls = []; let failing = false;
  const api = load('src/services/api/workerHistory.ts', { '@/services/api/client': { apiFetch: async path => { calls.push(path); if (failing) throw new Error('private SQL diagnostics'); return completed; } } });
  for (const id of [0, -1, 1.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1]) await assert.rejects(api.fetchWorkerHistoryDetails(id));
  assert.equal(calls.length, 0); await api.fetchWorkerHistory(); await api.fetchWorkerHistoryDetails(7);
  assert.deepEqual(calls, ['/api/worker-history', '/api/worker-history/7']);
  failing = true; await assert.rejects(api.fetchWorkerHistoryDetails(7), e => !e.message.includes('private SQL') && e.message.includes('officially joined'));
});

function footer() {
  const state = { pathname: '/worker/more', mode: 'light', insets: { top: 24, bottom: 36, left: 4, right: 8 } }, destinations = [];
  const Bar = load('src/components/WorkerFloatingTabBar.tsx', {
    'react/jsx-runtime': runtime, 'react-native': { ...primitive(['Pressable', 'Text', 'View']), StyleSheet: { create: s => s } },
    'expo-router': { usePathname: () => state.pathname, router: { navigate: route => destinations.push(route) } },
    '@expo/vector-icons': { Ionicons: 'Icon' }, 'react-native-safe-area-context': { useSafeAreaInsets: () => state.insets },
    '@/context/ThemeContext': { useTheme: () => ({ mode: state.mode, chrome: state.mode === 'light' ? colors.lightChrome : colors.darkChrome }) },
  }).default;
  return { state, destinations, render: Bar };
}

test('Five Worker navigation actions retain destinations and route-based selection in both themes', () => {
  for (const mode of ['light', 'dark']) {
    const app = footer(); app.state.mode = mode;
    const buttons = nodes(app.render(), 'Pressable');
    assert.deepEqual(buttons.map(b => b.props.accessibilityLabel), ['Home', 'Browse', 'Tasks', 'History', 'Skills']);
    buttons.forEach(b => b.props.onPress());
    assert.deepEqual(app.destinations, ['/worker', '/worker/available', '/worker/assignments', '/worker/history', '/worker/skills']);
    for (let i = 0; i < app.destinations.length; i++) {
      app.state.pathname = app.destinations[i]; const selected = nodes(app.render(), 'Pressable').filter(b => b.props.accessibilityState.selected);
      assert.equal(selected.length, 1); assert.equal(selected[0].props.accessibilityLabel, buttons[i].props.accessibilityLabel);
    }
  }
});

test('Worker navigation has equal touch regions, safe areas, theme surfaces, and no special center button', () => {
  const app = footer();
  for (const mode of ['light', 'dark']) {
    app.state.mode = mode; const tree = app.render(), pill = tree.props.children;
    assert.equal(tree.props.style.paddingBottom, 44); assert.equal(tree.props.style.paddingLeft, 16); assert.equal(tree.props.style.paddingRight, 20);
    assert.equal(pill.props.style[0].height, 64); assert.equal(pill.props.style[1].backgroundColor, mode === 'light' ? '#ffffff' : colors.darkChrome.card);
    const buttons = nodes(tree, 'Pressable'); assert.equal(buttons.length, 5);
    for (const b of buttons) { assert.equal(b.props.style, buttons[2].props.style); assert.equal(b.props.style.flex, 1); assert.equal(b.props.style.position, undefined); }
    assert.ok(nodes(tree, 'Icon').every(icon => icon.props.name !== 'add'));
    assert.ok(nodes(tree, 'Text').every(text => text.props.numberOfLines === 1));
  }
  app.state.pathname = '/worker/history/7'; assert.equal(app.render(), null);
});

test('Worker completed details render only saved authorized fields and use the required description fallback', () => {
  const details = { ...completed, projectType: '2-storey project', location: 'Recorded location', description: 'Final approved specifications.' };
  const Details = load('src/screens/worker/CompletedProject.tsx', {
    'react/jsx-runtime': runtime, react: { useCallback: fn => fn }, 'react-native': primitive(['ActivityIndicator', 'ScrollView', 'Text', 'View']),
    'expo-router': { useLocalSearchParams: () => ({ id: '7' }) }, '@/components/worker/HistoryUI': { ...primitive(['WorkerCompletedBadge', 'WorkerInfoRow', 'WorkerProjectImage']), useWorkerContentStyle: () => ({ paddingBottom: 24 }) },
    '@/components/history/HistoryUI': primitive(['HistoryFeedback']), '@/context/ThemeContext': { useTheme: () => ({ chrome: colors.lightChrome }) },
    '@/hooks/useFocusedResource': { useFocusedResource: () => ({ data: details }) }, '@/services/api/workerHistory': {}, '@/utils/workerHistory': utils,
  }).default;
  const rows = nodes(Details(), 'WorkerInfoRow').map(n => n.props);
  assert.deepEqual(rows.map(r => r.label), ['Homeowner', 'Project Type', 'My Role', 'Completion Date', 'Location', 'Project Description']);
  assert.equal(rows[2].value, 'Mason'); assert.equal(rows[5].value, details.description);
  details.description = null; details.workerRole = null;
  const missing = nodes(Details(), 'WorkerInfoRow'); assert.equal(missing[5].props.value, 'Final project description unavailable.'); assert.equal(missing[2].props.value, 'Not recorded');
  assert.equal(nodes(Details(), 'Pressable').length, 0);
});

test('Existing Attendance check-in and check-out still call the same actions and refresh recorded data', async () => {
  const calls = []; let refreshed = 0;
  const data = { today: [{ projectId: 7, projectTitle: 'Assigned site', status: 'not_in', checkInAt: null }], history: [] };
  const Attendance = load('src/screens/worker/AttendanceSection.tsx', {
    'react/jsx-runtime': runtime, react: { useState: value => [value, () => {}] }, 'react-native': primitive(['ActivityIndicator', 'Pressable', 'Text', 'View']),
    '@/components/ui': primitive(['Badge', 'Button', 'Card']), '@/services/api/workerActivity': { fetchAttendance: () => {}, checkIn: async id => calls.push(['in', id]), checkOut: async id => calls.push(['out', id]) },
    '@/hooks/useFocusedResource': { useFocusedResource: () => ({ data, refresh: async () => refreshed++ }) }, '@/utils/clock': { clockTime: () => '', hoursLabel: () => '' },
    '@/utils/timeline': {}, '@/utils/workerActivity': { DAY_STATUS: { not_in: { label: 'Not checked in', color: '#f59e0b' }, on_site: { label: 'On site', color: '#10b981' } } },
  }).default;
  let row = nodes(Attendance(), 'ProjectRow')[0]; await nodes(row.type(row.props), 'Button')[0].props.onPress();
  data.today[0].status = 'on_site'; data.today[0].checkInAt = '2026-10-20T02:00:00Z';
  row = nodes(Attendance(), 'ProjectRow')[0]; await nodes(row.type(row.props), 'Button')[0].props.onPress();
  assert.deepEqual(calls, [['in', 7], ['out', 7]]); assert.equal(refreshed, 2);
  data.today = []; assert.ok(JSON.stringify(Attendance()).includes("nothing to check in to"));
});

test('Existing Daily Work Log retains saved text, validates and sends the worker draft to the original save action', async () => {
  const slots = []; let cursor = 0, refreshed = 0; const saves = [];
  const data = { projects: [{ projectId: 7, projectTitle: 'Assigned site', todayLog: 'Saved record' }], logs: [] };
  const DailyLog = load('src/screens/worker/DailyLogSection.tsx', {
    'react/jsx-runtime': runtime,
    react: { useState(initial) { const i = cursor++; if (!(i in slots)) slots[i] = initial; return [slots[i], value => { slots[i] = value; }]; } },
    'react-native': primitive(['ActivityIndicator', 'Pressable', 'Text', 'View']), '@/components/ui': primitive(['Card', 'ChipPicker', 'Field', 'SubmitButton']),
    '@/services/api/workerActivity': { fetchWorkLogs: () => {}, saveWorkLog: async (id, text) => saves.push([id, text]) },
    '@/hooks/useFocusedResource': { useFocusedResource: () => ({ data, refresh: async () => refreshed++ }) }, '@/utils/timeline': {},
  }).default;
  const render = () => { cursor = 0; return DailyLog(); };
  assert.equal(nodes(render(), 'Field')[0].props.value, 'Saved record');
  nodes(render(), 'Field')[0].props.onChangeText('  Recorded work today  ');
  await nodes(render(), 'SubmitButton')[0].props.onPress(); assert.deepEqual(saves, [[7, 'Recorded work today']]); assert.equal(refreshed, 1);
  data.projects = []; assert.ok(JSON.stringify(render()).includes('nothing to log'));
});
