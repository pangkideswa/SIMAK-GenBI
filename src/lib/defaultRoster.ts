import { Division, Role } from '../types/database';

export interface SeedMember {
  user_id: string;
  npm: string;
  nim: string;
  email: string;
  full_name: string;
  division: Division;
  role: Role;
  jabatan: string;
  is_claimed: boolean;
}

export const DEFAULT_ROSTER_60: SeedMember[] = [
  // ================= BPH (6 Orang - Pengurus Inti) =================
  {
    user_id: 'a1111111-1111-1111-1111-111111111111',
    npm: '2414101078',
    nim: '2414101078',
    email: 'admin@genbi-unma.ac.id',
    full_name: 'Ahmad Fauzi',
    division: 'BPH',
    role: 'admin',
    jabatan: 'Ketua',
    is_claimed: true,
  },
  {
    user_id: 'seed-bph-02',
    npm: '2214100002',
    nim: '2214100002',
    email: 'putri.amelia@genbi-unma.ac.id',
    full_name: 'Putri Amelia',
    division: 'BPH',
    role: 'admin',
    jabatan: 'Wakil Ketua',
    is_claimed: true,
  },
  {
    user_id: 'seed-bph-03',
    npm: '2214100003',
    nim: '2214100003',
    email: 'zahra.nabila@genbi-unma.ac.id',
    full_name: 'Zahra Nabila',
    division: 'BPH',
    role: 'admin',
    jabatan: 'Sekretaris 1',
    is_claimed: true,
  },
  {
    user_id: 'seed-bph-04',
    npm: '2214100004',
    nim: '2214100004',
    email: 'intan.permatasari@genbi-unma.ac.id',
    full_name: 'Intan Permatasari',
    division: 'BPH',
    role: 'admin',
    jabatan: 'Sekretaris 2',
    is_claimed: true,
  },
  {
    user_id: 'seed-bph-05',
    npm: '2214100005',
    nim: '2214100005',
    email: 'melani.kusuma@genbi-unma.ac.id',
    full_name: 'Melani Kusuma',
    division: 'BPH',
    role: 'admin',
    jabatan: 'Bendahara 1',
    is_claimed: true,
  },
  {
    user_id: 'seed-bph-06',
    npm: '2214100006',
    nim: '2214100006',
    email: 'bagas.saputra@genbi-unma.ac.id',
    full_name: 'Bagas Saputra',
    division: 'BPH',
    role: 'admin',
    jabatan: 'Bendahara 2',
    is_claimed: true,
  },

  // ================= PUBLIKASI DAN SOSIALISASI (11 Orang: 1 Kadiv + 10 Anggota) =================
  {
    user_id: 'b2222222-2222-2222-2222-222222222222',
    npm: '2214100010',
    nim: '2214100010',
    email: 'deden@genbi-unma.ac.id',
    full_name: 'Deden Kurniawan',
    division: 'Publikasi dan Sosialisasi',
    role: 'kadiv',
    jabatan: 'Kepala Divisi',
    is_claimed: true,
  },
  {
    user_id: 'c3333333-3333-3333-3333-333333333333',
    npm: '2214100048',
    nim: '2214100048',
    email: 'fahmi@genbi-unma.ac.id',
    full_name: 'Muhamad Fahmi',
    division: 'Publikasi dan Sosialisasi',
    role: 'member',
    jabatan: 'Anggota',
    is_claimed: true,
  },
  {
    user_id: 'seed-pub-03',
    npm: '2214100011',
    nim: '2214100011',
    email: 'alifia.rahma@genbi-unma.ac.id',
    full_name: 'Alifia Rahma',
    division: 'Publikasi dan Sosialisasi',
    role: 'member',
    jabatan: 'Anggota',
    is_claimed: true,
  },
  {
    user_id: 'seed-pub-04',
    npm: '2214100012',
    nim: '2214100012',
    email: 'bima.pratama@genbi-unma.ac.id',
    full_name: 'Bima Pratama',
    division: 'Publikasi dan Sosialisasi',
    role: 'member',
    jabatan: 'Anggota',
    is_claimed: true,
  },
  {
    user_id: 'seed-pub-05',
    npm: '2214100013',
    nim: '2214100013',
    email: 'citra.lestari@genbi-unma.ac.id',
    full_name: 'Citra Lestari',
    division: 'Publikasi dan Sosialisasi',
    role: 'member',
    jabatan: 'Anggota',
    is_claimed: false,
  },
  {
    user_id: 'seed-pub-06',
    npm: '2214100014',
    nim: '2214100014',
    email: 'dimas.anggara@genbi-unma.ac.id',
    full_name: 'Dimas Anggara',
    division: 'Publikasi dan Sosialisasi',
    role: 'member',
    jabatan: 'Anggota',
    is_claimed: true,
  },
  {
    user_id: 'seed-pub-07',
    npm: '2214100015',
    nim: '2214100015',
    email: 'elsa.novita@genbi-unma.ac.id',
    full_name: 'Elsa Novita',
    division: 'Publikasi dan Sosialisasi',
    role: 'member',
    jabatan: 'Anggota',
    is_claimed: true,
  },
  {
    user_id: 'seed-pub-08',
    npm: '2214100016',
    nim: '2214100016',
    email: 'farhan.hakim@genbi-unma.ac.id',
    full_name: 'Farhan Hakim',
    division: 'Publikasi dan Sosialisasi',
    role: 'member',
    jabatan: 'Anggota',
    is_claimed: false,
  },
  {
    user_id: 'seed-pub-09',
    npm: '2214100017',
    nim: '2214100017',
    email: 'gina.marlina@genbi-unma.ac.id',
    full_name: 'Gina Marlina',
    division: 'Publikasi dan Sosialisasi',
    role: 'member',
    jabatan: 'Anggota',
    is_claimed: true,
  },
  {
    user_id: 'seed-pub-10',
    npm: '2214100018',
    nim: '2214100018',
    email: 'hendra.wijaya@genbi-unma.ac.id',
    full_name: 'Hendra Wijaya',
    division: 'Publikasi dan Sosialisasi',
    role: 'member',
    jabatan: 'Anggota',
    is_claimed: true,
  },
  {
    user_id: 'seed-pub-11',
    npm: '2214100019',
    nim: '2214100019',
    email: 'indah.sari@genbi-unma.ac.id',
    full_name: 'Indah Sari',
    division: 'Publikasi dan Sosialisasi',
    role: 'member',
    jabatan: 'Anggota',
    is_claimed: false,
  },

  // ================= PENDIDIKAN (11 Orang: 1 Kadiv + 10 Anggota) =================
  {
    user_id: 'sample-3',
    npm: '2214100025',
    nim: '2214100025',
    email: 'siti@genbi-unma.ac.id',
    full_name: 'Siti Rahmawati',
    division: 'Pendidikan',
    role: 'kadiv',
    jabatan: 'Kepala Divisi',
    is_claimed: true,
  },
  {
    user_id: 'seed-pdd-02',
    npm: '2214100020',
    nim: '2214100020',
    email: 'joko.santoso@genbi-unma.ac.id',
    full_name: 'Joko Santoso',
    division: 'Pendidikan',
    role: 'member',
    jabatan: 'Anggota',
    is_claimed: true,
  },
  {
    user_id: 'seed-pdd-03',
    npm: '2214100021',
    nim: '2214100021',
    email: 'kartika.dewi@genbi-unma.ac.id',
    full_name: 'Kartika Dewi',
    division: 'Pendidikan',
    role: 'member',
    jabatan: 'Anggota',
    is_claimed: true,
  },
  {
    user_id: 'seed-pdd-04',
    npm: '2214100022',
    nim: '2214100022',
    email: 'lukman.nugraha@genbi-unma.ac.id',
    full_name: 'Lukman Nugraha',
    division: 'Pendidikan',
    role: 'member',
    jabatan: 'Anggota',
    is_claimed: false,
  },
  {
    user_id: 'seed-pdd-05',
    npm: '2214100023',
    nim: '2214100023',
    email: 'maya.anggraini@genbi-unma.ac.id',
    full_name: 'Maya Anggraini',
    division: 'Pendidikan',
    role: 'member',
    jabatan: 'Anggota',
    is_claimed: true,
  },
  {
    user_id: 'seed-pdd-06',
    npm: '2214100024',
    nim: '2214100024',
    email: 'naufal.azhari@genbi-unma.ac.id',
    full_name: 'Naufal Azhari',
    division: 'Pendidikan',
    role: 'member',
    jabatan: 'Anggota',
    is_claimed: true,
  },
  {
    user_id: 'seed-pdd-07',
    npm: '2214100026',
    nim: '2214100026',
    email: 'olivia.putri@genbi-unma.ac.id',
    full_name: 'Olivia Putri',
    division: 'Pendidikan',
    role: 'member',
    jabatan: 'Anggota',
    is_claimed: true,
  },
  {
    user_id: 'seed-pdd-08',
    npm: '2214100027',
    nim: '2214100027',
    email: 'pandu.winata@genbi-unma.ac.id',
    full_name: 'Pandu Winata',
    division: 'Pendidikan',
    role: 'member',
    jabatan: 'Anggota',
    is_claimed: false,
  },
  {
    user_id: 'seed-pdd-09',
    npm: '2214100028',
    nim: '2214100028',
    email: 'qori.amalia@genbi-unma.ac.id',
    full_name: 'Qori Amalia',
    division: 'Pendidikan',
    role: 'member',
    jabatan: 'Anggota',
    is_claimed: true,
  },
  {
    user_id: 'seed-pdd-10',
    npm: '2214100029',
    nim: '2214100029',
    email: 'reza.pahlevi@genbi-unma.ac.id',
    full_name: 'Reza Pahlevi',
    division: 'Pendidikan',
    role: 'member',
    jabatan: 'Anggota',
    is_claimed: true,
  },
  {
    user_id: 'seed-pdd-11',
    npm: '2214100030',
    nim: '2214100030',
    email: 'salsa.bila@genbi-unma.ac.id',
    full_name: 'Salsa Bila',
    division: 'Pendidikan',
    role: 'member',
    jabatan: 'Anggota',
    is_claimed: false,
  },

  // ================= LINGKUNGAN HIDUP (11 Orang: 1 Kadiv + 10 Anggota) =================
  {
    user_id: 'sample-4',
    npm: '2214100033',
    nim: '2214100033',
    email: 'fajar@genbi-unma.ac.id',
    full_name: 'Fajar Pratama',
    division: 'Lingkungan Hidup',
    role: 'kadiv',
    jabatan: 'Kepala Divisi',
    is_claimed: true,
  },
  {
    user_id: 'seed-lh-02',
    npm: '2214100031',
    nim: '2214100031',
    email: 'taufik.hidayat@genbi-unma.ac.id',
    full_name: 'Taufik Hidayat',
    division: 'Lingkungan Hidup',
    role: 'member',
    jabatan: 'Anggota',
    is_claimed: true,
  },
  {
    user_id: 'seed-lh-03',
    npm: '2214100032',
    nim: '2214100032',
    email: 'ulfa.maulida@genbi-unma.ac.id',
    full_name: 'Ulfa Maulida',
    division: 'Lingkungan Hidup',
    role: 'member',
    jabatan: 'Anggota',
    is_claimed: true,
  },
  {
    user_id: 'seed-lh-04',
    npm: '2214100034',
    nim: '2214100034',
    email: 'vina.fitriani@genbi-unma.ac.id',
    full_name: 'Vina Fitriani',
    division: 'Lingkungan Hidup',
    role: 'member',
    jabatan: 'Anggota',
    is_claimed: false,
  },
  {
    user_id: 'seed-lh-05',
    npm: '2214100035',
    nim: '2214100035',
    email: 'wahyu.ramadhan@genbi-unma.ac.id',
    full_name: 'Wahyu Ramadhan',
    division: 'Lingkungan Hidup',
    role: 'member',
    jabatan: 'Anggota',
    is_claimed: true,
  },
  {
    user_id: 'seed-lh-06',
    npm: '2214100036',
    nim: '2214100036',
    email: 'yulia.kartika@genbi-unma.ac.id',
    full_name: 'Yulia Kartika',
    division: 'Lingkungan Hidup',
    role: 'member',
    jabatan: 'Anggota',
    is_claimed: true,
  },
  {
    user_id: 'seed-lh-07',
    npm: '2214100037',
    nim: '2214100037',
    email: 'zaki.mubarak@genbi-unma.ac.id',
    full_name: 'Zaki Mubarak',
    division: 'Lingkungan Hidup',
    role: 'member',
    jabatan: 'Anggota',
    is_claimed: true,
  },
  {
    user_id: 'seed-lh-08',
    npm: '2214100038',
    nim: '2214100038',
    email: 'aditya.kurnia@genbi-unma.ac.id',
    full_name: 'Aditya Kurnia',
    division: 'Lingkungan Hidup',
    role: 'member',
    jabatan: 'Anggota',
    is_claimed: false,
  },
  {
    user_id: 'seed-lh-09',
    npm: '2214100039',
    nim: '2214100039',
    email: 'bela.safitri@genbi-unma.ac.id',
    full_name: 'Bela Safitri',
    division: 'Lingkungan Hidup',
    role: 'member',
    jabatan: 'Anggota',
    is_claimed: true,
  },
  {
    user_id: 'seed-lh-10',
    npm: '2314100001',
    nim: '2314100001',
    email: 'cahyo.utomo@genbi-unma.ac.id',
    full_name: 'Cahyo Utomo',
    division: 'Lingkungan Hidup',
    role: 'member',
    jabatan: 'Anggota',
    is_claimed: true,
  },
  {
    user_id: 'seed-lh-11',
    npm: '2314100002',
    nim: '2314100002',
    email: 'dina.handayani@genbi-unma.ac.id',
    full_name: 'Dina Handayani',
    division: 'Lingkungan Hidup',
    role: 'member',
    jabatan: 'Anggota',
    is_claimed: false,
  },

  // ================= PENGABDIAN MASYARAKAT (11 Orang: 1 Kadiv + 10 Anggota) =================
  {
    user_id: 'seed-pm-01',
    npm: '2214100040',
    nim: '2214100040',
    email: 'raka.maulana@genbi-unma.ac.id',
    full_name: 'Raka Maulana',
    division: 'Pengabdian Masyarakat',
    role: 'kadiv',
    jabatan: 'Kepala Divisi',
    is_claimed: true,
  },
  {
    user_id: 'seed-pm-02',
    npm: '2214100067',
    nim: '2214100067',
    email: 'nadia@genbi-unma.ac.id',
    full_name: 'Nadia Putri',
    division: 'Pengabdian Masyarakat',
    role: 'member',
    jabatan: 'Anggota',
    is_claimed: false,
  },
  {
    user_id: 'seed-pm-03',
    npm: '2314100003',
    nim: '2314100003',
    email: 'eko.prasetyo@genbi-unma.ac.id',
    full_name: 'Eko Prasetyo',
    division: 'Pengabdian Masyarakat',
    role: 'member',
    jabatan: 'Anggota',
    is_claimed: true,
  },
  {
    user_id: 'seed-pm-04',
    npm: '2314100004',
    nim: '2314100004',
    email: 'fira.rahmawati@genbi-unma.ac.id',
    full_name: 'Fira Rahmawati',
    division: 'Pengabdian Masyarakat',
    role: 'member',
    jabatan: 'Anggota',
    is_claimed: true,
  },
  {
    user_id: 'seed-pm-05',
    npm: '2314100005',
    nim: '2314100005',
    email: 'galih.permadi@genbi-unma.ac.id',
    full_name: 'Galih Permadi',
    division: 'Pengabdian Masyarakat',
    role: 'member',
    jabatan: 'Anggota',
    is_claimed: true,
  },
  {
    user_id: 'seed-pm-06',
    npm: '2314100006',
    nim: '2314100006',
    email: 'hana.fatimah@genbi-unma.ac.id',
    full_name: 'Hana Fatimah',
    division: 'Pengabdian Masyarakat',
    role: 'member',
    jabatan: 'Anggota',
    is_claimed: false,
  },
  {
    user_id: 'seed-pm-07',
    npm: '2314100007',
    nim: '2314100007',
    email: 'ilham.firdaus@genbi-unma.ac.id',
    full_name: 'Ilham Firdaus',
    division: 'Pengabdian Masyarakat',
    role: 'member',
    jabatan: 'Anggota',
    is_claimed: true,
  },
  {
    user_id: 'seed-pm-08',
    npm: '2314100008',
    nim: '2314100008',
    email: 'jessica.tan@genbi-unma.ac.id',
    full_name: 'Jessica Tania',
    division: 'Pengabdian Masyarakat',
    role: 'member',
    jabatan: 'Anggota',
    is_claimed: true,
  },
  {
    user_id: 'seed-pm-09',
    npm: '2314100009',
    nim: '2314100009',
    email: 'khalid.akbar@genbi-unma.ac.id',
    full_name: 'Khalid Akbar',
    division: 'Pengabdian Masyarakat',
    role: 'member',
    jabatan: 'Anggota',
    is_claimed: false,
  },
  {
    user_id: 'seed-pm-10',
    npm: '2314100010',
    nim: '2314100010',
    email: 'laila.nur@genbi-unma.ac.id',
    full_name: 'Laila Nuraini',
    division: 'Pengabdian Masyarakat',
    role: 'member',
    jabatan: 'Anggota',
    is_claimed: true,
  },
  {
    user_id: 'seed-pm-11',
    npm: '2314100011',
    nim: '2314100011',
    email: 'maulana.yusuf@genbi-unma.ac.id',
    full_name: 'Maulana Yusuf',
    division: 'Pengabdian Masyarakat',
    role: 'member',
    jabatan: 'Anggota',
    is_claimed: true,
  },

  // ================= KEWIRAUSAHAAN (10 Orang: 1 Kadiv + 9 Anggota) =================
  {
    user_id: 'seed-kwu-01',
    npm: '2214100041',
    nim: '2214100041',
    email: 'aulia.rahma@genbi-unma.ac.id',
    full_name: 'Aulia Rahma',
    division: 'Kewirausahaan',
    role: 'kadiv',
    jabatan: 'Kepala Divisi',
    is_claimed: true,
  },
  {
    user_id: 'sample-6',
    npm: '2214100052',
    nim: '2214100052',
    email: 'rizky@genbi-unma.ac.id',
    full_name: 'Rizky Ramadhan',
    division: 'Kewirausahaan',
    role: 'member',
    jabatan: 'Anggota',
    is_claimed: false,
  },
  {
    user_id: 'seed-kwu-03',
    npm: '2314100012',
    nim: '2314100012',
    email: 'nadira.azzahra@genbi-unma.ac.id',
    full_name: 'Nadira Azzahra',
    division: 'Kewirausahaan',
    role: 'member',
    jabatan: 'Anggota',
    is_claimed: true,
  },
  {
    user_id: 'seed-kwu-04',
    npm: '2314100013',
    nim: '2314100013',
    email: 'oscar.pratama@genbi-unma.ac.id',
    full_name: 'Oscar Pratama',
    division: 'Kewirausahaan',
    role: 'member',
    jabatan: 'Anggota',
    is_claimed: true,
  },
  {
    user_id: 'seed-kwu-05',
    npm: '2314100014',
    nim: '2314100014',
    email: 'putra.mahendra@genbi-unma.ac.id',
    full_name: 'Putra Mahendra',
    division: 'Kewirausahaan',
    role: 'member',
    jabatan: 'Anggota',
    is_claimed: true,
  },
  {
    user_id: 'seed-kwu-06',
    npm: '2314100015',
    nim: '2314100015',
    email: 'ratna.dewi@genbi-unma.ac.id',
    full_name: 'Ratna Dewi',
    division: 'Kewirausahaan',
    role: 'member',
    jabatan: 'Anggota',
    is_claimed: false,
  },
  {
    user_id: 'seed-kwu-07',
    npm: '2314100016',
    nim: '2314100016',
    email: 'satria.budi@genbi-unma.ac.id',
    full_name: 'Satria Budi',
    division: 'Kewirausahaan',
    role: 'member',
    jabatan: 'Anggota',
    is_claimed: true,
  },
  {
    user_id: 'seed-kwu-08',
    npm: '2314100017',
    nim: '2314100017',
    email: 'tiara.anjani@genbi-unma.ac.id',
    full_name: 'Tiara Anjani',
    division: 'Kewirausahaan',
    role: 'member',
    jabatan: 'Anggota',
    is_claimed: true,
  },
  {
    user_id: 'seed-kwu-09',
    npm: '2314100018',
    nim: '2314100018',
    email: 'umar.faruq@genbi-unma.ac.id',
    full_name: 'Umar Faruq',
    division: 'Kewirausahaan',
    role: 'member',
    jabatan: 'Anggota',
    is_claimed: false,
  },
  {
    user_id: 'seed-kwu-10',
    npm: '2314100019',
    nim: '2314100019',
    email: 'vina.oktaviani@genbi-unma.ac.id',
    full_name: 'Vina Oktaviani',
    division: 'Kewirausahaan',
    role: 'member',
    jabatan: 'Anggota',
    is_claimed: true,
  },
];

const SEEDED_EVENTS = [
  { id: 'e1111111-1111-1111-1111-111111111111', title: 'Sosialisasi Cinta Bangga Paham (CBP) Rupiah ke SMA Majalengka', points: 15, date: '2026-11-20T06:55:00.000Z' },
  { id: 'evt-genpeka-2026', title: 'GENPEKA', points: 15, date: '2026-11-22T14:22:00.000Z' },
  { id: 'e2222222-2222-2222-2222-222222222222', title: 'Leadership Camp & Penguatan Kapasitas Generasi Baru Indonesia Cirebon', points: 25, date: '2026-11-23T06:55:00.000Z' },
  { id: 'e3333333-3333-3333-3333-333333333333', title: 'Rapat Pleno & Evaluasi Bulanan Divisi GenBI UNMA', points: 10, date: '2026-11-26T06:55:00.000Z' },
];

function seededHash(str: string): number {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export interface SeededAttendanceRecord {
  id: string;
  user_id: string;
  npm: string;
  nim: string;
  full_name: string;
  division: string;
  event_id: string;
  event_title: string;
  event_points: number;
  status: 'hadir' | 'izin' | 'alfa';
  verified: boolean;
  scanned_at: string;
}

export const DEFAULT_SEEDED_ATTENDANCES_60: SeededAttendanceRecord[] = (() => {
  const records: SeededAttendanceRecord[] = [];
  for (const member of DEFAULT_ROSTER_60) {
    const h = seededHash(member.npm);
    // Tentukan pola aktivitas acak yang realistis per anggota across 4 agenda
    for (let idx = 0; idx < SEEDED_EVENTS.length; idx++) {
      const ev = SEEDED_EVENTS[idx];
      const roll = ((h >> (idx * 6)) ^ (idx * 37)) % 100;
      let status: 'hadir' | 'izin' | 'alfa' = 'hadir';

      if (member.role === 'admin' || member.role === 'kadiv') {
        // BPH & Kadiv lebih aktif (mayoritas hadir, sesekali izin/alfa)
        if (roll < 82) status = 'hadir';
        else if (roll < 94) status = 'izin';
        else status = 'alfa';
      } else {
        // Anggota bervariasi acak: hadir, izin, atau alfa
        if (roll < 68) status = 'hadir';
        else if (roll < 84) status = 'izin';
        else status = 'alfa';
      }

      const minuteOffset = (roll % 45) + 5;
      const baseTime = new Date(ev.date).getTime() + minuteOffset * 60000;
      records.push({
        id: `seed-att-${member.npm}-${idx + 1}`,
        user_id: member.user_id,
        npm: member.npm,
        nim: member.nim,
        full_name: member.full_name,
        division: member.division,
        event_id: ev.id,
        event_title: ev.title,
        event_points: ev.points,
        status,
        verified: status !== 'alfa',
        scanned_at: new Date(baseTime).toISOString(),
      });
    }
  }
  return records;
})();

export function computeEvaluationPredicate(
  totalPoints: number,
  attendancePercentage: number
): 'Sangat Aktif' | 'Aktif' | 'Perlu Pembinaan' {
  if (totalPoints >= 55 && attendancePercentage >= 75) return 'Sangat Aktif';
  if (totalPoints >= 30 || attendancePercentage >= 50) return 'Aktif';
  return 'Perlu Pembinaan';
}

export const DEFAULT_EVALUATIONS_60 = DEFAULT_ROSTER_60.map((m) => {
  const userAtts = DEFAULT_SEEDED_ATTENDANCES_60.filter((a) => a.npm === m.npm);
  let total_hadir = 0;
  let total_izin = 0;
  let total_alfa = 0;
  let total_points = 0;

  for (const a of userAtts) {
    if (a.status === 'hadir' && a.verified) {
      total_hadir += 1;
      total_points += a.event_points;
    } else if (a.status === 'izin' && a.verified) {
      total_izin += 1;
    } else if (a.status === 'alfa') {
      total_alfa += 1;
    }
  }

  const attendance_percentage = Math.min(100, Math.round((total_hadir / SEEDED_EVENTS.length) * 100));
  const predicate = computeEvaluationPredicate(total_points, attendance_percentage);

  return {
    user_id: m.user_id,
    npm: m.npm,
    nim: m.nim,
    email: m.email,
    full_name: m.full_name,
    division: m.division,
    role: m.role,
    avatar_url: null,
    total_points,
    total_hadir,
    total_izin,
    total_alfa,
    attendance_percentage,
    predicate,
  };
}).sort((a, b) => b.total_points - a.total_points);

