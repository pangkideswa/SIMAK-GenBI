import { supabase } from './supabase';

export interface AcademicPeriod {
  id: string;
  name: string;
  academicYear: string;
  semester: 'Ganjil' | 'Genap';
  isActive: boolean;
  statusLabel?: string;
  createdAt: string;
}

const PERIODS_STORAGE_KEY = 'simak_academic_periods';

export const DEFAULT_PERIODS: AcademicPeriod[] = [
  {
    id: 'p-2026-ganjil',
    name: 'T.A. 2026/2027 Ganjil',
    academicYear: '2026/2027',
    semester: 'Ganjil',
    isActive: true,
    statusLabel: 'Periode Aktif',
    createdAt: '2026-08-01T00:00:00.000Z',
  },
  {
    id: 'p-2026-genap',
    name: 'T.A. 2026/2027 Genap',
    academicYear: '2026/2027',
    semester: 'Genap',
    isActive: false,
    statusLabel: 'Masa yang akan datang',
    createdAt: '2026-02-01T00:00:00.000Z',
  },
  {
    id: 'p-2027-ganjil',
    name: 'T.A. 2027/2028 Ganjil',
    academicYear: '2027/2028',
    semester: 'Ganjil',
    isActive: false,
    statusLabel: 'Masa yang akan datang',
    createdAt: '2027-08-01T00:00:00.000Z',
  },
];

/**
 * Mengambil daftar periode kepengurusan (gabungan Supabase & LocalStorage)
 */
export function getAcademicPeriods(): AcademicPeriod[] {
  try {
    const raw = localStorage.getItem(PERIODS_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    }
  } catch {}
  return DEFAULT_PERIODS;
}

/**
 * Menyimpan atau memperbarui data periode kepengurusan
 */
export async function saveAcademicPeriod(period: {
  id?: string;
  name: string;
  academicYear: string;
  semester: 'Ganjil' | 'Genap';
  isActive?: boolean;
  statusLabel?: string;
}): Promise<AcademicPeriod[]> {
  const current = getAcademicPeriods();
  const targetId = period.id || 'period-' + Date.now();

  let updated: AcademicPeriod[];
  const existingIdx = current.findIndex((p) => p.id === targetId);

  if (existingIdx >= 0) {
    updated = current.map((p) => {
      if (p.id === targetId) {
        return {
          ...p,
          name: period.name.trim(),
          academicYear: period.academicYear.trim(),
          semester: period.semester,
          isActive: period.isActive ?? p.isActive,
          statusLabel: period.statusLabel || p.statusLabel || (period.isActive ? 'Periode Aktif' : 'Masa yang akan datang'),
        };
      }
      // Jika periode ini diaktifkan, periode lain jadi non-aktif
      if (period.isActive) {
        return { ...p, isActive: false };
      }
      return p;
    });
  } else {
    const newPeriod: AcademicPeriod = {
      id: targetId,
      name: period.name.trim(),
      academicYear: period.academicYear.trim(),
      semester: period.semester,
      isActive: Boolean(period.isActive),
      statusLabel: period.statusLabel || (period.isActive ? 'Periode Aktif' : 'Masa yang akan datang'),
      createdAt: new Date().toISOString(),
    };

    if (newPeriod.isActive) {
      updated = [newPeriod, ...current.map((p) => ({ ...p, isActive: false }))];
    } else {
      updated = [newPeriod, ...current];
    }
  }

  // Simpan ke local storage
  localStorage.setItem(PERIODS_STORAGE_KEY, JSON.stringify(updated));

  // Siarkan ke seluruh tab & komponen aktif
  window.dispatchEvent(
    new CustomEvent('simak_period_sync', {
      detail: { periods: updated },
    })
  );

  // Sync opsional ke Supabase jika tabel tersedia
  try {
    await (supabase.from('academic_periods') as any).upsert(updated);
  } catch {}

  return updated;
}

/**
 * Mengatur satu periode menjadi Aktif
 */
export function setActivePeriod(periodId: string): AcademicPeriod[] {
  const current = getAcademicPeriods();
  const updated = current.map((p) => ({
    ...p,
    isActive: p.id === periodId,
  }));

  localStorage.setItem(PERIODS_STORAGE_KEY, JSON.stringify(updated));
  window.dispatchEvent(
    new CustomEvent('simak_period_sync', {
      detail: { periods: updated },
    })
  );
  return updated;
}

/**
 * Menghapus satu periode
 */
export function deleteAcademicPeriod(periodId: string): AcademicPeriod[] {
  const current = getAcademicPeriods();
  const updated = current.filter((p) => p.id !== periodId);

  // Pastikan selalu ada minimal 1 periode aktif jika yang dihapus aktif
  if (updated.length > 0 && !updated.some((p) => p.isActive)) {
    updated[0].isActive = true;
  }

  localStorage.setItem(PERIODS_STORAGE_KEY, JSON.stringify(updated));
  window.dispatchEvent(
    new CustomEvent('simak_period_sync', {
      detail: { periods: updated },
    })
  );
  return updated;
}
