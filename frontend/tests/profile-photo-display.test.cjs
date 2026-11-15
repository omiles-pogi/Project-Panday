const { test } = require('node:test');
const assert = require('node:assert/strict');
const { load, hooks, runtime, nodes, deferred, defaults } = require('./helpers/account-harness.cjs');

function transport(options = {}) {
  const requests = [];
  const response = { ok: true, status: 200, headers: { get: name => name === 'content-type' ? 'image/jpeg' : null }, arrayBuffer: async () => Uint8Array.of(255, 216, 255, 217).buffer, ...options.response };
  const api = load('src/services/api/client.ts', {
    'expo-constants': defaults({ expoConfig: { hostUri: '192.0.2.20:8081' } }),
    '@/utils/plannerError': load('src/utils/plannerError.ts', {}),
    'expo/fetch': { fetch: async (...args) => { requests.push(args); return options.fetch ? options.fetch(...args) : response; } },
  }, { process: { env: { EXPO_PUBLIC_API_BASE_URL: 'http://localhost:8000' } }, Uint8Array });
  api.setAuthToken('TEST_ONLY_TOKEN');
  return { api, requests };
}

test('private image reads use the current API origin, bearer header and verified binary image response', async () => {
  const { api, requests } = transport();
  const photo = await api.readAccountPhoto('/api/account/photo/13/version.jpg', new AbortController().signal);
  assert.deepEqual(Array.from(photo.bytes), [255, 216, 255, 217]); assert.equal(photo.type, 'image/jpeg');
  assert.equal(requests[0][0], 'http://192.0.2.20:8000/api/account/photo/13/version.jpg');
  assert.equal(requests[0][1].headers.Authorization, 'Bearer TEST_ONLY_TOKEN');
  assert.equal(requests[0][1].redirect, 'error'); assert.equal(requests[0][1].headers['cache-control'], 'no-cache');
  for (const path of ['https://evil.test/image.jpg', '/api/account/photo/13/../secret', '/storage/photo.jpg']) await assert.rejects(api.readAccountPhoto(path, new AbortController().signal));
  assert.equal(requests.length, 1);
});

test('image failures expose safe retryable errors rather than server bodies or invalid images', async () => {
  for (const [status, message] of [[401, /session expired/], [403, /cannot access/], [404, /unavailable/], [500, /server could not/]]) {
    const { api } = transport({ response: { ok: false, status, arrayBuffer() { throw Error('PRIVATE SERVER DATA'); } } });
    await assert.rejects(api.readAccountPhoto('/api/account/photo/13/photo.jpg', new AbortController().signal), message);
  }
  for (const response of [
    { headers: { get: () => 'text/html' } },
    { arrayBuffer: async () => new ArrayBuffer(0) },
    { headers: { get: name => name === 'content-type' ? 'image/jpeg' : '6000000' } },
  ]) {
    const { api } = transport({ response });
    await assert.rejects(api.readAccountPhoto('/api/account/photo/13/photo.jpg', new AbortController().signal));
  }
  const offline = transport({ fetch: () => { throw new Error('private network detail'); } });
  await assert.rejects(offline.api.readAccountPhoto('/api/account/photo/13/photo.jpg', new AbortController().signal), /Check your connection/);
});

test('a changed login session cannot deliver the previous account image', async () => {
  const pending = deferred(); const app = transport({ fetch: () => pending.promise });
  const read = app.api.readAccountPhoto('/api/account/photo/13/photo.jpg', new AbortController().signal);
  app.api.setAuthToken('OTHER_TEST_SESSION');
  pending.resolve({ ok: true });
  await assert.rejects(read); app.api.setAuthToken(null);
  await assert.rejects(app.api.readAccountPhoto('/api/account/photo/13/photo.jpg', new AbortController().signal));
});

test('native display writes exact bytes to an owned temporary file and cleans up without touching source uploads', async () => {
  const files = []; const bytes = Uint8Array.of(1, 2, 3);
  class File {
    constructor(directory, name) { this.uri = `${directory}/${name}`; files.push(this); }
    create() { this.exists = true; }
    async write(value) { this.bytes = value; }
    delete() { this.exists = false; this.deleted = true; }
  }
  const utility = load('src/utils/profilePhotoDisplay.ts', {
    'react-native': { Platform: { OS: 'android' } },
    '@/services/api/client': { readAccountPhoto: async () => ({ bytes, type: 'image/png' }) },
    'expo-file-system': { File, Paths: { cache: 'file:///app/cache' } },
  });
  const photo = await utility.loadProfilePhoto('/api/account/photo/13/photo.png', new AbortController().signal);
  assert.match(photo.uri, /^file:\/\/\/app\/cache\/panday-avatar-.*\.png$/); assert.equal(files[0].bytes, bytes);
  photo.dispose(); assert.equal(files[0].deleted, true); assert.equal(files.length, 1);
});

test('web display uses an authenticated binary Blob URL and revokes it on disposal', async () => {
  const revoked = []; const blobs = [];
  const utility = load('src/utils/profilePhotoDisplay.ts', {
    'react-native': { Platform: { OS: 'web' } },
    '@/services/api/client': { readAccountPhoto: async () => ({ bytes: Uint8Array.of(1, 2), type: 'image/png' }) },
  }, { Blob, URL: { createObjectURL: blob => { blobs.push(blob); return 'blob:test'; }, revokeObjectURL: url => revoked.push(url) } });
  const photo = await utility.loadProfilePhoto('/api/account/photo/13/photo.png', new AbortController().signal);
  assert.equal(photo.uri, 'blob:test'); assert.equal(blobs[0].type, 'image/png'); assert.equal(blobs[0].size, 2);
  photo.dispose(); assert.deepEqual(revoked, ['blob:test']);
});

function avatar(loader) {
  const h = hooks(); const errors = []; const disposed = [];
  const component = load('src/components/ProfilePhoto.tsx', {
    react: h.react, 'react/jsx-runtime': runtime, 'expo-router': {}, expo: {},
    'react-native': { Image: 'Image', Text: 'Text', View: 'View', ActivityIndicator: 'Spinner' },
    '@expo/vector-icons': {}, '@/context/AuthContext': {}, '@/context/AccountContext': {}, '@/context/ThemeContext': {},
    '@/utils/profilePhotoDisplay': { loadProfilePhoto: async (path, signal) => loader(path, signal, disposed) },
    '@/services/api/account': {}, '@/utils/profilePhoto': {},
  }, { AbortController, setTimeout, clearTimeout }).ProfileAvatar;
  let url = '/api/account/photo/13/old.jpg';
  const render = () => h.render(() => { const node = component({ name: 'Saved User', url, onPhotoError: message => errors.push(message) }); return node.type(node.props); });
  return { render, errors, disposed, h, change: value => { url = value; } };
}

test('avatars display verified files, restore on mount, replace versions and remove back to initials', async () => {
  const app = avatar(async (path, signal, disposed) => ({ uri: `file:///cache/${path.split('/').at(-1)}`, dispose: () => disposed.push(path) }));
  let tree = await app.render(); assert.equal(nodes(tree, 'Image')[0].props.source.uri, 'file:///cache/old.jpg');
  app.change('/api/account/photo/13/replacement.png'); tree = await app.render();
  assert.equal(nodes(tree, 'Image')[0].props.source.uri, 'file:///cache/replacement.png'); assert.equal(app.disposed.length, 1);
  app.change(null); tree = await app.render(); assert.equal(nodes(tree, 'Image').length, 0); assert.equal(nodes(tree, 'Text')[0].props.children, 'SU');
  assert.equal(app.disposed.length, 2);
});

test('failed image loads report errors, and a retired response never replaces the current photo', async () => {
  const gate = deferred(); const app = avatar(async (path, signal, disposed) => path.endsWith('old.jpg') ? gate.promise : ({ uri: 'file:///new.png', dispose: () => disposed.push('new') }));
  let tree = await app.render(); assert.equal(nodes(tree, 'Spinner').length, 1);
  app.change('/api/account/photo/13/new.png'); tree = await app.render();
  gate.resolve({ uri: 'file:///old.jpg', dispose: () => app.disposed.push('stale') }); tree = await app.render();
  assert.equal(nodes(tree, 'Image')[0].props.source.uri, 'file:///new.png'); assert.ok(app.disposed.includes('stale'));
  nodes(tree, 'Image')[0].props.onError(); tree = await app.render();
  assert.equal(nodes(tree, 'Image').length, 0); assert.match(app.errors.at(-1), /could not be displayed/);
  const offline = avatar(async () => { throw Error('Check your connection and retry.'); });
  tree = await offline.render(); assert.equal(nodes(tree, 'Image').length, 0); assert.match(offline.errors.at(-1), /retry/);
  app.h.unmount(); assert.ok(app.disposed.includes('new'));
});
