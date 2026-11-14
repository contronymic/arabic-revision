// The app controller: decides what the screen shows and reacts to taps.
// It never touches the page; ui.js draws whatever view() describes.
import { localDay } from './dates.js';
import { flatten } from './lessons.js';
import { pickCards } from './schedule.js';
import { recordMark, stats } from './progress.js';
import { buildQuiz } from './quiz.js';

export const SCOPE_ALL = 'all';
const ROUND_SIZE = 10;

// navigator.standalone exists only in Safari on iPhone and iPad.
export function shouldShowInstallNote(standalone, dismissed) {
  return standalone === false && !dismissed;
}

// markDelayMs: Right and Wrong are ignored this soon after "Show answer", so a
// quick double tap can't mark the card by accident.
export function createApp({ lessons, problems = [], store, now = () => new Date(), rng = Math.random, standalone, markDelayMs = 400 }) {
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
  const phraseById = (id) => content.phrases.find((p) => p.id === id);

  const scope = () => {
    const chosen = state.prefs.scope;
    return content.lessons.some((l) => l.id === chosen) ? chosen : SCOPE_ALL;
  };
  const pool = () => {
    const chosen = scope();
    return chosen === SCOPE_ALL ? content.phrases : content.phrases.filter((p) => p.lessonId === chosen);
  };

  // The whole set a phrase belongs to, with this form marked.
  const setOf = (phrase) => {
    const forms = (content.sets.get(phrase.setId)?.phraseIds ?? []).map(phraseById).filter(Boolean);
    const list = forms.length > 0 ? forms : [phrase];
    return list.map((p) => ({ ar: p.ar, en: p.en, current: p.id === phrase.id }));
  };

  const finish = () => { screen = 'done'; };

  function homeView() {
    return {
      screen: 'home',
      scopes: [{ id: SCOPE_ALL, label: 'All lessons so far' }, ...content.lessons.map((l) => ({ id: l.id, label: l.title }))],
      scope: scope(),
      stats: stats(state, content.lessons),
      installNote: shouldShowInstallNote(standalone, state.prefs.installNoteDismissed),
      saveFailed,
      problems: content.problems,
    };
  }

  function cardView() {
    const phrase = round.items[round.index];
    const toArabic = round.dir === 'en-ar';
    const front = toArabic
      ? { text: phrase.en, ...(phrase.hint !== undefined ? { hint: phrase.hint } : {}), arabic: false }
      : { text: phrase.ar, arabic: true };
    let back = null;
    if (round.flipped) {
      const note = content.sets.get(phrase.setId)?.note;
      back = { text: toArabic ? phrase.ar : phrase.en, arabic: toArabic, set: setOf(phrase), ...(note !== undefined ? { note } : {}) };
    }
    return { screen: 'card', dir: round.dir, phraseId: phrase.id, position: round.index + 1, total: round.items.length,
      flipped: round.flipped, front, back, saveFailed };
  }

  function quizView() {
    return { screen: 'quiz', position: round.index + 1, total: round.items.length,
      question: round.items[round.index], chosen: round.chosen };
  }

  function doneView() {
    const right = round.results.filter((r) => r.right).length;
    const missed = round.results.filter((r) => !r.right).map((r) => ({ ar: r.phrase.ar, en: r.phrase.en }));
    return { screen: 'done', kind: round.kind, ...(round.kind === 'cards' ? { dir: round.dir } : {}),
      right, total: round.results.length, missed, stats: stats(state, content.lessons) };
  }

  return {
    view() {
      if (screen === 'card') return cardView();
      if (screen === 'quiz') return quizView();
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

    startCards(dir) {
      refresh();
      const phrases = pool();
      if (phrases.length === 0) return;
      const ids = pickCards(phrases.map((p) => p.id), dir, state.cards, today(), ROUND_SIZE, rng);
      round = { kind: 'cards', dir, items: ids.map((id) => phrases.find((p) => p.id === id)), index: 0, flipped: false, results: [] };
      screen = 'card';
    },

    flip() {
      if (screen !== 'card' || round.flipped) return;
      round.flipped = true;
      round.flippedAt = now().getTime();
    },

    // Saves straight away, so closing the app mid-round loses nothing.
    mark(right) {
      if (screen !== 'card' || !round.flipped) return;
      if (now().getTime() - round.flippedAt < markDelayMs) return;
      const phrase = round.items[round.index];
      refresh();
      recordMark(state, { phraseId: phrase.id, dir: round.dir, right, today: today() });
      save();
      round.results.push({ phrase, right });
      round.index += 1;
      round.flipped = false;
      if (round.index >= round.items.length) finish();
    },

    startQuiz() {
      refresh();
      const phrases = pool();
      if (phrases.length === 0) return;
      const questions = buildQuiz(phrases, content.sets, ROUND_SIZE, rng);
      if (questions.length === 0) return;
      round = { kind: 'quiz', items: questions, index: 0, chosen: null, results: [] };
      screen = 'quiz';
    },

    choose(i) {
      if (screen !== 'quiz' || round.chosen !== null) return;
      const q = round.items[round.index];
      if (!Number.isInteger(i) || i < 0 || i >= q.options.length) return;
      round.chosen = i;
      // What the finish screen lists: the phrase with its answer. For a reply
      // question, that is the right reply and what it answers.
      const phrase = q.type === 'reply'
        ? { ar: q.options[q.answer], en: `reply to ${q.prompt}` }
        : phraseById(q.phraseId) ?? { ar: q.promptIsArabic ? q.prompt : '', en: q.promptIsArabic ? '' : q.prompt };
      round.results.push({ phrase, right: i === q.answer });
    },

    next() {
      if (screen !== 'quiz' || round.chosen === null) return;
      round.index += 1;
      round.chosen = null;
      if (round.index >= round.items.length) finish();
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
