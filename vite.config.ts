import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';
import basicSsl from '@vitejs/plugin-basic-ssl';

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    basicSsl(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['logo-genbi.png'],
      manifest: {
        name: 'SIMAK GENBI - Sistem Informasi Manajemen & Keaktifan',
        short_name: 'SIMAK GENBI',
        description: 'Sistem Informasi Manajemen & Keaktifan GenBI Komisariat Universitas Majalengka',
        theme_color: '#1D4ED8',
        background_color: '#F8FAFC',
        display: 'standalone',
        orientation: 'portrait-primary',
        icons: [
          {
            src: '/logo-genbi.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any',
          },
          {
            src: '/logo-genbi.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable',
          },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg}'],
      },
    }),
  ],
  server: {
    host: true, // Listen on all network addresses (0.0.0.0) so phone can access via LAN IP
  },
});
