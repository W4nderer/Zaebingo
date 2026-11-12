import { readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { PDFDocument } from 'pdf-lib';
import { describe, expect, it } from 'vitest';
import { CARD_TYPES } from '../core/cardTypes';
import { generateCards } from '../core/cards';
import { computeSeriesId } from '../core/seriesId';
import { parseTracksCsv } from '../core/tracks';
import { demoCsv } from '../ui/demo';
import { fitText } from './fitText';
import { DEFAULT_LAYOUTS } from './layout';
import { renderSeriesPdf } from './render';

const require = createRequire(import.meta.url);
const font = readFileSync(require.resolve('dejavu-fonts-ttf/ttf/DejaVuSansCondensed-Bold.ttf'));
const fontBytes = font.buffer.slice(font.byteOffset, font.byteOffset + font.byteLength) as ArrayBuffer;

describe('fitText', () => {
  const measure = (s: string, size: number) => s.length * size * 0.5;
  it('shrinks until the text fits', () => {
    const r = fitText('один два три четыре', 60, 40, 6, 20, measure);
    expect(r.fits).toBe(true);
    expect(r.size).toBeLessThan(20);
    expect(r.lines.join(' ')).toBe('один два три четыре');
  });
  it('flags text that cannot fit', () => {
    expect(fitText('x'.repeat(500), 20, 10, 6, 12, measure).fits).toBe(false);
  });
});

describe('renderSeriesPdf', () => {
  for (const kind of ['player', 'team'] as const) {
    it(`renders ${kind} cards`, async () => {
      const { tracks } = parseTracksCsv(demoCsv());
      const type = CARD_TYPES[kind];
      const cards = generateCards(3, type.rows * type.cols);
      const out = await renderSeriesPdf({
        kind,
        rows: type.rows,
        cols: type.cols,
        seriesId: await computeSeriesId(tracks),
        cards,
        tracks,
        layout: DEFAULT_LAYOUTS[kind],
        fontBytes,
      });
      const doc = await PDFDocument.load(out.pdf);
      // Players: one card per page. Teams: two per A4 sheet.
      expect(doc.getPageCount()).toBe(kind === 'player' ? 3 : 2);
      expect(out.overflow).toEqual([]);
      if (process.env.ZB_PDF_OUT) writeFileSync(`${process.env.ZB_PDF_OUT}/${kind}.pdf`, out.pdf);
    });
  }
});
