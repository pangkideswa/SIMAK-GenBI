import React from 'react';

interface SatelliteLoaderProps {
  message?: string;
  subMessage?: string;
  fullScreen?: boolean;
}

export const SatelliteLoader: React.FC<SatelliteLoaderProps> = ({
  message = 'Memuat SIMAK GENBI...',
  subMessage = 'Komisariat Universitas Majalengka',
  fullScreen = false,
}) => {
  const content = (
    <div className="flex flex-col items-center justify-center text-center p-4 select-none">
      {/* Satellite Orbital System (Clean SIAPOS Style) */}
      <div className="relative w-28 h-28 flex items-center justify-center">
        {/* Orbit Ring */}
        <div className="absolute inset-0 rounded-full border border-blue-200/90" />
        <div className="absolute inset-1.5 rounded-full border border-dashed border-blue-300/40" />

        {/* Single Orbiting Satellite Dot */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{ animation: 'siapos-spin 2.5s linear infinite' }}
        >
          <div className="w-3 h-3 rounded-full bg-blue-600 shadow-md shadow-blue-500/50 absolute -top-1.5 left-1/2 -translate-x-1/2 ring-2 ring-white" />
        </div>

        {/* Center: Official Logo GenBI UNMA */}
        <div className="w-14 h-14 rounded-2xl bg-white p-1.5 shadow-sm border border-slate-100 flex items-center justify-center relative z-10">
          <img
            src="/logo-genbi.png"
            alt="GenBI UNMA"
            className="w-full h-full object-contain"
          />
        </div>
      </div>

      {/* Loading Typography (Minimalist & Clean) */}
      {message && (
        <div className="mt-5 space-y-1">
          <h4 className="text-xs font-black tracking-widest text-slate-800 uppercase">
            {message}
          </h4>
          {subMessage && (
            <p className="text-[11px] text-slate-400 font-medium">
              {subMessage}
            </p>
          )}
        </div>
      )}

      <style>{`
        @keyframes siapos-spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );

  if (fullScreen) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-white/95 backdrop-blur-md">
        {content}
      </div>
    );
  }

  return content;
};
