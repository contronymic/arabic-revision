import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createApp, shouldShowInstallNote, PRAISE } from '../js/app.js';
import { createStore, emptyState } from '../js/store.js';
import { readJson, memoryStorage, throwingStorage, seededRng } from './helpers.js';

const f1 = readJson('test/fixtures/lessons/lesson-01.json');
const f2 = readJson('test/fixtures/lessons/lesson-02.json');

// tapDelayMs: 0 because this clock never moves; the double-tap guard has its own test.
function makeApp({ storage = memoryStorage(), day = '2026-11-14', standalone, seed = 7, now } = {}) {
  const [y, m, d] = day.split('-').map(Number);
  return createApp({ lessons: [f1, f2], problems: [], store: createStore(storage),
    now: now ?? (() => new Date(y, m - 1, d, 9, 0)), rng: seededRng(seed), standalone, tapDelayMs: now ? 400 : 0 });
}
// Answers the current question right or wrong, then moves on.
function answer(app, right) {
  const q = app.view().question;
  app.choose(right ? q.answer : (q.answer + 1) % q.options.length);
  app.next();
}
// Answers right until done(view) holds; gives up after 20 steps so a bug can't hang the run.
function stepUntil(app, done) {
  for (let i = 0; i < 20 && !done(app.view()); i++) answer(app, true);
  assert.ok(done(app.view()), 'stepUntil gave up after 20 steps');
}
const playAll = (app, right) => { for (let i = 0; i < 20 && app.view().screen === 'question'; i++) answer(app, right); };

test("home shows the scopes and each lesson's figures", () => {
  const v = makeApp().view();
  assert.equal(v.screen, 'home'); assert.equal(v.scope, 'all'); assert.equal(v.stats.overall.total, 13);
  assert.deepEqual(v.scopes.map(s => s.label), ['All lessons so far', 'Fixture 1', 'Fixture 2']);
});

test('a card answer moves the card schedule but not progress, and is saved at once', () => {
  const storage = memoryStorage(), app = makeApp({ storage });
  app.startCards('en-ar'); const q = app.view().question; app.choose(q.answer);
  const saved = createStore(storage).load();
  assert.equal(saved.cards[`${q.phraseId}|en-ar`].box, 1); assert.deepEqual(saved.rightDays, {});
});

test('card rounds are all multiple choice, in their own direction', () => {
  const en = makeApp(); en.startCards('en-ar');
  for (let i = 0; i < 20 && en.view().screen === 'question'; i++) {
    const q = en.view().question; assert.ok(['say', 'reply'].includes(q.type)); assert.equal(q.dir, 'en-ar'); answer(en, true);
  }
  const ar = makeApp(); ar.startCards('ar-en');
  for (let i = 0; i < 20 && ar.view().screen === 'question'; i++) {
    const q = ar.view().question; assert.equal(q.type, 'meaning'); assert.equal(q.ask[0].text, 'What does this mean?'); answer(ar, true);
  }
});

test('quiz answers right on two days make a phrase remembered; card rounds never do', () => {
  const storage = memoryStorage();
  const cards = makeApp({ storage, day: '2026-11-14' }); cards.startCards('en-ar'); playAll(cards, true);
  const cards2 = makeApp({ storage, day: '2026-11-15' }); cards2.startCards('en-ar'); playAll(cards2, true);
  cards2.goHome(); assert.equal(cards2.view().stats.overall.remembered, 0);
  const day1 = makeApp({ storage, day: '2026-11-14' }); day1.setScope('lesson-02'); day1.startQuiz(); playAll(day1, true);
  const day2 = makeApp({ storage, day: '2026-11-15' }); day2.startQuiz(); playAll(day2, true);
  day2.goHome(); assert.equal(day2.view().stats.lessons[1].remembered, 3);
});

test('the quiz asks about phrases not yet remembered first', () => {
  const storage = memoryStorage(), st = emptyState();
  for (const id of ['hi', 'hi2', 'hi-back-m', 'hi-back-f', 'glad', 'glada', 'gladin', 'yes']) st.rightDays[id] = ['2026-11-01', '2026-11-02'];
  createStore(storage).save(st);
  const app = makeApp({ storage }); app.startQuiz();
  const asked = [];
  for (let i = 0; i < 20 && app.view().screen === 'question'; i++) { asked.push(app.view().question.phraseId); answer(app, true); }
  for (const id of ['thanks', 'welcome', 'big', 'small', 'day']) assert.ok(asked.includes(id), `${id} was not asked`);
});

test('the quiz asks first about phrases missed in earlier quizzes, until they are answered right', () => {
  const storage = memoryStorage(), st = emptyState();
  for (const id of ['hi', 'hi2', 'hi-back-m', 'hi-back-f', 'glad', 'glada', 'gladin', 'yes', 'thanks', 'welcome']) st.rightDays[id] = ['2026-11-01'];
  st.quizMissed = ['big', 'day'];   // remembered or not, a miss comes first
  st.rightDays.big = ['2026-11-01', '2026-11-02'];
  createStore(storage).save(st);
  const app = makeApp({ storage }); app.startQuiz();
  const asked = [];
  for (let i = 0; i < 20 && app.view().screen === 'question'; i++) {
    const q = app.view().question; asked.push(q.phraseId);
    app.choose(q.phraseId === 'big' ? (q.answer + 1) % q.options.length : q.answer); app.next();
  }
  assert.ok(asked.includes('big') && asked.includes('day'), asked.join(' '));
  assert.deepEqual(createStore(storage).load().quizMissed, ['big']);   // day was answered right, big missed again
});

test('a quick second tap after Next, or after starting a round, does not answer the question', () => {
  let t = new Date(2026, 10, 14, 9, 0).getTime();
  const app = makeApp({ now: () => new Date(t) });
  app.startQuiz();
  const q = app.view().question; app.choose(q.answer);
  assert.equal(app.view().chosen, null, 'a tap at once after starting is ignored');
  t += 500; app.choose(q.answer); assert.equal(app.view().chosen, q.answer);
  app.next();
  const q2 = app.view().question; app.choose(q2.answer);
  assert.equal(app.view().chosen, null, 'a tap at once after Next is ignored');
  t += 100; app.choose(q2.answer); assert.equal(app.view().chosen, null);
  t += 400; app.choose(q2.answer); assert.equal(app.view().chosen, q2.answer);
});

test('lessons refreshed mid-round apply from the next round, and the round still finishes', () => {
  const app = makeApp(); app.setScope('lesson-02'); app.startQuiz();
  const first = app.view().question;
  app.setLessons([f1], []);   // lesson 2 has gone, as if a fresh download dropped it
  app.choose((first.answer + 1) % first.options.length);
  assert.ok(app.view().explain.length > 0); assert.ok(app.view().set.length > 0);
  app.next(); playAll(app, false);
  const v = app.view(); assert.equal(v.screen, 'done'); assert.equal(v.missed.length, v.total);
  assert.ok(v.missed.every((m) => m.ar && m.en));
  app.goHome(); assert.equal(app.view().stats.lessons.length, 1);
});

test('a choice is taken once; Next waits for it', () => {
  const app = makeApp(); app.startQuiz();
  app.next(); assert.equal(app.view().position, 1);
  const q = app.view().question; app.choose(q.answer); app.choose((q.answer + 1) % q.options.length);
  assert.equal(app.view().chosen, q.answer);
});

test('a round ends with a summary of what was missed', () => {
  const app = makeApp(); app.setScope('lesson-02'); app.startCards('en-ar');
  answer(app, false); answer(app, true); answer(app, true);
  const v = app.view(); assert.equal(v.screen, 'done'); assert.equal(v.right, 2); assert.equal(v.total, 3); assert.equal(v.missed.length, 1);
  assert.equal(v.stats, undefined);   // progress shows on the home screen only
});

test('after answering, the whole set and its note are shown, labelled by form', () => {
  const app = makeApp(); app.setScope('lesson-01'); app.startCards('en-ar');
  stepUntil(app, v => v.question.phraseId === 'glada');   // all 10 phrases are new, so glada is in the round
  const q = app.view().question;
  assert.deepEqual(q.ask, [{ text: 'How do you say ' }, { text: '‘glad’', strong: true }, { text: ' (feminine)?' }]);
  assert.equal(app.view().set, undefined);
  app.choose(q.answer);
  assert.equal(app.view().note, 'A note.');
  assert.deepEqual(app.view().set, [
    { ar: 'fāriz', en: 'glad (masculine)', current: false }, { ar: 'fāriza', en: 'glad (feminine)', current: true },
    { ar: 'fārizīn', en: 'glad (plural)', current: false } ]);
});

test('an English → Arabic question shows its hint', () => {
  const app = makeApp(); app.setScope('lesson-01'); app.startCards('en-ar');
  stepUntil(app, v => v.question.phraseId === 'hi');
  assert.equal(app.view().question.hint, '(not zubu)');
});

test('a saved scope for a lesson that has gone falls back to all', () => {
  const storage = memoryStorage(), st = emptyState(); st.prefs.scope = 'lesson-09'; createStore(storage).save(st);
  assert.equal(makeApp({ storage }).view().scope, 'all');
});

test('a quiz has ten questions and scores them', () => {
  const app = makeApp(); app.startQuiz(); playAll(app, true);
  assert.equal(app.view().right, app.view().total); assert.equal(app.view().total, 10);
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
  app.startCards('en-ar'); answer(app, true);
  assert.equal(app.view().saveFailed, true); assert.equal(app.view().position, 2);
});

test('setLessons swaps the lessons and keeps progress', () => {
  const storage = memoryStorage(), app = makeApp({ storage });
  app.startCards('en-ar'); const id = app.view().question.phraseId; answer(app, true); app.goHome();
  app.setLessons([f1], []);
  assert.equal(app.view().stats.overall.total, 10);
  assert.equal(createStore(storage).load().cards[`${id}|en-ar`].box, 1);
});

test("two copies open on one phone never erase each other's marks", () => {
  const storage = memoryStorage();
  const b = makeApp({ storage });   // opened first, then left in the background
  const a = makeApp({ storage });
  a.setScope('lesson-01'); a.startCards('en-ar'); playAll(a, true);   // 10 marks
  b.startCards('ar-en'); answer(b, true);   // one mark in the older copy
  assert.equal(Object.keys(createStore(storage).load().cards).length, 11);
  b.goHome(); b.refresh();
  assert.equal(b.view().scope, 'lesson-01');   // coming back to the front picks up the other copy's changes
});

test('the finish screen lists the right answer for every missed question, replies included', () => {
  let replies = 0;
  for (let seed = 1; seed <= 30; seed++) {
    const app = makeApp({ seed }); app.startQuiz();
    const asked = [];
    for (let i = 0; i < 20 && app.view().screen === 'question'; i++) { asked.push(app.view().question); answer(app, false); }
    const missed = app.view().missed;
    asked.forEach((q, i) => {
      if (q.type === 'reply') replies++;
      const right = q.options[q.answer];
      assert.ok(missed[i].ar === right || missed[i].en === right, `${q.type}: ${JSON.stringify(missed[i])} lacks ${right}`);
    });
  }
  assert.ok(replies > 0, 'no reply question came up');
});

test('a right answer gets a word of praise, kept until Next', () => {
  const app = makeApp(); app.startCards('en-ar');
  const q = app.view().question; app.choose(q.answer);
  const praise = app.view().praise; assert.ok(PRAISE.includes(praise));
  assert.equal(app.view().praise, praise);
  app.next(); const q2 = app.view().question; app.choose((q2.answer + 1) % q2.options.length);
  assert.equal(app.view().praise, undefined);
});

test("the praise mixes the course's own aywa! and tamam! with English, in letters the praise font has", () => {
  assert.ok(PRAISE.includes('aywa!') && PRAISE.includes('tamam!'), PRAISE.join(' / '));
  assert.ok(PRAISE.some((p) => /[A-Z]/.test(p)), 'no English left');
  // The praise is set in the pixel font, which carries plain Latin letters only.
  for (const p of PRAISE) assert.match(p, /^[A-Za-z !]+$/);
});
