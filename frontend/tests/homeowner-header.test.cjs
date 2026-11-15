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
    if (name === '@/components/auth/RequiredPasswordUpdate') return { __esModule: true, default: 'RequiredPasswordUpdate' };
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
    'react/jsx-runtime': runtime, 'react-native': primitives(['View', 'Text', 'Pressable']),
    'expo-router': { router: {} }, '@expo/vector-icons': { Ionicons: 'Icon' },
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
    assert.equal(row.props.style.height, 64);
    assert.equal(left.props.style.flex, 1); assert.equal(left.props.style.gap, 8);
    assert.equal(nodes(left, 'DrawerToggleButton').length, 1);
    assert.equal(nodes(left, 'Text')[0].props.children, 'History');
    assert.equal(right.props.style.gap, 8);
    assert.equal(right.props.style.flexShrink, 0); assert.equal(right.props.style.width, 80);
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
    assert.equal(button.props.hitSlop, inline ? 4 : 8);
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
    assert.equal(inline.props.hitSlop, 4); assert.equal(inline.props.style.flexShrink, 0);
    assert.equal(floating.props.style.position, 'absolute'); assert.equal(floating.props.style.top, 32);
    assert.equal(floating.props.style.right, 16);
    assert.equal(inline.props.children.props.name, mode === 'dark' ? 'sunny-outline' : 'moon-outline');
    inline.props.onPress();
  }
  assert.equal(toggles, 2);
});

test('all registered role routes leave actions to the shared header while preserving toast and unrelated screens', () => {
  let pathname = '/homeowner/history'; let role = 'homeowner'; let required = false;
  const Stack = 'Stack';
  const Root = load('src/app/_layout.tsx', {
    '../global.css': {}, 'react/jsx-runtime': runtime, react: { useCallback: (fn) => fn, useEffect: () => {} },
    'react-native': primitives(['View', 'ActivityIndicator']), 'expo-router': { Stack, usePathname: () => pathname },
    'expo-status-bar': { StatusBar: 'StatusBar' }, 'react-native-gesture-handler': { GestureHandlerRootView: 'GestureHandlerRootView' },
    'react-native-keyboard-controller': { KeyboardProvider: 'KeyboardProvider' },
    'react-native-safe-area-context': { SafeAreaProvider: 'SafeAreaProvider' },
    'expo-splash-screen': { preventAutoHideAsync: () => Promise.resolve(), hideAsync: async () => {} },
    '@/context/AuthContext': { AuthProvider: 'AuthProvider', useAuth: () => ({ status: 'authed', user: { role, requires_password_update: required } }) },
    '@/context/AccountContext': { AccountProvider: 'AccountProvider' },
    '@/context/ThemeContext': { ThemeProvider: 'ThemeProvider', useTheme: () => theme },
    '@/context/NotificationContext': { NotificationProvider: 'NotificationProvider' }, '@/context/ChatContext': { ChatProvider: 'ChatProvider' },
    '@/components/ThemeToggle': defaults('ThemeToggle'), '@/components/NotificationBell': defaults('NotificationBell'),
    '@/components/NotificationToast': defaults('NotificationToast'), '@/theme/fonts': { useAppFonts: () => [true] },
    '@/utils/headerRoutes': routeRules,
  }).default;
  const chrome = nodes(Root(), 'ThemedChrome')[0].type;
  const navigate = nodes(Root(), 'RootNavigator')[0].type;
  const boundary = nodes(Root(), 'PasswordUpdateBoundary')[0].type;
  required = true;
  assert.equal(nodes(boundary({ children: 'Private providers' }), 'RequiredPasswordUpdate').length, 1);
  assert.equal(navigate().type, 'RequiredPasswordUpdate');
  assert.equal(nodes(chrome(), 'NotificationBell').length, 0);
  required = false;
  assert.equal(boundary({ children: 'Private providers' }), 'Private providers');
  assert.equal(navigate().type, 'Stack');
  function routes(directory, prefix = '') {
    return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
      const route = `${prefix}/${entry.name}`;
      if (entry.isDirectory()) return routes(path.join(directory, entry.name), route);
      if (!entry.name.endsWith('.tsx') || entry.name === '_layout.tsx') return [];
      return [route.replace(/\([^/]+\)\//g, '').replace(/\.tsx$/, '').replace(/\/index$/, '').replace(/\[[^/]+\]/g, '7')];
    });
  }
  for (role of ['homeowner', 'supplier', 'worker', 'contractor']) {
    for (const route of routes(path.join(__dirname, '../src/app/(app)', role))) {
      for (pathname of [`/${role}${route}`, `/${role}${route}/`]) {
        const result = chrome();
        assert.equal(nodes(result, 'NotificationBell').length, 0, pathname);
        assert.equal(nodes(result, 'ThemeToggle').length, 0, pathname);
        assert.equal(nodes(result, 'NotificationToast').length, 1, pathname);
      }
    }
    for (pathname of ['/', '/login', '/admin', `/${role}-other`, '/another-role/history']) {
      assert.equal(nodes(chrome(), 'NotificationBell').length, 1, pathname);
      assert.equal(nodes(chrome(), 'ThemeToggle').length, 1, pathname);
    }
  }
});

test('long titles, subtitles and safe-area changes cannot shrink the action group in either theme', () => {
  let insets = { top: 24, left: 0, right: 0 };
  const Header = load('src/components/HomeownerHeader.tsx', {
    'react/jsx-runtime': runtime, 'react-native': primitives(['View', 'Text', 'Pressable']),
    'expo-router': { router: {} }, '@expo/vector-icons': { Ionicons: 'Icon' },
    'expo-router/drawer': { DrawerToggleButton: 'Menu' },
    'react-native-safe-area-context': { useSafeAreaInsets: () => insets },
    '@/context/ThemeContext': { useTheme: () => theme },
    '@/components/NotificationBell': defaults('Bell'), '@/components/ThemeToggle': defaults('Theme'),
  }).default;
  for (const mode of ['light', 'dark']) for (const width of [280, 320, 360, 412, 768]) for (const title of ['Home', 'Material Fulfillment', 'A very long construction project title that must truncate']) {
    theme.mode = mode; theme.chrome.card = mode === 'dark' ? '#1c222b' : '#fff';
    insets = { top: 44, left: 4, right: 8 };
    const header = Header({ title, subtitle: 'A long subtitle that must not move the action buttons' });
    const row = header.props.children; const [left, actions] = row.props.children;
    assert.equal(header.props.style.backgroundColor, theme.chrome.card);
    assert.equal(left.props.style.minWidth, 0); assert.equal(left.props.style.flexShrink, 1);
    assert.equal(actions.props.style.flexShrink, 0); assert.equal(actions.props.style.width, 80);
    assert.equal(actions.props.style.alignItems, 'center');
    assert.ok(nodes(left, 'Text').every((n) => n.props.numberOfLines === 1));
    // Check the shared flex-box constraints leave room for menu + a shrinking title even at 280dp.
    const titleWidth = width - header.props.style.paddingLeft - header.props.style.paddingRight - actions.props.style.width - row.props.style.gap - 36 - left.props.style.gap;
    assert.ok(titleWidth > 0, `${mode}: ${width}dp`);
    assert.equal(row.props.style.height, 64);
    assert.equal(JSON.stringify(header).includes('absolute'), false);
  }
});

test('the shared Back action retains navigation history and the requested deep-link fallback', () => {
  const calls = []; let canGoBack = true;
  const Header = load('src/components/HomeownerHeader.tsx', {
    'react/jsx-runtime': runtime, 'react-native': primitives(['View', 'Text', 'Pressable']),
    'expo-router': { router: { canGoBack: () => canGoBack, back: () => calls.push('back'), replace: (path) => calls.push(path) } },
    '@expo/vector-icons': { Ionicons: 'Icon' }, 'expo-router/drawer': { DrawerToggleButton: 'Menu' },
    'react-native-safe-area-context': { useSafeAreaInsets: () => ({ top: 24, left: 0, right: 0 }) },
    '@/context/ThemeContext': { useTheme: () => theme },
    '@/components/NotificationBell': defaults('Bell'), '@/components/ThemeToggle': defaults('Theme'),
  }).default;
  for (const backTo of ['/worker/history', '/contractor', '/homeowner/approvals', '/homeowner/messages', '/homeowner/history']) {
    canGoBack = true; nodes(Header({ title: 'Details', backTo }), 'Pressable')[0].props.onPress();
    assert.equal(calls.at(-1), 'back'); canGoBack = false;
    nodes(Header({ title: 'Details', backTo }), 'Pressable')[0].props.onPress(); assert.equal(calls.at(-1), backTo);
  }
});

test('every role tab inherits the shared header without changing its routes or bottom-bar setting', () => {
  function Tabs() {} Tabs.Screen = 'Tabs.Screen';
  const common = { 'react/jsx-runtime': runtime, 'expo-router': { Tabs },
    '@/context/ThemeContext': { useTheme: () => theme },
    '@/components/HomeownerHeader': defaults('Header'), '@/components/RoleFloatingTabBar': defaults('FloatingBar') };
  const RoleTabs = load('src/components/RoleTabs.tsx', common).default;
  for (const role of ['supplier', 'contractor', 'worker']) {
    const Layout = load(`src/app/(app)/${role}/(tabs)/_layout.tsx`, {
      'react/jsx-runtime': runtime, '@/components/RoleTabs': defaults('RoleTabs'),
    }).default;
    const config = Layout().props;
    assert.equal(config.hideBar, true);
    const tabs = RoleTabs(config);
    assert.equal(tabs.props.tabBar(), null);
    const screens = nodes(tabs, 'Tabs.Screen');
    assert.deepEqual(screens.map((n) => n.props.name), [...config.tabs].map((t) => t.name));
    for (const screen of screens) {
      const header = tabs.props.screenOptions.header({ options: screen.props.options, route: { name: screen.props.name } });
      assert.equal(header.type, 'Header'); assert.equal(header.props.title, screen.props.options.title);
    }
  }
  const HomeownerTabs = load('src/app/(app)/homeowner/(tabs)/_layout.tsx', {
    ...common, '@expo/vector-icons': { Ionicons: 'Icon' },
    '@/components/FloatingTabBar': defaults('FloatingBar'),
    '@/components/HomeDashboardTitle': defaults('HomeTitle'), '@/components/PlannerTitle': defaults('PlannerTitle'),
  }).default;
  const tabs = HomeownerTabs(); const screens = nodes(tabs, 'Tabs.Screen');
  assert.deepEqual(screens.map((s) => s.props.name), ['index', 'progress', 'project-chat', 'budget-monitor', 'marketplace']);
  assert.equal(tabs.props.detachInactiveScreens, false);
  assert.equal(tabs.props.tabBar({}).type, 'FloatingBar');
  const workersHeader = screens.find(screen => screen.props.name === 'marketplace').props.options.header();
  assert.equal(workersHeader.props.title, 'Workers'); assert.equal(workersHeader.props.subtitle, 'Manage your construction team');
  for (const screen of screens) {
    const options = { ...tabs.props.screenOptions, ...screen.props.options };
    assert.notEqual(options.headerShown, false);
    const header = options.header({ options, route: { name: screen.props.name } });
    assert.equal(header.type, 'Header', screen.props.name);
  }
});

test('drawer pages use menu headers, detail pages use Back, and nested sections suppress duplicate headers', () => {
  function Drawer() {} Drawer.Screen = 'Drawer.Screen';
  const RoleDrawer = load('src/components/RoleDrawer.tsx', {
    'react/jsx-runtime': runtime, 'react-native': { View: 'View' }, 'expo-router/drawer': { Drawer },
    '@/components/HomeownerHeader': defaults('Header'), '@/components/RoleDrawerContent': defaults('DrawerContent'),
    '@/context/ThemeContext': { useTheme: () => theme },
  }).default;
  for (const role of ['supplier', 'worker', 'contractor']) {
    const drawer = RoleDrawer({ role, items: [], pages: [{ name: 'profile', title: 'Profile' }, { name: 'history', title: 'History', headerShown: false }, { name: 'chat/[id]', title: 'Chat', detail: true }] });
    const screens = nodes(drawer, 'Drawer.Screen');
    assert.equal(screens.find((s) => s.props.name === '(tabs)').props.options.headerShown, false);
    const profile = screens.find((s) => s.props.name === 'profile');
    assert.equal(drawer.props.screenOptions.header({ options: profile.props.options }).props.title, 'Profile');
    assert.equal(screens.find((s) => s.props.name === 'history').props.options.headerShown, false);
    const detail = screens.find((s) => s.props.name === 'chat/[id]').props.options.header();
    assert.equal(detail.type, 'Header'); assert.equal(detail.props.backTo, `/${role}`);
  }
  const Worker = load('src/components/WorkerHeader.tsx', {
    'react/jsx-runtime': runtime, 'react-native': { Text: 'Text' },
    '@/components/HomeownerHeader': defaults('Header'), '@/context/ThemeContext': { useTheme: () => theme },
  }).default;
  assert.equal(Worker({ details: true }).type, 'Header');
  assert.equal(Worker({ details: true }).props.backTo, '/worker/history');
  assert.equal(Worker({}).props.subtitle, 'Skilled Worker Account');
});

test('Homeowner secondary and stack routes preserve their existing titles and back destinations', () => {
  function Drawer() {} Drawer.Screen = 'Drawer.Screen';
  function Stack() {} Stack.Screen = 'Stack.Screen';
  const navigation = [];
  const common = { 'react/jsx-runtime': runtime,
    'expo-router': { Stack, router: { replace: (path) => navigation.push(path) } },
    'expo-router/drawer': { Drawer }, 'react-native': { Pressable: 'Pressable' }, '@expo/vector-icons': { Ionicons: 'Icon' },
    '@/context/ThemeContext': { useTheme: () => theme },
    '@/context/AuthContext': { useAuth: () => ({ user: { id: 1, role: 'homeowner' } }) },
    '@/context/PlanContext': { PlanProvider: 'PlanProvider' },
    '@/components/HomeownerDrawerContent': defaults('DrawerContent'), '@/components/HomeownerHeader': defaults('Header'),
  };
  const Layout = load('src/app/(app)/homeowner/_layout.tsx', common).default;
  const screens = nodes(Layout(), 'Drawer.Screen');
  for (const name of ['profile', 'supplier-catalog', 'project-overview']) {
    const options = screens.find((s) => s.props.name === name).props.options;
    assert.equal(options.headerShown, true); assert.equal(options.header().type, 'Header');
  }
  screens.find((s) => s.props.name === 'project-overview').props.options.header().props.left.props.onPress();
  assert.deepEqual(navigation, ['/homeowner']);
  for (const section of ['approvals', 'messages', 'history']) {
    const Nested = load(`src/app/(app)/homeowner/${section}/_layout.tsx`, common).default;
    const nested = nodes(Nested(), 'Stack.Screen');
    for (const screen of nested) assert.equal(screen.props.options.header().type, 'Header');
    assert.equal(nested.find((s) => s.props.name === '[id]').props.options.header().props.backTo, `/homeowner/${section}`);
  }
});
