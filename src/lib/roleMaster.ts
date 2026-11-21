// Sistem Master Jabatan & Divisi Terpadu SIMAK GENBI
// Memungkinkan Super Admin menambah, mengubah, dan menghapus nama jabatan dan divisi kapan saja

export interface MasterJabatan {
  id: string;
  name: string;
  role: 'admin' | 'kadiv' | 'member';
  division?: string; // 'BPH', 'all', atau nama divisi tertentu
  description?: string;
  isSystemDefault?: boolean;
}

const STORAGE_JABATAN_KEY = 'simak_master_jabatan';
const STORAGE_DIVISIONS_KEY = 'simak_master_divisions';

export const DEFAULT_MASTER_JABATAN: MasterJabatan[] = [
  { id: 'ketua', name: 'Ketua', role: 'admin', division: 'BPH', description: 'Ketua Umum GenBI UNMA' },
  { id: 'wakil-ketua', name: 'Wakil Ketua', role: 'admin', division: 'BPH', description: 'Wakil Ketua GenBI UNMA' },
  { id: 'sekretaris-1', name: 'Sekretaris 1', role: 'admin', division: 'BPH', description: 'Sekretaris Utama BPH' },
  { id: 'sekretaris-2', name: 'Sekretaris 2', role: 'admin', division: 'BPH', description: 'Sekretaris Pendamping BPH' },
  { id: 'bendahara-1', name: 'Bendahara 1', role: 'admin', division: 'BPH', description: 'Bendahara Utama BPH' },
  { id: 'bendahara-2', name: 'Bendahara 2', role: 'admin', division: 'BPH', description: 'Bendahara Pendamping BPH' },
  { id: 'kadiv', name: 'Kepala Divisi', role: 'kadiv', division: 'all', description: 'Pimpinan Divisi Program Kerja' },
  { id: 'anggota', name: 'Anggota', role: 'member', division: 'all', description: 'Anggota Divisi' },
  { id: 'penerima-baru', name: 'Penerima Beasiswa Baru', role: 'member', division: 'Belum Ada Divisi', description: 'Penerima SK Baru Belum Ditempatkan' },
];

export const DEFAULT_DIVISIONS: string[] = [
  'BPH',
  'Publikasi dan Sosialisasi',
  'Lingkungan Hidup',
  'Pendidikan',
  'Pengabdian Masyarakat',
  'Kewirausahaan',
  'Belum Ada Divisi',
];

/**
 * Ambil seluruh daftar Master Jabatan dari localStorage (atau fallback default)
 */
export function getMasterJabatanList(): MasterJabatan[] {
  try {
    const raw = localStorage.getItem(STORAGE_JABATAN_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    }
  } catch (e) {
    console.warn('Gagal membaca master jabatan dari storage:', e);
  }
  return DEFAULT_MASTER_JABATAN;
}

/**
 * Simpan atau perbarui jabatan di daftar Master Jabatan
 */
export function saveMasterJabatan(item: { id?: string; name: string; role: 'admin' | 'kadiv' | 'member'; division?: string; description?: string }): MasterJabatan[] {
  const current = getMasterJabatanList();
  const id = item.id || `jabatan-${Date.now()}`;
  const existingIdx = current.findIndex((j) => j.id === id);

  let nextList: MasterJabatan[];
  if (existingIdx >= 0) {
    nextList = current.map((j) => (j.id === id ? { ...j, ...item, id } : j));
  } else {
    nextList = [...current, { id, name: item.name.trim(), role: item.role, division: item.division || 'all', description: item.description }];
  }

  try {
    localStorage.setItem(STORAGE_JABATAN_KEY, JSON.stringify(nextList));
    window.dispatchEvent(new CustomEvent('simak_jabatan_sync', { detail: nextList }));
  } catch (e) {
    console.warn('Gagal menyimpan master jabatan:', e);
  }

  return nextList;
}

/**
 * Hapus jabatan dari daftar Master Jabatan (misal jika tidak ada Wakil Ketua)
 */
export function deleteMasterJabatan(id: string): MasterJabatan[] {
  const current = getMasterJabatanList();
  const nextList = current.filter((j) => j.id !== id);

  try {
    localStorage.setItem(STORAGE_JABATAN_KEY, JSON.stringify(nextList));
    window.dispatchEvent(new CustomEvent('simak_jabatan_sync', { detail: nextList }));
  } catch (e) {
    console.warn('Gagal menghapus master jabatan:', e);
  }

  return nextList;
}

/**
 * Ambil daftar Master Divisi
 */
export function getMasterDivisions(): string[] {
  try {
    const raw = localStorage.getItem(STORAGE_DIVISIONS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    }
  } catch (e) {
    console.warn('Gagal membaca master divisi dari storage:', e);
  }
  return DEFAULT_DIVISIONS;
}

/**
 * Tambah Divisi Baru
 */
export function addMasterDivision(name: string): string[] {
  const current = getMasterDivisions();
  const cleanName = name.trim();
  if (!cleanName || current.includes(cleanName)) return current;

  const nextList = [...current, cleanName];
  try {
    localStorage.setItem(STORAGE_DIVISIONS_KEY, JSON.stringify(nextList));
    window.dispatchEvent(new CustomEvent('simak_division_sync', { detail: nextList }));
  } catch (e) {
    console.warn('Gagal menyimpan divisi baru:', e);
  }
  return nextList;
}

/**
 * Hapus Divisi
 */
export function deleteMasterDivision(name: string): string[] {
  const current = getMasterDivisions();
  const nextList = current.filter((d) => d !== name);
  try {
    localStorage.setItem(STORAGE_DIVISIONS_KEY, JSON.stringify(nextList));
    window.dispatchEvent(new CustomEvent('simak_division_sync', { detail: nextList }));
  } catch (e) {
    console.warn('Gagal menghapus divisi:', e);
  }
  return nextList;
}

/**
 * Menentukan label jabatan yang sesuai untuk ditampilkan kepada pengguna
 */
export function resolveUserJabatan(user: {
  role?: string;
  division?: string;
  jabatan?: string;
}): string {
  if (user.jabatan && user.jabatan.trim()) {
    return user.jabatan.trim();
  }
  if (user.role === 'admin') {
    return 'BPH';
  }
  if (user.role === 'kadiv') {
    return 'Kepala Divisi';
  }
  if (user.division === 'Belum Ada Divisi') {
    return 'Penerima Beasiswa Baru';
  }
  return 'Anggota';
}
