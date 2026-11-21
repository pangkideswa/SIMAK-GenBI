// Sistem Manajemen Reward Mubes & E-Voting BPH Terbaik SIMAK GENBI

export interface MubesRewardWinner {
  id: string; // key kategori, misal: 'kadiv-terbaik', 'bph-terbaik', dll.
  categoryTitle: string;
  categorySubtitle: string;
  winnerName: string;
  winnerNpm?: string;
  winnerDivision?: string;
  winnerRole?: string;
  notes?: string;
  updatedAt?: string;
}

export interface BphVotingCandidate {
  npm: string;
  name: string;
  jabatan: string; // Ketua, Wakil Ketua, Sekretaris, Bendahara, dll.
  division: string;
  votesCount: number;
}

export interface MubesAwardsState {
  isPublished: boolean; // Jika true, anggota bisa melihat di HP (Hall of Fame)
  publishedAt?: string;
  academicYear: string;
  winners: Record<string, MubesRewardWinner>;
  bphVotes: Record<string, number>; // npm => total suara
  voterNpms: string[]; // daftar NPM anggota yang sudah vote agar 1 akun = 1 suara
}

const STORAGE_AWARDS_KEY = 'simak_mubes_awards_state';

export const MUBES_AWARD_CATEGORIES = [
  {
    id: 'bph-terbaik',
    title: 'BPH Terbaik',
    subtitle: 'Dipilih secara demokratis melalui voting seluruh anggota & Kadiv',
    icon: 'Shield',
    type: 'voting', // ditentukan dari voting suara anggota
  },
  {
    id: 'kadiv-terbaik',
    title: 'Kepala Divisi Terbaik',
    subtitle: 'Kepemimpinan dan pembinaan divisi paling berdedikasi',
    icon: 'Crown',
    type: 'curated',
  },
  {
    id: 'proker-terbaik',
    title: 'Program of the Year',
    subtitle: 'Program kerja paling berdampak positif dan sukses terlaksana',
    icon: 'Sparkles',
    type: 'curated',
  },
  {
    id: 'inspiring-member',
    title: 'Most Inspiring Member',
    subtitle: 'Inisiatif, loyalitas, dan kontribusi nyata yang menginspirasi',
    icon: 'Award',
    type: 'curated',
  },
  {
    id: 'anggota-terbaik',
    title: 'Anggota Terbaik',
    subtitle: 'Kombinasi integritas kepribadian dan keaktifan organisasi',
    icon: 'Star',
    type: 'curated',
  },
  {
    id: 'anggota-paling-aktif',
    title: 'Anggota Paling Aktif',
    subtitle: 'Akumulasi skor poin kehadiran dan keaktifan tertinggi di sistem',
    icon: 'Trophy',
    type: 'system-stat',
  },
  {
    id: 'best-division',
    title: 'Best Division of the Year',
    subtitle: 'Divisi paling produktif dengan pencapaian target proker terbaik',
    icon: 'Layers',
    type: 'curated',
  },
  {
    id: 'divisi-terkompak',
    title: 'Divisi Terkompak',
    subtitle: 'Kekompakan tim divisi dengan persentase kehadiran paling solid',
    icon: 'Users',
    type: 'curated',
  },
];

export const DEFAULT_MUBES_AWARDS: MubesAwardsState = {
  isPublished: false,
  academicYear: '2026/2027',
  winners: {
    'bph-terbaik': {
      id: 'bph-terbaik',
      categoryTitle: 'BPH Terbaik',
      categorySubtitle: 'Dipilih secara demokratis melalui voting seluruh anggota & Kadiv',
      winnerName: 'Pangki Deswa Rayhandi',
      winnerDivision: 'Pengabdian Masyarakat',
      winnerRole: 'BPH',
      notes: 'Dedikasi tinggi dalam manajemen operasional dan digitalisasi sistem SIMAK GENBI',
    },
    'kadiv-terbaik': {
      id: 'kadiv-terbaik',
      categoryTitle: 'Kepala Divisi Terbaik',
      categorySubtitle: 'Kepemimpinan dan pembinaan divisi paling berdedikasi',
      winnerName: 'Siti Rahmawati',
      winnerDivision: 'Pendidikan',
      winnerRole: 'kadiv',
      notes: 'Kepemimpinan yang responsif dan konsisten mengayomi anggota divisi',
    },
    'proker-terbaik': {
      id: 'proker-terbaik',
      categoryTitle: 'Program of the Year',
      categorySubtitle: 'Program kerja paling berdampak positif dan sukses terlaksana',
      winnerName: 'Sosialisasi Cinta Bangga Paham (CBP) Rupiah',
      winnerDivision: 'Publikasi dan Sosialisasi',
      notes: 'Kolaborasi sukses bersama SMA di Majalengka dengan partisipasi peserta maksimal',
    },
    'inspiring-member': {
      id: 'inspiring-member',
      categoryTitle: 'Most Inspiring Member',
      categorySubtitle: 'Inisiatif, loyalitas, dan kontribusi nyata yang menginspirasi',
      winnerName: 'Deden Kurniawan',
      winnerDivision: 'Publikasi dan Sosialisasi',
      notes: 'Keteladanan tinggi dalam publikasi kreatif dan semangat kolaborasi',
    },
    'anggota-terbaik': {
      id: 'anggota-terbaik',
      categoryTitle: 'Anggota Terbaik',
      categorySubtitle: 'Kombinasi integritas kepribadian dan keaktifan organisasi',
      winnerName: 'Fajar Pratama',
      winnerDivision: 'Lingkungan Hidup',
      notes: 'Integritas tinggi, ramah, dan selalu siap berkontribusi pada kegiatan GenBI',
    },
    'anggota-paling-aktif': {
      id: 'anggota-paling-aktif',
      categoryTitle: 'Anggota Paling Aktif',
      categorySubtitle: 'Akumulasi skor poin kehadiran dan keaktifan tertinggi di sistem',
      winnerName: 'Nadia Putri',
      winnerDivision: 'Pengabdian Masyarakat',
      notes: 'Perolehan poin keaktifan tertinggi dengan tingkat kehadiran 100%',
    },
    'best-division': {
      id: 'best-division',
      categoryTitle: 'Best Division of the Year',
      categorySubtitle: 'Divisi paling produktif dengan pencapaian target proker terbaik',
      winnerName: 'Divisi Pendidikan',
      winnerDivision: 'Pendidikan',
      notes: 'Seluruh agenda kerja tuntas terlaksana dengan hasil evaluasi memuaskan',
    },
    'divisi-terkompak': {
      id: 'divisi-terkompak',
      categoryTitle: 'Divisi Terkompak',
      categorySubtitle: 'Kekompakan tim divisi dengan persentase kehadiran paling solid',
      winnerName: 'Divisi Publikasi dan Sosialisasi',
      winnerDivision: 'Publikasi dan Sosialisasi',
      notes: 'Solidaritas anggota paling aktif dengan tingkat presensi teratur',
    },
  },
  bphVotes: {
    '2414101078': 24, // Pangki Deswa Rayhandi
  },
  voterNpms: ['2214100010', '2214100025'],
};

/**
 * Ambil status awards dari localStorage
 */
export function getMubesAwardsState(): MubesAwardsState {
  try {
    const raw = localStorage.getItem(STORAGE_AWARDS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return {
        ...DEFAULT_MUBES_AWARDS,
        ...parsed,
        winners: { ...DEFAULT_MUBES_AWARDS.winners, ...(parsed.winners || {}) },
        bphVotes: { ...DEFAULT_MUBES_AWARDS.bphVotes, ...(parsed.bphVotes || {}) },
        voterNpms: Array.isArray(parsed.voterNpms) ? parsed.voterNpms : DEFAULT_MUBES_AWARDS.voterNpms,
      };
    }
  } catch {}
  return DEFAULT_MUBES_AWARDS;
}

/**
 * Simpan status awards ke localStorage dan broadcast custom event
 */
export function saveMubesAwardsState(state: MubesAwardsState): void {
  try {
    localStorage.setItem(STORAGE_AWARDS_KEY, JSON.stringify(state));
    window.dispatchEvent(new CustomEvent('simak_awards_sync', { detail: state }));
  } catch (err) {
    console.error('Gagal menyimpan status awards:', err);
  }
}

/**
 * Update satu pemenang kategori
 */
export function setCategoryWinner(
  categoryId: string,
  winnerData: Partial<MubesRewardWinner>
): MubesAwardsState {
  const current = getMubesAwardsState();
  const existing = current.winners[categoryId] || {
    id: categoryId,
    categoryTitle: categoryId,
    categorySubtitle: '',
    winnerName: '',
  };

  const updated: MubesAwardsState = {
    ...current,
    winners: {
      ...current.winners,
      [categoryId]: {
        ...existing,
        ...winnerData,
        updatedAt: new Date().toISOString(),
      },
    },
  };

  saveMubesAwardsState(updated);
  return updated;
}

/**
 * Toggle publikasi awards (Draft / Terbitkan)
 */
export function toggleAwardsPublish(publishStatus?: boolean): MubesAwardsState {
  const current = getMubesAwardsState();
  const nextStatus = publishStatus !== undefined ? publishStatus : !current.isPublished;
  const updated: MubesAwardsState = {
    ...current,
    isPublished: nextStatus,
    publishedAt: nextStatus ? new Date().toISOString() : undefined,
  };
  saveMubesAwardsState(updated);
  return updated;
}

/**
 * Anggota submit vote untuk BPH Terbaik (1 user = 1 vote)
 */
export function submitBphVote(voterNpm: string, targetBphNpm: string): { success: boolean; message: string } {
  const current = getMubesAwardsState();
  const cleanVoter = voterNpm.trim().replace(/[^a-zA-Z0-9]/g, '');
  const cleanTarget = targetBphNpm.trim().replace(/[^a-zA-Z0-9]/g, '');

  if (current.voterNpms.includes(cleanVoter)) {
    return {
      success: false,
      message: 'Anda sudah menggunakan hak suara voting BPH Terbaik pada periode ini.',
    };
  }

  const currentVotes = current.bphVotes[cleanTarget] || 0;
  const updated: MubesAwardsState = {
    ...current,
    voterNpms: [...current.voterNpms, cleanVoter],
    bphVotes: {
      ...current.bphVotes,
      [cleanTarget]: currentVotes + 1,
    },
  };

  saveMubesAwardsState(updated);
  return {
    success: true,
    message: 'Suara Anda berhasil dicatat secara rahasia. Terima kasih atas partisipasinya!',
  };
}
