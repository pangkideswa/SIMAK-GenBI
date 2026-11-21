import React, { useState, useEffect } from 'react';
import {
  Trophy,
  Vote,
  CheckCircle2,
  Lock,
} from 'lucide-react';
import {
  getMubesAwardsState,
  submitBphVote,
  MubesAwardsState,
  MUBES_AWARD_CATEGORIES,
} from '../lib/awardsSync';
import { normalizeStudentId } from '../lib/memberSync';

interface MubesAwardsMemberViewProps {
  currentUser: {
    id: string;
    fullName: string;
    role: string;
    npm?: string;
    nim?: string;
    division?: string;
  };
  bphMembers: Array<{
    npm: string;
    nim?: string;
    full_name?: string;
    fullName?: string;
    jabatan?: string;
    division?: string;
    avatar_url?: string | null;
  }>;
  onToast?: (msg: string, type?: 'success' | 'error' | 'info' | 'warning') => void;
}

export const MubesAwardsMemberView: React.FC<MubesAwardsMemberViewProps> = ({
  currentUser,
  bphMembers,
  onToast,
}) => {
  const [awardsState, setAwardsState] = useState<MubesAwardsState>(getMubesAwardsState());
  const [selectedBphNpm, setSelectedBphNpm] = useState<string>('');
  const [isSubmittingVote, setIsSubmittingVote] = useState(false);

  const cleanUserNpm = normalizeStudentId(currentUser.npm || currentUser.nim || '');
  const hasVoted = awardsState.voterNpms.includes(cleanUserNpm);
  const isBphUser = currentUser.role === 'admin' || currentUser.division === 'BPH';

  useEffect(() => {
    const handleSync = () => setAwardsState(getMubesAwardsState());
    window.addEventListener('simak_awards_sync', handleSync);
    return () => window.removeEventListener('simak_awards_sync', handleSync);
  }, []);

  const handleVote = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedBphNpm) {
      if (onToast) onToast('Pilih salah satu kandidat BPH terlebih dahulu.', 'warning');
      return;
    }

    setIsSubmittingVote(true);
    const result = submitBphVote(cleanUserNpm, selectedBphNpm);
    setIsSubmittingVote(false);

    if (result.success) {
      if (onToast) onToast(result.message, 'success');
      setAwardsState(getMubesAwardsState());
    } else {
      if (onToast) onToast(result.message, 'error');
    }
  };

  return (
    <div className="space-y-6">
      {/* 1. SEKSI E-VOTING BPH TERBAIK (Hanya untuk non-BPH) */}
      {!isBphUser && (
        <div className="bg-gradient-to-br from-indigo-900 via-blue-900 to-slate-900 rounded-[32px] p-6 sm:p-8 text-white shadow-xl relative overflow-hidden border border-blue-700/40">
          <div className="absolute top-0 right-0 -mt-10 -mr-10 w-64 h-64 rounded-full bg-cyan-400/10 blur-3xl pointer-events-none" />

          <div className="relative z-10 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="space-y-1">
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-cyan-400/20 text-cyan-300 border border-cyan-400/30 text-[10px] font-black uppercase tracking-wider">
                  <Vote className="w-3.5 h-3.5 text-cyan-300" />
                  <span>Bilik Suara Digital Mubes</span>
                </div>
                <h3 className="text-lg sm:text-xl font-black text-white">
                  Voting Rahasia: BPH Terbaik Pilihanmu
                </h3>
                <p className="text-xs text-blue-200 max-w-xl">
                  Beri apresiasi setinggi-tingginya kepada pengurus Badan Pengurus Harian (BPH) yang dinilai paling responsif, berdedikasi, dan melayani anggota dengan tulus.
                </p>
              </div>

              {hasVoted ? (
                <div className="inline-flex items-center gap-2 px-4 py-2 rounded-2xl bg-emerald-500/20 text-emerald-300 border border-emerald-400/40 text-xs font-black self-start sm:self-center">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  <span>Hak Suara Terpakai (Terkunci)</span>
                </div>
              ) : (
                <div className="inline-flex items-center gap-2 px-4 py-2 rounded-2xl bg-amber-500/20 text-amber-300 border border-amber-400/40 text-xs font-black self-start sm:self-center">
                  <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
                  <span>1 Akun = 1 Suara Anonim</span>
                </div>
              )}
            </div>

            {hasVoted ? (
              <div className="p-4 rounded-2xl bg-white/10 backdrop-blur-md border border-white/15 text-xs text-slate-200">
                Terima kasih telah berpartisipasi dalam voting demokratis Mubes GenBI UNMA. Pilihan suara Anda telah tersimpan secara rahasia dan akan diumumkan pada puncak prosesi Musyawarah Besar!
              </div>
            ) : (
              <form onSubmit={handleVote} className="space-y-4 pt-2">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {bphMembers.length === 0 ? (
                    <div className="col-span-full py-4 text-center text-xs text-blue-300">
                      Daftar kandidat pengurus BPH sedang dimuat...
                    </div>
                  ) : (
                    bphMembers.map((bph) => {
                      const bphId = normalizeStudentId(bph.npm || bph.nim || '');
                      const bphName = bph.full_name || bph.fullName || bphId;
                      const isSelected = selectedBphNpm === bphId;

                      return (
                        <label
                          key={bphId}
                          onClick={() => setSelectedBphNpm(bphId)}
                          className={`p-3.5 rounded-2xl border transition-all cursor-pointer flex items-center gap-3 select-none ${
                            isSelected
                              ? 'bg-blue-600/40 border-cyan-400 ring-2 ring-cyan-400 shadow-lg'
                              : 'bg-white/5 border-white/10 hover:bg-white/10 hover:border-white/20'
                          }`}
                        >
                          <input
                            type="radio"
                            name="bph_candidate"
                            value={bphId}
                            checked={isSelected}
                            onChange={() => setSelectedBphNpm(bphId)}
                            className="hidden"
                          />
                          <div
                            className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition ${
                              isSelected
                                ? 'border-cyan-400 bg-cyan-400 text-slate-950 font-bold text-xs'
                                : 'border-slate-400'
                            }`}
                          >
                            {isSelected && '✓'}
                          </div>
                          <div className="min-w-0">
                            <p className="text-xs font-black text-white truncate">{bphName}</p>
                            <p className="text-[10px] text-cyan-200/80 font-mono">
                              {bph.jabatan || 'Pengurus BPH'} &bull; {bphId}
                            </p>
                          </div>
                        </label>
                      );
                    })
                  )}
                </div>

                <div className="flex justify-end">
                  <button
                    type="submit"
                    disabled={isSubmittingVote || !selectedBphNpm}
                    className="w-full sm:w-auto px-6 py-3 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-slate-950 font-black text-xs rounded-xl shadow-lg shadow-cyan-500/25 transition cursor-pointer disabled:opacity-50"
                  >
                    {isSubmittingVote ? 'Mengirim Suara...' : 'Kirim Suara Rahasia (Kunci Pilihan)'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* 2. PANGGUNG PENGHARGAAN (HALL OF FAME MUBES) */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <h3 className="text-base sm:text-lg font-black text-slate-900 tracking-tight flex items-center gap-2">
              <Trophy className="w-5 h-5 text-amber-500" />
              <span>Hall of Fame: Peraih Penghargaan Mubes</span>
            </h3>
            <p className="text-xs text-slate-500">
              Apresiasi resmi akhir kepengurusan bagi pengurus, anggota, dan divisi terbaik GenBI UNMA.
            </p>
          </div>
        </div>

        {!awardsState.isPublished ? (
          <div className="p-8 rounded-[28px] bg-slate-50 border border-dashed border-slate-200 text-center space-y-2">
            <Lock className="w-8 h-8 text-slate-300 mx-auto" />
            <h4 className="text-sm font-bold text-slate-700">Penghargaan Masih Dirahasiakan</h4>
            <p className="text-xs text-slate-400 max-w-md mx-auto">
              BPH sedang merampungkan kurasi dan voting. Pengumuman 8 peraih reward akan dibuka resmi saat prosesi awarding Musyawarah Besar berlangsung.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
            {MUBES_AWARD_CATEGORIES.map((cat, idx) => {
              const winner = awardsState.winners[cat.id];
              return (
                <div
                  key={cat.id}
                  className="p-4 rounded-3xl bg-gradient-to-br from-amber-500/10 via-yellow-500/5 to-amber-600/10 border-2 border-amber-300 shadow-xs hover:shadow-md transition space-y-2.5 relative overflow-hidden flex flex-col justify-between"
                >
                  <div className="space-y-1">
                    <span className="inline-block px-2 py-0.5 rounded-md bg-amber-400 text-slate-950 text-[9px] font-black uppercase tracking-wider shadow-xs">
                      #{idx + 1} &bull; {cat.title}
                    </span>
                    <h5 className="text-xs font-black text-slate-900 line-clamp-1">
                      {winner?.winnerName || 'Belum Diumumkan'}
                    </h5>
                    {winner?.winnerDivision && (
                      <p className="text-[10px] text-slate-500 font-medium">
                        Divisi {winner.winnerDivision}
                      </p>
                    )}
                  </div>

                  {winner?.notes && (
                    <p className="text-[10px] text-slate-600 italic line-clamp-2 border-t border-amber-200/60 pt-1.5">
                      "{winner.notes}"
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
