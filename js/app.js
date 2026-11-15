// The app controller: decides what the screen shows and reacts to taps.
// It never touches the page; ui.js draws whatever view() describes.
import { localDay } from './dates.js';
import { flatten, englishAnswer } from './lessons.js';
import { pickCards } from './schedule.js';
import { recordMark, recordQuizAnswer, isRemembered, isMissed, stats } from './progress.js';
import { makeQuestion, buildQuiz, explain } from './quiz.js';
import { pickOne } from './random.js';

export const SCOPE_ALL = 'all';
const ROUND_SIZE = 10;

// Said for a right answer, one picked at random each time.
export const PRAISE = ['Right!', 'Correct!', 'Yes!', 'Well done!', 'Spot on!', 'Exactly!', 'Nice one!'];

// navigator.standalone exists only in Safari on iPhone and iPad.
export function shouldShowInstallNote(standalone, dismissed) {
  return standalone === false && !dismissed;
}

// tapDelayMs: the answers ignore taps this soon after a question appears, so a
// quick double tap on "Next" (or on a round's button) can't answer the next question.
export function createApp({ lessons, problems = [], store, now = () => new Date(), rng = Math.random, standalone, tapDelayMs = 400 }) {
  let state = store.load();
  let saveFailed = !store.available;
  let lastSaveOk = true;
  let content = { lessons, problems, ...flatten(lessons) };
  let screen = 'home';
  let round = null;

  const save = () => {
    lastSaveOk = store.save(state);
    if (!lastSaveOk) saveFailed = true;
  };
  // Another copy of the site (a second tab, or the app beside a browser tab) may
  // have saved since we loaded, so re-read before every change rather than
  // writing an old picture over its work.
  const refresh = () => { if (store.available && lastSaveOk) state = store.load(); };
  const today = () => localDay(now());
  const findPhrase = (c, id) => c.phrases.find((p) => p.id === id);
  const phraseById = (id) => findPhrase(content, id);

  const scope = () => {
    const chosen = state.prefs.scope;
    return content.lessons.some((l) => l.id === chosen) ? chosen : SCOPE_ALL;
  };
  const pool = () => {
    const chosen = scope();
    return chosen === SCOPE_ALL ? content.phrases : content.phrases.filter((p) => p.lessonId === chosen);
  };

  // The whole set a phrase belongs to, with this form marked.
  const setOf = (c, phrase) => {
    const forms = (c.sets.get(phrase.setId)?.phraseIds ?? []).map((id) => findPhrase(c, id)).filter(Boolean);
    const list = forms.length > 0 ? forms : [phrase];
    return list.map((p) => ({ ar: p.ar, en: englishAnswer(p.en), current: p.id === phrase.id }));
  };

  // A round keeps the lessons it started with: lessons refreshed in the
  // meantime (main.js does this when the app comes back to the front) apply
  // from the next round, so a phrase can't vanish halfway through this one.
  const start = (kind, dir, questions) => {
    if (questions.length === 0) return;
    round = { kind, ...(dir ? { dir } : {}), content, items: questions, index: 0, chosen: null, results: [],
      shownAt: now().getTime() };
    screen = 'question';
  };

  function homeView() {
    return {
      screen: 'home',
      scopes: [{ id: SCOPE_ALL, label: 'All lessons so far' }, ...content.lessons.map((l) => ({ id: l.id, label: l.title, ...(l.summary ? { summary: l.summary } : {}) }))],
      scope: scope(),
      stats: stats(state, content.lessons),
      installNote: shouldShowInstallNote(standalone, state.prefs.installNoteDismissed),
      saveFailed,
      problems: content.problems,
    };
  }

  function questionView() {
    const question = round.items[round.index];
    const view = { screen: 'question', kind: round.kind, position: round.index + 1, total: round.items.length,
      question, chosen: round.chosen, saveFailed };
    if (round.chosen !== null) {
      // After answering: why, the phrase's whole set, and its note.
      if (round.praise) view.praise = round.praise;
      const c = round.content;
      view.explain = explain(question, round.chosen, c.phrases);
      const phrase = findPhrase(c, question.phraseId);
      if (phrase) {
        view.set = setOf(c, phrase);
        const note = c.sets.get(phrase.setId)?.note;
        if (note !== undefined) view.note = note;
      }
    }
    return view;
  }

  function doneView() {
    const right = round.results.filter((r) => r.right).length;
    const missed = round.results.filter((r) => !r.right).map((r) => ({ ar: r.phrase.ar, en: englishAnswer(r.phrase.en) }));
    return { screen: 'done', kind: round.kind, ...(round.dir ? { dir: round.dir } : {}),
      right, total: round.results.length, missed };
  }

  return {
    view() {
      if (screen === 'question') return questionView();
      if (screen === 'done') return doneView();
      return homeView();
    },

    refresh,

    setScope(id) {
      if (id !== SCOPE_ALL && !content.lessons.some((l) => l.id === id)) return;
      refresh();
      state.prefs.scope = id;
      save();
    },

    // A practice round in one direction: the card schedule picks the phrases.
    startCards(dir) {
      refresh();
      const phrases = pool();
      if (phrases.length === 0) return;
      const ids = pickCards(phrases.map((p) => p.id), dir, state.cards, today(), ROUND_SIZE, rng);
      const questions = ids.map((id) => makeQuestion(dir, phraseById(id), phrases, content.sets, rng)).filter(Boolean);
      start('cards', dir, questions);
    },

    // The quiz: both directions, and the only round that counts towards progress.
    startQuiz() {
      refresh();
      const phrases = pool();
      if (phrases.length === 0) return;
      start('quiz', null, buildQuiz(phrases, content.sets, ROUND_SIZE, rng,
        (id) => isRemembered(state, id), (id) => isMissed(state, id)));
    },

    // Saves straight away, so closing the app mid-round loses nothing.
    choose(i) {
      if (screen !== 'question' || round.chosen !== null) return;
      if (now().getTime() - round.shownAt < tapDelayMs) return;
      const q = round.items[round.index];
      if (!Number.isInteger(i) || i < 0 || i >= q.options.length) return;
      round.chosen = i;
      const right = i === q.answer;
      round.praise = right ? pickOne(PRAISE, rng) : null;
      refresh();
      if (round.kind === 'quiz') recordQuizAnswer(state, { phraseId: q.phraseId, right, today: today() });
      else recordMark(state, { phraseId: q.phraseId, dir: q.dir, right, today: today() });
      save();
      round.results.push({ phrase: findPhrase(round.content, q.phraseId), right });
    },

    next() {
      if (screen !== 'question' || round.chosen === null) return;
      round.index += 1;
      round.chosen = null;
      round.shownAt = now().getTime();
      if (round.index >= round.items.length) screen = 'done';
    },

    goHome() {
      screen = 'home';
      round = null;
    },

    dismissInstallNote() {
      refresh();
      state.prefs.installNoteDismissed = true;
      save();
    },

    setLessons(newLessons, newProblems = []) {
      content = { lessons: newLessons, problems: newProblems, ...flatten(newLessons) };
    },
  };
}
