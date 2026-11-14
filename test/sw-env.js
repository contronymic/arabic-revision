// A small fake service-worker world for testing sw.js in Node: a fake network,
// fake caches, and sw.js itself run in a vm context. Test-only.
import vm from 'node:vm';
import { readFileSync } from 'node:fs';

const BASE = 'https://owner.github.io/arabic-revision/';
const TYPES = { html: 'text/html', css: 'text/css', js: 'text/javascript', json: 'application/json',
  webmanifest: 'application/manifest+json', png: 'image/png' };
const typeOf = (path) => TYPES[path.split('.').pop()] ?? 'application/octet-stream';

export function createSwEnv(initialFiles) {
  const files = { ...initialFiles };
  let offline = false;
  const stores = new Map();

  // The site's path for a URL, or null when it is not under the site.
  const pathOf = (href) => {
    const u = new URL(href);
    if (u.origin !== new URL(BASE).origin || !u.pathname.startsWith('/arabic-revision/')) return null;
    return u.pathname.slice('/arabic-revision/'.length) || 'index.html';
  };

  async function fakeFetch(input, init) {
    const request = input instanceof Request ? input : new Request(input, init);
    if (offline) throw new TypeError('Failed to fetch');
    const path = pathOf(request.url);
    if (path === null) throw new TypeError('Failed to fetch');
    const body = files[path];
    if (body === undefined || body === null) return new Response('Not found', { status: 404 });
    return new Response(body, { status: 200, headers: { 'content-type': typeOf(path) } });
  }

  const keyOf = (req) => (typeof req === 'string' ? new URL(req, BASE).href : req.url);
  const noSearch = (href) => href.split('?')[0];

  class FakeCache {
    constructor() { this.entries = new Map(); }
    async put(req, res) {
      const body = Buffer.from(await res.arrayBuffer());
      this.entries.set(keyOf(req), { body, status: res.status, headers: [...res.headers] });
    }
    async match(req, opts = {}) {
      const want = opts.ignoreSearch ? noSearch(keyOf(req)) : keyOf(req);
      for (const [key, e] of this.entries) {
        if ((opts.ignoreSearch ? noSearch(key) : key) === want) return new Response(e.body, { status: e.status, headers: e.headers });
      }
      return undefined;
    }
    async addAll(requests) {
      for (const r of requests) {
        const res = await fakeFetch(r);
        if (!res.ok) throw new TypeError(`addAll: ${res.status} for ${keyOf(r)}`);
        await this.put(r, res);
      }
    }
    async keys() { return [...this.entries.keys()].map((u) => new Request(u)); }
  }

  const caches = {
    async open(name) { if (!stores.has(name)) stores.set(name, new FakeCache()); return stores.get(name); },
    async keys() { return [...stores.keys()]; },
    async has(name) { return stores.has(name); },
    async delete(name) { return stores.delete(name); },
    async match(req, opts) {
      for (const cache of stores.values()) { const r = await cache.match(req, opts); if (r) return r; }
      return undefined;
    },
  };

  const listeners = {};
  const ctx = vm.createContext({
    console, URL, Request, Response, Headers, caches, fetch: fakeFetch,
    location: new URL(BASE + 'sw.js'),
    skipWaiting: async () => {},
    clients: { claim: async () => {} },
    addEventListener: (type, fn) => { (listeners[type] ??= []).push(fn); },
  });
  ctx.self = ctx;
  vm.runInContext(readFileSync(new URL('../sw.js', import.meta.url), 'utf8'), ctx, { filename: 'sw.js' });

  return {
    // Fires an event; resolves once respondWith and every waitUntil have settled.
    async dispatch(type, extra = {}) {
      const waits = [];
      let responded;
      const event = { waitUntil: (p) => { waits.push(Promise.resolve(p)); } };
      if (type === 'fetch') {
        event.request = new Request(new URL(extra.url, BASE).href, { method: extra.method ?? 'GET' });
        event.respondWith = (p) => { responded = Promise.resolve(p); };
      }
      for (const fn of listeners[type] ?? []) fn(event);
      const response = responded ? await responded : undefined;
      await Promise.all(waits);
      return response;
    },
    setOffline(value) { offline = value; },
    setFile(path, text) { files[path] = text; },
    cacheNames() { return [...stores.keys()]; },
    cachedPaths(name) { return [...(stores.get(name)?.entries.keys() ?? [])].map((u) => new URL(u).pathname); },
    run(expr) { return vm.runInContext(expr, ctx); },
    addCache(name) { stores.set(name, new FakeCache()); },
  };
}
