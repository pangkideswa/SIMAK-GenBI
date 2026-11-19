import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './index.css';
import { registerSW } from 'virtual:pwa-register';

// Registrasi Service Worker PWA agar terpasang sebagai WebAPK Standalone (tanpa address bar / icon browser)
registerSW({
  immediate: true,
  onNeedRefresh() {
    console.log('[SIMAK GENBI PWA] Versi baru tersedia.');
  },
  onOfflineReady() {
    console.log('[SIMAK GENBI PWA] Aplikasi siap bekerja secara offline.');
  },
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
