/**
 * SIMAK GENBI Point Configuration & Override Manager
 * Mengatur bobot poin presensi kegiatan biasa, presensi tugas delegasi Bank Indonesia,
 * serta penyesuaian langsung total poin anggota oleh Super Admin.
 */

import { supabase } from './supabase';
import { recordAuditLog } from './auditLog';
import { normalizeStudentId } from './memberSync';
import { broadcastAttendanceRecorded, broadcastPointSettingsMutated } from './meshSync';
import { sanitizeMemberIdentity } from './attendanceSync';

const SETTINGS_KEY = 'simak_point_settings';
const DEFAULT_DELEGASI_POINTS = 25;
const CLOUD_SETTINGS_QR_TOKEN = 'SIMAK_POINT_SETTINGS_V1';

export interface PointSettings {
  delegasiPoints: number; // default: 25
  defaultEventPoints: number; // default: 15
  updatedAt?: string;
  updatedBy?: string;
}

/**
 * Sinkronkan setelan poin dari Supabase Cloud agar seragam di Laptop, HP, dan Lab
 */
export async function syncPointSettingsFromCloud(): Promise<PointSettings> {
  const local = getPointSettings();
  try {
    const { data } = await (supabase.from('events') as any)
      .select('points, radius_meters, updated_at')
      .eq('qr_token', CLOUD_SETTINGS_QR_TOKEN)
      .maybeSingle();

    if (data && typeof data.points === 'number') {
      const cloudSettings: PointSettings = {
        delegasiPoints: Number(data.points || DEFAULT_DELEGASI_POINTS),
        defaultEventPoints: Number(data.radius_meters || 15),
        updatedAt: data.updated_at || new Date().toISOString(),
      };
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(cloudSettings));
      window.dispatchEvent(new CustomEvent('simak_point_settings_updated', { detail: cloudSettings }));
      return cloudSettings;
    }
  } catch {}
  return local;
}

/**
 * Mengambil setelan poin saat ini
 */
export function getPointSettings(): PointSettings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return {
        delegasiPoints: Number(parsed.delegasiPoints ?? DEFAULT_DELEGASI_POINTS),
        defaultEventPoints: Number(parsed.defaultEventPoints ?? 15),
        updatedAt: parsed.updatedAt,
        updatedBy: parsed.updatedBy,
      };
    }
  } catch {}
  return {
    delegasiPoints: DEFAULT_DELEGASI_POINTS,
    defaultEventPoints: 15,
  };
}

/**
 * Menyimpan setelan poin baru oleh Super Admin
 */
export function savePointSettings(settings: Partial<PointSettings>, actorName = 'Super Admin'): PointSettings {
  const current = getPointSettings();
  const next: PointSettings = {
    delegasiPoints: Math.max(1, Math.min(100, Number(settings.delegasiPoints ?? current.delegasiPoints))),
    defaultEventPoints: Math.max(1, Math.min(100, Number(settings.defaultEventPoints ?? current.defaultEventPoints))),
    updatedAt: new Date().toISOString(),
    updatedBy: actorName,
  };

  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(next));
    window.dispatchEvent(new CustomEvent('simak_point_settings_updated', { detail: next }));
    // Broadcast realtime P2P ke seluruh perangkat mobile & desktop aktif
    try {
      broadcastPointSettingsMutated(next);
    } catch {}
    // Simpan juga ke Supabase Cloud agar tersinkron ke semua perangkat
    (async () => {
      try {
        const { data: existing } = await (supabase.from('events') as any)
          .select('id')
          .eq('qr_token', CLOUD_SETTINGS_QR_TOKEN)
          .maybeSingle();
        if (existing?.id) {
          await (supabase.from('events') as any)
            .update({ points: next.delegasiPoints, radius_meters: next.defaultEventPoints })
            .eq('id', existing.id);
        } else {
          await (supabase.from('events') as any).insert({
            title: 'Konfigurasi Bobot Poin SIMAK',
            category: 'mubes-system',
            event_date: new Date().toISOString(),
            points: next.delegasiPoints,
            radius_meters: next.defaultEventPoints,
            qr_token: CLOUD_SETTINGS_QR_TOKEN,
            is_active: false,
            require_location: false,
          });
        }
      } catch {}
    })();
    recordAuditLog({
      actorName,
      actorRole: 'Super Admin',
      actionType: 'SETTINGS_UPDATE',
      target: 'Bobot Poin Presensi',
      description: `Mengubah bobot poin presensi: Delegasi BI = +${next.delegasiPoints} Poin, Kegiatan Default = +${next.defaultEventPoints} Poin.`,
    });
  } catch {}

  return next;
}

/**
 * Memperbarui langsung total poin dan riwayat keaktifan anggota oleh Super Admin
 */
export async function updateMemberPointsDirectly(
  identifier: string,
  newTotalPoints: number,
  notes: string = 'Penyesuaian poin oleh Super Admin',
  actorName: string = 'Super Admin'
): Promise<{ success: boolean; message: string; updatedEval?: any }> {
  const cleanId = normalizeStudentId(identifier);
  if (!cleanId) {
    return { success: false, message: 'NPM / User ID tidak valid.' };
  }

  const cappedPoints = Math.max(0, Number(newTotalPoints));
  const nextPredicate = cappedPoints >= 80 ? 'Sangat Aktif' : cappedPoints >= 60 ? 'Aktif' : 'Perlu Pembinaan';

  try {
    // 1. Ambil evaluasi eksisting dari localStorage
    const rawOv = localStorage.getItem('simak_evaluations_overrides');
    const ovMap = rawOv ? JSON.parse(rawOv) : {};
    let existingEval = ovMap[cleanId] || null;

    if (!existingEval) {
      try {
        const rawPersonal = localStorage.getItem(`simak_eval_${cleanId}`);
        if (rawPersonal) existingEval = JSON.parse(rawPersonal);
      } catch {}
    }

    const updatedEval = sanitizeMemberIdentity({
      ...(existingEval || {}),
      user_id: existingEval?.user_id || cleanId,
      npm: cleanId,
      nim: cleanId,
      full_name: existingEval?.full_name || existingEval?.fullName || cleanId,
      division: existingEval?.division || 'Publikasi dan Sosialisasi',
      role: existingEval?.role || 'member',
      total_points: cappedPoints,
      predicate: nextPredicate,
      updated_at: new Date().toISOString(),
    });

    // 2. Simpan ke overrides lokal
    ovMap[cleanId] = updatedEval;
    if (updatedEval.user_id && updatedEval.user_id !== cleanId) {
      ovMap[updatedEval.user_id] = updatedEval;
    }
    localStorage.setItem('simak_evaluations_overrides', JSON.stringify(ovMap));
    localStorage.setItem(`simak_eval_${cleanId}`, JSON.stringify(updatedEval));
    if (updatedEval.user_id) {
      localStorage.setItem(`simak_eval_${updatedEval.user_id}`, JSON.stringify(updatedEval));
    }

    // 3. Update ke Leaderboard Cache
    try {
      const rawLb = localStorage.getItem('simak_leaderboard_cache');
      let lbList: any[] = rawLb ? JSON.parse(rawLb) : [];
      const idx = lbList.findIndex(
        (m) => normalizeStudentId(m.npm || m.nim) === cleanId || m.user_id === cleanId
      );
      if (idx >= 0) {
        lbList[idx] = { ...lbList[idx], ...updatedEval };
      } else {
        lbList.push(updatedEval);
      }
      lbList.sort((a, b) => (b.total_points || 0) - (a.total_points || 0));
      localStorage.setItem('simak_leaderboard_cache', JSON.stringify(lbList));
      window.dispatchEvent(new CustomEvent('simak_leaderboard_sync', { detail: lbList }));
    } catch {}

    // 4. Update ke Database Supabase member_evaluations jika tabel terhubung
    try {
      await (supabase.from('member_evaluations') as any).upsert(
        {
          npm: cleanId,
          total_points: cappedPoints,
          predicate: nextPredicate,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'npm' }
      );
    } catch {}

    // 5. Broadcast ke seluruh tab & perangkat
    window.dispatchEvent(new CustomEvent('simak_evaluations_sync', { detail: updatedEval }));
    try {
      broadcastAttendanceRecorded(
        { id: `adj-${Date.now()}`, npm: cleanId, user_id: updatedEval.user_id, status: 'adjustment' },
        updatedEval
      );
    } catch {}

    // 6. Audit Trail
    recordAuditLog({
      actorName,
      actorRole: 'Super Admin',
      actionType: 'EVALUATION_OVERRIDE',
      target: `${cleanId} (${updatedEval.full_name})`,
      description: `Super Admin menyesuaikan poin menjadi ${cappedPoints} Poin (${nextPredicate}). Alasan: ${notes}.`,
    });

    return {
      success: true,
      message: `Poin untuk ${updatedEval.full_name} berhasil diubah menjadi ${cappedPoints} Poin!`,
      updatedEval,
    };
  } catch (err: any) {
    return {
      success: false,
      message: 'Gagal memperbarui poin: ' + (err.message || 'Kesalahan sistem'),
    };
  }
}
