/// <reference types="vitest" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'
import path from 'path'

export default defineConfig({
  base: '/',
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'prompt',
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,json}'],
        runtimeCaching: [
          {
            urlPattern: /\/catalog\/.*/i,
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'catalog-cache',
              expiration: { maxEntries: 50, maxAgeSeconds: 60 * 60 * 24 * 7 }, // 7 days
            },
          },
        ],
        navigateFallback: 'index.html',
      },
      manifest: {
        name: 'RackPro - Rack Mount Panel Configurator',
        short_name: 'RackPro',
        description: 'Design custom rack mount panels with real equipment dimensions',
        theme_color: '#0c0d11',
        background_color: '#0c0d11',
        display: 'standalone',
        start_url: '/',
        // TODO: Add PWA icons for full install prompt support
        // icons: [
        //   { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
        //   { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
        // ],
      },
    }),
  ],
  server: {
    allowedHosts: ['dannyboi.prodro.pro'],
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  test: {
    globals: true,
  },
})
