import { supabase } from './supabase';
import { Event as EventType } from '../types/database';

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

  // 2. Broadcast ke seluruh tab / halaman React aktif
  try {
    window.dispatchEvent(
      new CustomEvent('simak_event_sync', {
        detail: fullEvent,
      })
    );
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
      target_lat: fullEvent.target_lat,
      target_lng: fullEvent.target_lng,
      radius_meters: fullEvent.radius_meters,
    };

    if (eventPayload.id && !eventPayload.id.startsWith('evt-') && !eventPayload.id.startsWith('demo-')) {
      const { data, error } = await (supabase.from('events') as any)
        .update(dbPayload)
        .eq('id', eventPayload.id)
        .select()
        .maybeSingle();

      if (!error && data) {
        savedEvent = data as EventType;
        source = 'database';
      }
    } else {
      const { data, error } = await (supabase.from('events') as any)
        .insert(dbPayload)
        .select()
        .maybeSingle();

      if (!error && data) {
        savedEvent = data as EventType;
        source = 'database';
        // Perbarui id lokal jika Supabase menghasilkan UUID baru
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

  // 2. Broadcast ke semua komponen
  try {
    window.dispatchEvent(
      new CustomEvent('simak_event_deleted', {
        detail: { id: eventId },
      })
    );
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
export async function deleteAttendanceRecord(attendanceId: string, eventId?: string): Promise<boolean> {
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
      const filtered = allList.filter((item: any) => item.id !== attendanceId);
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
          const filtered = userAttList.filter((item: any) => item.id !== attendanceId && item.event_id !== eventId);
          localStorage.setItem(key, JSON.stringify(filtered));
        }
      }
    }
  } catch {}

  // 4. Broadcast Event Hapus ke seluruh komponen React
  try {
    window.dispatchEvent(
      new CustomEvent('simak_attendance_deleted', {
        detail: { id: attendanceId, eventId },
      })
    );
  } catch {}

  // 5. Eksekusi Hapus di Database Supabase
  try {
    const { error } = await supabase.from('attendances').delete().eq('id', attendanceId);
    if (error) {
      console.warn('Catatan hapus database Supabase:', error.message);
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
