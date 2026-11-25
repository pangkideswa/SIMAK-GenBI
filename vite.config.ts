// @ts-nocheck
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';
import basicSsl from '@vitejs/plugin-basic-ssl';
import fs from 'node:fs';
import path from 'node:path';

// Plugin sinkronisasi otomatis status Mubes Awards & Agenda Events antara Desktop & Mobile HP di jaringan LAN
function mubesAwardsSyncPlugin() {
  const mubesFilePath = path.resolve(__dirname, 'public/mubes-awards-cloud.json');
  const eventsFilePath = path.resolve(__dirname, 'public/events-cloud.json');
  const evalFilePath = path.resolve(__dirname, 'public/evaluations-cloud.json');
  let mubesMemoryCache: any = null;
  let eventsMemoryCache: any = null;
  let evaluationsMemoryCache: any = null;

  const loadEventsFromFile = () => {
    if (eventsMemoryCache) return eventsMemoryCache;
    if (fs.existsSync(eventsFilePath)) {
      try {
        const content = fs.readFileSync(eventsFilePath, 'utf-8');
        eventsMemoryCache = JSON.parse(content);
        return eventsMemoryCache;
      } catch {}
    }
    return [];
  };

  const ipRequests = new Map();
  const checkRate = (ip: string, limit = 60) => {
    const now = Date.now();
    const entry = ipRequests.get(ip);
    if (!entry || entry.resetAt <= now) {
      ipRequests.set(ip, { count: 1, resetAt: now + 60000 });
      return true;
    }
    if (entry.count >= limit) return false;
    entry.count++;
    return true;
  };

  return {
    name: 'lan-sync-plugin',
    configureServer(server: any) {
      // Middleware Rate Limiter Global
      server.middlewares.use((req: any, res: any, next: any) => {
        if (req.url && (req.url.startsWith('/api/events') || req.url.startsWith('/api/mubes-awards') || req.url.startsWith('/api/evaluations'))) {
          const clientIp = req.socket?.remoteAddress || 'lan-client';
          if (!checkRate(clientIp, 60)) {
            res.statusCode = 429;
            res.setHeader('Content-Type', 'application/json');
            res.setHeader('Retry-After', '30');
            res.end(JSON.stringify({ error: 'Rate limit exceeded. Silakan coba 30 detik lagi.' }));
            return;
          }
        }
        next();
      });

      // 1. API Events Sync (Buat/Edit/Kunci/Hapus Acara Lintas Perangkat)
      server.middlewares.use('/api/events', (req: any, res: any, next: any) => {
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

        if (req.method === 'OPTIONS') {
          res.statusCode = 204;
          res.end();
          return;
        }

        if (req.method === 'GET') {
          res.setHeader('Content-Type', 'application/json');
          const list = loadEventsFromFile();
          res.end(JSON.stringify(list));
          return;
        }

        if (req.method === 'POST') {
          let body = '';
          req.on('data', (chunk: any) => {
            body += chunk;
          });
          req.on('end', () => {
            try {
              const payload = JSON.parse(body);
              let currentList = [...loadEventsFromFile()];

              if (payload.action === 'save' && payload.event) {
                const idx = currentList.findIndex((e: any) => e.id === payload.event.id);
                if (idx >= 0) {
                  currentList[idx] = { ...currentList[idx], ...payload.event };
                } else {
                  currentList.unshift(payload.event);
                }
              } else if (payload.action === 'delete' && payload.eventId) {
                currentList = currentList.filter((e: any) => e.id !== payload.eventId);
              } else if (payload.action === 'toggleLock' && payload.eventId) {
                currentList = currentList.map((e: any) =>
                  e.id === payload.eventId ? { ...e, is_active: payload.nextStatus } : e
                );
              }

              eventsMemoryCache = currentList;
              fs.writeFileSync(eventsFilePath, JSON.stringify(currentList, null, 2), 'utf-8');
            } catch (e) {
              console.error('Error handling /api/events POST:', e);
            }
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ success: true, count: eventsMemoryCache?.length || 0 }));
          });
          return;
        }

        next();
      });

      // 2. API Mubes Awards Sync (Publikasi & Voting BPH Lintas Perangkat)
      server.middlewares.use('/api/mubes-awards', (req: any, res: any, next: any) => {
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

        if (req.method === 'OPTIONS') {
          res.statusCode = 204;
          res.end();
          return;
        }

        if (req.method === 'GET') {
          res.setHeader('Content-Type', 'application/json');
          if (mubesMemoryCache) {
            res.end(JSON.stringify(mubesMemoryCache));
            return;
          }
          if (fs.existsSync(mubesFilePath)) {
            try {
              const fileContent = fs.readFileSync(mubesFilePath, 'utf-8');
              res.end(fileContent);
              return;
            } catch {}
          }
          res.end(JSON.stringify({ isPublished: true }));
          return;
        }

        if (req.method === 'POST') {
          let body = '';
          req.on('data', (chunk: any) => {
            body += chunk;
          });
          req.on('end', () => {
            try {
              const parsed = JSON.parse(body);
              mubesMemoryCache = parsed;
              fs.writeFileSync(mubesFilePath, JSON.stringify(parsed, null, 2), 'utf-8');
            } catch (e) {
              console.error('Error writing mubes-awards-cloud.json:', e);
            }
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ success: true }));
          });
          return;
        }

        next();
      });

      // 3. API Evaluations Sync (Sinkronisasi Leaderboard Lintas Perangkat)
      server.middlewares.use('/api/evaluations', (req: any, res: any, next: any) => {
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

        if (req.method === 'OPTIONS') {
          res.statusCode = 204;
          res.end();
          return;
        }

        if (req.method === 'GET') {
          res.setHeader('Content-Type', 'application/json');
          if (evaluationsMemoryCache) {
            res.end(JSON.stringify(evaluationsMemoryCache));
            return;
          }
          if (fs.existsSync(evalFilePath)) {
            try {
              const fileContent = fs.readFileSync(evalFilePath, 'utf-8');
              evaluationsMemoryCache = JSON.parse(fileContent);
              res.end(fileContent);
              return;
            } catch {}
          }
          res.end(JSON.stringify([]));
          return;
        }

        if (req.method === 'POST') {
          let body = '';
          req.on('data', (chunk: any) => {
            body += chunk;
          });
          req.on('end', () => {
            try {
              const parsed = JSON.parse(body);
              const payload = parsed.evaluation || parsed;
              let list = evaluationsMemoryCache;
              if (!list && fs.existsSync(evalFilePath)) {
                try {
                  list = JSON.parse(fs.readFileSync(evalFilePath, 'utf-8'));
                } catch {}
              }
              if (!Array.isArray(list)) list = [];
              const targetNpm = String(payload.npm || payload.nim || payload.user_id || '').trim().toLowerCase();
              if (targetNpm) {
                if (typeof payload.total_points === 'number') {
                  payload.total_points = Math.min(100, Math.max(0, payload.total_points));
                }
                const rawName = String(payload.full_name || payload.fullName || '').toLowerCase();
                if (rawName.includes('pangki') || targetNpm === '2414101078') {
                  payload.full_name = 'Ahmad Fauzi';
                  payload.fullName = 'Ahmad Fauzi';
                  payload.avatar_url = null;
                }
                const idx = list.findIndex(
                  (m: any) =>
                    String(m.npm || m.nim || '').trim().toLowerCase() === targetNpm ||
                    m.user_id === payload.user_id
                );
                if (idx >= 0) {
                  list[idx] = { ...list[idx], ...payload };
                } else {
                  list.push(payload);
                }
                list.sort((a: any, b: any) => (b.total_points || 0) - (a.total_points || 0));
                evaluationsMemoryCache = list;
                fs.writeFileSync(evalFilePath, JSON.stringify(list, null, 2), 'utf-8');
              }
            } catch (e) {
              console.error('Error writing evaluations-cloud.json:', e);
            }
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ success: true }));
          });
          return;
        }

        next();
      });
    },
  };
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    mubesAwardsSyncPlugin(),
    react(),
    tailwindcss(),
    basicSsl(),
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: 'auto',
      includeAssets: ['logo-genbi.png', 'logo-BI.png', 'pwa-192.png', 'pwa-maskable-192.png', 'pwa-512.png', 'pwa-maskable-512.png'],
      manifest: {
        name: 'SIMAK GENBI - Sistem Informasi Manajemen & Keaktifan',
        short_name: 'SIMAK',
        description: 'Sistem Informasi Manajemen & Keaktifan GenBI Komisariat Universitas Majalengka',
        start_url: '/',
        display: 'standalone',
        background_color: '#FFFFFF',
        theme_color: '#1D4ED8',
        orientation: 'portrait-primary',
        icons: [
          {
            src: '/pwa-192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any',
          },
          {
            src: '/pwa-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any',
          },
          {
            src: '/pwa-maskable-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
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
