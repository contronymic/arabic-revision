// Multiple-choice questions, built only from the lessons' own phrases.
// Card rounds and the quiz both use them:
//   meaning  Arabic → English: "What does this mean?"
//   say      English → Arabic: "How do you say 'please' to a woman?"
//   reply    English → Arabic: "How would you reply to a man who says this?"
import { shuffle, pickOne } from './random.js';
import { describeForm, englishAnswer } from './lessons.js';
import { DIRS } from './schedule.js';

// Up to `count` distinct texts, never equal to the answer: from `first` before `rest`.
function wrongOptions(first, rest, answer, count, rng) {
  const seen = new Set([answer]);
  const out = [];
  for (const text of [...shuffle(first, rng), ...shuffle(rest, rng)]) {
    if (out.length === count) break;
    if (!seen.has(text)) { seen.add(text); out.push(text); }
  }
  return out;
}

function finish(q, answerText, wrong, rng) {
  if (wrong.length === 0) return null;
  const options = shuffle([answerText, ...wrong], rng);
  return { ...q, options, answer: options.indexOf(answerText) };
}

const siblingsOf = (phrase, pool) => pool.filter((p) => p.setId === phrase.setId && p.id !== phrase.id);
// Phrases from other sets, leaving out any with the same English, which would be right too.
const othersOf = (phrase, pool) => pool.filter((p) => p.setId !== phrase.setId && p.en !== phrase.en);

function meaning(phrase, pool, rng) {
  const answerText = englishAnswer(phrase.en);
  const wrong = wrongOptions(siblingsOf(phrase, pool).map((p) => englishAnswer(p.en)),
    othersOf(phrase, pool).map((p) => englishAnswer(p.en)), answerText, 3, rng);
  return finish({ type: 'meaning', dir: 'ar-en', phraseId: phrase.id,
    ask: [{ text: 'What does this mean?' }], prompt: phrase.ar }, answerText, wrong, rng);
}

function say(phrase, pool, rng) {
  const { base, to, label, by } = describeForm(phrase.en);
  let tail = '?';
  if (to) tail = ` to a ${to}?`;
  else if (label && !by) tail = ` (${label})?`;
  const wrong = wrongOptions(siblingsOf(phrase, pool).map((p) => p.ar), othersOf(phrase, pool).map((p) => p.ar), phrase.ar, 3, rng);
  // "sorry (said by a man)" is asked as the teacher words it: who is speaking.
  const q = { type: 'say', dir: 'en-ar', phraseId: phrase.id,
    ask: [{ text: by ? `How does a ${by} say ` : 'How do you say ' }, { text: `‘${base}’`, strong: true }, { text: tail }] };
  if (phrase.hint !== undefined) q.hint = phrase.hint;
  return finish(q, phrase.ar, wrong, rng);
}

// Asks for this phrase as the reply to a greeting it answers.
function reply(phrase, pool, sets, rng) {
  let greetings = pool.filter((p) => sets.get(p.setId)?.reply === phrase.setId);
  if (greetings.length === 0) return null;
  const { to, who: self } = describeForm(phrase.en);
  // A reply about yourself takes your own form: "kīfek?" is asked to a woman,
  // so she answers "ilḥamdilla mabsūṭa". Ask with the greeting that matches.
  const matched = self ? greetings.filter((g) => describeForm(g.en).to === self) : [];
  if (matched.length > 0) greetings = matched;
  const greeting = pickOne(greetings, rng);

  // A greeting with the same English (ahlan and marḥaba both mean "hello") is the
  // same greeting said another way, so its replies are right too: never offer them,
  // or those greetings, as wrong choices.
  const sameEnglish = new Set(pool.filter((p) => p.en === greeting.en).map((p) => p.setId));
  sameEnglish.add(greeting.setId);
  const rightReplies = new Set([...sameEnglish].map((id) => sets.get(id)?.reply).filter(Boolean));
  // Another reply ending in the same word ("naعm, ana mabsūṭa" beside
  // "ilḥamdilla mabsūṭa") may be just as right, so it is never offered as wrong.
  const lastWord = (ar) => ar.replace(/[?…]+$/u, '').trim().split(' ').pop();
  const usable = pool.filter((p) => !rightReplies.has(p.setId) && !sameEnglish.has(p.setId)
    && p.setId !== phrase.setId && lastWord(p.ar) !== lastWord(phrase.ar));
  const replyTargets = new Set([...sets.values()].map((s) => s.reply).filter(Boolean));
  // The reply's other forms are wrong only because of who is spoken to, or who speaks.
  const first = to || matched.length > 0 ? siblingsOf(phrase, pool).map((p) => p.ar) : [];
  let wrong = wrongOptions(first, usable.filter((p) => replyTargets.has(p.setId)).map((p) => p.ar), phrase.ar, 3, rng);
  if (wrong.length < 3) {
    const extra = usable.map((p) => p.ar).filter((t) => !wrong.includes(t));
    wrong = [...wrong, ...wrongOptions([], extra, phrase.ar, 3 - wrong.length, rng)];
  }

  const who = to ? ` a ${to} who ${to === 'group' ? 'say' : 'says'} this?` : ' this?';
  return finish({ type: 'reply', dir: 'en-ar', phraseId: phrase.id, greetingId: greeting.id,
    ask: [{ text: `How would you reply to${who}` }], prompt: greeting.ar }, phrase.ar, wrong, rng);
}

// One question about the phrase in the given direction, or null if the pool
// can't give it wrong choices. English → Arabic asks a reply as a reply.
export function makeQuestion(dir, phrase, pool, sets, rng = Math.random) {
  if (dir === 'ar-en') return meaning(phrase, pool, rng);
  return reply(phrase, pool, sets, rng) ?? say(phrase, pool, rng);
}

// The quiz: up to n questions about different phrases, each a random direction.
// Phrases missed in earlier quizzes come first, then those not yet remembered,
// then the rest. Then shuffled.
export function buildQuiz(pool, sets, n = 10, rng = Math.random, remembered = () => false, missed = () => false) {
  const ordered = [...shuffle(pool.filter((p) => missed(p.id)), rng),
    ...shuffle(pool.filter((p) => !missed(p.id) && !remembered(p.id)), rng),
    ...shuffle(pool.filter((p) => !missed(p.id) && remembered(p.id)), rng)];
  const questions = [];
  for (const phrase of ordered) {
    if (questions.length === n) break;
    for (const dir of shuffle(DIRS, rng)) {
      const q = makeQuestion(dir, phrase, pool, sets, rng);
      if (q) { questions.push(q); break; }
    }
  }
  return shuffle(questions, rng);
}

// Explanations, shown after answering.

// Which form a phrase is, and who it is for: "the form for speaking to a woman".
function formOf(phrase) {
  const { to, label, who, by } = describeForm(phrase.en);
  if (to) return `the form for speaking to a ${to}`;
  if (by) return `the ${label} form, said by a ${by}`;
  if (label) return `the ${label} form, used for a ${who}`;
  return null;
}

const means = (phrase) => `${phrase.ar} means ‘${englishAnswer(phrase.en)}’.`;

// Lines explaining the right answer, right or wrong, and what a wrong choice was instead.
export function explain(q, chosen, phrases) {
  const byId = (id) => phrases.find((p) => p.id === id);
  const phrase = byId(q.phraseId);
  if (!phrase) return [];
  const lines = [];
  const form = formOf(phrase);

  if (q.type === 'reply') {
    const greeting = byId(q.greetingId);
    if (greeting) lines.push(means(greeting));
    lines.push(means(phrase));   // its meaning already names who it is for
  } else {
    lines.push(form ? `${phrase.ar} is ${form}.` : means(phrase));
  }

  if (chosen !== q.answer) {
    const text = q.options[chosen];
    if (q.type === 'meaning') {
      const matches = phrases.filter((p) => englishAnswer(p.en) === text).map((p) => p.ar);
      if (matches.length > 0) lines.push(`You chose ‘${text}’, which is ${matches.join(' or ')}.`);
    } else {
      const other = phrases.find((p) => p.ar === text);
      if (other) {
        const otherForm = other.setId === phrase.setId ? formOf(other) : null;
        lines.push(otherForm ? `You chose ${text}, ${otherForm}.`
          : `You chose ${text}, which means ‘${englishAnswer(other.en)}’.`);
      }
    }
  }
  return lines;
}
