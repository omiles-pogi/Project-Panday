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
const planning = (key, options = {}) => ({ key, title: `Draft ${key}`, projectId: null, overviewAvailable: false, hasEstimates: true,
  savedAt: '2026-11-14T02:00:00.000Z', updatedAt: '2026-11-14T02:00:00.000Z',
  stages: { plan: 'Approved', budget: 'Approved', materials: 'Pending Approval' }, ...options });
function harness(options = {}) {
  const hook = hooks(); const selections = []; const fresh = []; const pushes = []; let creates = 0; let refreshes = 0;
  let user = { name: '  Maria Elena Cruz ', role: 'homeowner' };
  let dimensions = { width: 390, fontScale: 1 };
  let resource = { data: { projects: [active], ongoingProjects: [active], recentActivity: [] }, loading: false, error: null,
    refresh: async () => { refreshes++; } };
  const resumed = []; let resets = 0;
  const plan = { ready: true, planningSessionsReady: true, planningSessions: [], projectId: 99,
    selectProject: (id) => selections.push(id), startFresh: (id) => fresh.push(id),
    resumePlanningSession: key => { resumed.push(key); return true; }, reset: () => { resets++; }, refreshProjectSelection: async () => {} };
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
    '@/components/PlanningProjectCard': defaults('PlanningProjectCard'),
    '@/context/AuthContext': { useAuth: () => ({ user }) }, '@/context/PlanContext': { usePlan: () => plan },
    '@/context/ThemeContext': { useTheme: () => theme }, '@/hooks/useNewProjectFlow': newProjectFlow,
    '@/hooks/useFocusedResource': { useFocusedResource: () => resource }, '@/services/api/dashboard': { fetchHomeOverview: async () => resource.data },
    '@/utils/history': { historyDate: (date) => date.slice(0, 10) }, '../../../assets/home-hero-house.png': 1,
  };
  const Home = load('src/screens/homeowner/Dashboard.tsx', mocks).default;
  const Title = load('src/components/HomeDashboardTitle.tsx', mocks).default;
  let tree;
  return { selections, fresh, pushes, plan, theme, Title, resumed, resets: () => resets,
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

test('empty Home and hero preserve the existing creation workflow when no projects or drafts exist', async () => {
  const app = harness(); app.setResource({ data: { projects: [], ongoingProjects: [], recentActivity: [] } });
  await app.render(); assert.match(text(app.tree), /No ongoing Projects yet/);
  const hero = nodes(app.tree, 'HeroBanner')[0];
  const empty = nodes(app.tree, 'NewProjectButton').find((node) => node.props.label === 'Create New Project');
  assert.equal(hero.props.onNewProject, empty.props.onPress);
  assert.equal(hero.props.actionLabel, 'Start a New Project');
  hero.props.onNewProject(); await app.render();
  assert.equal(app.creates, 1); assert.deepEqual(app.fresh, [42]);
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
  const completed = rows.find(row => row.props.activity.projectId === 8);
  assert.match(text(completed.type(completed.props)), /Oct 20, 2026/);
  assert.match(text(completed.type(completed.props)), /10:24 AM/);
  completed.props.onPress(); rows.find(row => row.props.activity.projectId === 9).props.onPress();
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

test('one saved draft replaces the false empty state and both Continue actions resume its exact identity', async () => {
  const app = harness(); const session = planning('draft:first');
  app.plan.planningSessions = [session];
  app.setResource({ data: { projects: [], ongoingProjects: [], recentActivity: [] } });
  await app.render();
  assert.doesNotMatch(text(app.tree), /No ongoing Projects yet|My Ongoing Projects/);
  const hero = nodes(app.tree, 'HeroBanner')[0]; assert.equal(hero.props.actionLabel, 'Continue Project');
  hero.props.onNewProject();
  const card = nodes(app.tree, 'PlanningProjectCard')[0];
  assert.equal(card.props.session, session); card.props.onContinue(); card.props.onView();
  assert.deepEqual(app.resumed, ['draft:first', 'draft:first', 'draft:first']);
  assert.deepEqual(app.pushes, ['/homeowner/project-chat', '/homeowner/project-chat', '/homeowner/project-chat']);
  assert.equal(app.creates, 0); assert.equal(app.resets(), 0);
});

test('multiple drafts remain separate beside ongoing construction and the hero requests a choice', async () => {
  const app = harness(); app.plan.planningSessions = [planning('draft:one'), planning('draft:two')];
  await app.render();
  assert.equal(nodes(app.tree, 'OngoingProjectCard').length, 1);
  const hero = nodes(app.tree, 'HeroBanner')[0]; assert.equal(hero.props.actionLabel, 'Choose a Project');
  const scroll = nodes(app.tree, 'ScrollView')[0]; const positions = [];
  scroll.props.ref.current = { scrollTo: value => positions.push(value.y) };
  const section = nodes(app.tree, 'View').find(node => node.props.onLayout);
  section.props.onLayout({ nativeEvent: { layout: { y: 270 } } });
  hero.props.onNewProject(); assert.deepEqual(positions, [270]); assert.deepEqual(app.resumed, []);
  const cards = nodes(app.tree, 'PlanningProjectCard'); cards[1].props.onContinue(); cards[0].props.onContinue();
  assert.deepEqual(app.resumed, ['draft:two', 'draft:one']);
});

test('starting a separate draft requires confirmation and never calls the placeholder-resumption endpoint', async () => {
  const app = harness(); app.plan.planningSessions = [planning('draft:old')]; await app.render();
  const start = () => nodes(app.tree, 'NewProjectButton').find(node => node.props.label === 'Start a New Project').props.onPress();
  start(); await app.render();
  let modal = nodes(app.tree, 'NewProjectModal')[0]; assert.equal(modal.props.visible, true);
  assert.equal(modal.props.draftCount, 1); modal.props.onCancel(); await app.render();
  assert.equal(app.resets(), 0); assert.equal(app.creates, 0);
  start(); await app.render(); modal = nodes(app.tree, 'NewProjectModal')[0];
  modal.props.onConfirm(); modal.props.onConfirm(); await app.render();
  assert.equal(app.resets(), 1); assert.equal(app.creates, 0);
  assert.deepEqual(app.pushes, ['/homeowner/project-chat']);
  assert.equal(app.plan.planningSessions[0].key, 'draft:old');
});

test('draft View uses existing overview only when available; newer completion data suppresses stale draft cards', async () => {
  const app = harness();
  app.plan.planningSessions = [planning('7', { projectId: 7, overviewAvailable: true })];
  await app.render(); nodes(app.tree, 'PlanningProjectCard')[0].props.onView();
  assert.deepEqual(app.selections, [7]); assert.deepEqual(app.pushes, ['/homeowner/project-overview?projectId=7']);
  app.setResource({ data: { projects: [{ ...active, status: 'completed' }], ongoingProjects: [], recentActivity: [] } });
  await app.render(); assert.equal(nodes(app.tree, 'PlanningProjectCard').length, 0);
  assert.equal(nodes(app.tree, 'HeroBanner')[0].props.actionLabel, 'Start a New Project');
});

test('draft activity uses recorded saves, omits unknown dates, and preserves existing activity with correct destinations', async () => {
  const app = harness();
  app.plan.planningSessions = [planning('draft:recorded'), planning('draft:legacy', { savedAt: null, updatedAt: null })];
  app.setResource({ data: { projects: [active], ongoingProjects: [active], recentActivity: [
    { id: 'created-7', type: 'project_created', projectId: 7, title: 'Project Created', description: 'Saved record', createdAt: '2026-11-13T02:00:00Z', projectStatus: 'active' },
  ] } });
  await app.render(); const rows = nodes(app.tree, 'ActivityRow');
  assert.equal(rows.length, 2); assert.equal(rows[0].props.activity.title, 'PandAI draft saved');
  assert.equal(rows[0].props.activity.createdAt, '2026-11-14T02:00:00.000Z');
  rows[0].props.onPress(); assert.deepEqual(app.resumed, ['draft:recorded']);
  rows[1].props.onPress(); assert.deepEqual(app.selections, [7]);
});

test('unverified conversation hydration never flashes the empty state or enables new-project actions', async () => {
  const app = harness(); app.plan.planningSessionsReady = false;
  app.setResource({ data: { projects: [], ongoingProjects: [], recentActivity: [] } });
  await app.render(); assert.doesNotMatch(text(app.tree), /No ongoing Projects yet/);
  assert.equal(nodes(app.tree, 'HeroBanner')[0].props.disabled, true);
  app.plan.projectSelectionError = 'Could not verify project selection'; await app.render();
  assert.match(text(app.tree), /Could not verify/);
});

test('planning cards render recorded approval labels, responsive actions and real timestamps in both themes', () => {
  let mode = 'light';
  const card = load('src/components/PlanningProjectCard.tsx', {
    'react/jsx-runtime': runtime, 'react-native': { Pressable: 'Pressable', Text: 'Text', View: 'View' },
    '@expo/vector-icons': { Ionicons: 'Icon' },
    '@/context/ThemeContext': { useTheme: () => ({ chrome: { card: mode === 'light' ? '#fff' : '#1c222b', foreground: '#111', secondaryForeground: '#555', muted: '#eee', mutedForeground: '#777', border: '#ddd' } }) },
  }).default;
  let continued = 0; let viewed = 0;
  for (mode of ['light', 'dark']) for (const stacked of [true, false]) {
    const tree = card({ session: planning('draft:one'), stacked, disabled: false, onContinue: () => continued++, onView: () => viewed++ });
    assert.equal(tree.props.style.backgroundColor, mode === 'light' ? '#fff' : '#1c222b');
    assert.match(text(tree), /Continue Your Project/); assert.match(text(tree), /Draft · AI planning in progress/);
    assert.match(text(tree), /Pending Approval/); assert.match(text(tree), /Nov 14, 2026/);
    assert.doesNotMatch(text(tree), /Just now|\d+%/);
    const buttons = nodes(tree, 'Pressable'); buttons[0].props.onPress(); buttons[1].props.onPress();
    assert.ok(buttons.every(button => button.props.style.minHeight >= 44));
  }
  assert.equal(continued, 4); assert.equal(viewed, 4);
  assert.match(text(card({ session: planning('draft:legacy', { updatedAt: null }), stacked: true, disabled: true })), /Last updated:\s+Not recorded/);
});
