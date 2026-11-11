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
  vm.runInNewContext(outputText, { exports, ...globals, require(name) {
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
async function provider(saved, options = {}) {
  const hook = hooks();
  const storage = options.storage ?? new Map([['panday_plan_conversations:42', JSON.stringify(saved)]]);
  if (options.active) storage.set('panday_plan_conversations:42:active', options.active);
  let requests = 0;
  const calls = [];
  const { PlanProvider } = load('src/context/PlanContext.tsx', {
    react: hook.react, 'react/jsx-runtime': runtime,
    '@react-native-async-storage/async-storage': { getItem: async (key) => { if (options.readFailure) throw new Error('Disk unavailable'); return storage.get(key); }, setItem: async (key, value) => storage.set(key, value) },
    '@/context/AuthContext': { useAuth: () => ({ user: { id: options.userId ?? 42 } }) },
    '@/types/plan': { isChatReply: () => true, isClarificationNeeded: () => false },
    '@/services/ai/client': { generateConstructionPlan: async (...args) => { requests++; calls.push(args); return options.generate ? options.generate(...args) : { message: 'Reply' }; } },
    '@/utils/garage': {}, '@/utils/timeline': { normalizePlanTimeline: (value) => value, timelineLabel: () => '' },
  });
  const render = async () => (await hook.settle(() => PlanProvider({ children: null }))).props.value;
  return { render, api: await render(), storage, calls, requests: () => requests };
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
  const Route = load('src/app/(app)/homeowner/(tabs)/project-chat.tsx', deps).default;
  const title = Title(); assert.equal(nodes(title, 'Text')[0].props.children, 'PandAI');
  assert.equal(nodes(title, 'Text')[1].props.children, 'Cruz Residence');
  assert.equal(Route().key, '2');
  state = { ...state, activeProjectKey: '1', activeProjectTitle: 'Padlan House' };
  assert.equal(Route().key, '1'); assert.equal(nodes(Title(), 'Text')[1].props.children, 'Padlan House');
  state = { ready: false, activeProjectKey: 'draft:test' };
  assert.equal(nodes(Route(), 'Spinner').length, 1); assert.equal(nodes(Route(), 'Chat').length, 0);
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
    '@/services/api/projects': { fetchMyHomeownerProjects: async () => [], fetchDashboard: (id) => {
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
    '@/services/api/projects': { fetchMyHomeownerProjects: async () => [], fetchDashboard: async () => { defaultProjectFetches++; return {}; } },
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
    const input = composer.props.children[1].props.children[0];
    assert.equal(input.props.multiline, true);
    assert.equal(input.props.style.maxHeight, 120);
  }
  assert.equal(defaultProjectFetches, 0, 'empty history is not silently replaced with a default project');
});
