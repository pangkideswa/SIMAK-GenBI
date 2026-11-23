import { supabase } from './supabase';
import type { Event as EventType } from '../types/database';
import { sanitizeMemberIdentity } from './attendanceSync';
import { normalizeStudentId } from './memberSync';

const MESH_CHANNEL_NAME = 'simak_realtime_mesh';
const EVENTS_OVERRIDES_KEY = 'simak_events_overrides';
const ALL_ATTENDANCES_KEY = 'simak_all_attendances';
const AWARDS_STORAGE_KEY = 'simak_mubes_awards_state';

export interface MeshHandlers {
  onEventMutated?: (event: EventType) => void;
  onEventDeleted?: (eventId: string) => void;
  onAttendanceMutated?: (record: any) => void;
  onAttendanceDeleted?: (attendanceId: string, eventId?: string) => void;
  onAwardsMutated?: (awardsState: any) => void;
}

const registeredHandlers = new Set<MeshHandlers>();

let meshChannel: ReturnType<typeof supabase.channel> | null = null;
let isChannelSubscribed = false;

/**
 * 1. HTTP Cloud Sync untuk Events (API Vite Dev Server / Vercel Serverless / Public JSON)
 */
export async function fetchEventsCloud(): Promise<EventType[] | null> {
  const endpoints = ['/api/events', '/events-cloud.json'];

  for (const url of endpoints) {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 2500);

      const res = await fetch(url + '?_t=' + Date.now(), {
        method: 'GET',
        headers: { 'Cache-Control': 'no-cache, no-store, must-revalidate' },
        signal: controller.signal,
      });
      clearTimeout(timer);

      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data) && data.length > 0) {
          // Sinkronkan ke local overrides perangkat saat ini
          try {
            const raw = localStorage.getItem(EVENTS_OVERRIDES_KEY);
            const currentOv = raw ? JSON.parse(raw) : {};
            let changed = false;
            for (const ev of data) {
              if (ev && ev.id && !currentOv[ev.id]) {
                currentOv[ev.id] = ev;
                changed = true;
              }
            }
            if (changed) {
              localStorage.setItem(EVENTS_OVERRIDES_KEY, JSON.stringify(currentOv));
            }
          } catch {}
          return data as EventType[];
        }
      }
    } catch {}
  }

  return null;
}

/**
 * Simpan event baru atau update ke Cloud endpoint (LAN / Vercel)
 */
export async function saveEventCloud(event: EventType): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 3000);

    const res = await fetch('/api/events', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'save', event }),
      signal: controller.signal,
    });
    clearTimeout(timer);
    return res.ok;
  } catch {
    return false;
  }
}

/**
 * Hapus event dari Cloud endpoint
 */
export async function deleteEventCloud(eventId: string): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 3000);

    const res = await fetch('/api/events', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'delete', eventId }),
      signal: controller.signal,
    });
    clearTimeout(timer);
    return res.ok;
  } catch {
    return false;
  }
}

/**
 * Toggle kunci sesi presensi event di Cloud endpoint
 */
export async function toggleEventLockCloud(eventId: string, nextStatus: boolean): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 3000);

    const res = await fetch('/api/events', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'toggleLock', eventId, nextStatus }),
      signal: controller.signal,
    });
    clearTimeout(timer);
    return res.ok;
  } catch {
    return false;
  }
}

/**
 * 2. HTTP Cloud Sync untuk Evaluasi Poin & Leaderboard (LAN / Vercel Serverless / JSON)
 */
export async function fetchEvaluationsCloud(): Promise<any[] | null> {
  const endpoints = ['/api/evaluations', '/evaluations-cloud.json'];

  for (const url of endpoints) {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 2500);

      const res = await fetch(url + '?_t=' + Date.now(), {
        method: 'GET',
        headers: { 'Cache-Control': 'no-cache, no-store, must-revalidate' },
        signal: controller.signal,
      });
      clearTimeout(timer);

      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data) && data.length > 0) {
          try {
            const raw = localStorage.getItem('simak_evaluations_overrides');
            const currentOv = raw ? JSON.parse(raw) : {};
            let changed = false;
            for (const ev of data) {
              if (ev && (ev.user_id || ev.npm || ev.nim)) {
                const key = ev.npm || ev.nim || ev.user_id;
                const safeEv = sanitizeMemberIdentity(ev);
                safeEv.total_points = Math.min(100, Math.max(0, safeEv.total_points || 0));
                if (!currentOv[key] || (safeEv.total_points >= (currentOv[key].total_points || 0))) {
                  currentOv[key] = {
                    ...currentOv[key],
                    ...safeEv,
                  };
                  changed = true;
                }
              }
            }
            if (changed) {
              localStorage.setItem('simak_evaluations_overrides', JSON.stringify(currentOv));
            }
          } catch {}
          return data;
        }
      }
    } catch {}
  }

  return null;
}

/**
 * Simpan atau perbarui evaluasi poin anggota ke Cloud endpoint (LAN / Vercel)
 */
export async function saveEvaluationCloud(evaluation: any): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 3000);
    const safeEval = sanitizeMemberIdentity(evaluation);
    safeEval.total_points = Math.min(100, Math.max(0, safeEval.total_points || 0));

    const res = await fetch('/api/evaluations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'save', evaluation: safeEval }),
      signal: controller.signal,
    });
    clearTimeout(timer);
    return res.ok;
  } catch {
    return false;
  }
}

/**
 * Pastikan channel Realtime WebSocket Supabase selalu aktif
 */
export function ensureMeshChannel(): ReturnType<typeof supabase.channel> {
  if (meshChannel && isChannelSubscribed) {
    return meshChannel;
  }

  if (meshChannel) {
    return meshChannel;
  }

  meshChannel = supabase.channel(MESH_CHANNEL_NAME);

  // A. Menerima Event Mutasi (Buat/Edit/Kunci Sesi) dari Peer (Desktop/Mobile)
  meshChannel.on('broadcast', { event: 'EVENT_MUTATED' }, ({ payload }) => {
    if (payload && payload.id) {
      const incomingEvent: EventType = payload;

      // Update ke localStorage lokal
      try {
        const raw = localStorage.getItem(EVENTS_OVERRIDES_KEY);
        const ov = raw ? JSON.parse(raw) : {};
        ov[incomingEvent.id] = incomingEvent;
        localStorage.setItem(EVENTS_OVERRIDES_KEY, JSON.stringify(ov));
      } catch {}

      // Dispatch event lokal
      try {
        window.dispatchEvent(
          new CustomEvent('simak_event_sync', { detail: incomingEvent })
        );
      } catch {}

      for (const h of registeredHandlers) {
        try {
          h.onEventMutated?.(incomingEvent);
        } catch {}
      }
    }
  });

  // B. Menerima Hapus Event dari Peer
  meshChannel.on('broadcast', { event: 'EVENT_DELETED' }, ({ payload }) => {
    if (payload && payload.eventId) {
      const { eventId } = payload;
      try {
        const raw = localStorage.getItem(EVENTS_OVERRIDES_KEY);
        if (raw) {
          const ov = JSON.parse(raw);
          delete ov[eventId];
          localStorage.setItem(EVENTS_OVERRIDES_KEY, JSON.stringify(ov));
        }
      } catch {}

      try {
        window.dispatchEvent(
          new CustomEvent('simak_event_deleted', { detail: { id: eventId } })
        );
      } catch {}

      for (const h of registeredHandlers) {
        try {
          h.onEventDeleted?.(eventId);
        } catch {}
      }
    }
  });

// C. Menerima Presensi Masuk dari Peer (misal Anggota scan dari HP)
  meshChannel.on('broadcast', { event: 'ATTENDANCE_RECORDED' }, ({ payload }) => {
    if (payload) {
      const incomingRecord = payload.record || (payload.id ? payload : null);
      const incomingEval = payload.evaluation || null;

      if (incomingRecord) {
        const safeRecord = sanitizeMemberIdentity(incomingRecord);

        // Simpan ke shared global cache lokal
        try {
          const rawAll = localStorage.getItem(ALL_ATTENDANCES_KEY);
          const allList: any[] = rawAll ? JSON.parse(rawAll) : [];
          const filtered = allList.filter((a) => a.id !== safeRecord.id);
          filtered.unshift(safeRecord);
          localStorage.setItem(ALL_ATTENDANCES_KEY, JSON.stringify(filtered));

          // Simpan juga ke cache personal anggota (simak_attendances_*) agar riwayat kartu anggota langsung muncul
          const targetUserId = safeRecord.user_id || safeRecord.userId;
          const targetNpm = safeRecord.npm || safeRecord.nim;
          const keysToUpdate: string[] = [];
          if (targetUserId) keysToUpdate.push(`simak_attendances_${targetUserId}`);
          if (targetNpm && targetNpm !== targetUserId) keysToUpdate.push(`simak_attendances_${targetNpm}`);

          for (const k of keysToUpdate) {
            try {
              const personalRaw = localStorage.getItem(k);
              const personalList: any[] = personalRaw ? JSON.parse(personalRaw) : [];
              const pFiltered = personalList.filter((a) => a.id !== safeRecord.id && a.event_id !== safeRecord.event_id);
              pFiltered.unshift(safeRecord);
              localStorage.setItem(k, JSON.stringify(pFiltered));
            } catch {}
          }
        } catch {}

        try {
          window.dispatchEvent(
            new CustomEvent('simak_attendance_submitted', { detail: safeRecord })
          );
          window.dispatchEvent(
            new CustomEvent('simak_attendance_sync', { detail: safeRecord })
          );
        } catch {}

        for (const h of registeredHandlers) {
          try {
            h.onAttendanceMutated?.(safeRecord);
          } catch {}
        }
      }

      if (incomingEval) {
        const safeEval = sanitizeMemberIdentity(incomingEval);
        safeEval.total_points = Math.min(100, Math.max(0, safeEval.total_points || 0));

        try {
          const rawOv = localStorage.getItem('simak_evaluations_overrides');
          const ov = rawOv ? JSON.parse(rawOv) : {};
          const key1 = safeEval.user_id;
          const key2 = safeEval.npm || safeEval.nim;
          if (key1) ov[key1] = safeEval;
          if (key2) ov[key2] = safeEval;
          localStorage.setItem('simak_evaluations_overrides', JSON.stringify(ov));

          if (key1) localStorage.setItem(`simak_eval_${key1}`, JSON.stringify(safeEval));
          if (key2) localStorage.setItem(`simak_eval_${key2}`, JSON.stringify(safeEval));

          const rawLb = localStorage.getItem('simak_leaderboard_cache');
          let lbList: any[] = rawLb ? JSON.parse(rawLb) : [];
          const idx = lbList.findIndex(
            (m) => (key1 && m.user_id === key1) || (key2 && (m.npm === key2 || m.nim === key2))
          );
          if (idx >= 0) {
            lbList[idx] = { ...lbList[idx], ...safeEval };
          } else {
            lbList.push(safeEval);
          }
          lbList.sort((a, b) => (b.total_points || 0) - (a.total_points || 0));
          localStorage.setItem('simak_leaderboard_cache', JSON.stringify(lbList));

          window.dispatchEvent(
            new CustomEvent('simak_evaluations_sync', { detail: safeEval })
          );
          window.dispatchEvent(
            new CustomEvent('simak_leaderboard_sync', { detail: lbList })
          );
        } catch {}
      }
    }
  });

  // D. Menerima Hapus Presensi dari Peer
  meshChannel.on('broadcast', { event: 'ATTENDANCE_DELETED' }, ({ payload }) => {
    if (payload && payload.attendanceId) {
      try {
        window.dispatchEvent(
          new CustomEvent('simak_attendance_deleted', {
            detail: { id: payload.attendanceId, eventId: payload.eventId },
          })
        );
      } catch {}

      for (const h of registeredHandlers) {
        try {
          h.onAttendanceDeleted?.(payload.attendanceId, payload.eventId);
        } catch {}
      }
    }
  });

  // E. Menerima Update Mubes Awards (Publikasi & Voting) dari Peer
  meshChannel.on('broadcast', { event: 'AWARDS_MUTATED' }, ({ payload }) => {
    if (payload && typeof payload === 'object') {
      try {
        localStorage.setItem(AWARDS_STORAGE_KEY, JSON.stringify(payload));
        window.dispatchEvent(
          new CustomEvent('simak_awards_sync', { detail: payload })
        );
      } catch {}

      for (const h of registeredHandlers) {
        try {
          h.onAwardsMutated?.(payload);
        } catch {}
      }
    }
  });

  // F. Handshake Sinkronisasi Penuh Saat Perangkat Baru Bergabung
  meshChannel.on('broadcast', { event: 'REQUEST_STATE_SYNC' }, async () => {
    try {
      const rawEvents = localStorage.getItem(EVENTS_OVERRIDES_KEY);
      const rawAtt = localStorage.getItem(ALL_ATTENDANCES_KEY);
      const rawAwards = localStorage.getItem(AWARDS_STORAGE_KEY);
      const rawEvals = localStorage.getItem('simak_evaluations_overrides');
      const rawLeaderboard = localStorage.getItem('simak_leaderboard_cache');
      const rawPointSettings = localStorage.getItem('simak_point_settings');
      const rawWhitelist = localStorage.getItem('simak_whitelist_overrides');
      const rawPublish = localStorage.getItem('simak_leaderboard_published');

      if (rawEvents || rawAtt || rawAwards || rawEvals || rawLeaderboard || rawPointSettings || rawWhitelist || rawPublish) {
        meshChannel?.send({
          type: 'broadcast',
          event: 'PROVIDE_STATE_SYNC',
          payload: {
            events: rawEvents ? JSON.parse(rawEvents) : {},
            attendances: rawAtt ? JSON.parse(rawAtt) : [],
            awards: rawAwards ? JSON.parse(rawAwards) : null,
            evaluations: rawEvals ? JSON.parse(rawEvals) : null,
            leaderboard: rawLeaderboard ? JSON.parse(rawLeaderboard) : null,
            pointSettings: rawPointSettings ? JSON.parse(rawPointSettings) : null,
            whitelist: rawWhitelist ? JSON.parse(rawWhitelist) : null,
            leaderboardPublish: rawPublish ? JSON.parse(rawPublish) : null,
          },
        });
      }
    } catch {}
  });

  meshChannel.on('broadcast', { event: 'PROVIDE_STATE_SYNC' }, ({ payload }) => {
    if (payload) {
      if (payload.events && typeof payload.events === 'object') {
        try {
          const raw = localStorage.getItem(EVENTS_OVERRIDES_KEY);
          const current = raw ? JSON.parse(raw) : {};
          const merged = { ...payload.events, ...current };
          localStorage.setItem(EVENTS_OVERRIDES_KEY, JSON.stringify(merged));
          window.dispatchEvent(new CustomEvent('simak_full_sync_received'));
        } catch {}
      }
      if (Array.isArray(payload.attendances) && payload.attendances.length > 0) {
        try {
          const raw = localStorage.getItem(ALL_ATTENDANCES_KEY);
          const current: any[] = raw ? JSON.parse(raw) : [];
          const existingIds = new Set(current.map((a) => a.id));
          for (const item of payload.attendances) {
            if (!existingIds.has(item.id)) {
              current.unshift(sanitizeMemberIdentity(item));
            }
          }
          localStorage.setItem(ALL_ATTENDANCES_KEY, JSON.stringify(current));
          window.dispatchEvent(new CustomEvent('simak_attendance_sync'));
        } catch {}
      }
      if (payload.evaluations && typeof payload.evaluations === 'object') {
        try {
          const rawOv = localStorage.getItem('simak_evaluations_overrides');
          const currentOv = rawOv ? JSON.parse(rawOv) : {};
          const mergedOv = { ...currentOv, ...payload.evaluations };
          localStorage.setItem('simak_evaluations_overrides', JSON.stringify(mergedOv));
          window.dispatchEvent(new CustomEvent('simak_evaluations_sync'));
        } catch {}
      }
      if (Array.isArray(payload.leaderboard) && payload.leaderboard.length > 0) {
        try {
          localStorage.setItem('simak_leaderboard_cache', JSON.stringify(payload.leaderboard));
          window.dispatchEvent(new CustomEvent('simak_leaderboard_sync', { detail: payload.leaderboard }));
        } catch {}
      }
      if (payload.awards && typeof payload.awards === 'object') {
        try {
          localStorage.setItem(AWARDS_STORAGE_KEY, JSON.stringify(payload.awards));
          window.dispatchEvent(new CustomEvent('simak_awards_sync', { detail: payload.awards }));
        } catch {}
      }
      if (payload.pointSettings && typeof payload.pointSettings === 'object') {
        try {
          localStorage.setItem('simak_point_settings', JSON.stringify(payload.pointSettings));
          window.dispatchEvent(new CustomEvent('simak_point_settings_updated', { detail: payload.pointSettings }));
        } catch {}
      }
      if (payload.whitelist && typeof payload.whitelist === 'object') {
        try {
          const rawWl = localStorage.getItem('simak_whitelist_overrides');
          const currentWl = rawWl ? JSON.parse(rawWl) : {};
          const mergedWl = { ...currentWl, ...payload.whitelist };
          localStorage.setItem('simak_whitelist_overrides', JSON.stringify(mergedWl));
          window.dispatchEvent(new CustomEvent('simak_member_sync', { detail: { npm: 'ALL_SYNC' } }));
        } catch {}
      }
      if (payload.leaderboardPublish && typeof payload.leaderboardPublish === 'object') {
        try {
          localStorage.setItem('simak_leaderboard_published', JSON.stringify(payload.leaderboardPublish));
          window.dispatchEvent(
            new CustomEvent('simak_leaderboard_publish_updated', { detail: payload.leaderboardPublish })
          );
        } catch {}
      }
    }
  });

  // G. Menerima Perubahan Point Settings dari Super Admin
  meshChannel.on('broadcast', { event: 'POINT_SETTINGS_MUTATED' }, ({ payload }) => {
    if (payload && typeof payload === 'object') {
      try {
        localStorage.setItem('simak_point_settings', JSON.stringify(payload));
        window.dispatchEvent(
          new CustomEvent('simak_point_settings_updated', { detail: payload })
        );
      } catch {}
    }
  });

  // H. Menerima Perubahan Status Publikasi Leaderboard (BPH / Super Admin)
  meshChannel.on('broadcast', { event: 'LEADERBOARD_PUBLISH_MUTATED' }, ({ payload }) => {
    if (payload && typeof payload === 'object') {
      try {
        localStorage.setItem('simak_leaderboard_published', JSON.stringify(payload));
        window.dispatchEvent(
          new CustomEvent('simak_leaderboard_publish_updated', { detail: payload })
        );
      } catch {}
    }
  });

  // I. Menerima Perubahan Data Profil / Hak Akses Anggota Lintas Device
  meshChannel.on('broadcast', { event: 'MEMBER_MUTATED' }, ({ payload }) => {
    if (payload && (payload.npm || payload.nim)) {
      const cleanNpm = normalizeStudentId(payload.npm || payload.nim);
      try {
        // 1. Simpan ke whitelist overrides
        const rawWl = localStorage.getItem('simak_whitelist_overrides');
        const wl = rawWl ? JSON.parse(rawWl) : {};
        wl[cleanNpm] = {
          full_name: payload.fullName || payload.full_name,
          division: payload.division,
          role: payload.role,
          jabatan: payload.jabatan,
        };
        localStorage.setItem('simak_whitelist_overrides', JSON.stringify(wl));

        // 2. Simpan ke evaluations overrides
        const rawEv = localStorage.getItem('simak_evaluations_overrides');
        const evMap = rawEv ? JSON.parse(rawEv) : {};
        if (evMap[cleanNpm]) {
          evMap[cleanNpm] = {
            ...evMap[cleanNpm],
            full_name: payload.fullName || payload.full_name,
            division: payload.division,
            role: payload.role,
            jabatan: payload.jabatan,
          };
          localStorage.setItem('simak_evaluations_overrides', JSON.stringify(evMap));
        }

        // 3. Update sesi jika akun ini yang sedang login di HP
        const rawSession = localStorage.getItem('simak_user_session');
        if (rawSession) {
          const session = JSON.parse(rawSession);
          const sessionNpm = normalizeStudentId(session.npm || session.nim);
          if (sessionNpm === cleanNpm && session.role !== 'superadmin') {
            const updatedSession = {
              ...session,
              fullName: payload.fullName || payload.full_name || session.fullName,
              division: payload.division || session.division,
              role: payload.role || session.role,
              jabatan: payload.jabatan || session.jabatan,
            };
            localStorage.setItem('simak_user_session', JSON.stringify(updatedSession));
          }
        }

        // 4. Update leaderboard cache
        const rawLb = localStorage.getItem('simak_leaderboard_cache');
        if (rawLb) {
          const lbList = JSON.parse(rawLb);
          if (Array.isArray(lbList)) {
            const updatedLb = lbList.map((item: any) => {
              if (normalizeStudentId(item.npm || item.nim) === cleanNpm) {
                return {
                  ...item,
                  full_name: payload.fullName || payload.full_name || item.full_name,
                  division: payload.division || item.division,
                  role: payload.role || item.role,
                  jabatan: payload.jabatan || item.jabatan,
                };
              }
              return item;
            });
            localStorage.setItem('simak_leaderboard_cache', JSON.stringify(updatedLb));
          }
        }

        // 5. Trigger event lokal di HP
        window.dispatchEvent(
          new CustomEvent('simak_member_sync', {
            detail: {
              npm: cleanNpm,
              full_name: payload.fullName || payload.full_name,
              division: payload.division,
              role: payload.role,
              jabatan: payload.jabatan,
            },
          })
        );
      } catch {}
    }
  });

  meshChannel.subscribe((status) => {
    if (status === 'SUBSCRIBED') {
      isChannelSubscribed = true;
      // Request state sync from any existing active peer
      meshChannel?.send({
        type: 'broadcast',
        event: 'REQUEST_STATE_SYNC',
        payload: { clientTime: Date.now() },
      });
    } else if (status === 'CLOSED' || status === 'CHANNEL_ERROR') {
      isChannelSubscribed = false;
    }
  });

  return meshChannel;
}

/**
 * 2. SUPABASE REALTIME MESH (P2P WebSocket Sync Lintas Desktop & Mobile)
 */
export function initMeshSync(handlers?: MeshHandlers): () => void {
  ensureMeshChannel();

  if (handlers) {
    registeredHandlers.add(handlers);
  }

  return () => {
    if (handlers) {
      registeredHandlers.delete(handlers);
    }
  };
}

/**
 * Broadcast event yang baru dibuat / diubah ke semua perangkat aktif via Realtime WebSocket
 */
export async function broadcastEventMutated(event: EventType): Promise<void> {
  // Simpan ke local overrides
  try {
    const raw = localStorage.getItem(EVENTS_OVERRIDES_KEY);
    const ov = raw ? JSON.parse(raw) : {};
    ov[event.id] = event;
    localStorage.setItem(EVENTS_OVERRIDES_KEY, JSON.stringify(ov));
  } catch {}

  // Push ke Cloud API
  saveEventCloud(event);

  // Broadcast WebSocket
  const ch = ensureMeshChannel();
  try {
    await ch.send({
      type: 'broadcast',
      event: 'EVENT_MUTATED',
      payload: event,
    });
  } catch {}
}

/**
 * Broadcast event yang dihapus ke semua perangkat aktif
 */
export async function broadcastEventDeleted(eventId: string): Promise<void> {
  deleteEventCloud(eventId);

  const ch = ensureMeshChannel();
  try {
    await ch.send({
      type: 'broadcast',
      event: 'EVENT_DELETED',
      payload: { eventId },
    });
  } catch {}
}

/**
 * Broadcast presensi anggota baru ke semua perangkat aktif
 */
export async function broadcastAttendanceRecorded(record: any, evaluation?: any): Promise<void> {
  const ch = ensureMeshChannel();
  try {
    const safeRecord = sanitizeMemberIdentity(record);
    const safeEval = evaluation ? sanitizeMemberIdentity(evaluation) : null;
    if (safeEval) {
      safeEval.total_points = Math.min(100, Math.max(0, safeEval.total_points || 0));
      // Otomatis push ke cloud evaluations
      saveEvaluationCloud(safeEval).catch(() => {});
    }

    await ch.send({
      type: 'broadcast',
      event: 'ATTENDANCE_RECORDED',
      payload: {
        record: safeRecord,
        evaluation: safeEval,
        ...safeRecord, // Backwards compatibility jika ada listener lama
      },
    });
  } catch {}
}

/**
 * Broadcast hapus presensi ke semua perangkat aktif
 */
export async function broadcastAttendanceDeleted(attendanceId: string, eventId?: string): Promise<void> {
  const ch = ensureMeshChannel();
  try {
    await ch.send({
      type: 'broadcast',
      event: 'ATTENDANCE_DELETED',
      payload: { attendanceId, eventId },
    });
  } catch {}
}

/**
 * Broadcast update status Mubes Awards (Publikasi & Perolehan Suara E-Voting) ke seluruh perangkat
 */
export async function broadcastAwardsMutated(awardsState: any): Promise<void> {
  const ch = ensureMeshChannel();
  try {
    await ch.send({
      type: 'broadcast',
      event: 'AWARDS_MUTATED',
      payload: awardsState,
    });
  } catch {}
}

/**
 * Broadcast perubahan setelan poin global (Super Admin) ke seluruh perangkat aktif
 */
export async function broadcastPointSettingsMutated(settings: any): Promise<void> {
  const ch = ensureMeshChannel();
  try {
    await ch.send({
      type: 'broadcast',
      event: 'POINT_SETTINGS_MUTATED',
      payload: settings,
    });
  } catch {}
}

/**
 * Broadcast perubahan data anggota / hak akses ke seluruh perangkat aktif via WebSocket Realtime
 */
export async function broadcastMemberUpdated(payload: any): Promise<void> {
  const ch = ensureMeshChannel();
  try {
    await ch.send({
      type: 'broadcast',
      event: 'MEMBER_MUTATED',
      payload,
    });
  } catch {}
}

/**
 * Broadcast perubahan status publikasi Leaderboard ke seluruh perangkat aktif via WebSocket Realtime
 */
export async function broadcastLeaderboardPublishMutated(payload: any): Promise<void> {
  const ch = ensureMeshChannel();
  try {
    await ch.send({
      type: 'broadcast',
      event: 'LEADERBOARD_PUBLISH_MUTATED',
      payload,
    });
  } catch {}
}


