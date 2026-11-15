const { test } = require('node:test');
const assert = require('node:assert/strict');
const { load, defaults, deferred } = require('./helpers/account-harness.cjs');
const asset = (changes = {}) => ({ uri: 'file:///cache/selected.jpg', fileName: 'selected.jpg', mimeType: 'image/jpeg', fileSize: 4, width: 512, height: 512, ...changes });

// Exercise the installed SDK 58 FormData patch and encoder, rather than accepting any object
// in a permissive FormData mock (which let the original RN URI descriptor escape our tests).
class NativeFormData { constructor() { this._parts = []; } }
const { installFormDataPatch } = load('node_modules/expo/src/winter/FormData.ts', {}, { Blob });
const Form = installFormDataPatch(NativeFormData);
const { convertFormDataAsync } = load('node_modules/expo/src/winter/fetch/convertFormData.ts', {
  '../../utils/blobUtils': { blobToArrayBufferAsync: blob => blob.arrayBuffer() },
}, { Blob, TextEncoder });

function builder(platform = 'android', changes = {}) {
  const files = [];
  class ExpoFile {
    constructor(uri) {
      this.uri = uri; this.name = uri.split('/').at(-1); this.type = this.name.endsWith('.png') ? 'image/png' : 'image/jpeg';
      this.exists = true; this.size = 4; Object.assign(this, changes); files.push(this);
    }
    async bytes() { return Uint8Array.from([11, 22, 33, 44]); }
  }
  const helpers = load('src/utils/profilePhotoUpload.ts', {
    'react-native': { Platform: { OS: platform } }, 'expo-file-system': { File: ExpoFile },
    '@/utils/profilePhoto': load('src/utils/profilePhoto.ts', {}),
  }, { FormData: Form });
  return { ...helpers, files, ExpoFile };
}

test('installed Expo multipart encoder reproduces the original URI-descriptor failure', async () => {
  const body = new Form(); body.append('photo', { uri: 'file:///cache/selected.jpg', type: 'image/jpeg', name: 'selected.jpg' });
  await assert.rejects(convertFormDataAsync(body), /Unsupported FormDataPart implementation/);
});

test('JPEG/PNG picker files use real byte-backed Expo File parts with their actual filename and MIME type', async () => {
  for (const [extension, mime] of [['jpg', 'image/jpeg'], ['png', 'image/png']]) {
    const build = builder(); const body = await build.profilePhotoFormData(asset({ uri: `file:///cache/camera-or-gallery.${extension}`, mimeType: mime }));
    assert.ok(body.get('photo') instanceof build.ExpoFile);
    const { body: bytes, boundary } = await convertFormDataAsync(body);
    const encoded = new TextDecoder().decode(bytes);
    assert.match(encoded, new RegExp(`filename="camera-or-gallery.${extension}"`));
    assert.ok(encoded.includes(`content-type: ${mime}`)); assert.ok(encoded.includes('name="photo"'));
    assert.ok(encoded.endsWith(`--${boundary}--\r\n`));
    assert.ok(Buffer.from(bytes).includes(Buffer.from([11, 22, 33, 44])));
  }
});

test('browser uploads retain their actual File/Blob bytes, filename and MIME type without loading native files', async () => {
  const build = builder('web'); const file = new Blob(['image-data'], { type: 'image/png' });
  Object.defineProperty(file, 'name', { value: 'gallery.png', writable: true });
  const body = await build.profilePhotoFormData(asset({ mimeType: 'image/png', file }));
  assert.equal(build.files.length, 0); assert.equal(body.get('photo'), file);
  const encoded = new TextDecoder().decode((await convertFormDataAsync(body)).body);
  assert.match(encoded, /filename="gallery.png"/); assert.match(encoded, /content-type: image\/png/); assert.match(encoded, /image-data/);
});

test('missing, empty and genuinely oversized native files fail safely before any network request', async () => {
  for (const changes of [{ exists: false }, { size: 0 }, { size: 5242881 }, { type: 'application/octet-stream' }]) {
    await assert.rejects(builder('android', changes).profilePhotoFormData(asset()));
  }
  await assert.rejects(builder('web').profilePhotoFormData(asset()), /choose it again/);
});

function transport(options = {}) {
  const requests = []; const timeouts = []; const cleared = [];
  const client = load('src/services/api/client.ts', {
    'expo-constants': defaults({ expoConfig: { hostUri: '192.0.2.12:8081' } }),
    '@/utils/plannerError': load('src/utils/plannerError.ts', {}),
    'expo/fetch': { fetch: async (...args) => { requests.push(args); if (options.fetch) return options.fetch(...args); return { ok: true, status: 200, json: async () => ({ userId: 14, photoUrl: '/api/account/photo/14/saved.png', preferences: {} }) }; } },
  }, {
    process: { env: { EXPO_PUBLIC_API_BASE_URL: 'http://127.0.0.1:8000' } },
    fetch: () => { throw new Error('Photo uploads must select Expo fetch explicitly'); }, AbortController,
    setTimeout: callback => { timeouts.push(callback); return timeouts.length; }, clearTimeout: id => cleared.push(id),
  });
  client.setAuthToken('TEST_PRIVATE_AUTH'); return { ...client, requests, timeouts, cleared };
}

test('photo upload uses the existing LAN API origin, current bearer token and automatic boundary with explicit Expo fetch', async () => {
  const app = transport(); const body = await builder().profilePhotoFormData(asset());
  const result = await app.apiUploadPhoto(async () => body);
  const [url, request] = app.requests[0]; assert.equal(url, 'http://192.0.2.12:8000/api/account/photo');
  assert.equal(request.method, 'POST'); assert.equal(request.body, body);
  assert.equal(request.headers.authorization, 'Bearer TEST_PRIVATE_AUTH'); assert.equal(request.headers.accept, 'application/json');
  assert.equal(Object.keys(request.headers).some(key => key.toLowerCase() === 'content-type'), false);
  assert.equal(result.photoUrl, '/api/account/photo/14/saved.png'); assert.equal(app.cleared.length, 1);
});

test('authorization, validation and server failures are clear without exposing raw response details', async () => {
  for (const status of [401, 403, 413, 422, 500, 503]) {
    let bodyRead = false;
    const app = transport({ fetch: async () => ({ ok: false, status, json: async () => { bodyRead = true; return { message: 'PRIVATE_SQL_PASSWORD_SERVER_PATH' }; } }) });
    await assert.rejects(app.apiUploadPhoto(async () => new Form()), error => !/PRIVATE_SQL/.test(error.message) && /session|permission|MB|server/.test(error.message));
    assert.equal(bodyRead, false); assert.equal(app.cleared.length, 1);
  }
  const network = transport({ fetch: async () => { throw new Error('PRIVATE_NATIVE_DETAIL'); } });
  await assert.rejects(network.apiUploadPhoto(async () => new Form()), /Check your connection/);
});

test('timeout aborts uploading and releases its timer instead of leaving Save permanently busy', async () => {
  const app = transport({ fetch: async (url, { signal }) => new Promise((resolve, reject) => signal.addEventListener('abort', () => reject(new Error('Aborted')))) });
  const pending = app.apiUploadPhoto(async () => new Form());
  await new Promise(setImmediate); app.timeouts[0]();
  await assert.rejects(pending, /timed out/); assert.equal(app.cleared.length, 1);
});

test('account switches during file preparation or the HTTP response cannot upload to or publish another account', async () => {
  const preparing = deferred(); const app = transport(); const pending = app.apiUploadPhoto(() => preparing.promise);
  app.setAuthToken('ANOTHER_ACCOUNT'); preparing.resolve(new Form());
  await assert.rejects(pending, /session changed/); assert.equal(app.requests.length, 0);
  const gate = deferred(); const inFlight = transport({ fetch: () => gate.promise });
  const sending = inFlight.apiUploadPhoto(async () => new Form()); await new Promise(setImmediate);
  inFlight.setAuthToken('ANOTHER_ACCOUNT'); gate.resolve({ ok: true, json: async () => ({ userId: 14, photoUrl: '/api/account/photo/14/new.jpg' }) });
  await assert.rejects(sending, /session changed/);
});

test('account upload service builds the file inside the authenticated transport and rejects malformed success confirmations', async () => {
  let body;
  const service = load('src/services/api/account.ts', {
    './client': { apiUploadPhoto: async build => { body = await build(); return { userId: 14 }; } },
    '@/utils/profilePhotoUpload': builder(),
  });
  await service.uploadProfilePhoto(asset()); assert.ok(body.get('photo').bytes);
  for (const result of [null, {}, { userId: 0 }, { userId: 14, photoUrl: 'https://external.test/private' }, { userId: 14, photoUrl: '/api/account/photo/15/other.jpg' }]) {
    const app = transport({ fetch: async () => ({ ok: true, json: async () => result }) });
    await assert.rejects(app.apiUploadPhoto(async () => new Form()), /did not confirm/);
  }
});
