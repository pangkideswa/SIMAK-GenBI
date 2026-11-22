// @ts-nocheck
import type { VercelRequest, VercelResponse } from '@vercel/node';

// In-memory cache untuk serverless container Vercel
let eventsMemory: any[] = [
  {
    id: "evt-genpeka-2026",
    title: "GENPEKA",
    category: "Proker",
    event_date: "2026-11-22T14:22:00.000Z",
    points: 15,
    qr_token: "GENBI-ZCZRB9",
    is_active: true,
    require_location: false,
    target_lat: -6.8362,
    target_lng: 108.2275,
    radius_meters: 250,
    created_by: null,
    created_at: "2026-11-22T14:22:00.000Z"
  },
  {
    id: "e3333333-3333-3333-3333-333333333333",
    title: "Rapat Pleno & Evaluasi Bulanan Divisi GenBI UNMA",
    category: "Rutin",
    event_date: "2026-11-26T06:55:00.000Z",
    points: 10,
    qr_token: "PLENO-FEB-2026",
    is_active: true,
    require_location: false,
    target_lat: -6.8362,
    target_lng: 108.2275,
    radius_meters: 250,
    created_by: null,
    created_at: "2026-11-19T00:00:00.000Z"
  },
  {
    id: "e2222222-2222-2222-2222-222222222222",
    title: "Leadership Camp & Penguatan Kapasitas Generasi Baru Indonesia Cirebon",
    category: "Wajib",
    event_date: "2026-11-23T06:55:00.000Z",
    points: 25,
    qr_token: "LC-GENBI-2026",
    is_active: true,
    require_location: true,
    target_lat: -6.8362,
    target_lng: 108.2275,
    radius_meters: 300,
    created_by: null,
    created_at: "2026-11-19T00:00:00.000Z"
  },
  {
    id: "e1111111-1111-1111-1111-111111111111",
    title: "Sosialisasi Cinta Bangga Paham (CBP) Rupiah ke SMA Majalengka",
    category: "Proker",
    event_date: "2026-11-20T06:55:00.000Z",
    points: 15,
    qr_token: "CBP-UNMA-2026",
    is_active: true,
    require_location: false,
    target_lat: -6.8362,
    target_lng: 108.2275,
    radius_meters: 250,
    created_by: null,
    created_at: "2026-11-19T00:00:00.000Z"
  }
];

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
    return res.status(200).json(eventsMemory);
  }

  if (req.method === 'POST') {
    const payload = req.body;
    if (payload && payload.action === 'save' && payload.event) {
      const idx = eventsMemory.findIndex((e) => e.id === payload.event.id);
      if (idx >= 0) {
        eventsMemory[idx] = { ...eventsMemory[idx], ...payload.event };
      } else {
        eventsMemory.unshift(payload.event);
      }
    } else if (payload && payload.action === 'delete' && payload.eventId) {
      eventsMemory = eventsMemory.filter((e) => e.id !== payload.eventId);
    } else if (payload && payload.action === 'toggleLock' && payload.eventId) {
      eventsMemory = eventsMemory.map((e) =>
        e.id === payload.eventId ? { ...e, is_active: payload.nextStatus } : e
      );
    }
    return res.status(200).json({ success: true, count: eventsMemory.length });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
