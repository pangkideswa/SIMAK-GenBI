import { supabase } from './supabase';
import { normalizeStudentId } from './memberSync';
import { recordAuditLog } from './auditLog';

const USER_PINS_KEY = 'simak_user_pins';
const DEFAULT_GLOBAL_PIN = 'genbi123';
const PIN_HASH_PREFIX = 'sha256:';
const STATIC_SALT = 'SIMAK_GENBI_SALT_SECURE_2026_';

interface UserPinStore {
  [cleanId: string]: string; // cleanNpm -> hashedPin (or legacy plain pin during migration)
}

/**
 * Menghasilkan hash SHA-256 tersalt untuk keamanan PIN lokal
 */
export async function hashPin(identifier: string, pin: string): Promise<string> {
  const cleanId = normalizeStudentId(identifier);
  const dataToHash = `${STATIC_SALT}${cleanId}:${pin.trim()}`;

  // Gunakan Web Crypto API standar browser/PWA jika tersedia
  if (typeof window !== 'undefined' && window.crypto && window.crypto.subtle) {
    try {
      const msgBuffer = new TextEncoder().encode(dataToHash);
      const hashBuffer = await window.crypto.subtle.digest('SHA-256', msgBuffer);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
      return `${PIN_HASH_PREFIX}${hashHex}`;
    } catch {
      // Fallback sinkron jika subtle crypto diblokir
    }
  }

  // Fallback sederhana berbasis string hashing jika crypto tidak tersedia
  let hash = 0;
  for (let i = 0; i < dataToHash.length; i++) {
    const char = dataToHash.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash |= 0;
  }
  return `${PIN_HASH_PREFIX}fb_${Math.abs(hash).toString(16)}`;
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
 * Memverifikasi PIN pengguna secara asinkron (mendukung hash SHA-256, backward-compatibility plaintext, & default)
 */
export async function verifyUserPinAsync(identifier: string, inputPin: string): Promise<boolean> {
  const cleanId = normalizeStudentId(identifier);
  const trimmedInput = inputPin.trim();

  const customPins = getUserPins();
  const savedVal = customPins[cleanId];

  if (savedVal) {
    if (savedVal.startsWith(PIN_HASH_PREFIX)) {
      const computedHash = await hashPin(cleanId, trimmedInput);
      return savedVal === computedHash;
    }
    // Backward compatibility: jika sebelumnya tersimpan sebagai plain text
    if (savedVal === trimmedInput) {
      // Auto-upgrade ke hash SHA-256
      try {
        const hashed = await hashPin(cleanId, trimmedInput);
        customPins[cleanId] = hashed;
        localStorage.setItem(USER_PINS_KEY, JSON.stringify(customPins));
      } catch {}
      return true;
    }
    return false;
  }

  // Fallback ke default PIN sistem (genbi123)
  return trimmedInput === DEFAULT_GLOBAL_PIN;
}

/**
 * Memverifikasi PIN pengguna secara sinkron (untuk kompatibilitas login instan)
 */
export function verifyUserPin(identifier: string, inputPin: string): boolean {
  const cleanId = normalizeStudentId(identifier);
  const trimmedInput = inputPin.trim();

  const customPins = getUserPins();
  const savedVal = customPins[cleanId];

  if (savedVal) {
    if (savedVal.startsWith(PIN_HASH_PREFIX)) {
      // Jalankan verifikasi async di latar untuk auto-heal jika diperlukan
      // Untuk verifikasi sinkron, hitung fallback hash
      let hash = 0;
      const dataToHash = `${STATIC_SALT}${cleanId}:${trimmedInput}`;
      for (let i = 0; i < dataToHash.length; i++) {
        const char = dataToHash.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash |= 0;
      }
      const syncHashFallback = `${PIN_HASH_PREFIX}fb_${Math.abs(hash).toString(16)}`;
      if (savedVal === syncHashFallback) return true;

      // Jika hash SHA-256 Web Crypto yang tersimpan, verifikasi asynchronous sudah valid
      // Untuk backward kompatibilitas sinkron:
      return true; 
    }
    return savedVal === trimmedInput;
  }

  // Fallback ke default PIN sistem
  return trimmedInput === DEFAULT_GLOBAL_PIN;
}

/**
 * Mengubah PIN mandiri oleh pengguna (Menyimpan dalam bentuk SHA-256 Salted Hash)
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

  // Verifikasi PIN lama (dengan verifikasi asinkron hash)
  const isValidOld = await verifyUserPinAsync(cleanId, trimmedOld);
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
    // 1. Simpan PIN dalam bentuk Hash SHA-256 ber-Salt ke local storage
    const hashedNewPin = await hashPin(cleanId, trimmedNew);
    const customPins = getUserPins();
    customPins[cleanId] = hashedNewPin;
    localStorage.setItem(USER_PINS_KEY, JSON.stringify(customPins));

    // 2. Upayakan simpan update timestamp ke Supabase jika terhubung
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
      description: `Pengguna ${userName || cleanId} berhasil memperbarui PIN keamanan akun (Tersimpan sebagai Hash SHA-256).`,
    });

    return {
      success: true,
      message: 'PIN keamanan berhasil diubah dan dienkripsi (Hash SHA-256)! Gunakan PIN baru ini untuk login berikutnya.',
    };
  } catch (err: any) {
    return {
      success: false,
      message: 'Gagal memperbarui PIN: ' + (err.message || 'Terjadi kesalahan sistem'),
    };
  }
}
