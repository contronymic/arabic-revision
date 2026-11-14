// Shared test utilities. Nothing here is served to phones as part of the site.
import { readFileSync } from 'node:fs';

// Reads a JSON file relative to the project root.
export function readJson(relPath) {
  return JSON.parse(readFileSync(new URL('../' + relPath, import.meta.url), 'utf8'));
}

// A stand-in for fetch, serving the given files by URL.
// An object is served as JSON; a string is served as a body that is not JSON;
// a missing URL behaves like being offline.
export function fakeFetch(files) {
  return async (url) => {
    if (!(url in files)) throw new TypeError('Failed to fetch');
    const value = files[url];
    return {
      ok: true,
      status: 200,
      json: async () => {
        if (typeof value === 'string') return JSON.parse(value);
        return structuredClone(value);
      },
    };
  };
}

// A stand-in for localStorage, kept in memory.
export function memoryStorage() {
  const map = new Map();
  return {
    getItem: (key) => (map.has(key) ? map.get(key) : null),
    setItem: (key, value) => { map.set(key, String(value)); },
    removeItem: (key) => { map.delete(key); },
    keys: () => [...map.keys()],
  };
}

// Storage that fails on every call, like Safari's when it is blocked.
export function throwingStorage() {
  const fail = () => { throw new Error('storage unavailable'); };
  return { getItem: fail, setItem: fail, removeItem: fail };
}

// A small repeatable random-number generator (mulberry32) returning [0, 1).
export function seededRng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Just enough of a page (document.createElement and friends) to render ui.js in Node.
export function fakeDocument() {
  class Element {
    constructor(tag) {
      this.tagName = tag.toLowerCase(); this.className = ''; this.attributes = {}; this.children = []; this.own = ''; this.listeners = {};
    }
    get textContent() { return this.own + this.children.map((c) => c.textContent).join(''); }
    set textContent(text) { this.children = []; this.own = String(text); }
    setAttribute(name, value) { this.attributes[name] = String(value); }
    getAttribute(name) { return name in this.attributes ? this.attributes[name] : null; }
    addEventListener(type, fn) { this.listeners[type] = fn; }
    append(...nodes) { this.children.push(...nodes); }
    replaceChildren(...nodes) { this.children = nodes; }
  }
  return { createElement: (tag) => new Element(tag), createTextNode: (text) => ({ textContent: String(text) }) };
}

// Every element under root (depth first) that matches the test.
export function findAll(root, match) {
  const out = [];
  for (const child of root.children ?? []) {
    if (match(child)) out.push(child);
    out.push(...findAll(child, match));
  }
  return out;
}
