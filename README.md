# Zaebingo

PWA для музыкального бинго на 90 треков: генератор карточек для печати и проверка карточек по QR. Требования — в [SPEC.md](SPEC.md).

## Разработка

Нужен Node.js 22+.

```bash
npm install
npm run dev      # http://localhost:5173/Zaebingo/
npm test         # тесты ядра и рендера PDF
npm run build    # сборка в dist/
```

## Устройство

- `src/core` — логика без DOM: разбор таблички, идентификатор серии, генерация карточек, формат QR, условия победы.
- `src/pdf` — разметка карточек, подбор шрифта под клетку, рендер PDF (pdf-lib).
- `src/ui` — страница генератора, переводы ru/en.

Сайт публикуется на GitHub Pages workflow-ом `.github/workflows/deploy.yml` при пуше в `main`.
