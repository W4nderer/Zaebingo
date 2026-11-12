export type CardKind = 'player' | 'team';

/** A win stage: either N complete lines (rows/columns) or the whole card. */
export type WinStage = { id: string; lines: number } | { id: string; full: true };

export interface CardType {
  kind: CardKind;
  rows: number;
  cols: number;
  /** Stages in ascending order; the check reports the highest one reached. */
  stages: WinStage[];
}

export const CARD_TYPES: Record<CardKind, CardType> = {
  // Orientation (4×5 vs 5×4) and stages are open questions in SPEC.md; these are placeholders.
  player: {
    kind: 'player',
    rows: 4,
    cols: 5,
    stages: [
      { id: 'line1', lines: 1 },
      { id: 'line2', lines: 2 },
      { id: 'full', full: true },
    ],
  },
  team: {
    kind: 'team',
    rows: 5,
    cols: 5,
    stages: [{ id: 'full', full: true }],
  },
};

export const cellCount = (t: { rows: number; cols: number }) => t.rows * t.cols;
