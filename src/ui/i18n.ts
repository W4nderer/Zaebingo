export type Lang = 'ru' | 'en';

const ru = {
  appTitle: 'Zaebingo — генератор карточек',
  tableSection: 'Табличка с треками',
  tableLinkPlaceholder: 'Ссылка на Google Sheets',
  tableLoad: 'Загрузить',
  tableFile: 'или файл CSV',
  tableDemo: 'Пример для проверки',
  tableLoading: 'Загружаю…',
  tableLoaded: 'Треков: {count}. Серия: {series}. Обновлено: {date}.',
  tableNone: 'Табличка ещё не загружена.',
  tableOk: 'Табличка в порядке, можно генерировать.',
  tableDemoNote: 'Это пример с выдуманными треками, не ваша табличка.',
  fetchFailed: 'Не удалось загрузить табличку: {error}',
  notASheetLink: 'это не ссылка на Google Sheets',
  notShared: 'нет доступа — откройте табличку для всех, у кого есть ссылка',
  'issue.missingColumn': 'Нет столбца «{column}».',
  'issue.badNumber': 'Строка {row}: номер «{value}» не от 1 до 90.',
  'issue.duplicateNumber': 'Номер {n} встречается несколько раз.',
  'issue.missingNumbers': 'Нет номеров: {numbers}.',
  'issue.emptyCardText': 'У трека {n} пустой текст для карточки.',
  'issue.duplicateCardText': 'Одинаковый текст «{text}» у треков {numbers}.',
  'column.n': '№',
  'column.artist': 'Исполнитель',
  'column.song': 'Песня',
  'column.cardText': 'Текст для карточки',
  'kind.player': 'Карточки игроков',
  'kind.team': 'Командные карточки',
  'kindHint.player': 'Сетка {rows}×{cols}, лист А4 альбомный, одна карточка на лист.',
  'kindHint.team': 'Сетка {rows}×{cols}, А5, по две на лист А4 с линией реза.',
  count: 'Количество',
  template: 'Шаблон (PNG, JPG, PDF или SVG)',
  templateNone: 'без шаблона',
  templateClear: 'Убрать',
  layout: 'Разметка, мм от левого верхнего угла',
  gridRect: 'Сетка: x, y, ширина, высота',
  qrRect: 'QR: x, y, размер',
  drawGridLines: 'Рисовать линии сетки',
  templateOnTop: 'Шаблон поверх клеток',
  fontRange: 'Шрифт в клетке, пт: от, до',
  layoutReset: 'Сбросить разметку',
  generate: 'Сгенерировать PDF',
  generating: 'Генерирую…',
  generated: 'Готово: {count} шт. Файл скачан.',
  overflow: 'Не помещаются в клетку даже мелким шрифтом: {list}',
  previewNote: 'Превью: синяя рамка — сетка, красная — QR. PDF-шаблон в превью не показывается.',
  generateFailed: 'Ошибка генерации: {error}',
};

const en: typeof ru = {
  appTitle: 'Zaebingo — card generator',
  tableSection: 'Track table',
  tableLinkPlaceholder: 'Google Sheets link',
  tableLoad: 'Load',
  tableFile: 'or a CSV file',
  tableDemo: 'Demo data',
  tableLoading: 'Loading…',
  tableLoaded: 'Tracks: {count}. Series: {series}. Updated: {date}.',
  tableNone: 'No table loaded yet.',
  tableOk: 'Table is valid, ready to generate.',
  tableDemoNote: 'This is demo data with made-up tracks, not your table.',
  fetchFailed: 'Could not load the table: {error}',
  notASheetLink: 'not a Google Sheets link',
  notShared: 'no access — share the sheet with anyone who has the link',
  'issue.missingColumn': 'Column “{column}” is missing.',
  'issue.badNumber': 'Row {row}: number “{value}” is not between 1 and 90.',
  'issue.duplicateNumber': 'Number {n} appears more than once.',
  'issue.missingNumbers': 'Missing numbers: {numbers}.',
  'issue.emptyCardText': 'Track {n} has empty card text.',
  'issue.duplicateCardText': 'Same text “{text}” on tracks {numbers}.',
  'column.n': 'No.',
  'column.artist': 'Artist',
  'column.song': 'Song',
  'column.cardText': 'Card text',
  'kind.player': 'Player cards',
  'kind.team': 'Team cards',
  'kindHint.player': '{rows}×{cols} grid, A4 landscape, one card per sheet.',
  'kindHint.team': '{rows}×{cols} grid, A5, two per A4 sheet with a cut line.',
  count: 'Count',
  template: 'Template (PNG, JPG, PDF or SVG)',
  templateNone: 'no template',
  templateClear: 'Remove',
  layout: 'Layout, mm from the top-left corner',
  gridRect: 'Grid: x, y, width, height',
  qrRect: 'QR: x, y, size',
  drawGridLines: 'Draw grid lines',
  templateOnTop: 'Template above cells',
  fontRange: 'Cell font, pt: min, max',
  layoutReset: 'Reset layout',
  generate: 'Generate PDF',
  generating: 'Generating…',
  generated: 'Done: {count} cards. File downloaded.',
  overflow: 'Too long for a cell even at the smallest size: {list}',
  previewNote: 'Preview: blue frame is the grid, red is the QR. PDF templates are not shown in the preview.',
  generateFailed: 'Generation failed: {error}',
};

export type Key = keyof typeof ru;
const dict: Record<Lang, typeof ru> = { ru, en };

const LANG_KEY = 'zaebingo.lang';

function initialLang(): Lang {
  try {
    const saved = localStorage.getItem(LANG_KEY);
    if (saved === 'ru' || saved === 'en') return saved;
  } catch {
    /* storage unavailable */
  }
  return navigator.language.toLowerCase().startsWith('ru') ? 'ru' : 'en';
}

let lang: Lang = initialLang();

export const getLang = () => lang;

export function setLang(l: Lang) {
  lang = l;
  document.documentElement.lang = l;
  try {
    localStorage.setItem(LANG_KEY, l);
  } catch {
    /* storage unavailable */
  }
}

export function t(key: Key, params: Record<string, string | number> = {}): string {
  return dict[lang][key].replace(/\{(\w+)\}/g, (_, k) => String(params[k] ?? `{${k}}`));
}
