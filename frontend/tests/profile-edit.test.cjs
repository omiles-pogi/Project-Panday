// Run: node --test tests/profile-edit.test.cjs. No live accounts or database writes.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const flush = () => new Promise((resolve) => setImmediate(resolve));
const plain = (value) => JSON.parse(JSON.stringify(value));
const jsx = (type, props, key) => ({ type, props, key });
const runtime = { jsx, jsxs: jsx };
const ui = Object.fromEntries(['Badge', 'Card', 'Field', 'PageHeader', 'Screen', 'StatGrid', 'StatTile', 'SubmitButton'].map((name) => [name, name]));
const native = { Text: 'Text', View: 'View', Pressable: 'Pressable', ActivityIndicator: 'ActivityIndicator' };
function load(file, mocks) {
  const { outputText } = ts.transpileModule(fs.readFileSync(path.join(__dirname, '..', file), 'utf8'), {
    compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
  });
  const exports = {};
  vm.runInNewContext(outputText, { exports, Error, require(name) {
    if (name in mocks) return mocks[name];
    throw new Error(`Unexpected dependency: ${name}`);
  } }, { filename: file });
  return exports;
}
function hooks() {
  const slots = [];
  let cursor = 0, effects = [], dirty = false;
  const equal = (a, b) => a && b && a.length === b.length && a.every((v, i) => Object.is(v, b[i]));
  const react = {
    useState(initial) {
      const i = cursor++;
      if (!(i in slots)) slots[i] = typeof initial === 'function' ? initial() : initial;
      return [slots[i], (value) => { const next = typeof value === 'function' ? value(slots[i]) : value; if (!Object.is(next, slots[i])) { slots[i] = next; dirty = true; } }];
    },
    useRef(value) { return slots[cursor++] ??= { current: value }; },
    useCallback(callback, deps) { const i = cursor++; if (!equal(slots[i]?.deps, deps)) slots[i] = { deps, callback }; return slots[i].callback; },
    useEffect(effect, deps) {
      const i = cursor++;
      if (!equal(slots[i]?.deps, deps)) effects.push(() => { slots[i]?.cleanup?.(); slots[i] = { deps, cleanup: effect() }; });
    },
  };
  return { react, async render(fn) {
    for (let i = 0; i < 20; i++) {
      cursor = 0; dirty = false; const result = fn();
      const pending = effects; effects = []; pending.forEach((effect) => effect()); await flush();
      if (!dirty) return result;
    }
    throw new Error('Render failed to settle');
  }, unmount() { slots.forEach((slot) => slot?.cleanup?.()); } };
}
function nodes(node, type) {
  if (!node || typeof node !== 'object') return [];
  if (Array.isArray(node)) return node.flatMap((n) => nodes(n, type));
  if (typeof node.type === 'function') return nodes(node.type(node.props), type);
  return [...(node.type === type ? [node] : []), ...nodes(node.props?.children, type)];
}
const text = (node) => !node ? '' : typeof node !== 'object' ? String(node) : Array.isArray(node) ? node.map(text).join(' ') : text(node.props?.children);
function deferred() { let resolve, reject; const promise = new Promise((a, b) => { resolve = a; reject = b; }); return { promise, resolve, reject }; }

function setup(role, { failLoad = false } = {}) {
  const hook = hooks(); const calls = []; let pendingSave = null, failSave = false;
  let user = { id: 14, name: 'Saved Account', role };
  const supplier = { id: 14, name: user.name, email: 'account@example.test', businessName: 'Verified Shop', licenseNumber: 'VERIFIED-LICENSE', approvalStatus: 'approved', memberSince: null, location: 'Saved town', contactNumber: '+63 900', bio: 'Saved bio', listings: { total: 59, active: 0, inStock: 0 } };
  const homeowner = { id: 14, name: user.name, email: 'homeowner@example.test', memberSince: '2026-01-01T00:00:00Z', location: 'Saved town', contactNumber: '+63 900', projects: { total: 5, notStarted: 1, active: 3, completed: 1 } };
  const publicProfile = { companyName: 'Saved Company', specialization: 'Renovation', trade: 'Mason', yearsExperience: 5, bio: 'Saved bio', minDailyWage: 800, skills: ['Concrete'], averageRating: 4.5, ratingCount: 1 };
  const controls = load('src/components/ProfileEditControls.tsx', { 'react/jsx-runtime': runtime, 'react-native': native, '@expo/vector-icons': { Ionicons: 'Icon' }, '@/components/ui': ui });
  const form = load('src/hooks/useProfileEdit.ts', { react: hook.react });
  const fetch = async () => { if (failLoad) throw new Error('Profile unavailable'); return role === 'supplier' ? supplier : role === 'homeowner' ? homeowner : publicProfile; };
  const update = async (input) => {
    calls.push(plain(input));
    if (pendingSave) await pendingSave.promise;
    if (failSave) throw new Error('Validation failed');
    return role === 'homeowner' ? { ...homeowner, location: input.location, contactNumber: input.contact_number }
      : role === 'supplier' ? { ...supplier, location: input.location, contactNumber: input.contact_number, bio: input.bio }
      : { ...input, skills: input.skills.map((skill) => ({ skill: skill.trim() })), bio: input.bio?.trim() ?? null };
  };
  const mocks = {
    '@/components/ProfilePhoto': { __esModule: true, default: 'ProfilePhoto' },
    '@/components/AccountManagement': { __esModule: true, default: 'AccountManagement' },
    react: hook.react, 'react/jsx-runtime': runtime, 'react-native': native, '@expo/vector-icons': { Ionicons: 'Icon' },
    '@/components/ui': ui, '@/components/NameCard': { __esModule: true, default: 'NameCard' },
    '@/components/ProfileEditControls': controls, '@/hooks/useProfileEdit': form,
    '@/context/AuthContext': { useAuth: () => ({ user }) },
    '@/services/api/supplierProfile': { fetchMySupplierProfile: fetch, updateMySupplierProfile: update },
    '@/services/api/homeownerProfile': { fetchMyHomeownerProfile: fetch, updateMyHomeownerProfile: update },
    '@/services/api/contractors': { fetchContractorProfile: fetch, updateMyContractorProfile: update },
    '@/services/api/workers': { fetchWorkerProfile: fetch, updateMyWorkerProfile: update },
  };
  const file = role === 'worker' ? 'src/screens/worker/Skills.tsx' : `src/screens/${role}/Profile.tsx`;
  const { default: Screen } = load(file, mocks);
  const render = () => hook.render(() => Screen());
  const field = (tree, label) => nodes(tree, 'Field').find((n) => n.props.label === label);
  const button = (tree, label) => nodes(tree, 'Pressable').find((n) => text(n).trim() === (role === 'homeowner' && label === 'Save' ? 'Save Changes' : label));
  const card = (tree) => nodes(tree, 'Card').find((n) => n.props.title === (role === 'supplier' ? 'Shop details' : role === 'homeowner' ? 'Your details' : 'Profile details'));
  return { hook, calls, render, field, button, card,
    edit(tree) { const b = card(tree).props.right; assert.equal(b.props.disabled, false); b.props.onPress(); },
    pending(value) { pendingSave = value; }, failSave(value) { failSave = value; },
    rename() { user = { ...user, name: 'Changed Name' }; },
  };
}

for (const role of ['supplier', 'worker', 'contractor', 'homeowner']) {
  const primary = role === 'supplier' || role === 'homeowner' ? 'Location' : role === 'worker' ? 'Trade' : 'Specialization';
  test(`${role}: saved fields are locked until Edit, including name-card opt-in and skills`, async () => {
    const a = setup(role); const tree = await a.render();
    assert.equal(nodes(tree, 'ProfilePhoto').length, 1);
    assert.equal(nodes(tree, 'AccountManagement').length, 1);
    assert.ok(nodes(tree, 'Field').length >= (role === 'homeowner' ? 2 : 3));
    assert.ok(nodes(tree, 'Field').every((n) => n.props.editable === false && n.props.onChangeText === undefined));
    assert.equal(nodes(tree, 'NameCard')[0].props.requireEdit, true);
    assert.equal(a.button(tree, 'Save'), undefined); assert.equal(a.button(tree, 'Cancel'), undefined);
    const chips = nodes(tree, 'Pressable').filter((n) => n.key === 'Concrete');
    assert.ok(chips.every((n) => n.props.disabled));
    assert.equal(a.calls.length, 0);
    if (role === 'supplier') {
      assert.match(text(tree), /VERIFIED-LICENSE/); assert.match(text(tree), /Verified Shop/);
      assert.equal(nodes(tree, 'Field').some((n) => /business|license|email/i.test(n.props.label)), false);
    }
    if (role === 'homeowner') {
      assert.equal(nodes(tree, 'NameCard')[0].props.saveLabel, 'Save Changes');
      assert.equal(nodes(tree, 'Field').some((n) => /email|member|role|password/i.test(n.props.label)), false);
      assert.match(text(tree), /homeowner@example.test/);
    }
    a.hook.unmount();
  });
  test(`${role}: Cancel restores all saved fields and skills without a write`, async () => {
    const a = setup(role); let tree = await a.render(); const original = nodes(tree, 'Field').map((n) => n.props.value);
    a.edit(tree); tree = await a.render(); assert.ok(nodes(tree, 'Field').every((n) => n.props.editable));
    a.field(tree, primary).props.onChangeText('Changed');
    if (role === 'worker' || role === 'contractor') {
      const chip = nodes(tree, 'Pressable').find((n) => n.key === 'Concrete'); chip.props.onPress();
      const inline = a.field(tree, ''); inline.props.onChangeText('Unsaved skill');
    }
    tree = await a.render(); a.button(tree, 'Cancel').props.onPress(); tree = await a.render();
    assert.deepEqual(nodes(tree, 'Field').map((n) => n.props.value), original);
    assert.ok(nodes(tree, 'Field').every((n) => !n.props.editable)); assert.equal(a.calls.length, 0);
    if (role === 'worker' || role === 'contractor') assert.ok(nodes(tree, 'Pressable').some((n) => n.key === 'Concrete'));
    a.hook.unmount();
  });
  test(`${role}: confirmed Save locks fields and establishes the baseline for the next Cancel`, async () => {
    const a = setup(role); let tree = await a.render(); a.edit(tree); tree = await a.render();
    a.field(tree, primary).props.onChangeText('  Confirmed value  '); tree = await a.render();
    await a.button(tree, 'Save').props.onPress(); tree = await a.render();
    assert.equal(a.calls.length, 1); assert.equal(a.field(tree, primary).props.value, 'Confirmed value');
    assert.ok(nodes(tree, 'Field').every((n) => !n.props.editable)); assert.match(text(tree), /Saved/);
    a.edit(tree); tree = await a.render(); a.field(tree, primary).props.onChangeText('Discard this'); tree = await a.render();
    a.button(tree, 'Cancel').props.onPress(); tree = await a.render(); assert.equal(a.field(tree, primary).props.value, 'Confirmed value');
    assert.equal(a.calls.length, 1); a.hook.unmount();
  });
  test(`${role}: failed saves retain drafts and edit mode; Cancel still restores the saved profile`, async () => {
    const a = setup(role); let tree = await a.render(); const saved = a.field(tree, primary).props.value;
    a.edit(tree); tree = await a.render(); a.field(tree, primary).props.onChangeText('Unsaved value'); tree = await a.render();
    a.failSave(true); await a.button(tree, 'Save').props.onPress(); tree = await a.render();
    assert.equal(a.field(tree, primary).props.value, 'Unsaved value'); assert.equal(a.field(tree, primary).props.editable, true);
    assert.match(text(tree), /Validation failed/); a.button(tree, 'Cancel').props.onPress(); tree = await a.render();
    assert.equal(a.field(tree, primary).props.value, saved); a.hook.unmount();
  });
  test(`${role}: pending saves block duplicate submissions, edits, and cancellation`, async () => {
    const a = setup(role); let tree = await a.render(); a.edit(tree); tree = await a.render();
    const pending = deferred(); a.pending(pending); const save = a.button(tree, 'Save').props.onPress;
    const request = save(); await save(); assert.equal(a.calls.length, 1); tree = await a.render();
    assert.equal(a.button(tree, 'Cancel').props.disabled, true); assert.ok(nodes(tree, 'Field').every((n) => !n.props.editable));
    assert.equal(a.button(tree, 'Saving…').props.disabled, true);
    // Even a retained old callback cannot discard the in-flight draft.
    a.button(tree, 'Cancel').props.onPress(); pending.resolve(); await request; tree = await a.render();
    assert.equal(a.field(tree, primary).props.editable, false); a.hook.unmount();
  });
  test(`${role}: a failed initial load cannot enable editing or overwrite stored data`, async () => {
    const a = setup(role, { failLoad: true }); const tree = await a.render();
    assert.equal(a.calls.length, 0);
    if (role === 'supplier' || role === 'homeowner') assert.match(text(tree), /Profile unavailable/);
    else { assert.equal(a.card(tree).props.right.props.disabled, true); assert.ok(nodes(tree, 'Field').every((n) => !n.props.editable)); }
    a.hook.unmount();
  });
}

for (const role of ['worker', 'contractor']) {
  test(`${role}: required fields and numeric filtering still apply`, async () => {
    const a = setup(role); let tree = await a.render(); a.edit(tree); tree = await a.render();
    a.field(tree, 'Years of experience').props.onChangeText('a12b'); tree = await a.render();
    assert.equal(a.field(tree, 'Years of experience').props.value, '12');
    const primary = role === 'worker' ? 'Trade' : 'Specialization'; a.field(tree, primary).props.onChangeText(''); tree = await a.render();
    assert.equal(a.button(tree, 'Save').props.disabled, true); await a.button(tree, 'Save').props.onPress(); assert.equal(a.calls.length, 0);
    a.hook.unmount();
  });
  test(`${role}: saving a name does not reload or discard the open profile draft`, async () => {
    const a = setup(role); let tree = await a.render(); a.edit(tree); tree = await a.render();
    const label = role === 'worker' ? 'Trade' : 'Specialization'; a.field(tree, label).props.onChangeText('Draft stays');
    a.rename(); tree = await a.render(); assert.equal(a.field(tree, label).props.value, 'Draft stays'); assert.equal(a.field(tree, label).props.editable, true); a.hook.unmount();
  });
}

test('supplier: contact sanitization and source field limits are preserved', async () => {
  const a = setup('supplier'); let tree = await a.render(); a.edit(tree); tree = await a.render();
  a.field(tree, 'Contact number').props.onChangeText('abc+63 (900)-123'); tree = await a.render();
  assert.equal(a.field(tree, 'Contact number').props.value, '+63 (900)-123');
  assert.equal(a.field(tree, 'Contact number').props.maxLength, 30); assert.equal(a.field(tree, 'Location').props.maxLength, 255);
  a.hook.unmount();
});

test('worker: optional minimum wage can still be cleared explicitly', async () => {
  const a = setup('worker'); let tree = await a.render(); a.edit(tree); tree = await a.render();
  a.field(tree, 'Minimum daily wage (₱, optional)').props.onChangeText(''); tree = await a.render();
  await a.button(tree, 'Save').props.onPress(); tree = await a.render(); assert.equal(a.calls[0].min_daily_wage, null);
  assert.equal(a.field(tree, 'Minimum daily wage (₱, optional)').props.value, ''); a.hook.unmount();
});

function nameCard(requireEdit, saveLabel) {
  const hook = hooks(); const calls = []; let user = { name: 'Original Name' }, fail = false;
  const controls = load('src/components/ProfileEditControls.tsx', { 'react/jsx-runtime': runtime, 'react-native': native, '@expo/vector-icons': { Ionicons: 'Icon' }, '@/components/ui': ui });
  const { default: NameCard } = load('src/components/NameCard.tsx', {
    react: hook.react, 'react/jsx-runtime': runtime, 'react-native': native, '@/components/ui': ui,
    '@/components/ProfileEditControls': controls, '@/context/AuthContext': { useAuth: () => ({ user, updateName: async (name) => { calls.push(name); if (fail) throw new Error('Name update failed'); user = { name }; } }) },
  });
  return { hook, calls, render: () => hook.render(() => NameCard({ requireEdit, saveLabel })), fail() { fail = true; } };
}
test('protected name section supports Edit, validation, Save, and Cancel', async () => {
  const a = nameCard(true); let tree = await a.render(); assert.equal(nodes(tree, 'Field')[0].props.editable, false);
  nodes(tree, 'Card')[0].props.right.props.onPress(); tree = await a.render();
  nodes(tree, 'Field')[0].props.onChangeText('x'); tree = await a.render();
  await nodes(tree, 'Pressable').find((n) => text(n) === 'Save').props.onPress(); tree = await a.render();
  assert.match(text(tree), /at least 2 characters/); assert.equal(a.calls.length, 0);
  nodes(tree, 'Field')[0].props.onChangeText('  Saved Name  '); tree = await a.render();
  await nodes(tree, 'Pressable').find((n) => text(n) === 'Save').props.onPress(); tree = await a.render();
  assert.deepEqual(a.calls, ['Saved Name']); assert.equal(nodes(tree, 'Field')[0].props.editable, false);
  nodes(tree, 'Card')[0].props.right.props.onPress(); tree = await a.render(); nodes(tree, 'Field')[0].props.onChangeText('Discard me'); tree = await a.render();
  nodes(tree, 'Pressable').find((n) => text(n) === 'Cancel').props.onPress(); tree = await a.render();
  assert.equal(nodes(tree, 'Field')[0].props.value, 'Saved Name'); assert.equal(a.calls.length, 1); a.hook.unmount();
});
test('failed protected name save keeps editing available and Cancel restores the original name', async () => {
  const a = nameCard(true); let tree = await a.render(); nodes(tree, 'Card')[0].props.right.props.onPress(); tree = await a.render();
  nodes(tree, 'Field')[0].props.onChangeText('Unsaved Name'); tree = await a.render(); a.fail();
  await nodes(tree, 'Pressable').find((n) => text(n) === 'Save').props.onPress(); tree = await a.render();
  assert.equal(nodes(tree, 'Field')[0].props.editable, true); assert.match(text(tree), /Name update failed/);
  nodes(tree, 'Pressable').find((n) => text(n) === 'Cancel').props.onPress(); tree = await a.render();
  assert.equal(nodes(tree, 'Field')[0].props.value, 'Original Name'); a.hook.unmount();
});
test('NameCard without safe-edit opt-in keeps its existing direct-edit behavior', async () => {
  const a = nameCard(undefined); let tree = await a.render(); assert.equal(nodes(tree, 'Card')[0].props.right, undefined);
  assert.equal(typeof nodes(tree, 'Field')[0].props.onChangeText, 'function'); assert.equal(nodes(tree, 'SubmitButton')[0].props.label, 'Save name');
  nodes(tree, 'Field')[0].props.onChangeText('Homeowner Name'); tree = await a.render(); await nodes(tree, 'SubmitButton')[0].props.onPress();
  assert.deepEqual(a.calls, ['Homeowner Name']); a.hook.unmount();
});

test('homeowner: private details, project statistics, contact validation, and account fields are preserved', async () => {
  const a = setup('homeowner'); let tree = await a.render();
  const statsBefore = plain(nodes(tree, 'StatTile').map((n) => n.props));
  a.edit(tree); tree = await a.render();
  assert.equal(text(a.button(tree, 'Save')).trim(), 'Save Changes');
  a.field(tree, 'Location').props.onChangeText('  New town  ');
  a.field(tree, 'Contact number').props.onChangeText('abc+63 (900)-123'); tree = await a.render();
  assert.equal(a.field(tree, 'Contact number').props.value, '+63 (900)-123');
  assert.equal(a.field(tree, 'Contact number').props.maxLength, 30); assert.equal(a.field(tree, 'Location').props.maxLength, 255);
  assert.match(text(tree), /Only you can see these/);
  assert.equal(a.field(tree, 'Location').props.value, '  New town  ');
  // The top summary continues showing the saved location while the field is a draft.
  const summary = nodes(tree, 'Card').find((n) => !n.props.title); assert.match(text(summary), /Saved town/);
  await a.button(tree, 'Save').props.onPress(); tree = await a.render();
  assert.deepEqual(a.calls, [{ location: 'New town', contact_number: '+63 (900)-123' }]);
  assert.deepEqual(plain(nodes(tree, 'StatTile').map((n) => n.props)), statsBefore);
  assert.match(text(nodes(tree, 'Card').find((n) => !n.props.title)), /New town/);
  assert.match(text(tree), /homeowner@example.test/); a.hook.unmount();
});

test('homeowner: name section uses Save Changes while retaining validation and Cancel', async () => {
  const a = nameCard(true, 'Save Changes'); let tree = await a.render();
  assert.equal(nodes(tree, 'Field')[0].props.editable, false);
  nodes(tree, 'Card')[0].props.right.props.onPress(); tree = await a.render();
  nodes(tree, 'Field')[0].props.onChangeText('x'); tree = await a.render();
  await nodes(tree, 'Pressable').find((n) => text(n) === 'Save Changes').props.onPress(); tree = await a.render();
  assert.match(text(tree), /at least 2 characters/); assert.equal(a.calls.length, 0);
  nodes(tree, 'Field')[0].props.onChangeText('  Confirmed Homeowner  '); tree = await a.render();
  await nodes(tree, 'Pressable').find((n) => text(n) === 'Save Changes').props.onPress(); tree = await a.render();
  assert.deepEqual(a.calls, ['Confirmed Homeowner']); assert.equal(nodes(tree, 'Field')[0].props.editable, false);
  nodes(tree, 'Card')[0].props.right.props.onPress(); tree = await a.render();
  nodes(tree, 'Field')[0].props.onChangeText('Cancel this name'); tree = await a.render();
  nodes(tree, 'Pressable').find((n) => text(n) === 'Cancel').props.onPress(); tree = await a.render();
  assert.equal(nodes(tree, 'Field')[0].props.value, 'Confirmed Homeowner'); a.hook.unmount();
});
