import { supabase } from './supabase';
import { normalizeStudentId } from './memberSync';
import type { MemberEvaluation, Role, Division, EvaluationPredicate } from '../types/database';

export const ALL_ATTENDANCES_KEY = 'simak_all_attendances';
export const EVALUATIONS_OVERRIDES_KEY = 'simak_evaluations_overrides';
export const LEADERBOARD_CACHE_KEY = 'simak_leaderboard_cache';

/**
 * Cek apakah sebuah entitas profil / evaluasi merupakan akun Super Admin (Root System)
 * Super Admin bukan anggota kepengurusan dan tidak boleh masuk ke leaderboard / rekap keaktifan
 */
export function isSuperAdminAccount(userOrItem: any): boolean {
  if (!userOrItem) return false;
  const role = String(userOrItem.role || '').toLowerCase();
  const npm = String(userOrItem.npm || userOrItem.nim || userOrItem.userNpm || '').toLowerCase().trim();
  const fullName = String(userOrItem.full_name || userOrItem.fullName || userOrItem.userFullName || userOrItem.name || '').toLowerCase();
  const email = String(userOrItem.email || '').toLowerCase();
  const userId = String(userOrItem.user_id || userOrItem.userId || userOrItem.id || '');

  return (
    role === 'superadmin' ||
    npm === 'superadmin' ||
    fullName.includes('(super admin)') ||
    fullName.includes('super admin') ||
    email.startsWith('superadmin') ||
    userId === '00000000-0000-0000-0000-000000000000' ||
    userId === '00000000-0000-0000-0000-000000000001'
  );
}

/**
 * Bersihkan seluruh residu akun Super Admin dari cache leaderboard & evaluasi lokal
 */
export function purgeSuperAdminFromCache(): void {
  try {
    // 1. Bersihkan EVALUATIONS_OVERRIDES_KEY
    const rawOv = localStorage.getItem(EVALUATIONS_OVERRIDES_KEY);
    if (rawOv) {
      const ov = JSON.parse(rawOv);
      let changed = false;
      for (const [key, val] of Object.entries(ov)) {
        if (
          isSuperAdminAccount(val) ||
          key.toLowerCase() === 'superadmin' ||
          key.startsWith('00000000-0000')
        ) {
          delete ov[key];
          changed = true;
        }
      }
      if (changed) {
        localStorage.setItem(EVALUATIONS_OVERRIDES_KEY, JSON.stringify(ov));
      }
    }

    // 2. Bersihkan LEADERBOARD_CACHE_KEY
    const rawLb = localStorage.getItem(LEADERBOARD_CACHE_KEY);
    if (rawLb) {
      const lb = JSON.parse(rawLb);
      if (Array.isArray(lb)) {
        const filtered = lb.filter((item: any) => !isSuperAdminAccount(item));
        localStorage.setItem(LEADERBOARD_CACHE_KEY, JSON.stringify(filtered));
      }
    }

    // 3. Bersihkan ALL_ATTENDANCES_KEY
    const rawAtt = localStorage.getItem(ALL_ATTENDANCES_KEY);
    if (rawAtt) {
      const atts = JSON.parse(rawAtt);
      if (Array.isArray(atts)) {
        const filtered = atts.filter((item: any) => !isSuperAdminAccount(item));
        localStorage.setItem(ALL_ATTENDANCES_KEY, JSON.stringify(filtered));
      }
    }

    // 4. Hapus key-key personal SUPERADMIN jika tersisa
    const keysToRemove = [
      'simak_attendances_SUPERADMIN',
      'simak_attendances_superadmin',
      'simak_attendances_00000000-0000-0000-0000-000000000000',
      'simak_attendances_00000000-0000-0000-0000-000000000001',
      'simak_eval_SUPERADMIN',
      'simak_eval_superadmin',
      'simak_eval_00000000-0000-0000-0000-000000000000',
      'simak_eval_00000000-0000-0000-0000-000000000001',
    ];
    for (const k of keysToRemove) {
      localStorage.removeItem(k);
    }
  } catch {}
}

export interface UnifiedAttendanceInput {
  eventId: string;
  userId: string;
  userFullName: string;
  userNpm: string;
  userDivision?: string;
  userRole?: string;
  eventTitle: string;
  eventPoints: number;
  eventCategory?: string;
  eventDate?: string;
  status?: 'hadir' | 'izin' | 'delegasi';
  verified?: boolean;
  proofUrl?: string | null;
  userLat?: number | null;
  userLng?: number | null;
}

export interface UnifiedAttendanceRecord {
  id: string;
  event_id: string;
  user_id: string;
  status: 'hadir' | 'izin' | 'delegasi';
  verified: boolean;
  scanned_at: string;
  full_name: string;
  npm: string;
  nim: string;
  division: string;
  role?: string;
  event_title: string;
  event_points: number;
  event_category?: string;
  event_date?: string;
  proof_url?: string | null;
  user_lat?: number | null;
  user_lng?: number | null;
}

/**
 * Catat Presensi Terpadu (Admin, Kadiv, & Anggota)
 * Sinkron 100% ke:
 * 1. Supabase 'attendances' (jika online)
 * 2. simak_all_attendances (shared global participants)
 * 3. simak_attendances_{userId} & simak_attendances_{userNpm} (riwayat kartu anggota)
 * 4. simak_eval_{userId} & simak_evaluations_overrides (poin keaktifan & predikat)
 * 5. simak_leaderboard_cache (peringkat leaderboard)
 * 6. Broadcast event CustomEvent untuk update instan tanpa F5
 */
export async function recordUnifiedAttendance(
  input: UnifiedAttendanceInput
): Promise<UnifiedAttendanceRecord> {
  const cleanNpm = normalizeStudentId(input.userNpm);
  const nowIso = new Date().toISOString();
  const recordId = `att-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;

  const attRecord: UnifiedAttendanceRecord = {
    id: recordId,
    event_id: input.eventId,
    user_id: input.userId,
    status: input.status || 'hadir',
    verified: input.verified !== false,
    scanned_at: nowIso,
    full_name: input.userFullName,
    npm: cleanNpm,
    nim: cleanNpm,
    division: input.userDivision || 'Publikasi dan Sosialisasi',
    role: input.userRole || 'member',
    event_title: input.eventTitle,
    event_points: Number(input.eventPoints || 15),
    event_category: input.eventCategory || 'Proker',
    event_date: input.eventDate || nowIso,
    proof_url: input.proofUrl || null,
    user_lat: input.userLat || null,
    user_lng: input.userLng || null,
  };

  // Super Admin (Root System) bukan anggota kepengurusan dan tidak dicatat ke leaderboard / evaluasi anggota
  if (isSuperAdminAccount(input)) {
    return attRecord;
  }

  // 1. Simpan ke simak_all_attendances (Shared Global Cache)
  try {
    const rawAll = localStorage.getItem(ALL_ATTENDANCES_KEY);
    const allList: any[] = rawAll ? JSON.parse(rawAll) : [];
    // Hapus presensi duplikat jika ada untuk acara & user yang sama
    const filteredAll = allList.filter(
      (a) =>
        !(
          a.event_id === input.eventId &&
          (a.user_id === input.userId || normalizeStudentId(a.npm || a.nim) === cleanNpm)
        )
    );
    filteredAll.unshift(attRecord);
    localStorage.setItem(ALL_ATTENDANCES_KEY, JSON.stringify(filteredAll));
  } catch (e) {
    console.warn('Gagal menyimpan simak_all_attendances:', e);
  }

  // 2. Simpan ke Riwayat Personal Kartu Anggota (simak_attendances_{userId} & {cleanNpm})
  try {
    const personalRecord = {
      id: attRecord.id,
      event_id: attRecord.event_id,
      status: attRecord.status,
      proof_url: attRecord.proof_url,
      verified: attRecord.verified,
      scanned_at: attRecord.scanned_at,
      event_title: attRecord.event_title,
      event_points: attRecord.event_points,
      event_category: attRecord.event_category,
      event_date: attRecord.event_date,
    };

    const userKeys = [`simak_attendances_${input.userId}`];
    if (cleanNpm && cleanNpm !== input.userId) {
      userKeys.push(`simak_attendances_${cleanNpm}`);
    }

    for (const key of userKeys) {
      const rawUserAtt = localStorage.getItem(key);
      const list: any[] = rawUserAtt ? JSON.parse(rawUserAtt) : [];
      const filtered = list.filter((a) => a.event_id !== input.eventId);
      filtered.unshift(personalRecord);
      localStorage.setItem(key, JSON.stringify(filtered));
    }
  } catch (e) {
    console.warn('Gagal menyimpan riwayat presensi personal:', e);
  }

  // 3. Update Evaluasi Poin & Predikat (simak_eval_{userId} & simak_evaluations_overrides)
  let updatedEval: MemberEvaluation | null = null;
  try {
    // Cari evaluasi yang ada saat ini
    let currentEval: any = null;
    const rawPersonalEval = localStorage.getItem(`simak_eval_${input.userId}`);
    if (rawPersonalEval) {
      currentEval = JSON.parse(rawPersonalEval);
    } else {
      const rawOv = localStorage.getItem(EVALUATIONS_OVERRIDES_KEY);
      if (rawOv) {
        const ovMap = JSON.parse(rawOv);
        currentEval = ovMap[cleanNpm] || ovMap[input.userId] || null;
      }
    }

    const prevPoints = Number(currentEval?.total_points ?? (input.userRole === 'admin' ? 95 : input.userRole === 'kadiv' ? 85 : 60));
    const prevHadir = Number(currentEval?.total_hadir ?? (input.userRole === 'admin' ? 7 : input.userRole === 'kadiv' ? 6 : 4));
    const nextPoints = prevPoints + attRecord.event_points;
    const nextHadir = prevHadir + 1;
    const nextPredicate: EvaluationPredicate =
      nextPoints >= 80 ? 'Sangat Aktif' : nextPoints >= 60 ? 'Aktif' : 'Perlu Pembinaan';

    updatedEval = {
      user_id: input.userId,
      npm: cleanNpm,
      nim: cleanNpm,
      email: currentEval?.email || null,
      full_name: input.userFullName,
      division: (input.userDivision as Division) || 'Publikasi dan Sosialisasi',
      role: (input.userRole as Role) || 'member',
      avatar_url: currentEval?.avatar_url || null,
      total_points: nextPoints,
      total_hadir: nextHadir,
      total_izin: Number(currentEval?.total_izin ?? 0),
      total_alfa: Number(currentEval?.total_alfa ?? 0),
      attendance_percentage: Math.min(100, Math.round((nextHadir / Math.max(1, 7)) * 100)),
      predicate: nextPredicate,
    };

    // Simpan ke storage personal
    localStorage.setItem(`simak_eval_${input.userId}`, JSON.stringify(updatedEval));
    if (cleanNpm && cleanNpm !== input.userId) {
      localStorage.setItem(`simak_eval_${cleanNpm}`, JSON.stringify(updatedEval));
    }

    // Simpan ke overrides global
    let overrides: Record<string, any> = {};
    const rawOv = localStorage.getItem(EVALUATIONS_OVERRIDES_KEY);
    if (rawOv) {
      try {
        overrides = JSON.parse(rawOv);
      } catch {}
    }
    overrides[input.userId] = updatedEval;
    if (cleanNpm) overrides[cleanNpm] = updatedEval;
    localStorage.setItem(EVALUATIONS_OVERRIDES_KEY, JSON.stringify(overrides));
  } catch (e) {
    console.warn('Gagal mengupdate evaluasi:', e);
  }

  // 4. Update Leaderboard Cache (simak_leaderboard_cache)
  try {
    const rawLb = localStorage.getItem(LEADERBOARD_CACHE_KEY);
    let lbList: MemberEvaluation[] = rawLb ? JSON.parse(rawLb) : [];
    if (updatedEval) {
      const idx = lbList.findIndex(
        (m) =>
          m.user_id === input.userId ||
          normalizeStudentId(m.npm || m.nim) === cleanNpm
      );
      if (idx >= 0) {
        lbList[idx] = {
          ...lbList[idx],
          total_points: updatedEval.total_points,
          total_hadir: updatedEval.total_hadir,
          attendance_percentage: updatedEval.attendance_percentage,
          predicate: updatedEval.predicate,
        };
      } else {
        lbList.push(updatedEval);
      }
      lbList.sort((a, b) => (b.total_points || 0) - (a.total_points || 0));
      localStorage.setItem(LEADERBOARD_CACHE_KEY, JSON.stringify(lbList));
    }
  } catch (e) {
    console.warn('Gagal mengupdate leaderboard cache:', e);
  }

  // 5. Broadcast Event Realtime ke Seluruh Komponen / Tab
  try {
    window.dispatchEvent(
      new CustomEvent('simak_attendance_submitted', {
        detail: attRecord,
      })
    );
    window.dispatchEvent(
      new CustomEvent('simak_attendance_sync', {
        detail: attRecord,
      })
    );
    if (updatedEval) {
      window.dispatchEvent(
        new CustomEvent('simak_evaluations_sync', {
          detail: updatedEval,
        })
      );
    }
  } catch {}

  // 6. Simpan ke Supabase (jika online & kredensial valid)
  try {
    await (supabase.from('attendances') as any).insert({
      event_id: input.eventId,
      user_id: input.userId,
      status: attRecord.status,
      verified: attRecord.verified,
      user_lat: attRecord.user_lat,
      user_lng: attRecord.user_lng,
    });
  } catch (err: any) {
    console.warn('Database Supabase attendances notice (menggunakan sinkronisasi lokal terpadu):', err?.message);
  }

  return attRecord;
}

/**
 * Gabungkan data evaluasi dari Supabase dengan Overrides Lokal
 * Menjamin poin yang bertambah tidak pernah hilang saat refresh / re-fetch
 * Selalu mengesampingkan dan memfilter akun Super Admin agar tidak masuk ke leaderboard / rekap
 */
export function applyEvaluationsOverrides(
  baseList: MemberEvaluation[]
): MemberEvaluation[] {
  // Bersihkan residu akun superadmin dari cache
  purgeSuperAdminFromCache();

  let overrides: Record<string, any> = {};
  try {
    const rawOv = localStorage.getItem(EVALUATIONS_OVERRIDES_KEY);
    if (rawOv) overrides = JSON.parse(rawOv);
  } catch {}

  const merged = baseList
    .filter((item) => !isSuperAdminAccount(item))
    .map((item) => {
      const cleanId = normalizeStudentId(item.npm || item.nim);
      const ov = overrides[cleanId] || overrides[item.user_id];
      if (ov) {
        return {
          ...item,
          total_points: ov.total_points ?? item.total_points,
          total_hadir: ov.total_hadir ?? item.total_hadir,
          total_izin: ov.total_izin ?? item.total_izin,
          total_alfa: ov.total_alfa ?? item.total_alfa,
          attendance_percentage: ov.attendance_percentage ?? item.attendance_percentage,
          predicate: ov.predicate ?? item.predicate,
        };
      }
      return item;
    });

  // Tambahkan juga jika ada user override yang belum ada di baseList (kecuali Super Admin)
  for (const [key, ovItem] of Object.entries(overrides)) {
    if (isSuperAdminAccount(ovItem)) continue;
    const cleanKey = normalizeStudentId(key);
    if (
      !merged.some(
        (m) =>
          normalizeStudentId(m.npm || m.nim) === cleanKey ||
          m.user_id === ovItem.user_id
      )
    ) {
      merged.push(ovItem);
    }
  }

  return merged
    .filter((m) => !isSuperAdminAccount(m))
    .sort((a, b) => (b.total_points || 0) - (a.total_points || 0));
}

/**
 * Cek apakah seorang user (Admin/Kadiv/Anggota) sudah tercatat presensi pada acara tertentu
 */
export function isEventAttendedByUser(
  eventId: string,
  userId: string,
  userNpm?: string
): boolean {
  const cleanNpm = normalizeStudentId(userNpm);
  try {
    const rawAll = localStorage.getItem(ALL_ATTENDANCES_KEY);
    if (rawAll) {
      const all: any[] = JSON.parse(rawAll);
      const found = all.some(
        (a) =>
          a.event_id === eventId &&
          (a.user_id === userId || (cleanNpm && normalizeStudentId(a.npm || a.nim) === cleanNpm)) &&
          a.status === 'hadir'
      );
      if (found) return true;
    }
  } catch {}

  try {
    const rawPersonal = localStorage.getItem(`simak_attendances_${userId}`);
    if (rawPersonal) {
      const personal: any[] = JSON.parse(rawPersonal);
      const found = personal.some(
        (a) => a.event_id === eventId && a.status === 'hadir'
      );
      if (found) return true;
    }
  } catch {}

  return false;
}

/**
 * Setujui Presensi Izin / Delegasi secara Terpadu
 * Mengupdate status verified di seluruh storage lokal dan menambahkan poin jika delegasi
 */
export async function approveAttendanceSync(
  id: string,
  isDelegasi: boolean
): Promise<void> {
  let targetUser: any = null;

  // 1. Update di simak_all_attendances
  try {
    const rawAll = localStorage.getItem(ALL_ATTENDANCES_KEY);
    if (rawAll) {
      const allList = JSON.parse(rawAll);
      const updated = allList.map((p: any) => {
        if (p.id === id) {
          targetUser = p;
          return { ...p, verified: true };
        }
        return p;
      });
      localStorage.setItem(ALL_ATTENDANCES_KEY, JSON.stringify(updated));
    }
  } catch {}

  // 2. Update storage personal pengguna
  if (targetUser) {
    const userId = targetUser.user_id;
    const cleanNpm = normalizeStudentId(targetUser.npm || targetUser.nim);
    const addedPoints = isDelegasi ? 30 : 0;

    const userKeys = [`simak_attendances_${userId}`];
    if (cleanNpm && cleanNpm !== userId) userKeys.push(`simak_attendances_${cleanNpm}`);
    for (const key of userKeys) {
      try {
        const raw = localStorage.getItem(key);
        if (raw) {
          const list = JSON.parse(raw);
          const updated = list.map((a: any) =>
            a.id === id ? { ...a, verified: true } : a
          );
          localStorage.setItem(key, JSON.stringify(updated));
        }
      } catch {}
    }

    if (addedPoints > 0) {
      try {
        let currentEval: any = null;
        const rawPersonalEval = localStorage.getItem(`simak_eval_${userId}`);
        if (rawPersonalEval) {
          currentEval = JSON.parse(rawPersonalEval);
        } else {
          const rawOv = localStorage.getItem(EVALUATIONS_OVERRIDES_KEY);
          if (rawOv) {
            const ovMap = JSON.parse(rawOv);
            currentEval = ovMap[cleanNpm] || ovMap[userId] || null;
          }
        }

        const prevPoints = Number(currentEval?.total_points ?? 60);
        const nextPoints = prevPoints + addedPoints;
        const nextPredicate: EvaluationPredicate =
          nextPoints >= 80 ? 'Sangat Aktif' : nextPoints >= 60 ? 'Aktif' : 'Perlu Pembinaan';

        const updatedEval: MemberEvaluation = {
          user_id: userId,
          npm: cleanNpm,
          nim: cleanNpm,
          email: currentEval?.email || null,
          full_name: targetUser.full_name || currentEval?.full_name || 'Anggota GenBI',
          division: targetUser.division || currentEval?.division || 'Publikasi dan Sosialisasi',
          role: targetUser.role || currentEval?.role || 'member',
          avatar_url: currentEval?.avatar_url || null,
          total_points: nextPoints,
          total_hadir: Number(currentEval?.total_hadir ?? 4),
          total_izin: Number(currentEval?.total_izin ?? 0),
          total_alfa: Number(currentEval?.total_alfa ?? 0),
          attendance_percentage: Number(currentEval?.attendance_percentage ?? 80),
          predicate: nextPredicate,
        };

        localStorage.setItem(`simak_eval_${userId}`, JSON.stringify(updatedEval));
        if (cleanNpm && cleanNpm !== userId) {
          localStorage.setItem(`simak_eval_${cleanNpm}`, JSON.stringify(updatedEval));
        }

        let overrides: Record<string, any> = {};
        const rawOv = localStorage.getItem(EVALUATIONS_OVERRIDES_KEY);
        if (rawOv) {
          try {
            overrides = JSON.parse(rawOv);
          } catch {}
        }
        overrides[userId] = updatedEval;
        if (cleanNpm) overrides[cleanNpm] = updatedEval;
        localStorage.setItem(EVALUATIONS_OVERRIDES_KEY, JSON.stringify(overrides));
      } catch {}
    }
  }

  // 3. Broadcast Event Realtime
  try {
    window.dispatchEvent(
      new CustomEvent('simak_attendance_verified', {
        detail: { id, isDelegasi },
      })
    );
    window.dispatchEvent(
      new CustomEvent('simak_attendance_sync', {
        detail: { id, isDelegasi },
      })
    );
  } catch {}
}

