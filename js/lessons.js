// Lessons: loading them on the phone, and flattening them into phrases and sets.
// Content rules (letters, spelling, links) are checked by the tests before
// publishing; here we only refuse a lesson whose shape would break the app.

const isString = (v) => typeof v === 'string';
const isOptionalString = (v) => v === undefined || isString(v);

export function isUsableLesson(lesson) {
  return Boolean(lesson) && isString(lesson.id) && isString(lesson.title) && isOptionalString(lesson.summary)
    && Array.isArray(lesson.sets) && lesson.sets.length > 0
    && lesson.sets.every((set) => Boolean(set) && isString(set.id)
      && isOptionalString(set.reply) && isOptionalString(set.note)
      && Array.isArray(set.forms) && set.forms.length > 0
      && set.forms.every((form) => Boolean(form) && isString(form.id)
        && isString(form.ar) && isString(form.en) && isOptionalString(form.hint)));
}

export function flatten(lessons) {
  const phrases = [];
  const sets = new Map();
  for (const lesson of lessons) {
    for (const set of lesson.sets) {
      const info = { id: set.id, lessonId: lesson.id, phraseIds: set.forms.map((f) => f.id) };
      if (set.reply !== undefined) info.reply = set.reply;
      if (set.note !== undefined) info.note = set.note;
      sets.set(set.id, info);
      for (const form of set.forms) {
        const phrase = { id: form.id, ar: form.ar, en: form.en };
        if (form.hint !== undefined) phrase.hint = form.hint;
        phrase.setId = set.id;
        phrase.lessonId = lesson.id;
        phrases.push(phrase);
      }
    }
  }
  return { phrases, sets };
}

async function fetchJson(fetchFn, url) {
  const response = await fetchFn(url);
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.json();
}

// Loads the lesson list and every lesson in it, keeping whatever it can get.
export async function loadLessons(fetchFn, base = 'lessons/') {
  let index;
  try {
    index = await fetchJson(fetchFn, base + 'index.json');
    if (!Array.isArray(index?.lessons)) throw new Error('no lesson list');
  } catch {
    return { lessons: [], problems: ['Could not read the list of lessons.'] };
  }

  const results = await Promise.all(index.lessons.map(async (entry) => {
    const name = isString(entry?.id) ? entry.id : 'a lesson';
    if (!isString(entry?.file)) return { problem: `The list of lessons has a bad entry for ${name}.` };
    try {
      const lesson = await fetchJson(fetchFn, base + entry.file);
      if (!isUsableLesson(lesson)) return { problem: `${name} is not in the expected shape.` };
      return { lesson };
    } catch {
      return { problem: `Could not load ${name}.` };
    }
  }));

  return {
    lessons: results.filter((r) => r.lesson).map((r) => r.lesson),
    problems: results.filter((r) => r.problem).map((r) => r.problem),
  };
}

// Forms. A phrase's English may end in a label saying which form it is:
// "(to a man)", "(to a woman)" or "(to a group)" for who is spoken to, and
// "(said by a …)" or "(m)", "(f)", "(pl)" for the grammatical form.
const TO = /^(.+?)\s*\(to a (man|woman|group)\)$/u;
const GRAMMAR = /^(.+?)\s*\((?:said by a (man|woman|group)|(m|f|pl))\)$/u;
// The one table of forms: who each is for, its name, and its short label.
const LABEL = { man: 'masculine', woman: 'feminine', group: 'plural' };
const SHORT = { m: 'man', f: 'woman', pl: 'group' };

// { base } for a phrase with one form; plus { to } for who is spoken to, or
// { label, who } for the grammatical form and who it is for, with { by } when
// the English names who says it.
export function describeForm(en) {
  let m = en.match(TO);
  if (m) return { base: m[1], to: m[2] };
  m = en.match(GRAMMAR);
  if (m) {
    const who = m[2] ?? SHORT[m[3]];
    return { base: m[1], label: LABEL[who], who, ...(m[2] ? { by: m[2] } : {}) };
  }
  return { base: en };
}

const join = (base, words) => `${base}${/[?…]$/u.test(base) ? ' ' : ', '}${words}`;

// The English as an answer choice: "please, offering something, to a woman",
// "how are you? to a man", "sorry, said by a man", "busy (feminine)".
export function englishAnswer(en) {
  const { base, to, label, by } = describeForm(en);
  if (to) return join(base, `to a ${to}`);
  if (by) return join(base, `said by a ${by}`);
  if (label) return `${base} (${label})`;
  return en;
}
