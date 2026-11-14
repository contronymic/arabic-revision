import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createApp, shouldShowInstallNote } from '../js/app.js';
import { createStore, emptyState, STORAGE_KEY } from '../js/store.js';
import { readJson, memoryStorage, throwingStorage, seededRng } from './helpers.js';

const f1 = readJson('test/fixtures/lessons/lesson-01.json');
const f2 = readJson('test/fixtures/lessons/lesson-02.json');

function makeApp({ storage = memoryStorage(), day = '2026-11-14', standalone } = {}) {
  const [y, m, d] = day.split('-').map(Number);
  return createApp({ lessons: [f1, f2], problems: [], store: createStore(storage),
    now: () => new Date(y, m - 1, d, 9, 0), rng: seededRng(7), standalone });
}
const flipAndMark = (app, right) => { app.flip(); app.mark(right); };
// Marks cards right until done(view) holds; gives up after 20 steps so a bug can't hang the run.
function stepUntil(app, done) {
  for (let i = 0; i < 20 && !done(app.view()); i++) flipAndMark(app, true);
  assert.ok(done(app.view()), 'stepUntil gave up after 20 steps');
}

test("home shows the scopes and each lesson's figures", () => {
  const v = makeApp().view();
  assert.equal(v.screen, 'home'); assert.equal(v.scope, 'all'); assert.equal(v.stats.overall.total, 13);
  assert.deepEqual(v.scopes.map(s => s.label), ['All lessons so far', 'Fixture 1', 'Fixture 2']);
});

test('a mark is saved the moment it is made', () => {
  const storage = memoryStorage(), app = makeApp({ storage, day: '2026-11-14' });
  app.startCards('en-ar'); const id = app.view().phraseId; flipAndMark(app, true);
  const saved = createStore(storage).load();
  assert.equal(saved.cards[`${id}|en-ar`].box, 1); assert.deepEqual(saved.rightDays[id], ['2026-11-14']);
});

test('marks made before closing mid-round count on the next day', () => {
  const storage = memoryStorage(), day1 = makeApp({ storage, day: '2026-11-14' });
  day1.setScope('lesson-02'); day1.startCards('en-ar'); flipAndMark(day1, true); flipAndMark(day1, true); // closed after 2 of 3
  const day2 = makeApp({ storage, day: '2026-11-15' });
  assert.equal(day2.view().scope, 'lesson-02');
  day2.startCards('en-ar'); stepUntil(day2, v => v.screen === 'done');
  assert.equal(day2.view().stats.lessons[1].remembered, 2);
});

test('Right and Wrong do nothing until the card is flipped', () => {
  const app = makeApp(); app.startCards('en-ar'); app.mark(true);
  assert.equal(app.view().position, 1); assert.equal(app.view().flipped, false); assert.equal(app.view().back, null);
});

test('a round of cards ends with a summary of what was missed', () => {
  const app = makeApp(); app.setScope('lesson-02'); app.startCards('en-ar');
  flipAndMark(app, false); flipAndMark(app, true); flipAndMark(app, true);
  const v = app.view(); assert.equal(v.screen, 'done'); assert.equal(v.right, 2); assert.equal(v.total, 3); assert.equal(v.missed.length, 1);
});

test('English → Arabic: English and hint in front; Arabic and the whole set behind', () => {
  const app = makeApp(); app.setScope('lesson-01'); app.startCards('en-ar');
  stepUntil(app, v => v.phraseId === 'glada');   // all 10 phrases are new, so glada is in the round
  assert.deepEqual(app.view().front, { text: 'glad (f)', arabic: false });
  app.flip();
  assert.deepEqual(app.view().back, { text: 'fāriza', arabic: true, note: 'A note.', set: [
    { ar: 'fāriz', en: 'glad (m)', current: false }, { ar: 'fāriza', en: 'glad (f)', current: true },
    { ar: 'fārizīn', en: 'glad (pl)', current: false } ] });
});

test('an English → Arabic card shows its hint', () => {
  const app = makeApp(); app.setScope('lesson-01'); app.startCards('en-ar');
  stepUntil(app, v => v.phraseId === 'hi');
  assert.deepEqual(app.view().front, { text: 'hello', hint: '(not zubu)', arabic: false });
});

test('Arabic → English shows the Arabic first and no hint', () => {
  const app = makeApp(); app.setScope('lesson-01'); app.startCards('ar-en');
  stepUntil(app, v => v.phraseId === 'hi');
  assert.deepEqual(app.view().front, { text: 'zabi', arabic: true });
});

test('a saved scope for a lesson that has gone falls back to all', () => {
  const storage = memoryStorage(), st = emptyState(); st.prefs.scope = 'lesson-09'; createStore(storage).save(st);
  assert.equal(makeApp({ storage }).view().scope, 'all');
});

test('a quiz takes one choice per question, scores it, and changes no progress', () => {
  const storage = memoryStorage(), app = makeApp({ storage }), before = storage.getItem(STORAGE_KEY); app.startQuiz();
  for (let i = 0; i < 20 && app.view().screen === 'quiz'; i++) {
    const q = app.view().question; app.choose(q.answer); app.choose((q.answer + 1) % q.options.length); app.next();
  }
  assert.equal(app.view().right, app.view().total); assert.equal(app.view().total, 10);
  assert.equal(storage.getItem(STORAGE_KEY), before);
});

test('with no lessons, rounds do not start', () => {
  const app = createApp({ lessons: [], problems: ['x'], store: createStore(memoryStorage()) });
  app.startCards('en-ar'); app.startQuiz(); assert.equal(app.view().screen, 'home'); assert.equal(app.view().problems.length, 1);
});

test('the iPhone note shows only in Safari outside the Home Screen app, until OK', () => {
  assert.equal(shouldShowInstallNote(false, false), true);
  assert.equal(shouldShowInstallNote(true, false), false);
  assert.equal(shouldShowInstallNote(undefined, false), false);
  assert.equal(shouldShowInstallNote(false, true), false);
  const storage = memoryStorage(), app = makeApp({ storage, standalone: false });
  assert.equal(app.view().installNote, true); app.dismissInstallNote();
  assert.equal(makeApp({ storage, standalone: false }).view().installNote, false);
});

test('when storage fails, rounds still work and the view says so', () => {
  const app = makeApp({ storage: throwingStorage() }); assert.equal(app.view().saveFailed, true);
  app.startCards('en-ar'); flipAndMark(app, true);
  assert.equal(app.view().saveFailed, true); assert.equal(app.view().position, 2);
});

test('setLessons swaps the lessons and keeps progress', () => {
  const storage = memoryStorage(), app = makeApp({ storage });
  app.startCards('en-ar'); const id = app.view().phraseId; flipAndMark(app, true); app.goHome();
  app.setLessons([f1], []);
  assert.equal(app.view().stats.overall.total, 10);
  assert.equal(createStore(storage).load().cards[`${id}|en-ar`].box, 1);
});
