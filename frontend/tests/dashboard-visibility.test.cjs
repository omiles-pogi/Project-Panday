const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

function load(file, mocks, timers = {}) {
  const filename = path.join(__dirname, '..', file);
  const { outputText } = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
  });
  const exports = {};
  vm.runInNewContext(outputText, { exports, Error, ...timers, require(name) {
    if (name in mocks) return mocks[name];
    throw new Error(`Unexpected dependency: ${name}`);
  } }, { filename });
  return exports;
}
const jsx = (type, props) => ({ type, props });
const runtime = { jsx, jsxs: jsx };
const defaults = (value) => ({ __esModule: true, default: value });
const tick = () => new Promise((resolve) => setImmediate(resolve));
function deferred() { let resolve, reject; const promise = new Promise((a, b) => { resolve = a; reject = b; }); return { promise, resolve, reject }; }
function nodes(node, type) {
  if (!node || typeof node !== 'object') return [];
  if (Array.isArray(node)) return node.flatMap((child) => nodes(child, type));
  return [...(node.type === type || node.type?.name === type ? [node] : []), ...nodes(node.props?.children, type)];
}
function text(node) {
  if (node == null || typeof node === 'boolean') return '';
  if (Array.isArray(node)) return node.map(text).filter(Boolean).join(' ').replace(/\s+/g, ' ').trim();
  return typeof node === 'object' ? text(node.props?.children) : String(node).trim();
}
function hooks() {
  const slots = []; let cursor = 0; let dirty = false; let effects = [];
  const equal = (a, b) => a && b && a.length === b.length && a.every((value, i) => Object.is(value, b[i]));
  const react = {
    useState(initial) { const i = cursor++; if (!(i in slots)) slots[i] = typeof initial === 'function' ? initial() : initial;
      return [slots[i], (value) => { const next = typeof value === 'function' ? value(slots[i]) : value; if (!Object.is(next, slots[i])) { slots[i] = next; dirty = true; } }]; },
    useRef(initial) { return slots[cursor++] ??= { current: initial }; },
    useCallback(callback, deps) { const i = cursor++; if (!equal(slots[i]?.deps, deps)) slots[i] = { callback, deps }; return slots[i].callback; },
    useEffect(effect, deps) { const i = cursor++; if (!equal(slots[i], deps)) { slots[i] = deps; effects.push(effect); } },
  };
  return { react, async settle(fn) {
    for (let i = 0; i < 30; i++) { cursor = 0; dirty = false; const result = fn(); const pending = effects; effects = []; pending.forEach((effect) => effect()); await tick(); if (!dirty) return result; }
    throw new Error('Dashboard did not settle');
  } };
}

test('dashboard API opts into Home filters and uses confirmed PATCH removal with sanitized failures', async () => {
  const calls = []; let response = { id: 7, isHiddenFromDashboard: true };
  class ApiError extends Error { constructor(data) { super('API error'); this.data = data; } }
  const api = load('src/services/api/dashboard.ts', { '@/services/api/client': { ApiError, apiFetch: async (...args) => {
    calls.push(args); if (response instanceof Error) throw response; return response;
  } }, '@/services/api/projects': { fetchDashboard: async () => ({ project: null }) } });
  await api.fetchHomeDashboard(7); await api.fetchDashboardProjects(); await api.removeProjectFromDashboard(7);
  assert.equal(calls[0][0], '/api/dashboard?dashboard_only=1&project_id=7');
  assert.equal(calls[1][0], '/api/projects?dashboard_only=1');
  assert.equal(calls[2][0], '/api/projects/7/hide-from-dashboard');
  assert.equal(calls[2][1].method, 'PATCH');
  assert.equal(calls.some((call) => call[1]?.method === 'DELETE'), false);
  await assert.rejects(api.removeProjectFromDashboard(0), /unavailable/);
  response = { id: 7, isHiddenFromDashboard: false };
  await assert.rejects(api.removeProjectFromDashboard(7), /Couldn't remove/);
  response = new Error('SQLSTATE sensitive details');
  await assert.rejects(api.removeProjectFromDashboard(7), (error) => !/SQLSTATE|sensitive/.test(error.message));
  response = new ApiError({ errors: { project_id: ['Only completed projects can be removed.'] } });
  await assert.rejects(api.removeProjectFromDashboard(7), /Only completed/);
});

const project = (id, status, title) => ({ id, status, title, location: 'Dagupan', budget: 900000, totalEstimate: 850000,
  timelineValue: 6, timelineUnit: 'months', startedAt: '2026-01-01', overallProgressPct: status === 'completed' ? 100 : 0,
  phases: [], workers: [], contractors: [], canManageChecklist: false });
function server(records, selectedId) {
  const hidden = new Set();
  return { records, hidden,
    visible: () => records.filter((item) => !hidden.has(item.id)),
    dashboard(id) {
      const visible = this.visible();
      const selected = visible.find((item) => item.id === (id ?? selectedId)) ?? visible[0] ?? null;
      return { project: selected, stats: { active: records.filter((item) => item.status === 'active').length, completed: records.filter((item) => item.status === 'completed').length } };
    },
  };
}
async function dashboardHarness(backend, options = {}) {
  const hook = hooks(); const removals = []; const reads = []; const selections = []; const navigations = []; const drafts = [];
  let poll; let paused;
  const selectProject = (...args) => selections.push(args);
  const api = {
    fetchDashboardProjects: async () => [...backend.visible()],
    fetchHomeDashboard: async (id) => { reads.push(id); if (paused) { const request = paused; paused = null; return request.promise; } return backend.dashboard(id); },
    removeProjectFromDashboard: async (id) => { removals.push(id); await options.remove?.(id); backend.hidden.add(id); },
  };
  const projectApi = { createDraftProject: async () => { drafts.push(1); return { id: 99, title: 'New Project', status: 'not_started', created: true }; } };
  const planApi = { usePlan: () => ({ ready: true, selectProject, startFresh: (id) => selections.push(['fresh', id]) }) };
  const routerApi = { router: { push: (value) => navigations.push(value) }, useLocalSearchParams: () => ({}), useFocusEffect: (fn) => hook.react.useEffect(fn, [fn]) };
  const newProjectFlow = load('src/hooks/useNewProjectFlow.ts', {
    react: hook.react, 'expo-router': routerApi, '@/context/PlanContext': planApi, '@/services/api/projects': projectApi,
  });
  const Dashboard = load('src/screens/homeowner/ProjectOverview.tsx', {
    react: hook.react, 'react/jsx-runtime': runtime,
    'react-native': { Text: 'Text', View: 'View', Pressable: 'Pressable', ScrollView: 'Scroll', Modal: 'Modal', ActivityIndicator: 'ActivityIndicator', AppState: { currentState: 'active', addEventListener: () => ({ remove() {} }) } },
    'react-native-safe-area-context': { useSafeAreaInsets: () => ({ top: 24, bottom: 24 }) },
    '@/components/charts': { CountUp: 'CountUp', ProgressRing: 'ProgressRing' }, '@/components/ui': { ProgressBar: 'ProgressBar' },
    'expo-router': routerApi,
    '@expo/vector-icons': { Ionicons: 'Icon' }, '@/services/api/dashboard': { ...api, fetchProjectOverview: api.fetchHomeDashboard },
    '@/services/api/projects': projectApi,
    '@/context/PlanContext': planApi,
    '@/context/ThemeContext': { useTheme: () => ({ chrome: { foreground: '#11141c' } }) },
    '@/hooks/useNewProjectFlow': newProjectFlow, '@/components/NewProjectModal': defaults('NewProjectModal'),
    '@/utils/currency': { peso: (value) => `PHP ${value}` }, '@/utils/budget': { compareBudget: () => ({ hasBudget: true, difference: 50000 }), formatBudget: (value) => `PHP ${value}` },
    '@/theme/colors': { colors: {} }, '@/components/Mascot': defaults('Mascot'), '@/components/MessageButton': defaults('MessageButton'),
    '@/components/ProjectChecklistCard': defaults('ProjectChecklistCard'), '@/components/ProjectCompletionCard': defaults('ProjectCompletionCard'),
    '@/components/ProjectRatingPrompt': defaults('ProjectRatingPrompt'), '@/screens/timeline/ProjectCalendar': defaults('ProjectCalendar'),
    '@/components/WageSheet': defaults('WageSheet'), '@/components/AddBudgetSheet': defaults('AddBudgetSheet'), '@/utils/wage': {},
  }, { setInterval: (fn) => { poll = fn; return 1; }, clearInterval() {} }).default;
  const render = () => hook.settle(Dashboard);
  return { render, initial: await render(), removals, reads, selections, navigations, drafts,
    poll: () => poll(), pauseNextRead: () => { paused = deferred(); return paused; } };
}
const removeModal = (tree) => nodes(tree, 'RemoveFromDashboardModal')[0];
const removeButton = (tree, title) => nodes(tree, 'Pressable').find((node) => node.props.accessibilityLabel === `Remove ${title} from dashboard`);

test('only completed chips have X; the actual-name confirmation explains History and Cancel changes nothing', async () => {
  const backend = server([project(7, 'completed', 'Named residence'), project(8, 'active', 'Ongoing residence'), project(9, 'not_started', 'New Project')]);
  const app = await dashboardHarness(backend);
  assert.ok(removeButton(app.initial, 'Named residence'));
  assert.equal(removeButton(app.initial, 'Ongoing residence'), undefined);
  assert.equal(removeButton(app.initial, 'New Project'), undefined);
  removeButton(app.initial, 'Named residence').props.onPress();
  let tree = await app.render(); const modal = removeModal(tree);
  const rendered = modal.type(modal.props);
  assert.match(text(rendered), /Remove from Dashboard\?/);
  assert.match(text(rendered), /Named residence/);
  assert.match(text(rendered), /remain saved in your History/);
  assert.equal(nodes(rendered, 'Pressable').map((node) => text(node)).join(','), 'Cancel,Remove');
  modal.props.onCancel(); tree = await app.render();
  assert.equal(removeModal(tree).props.project, null);
  assert.equal(app.removals.length, 0); assert.ok(removeButton(tree, 'Named residence'));
});

test('confirmed removal waits for success, ignores double taps, switches selection, and stays hidden after reopening', async () => {
  const pending = deferred();
  const backend = server([project(7, 'completed', 'Named residence'), project(8, 'active', 'Ongoing residence')]);
  const app = await dashboardHarness(backend, { remove: () => pending.promise });
  removeButton(app.initial, 'Named residence').props.onPress();
  let tree = await app.render(); const action = removeModal(tree).props.onConfirm;
  action(); action(); await tick();
  assert.deepEqual(app.removals, [7]);
  tree = await app.render(); assert.ok(removeButton(tree, 'Named residence'));
  pending.resolve(); await tick(); tree = await app.render();
  assert.equal(removeButton(tree, 'Named residence'), undefined);
  assert.equal(removeModal(tree).props.project, null);
  assert.equal(app.selections.at(-1)[0], 8);
  assert.equal(backend.records.length, 2);
  const reopened = await dashboardHarness(backend);
  assert.equal(removeButton(reopened.initial, 'Named residence'), undefined);
});

test('removing an unselected project preserves the current project and rejects a stale poll that includes it', async () => {
  const backend = server([project(7, 'completed', 'Named residence'), project(8, 'active', 'Ongoing residence')], 8);
  const app = await dashboardHarness(backend);
  const initialSelections = app.selections.length;
  const pendingPoll = app.pauseNextRead(); app.poll(); await tick();
  removeButton(app.initial, 'Named residence').props.onPress();
  let tree = await app.render(); removeModal(tree).props.onConfirm(); await tick(); tree = await app.render();
  assert.equal(removeButton(tree, 'Named residence'), undefined);
  assert.equal(app.selections.length, initialSelections);
  pendingPoll.resolve(backend.dashboard(8)); await tick(); tree = await app.render();
  assert.equal(removeButton(tree, 'Named residence'), undefined);
  assert.equal(app.selections.at(-1)[0], 8);
});

test('a failed removal retains the chip and offers retry in the same confirmation', async () => {
  let failed = true;
  const backend = server([project(7, 'completed', 'Named residence'), project(8, 'active', 'Ongoing residence')]);
  const app = await dashboardHarness(backend, { remove: async () => { if (failed) throw new Error('Please try again'); } });
  removeButton(app.initial, 'Named residence').props.onPress();
  let tree = await app.render(); removeModal(tree).props.onConfirm(); await tick(); tree = await app.render();
  assert.ok(removeButton(tree, 'Named residence'));
  assert.equal(removeModal(tree).props.error, 'Please try again');
  failed = false; removeModal(tree).props.onConfirm(); await tick(); tree = await app.render();
  assert.equal(removeButton(tree, 'Named residence'), undefined);
});

test('removing the last visible project leaves Overview scrollable without a floating creation button', async () => {
  const backend = server([project(7, 'completed', 'Named residence')]);
  const app = await dashboardHarness(backend);
  removeButton(app.initial, 'Named residence').props.onPress();
  let tree = await app.render(); removeModal(tree).props.onConfirm(); await tick(); tree = await app.render();
  assert.match(text(tree), /No active project yet/);
  assert.equal(removeButton(tree, 'Named residence'), undefined);
  assert.equal(nodes(tree, 'NewProjectFab').length, 0);
  assert.equal(nodes(tree, 'NewProjectModal').length, 0);
  assert.equal(app.drafts.length, 0);
  assert.equal(nodes(tree, 'Scroll')[0].props.contentContainerStyle.paddingBottom, 40);
  assert.equal(backend.records.length, 1);
});
