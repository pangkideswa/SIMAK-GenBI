import { supabase } from './supabase';
import { Event as EventType } from '../types/database';
import { normalizeStudentId } from './memberSync';
import {
  broadcastEventMutated,
  broadcastEventDeleted,
  toggleEventLockCloud,
  broadcastAttendanceDeleted,
} from './meshSync';

const EVENTS_OVERRIDES_KEY = 'simak_events_overrides';
const DELETED_EVENTS_KEY = 'simak_deleted_events';
const DELETED_ATTENDANCES_KEY = 'simak_deleted_attendances';
const ALL_ATTENDANCES_KEY = 'simak_all_attendances';

/**
 * Simpan atau buat kegiatan baru (Supabase + Local Fallback + Broadcast Event)
 */
export async function saveOrUpdateEvent(eventPayload: Partial<EventType> & { id?: string }): Promise<{
  event: EventType;
  source: 'database' | 'local';
}> {
  const eventId = eventPayload.id || `evt-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  const fullEvent: EventType = {
    id: eventId,
    title: eventPayload.title || 'Agenda Baru',
    category: eventPayload.category || 'Proker',
    event_date: eventPayload.event_date || new Date().toISOString(),
    points: Number(eventPayload.points || 15),
    qr_token: (eventPayload.qr_token || 'TOKEN').toUpperCase(),
    is_active: eventPayload.is_active ?? true,
    require_location: eventPayload.require_location ?? false,
    location_name: eventPayload.location_name?.trim() || 'Kampus Universitas Majalengka',
    target_lat: eventPayload.target_lat ?? -6.8362,
    target_lng: eventPayload.target_lng ?? 108.2275,
    radius_meters: eventPayload.radius_meters ?? 250,
    created_by: eventPayload.created_by || null,
    created_at: new Date().toISOString(),
  };

  // 1. Simpan ke local overrides agar instan & tidak pernah hilang
  try {
    const raw = localStorage.getItem(EVENTS_OVERRIDES_KEY);
    const overrides = raw ? JSON.parse(raw) : {};
    overrides[eventId] = fullEvent;
    localStorage.setItem(EVENTS_OVERRIDES_KEY, JSON.stringify(overrides));

    // Pastikan tidak ada di daftar deleted
    const rawDel = localStorage.getItem(DELETED_EVENTS_KEY);
    if (rawDel) {
      const delList = JSON.parse(rawDel);
      const filtered = delList.filter((id: string) => id !== eventId);
      localStorage.setItem(DELETED_EVENTS_KEY, JSON.stringify(filtered));
    }
  } catch (e) {
    console.warn('Gagal menyimpan event overrides:', e);
  }

  // 2. Broadcast ke seluruh tab / halaman React aktif & P2P Mesh Realtime (Desktop & Mobile)
  try {
    window.dispatchEvent(
      new CustomEvent('simak_event_sync', {
        detail: fullEvent,
      })
    );
    broadcastEventMutated(fullEvent);
  } catch {}

  // 3. Simpan ke Database Supabase jika memungkinkan
  let savedEvent = fullEvent;
  let source: 'database' | 'local' = 'local';

  try {
    // Siapkan payload bersih tanpa foreign key yang bisa memicu RLS violation
    const dbPayload: any = {
      title: fullEvent.title,
      category: fullEvent.category,
      event_date: fullEvent.event_date,
      points: fullEvent.points,
      qr_token: fullEvent.qr_token,
      is_active: fullEvent.is_active,
      require_location: fullEvent.require_location,
      location_name: fullEvent.location_name,
      target_lat: fullEvent.target_lat,
      target_lng: fullEvent.target_lng,
      radius_meters: fullEvent.radius_meters,
    };

    const runSave = async (payloadToSend: any) => {
      if (eventPayload.id && !eventPayload.id.startsWith('evt-') && !eventPayload.id.startsWith('demo-')) {
        return (supabase.from('events') as any)
          .update(payloadToSend)
          .eq('id', eventPayload.id)
          .select()
          .maybeSingle();
      }
      return (supabase.from('events') as any)
        .insert(payloadToSend)
        .select()
        .maybeSingle();
    };

    let { data, error } = await runSave(dbPayload);
    if (error && String(error.message || '').toLowerCase().includes('location_name')) {
      const { location_name: _omit, ...fallbackPayload } = dbPayload;
      const retryRes = await runSave(fallbackPayload);
      data = retryRes.data;
      error = retryRes.error;
    }

    if (!error && data) {
      savedEvent = { ...data, location_name: data.location_name || fullEvent.location_name } as EventType;
      source = 'database';
      if (!eventPayload.id || eventPayload.id.startsWith('evt-') || eventPayload.id.startsWith('demo-')) {
        const raw = localStorage.getItem(EVENTS_OVERRIDES_KEY);
        const overrides = raw ? JSON.parse(raw) : {};
        delete overrides[eventId];
        overrides[savedEvent.id] = savedEvent;
        localStorage.setItem(EVENTS_OVERRIDES_KEY, JSON.stringify(overrides));
      }
    }
  } catch (err) {
    console.warn('Catatan database saat menyimpan event (menggunakan penyimpanan lokal):', err);
  }

  return { event: savedEvent, source };
}

/**
 * Hapus agenda kegiatan
 */
export async function deleteEventPermanently(eventId: string): Promise<boolean> {
  // 1. Catat ke deleted events agar tidak muncul lagi dari database
  try {
    const rawDel = localStorage.getItem(DELETED_EVENTS_KEY);
    const delList = rawDel ? JSON.parse(rawDel) : [];
    if (!delList.includes(eventId)) {
      delList.push(eventId);
      localStorage.setItem(DELETED_EVENTS_KEY, JSON.stringify(delList));
    }

    const raw = localStorage.getItem(EVENTS_OVERRIDES_KEY);
    if (raw) {
      const overrides = JSON.parse(raw);
      delete overrides[eventId];
      localStorage.setItem(EVENTS_OVERRIDES_KEY, JSON.stringify(overrides));
    }
  } catch {}

  // 2. Broadcast ke semua komponen & P2P Mesh Realtime
  try {
    window.dispatchEvent(
      new CustomEvent('simak_event_deleted', {
        detail: { id: eventId },
      })
    );
    broadcastEventDeleted(eventId);
  } catch {}

  // 3. Hapus dari Supabase
  try {
    await supabase.from('events').delete().eq('id', eventId);
  } catch {}

  return true;
}

/**
 * HAPUS PRESENSI PESERTA (Perbaikan Bug "Sukses tapi Data Masih Ada")
 * Menghapus dari Supabase, daftar blacklist lokal, simak_all_attendances, dan sesi user.
 */
export async function deleteAttendanceRecord(
  attendanceId: string,
  eventId?: string,
  memberInfo?: { userId?: string; npm?: string; points?: number }
): Promise<boolean> {
  const targetUserId = memberInfo?.userId;
  const targetNpm = normalizeStudentId(memberInfo?.npm);
  const deductionPoints = Number(memberInfo?.points || 0);

  // 1. Masukkan ke Blacklist Hapus agar tidak pernah muncul lagi saat load/fetch
  try {
    const rawDel = localStorage.getItem(DELETED_ATTENDANCES_KEY);
    const delList: string[] = rawDel ? JSON.parse(rawDel) : [];
    if (!delList.includes(attendanceId)) {
      delList.push(attendanceId);
      localStorage.setItem(DELETED_ATTENDANCES_KEY, JSON.stringify(delList));
    }
  } catch {}

  // 2. Bersihkan dari simak_all_attendances
  try {
    const rawAll = localStorage.getItem(ALL_ATTENDANCES_KEY);
    if (rawAll) {
      const allList = JSON.parse(rawAll);
      const filtered = allList.filter(
        (item: any) =>
          item.id !== attendanceId &&
          !(eventId && (item.event_id === eventId || item.eventId === eventId) &&
            ((targetUserId && item.user_id === targetUserId) ||
             (targetNpm && normalizeStudentId(item.npm || item.nim) === targetNpm)))
      );
      localStorage.setItem(ALL_ATTENDANCES_KEY, JSON.stringify(filtered));
    }
  } catch {}

  // 3. Bersihkan dari penyimpanan per-user di localStorage
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith('simak_attendances_')) {
        const rawUserAtt = localStorage.getItem(key);
        if (rawUserAtt) {
          const userAttList = JSON.parse(rawUserAtt);
          const filtered = userAttList.filter(
            (item: any) =>
              item.id !== attendanceId &&
              !(eventId && (item.event_id === eventId || item.eventId === eventId))
          );
          localStorage.setItem(key, JSON.stringify(filtered));
        }
      }
    }
  } catch {}

  // 4. Update dan kurangi evaluasi poin serta total_hadir anggota
  let updatedEval: any = null;
  try {
    const rawOv = localStorage.getItem('simak_evaluations_overrides');
    const ovMap = rawOv ? JSON.parse(rawOv) : {};

    const findKey = targetNpm || targetUserId;
    let currentEval = findKey ? ovMap[findKey] : null;
    if (!currentEval && targetUserId) {
      const rawUser = localStorage.getItem(`simak_eval_${targetUserId}`);
      if (rawUser) currentEval = JSON.parse(rawUser);
    }
    if (!currentEval && targetNpm) {
      const rawNpm = localStorage.getItem(`simak_eval_${targetNpm}`);
      if (rawNpm) currentEval = JSON.parse(rawNpm);
    }

    if (currentEval) {
      const nextPts = Math.max(0, (currentEval.total_points || 0) - (deductionPoints > 0 ? deductionPoints : 10));
      const nextHadir = Math.max(0, (currentEval.total_hadir || 1) - 1);
      const nextPredicate = nextPts >= 80 ? 'Sangat Aktif' : nextPts >= 60 ? 'Aktif' : 'Perlu Pembinaan';

      updatedEval = {
        ...currentEval,
        total_points: nextPts,
        total_hadir: nextHadir,
        predicate: nextPredicate,
      };

      if (targetUserId) {
        ovMap[targetUserId] = updatedEval;
        localStorage.setItem(`simak_eval_${targetUserId}`, JSON.stringify(updatedEval));
      }
      if (targetNpm) {
        ovMap[targetNpm] = updatedEval;
        localStorage.setItem(`simak_eval_${targetNpm}`, JSON.stringify(updatedEval));
      }
      localStorage.setItem('simak_evaluations_overrides', JSON.stringify(ovMap));

      // Update cache leaderboard
      const rawLb = localStorage.getItem('simak_leaderboard_cache');
      if (rawLb) {
        let lbList = JSON.parse(rawLb);
        const idx = lbList.findIndex(
          (m: any) =>
            (targetUserId && m.user_id === targetUserId) ||
            (targetNpm && normalizeStudentId(m.npm || m.nim) === targetNpm)
        );
        if (idx >= 0) {
          lbList[idx] = { ...lbList[idx], ...updatedEval };
          lbList.sort((a: any, b: any) => (b.total_points || 0) - (a.total_points || 0));
          localStorage.setItem('simak_leaderboard_cache', JSON.stringify(lbList));
        }
      }
    }
  } catch (err) {
    console.warn('Gagal memperbarui evaluasi lokal saat hapus presensi:', err);
  }

  // 5. Broadcast Event Hapus ke seluruh komponen React & P2P Mesh Realtime
  try {
    window.dispatchEvent(
      new CustomEvent('simak_attendance_deleted', {
        detail: {
          id: attendanceId,
          eventId,
          userId: targetUserId,
          npm: targetNpm,
          deductionPoints,
          evaluation: updatedEval,
        },
      })
    );
    broadcastAttendanceDeleted(attendanceId, eventId, {
      userId: targetUserId,
      npm: targetNpm,
      deductionPoints,
      evaluation: updatedEval,
    });
  } catch {}

  // 6. Eksekusi Hapus di Database Supabase (by UUID id atau kombinasi user_id + event_id)
  try {
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(attendanceId);
    if (isUuid) {
      const { error } = await supabase.from('attendances').delete().eq('id', attendanceId);
      if (error) {
        console.warn('Catatan hapus database Supabase (by id):', error.message);
      }
    }
    if (targetUserId && eventId) {
      const { error: pairErr } = await supabase
        .from('attendances')
        .delete()
        .eq('user_id', targetUserId)
        .eq('event_id', eventId);
      if (pairErr) {
        console.warn('Catatan hapus database Supabase (by user+event):', pairErr.message);
      }
    }

    // Sinkronkan pengurangan poin & kehadiran ke member_evaluations Supabase Cloud
    if (updatedEval && (targetUserId || targetNpm)) {
      const evalUpdatePayload = {
        total_points: updatedEval.total_points,
        total_hadir: updatedEval.total_hadir,
        predicate: updatedEval.predicate,
      };
      if (targetUserId && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(targetUserId)) {
        await (supabase.from('member_evaluations') as any)
          .update(evalUpdatePayload)
          .eq('user_id', targetUserId);
      } else if (targetNpm) {
        await (supabase.from('member_evaluations') as any)
          .update(evalUpdatePayload)
          .or(`npm.eq.${targetNpm},nim.eq.${targetNpm}`);
      }
    }
  } catch (err: any) {
    console.warn('Gagal menghubungi database saat menghapus presensi:', err?.message);
  }

  return true;
}

/**
 * Filter daftar presensi agar tidak menyertakan data yang sudah dihapus
 */
export function filterDeletedAttendances<T extends { id: string }>(list: T[]): T[] {
  try {
    const rawDel = localStorage.getItem(DELETED_ATTENDANCES_KEY);
    if (!rawDel) return list;
    const delList: string[] = JSON.parse(rawDel);
    if (!Array.isArray(delList) || delList.length === 0) return list;
    const delSet = new Set(delList);
    return list.filter((item) => !delSet.has(item.id));
  } catch {
    return list;
  }
}

/**
 * Filter daftar event agar tidak menyertakan agenda yang sudah dihapus
 */
export function filterDeletedEvents(events: EventType[]): EventType[] {
  try {
    const rawDel = localStorage.getItem(DELETED_EVENTS_KEY);
    if (!rawDel) return events;
    const delList: string[] = JSON.parse(rawDel);
    if (!Array.isArray(delList) || delList.length === 0) return events;
    const delSet = new Set(delList);
    return events.filter((e) => !delSet.has(e.id));
  } catch {
    return events;
  }
}

/**
 * Toggle status aktif/kunci sesi presensi agenda (Persisten di Supabase & Local Overrides)
 */
export async function toggleEventLock(eventId: string, nextStatus: boolean): Promise<void> {
  // 1. Simpan ke local overrides agar instan & tidak pernah hilang saat refresh
  try {
    const raw = localStorage.getItem(EVENTS_OVERRIDES_KEY);
    const overrides = raw ? JSON.parse(raw) : {};
    overrides[eventId] = {
      ...(overrides[eventId] || {}),
      id: eventId,
      is_active: nextStatus,
    };
    localStorage.setItem(EVENTS_OVERRIDES_KEY, JSON.stringify(overrides));
  } catch (e) {
    console.warn('Gagal menyimpan status kunci event ke cache lokal:', e);
  }

    // 2. Broadcast ke seluruh tab / komponen React aktif & Cloud Mesh
  try {
    window.dispatchEvent(
      new CustomEvent('simak_event_lock_sync', {
        detail: { eventId, is_active: nextStatus },
      })
    );
    toggleEventLockCloud(eventId, nextStatus);
    const raw = localStorage.getItem(EVENTS_OVERRIDES_KEY);
    if (raw) {
      const ov = JSON.parse(raw);
      if (ov[eventId]) {
        broadcastEventMutated(ov[eventId]);
      }
    }
  } catch {}

  // 3. Update ke Supabase database jika terhubung
  try {
    await (supabase.from('events') as any).update({ is_active: nextStatus }).eq('id', eventId);
  } catch (err) {
    console.warn('Supabase event lock update note:', err);
  }
}
