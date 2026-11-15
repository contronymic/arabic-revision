import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fakeDocument, findAll } from './helpers.js';

globalThis.document = fakeDocument();
const { render } = await import('../js/ui.js');
const noActions = new Proxy({}, { get: () => () => {} });
const stats = { lessons: [{ id: 'lesson-01', title: 'Lesson 1', remembered: 3, total: 69, percent: 4 }],
  overall: { remembered: 3, total: 69, percent: 4 } };

test('home has the flag, the headings and the three rounds in order', () => {
  const root = document.createElement('main');
  render(root, { screen: 'home', scopes: [{ id: 'all', label: 'All lessons so far' }, { id: 'lesson-01', label: 'Lesson 1' }],
    scope: 'all', stats, installNote: false, saveFailed: false, problems: [] }, noActions);
  assert.equal(findAll(root, (n) => n.className === 'flag')[0].getAttribute('role'), 'img');
  const headings = findAll(root, (n) => /^h[1-3]$/.test(n.tagName)).map((n) => `${n.tagName} ${n.textContent}`);
  assert.deepEqual(headings, ['h1 Palestinian Arabic Revision', 'h2 Progress:',
    'h3 Lesson 1: 3 of 69 phrases remembered · 4%', 'h2 What do you want to work on?']);
  const modes = findAll(root, (n) => /^mode\b/.test(n.className)).map((n) => n.textContent);
  assert.deepEqual(modes, ['English → Arabic', 'Arabic → English', 'QuizCounts towards progress']);
});

test('a question reads out its whole wording, the English phrase included', () => {
  const root = document.createElement('main');
  render(root, { screen: 'question', kind: 'cards', position: 1, total: 10, chosen: null, saveFailed: false,
    question: { type: 'say', dir: 'en-ar', phraseId: 'x', ask: [{ text: 'How do you say ' }, { text: '‘please’', strong: true }, { text: ' to a woman?' }],
      options: ['a', 'b'], answer: 0 } }, noActions);
  const [card] = findAll(root, (n) => n.className === 'card');
  assert.equal(card.textContent, 'How do you say ‘please’ to a woman?');
});
