// Browser features that can throw or be missing must never stop the site starting.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { getStorage, startOfflineCopy, checkForUpdate, isStandalone } from '../js/platform.js';

// An object whose named properties throw when read, as Firefox's do with site data blocked.
function throwing(names) {
  const o = {};
  for (const n of names) Object.defineProperty(o, n, { get() { throw new Error('SecurityError'); } });
  return o;
}

test('blocked storage gives null instead of crashing', () => {
  assert.equal(getStorage(throwing(['localStorage'])), null);
  const ls = {}; assert.equal(getStorage({ localStorage: ls }), ls);
});

test('a browser that refuses the offline copy still starts', async () => {
  assert.doesNotThrow(() => startOfflineCopy(throwing(['serviceWorker', 'storage'])));
  assert.doesNotThrow(() => startOfflineCopy({}));   // no service worker support at all
  const refusing = { serviceWorker: { register: () => Promise.reject(new Error('no')) },
    storage: { persist: () => Promise.reject(new Error('no')) } };
  assert.doesNotThrow(() => startOfflineCopy(refusing));
  assert.doesNotThrow(() => checkForUpdate(throwing(['serviceWorker'])));
  await new Promise((r) => setTimeout(r, 10));   // an unhandled rejection would fail the run
});

test('the offline copy is registered from sw.js', () => {
  let url;
  startOfflineCopy({ serviceWorker: { register: (u) => { url = u; return Promise.resolve(); } } });
  assert.equal(url, './sw.js');
});

test('standalone is read safely', () => {
  assert.equal(isStandalone({ standalone: true }), true);
  assert.equal(isStandalone({}), undefined);
  assert.equal(isStandalone(throwing(['standalone'])), undefined);
});
