import { test } from 'node:test';
import assert from 'node:assert/strict';
import { STORAGE_KEY, emptyState, createStore } from '../js/store.js';
import { memoryStorage, throwingStorage } from './helpers.js';

test('saves and loads under its own name only', () => {
  const s = memoryStorage(), store = createStore(s), state = emptyState();
  state.rightDays.yes = ['2026-11-14'];
  assert.equal(store.save(state), true);
  assert.deepEqual(s.keys(), ['arabic-revision:v1']);
  assert.deepEqual(createStore(s).load(), state);
});

test('starts fresh when nothing is saved, or the saved value is junk', () => {
  for (const raw of [null, '{not json', '{"v":99}', '"text"', 'null', '[]']) {
    const s = memoryStorage(); if (raw !== null) s.setItem(STORAGE_KEY, raw);
    assert.deepEqual(createStore(s).load(), emptyState(), String(raw));
  }
});

test('fills in missing parts and keeps what is there', () => {
  const s = memoryStorage();
  s.setItem(STORAGE_KEY, '{"v":1,"cards":{"yes|en-ar":{"box":1,"due":"2026-11-15","seen":"2026-11-14"}},"rightDays":"bad"}');
  const st = createStore(s).load();
  assert.equal(st.cards['yes|en-ar'].box, 1); assert.deepEqual(st.rightDays, {}); assert.deepEqual(st.prefs, emptyState().prefs);
});

test('never throws when storage throws or is missing', () => {
  for (const s of [throwingStorage(), null]) {
    const store = createStore(s);
    assert.deepEqual(store.load(), emptyState()); assert.equal(store.save(emptyState()), false);
  }
});

test('drops saved values of the wrong kind', () => {
  const s = memoryStorage();
  s.setItem(STORAGE_KEY, JSON.stringify({ v: 1,
    cards: { 'a|en-ar': { box: 'x', due: '2026-11-15', seen: '2026-11-14' }, 'b|en-ar': { box: 2, due: '2026-11-18', seen: '2026-11-15' } },
    rightDays: { x: 'bad', y: ['2026-11-14', '2026-11-14', '2026-11-15', '2026-11-16'], z: [3] } }));
  const st = createStore(s).load();
  assert.deepEqual(Object.keys(st.cards), ['b|en-ar']);
  assert.deepEqual(st.rightDays, { y: ['2026-11-14', '2026-11-15'] });
});

test('says whether progress can be saved, leaving no probe behind', () => {
  const s = memoryStorage();
  assert.equal(createStore(s).available, true); assert.deepEqual(s.keys(), []);
  assert.equal(createStore(throwingStorage()).available, false); assert.equal(createStore(null).available, false);
});
