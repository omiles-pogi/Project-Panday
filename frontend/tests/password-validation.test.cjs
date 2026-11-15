const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const jsx = (type, props) => ({ type, props });
const runtime = { jsx, jsxs: jsx };
function load(file, mocks = {}) {
  const filename = path.join(__dirname, '..', file);
  const { outputText } = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
  });
  const exports = {};
  vm.runInNewContext(outputText, { exports, require(name) { if (name in mocks) return mocks[name];
    if (name === '@/components/auth/PasswordInputGuard') return load('src/components/auth/PasswordInputGuard.tsx', mocks);
    if (name === '@/validators/auth') return load('src/validators/auth.ts');
    throw new Error(`Unexpected dependency ${name}`); } }, { filename });
  return exports;
}
const validators = load('src/validators/auth.ts');
const palette = load('src/theme/colors.ts');
function nodes(node, type) {
  if (!node || typeof node !== 'object') return [];
  if (Array.isArray(node)) return node.flatMap(item => nodes(item, type));
  return [...(node.type === type ? [node] : []), ...nodes(node.props?.children, type)];
}
function text(node) {
  if (node == null || typeof node === 'boolean') return '';
  if (Array.isArray(node)) return node.map(text).join(' ');
  return typeof node === 'object' ? text(node.props?.children) : String(node);
}
function hooks() {
  let cursor = 0; const slots = [];
  return { react: {
    useState(initial) { const i = cursor++; if (!(i in slots)) slots[i] = typeof initial === 'function' ? initial() : initial; return [slots[i], value => { slots[i] = typeof value === 'function' ? value(slots[i]) : value; }]; },
    useRef(initial) { return slots[cursor++] ??= { current: initial }; },
    useCallback: fn => fn, useEffect() {},
  }, render(fn) { cursor = 0; return fn(); } };
}
const invalid = ['', 'abc1234', 'abcdefgh', '12345678', 'ééééééé1', 'abcdefg١', 'a1😀😀😀'];
const tick = () => new Promise(resolve => setImmediate(resolve));

test('creation/reset policy handles every requirement, Unicode length, and exact confirmation without changing login', () => {
  for (const password of invalid) {
    assert.equal(validators.isValidPassword(password), false);
    assert.equal(validators.isValidResetForm('123456', password, password), false);
  }
  for (const password of ['abcdefg1', 'ABCDEFG1', 'a1😀😀😀😀😀😀']) {
    assert.equal(validators.isValidPassword(password), true);
    assert.equal(validators.isValidResetForm('123456', password, password), true);
  }
  assert.match(validators.confirmationError('short1', 'short1'), /8 characters/);
  assert.equal(validators.confirmationError('abcdefgh1', 'abcdefgh2'), 'Passwords do not match.');
  assert.equal(validators.confirmationState('abcdefgh1', ''), 'neutral');
  assert.equal(validators.confirmationState('abcdefgh1', 'abcdefgh1'), 'valid');
  assert.equal(validators.confirmationState('newvalue1', 'abcdefgh1'), 'invalid');
  assert.equal(validators.isValidLoginForm('legacy@example.com', 'old'), true);
  for (const email of ['invalid', 'a@', '@example.com', 'a b@example.com']) assert.equal(validators.isValidEmail(email), false);
  const fields = { name: 'Preview User', email: 'a@gmail.com', password: 'abcdefg1', passwordConfirmation: 'abcdefg1' };
  assert.equal(validators.isValidRegisterForm(fields), true);
  assert.equal(validators.isValidRegisterForm({ ...fields, name: ' ' }), false);
  assert.equal(validators.isValidRegisterForm({ ...fields, name: 'a'.repeat(256) }), false);
});

function feedback(mode) {
  const theme = { mode, chrome: mode === 'dark' ? palette.darkChrome : palette.lightChrome };
  const mocks = { 'react/jsx-runtime': runtime, 'react-native': { Text: 'Text', View: 'View' },
    '@expo/vector-icons': { Ionicons: 'Icon' }, '@/context/ThemeContext': { useTheme: () => theme }, '@/validators/auth': validators };
  return { ...load('src/components/auth/PasswordValidation.tsx', mocks), theme };
}

test('requirements start neutral, show only unmet errors, then clear and turn green in both themes', () => {
  for (const mode of ['light', 'dark']) {
    const ui = feedback(mode), colors = ui.useValidationColors();
    let tree = ui.default({ password: '' });
    assert.equal(nodes(tree, 'Text').filter(n => n.props.accessibilityRole === 'alert').length, 0);
    assert.ok(nodes(tree, 'Icon').every(n => n.props.color === colors.neutral));
    tree = ui.default({ password: 'abc' });
    assert.deepEqual(nodes(tree, 'Icon').map(n => n.props.color), [colors.invalid, colors.valid, colors.invalid, colors.valid]);
    assert.match(text(tree), /at least 8 characters/);
    tree = ui.default({ password: 'abcdefgh' });
    const error = nodes(tree, 'Text').find(n => n.props.accessibilityRole === 'alert');
    assert.match(text(error), /one number/); assert.doesNotMatch(text(error), /one letter|8 characters/);
    tree = ui.default({ password: 'abcdefg1' });
    assert.ok(nodes(tree, 'Icon').every(n => n.props.name === 'checkmark-circle' && n.props.color === colors.valid));
    assert.equal(nodes(tree, 'Text').filter(n => n.props.accessibilityRole === 'alert').length, 0);
    assert.ok(nodes(ui.default({ password: '', attempted: true }), 'Icon').slice(0, 3).every(n => n.props.color === colors.invalid));
    assert.equal(ui.PasswordConfirmation({ password: 'abcdefg1', confirmation: '' }), null);
    assert.match(text(ui.PasswordConfirmation({ password: 'abc1', confirmation: 'abc1' })), /8 characters/);
    assert.doesNotMatch(text(ui.PasswordConfirmation({ password: 'abc1', confirmation: 'abc1' })), /do not match/);
    assert.match(text(ui.PasswordConfirmation({ password: 'abcdefg1', confirmation: 'abcdefg1' })), /Passwords match/);
  }
});

test('shared fields preserve visibility controls, show themed validation borders, and buttons are gray until valid', () => {
  for (const mode of ['light', 'dark']) {
    const feedbackUI = feedback(mode), theme = feedbackUI.theme, hook = hooks();
    const ui = load('src/components/auth/PasswordRecoveryUI.tsx', {
      react: hook.react, 'react/jsx-runtime': runtime, 'expo-router': {},
      'react-native': { View: 'View', Text: 'Text', TextInput: 'Input', Pressable: 'Pressable', ActivityIndicator: 'Spinner' },
      'react-native-safe-area-context': {}, '@/components/KeyboardView': {}, '@/components/KeyboardAwareScrollView': {},
      '@/components/Mascot': {}, '@/components/WaveHeader': {}, '@expo/vector-icons': { Ionicons: 'Icon' },
      '@/context/ThemeContext': { useTheme: () => theme }, '@/components/auth/PasswordValidation': feedbackUI,
    });
    const render = state => hook.render(() => ui.RecoveryField({ label: 'Confirm password', secureTextEntry: true, validationState: state, value: '', placeholder: 'Registered email' }));
    let tree = render('neutral');
    assert.equal(nodes(tree, 'Input')[0].props.secureTextEntry, true);
    assert.equal(nodes(tree, 'Input')[0].props.placeholderTextColor, theme.chrome.mutedForeground);
    nodes(tree, 'Pressable')[0].props.onPress(); assert.equal(nodes(render('neutral'), 'Input')[0].props.secureTextEntry, false);
    nodes(render('neutral'), 'Pressable')[0].props.onPress(); assert.equal(nodes(render('neutral'), 'Input')[0].props.secureTextEntry, true);
    assert.equal(render('valid').props.children[1].props.style.borderColor, feedbackUI.useValidationColors().valid);
    assert.equal(render('invalid').props.children[1].props.style.borderColor, feedbackUI.useValidationColors().invalid);
    assert.equal(ui.RecoveryButton({ label: 'Reset', disabled: true }).props.style.backgroundColor, theme.chrome.muted);
    assert.equal(ui.RecoveryButton({ label: 'Reset', disabled: false }).props.style.backgroundColor, '#f59e0b');
  }
});

function registration(register = async () => {}) {
  const hook = hooks();
  const Screen = load('src/screens/auth/Register.tsx', {
    react: hook.react, 'react/jsx-runtime': runtime,
    'react-native': { Text: 'Text', View: 'View', Pressable: 'Pressable', ActivityIndicator: 'Spinner' },
    'expo-router': { Link: 'Link' }, '@expo/vector-icons': { Ionicons: 'Icon' },
    '@/components/KeyboardView': { __esModule: true, default: 'KeyboardView' },
    '@/components/KeyboardAwareScrollView': { __esModule: true, default: 'KeyboardScroll' },
    '@/context/AuthContext': { useAuth: () => ({ register }) }, '@/context/ThemeContext': { useTheme: () => ({ chrome: palette.lightChrome }) },
    '@/components/Logo': { __esModule: true, default: 'Logo' }, '@/theme/colors': palette, '@/validators/auth': validators,
    '@/components/auth/PasswordRecoveryUI': { RecoveryField: 'Field' },
    '@/components/auth/PasswordValidation': { __esModule: true, default: 'Requirements', PasswordConfirmation: 'Confirmation' },
  }).default;
  const render = () => hook.render(Screen);
  const change = (label, value) => nodes(render(), 'Field').find(n => n.props.label === label).props.onChangeText(value);
  const button = () => nodes(render(), 'Pressable').find(n => n.props.accessibilityLabel === 'Create Account');
  return { render, change, button };
}

test('registration has empty requested placeholders, blocks invalid submissions, and updates confirmation after password edits', async () => {
  let calls = 0; const app = registration(async () => calls++);
  let fields = nodes(app.render(), 'Field');
  assert.equal(fields[0].props.placeholder, 'Full name'); assert.equal(fields[0].props.value, '');
  assert.equal(fields[1].props.placeholder, 'Registered email'); assert.equal(fields[1].props.value, '');
  app.change('Name', 'Preview User'); app.change('Email', 'preview@gmail.com');
  for (const password of invalid) {
    app.change('Password', password); app.change('Confirm password', password);
    assert.equal(app.button().props.disabled, true); await app.button().props.onPress();
  }
  assert.equal(calls, 0);
  app.change('Password', 'abcdefg1'); app.change('Confirm password', 'abcdefg1'); assert.equal(app.button().props.disabled, false);
  app.change('Password', 'newvalue1'); assert.equal(app.button().props.disabled, true);
  assert.equal(nodes(app.render(), 'Field').find(n => n.props.label === 'Confirm password').props.validationState, 'invalid');
  app.change('Password', ''); assert.equal(nodes(app.render(), 'Field').find(n => n.props.label === 'Password').props.validationState, 'invalid');
});

test('all registration roles retain required verification fields and the immediate duplicate-request lock', async () => {
  for (const [label, role] of [['Homeowner', 'homeowner'], ['Contractor', 'contractor'], ['Supplier', 'supplier'], ['Skilled Worker', 'worker']]) {
    let calls = 0, payload, release;
    const app = registration(async fields => { calls++; payload = fields; await new Promise(resolve => { release = resolve; }); });
    nodes(app.render(), 'Pressable').find(n => text(n).trim() === label).props.onPress();
    app.change('Name', 'Preview User'); app.change('Email', 'preview@gmail.com'); app.change('Password', 'abcdefg1'); app.change('Confirm password', 'abcdefg1');
    const required = validators.VERIFICATION_FIELDS[role];
    if (required) {
      assert.equal(app.button().props.disabled, true);
      app.change(required.licenseLabel, 'ID-1234');
      if (required.businessLabel) app.change(required.businessLabel, 'Preview Business');
    }
    assert.equal(app.button().props.disabled, false);
    const handler = app.button().props.onPress;
    const pending = handler(); await handler();
    assert.equal(calls, 1); assert.equal(payload.role, role); assert.equal(app.button().props.disabled, true);
    assert.equal(nodes(app.render(), 'Field')[0].props.editable, false);
    release(); await pending; assert.equal(app.button().props.disabled, false);
  }
});

test('reset uses the same password requirements and never submits an invalid password despite an authorized grant', async () => {
  const hook = hooks(); let calls = 0;
  const recovery = { email: 'preview@example.invalid', authorization: { token: 'synthetic-server-grant', expiresAt: Date.now() + 300000 } };
  const Screen = load('src/screens/auth/CreateNewPassword.tsx', {
    react: hook.react, 'react/jsx-runtime': runtime, 'react-native': { Pressable: 'Pressable', Text: 'Text', View: 'View' },
    'expo-router': { Redirect: 'Redirect', router: { replace() {} } }, '@/validators/auth': validators,
    '@/context/PasswordRecoveryContext': { usePasswordRecovery: () => ({ recovery, clear() {} }) },
    '@/services/api/auth': { resetPasswordRequest: async () => calls++ }, '@/services/api/client': { ApiError: class extends Error {} },
    '@/components/auth/PasswordValidation': { __esModule: true, default: 'Requirements', PasswordConfirmation: 'Confirmation' },
    '@/components/auth/PasswordRecoveryUI': { RecoveryScreen: 'Screen', RecoveryField: 'Field', RecoveryButton: 'Button', RecoveryError: 'Error', useSecondsRemaining: () => 100, useRecoveryAction: () => ({ submitting: false, error: null, run: task => task(() => true) }) },
  }).default;
  const render = () => hook.render(Screen);
  for (const password of invalid) {
    const inputs = nodes(render(), 'Field'); inputs[0].props.onChangeText(password); inputs[1].props.onChangeText(password);
    let tree = render(); assert.equal(nodes(tree, 'Button')[0].props.disabled, true); nodes(tree, 'Button')[0].props.onPress();
    tree = render(); assert.equal(nodes(tree, 'Field')[0].props.validationState, 'invalid');
  }
  await tick(); assert.equal(calls, 0);
  const inputs = nodes(render(), 'Field'); inputs[0].props.onChangeText('abcdefg1'); inputs[1].props.onChangeText('abcdefg1');
  assert.equal(nodes(render(), 'Button')[0].props.disabled, false);
  inputs[0].props.onChangeText('newvalue1'); assert.equal(nodes(render(), 'Button')[0].props.disabled, true);
});
