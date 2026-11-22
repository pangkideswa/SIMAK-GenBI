import React from 'react';

interface FooterProps {
  className?: string;
  showInstitution?: boolean;
}

export const Footer: React.FC<FooterProps> = ({ className = '', showInstitution = false }) => {
  return (
    <footer className={`w-full py-4 px-4 mt-auto text-center select-none ${className}`}>
      <div className="max-w-4xl mx-auto space-y-1 text-[10px] sm:text-[11px] font-medium opacity-70 leading-relaxed">
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
    </footer>
  );
};

export default Footer;
