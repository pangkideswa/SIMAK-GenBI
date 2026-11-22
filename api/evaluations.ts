// @ts-nocheck
import type { VercelRequest, VercelResponse } from '@vercel/node';

let evaluationsMemory: any[] = [
  {
    user_id: "a1111111-1111-1111-1111-111111111111",
    npm: "2414101078",
    nim: "2414101078",
    email: "admin@genbi-unma.ac.id",
    full_name: "Ahmad Fauzi",
    division: "BPH",
    role: "admin",
    avatar_url: null,
    total_points: 95,
    total_hadir: 7,
    total_izin: 0,
    total_alfa: 0,
    attendance_percentage: 100.0,
    predicate: "Sangat Aktif"
  },
  {
    user_id: "b2222222-2222-2222-2222-222222222222",
    npm: "2214100010",
    nim: "2214100010",
    email: "deden@genbi-unma.ac.id",
    full_name: "Deden Kurniawan",
    division: "Publikasi dan Sosialisasi",
    role: "kadiv",
    avatar_url: null,
    total_points: 85,
    total_hadir: 6,
    total_izin: 1,
    total_alfa: 0,
    attendance_percentage: 85.7,
    predicate: "Sangat Aktif"
  },
  {
    user_id: "c3333333-3333-3333-3333-333333333333",
    npm: "2214100048",
    nim: "2214100048",
    email: "anisa@genbi-unma.ac.id",
    full_name: "Anisa Permata",
    division: "Publikasi dan Sosialisasi",
    role: "member",
    avatar_url: null,
    total_points: 75,
    total_hadir: 5,
    total_izin: 2,
    total_alfa: 0,
    attendance_percentage: 71.4,
    predicate: "Aktif"
  },
  {
    user_id: "sample-3",
    npm: "2214100025",
    nim: "2214100025",
    email: "siti@genbi-unma.ac.id",
    full_name: "Siti Rahmawati",
    division: "Pendidikan",
    role: "kadiv",
    avatar_url: null,
    total_points: 75,
    total_hadir: 5,
    total_izin: 1,
    total_alfa: 0,
    attendance_percentage: 71.4,
    predicate: "Aktif"
  },
  {
    user_id: "sample-4",
    npm: "2214100033",
    nim: "2214100033",
    email: "fajar@genbi-unma.ac.id",
    full_name: "Fajar Pratama",
    division: "Lingkungan Hidup",
    role: "kadiv",
    avatar_url: null,
    total_points: 70,
    total_hadir: 5,
    total_izin: 0,
    total_alfa: 1,
    attendance_percentage: 71.4,
    predicate: "Aktif"
  },
  {
    user_id: "sample-6",
    npm: "2214100052",
    nim: "2214100052",
    email: "rizky@genbi-unma.ac.id",
    full_name: "Rizky Ramadhan",
    division: "Kewirausahaan",
    role: "member",
    avatar_url: null,
    total_points: 40,
    total_hadir: 3,
    total_izin: 1,
    total_alfa: 2,
    attendance_percentage: 42.9,
    predicate: "Perlu Pembinaan"
  }
];

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
    return res.status(200).json(evaluationsMemory);
  }

  if (req.method === 'POST') {
    const rawBody = req.body;
    if (rawBody && typeof rawBody === 'object') {
      const payload = rawBody.evaluation || rawBody;
      const targetNpm = String(payload.npm || payload.nim || payload.user_id || '').trim().toLowerCase();
      if (targetNpm) {
        // Skala poin maksimal 100
        if (typeof payload.total_points === 'number') {
          payload.total_points = Math.min(100, Math.max(0, payload.total_points));
        }
        // Sanitasi identitas demo
        const rawName = String(payload.full_name || payload.fullName || '').toLowerCase();
        if (rawName.includes('pangki') || targetNpm === '2414101078') {
          payload.full_name = 'Ahmad Fauzi';
          payload.fullName = 'Ahmad Fauzi';
          payload.avatar_url = null;
        }

        const idx = evaluationsMemory.findIndex(
          (m) =>
            String(m.npm || m.nim || '').trim().toLowerCase() === targetNpm ||
            m.user_id === payload.user_id
        );
        if (idx >= 0) {
          evaluationsMemory[idx] = { ...evaluationsMemory[idx], ...payload };
        } else {
          evaluationsMemory.push(payload);
        }
        evaluationsMemory.sort((a, b) => (b.total_points || 0) - (a.total_points || 0));
      }
    }
    return res.status(200).json({ success: true, count: evaluationsMemory.length });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
