/**
 * SIMAK GENBI PWA Install Manager
 * Menangkap event 'beforeinstallprompt' dari browser Chrome / Edge / Android
 * dan menyediakan antarmuka 1-klik untuk instalasi instan (WebAPK) tanpa harus membuka menu titik tiga.
 */

let deferredPrompt: any = null;
const listeners = new Set<(canInstall: boolean) => void>();

if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e: any) => {
    // Cegah mini-infobar default browser agar bisa digantikan oleh banner khas SIMAK GENBI
    e.preventDefault();
    deferredPrompt = e;
    listeners.forEach((fn) => fn(true));
  });

  window.addEventListener('appinstalled', () => {
    deferredPrompt = null;
    listeners.forEach((fn) => fn(false));
  });
}

/**
 * Cek apakah aplikasi sedang berjalan dalam mode Standalone PWA / WebAPK terinstal
 */
export function isRunningStandalone(): boolean {
  if (typeof window === 'undefined') return false;
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (window.navigator as any).standalone === true ||
    document.referrer.includes('android-app://')
  );
}

/**
 * Cek apakah browser siap menampilkan prompt instalasi
 */
export function canPromptInstall(): boolean {
  return deferredPrompt !== null;
}

/**
 * Subscribe terhadap perubahan ketersediaan install prompt
 */
export function subscribeInstallPrompt(callback: (canInstall: boolean) => void): () => void {
  listeners.add(callback);
  callback(deferredPrompt !== null);
  return () => {
    listeners.delete(callback);
  };
}

/**
 * Memicu dialog native instalasi PWA ke layar utama pengguna
 */
export async function triggerPwaInstall(): Promise<{ outcome: 'accepted' | 'dismissed' | 'unsupported' }> {
  if (!deferredPrompt) {
    // Tunggu hingga 2.5 detik jika event beforeinstallprompt browser masih dalam proses negosiasi
    await new Promise<void>((resolve) => {
      let resolved = false;
      const unsubs = subscribeInstallPrompt((canInstall) => {
        if (canInstall && !resolved) {
          resolved = true;
          unsubs();
          resolve();
        }
      });
      setTimeout(() => {
        if (!resolved) {
          resolved = true;
          unsubs();
          resolve();
        }
      }, 2500);
    });
  }

  if (!deferredPrompt) {
    return { outcome: 'unsupported' };
  }

  try {
    deferredPrompt.prompt();
    const choiceResult = await deferredPrompt.userChoice;
    deferredPrompt = null;
    listeners.forEach((fn) => fn(false));
    return { outcome: choiceResult.outcome };
  } catch {
    return { outcome: 'unsupported' };
  }
}
