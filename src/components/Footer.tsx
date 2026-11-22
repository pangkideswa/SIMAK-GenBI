import React from 'react';

interface FooterProps {
  className?: string;
}

export const Footer: React.FC<FooterProps> = ({ className = '' }) => {
  return (
    <footer className={`w-full py-4 px-4 mt-auto text-center select-none ${className}`}>
      <div className="max-w-4xl mx-auto">
        <p className="text-[10px] sm:text-[11px] font-medium opacity-70 tracking-normal leading-relaxed">
          &copy; 2026 SIMAK GenBI V1.0 &mdash; Hak Cipta Dilindungi | Created by{' '}
          <a
            href="https://github.com/pangkideswa"
            target="_blank"
            rel="noopener noreferrer"
            className="font-bold text-blue-500 hover:text-blue-400 hover:underline transition-colors inline-block"
          >
            PD-Dev
          </a>
        </p>
      </div>
    </footer>
  );
};

export default Footer;
