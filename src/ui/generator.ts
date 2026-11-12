import fontUrl from 'dejavu-fonts-ttf/ttf/DejaVuSansCondensed-Bold.ttf?url';
import { CARD_TYPES, cellCount, type CardKind } from '../core/cardTypes';
import { generateCards } from '../core/cards';
import { computeSeriesId } from '../core/seriesId';
import { fetchTracksCsv, parseTracksCsv, type ParsedTable, type TableIssue } from '../core/tracks';
import { DEFAULT_LAYOUTS, type CardLayout } from '../pdf/layout';
import type { Template } from '../pdf/render';
import { demoCsv } from './demo';
import { h } from './dom';
import { getLang, setLang, t, type Key } from './i18n';

// ---------- state ----------

interface StoredTable {
  source: 'sheet' | 'csv' | 'demo';
  link?: string;
  csv: string;
  fetchedAt: string;
}

interface KindState {
  count: number;
  layout: CardLayout;
  template?: Template;
  templateName?: string;
  /** Bitmap of an image template for the preview. */
  previewImage?: HTMLImageElement;
  status?: string;
  busy?: boolean;
}

const TABLE_KEY = 'zaebingo.table';
const layoutKey = (k: CardKind) => `zaebingo.layout.${k}`;

function load<T>(key: string): T | undefined {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : undefined;
  } catch {
    return undefined;
  }
}

function save(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* storage unavailable or full */
  }
}

let stored = load<StoredTable>(TABLE_KEY);
let parsed: ParsedTable | undefined;
let seriesId: string | undefined;
let tableStatus = '';
let linkInput = stored?.link ?? '';

const kinds: Record<CardKind, KindState> = {
  player: { count: 10, layout: initialLayout('player') },
  team: { count: 4, layout: initialLayout('team') },
};

/** Saved layout over a deep copy of the defaults (the UI mutates nested objects in place). */
function initialLayout(kind: CardKind): CardLayout {
  return { ...structuredClone(DEFAULT_LAYOUTS[kind]), ...load<CardLayout>(layoutKey(kind)) };
}

let root: HTMLElement;

// ---------- table ----------

async function applyCsv(next: StoredTable) {
  stored = next;
  save(TABLE_KEY, stored);
  parsed = parseTracksCsv(stored.csv);
  seriesId = parsed.issues.length === 0 ? await computeSeriesId(parsed.tracks) : undefined;
  tableStatus = '';
}

async function loadFromSheet() {
  tableStatus = t('tableLoading');
  render();
  try {
    const csv = await fetchTracksCsv(linkInput);
    await applyCsv({ source: 'sheet', link: linkInput.trim(), csv, fetchedAt: new Date().toISOString() });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    const known = msg === 'notASheetLink' || msg === 'notShared' ? t(msg) : msg;
    tableStatus = t('fetchFailed', { error: known });
  }
  render();
}

async function loadFromFile(file: File) {
  await applyCsv({ source: 'csv', csv: await file.text(), fetchedAt: new Date().toISOString() });
  render();
}

async function loadDemo() {
  await applyCsv({ source: 'demo', csv: demoCsv(), fetchedAt: new Date().toISOString() });
  render();
}

function issueText(issue: TableIssue): string {
  const key = `issue.${issue.code}` as Key;
  switch (issue.code) {
    case 'missingColumn':
      return t(key, { column: t(`column.${issue.column}` as Key) });
    case 'missingNumbers':
    case 'duplicateCardText':
      return t(key, { ...issue, numbers: issue.numbers.join(', ') });
    default:
      return t(key, issue as unknown as Record<string, string | number>);
  }
}

// ---------- templates ----------

const PX_PER_MM_300DPI = 300 / 25.4;

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('image'));
    img.src = src;
  });
}

/** SVG is rasterised to a 300 dpi PNG of the card size; pdf-lib cannot embed SVG directly. */
async function svgToPng(file: File, layout: CardLayout): Promise<ArrayBuffer> {
  const url = URL.createObjectURL(file);
  try {
    const img = await loadImage(url);
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(layout.pageW * PX_PER_MM_300DPI);
    canvas.height = Math.round(layout.pageH * PX_PER_MM_300DPI);
    canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob>((res, rej) => canvas.toBlob((b) => (b ? res(b) : rej(new Error('svg'))), 'image/png'));
    return blob.arrayBuffer();
  } finally {
    URL.revokeObjectURL(url);
  }
}

async function setTemplate(kind: CardKind, file: File | undefined) {
  const s = kinds[kind];
  s.template = undefined;
  s.templateName = undefined;
  s.previewImage = undefined;
  if (file) {
    const name = file.name.toLowerCase();
    let template: Template;
    if (name.endsWith('.pdf')) template = { type: 'pdf', bytes: await file.arrayBuffer() };
    else if (name.endsWith('.svg')) template = { type: 'png', bytes: await svgToPng(file, s.layout) };
    else if (name.endsWith('.png')) template = { type: 'png', bytes: await file.arrayBuffer() };
    else template = { type: 'jpg', bytes: await file.arrayBuffer() };
    s.template = template;
    s.templateName = file.name;
    if (template.type !== 'pdf') {
      s.previewImage = await loadImage(URL.createObjectURL(new Blob([template.bytes], { type: `image/${template.type === 'jpg' ? 'jpeg' : 'png'}` })));
    }
  }
  render();
}

// ---------- generation ----------

let fontBytes: Promise<ArrayBuffer> | undefined;
const getFont = () => (fontBytes ??= fetch(fontUrl).then((r) => r.arrayBuffer()));

async function generate(kind: CardKind) {
  const s = kinds[kind];
  if (!parsed || !seriesId) return;
  s.busy = true;
  s.status = t('generating');
  render();
  try {
    const type = CARD_TYPES[kind];
    const cards = generateCards(s.count, cellCount(type));
    // Loaded on demand: pdf-lib and fontkit are large and only the generator needs them.
    const { renderSeriesPdf } = await import('../pdf/render');
    const out = await renderSeriesPdf({
      kind,
      rows: type.rows,
      cols: type.cols,
      seriesId,
      cards,
      tracks: parsed.tracks,
      layout: s.layout,
      template: s.template,
      fontBytes: await getFont(),
    });
    const a = h('a', { href: URL.createObjectURL(new Blob([out.pdf as BlobPart], { type: 'application/pdf' })), download: `zaebingo-${seriesId}-${kind}.pdf` });
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 60_000);
    s.status = t('generated', { count: cards.length });
    if (out.overflow.length) s.status += ' ' + t('overflow', { list: out.overflow.join(', ') });
  } catch (e) {
    s.status = t('generateFailed', { error: e instanceof Error ? e.message : String(e) });
  }
  s.busy = false;
  render();
}

// ---------- preview ----------

function drawPreview(canvas: HTMLCanvasElement, kind: CardKind) {
  const s = kinds[kind];
  const { layout } = s;
  const { rows, cols } = CARD_TYPES[kind];
  const scale = canvas.width / layout.pageW;
  canvas.height = Math.round(layout.pageH * scale);
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  if (s.previewImage) ctx.drawImage(s.previewImage, 0, 0, canvas.width, canvas.height);

  const g = layout.grid;
  ctx.strokeStyle = '#2563eb';
  ctx.lineWidth = 1;
  for (let r = 0; r <= rows; r++) {
    const y = (g.y + (g.h / rows) * r) * scale;
    ctx.beginPath();
    ctx.moveTo(g.x * scale, y);
    ctx.lineTo((g.x + g.w) * scale, y);
    ctx.stroke();
  }
  for (let c = 0; c <= cols; c++) {
    const x = (g.x + (g.w / cols) * c) * scale;
    ctx.beginPath();
    ctx.moveTo(x, g.y * scale);
    ctx.lineTo(x, (g.y + g.h) * scale);
    ctx.stroke();
  }
  ctx.strokeStyle = '#dc2626';
  ctx.lineWidth = 2;
  ctx.strokeRect(layout.qr.x * scale, layout.qr.y * scale, layout.qr.size * scale, layout.qr.size * scale);
}

// ---------- view ----------

function numberInput(value: number, onChange: (v: number) => void, attrs: Record<string, string | number> = {}) {
  return h('input', {
    type: 'number',
    value,
    step: 'any',
    ...attrs,
    oninput: (e: Event) => {
      const v = Number((e.target as HTMLInputElement).value);
      if (Number.isFinite(v)) onChange(v);
    },
  });
}

function kindSection(kind: CardKind) {
  const s = kinds[kind];
  const type = CARD_TYPES[kind];
  const canvas = h('canvas', { width: 360, class: 'preview' });
  const changed = () => {
    save(layoutKey(kind), s.layout);
    drawPreview(canvas, kind);
  };
  const L = s.layout;
  const ready = !!seriesId && !s.busy;

  const section = h(
    'section',
    { class: 'card' },
    h('h2', {}, t(`kind.${kind}` as Key)),
    h('p', { class: 'hint' }, t(`kindHint.${kind}` as Key, { rows: type.rows, cols: type.cols })),
    h('label', {}, t('count'), numberInput(s.count, (v) => (s.count = Math.max(1, Math.floor(v))), { min: 1, step: 1 })),
    h(
      'div',
      { class: 'field' },
      h('span', {}, t('template')),
      h(
        'div',
        { class: 'row' },
        h('input', {
          type: 'file',
          accept: '.png,.jpg,.jpeg,.pdf,.svg',
          onchange: (e: Event) => setTemplate(kind, (e.target as HTMLInputElement).files?.[0]),
        }),
        s.templateName ? h('button', { type: 'button', onclick: () => setTemplate(kind, undefined) }, t('templateClear')) : null,
      ),
      h('small', {}, s.templateName ?? t('templateNone')),
    ),
    h(
      'details',
      {},
      h('summary', {}, t('layout')),
      h('div', { class: 'field' }, h('span', {}, t('gridRect')), h('div', { class: 'row' },
        numberInput(L.grid.x, (v) => ((L.grid.x = v), changed())),
        numberInput(L.grid.y, (v) => ((L.grid.y = v), changed())),
        numberInput(L.grid.w, (v) => ((L.grid.w = v), changed())),
        numberInput(L.grid.h, (v) => ((L.grid.h = v), changed())),
      )),
      h('div', { class: 'field' }, h('span', {}, t('qrRect')), h('div', { class: 'row' },
        numberInput(L.qr.x, (v) => ((L.qr.x = v), changed())),
        numberInput(L.qr.y, (v) => ((L.qr.y = v), changed())),
        numberInput(L.qr.size, (v) => ((L.qr.size = v), changed())),
      )),
      h('div', { class: 'field' }, h('span', {}, t('fontRange')), h('div', { class: 'row' },
        numberInput(L.fontMin, (v) => ((L.fontMin = v), changed())),
        numberInput(L.fontMax, (v) => ((L.fontMax = v), changed())),
      )),
      h('label', { class: 'check' }, h('input', { type: 'checkbox', checked: L.drawGridLines, onchange: (e: Event) => ((L.drawGridLines = (e.target as HTMLInputElement).checked), changed()) }), t('drawGridLines')),
      h('label', { class: 'check' }, h('input', { type: 'checkbox', checked: L.templateOnTop, onchange: (e: Event) => ((L.templateOnTop = (e.target as HTMLInputElement).checked), changed()) }), t('templateOnTop')),
      h('button', {
        type: 'button',
        onclick: () => {
          s.layout = structuredClone(DEFAULT_LAYOUTS[kind]);
          save(layoutKey(kind), s.layout);
          render();
        },
      }, t('layoutReset')),
    ),
    canvas,
    h('small', { class: 'hint' }, t('previewNote')),
    h('button', { type: 'button', class: 'primary', disabled: !ready, onclick: () => generate(kind) }, t('generate')),
    s.status ? h('p', { class: 'status' }, s.status) : null,
  );
  drawPreview(canvas, kind);
  return section;
}

function tableSection() {
  const linkEl = h('input', {
    type: 'url',
    value: linkInput,
    placeholder: t('tableLinkPlaceholder'),
    oninput: (e: Event) => (linkInput = (e.target as HTMLInputElement).value),
  });
  const info: Node[] = [];
  if (stored && parsed) {
    info.push(h('p', {}, t('tableLoaded', {
      count: parsed.tracks.length,
      series: seriesId ?? '—',
      date: new Date(stored.fetchedAt).toLocaleString(getLang()),
    })));
    if (stored.source === 'demo') info.push(h('p', { class: 'warn' }, t('tableDemoNote')));
    if (parsed.issues.length) info.push(h('ul', { class: 'issues' }, ...parsed.issues.map((i) => h('li', {}, issueText(i)))));
    else info.push(h('p', { class: 'ok' }, t('tableOk')));
  } else {
    info.push(h('p', {}, t('tableNone')));
  }
  return h(
    'section',
    { class: 'card' },
    h('h2', {}, t('tableSection')),
    h('form', { class: 'row', onsubmit: (e: Event) => (e.preventDefault(), loadFromSheet()) }, linkEl, h('button', { type: 'submit' }, t('tableLoad'))),
    h('div', { class: 'row' },
      h('label', { class: 'file' }, t('tableFile'), h('input', { type: 'file', accept: '.csv,text/csv', onchange: (e: Event) => {
        const f = (e.target as HTMLInputElement).files?.[0];
        if (f) loadFromFile(f);
      } })),
      h('button', { type: 'button', onclick: loadDemo }, t('tableDemo')),
    ),
    tableStatus ? h('p', { class: 'status' }, tableStatus) : null,
    ...info,
  );
}

function render() {
  document.title = t('appTitle');
  root.replaceChildren(
    h('header', {},
      h('h1', {}, t('appTitle')),
      h('div', { class: 'lang' }, ...(['ru', 'en'] as const).map((l) =>
        h('button', { type: 'button', class: l === getLang() ? 'active' : '', onclick: () => (setLang(l), render()) }, l.toUpperCase()),
      )),
    ),
    tableSection(),
    kindSection('player'),
    kindSection('team'),
  );
}

export async function mountGenerator(el: HTMLElement) {
  root = el;
  setLang(getLang());
  if (stored) await applyCsv(stored);
  render();
}
