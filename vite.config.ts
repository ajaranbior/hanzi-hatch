import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// Relative base so the same build works on GitHub Pages (/hanzi-hatch/), a custom domain,
// or inside a Capacitor WebView.
export default defineConfig({
  base: './',
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      manifest: {
        name: 'Hanzi Hatch',
        short_name: 'Hanzi Hatch',
        description: 'Learn Chinese characters, tones, pronunciation and meaning.',
        theme_color: '#c0392b',
        background_color: '#faf7f2',
        display: 'standalone',
        start_url: './',
        icons: [{ src: 'icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any maskable' }],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg}', 'data/hsk.json'],
        maximumFileSizeToCacheInBytes: 5_000_000,
        runtimeCaching: [
          {
            urlPattern: /\/(strokes|data)\/.*\.json$/,
            handler: 'CacheFirst',
            options: { cacheName: 'hanzi-data', expiration: { maxEntries: 12000 } },
          },
        ],
      },
    }),
  ],
  test: { include: ['tests/**/*.test.ts'] },
})
