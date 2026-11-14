// Start-up: open storage, load the lessons, draw the screen, and redraw after each tap.
import { loadLessons } from './lessons.js';
import { createStore, STORAGE_KEY } from './store.js';
import { createApp } from './app.js';
import { render } from './ui.js';
import { getStorage, startOfflineCopy, checkForUpdate, isStandalone } from './platform.js';

startOfflineCopy(navigator);

const store = createStore(getStorage(window));
const fetchLessons = () => loadLessons((url) => fetch(url));
const root = document.getElementById('app');

const { lessons, problems } = await fetchLessons();
const app = createApp({ lessons, problems, store, standalone: isStandalone(navigator) });

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

// Redraws screens that show progress, after progress was re-read.
function refreshProgress() {
  app.refresh();
  const screen = app.view().screen;
  if (screen === 'home' || screen === 'done') draw();
}

draw();

// Another open copy of the site (a second tab, or the app beside a browser tab) saved progress.
window.addEventListener('storage', (event) => {
  if (event.key === STORAGE_KEY || event.key === null) refreshProgress();
});

// A Home Screen app is often resumed rather than reloaded, so look for new
// or corrected lessons, and other copies' progress, whenever it comes back to the front.
document.addEventListener('visibilitychange', async () => {
  if (document.visibilityState !== 'visible') return;
  checkForUpdate(navigator);
  refreshProgress();
  if (app.view().screen !== 'home') return;
  const fresh = await fetchLessons();
  if (fresh.lessons.length === 0) return;
  app.setLessons(fresh.lessons, fresh.problems);
  if (app.view().screen === 'home') draw();
});
