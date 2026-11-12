import type { Track } from './tracks';

const BASE32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

/**
 * Series ID: hash of the "number → card text" pairs, i.e. exactly what is printed on paper.
 * Editing artist or song does not change it. 40 bits → 8 base32 chars (QR alphanumeric-safe).
 */
export async function computeSeriesId(tracks: Track[]): Promise<string> {
  const canonical = [...tracks]
    .sort((a, b) => a.n - b.n)
    .map((t) => `${t.n}\t${t.cardText.trim()}\n`)
    .join('');
  const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(canonical)));
  let bits = 0;
  let value = 0;
  let out = '';
  for (let i = 0; i < 5; i++) {
    value = (value << 8) | digest[i];
    bits += 8;
    while (bits >= 5) {
      out += BASE32[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  return out;
}
