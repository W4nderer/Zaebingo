import fontkit from '@pdf-lib/fontkit';
import { PDFDocument, PDFEmbeddedPage, PDFFont, PDFImage, PDFPage, rgb } from 'pdf-lib';
import QRCode from 'qrcode';
import type { CardKind } from '../core/cardTypes';
import { encodeCardPayload } from '../core/qrPayload';
import type { Track } from '../core/tracks';
import { fitText, LINE_HEIGHT, type FittedText } from './fitText';
import { A4_PORTRAIT, MM_TO_PT, type CardLayout } from './layout';

export type Template = { type: 'png' | 'jpg' | 'pdf'; bytes: ArrayBuffer };

export interface SeriesInput {
  kind: CardKind;
  rows: number;
  cols: number;
  seriesId: string;
  /** Track numbers per card, in cell order (row-major). Card N is cards[N - 1]. */
  cards: number[][];
  tracks: Track[];
  layout: CardLayout;
  template?: Template;
  fontBytes: ArrayBuffer;
}

export interface SeriesOutput {
  pdf: Uint8Array;
  /** Tracks (of all 90) whose card text overflows its cell even at the minimum font size. */
  overflow: number[];
}

const mm = (v: number) => v * MM_TO_PT;
const BLACK = rgb(0, 0, 0);
const WHITE = rgb(1, 1, 1);

/** Text placement for every track, computed once: depends only on text and cell size. */
function fitAllTexts(input: SeriesInput, font: PDFFont): Map<number, FittedText> {
  const { layout, rows, cols } = input;
  const boxW = mm(layout.grid.w / cols - 2 * layout.cellPadding);
  const boxH = mm(layout.grid.h / rows - 2 * layout.cellPadding);
  const measure = (t: string, s: number) => font.widthOfTextAtSize(t, s);
  const fitted = new Map<number, FittedText>();
  for (const t of input.tracks) fitted.set(t.n, fitText(t.cardText, boxW, boxH, layout.fontMin, layout.fontMax, measure));
  return fitted;
}

/** Draws one card with its top-left corner at (ox, oy) mm on the page. */
function drawCard(
  page: PDFPage,
  ox: number,
  oy: number,
  cardIndex: number,
  input: SeriesInput,
  font: PDFFont,
  fitted: Map<number, FittedText>,
  template: PDFImage | PDFEmbeddedPage | undefined,
) {
  const { layout, rows, cols } = input;
  const pageH = page.getHeight();
  // pdf-lib uses points from the bottom-left; layout uses mm from the card's top-left.
  const X = (x: number) => mm(ox + x);
  const Y = (y: number) => pageH - mm(oy + y);

  const drawTemplate = () => {
    if (!template) return;
    const opts = { x: X(0), y: Y(layout.pageH), width: mm(layout.pageW), height: mm(layout.pageH) };
    if (template instanceof PDFImage) page.drawImage(template, opts);
    else page.drawPage(template, opts);
  };

  if (!layout.templateOnTop) drawTemplate();

  const { grid } = layout;
  const cw = grid.w / cols;
  const ch = grid.h / rows;
  const card = input.cards[cardIndex];
  card.forEach((n, i) => {
    const r = Math.floor(i / cols);
    const c = i % cols;
    const f = fitted.get(n)!;
    const lh = f.size * LINE_HEIGHT;
    const cx = X(grid.x + c * cw + cw / 2);
    const cy = Y(grid.y + r * ch + ch / 2);
    // Vertically centre the block; baseline sits ~0.8 of the line height below the line top.
    let top = cy + (f.lines.length * lh) / 2;
    for (const line of f.lines) {
      const w = font.widthOfTextAtSize(line, f.size);
      page.drawText(line, { x: cx - w / 2, y: top - lh * 0.8, size: f.size, font, color: BLACK });
      top -= lh;
    }
  });

  if (layout.drawGridLines) {
    const t = 0.8;
    for (let r = 0; r <= rows; r++) {
      page.drawLine({ start: { x: X(grid.x), y: Y(grid.y + r * ch) }, end: { x: X(grid.x + grid.w), y: Y(grid.y + r * ch) }, thickness: t, color: BLACK });
    }
    for (let c = 0; c <= cols; c++) {
      page.drawLine({ start: { x: X(grid.x + c * cw), y: Y(grid.y) }, end: { x: X(grid.x + c * cw), y: Y(grid.y + grid.h) }, thickness: t, color: BLACK });
    }
  }

  if (layout.templateOnTop) drawTemplate();

  // QR and number go last so the template can never cover them.
  const number = cardIndex + 1;
  const payload = encodeCardPayload({ seriesId: input.seriesId, kind: input.kind, rows, cols, number, tracks: card });
  const qr = QRCode.create(payload, { errorCorrectionLevel: 'M' });
  const size = qr.modules.size;
  const quiet = 2;
  const unit = layout.qr.size / (size + 2 * quiet);
  page.drawRectangle({ x: X(layout.qr.x), y: Y(layout.qr.y + layout.qr.size), width: mm(layout.qr.size), height: mm(layout.qr.size), color: WHITE });
  for (let r = 0; r < size; r++) {
    // Merge horizontal runs of dark modules into one rectangle each.
    let c = 0;
    while (c < size) {
      if (!qr.modules.get(r, c)) {
        c++;
        continue;
      }
      const start = c;
      while (c < size && qr.modules.get(r, c)) c++;
      page.drawRectangle({
        x: X(layout.qr.x + (quiet + start) * unit),
        y: Y(layout.qr.y + (quiet + r + 1) * unit),
        width: mm((c - start) * unit),
        height: mm(unit),
        color: BLACK,
      });
    }
  }
  const label = `№ ${number}`;
  const labelSize = 9;
  const lw = font.widthOfTextAtSize(label, labelSize);
  page.drawText(label, { x: X(layout.qr.x + layout.qr.size / 2) - lw / 2, y: Y(layout.qr.y + layout.qr.size) - labelSize * 1.1, size: labelSize, font, color: BLACK });
}

export async function renderSeriesPdf(input: SeriesInput): Promise<SeriesOutput> {
  const doc = await PDFDocument.create();
  doc.registerFontkit(fontkit);
  doc.setTitle(`Zaebingo ${input.seriesId} ${input.kind}`);
  const font = await doc.embedFont(input.fontBytes, { subset: true });

  let template: PDFImage | PDFEmbeddedPage | undefined;
  if (input.template) {
    const { type, bytes } = input.template;
    if (type === 'png') template = await doc.embedPng(bytes);
    else if (type === 'jpg') template = await doc.embedJpg(bytes);
    else [template] = await doc.embedPdf(bytes, [0]);
  }

  const fitted = fitAllTexts(input, font);
  const { layout } = input;

  if (input.kind === 'player') {
    input.cards.forEach((_, i) => {
      const page = doc.addPage([mm(layout.pageW), mm(layout.pageH)]);
      drawCard(page, 0, 0, i, input, font, fitted, template);
    });
  } else {
    // Two A5 cards per A4 portrait sheet, each centred in its half, dashed cut line in the middle.
    const half = A4_PORTRAIT.h / 2;
    const ox = (A4_PORTRAIT.w - layout.pageW) / 2;
    const oy = (half - layout.pageH) / 2;
    for (let i = 0; i < input.cards.length; i += 2) {
      const page = doc.addPage([mm(A4_PORTRAIT.w), mm(A4_PORTRAIT.h)]);
      drawCard(page, ox, oy, i, input, font, fitted, template);
      if (i + 1 < input.cards.length) drawCard(page, ox, half + oy, i + 1, input, font, fitted, template);
      const y = page.getHeight() - mm(half);
      page.drawLine({ start: { x: 0, y }, end: { x: page.getWidth(), y }, thickness: 0.5, color: rgb(0.5, 0.5, 0.5), dashArray: [4, 3] });
    }
  }

  // Reported for all tracks, not just the ones on these cards: the next series may use them.
  const overflow = [...fitted].filter(([, f]) => !f.fits).map(([n]) => n);
  return { pdf: await doc.save(), overflow };
}
