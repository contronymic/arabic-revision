// Shuffling with an injectable random source, so tests can repeat a run.

// Returns a shuffled copy (Fisher–Yates); the input is left alone.
export function shuffle(items, rng = Math.random) {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

export function pickOne(items, rng = Math.random) {
  return items[Math.floor(rng() * items.length)];
}
