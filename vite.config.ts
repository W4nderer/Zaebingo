/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

// GitHub Pages serves the project at /Zaebingo/.
export default defineConfig({
  base: '/Zaebingo/',
  plugins: [
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icon.svg'],
      manifest: {
        name: 'Zaebingo',
        short_name: 'Zaebingo',
        description: 'Music bingo: card generator and checker',
        lang: 'ru',
        display: 'standalone',
        background_color: '#ffffff',
        theme_color: '#7c3aed',
        icons: [{ src: 'icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' }],
      },
      workbox: {
        // The bundled Cyrillic font is ~750 KB; keep it available offline.
        globPatterns: ['**/*.{js,css,html,svg,ttf}'],
        maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
      },
    }),
  ],
  // The PDF chunk (pdf-lib + fontkit) is ~1.2 MB but loads only when generating cards.
  build: { chunkSizeWarningLimit: 1500 },
  test: {
    include: ['src/**/*.test.ts'],
  },
});
