import type { CardKind } from '../core/cardTypes';

/** All layout values are millimetres from the top-left corner of the card. */
export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface CardLayout {
  /** Card size: A4 landscape for players, A5 landscape for teams. */
  pageW: number;
  pageH: number;
  /** Rectangle the grid is fitted into. */
  grid: Rect;
  /** Square QR code; the card number is printed under it. */
  qr: { x: number; y: number; size: number };
  /** Draw grid lines (off when the template already has them). */
  drawGridLines: boolean;
  /** Draw the template above the cells (as in the spec) or below them. */
  templateOnTop: boolean;
  /** Inner padding of a cell. */
  cellPadding: number;
  /** Font size range for cell text, in points. */
  fontMax: number;
  fontMin: number;
}

export const DEFAULT_LAYOUTS: Record<CardKind, CardLayout> = {
  player: {
    pageW: 297,
    pageH: 210,
    grid: { x: 15, y: 38, w: 267, h: 160 },
    qr: { x: 258, y: 6, size: 24 },
    drawGridLines: true,
    templateOnTop: true,
    cellPadding: 3,
    fontMax: 20,
    fontMin: 7,
  },
  team: {
    pageW: 210,
    pageH: 148,
    grid: { x: 10, y: 34, w: 190, h: 106 },
    qr: { x: 182, y: 5, size: 20 },
    drawGridLines: true,
    templateOnTop: true,
    cellPadding: 2,
    fontMax: 14,
    fontMin: 6,
  },
};

/** A4 portrait sheet that holds two A5 team cards, one above the other. */
export const A4_PORTRAIT = { w: 210, h: 297 };

export const MM_TO_PT = 72 / 25.4;
