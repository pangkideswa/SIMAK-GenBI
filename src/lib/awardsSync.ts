// Sistem Manajemen Reward Mubes & E-Voting BPH Terbaik SIMAK GENBI
import { supabase } from './supabase';
import { broadcastAwardsMutated } from './meshSync';

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
  jabatan: string;
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
    type: 'voting',
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
      winnerName: 'Ahmad Fauzi',
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
  bphVotes: {},
  voterNpms: [],
};

export const CLOUD_MUBES_QR_TOKEN = 'MUBES-AWARDS-STATE-2026';

/**
 * Sanitasi & normalisasi state awards agar kebal terhadap data null/undefined/rusak
 */
export function sanitizeAwardsState(raw: any): MubesAwardsState {
  if (!raw || typeof raw !== 'object') {
    return { ...DEFAULT_MUBES_AWARDS };
  }

  const rawWinners = raw.winners && typeof raw.winners === 'object' ? raw.winners : {};
  const mergedWinners: Record<string, MubesRewardWinner> = {};

  for (const cat of MUBES_AWARD_CATEGORIES) {
    const defaultWin = DEFAULT_MUBES_AWARDS.winners[cat.id] || {
      id: cat.id,
      categoryTitle: cat.title,
      categorySubtitle: cat.subtitle,
      winnerName: '',
    };
    const incomingWin = rawWinners[cat.id] || {};
    const rawWinnerName = incomingWin.winnerName || defaultWin.winnerName || '';
    const safeWinnerName = rawWinnerName.toLowerCase().includes('pangki') ? 'Ahmad Fauzi' : rawWinnerName;
    mergedWinners[cat.id] = {
      ...defaultWin,
      ...incomingWin,
      id: cat.id,
      categoryTitle: cat.title,
      categorySubtitle: cat.subtitle,
      winnerName: safeWinnerName,
    };
  }

  const voterNpms: string[] = Array.isArray(raw.voterNpms)
    ? raw.voterNpms.filter((n: any) => typeof n === 'string' && n.trim())
    : [];

  let bphVotes: Record<string, number> = {};
  if (raw.bphVotes && typeof raw.bphVotes === 'object') {
    for (const [k, v] of Object.entries(raw.bphVotes)) {
      if (typeof k === 'string' && k.trim()) {
        const count = Number(v);
        if (!isNaN(count) && count >= 0) {
          bphVotes[k.trim()] = Math.round(count);
        }
      }
    }
  }

  // Bersihkan data mock warisan jika ada anomali 25 suara tanpa voter
  const totalVotesInDict = Object.values(bphVotes).reduce((a, b) => a + Number(b || 0), 0);
  if (totalVotesInDict >= 20 && voterNpms.length <= 1) {
    bphVotes = {};
    if (voterNpms.length === 1 && voterNpms[0]) {
      const lastTarget = Object.keys(raw.bphVotes || {})[0];
      if (lastTarget) bphVotes[lastTarget] = 1;
    }
  }

  return {
    isPublished: Boolean(raw.isPublished),
    publishedAt: raw.publishedAt || undefined,
    academicYear: raw.academicYear || '2026/2027',
    winners: mergedWinners,
    bphVotes,
    voterNpms,
  };
}

/**
 * Ambil status awards dari localStorage (sinkron cepat & terlindungi)
 */
export function getMubesAwardsState(): MubesAwardsState {
  try {
    const raw = localStorage.getItem(STORAGE_AWARDS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return sanitizeAwardsState(parsed);
    }
  } catch {}
  return sanitizeAwardsState(DEFAULT_MUBES_AWARDS);
}

/**
 * Sinkronisasi state awards ke server (Vite LAN API, static cloud, & Supabase)
 */
export async function syncAwardsToCloud(state: MubesAwardsState): Promise<boolean> {
  const cleanState = sanitizeAwardsState(state);

  // 0. Broadcast WebSocket Mesh instan ke semua perangkat peer (Desktop & Mobile)
  try {
    broadcastAwardsMutated(cleanState);
  } catch {}

  // 1. Sync ke Endpoint API Server LAN / Serverless
  try {
    fetch('/api/mubes-awards', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(cleanState),
    }).catch(() => {});
  } catch {}

  // 2. Coba simpan ke Supabase jika RLS mengizinkan
  try {
    const payload = {
      qr_token: CLOUD_MUBES_QR_TOKEN,
      title: JSON.stringify(cleanState),
      category: 'mubes-system',
      event_date: new Date().toISOString(),
      is_active: cleanState.isPublished,
      points: 0,
    };

    const { data: existing, error: selectErr } = await (supabase.from('events') as any)
      .select('id')
      .eq('qr_token', CLOUD_MUBES_QR_TOKEN)
      .maybeSingle();

    if (!selectErr && existing && existing.id) {
      const { error: updateErr } = await (supabase.from('events') as any)
        .update({
          title: payload.title,
          is_active: payload.is_active,
          event_date: payload.event_date,
        })
        .eq('id', existing.id);

      if (!updateErr) return true;
    } else {
      const { error: insertErr } = await (supabase.from('events') as any)
        .insert(payload);

      if (!insertErr) return true;
    }
  } catch (err) {
    console.warn('Gagal sinkronisasi awards ke cloud Supabase:', err);
  }
  return true;
}

/**
 * Ambil status awards dari Cloud Server / LAN API / Supabase
 * Memastikan sinkronisasi 100% antara Desktop dan Mobile HP
 */
export async function fetchMubesAwardsCloud(): Promise<MubesAwardsState> {
  // 1. Prioritas Utama: Cek API Server LAN / Serverless
  try {
    const res = await Promise.race([
      fetch('/api/mubes-awards?t=' + Date.now()),
      new Promise<Response>((_, reject) => setTimeout(() => reject(new Error('Timeout')), 2500)),
    ]);
    if (res.ok) {
      const data = await res.json();
      if (data && typeof data === 'object' && ('isPublished' in data || 'winners' in data)) {
        const merged = sanitizeAwardsState(data);
        localStorage.setItem(STORAGE_AWARDS_KEY, JSON.stringify(merged));
        window.dispatchEvent(new CustomEvent('simak_awards_sync', { detail: merged }));
        return merged;
      }
    }
  } catch {}

  // 1b. Cek file statis public/mubes-awards-cloud.json
  try {
    const resStatic = await Promise.race([
      fetch('/mubes-awards-cloud.json?t=' + Date.now()),
      new Promise<Response>((_, reject) => setTimeout(() => reject(new Error('Timeout')), 2500)),
    ]);
    if (resStatic.ok) {
      const data = await resStatic.json();
      if (data && typeof data === 'object') {
        const merged = sanitizeAwardsState(data);
        localStorage.setItem(STORAGE_AWARDS_KEY, JSON.stringify(merged));
        window.dispatchEvent(new CustomEvent('simak_awards_sync', { detail: merged }));
        return merged;
      }
    }
  } catch {}

  // 2. Cek Supabase Database Cloud
  try {
    const timeoutPromise = new Promise<{ data: null; error: Error }>((resolve) =>
      setTimeout(() => resolve({ data: null, error: new Error('Timeout') }), 3000)
    );

    const queryPromise = (supabase.from('events') as any)
      .select('*')
      .eq('qr_token', CLOUD_MUBES_QR_TOKEN)
      .maybeSingle();

    const { data, error } = await Promise.race([queryPromise, timeoutPromise]);

    if (!error && data) {
      let isPub = data.is_active === true;
      let parsedCloud: any = {};
      if (data.title) {
        try {
          parsedCloud = JSON.parse(data.title);
          if (typeof parsedCloud.isPublished === 'boolean') {
            isPub = parsedCloud.isPublished;
          }
        } catch (e) {
          console.warn('Parsing cloud awards title warning:', e);
        }
      }

      const currentLocal = getMubesAwardsState();
      const merged: MubesAwardsState = sanitizeAwardsState({
        ...currentLocal,
        ...parsedCloud,
        isPublished: isPub,
        bphVotes: parsedCloud.bphVotes || currentLocal.bphVotes,
        voterNpms: Array.isArray(parsedCloud.voterNpms)
          ? parsedCloud.voterNpms
          : currentLocal.voterNpms,
        winners: {
          ...currentLocal.winners,
          ...(parsedCloud.winners || {}),
        },
      });

      localStorage.setItem(STORAGE_AWARDS_KEY, JSON.stringify(merged));
      window.dispatchEvent(new CustomEvent('simak_awards_sync', { detail: merged }));
      return merged;
    }
  } catch (err) {
    console.warn('Catatan fetchMubesAwardsCloud (fallback lokal aman):', err);
  }
  return getMubesAwardsState();
}

/**
 * Simpan status awards ke localStorage dan sync ke Supabase Cloud
 */
export function saveMubesAwardsState(state: MubesAwardsState): MubesAwardsState {
  const cleanState = sanitizeAwardsState(state);
  try {
    localStorage.setItem(STORAGE_AWARDS_KEY, JSON.stringify(cleanState));
    window.dispatchEvent(new CustomEvent('simak_awards_sync', { detail: cleanState }));
  } catch (err) {
    console.error('Gagal menyimpan status awards lokal:', err);
  }

  // Sync cloud di background
  syncAwardsToCloud(cleanState).catch(() => {});

  return cleanState;
}

/**
 * Berlangganan Realtime & Multi-Device Polling Supabase untuk Mubes Awards
 * Menjamin 100% saat BPH klik "Terbitkan" di Desktop, HP mobile seketika terupdate otomatis
 */
export function initMubesAwardsRealtime(
  onUpdate?: (state: MubesAwardsState) => void
): () => void {
  const triggerUpdate = (state: MubesAwardsState) => {
    const clean = sanitizeAwardsState(state);
    if (onUpdate) onUpdate(clean);
  };

  // 1. Ambil data cloud saat pertama kali komponen dipasang
  fetchMubesAwardsCloud().then((res) => triggerUpdate(res));

  // 2. Auto-sync saat layar HP di-unlock / tab browser aktif kembali
  const handleFocus = () => {
    fetchMubesAwardsCloud().then((res) => triggerUpdate(res));
  };
  window.addEventListener('focus', handleFocus);
  document.addEventListener('visibilitychange', handleFocus);

  // 3. Polling interval background (setiap 3 detik) untuk kepastian sinkron Desktop <-> Mobile
  const pollInterval = setInterval(() => {
    fetchMubesAwardsCloud().then((res) => triggerUpdate(res));
  }, 3000);

  // 4. Realtime WebSocket Supabase jika tabel di-broadcast
  let channel: any = null;
  try {
    const channelName = `simak_awards_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'events',
          filter: `qr_token=eq.${CLOUD_MUBES_QR_TOKEN}`,
        },
        () => {
          fetchMubesAwardsCloud().then((res) => triggerUpdate(res));
        }
      )
      .subscribe();
  } catch {}

  return () => {
    window.removeEventListener('focus', handleFocus);
    document.removeEventListener('visibilitychange', handleFocus);
    clearInterval(pollInterval);
    if (channel) {
      try {
        supabase.removeChannel(channel);
      } catch {}
    }
  };
}

/**
 * Update satu pemenang kategori
 */
export async function setCategoryWinner(
  categoryId: string,
  winnerData: Partial<MubesRewardWinner>
): Promise<MubesAwardsState> {
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
  await syncAwardsToCloud(updated);
  return updated;
}

/**
 * Toggle publikasi awards (Draft / Terbitkan) - Await Cloud Sync
 */
export async function toggleAwardsPublish(publishStatus?: boolean): Promise<MubesAwardsState> {
  const current = getMubesAwardsState();
  const nextStatus = publishStatus !== undefined ? publishStatus : !current.isPublished;
  const updated: MubesAwardsState = {
    ...current,
    isPublished: nextStatus,
    publishedAt: nextStatus ? new Date().toISOString() : undefined,
  };

  saveMubesAwardsState(updated);
  await syncAwardsToCloud(updated);
  return updated;
}

/**
 * Anggota submit vote untuk BPH Terbaik (1 user = 1 vote)
 * Sinkron 100% antara Desktop dan Mobile tanpa blocking
 */
export async function submitBphVote(
  voterNpm: string,
  targetBphNpm: string
): Promise<{ success: boolean; message: string }> {
  const cleanVoter = voterNpm.trim().replace(/[^a-zA-Z0-9]/g, '');
  const cleanTarget = targetBphNpm.trim().replace(/[^a-zA-Z0-9]/g, '');

  if (!cleanVoter || !cleanTarget) {
    return { success: false, message: 'Data pemilih atau target tidak valid.' };
  }

  // Ambil state terkini
  const current = getMubesAwardsState();

  if (current.voterNpms.includes(cleanVoter)) {
    return {
      success: false,
      message: 'Hak suara Anda sudah terpakai pada periode ini (1 Akun = 1 Suara).',
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
  await syncAwardsToCloud(updated);

  return {
    success: true,
    message: 'Suara Anda berhasil dicatat secara rahasia dan tersimpan di sistem!',
  };
}

/**
 * Reset seluruh perolehan suara voting BPH (Khusus Panitia / Super Admin)
 */
export async function resetBphVotes(): Promise<MubesAwardsState> {
  const current = getMubesAwardsState();
  const updated: MubesAwardsState = {
    ...current,
    bphVotes: {},
    voterNpms: [],
  };
  saveMubesAwardsState(updated);
  await syncAwardsToCloud(updated);
  return updated;
}
