// Saved progress, kept in the browser's localStorage under a name of its own.
// Every call is guarded: blocked or damaged storage never stops the app.

export const STORAGE_KEY = 'arabic-revision:v1';
const PROBE_KEY = 'arabic-revision:probe';
const DAY = /^\d{4}-\d{2}-\d{2}$/;

export function emptyState() {
  return { v: 1, cards: {}, rightDays: {}, prefs: { scope: 'all', installNoteDismissed: false } };
}

const isPlainObject = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const isDay = (v) => typeof v === 'string' && DAY.test(v);

function cleanCards(raw) {
  const cards = {};
  if (!isPlainObject(raw)) return cards;
  for (const [key, card] of Object.entries(raw)) {
    if (isPlainObject(card) && Number.isInteger(card.box) && card.box >= 0 && card.box <= 4
        && isDay(card.due) && isDay(card.seen)) {
      cards[key] = { box: card.box, due: card.due, seen: card.seen };
    }
  }
  return cards;
}

function cleanRightDays(raw) {
  const rightDays = {};
  if (!isPlainObject(raw)) return rightDays;
  for (const [phraseId, days] of Object.entries(raw)) {
    if (!Array.isArray(days)) continue;
    const kept = [...new Set(days.filter(isDay))].slice(0, 2);
    if (kept.length > 0) rightDays[phraseId] = kept;
  }
  return rightDays;
}

// Keeps only values of the right kind; anything else falls back to the defaults.
function cleanState(raw) {
  const state = emptyState();
  if (!isPlainObject(raw) || raw.v !== 1) return state;
  state.cards = cleanCards(raw.cards);
  state.rightDays = cleanRightDays(raw.rightDays);
  if (isPlainObject(raw.prefs)) {
    if (typeof raw.prefs.scope === 'string') state.prefs.scope = raw.prefs.scope;
    if (typeof raw.prefs.installNoteDismissed === 'boolean') {
      state.prefs.installNoteDismissed = raw.prefs.installNoteDismissed;
    }
  }
  return state;
}

export function createStore(storage) {
  let available = false;
  if (storage) {
    try {
      storage.setItem(PROBE_KEY, '1');
      storage.removeItem(PROBE_KEY);
      available = true;
    } catch {
      available = false;
    }
  }

  return {
    available,
    load() {
      try {
        const raw = storage ? storage.getItem(STORAGE_KEY) : null;
        return raw == null ? emptyState() : cleanState(JSON.parse(raw));
      } catch {
        return emptyState();
      }
    },
    save(state) {
      if (!storage) return false;
      try {
        storage.setItem(STORAGE_KEY, JSON.stringify(state));
        return true;
      } catch {
        return false;
      }
    },
  };
}
