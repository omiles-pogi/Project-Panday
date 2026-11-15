// Run with: node --test tests/floating-navigation.test.cjs
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
  vm.runInNewContext(outputText, { exports, setInterval: () => 0, clearInterval: () => {}, ...globals, require(name) {
    if (name === '@/utils/planningState') return load('src/utils/planningState.ts', {});
    if (name === '@/utils/plannerError') return load('src/utils/plannerError.ts', {});
    if (name in mocks) return mocks[name];
    throw new Error(`Unexpected dependency: ${name}`);
  } }, { filename });
  return exports;
}
const jsx = (type, props, key) => ({ type, props, key });
const runtime = { jsx, jsxs: jsx };
const flat = (style) => Array.isArray(style) ? Object.assign({}, ...style.filter(Boolean).map(flat)) : style;
function nodes(node, type) {
  if (!node || typeof node !== 'object') return [];
  if (Array.isArray(node)) return node.flatMap((child) => nodes(child, type));
  if (typeof node.type === 'function') return nodes(node.type(node.props), type);
  return [...(node.type === type ? [node] : []), ...nodes(node.props?.children, type)];
}
function hooks() {
  const slots = [];
  let cursor = 0;
  let effects = [];
  let dirty = false;
  const equal = (a, b) => a && b && a.length === b.length && a.every((value, i) => Object.is(value, b[i]));
  const react = {
    createContext: () => ({ Provider: 'Provider' }), useContext: () => null,
    useState(initial) {
      const index = cursor++;
      if (!(index in slots)) slots[index] = typeof initial === 'function' ? initial() : initial;
      return [slots[index], (value) => { const next = typeof value === 'function' ? value(slots[index]) : value; if (!Object.is(next, slots[index])) { slots[index] = next; dirty = true; } }];
    },
    useRef(initial) { return slots[cursor++] ??= { current: initial }; },
    useCallback(callback, deps) {
      const index = cursor++;
      if (!equal(slots[index]?.deps, deps)) slots[index] = { deps, callback };
      return slots[index].callback;
    },
    useEffect(effect, deps) {
      const index = cursor++;
      if (!equal(slots[index]?.deps, deps)) {
        effects.push(() => { slots[index]?.cleanup?.(); slots[index] = { deps, cleanup: effect() }; });
      }
    },
  };
  return {
    react,
    render(fn) { cursor = 0; return fn(); },
    async settle(fn) {
      for (let i = 0; i < 25; i++) {
        cursor = 0; dirty = false; const result = fn();
        const pending = effects; effects = []; pending.forEach((effect) => effect());
        await new Promise((resolve) => setImmediate(resolve));
        if (!dirty) return result;
      }
      throw new Error('Render did not settle');
    },
  };
}

function bar() {
  const hook = hooks();
  let width = 360;
  let mode = 'light';
  let ready = true;
  let prevented = false;
  let resumed = 0;
  const events = [];
  const navigated = [];
  const animations = [];
  const colors = { card: '#fff', border: '#eee', background: '#f3f4f7', mutedForeground: '#5a6370', secondaryForeground: '#9ca3af' };
  const { default: Bar } = load('src/components/FloatingTabBar.tsx', {
    react: hook.react, 'react/jsx-runtime': runtime,
    'react-native': {
      Animated: { Value: class {}, View: 'Animated', spring: (_value, options) => ({ start: () => animations.push(options.toValue) }) },
      Platform: { OS: 'android' }, View: 'View', Pressable: 'Pressable', Text: 'Text',
      StyleSheet: { create: (style) => style }, useWindowDimensions: () => ({ width }),
    },
    '@expo/vector-icons': { Ionicons: 'Icon' }, 'expo-linear-gradient': { LinearGradient: 'Gradient' },
    '@/components/Mascot': { __esModule: true, default: 'Mascot' },
    '@/context/ThemeContext': { useTheme: () => ({ chrome: { ...colors, card: mode === 'dark' ? '#1a1d27' : '#fff' }, mode }) },
    '@/context/PlanContext': { usePlan: () => ({ ready, openMostRecent: () => resumed++ }) },
  });
  const routes = ['index', 'progress', 'project-chat', 'budget-monitor', 'marketplace'].map((name) => ({ name, key: `original-${name}`, params: { retained: name } }));
  const labels = ['Home', 'Progress', 'AI Plan', 'Budget', 'Workers'];
  const props = {
    state: { routes, index: 0 },
    descriptors: Object.fromEntries(routes.map((route, i) => [route.key, { options: { tabBarLabel: labels[i] } }])),
    insets: { top: 0, left: 0, right: 0, bottom: 24 },
    emitter: { emit(event) { events.push(event); return { defaultPrevented: prevented }; } },
    navigateToTab: (key) => navigated.push(key),
  };
  return {
    props, events, navigated, animations,
    render: () => hook.render(() => Bar(props)),
    setWidth: (value) => width = value, setMode: (value) => mode = value,
    setReady: (value) => ready = value, prevent: () => prevented = true,
    resumed: () => resumed,
  };
}

test('five positions preserve route keys and events; the AI shortcut never replaces the selected conversation', () => {
  const app = bar();
  const buttons = nodes(app.render(), 'Pressable');
  assert.deepEqual(buttons.map((button) => nodes(button, 'Text')[0].props.children), ['Home', 'Progress', 'AI', 'Budget', 'Workers']);
  buttons.forEach((button) => button.props.onPress());
  assert.deepEqual(app.navigated, ['original-progress', 'original-project-chat', 'original-budget-monitor', 'original-marketplace']);
  assert.equal(app.resumed(), 0, 'global latest-history selection is never invoked');
  assert.equal(app.props.state.routes[4].params.retained, 'marketplace');
  buttons[4].props.onLongPress();
  assert.equal(app.events.at(-1).type, 'tabLongPress');
  app.prevent();
  buttons[2].props.onPress();
  assert.equal(app.resumed(), 0);
  assert.equal(app.navigated.length, 4);
  buttons[2].props.onPressIn(); buttons[2].props.onPressOut();
  assert.deepEqual(app.animations, [0.92, 1]);
});

test('chat returns no component or reserved space, then bar returns on every regular tab', () => {
  const app = bar();
  for (const index of [0, 1, 3, 4, 2, 0, 2, 4]) {
    app.props.state.index = index;
    const tree = app.render();
    if (index === 2) assert.equal(tree, null);
    else assert.equal(nodes(tree, 'Pressable').length, 5);
  }
  app.setReady(false);
  const buttons = nodes(app.render(), 'Pressable');
  assert.equal(buttons[2].props.disabled, true);
  assert.ok(buttons.filter((_, i) => i !== 2).every((button) => !button.props.disabled));
});

test('layout stays in flow, centered and contained across phone sizes, themes, insets and font settings', () => {
  const app = bar();
  for (const mode of ['light', 'dark']) {
    app.setMode(mode);
    for (const width of [280, 320, 360, 393, 412, 600, 800]) {
      for (const sideInset of [0, 24]) {
        for (const bottom of [0, 24, 48, 80]) {
          app.setWidth(width);
          Object.assign(app.props.insets, { left: sideInset, right: sideInset, bottom });
          let tree = app.render();
          const frameWidth = Math.min(560, width - sideInset * 2 - 24);
          tree.props.children.props.onLayout({ nativeEvent: { layout: { width: frameWidth } } });
          tree = app.render();
          const frame = tree.props.children;
          const [pill, row] = frame.props.children;
          const [left, center, right] = row.props.children;
          const centerStyle = flat(center.props.style);
          const sideWidth = (frameWidth - row.props.style.paddingHorizontal * 2 - centerStyle.width) / 2;
          const centerX = row.props.style.paddingHorizontal + sideWidth + centerStyle.width / 2;
          const circle = flat(nodes(center, 'Animated')[0].props.style);
          assert.equal(tree.props.style.position, undefined, 'bar reserves space instead of overlaying content');
          assert.equal(tree.props.style.paddingBottom, bottom + 12, 'system inset is never capped');
          assert.deepEqual(left.props.style, right.props.style);
          assert.equal(centerX, frameWidth / 2);
          assert.ok(sideWidth / 2 >= 28);
          assert.ok(circle.width + 16 <= centerStyle.width);
          assert.ok(circle.height + 16 + 12 <= centerStyle.height, 'AI label clears circle');
          assert.equal(flat(pill.props.style).backgroundColor, mode === 'light' ? '#fff' : '#1a1d27');
          const buttons = nodes(tree, 'Pressable');
          assert.ok(buttons.every((button) => typeof button.props.style === 'object'), 'NativeWind receives static layout styles');
          for (const label of nodes(tree, 'Text')) {
            assert.equal(label.props.numberOfLines, 1);
            assert.equal(label.props.maxFontSizeMultiplier, 1.35);
          }
        }
      }
    }
  }
});

const conversation = (content, updatedAt) => ({ plan: null, messages: content ? [{ role: 'user', content }] : [], approvalStage: null, clarificationRounds: 0, updatedAt });
const reliabilityPlan = { projectTitle: 'House', location: 'Dagupan', areaSqm: 80, floors: 1, bedrooms: 2, bathrooms: 1, budget: 900000,
  totalEstimate: 850000, timelineValue: 6, timelineUnit: 'months', phases: [], materials: [{ material: 'Cement', category: 'Foundation', qty: 10, unit: 'bag', unitPrice: 250, supplierProductId: 14 }],
  budgetBreakdown: [{ category: 'Foundation', amount: 850000 }], supplierSelections: { Foundation: 14 } };
async function provider(saved, options = {}) {
  const hook = hooks();
  const storage = options.storage ?? new Map([['panday_plan_conversations:42', JSON.stringify(saved)]]);
  if (options.active) storage.set('panday_plan_conversations:42:active', options.active);
  let requests = 0;
  const calls = [];
  let projectList = options.projects ?? Array.from({ length: 100 }, (_, i) => ({ id: i + 1, title: 'Project ' + (i + 1), status: 'active' }));
  let route = '/homeowner';
  const { PlanProvider } = load('src/context/PlanContext.tsx', {
    react: hook.react, 'react/jsx-runtime': runtime,
    'react-native': { AppState: { currentState: 'active', addEventListener: () => ({ remove() {} }) } },
    'expo-router': { usePathname: () => route },
    '@/services/api/projects': { fetchMyHomeownerProjects: async () => options.fetchProjects ? options.fetchProjects() : projectList },
    '@/utils/activeProject': load('src/utils/activeProject.ts'),
    '@react-native-async-storage/async-storage': { getItem: async (key) => { if (options.readFailure) throw new Error('Disk unavailable'); return storage.get(key); }, setItem: async (key, value) => { if (options.write) await options.write(key, value); storage.set(key, value); } },
    '@/context/AuthContext': { useAuth: () => ({ user: { id: options.userId ?? 42 } }) },
    '@/types/plan': { isChatReply: value => 'message' in value, isClarificationNeeded: value => 'questions' in value,
      SUPPLIER_CATEGORIES: ['Construction Materials', 'Electrical and Plumbing', 'Finishing Works'] },
    '@/services/ai/client': { generateConstructionPlan: async (...args) => { requests++; calls.push(args); return options.generate ? options.generate(...args) : { message: 'Reply' }; } },
    '@/utils/garage': { garageLabel: () => '' }, '@/utils/timeline': { normalizePlanTimeline: (value) => value, timelineLabel: () => '' },
  });
  const render = async () => (await hook.settle(() => PlanProvider({ children: null }))).props.value;
  return { render, api: await render(), storage, calls, requests: () => requests, setProjects: value => { projectList = value; }, setRoute: value => { route = value; } };
}

test('hydration restores the selected ID instead of the latest history and preserves the other projects', async () => {
  const saved = { 1: conversation('Newest', 200), 2: conversation('Selected older project', 100), 3: conversation('', 999) };
  const app = await provider(saved, { active: '2' });
  let api = await app.render();
  assert.equal(api.activeProjectKey, '2');
  assert.equal(api.messages[0].content, 'Selected older project');
  api.selectProject(1); api = await app.render();
  assert.equal(api.activeProjectKey, '1');
  assert.deepEqual(JSON.parse(app.storage.get('panday_plan_conversations:42')), saved);
  assert.equal(app.requests(), 0);
});

test('failed message preserves structured approvals and supplier selections; restart/retry uses exactly one user turn', async () => {
  const key = 'panday_plan_conversations:42';
  const review = { planFlags: { location: true }, materialsApproved: { cement: true } };
  const original = { ...conversation('Saved plan', 100), plan: reliabilityPlan, approvalStage: 'materials', review };
  const app = await provider({ 7: original }, { active: '7', generate: async () => { throw new Error('Connection interrupted'); } });
  const backup = JSON.parse(app.storage.get(`${key}:before-planner-reliability`));
  assert.deepEqual(JSON.parse(backup.conversations), { 7: original }); assert.equal(backup.active, '7');
  await assert.rejects(app.api.send('Change the roof'), /Connection interrupted/);
  let api = await app.render();
  assert.equal(api.loading, false); assert.equal(api.pendingTurn.status, 'failed'); assert.equal(api.approvalStage, 'materials');
  assert.deepEqual(JSON.parse(JSON.stringify(api.plan)), reliabilityPlan); assert.deepEqual(JSON.parse(JSON.stringify(api.review)), review);
  const restarted = await provider({}, { storage: app.storage });
  const result = await restarted.api.send('Change the roof', undefined, { retry: true });
  assert.equal(result.type, 'chat'); api = await restarted.render(); assert.equal(api.pendingTurn, null);
  const cached = JSON.parse(app.storage.get(key))['7'];
  assert.equal(cached.messages.filter(message => message.content === 'Change the roof').length, 1);
  assert.equal(cached.messages.filter(message => message.content === 'Reply').length, 1);
  assert.deepEqual(cached.plan, reliabilityPlan); assert.deepEqual(cached.review, review);
  assert.deepEqual(JSON.parse(app.storage.get(`${key}:before-planner-reliability`)), backup);
});

test('review choices, approval events, manual budget edits and returned plan cards survive hydration without regeneration', async () => {
  const key = 'panday_plan_conversations:42';
  const app = await provider({ 7: { ...conversation('Plan: House', 100), plan: reliabilityPlan, approvalStage: 'plan' } }, { active: '7' });
  app.api.setReview({ planFlags: { bedrooms: true }, materialsApproved: { cement: true } });
  let api = await app.render();
  await api.setApprovalStage('budget', { userText: 'Approve plan', assistantText: 'Review the budget' });
  api = await app.render();
  api.updatePlan({ ...reliabilityPlan, budgetBreakdown: [{ category: 'Foundation', amount: 810000 }] });
  api = await app.render();
  const restarted = await provider({}, { storage: app.storage });
  assert.equal(restarted.requests(), 0); assert.equal(restarted.api.plan.totalEstimate, 810000);
  assert.equal(restarted.api.approvalStage, 'budget'); assert.equal(restarted.api.review.planFlags.bedrooms, true);
  assert.equal(restarted.api.review.materialsApproved.cement, true);
  const cached = JSON.parse(app.storage.get(key))['7'];
  assert.equal(cached.messages.at(-1).planSnapshot.totalEstimate, 810000);
  assert.equal(cached.messages.at(-1).card, 'budget');
  assert.equal(cached.messages.filter(message => message.content === 'Approve plan').length, 1);
});

test('new provider plan is durably saved before send resolves and does not enter another draft', async () => {
  const app = await provider({}, { generate: async () => reliabilityPlan });
  const key = app.api.activeProjectKey;
  await app.api.send('Build a home');
  const cached = JSON.parse(app.storage.get('panday_plan_conversations:42'))[key];
  assert.deepEqual(cached.plan, reliabilityPlan); assert.equal(cached.messages.at(-1).card, 'plan');
  assert.equal(cached.messages.at(-1).planSnapshot.supplierSelections.Foundation, 14);
  let api = await app.render(); api.reset(); api = await app.render();
  assert.notEqual(api.activeProjectKey, key); assert.equal(api.plan, null); assert.equal(api.messages.length, 0);
  const restarted = await provider({}, { storage: app.storage });
  assert.equal(restarted.api.plan, null); assert.equal(restarted.requests(), 0);
});

test('supplier choices save per category without AI, preserve approved quotes and survive project switches and restart', async () => {
  const original = { ...conversation('Saved estimate', 100), plan: reliabilityPlan, approvalStage: 'materials', review: { planFlags: { area: true }, materialsApproved: { cement: true } } };
  const app = await provider({ 7: original, 8: original }, { active: '7', generate: async () => { throw new Error('Provider unavailable'); } });
  await app.api.setSupplierSelection('Construction Materials', 14);
  let api = await app.render();
  await api.setSupplierSelection('Finishing Works', 17);
  api = await app.render();
  assert.equal(app.requests(), 0);
  assert.equal(api.plan.supplierSelections['Construction Materials'], 14);
  assert.equal(api.plan.supplierSelections['Finishing Works'], 17);
  assert.deepEqual(JSON.parse(JSON.stringify(api.plan.materials)), reliabilityPlan.materials);
  assert.deepEqual(JSON.parse(JSON.stringify(api.review)), original.review);
  assert.equal(api.approvalStage, 'materials');
  api.selectProject(8); api = await app.render();
  assert.equal(api.plan.supplierSelections['Finishing Works'], undefined);
  api.selectProject(7); api = await app.render();
  const restarted = await provider({}, { storage: app.storage });
  assert.equal(restarted.api.activeProjectKey, '7');
  assert.equal(restarted.api.plan.supplierSelections['Finishing Works'], 17);
  assert.equal(restarted.api.plan.supplierSelections['Construction Materials'], 14);
  assert.equal(restarted.requests(), 0);
  const restored = load('src/utils/planningState.ts', {}).restorePlanningMessages(restarted.api.plan,
    [{ role: 'assistant', content: 'Plan', card: 'plan', planSnapshot: reliabilityPlan }, { role: 'assistant', content: 'Budget', card: 'budget', planSnapshot: reliabilityPlan }, ...restarted.api.messages], 'materials', card => card);
  assert.equal(restored.filter(message => message.card === 'plan').length, 1);
  assert.equal(restored.filter(message => message.card === 'budget').length, 1);
  await assert.rejects(api.send('Explain these estimates'), /Provider unavailable/);
  api = await app.render();
  await api.setSupplierSelection('Electrical and Plumbing', 17);
  api = await app.render();
  assert.equal(api.pendingTurn.supplierSelections['Electrical and Plumbing'], 17);
  const retry = await provider({}, { storage: app.storage });
  await retry.api.send('Explain these estimates', undefined, { retry: true });
  assert.equal(retry.calls[0][4]['Construction Materials'], 14);
  assert.equal(retry.calls[0][4]['Finishing Works'], 17);
  assert.equal(retry.calls[0][4]['Electrical and Plumbing'], 17);
  const cached = JSON.parse(app.storage.get('panday_plan_conversations:42'))['7'];
  assert.equal(cached.messages.filter(message => message.content === 'Explain these estimates').length, 1);
});

test('failed supplier preference storage does not call AI or replace the original saved plan', async () => {
  const original = { ...conversation('Saved estimate', 100), plan: reliabilityPlan, approvalStage: 'materials' };
  let fail = false;
  const app = await provider({ 7: original }, { active: '7', write: async () => { if (fail) throw new Error('Disk unavailable'); } });
  const savedBefore = app.storage.get('panday_plan_conversations:42');
  fail = true;
  await assert.rejects(app.api.setSupplierSelection('Finishing Works', 17), /Could not save your supplier choice/);
  const api = await app.render();
  assert.equal(app.requests(), 0);
  assert.deepEqual(JSON.parse(JSON.stringify(api.plan)), reliabilityPlan);
  assert.equal(app.storage.get('panday_plan_conversations:42'), savedBefore);
});

test('request lock prevents double sends, and preflight storage failure makes no AI call', async () => {
  let resolve; const pending = new Promise(done => { resolve = done; });
  const app = await provider({}, { generate: () => pending });
  const first = app.api.send('One request');
  await assert.rejects(app.api.send('One request'), /already in progress/);
  await new Promise(done => setImmediate(done)); assert.equal(app.requests(), 1);
  resolve({ message: 'Done' }); await first;
  let fail = false;
  const blocked = await provider({ 7: conversation('Preserved', 100) }, { active: '7', write: async () => { if (fail) throw new Error('Device full'); } });
  fail = true; await assert.rejects(blocked.api.send('Unsent'), /Device full/);
  const api = await blocked.render(); assert.equal(blocked.requests(), 0); assert.equal(api.loading, false); assert.equal(api.pendingTurn.errorCode, 'storage');
  assert.equal(api.messages[0].content, 'Preserved');
});

test('response storage retry saves the received result without requesting another AI response', async () => {
  let fail = false; let writes = 0;
  const app = await provider({}, { generate: async () => { fail = true; return { message: 'Already generated' }; }, write: async () => { if (fail) { writes++; throw new Error('Device unavailable'); } } });
  await assert.rejects(app.api.send('Question'), /Device unavailable/);
  let api = await app.render(); assert.equal(api.pendingTurn.errorCode, 'storage'); assert.ok(writes > 0);
  fail = false; await api.send('Question', undefined, { retry: true }); api = await app.render();
  assert.equal(app.requests(), 1); assert.equal(api.pendingTurn, null);
  assert.equal(api.messages.filter(message => message.content === 'Question').length, 1);
  assert.equal(api.messages.filter(message => message.content === 'Already generated').length, 1);
});

test('completed persisted selection moves to ongoing construction while completed conversations remain readable and unchanged', async () => {
  const saved = { 1: conversation('Completed project messages', 200), 2: conversation('Other project messages', 100) };
  const projects = [{ id: 1, title: 'test 2', status: 'completed' }, { id: 2, title: 'Ongoing residence', status: 'active' }];
  const app = await provider(saved, { active: '1', projects });
  assert.equal(app.api.activeProjectKey, '2'); assert.equal(app.api.messages[0].content, 'Other project messages');
  assert.equal(app.api.getProjectMessages(1)[0].content, 'Completed project messages');
  app.api.selectProject(1); let api = await app.render(); assert.equal(api.activeProjectKey, '2');
  app.setRoute('/homeowner/history/1'); api = await app.render(); assert.equal(api.activeProjectKey, '2');
  const cached = JSON.parse(app.storage.get('panday_plan_conversations:42'));
  assert.equal(cached['1'].messages[0].content, 'Completed project messages');
  const restarted = await provider({}, { storage: app.storage, projects });
  assert.equal(restarted.api.activeProjectKey, '2'); assert.equal(restarted.api.getProjectMessages(1)[0].content, 'Completed project messages');
});

test('completing the last project leaves a fresh empty context across restarts without deleting any conversation', async () => {
  const app = await provider({ 1: conversation('Preserve this final conversation', 100) }, { active: '1', projects: [{ id: 1, status: 'active' }] });
  app.setProjects([{ id: 1, status: 'completed' }]); await app.api.refreshProjectSelection(); let api = await app.render();
  assert.match(api.activeProjectKey, /^draft:/); assert.equal(api.messages.length, 0); assert.equal(api.plan, null);
  assert.equal(api.getProjectMessages(1)[0].content, 'Preserve this final conversation');
  const restarted = await provider({}, { storage: app.storage, projects: [{ id: 1, status: 'completed' }] });
  assert.match(restarted.api.activeProjectKey, /^draft:/); assert.equal(restarted.api.messages.length, 0);
  restarted.api.startFresh(3, 'New project'); api = await restarted.render();
  // The authoritative list must also contain the newly created server project before it can render.
  restarted.setProjects([{ id: 1, status: 'completed' }, { id: 3, status: 'not_started' }]);
  restarted.api.startFresh(3, 'New project'); api = await restarted.render();
  assert.equal(api.activeProjectKey, '3'); assert.equal(api.messages.length, 0); assert.equal(api.getProjectMessages(1).length, 1);
});

test('completion while mounted selects another ongoing project and discards a late AI response from the retired selection', async () => {
  let resolve;
  const response = new Promise(done => { resolve = done; });
  const projects = [{ id: 1, title: 'Finishing project', status: 'active' }, { id: 2, title: 'Replacement project', status: 'active' }];
  const app = await provider({ 1: conversation('Original completed conversation'), 2: conversation('Replacement conversation') }, { active: '1', projects, generate: () => response });
  const sending = app.api.send('Request begun before completion');
  await new Promise(done => setImmediate(done)); // The turn is persisted before opening the provider request.
  app.setProjects([{ ...projects[0], status: 'completed' }, projects[1]]);
  await app.api.refreshProjectSelection();
  let api = await app.render();
  assert.equal(api.activeProjectKey, '2'); assert.equal(api.messages[0].content, 'Replacement conversation');
  resolve({ message: 'Late completed project response' });
  await assert.rejects(sending, /selected project changed/);
  api = await app.render();
  assert.equal(api.messages[0].content, 'Replacement conversation');
  assert.equal(api.getProjectMessages(1)[0].content, 'Original completed conversation');
  assert.equal(api.getProjectMessages(1).some(message => message.content === 'Late completed project response'), false);
});

test('AI plan approval and pending construction confirmation remain eligible; explicit draft projects are preserved', async () => {
  for (const status of ['active', 'pending_confirmation', 'not_started']) {
    const cached = { ...conversation('Own approved plan', 100), plan: { projectTitle: 'Approved plan' }, approvalStage: 'summary' };
    const app = await provider({ 7: cached }, { active: '7', projects: [{ id: 7, status, title: 'Approved plan' }] });
    assert.equal(app.api.activeProjectKey, '7'); assert.equal(app.api.messages[0].content, 'Own approved plan'); assert.equal(app.api.approvalStage, 'summary');
  }
});

test('a late lifecycle response cannot replace a newer explicit project selection', async () => {
  const late = {}; late.promise = new Promise(resolve => { late.resolve = resolve; }); let slow = false;
  const projects = [{ id: 1, status: 'active' }, { id: 2, status: 'active' }];
  const app = await provider({ 1: conversation('First project'), 2: conversation('Second project') }, { active: '1', fetchProjects: () => slow ? late.promise : projects });
  slow = true; const pending = app.api.refreshProjectSelection();
  app.api.selectProject(2); slow = false; let api = await app.render();
  late.resolve([{ id: 1, status: 'completed' }]); await pending; api = await app.render();
  assert.equal(api.activeProjectKey, '2'); assert.equal(api.messages[0].content, 'Second project');
});

test('unverified lifecycle state stays hidden on tab changes and a retry restores only the selected history', async () => {
  let offline = false;
  const app = await provider({ 1: conversation('Never overwrite on network failure') }, { active: '1', fetchProjects: () => { if (offline) throw new Error('Offline'); return [{ id: 1, status: 'active' }]; } });
  offline = true; app.setRoute('/homeowner/progress'); let api = await app.render();
  assert.equal(api.ready, false); assert.equal(api.messages.length, 0); assert.match(api.projectSelectionError, /verify the active project/);
  assert.equal(api.getProjectMessages(1)[0].content, 'Never overwrite on network failure');
  offline = false; await api.refreshProjectSelection(); api = await app.render();
  assert.equal(api.ready, true); assert.equal(api.activeProjectKey, '1'); assert.equal(api.messages[0].content, 'Never overwrite on network failure');
});

test('active dashboard reads cannot use a default project, completed record, or mismatched response', async () => {
  const calls = []; let project = { id: 7, status: 'active' };
  const api = load('src/services/api/projects.ts', { '@/services/api/client': { apiFetch: async path => { calls.push(path); return { project, stats: { active: 1, completed: 1 } }; } } });
  for (const id of [undefined, 0, -1, NaN, 1.5]) await assert.rejects(api.fetchActiveDashboard(id));
  assert.equal(calls.length, 0); assert.equal((await api.fetchActiveDashboard(7)).project.id, 7);
  assert.equal(calls[0], '/api/dashboard?project_id=7&active_only=1');
  project = { id: 7, status: 'completed' }; assert.equal((await api.fetchActiveDashboard(7)).project, null);
  project = { id: 8, status: 'active' }; assert.equal((await api.fetchActiveDashboard(7)).project, null);
});

test('messages and approval state stay keyed to their project and selection survives an app restart', async () => {
  const app = await provider({ 1: conversation('Newest', 200), 2: conversation('Older', 100) });
  app.api.selectProject(2);
  let api = await app.render();
  api.setApprovalStage('budget');
  api = await app.render();
  assert.ok(JSON.parse(app.storage.get('panday_plan_conversations:42'))['2'].updatedAt > 200);
  await api.send('Continue this conversation');
  api = await app.render();
  const saved = JSON.parse(app.storage.get('panday_plan_conversations:42'));
  assert.ok(saved['2'].updatedAt > saved['1'].updatedAt);
  const restarted = await provider(null, { storage: app.storage });
  api = await restarted.render();
  assert.equal(api.activeProjectKey, '2');
  assert.equal(api.messages.at(-1).content, 'Reply');
  assert.equal(restarted.requests(), 0);
});

test('no selection opens a unique empty draft without using another project as a fallback', async () => {
  const app = await provider({});
  const api = await app.render();
  assert.match(api.activeProjectKey, /^draft:/);
  assert.equal(api.messages.length, 0);
  assert.equal(app.requests(), 0);
});

test('a newly created project stays empty while reopening an existing project restores only its own messages', async () => {
  const app = await provider({ 1: conversation('Project A history', 500), 2: conversation('Project B history', 100) }, { active: '1' });
  app.api.startFresh(3, 'New Residence'); let api = await app.render();
  assert.equal(api.activeProjectKey, '3'); assert.equal(api.activeProjectTitle, 'New Residence');
  assert.equal(api.messages.length, 0); assert.equal(api.plan, null); assert.equal(api.approvalStage, null);
  await api.send('Only for project C'); api = await app.render();
  assert.equal(app.calls[0][5], 3); assert.equal(app.calls[0][0].length, 1);
  api.selectProject(1); api = await app.render(); assert.equal(api.messages[0].content, 'Project A history');
  api.startFresh(2); api = await app.render(); assert.equal(api.messages[0].content, 'Project B history', 'reused IDs never erase their history');
  api.selectProject(3); api = await app.render(); assert.equal(api.messages[0].content, 'Only for project C');
});

test('existing projects restore their separate plans and approval steps without copying them into a new project', async () => {
  const first = { ...conversation('A brief and saved reply', 200), plan: { projectTitle: 'A saved plan' }, approvalStage: 'budget' };
  const second = { ...conversation('B brief and saved reply', 100), plan: { projectTitle: 'B saved plan' }, approvalStage: 'materials' };
  const app = await provider({ 1: first, 2: second }, { active: '1' });
  assert.equal(app.api.plan.projectTitle, 'A saved plan'); assert.equal(app.api.approvalStage, 'budget');
  app.api.selectProject(2); let api = await app.render();
  assert.equal(api.plan.projectTitle, 'B saved plan'); assert.equal(api.approvalStage, 'materials');
  await api.send('Continue only B'); api = await app.render();
  assert.equal(app.calls[0][3].projectTitle, 'B saved plan'); assert.equal(app.calls[0][5], 2);
  assert.equal(app.calls[0][0][0].content, 'B brief and saved reply');
  api.selectProject(1); api = await app.render(); assert.equal(api.plan.projectTitle, 'A saved plan');
  assert.equal(api.messages[0].content, 'A brief and saved reply');
  api.startFresh(3); api = await app.render(); assert.equal(api.plan, null); assert.equal(api.messages.length, 0);
});

test('unique drafts link only to their own new project and cannot overwrite another project history', async () => {
  const app = await provider({ 1: conversation('Existing house', 100) }, { active: '1' });
  app.api.reset(); let api = await app.render(); const first = api.activeProjectKey;
  await api.send('Unsaved project brief'); api = await app.render();
  api.reset(); api = await app.render(); assert.notEqual(api.activeProjectKey, first);
  assert.equal(api.messages.length, 0);
  await api.send('Second brief'); api = await app.render(); api.linkToProject(3); api = await app.render();
  assert.equal(api.activeProjectKey, '3'); assert.equal(api.messages[0].content, 'Second brief');
  const records = JSON.parse(app.storage.get('panday_plan_conversations:42'));
  assert.equal(records[first].messages[0].content, 'Unsaved project brief');
  assert.equal(records['1'].messages[0].content, 'Existing house');
  assert.throws(() => api.linkToProject(1), /cannot be moved/);
});

test('switching project ignores delayed chunks and responses; stale send callbacks cannot use another project context', async () => {
  let resolve; const reply = new Promise((done) => { resolve = done; }); const chunks = [];
  const app = await provider({ 1: conversation('Project A', 100), 2: conversation('Project B', 50) }, { active: '1', generate: () => reply });
  const sending = app.api.send('A request', (chunk) => chunks.push(chunk));
  await new Promise(done => setImmediate(done));
  app.api.selectProject(2); let api = await app.render();
  app.calls[0][2]('Late text from A'); resolve({ message: 'Late A response' });
  await assert.rejects(sending, /selected project changed/); api = await app.render();
  assert.equal(api.messages[0].content, 'Project B'); assert.equal(chunks.length, 0);
  assert.equal(api.loading, false); assert.equal(api.error, null);
  await assert.rejects(app.api.send('stale callback'), /Select the project again/);
  await assert.rejects(app.api.getFinalizationKey(), /selected project changed/);
  assert.throws(() => app.api.linkToProject(9), /selected project changed/);
  assert.equal(app.requests(), 1);
});

test('planner header names the active project and route isolates its local UI only after hydration', () => {
  let state = { ready: true, activeProjectKey: '2', activeProjectTitle: 'Cruz Residence' };
  const deps = {
    'react/jsx-runtime': runtime,
    'react-native': { View: 'View', Text: 'Text', ActivityIndicator: 'Spinner' },
    '@/context/PlanContext': { usePlan: () => state }, '@/context/ThemeContext': { useTheme: () => ({ chrome: {} }) },
    '@/screens/homeowner/ProjectChat': { __esModule: true, default: 'Chat' },
  };
  const Title = load('src/components/PlannerTitle.tsx', deps).default;
  deps['@/components/ActiveProjectGate'] = { __esModule: true, default: load('src/components/ActiveProjectGate.tsx', deps).default };
  const Route = load('src/app/(app)/homeowner/(tabs)/project-chat.tsx', deps).default;
  const title = Title(); assert.equal(nodes(title, 'Text')[0].props.children, 'PandAI');
  assert.equal(nodes(title, 'Text')[1].props.children, 'Cruz Residence');
  assert.equal(Route().props.children.key, '2');
  state = { ...state, activeProjectKey: '1', activeProjectTitle: 'Padlan House' };
  assert.equal(Route().props.children.key, '1'); assert.equal(nodes(Title(), 'Text')[1].props.children, 'Padlan House');
  const switchedGate = Route();
  assert.equal(switchedGate.type(switchedGate.props).props.children[0].key, '1', 'Project switches also reset screen-local data');
  state = { ready: false, activeProjectKey: 'draft:test' };
  assert.equal(nodes(Route(), 'Spinner').length, 1);
  const gate = Route(); assert.equal(gate.type(gate.props).props.children[0].props.style.display, 'none');
  assert.equal(nodes(Route(), 'Chat').length, 1, 'Keep keyboard hooks mounted while the cached view is hidden');
  state = { ...state, ready: true }; assert.equal(nodes(Title(), 'Text')[1].props.children, 'Select a project');
});

test('planner refresh requests only the selected ID, ignores stale responses, and leaves no-selection to the existing chooser', async () => {
  const hook = hooks(); const requests = []; const selected = []; const named = [];
  const pending = new Map();
  const context = { plan: null, messages: [], approvalStage: null, ready: true, activeProjectKey: '2', restoredVersion: 0,
    selectProject: (...args) => selected.push(args), syncProjectNaming: (...args) => named.push(args) };
  const Chat = load('src/screens/homeowner/ProjectChat.tsx', {
    react: hook.react, 'react/jsx-runtime': runtime,
    'react-native': { Text: 'Text', View: 'View', TextInput: 'Input', Pressable: 'Pressable', ScrollView: 'Scroll' },
    'expo-router': { router: {}, useFocusEffect: (fn) => hook.react.useEffect(fn, [fn]) },
    'react-native-safe-area-context': { useSafeAreaInsets: () => ({ bottom: 24 }) }, '@expo/vector-icons': { Ionicons: 'Icon' },
    '@/context/PlanContext': { usePlan: () => context }, '@/context/ThemeContext': { useTheme: () => ({ chrome: {} }) },
    '@/components/SupplierPicker': {}, '@/components/BudgetCategoryBreakdown': {}, '@/components/charts': {},
    '@/utils/currency': {}, '@/utils/budget': {}, '@/utils/timeline': {}, '@/utils/garage': {}, '@/utils/chatTime': {},
    '@/services/api/projects': { fetchMyHomeownerProjects: async () => [], fetchActiveDashboard: (id) => {
      requests.push(id); return new Promise((resolve) => pending.set(id, resolve));
    } },
    '@/components/Mascot': { __esModule: true, default: 'Mascot' }, '@/components/ProjectNamePrompt': { __esModule: true, default: 'Naming' },
    'react-native-reanimated': { __esModule: true, default: { View: 'Animated' }, useAnimatedStyle: (fn) => fn() },
    'react-native-keyboard-controller': { useKeyboardState: () => false, useReanimatedKeyboardAnimation: () => ({ height: { value: 0 } }) },
    '@/components/PlanEditorSheet': {}, '@/components/ExportPdfButton': {}, '@/utils/pdf': {}, 'expo-clipboard': {},
  });
  await hook.settle(Chat.default);
  context.activeProjectKey = '3'; await hook.settle(Chat.default);
  pending.get(2)({ project: { id: 2, title: 'Old response' } });
  pending.get(3)({ project: { id: 3, title: 'Selected residence', status: 'not_started', approvedPlan: null } });
  await hook.settle(Chat.default);
  assert.deepEqual(requests, [2, 3]); assert.equal(selected.length, 1); assert.equal(selected[0][0], 3);
  assert.equal(selected[0][2], 'Selected residence'); assert.equal(named.length, 1);
  context.activeProjectKey = 'draft:unique'; await hook.settle(Chat.default);
  assert.deepEqual(requests, [2, 3], 'no default dashboard request without a selected project');
});

test('accounts cannot load each other\'s histories and failed hydration never overwrites stored records', async () => {
  const storage = new Map([['panday_plan_conversations:42', JSON.stringify({ 1: conversation('Private history', 100) })], ['panday_plan_conversations:42:active', '1']]);
  const other = await provider(null, { storage, userId: 99 });
  assert.equal(other.api.messages.length, 0); assert.match(other.api.activeProjectKey, /^draft:/);
  const before = storage.get('panday_plan_conversations:42');
  const failed = await provider(null, { storage, readFailure: true });
  assert.equal(failed.api.ready, false); assert.match(failed.api.error, /saved conversations/);
  assert.equal(storage.get('panday_plan_conversations:42'), before);
});

test('chat keeps its existing single keyboard lift and only system-safe padding after bar removal', () => {
  const hook = hooks();
  let visible = false;
  let defaultProjectFetches = 0;
  const react = { ...hook.react, useEffect() {} };
  const { default: Chat } = load('src/screens/homeowner/ProjectChat.tsx', {
    react, 'react/jsx-runtime': runtime,
    'react-native': { Text: 'Text', View: 'View', TextInput: 'Input', Pressable: 'Pressable', ScrollView: 'Scroll' },
    'expo-router': { router: {}, useFocusEffect: (callback) => callback() },
    'react-native-safe-area-context': { useSafeAreaInsets: () => ({ bottom: 24, left: 0, right: 0, top: 24 }) },
    '@expo/vector-icons': { Ionicons: 'Icon' },
    '@/context/PlanContext': { usePlan: () => ({ plan: null, messages: [], ready: true, activeProjectKey: 'draft', resumeLatestRequested: true }) },
    '@/context/ThemeContext': { useTheme: () => ({ chrome: {} }) },
    '@/components/SupplierPicker': {}, '@/components/BudgetCategoryBreakdown': {}, '@/components/charts': {},
    '@/utils/currency': {}, '@/utils/budget': {}, '@/utils/timeline': {}, '@/utils/garage': {},
    '@/utils/chatTime': {},
    '@/services/api/projects': { fetchMyHomeownerProjects: async () => [], fetchActiveDashboard: async () => { defaultProjectFetches++; return {}; } },
    '@/components/Mascot': { __esModule: true, default: 'Mascot' },
    'react-native-reanimated': { __esModule: true, default: { View: 'Animated' }, useAnimatedStyle: (fn) => fn() },
    'react-native-keyboard-controller': { useKeyboardState: () => visible, useReanimatedKeyboardAnimation: () => ({ height: { value: visible ? -300 : 0 } }) },
    '@/components/PlanEditorSheet': {}, '@/components/ExportPdfButton': {}, '@/utils/pdf': {},
    '@/components/ProjectNamePrompt': { __esModule: true, default: 'ProjectNamePrompt' },
    'expo-clipboard': {},
  });
  for (const open of [false, true, false, true, false]) {
    visible = open;
    const tree = hook.render(Chat);
    const container = tree.props.children;
    assert.equal(flat(container.props.style).paddingBottom, open ? 300 : 0);
    const [list, , composer] = container.props.children;
    assert.equal(list.type, 'Scroll');
    assert.equal(composer.props.style.paddingBottom, open ? 12 : 40);
    assert.equal(composer.props.style.flexShrink, 0);
    const input = nodes(composer, 'Input')[0];
    assert.equal(input.props.multiline, true);
    assert.equal(input.props.style.maxHeight, 120);
  }
  assert.equal(defaultProjectFetches, 0, 'empty history is not silently replaced with a default project');
});

test('Home planning index restores all independent local/server drafts and preserves selected context through restarts', async () => {
  const saved = {
    'draft:one': conversation('First independent conversation', 100),
    'draft:two': { ...conversation('Second independent conversation', 200), approvalStage: 'materials', plan: { projectTitle: 'Draft estimate', materials: [{ name: 'Saved cement' }], budgetBreakdown: [{ amount: 20 }] } },
    4: conversation('Server placeholder conversation', 300),
    5: conversation('Completed conversation retained', 400),
    6: conversation('Ongoing construction retained', 500),
  };
  const projects = [{ id: 4, status: 'not_started', title: 'New Project' }, { id: 5, status: 'completed' }, { id: 6, status: 'active' }];
  const app = await provider(saved, { active: '6', projects });
  let api = await app.render();
  assert.equal(api.activeProjectKey, '6'); assert.equal(api.planningSessionsReady, true);
  assert.deepEqual(Array.from(api.planningSessions, session => session.key), ['4', 'draft:two', 'draft:one']);
  assert.equal(api.resumePlanningSession('draft:two'), true); api = await app.render();
  assert.equal(api.messages[0].content, 'Second independent conversation');
  assert.equal(api.approvalStage, 'materials'); assert.equal(api.plan.materials[0].name, 'Saved cement');
  assert.equal(api.planningSessions.find(session => session.key === 'draft:two').stages.budget, 'Approved');
  const stamp = api.planningSessions.find(session => session.key === 'draft:two').savedAt;
  assert.equal(stamp, new Date(200).toISOString(), 'Opening a draft must not invent a new save timestamp');
  api.resumePlanningSession('draft:one'); api = await app.render();
  assert.equal(api.messages[0].content, 'First independent conversation'); assert.equal(api.plan, null);
  assert.equal(api.resumePlanningSession('5'), false); assert.equal(api.resumePlanningSession('999'), false);
  const restarted = await provider({}, { storage: app.storage, projects });
  assert.equal(restarted.api.activeProjectKey, 'draft:one');
  assert.equal(restarted.api.planningSessions.length, 3);
  restarted.api.resumePlanningSession('draft:two'); const restored = await restarted.render();
  assert.equal(restored.approvalStage, 'materials'); assert.equal(restored.plan.projectTitle, 'Draft estimate');
  assert.equal(restored.getProjectMessages(5)[0].content, 'Completed conversation retained');
});

test('starting and saving another draft preserves previous drafts, and another account cannot list or resume them', async () => {
  const app = await provider({ 'draft:old': conversation('Original saved draft', 100) }, { active: 'draft:old', projects: [] });
  app.api.reset(); let api = await app.render();
  const newKey = api.activeProjectKey; assert.notEqual(newKey, 'draft:old');
  assert.deepEqual(Array.from(api.planningSessions, session => session.key), ['draft:old'], 'Do not advertise empty automatic drafts');
  await api.send('New independent draft'); api = await app.render();
  assert.equal(api.planningSessions.length, 2);
  assert.ok(api.planningSessions.find(session => session.key === newKey).savedAt);
  api.resumePlanningSession('draft:old'); api = await app.render();
  assert.equal(api.messages[0].content, 'Original saved draft');
  const other = await provider({}, { storage: app.storage, userId: 43, projects: [] });
  assert.equal(other.api.planningSessions.length, 0);
  assert.equal(other.api.resumePlanningSession('draft:old'), false);
  assert.equal(other.api.resumePlanningSession(newKey), false);
  const loggedBackIn = await provider({}, { storage: app.storage, projects: [] });
  assert.equal(loggedBackIn.api.planningSessions.length, 2);
  loggedBackIn.api.resumePlanningSession(newKey); const continued = await loggedBackIn.render();
  assert.equal(continued.messages[0].content, 'New independent draft');
});

test('legacy draft migration preserves an unselected conversation while saved construction stays selected', async () => {
  const app = await provider({ draft: conversation('Legacy unfinished conversation', 100), 3: conversation('Selected construction', 200) },
    { active: '3', projects: [{ id: 3, status: 'active' }] });
  const api = await app.render(); assert.equal(api.activeProjectKey, '3');
  assert.equal(api.planningSessions.length, 1);
  const key = api.planningSessions[0].key; assert.ok(key.startsWith('draft:'));
  api.resumePlanningSession(key); const resumed = await app.render();
  assert.equal(resumed.messages[0].content, 'Legacy unfinished conversation');
  assert.equal(resumed.getProjectMessages(3)[0].content, 'Selected construction');
});

test('planning statuses follow recorded approval stages and do not mistake approved/completed construction for drafts', () => {
  const { resumablePlanningSessions } = load('src/utils/activeProject.ts');
  for (const [stage, expected] of [
    ['plan', ['Pending Approval', 'Not Started', 'Not Started']],
    ['budget', ['Approved', 'Pending Approval', 'Not Started']],
    ['materials', ['Approved', 'Approved', 'Pending Approval']],
    ['summary', ['Approved', 'Approved', 'Approved']],
  ]) {
    const sessions = resumablePlanningSessions({ 'draft:one': { ...conversation('Saved', 100), plan: { projectTitle: 'Estimate' }, approvalStage: stage } }, []);
    assert.deepEqual([sessions[0].stages.plan, sessions[0].stages.budget, sessions[0].stages.materials], expected);
  }
  const sessions = resumablePlanningSessions({
    'draft:unknown': conversation('Legacy activity without timestamp'), 'draft:blank': conversation(''),
    1: { ...conversation('Approved plan', 100), approvalStage: 'summary' },
    2: { ...conversation('Finished work', 200), approvalStage: 'plan' },
    3: { ...conversation('Renamed elsewhere', 300), projectNaming: { pending: true, title: 'Old name' } },
    99: conversation('Deleted or foreign ID', 400),
  }, [{ id: 1, status: 'active', hasApprovedPlan: true }, { id: 2, status: 'completed' },
    { id: 3, status: 'active', projectNamePending: false }, { id: 4, status: 'not_started', createdAt: '2026-11-01T01:00:00Z' }]);
  assert.deepEqual(Array.from(sessions, session => session.key).sort(), ['4', 'draft:unknown']);
  assert.equal(sessions.find(session => session.key === 'draft:unknown').updatedAt, null);
  assert.equal(sessions.find(session => session.key === '4').updatedAt, '2026-11-01T01:00:00.000Z');
  assert.equal(sessions.find(session => session.key === '4').savedAt, null, 'A server placeholder timestamp is not a recorded chat-save event');
});

test('a lost finalization response recovers only the exact retry identity and resumes the saved naming step', async () => {
  const original = { ...conversation('Original finalized draft conversation', 100), finalizationKey: 'draft-retry-identity',
    plan: { projectTitle: 'Original proposal', materials: [{ name: 'Retained estimate' }], budgetBreakdown: [{ amount: 50 }] }, approvalStage: 'materials' };
  const projects = [{ id: 9, title: 'Saved project', status: 'active', hasApprovedPlan: true, projectNamePending: true, finalizationKey: 'draft-retry-identity' }];
  const app = await provider({ 'draft:lost-response': original }, { active: 'draft:lost-response', projects });
  const api = await app.render();
  assert.equal(api.activeProjectKey, '9'); assert.equal(api.messages[0].content, original.messages[0].content);
  assert.equal(api.plan.materials[0].name, 'Retained estimate');
  assert.equal(api.approvalStage, 'summary'); assert.equal(api.projectNaming.pending, true);
  assert.deepEqual(Array.from(api.planningSessions, session => session.key), ['9']);
  const cached = JSON.parse(app.storage.get('panday_plan_conversations:42'));
  assert.equal(cached['9'].finalizationKey, original.finalizationKey);
  assert.equal(cached['draft:lost-response'], undefined, 'The same conversation moves once, without duplication');
  assert.equal(app.requests(), 0);
});

test('a detached finalized draft can never reactivate completed construction and its original messages remain readable', async () => {
  const original = { ...conversation('Completed project original conversation', 100), finalizationKey: 'completed-retry-identity', plan: { budget: 80 } };
  const projects = [{ id: 9, title: 'Finished home', status: 'completed', hasApprovedPlan: true, projectNamePending: false, finalizationKey: 'completed-retry-identity' }];
  const app = await provider({ 'draft:detached': original }, { active: 'draft:detached', projects });
  let api = await app.render();
  assert.notEqual(api.activeProjectKey, '9'); assert.ok(api.activeProjectKey.startsWith('draft:'));
  assert.equal(api.planningSessions.length, 0); assert.equal(api.messages.length, 0);
  assert.equal(api.getProjectMessages(9)[0].content, original.messages[0].content);
  assert.equal(JSON.parse(app.storage.get('panday_plan_conversations:42'))['9'].plan.budget, 80);
  const restarted = await provider({}, { storage: app.storage, projects }); api = await restarted.render();
  assert.notEqual(api.activeProjectKey, '9'); assert.equal(api.planningSessions.length, 0);
  assert.equal(api.getProjectMessages(9)[0].content, original.messages[0].content);
});

test('finalization recovery never overwrites an existing saved conversation or exposes a duplicate draft', async () => {
  const saved = { 'draft:recovery-copy': { ...conversation('Retained recovery copy', 100), finalizationKey: 'same-project-retry' }, 9: conversation('Existing saved conversation', 200) };
  const app = await provider(saved, { active: 'draft:recovery-copy', projects: [{ id: 9, title: 'Existing project', status: 'active', projectNamePending: false, finalizationKey: 'same-project-retry' }] });
  const api = await app.render(); assert.equal(api.activeProjectKey, '9'); assert.equal(api.planningSessions.length, 0);
  assert.equal(api.messages[0].content, 'Existing saved conversation');
  const cached = JSON.parse(app.storage.get('panday_plan_conversations:42'));
  assert.equal(cached['draft:recovery-copy'].messages[0].content, 'Retained recovery copy');
  assert.equal(cached['9'].messages[0].content, 'Existing saved conversation');
});
