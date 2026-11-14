import { test } from 'node:test';
import assert from 'node:assert/strict';
import { markCard, pickCards, cardKey } from '../js/schedule.js';
import { shuffle } from '../js/random.js';
import { addDays } from '../js/dates.js';
import { seededRng } from './helpers.js';

test('right moves a card up one box; wrong sends it back to box 0, due today', () => {
  assert.deepEqual(markCard(undefined, true, '2026-11-14'), { box: 1, due: '2026-11-15', seen: '2026-11-14' });
  assert.deepEqual(markCard({ box: 1, due: '2026-11-15', seen: '2026-11-14' }, true, '2026-11-15'), { box: 2, due: '2026-11-18', seen: '2026-11-15' });
  assert.deepEqual(markCard({ box: 4, due: '2026-12-01', seen: '2026-11-17' }, true, '2026-12-01'), { box: 4, due: '2026-12-15', seen: '2026-12-01' });
  assert.deepEqual(markCard({ box: 3, due: '2026-11-20', seen: '2026-11-13' }, false, '2026-11-20'), { box: 0, due: '2026-11-20', seen: '2026-11-20' });
});

test('due cards come first, then new ones, never cards not yet due when there are enough', () => {
  const ids = Array.from({ length: 30 }, (_, i) => `p${i}`), k = id => cardKey(id, 'en-ar');
  const cards = { [k('p5')]: { box: 0, due: '2026-11-20', seen: '2026-11-20' },
                  [k('p6')]: { box: 0, due: '2026-11-18', seen: '2026-11-18' },
                  [k('p7')]: { box: 2, due: '2026-11-19', seen: '2026-11-16' } };
  for (const id of ids.slice(8, 18)) cards[k(id)] = { box: 2, due: '2026-11-25', seen: '2026-11-19' };
  const picked = pickCards(ids, 'en-ar', cards, '2026-11-20', 10, seededRng(1));
  assert.deepEqual(new Set(picked), new Set(['p5', 'p6', 'p7', 'p0', 'p1', 'p2', 'p3', 'p4', 'p18', 'p19']));
});

test('with nothing due or new, the cards due soonest are used', () => {
  const ids = Array.from({ length: 12 }, (_, i) => `p${i}`);
  const cards = Object.fromEntries(ids.map((id, i) =>
    [cardKey(id, 'en-ar'), { box: 3, due: addDays('2026-11-21', i), seen: '2026-11-14' }]));
  const picked = pickCards(ids, 'en-ar', cards, '2026-11-20', 10, seededRng(1));
  assert.deepEqual(new Set(picked), new Set(ids.slice(0, 10)));
});

test('a card marked wrong comes back before one marked right', () => {
  const cards = { 'a|en-ar': markCard(undefined, false, '2026-11-20'), 'b|en-ar': markCard(undefined, true, '2026-11-20') };
  assert.deepEqual(pickCards(['a', 'b'], 'en-ar', cards, '2026-11-20', 1, seededRng(1)), ['a']);
  assert.deepEqual(pickCards(['b', 'a', 'c'], 'en-ar', cards, '2026-11-21', 1, seededRng(1)), ['a']);
});

test('the two directions are scheduled separately', () => {
  const cards = { 'a|ar-en': { box: 0, due: '2026-11-20', seen: '2026-11-20' }, 'b|en-ar': { box: 0, due: '2026-11-20', seen: '2026-11-20' } };
  assert.deepEqual(pickCards(['a', 'b'], 'en-ar', cards, '2026-11-20', 1, seededRng(1)), ['b']);
});

test('a small pool gives a short round with no repeats', () => {
  const picked = pickCards(['a', 'b', 'c'], 'en-ar', {}, '2026-11-20', 10, seededRng(1));
  assert.equal(picked.length, 3); assert.deepEqual(new Set(picked), new Set(['a', 'b', 'c']));
});

test('shuffle keeps every item once, leaves its input alone, and repeats with the same seed', () => {
  const items = Array.from({ length: 20 }, (_, i) => i), copy = [...items];
  const a = shuffle(items, seededRng(5));
  assert.deepEqual([...a].sort((x, y) => x - y), items);
  assert.deepEqual(items, copy);
  assert.deepEqual(shuffle(items, seededRng(5)), a);
});
