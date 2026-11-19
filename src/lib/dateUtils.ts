/**
 * Utility Pemformatan Waktu Resmi WIB (Waktu Indonesia Barat / 24 Jam)
 * Standar SIMAK GENBI Komisariat UNMA
 */

/**
 * Format tanggal dan waktu 24 jam lengkap dengan penanda WIB
 * Contoh: "Kamis, 19 Nov 2026 • 11:08 WIB" atau "19 Nov 2026 • 14:30 WIB"
 */
export function formatDateTimeWIB(
  dateInput?: string | number | Date | null,
  includeDay: boolean = true
): string {
  if (!dateInput) return '-';
  try {
    const d = new Date(dateInput);
    if (isNaN(d.getTime())) return '-';

    const datePart = d.toLocaleDateString('id-ID', {
      weekday: includeDay ? 'short' : undefined,
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });

    const hours = String(d.getHours()).padStart(2, '0');
    const minutes = String(d.getMinutes()).padStart(2, '0');

    return `${datePart} • ${hours}:${minutes} WIB`;
  } catch {
    return String(dateInput);
  }
}

/**
 * Format hanya jam dalam format 24 jam WIB
 * Contoh: "11:08 WIB", "23:59 WIB"
 */
export function formatTimeWIB(dateInput?: string | number | Date | null): string {
  if (!dateInput) return '-';
  try {
    const d = new Date(dateInput);
    if (isNaN(d.getTime())) return '-';

    const hours = String(d.getHours()).padStart(2, '0');
    const minutes = String(d.getMinutes()).padStart(2, '0');

    return `${hours}:${minutes} WIB`;
  } catch {
    return '-';
  }
}

/**
 * Format tanggal panjang Indonesia
 * Contoh: "19 November 2026"
 */
export function formatDateLongIndo(dateInput?: string | number | Date | null): string {
  if (!dateInput) return '-';
  try {
    const d = new Date(dateInput);
    if (isNaN(d.getTime())) return '-';

    return d.toLocaleDateString('id-ID', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  } catch {
    return String(dateInput);
  }
}

/**
 * Konversi Date / ISO string ke nilai yang kompatibel dengan <input type="datetime-local" />
 * Format: "YYYY-MM-DDTHH:mm" dalam zona waktu lokal 24 jam
 */
export function toDatetimeLocalWIB(dateInput?: string | number | Date | null): string {
  try {
    const d = dateInput ? new Date(dateInput) : new Date();
    if (isNaN(d.getTime())) return '';

    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const hours = String(d.getHours()).padStart(2, '0');
    const minutes = String(d.getMinutes()).padStart(2, '0');

    return `${year}-${month}-${day}T${hours}:${minutes}`;
  } catch {
    return '';
  }
}
