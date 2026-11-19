import { supabase } from './supabase';
import { Division, Role } from '../types/database';

export interface MemberSyncPayload {
  npm: string;
  nim?: string;
  fullName: string;
  division: Division;
  role: Role;
}

const WHITELIST_OVERRIDES_KEY = 'simak_whitelist_overrides';
const LEADERBOARD_CACHE_KEY = 'simak_leaderboard_cache';
const USER_SESSION_KEY = 'simak_user_session';

/**
 * Normalisasi NPM / NIM menjadi string bersih tanpa spasi, titik, atau strip
 */
export function normalizeStudentId(id?: string | number | null): string {
  if (id === null || id === undefined) return '';
  return String(id).replace(/[\s.-]/g, '').trim();
}

/**
 * Sinkronisasi Perubahan Member ke:
 * 1. Supabase (authorized_members & profiles)
 * 2. LocalStorage (whitelist overrides, leaderboard cache, active user session)
 * 3. Window CustomEvent ('simak_member_sync') untuk update state realtime di halaman aktif
 */
export async function syncMemberUpdate(payload: MemberSyncPayload): Promise<{
  success: boolean;
  error?: string;
}> {
  const cleanId = normalizeStudentId(payload.npm || payload.nim);
  if (!cleanId) {
    return { success: false, error: 'NPM / NIM tidak valid.' };
  }

  const updateData = {
    full_name: payload.fullName.trim(),
    division: payload.division,
    role: payload.role,
  };

  // 1. Simpan ke Local Overrides agar instan & tidak pernah reset ke data lama
  try {
    const raw = localStorage.getItem(WHITELIST_OVERRIDES_KEY);
    const overrides = raw ? JSON.parse(raw) : {};
    overrides[cleanId] = updateData;
    if (payload.nim) {
      overrides[normalizeStudentId(payload.nim)] = updateData;
    }
    localStorage.setItem(WHITELIST_OVERRIDES_KEY, JSON.stringify(overrides));
  } catch (e) {
    console.warn('Gagal menyimpan whitelist overrides:', e);
  }

  // 2. Sinkronkan ke Leaderboard / Evaluasi Cache
  try {
    const rawLb = localStorage.getItem(LEADERBOARD_CACHE_KEY);
    if (rawLb) {
      const lbList = JSON.parse(rawLb);
      if (Array.isArray(lbList)) {
        const updatedLb = lbList.map((item: any) => {
          const itemNpm = normalizeStudentId(item.npm || item.nim);
          if (itemNpm === cleanId) {
            return {
              ...item,
              full_name: payload.fullName.trim(),
              division: payload.division,
              role: payload.role,
            };
          }
          return item;
        });
        localStorage.setItem(LEADERBOARD_CACHE_KEY, JSON.stringify(updatedLb));
      }
    }
  } catch (e) {
    console.warn('Gagal update cache leaderboard:', e);
  }

  // 3. Sinkronkan ke Sesi Pengguna Aktif jika akun yang diedit sedang login
  try {
    const rawSession = localStorage.getItem(USER_SESSION_KEY);
    if (rawSession) {
      const session = JSON.parse(rawSession);
      const sessionNpm = normalizeStudentId(session.npm || session.nim);
      if (sessionNpm === cleanId && session.role !== 'superadmin') {
        const updatedSession = {
          ...session,
          fullName: payload.fullName.trim(),
          division: payload.division,
          role: payload.role,
        };
        localStorage.setItem(USER_SESSION_KEY, JSON.stringify(updatedSession));
      }
    }
  } catch (e) {
    console.warn('Gagal update user session cache:', e);
  }

  // 4. Siarkan Custom Event ke seluruh komponen React yang sedang aktif
  try {
    window.dispatchEvent(
      new CustomEvent('simak_member_sync', {
        detail: {
          npm: cleanId,
          ...updateData,
        },
      })
    );
  } catch (e) {
    console.warn('Gagal dispatch custom event:', e);
  }

  // 5. Simpan ke Supabase Database secara aman
  let dbError: any = null;
  try {
    // A. Update authorized_members
    const { error: authErr } = await (supabase.from('authorized_members') as any)
      .update(updateData)
      .eq('npm', cleanId);
    if (authErr) {
      console.warn('Catatan Supabase authorized_members:', authErr.message);
    }

    // B. Update profiles jika akun sudah melakukan aktivasi
    const { error: profErr } = await (supabase.from('profiles') as any)
      .update(updateData)
      .or(`npm.eq.${cleanId},nim.eq.${cleanId}`);
    if (profErr) {
      console.warn('Catatan Supabase profiles:', profErr.message);
    }
  } catch (err: any) {
    dbError = err;
    console.warn('Catatan koneksi database:', err?.message);
  }

  return { success: true, error: dbError?.message };
}
