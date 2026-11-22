// @ts-nocheck
import type { VercelRequest, VercelResponse } from '@vercel/node';

let awardsStateMemory: any = {
  isPublished: false,
  academicYear: "2026/2027",
  winners: {
    "bph-terbaik": {
      id: "bph-terbaik",
      categoryTitle: "BPH Terbaik",
      categorySubtitle: "Dipilih secara demokratis melalui voting seluruh anggota & Kadiv",
      winnerName: "Ahmad Fauzi",
      winnerDivision: "Pengabdian Masyarakat",
      winnerRole: "BPH",
      notes: "Dedikasi tinggi dalam manajemen operasional dan digitalisasi sistem SIMAK GENBI"
    },
    "kadiv-terbaik": {
      id: "kadiv-terbaik",
      categoryTitle: "Kepala Divisi Terbaik",
      categorySubtitle: "Kepemimpinan dan pembinaan divisi paling berdedikasi",
      winnerName: "Siti Rahmawati",
      winnerDivision: "Pendidikan",
      winnerRole: "kadiv",
      notes: "Kepemimpinan yang responsif dan konsisten mengayomi anggota divisi"
    },
    "proker-terbaik": {
      id: "proker-terbaik",
      categoryTitle: "Program of the Year",
      categorySubtitle: "Program kerja paling berdampak positif dan sukses terlaksana",
      winnerName: "Sosialisasi Cinta Bangga Paham (CBP) Rupiah",
      winnerDivision: "Publikasi dan Sosialisasi",
      notes: "Kolaborasi sukses bersama SMA di Majalengka dengan partisipasi peserta maksimal"
    },
    "inspiring-member": {
      id: "inspiring-member",
      categoryTitle: "Most Inspiring Member",
      categorySubtitle: "Inisiatif, loyalitas, dan kontribusi nyata yang menginspirasi",
      winnerName: "Deden Kurniawan",
      winnerDivision: "Publikasi dan Sosialisasi",
      notes: "Keteladanan tinggi dalam publikasi kreatif dan semangat kolaborasi"
    },
    "anggota-terbaik": {
      id: "anggota-terbaik",
      categoryTitle: "Anggota Terbaik",
      categorySubtitle: "Kombinasi integritas kepribadian dan keaktifan organisasi",
      winnerName: "Fajar Pratama",
      winnerDivision: "Lingkungan Hidup",
      notes: "Integritas tinggi, ramah, dan selalu siap berkontribusi pada kegiatan GenBI"
    },
    "anggota-paling-aktif": {
      id: "anggota-paling-aktif",
      categoryTitle: "Anggota Paling Aktif",
      categorySubtitle: "Akumulasi skor poin kehadiran dan keaktifan tertinggi di sistem",
      winnerName: "Ahmad Fauzi",
      winnerDivision: "BPH",
      notes: "Raihan poin keaktifan tertinggi sepanjang periode berjalan"
    },
    "best-division": {
      id: "best-division",
      categoryTitle: "Best Division of the Year",
      categorySubtitle: "Divisi paling produktif dengan pencapaian target proker terbaik",
      winnerName: "Publikasi dan Sosialisasi",
      winnerDivision: "Publikasi dan Sosialisasi",
      notes: "Pengelolaan kanal media sosial dan peliputan kegiatan terstruktur dan masif"
    },
    "divisi-terkompak": {
      id: "divisi-terkompak",
      categoryTitle: "Divisi Terkompak",
      categorySubtitle: "Kekompakan tim divisi dengan persentase kehadiran paling solid",
      winnerName: "Pengabdian Masyarakat",
      winnerDivision: "Pengabdian Masyarakat",
      notes: "Tingkat kehadiran 100% pada setiap agenda wajib dan kepedulian sosial yang konsisten"
    }
  },
  bphVotes: {},
  voterNpms: []
};

// Rate limiter in-memory per IP (maksimal 60 request/menit)
const ipCache = new Map<string, { count: number; resetAt: number }>();

function checkIpRateLimit(ip: string, limit: number = 60, windowMs: number = 60000): boolean {
  const now = Date.now();
  const entry = ipCache.get(ip);
  if (!entry || entry.resetAt <= now) {
    ipCache.set(ip, { count: 1, resetAt: now + windowMs });
    return true;
  }
  if (entry.count >= limit) {
    return false;
  }
  entry.count++;
  return true;
}

export default function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  const clientIp = (req.headers && (req.headers['x-forwarded-for'] || req.headers['x-real-ip'])) || 'client-ip';
  const ipStr = Array.isArray(clientIp) ? clientIp[0] : String(clientIp).split(',')[0].trim();
  if (!checkIpRateLimit(ipStr, 60, 60000)) {
    res.setHeader('Retry-After', '30');
    return res.status(429).json({ error: 'Terlalu banyak permintaan. Silakan tunggu 30 detik.' });
  }

  if (req.method === 'GET') {
    return res.status(200).json(awardsStateMemory);
  }

  if (req.method === 'POST') {
    const payload = req.body;
    if (payload && typeof payload === 'object') {
      awardsStateMemory = { ...awardsStateMemory, ...payload };
    }
    return res.status(200).json({ success: true, isPublished: Boolean(awardsStateMemory.isPublished) });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
