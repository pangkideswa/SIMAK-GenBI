import { supabase } from './supabase';
import { normalizeStudentId } from './memberSync';
import { recordAuditLog } from './auditLog';

const USER_PINS_KEY = 'simak_user_pins';
const DEFAULT_GLOBAL_PIN = 'genbi123';

interface UserPinStore {
  [cleanId: string]: string; // cleanNpm -> pin
}

/**
 * Mengambil daftar PIN kustom yang tersimpan
 */
export function getUserPins(): UserPinStore {
  try {
    const raw = localStorage.getItem(USER_PINS_KEY);
    if (raw) {
      return JSON.parse(raw);
    }
  } catch {}
  return {};
}

/**
 * Memverifikasi PIN pengguna (mendukung PIN kustom & default genbi123)
 */
export function verifyUserPin(identifier: string, inputPin: string): boolean {
  const cleanId = normalizeStudentId(identifier);
  const trimmedInput = inputPin.trim();

  const customPins = getUserPins();
  const savedPin = customPins[cleanId];

  if (savedPin) {
    return savedPin === trimmedInput;
  }

  // Fallback ke default PIN sistem
  return trimmedInput === DEFAULT_GLOBAL_PIN;
}

/**
 * Mengubah PIN mandiri oleh pengguna
 */
export async function changeUserPin(
  identifier: string,
  oldPin: string,
  newPin: string,
  userName?: string
): Promise<{ success: boolean; message: string }> {
  const cleanId = normalizeStudentId(identifier);
  const trimmedOld = oldPin.trim();
  const trimmedNew = newPin.trim();

  if (!trimmedNew || trimmedNew.length < 4) {
    return {
      success: false,
      message: 'PIN baru minimal harus 4 karakter / angka!',
    };
  }

  // Verifikasi PIN lama
  const isValidOld = verifyUserPin(cleanId, trimmedOld);
  if (!isValidOld) {
    return {
      success: false,
      message: 'PIN lama yang Anda masukkan salah!',
    };
  }

  if (trimmedOld === trimmedNew) {
    return {
      success: false,
      message: 'PIN baru tidak boleh sama dengan PIN lama!',
    };
  }

  try {
    // 1. Simpan ke local storage
    const customPins = getUserPins();
    customPins[cleanId] = trimmedNew;
    localStorage.setItem(USER_PINS_KEY, JSON.stringify(customPins));

    // 2. Upayakan simpan ke Supabase jika kolom tersedia
    try {
      await (supabase.from('profiles') as any)
        .update({ updated_at: new Date().toISOString() })
        .eq('npm', cleanId);
    } catch {}

    // 3. Catat ke audit log
    recordAuditLog({
      actorName: userName || cleanId,
      actorRole: 'member',
      actionType: 'AUTH_PIN_CHANGE',
      target: cleanId,
      description: `Pengguna ${userName || cleanId} berhasil memperbarui PIN keamanan akun secara mandiri.`,
    });

    return {
      success: true,
      message: 'PIN keamanan berhasil diubah! Gunakan PIN baru ini untuk login berikutnya.',
    };
  } catch (err: any) {
    return {
      success: false,
      message: 'Gagal memperbarui PIN: ' + (err.message || 'Terjadi kesalahan sistem'),
    };
  }
}
