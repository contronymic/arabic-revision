// Tap-to-answer quiz questions, built only from the lessons' own phrases.
// Quizzes are practice: they never touch progress or the card schedule.
import { shuffle, pickOne } from './random.js';

export const QUIZ_TYPES = ['meaning', 'arabic', 'reply', 'form'];

// Up to `count` distinct texts from the candidates, never equal to the answer.
function wrongOptions(candidates, answer, count, rng) {
  const seen = new Set([answer]);
  const out = [];
  for (const text of shuffle(candidates, rng)) {
    if (out.length === count) break;
    if (!seen.has(text)) { seen.add(text); out.push(text); }
  }
  return out;
}

function question(type, phrase, prompt, promptIsArabic, answerText, wrong, rng, withHint) {
  if (wrong.length === 0) return null;
  const options = shuffle([answerText, ...wrong], rng);
  const q = { type, phraseId: phrase.id, prompt, promptIsArabic, options, answer: options.indexOf(answerText) };
  if (withHint && phrase.hint !== undefined) q.hint = phrase.hint;
  return q;
}

export function makeQuestion(type, phrase, pool, sets, rng = Math.random) {
  const others = pool.filter((p) => p.id !== phrase.id);

  if (type === 'meaning') {
    const wrong = wrongOptions(others.filter((p) => p.en !== phrase.en).map((p) => p.en), phrase.en, 3, rng);
    return question(type, phrase, phrase.ar, true, phrase.en, wrong, rng, false);
  }

  if (type === 'arabic') {
    const wrong = wrongOptions(others.filter((p) => p.en !== phrase.en).map((p) => p.ar), phrase.ar, 3, rng);
    return question(type, phrase, phrase.en, false, phrase.ar, wrong, rng, true);
  }

  if (type === 'reply') {
    const replySetId = sets.get(phrase.setId)?.reply;
    const replySet = replySetId ? sets.get(replySetId) : undefined;
    if (!replySet) return null;
    const replyForms = pool.filter((p) => p.setId === replySet.id);
    if (replyForms.length === 0) return null;
    const answerText = pickOne(replyForms, rng).ar;
    // A greeting with the same English (ahlan and marḥaba both mean "hello") is the
    // same greeting said another way, so its replies are right too: never offer them,
    // or those greetings, as wrong choices.
    const sameEnglish = new Set(pool.filter((p) => p.en === phrase.en).map((p) => p.setId));
    sameEnglish.add(phrase.setId);
    const rightReplies = new Set([...sameEnglish].map((id) => sets.get(id)?.reply).filter(Boolean));
    const usable = pool.filter((p) => !rightReplies.has(p.setId) && !sameEnglish.has(p.setId));
    const replyTargets = new Set([...sets.values()].map((s) => s.reply).filter(Boolean));
    let wrong = wrongOptions(usable.filter((p) => replyTargets.has(p.setId)).map((p) => p.ar), answerText, 3, rng);
    if (wrong.length < 3) {
      const extra = usable.map((p) => p.ar).filter((t) => !wrong.includes(t));
      wrong = [...wrong, ...wrongOptions(extra, answerText, 3 - wrong.length, rng)];
    }
    return question(type, phrase, phrase.ar, true, answerText, wrong, rng, false);
  }

  if (type === 'form') {
    const siblings = others.filter((p) => p.setId === phrase.setId);
    const wrong = wrongOptions(siblings.map((p) => p.ar), phrase.ar, 3, rng);
    return question(type, phrase, phrase.en, false, phrase.ar, wrong, rng, true);
  }

  return null;
}

// Up to n questions, each about a different phrase, in a mix of types.
export function buildQuiz(pool, sets, n = 10, rng = Math.random) {
  const questions = [];
  for (const phrase of shuffle(pool, rng)) {
    if (questions.length === n) break;
    for (const type of shuffle(QUIZ_TYPES, rng)) {
      const q = makeQuestion(type, phrase, pool, sets, rng);
      if (q) { questions.push(q); break; }
    }
  }
  return questions;
}
