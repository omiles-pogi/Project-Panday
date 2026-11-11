const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
function load(file, mocks = {}) {
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
const defaults = (value) => ({ __esModule: true, default: value });
const primitive = (names) => Object.fromEntries(names.map((name) => [name, name]));
const colors = load('src/theme/colors.ts');
function nodes(node, type) {
  if (!node || typeof node !== 'object') return [];
  if (Array.isArray(node)) return node.flatMap((value) => nodes(value, type));
  return [...(node.type === type || node.type?.name === type ? [node] : []), ...nodes(node.props?.children, type)];
}
const flat = (style) => Array.isArray(style) ? Object.assign({}, ...style.filter(Boolean).map(flat)) : style;
function bar() {
  const state = { pathname: '/supplier/more', width: 390, mode: 'light', insets: { top: 24, bottom: 36, left: 0, right: 0 } };
  const navigations = [];
  const Bar = load('src/components/SupplierFloatingTabBar.tsx', {
    'react/jsx-runtime': runtime,
    'react-native': { ...primitive(['Pressable', 'Text', 'View']), StyleSheet: { create: (style) => style }, useWindowDimensions: () => ({ width: state.width }) },
    'expo-router': { usePathname: () => state.pathname, router: { navigate: (route) => navigations.push(route) } },
    '@expo/vector-icons': { Ionicons: 'Icon' }, 'react-native-safe-area-context': { useSafeAreaInsets: () => state.insets },
    '@/context/ThemeContext': { useTheme: () => ({ mode: state.mode, chrome: state.mode === 'light' ? colors.lightChrome : colors.darkChrome }) },
  }).default;
  return { state, navigations, render: Bar };
}

test('all five buttons retain the existing Supplier destinations and Add Material parameter', () => {
  const app = bar(); const buttons = nodes(app.render(), 'Pressable');
  assert.deepEqual(buttons.map((button) => button.props.accessibilityLabel), ['Home', 'Products', 'Add Product', 'History', 'Account']);
  buttons.forEach((button) => button.props.onPress());
  assert.deepEqual(JSON.parse(JSON.stringify(app.navigations)), [
    '/supplier', '/supplier/pricing', { pathname: '/supplier/pricing', params: { add: '1' } }, '/supplier/history', '/supplier/profile',
  ]);
  assert.equal(JSON.stringify(app.navigations).includes('/homeowner'), false);
});

test('selection follows router state including nested History and never falsely highlights Home', () => {
  const app = bar();
  for (const [pathname, expected] of [['/supplier', 'Home'], ['/supplier/', 'Home'], ['/supplier/pricing', 'Products'],
    ['/supplier/history', 'History'], ['/supplier/history/7/items', 'History'], ['/supplier/profile', 'Account']]) {
    app.state.pathname = pathname;
    const selected = nodes(app.render(), 'Pressable').filter((button) => button.props.accessibilityState?.selected);
    assert.deepEqual(selected.map((button) => button.props.accessibilityLabel), [expected]);
  }
  app.state.pathname = '/supplier/fulfillment';
  assert.equal(nodes(app.render(), 'Pressable').filter((button) => button.props.accessibilityState?.selected).length, 0);
  app.state.pathname = '/supplier'; nodes(app.render(), 'Pressable')[0].props.onPress();
  assert.equal(app.navigations.length, 0, 'reselecting Home does not reset its screen');
});

test('five targets remain centered, contained and readable across sizes, themes and bottom safe areas', () => {
  const app = bar();
  for (const width of [280, 320, 390, 430, 800]) for (const mode of ['light', 'dark']) for (const bottom of [0, 24, 48]) {
    app.state.width = width; app.state.mode = mode; app.state.insets = { top: 24, bottom, left: width === 280 ? 0 : 6, right: width === 280 ? 0 : 14 };
    const tree = app.render(); const frame = tree.props.children;
    const [pill, row] = frame.props.children; const [left, center, right] = row.props.children;
    const frameWidth = Math.min(frame.props.style.maxWidth, width - tree.props.style.paddingLeft - tree.props.style.paddingRight);
    const sideWidth = (frameWidth - row.props.style.paddingHorizontal * 2 - center.props.style.width) / 2;
    assert.equal(tree.props.style.position, undefined, 'footer reserves its own space');
    assert.equal(tree.props.style.paddingBottom, bottom + 8);
    assert.equal(row.props.style.paddingHorizontal + sideWidth + center.props.style.width / 2, frameWidth / 2);
    assert.ok(sideWidth / 2 >= 44); assert.deepEqual(left.props.style, right.props.style);
    const circle = flat(nodes(center, 'View').find((node) => flat(node.props.style).borderRadius === 26).props.style);
    const label = flat(nodes(center, 'Text')[0].props.style);
    assert.ok(circle.width <= center.props.style.width);
    assert.ok(circle.height + label.lineHeight + label.bottom <= center.props.style.height);
    assert.equal(flat(pill.props.style).backgroundColor, mode === 'light' ? colors.lightChrome.card : colors.darkChrome.card);
    assert.equal(nodes(tree, 'Pressable').length, 5);
    for (const node of nodes(tree, 'Text')) { assert.equal(node.props.numberOfLines, 1); assert.equal(node.props.maxFontSizeMultiplier, 1.35); }
  }
});

test('existing Inventory Add Material sheet opens, closes and reopens from the center action without Inventory changes', () => {
  const app = bar(); let params = {}; const slots = []; let cursor = 0;
  const Pricing = load('src/screens/supplier/Pricing.tsx', {
    react: { useState(initial) { const i = cursor++; if (!(i in slots)) slots[i] = initial; return [slots[i], (value) => { slots[i] = value; }]; } },
    'react/jsx-runtime': runtime, 'react-native': primitive(['ActivityIndicator', 'Pressable', 'Text', 'View']),
    'expo-router': { useLocalSearchParams: () => params, router: { setParams: (value) => { params = { ...params, ...value }; } } },
    '@expo/vector-icons': { Ionicons: 'Icon' }, '@/components/ui': primitive(['Badge', 'Button', 'Card', 'ChipPicker', 'Field', 'PageHeader', 'Screen', 'SubmitButton']),
    '@/components/Sheet': defaults('Sheet'), '@/components/StockBadge': defaults('StockBadge'),
    '@/context/SupplierContext': { useSupplier: () => ({ products: [], productsLoading: false, productsError: null }) },
    '@/context/ThemeContext': { useTheme: () => ({ chrome: colors.lightChrome }) },
    '@/data/supplier': { CATEGORIES: [], CAT_COLORS: {}, UNITS: [] }, '@/utils/currency': {}, './InventoryStats': defaults('InventoryStats'),
  }).default;
  const render = () => { cursor = 0; return Pricing(); };
  for (let i = 0; i < 2; i++) {
    nodes(app.render(), 'Pressable').find((button) => button.props.accessibilityLabel === 'Add Product').props.onPress();
    params = app.navigations.at(-1).params;
    const sheet = nodes(render(), 'MaterialFormSheet')[0]; assert.ok(sheet); assert.equal(sheet.props.product, undefined);
    sheet.props.onClose(); assert.equal(params.add, undefined); assert.equal(nodes(render(), 'MaterialFormSheet').length, 0);
  }
});

test('Contractor/Worker retain the incoming floating bar; only Supplier opts into its drawer footer', () => {
  function Drawer() {} Drawer.Screen = 'DrawerScreen';
  function Tabs() {} Tabs.Screen = 'TabScreen';
  const shared = {
    'react/jsx-runtime': runtime, 'react-native': primitive(['Pressable', 'View']),
    'expo-router': { Tabs, router: {} }, 'expo-router/drawer': { Drawer, DrawerToggleButton: 'DrawerToggleButton' },
    '@expo/vector-icons': { Ionicons: 'Icon' }, '@/context/ThemeContext': { useTheme: () => ({ chrome: colors.lightChrome }) },
    '@/components/RoleDrawerContent': defaults('DrawerContent'),
    '@/components/RoleFloatingTabBar': defaults('RoleFloatingTabBar'),
  };
  const RoleDrawer = load('src/components/RoleDrawer.tsx', shared).default;
  for (const role of ['contractor', 'worker']) assert.equal(RoleDrawer({ role, items: [], pages: [] }).type, Drawer);
  const wrapped = RoleDrawer({ role: 'supplier', items: [], pages: [], footer: jsx('Footer', {}) });
  assert.equal(wrapped.props.style.flex, 1); assert.equal(nodes(wrapped, Drawer).length, 1); assert.equal(nodes(wrapped, 'Footer').length, 1);
  const RoleTabs = load('src/components/RoleTabs.tsx', shared).default;
  assert.equal(RoleTabs({ tabs: [] }).props.tabBar({}).type, 'RoleFloatingTabBar');
  assert.equal(RoleTabs({ tabs: [], hideBar: true }).props.tabBar(), null);
  const SupplierTabs = load('src/app/(app)/supplier/(tabs)/_layout.tsx', { 'react/jsx-runtime': runtime, '@/components/RoleTabs': defaults('RoleTabs') }).default;
  assert.equal(SupplierTabs().props.hideBar, true);
  assert.deepEqual([...SupplierTabs().props.tabs].map((tab) => tab.name), ['index', 'pricing', 'fulfillment', 'more']);
});
