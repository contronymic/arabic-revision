import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeQuestion, buildQuiz } from '../js/quiz.js';
import { flatten } from '../js/lessons.js';
import { readJson, seededRng } from './helpers.js';

const f1 = readJson('test/fixtures/lessons/lesson-01.json');
const f2 = readJson('test/fixtures/lessons/lesson-02.json');
const { phrases, sets } = flatten([f1, f2]);
const byId = (id) => phrases.find((p) => p.id === id);

test('a meaning question never offers two right answers', () => {
  for (let seed = 1; seed <= 50; seed++) {
    const q = makeQuestion('meaning', byId('hi'), phrases, sets, seededRng(seed));
    assert.equal(q.prompt, 'zabi'); assert.equal(q.promptIsArabic, true);
    assert.equal(q.options[q.answer], 'hello'); assert.equal(q.options.filter(o => o === 'hello').length, 1);
    assert.equal(new Set(q.options).size, q.options.length); assert.ok(q.options.length >= 2 && q.options.length <= 4);
  }
});

test('a meaning question never shows the same wrong answer twice', () => {
  for (let seed = 1; seed <= 50; seed++) {
    const q = makeQuestion('meaning', byId('yes'), phrases, sets, seededRng(seed));
    assert.equal(new Set(q.options).size, q.options.length); assert.ok(q.options.filter(o => o === 'hello').length <= 1);
  }
});

test('an Arabic question shows the hint and leaves out the other "hello"', () => {
  for (let seed = 1; seed <= 50; seed++) {
    const q = makeQuestion('arabic', byId('hi'), phrases, sets, seededRng(seed));
    assert.equal(q.prompt, 'hello'); assert.equal(q.hint, '(not zubu)');
    assert.equal(q.options[q.answer], 'zabi'); assert.ok(!q.options.includes('zubu'));
  }
});

test('a reply question offers exactly one form of the right reply', () => {
  for (let seed = 1; seed <= 50; seed++) {
    const q = makeQuestion('reply', byId('hi'), phrases, sets, seededRng(seed)), replies = ['zabi bak', 'zabi bik'];
    assert.equal(q.options.filter(o => replies.includes(o)).length, 1); assert.ok(replies.includes(q.options[q.answer]));
    assert.ok(!q.options.includes('zabi'));
  }
  assert.equal(makeQuestion('reply', byId('yes'), phrases, sets, seededRng(1)), null);
  const partial = new Map(sets); partial.delete('hi-back');   // the reply's lesson didn't load
  assert.equal(makeQuestion('reply', byId('hi'), phrases, partial, seededRng(1)), null);
});

test("a form question offers the set's own forms", () => {
  const q = makeQuestion('form', byId('glada'), phrases, sets, seededRng(1));
  assert.equal(q.prompt, 'glad (f)'); assert.equal(q.options[q.answer], 'fāriza');
  assert.deepEqual([...q.options].sort(), ['fāriz', 'fāriza', 'fārizīn']);
  assert.equal(makeQuestion('form', byId('yes'), phrases, sets, seededRng(1)), null);
});

test('a pool of one gives no meaning question', () => {
  const one = flatten([{ id: 'lesson-01', title: 'x', sets: [f1.sets[4]] }]);
  assert.equal(makeQuestion('meaning', one.phrases[0], one.phrases, one.sets, seededRng(1)), null);
});

test('buildQuiz gives ten questions about ten different phrases', () => {
  const qs = buildQuiz(phrases, sets, 10, seededRng(3));
  assert.equal(qs.length, 10); assert.equal(new Set(qs.map(q => q.phraseId)).size, 10);
  for (const q of qs) assert.ok(q.answer >= 0 && q.answer < q.options.length);
});

test('buildQuiz on a tiny pool returns what it can and stops', () => {
  const two = flatten([f2]); two.phrases.pop();
  assert.ok(buildQuiz(two.phrases, two.sets, 10, seededRng(1)).length <= 2);
});
