import React from 'react';

interface FooterProps {
  className?: string;
  showInstitution?: boolean;
}

export const Footer: React.FC<FooterProps> = ({ className = '', showInstitution = false }) => {
  const rawWa = String(import.meta.env.VITE_SUPERADMIN_WA || '6281233436196').replace(/\D/g, '');
  const waNumber = rawWa.startsWith('0') ? '62' + rawWa.slice(1) : rawWa;
  const waUrl = `https://wa.me/${waNumber}?text=${encodeURIComponent(
    'Halo Admin SIMAK GENBI, saya ingin menanyakan kendala pada sistem.'
  )}`;

  return (
    <footer className={`w-full py-4 px-4 sm:px-6 mt-auto select-none ${className}`}>
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-3">
        <div className="hidden sm:block w-9 shrink-0" aria-hidden="true" />
        <div className="flex-1 text-center space-y-1 text-[10px] sm:text-[11px] font-medium opacity-70 leading-relaxed min-w-0">
          {showInstitution && (
            <p className="text-[9px] sm:text-xs font-black tracking-normal sm:tracking-widest uppercase opacity-85 whitespace-nowrap overflow-hidden text-ellipsis">
              GENBI KOMISARIAT UNIVERSITAS MAJALENGKA
            </p>
          )}
          <p className="flex flex-col sm:flex-row items-center justify-center gap-0.5 sm:gap-1.5">
            <span>&copy; 2026 SIMAK GenBI V1.0 &mdash; Hak Cipta Dilindungi</span>
            <span className="hidden sm:inline">&bull;</span>
            <span>
              Created by{' '}
              <a
                href="https://github.com/pangkideswa"
                target="_blank"
                rel="noopener noreferrer"
                className="font-bold text-blue-500 hover:text-blue-400 hover:underline transition-colors"
              >
                PD-Dev
              </a>
            </span>
          </p>
        </div>

        {/* Tombol Hubungi Super Admin via WhatsApp (Gaya SIAPOS, Kanan Bawah) */}
        <a
          href={waUrl}
          target="_blank"
          rel="noopener noreferrer"
          title="Hubungi Super Admin via WhatsApp"
          aria-label="Hubungi Super Admin via WhatsApp"
          className="print:hidden w-9 h-9 rounded-xl bg-emerald-500/10 hover:bg-emerald-500 text-emerald-600 hover:text-white border border-emerald-500/25 hover:border-emerald-500 shadow-xs flex items-center justify-center transition-all duration-200 hover:scale-105 active:scale-95 shrink-0"
        >
          <svg
            viewBox="0 0 24 24"
            className="w-4 h-4 fill-current"
            aria-hidden="true"
          >
            <path d="M12.04 2c-5.46 0-9.91 4.45-9.91 9.91 0 1.75.46 3.45 1.32 4.95L2.05 22l5.25-1.38c1.45.79 3.08 1.21 4.74 1.21 5.46 0 9.91-4.45 9.91-9.91 0-2.65-1.03-5.14-2.9-7.01A9.816 9.816 0 0 0 12.04 2m.01 1.67c2.2 0 4.26.86 5.82 2.42a8.225 8.225 0 0 1 2.41 5.83c0 4.54-3.7 8.23-8.24 8.23-1.48 0-2.93-.39-4.19-1.15l-.3-.18-3.12.82.83-3.04-.19-.31a8.18 8.18 0 0 1-1.26-4.38c0-4.54 3.7-8.24 8.24-8.24M8.53 7.33c-.17 0-.45.06-.68.31-.23.25-.9.88-.9 2.15s.92 2.49 1.05 2.66c.13.17 1.81 2.77 4.39 3.88.61.26 1.09.42 1.46.54.61.19 1.17.17 1.61.1.49-.07 1.51-.62 1.72-1.21.21-.6.21-1.11.15-1.21-.06-.11-.23-.17-.49-.3-.26-.13-1.51-.75-1.75-.83-.23-.09-.4-.13-.58.13-.17.26-.66.83-.81 1-.15.17-.3.19-.56.06-.26-.13-1.09-.4-2.08-1.28-.77-.69-1.29-1.53-1.44-1.79-.15-.26-.02-.4.11-.53.12-.12.26-.3.39-.45.13-.15.17-.26.26-.43.09-.17.04-.32-.02-.45-.06-.13-.58-1.39-.79-1.91-.21-.5-.42-.43-.58-.44z" />
          </svg>
        </a>
      </div>
    </footer>
  );
};

export default Footer;
