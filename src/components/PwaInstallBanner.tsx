import React, { useState, useEffect } from 'react';
import { Download, X, Smartphone, CheckCircle2 } from 'lucide-react';
import { isRunningStandalone, subscribeInstallPrompt, triggerPwaInstall } from '../lib/pwaInstall';

interface PwaInstallBannerProps {
  className?: string;
}

export const PwaInstallBanner: React.FC<PwaInstallBannerProps> = ({ className = '' }) => {
  const [isVisible, setIsVisible] = useState(false);
  const [isDismissed, setIsDismissed] = useState(() => {
    try {
      return sessionStorage.getItem('simak_pwa_banner_dismissed') === 'true';
    } catch {
      return false;
    }
  });
  const [isInstalled, setIsInstalled] = useState(false);
  const [isInstalling, setIsInstalling] = useState(false);
  const [showIosTip, setShowIosTip] = useState(false);
  const [showAndroidTip, setShowAndroidTip] = useState(false);

  useEffect(() => {
    // Jika sudah diinstal dan dibuka di mode aplikasi standalone, tidak perlu tampilkan
    if (isRunningStandalone() || isDismissed) {
      return;
    }

    // Tampilkan banner setelah 1 detik
    const timer = setTimeout(() => {
      setIsVisible(true);
    }, 1000);

    // Dengarkan event native 'beforeinstallprompt' dari browser
    const unsubscribe = subscribeInstallPrompt(() => {});

    return () => {
      clearTimeout(timer);
      unsubscribe();
    };
  }, [isDismissed]);

  const handleInstallClick = async () => {
    setIsInstalling(true);
    const result = await triggerPwaInstall();
    setIsInstalling(false);

    if (result.outcome === 'accepted') {
      setIsInstalled(true);
      setTimeout(() => setIsDismissed(true), 2000);
    } else if (result.outcome === 'dismissed') {
      // User membatalkan dialog browser
      handleDismiss();
    } else {
      // Browser belum menembak deferredPrompt (misal di iOS atau insecure context HTTP LAN)
      const isIos = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
      if (isIos) {
        setShowIosTip(true);
      } else {
        setShowAndroidTip(true);
      }
    }
  };

  const handleDismiss = () => {
    setIsDismissed(true);
    try {
      sessionStorage.setItem('simak_pwa_banner_dismissed', 'true');
    } catch {}
  };

  // Jangan tampilkan jika belum waktunya (delay), sudah di-dismiss dalam sesi ini, atau sudah mode standalone
  if (!isVisible || isDismissed || isRunningStandalone()) {
    return null;
  }

  return (
    <div
      className={`fixed inset-x-0 bottom-0 sm:bottom-6 sm:inset-x-auto sm:right-6 sm:max-w-md z-50 p-4 sm:p-0 animate-in fade-in slide-in-from-bottom-6 duration-300 ${className}`}
    >
      <div className="relative overflow-hidden rounded-3xl bg-slate-950/95 backdrop-blur-2xl border border-blue-500/40 shadow-2xl shadow-blue-950/60 p-5 text-white">
        {/* Glow ambient background khas SIMAK GenBI */}
        <div className="absolute -top-16 -left-16 w-36 h-36 bg-blue-600/35 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-16 -right-16 w-36 h-36 bg-indigo-600/30 rounded-full blur-3xl pointer-events-none" />

        {/* Tombol Tutup Silang */}
        <button
          onClick={handleDismiss}
          className="absolute top-3.5 right-3.5 p-1.5 rounded-full text-slate-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
          aria-label="Tutup"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="relative flex items-center gap-3.5 pr-6">
          {/* Logo / Ikon Khas SIMAK GENBI */}
          <div className="w-13 h-13 rounded-2xl bg-gradient-to-br from-blue-600 via-indigo-600 to-blue-800 p-0.5 shadow-lg shadow-blue-600/40 shrink-0 flex items-center justify-center">
            <div className="w-full h-full bg-slate-950 rounded-[14px] flex items-center justify-center">
              <Download className="w-6 h-6 text-blue-400 animate-bounce" />
            </div>
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <h4 className="text-sm font-black tracking-tight text-white">
                Instal SIMAK GENBI
              </h4>
              <span className="px-1.5 py-0.2 rounded-md bg-blue-500/20 text-blue-300 border border-blue-400/30 text-[9px] font-bold">
                PWA
              </span>
            </div>
            <p className="text-[11px] text-slate-300 leading-snug mt-1">
              Tambahkan ke layar utama untuk akses presensi instan & responsif.
            </p>
          </div>
        </div>

        {showIosTip && (
          <div className="mt-3 p-2.5 rounded-xl bg-blue-900/40 border border-blue-500/30 text-[11px] text-blue-200 leading-relaxed">
            Di iPhone/iPad: Ketuk ikon <strong>Bagikan (Share)</strong> lalu pilih <strong>&quot;Tambah ke Layar Utama&quot;</strong>.
          </div>
        )}

        {showAndroidTip && (
          <div className="mt-3 p-3 rounded-2xl bg-blue-950/60 border border-blue-500/40 text-[11px] text-blue-200 leading-relaxed space-y-1.5 animate-in fade-in duration-200">
            <p className="font-bold text-white flex items-center gap-1.5">
              <span>💡</span> Tips Pemasangan WebAPK Resmi
            </p>
            <p>
              1. Jika sebelumnya sudah ada ikon <strong>SIMAK</strong> di layar utama, silakan <strong>hapus / uninstall ikon lama</strong> tersebut terlebih dahulu.
            </p>
            <p>
              2. Buka menu titik tiga <strong>⋮</strong> di pojok kanan atas Chrome, lalu pilih <strong>&quot;Instal aplikasi&quot;</strong> (pastikan pilih <em>Instal aplikasi</em>, bukan Tambahkan ke Layar Utama).
            </p>
          </div>
        )}

        {/* Action Button */}
        <div className="mt-4 pt-3.5 border-t border-white/10 flex items-center gap-2">
          {isInstalled ? (
            <div className="w-full py-2.5 rounded-xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 flex items-center justify-center gap-2 text-xs font-bold">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              <span>Aplikasi Berhasil Dipasang!</span>
            </div>
          ) : (
            <>
              <button
                onClick={handleInstallClick}
                disabled={isInstalling}
                className="flex-1 py-3 px-4 rounded-xl bg-gradient-to-r from-blue-600 via-blue-500 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 active:scale-[0.98] text-white font-black text-xs flex items-center justify-center gap-2 shadow-lg shadow-blue-600/40 transition-all cursor-pointer"
              >
                <Smartphone className="w-4 h-4" />
                <span>{isInstalling ? 'Memasang Aplikasi...' : 'INSTAL APLIKASI'}</span>
              </button>
              <button
                onClick={handleDismiss}
                className="py-3 px-3.5 rounded-xl bg-white/5 hover:bg-white/10 text-slate-400 hover:text-slate-200 text-xs font-semibold transition cursor-pointer"
              >
                Nanti
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default PwaInstallBanner;
