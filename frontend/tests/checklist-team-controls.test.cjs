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
    useRef(value) { const i = cursor++; return slots[i] ??= { current: value }; },
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
    const project = { id: 7, title: 'Saved house', status: 'active', canManageChecklist: true, checklistLocked: false, canSubmitCompletion: false,
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
    const toggle = nodes(tree, 'Pressable').find((node) => node.props.accessibilityRole === 'checkbox').props.onPress;
    toggle(); toggle();
    await tick(); tree = render(); assert.deepEqual(calls.at(-1), ['togglePhaseTask', 7, 8, 9, true]);
    assert.equal(calls.filter(call => call[0] === 'togglePhaseTask').length, 1);
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

test('drawer skills and services trim and deduplicate before submitting the original search parameters', () => {
  const model=load('src/utils/workersFilters.ts',{});
  for(const type of ['worker','contractor']) {
    const filters=model.normalizeWorkerFilters({type,specialty:'  Residential  ',skills:['  Concrete Work  ','concrete work'],minRate:'',maxRate:''});
    assert.deepEqual(Array.from(filters.skills),['concrete work']);
    const query=model.workerFilterQuery(type,filters);
    assert.deepEqual(Array.from(query.skills),['concrete work']);
    assert.equal(query[type==='worker'?'trade':'specialization'],'Residential');
  }
});
