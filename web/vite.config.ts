import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icon.svg', 'icons/apple-touch-icon.png'],
      manifest: {
        name: 'Contatos',
        short_name: 'Contatos',
        description: 'Lista de pessoas por data e turno.',
        lang: 'pt-BR',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        orientation: 'portrait',
        theme_color: '#000000',
        background_color: '#000000',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: 'icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
          { src: 'icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,woff2,webmanifest}'],
        navigateFallback: 'index.html',
        // a API nunca é interceptada: o app fala com ela pelo cliente próprio
        navigateFallbackDenylist: [/^\/api\//],
        cleanupOutdatedCaches: true,
      },
    }),
  ],
});
