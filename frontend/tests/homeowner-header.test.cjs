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
  vm.runInNewContext(outputText, { exports, require(name) {
    if (name in mocks) return mocks[name];
    throw new Error(`Unexpected dependency: ${name}`);
  } }, { filename });
  return exports;
}
const jsx = (type, props) => ({ type, props });
const runtime = { jsx, jsxs: jsx };
const defaults = (value) => ({ __esModule: true, default: value });
const primitives = (names) => Object.fromEntries(names.map((name) => [name, name]));
function nodes(node, type) {
  if (!node || typeof node !== 'object') return [];
  if (Array.isArray(node)) return node.flatMap((child) => nodes(child, type));
  return [...(node.type === type || node.type?.name === type ? [node] : []), ...nodes(node.props?.children, type)];
}
const routeRules = load('src/utils/headerRoutes.ts', {});
const theme = { mode: 'light', chrome: { card: '#fff', foreground: '#111', secondaryForeground: '#555', border: '#ddd' } };

test('Home and History share an in-flow header with safe areas, adjacent title, and equal-size action grouping', () => {
  let insets = { top: 24, left: 0, right: 0, bottom: 36 };
  const Header = load('src/components/HomeownerHeader.tsx', {
    'react/jsx-runtime': runtime, 'react-native': primitives(['View', 'Text']),
    'expo-router/drawer': { DrawerToggleButton: 'DrawerToggleButton' },
    'react-native-safe-area-context': { useSafeAreaInsets: () => insets },
    '@/context/ThemeContext': { useTheme: () => theme },
    '@/components/NotificationBell': defaults('NotificationBell'), '@/components/ThemeToggle': defaults('ThemeToggle'),
  }).default;
  for (const top of [0, 24, 44]) {
    insets = { ...insets, top, left: 4, right: 8 };
    const header = Header({ title: 'History', subtitle: 'Completed Projects' });
    assert.equal(header.props.style.paddingTop, top);
    assert.equal(header.props.style.paddingLeft, 20); assert.equal(header.props.style.paddingRight, 24);
    const row = header.props.children; const [left, right] = row.props.children;
    assert.equal(row.props.style.flexDirection, 'row'); assert.equal(row.props.style.alignItems, 'center');
    assert.equal(left.props.style.flex, 1); assert.equal(left.props.style.gap, 8);
    assert.equal(nodes(left, 'DrawerToggleButton').length, 1);
    assert.equal(nodes(left, 'Text')[0].props.children, 'History');
    assert.equal(right.props.style.gap, 8);
    assert.equal(nodes(right, 'NotificationBell')[0].props.inline, true);
    assert.equal(nodes(right, 'ThemeToggle')[0].props.inline, true);
    assert.equal(JSON.stringify(header).includes('absolute'), false);
  }
});

test('existing notification handlers, badge, and panel still work in both inline and floating placements', () => {
  let open = false; let refreshed = 0; let dismissed = 0;
  const Bell = load('src/components/NotificationBell.tsx', {
    'react/jsx-runtime': runtime, react: { useState: () => [open, (value) => { open = value; }] },
    'react-native': primitives(['Pressable', 'Text', 'View']), '@expo/vector-icons': { Ionicons: 'Icon' },
    'react-native-safe-area-context': { useSafeAreaInsets: () => ({ top: 24 }) },
    '@/context/ThemeContext': { useTheme: () => theme },
    '@/context/NotificationContext': { useNotifications: () => ({ unreadCount: 12, refresh: () => refreshed++, dismissPopup: () => dismissed++ }) },
    '@/components/NotificationsPanel': defaults('NotificationsPanel'),
  }).default;
  for (const inline of [true, false]) {
    const tree = Bell({ inline }); const button = nodes(tree, 'Pressable')[0];
    assert.equal(button.props.style.width, 36); assert.equal(button.props.style.height, 36);
    assert.equal(button.props.style.position, inline ? undefined : 'absolute');
    assert.equal(nodes(button, 'Text')[0].props.children, '9+');
    button.props.onPress();
    const panel = nodes(Bell({ inline }), 'NotificationsPanel')[0]; assert.equal(panel.props.visible, true);
    panel.props.onClose(); assert.equal(open, false);
  }
  assert.equal(refreshed, 2); assert.equal(dismissed, 2);
});

test('theme action retains mode icons and handler; default placement is preserved elsewhere', () => {
  let toggles = 0;
  const Toggle = load('src/components/ThemeToggle.tsx', {
    'react/jsx-runtime': runtime, 'react-native': { Pressable: 'Pressable' }, '@expo/vector-icons': { Ionicons: 'Icon' },
    'react-native-safe-area-context': { useSafeAreaInsets: () => ({ top: 24 }) },
    '@/context/ThemeContext': { useTheme: () => ({ ...theme, toggleTheme: () => toggles++ }) },
  }).default;
  for (const mode of ['light', 'dark']) {
    theme.mode = mode;
    const inline = Toggle({ inline: true }); const floating = Toggle();
    assert.equal(inline.props.style.position, undefined);
    assert.equal(inline.props.style.width, 36); assert.equal(inline.props.style.height, 36);
    assert.equal(floating.props.style.position, 'absolute'); assert.equal(floating.props.style.top, 32);
    assert.equal(floating.props.style.right, 16);
    assert.equal(inline.props.children.props.name, mode === 'dark' ? 'sunny-outline' : 'moon-outline');
    inline.props.onPress();
  }
  assert.equal(toggles, 2);
});

test('root renders one header-action set only on the intended homeowner routes, preserving toast and other screens', () => {
  let pathname = '/homeowner/history'; let role = 'homeowner';
  const Stack = 'Stack';
  const Root = load('src/app/_layout.tsx', {
    '../global.css': {}, 'react/jsx-runtime': runtime, react: { useCallback: (fn) => fn, useEffect: () => {} },
    'react-native': primitives(['View', 'ActivityIndicator']), 'expo-router': { Stack, usePathname: () => pathname },
    'expo-status-bar': { StatusBar: 'StatusBar' }, 'react-native-gesture-handler': { GestureHandlerRootView: 'GestureHandlerRootView' },
    'react-native-keyboard-controller': { KeyboardProvider: 'KeyboardProvider' },
    'react-native-safe-area-context': { SafeAreaProvider: 'SafeAreaProvider' },
    'expo-splash-screen': { preventAutoHideAsync: () => Promise.resolve(), hideAsync: async () => {} },
    '@/context/AuthContext': { AuthProvider: 'AuthProvider', useAuth: () => ({ user: { role } }) },
    '@/context/ThemeContext': { ThemeProvider: 'ThemeProvider', useTheme: () => theme },
    '@/context/NotificationContext': { NotificationProvider: 'NotificationProvider' }, '@/context/ChatContext': { ChatProvider: 'ChatProvider' },
    '@/components/ThemeToggle': defaults('ThemeToggle'), '@/components/NotificationBell': defaults('NotificationBell'),
    '@/components/NotificationToast': defaults('NotificationToast'), '@/theme/fonts': { useAppFonts: () => [true] },
    '@/utils/headerRoutes': routeRules,
  }).default;
  const chrome = nodes(Root(), 'ThemedChrome')[0].type;
  for (pathname of ['/homeowner', '/homeowner/', '/homeowner/history', '/homeowner/history/', '/homeowner/project-chat', '/homeowner/project-chat/']) {
    const result = chrome(); assert.equal(nodes(result, 'NotificationBell').length, 0); assert.equal(nodes(result, 'ThemeToggle').length, 0);
    assert.equal(nodes(result, 'NotificationToast').length, 1);
  }
  for (pathname of ['/homeowner/history/3', '/homeowner/history-other', '/homeowner/progress', '/homeowner/project-chat-other', '/contractor', '/supplier']) {
    assert.equal(nodes(chrome(), 'NotificationBell').length, 1); assert.equal(nodes(chrome(), 'ThemeToggle').length, 1);
  }
  role = 'contractor'; pathname = '/homeowner/history';
  assert.equal(nodes(chrome(), 'ThemeToggle').length, 1);
  role = 'supplier';
  for (pathname of ['/supplier', '/supplier/', '/supplier/history', '/supplier/history/7', '/supplier/history/7/items']) {
    assert.equal(nodes(chrome(), 'NotificationBell').length, 0);
    assert.equal(nodes(chrome(), 'ThemeToggle').length, 0);
    assert.equal(nodes(chrome(), 'NotificationToast').length, 1);
  }
  for (pathname of ['/supplier/history-other', '/supplier/pricing', '/supplier/profile', '/supplier/fulfillment']) {
    assert.equal(nodes(chrome(), 'NotificationBell').length, 1);
    assert.equal(nodes(chrome(), 'ThemeToggle').length, 1);
  }
});
