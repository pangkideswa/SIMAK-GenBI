/**
 * SIMAK GENBI - Leaderboard Publication & Visibility Controller
 * Mengatur visibilitas Leaderboard ke Anggota (Draft vs Diterbitkan),
 * serta hak akses filter per divisi bagi Kepala Divisi (Kadiv).
 */

import { recordAuditLog } from './auditLog';
import { broadcastLeaderboardPublishMutated } from './meshSync';

const LEADERBOARD_PUBLISH_KEY = 'simak_leaderboard_published';

export interface LeaderboardPublishState {
  isPublished: boolean;
  publishedAt?: string;
  updatedBy?: string;
}

/**
 * Mengambil status publikasi Leaderboard saat ini
 * Default: false (Dirahasiakan dari anggota sampai diterbitkan resmi oleh BPH/Super Admin)
 */
export function getLeaderboardPublishState(): LeaderboardPublishState {
  try {
    const raw = localStorage.getItem(LEADERBOARD_PUBLISH_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return {
        isPublished: Boolean(parsed.isPublished),
        publishedAt: parsed.publishedAt,
        updatedBy: parsed.updatedBy,
      };
    }
  } catch {}

  // Default: Dirahasiakan (false)
  return {
    isPublished: false,
  };
}

/**
 * Menyimpan dan menyiarkan status publikasi Leaderboard ke seluruh sistem & peer mesh
 */
export async function setLeaderboardPublishState(
  isPublished: boolean,
  actorName = 'BPH GenBI'
): Promise<LeaderboardPublishState> {
  const nextState: LeaderboardPublishState = {
    isPublished,
    publishedAt: isPublished ? new Date().toISOString() : undefined,
    updatedBy: actorName,
  };

  try {
    localStorage.setItem(LEADERBOARD_PUBLISH_KEY, JSON.stringify(nextState));
  } catch (err) {
    console.warn('Gagal menyimpan status publikasi leaderboard:', err);
  }

  // Siarkan CustomEvent lokal
  try {
    window.dispatchEvent(
      new CustomEvent('simak_leaderboard_publish_updated', { detail: nextState })
    );
  } catch {}

  // Siarkan ke Realtime WebSocket Mesh ke seluruh perangkat (Desktop & Mobile)
  try {
    await broadcastLeaderboardPublishMutated(nextState);
  } catch (err) {
    console.warn('Gagal broadcast publikasi leaderboard ke mesh:', err);
  }

  // Catat jejak audit
  try {
    recordAuditLog({
      actorName,
      actorRole: actorName.toLowerCase().includes('super') ? 'Super Admin' : 'BPH',
      actionType: 'SETTINGS_UPDATE',
      target: 'Leaderboard Publikasi',
      description: isPublished
        ? 'Menerbitkan Leaderboard Poin Keaktifan agar dapat dilihat oleh seluruh anggota.'
        : 'Menyembunyikan / merahasiakan kembali Leaderboard Poin Keaktifan dari akun anggota.',
    });
  } catch {}

  return nextState;
}
