# SIMAK GENBI — Sistem Informasi Manajemen & Keaktifan GenBI

Platform **Progressive Web App (PWA)** terpadu untuk manajemen presensi, keaktifan, evaluasi beasiswa, dan administrasi kepengurusan **Generasi Baru Indonesia (GenBI) Komisariat Universitas Majalengka (UNMA)** — KPw Bank Indonesia Cirebon.

---

## Fitur Utama

### 1. Multi-Peran (Anggota, Kepala Divisi, BPH, & Super Admin)
- **Anggota & Kepala Divisi (`DashboardPage`)**:
  - **Smart ID Card Digital**: Kartu anggota bolak-balik lengkap dengan QR Code presensi resmi, jabatan/divisi, program studi, serta ekspor gambar PNG resolusi tinggi.
  - **Presensi QR & Token**: Pemindai kamera QR 1:1 anti-multiscan, unggah gambar QR, dan input token manual dengan validasi lokasi GPS opsional (geofencing).
  - **Tugas Delegasi BI**: Presensi penugasan luar kampus dengan pilihan **Kamera Langsung** / **Galeri**, perekaman GPS, serta **watermark otomatis** (waktu WIB, koordinat GPS, nama/NPM, dan kota) di atas foto sebelum diunggah ke Google Drive.
  - **Ajukan Izin / Sakit**: Unggah surat bukti resmi langsung ke Google Drive.
  - **Evaluasi Keaktifan & Rapor PDF**: Rekap otomatis kehadiran, persentase, status keaktifan (`Sangat Aktif`, `Aktif`, `Perlu Pembinaan`), serta cetak Rapor Keaktifan & Rekomendasi Beasiswa BI (PDF) dengan QR verifikasi dokumen.
  - **Leaderboard Divisi & Reward Mubes**: Klasemen keaktifan internal divisi (untuk Kadiv) serta halaman penghargaan tahunan Mubes.
- **Badan Pengurus Harian / BPH (`AdminDashboardPage`)**:
  - **Manajemen Agenda & Sesi**: Buat, edit, kunci/buka sesi presensi, atur lokasi kegiatan (kampus maupun luar kampus), radius GPS, QR Proyektor, Scan ID Card peserta, Lihat Peserta, serta cetak **Berita Acara & Daftar Hadir Resmi (PDF)**.
  - **Verifikasi & Rekap**: Persetujuan/penolakan izin & tugas delegasi, tombol **Lihat Bukti**, penambahan nilai kontribusi (`+ Nilai`), tombol **WA** per anggota, dan **Export CSV** format baku LPJ Bank Indonesia.
  - **Leaderboard & Peringkat**: Podium Top 3, kontrol publikasi klasemen (`Draft Internal` / `Terbit ke Anggota`), dan cetak rapor PDF.
  - **Whitelist SK Anggota**: Kelola daftar SK resmi (tambah satuan, edit jabatan/divisi/role, impor CSV massal, hapus satuan, maupun hapus semua).
- **Super Admin (`SuperAdminPage`)**:
  - Manajemen seluruh pengguna, Master Jabatan & Master Divisi, Periode Kepengurusan, pengaturan bobot poin presensi (tersinkron ke cloud), **Pratinjau Antarmuka Peran**, kesehatan sistem, log audit, dan manajemen Reward Mubes.

### 2. Sinkronisasi Cloud & Offline-First
- **Supabase**: Sinkronisasi real-time lintas perangkat untuk `profiles`, `authorized_members`, `events`, `attendances`, dan view `member_evaluations`.
- **Google Apps Script + Google Drive**: Pemisahan otomatis ke subfolder **`Dokumentasi Delegasi`** (`DELEGASI_*.jpg`) dan **`Surat Izin & Validasi`** (`IZIN_*.*`).
- **PWA & Antrean Offline**: Dukungan instalasi aplikasi (Android/iOS/Desktop), notifikasi web, dan antrean presensi offline otomatis saat koneksi terputus.

---

## Teknologi

- **Frontend**: React 19, TypeScript, Vite 6, Tailwind CSS v4, Lucide Icons
- **Backend & Auth**: Supabase (`@supabase/supabase-js`)
- **Storage Eksternal**: Google Apps Script Web App (`google-apps-script/Code.gs`) -> Google Drive
- **QR & Export**: `html5-qrcode`, `qrcode.react`, `html2canvas-pro`
- **PWA & Hosting**: `vite-plugin-pwa` (Workbox), siap deploy ke Vercel (`vercel.json` & `/api/*`)

---

## Struktur Direktori

```text
SIMAK-GenBI/
├── api/                         # Serverless API endpoints (Vercel)
├── google-apps-script/
│   └── Code.gs                  # Google Apps Script Drive uploader (subFolder support)
├── public/                      # Aset statis, ikon PWA, & fallback cloud JSON
├── src/
│   ├── components/              # Komponen modal cetak, verifikasi dokumen, footer, picker
│   ├── lib/                     # Integrasi Supabase, Drive, sync, audit log, & roster
│   ├── pages/                   # LoginPage, DashboardPage, AdminDashboardPage, SuperAdminPage
│   └── types/                   # Definisi tipe TypeScript database
├── supabase/
│   └── schema.sql               # Skema database PostgreSQL & RLS Supabase
├── .env.example                 # Template variabel lingkungan
└── package.json
```

---

## Instalasi & Menjalankan Secara Lokal

1. **Clone repository & pasang dependensi**
   ```bash
   git clone https://github.com/pangkideswa/SIMAK-GenBI.git
   cd SIMAK-GenBI
   npm install
   ```

2. **Siapkan Environment Variables**
   Salin `.env.example` menjadi `.env`, lalu isi kredensial Anda:
   ```env
   VITE_SUPABASE_URL=https://your-project.supabase.co
   VITE_SUPABASE_ANON_KEY=your-anon-key
   VITE_GDRIVE_UPLOAD_URL=https://script.google.com/macros/s/your-deployment-id/exec
   VITE_SUPERADMIN_WA=6281234567890
   ```

3. **Siapkan Database Supabase**
   Jalankan skema di [`supabase/schema.sql`](supabase/schema.sql) melalui **Supabase SQL Editor**, serta pastikan kolom berikut tersedia bila memakai tabel lama:
   ```sql
   ALTER TABLE public.authorized_members ADD COLUMN IF NOT EXISTS jabatan text;
   ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS jabatan text;
   ALTER TABLE public.events ADD COLUMN IF NOT EXISTS location_name text;
   ```

4. **Siapkan Google Drive Uploader (Opsional untuk Penyimpanan Drive)**
   Deploy isi [`google-apps-script/Code.gs`](google-apps-script/Code.gs) sebagai **Web App** (*Execute as: Me*, *Who has access: Anyone*), lalu masukkan URL deployment-nya ke `VITE_GDRIVE_UPLOAD_URL`.

5. **Jalankan Server Pengembangan / Build Produksi**
   ```bash
   npm run dev      # Mode pengembangan (HTTPS lokal via @vitejs/plugin-basic-ssl)
   npm run build    # TypeScript check + build produksi ke folder dist/
   ```

---

## Lisensi & Pengembang

&copy; 2026 **SIMAK GenBI V1.0** — GenBI Komisariat Universitas Majalengka.  
Dikembangkan oleh **PD-Dev** ([GitHub](https://github.com/pangkideswa)).
