import { describe, expect, it } from 'vitest';
import { demoCsv } from '../ui/demo';
import { CARD_TYPES } from './cardTypes';
import { generateCards, randomCard } from './cards';
import { parseCsv } from './csv';
import { decodeCardPayload, encodeCardPayload } from './qrPayload';
import { computeSeriesId } from './seriesId';
import { parseTracksCsv, sheetCsvUrl } from './tracks';
import { checkCard } from './win';

describe('parseCsv', () => {
  it('handles quotes, escaped quotes, commas and newlines', () => {
    expect(parseCsv('a,"b, c","d ""e"""\r\n1,"x\ny",3\n')).toEqual([
      ['a', 'b, c', 'd "e"'],
      ['1', 'x\ny', '3'],
    ]);
  });
});

describe('parseTracksCsv', () => {
  it('accepts the demo table', () => {
    const { tracks, issues } = parseTracksCsv(demoCsv());
    expect(issues).toEqual([]);
    expect(tracks).toHaveLength(90);
    expect(tracks[0]).toMatchObject({ n: 1, artist: 'Исполнитель 1', song: 'Песня 1' });
  });

  it('reports missing numbers, empty and duplicate card texts', () => {
    const csv = ['№,Исполнитель,Песня,Текст для карточки', '1,a,b,Same', '2,a,b,same ', '3,a,b,'].join('\n');
    const codes = parseTracksCsv(csv).issues.map((i) => i.code);
    expect(codes).toEqual(expect.arrayContaining(['missingNumbers', 'emptyCardText', 'duplicateCardText']));
  });

  it('reports a missing card text column', () => {
    expect(parseTracksCsv('№,Исполнитель\n1,a').issues).toEqual([{ code: 'missingColumn', column: 'cardText' }]);
  });
});

describe('sheetCsvUrl', () => {
  it('builds a gviz CSV URL with the tab gid', () => {
    expect(sheetCsvUrl('https://docs.google.com/spreadsheets/d/AbC-123_x/edit#gid=42')).toBe(
      'https://docs.google.com/spreadsheets/d/AbC-123_x/gviz/tq?tqx=out:csv&headers=1&gid=42',
    );
  });
  it('keeps published CSV links', () => {
    const link = 'https://docs.google.com/spreadsheets/d/e/2PACX-x/pub?output=csv';
    expect(sheetCsvUrl(link)).toBe(link);
  });
});

describe('computeSeriesId', () => {
  it('depends only on number → card text', async () => {
    const { tracks } = parseTracksCsv(demoCsv());
    const id = await computeSeriesId(tracks);
    expect(id).toMatch(/^[A-Z2-7]{8}$/);
    const renamed = tracks.map((t) => ({ ...t, artist: 'X', song: 'Y' }));
    expect(await computeSeriesId(renamed)).toBe(id);
    const edited = tracks.map((t) => (t.n === 5 ? { ...t, cardText: 'Другое' } : t));
    expect(await computeSeriesId(edited)).not.toBe(id);
  });
});

describe('cards', () => {
  it('picks distinct tracks in range', () => {
    const card = randomCard(25);
    expect(new Set(card).size).toBe(25);
    expect(card.every((n) => n >= 1 && n <= 90)).toBe(true);
  });

  it('never repeats a set of tracks, even with a weak RNG', () => {
    // An RNG with few distinct outputs forces collisions that must be rejected.
    let i = 0;
    const weak = () => [0.1, 0.5, 0.9, 0.3][i++ % 4] * ((i % 7) / 7);
    const cards = generateCards(3, 20, weak);
    const keys = cards.map((c) => [...c].sort((a, b) => a - b).join(','));
    expect(new Set(keys).size).toBe(3);
  });
});

describe('qr payload', () => {
  it('round-trips', () => {
    const p = { seriesId: 'K7QX2M4A', kind: 'team' as const, rows: 5, cols: 5, number: 12, tracks: randomCard(25) };
    const text = encodeCardPayload(p);
    expect(text).toMatch(/^[0-9A-Z:]+$/);
    expect(decodeCardPayload(text)).toEqual(p);
  });

  it('rejects foreign or broken codes', () => {
    expect(decodeCardPayload('https://example.com')).toBeNull();
    expect(decodeCardPayload('ZB1:ABC:P45:1:0102')).toBeNull(); // wrong track count
    expect(decodeCardPayload('ZB1:ABC:P11:1:91')).toBeNull(); // out of range
  });
});

describe('checkCard', () => {
  const { rows, cols, stages } = CARD_TYPES.player; // 4×5
  const tracks = Array.from({ length: 20 }, (_, i) => i + 1);

  it('nothing played', () => {
    const r = checkCard(tracks, rows, cols, stages, []);
    expect(r.reached).toBeNull();
    expect(r.next?.id).toBe('line1');
    expect(r.missingForNext).toBe(4); // shortest line is a 4-cell column
  });

  it('one column, then a row', () => {
    const column = [1, 6, 11, 16];
    let r = checkCard(tracks, rows, cols, stages, column);
    expect(r.reached?.id).toBe('line1');
    expect(r.next?.id).toBe('line2');
    // Another column needs 4 cells; a row has 5 cells with one already closed: also 4.
    expect(r.missingForNext).toBe(4);
    r = checkCard(tracks, rows, cols, stages, [...column, 2, 3, 4, 5]);
    expect(r.reached?.id).toBe('line2');
    expect(r.completeLines).toBe(2);
  });

  it('full card', () => {
    const r = checkCard(tracks, rows, cols, stages, tracks);
    expect(r.reached?.id).toBe('full');
    expect(r.next).toBeNull();
  });

  it('team card needs all 25', () => {
    const team = CARD_TYPES.team;
    const t25 = Array.from({ length: 25 }, (_, i) => i + 1);
    const r = checkCard(t25, team.rows, team.cols, team.stages, t25.slice(0, 24));
    expect(r.reached).toBeNull();
    expect(r.missingForNext).toBe(1);
  });
});
