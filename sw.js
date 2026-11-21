// The offline copy. A classic script (not a module) so every phone can run it.
// The page is served from its own copy, renewed whenever VERSION changes.
// Lessons are served from their copy at once and refreshed in the background.

// The first 12 hex characters of the SHA-256 of SHELL_FILES (except './').
// `node --test` gives the right value whenever a page file changes.
const VERSION = 'c29ffa659e00';
const SHELL_PREFIX = 'arabic-revision-shell-';
const SHELL_CACHE = SHELL_PREFIX + VERSION;
const LESSONS_CACHE = 'arabic-revision-lessons';
const SHELL_FILES = [
  './',
  './index.html',
  './app.css',
  './manifest.webmanifest',
  './js/app.js',
  './js/dates.js',
  './js/lessons.js',
  './js/main.js',
  './js/platform.js',
  './js/progress.js',
  './js/quiz.js',
  './js/random.js',
  './js/schedule.js',
  './js/store.js',
  './js/ui.js',
  './icons/icon-180.png',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './fonts/alegreya-latin.woff2',
  './fonts/alegreya-latin-ext.woff2',
  './fonts/alegreya-italic-latin.woff2',
  './fonts/alegreya-italic-latin-ext.woff2',
  './fonts/pixelify-sans-latin.woff2',
  './fonts/vt323-latin.woff2',
];

const toUrl = (path) => new URL(path, self.location).href;
const SCOPE = toUrl('./');
const LESSONS_DIR = toUrl('./lessons/');
const LESSON_INDEX = toUrl('./lessons/index.json');
const withoutSearch = (href) => href.split('#')[0].split('?')[0];

// Stores a lesson file only if it arrived intact, so an error page never
// replaces a good copy.
async function storeIfGood(cache, key, response) {
  if (!response || !response.ok) return false;
  try {
    await response.clone().json();
  } catch {
    return false;
  }
  await cache.put(key, response);
  return true;
}

// Fetches the lesson list and every lesson in it, keeping what arrives intact.
async function refreshLessons() {
  try {
    const cache = await caches.open(LESSONS_CACHE);
    const indexResponse = await fetch(LESSON_INDEX, { cache: 'no-cache' });
    if (!indexResponse.ok) return;
    let index;
    try {
      index = await indexResponse.clone().json();
    } catch {
      return;
    }
    await cache.put(LESSON_INDEX, indexResponse);
    const files = Array.isArray(index.lessons)
      ? index.lessons.map((l) => l && l.file).filter((f) => typeof f === 'string')
      : [];
    await Promise.all(files.map(async (file) => {
      try {
        const href = new URL(file, LESSONS_DIR).href;
        await storeIfGood(cache, href, await fetch(href, { cache: 'no-cache' }));
      } catch {
        // Offline or failed: keep whatever copy there is.
      }
    }));
  } catch {
    // Offline: keep whatever copy there is.
  }
}

async function lessonFile(request) {
  const cache = await caches.open(LESSONS_CACHE);
  const cached = await cache.match(request, { ignoreSearch: true });
  if (cached) return cached;
  const response = await fetch(request);
  await storeIfGood(cache, withoutSearch(request.url), response.clone());
  return response;
}

async function pageFile(request) {
  const cache = await caches.open(SHELL_CACHE);
  const cached = await cache.match(request, { ignoreSearch: true });
  return cached || fetch(request);
}

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(SHELL_CACHE);
    await cache.addAll(SHELL_FILES.map((path) => new Request(toUrl(path), { cache: 'reload' })));
    await refreshLessons();
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const names = await caches.keys();
    await Promise.all(names
      .filter((name) => name.startsWith(SHELL_PREFIX) && name !== SHELL_CACHE)
      .map((name) => caches.delete(name)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET' || !request.url.startsWith(SCOPE)) return;
  const href = withoutSearch(request.url);
  if (href === LESSON_INDEX) {
    event.respondWith(lessonFile(request));
    event.waitUntil(refreshLessons());
  } else if (href.startsWith(LESSONS_DIR)) {
    event.respondWith(lessonFile(request));
  } else {
    event.respondWith(pageFile(request));
  }
});
