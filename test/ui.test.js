import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fakeDocument, findAll } from './helpers.js';

globalThis.document = fakeDocument();
const { render } = await import('../js/ui.js');
const noActions = new Proxy({}, { get: () => () => {} });

test("a card is read out by its own text, so VoiceOver users hear the English", () => {
  const root = document.createElement('main');
  render(root, { screen: 'card', dir: 'en-ar', phraseId: 'hi', position: 1, total: 10, flipped: false,
    front: { text: 'hello', hint: '(not zubu)', arabic: false }, back: null, saveFailed: false }, noActions);
  const [card] = findAll(root, (n) => n.className === 'card');
  assert.equal(card.tagName, 'button');
  assert.equal(card.getAttribute('aria-label'), null);
  assert.match(card.textContent, /hello/);
});
