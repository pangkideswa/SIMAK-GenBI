export type AuditActionType =
  | 'AUTH_PIN_CHANGE'
  | 'ROLE_CHANGE'
  | 'EVENT_CREATE'
  | 'EVENT_UPDATE'
  | 'EVENT_DELETE'
  | 'EVENT_SESSION_TOGGLE'
  | 'IZIN_APPROVE'
  | 'IZIN_REJECT'
  | 'DELEGASI_APPROVE'
  | 'PERIOD_CREATE'
  | 'PERIOD_ACTIVATE'
  | 'PERIOD_DELETE'
  | 'WHITELIST_ADD'
  | 'WHITELIST_EDIT'
  | 'SYSTEM_BACKUP'
  | 'SETTINGS_UPDATE'
  | 'EVALUATION_OVERRIDE';

export interface AuditLog {
  id: string;
  timestamp: string;
  actorName: string;
  actorRole: string;
  actionType: AuditActionType;
  target: string;
  description: string;
}

const AUDIT_LOGS_KEY = 'simak_audit_logs';

const DEFAULT_AUDIT_LOGS: AuditLog[] = [
  {
    id: 'log-1',
    timestamp: new Date(Date.now() - 3600000 * 2).toISOString(),
    actorName: 'Ahmad Fauzi',
    actorRole: 'BPH',
    actionType: 'PERIOD_ACTIVATE',
    target: 'T.A. 2026/2027 Ganjil',
    description: 'Menetapkan periode "T.A. 2026/2027 Ganjil" sebagai periode kepengurusan aktif SIMAK GENBI.',
  },
  {
    id: 'log-2',
    timestamp: new Date(Date.now() - 3600000 * 5).toISOString(),
    actorName: 'Ahmad Fauzi',
    actorRole: 'BPH',
    actionType: 'EVENT_CREATE',
    target: 'Sosialisasi Cinta Bangga Paham (CBP) Rupiah',
    description: 'Membuat agenda proker baru dan mengaktifkan sesi presensi QR resmi dengan bobot 15 Poin.',
  },
  {
    id: 'log-3',
    timestamp: new Date(Date.now() - 3600000 * 12).toISOString(),
    actorName: 'Super Admin Root',
    actorRole: 'Super Admin',
    actionType: 'ROLE_CHANGE',
    target: '2214100010 (Deden Kurniawan)',
    description: 'Memperbarui hak akses jabatan pengguna menjadi Kepala Divisi (Kadiv) Publikasi dan Sosialisasi.',
  },
];

/**
 * Mengambil daftar seluruh riwayat log audit
 */
export function getAuditLogs(): AuditLog[] {
  try {
    const raw = localStorage.getItem(AUDIT_LOGS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    }
  } catch {}
  return DEFAULT_AUDIT_LOGS;
}

/**
 * Mencatat aktivitas audit baru
 */
export function recordAuditLog(log: {
  actorName: string;
  actorRole: string;
  actionType: AuditActionType;
  target: string;
  description: string;
}): AuditLog {
  const newLog: AuditLog = {
    id: 'log-' + Date.now() + '-' + Math.random().toString(36).substring(2, 6),
    timestamp: new Date().toISOString(),
    actorName: log.actorName,
    actorRole: log.actorRole,
    actionType: log.actionType,
    target: log.target,
    description: log.description,
  };

  try {
    const existing = getAuditLogs();
    const updated = [newLog, ...existing.slice(0, 199)]; // Simpan hingga 200 log terbaru
    localStorage.setItem(AUDIT_LOGS_KEY, JSON.stringify(updated));

    // Siarkan ke seluruh tab / komponen
    window.dispatchEvent(
      new CustomEvent('simak_audit_sync', {
        detail: newLog,
      })
    );
  } catch {}

  return newLog;
}

/**
 * Membersihkan seluruh log audit (Akses Super Admin)
 */
export function clearAuditLogs(): void {
  try {
    localStorage.removeItem(AUDIT_LOGS_KEY);
    window.dispatchEvent(new CustomEvent('simak_audit_sync'));
  } catch {}
}
