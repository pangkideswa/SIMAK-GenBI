/**
 * SIMAK GENBI Rate Limiting & Cooldown Protection Engine
 * Melindungi dari:
 * 1. Serangan Brute-Force PIN & Password Login
 * 2. Spam & Tebak Token Presensi (Token Guessing Lockout)
 * 3. Race conditions & abuse
 */

interface RateLimitEntry {
  attempts: number;
  firstAttemptAt: number;
  lockedUntil: number | null;
}

const STORAGE_KEY = 'simak_rate_limits';

function getStore(): Record<string, RateLimitEntry> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return {};
}

function saveStore(store: Record<string, RateLimitEntry>): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  } catch {}
}

/**
 * Cek status rate limit untuk sebuah target key (misal: 'login_2414101078' atau 'token_evt123')
 */
export function checkRateLimit(
  key: string,
  maxAttempts: number = 5,
  cooldownSeconds: number = 30
): {
  isLocked: boolean;
  remainingAttempts: number;
  retryAfterSeconds: number;
} {
  const store = getStore();
  const entry = store[key];
  const now = Date.now();

  if (!entry) {
    return {
      isLocked: false,
      remainingAttempts: maxAttempts,
      retryAfterSeconds: 0,
    };
  }

  // Jika sedang masa cooldown / terkunci
  if (entry.lockedUntil && entry.lockedUntil > now) {
    const retryAfterSeconds = Math.ceil((entry.lockedUntil - now) / 1000);
    return {
      isLocked: true,
      remainingAttempts: 0,
      retryAfterSeconds,
    };
  }

  // Jika masa cooldown sudah lewat atau jendela waktu reset (misal 5 menit)
  if (entry.lockedUntil && entry.lockedUntil <= now) {
    // Reset status setelah cooldown berakhir
    delete store[key];
    saveStore(store);
    return {
      isLocked: false,
      remainingAttempts: maxAttempts,
      retryAfterSeconds: 0,
    };
  }

  // Jendela waktu kadaluarsa (jika tidak ada percobaan lagi selama 5 menit, reset)
  const windowTimeMs = 5 * 60 * 1000;
  if (now - entry.firstAttemptAt > windowTimeMs) {
    delete store[key];
    saveStore(store);
    return {
      isLocked: false,
      remainingAttempts: maxAttempts,
      retryAfterSeconds: 0,
    };
  }

  const remainingAttempts = Math.max(0, maxAttempts - entry.attempts);
  const isLocked = remainingAttempts <= 0;
  const retryAfterSeconds = isLocked ? cooldownSeconds : 0;

  return {
    isLocked,
    remainingAttempts,
    retryAfterSeconds,
  };
}

/**
 * Catat percobaan gagal dan kunci sementara jika melewati batas
 */
export function recordFailedAttempt(
  key: string,
  maxAttempts: number = 5,
  cooldownSeconds: number = 30
): {
  isLocked: boolean;
  remainingAttempts: number;
  retryAfterSeconds: number;
} {
  const store = getStore();
  const now = Date.now();
  let entry = store[key];

  if (!entry || (entry.lockedUntil && entry.lockedUntil <= now)) {
    entry = {
      attempts: 1,
      firstAttemptAt: now,
      lockedUntil: null,
    };
  } else {
    entry.attempts += 1;
  }

  if (entry.attempts >= maxAttempts) {
    entry.lockedUntil = now + cooldownSeconds * 1000;
  }

  store[key] = entry;
  saveStore(store);

  const isLocked = entry.attempts >= maxAttempts;
  const remainingAttempts = Math.max(0, maxAttempts - entry.attempts);
  const retryAfterSeconds = isLocked ? cooldownSeconds : 0;

  return {
    isLocked,
    remainingAttempts,
    retryAfterSeconds,
  };
}

/**
 * Reset / bersihkan rekaman rate limit saat berhasil
 */
export function resetRateLimit(key: string): void {
  try {
    const store = getStore();
    if (store[key]) {
      delete store[key];
      saveStore(store);
    }
  } catch {}
}
