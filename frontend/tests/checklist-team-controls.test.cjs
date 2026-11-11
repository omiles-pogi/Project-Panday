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
  vm.runInNewContext(outputText, { exports, require(name) { if (name in mocks) return mocks[name]; throw new Error(`Unexpected dependency ${name}`); } }, { filename });
  return exports;
}
const jsx = (type, props) => ({ type, props });
const runtime = { jsx, jsxs: jsx };
const colors = load('src/theme/colors.ts', {});
const tick = () => new Promise((resolve) => setImmediate(resolve));
function nodes(node, type) {
  if (!node || typeof node !== 'object') return [];
  if (Array.isArray(node)) return node.flatMap((value) => nodes(value, type));
  return [...(node.type === type || node.type?.name === type ? [node] : []), ...nodes(node.props?.children, type)];
}
function hooks() {
  const slots = []; let cursor = 0;
  return { react: {
    useState(initial) { const i = cursor++; if (!(i in slots)) slots[i] = typeof initial === 'function' ? initial() : initial;
      return [slots[i], (value) => { slots[i] = typeof value === 'function' ? value(slots[i]) : value; }]; },
    useEffect: () => {}, useCallback: (fn) => fn,
  }, render(fn) { cursor = 0; return fn(); } };
}

test('checklist task text follows the theme while toggle, delete, add and phase confirmations retain their API arguments', async () => {
  for (const mode of ['light', 'dark']) {
    const hook = hooks(); const calls = []; const confirmations = []; let refreshed = 0;
    const chrome = mode === 'light' ? colors.lightChrome : colors.darkChrome;
    const api = Object.fromEntries(['addPhaseTask', 'checkAllTasks', 'deletePhaseTask', 'submitProjectCompletion', 'togglePhaseTask', 'uncheckAllTasks']
      .map((name) => [name, async (...args) => calls.push([name, ...args])]));
    const Card = load('src/components/ProjectChecklistCard.tsx', {
      react: hook.react, 'react/jsx-runtime': runtime, 'react-native': { Text: 'Text', View: 'View', Pressable: 'Pressable' },
      '@expo/vector-icons': { Ionicons: 'Icon' }, '@/components/ui': { Button: 'Button', Field: 'Field', ProgressBar: 'ProgressBar' },
      '@/components/ConfirmDialog': { useConfirmDialog: () => ({ ask: (options) => confirmations.push(options), dialog: null }) },
      '@/services/api/projects': api, '@/context/ThemeContext': { useTheme: () => ({ mode, chrome }) },
    }).default;
    const project = { id: 7, title: 'Saved house', canManageChecklist: true, checklistLocked: false, canSubmitCompletion: false,
      checklist: { pct: 50, totalTasks: 2, doneTasks: 1 }, phases: [{ id: 8, name: 'Foundation', progressPct: 50,
        tasks: [{ id: 9, description: 'Check excavation', isDone: false }, { id: 10, description: 'Site cleared', isDone: true }] }] };
    const render = () => hook.render(() => {
      const root = Card({ project, onChanged: async () => { refreshed++; } });
      const phase = nodes(root, 'PhaseChecklist')[0];
      return phase.type(phase.props);
    });
    let tree = render();
    const description = nodes(tree, 'Text').find((node) => node.props.children === 'Check excavation');
    assert.equal(description.props.style.color, chrome.foreground);
    nodes(tree, 'Pressable').find((node) => node.props.accessibilityRole === 'checkbox').props.onPress();
    await tick(); tree = render(); assert.deepEqual(calls.at(-1), ['togglePhaseTask', 7, 8, 9, true]);
    let stopped = false;
    nodes(tree, 'Pressable').find((node) => node.props.accessibilityLabel === 'Delete Check excavation').props.onPress({ stopPropagation() { stopped = true; } });
    await tick(); tree = render(); assert.equal(stopped, true); assert.deepEqual(calls.at(-1), ['deletePhaseTask', 7, 8, 9]);
    nodes(tree, 'Field')[0].props.onChangeText('  Final inspection  '); tree = render();
    nodes(tree, 'Field')[0].props.onSubmitEditing(); await tick(); tree = render();
    assert.deepEqual(calls.at(-1), ['addPhaseTask', 7, 8, 'Final inspection']);
    assert.equal(nodes(tree, 'Field')[0].props.value, '');
    for (const label of ['Check All', 'Uncheck All']) {
      nodes(tree, 'Button').find((node) => node.props.label === label).props.onPress();
      assert.equal(confirmations.at(-1).detail.includes('Foundation'), true);
      confirmations.at(-1).onConfirm(); await tick(); tree = render();
    }
    assert.deepEqual(calls.slice(-2), [['checkAllTasks', 7, 8], ['uncheckAllTasks', 7, 8]]);
    assert.equal(refreshed, 5);
    assert.equal(nodes(tree, 'Field')[0].props.style.backgroundColor, chrome.card);
  }
});

test('skills and services still trim, deduplicate and submit through the original search functions', async () => {
  const hook = hooks(); const searches = [];
  const FindWorkers = load('src/screens/homeowner/FindWorkers.tsx', {
    react: hook.react, 'react/jsx-runtime': runtime,
    'expo-router': { useFocusEffect: () => {} },
    'react-native': { Text: 'Text', View: 'View', Pressable: 'Pressable', ActivityIndicator: 'Spinner' },
    '@expo/vector-icons': { Ionicons: 'Icon' },
    '@/components/ui': Object.fromEntries(['Badge', 'Card', 'Field', 'PageHeader', 'Screen', 'SubmitButton'].map((name) => [name, name])),
    '@/services/api/workers': { searchWorkers: async (params) => { searches.push(['workers', params]); return []; } },
    '@/services/api/contractors': { searchContractors: async (params) => { searches.push(['contractors', params]); return []; } },
    '@/services/api/projects': {}, '@/context/PlanContext': { usePlan: () => ({ plan: null, ready: true, activeProjectKey: '7' }) },
    '@/context/ThemeContext': { useTheme: () => ({ chrome: colors.lightChrome }) },
    '@/utils/teamRecommendations': { recommendedSkillsForPlan: () => [] }, '@/utils/currency': {}, '@/utils/wage': {},
  }).default;
  let tree = hook.render(FindWorkers);
  const field = () => nodes(tree, 'Field').find((node) => node.props.label === '');
  field().props.onChangeText('  Concrete Work  '); tree = hook.render(FindWorkers);
  const add = nodes(tree, 'Pressable').find((node) => node.props.accessibilityLabel === 'Add skill');
  assert.equal(add.props.style.height, 44); assert.equal(add.props.style.flexShrink, 0);
  add.props.onPress(); tree = hook.render(FindWorkers); assert.equal(field().props.value, '');
  field().props.onChangeText('concrete work'); tree = hook.render(FindWorkers);
  nodes(tree, 'Pressable').find((node) => node.props.accessibilityLabel === 'Add skill').props.onPress(); tree = hook.render(FindWorkers);
  nodes(tree, 'SubmitButton')[0].props.onPress(); await tick(); tree = hook.render(FindWorkers);
  assert.equal(searches[0][0], 'workers'); assert.deepEqual([...searches[0][1].skills], ['Concrete Work']);
  nodes(tree, 'Pressable').find((node) => node.props.children?.props?.children === 'Contractors').props.onPress();
  await tick(); tree = hook.render(FindWorkers);
  assert.ok(nodes(tree, 'Pressable').find((node) => node.props.accessibilityLabel === 'Add service'));
  field().props.onChangeText('Project Management'); tree = hook.render(FindWorkers);
  field().props.onSubmitEditing(); tree = hook.render(FindWorkers);
  nodes(tree, 'SubmitButton')[0].props.onPress(); await tick();
  assert.equal(searches.at(-1)[0], 'contractors');
  assert.deepEqual([...searches.at(-1)[1].skills], ['Project Management']);
});
