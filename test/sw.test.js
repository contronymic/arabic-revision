import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { createSwEnv } from './sw-env.js';
import { readJson } from './helpers.js';

// The site's files as served: text for most, raw bytes for the icons.
function fromDisk() {
  const files = {};
  for (const f of ['index.html', 'app.css', 'manifest.webmanifest']) files[f] = readFileSync(f, 'utf8');
  for (const f of readdirSync('js').filter(f => f.endsWith('.js'))) files['js/' + f] = readFileSync('js/' + f, 'utf8');
  for (const f of readdirSync('icons').filter(f => f.endsWith('.png'))) files['icons/' + f] = readFileSync('icons/' + f);
  for (const f of readdirSync('fonts').filter(f => f.endsWith('.woff2'))) files['fonts/' + f] = readFileSync('fonts/' + f);
  for (const f of readdirSync('lessons').filter(f => f.endsWith('.json'))) files['lessons/' + f] = readFileSync('lessons/' + f, 'utf8');
  return files;
}

test('SHELL_FILES lists every file the page needs', () => {
  const env = createSwEnv(fromDisk());
  const expected = ['./', './index.html', './app.css', './manifest.webmanifest',
    ...readdirSync('js').filter(f => f.endsWith('.js')).map(f => './js/' + f), './icons/icon-180.png', './icons/icon-192.png', './icons/icon-512.png',
    ...readdirSync('fonts').filter(f => f.endsWith('.woff2')).map(f => './fonts/' + f)];
  assert.deepEqual(new Set(env.run('SHELL_FILES')), new Set(expected));
});

test('install stores the page and every lesson in the index', async () => {
  const env = createSwEnv(fromDisk()); await env.dispatch('install');
  assert.ok(env.cachedPaths(env.run('SHELL_CACHE')).includes('/arabic-revision/js/app.js'));
  const listed = readJson('lessons/index.json').lessons.map(l => '/arabic-revision/lessons/' + l.file);
  assert.deepEqual(env.cachedPaths('arabic-revision-lessons').sort(), ['/arabic-revision/lessons/index.json', ...listed].sort());
});

test("activate removes only this site's old offline copies", async () => {
  const env = createSwEnv(fromDisk());
  for (const n of ['arabic-revision-shell-v0', 'other-project-cache', 'workbox-precache-v2']) env.addCache(n);
  await env.dispatch('install'); await env.dispatch('activate');
  assert.deepEqual(env.cacheNames().sort(), ['arabic-revision-lessons', env.run('SHELL_CACHE'), 'other-project-cache', 'workbox-precache-v2'].sort());
});

test('offline, the page and the lessons come from the offline copy', async () => {
  const env = createSwEnv(fromDisk()); await env.dispatch('install'); env.setOffline(true);
  assert.equal((await env.dispatch('fetch', { url: './' })).status, 200);
  assert.equal((await env.dispatch('fetch', { url: './lessons/lesson-01.json' })).status, 200);
});

test('a lesson added to the index is stored on the next visit', async () => {
  const env = createSwEnv(fromDisk()); await env.dispatch('install');
  env.setFile('lessons/index.json', JSON.stringify({ lessons: [{ id: 'lesson-01', file: 'lesson-01.json' }, { id: 'lesson-02', file: 'lesson-02.json' }] }));
  env.setFile('lessons/lesson-02.json', readFileSync('test/fixtures/lessons/lesson-02.json', 'utf8'));
  await env.dispatch('fetch', { url: './lessons/index.json' });
  assert.ok(env.cachedPaths('arabic-revision-lessons').includes('/arabic-revision/lessons/lesson-02.json'));
});

test('requests to other sites are left alone', async () => {
  const env = createSwEnv(fromDisk());
  assert.equal(await env.dispatch('fetch', { url: 'https://elsewhere.example/x' }), undefined);
});

test('VERSION matches the page files', () => {
  const env = createSwEnv(fromDisk()), files = env.run('SHELL_FILES').filter(f => f !== './');
  const hash = createHash('sha256'); for (const f of files) hash.update(readFileSync(f.slice(2)));
  const expected = hash.digest('hex').slice(0, 12);
  assert.equal(env.run('VERSION'), expected, `a page file changed: set VERSION in sw.js to '${expected}'`);
});

test('a failed download keeps the good offline copy', async () => {
  const env = createSwEnv(fromDisk()); await env.dispatch('install');
  env.setFile('lessons/lesson-01.json', null);
  await env.dispatch('fetch', { url: './lessons/index.json' });
  assert.equal((await env.dispatch('fetch', { url: './lessons/lesson-01.json' })).status, 200);
});
