import { TRACK_COUNT } from '../core/tracks';

/** Made-up table for trying the generator before the real one is available. */
export function demoCsv(): string {
  const rows = ['№,Исполнитель,Песня,Текст для карточки'];
  for (let n = 1; n <= TRACK_COUNT; n++) {
    const text =
      n % 9 === 0
        ? `Очень длинное название демо-песни номер ${n}, чтобы проверить перенос строк`
        : n % 4 === 0
          ? `Демо ${n}`
          : `Демо-песня №${n}`;
    rows.push(`${n},Исполнитель ${n},Песня ${n},"${text}"`);
  }
  return rows.join('\n');
}
