/** Width of `text` at `size` points, in points. */
export type Measure = (text: string, size: number) => number;

export interface FittedText {
  size: number;
  lines: string[];
  /** False when the text overflows even at the minimum size. */
  fits: boolean;
}

export const LINE_HEIGHT = 1.15;

/** Greedy word wrap; words longer than the width are split by characters. */
export function wrap(text: string, size: number, maxWidth: number, measure: Measure): string[] {
  const lines: string[] = [];
  for (const paragraph of text.split(/\r?\n/)) {
    let line = '';
    for (const word of paragraph.split(/\s+/).filter(Boolean)) {
      const candidate = line ? `${line} ${word}` : word;
      if (measure(candidate, size) <= maxWidth) {
        line = candidate;
        continue;
      }
      if (line) lines.push(line);
      line = '';
      if (measure(word, size) <= maxWidth) {
        line = word;
        continue;
      }
      // Hard-break an overlong word.
      let chunk = '';
      for (const ch of word) {
        if (chunk && measure(chunk + ch, size) > maxWidth) {
          lines.push(chunk);
          chunk = '';
        }
        chunk += ch;
      }
      line = chunk;
    }
    lines.push(line);
  }
  return lines;
}

const wordsIntact = (text: string, lines: string[]) =>
  text.split(/\s+/).filter(Boolean).every((w) => lines.some((l) => l.split(' ').includes(w)));

/**
 * Largest font size in [min, max] at which the text fits the box without splitting words.
 * Falls back to hard-breaking words at the minimum size; `fits` is false if it still overflows.
 */
export function fitText(text: string, boxW: number, boxH: number, min: number, max: number, measure: Measure): FittedText {
  for (let size = max; size >= min; size -= 0.5) {
    const lines = wrap(text, size, boxW, measure);
    if (lines.length * size * LINE_HEIGHT <= boxH && wordsIntact(text, lines)) return { size, lines, fits: true };
  }
  const lines = wrap(text, min, boxW, measure);
  return { size: min, lines, fits: lines.length * min * LINE_HEIGHT <= boxH };
}
