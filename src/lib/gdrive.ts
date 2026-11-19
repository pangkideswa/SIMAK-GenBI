import { supabase } from './supabase';

export interface GDriveUploadMetadata {
  uploaderNpm: string;
  uploaderName: string;
  eventTitle: string;
  reason?: string;
}

export interface GDriveUploadResult {
  fileUrl: string;
  provider: 'gdrive' | 'supabase' | 'direct';
  fileName: string;
}

/**
 * Kompresi gambar client-side otomatis sebelum upload agar:
 * 1. Ukuran file berkurang dari ~10MB menjadi ~200KB.
 * 2. Upload Google Drive / Apps Script selesai dalam < 1 detik.
 * 3. Menghindari crash memori browser ponsel yang menyebabkan halaman ter-refresh sendiri.
 */
async function compressImageIfNeeded(file: File): Promise<File> {
  if (!file.type.startsWith('image/') || file.size <= 250 * 1024) {
    return file;
  }

  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const maxDimension = 1200;
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
          resolve(file);
          return;
        }

        ctx.drawImage(img, 0, 0, width, height);
        canvas.toBlob(
          (blob) => {
            if (blob) {
              const compressedFile = new File([blob], file.name.replace(/\.[^/.]+$/, '.jpg'), {
                type: 'image/jpeg',
                lastModified: Date.now(),
              });
              resolve(compressedFile);
            } else {
              resolve(file);
            }
          },
          'image/jpeg',
          0.72
        );
      };
      img.onerror = () => resolve(file);
      img.src = e.target?.result as string;
    };
    reader.onerror = () => resolve(file);
    reader.readAsDataURL(file);
  });
}

/**
 * Upload berkas surat izin / dispensasi ke Google Drive (via Google Apps Script Web App Endpoint)
 * atau fallback ke Supabase Storage jika URL Apps Script belum dikonfigurasi.
 */
export async function uploadProofToGDrive(
  file: File,
  metadata: GDriveUploadMetadata
): Promise<GDriveUploadResult> {
  // Kompresi terlebih dahulu jika ukuran besar untuk mencegah reload browser dan timeout GAS
  const processedFile = await compressImageIfNeeded(file);

  const gdriveEndpoint =
    import.meta.env.VITE_GDRIVE_UPLOAD_URL ||
    localStorage.getItem('simak_gdrive_upload_url') ||
    '';

  const cleanNpm = metadata.uploaderNpm || 'NPM';
  const cleanExt = processedFile.name.split('.').pop() || 'dat';
  const targetFileName = `IZIN_${cleanNpm}_${Date.now()}.${cleanExt}`;

  // 1. Jika pengguna telah mengonfigurasi URL Google Apps Script Web App (seperti sistem SIAPOS)
  if (gdriveEndpoint && gdriveEndpoint.startsWith('https://script.google.com/')) {
    try {
      const base64Data = await fileToBase64(processedFile);

      const payload = {
        action: 'upload',
        fileName: targetFileName,
        mimeType: processedFile.type || 'application/octet-stream',
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
      });

      const responseText = await response.text();
      let result: any = null;
      try {
        result = JSON.parse(responseText);
      } catch {
        // Jika Google Apps Script mengembalikan teks URL langsung
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
    } catch (gdriveErr) {
      console.warn('Google Drive Apps Script upload error, fallback ke Supabase Storage:', gdriveErr);
    }
  }

  // 2. Fallback: Simpan ke Supabase Storage (bucket attendance-proofs)
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
  } catch (storageErr) {
    console.warn('Supabase storage upload error:', storageErr);
  }

  // 3. Fallback terakhir jika kedua cloud storage offline
  return {
    fileUrl: `[Berkas Lampiran]: ${processedFile.name} (${Math.round(processedFile.size / 1024)} KB)`,
    provider: 'direct',
    fileName: file.name,
  };
}

/**
 * Konversi File objek menjadi Base64 Data URL
 */
export function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = (err) => reject(err);
  });
}
