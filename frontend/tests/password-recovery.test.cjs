// Run with: node --test tests/password-recovery.test.cjs
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

function load(file, mocks = {}, globals = {}) {
  const filename = path.join(__dirname, '..', file);
  const { outputText } = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
  });
  const exports = {};
  vm.runInNewContext(outputText, { exports, ...globals, require(name) {
    if (name in mocks) return mocks[name];
    throw new Error(`Unexpected dependency ${name}`);
  } }, { filename });
  return exports;
}
const jsx = (type, props) => ({ type, props });
const runtime = { jsx, jsxs: jsx };
const nodes = (node, type) => !node || typeof node !== 'object' ? [] : Array.isArray(node)
  ? node.flatMap((child) => nodes(child, type))
  : [...(node.type === type ? [node] : []), ...nodes(node.props?.children, type)];

function hooks() {
  const slots = [];
  let cursor = 0;
  return {
    react: {
      useState(initial) {
        const index = cursor++;
        if (!(index in slots)) slots[index] = typeof initial === 'function' ? initial() : initial;
        return [slots[index], (value) => { slots[index] = typeof value === 'function' ? value(slots[index]) : value; }];
      },
      useRef(initial) { return slots[cursor++] ??= { current: initial }; },
      useCallback: (callback) => callback,
    },
    render(callback) { cursor = 0; return callback(); },
  };
}

const { editOtp } = load('src/utils/otp.ts');
const validators = load('src/validators/auth.ts');

test('six OTP slots accept numeric entry/full paste without shifting middle deletions', () => {
  const empty = Array(6).fill('');
  assert.equal(editOtp(empty, 0, '1').focus, 1);
  assert.equal(editOtp(empty, 4, '123456').digits.join(''), '123456');
  assert.equal(editOtp(empty, 0, 'a12b34c56').digits.join(''), '123456');
  assert.equal(editOtp(empty, 0, 'abcdef').digits.join(''), '');
  const removed = editOtp(['1', '2', '3', '4', '5', '6'], 2, '');
  assert.equal(removed.digits[2], '');
  assert.equal(removed.digits[3], '4');
  assert.equal(validators.isValidResetCode('12345'), false);
  assert.equal(validators.isValidResetCode('123456'), true);
});

test('OTP component advances focus, handles paste, backspace and disabled state', () => {
  const hook = hooks();
  let changed;
  let focused;
  const { default: Otp } = load('src/components/auth/OtpInput.tsx', {
    react: hook.react, 'react/jsx-runtime': runtime,
    'react-native': { View: 'View', TextInput: 'Input', StyleSheet: { create: (value) => value } },
    '@/context/ThemeContext': { useTheme: () => ({ chrome: {} }) }, '@/utils/otp': { editOtp },
  });
  const render = (digits, disabled = false) => hook.render(() => Otp({ digits, disabled, onChange: (value) => changed = value }));
  let inputs = nodes(render(Array(6).fill('')), 'Input');
  inputs.forEach((input, index) => input.props.ref({ focus: () => focused = index }));
  inputs[0].props.onChangeText('1');
  assert.equal(focused, 1);
  inputs[3].props.onChangeText('123456');
  assert.equal(changed.join(''), '123456');
  assert.equal(focused, 5);
  inputs = nodes(render(['1', '2', '', '', '', '']), 'Input');
  inputs[2].props.onKeyPress({ nativeEvent: { key: 'Backspace' } });
  assert.equal(focused, 1);
  assert.equal(changed[1], '');
  assert.ok(inputs.every((input) => input.props.keyboardType === 'number-pad'));
  assert.ok(nodes(render(Array(6).fill(''), true), 'Input').every((input) => input.props.editable === false));
});

function screen(file, recovery, api = {}) {
  const hook = hooks();
  const navigated = [];
  const authorized = [];
  const context = {
    recovery,
    codeSent: (email) => { recovery.email = email; recovery.resendAt = Date.now() + 60000; recovery.authorization = null; },
    verified: (token, seconds) => { authorized.push(token); recovery.authorization = { token, expiresAt: Date.now() + seconds * 1000 }; },
    clear: () => { recovery.email = ''; recovery.authorization = null; },
  };
  const ui = {
    RecoveryScreen: 'Screen', RecoveryButton: 'Button', RecoveryError: 'Error', RecoveryField: 'Field',
    useSecondsRemaining: (deadline) => Math.max(0, Math.ceil((deadline - Date.now()) / 1000)),
    useRecoveryAction: () => ({ submitting: false, error: null, run: (task) => task(() => true) }),
  };
  const { default: Screen } = load(file, {
    react: hook.react, 'react/jsx-runtime': runtime,
    'react-native': { Pressable: 'Pressable', Text: 'Text', View: 'View' },
    'expo-router': { Redirect: 'Redirect', router: { push: (href) => navigated.push(href), replace: (href) => navigated.push(href) } },
    '@/context/PasswordRecoveryContext': { usePasswordRecovery: () => context },
    '@/components/auth/PasswordRecoveryUI': ui,
    '@/components/auth/OtpInput': { __esModule: true, default: 'Otp' },
    '@/services/api/auth': api,
    '@/services/api/client': { ApiError: class extends Error {} },
    '@/validators/auth': validators,
  });
  return { render: () => hook.render(Screen), navigated, authorized, recovery };
}
const settle = () => new Promise((resolve) => setImmediate(resolve));

test('verification UI has no passwords or sign-in link and requires successful backend verification', async () => {
  let resolveRequest;
  let requested;
  const app = screen('src/screens/auth/VerifyPasswordCode.tsx', { email: 'test@example.com', resendAt: 0 }, {
    verifyPasswordResetCodeRequest: (email, code) => { requested = { email, code }; return new Promise((resolve) => resolveRequest = resolve); },
  });
  let tree = app.render();
  assert.equal(tree.props.title, 'Verify your code');
  assert.equal(nodes(tree, 'Field').length, 0);
  assert.equal(nodes(tree, 'Button')[0].props.disabled, true);
  assert.equal(JSON.stringify(tree).includes('Sign in'), false);
  nodes(tree, 'Otp')[0].props.onChange(['1', '2', '3', '4', '5', '6']);
  tree = app.render();
  assert.equal(nodes(tree, 'Button')[0].props.disabled, false);
  nodes(tree, 'Button')[0].props.onPress();
  assert.equal(requested.code, '123456');
  assert.equal(app.navigated.length, 0);
  resolveRequest({ reset_token: 'server-issued-grant', expires_in: 300 });
  await settle();
  assert.deepEqual(app.authorized, ['server-issued-grant']);
  assert.deepEqual(app.navigated, ['/create-new-password']);
});

test('verification cannot be entered without an email request and resend honors cooldown', async () => {
  assert.equal(screen('src/screens/auth/VerifyPasswordCode.tsx', { email: '', resendAt: 0 }).render().type, 'Redirect');
  let requests = 0;
  const app = screen('src/screens/auth/VerifyPasswordCode.tsx', { email: 'test@example.com', resendAt: Date.now() + 60000 }, {
    forgotPasswordRequest: async () => requests++,
  });
  let tree = app.render();
  assert.equal(nodes(tree, 'Pressable')[0].props.disabled, true);
  nodes(tree, 'Pressable')[0].props.onPress();
  assert.equal(requests, 0);
  app.recovery.resendAt = 0;
  tree = app.render();
  nodes(tree, 'Pressable')[0].props.onPress();
  await settle();
  assert.equal(requests, 1);
  assert.equal(nodes(app.render(), 'Pressable')[0].props.disabled, true);
});

test('password screen rejects direct access and renders only two matching password fields', async () => {
  const direct = screen('src/screens/auth/CreateNewPassword.tsx', { email: '', authorization: null });
  assert.equal(direct.render().type, 'Redirect');
  assert.equal(direct.render().props.href, '/forgot-password');
  let payload;
  const app = screen('src/screens/auth/CreateNewPassword.tsx', { email: 'test@example.com', authorization: { token: 'server-grant', expiresAt: Date.now() + 300000 } }, {
    resetPasswordRequest: async (fields) => { payload = fields; },
  });
  let tree = app.render();
  assert.equal(nodes(tree, 'Otp').length, 0);
  const fields = nodes(tree, 'Field');
  assert.equal(fields.length, 2);
  assert.ok(fields.every((field) => field.props.secureTextEntry));
  fields[0].props.onChangeText('new-password-123');
  fields[1].props.onChangeText('different');
  assert.equal(nodes(app.render(), 'Button')[0].props.disabled, true);
  fields[1].props.onChangeText('new-password-123');
  tree = app.render();
  assert.equal(nodes(tree, 'Button')[0].props.disabled, false);
  nodes(tree, 'Button')[0].props.onPress();
  await settle();
  assert.equal(payload.reset_token, 'server-grant');
  assert.equal(payload.code, undefined);
  assert.equal(app.navigated[0].pathname, '/login');
  assert.equal(app.navigated[0].params.passwordReset, 'success');
  assert.equal(app.recovery.authorization, null);
  assert.equal(app.render(), null, 'clearing credentials during successful navigation cannot trigger the direct-link guard');
});

test('expired authorization disables password reset and offers another code', () => {
  const app = screen('src/screens/auth/CreateNewPassword.tsx', { email: 'test@example.com', authorization: { token: 'expired', expiresAt: Date.now() - 1000 } });
  const tree = app.render();
  assert.equal(nodes(tree, 'Button')[0].props.disabled, true);
  assert.ok(nodes(tree, 'Field').every((field) => field.props.editable === false));
  assert.match(nodes(tree, 'Error')[0].props.message, /expired/);
});

test('immediate action lock prevents duplicate requests and ignores responses after blur', async () => {
  const hook = hooks();
  let blur;
  const { useRecoveryAction } = load('src/components/auth/PasswordRecoveryUI.tsx', {
    react: { ...hook.react, useEffect() {} }, 'react/jsx-runtime': runtime,
    'expo-router': { useFocusEffect: (callback) => blur = callback() },
    'react-native': {}, 'react-native-safe-area-context': {},
    '@/components/KeyboardView': {}, '@/components/KeyboardAwareScrollView': {},
    '@/components/Mascot': {}, '@/components/WaveHeader': {}, '@/context/ThemeContext': {},
  });
  const action = hook.render(useRecoveryAction);
  let release;
  let requests = 0;
  let navigated = false;
  const first = action.run(async (isActive) => { requests++; await new Promise((resolve) => release = resolve); if (isActive()) navigated = true; });
  await action.run(async () => requests++);
  assert.equal(requests, 1);
  blur();
  release();
  await first;
  assert.equal(navigated, false);
});

test('requesting an email opens verification only after the request succeeds', async () => {
  let resolveRequest;
  const app = screen('src/screens/auth/ForgotPassword.tsx', { email: '', authorization: null }, {
    forgotPasswordRequest: () => new Promise((resolve) => resolveRequest = resolve),
  });
  let tree = app.render();
  assert.equal(nodes(tree, 'Button')[0].props.disabled, true);
  nodes(tree, 'Field')[0].props.onChangeText('Test@Example.com');
  tree = app.render();
  nodes(tree, 'Button')[0].props.onPress();
  assert.equal(app.navigated.length, 0);
  resolveRequest({ message: 'If registered, a code is on its way.' });
  await settle();
  assert.equal(app.recovery.email, 'test@example.com');
  assert.deepEqual(app.navigated, ['/verify-code']);
});

test('both password fields toggle visibility independently', () => {
  for (const label of ['New password', 'Confirm new password']) {
    const hook = hooks();
    const { RecoveryField } = load('src/components/auth/PasswordRecoveryUI.tsx', {
      react: { ...hook.react, useEffect() {} }, 'react/jsx-runtime': runtime,
      'expo-router': {},
      'react-native': { View: 'View', Text: 'Text', TextInput: 'Input', Pressable: 'Pressable' },
      'react-native-safe-area-context': {}, '@/components/KeyboardView': {},
      '@/components/KeyboardAwareScrollView': {}, '@/components/Mascot': {}, '@/components/WaveHeader': {},
      '@/context/ThemeContext': { useTheme: () => ({ chrome: {} }) },
    });
    const render = () => hook.render(() => RecoveryField({ label, secureTextEntry: true, value: 'private', onChangeText() {} }));
    let tree = render();
    assert.equal(nodes(tree, 'Input')[0].props.secureTextEntry, true);
    nodes(tree, 'Pressable')[0].props.onPress();
    tree = render();
    assert.equal(nodes(tree, 'Input')[0].props.secureTextEntry, false);
    nodes(tree, 'Pressable')[0].props.onPress();
    assert.equal(nodes(render(), 'Input')[0].props.secureTextEntry, true);
  }
});

test('recovery scroll margin brings actions above keyboard without changing other screens', () => {
  function check(focusBottomOffset) {
    const hook = hooks();
    const listeners = {};
    const timers = [];
    const scrolled = [];
    const input = { measureLayout: (_content, callback) => callback(0, 300, 40, 54) };
    const { default: Scroll } = load('src/components/KeyboardAwareScrollView.tsx', {
      react: { ...hook.react, useEffect: (effect) => effect() }, 'react/jsx-runtime': runtime,
      'react-native': {
        Platform: { OS: 'android' }, ScrollView: 'Scroll',
        Keyboard: { addListener: (event, callback) => { listeners[event] = callback; return { remove() {} }; } },
        TextInput: { State: { currentlyFocusedInput: () => input } },
      },
    }, {
      setTimeout: (callback) => { timers.push(callback); return timers.length; },
      clearTimeout() {}, setInterval: () => 1, clearInterval() {},
    });
    const tree = hook.render(() => Scroll({ focusBottomOffset }));
    tree.props.ref.current = { getInnerViewRef: () => ({}), scrollTo: ({ y }) => scrolled.push(y) };
    tree.props.onLayout({ nativeEvent: { layout: { height: 400 } } });
    listeners.keyboardDidShow();
    timers.splice(0).forEach((callback) => callback());
    assert.equal(tree.props.focusBottomOffset, undefined);
    return scrolled;
  }
  assert.equal(check(undefined).length, 0, 'other screens retain their original focused-field margin');
  const scrolls = check(192);
  assert.equal(scrolls.length, 1);
  assert.ok(354 + 192 - scrolls[0] <= 400, 'focused field and recovery action region are visible');
});
