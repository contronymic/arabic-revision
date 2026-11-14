// The card schedule (Leitner boxes): right moves a card up a box and spaces it
// out; wrong sends it back to box 0, due again today.
import { addDays } from './dates.js';
import { shuffle } from './random.js';

// Days until a card in each box is due again.
export const INTERVALS = [0, 1, 3, 7, 14];
export const DIRS = ['en-ar', 'ar-en'];

export function cardKey(phraseId, dir) {
  return `${phraseId}|${dir}`;
}

export function markCard(card, right, today) {
  const box = right ? Math.min((card?.box ?? 0) + 1, INTERVALS.length - 1) : 0;
  return { box, due: addDays(today, INTERVALS[box]), seen: today };
}

// Picks up to n cards for a round: due cards first (lowest box, most overdue),
// then new cards in lesson order, then the cards due soonest. Then shuffles.
export function pickCards(phraseIds, dir, cards, today, n = 10, rng = Math.random) {
  const due = [], fresh = [], later = [];
  for (const id of phraseIds) {
    const card = cards[cardKey(id, dir)];
    if (!card) fresh.push(id);
    else if (card.due <= today) due.push({ id, card });
    else later.push({ id, card });
  }
  due.sort((a, b) => a.card.box - b.card.box || a.card.due.localeCompare(b.card.due));
  later.sort((a, b) => a.card.due.localeCompare(b.card.due));
  const ordered = [...due.map((x) => x.id), ...fresh, ...later.map((x) => x.id)];
  return shuffle(ordered.slice(0, n), rng);
}
