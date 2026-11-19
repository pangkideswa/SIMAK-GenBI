/**
 * Offline-First Queue Manager untuk PWA SIMAK GENBI
 * Menampung absensi dan izin ketika perangkat offline / hilang sinyal,
 * lalu mengirimkannya secara otomatis begitu koneksi internet pulih.
 */

export interface QueuedAttendance {
  id: string;
  userId: string;
  token: string;
  userLat?: number | null;
  userLng?: number | null;
  timestamp: string;
  eventTitle?: string;
}

const OFFLINE_QUEUE_KEY = 'simak_offline_queue';

/**
 * Menyimpan presensi ke antrean offline lokal
 */
export function enqueueOfflineAttendance(item: Omit<QueuedAttendance, 'id' | 'timestamp'>): QueuedAttendance {
  const queue = getOfflineQueue();
  const newItem: QueuedAttendance = {
    ...item,
    id: 'offline-' + Date.now() + '-' + Math.random().toString(36).substring(2, 6),
    timestamp: new Date().toISOString(),
  };

  queue.push(newItem);
  try {
    localStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(queue));
  } catch (e) {
    console.warn('Gagal menyimpan offline queue:', e);
  }

  return newItem;
}

/**
 * Mengambil seluruh daftar antrean offline
 */
export function getOfflineQueue(): QueuedAttendance[] {
  try {
    const raw = localStorage.getItem(OFFLINE_QUEUE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

/**
 * Menghapus item tertentu dari antrean setelah berhasil disinkronkan
 */
export function dequeueOfflineAttendance(id: string): void {
  const queue = getOfflineQueue().filter((item) => item.id !== id);
  try {
    localStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(queue));
  } catch (e) {
    console.warn('Gagal dequeue:', e);
  }
}

/**
 * Mengosongkan seluruh antrean offline
 */
export function clearOfflineQueue(): void {
  try {
    localStorage.removeItem(OFFLINE_QUEUE_KEY);
  } catch {}
}

/**
 * Mengosongkan dan memproses paksa antrean offline saat ini secara manual
 */
export async function flushOfflineQueue(
  onSyncItem: (item: QueuedAttendance) => Promise<boolean>
): Promise<number> {
  const queue = getOfflineQueue();
  if (queue.length === 0) return 0;

  let successCount = 0;
  for (const item of queue) {
    try {
      const success = await onSyncItem(item);
      if (success) {
        dequeueOfflineAttendance(item.id);
        successCount++;
      }
    } catch (err) {
      console.warn('Gagal memproses item offline queue:', err);
    }
  }

  if (successCount > 0) {
    window.dispatchEvent(
      new CustomEvent('simak_offline_synced', {
        detail: { count: successCount },
      })
    );
  }
  return successCount;
}

/**
 * Menginisialisasi listener online/offline otomatis untuk PWA
 */
export function initOfflineQueueSync(
  onSyncItem: (item: QueuedAttendance) => Promise<boolean>,
  onStatusChange?: (isOnline: boolean, queueCount: number) => void
): () => void {
  const syncAll = async () => {
    const queue = getOfflineQueue();
    if (queue.length === 0) return;

    let successCount = 0;
    for (const item of queue) {
      try {
        const success = await onSyncItem(item);
        if (success) {
          dequeueOfflineAttendance(item.id);
          successCount++;
        }
      } catch (err) {
        console.warn('Gagal memproses item offline queue:', err);
      }
    }

    if (successCount > 0) {
      window.dispatchEvent(
        new CustomEvent('simak_offline_synced', {
          detail: { count: successCount },
        })
      );
    }
  };

  const handleOnline = () => {
    if (onStatusChange) onStatusChange(true, getOfflineQueue().length);
    syncAll();
  };

  const handleOffline = () => {
    if (onStatusChange) onStatusChange(false, getOfflineQueue().length);
  };

  window.addEventListener('online', handleOnline);
  window.addEventListener('offline', handleOffline);

  // Jika saat inisialisasi sudah online dan ada antrean tertunda, segera proses
  if (navigator.onLine) {
    syncAll();
  }

  return () => {
    window.removeEventListener('online', handleOnline);
    window.removeEventListener('offline', handleOffline);
  };
}
