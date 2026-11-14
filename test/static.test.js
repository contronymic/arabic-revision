// Checks on the site's files themselves: privacy, safety and text direction.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const read = (f) => readFileSync(join(root, f), 'utf8');
const SKIP = new Set(['.git', 'test', 'node_modules']);

// Every file under the project folder that the site serves (test/ excluded).
function siteFiles(dir = root) {
  return readdirSync(dir).flatMap((name) => {
    if (SKIP.has(name)) return [];
    const full = join(dir, name);
    return statSync(full).isDirectory() ? siteFiles(full) : [relative(root, full)];
  });
}

const SITE_EXT = /\.(html|css|js|json|webmanifest)$/;

test('the page asks search engines not to list it', () => assert.match(read('index.html'), /<meta name="robots" content="noindex">/));
test('the page allows nothing from another site', () => assert.match(read('index.html'), /default-src 'self'/));
test('the page shows something while it starts', () => assert.match(read('index.html'), /<main id="app">\s*<p[^>]*>Loading…<\/p>/));
test('zoom is not blocked', () => assert.doesNotMatch(read('index.html'), /user-scalable|maximum-scale/));
test('no site file links to another site', () => {
  for (const f of siteFiles().filter(f => SITE_EXT.test(f))) assert.doesNotMatch(read(f), /https?:\/\/|["'(]\/\//, f);
});
test('no file uses innerHTML', () => {
  for (const f of siteFiles().filter(f => f.endsWith('.js'))) assert.doesNotMatch(read(f), /\.innerHTML\b|outerHTML\s*=|insertAdjacentHTML/, f);
});
test('nothing switches text direction, so ع stays on the left of عfwan', () => {
  for (const f of siteFiles().filter(f => /\.(html|css|js)$/.test(f)))
    assert.doesNotMatch(read(f), /\bdir\s*[=:]\s*["']?(auto|rtl)|setAttribute\(\s*["']dir|unicode-bidi|direction\s*:\s*rtl|<bdo|[‪-‮⁦-⁩]/, f);
});
