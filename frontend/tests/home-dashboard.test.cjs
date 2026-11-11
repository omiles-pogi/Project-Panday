const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

function load(file, mocks) {
  const filename = path.join(__dirname, '..', file);
  const { outputText } = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
  });
  const exports = {};
  vm.runInNewContext(outputText, { exports, Error, require(name) {
    if (name in mocks) return mocks[name];
    throw new Error(`Unexpected dependency: ${name}`);
  } }, { filename });
  return exports;
}
const jsx = (type, props) => ({ type, props });
const runtime = { jsx, jsxs: jsx };
const defaults = (value) => ({ __esModule: true, default: value });
const tick = () => new Promise((resolve) => setImmediate(resolve));
function nodes(node, type) {
  if (!node || typeof node !== 'object') return [];
  if (Array.isArray(node)) return node.flatMap((child) => nodes(child, type));
  return [...(node.type === type || node.type?.name === type ? [node] : []), ...nodes(node.props?.children, type)];
}
function text(node) {
  if (node == null || typeof node === 'boolean') return '';
  if (Array.isArray(node)) return node.map(text).filter(Boolean).join(' ');
  return typeof node === 'object' ? text(node.props?.children) : String(node);
}
function hooks() {
  const slots = []; let cursor = 0; let dirty = false;
  const equal = (a, b) => a && b && a.length === b.length && a.every((value, i) => Object.is(value, b[i]));
  const react = {
    useState(initial) { const i = cursor++; if (!(i in slots)) slots[i] = initial;
      return [slots[i], (value) => { const next = typeof value === 'function' ? value(slots[i]) : value; if (!Object.is(next, slots[i])) { slots[i] = next; dirty = true; } }]; },
    useRef(initial) { return slots[cursor++] ??= { current: initial }; },
    useCallback(callback, deps) { const i = cursor++; if (!equal(slots[i]?.deps, deps)) slots[i] = { callback, deps }; return slots[i].callback; },
  };
  return { react, async render(fn) {
    for (let i = 0; i < 20; i++) { cursor = 0; dirty = false; const result = fn(); await tick(); if (!dirty) return result; }
    throw new Error('Home did not settle');
  } };
}
const active = { id: 7, title: 'Actual Saved Title', status: 'active', location: 'Dagupan', floors: 2,
  startedAt: '2026-10-20T00:00:00Z', overallProgressPct: 65 };
function harness(options = {}) {
  const hook = hooks(); const selections = []; const fresh = []; const pushes = []; let creates = 0; let refreshes = 0;
  let user = { name: '  Maria Elena Cruz ', role: 'homeowner' };
  let dimensions = { width: 390, fontScale: 1 };
  let resource = { data: { projects: [active], ongoingProjects: [active], recentActivity: [] }, loading: false, error: null,
    refresh: async () => { refreshes++; } };
  const plan = { ready: true, projectId: 99, selectProject: (id) => selections.push(id), startFresh: (id) => fresh.push(id) };
  const theme = { mode: 'light', chrome: { foreground: '#111', card: '#fff', border: '#ddd', muted: '#eee', secondaryForeground: '#555', mutedForeground: '#777' } };
  const router = { push: (value) => pushes.push(value) };
  const newProjectFlow = load('src/hooks/useNewProjectFlow.ts', {
    react: hook.react, 'expo-router': { router }, '@/context/PlanContext': { usePlan: () => plan },
    '@/services/api/projects': { createDraftProject: async () => { creates++; return options.create ? options.create() : { id: 42, created: true }; } },
  });
  const mocks = {
    react: hook.react, 'react/jsx-runtime': runtime,
    'react-native': { ...Object.fromEntries(['ActivityIndicator', 'Image', 'Pressable', 'RefreshControl', 'ScrollView', 'Text', 'View'].map((x) => [x, x])),
      StyleSheet: { create: (styles) => styles }, useWindowDimensions: () => dimensions },
    'expo-router': { router, Redirect: 'Redirect' }, '@expo/vector-icons': { Ionicons: 'Ionicons' },
    'expo-linear-gradient': { LinearGradient: 'LinearGradient' },
    'react-native-safe-area-context': { useSafeAreaInsets: () => ({ top: 24, bottom: 36, left: 4, right: 4 }) },
    '@/components/ui': { MAX_CONTENT_WIDTH: 880, ProgressBar: 'ProgressBar' },
    '@/components/Mascot': defaults('Mascot'), '@/components/NewProjectModal': defaults('NewProjectModal'),
    '@/context/AuthContext': { useAuth: () => ({ user }) }, '@/context/PlanContext': { usePlan: () => plan },
    '@/context/ThemeContext': { useTheme: () => theme }, '@/hooks/useNewProjectFlow': newProjectFlow,
    '@/hooks/useFocusedResource': { useFocusedResource: () => resource }, '@/services/api/dashboard': { fetchHomeOverview: async () => resource.data },
    '@/utils/history': { historyDate: (date) => date.slice(0, 10) }, '../../../assets/home-hero-house.png': 1,
  };
  const Home = load('src/screens/homeowner/Dashboard.tsx', mocks).default;
  const Title = load('src/components/HomeDashboardTitle.tsx', mocks).default;
  let tree;
  return { selections, fresh, pushes, plan, theme, Title,
    get tree() { return tree; }, get creates() { return creates; }, get refreshes() { return refreshes; },
    setResource: (value) => { resource = { ...resource, ...value }; }, setDimensions: (value) => { dimensions = value; },
    setUser: (value) => { user = value; }, render: async () => { tree = await hook.render(Home); return tree; },
  };
}

test('opening and refocusing Home preserves cached selection; explicit project actions open the saved ID', async () => {
  const app = harness(); await app.render(); await app.render();
  assert.deepEqual(app.selections, []); assert.deepEqual(app.fresh, []); assert.equal(app.plan.projectId, 99);
  const cards = nodes(app.tree, 'OngoingProjectCard'); assert.equal(cards.length, 1);
  const card = cards[0].type(cards[0].props);
  assert.match(text(card), /Actual Saved Title/); assert.match(text(card), /Dagupan/); assert.match(text(card), /65/);
  const progress = nodes(card, 'View').find((node) => node.props.accessibilityRole === 'progressbar');
  assert.equal(progress.props.accessibilityValue.now, 65);
  assert.equal(progress.props.children.props.style.width, '65%');
  nodes(card, 'Pressable')[0].props.onPress();
  assert.deepEqual(app.selections, [7]); assert.deepEqual(app.pushes, ['/homeowner/project-overview?projectId=7']);
  assert.doesNotMatch(text(app.tree), /View All/);
  assert.match(text(app.Title()), /Welcome back,\s+Maria\s*!/);
});

test('empty Home and hero share the existing creation workflow; drafts resume without a new project or reset', async () => {
  const app = harness(); app.setResource({ data: { projects: [{ id: 24, status: 'not_started' }], ongoingProjects: [], recentActivity: [] } });
  await app.render(); assert.match(text(app.tree), /No ongoing Projects yet/);
  const hero = nodes(app.tree, 'HeroBanner')[0];
  const empty = nodes(app.tree, 'NewProjectButton').find((node) => node.props.label === 'Create New Project');
  assert.equal(hero.props.onNewProject, empty.props.onPress);
  hero.props.onNewProject();
  assert.equal(app.creates, 0); assert.deepEqual(app.fresh, []); assert.deepEqual(app.selections, [24]);
  assert.deepEqual(app.pushes, ['/homeowner/project-chat']);
});

test('new project confirmation and synchronous request lock preserve the existing draft-creation behavior', async () => {
  let resolve; const pending = new Promise((done) => { resolve = done; });
  const app = harness({ create: () => pending }); await app.render();
  nodes(app.tree, 'HeroBanner')[0].props.onNewProject(); await app.render();
  let modal = nodes(app.tree, 'NewProjectModal')[0]; assert.equal(modal.props.visible, true);
  modal.props.onCancel(); await app.render(); assert.equal(app.creates, 0);
  nodes(app.tree, 'HeroBanner')[0].props.onNewProject(); await app.render();
  modal = nodes(app.tree, 'NewProjectModal')[0]; modal.props.onConfirm(); modal.props.onConfirm();
  assert.equal(app.creates, 1); resolve({ id: 42, created: true }); await app.render();
  assert.deepEqual(app.fresh, [42]); assert.deepEqual(app.pushes, ['/homeowner/project-chat']);
});

test('Home excludes non-active cards and activity links retain History and completion review access', async () => {
  const app = harness();
  app.setResource({ data: { projects: [active], ongoingProjects: [active, { ...active, id: 8, status: 'completed' }, { ...active, id: 9, status: 'pending_confirmation' }],
    recentActivity: [
      { id: 'completed:8', projectId: 8, projectStatus: 'completed', type: 'project_completed', title: 'Project Completed', description: 'Saved completion', createdAt: '2026-10-20T02:24:00Z' },
      { id: 'submitted:9', projectId: 9, projectStatus: 'pending_confirmation', type: 'project_submitted', title: 'Completion Submitted', description: 'Review required', createdAt: '2026-10-21T01:15:00Z' },
    ] } });
  await app.render(); assert.equal(nodes(app.tree, 'OngoingProjectCard').length, 1);
  const rows = nodes(app.tree, 'ActivityRow');
  assert.match(text(rows[0].type(rows[0].props)), /Oct 20, 2026/);
  assert.match(text(rows[0].type(rows[0].props)), /10:24 AM/);
  rows[0].props.onPress(); rows[1].props.onPress();
  assert.deepEqual(app.pushes, ['/homeowner/history/8', '/homeowner/project-overview?projectId=9']);
});

test('small phones and large fonts stack content in both themes while loading and retry states remain usable', async () => {
  const app = harness();
  for (const mode of ['light', 'dark']) for (const dimensions of [{ width: 320, fontScale: 1 }, { width: 430, fontScale: 1.8 }]) {
    app.theme.mode = mode; app.setDimensions(dimensions); await app.render();
    const hero = nodes(app.tree, 'HeroBanner')[0]; assert.equal(hero.props.stacked, true);
    assert.equal(nodes(hero.type(hero.props), 'Image')[0].props.style.width, '100%');
    const scroll = nodes(app.tree, 'ScrollView')[0]; assert.equal(scroll.props.contentContainerStyle.paddingLeft, 20);
  }
  app.setResource({ data: null, loading: true }); await app.render();
  assert.equal(nodes(app.tree, 'ActivityIndicator').length, 2);
  assert.equal(nodes(app.tree, 'HeroBanner')[0].props.disabled, true);
  app.setResource({ loading: false, error: 'Offline' }); await app.render();
  assert.doesNotMatch(text(app.tree), /No ongoing Projects yet/);
  nodes(app.tree, 'NewProjectButton').find((node) => node.props.label === 'Retry').props.onPress();
  await app.render(); assert.equal(app.refreshes, 1);
  app.setUser({ name: 'Supplier', role: 'supplier' }); await app.render(); assert.equal(app.tree.type, 'Redirect');
});

test('Home reads sanitized landing data and explicit details can open retained hidden projects', async () => {
  const calls = []; let failed = false; let selected = { id: 7 };
  const api = load('src/services/api/dashboard.ts', {
    '@/services/api/client': { ApiError: Error, apiFetch: async (route) => { calls.push(route); if (failed) throw new Error('SQLSTATE private'); return { projects: [] }; } },
    '@/services/api/projects': { fetchDashboard: async (id) => { calls.push(id); return { project: selected }; } },
  });
  await api.fetchHomeOverview(); assert.equal(calls[0], '/api/home-dashboard');
  assert.equal((await api.fetchProjectOverview(7)).project.id, 7); assert.equal(calls[1], 7);
  selected = null; await assert.rejects(api.fetchProjectOverview(999), /unavailable/);
  failed = true; await assert.rejects(api.fetchHomeOverview(), (error) => !/SQLSTATE|private/.test(error.message));
});

test('project details require an explicit valid ID and homeowner role', () => {
  let projectId; let role = 'homeowner';
  const Route = load('src/app/(app)/homeowner/project-overview.tsx', {
    'react/jsx-runtime': runtime, 'expo-router': { Redirect: 'Redirect', useLocalSearchParams: () => ({ projectId }) },
    '@/context/AuthContext': { useAuth: () => ({ user: { role } }) }, '@/screens/homeowner/ProjectOverview': defaults('ProjectOverview'),
  }).default;
  for (projectId of [undefined, '', '-1', '0', 'bad', '1.5']) assert.equal(Route().props.href, '/homeowner');
  projectId = '7'; assert.equal(Route().type, 'ProjectOverview');
  role = 'contractor'; assert.equal(Route().props.href, '/');
});
