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
const jsx = (type, props) => ({ type, props });
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
      if (!equal(slots[index], deps)) { slots[index] = deps; effects.push(effect); }
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

test('five positions preserve original route keys, params, prevented events, and latest-chat callback', () => {
  const app = bar();
  const buttons = nodes(app.render(), 'Pressable');
  assert.deepEqual(buttons.map((button) => nodes(button, 'Text')[0].props.children), ['Home', 'Progress', 'AI', 'Budget', 'Workers']);
  buttons.forEach((button) => button.props.onPress());
  assert.deepEqual(app.navigated, ['original-progress', 'original-project-chat', 'original-budget-monitor', 'original-marketplace']);
  assert.equal(app.resumed(), 1);
  assert.equal(app.props.state.routes[4].params.retained, 'marketplace');
  buttons[4].props.onLongPress();
  assert.equal(app.events.at(-1).type, 'tabLongPress');
  app.prevent();
  buttons[2].props.onPress();
  assert.equal(app.resumed(), 1);
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
async function provider(saved) {
  const hook = hooks();
  const storage = new Map([['panday_plan_conversations:42', JSON.stringify(saved)]]);
  let requests = 0;
  const { PlanProvider } = load('src/context/PlanContext.tsx', {
    react: hook.react, 'react/jsx-runtime': runtime,
    '@react-native-async-storage/async-storage': { getItem: async (key) => storage.get(key), setItem: async (key, value) => storage.set(key, value) },
    '@/context/AuthContext': { useAuth: () => ({ user: { id: 42 } }) },
    '@/types/plan': { isChatReply: () => true, isClarificationNeeded: () => false },
    '@/services/ai/client': { generateConstructionPlan: async () => { requests++; return { message: 'Reply' }; } },
    '@/utils/garage': {}, '@/utils/timeline': { normalizePlanTimeline: (value) => value, timelineLabel: () => '' },
  });
  const render = async () => (await hook.settle(() => PlanProvider({ children: null }))).props.value;
  return { render, api: await render(), storage, requests: () => requests };
}

test('hydration and empty placeholders cannot displace latest real history; old threads remain accessible', async () => {
  const saved = { 1: conversation('Newest', 200), 2: conversation('Older', 100), 3: conversation('', 999), draft: conversation('', 1000) };
  const app = await provider(saved);
  app.api.openMostRecent();
  let api = await app.render();
  assert.equal(api.activeProjectKey, '1');
  assert.equal(api.messages[0].content, 'Newest');
  assert.equal(api.resumeLatestRequested, true);
  api.selectProject(2);
  api = await app.render();
  assert.equal(api.messages[0].content, 'Older');
  assert.equal(api.resumeLatestRequested, false);
  api.openMostRecent(); api = await app.render();
  assert.equal(api.activeProjectKey, '1');
  assert.deepEqual(JSON.parse(app.storage.get('panday_plan_conversations:42')), saved);
  assert.equal(app.requests(), 0);
});

test('message and approval activity mark latest history; reads do not advance recency', async () => {
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
  const restarted = await provider(saved);
  restarted.api.openMostRecent();
  api = await restarted.render();
  assert.equal(api.activeProjectKey, '2');
  assert.equal(api.messages.at(-1).content, 'Reply');
  assert.equal(restarted.requests(), 0);
});

test('no history stays on the existing empty draft without AI requests', async () => {
  const app = await provider({});
  const before = app.storage.get('panday_plan_conversations:42');
  app.api.openMostRecent();
  const api = await app.render();
  assert.equal(api.activeProjectKey, 'draft');
  assert.equal(api.messages.length, 0);
  assert.equal(api.resumeLatestRequested, true);
  assert.equal(app.storage.get('panday_plan_conversations:42'), before);
  assert.equal(app.requests(), 0);
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
