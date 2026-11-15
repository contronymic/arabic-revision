import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeQuestion, buildQuiz } from '../js/quiz.js';
import { flatten } from '../js/lessons.js';
import { readJson, seededRng } from './helpers.js';

const f1 = readJson('test/fixtures/lessons/lesson-01.json');
const f2 = readJson('test/fixtures/lessons/lesson-02.json');
const { phrases, sets } = flatten([f1, f2]);
const byId = (id) => phrases.find((p) => p.id === id);
const askText = (q) => q.ask.map((p) => p.text).join('');

test('a meaning question shows the Arabic and never offers two right answers', () => {
  for (let seed = 1; seed <= 50; seed++) {
    const q = makeQuestion('ar-en', byId('hi'), phrases, sets, seededRng(seed));
    assert.equal(q.type, 'meaning'); assert.equal(askText(q), 'What does this mean?'); assert.equal(q.prompt, 'zabi');
    assert.equal(q.options[q.answer], 'hello'); assert.equal(q.options.filter(o => o === 'hello').length, 1);
    assert.equal(new Set(q.options).size, q.options.length); assert.ok(q.options.length >= 2 && q.options.length <= 4);
  }
});

test("a meaning question's answers name the form, and offer the set's other forms", () => {
  const q = makeQuestion('ar-en', byId('hi-back-f'), phrases, sets, seededRng(1));
  assert.equal(q.options[q.answer], 'hi back, to a woman'); assert.ok(q.options.includes('hi back, to a man'));
  const g = makeQuestion('ar-en', byId('glada'), phrases, sets, seededRng(1));
  assert.equal(g.options[g.answer], 'glad (feminine)');
  assert.ok(g.options.includes('glad (masculine)') && g.options.includes('glad (plural)'));
});

test('a "how do you say" question shows the hint and leaves out the other "hello"', () => {
  for (let seed = 1; seed <= 50; seed++) {
    const q = makeQuestion('en-ar', byId('hi2'), phrases, sets, seededRng(seed));
    assert.equal(q.type, 'say'); assert.equal(askText(q), 'How do you say ‘hello’?'); assert.equal(q.hint, '(not zabi)');
    assert.equal(q.prompt, undefined); assert.equal(q.options[q.answer], 'zubu'); assert.ok(!q.options.includes('zabi'));
  }
});

test("a form is asked by its label, with the set's own forms as choices", () => {
  const q = makeQuestion('en-ar', byId('glada'), phrases, sets, seededRng(1));
  assert.equal(askText(q), 'How do you say ‘glad’ (feminine)?'); assert.equal(q.options[q.answer], 'fāriza');
  assert.ok(q.options.includes('fāriz') && q.options.includes('fārizīn'));
});

test('a form named by who says it is asked that way, and its answer keeps the wording', () => {
  const lesson = { id: 'lesson-01', title: 'x', sets: [
    { id: 'sorry', forms: [ { id: 'sorry-m', ar: 'asif', en: 'sorry (said by a man)' },
      { id: 'sorry-f', ar: 'asifa', en: 'sorry (said by a woman)' } ] },
    { id: 'yes', forms: [ { id: 'yes', ar: 'ayzu', en: 'yes' } ] } ] };
  const { phrases: ps, sets: ss } = flatten([lesson]);
  const say = makeQuestion('en-ar', ps.find((p) => p.id === 'sorry-m'), ps, ss, seededRng(1));
  assert.equal(askText(say), 'How does a man say ‘sorry’?'); assert.equal(say.options[say.answer], 'asif');
  const mean = makeQuestion('ar-en', ps.find((p) => p.id === 'sorry-f'), ps, ss, seededRng(1));
  assert.equal(mean.options[mean.answer], 'sorry, said by a woman'); assert.ok(mean.options.includes('sorry, said by a man'));
});

test('a reply is asked as a reply, naming who spoke for a reply with forms', () => {
  for (let seed = 1; seed <= 50; seed++) {
    const q = makeQuestion('en-ar', byId('hi-back-f'), phrases, sets, seededRng(seed));
    assert.equal(q.type, 'reply'); assert.equal(askText(q), 'How would you reply to a woman who says this?');
    assert.equal(q.prompt, 'zabi'); assert.equal(q.options[q.answer], 'zabi bik'); assert.ok(q.options.includes('zabi bak'));
    assert.ok(!q.options.includes('zabi'));
  }
  const w = makeQuestion('en-ar', byId('welcome'), phrases, sets, seededRng(1));
  assert.equal(askText(w), 'How would you reply to this?'); assert.equal(w.prompt, 'šukzi'); assert.equal(w.options[w.answer], 'عazwa');
});

test("a reply whose greeting isn't in the pool is asked as \"how do you say\"", () => {
  const pool = phrases.filter((p) => p.id !== 'thanks');
  assert.equal(makeQuestion('en-ar', byId('welcome'), pool, sets, seededRng(1)).type, 'say');
});

test('a reply question never offers the replies of a same-English greeting as wrong', () => {
  const g = structuredClone(f1); g.sets[1].reply = 'welcome';   // zubu ("hello") now answers with عazwa too
  const { phrases: ps, sets: ss } = flatten([g, f2]);
  for (let seed = 1; seed <= 50; seed++) {
    const q = makeQuestion('en-ar', ps.find((p) => p.id === 'welcome'), ps, ss, seededRng(seed));
    if (q.prompt !== 'zabi' && q.prompt !== 'zubu') continue;
    assert.ok(!q.options.includes('zabi bak') && !q.options.includes('zabi bik'), q.options.join(' / '));
  }
});

test('a pool of one gives no question', () => {
  const one = flatten([{ id: 'lesson-01', title: 'x', sets: [f1.sets[4]] }]);
  assert.equal(makeQuestion('ar-en', one.phrases[0], one.phrases, one.sets, seededRng(1)), null);
  assert.equal(makeQuestion('en-ar', one.phrases[0], one.phrases, one.sets, seededRng(1)), null);
});

test('buildQuiz gives ten questions about ten different phrases, in both directions', () => {
  const dirs = new Set();
  for (let seed = 1; seed <= 10; seed++) {
    const qs = buildQuiz(phrases, sets, 10, seededRng(seed));
    assert.equal(qs.length, 10); assert.equal(new Set(qs.map(q => q.phraseId)).size, 10);
    for (const q of qs) { assert.ok(q.answer >= 0 && q.answer < q.options.length); dirs.add(q.dir); }
  }
  assert.deepEqual([...dirs].sort(), ['ar-en', 'en-ar']);
});

test('buildQuiz on a tiny pool returns what it can and stops', () => {
  const two = flatten([f2]); two.phrases.pop();
  assert.ok(buildQuiz(two.phrases, two.sets, 10, seededRng(1)).length <= 2);
});

test('after a reply, both phrases are explained, and a wrong choice', async () => {
  const { explain } = await import('../js/quiz.js');
  const q = makeQuestion('en-ar', byId('hi-back-f'), phrases, sets, seededRng(1));
  const wrong = q.options.indexOf('zabi bak');
  assert.deepEqual(explain(q, wrong, phrases), [
    'zabi means ‘hello’.', 'zabi bik means ‘hi back, to a woman’.',
    'You chose zabi bak, the form for speaking to a man.']);
  assert.equal(explain(q, q.answer, phrases).length, 2);
});

test('after other questions, the form is explained, and what a wrong choice was', async () => {
  const { explain } = await import('../js/quiz.js');
  const say = makeQuestion('en-ar', byId('glada'), phrases, sets, seededRng(1));
  assert.deepEqual(explain(say, say.answer, phrases), ['fāriza is the feminine form, used for a woman.']);
  const yes = makeQuestion('en-ar', byId('yes'), phrases, sets, seededRng(1));
  const other = yes.options.findIndex((o, i) => i !== yes.answer);
  const p = phrases.find((x) => x.ar === yes.options[other]);
  assert.deepEqual(explain(yes, yes.answer, phrases), ['ayzu means ‘yes’.']);
  assert.ok(explain(yes, other, phrases)[1].startsWith(`You chose ${p.ar}, which means`));
  const m = makeQuestion('ar-en', byId('yes'), phrases, sets, seededRng(2));
  const mOther = m.options.findIndex((o, i) => i !== m.answer);
  assert.match(explain(m, mOther, phrases)[1], /^You chose ‘.+’, which is .+\.$/u);
});

test('a reply about yourself is asked with the greeting in the matching form', () => {
  const lesson = { id: 'lesson-01', title: 'x', sets: [
    { id: 'how', reply: 'fine', forms: [ { id: 'how-m', ar: 'kayfu', en: 'how are you? (to a man)' },
      { id: 'how-f', ar: 'kayfi', en: 'how are you? (to a woman)' } ] },
    { id: 'fine', forms: [ { id: 'fine-m', ar: 'zayn', en: 'fine (m)' }, { id: 'fine-f', ar: 'zayna', en: 'fine (f)' } ] },
    { id: 'yes', forms: [ { id: 'yes', ar: 'ayzu', en: 'yes' } ] } ] };
  const { phrases: ps, sets: ss } = flatten([lesson]);
  for (let seed = 1; seed <= 30; seed++) {
    const q = makeQuestion('en-ar', ps.find((p) => p.id === 'fine-f'), ps, ss, seededRng(seed));
    assert.equal(q.type, 'reply'); assert.equal(q.prompt, 'kayfi'); assert.equal(q.options[q.answer], 'zayna');
    assert.ok(q.options.includes('zayn'));
  }
});

test('a reply never offers another reply ending in the same word as wrong', () => {
  const lesson = { id: 'lesson-01', title: 'x', sets: [
    { id: 'q', reply: 'a', forms: [ { id: 'q', ar: 'inti zayna?', en: 'are you fine? (to a woman)' } ] },
    { id: 'a', forms: [ { id: 'a', ar: 'ayzu, ana zayna', en: 'yes, I am fine (said by a woman)' } ] },
    { id: 'h', reply: 'b', forms: [ { id: 'h', ar: 'kayfi?', en: 'how are you? (to a woman)' } ] },
    { id: 'b', forms: [ { id: 'b', ar: 'hamdu zayna', en: 'fine, thanks (said by a woman)' } ] },
    { id: 'n', forms: [ { id: 'n', ar: 'lā', en: 'no' } ] } ] };
  const { phrases: ps, sets: ss } = flatten([lesson]);
  for (let seed = 1; seed <= 30; seed++) {
    const q = makeQuestion('en-ar', ps.find((p) => p.id === 'a'), ps, ss, seededRng(seed));
    assert.ok(!q.options.includes('hamdu zayna'), q.options.join(' / '));
  }
});
