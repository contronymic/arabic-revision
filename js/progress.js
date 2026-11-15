// Marks and the measure. A phrase is "remembered" once it has been answered
// right in the quiz on two different days; it then stays remembered.
// Card rounds are practice: they move the card schedule, not progress.
import { cardKey, markCard } from './schedule.js';
import { flatten } from './lessons.js';

export function recordMark(state, { phraseId, dir, right, today }) {
  const key = cardKey(phraseId, dir);
  state.cards[key] = markCard(state.cards[key], right, today);
  return state;
}

// A phrase missed in the quiz leads every quiz after, until it is answered right.
export function recordQuizAnswer(state, { phraseId, right, today }) {
  const missed = (state.quizMissed ?? []).filter((id) => id !== phraseId);
  state.quizMissed = right ? missed : [...missed, phraseId];
  if (!right) return state;
  const days = state.rightDays[phraseId] ?? [];
  if (!days.includes(today) && days.length < 2) state.rightDays[phraseId] = [...days, today];
  return state;
}

export function isMissed(state, phraseId) {
  return (state.quizMissed ?? []).includes(phraseId);
}

export function isRemembered(state, phraseId) {
  return (state.rightDays[phraseId]?.length ?? 0) >= 2;
}

// Rounded down, so 90% shows only once 90% is really reached.
export function percent(remembered, total) {
  return total ? Math.floor((100 * remembered) / total) : 0;
}

export function stats(state, lessons) {
  const perLesson = lessons.map((lesson) => {
    const { phrases } = flatten([lesson]);
    const remembered = phrases.filter((p) => isRemembered(state, p.id)).length;
    return { id: lesson.id, title: lesson.title, remembered, total: phrases.length, percent: percent(remembered, phrases.length) };
  });
  const remembered = perLesson.reduce((sum, l) => sum + l.remembered, 0);
  const total = perLesson.reduce((sum, l) => sum + l.total, 0);
  return { lessons: perLesson, overall: { remembered, total, percent: percent(remembered, total) } };
}
