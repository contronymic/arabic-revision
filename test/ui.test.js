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
  assert.deepEqual(headings, ['h1 Palestinian Arabic Revision', 'h2 What do you want to work on?']);
  const modes = findAll(root, (n) => /^mode\b/.test(n.className)).map((n) => n.textContent);
  assert.deepEqual(modes, ['English → Arabic', 'Arabic → English', 'QuizCounts towards progress']);
});

test('home keeps progress off its page, behind a Progress button', () => {
  const root = document.createElement('main');
  let shown = 0;
  render(root, { screen: 'home', scopes: [{ id: 'all', label: 'All lessons so far' }], scope: 'all', stats,
    installNote: false, saveFailed: false, problems: [] }, { showProgress: () => { shown += 1; } });
  assert.equal(findAll(root, (n) => n.className === 'bar').length, 0);
  const [button] = findAll(root, (n) => n.tagName === 'button' && n.textContent === 'Progress');
  assert.ok(button, 'no Progress button');
  button.listeners.click(); assert.equal(shown, 1);
});

test('progress has its own page: each lesson, the overall line, the note and a way home', () => {
  const root = document.createElement('main');
  const two = { lessons: [{ id: 'lesson-01', title: 'Lesson 1', remembered: 3, total: 69, percent: 4 },
    { id: 'lesson-02', title: 'Lesson 2', remembered: 0, total: 10, percent: 0 }], overall: { remembered: 3, total: 79, percent: 4 } };
  let home = 0;
  render(root, { screen: 'progress', stats: two, saveFailed: false }, { goHome: () => { home += 1; } });
  const headings = findAll(root, (n) => /^h[1-3]$/.test(n.tagName)).map((n) => `${n.tagName} ${n.textContent}`);
  assert.deepEqual(headings, ['h2 Progress', 'h3 Lesson 1: 3 of 69 phrases remembered · 4%',
    'h3 Lesson 2: 0 of 10 phrases remembered · 0%', 'h3 Overall: 3 of 79 phrases remembered · 4%']);
  assert.equal(findAll(root, (n) => n.className === 'bar').length, 3);
  assert.equal(findAll(root, (n) => /progress-note/.test(n.className)).length, 1);
  const buttons = findAll(root, (n) => n.tagName === 'button');
  assert.deepEqual(buttons.map((n) => n.textContent), ['Home']);
  buttons[0].listeners.click(); assert.equal(home, 1);
});

test('a question reads out its whole wording, the English phrase included', () => {
  const root = document.createElement('main');
  render(root, { screen: 'question', kind: 'cards', position: 1, total: 10, chosen: null, saveFailed: false,
    question: { type: 'say', dir: 'en-ar', phraseId: 'x', ask: [{ text: 'How do you say ' }, { text: '‘please’', strong: true }, { text: ' to a woman?' }],
      options: ['a', 'b'], answer: 0 } }, noActions);
  const [card] = findAll(root, (n) => n.className === 'card');
  assert.equal(card.textContent, 'How do you say ‘please’ to a woman?');
});
