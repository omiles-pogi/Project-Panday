const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

function load(relative, mocks, globals = {}) {
  const filename = path.join(__dirname, '..', relative);
  const { outputText } = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020,
      jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true,
    },
  });
  const exports = {};
  vm.runInNewContext(outputText, { exports, ...globals, require(name) {
    if (!(name in mocks)) throw new Error(`Unexpected import: ${name}`);
    return mocks[name]();
  } }, { filename });
  return exports;
}

function setup(options = {}) {
  const events = [];
  const imports = [];
  const probes = [];
  const registered = [];
  const unregistered = [];
  let listener;
  let removed = 0;
  let handler;
  const constants = {
    executionEnvironment: 'standalone', appOwnership: null,
    expoConfig: { extra: { eas: { projectId: 'test-project-id' } } },
    ...options.constants,
  };
  const api = load('src/services/push.ts', {
    'react-native': () => ({ Platform: { OS: options.platform ?? 'android' } }),
    'expo-constants': () => ({ __esModule: true, default: constants }),
    expo: () => ({
      isRunningInExpoGo: () => {
        if (options.detectorError) throw new Error('Native host unavailable');
        return options.go ?? false;
      },
      requireOptionalNativeModule: (name) => {
        probes.push(name);
        return options.missingNative === name ? null : {};
      },
    }),
    'expo-device': () => {
      imports.push('expo-device');
      return { isDevice: options.device ?? true };
    },
    'expo-notifications': () => {
      imports.push('expo-notifications');
      if (options.importError) throw new Error("Cannot find native module 'ExpoApplication'");
      return {
        AndroidImportance: { HIGH: 4 },
        setNotificationHandler: (value) => { handler = value; },
        setNotificationChannelAsync: async (id, config) => {
          events.push('channel');
          assert.equal(id, 'default'); assert.equal(config.importance, 4);
        },
        getPermissionsAsync: async () => {
          events.push('get-permission'); return { status: options.permission ?? 'granted' };
        },
        requestPermissionsAsync: async () => {
          events.push('request-permission'); return { status: options.requestPermission ?? 'granted' };
        },
        getExpoPushTokenAsync: async ({ projectId }) => {
          events.push('token');
          assert.equal(projectId, options.expectedProjectId ?? 'test-project-id');
          if (options.tokenError) throw new Error('Push service unreachable');
          if (options.tokenPromise) await options.tokenPromise;
          return { data: 'test-push-token' };
        },
        getLastNotificationResponseAsync: async () => options.last ?? null,
        addNotificationResponseReceivedListener: (callback) => {
          listener = callback; return { remove: () => removed++ };
        },
      };
    },
    '@/services/api/deviceTokens': () => ({
      registerDeviceToken: async (...args) => { registered.push(args); if (options.registrationPromise) await options.registrationPromise; },
      unregisterDeviceToken: async (token) => { unregistered.push(token); },
    }),
  });
  return {
    api, events, imports, probes, registered, unregistered,
    tap: (response) => listener(response), removed: () => removed, handler: () => handler,
  };
}

const response = (id) => ({ notification: { request: {
  identifier: id, content: { data: { type: 'new_message', conversationId: 8 } },
} } });

test('Expo Go never evaluates native notifications, including incomplete/misleading environment metadata', async () => {
  for (const executionEnvironment of [undefined, 'storeClient', 'standalone']) {
    const app = setup({ go: true, constants: { executionEnvironment } });
    const cleanup = await app.api.enablePush(() => assert.fail('Unexpected push'));
    cleanup();
    assert.deepEqual(app.imports, []);
    assert.deepEqual(app.probes, []);
    assert.deepEqual(app.registered, []);
  }
});

test('legacy Go ownership also blocks native imports when the host detector returns false', async () => {
  const app = setup({ constants: { appOwnership: 'expo', executionEnvironment: undefined } });
  await app.api.enablePush(() => {});
  assert.deepEqual(app.imports, []);
  assert.deepEqual(app.probes, []);
});

test('web skips push without probing native modules', async () => {
  const app = setup({ platform: 'web', detectorError: true });
  await app.api.enablePush(() => {});
  assert.deepEqual(app.imports, []); assert.deepEqual(app.probes, []);
});

test('missing/invalid EAS project IDs skip native imports and permission requests', async () => {
  for (const projectId of [undefined, '', '   ', 123]) {
    const app = setup({ constants: { expoConfig: { extra: { eas: { projectId } } } } });
    await app.api.enablePush(() => {});
    assert.deepEqual(app.imports, []); assert.deepEqual(app.events, []);
    assert.deepEqual(app.probes, []);
  }
});

test('a binary missing ExpoApplication or native push never evaluates expo-notifications', async () => {
  for (const missingNative of ['ExpoApplication', 'ExpoPushTokenManager']) {
    const app = setup({ missingNative });
    const cleanup = await app.api.enablePush(() => assert.fail('Unexpected push'));
    cleanup();
    assert.deepEqual(app.imports, []); assert.deepEqual(app.events, []);
    assert.deepEqual(app.registered, []);
  }
});

test('storeClient development builds retain push, tap handling, listener cleanup and logout unregister', async () => {
  const last = response('launch');
  const app = setup({ constants: { executionEnvironment: 'storeClient' }, last, permission: 'undetermined' });
  const opened = [];
  const cleanup = await app.api.enablePush((data) => opened.push(data));
  assert.deepEqual(app.registered, [['test-push-token', 'android']]);
  assert.deepEqual(app.events, ['channel', 'get-permission', 'request-permission', 'token']);
  assert.equal(opened.length, 1);
  assert.equal(opened[0].conversationId, 8);
  app.tap(last); assert.equal(opened.length, 1); // Do not reopen the launch push.
  app.tap(response('next')); assert.equal(opened.length, 2);
  assert.deepEqual(JSON.parse(JSON.stringify(await app.handler().handleNotification())), {
    shouldShowBanner: false, shouldShowList: false, shouldPlaySound: false, shouldSetBadge: false,
  });
  cleanup(); assert.equal(app.removed(), 1);
  await app.api.disablePush(); await app.api.disablePush();
  assert.deepEqual(app.unregistered, ['test-push-token']);
});

test('standalone iOS builds retain push using the EAS manifest project ID', async () => {
  const app = setup({ platform: 'ios', constants: { expoConfig: null, easConfig: { projectId: 'manifest-project' } }, expectedProjectId: 'manifest-project' });
  await app.api.enablePush(() => {});
  assert.deepEqual(app.events, ['get-permission', 'token']);
  assert.deepEqual(app.registered, [['test-push-token', 'ios']]);
});

test('simulators do not load notifications or register a token', async () => {
  const app = setup({ device: false });
  await app.api.enablePush(() => {});
  assert.deepEqual(app.imports, ['expo-device']); assert.deepEqual(app.registered, []);
});

test('denied permission does not register a device token', async () => {
  const app = setup({ permission: 'denied', requestPermission: 'denied' });
  await app.api.enablePush(() => {});
  assert.deepEqual(app.events, ['channel', 'get-permission', 'request-permission']);
  assert.deepEqual(app.registered, []);
});

test('host detection, native import and push service errors stay isolated from sign-in', async () => {
  for (const options of [{ detectorError: true }, { importError: true }, { tokenError: true }]) {
    const app = setup(options);
    const cleanup = await app.api.enablePush(() => {});
    assert.equal(typeof cleanup, 'function'); cleanup();
    assert.deepEqual(app.registered, []);
  }
});

test('turning push off before a native token resolves prevents late backend registration', async () => {
  let resolve; const tokenPromise = new Promise(done => { resolve = done; });
  const app = setup({ tokenPromise });
  const enabling = app.api.enablePush(() => {});
  await new Promise(setImmediate);
  await app.api.disablePush();
  resolve(); await enabling;
  assert.deepEqual(app.registered, []); assert.deepEqual(app.unregistered, []);
});

test('logout waits for a registration already sent, then unregisters it before credentials are revoked', async () => {
  let resolve; const registrationPromise = new Promise(done => { resolve = done; });
  const app = setup({ registrationPromise });
  const enabling = app.api.enablePush(() => {});
  await new Promise(setImmediate); assert.equal(app.registered.length, 1);
  const disabling = app.api.disablePush();
  assert.deepEqual(app.unregistered, []);
  resolve(); await Promise.all([enabling, disabling]);
  assert.deepEqual(app.unregistered, ['test-push-token']);
});

test('an aborted initialization cannot register a token or deliver a late status update', async () => {
  let resolve; const tokenPromise = new Promise(done => { resolve = done; });
  const app = setup({ tokenPromise }); const controller = new AbortController(); const statuses = [];
  const enabling = app.api.enablePush(() => {}, { signal: controller.signal, onStatus: message => statuses.push(message) });
  await new Promise(setImmediate); controller.abort(); resolve(); await enabling;
  assert.deepEqual(app.registered, []); assert.deepEqual(statuses, []);
});

test('the actual in-app provider still loads its API feed and unread pop-up with Expo Go push skipped', async () => {
  const app = setup({ go: true });
  const effects = [];
  const states = [];
  const refs = [];
  const intervals = [];
  let stateIndex = 0; let refIndex = 0; let initial = true; let fetches = 0;
  const item = { id: 1, isRead: false, type: 'new_message', data: { conversationId: 8 } };
  const jsx = (type, props) => ({ type, props });
  const { NotificationProvider } = load('src/context/NotificationContext.tsx', {
    react: () => ({
      createContext: () => ({ Provider: 'Provider' }),
      useCallback: (fn) => fn,
      useState: (value) => {
        const index = stateIndex++;
        if (initial) states[index] = value;
        return [states[index], (next) => { states[index] = typeof next === 'function' ? next(states[index]) : next; }];
      },
      useRef: (value) => { const index = refIndex++; return refs[index] ??= { current: value }; },
      useEffect: (fn) => { if (initial) effects.push(fn); },
    }),
    'react/jsx-runtime': () => ({ jsx, jsxs: jsx }),
    'expo-router': () => ({ router: { push: () => {} } }),
    '@/context/AuthContext': () => ({ useAuth: () => ({ status: 'authed', user: { role: 'supplier' } }) }),
    '@/context/AccountContext': () => ({ useAccount: () => ({ ready: true, data: { preferences: { push_enabled: true } } }) }),
    '@/services/push': () => app.api,
    '@/utils/notificationRoutes': () => ({ notificationRoute: () => null }),
    '@/services/api/projects': () => ({}),
    '@/services/api/notifications': () => ({
      fetchNotifications: async () => { fetches++; return [item]; },
      fetchUnreadNotificationCount: async () => 1,
    }),
  }, {
    AbortController,
    setInterval: (fn, delay) => { assert.equal(delay, 20000); intervals.push(fn); return 1; },
    clearInterval: () => {},
  });
  NotificationProvider({ children: null });
  const cleanups = effects.map((effect) => effect());
  await new Promise(setImmediate);
  initial = false; stateIndex = 0; refIndex = 0;
  const { value } = NotificationProvider({ children: null }).props;
  assert.equal(value.notifications[0], item);
  assert.equal(value.unreadCount, 1); assert.equal(value.popup.notification, item);
  intervals[0](); await new Promise(setImmediate);
  assert.equal(fetches, 2); assert.deepEqual(app.imports, []);
  cleanups.forEach((cleanup) => cleanup?.());
});
