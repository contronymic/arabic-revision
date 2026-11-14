// Start-up: open storage, load the lessons, draw the screen, and redraw after each tap.
import { loadLessons } from './lessons.js';
import { createStore } from './store.js';
import { createApp } from './app.js';
import { render } from './ui.js';

let storage = null;
try {
  storage = window.localStorage;
} catch {
  storage = null;
}

// The offline copy and the Home Screen app. Neither is essential, so failures are ignored.
navigator.serviceWorker?.register('./sw.js').catch(() => {});
navigator.storage?.persist?.()?.catch(() => {});

const store = createStore(storage);
const fetchLessons = () => loadLessons((url) => fetch(url));
const root = document.getElementById('app');

const { lessons, problems } = await fetchLessons();
const app = createApp({ lessons, problems, store, standalone: navigator.standalone });

let shown = '';
function draw() {
  const view = app.view();
  render(root, view, act);
  const where = `${view.screen}:${view.position ?? ''}`;
  if (where !== shown) {
    shown = where;
    window.scrollTo(0, 0);
    root.querySelector('[data-focus]')?.focus({ preventScroll: true });
  }
}

const METHODS = ['setScope', 'startCards', 'flip', 'mark', 'startQuiz', 'choose', 'next', 'goHome', 'dismissInstallNote'];
const act = Object.fromEntries(METHODS.map((name) => [name, (...args) => { app[name](...args); draw(); }]));

draw();

// A Home Screen app is often resumed rather than reloaded, so look for new
// or corrected lessons whenever it comes back to the front.
document.addEventListener('visibilitychange', async () => {
  if (document.visibilityState !== 'visible') return;
  navigator.serviceWorker?.getRegistration().then((r) => r?.update()).catch(() => {});
  if (app.view().screen !== 'home') return;
  const fresh = await fetchLessons();
  if (fresh.lessons.length === 0) return;
  app.setLessons(fresh.lessons, fresh.problems);
  if (app.view().screen === 'home') draw();
});
