const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const jsx = (type, props, key) => ({ type, props, key });
const runtime = { jsx, jsxs: jsx };
const tick = () => new Promise(setImmediate);
function load(file, mocks, globals = {}) {
  const filename = path.join(__dirname, '../..', file);
  const { outputText } = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
  });
  const exports = {};
  vm.runInNewContext(outputText, { exports, Error, ...globals, require(name) {
    if (!(name in mocks) && name === '@/components/auth/PasswordInputGuard') return load('src/components/auth/PasswordInputGuard.tsx', mocks, globals);
    if (!(name in mocks) && name === '@/validators/auth') return load('src/validators/auth.ts', {}, globals);
    if (!(name in mocks)) throw new Error(`Unexpected dependency: ${name}`);
    return mocks[name];
  } }, { filename });
  return exports;
}
function hooks() {
  const slots = []; let cursor = 0; let effects = []; let dirty = false;
  const same = (a, b) => a && b && a.length === b.length && a.every((value, index) => Object.is(value, b[index]));
  const react = {
    createContext: () => ({ Provider: 'Provider' }), useContext: () => null,
    useState(initial) {
      const i = cursor++; if (!(i in slots)) slots[i] = typeof initial === 'function' ? initial() : initial;
      return [slots[i], value => { const next = typeof value === 'function' ? value(slots[i]) : value; if (!Object.is(next, slots[i])) { slots[i] = next; dirty = true; } }];
    },
    useRef: value => slots[cursor++] ??= { current: value },
    useCallback(callback, deps) { const i = cursor++; if (!same(slots[i]?.deps, deps)) slots[i] = { callback, deps }; return slots[i].callback; },
    useMemo(factory, deps) { const i = cursor++; if (!same(slots[i]?.deps, deps)) slots[i] = { value: factory(), deps }; return slots[i].value; },
    useEffect(effect, deps) { const i = cursor++; if (!same(slots[i]?.deps, deps)) effects.push(() => { slots[i]?.cleanup?.(); slots[i] = { deps, cleanup: effect() }; }); },
  };
  return { react, async render(fn) {
    for (let i = 0; i < 30; i++) {
      cursor = 0; dirty = false; const result = fn(); const pending = effects; effects = [];
      pending.forEach(effect => effect()); await tick(); if (!dirty) return result;
    }
    throw new Error('Render did not settle');
  }, unmount() { slots.forEach(slot => slot?.cleanup?.()); } };
}
function nodes(node, type) {
  if (!node || typeof node !== 'object') return [];
  if (Array.isArray(node)) return node.flatMap(item => nodes(item, type));
  return [...(node.type === type || node.type?.name === type ? [node] : []), ...nodes(node.props?.children, type)];
}
const text = node => node == null ? '' : typeof node !== 'object' ? String(node) : Array.isArray(node) ? node.map(text).join(' ') : text(node.props?.children);
function deferred() { let resolve; let reject; const promise = new Promise((a, b) => { resolve = a; reject = b; }); return { promise, resolve, reject }; }
class Multipart {
  constructor() { this.entries = []; }
  append(...args) { this.entries.push(args); }
}
const theme = { mode: 'light', chrome: { foreground: '#111', secondaryForeground: '#555', mutedForeground: '#777', border: '#ddd', muted: '#eee', card: '#fff' } };
const defaults = value => ({ __esModule: true, default: value });
module.exports = { load, hooks, nodes, text, deferred, tick, Multipart, runtime, theme, defaults };
