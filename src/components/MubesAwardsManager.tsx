import React, { useState, useEffect } from 'react';
import {
  Trophy,
  Award,
  Lock,
  Globe,
  Vote,
  Pencil,
  X,
  RotateCcw,
} from 'lucide-react';
import {
  getMubesAwardsState,
  toggleAwardsPublish,
  setCategoryWinner,
  resetBphVotes,
  initMubesAwardsRealtime,
  sanitizeAwardsState,
  MUBES_AWARD_CATEGORIES,
  DEFAULT_MUBES_AWARDS,
  MubesAwardsState,
} from '../lib/awardsSync';
import { normalizeStudentId } from '../lib/memberSync';
import { sanitizeMemberIdentity } from '../lib/attendanceSync';

interface BphCandidateItem {
  npm: string;
  nim?: string;
  full_name?: string;
  fullName?: string;
  division?: string;
  role?: string;
  jabatan?: string;
  total_points?: number;
}

interface MubesAwardsManagerProps {
  currentUser?: {
    id: string;
    fullName: string;
    role: string;
    npm?: string;
  };
  members?: BphCandidateItem[];
  events?: Array<{
    id: string;
    title: string;
    category?: string;
    points?: number;
  }>;
  onToast?: (msg: string, type?: 'success' | 'error' | 'info' | 'warning') => void;
}

const DEFAULT_FALLBACK_BPH: BphCandidateItem[] = [
  { npm: '2414101078', fullName: 'Ahmad Fauzi', full_name: 'Ahmad Fauzi', jabatan: 'Ketua Umum', division: 'BPH' },
  { npm: '2214100010', fullName: 'Deden Kurniawan', full_name: 'Deden Kurniawan', jabatan: 'Sekretaris Umum', division: 'BPH' },
  { npm: '2214100025', fullName: 'Siti Rahmawati', full_name: 'Siti Rahmawati', jabatan: 'Bendahara Umum', division: 'BPH' },
];

export const MubesAwardsManager: React.FC<MubesAwardsManagerProps> = ({
  members = [],
  onToast,
}) => {
  const [awardsState, setAwardsState] = useState<MubesAwardsState>(() => getMubesAwardsState());
  const [editingCategory, setEditingCategory] = useState<string | null>(null);

  // Form edit pemenang
  const [winnerName, setWinnerName] = useState('');
  const [winnerDivision, setWinnerDivision] = useState('');
  const [winnerNpm, setWinnerNpm] = useState('');
  const [winnerNotes, setWinnerNotes] = useState('');

  // Selalu sanitasi state
  const safeState = sanitizeAwardsState(awardsState);
  const voterList = Array.isArray(safeState.voterNpms) ? safeState.voterNpms : [];
  const bphVotesMap = safeState.bphVotes || {};
  const winnersMap = safeState.winners || DEFAULT_MUBES_AWARDS.winners;

  const [isTogglingPublish, setIsTogglingPublish] = useState(false);

  useEffect(() => {
    const handleSync = () => setAwardsState(getMubesAwardsState());
    window.addEventListener('simak_awards_sync', handleSync);
    window.addEventListener('storage', handleSync);
    const cleanupRealtime = initMubesAwardsRealtime((state) => {
      if (state) setAwardsState(sanitizeAwardsState(state));
    });
    return () => {
      window.removeEventListener('simak_awards_sync', handleSync);
      window.removeEventListener('storage', handleSync);
      cleanupRealtime();
    };
  }, []);

  const handleTogglePublish = async () => {
    setIsTogglingPublish(true);
    try {
      const nextState = await toggleAwardsPublish();
      setAwardsState(nextState);
      if (onToast) {
        onToast(
          nextState.isPublished
            ? '🎉 Penghargaan Mubes resmi DITERBITKAN ke seluruh anggota & tersinkron ke cloud!'
            : 'Status Penghargaan Mubes dikembalikan ke DRAFT (Rahasia BPH).',
          'success'
        );
      }
    } catch {
      if (onToast) onToast('Gagal menyinkronkan status ke server cloud.', 'error');
    } finally {
      setIsTogglingPublish(false);
    }
  };

  const handleOpenEdit = (catId: string) => {
    const currentWinner = winnersMap[catId];
    setEditingCategory(catId);
    setWinnerName(currentWinner?.winnerName || '');
    setWinnerDivision(currentWinner?.winnerDivision || '');
    setWinnerNpm(currentWinner?.winnerNpm || '');
    setWinnerNotes(currentWinner?.notes || '');
  };

  const handleSaveWinner = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCategory || !winnerName.trim()) return;

    try {
      const nextState = await setCategoryWinner(editingCategory, {
        winnerName: winnerName.trim(),
        winnerDivision: winnerDivision.trim(),
        winnerNpm: winnerNpm.trim(),
        notes: winnerNotes.trim(),
      });

      setAwardsState(nextState);
      setEditingCategory(null);
      if (onToast) {
        onToast('Pemenang penghargaan berhasil diperbarui & tersinkron!', 'success');
      }
    } catch {
      if (onToast) onToast('Gagal menyimpan pemenang ke cloud.', 'error');
    }
  };

  // Helper daftar BPH untuk voting
  const memberList = Array.isArray(members) ? members : [];
  const filteredBph = memberList.filter((m) => {
    const role = (m.role || '').toLowerCase();
    const div = (m.division || '').toUpperCase();
    const jab = (m.jabatan || '').toLowerCase();
    return (
      role === 'admin' ||
      div === 'BPH' ||
      jab.includes('bph') ||
      jab.includes('ketua') ||
      jab.includes('sekretaris') ||
      jab.includes('bendahara')
    );
  });

  const bphCandidates = filteredBph.length > 0 ? filteredBph : DEFAULT_FALLBACK_BPH;

  return (
    <div className="space-y-6">
      {/* Header Panel Awards */}
      <div className="bg-gradient-to-br from-slate-900 via-indigo-950 to-blue-950 p-6 sm:p-8 rounded-[32px] text-white shadow-xl relative overflow-hidden border border-indigo-900/50">
        <div className="absolute top-0 right-0 -mt-10 -mr-10 w-64 h-64 rounded-full bg-blue-500/15 blur-3xl pointer-events-none" />
        <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1.5">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-400/20 text-amber-300 border border-amber-400/30 text-[10px] font-black uppercase tracking-wider">
              <Trophy className="w-3.5 h-3.5 text-amber-400" />
              <span>Musyawarah Besar GenBI UNMA</span>
            </div>
            <h2 className="text-xl sm:text-2xl font-black tracking-tight text-white">
              Sidang & Kurasi Reward Mubes (Annual Awards)
            </h2>
            <p className="text-xs text-slate-300 max-w-xl">
              Pusat penetapan 8 penghargaan resmi akhir kepengurusan. Hasil dapat disimpan secara rahasia sebelum diterbitkan ke aplikasi saat prosesi Mubes.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
            <div className="px-3.5 py-2 rounded-2xl bg-white/10 backdrop-blur-md border border-white/15 flex items-center gap-2">
              <span
                className={`w-2.5 h-2.5 rounded-full ${
                  safeState.isPublished ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'
                }`}
              />
              <div className="text-left">
                <p className="text-[10px] text-slate-300 uppercase font-black">Status Publikasi</p>
                <p className="text-xs font-black">
                  {safeState.isPublished ? 'DITERBITKAN RESMI' : 'DRAFT RAHASIA BPH'}
                </p>
              </div>
            </div>

            <button
              onClick={handleTogglePublish}
              disabled={isTogglingPublish}
              className={`px-5 py-2.5 rounded-2xl text-xs font-black transition shadow-lg cursor-pointer flex items-center justify-center gap-2 disabled:opacity-60 ${
                safeState.isPublished
                  ? 'bg-amber-500 hover:bg-amber-600 text-slate-950 shadow-amber-500/20'
                  : 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-600/30'
              }`}
            >
              {isTogglingPublish ? (
                <span className="flex items-center gap-1.5">
                  <span className="w-3.5 h-3.5 rounded-full border-2 border-white/40 border-t-white animate-spin" />
                  <span>Sinkron Cloud...</span>
                </span>
              ) : safeState.isPublished ? (
                <>
                  <Lock className="w-4 h-4" />
                  <span>Kunci Kembali (Draft)</span>
                </>
              ) : (
                <>
                  <Globe className="w-4 h-4" />
                  <span>Terbitkan ke Aplikasi</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Rekap Perolehan Suara E-Voting BPH Terbaik */}
      <div className="bg-white p-5 sm:p-6 rounded-3xl border border-slate-100 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="p-2.5 rounded-2xl bg-indigo-50 text-indigo-700 border border-indigo-100">
              <Vote className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm sm:text-base font-black text-slate-900">
                Perolehan Suara Voting: BPH Terbaik
              </h3>
              <p className="text-xs text-slate-500">
                Dipilih langsung oleh seluruh Anggota & Kadiv secara mandiri melalui aplikasi ({voterList.length} Suara Masuk)
              </p>
            </div>
          </div>

          {voterList.length > 0 && (
            <button
              type="button"
              onClick={async () => {
                if (confirm('Reset seluruh perolehan suara voting BPH ke 0?')) {
                  const resetState = await resetBphVotes();
                  setAwardsState(resetState);
                  if (onToast) onToast('Perolehan suara voting BPH berhasil direset ke 0 & tersinkron!', 'info');
                }
              }}
              className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-rose-50 text-slate-600 hover:text-rose-600 border border-slate-200 text-xs font-bold transition flex items-center gap-1.5 self-start sm:self-auto cursor-pointer"
              title="Reset seluruh suara voting ke 0"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Reset Suara</span>
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {bphCandidates.length === 0 ? (
            <div className="col-span-full py-4 text-center text-xs text-slate-400">
              Belum ada data pengurus BPH di sistem
            </div>
          ) : (
            bphCandidates.map((rawBph) => {
              const bph = sanitizeMemberIdentity(rawBph);
              const bphId = normalizeStudentId(bph.npm || bph.nim || '');
              let bphName = bph.full_name || bph.fullName || bphId;
              if (bphId === '2414101078' || bphName.toLowerCase().includes('pangki')) {
                bphName = 'Ahmad Fauzi';
              }
              const votes = bphVotesMap[bphId] || 0;
              const totalVotes = Math.max(1, voterList.length);
              const percentage = Math.round((votes / totalVotes) * 100);

              return (
                <div
                  key={bphId}
                  className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/80 hover:border-indigo-300 transition space-y-2"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs font-black text-slate-900">{bphName}</p>
                      <p className="text-[10px] text-slate-500 font-mono">
                        {bph.jabatan || 'Pengurus BPH'} &bull; NPM {bphId}
                      </p>
                    </div>
                    <span className="px-2.5 py-1 rounded-xl bg-indigo-100 text-indigo-900 text-xs font-black">
                      {votes} Suara
                    </span>
                  </div>
                  {/* Progress Bar */}
                  <div className="w-full h-2 rounded-full bg-slate-200 overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-blue-600 to-indigo-600 rounded-full transition-all duration-500"
                      style={{ width: `${percentage}%` }}
                    />
                  </div>
                  <div className="flex justify-between text-[10px] text-slate-400 font-bold">
                    <span>Partisipasi</span>
                    <span>{percentage}% dari total suara</span>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Grid 8 Kartu Kategori Reward Mubes */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {MUBES_AWARD_CATEGORIES.map((cat, idx) => {
          const winner = winnersMap[cat.id] || DEFAULT_MUBES_AWARDS.winners[cat.id];
          const hasWinner = Boolean(winner?.winnerName);

          return (
            <div
              key={cat.id}
              className="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm hover:shadow-md transition space-y-3 relative group"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-amber-50 text-amber-700 border border-amber-200 flex items-center justify-center font-black text-sm shrink-0">
                    #{idx + 1}
                  </div>
                  <div>
                    <h4 className="text-sm font-black text-slate-900">{cat.title}</h4>
                    <p className="text-[11px] text-slate-500">{cat.subtitle}</p>
                  </div>
                </div>

                <button
                  onClick={() => handleOpenEdit(cat.id)}
                  className="p-2 rounded-xl text-blue-600 hover:bg-blue-50 border border-transparent hover:border-blue-200 transition cursor-pointer"
                  title="Tetapkan / Ubah Pemenang"
                >
                  <Pencil className="w-4 h-4" />
                </button>
              </div>

              {/* Box Pemenang Terpilih */}
              <div
                className={`p-3.5 rounded-2xl border transition ${
                  hasWinner
                    ? 'bg-gradient-to-r from-amber-500/10 via-yellow-500/5 to-amber-600/10 border-amber-300'
                    : 'bg-slate-50 border-dashed border-slate-200 text-center'
                }`}
              >
                {hasWinner ? (
                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-black uppercase tracking-wider text-amber-800 flex items-center gap-1">
                        <Award className="w-3 h-3 text-amber-600" />
                        <span>Pemenang Ditetapkan</span>
                      </span>
                      {winner?.winnerDivision && (
                        <span className="px-2 py-0.5 rounded-md bg-white text-slate-700 text-[10px] font-bold border border-slate-200 shadow-xs">
                          {winner.winnerDivision}
                        </span>
                      )}
                    </div>
                    <p className="text-sm font-black text-slate-900">
                      {winner?.winnerName?.toLowerCase().includes('pangki') ? 'Ahmad Fauzi' : winner?.winnerName}
                    </p>
                    {winner?.notes && (
                      <p className="text-xs text-slate-600 italic">"{winner.notes}"</p>
                    )}
                  </div>
                ) : (
                  <p className="text-xs text-slate-400 py-1">Pemenang belum ditetapkan oleh BPH</p>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Modal Dialog Edit / Tetapkan Pemenang */}
      {editingCategory && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-lg rounded-3xl bg-white p-6 shadow-2xl space-y-4 relative border border-slate-100">
            <button
              onClick={() => setEditingCategory(null)}
              className="absolute top-4 right-4 p-2 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="space-y-1">
              <span className="text-[10px] font-black uppercase tracking-wider text-amber-600 bg-amber-50 px-2 py-0.5 rounded-md border border-amber-200">
                Penetapan Resmi BPH
              </span>
              <h3 className="text-base font-black text-slate-900">
                {MUBES_AWARD_CATEGORIES.find((c) => c.id === editingCategory)?.title}
              </h3>
              <p className="text-xs text-slate-500">
                {MUBES_AWARD_CATEGORIES.find((c) => c.id === editingCategory)?.subtitle}
              </p>
            </div>

            <form onSubmit={handleSaveWinner} className="space-y-3.5 pt-2">
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700">Nama Penerima Penghargaan *</label>
                <input
                  type="text"
                  required
                  value={winnerName}
                  onChange={(e) => setWinnerName(e.target.value)}
                  placeholder="Contoh: Ahmad Fauzi atau Nama Proker / Divisi"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-blue-600/30 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700">Divisi Terkait</label>
                  <input
                    type="text"
                    value={winnerDivision}
                    onChange={(e) => setWinnerDivision(e.target.value)}
                    placeholder="Contoh: Publikasi dan Sosialisasi"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-blue-600/30 focus:outline-none"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700">NPM (Opsional)</label>
                  <input
                    type="text"
                    value={winnerNpm}
                    onChange={(e) => setWinnerNpm(e.target.value)}
                    placeholder="Contoh: 2414101078"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-blue-600/30 focus:outline-none"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700">
                  Keterangan / Dedikasi Singkat
                </label>
                <textarea
                  rows={2}
                  value={winnerNotes}
                  onChange={(e) => setWinnerNotes(e.target.value)}
                  placeholder="Contoh: Dedikasi tinggi dalam manajemen operasional dan digitalisasi sistem SIMAK GENBI"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-blue-600/30 focus:outline-none resize-none"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setEditingCategory(null)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 transition cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl text-xs font-black bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white shadow-md shadow-blue-600/25 transition cursor-pointer"
                >
                  Simpan Penetapan
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default MubesAwardsManager;
