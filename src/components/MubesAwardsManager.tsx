import React, { useState, useEffect } from 'react';
import {
  Trophy,
  Award,
  Lock,
  Globe,
  Vote,
  Pencil,
  X,
} from 'lucide-react';
import {
  getMubesAwardsState,
  toggleAwardsPublish,
  setCategoryWinner,
  MUBES_AWARD_CATEGORIES,
  MubesAwardsState,
} from '../lib/awardsSync';
import { normalizeStudentId } from '../lib/memberSync';

interface MubesAwardsManagerProps {
  currentUser: {
    id: string;
    fullName: string;
    role: string;
    npm?: string;
  };
  members: Array<{
    npm: string;
    nim?: string;
    full_name?: string;
    fullName?: string;
    division?: string;
    role?: string;
    jabatan?: string;
    total_points?: number;
  }>;
  events?: Array<{
    id: string;
    title: string;
    category?: string;
    points?: number;
  }>;
  onToast?: (msg: string, type?: 'success' | 'error' | 'info' | 'warning') => void;
}

export const MubesAwardsManager: React.FC<MubesAwardsManagerProps> = ({
  members,
  events = [],
  onToast,
}) => {
  const [awardsState, setAwardsState] = useState<MubesAwardsState>(getMubesAwardsState());
  const [editingCategory, setEditingCategory] = useState<string | null>(null);

  // Form edit pemenang
  const [winnerName, setWinnerName] = useState('');
  const [winnerDivision, setWinnerDivision] = useState('');
  const [winnerNpm, setWinnerNpm] = useState('');
  const [winnerNotes, setWinnerNotes] = useState('');

  useEffect(() => {
    const handleSync = () => setAwardsState(getMubesAwardsState());
    window.addEventListener('simak_awards_sync', handleSync);
    return () => window.removeEventListener('simak_awards_sync', handleSync);
  }, []);

  const handleTogglePublish = () => {
    const nextState = toggleAwardsPublish();
    setAwardsState(nextState);
    if (onToast) {
      onToast(
        nextState.isPublished
          ? '🎉 Penghargaan Mubes resmi DITERBITKAN ke seluruh anggota!'
          : 'Status Penghargaan Mubes dikembalikan ke DRAFT (Rahasia BPH).',
        'success'
      );
    }
  };

  const handleOpenEdit = (catId: string) => {
    const currentWinner = awardsState.winners[catId];
    setEditingCategory(catId);
    setWinnerName(currentWinner?.winnerName || '');
    setWinnerDivision(currentWinner?.winnerDivision || '');
    setWinnerNpm(currentWinner?.winnerNpm || '');
    setWinnerNotes(currentWinner?.notes || '');
  };

  const handleSaveWinner = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCategory || !winnerName.trim()) return;

    const nextState = setCategoryWinner(editingCategory, {
      winnerName: winnerName.trim(),
      winnerDivision: winnerDivision.trim(),
      winnerNpm: winnerNpm.trim(),
      notes: winnerNotes.trim(),
    });

    setAwardsState(nextState);
    setEditingCategory(null);
    if (onToast) {
      onToast('Pemenang penghargaan berhasil diperbarui!', 'success');
    }
  };

  // Helper daftar BPH untuk voting
  const bphCandidates = members.filter((m) => {
    const role = m.role || '';
    const div = m.division || '';
    const jab = m.jabatan || '';
    return role === 'admin' || div === 'BPH' || jab.toLowerCase().includes('bph') || jab === 'Ketua';
  });

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
                  awardsState.isPublished ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'
                }`}
              />
              <div className="text-left">
                <p className="text-[10px] text-slate-300 uppercase font-black">Status Publikasi</p>
                <p className="text-xs font-black">
                  {awardsState.isPublished ? 'DITERBITKAN RESMI' : 'DRAFT RAHASIA BPH'}
                </p>
              </div>
            </div>

            <button
              onClick={handleTogglePublish}
              className={`px-5 py-2.5 rounded-2xl text-xs font-black transition shadow-lg cursor-pointer flex items-center justify-center gap-2 ${
                awardsState.isPublished
                  ? 'bg-amber-500 hover:bg-amber-600 text-slate-950 shadow-amber-500/20'
                  : 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-600/30'
              }`}
            >
              {awardsState.isPublished ? (
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
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2.5 rounded-2xl bg-indigo-50 text-indigo-700 border border-indigo-100">
              <Vote className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm sm:text-base font-black text-slate-900">
                Perolehan Suara Voting: BPH Terbaik
              </h3>
              <p className="text-xs text-slate-500">
                Dipilih langsung oleh seluruh Anggota & Kadiv secara mandiri melalui aplikasi ({awardsState.voterNpms.length} Suara Masuk)
              </p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {bphCandidates.length === 0 ? (
            <div className="col-span-full py-4 text-center text-xs text-slate-400">
              Belum ada data pengurus BPH di sistem
            </div>
          ) : (
            bphCandidates.map((bph) => {
              const bphId = normalizeStudentId(bph.npm || bph.nim || '');
              const bphName = bph.full_name || bph.fullName || bphId;
              const votes = awardsState.bphVotes[bphId] || 0;
              const totalVotes = Math.max(1, awardsState.voterNpms.length);
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
          const winner = awardsState.winners[cat.id];
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
                      {winner.winnerDivision && (
                        <span className="px-2 py-0.5 rounded-md bg-white text-slate-700 text-[10px] font-bold border border-slate-200 shadow-xs">
                          {winner.winnerDivision}
                        </span>
                      )}
                    </div>
                    <p className="text-sm font-black text-slate-900">{winner.winnerName}</p>
                    {winner.notes && (
                      <p className="text-xs text-slate-600 italic">"{winner.notes}"</p>
                    )}
                  </div>
                ) : (
                  <div className="py-2 text-slate-400 text-xs font-bold">
                    Belum ada pemenang ditetapkan untuk kategori ini
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Modal Edit Pemenang */}
      {editingCategory && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-md rounded-[32px] bg-white p-6 shadow-2xl space-y-4 relative border border-slate-100">
            <button
              onClick={() => setEditingCategory(null)}
              className="absolute top-4 right-4 p-2 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            <div>
              <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md bg-amber-50 text-amber-700 text-[10px] font-black uppercase tracking-wider mb-1 border border-amber-200">
                <Trophy className="w-3 h-3 text-amber-600" />
                <span>Penetapan Pemenang Mubes</span>
              </div>
              <h3 className="text-base font-black text-slate-900">
                {MUBES_AWARD_CATEGORIES.find((c) => c.id === editingCategory)?.title}
              </h3>
              <p className="text-xs text-slate-500">
                {MUBES_AWARD_CATEGORIES.find((c) => c.id === editingCategory)?.subtitle}
              </p>
            </div>

            <form onSubmit={handleSaveWinner} className="space-y-3.5 text-left pt-1">
              {/* Dropdown Cepat dari Daftar Anggota / Proker */}
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-slate-600 uppercase">
                  Pilih Cepat Kandidat Terdaftar
                </label>
                <select
                  onChange={(e) => {
                    const val = e.target.value;
                    if (!val) return;
                    if (editingCategory === 'proker-terbaik') {
                      const matchedEv = events.find((ev) => ev.title === val);
                      if (matchedEv) {
                        setWinnerName(matchedEv.title);
                        setWinnerDivision(matchedEv.category || 'Program Kerja');
                      }
                    } else if (editingCategory === 'best-division' || editingCategory === 'divisi-terkompak') {
                      setWinnerName(`Divisi ${val}`);
                      setWinnerDivision(val);
                    } else {
                      const matchedMem = members.find(
                        (m) => (m.full_name || m.fullName) === val || m.npm === val
                      );
                      if (matchedMem) {
                        setWinnerName(matchedMem.full_name || matchedMem.fullName || '');
                        setWinnerDivision(matchedMem.division || '');
                        setWinnerNpm(matchedMem.npm || matchedMem.nim || '');
                      }
                    }
                  }}
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-600/30 focus:outline-none bg-white font-medium"
                >
                  <option value="">-- Pilih dari data sistem --</option>
                  {editingCategory === 'proker-terbaik' ? (
                    events.map((ev) => (
                      <option key={ev.id} value={ev.title}>
                        {ev.title} ({ev.category || 'Proker'})
                      </option>
                    ))
                  ) : editingCategory === 'best-division' || editingCategory === 'divisi-terkompak' ? (
                    [
                      'Publikasi dan Sosialisasi',
                      'Lingkungan Hidup',
                      'Pendidikan',
                      'Pengabdian Masyarakat',
                      'Kewirausahaan',
                      'BPH',
                    ].map((d) => (
                      <option key={d} value={d}>
                        Divisi {d}
                      </option>
                    ))
                  ) : (
                    members.map((m) => {
                      const name = m.full_name || m.fullName || m.npm;
                      return (
                        <option key={m.npm || m.nim} value={name}>
                          {name} ({m.division || 'Umum'})
                        </option>
                      );
                    })
                  )}
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-bold text-slate-600 uppercase">
                  Nama Penerima Penghargaan
                </label>
                <input
                  type="text"
                  required
                  value={winnerName}
                  onChange={(e) => setWinnerName(e.target.value)}
                  placeholder="Contoh: Nama Anggota / Nama Proker"
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-600/30 focus:outline-none font-bold"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-bold text-slate-600 uppercase">
                  Divisi Asal / Penyelenggara
                </label>
                <input
                  type="text"
                  value={winnerDivision}
                  onChange={(e) => setWinnerDivision(e.target.value)}
                  placeholder="Contoh: Pendidikan / Publikasi dan Sosialisasi"
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-600/30 focus:outline-none"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-bold text-slate-600 uppercase">
                  Catatan Prestasi / Alasan Apresiasi
                </label>
                <textarea
                  rows={2}
                  value={winnerNotes}
                  onChange={(e) => setWinnerNotes(e.target.value)}
                  placeholder="Contoh: Dedikasi luar biasa dalam menyukseskan program kerja..."
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-600/30 focus:outline-none resize-none"
                />
              </div>

              <div className="pt-2 flex gap-2">
                <button
                  type="button"
                  onClick={() => setEditingCategory(null)}
                  className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-bold text-xs rounded-xl shadow-md shadow-blue-600/25 transition cursor-pointer"
                >
                  Simpan Pemenang
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
