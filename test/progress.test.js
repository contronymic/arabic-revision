import { test } from 'node:test';
import assert from 'node:assert/strict';
import { recordMark, recordQuizAnswer, isRemembered, percent, stats } from '../js/progress.js';
import { emptyState } from '../js/store.js';
import { readJson } from './helpers.js';

const f1 = readJson('test/fixtures/lessons/lesson-01.json');
const f2 = readJson('test/fixtures/lessons/lesson-02.json');
const quiz = (s, phraseId, right, today) => recordQuizAnswer(s, { phraseId, right, today });

test('two right quiz answers on one day are one day; on two days, remembered', () => {
  const s = emptyState();
  quiz(s, 'yes', true, '2026-11-14'); quiz(s, 'yes', true, '2026-11-14');
  assert.equal(isRemembered(s, 'yes'), false);
  quiz(s, 'yes', true, '2026-11-15');
  assert.equal(isRemembered(s, 'yes'), true); assert.deepEqual(s.rightDays.yes, ['2026-11-14', '2026-11-15']);
});

test('card marks move the schedule and never count towards remembered', () => {
  const s = emptyState();
  for (const dir of ['en-ar', 'ar-en']) {
    recordMark(s, { phraseId: 'yes', dir, right: true, today: '2026-11-14' });
    recordMark(s, { phraseId: 'yes', dir, right: true, today: '2026-11-15' });
  }
  assert.equal(isRemembered(s, 'yes'), false); assert.equal(s.cards['yes|ar-en'].box, 2); assert.equal(s.cards['yes|en-ar'].box, 2);
});

test('a wrong quiz answer after remembering does not undo it; a wrong card mark resets the card', () => {
  const s = emptyState(); quiz(s, 'yes', true, '2026-11-14'); quiz(s, 'yes', true, '2026-11-15'); quiz(s, 'yes', false, '2026-11-16');
  assert.equal(isRemembered(s, 'yes'), true);
  recordMark(s, { phraseId: 'yes', dir: 'en-ar', right: true, today: '2026-11-14' });
  recordMark(s, { phraseId: 'yes', dir: 'en-ar', right: false, today: '2026-11-16' });
  assert.equal(s.cards['yes|en-ar'].box, 0);
});

test('percent rounds down', () => {
  assert.equal(percent(9, 10), 90); assert.equal(percent(26, 29), 89); assert.equal(percent(29, 29), 100); assert.equal(percent(0, 0), 0);
});

test('figures per lesson and overall', () => {
  const s = emptyState();
  for (const id of ['hi', 'hi2', 'hi-back-m', 'hi-back-f', 'glad', 'glada', 'gladin', 'yes', 'thanks'])
    s.rightDays[id] = ['2026-11-14', '2026-11-15'];
  assert.deepEqual(stats(s, [f1, f2]), {
    lessons: [ { id: 'lesson-01', title: 'Fixture 1', remembered: 9, total: 10, percent: 90 },
               { id: 'lesson-02', title: 'Fixture 2', remembered: 0, total: 3, percent: 0 } ],
    overall: { remembered: 9, total: 13, percent: 69 } });
});

test('progress for phrases no longer in any lesson is ignored', () => {
  const s = emptyState(); s.rightDays.gone = ['2026-11-01', '2026-11-02']; s.rightDays.big = ['2026-11-01', '2026-11-02'];
  assert.deepEqual(stats(s, [f2]).overall, { remembered: 1, total: 3, percent: 33 });
});
