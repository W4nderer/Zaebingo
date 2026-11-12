import { parseCsv } from './csv';

export const TRACK_COUNT = 90;

export interface Track {
  n: number;
  artist: string;
  song: string;
  cardText: string;
}

export type TableIssue =
  | { code: 'missingColumn'; column: 'n' | 'artist' | 'song' | 'cardText' }
  | { code: 'badNumber'; row: number; value: string }
  | { code: 'duplicateNumber'; n: number }
  | { code: 'missingNumbers'; numbers: number[] }
  | { code: 'emptyCardText'; n: number }
  | { code: 'duplicateCardText'; numbers: number[]; text: string };

const HEADER_ALIASES: Record<keyof Track, string[]> = {
  n: ['№', '#', 'номер', 'no', 'n', 'number', 'num'],
  artist: ['исполнитель', 'artist', 'группа'],
  song: ['песня', 'song', 'title', 'название', 'трек'],
  cardText: ['текст для карточки', 'текст на карточке', 'текст', 'card text', 'cardtext', 'text'],
};

const norm = (s: string) => s.trim().toLowerCase().replace(/\s+/g, ' ');

/** Finds column indexes by header name; columns with unknown headers are ignored. */
function mapHeader(header: string[]): Partial<Record<keyof Track, number>> {
  const map: Partial<Record<keyof Track, number>> = {};
  header.forEach((h, i) => {
    const name = norm(h);
    for (const key of Object.keys(HEADER_ALIASES) as (keyof Track)[]) {
      if (map[key] === undefined && HEADER_ALIASES[key].includes(name)) map[key] = i;
    }
  });
  return map;
}

export interface ParsedTable {
  tracks: Track[];
  /** Issues that make the table unusable for card generation. */
  issues: TableIssue[];
}

/** Parses the CSV export of the tracks sheet and validates it for card generation. */
export function parseTracksCsv(csv: string): ParsedTable {
  const rows = parseCsv(csv).filter((r) => r.some((c) => c.trim() !== ''));
  const issues: TableIssue[] = [];
  if (rows.length === 0) {
    return { tracks: [], issues: [{ code: 'missingColumn', column: 'n' }] };
  }
  const cols = mapHeader(rows[0]);
  for (const key of ['n', 'cardText'] as const) {
    if (cols[key] === undefined) issues.push({ code: 'missingColumn', column: key });
  }
  if (issues.length) return { tracks: [], issues };

  const cell = (r: string[], key: keyof Track) => {
    const i = cols[key];
    return i === undefined ? '' : (r[i] ?? '').trim();
  };

  const byNumber = new Map<number, Track>();
  rows.slice(1).forEach((r, idx) => {
    const raw = cell(r, 'n');
    const n = Number(raw);
    if (!Number.isInteger(n) || n < 1 || n > TRACK_COUNT) {
      issues.push({ code: 'badNumber', row: idx + 2, value: raw });
      return;
    }
    if (byNumber.has(n)) {
      issues.push({ code: 'duplicateNumber', n });
      return;
    }
    byNumber.set(n, { n, artist: cell(r, 'artist'), song: cell(r, 'song'), cardText: cell(r, 'cardText') });
  });

  const missing: number[] = [];
  for (let n = 1; n <= TRACK_COUNT; n++) if (!byNumber.has(n)) missing.push(n);
  if (missing.length) issues.push({ code: 'missingNumbers', numbers: missing });

  const tracks = [...byNumber.values()].sort((a, b) => a.n - b.n);

  const byText = new Map<string, number[]>();
  for (const t of tracks) {
    if (!t.cardText) {
      issues.push({ code: 'emptyCardText', n: t.n });
      continue;
    }
    const key = norm(t.cardText);
    byText.set(key, [...(byText.get(key) ?? []), t.n]);
  }
  for (const numbers of byText.values()) {
    if (numbers.length > 1) {
      issues.push({ code: 'duplicateCardText', numbers, text: tracks.find((t) => t.n === numbers[0])!.cardText });
    }
  }

  return { tracks, issues };
}

/**
 * Turns a Google Sheets link into a CSV URL readable from the browser (CORS-enabled gviz endpoint).
 * Links that already point to CSV (e.g. "Publish to web" → CSV) are returned as is.
 */
export function sheetCsvUrl(link: string): string {
  const url = new URL(link.trim());
  if (url.searchParams.get('output') === 'csv' || url.searchParams.get('format') === 'csv' || url.searchParams.get('tqx')?.includes('csv')) {
    return url.toString();
  }
  const m = url.pathname.match(/\/spreadsheets\/d\/([\w-]+)/);
  if (!m) throw new Error('notASheetLink');
  const gid = url.hash.match(/gid=(\d+)/)?.[1] ?? url.searchParams.get('gid') ?? '0';
  return `https://docs.google.com/spreadsheets/d/${m[1]}/gviz/tq?tqx=out:csv&headers=1&gid=${gid}`;
}

export async function fetchTracksCsv(link: string): Promise<string> {
  const res = await fetch(sheetCsvUrl(link), { cache: 'no-store' });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const text = await res.text();
  // A sheet that is not shared returns the Google sign-in HTML page instead of CSV.
  if (/^\s*<(!doctype|html)/i.test(text)) throw new Error('notShared');
  return text;
}
