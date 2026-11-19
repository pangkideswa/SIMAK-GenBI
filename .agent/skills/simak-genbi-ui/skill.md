---
name: simak-genbi-ui-system
description: Standar sistem desain, arsitektur UI/UX, dan aturan komponen frontend untuk platform PWA SIMAK GENBI (Sistem Informasi Manajemen & Keaktifan GenBI).
---

# SIMAK GENBI Design & Architecture System

## 1. Identitas Aplikasi & Konteks

- **Nama Platform:** SIMAK GENBI (_Sistem Informasi Manajemen & Keaktifan GenBI_).
- **Entitas Pengembang:** GenBI Komisariat Universitas Majalengka.
- **Karakter Visual:** Formal-institusional berwibawa yang dipadukan dengan estetika modern _Clean Glassmorphism_.

## 2. Tech Stack & Struktur Kode

- Gunakan **React (TypeScript)** dengan **Tailwind CSS** dan **Lucide Icons**.
- Terapkan arsitektur komponen modular dengan penamaan file PascalCase (`LoginCard.tsx`, `KeaktifanChart.tsx`, `DigitalMemberCard.tsx`).
- Pastikan seluruh tampilan _mobile-first_ dan responsif karena aplikasi beroperasi sebagai **PWA (Progressive Web App)**.

## 3. Palet Warna & Permukaan (Surface)

- **Canvas Background:** Latar belakang lembut bernuansa _ice-slate_ (`bg-slate-50`) dengan aksen _mesh gradient_ radial halus berwarna biru korporat Bank Indonesia (`#1D4ED8` / `blue-700`) dan indigo/cyan pada opasitas rendah (`10% - 15%`).
- **Surface & Kartu:** Efek _frosted glass_ (`bg-white/85 backdrop-blur-xl`), border tipis transparan (`border border-white ring-1 ring-slate-900/5`), bayangan lembut bertingkat, dan sudut membulat presisi (`rounded-[32px]` untuk kartu utama, `rounded-2xl` untuk elemen dalam).
- **Warna Utama (Brand):** Royal Blue (`#2563EB` hingga `#1E40AF`) dengan aksen emas/amber (`#F59E0B`) khusus untuk indikator prestasi, peringkat, atau skor evaluasi tinggi.

## 4. Tipografi & Hirarki Brand

- Gunakan font geometris modern (_Plus Jakarta Sans_ atau _Inter_).
- Penulisan judul brand utama wajib menggunakan ketebalan `font-extrabold tracking-tight` dengan kontras warna dua nada: **SIMAK** berwarna `text-slate-900` dan **GENBI** berwarna `text-blue-600`.

## 5. Standar Interaksi & Aksesibilitas

- Setiap _input field_ wajib memiliki ikon di sisi kiri (`Lucide Icons`), latar belakang `bg-slate-100/60`, serta transisi fokus yang jelas (`focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10`).
- Tombol aksi utama wajib memiliki efek gradasi biru korporat, _hover elevation_, dan _active scale_ (`active:scale-[0.98] transition-all`).
