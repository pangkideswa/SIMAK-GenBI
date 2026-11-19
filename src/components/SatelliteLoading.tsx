import React from 'react';

interface SatelliteLoadingProps {
  message?: string;
  submessage?: string;
  fullScreen?: boolean;
}

export const SatelliteLoading: React.FC<SatelliteLoadingProps> = ({
  message = 'MEMUAT SISTEM',
  submessage = 'Komisariat Universitas Majalengka',
  fullScreen = true,
}) => {
  return (
    <div
      className={`${
        fullScreen ? 'fixed inset-0 min-h-screen z-50' : 'w-full py-12'
      } bg-white flex flex-col items-center justify-center p-6 text-slate-800 select-none`}
    >
      {/* Satellite Orbiting Container */}
      <div className="relative w-28 h-28 flex items-center justify-center">
        {/* Orbit Ring */}
        <div className="absolute inset-0 rounded-full border border-blue-200/80" />
        <div className="absolute inset-1.5 rounded-full border border-dashed border-blue-300/40" />

        {/* Orbiting Satellite Dot */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{ animation: 'spin 2.6s linear infinite' }}
        >
          <div className="w-3 h-3 rounded-full bg-blue-600 shadow-sm shadow-blue-500/50 absolute -top-1.5 left-1/2 -translate-x-1/2 ring-2 ring-white" />
        </div>

        {/* Secondary Minor Satellite Dot (Counter-rotation, minimal) */}
        <div
          className="absolute inset-3 pointer-events-none"
          style={{ animation: 'spin-reverse 4.2s linear infinite' }}
        >
          <div className="w-2 h-2 rounded-full bg-amber-500 shadow-sm shadow-amber-500/50 absolute -top-1 left-1/2 -translate-x-1/2 ring-1 ring-white" />
        </div>

        {/* Central Logo GenBI UNMA */}
        <div className="w-14 h-14 rounded-2xl bg-white p-1.5 shadow-sm border border-slate-100 flex items-center justify-center relative z-10">
          <img
            src="/logo-genbi.png"
            alt="GenBI UNMA"
            className="w-full h-full object-contain"
          />
        </div>
      </div>

      {/* Typography */}
      <div className="mt-6 text-center space-y-1">
        <h3 className="text-xs font-black tracking-widest text-slate-800 uppercase">
          {message}
        </h3>
        <p className="text-[11px] text-slate-400 font-medium">
          {submessage}
        </p>
      </div>

      {/* Inline styles for keyframe animation without bloating tailwind config */}
      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        @keyframes spin-reverse {
          from { transform: rotate(360deg); }
          to { transform: rotate(0deg); }
        }
      `}</style>
    </div>
  );
};
