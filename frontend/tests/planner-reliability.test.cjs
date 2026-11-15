const { test } = require('node:test');
const assert = require('node:assert/strict');
const { load, defaults, hooks, nodes, runtime, theme } = require('./helpers/account-harness.cjs');
const state = load('src/utils/planningState.ts', {});
const plain = value => JSON.parse(JSON.stringify(value));
const plan = { projectTitle: 'Residence', materials: [{ material: 'Cement', category: 'Foundation', qty: 10, unit: 'bag', unitPrice: 250, supplierId: 14, supplierProductId: 51 }], supplierSelections: { Foundation: 14 }, totalEstimate: 2500 };

test('existing supplier picker keeps category controls independent and invokes the saved-choice action', async () => {
  const hook = hooks(); const calls = [];
  const categories = ['Construction Materials', 'Electrical and Plumbing', 'Finishing Works'];
  const { default: Picker } = load('src/components/SupplierPicker.tsx', {
    react: hook.react, 'react/jsx-runtime': runtime,
    'react-native': { ActivityIndicator: 'ActivityIndicator', Pressable: 'Pressable', Text: 'Text', View: 'View' },
    '@expo/vector-icons': { Ionicons: 'Icon' }, '@/components/Sheet': defaults('Sheet'),
    '@/context/ThemeContext': { useTheme: () => theme }, '@/types/plan': { SUPPLIER_CATEGORIES: categories },
    '@/services/ai/client': { fetchSupplierOptions: async () => categories.map(category => ({ category, suppliers: [{ id: 14, name: 'Tripple R', itemCount: 1, inStockCount: 1 }, { id: 17, name: 'SLD Hardware', itemCount: 1, inStockCount: 1 }] })) },
  });
  let current = { ...plan, supplierSelections: {} };
  const render = () => hook.render(() => Picker({ plan: current, onChoose: (category, supplier) => {
    calls.push([category, supplier?.id ?? null]);
    current = { ...current, supplierSelections: { ...current.supplierSelections, [category]: supplier?.id ?? null } };
  } }));
  let tree = await render();
  const categoryButton = (tree, category) => nodes(tree, 'Pressable').find(node => node.props.accessibilityLabel?.startsWith(`${category} supplier:`));
  categoryButton(tree, categories[0]).props.onPress(); tree = await render();
  nodes(tree, 'SupplierRow').find(node => node.props.label === 'Tripple R').props.onPress(); tree = await render();
  assert.match(categoryButton(tree, categories[0]).props.accessibilityLabel, /Tripple R/);
  categoryButton(tree, categories[2]).props.onPress(); tree = await render();
  nodes(tree, 'SupplierRow').find(node => node.props.label === 'SLD Hardware').props.onPress(); tree = await render();
  assert.match(categoryButton(tree, categories[2]).props.accessibilityLabel, /SLD Hardware/);
  assert.match(categoryButton(tree, categories[0]).props.accessibilityLabel, /Tripple R/);
  assert.deepEqual(calls, [[categories[0], 14], [categories[2], 17]]);
});

test('legacy cards restore from structured cache even when a failed user turn is last; source data remains unchanged', () => {
  const history = [{ role: 'assistant', content: 'Plan: Residence' }, { role: 'user', content: 'Change the roof' }];
  const before = JSON.stringify({ history, plan });
  const restored = state.restorePlanningMessages(plan, history, 'materials', card => card);
  assert.deepEqual(Array.from(restored.filter(message => message.card), message => message.card), ['plan', 'budget', 'materials']);
  assert.equal(restored.at(-1).content, 'Change the roof');
  for (const message of restored.filter(message => message.card)) assert.deepEqual(plain(message.planSnapshot), plan);
  assert.equal(JSON.stringify({ history, plan }), before);
  const second = state.restorePlanningMessages(plan, restored, 'materials', card => card);
  assert.equal(second.length, restored.length);
  assert.equal(state.restorePlanningMessages(null, history, null, () => { throw new Error('No synthetic plan'); }).length, 2);
});

test('saved historical cards retain their exact plan snapshots and all reached approval cards remain visible', () => {
  const old = { ...plan, totalEstimate: 1000 };
  const history = [{ role: 'assistant', content: 'Earlier budget', card: 'budget', planSnapshot: old, reviewSnapshot: { planFlags: {}, materialsApproved: { old: true } } }];
  const restored = state.restorePlanningMessages(plan, history, 'summary', card => card);
  assert.equal(restored[0].planSnapshot.totalEstimate, 1000);
  assert.equal(restored[0].reviewSnapshot.materialsApproved.old, true);
  assert.deepEqual(Array.from(restored.slice(1), message => message.card), ['plan', 'budget', 'materials', 'summary']);
  assert.equal(state.restorePlanningMessages(plan, [], 'plan', card => card)[0].planSnapshot.supplierSelections.Foundation, 14);
});

test('material approvals follow the same product and quote, survive reordering, and do not approve changed quantities or prices', () => {
  const cement = plan.materials[0]; const steel = { ...cement, material: 'Steel', supplierProductId: 52 };
  const original = state.materialApprovalKey(cement, 0, [cement, steel]);
  assert.equal(state.materialApprovalKey(cement, 1, [steel, cement]), original);
  for (const changes of [{ qty: 11 }, { unitPrice: 251 }, { supplierId: 15 }, { supplierProductId: 60 }]) {
    assert.notEqual(state.materialApprovalKey({ ...cement, ...changes }, 0, [{ ...cement, ...changes }]), original);
  }
  assert.notEqual(state.materialApprovalKey(cement, 1, [cement, cement]), original);
  assert.equal(state.samePlanningData(plan, { ...plan, projectTitle: 'Renamed' }), true);
  assert.equal(state.samePlanningData(plan, { ...plan, supplierSelections: { 'Construction Materials': 17 } }), true);
});

test('advancing a card freezes its actual review choices without changing older plan reviews', () => {
  const oldPlan = { ...plan, totalEstimate: 1000 };
  const messages = [
    { role: 'assistant', card: 'materials', planSnapshot: oldPlan, reviewSnapshot: { materialsApproved: { old: true }, planFlags: {} } },
    { role: 'assistant', card: 'materials', planSnapshot: plan, reviewSnapshot: { materialsApproved: {}, planFlags: {} } },
  ];
  const review = { materialsApproved: { current: true }, planFlags: { location: false } };
  const frozen = state.snapshotCurrentReview(messages, plan, 'materials', review);
  assert.equal(frozen[0].reviewSnapshot.materialsApproved.old, true);
  assert.equal(frozen[1].reviewSnapshot.materialsApproved.current, true);
  assert.equal(messages[1].reviewSnapshot.materialsApproved.current, undefined);
});

function transport() {
  const warnings = []; const instances = [];
  class XHR {
    constructor() { instances.push(this); this.headers = {}; this.responseText = ''; this.status = 200; }
    open(method, url) { this.method = method; this.url = url; }
    setRequestHeader(key, value) { this.headers[key] = value; }
    send(body) { this.body = body; }
    abort() { this.aborted = true; this.onabort?.(); }
    progress(text) { this.responseText += text; this.onprogress?.(); }
    finish(text = '') { this.responseText += text; this.onload(); }
  }
  const diagnostics = load('src/utils/plannerError.ts', {}, { console: { warn: (...args) => warnings.push(args) } });
  const client = load('src/services/api/client.ts', { 'expo-constants': defaults({ expoConfig: null }), '@/utils/plannerError': diagnostics }, {
    process: { env: { EXPO_PUBLIC_API_BASE_URL: 'https://backend.test' } }, XMLHttpRequest: XHR,
  });
  const ai = load('src/services/ai/client.ts', { '@/services/api/client': client, '@/utils/plannerError': diagnostics });
  return { client, ai, instances, warnings };
}

test('native streaming consumes split NDJSON and its final line without newline; private card metadata stays on the device', async () => {
  const app = transport(); const chunks = [];
  const pending = app.ai.generateConstructionPlan([{ role: 'user', content: 'Question', id: 'local', card: 'plan', planSnapshot: plan }], false, text => chunks.push(text), plan, null, 7);
  const xhr = app.instances[0]; assert.equal(xhr.timeout, 180000);
  const payload = JSON.parse(xhr.body); assert.deepEqual(payload.messages, [{ role: 'user', content: 'Question' }]); assert.equal(payload.project_id, 7);
  xhr.progress('{"type":"started"}\n{"type":"chu');
  xhr.progress('nk","text":"Hello"}\n');
  xhr.finish('{"type":"done","result":{"chatReply":true,"message":"Hello"}}');
  assert.equal((await pending).message, 'Hello'); assert.deepEqual(chunks, ['Hello']); assert.equal(app.warnings.length, 0);
});

test('connection, timeout, HTTP rejection and provider failure are distinct and diagnostics never include message content or bearer tokens', async () => {
  for (const [trigger, expected] of [
    [xhr => xhr.onerror(), 'backend_connection'], [xhr => xhr.ontimeout(), 'backend_timeout'],
    [xhr => { xhr.status = 500; xhr.finish('private server stack'); }, 'backend_http'],
    [xhr => xhr.finish('{"type":"error","message":"Provider unavailable","status":502,"code":"provider_stream"}\n'), 'provider_stream'],
  ]) {
    const app = transport(); app.client.setAuthToken('PRIVATE_TEST_BEARER');
    const pending = app.ai.generateConstructionPlan([{ role: 'user', content: 'PRIVATE_TEST_MESSAGE' }]);
    trigger(app.instances[0]); await assert.rejects(pending, error => error.code === expected);
    assert.equal(app.warnings.at(-1)[1].category, expected);
    const log = JSON.stringify(app.warnings); assert.doesNotMatch(log, /PRIVATE_TEST|private server stack/);
  }
});

test('malformed or truncated streams fail safely; abort ignores late response events', async () => {
  for (const body of ['invalid-json\n', '{"type":"chunk","text":"Incomplete"}\n']) {
    const app = transport(); const pending = app.ai.generateConstructionPlan([{ role: 'user', content: 'Question' }]);
    app.instances[0].finish(body); await assert.rejects(pending, error => error.code === 'protocol');
  }
  const app = transport(); const controller = new AbortController(); const events = [];
  const pending = app.client.apiFetchStream('/api/ai/plan', { signal: controller.signal }, event => events.push(event));
  controller.abort(); await assert.rejects(pending, error => error.code === 'cancelled');
  app.instances[0].progress('{"type":"done","result":{}}\n'); app.instances[0].finish();
  assert.equal(events.length, 0); assert.equal(app.warnings.length, 0);
});
