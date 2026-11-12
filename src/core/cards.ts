import { TRACK_COUNT } from './tracks';

export type Rng = () => number;

/** Uniform random float in [0, 1) from the platform CSPRNG. */
export const cryptoRng: Rng = () => {
  const a = new Uint32Array(1);
  crypto.getRandomValues(a);
  return a[0] / 2 ** 32;
};

/** Picks `size` distinct tracks from 1..TRACK_COUNT in random order (partial Fisher–Yates). */
export function randomCard(size: number, rng: Rng = cryptoRng): number[] {
  const pool = Array.from({ length: TRACK_COUNT }, (_, i) => i + 1);
  for (let i = 0; i < size; i++) {
    const j = i + Math.floor(rng() * (TRACK_COUNT - i));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool.slice(0, size);
}

/**
 * Generates `count` cards of `size` cells. Cards differ by their set of tracks,
 * not just by layout. Each card lists track numbers in cell order (row-major).
 */
export function generateCards(count: number, size: number, rng: Rng = cryptoRng): number[][] {
  if (size > TRACK_COUNT) throw new Error('card larger than track list');
  const seen = new Set<string>();
  const cards: number[][] = [];
  let attempts = 0;
  while (cards.length < count) {
    if (++attempts > count * 1000) throw new Error('could not generate enough distinct cards');
    const card = randomCard(size, rng);
    const key = [...card].sort((a, b) => a - b).join(',');
    if (seen.has(key)) continue;
    seen.add(key);
    cards.push(card);
  }
  return cards;
}
