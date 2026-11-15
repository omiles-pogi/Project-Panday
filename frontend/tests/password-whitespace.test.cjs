const { test } = require('node:test');
const assert = require('node:assert/strict');
const { load, hooks, nodes, text, runtime, defaults } = require('./helpers/account-harness.cjs');
const validators = load('src/validators/auth.ts', {});
const whitespace = [' ', '\t', '\n', '\r', '\v', '\f', '\u0085', '\u00a0', '\u1680', '\u2003', '\u200b', '\u2028', '\u2029', '\u202f', '\u205f', '\u2060', '\u3000', '\ufeff'];

test('one policy rejects typed and pasted whitespace without altering secrets, and retains existing complexity', () => {
  for (const space of whitespace) {
    for (const value of [`${space}Validpass123`, `Validpass123${space}`, `Valid${space}pass123`]) {
      const result = validators.passwordInputChange('Original123', value);
      assert.equal(result.accepted, false); assert.equal(result.value, 'Original123'); assert.match(result.error, /whitespace/);
      assert.equal(validators.isValidPassword(value), false);
      const legacy = validators.passwordInputChange('', value, true);
      assert.equal(legacy.accepted, true); assert.equal(legacy.value, value);
    }
  }
  for (const value of ['Validpass123', 'a1😀😀😀😀😀😀']) assert.equal(validators.isValidPassword(value), true);
  for (const value of ['short1', 'onlyletters', '123456789']) assert.equal(validators.isValidPassword(value), false);
});

async function field({ existing = false, verified = false } = {}) {
  const h = hooks(); let value = 'Validpass123'; const changes = [];
  const Guard = load('src/components/auth/PasswordInputGuard.tsx', {
    react: h.react, 'react/jsx-runtime': runtime, 'react-native': { Pressable: 'Button', Text: 'Text' }, '@/validators/auth': validators,
  });
  const Field = load('src/components/auth/PasswordRecoveryUI.tsx', {
    react: h.react, 'react/jsx-runtime': runtime,
    'react-native': { View: 'View', Text: 'Text', TextInput: 'Input', Pressable: 'Button' },
    'expo-router': {}, 'react-native-safe-area-context': {}, '@/components/KeyboardView': {}, '@/components/KeyboardAwareScrollView': {},
    '@/components/Mascot': {}, '@/components/WaveHeader': {}, '@expo/vector-icons': { Ionicons: 'Icon' },
    '@/context/ThemeContext': { useTheme: () => ({ chrome: { border: '#ddd' } }) },
    '@/components/auth/PasswordValidation': { useValidationColors: () => ({ neutral: '#ddd', valid: '#080', invalid: '#800' }) },
    '@/components/auth/PasswordInputGuard': Guard,
  }).RecoveryField;
  const render = async () => {
    const tree = await h.render(() => Field({ label: 'Password', value, onChangeText: next => { changes.push(next); value = next; }, secureTextEntry: true, existingPassword: existing, allowLegacyWhitespace: verified }));
    const notice = nodes(tree, 'PasswordInputFeedback')[0];
    return { tree, notice: Guard.PasswordInputFeedback(notice.props) };
  };
  return { render, changes, value: () => value };
}

test('shared password fields reject paste/spacebar edits while Show/Hide stays independent', async () => {
  const app = await field(); let rendered = await app.render();
  nodes(rendered.tree, 'Input')[0].props.onChangeText('Validpass123 '); rendered = await app.render();
  assert.equal(app.value(), 'Validpass123'); assert.match(text(rendered.notice), /cannot contain/);
  nodes(rendered.tree, 'Button')[0].props.onPress(); rendered = await app.render();
  assert.equal(nodes(rendered.tree, 'Input')[0].props.secureTextEntry, false);
  nodes(rendered.tree, 'Input')[0].props.onChangeText('\tPastedpass123'); rendered = await app.render();
  assert.equal(app.changes.length, 0);
  nodes(rendered.tree, 'Input')[0].props.onChangeText('Changedpass456'); rendered = await app.render();
  assert.equal(app.value(), 'Changedpass456'); assert.doesNotMatch(text(rendered.notice), /cannot contain/);
  assert.equal(nodes(rendered.notice, 'Button').length, 0, 'new-password fields never offer a legacy bypass');
});

test('current-password exception requires explicit opt-in and passes the exact original secret', async () => {
  const app = await field({ existing: true }); let rendered = await app.render();
  const legacy = ' Legacy pass123\t';
  nodes(rendered.tree, 'Input')[0].props.onChangeText(legacy); rendered = await app.render();
  assert.equal(app.changes.length, 0);
  nodes(rendered.notice, 'Button')[0].props.onPress(); rendered = await app.render();
  nodes(rendered.tree, 'Input')[0].props.onChangeText(legacy); rendered = await app.render();
  assert.equal(app.value(), legacy); assert.match(text(rendered.notice), /enter it exactly/);
});

test('mandatory password update retries sign-in after a successful save without submitting the change twice', async () => {
  const h = hooks(); const updates = [], logins = []; let first = true;
  const Component = load('src/components/auth/RequiredPasswordUpdate.tsx', {
    react: h.react, 'react/jsx-runtime': runtime, 'react-native': { Pressable: 'Button', Text: 'Text', View: 'View' },
    '@/context/AuthContext': { useAuth: () => ({ user: { email: 'synthetic@example.test' }, login: async (...args) => { logins.push(args); if (first) { first = false; throw new Error('Network failed'); } }, logout() {} }) },
    '@/services/api/account': { changeAccountPassword: async fields => { updates.push(fields); } }, '@/validators/auth': validators,
    '@/components/auth/PasswordValidation': { ...defaults('Requirements'), PasswordConfirmation: 'Confirmation' },
    '@/components/auth/PasswordRecoveryUI': { RecoveryButton: 'Submit', RecoveryError: 'Error', RecoveryField: 'Field', RecoveryScreen: 'Screen' },
  }).default;
  const render = () => h.render(Component); let tree = await render();
  for (const [label, value] of [['Current Password', ' Legacy pass123\t'], ['New Password', 'Newpass123'], ['Confirm New Password', 'Newpass123']]) {
    nodes(tree, 'Field').find(node => node.props.label === label).props.onChangeText(value); tree = await render();
  }
  assert.equal(nodes(tree, 'Submit')[0].props.disabled, false);
  await nodes(tree, 'Submit')[0].props.onPress(); tree = await render();
  assert.equal(updates.length, 1); assert.equal(updates[0].current_password, ' Legacy pass123\t');
  assert.equal(nodes(tree, 'Submit')[0].props.label, 'Continue signing in');
  await nodes(tree, 'Submit')[0].props.onPress(); tree = await render();
  assert.equal(updates.length, 1); assert.equal(logins.length, 2); assert.equal(logins[1][1], 'Newpass123');
});
