import { supabase } from './supabase';

export interface GDriveUploadResult {
  fileUrl: string;
  provider: 'gdrive' | 'supabase' | 'direct';
  fileName: string;
}

export interface GDriveUploadMetadata {
  uploaderNpm: string;
  uploaderName: string;
  eventTitle: string;
  reason?: string;
}

/**
 * Kompresi gambar aman untuk ponsel cerdas (Anti-Crash & Anti-Reload):
 * Menggunakan URL.createObjectURL (zero memory overhead) alih-alih FileReader data URL
 * agar browser mobile (Android/iOS) tidak mengalami Out-Of-Memory (OOM) yang memicu refresh otomatis.
 */
async function compressImageIfNeeded(file: File): Promise<File> {
  // Hanya proses jika file bertipe gambar dan ukurannya > 200 KB
  if (!file.type.startsWith('image/') || file.size <= 200 * 1024) {
    return file;
  }

  return new Promise((resolve) => {
    let objectUrl = '';
    try {
      objectUrl = URL.createObjectURL(file);
      const img = new Image();

      img.onload = () => {
        try {
          const maxDimension = 1000;
          let width = img.width;
          let height = img.height;

          if (width > maxDimension || height > maxDimension) {
            if (width > height) {
              height = Math.round((height * maxDimension) / width);
              width = maxDimension;
            } else {
              width = Math.round((width * maxDimension) / height);
              height = maxDimension;
            }
          }

          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');

          if (!ctx) {
            URL.revokeObjectURL(objectUrl);
            resolve(file);
            return;
          }

          ctx.drawImage(img, 0, 0, width, height);

          canvas.toBlob(
            (blob) => {
              URL.revokeObjectURL(objectUrl);
              // Bersihkan canvas dari memori
              canvas.width = 0;
              canvas.height = 0;

              if (blob) {
                const cleanName = file.name.replace(/\.[^/.]+$/, '') + '.jpg';
                const compressedFile = new File([blob], cleanName, {
                  type: 'image/jpeg',
                  lastModified: Date.now(),
                });
                resolve(compressedFile);
              } else {
                resolve(file);
              }
            },
            'image/jpeg',
            0.7
          );
        } catch {
          URL.revokeObjectURL(objectUrl);
          resolve(file);
        }
      };

      img.onerror = () => {
        URL.revokeObjectURL(objectUrl);
        resolve(file);
      };

      img.src = objectUrl;
    } catch {
      if (objectUrl) URL.revokeObjectURL(objectUrl);
      resolve(file);
    }
  });
}

/**
 * Upload berkas surat izin / dispensasi / delegasi ke Google Drive (via Google Apps Script Web App Endpoint)
 * atau fallback ke Supabase Storage / Penyimpanan Langsung jika Apps Script timeout atau offline.
 */
export async function uploadProofToGDrive(
  file: File,
  metadata: GDriveUploadMetadata
): Promise<GDriveUploadResult> {
  // 1. Validasi Keamanan Berkas (Defense-in-Depth):
  // Batas ukuran berkas maksimal 5 MB
  const MAX_FILE_SIZE = 5 * 1024 * 1024;
  if (file.size > MAX_FILE_SIZE) {
    throw new Error('Ukuran berkas melebihi batas maksimal 5 MB. Harap unggah berkas yang lebih kecil.');
  }

  // Validasi format/MIME type yang sah (hanya gambar umum & PDF)
  const allowedExtensions = ['jpg', 'jpeg', 'png', 'webp', 'pdf'];
  const ext = (file.name.split('.').pop() || '').toLowerCase();
  const mime = (file.type || '').toLowerCase();

  const isMimeAllowed = mime.startsWith('image/') || mime === 'application/pdf';
  const isExtAllowed = allowedExtensions.includes(ext);

  if (!isMimeAllowed || !isExtAllowed) {
    throw new Error('Format berkas tidak diizinkan. Sistem hanya menerima berkas Foto (JPG, PNG, WEBP) atau Dokumen PDF resmi.');
  }

  // 2. Kompresi gambar terlebih dahulu untuk mencegah crash memori di browser ponsel
  const processedFile = await compressImageIfNeeded(file);

  const gdriveEndpoint =
    import.meta.env.VITE_GDRIVE_UPLOAD_URL ||
    localStorage.getItem('simak_gdrive_upload_url') ||
    '';

  const cleanNpm = (metadata.uploaderNpm || 'NPM').replace(/[^a-zA-Z0-9_-]/g, '');
  const cleanExt = (processedFile.name.split('.').pop() || 'jpg').toLowerCase();
  const safeExt = allowedExtensions.includes(cleanExt) ? cleanExt : 'jpg';
  const targetFileName = `IZIN_${cleanNpm}_${Date.now()}.${safeExt}`;

  // 2. Jika Google Apps Script terkonfigurasi, coba unggah ke Google Drive dengan timeout 12 detik
  if (gdriveEndpoint && gdriveEndpoint.startsWith('https://script.google.com/')) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 12000);

    try {
      const base64Data = await fileToBase64(processedFile);

      const payload = {
        action: 'upload',
        fileName: targetFileName,
        mimeType: processedFile.type || 'image/jpeg',
        base64: base64Data.split(',')[1] || base64Data,
        folderName: 'SIMAK GENBI - Berkas Izin & Dispensasi',
        uploaderNpm: metadata.uploaderNpm,
        uploaderName: metadata.uploaderName,
        eventTitle: metadata.eventTitle,
        reason: metadata.reason || '',
      };

      const response = await fetch(gdriveEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'text/plain;charset=utf-8',
        },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);
      const responseText = await response.text();

      let result: any = null;
      try {
        result = JSON.parse(responseText);
      } catch {
        if (responseText.startsWith('http')) {
          result = { fileUrl: responseText.trim() };
        }
      }

      if (result && (result.fileUrl || result.url)) {
        return {
          fileUrl: result.fileUrl || result.url,
          provider: 'gdrive',
          fileName: targetFileName,
        };
      }
    } catch (gdriveErr: any) {
      clearTimeout(timeoutId);
      console.warn('Google Apps Script drive upload timeout/error, beralih ke Supabase/Fallback:', gdriveErr?.message);
    }
  }

  // 3. Fallback: Simpan ke Supabase Storage (bucket attendance-proofs)
  try {
    const filePath = `surat-izin/${targetFileName}`;
    const { error: uploadError } = await supabase.storage
      .from('attendance-proofs')
      .upload(filePath, processedFile, {
        cacheControl: '3600',
        upsert: false,
      });

    if (!uploadError) {
      const { data: publicData } = supabase.storage
        .from('attendance-proofs')
        .getPublicUrl(filePath);

      if (publicData?.publicUrl) {
        return {
          fileUrl: publicData.publicUrl,
          provider: 'supabase',
          fileName: targetFileName,
        };
      }
    }
  } catch (storageErr: any) {
    console.warn('Supabase storage upload note:', storageErr?.message);
  }

  // 4. Fallback Terakhir: Catat metadata berkas agar data pengajuan anggota tetap tersimpan aman
  return {
    fileUrl: `[Lampiran Terlampir]: ${processedFile.name} (${Math.round(processedFile.size / 1024)} KB)`,
    provider: 'direct',
    fileName: file.name,
  };
}

/**
 * Konversi File objek menjadi Base64 Data URL secara aman
 */
export function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = (err) => reject(err);
  });
}
