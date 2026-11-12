import type { WinStage } from './cardTypes';

export interface WinCheck {
  /** closed[i] is true when the track in cell i (row-major) has been played. */
  closed: boolean[];
  /** Highest stage reached, or null. */
  reached: WinStage | null;
  /** Next stage after `reached`, or null if the card is fully won. */
  next: WinStage | null;
  /** Minimum number of still-open cells needed to reach `next`. */
  missingForNext: number;
  /** Count of complete rows plus complete columns. */
  completeLines: number;
}

/** All rows and columns of the grid as lists of cell indexes. */
function gridLines(rows: number, cols: number): number[][] {
  const lines: number[][] = [];
  for (let r = 0; r < rows; r++) lines.push(Array.from({ length: cols }, (_, c) => r * cols + c));
  for (let c = 0; c < cols; c++) lines.push(Array.from({ length: rows }, (_, r) => r * cols + c));
  return lines;
}

/** Calls fn for every k-element combination of indexes 0..n-1. */
function combinations(n: number, k: number, fn: (combo: number[]) => void, start = 0, acc: number[] = []) {
  if (acc.length === k) return fn(acc);
  for (let i = start; i <= n - (k - acc.length); i++) {
    acc.push(i);
    combinations(n, k, fn, i + 1, acc);
    acc.pop();
  }
}

/** Fewest open cells that must still be closed to satisfy the stage. */
function missingFor(stage: WinStage, closed: boolean[], lines: number[][]): number {
  if ('full' in stage) return closed.filter((x) => !x).length;
  if (stage.lines > lines.length) return Infinity;
  let best = Infinity;
  combinations(lines.length, stage.lines, (combo) => {
    const cells = new Set(combo.flatMap((i) => lines[i]));
    let open = 0;
    for (const cell of cells) if (!closed[cell]) open++;
    best = Math.min(best, open);
  });
  return best;
}

export function checkCard(
  tracks: number[],
  rows: number,
  cols: number,
  stages: WinStage[],
  played: Iterable<number>,
): WinCheck {
  const playedSet = new Set(played);
  const closed = tracks.map((n) => playedSet.has(n));
  const lines = gridLines(rows, cols);
  const completeLines = lines.filter((l) => l.every((i) => closed[i])).length;

  let reached: WinStage | null = null;
  let next: WinStage | null = null;
  let missingForNext = 0;
  for (const stage of stages) {
    const missing = missingFor(stage, closed, lines);
    if (missing === 0) {
      reached = stage;
    } else {
      next = stage;
      missingForNext = missing;
      break;
    }
  }
  return { closed, reached, next, missingForNext, completeLines };
}
