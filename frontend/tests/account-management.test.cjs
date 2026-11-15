const { test } = require('node:test');
const assert = require('node:assert/strict');
const { load, hooks, nodes, text, deferred, Multipart, runtime, theme, defaults } = require('./helpers/account-harness.cjs');
const asset = (changes = {}) => ({ uri: 'file:///picked-photo.jpg', mimeType: 'image/jpeg', width: 512, height: 512, fileSize: 4000, ...changes });
const settings = (userId = 14, changes = {}) => ({ userId, photoUrl: '/api/account/photo/14/old.jpg', preferences: { push_enabled: true, project_updates: false, messages: true }, ...changes });

function photo(options = {}) {
  const userId = options.userId ?? 14;
  const h = hooks(); let picked = asset(); let denied = false; let cancelled = false; let postError = false;
  const uploads = []; const confirmations = []; const nativeLoads = []; let removes = 0; let launches = 0;
  const account = { ready: true, data: settings(userId, { photoUrl: `/api/account/photo/${userId}/old.jpg` }), acceptPhoto: async data => { account.data = data; } };
  const permission = async () => ({ granted: !denied });
  const launch = async () => { launches++; return cancelled ? { canceled: true } : { canceled: false, assets: [picked] }; };
  const Card = load('src/components/ProfilePhoto.tsx', {
    react: h.react, 'react/jsx-runtime': runtime,
    'expo-router': { useFocusEffect: () => {} },
    'react-native': { ActivityIndicator: 'ActivityIndicator', Image: 'Image', Modal: 'Modal', Platform: { OS: options.platform ?? 'android' }, Pressable: 'Pressable', Text: 'Text', View: 'View', Alert: { alert: (...args) => confirmations.push(args) } },
    expo: { requireOptionalNativeModule: name => { nativeLoads.push(name); return options.missingNative ? null : {}; } },
    'expo-image-picker': { requestCameraPermissionsAsync: permission, requestMediaLibraryPermissionsAsync: permission, launchCameraAsync: launch, launchImageLibraryAsync: launch },
    '@expo/vector-icons': { Ionicons: 'Icon' },
    '@/context/AuthContext': { useAuth: () => ({ user: { id: userId, role: options.role ?? 'homeowner' } }) },
    '@/context/AccountContext': { useAccount: () => account }, '@/context/ThemeContext': { useTheme: () => theme },
    '@/utils/profilePhotoDisplay': { loadProfilePhoto: async () => ({ uri: 'file:///cache/avatar.jpg', dispose() {} }) },
    '@/services/api/account': { uploadProfilePhoto: async image => { uploads.push(image); if (postError) throw new Error('Upload failed'); return settings(options.responseUserId ?? userId, { photoUrl: `/api/account/photo/${userId}/new.jpg` }); }, removeProfilePhoto: async () => { removes++; return settings(userId, { photoUrl: null }); } },
    '@/utils/profilePhoto': load('src/utils/profilePhoto.ts', {}),
  }, { FormData: Multipart }).default;
  let tree;
  const render = async () => tree = await h.render(() => Card({ name: 'Saved Account' }));
  const action = label => {
    const visible = nodes(tree, 'Modal').filter(node => node.props.visible);
    const root = visible.length ? visible : tree;
    const button = nodes(root, 'Pressable').find(node => text(node).trim() === label || node.props.accessibilityLabel === label);
    assert.ok(button, `Missing action ${label}`); button.props.onPress();
  };
  return { render, action, account, uploads, confirmations, nativeLoads, removes: () => removes, launches: () => launches,
    pick: value => { picked = value; }, deny: () => { denied = true; }, cancelPicker: () => { cancelled = true; }, failPost: () => { postError = true; } };
}

test('photo gallery selection previews first, Cancel preserves the saved image, and Save uploads exactly once', async () => {
  const app = photo(); await app.render(); assert.deepEqual(app.nativeLoads, []);
  app.action('Change profile photo'); await app.render(); app.action('Choose from gallery'); let tree = await app.render();
  assert.equal(app.uploads.length, 0); assert.match(text(tree), /Preview profile photo/);
  app.action('Cancel'); await app.render(); assert.equal(app.account.data.photoUrl, '/api/account/photo/14/old.jpg');
  app.action('Change profile photo'); await app.render(); app.action('Choose from gallery'); await app.render();
  app.action('Save Photo'); app.action('Save Photo'); await app.render();
  assert.equal(app.uploads.length, 1); assert.equal(app.uploads[0].uri, 'file:///picked-photo.jpg');
  assert.equal(app.uploads[0].mimeType, 'image/jpeg');
  assert.equal(app.account.data.photoUrl, '/api/account/photo/14/new.jpg');
});

test('Remove Photo requires explicit confirmation and restores the default without another upload', async () => {
  const app = photo(); await app.render(); app.action('Change profile photo'); await app.render(); app.action('Remove photo');
  assert.equal(app.removes(), 0); app.confirmations[0][2][0].onPress?.();
  assert.equal(app.account.data.photoUrl, '/api/account/photo/14/old.jpg');
  app.confirmations[0][2][1].onPress(); await app.render();
  assert.equal(app.removes(), 1); assert.equal(app.account.data.photoUrl, null); assert.equal(app.uploads.length, 0);
});

test('camera and iOS gallery permission denial never launches or uploads, and an old native build fails safely', async () => {
  for (const platform of ['android', 'ios']) {
    const app = photo({ platform }); app.deny(); await app.render(); app.action('Change profile photo'); await app.render();
    app.action(platform === 'android' ? 'Take photo' : 'Choose from gallery'); const tree = await app.render();
    assert.match(text(tree), /permission was denied/); assert.equal(app.launches(), 0); assert.equal(app.uploads.length, 0);
  }
  const app = photo({ missingNative: true }); await app.render(); app.action('Change profile photo'); await app.render(); app.action('Take photo');
  assert.match(text(await app.render()), /updated development build/); assert.equal(app.uploads.length, 0);
});

test('camera capture is available, picker cancellation preserves the image, and upload errors keep the preview', async () => {
  const app = photo(); await app.render(); app.action('Change profile photo'); await app.render(); app.action('Take photo'); await app.render();
  assert.equal(app.launches(), 1); app.failPost(); app.action('Save Photo'); const tree = await app.render();
  assert.match(text(tree), /Upload failed/); assert.equal(app.account.data.photoUrl, '/api/account/photo/14/old.jpg');
  assert.equal(nodes(tree, 'Modal').find(node => node.props.visible).props.children.props.children.props.children[1].type, 'Image');
  const cancelled = photo(); cancelled.cancelPicker(); await cancelled.render(); cancelled.action('Change profile photo'); await cancelled.render(); cancelled.action('Choose from gallery');
  assert.equal(nodes(await cancelled.render(), 'Modal').filter(node => node.props.visible).length, 0); assert.equal(cancelled.uploads.length, 0);
});

test('client photo validation rejects unsupported, oversized and excessive-dimension images', async () => {
  for (const bad of [asset({ mimeType: 'image/svg+xml' }), asset({ fileSize: 5242881 }), asset({ width: 4097 })]) {
    const app = photo(); app.pick(bad); await app.render(); app.action('Change profile photo'); await app.render(); app.action('Choose from gallery');
    const tree = await app.render(); assert.equal(app.uploads.length, 0);
    assert.equal(nodes(tree, 'Modal').some(node => node.props.visible), false);
  }
});

test('all four roles share the photo preview/upload/replace flow without accepting another account response', async () => {
  for (const [index, role] of ['homeowner', 'contractor', 'worker', 'supplier'].entries()) {
    const userId = 20 + index; const app = photo({ role, userId });
    app.pick(asset({ uri: 'file:///camera-or-gallery.png', mimeType: 'image/png' }));
    await app.render(); app.action('Change profile photo'); await app.render(); app.action('Choose from gallery'); await app.render();
    app.action('Save Photo'); app.action('Save Photo'); await app.render();
    assert.equal(app.uploads.length, 1); assert.equal(app.uploads[0].mimeType, 'image/png');
    assert.equal(app.account.data.photoUrl, `/api/account/photo/${userId}/new.jpg`);
    app.action('Change profile photo'); await app.render(); app.action('Take photo'); await app.render(); app.action('Cancel'); await app.render();
    assert.equal(app.uploads.length, 1); assert.equal(app.account.data.photoUrl, `/api/account/photo/${userId}/new.jpg`);
  }
  const mismatched = photo({ responseUserId: 99 }); await mismatched.render();
  mismatched.action('Change profile photo'); await mismatched.render(); mismatched.action('Choose from gallery'); await mismatched.render(); mismatched.action('Save Photo');
  assert.match(text(await mismatched.render()), /did not match your account/);
  assert.equal(mismatched.account.data.photoUrl, '/api/account/photo/14/old.jpg');
});

test('multipart API uploads omit JSON content type and image bearer headers are restricted to our account-photo path', async () => {
  const requests = [];
  const api = load('src/services/api/client.ts', { 'expo-constants': defaults({ expoConfig: null }), '@/utils/plannerError': load('src/utils/plannerError.ts', {}) }, {
    process: { env: { EXPO_PUBLIC_API_BASE_URL: 'https://api.example.test' } }, FormData: Multipart,
    fetch: async (...args) => { requests.push(args); return { ok: true, json: async () => ({}) }; },
  });
  api.setAuthToken('test-token');
  await api.apiFetch('/api/account/photo', { method: 'POST', body: new Multipart() });
  assert.equal(requests[0][1].headers['content-type'], undefined);
  await api.apiFetch('/api/account/preferences', { method: 'PATCH', body: '{}' });
  assert.equal(requests[1][1].headers['content-type'], 'application/json');
  assert.equal(api.accountPhotoSource('/api/account/photo/14/photo.jpg').headers.Authorization, 'Bearer test-token');
  for (const path of ['https://third-party.example/photo.jpg', '/api/account/photo/14/../secret', '/storage/private']) assert.equal(api.accountPhotoSource(path), undefined);
  api.setAuthToken(null); assert.equal(api.accountPhotoSource('/api/account/photo/14/photo.jpg'), undefined);
});

test('theme switches and header toggles share one state, persist per account, and reject late hydration', async () => {
  const h = hooks(); let user = { id: 14 }; const store = new Map([['panday_theme_mode:14', 'dark'], ['panday_theme_mode:15', 'light']]);
  const Provider = load('src/context/ThemeContext.tsx', {
    react: h.react, 'react/jsx-runtime': runtime, 'react-native': { Appearance: { getColorScheme: () => 'light' }, View: 'View' },
    nativewind: { vars: value => value }, '@/context/AuthContext': { useAuth: () => ({ user }) },
    '@/utils/tokenStorage': { tokenStorage: { getItem: async key => store.get(key), setItem: async (key, value) => store.set(key, value) } },
    '@/theme/colors': { darkChrome: { card: '#111' }, lightChrome: { card: '#fff' } },
  }).ThemeProvider;
  const render = async () => (await h.render(() => Provider({ children: null }))).props.value;
  let api = await render(); assert.equal(api.mode, 'dark');
  api.toggleTheme(); api = await render(); assert.equal(api.mode, 'light'); assert.equal(store.get('panday_theme_mode:14'), 'light');
  api.toggleTheme(); api.toggleTheme(); api = await render(); assert.equal(api.mode, 'light');
  api.setTheme('dark'); api = await render(); assert.equal(store.get('panday_theme_mode:14'), 'dark');
  user = { id: 15 }; api = await render(); assert.equal(api.mode, 'light');
  api.setTheme('dark'); await render(); user = { id: 14 }; api = await render(); assert.equal(api.mode, 'dark');
  assert.equal(store.get('panday_theme_mode:15'), 'dark');
});

test('a delayed saved theme cannot undo a newer user choice', async () => {
  const h = hooks(); const delayed = deferred(); const writes = [];
  const Provider = load('src/context/ThemeContext.tsx', {
    react: h.react, 'react/jsx-runtime': runtime, 'react-native': { Appearance: { getColorScheme: () => 'light' }, View: 'View' },
    nativewind: { vars: value => value }, '@/context/AuthContext': { useAuth: () => ({ user: { id: 14 } }) },
    '@/utils/tokenStorage': { tokenStorage: { getItem: () => delayed.promise, setItem: async (...args) => writes.push(args) } },
    '@/theme/colors': { darkChrome: {}, lightChrome: {} },
  }).ThemeProvider;
  const render = async () => (await h.render(() => Provider({ children: null }))).props.value;
  let api = await render(); api.setTheme('dark'); api = await render(); delayed.resolve('light'); api = await render();
  assert.equal(api.mode, 'dark'); assert.deepEqual(writes, [['panday_theme_mode:14', 'dark']]);
});

test('a new account defaults to light even on a dark device, while a manual saved dark choice survives account switches', async () => {
  const h=hooks();let user={id:90};const store=new Map();
  const Provider=load('src/context/ThemeContext.tsx',{
    react:h.react,'react/jsx-runtime':runtime,'react-native':{Appearance:{getColorScheme:()=> 'dark'},View:'View'},nativewind:{vars:value=>value},
    '@/context/AuthContext':{useAuth:()=>({user})},'@/utils/tokenStorage':{tokenStorage:{getItem:async key=>store.get(key),setItem:async(key,value)=>store.set(key,value)}},
    '@/theme/colors':{darkChrome:{},lightChrome:{}},
  }).ThemeProvider;
  const render=async()=>(await h.render(()=>Provider({children:null}))).props.value;
  let api=await render();assert.equal(api.mode,'light');api.setTheme('dark');api=await render();assert.equal(api.mode,'dark');
  user={id:91};api=await render();assert.equal(api.mode,'light');user={id:90};api=await render();assert.equal(api.mode,'dark');
});

function accountProvider(options = {}) {
  const h = hooks(); const photos = []; const changes = [];
  const user = { id: options.userId ?? 14, role: 'homeowner' };
  const syncProfilePhoto = (...args) => photos.push(args);
  const Provider = load('src/context/AccountContext.tsx', {
    react: h.react, 'react/jsx-runtime': runtime,
    '@/context/AuthContext': { useAuth: () => ({ user, syncProfilePhoto }) },
    '@/services/api/account': {
      fetchAccountSettings: async () => options.read ? options.read() : settings(user.id),
      updateNotificationPreferences: async value => { changes.push(value); if (options.write) return options.write(value); return { ...settings(user.id), preferences: { ...settings(user.id).preferences, ...value } }; },
    },
  }).AccountProvider;
  const render = async () => (await h.render(() => { const session = Provider({ children: null }); assert.equal(session.key, user.id); return session.type(session.props); })).props.value;
  return { render, h, photos, changes };
}

test('account preference writes wait for confirmation, reject duplicate taps, and preserve a newer photo response', async () => {
  const pending = deferred(); const app = accountProvider({ write: () => pending.promise });
  let api = await app.render(); assert.equal(api.ready, true); assert.equal(api.data.preferences.push_enabled, true);
  const saving = api.updatePreferences({ push_enabled: false }); void api.updatePreferences({ messages: false });
  api = await app.render(); assert.equal(api.saving, true); assert.equal(api.data.preferences.push_enabled, true);
  await api.acceptPhoto(settings(14, { photoUrl: '/api/account/photo/14/new.jpg' }));
  pending.resolve({ ...settings(), preferences: { ...settings().preferences, push_enabled: false } }); await saving; api = await app.render();
  assert.equal(app.changes.length, 1); assert.equal(api.data.preferences.push_enabled, false);
  assert.equal(api.data.preferences.messages, true); assert.equal(api.data.photoUrl, '/api/account/photo/14/new.jpg');
  assert.deepEqual(app.photos, [[14, '/api/account/photo/14/old.jpg'], [14, '/api/account/photo/14/new.jpg']]);
});

test('failed preference saves retain the last server state, and mismatched account responses are rejected', async () => {
  const app = accountProvider({ write: () => { throw new Error('Server unavailable'); } });
  let api = await app.render(); await api.updatePreferences({ messages: false }); api = await app.render();
  assert.equal(api.data.preferences.messages, true); assert.equal(api.error, 'Server unavailable');
  await api.acceptPhoto(settings(15)); api = await app.render(); assert.equal(app.photos.length, 1);
  const other = accountProvider({ userId: 15, read: () => settings(14) });
  const rejected = await other.render(); assert.equal(rejected.data, null); assert.match(rejected.error, /did not match/);
});

test('stale account reads cannot replace a newly saved photo and a remounted account restores its own preferences', async () => {
  let count = 0; const pending = deferred();
  const app = accountProvider({ read: () => ++count === 1 ? settings() : pending.promise });
  let api = await app.render(); const refresh = api.refresh();
  await api.acceptPhoto(settings(14, { photoUrl: null })); pending.resolve(settings()); await refresh;
  api = await app.render(); assert.equal(api.data.photoUrl, null);
  app.h.unmount();
  const other = accountProvider({ userId: 15, read: () => ({ ...settings(15), preferences: { push_enabled: false, project_updates: true, messages: false } }) });
  const next = await other.render(); assert.equal(next.data.userId, 15); assert.equal(next.data.preferences.messages, false);
});

test('functional switches use server values, preserve categories while disabled, and Other has no actions', async () => {
  const h = hooks(); const changes = []; const appearance = [];
  const account = { ready: true, data: settings(), saving: false, refresh: async () => {}, updatePreferences: async value => changes.push(value) };
  const View = load('src/components/AccountManagement.tsx', {
    react: h.react, 'react/jsx-runtime': runtime, 'react-native': { ActivityIndicator: 'ActivityIndicator', Pressable: 'Pressable', Switch: 'Switch', Text: 'Text', View: 'View' },
    '@expo/vector-icons': { Ionicons: 'Icon' }, '@/components/ui': { Card: 'Card' },
    '@/components/auth/PasswordRecoveryUI': { RecoveryField: 'RecoveryField' },
    '@/components/auth/PasswordValidation': { __esModule: true, default: 'Requirements', PasswordConfirmation: 'Confirmation' },
    '@/validators/auth': { isValidPassword: value => value.length >= 8 && /[A-Za-z]/.test(value) && /\d/.test(value) },
    '@/context/AuthContext': { useAuth: () => ({ user: { id: 14, name: 'Account Name', email: 'account@example.test', role: 'worker', license_number: 'RESTRICTED' } }) },
    '@/context/AccountContext': { useAccount: () => account }, '@/context/ThemeContext': { useTheme: () => ({ ...theme, setTheme: value => appearance.push(value) }) },
    '@/context/NotificationContext': { useNotifications: () => ({ pushStatus: 'In-app feed available' }) },
    '@/services/api/account': { changeAccountPassword: async () => ({ message: 'Updated' }) },
  }).default;
  let tree = await h.render(() => View({ accountInformation: true }));
  const switches = nodes(tree, 'SettingSwitch');
  switches[0].props.onChange(true); switches[1].props.onChange(false);
  assert.deepEqual(appearance, ['dark']); assert.equal(changes[0].push_enabled, false);
  account.data.preferences.push_enabled = false; tree = await h.render(() => View({ accountInformation: true }));
  const categories = nodes(tree, 'SettingSwitch').slice(2);
  assert.deepEqual(categories.map(node => node.props.value), [false, true]); assert.ok(categories.every(node => node.props.disabled));
  assert.equal(nodes(tree, 'Card').find(node => node.props.title === 'Other').props.children.some(node => node.props.onPress), false);
  assert.match(text(tree), /Coming Soon/); assert.match(text(tree), /RESTRICTED/);
});

test('Change Password validates before submitting, reports server errors, locks duplicate taps and clears secrets after success', async () => {
  const h = hooks(); const requests = []; let pending = deferred();
  const Screen = load('src/components/AccountManagement.tsx', {
    react: h.react, 'react/jsx-runtime': runtime, 'react-native': { ActivityIndicator: 'ActivityIndicator', Pressable: 'Pressable', Switch: 'Switch', Text: 'Text', View: 'View' },
    '@expo/vector-icons': { Ionicons: 'Icon' }, '@/components/ui': { Card: 'Card' },
    '@/components/auth/PasswordRecoveryUI': { RecoveryField: 'RecoveryField' },
    '@/components/auth/PasswordValidation': { __esModule: true, default: 'Requirements', PasswordConfirmation: 'Confirmation' },
    '@/validators/auth': { isValidPassword: value => value.length >= 8 && /[A-Za-z]/.test(value) && /\d/.test(value) },
    '@/context/AuthContext': { useAuth: () => ({ user: { id: 14, role: 'homeowner' } }) },
    '@/context/AccountContext': { useAccount: () => ({ ready: true, data: settings() }) }, '@/context/ThemeContext': { useTheme: () => ({ ...theme, setTheme: () => {} }) },
    '@/context/NotificationContext': { useNotifications: () => ({ pushStatus: '' }) },
    '@/services/api/account': { changeAccountPassword: async value => { requests.push(value); return pending.promise; } },
  }).default;
  const render = () => h.render(() => Screen({}));
  const button = (tree, label) => nodes(tree, 'Pressable').find(node => node.props.accessibilityLabel === label || text(node).trim() === label);
  const field = (tree, label) => nodes(tree, 'RecoveryField').find(node => node.props.label === label);
  let tree = await render(); button(tree, 'Change Password').props.onPress(); tree = await render();
  assert.equal(nodes(tree, 'RecoveryField').length, 3);
  assert.ok(nodes(tree, 'RecoveryField').every(node => node.props.secureTextEntry));
  button(tree, 'Update Password').props.onPress(); tree = await render(); assert.equal(requests.length, 0);
  assert.match(text(tree), /Enter your current password/);
  field(tree, 'Current Password').props.onChangeText('Currentpass123');
  field(tree, 'New Password').props.onChangeText('Newpassword123');
  field(tree, 'Confirm New Password').props.onChangeText('Mismatch123');
  tree = await render(); button(tree, 'Update Password').props.onPress(); assert.equal(requests.length, 0);
  field(tree, 'Confirm New Password').props.onChangeText('Newpassword123'); tree = await render();
  button(tree, 'Update Password').props.onPress(); button(tree, 'Update Password').props.onPress();
  assert.equal(requests.length, 1); pending.reject(new Error('Current password is incorrect')); tree = await render();
  assert.match(text(tree), /Current password is incorrect/);
  pending = deferred(); button(tree, 'Update Password').props.onPress(); pending.resolve({ message: 'Password updated' }); tree = await render();
  assert.match(text(tree), /Password updated/); assert.equal(nodes(tree, 'RecoveryField').length, 0);
  button(tree, 'Change Password').props.onPress(); tree = await render();
  assert.ok(nodes(tree, 'RecoveryField').every(node => node.props.value === ''));
  field(tree, 'New Password').props.onChangeText('Unsavedpassword123'); button(tree, 'Cancel').props.onPress(); tree = await render();
  button(tree, 'Change Password').props.onPress(); tree = await render(); assert.equal(field(tree, 'New Password').props.value, '');
});
