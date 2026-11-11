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
  vm.runInNewContext(outputText, { exports, Error, setTimeout, clearTimeout, require(name) {
    if (name in mocks) return mocks[name];
    throw new Error(`Unexpected dependency: ${name}`);
  } }, { filename });
  return exports;
}
const jsx = (type, props) => ({ type, props });
const runtime = { jsx, jsxs: jsx };
const moduleDefault = (value) => ({ __esModule: true, default: value });
function nodes(node, type) {
  if (!node || typeof node !== 'object') return [];
  if (Array.isArray(node)) return node.flatMap((child) => nodes(child, type));
  // Inspect component boundaries as well as native elements; do not execute nested cards here.
  return [...(node.type === type || node.type?.name === type ? [node] : []), ...nodes(node.props?.children, type)];
}
const tick = () => new Promise((resolve) => setImmediate(resolve));
function deferred() { let resolve, reject; const promise = new Promise((a, b) => { resolve = a; reject = b; }); return { promise, resolve, reject }; }
function hooks() {
  const slots = []; let cursor = 0; let dirty = false; let effects = [];
  const equal = (a, b) => a && b && a.length === b.length && a.every((value, i) => Object.is(value, b[i]));
  const react = {
    createContext: () => ({ Provider: 'Provider' }), useContext: () => null,
    useState(initial) { const i = cursor++; if (!(i in slots)) slots[i] = typeof initial === 'function' ? initial() : initial;
      return [slots[i], (value) => { const next = typeof value === 'function' ? value(slots[i]) : value; if (!Object.is(next, slots[i])) { slots[i] = next; dirty = true; } }]; },
    useRef(initial) { return slots[cursor++] ??= { current: initial }; },
    useCallback(callback, deps) { const i = cursor++; if (!equal(slots[i]?.deps, deps)) slots[i] = { callback, deps }; return slots[i].callback; },
    useEffect(effect, deps) { const i = cursor++; if (!equal(slots[i]?.deps, deps)) { effects.push(() => { slots[i]?.cleanup?.(); slots[i] = { deps, cleanup: effect() }; }); } },
  };
  return { react,
    render(fn) { cursor = 0; return fn(); },
    async settle(fn) { for (let i = 0; i < 30; i++) { cursor = 0; dirty = false; const result = fn(); const pending = effects; effects = []; pending.forEach((effect) => effect()); await tick(); if (!dirty) return result; } throw new Error('Render did not settle'); },
    unmount() { slots.forEach((slot) => slot?.cleanup?.()); },
  };
}
const plan = { projectTitle: 'AI title', location: 'Dagupan', areaSqm: 100, floors: 1, bedrooms: 2, bathrooms: 1,
  designStyle: 'Modern', budget: 900000, totalEstimate: 850000, timelineValue: 6, timelineUnit: 'months',
  exteriorConcept: 'Exterior', interiorConcept: 'Interior', phases: [], materials: [], budgetBreakdown: [] };

test('name API validates the project and requires backend confirmation before returning success', async () => {
  const calls = []; let response = { id: 7, title: 'My Residence', status: 'active', projectNamePending: false };
  class ApiError extends Error { constructor(data) { super('API failure'); this.data = data; } }
  const api = load('src/services/api/projectNaming.ts', { '@/services/api/client': { ApiError, apiFetch: async (...args) => {
    calls.push(args); if (response instanceof Error) throw response; return response;
  } } });
  await assert.rejects(api.saveProjectName(0, 'House'), /unavailable/);
  await assert.rejects(api.saveProjectName(7, '  '), /Enter a project name/);
  assert.equal(calls.length, 0);
  const saved = await api.saveProjectName(7, '  My Residence  ');
  assert.equal(saved.title, 'My Residence');
  assert.equal(calls[0][0], '/api/projects/7/name');
  assert.equal(calls[0][1].method, 'PATCH');
  assert.deepEqual(JSON.parse(calls[0][1].body), { name: 'My Residence' });
  response = { id: 8, title: 'Wrong project', projectNamePending: false };
  await assert.rejects(api.saveProjectName(7, 'House'), /Couldn't save/);
  response = new Error('SQLSTATE private credential');
  await assert.rejects(api.saveProjectName(7, 'House'), (error) => !/SQLSTATE|credential/.test(error.message));
  response = new ApiError({ errors: { name: ['This project already has a saved name.'] } });
  await assert.rejects(api.saveProjectName(7, 'House'), /already has a saved name/);
});

async function promptHarness(request) {
  const hook = hooks(); const saved = []; let naming = { projectId: 7, title: 'AI title', pending: true };
  const Prompt = load('src/components/ProjectNamePrompt.tsx', {
    react: hook.react, 'react/jsx-runtime': runtime,
    'react-native': { Pressable: 'Pressable', Text: 'Text', TextInput: 'Input', View: 'View' },
    '@/components/Mascot': moduleDefault('Mascot'), '@/context/ThemeContext': { useTheme: () => ({ chrome: {} }) },
    '@/services/api/projectNaming': { saveProjectName: request },
  }).default;
  const render = () => hook.settle(() => Prompt({ naming, onSaved: (value) => saved.push(value) }));
  return { hook, saved, render, named: (title) => { naming = { ...naming, title, pending: false }; } };
}

test('name prompt rejects blanks, locks duplicate taps, retains errors for retry, and confirms only a successful save', async () => {
  let pending = deferred(); let calls = 0;
  const prompt = await promptHarness(async () => { calls++; return pending.promise; });
  let tree = await prompt.render();
  assert.equal(nodes(tree, 'Input')[0].props.placeholder, 'e.g., Padlan Residence');
  assert.equal(nodes(tree, 'Pressable')[0].props.disabled, true);
  nodes(tree, 'Input')[0].props.onSubmitEditing(); await tick();
  assert.equal(calls, 0);
  nodes(tree, 'Input')[0].props.onChangeText('My Residence');
  tree = await prompt.render();
  const submit = nodes(tree, 'Pressable')[0].props.onPress;
  submit(); submit(); await tick();
  assert.equal(calls, 1); assert.equal(prompt.saved.length, 0);
  pending.reject(new Error('Connection lost')); await tick();
  tree = await prompt.render();
  assert.ok(nodes(tree, 'Text').some((node) => node.props.children === 'Connection lost'));
  assert.equal(prompt.saved.length, 0);
  pending = deferred();
  nodes(tree, 'Pressable')[0].props.onPress();
  pending.resolve({ id: 7, title: 'My Residence', status: 'active', projectNamePending: false }); await tick();
  assert.equal(prompt.saved.length, 1);
  prompt.named(prompt.saved[0].title);
  tree = await prompt.render();
  assert.equal(nodes(tree, 'Input').length, 0);
  assert.equal(nodes(tree, 'Pressable').length, 0);
  assert.ok(nodes(tree, 'Text').some((node) => String(node.props.children).includes('My Residence')));
});

test('leaving a naming prompt ignores a late response for the old conversation', async () => {
  const pending = deferred();
  const prompt = await promptHarness(async () => pending.promise);
  let tree = await prompt.render(); nodes(tree, 'Input')[0].props.onChangeText('My Residence');
  tree = await prompt.render(); nodes(tree, 'Pressable')[0].props.onPress();
  prompt.hook.unmount();
  pending.resolve({ id: 7, title: 'My Residence', projectNamePending: false }); await tick();
  assert.equal(prompt.saved.length, 0);
});

async function provider(storage, userId = 42, options = {}) {
  const hook = hooks();
  const Provider = load('src/context/PlanContext.tsx', {
    react: hook.react, 'react/jsx-runtime': runtime,
    '@react-native-async-storage/async-storage': { getItem: async (key) => storage.get(key), setItem: async (key, value) => storage.set(key, value) },
    '@/context/AuthContext': { useAuth: () => ({ user: { id: userId } }) },
    '@/types/plan': { isChatReply: (value) => 'message' in value, isClarificationNeeded: (value) => 'questions' in value },
    '@/services/ai/client': { generateConstructionPlan: async () => options.planReply ?? ({ message: 'Existing reply' }) },
    '@/utils/garage': { garageLabel: () => '' }, '@/utils/timeline': { normalizePlanTimeline: (value) => value, timelineLabel: () => '' },
  }).PlanProvider;
  const render = async () => (await hook.settle(() => Provider({ children: null }))).props.value;
  return { api: await render(), render };
}

test('retry keys persist before requests, survive reloads, and move with the single finalized project', async () => {
  const key = 'panday_plan_conversations:42';
  const storage = new Map([[key, JSON.stringify({ draft: { plan, messages: [{ role: 'assistant', content: 'Existing plan' }], approvalStage: 'materials', clarificationRounds: 0 } })]]);
  let app = await provider(storage);
  const [first, second] = await Promise.all([app.api.getFinalizationKey(), app.api.getFinalizationKey()]);
  assert.equal(first, second); assert.ok(first.length >= 16);
  const draftKey = app.api.activeProjectKey;
  assert.match(draftKey, /^draft:/);
  assert.equal(JSON.parse(storage.get(key))[draftKey].finalizationKey, first);
  app = await provider(storage);
  assert.equal(await app.api.getFinalizationKey(), first);
  app.api.linkToProject(7, { projectId: 7, title: 'AI title', pending: true });
  let api = await app.render();
  assert.equal(api.activeProjectKey, '7'); assert.equal(api.projectNaming.pending, true);
  const persisted = JSON.parse(storage.get(key));
  assert.equal(persisted[draftKey], undefined); assert.equal(persisted['7'].finalizationKey, first);
  assert.equal(persisted['7'].messages[0].content, 'Existing plan');
  const reopened = await provider(storage); reopened.api.selectProject(7); api = await reopened.render();
  assert.equal(api.projectNaming.pending, true); assert.equal(api.approvalStage, 'summary');
  const otherAccount = await provider(storage, 99);
  assert.equal(otherAccount.api.projectNaming, null);
});

test('saved names restore after login, update the plan title, and cannot be reverted by a stale dashboard response', async () => {
  const key = 'panday_plan_conversations:42';
  const storage = new Map([[key, JSON.stringify({ 7: { plan, messages: [{ role: 'assistant', content: 'Existing plan' }], approvalStage: 'summary', clarificationRounds: 0,
    projectNaming: { projectId: 7, title: 'AI title', pending: true } } })]]);
  let app = await provider(storage); app.api.selectProject(7); let api = await app.render();
  api.syncProjectNaming({ id: 7, title: 'My Residence', status: 'active', projectNamePending: false });
  api = await app.render();
  assert.equal(api.plan.projectTitle, 'My Residence'); assert.equal(api.projectNaming.pending, false);
  api.syncProjectNaming({ id: 7, title: 'AI title', status: 'active', projectNamePending: true });
  api.syncProjectNaming({ id: 8, title: 'Different project', status: 'active', projectNamePending: false });
  api = await app.render(); assert.equal(api.plan.projectTitle, 'My Residence');
  app = await provider(storage); app.api.selectProject(7); api = await app.render();
  assert.equal(api.projectNaming.title, 'My Residence'); assert.equal(api.projectNaming.pending, false);
  api.updatePlan({ ...plan, projectTitle: 'Local edit' });
  api = await app.render(); assert.equal(api.plan.projectTitle, 'My Residence');
  app = await provider(storage, 42, { planReply: { ...plan, projectTitle: 'AI suggested title' } });
  app.api.selectProject(7); api = await app.render();
  const reply = await api.send('Adjust my plan');
  assert.equal(reply.plan.projectTitle, 'My Residence');
});

async function chatHarness(request, options = {}) {
  const hook = hooks(); const calls = []; const linked = [];
  const context = {
    plan, messages: [{ role: 'assistant', content: 'Existing AI plan' }], approvalStage: 'materials', ready: true,
    activeProjectKey: options.projectKey ?? 'draft', restoredVersion: 0, resumeLatestRequested: true, projectNaming: null,
    getFinalizationKey: async () => { if (options.storageFailure) throw new Error('Disk failure'); return 'persisted-conversation-retry-key'; },
    setApprovalStage: (stage) => { context.approvalStage = stage; },
    linkToProject: (id, naming) => { linked.push(id); context.activeProjectKey = String(id); context.projectNaming = naming; },
    syncProjectNaming: () => {}, selectProject: () => {}, send: () => {}, updatePlan: () => {},
  };
  const send = async (...args) => { calls.push(args); return request(...args); };
  const Chat = load('src/screens/homeowner/ProjectChat.tsx', {
    react: hook.react, 'react/jsx-runtime': runtime,
    'react-native': { Text: 'Text', View: 'View', TextInput: 'Input', Pressable: 'Pressable', ScrollView: 'Scroll' },
    'expo-router': { router: {}, useFocusEffect: () => {} },
    'react-native-safe-area-context': { useSafeAreaInsets: () => ({ top: 24, bottom: 24 }) },
    '@expo/vector-icons': { Ionicons: 'Icon' }, '@/context/PlanContext': { usePlan: () => context },
    '@/context/ThemeContext': { useTheme: () => ({ chrome: {} }) },
    '@/components/SupplierPicker': {}, '@/components/BudgetCategoryBreakdown': {}, '@/components/charts': {},
    '@/utils/currency': {}, '@/utils/budget': {}, '@/utils/timeline': {}, '@/utils/garage': {}, '@/utils/chatTime': {},
    '@/services/api/projects': { createProject: send, startProjectFromPlan: send },
    '@/components/Mascot': moduleDefault('Mascot'), '@/components/ProjectNamePrompt': moduleDefault('Naming'),
    'react-native-reanimated': { ...moduleDefault({ View: 'Animated' }), useAnimatedStyle: (fn) => fn() },
    'react-native-keyboard-controller': { useKeyboardState: () => false, useReanimatedKeyboardAnimation: () => ({ height: { value: 0 } }) },
    '@/components/PlanEditorSheet': {}, '@/components/ExportPdfButton': {}, '@/utils/pdf': {}, 'expo-clipboard': {},
  }).default;
  const render = () => hook.settle(Chat);
  return { context, calls, linked, render, initial: await render() };
}

test('chat asks only after backend finalization and repeated taps share one keyed save', async () => {
  const pending = deferred();
  const chat = await chatHarness(async () => pending.promise);
  assert.equal(nodes(chat.initial, 'Naming').length, 0);
  const advance = nodes(chat.initial, 'AIBubble')[0].props.onAdvance;
  const first = advance(); const second = advance(); await tick();
  assert.equal(chat.calls.length, 1); assert.equal(chat.calls[0][1], 'persisted-conversation-retry-key');
  assert.equal(nodes(await chat.render(), 'Naming').length, 0);
  pending.resolve({ id: 7, title: 'AI title', status: 'active', projectNamePending: true });
  await first; await second;
  const tree = await chat.render();
  assert.deepEqual(chat.linked, [7]);
  assert.equal(nodes(tree, 'Naming')[0].props.naming.pending, true);
  assert.equal(chat.context.approvalStage, 'summary');
});

test('lost finalization responses retry the same key and storage failures send no project request', async () => {
  let attempts = 0;
  const chat = await chatHarness(async () => { if (++attempts === 1) throw new Error('Lost response'); return { id: 7, title: 'AI title', status: 'active', projectNamePending: true }; });
  await nodes(chat.initial, 'AIBubble')[0].props.onAdvance();
  let tree = await chat.render(); assert.equal(chat.linked.length, 0); assert.equal(nodes(tree, 'Naming').length, 0);
  await nodes(tree, 'AIBubble')[0].props.onAdvance(); tree = await chat.render();
  assert.equal(chat.calls.length, 2); assert.equal(chat.calls[0][1], chat.calls[1][1]);
  assert.deepEqual(chat.linked, [7]);
  const blocked = await chatHarness(async () => {}, { storageFailure: true });
  await nodes(blocked.initial, 'AIBubble')[0].props.onAdvance();
  assert.equal(blocked.calls.length, 0); assert.equal(blocked.linked.length, 0);
});

test('placeholder finalization uses its actual ID and ignores responses after switching conversations', async () => {
  const pending = deferred();
  const chat = await chatHarness(async () => pending.promise, { projectKey: '5' });
  const action = nodes(chat.initial, 'AIBubble')[0].props.onAdvance(); await tick();
  assert.equal(chat.calls[0][0], 5); assert.equal(chat.calls[0][2], 'persisted-conversation-retry-key');
  chat.context.activeProjectKey = '8'; await chat.render();
  pending.resolve({ id: 5, title: 'Old project', status: 'active', projectNamePending: true });
  await action;
  assert.equal(chat.linked.length, 0);
  assert.equal(nodes(await chat.render(), 'Naming').length, 0);
});
