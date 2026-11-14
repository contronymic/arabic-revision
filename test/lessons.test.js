import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { validateLessons } from './lesson-rules.js';
import { flatten, loadLessons } from '../js/lessons.js';
import { readJson, fakeFetch } from './helpers.js';

const clone = structuredClone;
const f1 = readJson('test/fixtures/lessons/lesson-01.json');
const f2 = readJson('test/fixtures/lessons/lesson-02.json');

let files;
beforeEach(() => {
  files = {
    'lessons/index.json': readJson('test/fixtures/lessons/index.json'),
    'lessons/lesson-01.json': clone(f1),
    'lessons/lesson-02.json': clone(f2),
  };
});

test('the fixture lessons pass every check', () => assert.deepEqual(validateLessons([f1, f2]), []));

test('two phrases with the same English and no hint are rejected', () => {
  const bad = clone(f1); delete bad.sets[0].forms[0].hint; delete bad.sets[1].forms[0].hint;
  assert.ok(validateLessons([bad]).some(p => p.includes('hello')));
});

test('a same-English pair where only one has a hint is rejected', () => {
  const bad = clone(f1); delete bad.sets[1].forms[0].hint;   // "hello" bare, beside "hello (not zubu)"
  assert.ok(validateLessons([bad]).some(p => p.includes('hello')));
});

test('a hint without brackets is rejected', () => {
  const bad = clone(f1); bad.sets[0].forms[0].hint = 'not zubu';
  assert.ok(validateLessons([bad]).some(p => p.includes('not zubu')));
});

test('Arabic outside the course letters is rejected', () => {
  // 'ṣ' is s with a dot below (U+1E63): the course writes ş (U+015F) instead.
  for (const ar of ['Ayzu', 'ṣayzu', 'aHzu', 'ayzu!', 'صyzu']) {
    const bad = clone(f1); bad.sets[4].forms[0].ar = ar;
    assert.ok(validateLessons([bad]).some(p => p.includes(ar)), ar);
  }
});

test('text not in NFC is rejected', () => {   // é written as e + combining accent, in a field with no letter check
  const bad = clone(f1); bad.sets[3].note = 'Café note.';
  assert.ok(validateLessons([bad]).some(p => p.includes('Cafe')));
});

test('Arabic script other than ع, and links, are rejected in any field', () => {
  const a = clone(f1); a.sets[4].forms[0].en = 'yes نعم';
  const b = clone(f1); b.sets[3].note = 'see https://example.com';
  assert.ok(validateLessons([a]).some(p => p.includes('yes')));
  assert.ok(validateLessons([b]).length > 0);
});

test('duplicate ids, duplicate Arabic and dangling replies are rejected', () => {
  const dupId = clone(f2); dupId.sets[0].forms[0].id = 'yes';
  const dupAr = clone(f2); dupAr.sets[0].forms[0].ar = 'zabi';
  const dangling = clone(f1); dangling.sets[0].reply = 'nope';
  assert.ok(validateLessons([f1, dupId]).some(p => p.includes('yes')));
  assert.ok(validateLessons([f1, dupAr]).some(p => p.includes('zabi')));
  assert.ok(validateLessons([dangling]).some(p => p.includes('nope')));
});

test('flatten lists phrases in lesson order with their set and lesson', () => {
  const { phrases, sets } = flatten([f1, f2]);
  assert.equal(phrases.length, 13);
  assert.deepEqual(phrases[0], { id: 'hi', ar: 'zabi', en: 'hello', hint: '(not zubu)', setId: 'hi', lessonId: 'lesson-01' });
  assert.deepEqual(phrases[12], { id: 'day', ar: 'yawzi', en: 'day', setId: 'day', lessonId: 'lesson-02' });
  assert.deepEqual(sets.get('glad'), { id: 'glad', lessonId: 'lesson-01', phraseIds: ['glad', 'glada', 'gladin'], note: 'A note.' });
  assert.equal(sets.get('hi').reply, 'hi-back');
});

test('loadLessons loads every lesson in the index', async () => {
  const r = await loadLessons(fakeFetch(files));
  assert.deepEqual(r.lessons.map(l => l.id), ['lesson-01', 'lesson-02']); assert.deepEqual(r.problems, []);
});

test('loadLessons keeps what it has when a lesson is missing offline', async () => {
  delete files['lessons/lesson-02.json'];
  const r = await loadLessons(fakeFetch(files));
  assert.deepEqual(r.lessons.map(l => l.id), ['lesson-01']); assert.equal(r.problems.length, 1);
});

test('loadLessons skips a lesson that is not JSON or has a broken shape', async () => {
  for (const bad of ['oops', { id: 'lesson-02', title: 'x' }]) {
    files['lessons/lesson-02.json'] = bad;
    const r = await loadLessons(fakeFetch(files));
    assert.deepEqual(r.lessons.map(l => l.id), ['lesson-01'], String(bad)); assert.equal(r.problems.length, 1);
  }
});

test('loadLessons does not judge letters, or links between lessons', async () => {
  const odd = clone(f2); odd.sets[0].forms[0].ar = 'Big'; odd.sets[0].reply = 'hi';   // 'hi' is a set in lesson-01
  files['lessons/lesson-02.json'] = odd;
  assert.deepEqual((await loadLessons(fakeFetch(files))).lessons.map(l => l.id), ['lesson-01', 'lesson-02']);
});

test('loadLessons returns nothing and one problem when the index cannot be read', async () => {
  const r = await loadLessons(fakeFetch({})); assert.deepEqual(r.lessons, []); assert.equal(r.problems.length, 1);
});
