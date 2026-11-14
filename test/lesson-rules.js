// The content rules every lesson must pass before it is published.
// They run on the computer only, never on the phone, so allowing a new letter
// for a later lesson changes this file, not the site.

// The course's letters: a–z, ā ē ī ū ḥ ṭ ş ḍ ġ š, ع, space, "?", "…" and "-".
export const ALLOWED_AR =
  /^[a-zāēīūḥṭşḍġšع ?…-]+$/u;

const ID = /^[a-z0-9-]+$/;
const LESSON_ID = /^lesson-\d{2}$/;
const HINT = /^\(.+\)$/u;
const ARABIC_SCRIPT = /[؀-ۿݐ-ݿࢠ-ࣿﭐ-﷿ﹰ-﻿]/u;
const LINK = /http|:\/\//i;

// Every string in a value, with a readable path to it.
function* strings(value, path) {
  if (typeof value === 'string') yield [path, value];
  else if (Array.isArray(value)) for (const [i, v] of value.entries()) yield* strings(v, `${path}[${i}]`);
  else if (value && typeof value === 'object') for (const [k, v] of Object.entries(value)) yield* strings(v, `${path}.${k}`);
}

export function validateLessons(lessons) {
  const problems = [];
  const setIds = new Set(), formIds = new Set(), arabic = new Set(), fronts = new Set();
  const knownSets = new Set(lessons.flatMap(l => (Array.isArray(l?.sets) ? l.sets : []).map(s => s?.id)));

  for (const lesson of lessons) {
    const where = typeof lesson?.id === 'string' ? lesson.id : '(a lesson)';
    if (!LESSON_ID.test(lesson?.id ?? '')) problems.push(`Lesson id "${lesson?.id}" should look like lesson-01.`);
    if (typeof lesson?.title !== 'string' || !lesson.title.trim()) problems.push(`${where}: the title is empty.`);
    if (!Array.isArray(lesson?.sets) || lesson.sets.length === 0) {
      problems.push(`${where}: it has no sets.`);
      continue;
    }

    for (const set of lesson.sets) {
      if (!ID.test(set?.id ?? '')) problems.push(`${where}: set id "${set?.id}" should use a–z, 0–9 and hyphens only.`);
      if (setIds.has(set?.id)) problems.push(`${where}: set id "${set.id}" is used twice.`);
      setIds.add(set?.id);
      if (set?.reply !== undefined && !knownSets.has(set.reply)) problems.push(`${where}: set "${set.id}" replies to "${set.reply}", which is not a set.`);
      if (!Array.isArray(set?.forms) || set.forms.length === 0) {
        problems.push(`${where}: set "${set?.id}" has no forms.`);
        continue;
      }

      for (const form of set.forms) {
        if (!ID.test(form?.id ?? '')) problems.push(`${where}: form id "${form?.id}" should use a–z, 0–9 and hyphens only.`);
        if (formIds.has(form?.id)) problems.push(`${where}: form id "${form.id}" is used twice.`);
        formIds.add(form?.id);

        if (typeof form?.ar !== 'string' || !ALLOWED_AR.test(form.ar)) problems.push(`${where}: "${form?.ar}" (${form?.id}) uses letters outside the course's.`);
        if (arabic.has(form?.ar)) problems.push(`${where}: the Arabic "${form.ar}" appears twice.`);
        arabic.add(form?.ar);

        if (typeof form?.en !== 'string' || !form.en.trim()) problems.push(`${where}: form "${form?.id}" has no English.`);
        if (form?.hint !== undefined && !(typeof form.hint === 'string' && HINT.test(form.hint))) {
          problems.push(`${where}: the hint "${form.hint}" (${form.id}) should be in brackets.`);
        }
        const front = `${form?.en}\u0000${form?.hint ?? ''}`;
        if (fronts.has(front)) problems.push(`${where}: two cards would show the same English, "${form.en}"${form.hint ? ` ${form.hint}` : ''}.`);
        fronts.add(front);
      }
    }

    for (const [path, text] of strings(lesson, where)) {
      if (text !== text.normalize('NFC')) problems.push(`${path}: "${text}" is not in NFC form.`);
      if (LINK.test(text)) problems.push(`${path}: "${text}" contains a link.`);
      if (ARABIC_SCRIPT.test(text.replaceAll('ع', ''))) problems.push(`${path}: "${text}" contains Arabic script other than ع.`);
    }
  }
  return problems;
}
