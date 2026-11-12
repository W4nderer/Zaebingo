import type { CardKind } from './cardTypes';
import { TRACK_COUNT } from './tracks';

/**
 * Card QR payload. Uses only QR alphanumeric characters (0-9, A-Z, ':') so the code stays small:
 *
 *   ZB1:<series>:<kind><rows><cols>:<number>:<tracks>
 *
 * kind is P (player) or T (team); tracks are two-digit numbers in cell order, row-major.
 * Example: ZB1:K7QX2M4A:T55:12:0517...  (25 tracks → 50 digits)
 */
export interface CardPayload {
  seriesId: string;
  kind: CardKind;
  rows: number;
  cols: number;
  number: number;
  tracks: number[];
}

const PREFIX = 'ZB1';
const KIND_CODE: Record<CardKind, string> = { player: 'P', team: 'T' };

export function encodeCardPayload(p: CardPayload): string {
  if (p.tracks.length !== p.rows * p.cols) throw new Error('tracks do not fill the grid');
  const tracks = p.tracks.map((n) => String(n).padStart(2, '0')).join('');
  return [PREFIX, p.seriesId, `${KIND_CODE[p.kind]}${p.rows}${p.cols}`, String(p.number), tracks].join(':');
}

/** Returns null for anything that is not a valid Zaebingo card code. */
export function decodeCardPayload(text: string): CardPayload | null {
  const m = text.trim().toUpperCase().match(/^ZB1:([A-Z2-7]+):([PT])([1-9])([1-9]):(\d+):(\d+)$/);
  if (!m) return null;
  const [, seriesId, k, r, c, num, digits] = m;
  const rows = Number(r);
  const cols = Number(c);
  if (digits.length !== rows * cols * 2) return null;
  const tracks: number[] = [];
  for (let i = 0; i < digits.length; i += 2) tracks.push(Number(digits.slice(i, i + 2)));
  if (tracks.some((n) => n < 1 || n > TRACK_COUNT) || new Set(tracks).size !== tracks.length) return null;
  return { seriesId, kind: k === 'P' ? 'player' : 'team', rows, cols, number: Number(num), tracks };
}
