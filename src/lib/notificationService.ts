/**
 * Service Notifikasi Web & PWA SIMAK GENBI
 */

const NOTIFICATION_PREF_KEY = 'simak_push_enabled';

/**
 * Mengecek apakah browser mendukung Web Notification API
 */
export function isNotificationSupported(): boolean {
  return typeof window !== 'undefined' && 'Notification' in window;
}

/**
 * Mengecek apakah izin notifikasi telah diberikan
 */
export function getNotificationPermission(): NotificationPermission {
  if (!isNotificationSupported()) return 'denied';
  return Notification.permission;
}

/**
 * Mengecek apakah pengguna mengaktifkan toggle notifikasi di SIMAK
 */
export function isPushNotificationEnabled(): boolean {
  if (!isNotificationSupported()) return false;
  const pref = localStorage.getItem(NOTIFICATION_PREF_KEY);
  return pref === 'true' && Notification.permission === 'granted';
}

/**
 * Meminta izin kepada pengguna untuk mengirimkan notifikasi PWA
 */
export async function requestNotificationPermission(): Promise<{
  granted: boolean;
  permission: NotificationPermission;
}> {
  if (!isNotificationSupported()) {
    return { granted: false, permission: 'denied' };
  }

  try {
    const permission = await Notification.requestPermission();
    const granted = permission === 'granted';
    localStorage.setItem(NOTIFICATION_PREF_KEY, granted ? 'true' : 'false');

    if (granted) {
      sendWebNotification('Notifikasi SIMAK GENBI Aktif! 🔔', {
        body: 'Anda akan menerima pengingat otomatis saat sesi presensi proker resmi dibuka oleh BPH.',
        icon: '/logo-genbi.png',
        badge: '/logo-genbi.png',
      });
    }

    return { granted, permission };
  } catch (err) {
    console.warn('Gagal meminta izin notifikasi:', err);
    return { granted: false, permission: 'denied' };
  }
}

/**
 * Mematikan toggle notifikasi lokal
 */
export function disablePushNotification(): void {
  localStorage.setItem(NOTIFICATION_PREF_KEY, 'false');
}

/**
 * Mengirimkan notifikasi lokal ke sistem desktop/smartphone
 */
export function sendWebNotification(
  title: string,
  options?: NotificationOptions
): boolean {
  if (!isNotificationSupported() || Notification.permission !== 'granted') {
    return false;
  }

  const defaultOptions: NotificationOptions = {
    icon: '/logo-genbi.png',
    badge: '/logo-genbi.png',
    tag: 'simak-genbi-alert',
    ...options,
  };

  try {
    // 1. Coba lewat Service Worker jika terdaftar (PWA Mobile)
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.ready
        .then((registration) => {
          registration.showNotification(title, defaultOptions);
        })
        .catch(() => {
          new Notification(title, defaultOptions);
        });
      return true;
    }

    // 2. Fallback Notification API langsung
    new Notification(title, defaultOptions);
    return true;
  } catch (err) {
    console.warn('Gagal mengirimkan notifikasi:', err);
    return false;
  }
}

/**
 * Mengirimkan notifikasi pengingat sesi presensi dibuka
 */
export function notifySessionOpened(eventTitle: string, points: number): void {
  sendWebNotification(`🚨 Sesi Presensi Dibuka: ${eventTitle}`, {
    body: `Sesi presensi resmi telah dibuka (+${points} Poin). Segera lakukan scan QR di lokasi acara!`,
    icon: '/logo-genbi.png',
    badge: '/logo-genbi.png',
  });
}

/**
 * Mengecek agenda yang akan datang dalam kurun waktu 24 jam / hari ini
 * dan mengirimkan pengingat otomatis ke perangkat anggota jika belum pernah diingatkan
 */
export function checkUpcomingAgendaReminders(
  events: Array<{ id: string; title: string; event_date: string; points: number }>
): void {
  if (!isPushNotificationEnabled()) return;

  const now = new Date().getTime();
  const notifiedKey = 'simak_notified_agendas';
  let notifiedIds: string[] = [];
  try {
    const raw = localStorage.getItem(notifiedKey);
    if (raw) notifiedIds = JSON.parse(raw);
  } catch {}

  const oneDayMs = 24 * 60 * 60 * 1000;

  for (const ev of events) {
    const eventTime = new Date(ev.event_date).getTime();
    const diff = eventTime - now;

    // Jika agenda dalam rentang 0 hingga 24 jam ke depan
    if (diff > 0 && diff <= oneDayMs && !notifiedIds.includes(ev.id)) {
      const hoursLeft = Math.max(1, Math.round(diff / (60 * 60 * 1000)));
      sendWebNotification(`📅 Pengingat Agenda: ${ev.title}`, {
        body: `Kegiatan GenBI akan dimulai dalam ~${hoursLeft} jam lagi (+${ev.points} Poin). Pastikan hadir tepat waktu!`,
        icon: '/logo-genbi.png',
        badge: '/logo-genbi.png',
        tag: `agenda-reminder-${ev.id}`,
      });

      notifiedIds.push(ev.id);
      try {
        localStorage.setItem(notifiedKey, JSON.stringify(notifiedIds));
      } catch {}
      break;
    }
  }
}

