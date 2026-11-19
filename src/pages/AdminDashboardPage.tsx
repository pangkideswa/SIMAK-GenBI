import React, { useState, useEffect } from 'react';
import {
  LogOut,
  Calendar,
  Plus,
  QrCode,
  FileCheck2,
  Users,
  Download,
  CheckCircle,
  ExternalLink,
  X,
  Clock,
  Shield,
  Search,
  Lock,
  Unlock,
  Eye,
  CalendarDays,
  UserCheck,
  Maximize2,
  Minimize2,
  Filter,
  UserPlus,
  Crown,
  Trash2,
  FileSpreadsheet,
  UploadCloud,
  XCircle,
  MapPin,
  Pencil,
  Share2,
  Printer,
  Bell,
  Award,
} from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { supabase } from '../lib/supabase';
import { syncMemberUpdate, normalizeStudentId } from '../lib/memberSync';
import { formatDateTimeWIB, toDatetimeLocalWIB } from '../lib/dateUtils';
import { WibDateTimePicker } from '../components/WibDateTimePicker';
import { MemberReportModal } from '../components/MemberReportModal';
import { recordAuditLog } from '../lib/auditLog';
import {
  isPushNotificationEnabled,
  requestNotificationPermission,
  sendWebNotification,
  notifySessionOpened,
} from '../lib/notificationService';
import {
  saveOrUpdateEvent,
  deleteEventPermanently,
  deleteAttendanceRecord,
  filterDeletedAttendances,
  filterDeletedEvents,
} from '../lib/eventSync';
import { getAcademicPeriods, AcademicPeriod } from '../lib/periodSync';
import { Footer } from '../components/Footer';
import {
  recordUnifiedAttendance,
  applyEvaluationsOverrides,
  approveAttendanceSync,
} from '../lib/attendanceSync';
import type { Event as EventType, MemberEvaluation, EventCategory, Division, Role } from '../types/database';

interface AdminDashboardPageProps {
  user: {
    id: string;
    npm: string;
    nim?: string;
    fullName: string;
    division: string;
    role: Role;
  };
  onLogout: () => void;
  onSwitchToMemberView?: () => void;
}

interface PendingAttendance {
  id: string;
  user_id: string;
  event_id: string;
  status: string;
  proof_url: string | null;
  verified: boolean;
  scanned_at: string;
  member_name: string;
  member_npm: string;
  member_nim?: string;
  event_title: string;
  user_lat?: number | null;
  user_lng?: number | null;
  isDelegasi?: boolean;
  delegasiData?: {
    isDelegasi?: boolean;
    title?: string;
    city?: string;
    note?: string;
    photoUrl?: string;
    lat?: number | null;
    lng?: number | null;
    submittedAt?: string;
  } | null;
}

interface EventParticipant {
  id: string;
  user_id: string;
  status: 'hadir' | 'izin' | 'alfa';
  verified: boolean;
  scanned_at: string;
  full_name: string;
  npm: string;
  nim?: string;
  division: string;
}

const ALL_DIVISIONS: (Division | 'Semua')[] = [
  'Semua',
  'Publikasi dan Sosialisasi',
  'Lingkungan Hidup',
  'Pendidikan',
  'Pengabdian Masyarakat',
  'Kewirausahaan',
  'BPH',
];

const DEFAULT_SAMPLE_EVENTS: EventType[] = [
  {
    id: 'e1111111-1111-1111-1111-111111111111',
    title: 'Sosialisasi Cinta Bangga Paham (CBP) Rupiah ke SMA Majalengka',
    category: 'Proker',
    event_date: new Date(Date.now() + 86400000 * 2).toISOString(),
    points: 15,
    qr_token: 'CBP-UNMA-2026',
    is_active: true,
    require_location: false,
    target_lat: -6.8362,
    target_lng: 108.2275,
    radius_meters: 250,
    created_by: null,
    created_at: new Date().toISOString(),
  },
  {
    id: 'e2222222-2222-2222-2222-222222222222',
    title: 'Leadership Camp & Penguatan Kapasitas Generasi Baru Indonesia Cirebon',
    category: 'Wajib',
    event_date: new Date(Date.now() + 86400000 * 5).toISOString(),
    points: 25,
    qr_token: 'LC-GENBI-2026',
    is_active: true,
    require_location: true,
    target_lat: -6.8362,
    target_lng: 108.2275,
    radius_meters: 300,
    created_by: null,
    created_at: new Date().toISOString(),
  },
  {
    id: 'e3333333-3333-3333-3333-333333333333',
    title: 'Rapat Pleno & Evaluasi Bulanan Divisi GenBI UNMA',
    category: 'Rutin',
    event_date: new Date(Date.now() + 86400000 * 8).toISOString(),
    points: 10,
    qr_token: 'PLENO-FEB-2026',
    is_active: true,
    require_location: false,
    target_lat: -6.8362,
    target_lng: 108.2275,
    radius_meters: 250,
    created_by: null,
    created_at: new Date().toISOString(),
  },
  {
    id: 'e4444444-4444-4444-4444-444444444444',
    title: 'Penugasan Delegasi Bank Indonesia (Wilayah 9 & 10 Ciayumajakuning)',
    category: 'Wajib',
    event_date: new Date(Date.now() + 86400000 * 12).toISOString(),
    points: 30,
    qr_token: 'DELEGASI-BI-2026',
    is_active: true,
    require_location: false,
    target_lat: -6.7063,
    target_lng: 108.557,
    radius_meters: 50000,
    created_by: null,
    created_at: new Date().toISOString(),
  },
];

const DEFAULT_SAMPLE_LEADERBOARD: MemberEvaluation[] = [
  {
    user_id: 'a1111111-1111-1111-1111-111111111111',
    npm: '2414101078',
    nim: '2414101078',
    email: 'admin@genbi-unma.ac.id',
    full_name: 'Pangki Deswa Rayhandi',
    division: 'BPH',
    role: 'admin',
    avatar_url: null,
    total_points: 95,
    total_hadir: 7,
    total_izin: 0,
    total_alfa: 0,
    attendance_percentage: 100.0,
    predicate: 'Sangat Aktif',
  },
  {
    user_id: 'b2222222-2222-2222-2222-222222222222',
    npm: '2214100010',
    nim: '2214100010',
    email: 'deden@genbi-unma.ac.id',
    full_name: 'Deden Kurniawan',
    division: 'Publikasi dan Sosialisasi',
    role: 'kadiv',
    avatar_url: null,
    total_points: 85,
    total_hadir: 6,
    total_izin: 1,
    total_alfa: 0,
    attendance_percentage: 85.7,
    predicate: 'Sangat Aktif',
  },
  {
    user_id: 'sample-3',
    npm: '2214100025',
    nim: '2214100025',
    email: 'siti@genbi-unma.ac.id',
    full_name: 'Siti Rahmawati',
    division: 'Pendidikan',
    role: 'kadiv',
    avatar_url: null,
    total_points: 75,
    total_hadir: 5,
    total_izin: 1,
    total_alfa: 0,
    attendance_percentage: 71.4,
    predicate: 'Aktif',
  },
  {
    user_id: 'sample-4',
    npm: '2214100033',
    nim: '2214100033',
    email: 'fajar@genbi-unma.ac.id',
    full_name: 'Fajar Pratama',
    division: 'Lingkungan Hidup',
    role: 'kadiv',
    avatar_url: null,
    total_points: 70,
    total_hadir: 5,
    total_izin: 0,
    total_alfa: 1,
    attendance_percentage: 71.4,
    predicate: 'Aktif',
  },
  {
    user_id: 'c3333333-3333-3333-3333-333333333333',
    npm: '2214100048',
    nim: '2214100048',
    email: 'anisa@genbi-unma.ac.id',
    full_name: 'Anisa Permata',
    division: 'Publikasi dan Sosialisasi',
    role: 'member',
    avatar_url: null,
    total_points: 60,
    total_hadir: 4,
    total_izin: 2,
    total_alfa: 0,
    attendance_percentage: 57.1,
    predicate: 'Aktif',
  },
  {
    user_id: 'sample-6',
    npm: '2214100052',
    nim: '2214100052',
    email: 'rizky@genbi-unma.ac.id',
    full_name: 'Rizky Ramadhan',
    division: 'Kewirausahaan',
    role: 'member',
    avatar_url: null,
    total_points: 40,
    total_hadir: 3,
    total_izin: 1,
    total_alfa: 2,
    attendance_percentage: 42.9,
    predicate: 'Perlu Pembinaan',
  },
];

const DEFAULT_SAMPLE_WHITELIST: Array<{
  npm: string;
  nim?: string;
  full_name: string;
  division: Division;
  role: Role;
  is_claimed: boolean;
  created_at: string;
}> = [
  { npm: '2414101078', nim: '2414101078', full_name: 'Pangki Deswa Rayhandi', division: 'BPH', role: 'admin', is_claimed: true, created_at: new Date().toISOString() },
  { npm: '2214100010', nim: '2214100010', full_name: 'Deden Kurniawan', division: 'Publikasi dan Sosialisasi', role: 'kadiv', is_claimed: true, created_at: new Date().toISOString() },
  { npm: '2214100025', nim: '2214100025', full_name: 'Siti Rahmawati', division: 'Pendidikan', role: 'kadiv', is_claimed: true, created_at: new Date().toISOString() },
  { npm: '2214100033', nim: '2214100033', full_name: 'Fajar Pratama', division: 'Lingkungan Hidup', role: 'kadiv', is_claimed: true, created_at: new Date().toISOString() },
  { npm: '2214100048', nim: '2214100048', full_name: 'Anisa Permata', division: 'Publikasi dan Sosialisasi', role: 'member', is_claimed: true, created_at: new Date().toISOString() },
  { npm: '2214100052', nim: '2214100052', full_name: 'Rizky Ramadhan', division: 'Kewirausahaan', role: 'member', is_claimed: false, created_at: new Date().toISOString() },
  { npm: '2214100067', nim: '2214100067', full_name: 'Nadia Putri', division: 'Pengabdian Masyarakat', role: 'member', is_claimed: false, created_at: new Date().toISOString() },
];

const DEFAULT_SAMPLE_PENDING_IZIN: PendingAttendance[] = [
  {
    id: 'demo-pending-1',
    user_id: 'sample-6',
    event_id: 'sample-evt-1',
    status: 'izin',
    proof_url: 'Surat Keterangan Sakit & Resep Dokter Puskesmas',
    verified: false,
    scanned_at: new Date().toISOString(),
    member_name: 'Rizky Ramadhan',
    member_npm: '2214100052',
    member_nim: '2214100052',
    event_title: 'Sosialisasi Cinta Bangga Paham (CBP) Rupiah ke SMA Majalengka',
  },
];

export const AdminDashboardPage: React.FC<AdminDashboardPageProps> = ({
  user,
  onLogout,
  onSwitchToMemberView,
}) => {
  const [activeTab, setActiveTab] = useState<'events' | 'verification' | 'leaderboard' | 'whitelist'>('events');

  // Periode Kepengurusan Dinamis (Tersinkronisasi dengan Super Admin)
  const initialPeriods = getAcademicPeriods();
  const [academicPeriods, setAcademicPeriods] = useState<AcademicPeriod[]>(initialPeriods);
  const activePeriodObj = initialPeriods.find((p) => p.isActive) || initialPeriods[0];
  const [selectedSemester, setSelectedSemester] = useState<string>(
    activePeriodObj ? activePeriodObj.name : 'T.A. 2026/2027 Ganjil'
  );

  // Status Kehadiran Mandiri BPH
  const [bphAttendedEventIds, setBphAttendedEventIds] = useState<string[]>([]);
  const [isSubmittingBphAtt, setIsSubmittingBphAtt] = useState(false);
  const [isPushEnabled, setIsPushEnabled] = useState(isPushNotificationEnabled());

  // Events State
  const [events, setEvents] = useState<EventType[]>([]);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showQrModal, setShowQrModal] = useState(false);
  const [isProjectorMode, setIsProjectorMode] = useState(false);
  const [activeQrEvent, setActiveQrEvent] = useState<EventType | null>(null);

  // Form Buat Event Baru
  const [newTitle, setNewTitle] = useState('');
  const [newCategory, setNewCategory] = useState<EventCategory>('Proker');
  const [newDate, setNewDate] = useState('');
  const [newPoints, setNewPoints] = useState(15);
  const [newToken, setNewToken] = useState('');
  const [requireLocation, setRequireLocation] = useState(false);
  const [targetRadius, setTargetRadius] = useState(250);
  const [isSubmittingEvent, setIsSubmittingEvent] = useState(false);

  // Edit Event State
  const [showEditEventModal, setShowEditEventModal] = useState(false);
  const [editingEvent, setEditingEvent] = useState<EventType | null>(null);
  const [editEventTitle, setEditEventTitle] = useState('');
  const [editEventCategory, setEditEventCategory] = useState<EventCategory>('Proker');
  const [editEventDate, setEditEventDate] = useState('');
  const [editEventPoints, setEditEventPoints] = useState(15);
  const [editEventToken, setEditEventToken] = useState('');
  const [editEventRequireLocation, setEditEventRequireLocation] = useState(false);
  const [editEventRadius, setEditEventRadius] = useState(250);
  const [isUpdatingEvent, setIsUpdatingEvent] = useState(false);

  // Modal Tolak Izin State
  const [rejectAttendanceId, setRejectAttendanceId] = useState<string | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [isSubmittingRejection, setIsSubmittingRejection] = useState(false);

  // Detail Peserta Modal State & Presensi Manual
  const [selectedEventForParticipants, setSelectedEventForParticipants] = useState<EventType | null>(null);
  const [participants, setParticipants] = useState<EventParticipant[]>([]);
  const [isLoadingParticipants, setIsLoadingParticipants] = useState(false);
  const [showManualAttendanceModal, setShowManualAttendanceModal] = useState(false);
  const [manualMemberNpm, setManualMemberNpm] = useState('');
  const [isSubmittingManualAtt, setIsSubmittingManualAtt] = useState(false);

  // Verifikasi Izin & Rekap State
  const [pendingIzin, setPendingIzin] = useState<PendingAttendance[]>([]);
  const [evaluations, setEvaluations] = useState<MemberEvaluation[]>([]);
  const [searchMember, setSearchMember] = useState('');
  const [selectedDivisionFilter, setSelectedDivisionFilter] = useState<string>('Semua');
  const [selectedReportMember, setSelectedReportMember] = useState<MemberEvaluation | null>(null);

  // Whitelist SK Anggota State
  const [whitelistMembers, setWhitelistMembers] = useState<Array<{
    npm: string;
    nim?: string;
    full_name: string;
    division: Division;
    role: Role;
    is_claimed: boolean;
    created_at: string;
  }>>([]);
  const [isLoadingWhitelist, setIsLoadingWhitelist] = useState(false);
  const [showAddWhitelistModal, setShowAddWhitelistModal] = useState(false);
  const [whiteNpm, setWhiteNpm] = useState('');
  const [whiteFullName, setWhiteFullName] = useState('');
  const [whiteDivision, setWhiteDivision] = useState<Division>('Publikasi dan Sosialisasi');
  const [whiteRole, setWhiteRole] = useState<Role>('member');
  const [isSavingWhitelist, setIsSavingWhitelist] = useState(false);

  // Edit Whitelist Member State
  const [showEditWhitelistModal, setShowEditWhitelistModal] = useState(false);
  const [editingWhitelist, setEditingWhitelist] = useState<{
    npm: string;
    nim?: string;
    full_name: string;
    division: Division;
    role: Role;
    is_claimed: boolean;
  } | null>(null);
  const [editWhiteFullName, setEditWhiteFullName] = useState('');
  const [editWhiteDivision, setEditWhiteDivision] = useState<Division>('Publikasi dan Sosialisasi');
  const [editWhiteRole, setEditWhiteRole] = useState<Role>('member');
  const [isUpdatingWhitelist, setIsUpdatingWhitelist] = useState(false);

  // Fetch Data Awal Asli Supabase
  const loadAdminData = async () => {
    try {
      // 1. Ambil Events Asli dengan Overrides Lokal
      const { data: eventData } = await supabase
        .from('events')
        .select('*')
        .order('event_date', { ascending: false });

      let eventOverrides: Record<string, any> = {};
      try {
        const raw = localStorage.getItem('simak_events_overrides');
        if (raw) eventOverrides = JSON.parse(raw);
      } catch {}

      const baseEvents = (eventData && eventData.length > 0) ? eventData : DEFAULT_SAMPLE_EVENTS;
      const mergedEvents = baseEvents.map((ev: any) => {
        const ov = eventOverrides[ev.id];
        return ov ? { ...ev, ...ov } : ev;
      });
      // Masukkan juga event yang dibuat lokal jika belum ada di database
      for (const [ovId, ovEv] of Object.entries(eventOverrides)) {
        if (!mergedEvents.some((e: any) => e.id === ovId)) {
          mergedEvents.unshift(ovEv);
        }
      }
      setEvents(filterDeletedEvents(mergedEvents as EventType[]));

      // 2. Ambil Rekap Keaktifan Seluruh Anggota (Terpadu Supabase + Overrides Permanen)
      const { data: evalData } = await supabase
        .from('member_evaluations')
        .select('*')
        .order('total_points', { ascending: false });

      const baseEvals = (evalData && evalData.length > 0) ? (evalData as MemberEvaluation[]) : DEFAULT_SAMPLE_LEADERBOARD;
      setEvaluations(applyEvaluationsOverrides(baseEvals));

      // 3. Ambil Pengajuan Izin & Delegasi Menunggu Verifikasi
      const { data: attData } = await supabase
        .from('attendances')
        .select('id, user_id, event_id, status, proof_url, verified, scanned_at, user_lat, user_lng')
        .in('status', ['izin', 'delegasi'])
        .eq('verified', false);

      let enrichedPending: PendingAttendance[] = [];

      if (attData && attData.length > 0) {
        const userIds = [...new Set(attData.map((a: any) => a.user_id))];
        const eventIds = [...new Set(attData.map((a: any) => a.event_id))];

        const { data: profilesData } = await supabase
          .from('profiles')
          .select('id, full_name, npm, nim')
          .in('id', userIds);

        const { data: eventsTitleData } = await supabase
          .from('events')
          .select('id, title')
          .in('id', eventIds);

        const profMap = new Map((profilesData || []).map((p: any) => [p.id, p]));
        const evMap = new Map((eventsTitleData || []).map((e: any) => [e.id, e]));

        enrichedPending = attData.map((a: any) => {
          const prof: any = profMap.get(a.user_id);
          const ev: any = evMap.get(a.event_id);
          const identifier = prof?.npm || prof?.nim || '-';

          let isDelegasi = a.status === 'delegasi';
          let delegasiMeta: any = null;
          let finalProofUrl = a.proof_url;

          if (a.proof_url && typeof a.proof_url === 'string' && a.proof_url.startsWith('{')) {
            try {
              delegasiMeta = JSON.parse(a.proof_url);
              if (delegasiMeta?.isDelegasi) {
                isDelegasi = true;
                finalProofUrl = delegasiMeta.photoUrl || finalProofUrl;
              }
            } catch {}
          }

          return {
            id: a.id,
            user_id: a.user_id,
            event_id: a.event_id,
            status: a.status,
            proof_url: finalProofUrl,
            verified: a.verified,
            scanned_at: a.scanned_at,
            member_name: prof?.full_name || 'Anggota GenBI',
            member_npm: identifier,
            member_nim: identifier,
            event_title: isDelegasi ? (delegasiMeta?.title || 'Tugas Delegasi Bank Indonesia') : (ev?.title || 'Agenda Kegiatan'),
            user_lat: a.user_lat || delegasiMeta?.lat,
            user_lng: a.user_lng || delegasiMeta?.lng,
            isDelegasi,
            delegasiData: delegasiMeta,
          };
        });
      }

      // Sinkronkan juga dari simak_all_attendances di localStorage jika ada pengajuan lokal
      try {
        const localAllRaw = localStorage.getItem('simak_all_attendances');
        if (localAllRaw) {
          const localAll = JSON.parse(localAllRaw);
          const localPending = localAll.filter(
            (p: any) => (p.status === 'izin' || p.status === 'delegasi') && !p.verified && !enrichedPending.some((ep) => ep.id === p.id)
          );

          for (const lp of localPending) {
            let isDelegasi = lp.status === 'delegasi';
            let delegasiMeta: any = null;
            let finalProofUrl = lp.proof_url;

            if (lp.proof_url && typeof lp.proof_url === 'string' && lp.proof_url.startsWith('{')) {
              try {
                delegasiMeta = JSON.parse(lp.proof_url);
                if (delegasiMeta?.isDelegasi) {
                  isDelegasi = true;
                  finalProofUrl = delegasiMeta.photoUrl || finalProofUrl;
                }
              } catch {}
            }

            enrichedPending.unshift({
              id: lp.id,
              user_id: lp.user_id,
              event_id: lp.event_id,
              status: lp.status,
              proof_url: finalProofUrl,
              verified: false,
              scanned_at: lp.scanned_at || new Date().toISOString(),
              member_name: lp.full_name || 'Anggota GenBI',
              member_npm: lp.npm || lp.nim || '-',
              member_nim: lp.npm || lp.nim || '-',
              event_title: isDelegasi ? (delegasiMeta?.title || 'Tugas Delegasi Bank Indonesia') : (lp.event_title || 'Agenda Kegiatan'),
              user_lat: lp.user_lat || delegasiMeta?.lat,
              user_lng: lp.user_lng || delegasiMeta?.lng,
              isDelegasi,
              delegasiData: delegasiMeta,
            });
          }
        }
      } catch {}

      const finalPending = filterDeletedAttendances(enrichedPending);
      if (finalPending.length > 0) {
        setPendingIzin(finalPending);
      } else if (user.id.startsWith('demo-')) {
        setPendingIzin(filterDeletedAttendances(DEFAULT_SAMPLE_PENDING_IZIN));
      } else {
        setPendingIzin([]);
      }

      // 4. Deteksi Agenda yang Sudah Dihadiri oleh BPH yang Sedang Login (Sinkron Lintas Desktop & Mobile)
      try {
        const cleanUserNpm = normalizeStudentId(user.npm || user.nim || '');
        let bphAttList: string[] = [];

        // A. Ambil langsung dari Supabase Database (Kunci sinkronisasi lintas perangkat Desktop & HP)
        try {
          const { data: dbAtt } = await supabase
            .from('attendances')
            .select('event_id')
            .eq('user_id', user.id)
            .eq('status', 'hadir');

          if (dbAtt && dbAtt.length > 0) {
            bphAttList.push(...dbAtt.map((a: any) => a.event_id));
          }

          // Cek juga jika ada ID profil lain yang memiliki NPM sama
          if (cleanUserNpm) {
            const { data: profileIds } = await supabase
              .from('profiles')
              .select('id')
              .or(`npm.eq.${cleanUserNpm},nim.eq.${cleanUserNpm}`);
            
            if (profileIds && profileIds.length > 0) {
              const ids = profileIds.map((p: any) => p.id);
              const { data: npmAtt } = await supabase
                .from('attendances')
                .select('event_id')
                .in('user_id', ids)
                .eq('status', 'hadir');
              if (npmAtt && npmAtt.length > 0) {
                bphAttList.push(...npmAtt.map((a: any) => a.event_id));
              }
            }
          }
        } catch (dbErr) {
          console.warn('Gagal membaca presensi BPH dari Supabase:', dbErr);
        }

        // B. Cek dari LocalStorage jika ada presensi lokal offline perangkat ini
        const localAllRaw = localStorage.getItem('simak_all_attendances');
        if (localAllRaw) {
          const localAll = JSON.parse(localAllRaw);
          const found = localAll
            .filter(
              (a: any) =>
                (a.user_id === user.id || (cleanUserNpm && normalizeStudentId(a.npm || a.nim) === cleanUserNpm)) &&
                a.status === 'hadir'
            )
            .map((a: any) => a.event_id);
          bphAttList.push(...found);
        }

        const rawPersonal = localStorage.getItem(`simak_attendances_${user.id}`);
        if (rawPersonal) {
          const personal = JSON.parse(rawPersonal);
          const foundPersonal = personal
            .filter((a: any) => a.status === 'hadir')
            .map((a: any) => a.event_id);
          bphAttList.push(...foundPersonal);
        }

        setBphAttendedEventIds((prev) => Array.from(new Set([...prev, ...bphAttList])));
      } catch {}
    } catch {
      setEvents(filterDeletedEvents(DEFAULT_SAMPLE_EVENTS));
      setEvaluations(applyEvaluationsOverrides(DEFAULT_SAMPLE_LEADERBOARD));
      if (user.id.startsWith('demo-')) {
        setPendingIzin(filterDeletedAttendances(DEFAULT_SAMPLE_PENDING_IZIN));
      } else {
        setPendingIzin([]);
      }
    }
  };

  // Fetch Daftar Whitelist SK Resmi dengan Dukungan Overrides Lokal
  const loadWhitelistMembers = async () => {
    setIsLoadingWhitelist(true);
    try {
      let baseList: any[] = [];
      const { data, error } = await (supabase.from('authorized_members') as any)
        .select('*')
        .order('created_at', { ascending: false });

      if (!error && data && data.length > 0) {
        baseList = data;
      } else {
        baseList = DEFAULT_SAMPLE_WHITELIST;
      }

      let overrides: Record<string, any> = {};
      try {
        const raw = localStorage.getItem('simak_whitelist_overrides');
        if (raw) overrides = JSON.parse(raw);
      } catch {}

      const merged = baseList.map((d: any) => {
        const studentId = normalizeStudentId(d.npm || d.nim);
        const ov = overrides[studentId];
        return {
          ...d,
          npm: studentId,
          nim: studentId,
          ...(ov ? ov : {}),
        };
      });

      setWhitelistMembers(merged);
    } catch {
      let overrides: Record<string, any> = {};
      try {
        const raw = localStorage.getItem('simak_whitelist_overrides');
        if (raw) overrides = JSON.parse(raw);
      } catch {}

      setWhitelistMembers(
        DEFAULT_SAMPLE_WHITELIST.map((d: any) => {
          const studentId = normalizeStudentId(d.npm || d.nim);
          return {
            ...d,
            npm: studentId,
            nim: studentId,
            ...(overrides[studentId] || {}),
          };
        })
      );
    } finally {
      setIsLoadingWhitelist(false);
    }
  };

  // Tambah Anggota Resmi ke Whitelist (SK BPH)
  const handleAddWhitelistMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!whiteNpm.trim() || !whiteFullName.trim()) {
      alert('NPM dan Nama Lengkap wajib diisi!');
      return;
    }

    setIsSavingWhitelist(true);
    if (user.id.startsWith('demo-')) {
      const newMember = {
        npm: whiteNpm.trim(),
        nim: whiteNpm.trim(),
        full_name: whiteFullName.trim(),
        division: whiteDivision,
        role: whiteRole,
        is_claimed: false,
        created_at: new Date().toISOString(),
      };
      setWhitelistMembers([newMember, ...whitelistMembers]);
      setShowAddWhitelistModal(false);
      setWhiteNpm('');
      setWhiteFullName('');
      setWhiteDivision('Publikasi dan Sosialisasi');
      setWhiteRole('member');
      setIsSavingWhitelist(false);
      alert(`Sukses menambahkan ${whiteFullName} (${whiteRole === 'kadiv' ? 'Kepala Divisi' : 'Anggota'}) ke SK Whitelist (Mode Demo)!`);
      return;
    }
    try {
      const { error } = await (supabase.from('authorized_members') as any).insert({
        npm: whiteNpm.trim(),
        nim: whiteNpm.trim(),
        full_name: whiteFullName.trim(),
        division: whiteDivision,
        role: whiteRole,
        is_claimed: false,
      });

      if (error) {
        if (error.code === '23505') {
          throw new Error('NPM ini sudah terdaftar dalam SK / Whitelist.');
        }
        throw error;
      }

      alert(`Sukses menambahkan ${whiteFullName} (${whiteRole === 'kadiv' ? 'Kepala Divisi' : 'Anggota'}) ke SK Whitelist!`);
      setShowAddWhitelistModal(false);
      setWhiteNpm('');
      setWhiteFullName('');
      setWhiteDivision('Publikasi dan Sosialisasi');
      setWhiteRole('member');
      loadWhitelistMembers();
    } catch (err: any) {
      alert(err.message || 'Gagal menambahkan anggota ke SK Whitelist.');
    } finally {
      setIsSavingWhitelist(false);
    }
  };

  // State Import CSV Massal Whitelist
  const [showImportCsvModal, setShowImportCsvModal] = useState(false);
  const [csvText, setCsvText] = useState('');
  const [isImportingCsv, setIsImportingCsv] = useState(false);

  // Parser & Handler Import Massal CSV
  const handleImportCsv = async () => {
    if (!csvText.trim()) {
      alert('Masukkan atau upload data teks CSV terlebih dahulu.');
      return;
    }

    setIsImportingCsv(true);
    if (user.id.startsWith('demo-')) {
      const lines = csvText
        .split('\n')
        .map((l) => l.trim())
        .filter((l) => l.length > 0);

      const toInsert: Array<{
        npm: string;
        nim?: string;
        full_name: string;
        division: Division;
        role: Role;
        is_claimed: boolean;
        created_at: string;
      }> = [];

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (i === 0 && (line.toLowerCase().includes('npm') || line.toLowerCase().includes('nim') || line.toLowerCase().includes('nama'))) {
          continue;
        }

        const delimiter = line.includes(';') ? ';' : line.includes('\t') ? '\t' : ',';
        const parts = line.split(delimiter).map((p) => p.trim().replace(/^["']|["']$/g, ''));

        if (parts.length >= 2) {
          const rawNpm = parts[0].replace(/\s+/g, '');
          const fullName = parts[1];
          let division: Division = 'Publikasi dan Sosialisasi';
          let role: Role = 'member';

          if (parts[2]) {
            division = parts[2] as Division;
          }
          if (parts[3]) {
            const roleInput = parts[3].toLowerCase();
            if (roleInput.includes('kadiv') || roleInput.includes('kepala')) role = 'kadiv';
            else if (roleInput.includes('admin') || roleInput.includes('bph')) role = 'admin';
          }

          if (rawNpm && fullName) {
            toInsert.push({
              npm: rawNpm,
              nim: rawNpm,
              full_name: fullName,
              division,
              role,
              is_claimed: false,
              created_at: new Date().toISOString(),
            });
          }
        }
      }

      setWhitelistMembers([...toInsert, ...whitelistMembers]);
      setShowImportCsvModal(false);
      setCsvText('');
      setIsImportingCsv(false);
      alert(`Berhasil mengimpor ${toInsert.length} data anggota resmi ke SK Whitelist (Mode Demo)!`);
      return;
    }
    try {
      const lines = csvText
        .split('\n')
        .map((l) => l.trim())
        .filter((l) => l.length > 0);

      const validDivisions: Division[] = [
        'Publikasi dan Sosialisasi',
        'Lingkungan Hidup',
        'Pendidikan',
        'Pengabdian Masyarakat',
        'Kewirausahaan',
        'BPH',
      ];

      const toInsert: Array<{
        npm: string;
        nim: string;
        full_name: string;
        division: Division;
        role: Role;
        is_claimed: boolean;
      }> = [];

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        // Abaikan baris header jika ada kata NPM/NIM/NAMA
        if (i === 0 && (line.toLowerCase().includes('npm') || line.toLowerCase().includes('nim')) && line.toLowerCase().includes('nama')) {
          continue;
        }

        // Dukung pemisah koma (,) atau titik koma (;) atau tab
        const delimiter = line.includes(';') ? ';' : line.includes('\t') ? '\t' : ',';
        const cols = line.split(delimiter).map((c) => c.trim().replace(/^["']|["']$/g, ''));

        if (cols.length >= 2) {
          const rawId = cols[0];
          const full_name = cols[1];
          let division: Division = 'Publikasi dan Sosialisasi';
          let role: Role = 'member';

          if (cols.length >= 3) {
            const rawDiv = cols[2];
            const matched = validDivisions.find(
              (vd) => vd.toLowerCase() === rawDiv.toLowerCase()
            );
            if (matched) division = matched;
          }

          if (cols.length >= 4) {
            const rawRole = cols[3].toLowerCase();
            if (rawRole.includes('kadiv') || rawRole.includes('kepala')) {
              role = 'kadiv';
            } else if (rawRole.includes('admin') || rawRole.includes('bph')) {
              role = 'admin';
            }
          }

          if (rawId && full_name) {
            toInsert.push({
              npm: rawId,
              nim: rawId,
              full_name,
              division,
              role,
              is_claimed: false,
            });
          }
        }
      }

      if (toInsert.length === 0) {
        throw new Error('Tidak ada baris data valid yang terbaca. Pastikan format: NPM, Nama Lengkap, Divisi, Role');
      }

      const { error } = await (supabase.from('authorized_members') as any).upsert(toInsert, {
        onConflict: 'npm',
        ignoreDuplicates: false,
      });

      if (error) throw error;

      alert(`Berhasil mengimpor ${toInsert.length} data anggota resmi ke SK Whitelist!`);
      setShowImportCsvModal(false);
      setCsvText('');
      loadWhitelistMembers();
    } catch (err: any) {
      alert(err.message || 'Gagal memproses impor CSV.');
    } finally {
      setIsImportingCsv(false);
    }
  };

  // Hapus Anggota dari Whitelist
  const handleDeleteWhitelist = async (identifier: string) => {
    if (!confirm(`Yakin ingin menghapus ${identifier} dari daftar SK Whitelist?`)) return;

    // Hapus dari state dan overrides lokal secara instan
    setWhitelistMembers((prev) => prev.filter((m) => m.npm !== identifier && m.nim !== identifier));
    try {
      const raw = localStorage.getItem('simak_whitelist_overrides');
      if (raw) {
        const overrides = JSON.parse(raw);
        delete overrides[identifier];
        localStorage.setItem('simak_whitelist_overrides', JSON.stringify(overrides));
      }
    } catch {}

    if (user.id.startsWith('demo-')) {
      alert(`NPM ${identifier} berhasil dihapus dari SK Whitelist (Mode Demo).`);
      return;
    }

    try {
      await (supabase.from('authorized_members') as any)
        .delete()
        .or(`npm.eq.${identifier},nim.eq.${identifier}`);
      alert(`NPM ${identifier} berhasil dihapus dari SK Whitelist.`);
    } catch (err: any) {
      console.warn('Database note:', err);
    }
  };

  useEffect(() => {
    loadAdminData();
    loadWhitelistMembers();

    const handleSyncEvent = (event: any) => {
      const detail = event?.detail;
      if (!detail?.npm) return;
      const cleanTargetId = normalizeStudentId(detail.npm);

      setWhitelistMembers((prev) =>
        prev.map((m) => {
          if (normalizeStudentId(m.npm || m.nim) === cleanTargetId) {
            return {
              ...m,
              full_name: detail.full_name || m.full_name,
              division: detail.division || m.division,
              role: detail.role || m.role,
            };
          }
          return m;
        })
      );

      setEvaluations((prev) =>
        prev.map((ev) => {
          if (normalizeStudentId(ev.npm || ev.nim) === cleanTargetId) {
            return {
              ...ev,
              full_name: detail.full_name || ev.full_name,
              division: detail.division || ev.division,
              role: detail.role || ev.role,
            };
          }
          return ev;
        })
      );
    };

    // Listener Event Sync & Attendance Sync
    const handleEventSync = (e: any) => {
      const syncedEvent = e?.detail;
      if (!syncedEvent?.id) return;
      setEvents((prev) => [syncedEvent, ...prev.filter((ev) => ev.id !== syncedEvent.id)]);
    };

    const handleEventDeleted = (e: any) => {
      const delId = e?.detail?.id;
      if (!delId) return;
      setEvents((prev) => prev.filter((ev) => ev.id !== delId));
    };

    const handleAttDeleted = (e: any) => {
      const delId = e?.detail?.id;
      if (!delId) return;
      setParticipants((prev) => prev.filter((p) => p.id !== delId));
      setPendingIzin((prev) => prev.filter((p) => p.id !== delId));
    };

    const handleAttSubmitted = (e?: any) => {
      const d = e?.detail;
      if (d) {
        const cleanUserNpm = normalizeStudentId(user.npm || user.nim || '');
        if (d.event_id && (d.user_id === user.id || normalizeStudentId(d.npm || d.nim) === cleanUserNpm)) {
          setBphAttendedEventIds((prev) => Array.from(new Set([...prev, d.event_id])));
        }
      }
      loadAdminData();
    };

    const handlePeriodSync = () => {
      const allPeriods = getAcademicPeriods();
      setAcademicPeriods(allPeriods);
      const active = allPeriods.find((p) => p.isActive);
      if (active) {
        setSelectedSemester(active.name);
      }
    };

    window.addEventListener('simak_member_sync', handleSyncEvent);
    window.addEventListener('simak_event_sync', handleEventSync);
    window.addEventListener('simak_event_deleted', handleEventDeleted);
    window.addEventListener('simak_attendance_deleted', handleAttDeleted);
    window.addEventListener('simak_attendance_submitted', handleAttSubmitted);
    window.addEventListener('simak_attendance_sync', handleAttSubmitted);
    window.addEventListener('simak_evaluations_sync', handleAttSubmitted);
    window.addEventListener('simak_period_sync', handlePeriodSync);

    return () => {
      window.removeEventListener('simak_member_sync', handleSyncEvent);
      window.removeEventListener('simak_event_sync', handleEventSync);
      window.removeEventListener('simak_event_deleted', handleEventDeleted);
      window.removeEventListener('simak_attendance_deleted', handleAttDeleted);
      window.removeEventListener('simak_attendance_submitted', handleAttSubmitted);
      window.removeEventListener('simak_attendance_sync', handleAttSubmitted);
      window.removeEventListener('simak_evaluations_sync', handleAttSubmitted);
      window.removeEventListener('simak_period_sync', handlePeriodSync);
    };
  }, []);

  // Fetch Peserta Kegiatan Sesi Terpilih
  const handleOpenParticipants = async (eventItem: EventType) => {
    setSelectedEventForParticipants(eventItem);
    setIsLoadingParticipants(true);
    setParticipants([]);

    try {
      const { data: attList } = await supabase
        .from('attendances')
        .select('id, user_id, status, verified, scanned_at')
        .eq('event_id', eventItem.id);

      if (attList && attList.length > 0) {
        const userIds = attList.map((a: any) => a.user_id);
        const { data: userProfiles } = await supabase
          .from('profiles')
          .select('id, full_name, npm, nim, division')
          .in('id', userIds);

        const userMap = new Map((userProfiles || []).map((u: any) => [u.id, u]));

        const enrichedList: EventParticipant[] = attList.map((a: any) => {
          const u: any = userMap.get(a.user_id);
          const studentId = u?.npm || u?.nim || '-';
          return {
            id: a.id,
            user_id: a.user_id,
            status: a.status,
            verified: a.verified,
            scanned_at: a.scanned_at,
            full_name: u?.full_name || 'Anggota GenBI',
            npm: studentId,
            nim: studentId,
            division: u?.division || '-',
          };
        });

        // Gabungkan juga dengan data presensi lokal (jika ada)
        try {
          const localAll = localStorage.getItem('simak_all_attendances');
          if (localAll) {
            const parsed = JSON.parse(localAll);
            const matched = parsed.filter(
              (p: any) => p.event_id === eventItem.id && !enrichedList.some((e) => e.user_id === p.user_id)
            );
            if (matched.length > 0) {
              enrichedList.push(...matched);
            }
          }
        } catch {}

        setParticipants(filterDeletedAttendances(enrichedList));
      } else {
        // Fallback: periksa cache lokal bersama jika Supabase belum ada data
        try {
          const localAll = localStorage.getItem('simak_all_attendances');
          if (localAll) {
            const parsed = JSON.parse(localAll);
            const matched = parsed.filter((p: any) => p.event_id === eventItem.id);
            if (matched.length > 0) {
              setParticipants(filterDeletedAttendances(matched));
              return;
            }
          }
        } catch {}
        setParticipants([]);
      }
    } catch {
      try {
        const localAll = localStorage.getItem('simak_all_attendances');
        if (localAll) {
          const parsed = JSON.parse(localAll);
          const matched = parsed.filter((p: any) => p.event_id === eventItem.id);
          if (matched.length > 0) {
            setParticipants(filterDeletedAttendances(matched));
            return;
          }
        }
      } catch {}
      setParticipants([]);
    } finally {
      setIsLoadingParticipants(false);
    }
  };

  // Toggle Buka / Kunci Sesi Absensi
  const handleToggleEventActive = async (eventId: string, currentStatus: boolean) => {
    const nextStatus = !currentStatus;
    const targetEv = events.find((e) => e.id === eventId);
    try {
      await (supabase.from('events') as any).update({ is_active: nextStatus }).eq('id', eventId);
      setEvents((prev) =>
        prev.map((e) => (e.id === eventId ? { ...e, is_active: nextStatus } : e))
      );

      // Notifikasi Push Web PWA jika sesi baru saja dibuka
      if (nextStatus && targetEv) {
        notifySessionOpened(targetEv.title, targetEv.points || 15);
      }

      // Catat Audit Trail Log
      recordAuditLog({
        actorName: user.fullName,
        actorRole: 'BPH / Administrator',
        actionType: 'EVENT_SESSION_TOGGLE',
        target: targetEv?.title || eventId,
        description: nextStatus
          ? `Membuka sesi presensi untuk agenda "${targetEv?.title || eventId}" (+${targetEv?.points || 15} Poin).`
          : `Mengunci sesi presensi untuk agenda "${targetEv?.title || eventId}".`,
      });
    } catch (err: any) {
      alert('Gagal mengubah status sesi: ' + err.message);
    }
  };

  // Toggle / Test Web Push Notification PWA BPH
  const handleTogglePushNotification = async () => {
    if (isPushEnabled) {
      sendWebNotification('Pengingat BPH SIMAK GENBI 🔔', {
        body: 'Notifikasi presensi dan sesi operasional BPH aktif.',
        icon: '/logo-genbi.png',
      });
      alert('Notifikasi browser aktif! Tes notifikasi telah dikirim ke perangkat Anda.');
    } else {
      const res = await requestNotificationPermission();
      if (res.granted) {
        setIsPushEnabled(true);
        alert('Notifikasi pengingat sesi presensi berhasil diaktifkan!');
      } else {
        alert('Izin notifikasi tidak diizinkan oleh browser.');
      }
    }
  };

  // Generate Token Otomatis
  const generateRandomToken = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let res = 'GENBI-';
    for (let i = 0; i < 6; i++) {
      res += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setNewToken(res);
  };

  // Submit Acara Baru
  const handleCreateEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim() || !newToken.trim()) return;

    setIsSubmittingEvent(true);
    const eventPayload: any = {
      title: newTitle.trim(),
      category: newCategory,
      event_date: newDate ? new Date(newDate).toISOString() : new Date().toISOString(),
      points: Number(newPoints),
      qr_token: newToken.trim().toUpperCase(),
      is_active: true,
      require_location: requireLocation,
      target_lat: -6.8362, // Kampus UNMA Majalengka
      target_lng: 108.2275,
      radius_meters: Number(targetRadius),
    };

    try {
      const result = await saveOrUpdateEvent(eventPayload);
      setEvents((prev) => [result.event, ...prev.filter((ev) => ev.id !== result.event.id)]);
      setShowCreateModal(false);
      setNewTitle('');
      setNewToken('');
      setRequireLocation(false);

      recordAuditLog({
        actorName: user.fullName,
        actorRole: 'BPH / Administrator',
        actionType: 'EVENT_CREATE',
        target: newTitle.trim(),
        description: `Membuat agenda baru "${newTitle.trim()}" kategori ${newCategory} (+${newPoints} Poin).`,
      });

      alert(`Sesi kegiatan "${newTitle}" berhasil dibuat dan sesi presensi aktif!`);
    } catch (err: any) {
      alert('Gagal membuat acara: ' + (err.message || 'Terjadi kesalahan sistem'));
    } finally {
      setIsSubmittingEvent(false);
    }
  };

  // Presensi Mandiri Akun BPH (1-Klik Hadir Langsung - Sinkron 100% ke Seluruh Halaman)
  const handleSelfAttendanceBph = async (ev: EventType) => {
    if (bphAttendedEventIds.includes(ev.id)) {
      alert(`Anda sudah tercatat hadir pada kegiatan "${ev.title}".`);
      return;
    }

    const confirmAtt = window.confirm(
      `Konfirmasi Presensi BPH:\n\n` +
      `Nama: ${user.fullName} (BPH)\n` +
      `Kegiatan: ${ev.title}\n` +
      `Bobot Poin: +${ev.points || 15} Poin\n\n` +
      `Catat kehadiran mandiri Anda sekarang?`
    );
    if (!confirmAtt) return;

    setIsSubmittingBphAtt(true);
    try {
      const cleanUserNpm = normalizeStudentId(user.npm || user.nim || '');
      
      // Catat presensi secara terpadu ke Supabase, storage personal, shared cache, dan overrides
      const attRecord = await recordUnifiedAttendance({
        eventId: ev.id,
        userId: user.id,
        userFullName: user.fullName,
        userNpm: cleanUserNpm,
        userDivision: user.division || 'BPH',
        userRole: user.role || 'admin',
        eventTitle: ev.title,
        eventPoints: ev.points || 15,
        eventCategory: ev.category,
        eventDate: ev.event_date,
        status: 'hadir',
        verified: true,
      });

      // 1. Update state bphAttendedEventIds
      setBphAttendedEventIds((prev) => Array.from(new Set([...prev, ev.id])));

      // 2. Update evaluasi poin BPH di tabel Leaderboard
      setEvaluations((prev) => {
        const nextList = prev.map((item) => {
          if (
            item.user_id === user.id ||
            normalizeStudentId(item.npm || item.nim) === cleanUserNpm
          ) {
            const nextHadir = (item.total_hadir || 0) + 1;
            const nextPoints = (item.total_points || 0) + (ev.points || 15);
            const nextPredicate: any =
              nextPoints >= 80 ? 'Sangat Aktif' : nextPoints >= 60 ? 'Aktif' : 'Perlu Pembinaan';
            return {
              ...item,
              total_hadir: nextHadir,
              total_points: nextPoints,
              attendance_percentage: Math.min(100, Math.round((nextHadir / Math.max(1, events.length)) * 100)),
              predicate: nextPredicate,
            };
          }
          return item;
        });
        return nextList.sort((a, b) => (b.total_points || 0) - (a.total_points || 0));
      });

      // 3. Jika modal detail peserta kegiatan sedang terbuka untuk acara ini, tambahkan seketika
      if (selectedEventForParticipants && selectedEventForParticipants.id === ev.id) {
        setParticipants((prev) => {
          const exists = prev.some((p) => p.user_id === user.id || normalizeStudentId(p.npm || p.nim) === cleanUserNpm);
          if (exists) return prev;
          return [
            {
              id: attRecord.id,
              user_id: user.id,
              status: 'hadir',
              verified: true,
              scanned_at: attRecord.scanned_at,
              full_name: user.fullName,
              npm: cleanUserNpm,
              nim: cleanUserNpm,
              division: user.division || 'BPH',
            },
            ...prev,
          ];
        });
      }

      alert(`✓ Presensi Mandiri BPH Berhasil!\n\nNama: ${user.fullName}\nKegiatan: ${ev.title}\nPoin Diperoleh: +${ev.points || 15} Poin.\nData tersinkronisasi 100% ke Riwayat Kartu Anggota dan Leaderboard.`);
    } catch (err: any) {
      alert('Gagal mencatat presensi BPH: ' + (err.message || 'Terjadi kesalahan sistem'));
    } finally {
      setIsSubmittingBphAtt(false);
    }
  };

  // Buka Modal Edit Acara
  const handleOpenEditEvent = (ev: EventType) => {
    setEditingEvent(ev);
    setEditEventTitle(ev.title);
    setEditEventCategory(ev.category);
    setEditEventDate(toDatetimeLocalWIB(ev.event_date));
    setEditEventPoints(ev.points || 15);
    setEditEventToken(ev.qr_token || '');
    setEditEventRequireLocation(ev.require_location || false);
    setEditEventRadius(ev.radius_meters || 250);
    setShowEditEventModal(true);
  };

  // Simpan Perubahan Edit Acara
  const handleUpdateEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingEvent || !editEventTitle.trim() || !editEventToken.trim()) return;

    setIsUpdatingEvent(true);
    const updatedPayload = {
      title: editEventTitle.trim(),
      category: editEventCategory,
      event_date: editEventDate ? new Date(editEventDate).toISOString() : editingEvent.event_date,
      points: Number(editEventPoints),
      qr_token: editEventToken.trim().toUpperCase(),
      require_location: editEventRequireLocation,
      radius_meters: Number(editEventRadius),
    };

    try {
      const result = await saveOrUpdateEvent({ id: editingEvent.id, ...updatedPayload });
      setEvents((prev) =>
        prev.map((ev) => (ev.id === editingEvent.id ? result.event : ev))
      );
      setShowEditEventModal(false);
      setEditingEvent(null);
      alert(`Agenda "${editEventTitle}" berhasil diperbarui!`);
    } catch (err: any) {
      alert('Gagal memperbarui acara: ' + (err.message || 'Terjadi kesalahan'));
    } finally {
      setIsUpdatingEvent(false);
    }
  };

  // Hapus Acara
  const handleDeleteEvent = async (eventId: string, title: string) => {
    if (!confirm(`Hapus agenda "${title}"?\n\nPERINGATAN: Seluruh riwayat presensi yang terkait dengan agenda ini juga akan ikut terhapus.`)) return;

    try {
      await deleteEventPermanently(eventId);
      setEvents((prev) => prev.filter((ev) => ev.id !== eventId));
      recordAuditLog({
        actorName: user.fullName,
        actorRole: 'BPH / Administrator',
        actionType: 'EVENT_DELETE',
        target: title,
        description: `Menghapus agenda kegiatan "${title}" secara permanen dari sistem.`,
      });
      alert(`Agenda "${title}" berhasil dihapus.`);
    } catch (err: any) {
      alert('Gagal menghapus acara: ' + err.message);
    }
  };

  // Buka Modal Edit SK Whitelist
  const handleOpenEditWhitelist = (item: {
    npm: string;
    nim?: string;
    full_name: string;
    division: Division;
    role: Role;
    is_claimed: boolean;
  }) => {
    setEditingWhitelist(item);
    setEditWhiteFullName(item.full_name);
    setEditWhiteDivision(item.division);
    setEditWhiteRole(item.role);
    setShowEditWhitelistModal(true);
  };

  // Simpan Perubahan SK Whitelist
  const handleUpdateWhitelist = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingWhitelist || !editWhiteFullName.trim()) {
      alert('Nama Lengkap tidak boleh kosong!');
      return;
    }

    setIsUpdatingWhitelist(true);
    const cleanTargetId = normalizeStudentId(editingWhitelist.npm || editingWhitelist.nim);
    const updatedPayload = {
      full_name: editWhiteFullName.trim(),
      division: editWhiteDivision,
      role: editWhiteRole,
    };

    // 1. Perbarui state whitelist secara instan di UI
    setWhitelistMembers((prev) =>
      prev.map((m) => {
        const mId = normalizeStudentId(m.npm || m.nim);
        if (mId === cleanTargetId) {
          return {
            ...m,
            ...updatedPayload,
          };
        }
        return m;
      })
    );

    // 2. Perbarui state Rekap Keaktifan (Evaluations / Leaderboard) secara instan di UI
    setEvaluations((prev) =>
      prev.map((ev) => {
        const evId = normalizeStudentId(ev.npm || ev.nim);
        if (evId === cleanTargetId) {
          return {
            ...ev,
            full_name: editWhiteFullName.trim(),
            division: editWhiteDivision,
            role: editWhiteRole,
          };
        }
        return ev;
      })
    );

    // 3. Sinkronisasikan secara menyeluruh ke Database Supabase, LocalStorage, dan Session
    await syncMemberUpdate({
      npm: cleanTargetId,
      nim: editingWhitelist.nim,
      fullName: editWhiteFullName.trim(),
      division: editWhiteDivision,
      role: editWhiteRole,
    });

    setShowEditWhitelistModal(false);
    setEditingWhitelist(null);
    setIsUpdatingWhitelist(false);
    alert(`Data SK untuk ${editWhiteFullName} berhasil diperbarui & disinkronkan ke seluruh sistem!`);
  };

  // Hapus / Batalkan Pengajuan Izin
  const handleDeleteIzin = async (id: string, memberName: string) => {
    if (!confirm(`Hapus / batalkan pengajuan izin dari ${memberName}?`)) return;

    if (user.id.startsWith('demo-')) {
      setPendingIzin(pendingIzin.filter((p) => p.id !== id));
      alert('Pengajuan izin dihapus (Mode Demo).');
      return;
    }

    try {
      const { error } = await supabase.from('attendances').delete().eq('id', id);
      if (error) throw error;
      setPendingIzin(pendingIzin.filter((p) => p.id !== id));
      alert('Pengajuan izin berhasil dihapus.');
      loadAdminData();
    } catch (err: any) {
      alert('Gagal menghapus izin: ' + err.message);
    }
  };

  // Hapus Presensi Peserta pada Kegiatan Tertentu
  const handleDeleteParticipant = async (attendanceId: string, memberName: string) => {
    if (!confirm(`Hapus riwayat presensi untuk "${memberName}" pada agenda ini?`)) return;

    try {
      // 1. Jalankan fungsi hapus terpadu (Supabase, blacklist lokal, cache all_attendances & user sessions)
      await deleteAttendanceRecord(attendanceId, selectedEventForParticipants?.id);

      // 2. Perbarui state peserta saat ini
      setParticipants((prev) => prev.filter((p) => p.id !== attendanceId));

      // 3. Kurangi poin peserta di tabel evaluasi secara instan
      const eventPoints = selectedEventForParticipants?.points || 10;
      setEvaluations((prev) =>
        prev.map((ev) => {
          const matched = participants.find((p) => p.id === attendanceId);
          if (matched && (ev.npm === matched.npm || ev.nim === matched.npm)) {
            const nextPts = Math.max(0, (ev.total_points || 0) - eventPoints);
            const nextHadir = Math.max(0, (ev.total_hadir || 1) - 1);
            return {
              ...ev,
              total_points: nextPts,
              total_hadir: nextHadir,
            };
          }
          return ev;
        })
      );

      alert(`Presensi untuk ${memberName} berhasil dihapus dari sistem!`);
      loadAdminData();
    } catch (err: any) {
      alert('Gagal menghapus presensi: ' + err.message);
    }
  };

  // Presensi Manual Anggota oleh Admin
  const handleAddManualAttendance = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedEventForParticipants || !manualMemberNpm.trim()) {
      alert('Pilih atau masukkan NPM anggota!');
      return;
    }

    setIsSubmittingManualAtt(true);
    const targetNpm = manualMemberNpm.trim();

    try {
      const { data: profData } = await supabase
        .from('profiles')
        .select('id, full_name, npm, nim, division')
        .or(`npm.eq.${targetNpm},nim.eq.${targetNpm}`)
        .maybeSingle();

      let targetUserId = profData?.id;
      let targetName = profData?.full_name;
      let targetDiv = profData?.division || 'Publikasi dan Sosialisasi';

      if (!targetUserId) {
        const { data: authData } = await (supabase.from('authorized_members') as any)
          .select('*')
          .or(`npm.eq.${targetNpm},nim.eq.${targetNpm}`)
          .maybeSingle();

        if (authData) {
          throw new Error(`Anggota ${authData.full_name} (${targetNpm}) belum mengaktifkan akun di SIMAK GENBI. Harap aktivasi akun terlebih dahulu.`);
        } else {
          throw new Error(`NPM "${targetNpm}" tidak ditemukan dalam daftar anggota resmi!`);
        }
      }

      // Catat presensi secara terpadu agar langsung tersinkronisasi ke kartu anggota & leaderboard
      await recordUnifiedAttendance({
        eventId: selectedEventForParticipants.id,
        userId: targetUserId,
        userFullName: targetName || 'Anggota GenBI',
        userNpm: targetNpm,
        userDivision: targetDiv,
        userRole: 'member',
        eventTitle: selectedEventForParticipants.title,
        eventPoints: selectedEventForParticipants.points || 15,
        eventCategory: selectedEventForParticipants.category,
        eventDate: selectedEventForParticipants.event_date,
        status: 'hadir',
        verified: true,
      });

      const newPart: EventParticipant = {
        id: 'att-' + Date.now(),
        user_id: targetUserId,
        status: 'hadir',
        verified: true,
        scanned_at: new Date().toISOString(),
        full_name: targetName || 'Anggota GenBI',
        npm: targetNpm,
        nim: targetNpm,
        division: targetDiv,
      };

      setParticipants([newPart, ...participants]);
      setShowManualAttendanceModal(false);
      setManualMemberNpm('');
      alert(`Berhasil mencatat presensi manual untuk ${targetName}!`);
      loadAdminData();
      loadAdminData();
    } catch (err: any) {
      alert(err.message || 'Gagal menambahkan presensi manual.');
    } finally {
      setIsSubmittingManualAtt(false);
    }
  };

  // Share Agenda ke WhatsApp Broadcast Resmi
  const handleShareWhatsApp = (ev: EventType) => {
    const dateFormatted = formatDateTimeWIB(ev.event_date);
    const locationText = ev.require_location
      ? 'Kampus Universitas Majalengka (Wajib Presensi GPS di Lokasi)'
      : 'Kampus Universitas Majalengka';

    const text = `📢 *PENGUMUMAN KEGIATAN GENBI UNMA* 📢\n\n📌 *Acara*: ${ev.title}\n📂 *Kategori*: ${ev.category}\n🕒 *Waktu*: ${dateFormatted}\n📍 *Lokasi*: ${locationText}\n🎖️ *Bobot Poin*: +${ev.points} Poin Keaktifan\n🔑 *Kode Token Presensi*: ${ev.qr_token}\n\nMohon seluruh rekan-rekan penerima beasiswa Bank Indonesia hadir tepat waktu dan mengisi presensi via SIMAK GENBI:\n👉 ${window.location.origin}\n\n#GenBIUNMA #EnergiUntukNegeri #BankIndonesia`;

    window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`, '_blank');
  };

  // Setujui Izin / Delegasi dengan Broadcast Realtime ke HP Anggota
  const handleApproveIzin = async (id: string, isDelegasi = false) => {
    // 1. Eksekusi sinkronisasi terpadu (+30 poin jika delegasi, update riwayat personal dan leaderboard)
    await approveAttendanceSync(id, isDelegasi);

    if (user.id.startsWith('demo-') || id.startsWith('delegasi-') || id.startsWith('izin-')) {
      setPendingIzin(pendingIzin.filter((p) => p.id !== id));
      alert(
        isDelegasi
          ? 'Tugas delegasi BI disetujui (+30 Poin ditambahkan & disiarkan realtime ke HP anggota)!'
          : 'Dispensasi izin disetujui (Disiarkan realtime ke HP anggota)!'
      );
      loadAdminData();
      return;
    }

    try {
      await (supabase.from('attendances') as any).update({ verified: true }).eq('id', id);
      setPendingIzin(pendingIzin.filter((p) => p.id !== id));
      const approvedTarget = pendingIzin.find((p) => p.id === id);
      recordAuditLog({
        actorName: user.fullName,
        actorRole: 'BPH / Administrator',
        actionType: isDelegasi ? 'DELEGASI_APPROVE' : 'IZIN_APPROVE',
        target: approvedTarget?.member_name || id,
        description: isDelegasi
          ? `Menyetujui tugas delegasi Bank Indonesia untuk ${approvedTarget?.member_name || id} (+30 Poin).`
          : `Menyetujui dispensasi izin kegiatan untuk ${approvedTarget?.member_name || id}.`,
      });

      alert(
        isDelegasi
          ? 'Tugas delegasi Bank Indonesia resmi disetujui (+30 Poin ditambahkan & disiarkan realtime ke HP anggota)!'
          : 'Permohonan izin resmi disetujui & disinkronkan ke HP anggota.'
      );
      loadAdminData();
    } catch (err: any) {
      alert('Gagal memverifikasi izin: ' + err.message);
    }
  };

  // Tolak Izin dengan Catatan Alasan dari BPH
  const handleRejectIzin = async () => {
    if (!rejectAttendanceId) return;
    if (!rejectionReason.trim()) {
      alert('Berikan alasan penolakan izin (contoh: surat tidak valid / tidak ada tanda tangan dokter).');
      return;
    }

    if (user.id.startsWith('demo-')) {
      setPendingIzin(pendingIzin.filter((p) => p.id !== rejectAttendanceId));
      setRejectAttendanceId(null);
      setRejectionReason('');
      alert('Pengajuan izin ditolak dan dicatat (Mode Demo).');
      return;
    }

    setIsSubmittingRejection(true);
    try {
      await (supabase.from('attendances') as any)
        .update({
          status: 'alfa',
          verified: false,
          rejection_reason: rejectionReason.trim(),
        })
        .eq('id', rejectAttendanceId);

      setPendingIzin(pendingIzin.filter((p) => p.id !== rejectAttendanceId));
      setRejectAttendanceId(null);
      setRejectionReason('');
      alert('Pengajuan izin ditolak. Status kehadiran diubah menjadi Alfa.');
      loadAdminData();
    } catch (err: any) {
      alert('Gagal menolak izin: ' + err.message);
    } finally {
      setIsSubmittingRejection(false);
    }
  };

  // Export Rekapitulasi LPJ Format Baku Bank Indonesia (Excel / CSV dengan UTF-8 BOM)
  const handleExportCSV = () => {
    if (evaluations.length === 0) {
      alert('Tidak ada data rekap untuk diekspor.');
      return;
    }

    const headers = [
      'No',
      'NPM',
      'Nama Lengkap Sesuai SK',
      'Divisi',
      'Jabatan / Amanah',
      'Total Hadir',
      'Total Izin',
      'Total Alfa',
      'Persentase Kehadiran (%)',
      'Total Poin Keaktifan',
      'Predikat Keaktifan',
      'Rekomendasi Kelayakan Beasiswa',
    ];

    const rows = evaluations.map((m, index) => {
      const studentId = m.npm || m.nim || '-';
      const roleName =
        m.role === 'admin'
          ? 'BPH / Pengurus Harian'
          : m.role === 'kadiv'
          ? 'Kepala Divisi (Kadiv)'
          : 'Anggota';

      let rekomendasi = 'PERLU EVALUASI & PEMBINAAN BPH';
      if (m.predicate === 'Sangat Aktif' || m.total_points >= 80) {
        rekomendasi = 'SANGAT DIREKOMENDASIKAN (Pertahankan Beasiswa)';
      } else if (m.predicate === 'Aktif' || m.total_points >= 60) {
        rekomendasi = 'DIREKOMENDASIKAN (Lanjut Beasiswa)';
      }

      return [
        index + 1,
        `"${studentId}"`,
        `"${m.full_name}"`,
        `"${m.division}"`,
        `"${roleName}"`,
        m.total_hadir,
        m.total_izin,
        m.total_alfa,
        `"${m.attendance_percentage}%"`,
        m.total_points,
        `"${m.predicate}"`,
        `"${rekomendasi}"`,
      ];
    });

    const metadataLines = [
      'LAPORAN PERTANGGUNGJAWABAN (LPJ) EVALUASI KEAKTIFAN PENERIMA BEASISWA BANK INDONESIA',
      'KOMUNITAS GENERASI BARU INDONESIA (GenBI) KOMISARIAT UNIVERSITAS MAJALENGKA',
      `Tanggal Dokumen : ${new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}`,
      `Total Penerima Beasiswa Terdaftar : ${evaluations.length} Mahasiswa`,
      '',
    ];

    const csvContent =
      '\uFEFF' +
      metadataLines.join('\n') +
      '\n' +
      [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute(
      'download',
      `LPJ_KEAKTIFAN_GENBI_UNMA_BI_${new Date().toISOString().split('T')[0]}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const filteredEvaluations = evaluations.filter((ev) => {
    const studentId = ev.npm || ev.nim || '';
    const matchesSearch =
      ev.full_name.toLowerCase().includes(searchMember.toLowerCase()) ||
      studentId.toLowerCase().includes(searchMember.toLowerCase()) ||
      ev.division.toLowerCase().includes(searchMember.toLowerCase());

    const matchesDivision =
      selectedDivisionFilter === 'Semua' || ev.division === selectedDivisionFilter;

    return matchesSearch && matchesDivision;
  });

  const activeEventsCount = events.filter((e) => e.is_active).length;

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 flex flex-col items-center relative overflow-x-hidden">
      {/* Background Ambient Grid & Radial Glow */}
      <div className="fixed inset-0 pointer-events-none -z-10">
        <div className="absolute inset-0 bg-[radial-gradient(#cbd5e1_1px,transparent_1px)] [background-size:24px_24px] opacity-40" />
        <div className="absolute top-0 right-0 w-96 h-96 rounded-full bg-blue-600/15 blur-3xl animate-pulse" />
        <div className="absolute bottom-0 left-0 w-96 h-96 rounded-full bg-indigo-500/15 blur-3xl" />
      </div>

      <div className="w-full max-w-7xl min-h-screen flex flex-col pb-20">
        {/* Sticky Header BPH */}
        <header className="sticky top-0 z-30 px-3 sm:px-8 py-3 sm:py-4 bg-white/95 backdrop-blur-xl border-b border-slate-200/80 shadow-xs flex items-center justify-between">
          <div className="flex items-center gap-2.5 sm:gap-3">
            <div className="w-9 h-9 sm:w-11 sm:h-11 rounded-xl sm:rounded-2xl bg-white p-1 shadow-xs border border-slate-200 flex items-center justify-center shrink-0">
              <img
                src="/logo-genbi.png"
                alt="Logo GenBI UNMA"
                className="w-full h-full object-contain"
              />
            </div>
            <div>
              <div className="flex items-center gap-1.5 sm:gap-2">
                <span className="font-black text-base sm:text-lg tracking-tight text-slate-900">SIMAK</span>
                <span className="font-black text-base sm:text-lg tracking-tight bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
                  GENBI
                </span>
                <span className="px-1.5 py-0.5 rounded-md bg-blue-50 text-blue-700 font-black text-[10px] tracking-wider border border-blue-200">
                  BPH
                </span>
              </div>
              <p className="text-[9px] sm:text-[10px] text-slate-400 font-bold tracking-wider uppercase leading-none hidden xs:block">
                Komisariat UNMA &bull; KPw BI Cirebon
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2.5">
            {/* Tombol Lonceng Notifikasi PWA */}
            <button
              onClick={handleTogglePushNotification}
              className={`p-2 sm:px-3 sm:py-1.5 rounded-xl border text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
                isPushEnabled
                  ? 'bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border-emerald-200'
                  : 'bg-slate-100 hover:bg-blue-50 text-slate-700 hover:text-blue-700 border-slate-200'
              }`}
              title={isPushEnabled ? 'Notifikasi PWA Aktif (Klik untuk kirim tes)' : 'Aktifkan Pengingat Notifikasi Presensi'}
            >
              <Bell className={`w-3.5 h-3.5 ${isPushEnabled ? 'text-emerald-600' : 'text-slate-500'}`} />
              <span className="hidden md:inline">{isPushEnabled ? 'Notifikasi Aktif' : 'Notifikasi'}</span>
            </button>

            {onSwitchToMemberView && (
              <button
                onClick={onSwitchToMemberView}
                className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-xl bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 text-xs font-bold transition cursor-pointer"
                title="Lihat Tampilan Anggota"
              >
                <Users className="w-3.5 h-3.5 shrink-0" />
                <span className="hidden sm:inline">Tampilan Anggota</span>
                <span className="sm:hidden text-[11px] font-bold">Anggota</span>
              </button>
            )}
            <div className="hidden lg:flex flex-col text-right">
              <span className="text-xs font-bold text-slate-800">{user.fullName}</span>
              <span className="text-[10px] text-slate-400 font-medium">BPH Komisariat</span>
            </div>
            <button
              onClick={onLogout}
              className="p-2 sm:px-3 sm:py-1.5 rounded-xl bg-slate-100 hover:bg-rose-50 text-slate-600 hover:text-rose-600 border border-slate-200 text-xs font-bold transition cursor-pointer flex items-center gap-1.5"
              title="Keluar"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Keluar</span>
            </button>
          </div>
        </header>

        {/* Content Body */}
        <main className="p-4 sm:p-6 lg:p-8 space-y-6">
          {/* Header KPI Stats Banner */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5 sm:gap-4">
            <div className="p-4 sm:p-5 rounded-2xl bg-white/95 backdrop-blur-md border border-slate-200/80 shadow-xs flex items-center gap-3.5">
              <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0 border border-blue-100">
                <Calendar className="w-6 h-6" />
              </div>
              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                  Total Agenda
                </span>
                <span className="text-2xl sm:text-3xl font-black text-slate-900 leading-tight">
                  {events.length}
                </span>
              </div>
            </div>

            <div className="p-4 sm:p-5 rounded-2xl bg-white/95 backdrop-blur-md border border-slate-200/80 shadow-xs flex items-center gap-3.5">
              <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0 border border-emerald-100">
                <QrCode className="w-6 h-6" />
              </div>
              <div>
                <span className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider block">
                  Sesi Terbuka
                </span>
                <span className="text-2xl sm:text-3xl font-black text-emerald-600 leading-tight">
                  {activeEventsCount}
                </span>
              </div>
            </div>

            <div className="p-4 sm:p-5 rounded-2xl bg-white/95 backdrop-blur-md border border-slate-200/80 shadow-xs flex items-center gap-3.5">
              <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0 border border-indigo-100">
                <Users className="w-6 h-6" />
              </div>
              <div>
                <span className="text-[10px] font-bold text-indigo-600 uppercase tracking-wider block">
                  Anggota Terdaftar
                </span>
                <span className="text-2xl sm:text-3xl font-black text-indigo-900 leading-tight">
                  {evaluations.length}
                </span>
              </div>
            </div>

            <div className="p-4 sm:p-5 rounded-2xl bg-white/95 backdrop-blur-md border border-slate-200/80 shadow-xs flex items-center gap-3.5">
              <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0 border border-amber-100">
                <Clock className="w-6 h-6" />
              </div>
              <div>
                <span className="text-[10px] font-bold text-amber-600 uppercase tracking-wider block">
                  Verifikasi Tertunda
                </span>
                <span className="text-2xl sm:text-3xl font-black text-amber-600 leading-tight">
                  {pendingIzin.length}
                </span>
              </div>
            </div>
          </div>

          {/* Bar Periode Kepengurusan & Arsip Multi-Semester (Responsive Mobile) */}
          <div className="p-3 sm:p-4 bg-white/95 backdrop-blur-md border border-slate-200/80 rounded-2xl shadow-xs space-y-2.5 sm:space-y-0 sm:flex sm:items-center sm:justify-between sm:gap-4">
            <div className="flex items-center justify-between sm:justify-start gap-2">
              <div className="flex items-center gap-1.5 text-slate-700 font-extrabold text-xs">
                <CalendarDays className="w-4 h-4 text-blue-600 shrink-0" />
                <span className="uppercase text-[10px] sm:text-xs tracking-wider text-slate-500 sm:text-slate-700 font-black">
                  Periode Kepengurusan:
                </span>
              </div>
              
              {/* Badge Status di Mobile */}
              <div className="sm:hidden">
                {(() => {
                  const matched = academicPeriods.find((p) => p.name === selectedSemester);
                  const isCurrentActive = matched ? matched.isActive : selectedSemester.includes('Aktif');
                  return (
                    <span
                      className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase ${
                        isCurrentActive
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          : 'bg-amber-50 text-amber-700 border border-amber-200'
                      }`}
                    >
                      {isCurrentActive ? 'Aktif' : 'Demisioner'}
                    </span>
                  );
                })()}
              </div>
            </div>

            <div className="flex items-center gap-2.5 w-full sm:w-auto">
              <select
                value={selectedSemester}
                onChange={(e) => setSelectedSemester(e.target.value)}
                className="w-full sm:w-auto px-3 py-1.5 text-xs font-bold border border-slate-200 rounded-xl bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-600/30 cursor-pointer shadow-xs"
              >
                {academicPeriods.map((p) => (
                  <option key={p.id} value={p.name}>
                    {p.name} {p.isActive ? '(Periode Aktif)' : '(Arsip Demisioner)'}
                  </option>
                ))}
              </select>

              {/* Badge Status di Desktop */}
              <div className="hidden sm:block shrink-0">
                {(() => {
                  const matched = academicPeriods.find((p) => p.name === selectedSemester);
                  const isCurrentActive = matched ? matched.isActive : selectedSemester.includes('Aktif');
                  return (
                    <span
                      className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase ${
                        isCurrentActive
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          : 'bg-amber-50 text-amber-700 border border-amber-200'
                      }`}
                    >
                      {isCurrentActive ? 'Kepengurusan Aktif' : 'Arsip Demisioner'}
                    </span>
                  );
                })()}
              </div>
            </div>
          </div>

          {/* Banner Peringatan Saat Meninjau Arsip Demisioner */}
          {(() => {
            const matched = academicPeriods.find((p) => p.name === selectedSemester);
            const isCurrentActive = matched ? matched.isActive : selectedSemester.includes('Aktif');
            if (!isCurrentActive) {
              return (
                <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-300 text-amber-900 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2 shadow-xs">
                  <div className="flex items-center gap-2 font-bold">
                    <CalendarDays className="w-4 h-4 text-amber-600 shrink-0" />
                    <span>Anda sedang meninjau arsip historis kepengurusan {selectedSemester} (Mode Demisioner).</span>
                  </div>
                  <button
                    onClick={() => {
                      const act = academicPeriods.find((p) => p.isActive);
                      if (act) setSelectedSemester(act.name);
                    }}
                    className="self-start sm:self-center px-3 py-1 rounded-xl bg-amber-200 hover:bg-amber-300 text-amber-950 font-black text-[11px] transition cursor-pointer shrink-0"
                  >
                    Kembali ke Periode Aktif
                  </button>
                </div>
              );
            }
            return null;
          })()}

          {/* Navigation Tab */}
          <div className="flex p-1 bg-white/90 backdrop-blur-md border border-slate-200/80 rounded-2xl shadow-xs overflow-x-auto gap-1">
            <button
              onClick={() => setActiveTab('events')}
              className={`flex-1 min-w-[150px] py-2.5 rounded-xl text-xs sm:text-sm font-extrabold flex items-center justify-center gap-2 transition cursor-pointer ${
                activeTab === 'events'
                  ? 'bg-blue-600 text-white shadow-md shadow-blue-600/20'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Calendar className="w-4 h-4" />
              <span>Agenda & Sesi ({events.length})</span>
            </button>

            <button
              onClick={() => setActiveTab('verification')}
              className={`flex-1 min-w-[160px] py-2.5 rounded-xl text-xs sm:text-sm font-extrabold flex items-center justify-center gap-2 transition cursor-pointer ${
                activeTab === 'verification'
                  ? 'bg-blue-600 text-white shadow-md shadow-blue-600/20'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <FileCheck2 className="w-4 h-4" />
              <span>Verifikasi & Rekap</span>
              {pendingIzin.length > 0 && (
                <span className="px-2 py-0.5 rounded-full bg-amber-400 text-slate-950 text-[10px] font-black">
                  {pendingIzin.length}
                </span>
              )}
            </button>

            <button
              onClick={() => setActiveTab('leaderboard')}
              className={`flex-1 min-w-[170px] py-2.5 rounded-xl text-xs sm:text-sm font-extrabold flex items-center justify-center gap-2 transition cursor-pointer ${
                activeTab === 'leaderboard'
                  ? 'bg-blue-600 text-white shadow-md shadow-blue-600/20'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Crown className="w-4 h-4 text-amber-400" />
              <span>Leaderboard & Peringkat</span>
            </button>

            <button
              onClick={() => {
                setActiveTab('whitelist');
                loadWhitelistMembers();
              }}
              className={`flex-1 min-w-[170px] py-2.5 rounded-xl text-xs sm:text-sm font-extrabold flex items-center justify-center gap-2 transition cursor-pointer ${
                activeTab === 'whitelist'
                  ? 'bg-blue-600 text-white shadow-md shadow-blue-600/20'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Users className="w-4 h-4" />
              <span>Whitelist SK Anggota ({whitelistMembers.length})</span>
            </button>
          </div>

          {/* TAB 1: AGENDA & KONTROL SESI PRESENSI */}
          {activeTab === 'events' && (
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h2 className="text-base sm:text-lg font-black text-slate-900 tracking-tight">
                    Kontrol Sesi Presensi Agenda Kegiatan
                  </h2>
                  <p className="text-xs text-slate-500">
                    Kunci sesi presensi jika rapat/kegiatan sudah selesai agar token tidak disalahgunakan.
                  </p>
                </div>
                <button
                  onClick={() => {
                    generateRandomToken();
                    setShowCreateModal(true);
                  }}
                  className="px-4 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-xl text-xs font-black shadow-md shadow-blue-600/25 flex items-center gap-1.5 transition cursor-pointer self-start sm:self-center"
                >
                  <Plus className="w-4 h-4" />
                  <span>Tambah Acara Baru</span>
                </button>
              </div>

              {/* Event Cards atau Empty State Bersih */}
              {events.length === 0 ? (
                <div className="p-10 rounded-[28px] bg-white/80 backdrop-blur-md border border-dashed border-slate-200 text-center space-y-2.5">
                  <CalendarDays className="w-12 h-12 text-slate-300 mx-auto" />
                  <h4 className="text-base font-bold text-slate-700">Belum ada agenda kegiatan dibuat</h4>
                  <p className="text-xs text-slate-400 max-w-sm mx-auto">
                    Klik tombol "Tambah Acara Baru" di atas untuk membuat sesi kegiatan dan menghasilkan token presensi QR resmi.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4.5">
                  {events.map((ev) => {
                    const badgeColor =
                      ev.category === 'Wajib'
                        ? 'bg-rose-50 text-rose-700 border-rose-200'
                        : ev.category === 'Proker'
                        ? 'bg-blue-50 text-blue-700 border-blue-200'
                        : 'bg-amber-50 text-amber-700 border-amber-200';

                    const eventDateStr = formatDateTimeWIB(ev.event_date);
                    const isBphAttended = bphAttendedEventIds.includes(ev.id);

                    return (
                      <div
                        key={ev.id}
                        className={`p-5 rounded-[28px] bg-white/95 backdrop-blur-md border ring-1 shadow-xs transition-all flex flex-col justify-between space-y-4 ${
                          ev.is_active
                            ? 'border-slate-200/80 ring-slate-900/5 hover:shadow-md'
                            : 'border-slate-200 ring-slate-200/50 opacity-80 bg-slate-100/50'
                        }`}
                      >
                        {/* 1. Header & Isi Konten Agenda */}
                        <div className="space-y-3">
                          <div className="flex justify-between items-center gap-2">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className={`px-2.5 py-0.5 rounded-md text-[10px] font-black border ${badgeColor}`}>
                                {ev.category}
                              </span>
                              <span
                                className={`px-2.5 py-0.5 rounded-full text-[10px] font-black border ${
                                  ev.is_active
                                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                    : 'bg-slate-100 text-slate-500 border-slate-200'
                                }`}
                              >
                                {ev.is_active ? '● Sesi Terbuka' : '○ Sesi Terkunci'}
                              </span>
                            </div>

                            <span className="px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200 text-[10px] font-black shrink-0">
                              +{ev.points} Poin
                            </span>
                          </div>

                          <h3 className="text-sm sm:text-base font-extrabold text-slate-900 leading-snug">
                            {ev.title}
                          </h3>

                          <div className="flex items-center gap-1.5 text-xs text-slate-500 font-medium">
                            <Clock className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                            <span>{eventDateStr}</span>
                          </div>

                          {/* Banner Status Presensi Mandiri BPH */}
                          {ev.is_active && (
                            isBphAttended ? (
                              <div className="flex items-center justify-between px-3 py-1.5 rounded-xl bg-emerald-50 border border-emerald-200/80 text-emerald-800 text-xs font-bold">
                                <span className="flex items-center gap-1.5">
                                  <CheckCircle className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                                  <span>Presensi BPH Anda Tercatat</span>
                                </span>
                                <span className="text-[10px] font-black font-mono text-emerald-700 bg-emerald-100/80 px-2 py-0.5 rounded-md">
                                  +{ev.points} P
                                </span>
                              </div>
                            ) : (
                              <button
                                onClick={() => handleSelfAttendanceBph(ev)}
                                disabled={isSubmittingBphAtt}
                                className="w-full flex items-center justify-between px-3 py-1.5 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-200 text-xs font-bold transition cursor-pointer shadow-xs active:scale-[0.99] disabled:opacity-50"
                                title="Catat kehadiran mandiri Anda sebagai BPH untuk agenda ini"
                              >
                                <span className="flex items-center gap-1.5">
                                  <UserCheck className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                                  <span>Presensi Mandiri BPH</span>
                                </span>
                                <span className="px-2 py-0.5 rounded-md bg-amber-500 hover:bg-amber-600 text-white text-[10px] font-black">
                                  +Catat Hadir
                                </span>
                              </button>
                            )
                          )}
                        </div>

                        {/* 2. Footer Aksi Kartu: 2 Baris Presisi & Simetris */}
                        <div className="pt-3 border-t border-slate-100 space-y-2.5">
                          {/* Baris 1: Token QR & Toolbar Icon Sekunder */}
                          <div className="flex items-center justify-between gap-2">
                            <div className="text-[11px] font-mono font-black text-slate-700 bg-slate-100 px-2.5 py-1 rounded-lg border border-slate-200 shrink-0">
                              {ev.qr_token}
                            </div>

                            {/* Toolbar Icon (Gembok, Share WA, Edit, Hapus) */}
                            <div className="flex items-center gap-1 shrink-0">
                              <button
                                onClick={() => handleToggleEventActive(ev.id, ev.is_active)}
                                className={`p-1.5 rounded-lg text-xs font-bold border transition cursor-pointer ${
                                  ev.is_active
                                    ? 'bg-rose-50 text-rose-600 border-rose-200 hover:bg-rose-100'
                                    : 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
                                }`}
                                title={ev.is_active ? 'Kunci sesi presensi' : 'Buka sesi presensi'}
                              >
                                {ev.is_active ? <Lock className="w-3.5 h-3.5" /> : <Unlock className="w-3.5 h-3.5" />}
                              </button>

                              <button
                                onClick={() => handleShareWhatsApp(ev)}
                                className="p-1.5 rounded-lg bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200 transition cursor-pointer"
                                title="Bagikan pengumuman ke WhatsApp Grup"
                              >
                                <Share2 className="w-3.5 h-3.5 text-emerald-600" />
                              </button>

                              <button
                                onClick={() => handleOpenEditEvent(ev)}
                                className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 transition cursor-pointer"
                                title="Edit rincian agenda"
                              >
                                <Pencil className="w-3.5 h-3.5" />
                              </button>

                              <button
                                onClick={() => handleDeleteEvent(ev.id, ev.title)}
                                className="p-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200 transition cursor-pointer"
                                title="Hapus agenda ini"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>

                          {/* Baris 2: Dua Tombol Aksi Utama (Peserta & Tampilkan QR) 50:50 */}
                          <div className="grid grid-cols-2 gap-2">
                            <button
                              onClick={() => handleOpenParticipants(ev)}
                              className="w-full flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold border border-slate-200 transition cursor-pointer"
                              title="Lihat daftar presensi kegiatan ini"
                            >
                              <Eye className="w-3.5 h-3.5 text-slate-500" />
                              <span>Peserta</span>
                            </button>

                            <button
                              onClick={() => {
                                setActiveQrEvent(ev);
                                setIsProjectorMode(false);
                                setShowQrModal(true);
                              }}
                              className="w-full flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-black text-xs shadow-xs transition cursor-pointer active:scale-[0.98]"
                            >
                              <QrCode className="w-3.5 h-3.5" />
                              <span>Tampilkan QR</span>
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* TAB 2: VERIFIKASI IZIN & REKAP KEAKTIFAN */}
          {activeTab === 'verification' && (
            <div className="space-y-6">
              {/* Seksi Verifikasi Izin & Tugas Delegasi BI */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-black text-slate-900 flex items-center gap-2">
                    <Shield className="w-4 h-4 text-blue-600" />
                    <span>Pengajuan Izin & Delegasi Menunggu Verifikasi ({pendingIzin.length})</span>
                  </h3>
                  <span className="text-[11px] text-slate-500 font-medium">
                    Sinkronisasi Realtime Supabase + Cloud Drive
                  </span>
                </div>

                {pendingIzin.length === 0 ? (
                  <div className="p-8 rounded-[24px] bg-white/70 border border-dashed border-slate-200 text-center text-xs text-slate-400">
                    Tidak ada permohonan izin atau presensi delegasi yang sedang menunggu verifikasi.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {pendingIzin.map((izin) => {
                      const isDelegasi = Boolean(izin.isDelegasi || izin.status === 'delegasi');
                      return (
                        <div
                          key={izin.id}
                          className={`p-4 rounded-2xl shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3 border ${
                            isDelegasi
                              ? 'bg-gradient-to-r from-amber-50/70 via-purple-50/40 to-white border-amber-300 ring-1 ring-amber-400/20'
                              : 'bg-white/95 border-amber-200/90'
                          }`}
                        >
                          <div className="space-y-1.5 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              {isDelegasi ? (
                                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-gradient-to-r from-amber-400 to-yellow-500 text-slate-950 font-black text-[10px] tracking-wide uppercase shadow-xs">
                                  <span>⭐</span>
                                  <span>TUGAS DELEGASI BI (Wilayah 9 & 10)</span>
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-blue-100 text-blue-900 font-bold text-[10px]">
                                  <span>Dispensasi Izin</span>
                                </span>
                              )}
                              <span className="text-xs font-black text-slate-900">
                                {izin.member_name}
                              </span>
                              <span className="text-[10px] font-mono text-slate-400">
                                ({izin.member_npm || izin.member_nim})
                              </span>
                            </div>

                            <p className="text-xs font-semibold text-slate-700">
                              {isDelegasi ? (
                                <>
                                  <span className="text-slate-500 font-normal">Agenda: </span>
                                  <span className="text-purple-900 font-bold">
                                    {izin.delegasiData?.title || izin.event_title}
                                  </span>
                                  {izin.delegasiData?.city && (
                                    <span className="ml-1 text-[11px] text-amber-800 font-bold">
                                      &bull; Lokasi: {izin.delegasiData.city}
                                    </span>
                                  )}
                                </>
                              ) : (
                                <>
                                  <span className="text-slate-500 font-normal">Agenda: </span>
                                  {izin.event_title}
                                </>
                              )}
                            </p>

                            {/* Catatan / Keterangan Penugasan */}
                            {izin.delegasiData?.note && (
                              <p className="text-[11px] text-slate-600 bg-white/70 p-2 rounded-xl border border-slate-200/60">
                                <span className="font-bold text-slate-700">Uraian Tugas: </span>
                                {izin.delegasiData.note}
                              </p>
                            )}

                            {/* Baris Lokasi GPS & Bukti Google Drive */}
                            <div className="flex flex-wrap items-center gap-3 pt-0.5">
                              {izin.proof_url && (
                                <a
                                  href={izin.proof_url}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="inline-flex items-center gap-1 text-[11px] font-bold text-blue-600 hover:text-blue-800 hover:underline bg-blue-50 px-2 py-0.5 rounded-lg border border-blue-200/60"
                                >
                                  <span>Lihat Bukti Foto di Google Drive</span>
                                  <ExternalLink className="w-3 h-3" />
                                </a>
                              )}

                              {izin.user_lat && izin.user_lng && (
                                <a
                                  href={`https://www.google.com/maps?q=${izin.user_lat},${izin.user_lng}`}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 hover:text-emerald-900 hover:underline bg-emerald-50 px-2 py-0.5 rounded-lg border border-emerald-200/60"
                                >
                                  <span>📍 GPS: {izin.user_lat.toFixed(4)}, {izin.user_lng.toFixed(4)}</span>
                                  <ExternalLink className="w-3 h-3" />
                                </a>
                              )}
                            </div>
                          </div>

                          <div className="flex items-center gap-2 self-start sm:self-center shrink-0">
                            <button
                              onClick={() => handleDeleteIzin(izin.id, izin.member_name)}
                              className="p-2 rounded-xl text-slate-400 hover:text-rose-600 hover:bg-rose-50 border border-transparent hover:border-rose-200 transition cursor-pointer"
                              title="Hapus permohonan"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>

                            <button
                              onClick={() => {
                                setRejectAttendanceId(izin.id);
                                setRejectionReason('');
                              }}
                              className="flex items-center gap-1 px-3 py-2 bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200 rounded-xl text-xs font-bold transition cursor-pointer"
                            >
                              <XCircle className="w-3.5 h-3.5" />
                              <span>Tolak</span>
                            </button>

                            <button
                              onClick={() => handleApproveIzin(izin.id, isDelegasi)}
                              className={`px-4 py-2 rounded-xl text-xs font-black shadow-sm flex items-center justify-center gap-1.5 transition cursor-pointer active:scale-[0.98] ${
                                isDelegasi
                                  ? 'bg-gradient-to-r from-amber-400 via-amber-500 to-yellow-500 text-slate-950 hover:from-amber-500 hover:to-yellow-600 shadow-amber-500/20'
                                  : 'bg-emerald-600 hover:bg-emerald-700 text-white'
                              }`}
                            >
                              {isDelegasi ? <Award className="w-3.5 h-3.5" /> : <CheckCircle className="w-3.5 h-3.5" />}
                              <span>{isDelegasi ? 'Setujui Delegasi (+30 P)' : 'Setujui Izin'}</span>
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Seksi Rekap Keaktifan Seluruh Anggota */}
              <div className="space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <h3 className="text-sm font-black text-slate-900 flex items-center gap-2">
                      <Users className="w-4 h-4 text-blue-600" />
                      <span>Rekap Keaktifan Anggota ({evaluations.length})</span>
                    </h3>
                    <p className="text-xs text-slate-500">Evaluasi otomatis dari seluruh presensi agenda & proker</p>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    {/* Filter Divisi */}
                    <div className="flex items-center gap-1">
                      <Filter className="w-3.5 h-3.5 text-slate-400" />
                      <select
                        value={selectedDivisionFilter}
                        onChange={(e) => setSelectedDivisionFilter(e.target.value)}
                        className="px-2.5 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-600/30"
                      >
                        {ALL_DIVISIONS.map((d) => (
                          <option key={d} value={d}>
                            {d}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="relative">
                      <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400" />
                      <input
                        type="text"
                        value={searchMember}
                        onChange={(e) => setSearchMember(e.target.value)}
                        placeholder="Cari nama/NPM..."
                        className="pl-8 pr-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-blue-600/30"
                      />
                    </div>

                    <button
                      onClick={handleExportCSV}
                      className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black flex items-center gap-1.5 shadow-sm transition cursor-pointer"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>Export CSV</span>
                    </button>
                  </div>
                </div>

                {/* Tabel Rekap atau Empty State */}
                {evaluations.length === 0 ? (
                  <div className="p-8 rounded-[24px] border border-dashed border-slate-200 bg-white/70 text-center text-xs text-slate-400">
                    Belum ada anggota terdaftar di sistem SIMAK GENBI.
                  </div>
                ) : (
                  <div className="overflow-x-auto rounded-[24px] border border-slate-200/80 bg-white/95 shadow-xs">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="bg-slate-50/90 text-slate-500 border-b border-slate-200">
                          <th className="py-3 px-3.5 font-bold">Anggota</th>
                          <th className="py-3 px-3 font-bold">Divisi</th>
                          <th className="py-3 px-3 font-bold text-center">Hadir</th>
                          <th className="py-3 px-3 font-bold text-center">Izin</th>
                          <th className="py-3 px-3 font-bold text-center">Alfa</th>
                          <th className="py-3 px-3 font-bold text-right">Poin</th>
                          <th className="py-3 px-3.5 font-bold text-center">Predikat</th>
                          <th className="py-3 px-3 font-bold text-center">Rapor BI</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {filteredEvaluations.map((m) => {
                          const predColor =
                            m.predicate === 'Sangat Aktif'
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                              : m.predicate === 'Aktif'
                              ? 'bg-blue-50 text-blue-700 border-blue-200'
                              : m.predicate === 'Perlu Pembinaan'
                              ? 'bg-rose-50 text-rose-700 border-rose-200'
                              : 'bg-amber-50 text-amber-700 border-amber-200';

                          return (
                            <tr key={m.user_id} className="hover:bg-slate-50/70 transition">
                              <td className="py-2.5 px-3.5">
                                <div className="flex items-center gap-1.5">
                                  <span className="font-extrabold text-slate-900 block">{m.full_name}</span>
                                  {m.role === 'kadiv' && (
                                    <span className="inline-flex items-center gap-0.5 px-1.5 py-0.2 bg-amber-100 text-amber-900 border border-amber-300 rounded text-[9px] font-black">
                                      <Crown className="w-2.5 h-2.5 text-amber-700" />
                                      Kadiv
                                    </span>
                                  )}
                                </div>
                                <span className="font-mono text-[10px] text-slate-400">{m.npm || m.nim}</span>
                              </td>
                              <td className="py-2.5 px-3 font-medium text-slate-600">{m.division}</td>
                              <td className="py-2.5 px-3 text-center font-bold text-slate-800">
                                {m.total_hadir}
                              </td>
                              <td className="py-2.5 px-3 text-center text-slate-600">{m.total_izin}</td>
                              <td className="py-2.5 px-3 text-center text-slate-600">{m.total_alfa}</td>
                              <td className="py-2.5 px-3 text-right">
                                <span className="font-black text-blue-600">{m.total_points}</span>
                              </td>
                              <td className="py-2.5 px-3.5 text-center">
                                <span className={`px-2 py-0.5 rounded-full text-[10px] font-black border ${predColor}`}>
                                  {m.predicate}
                                </span>
                              </td>
                              <td className="py-2.5 px-3 text-center">
                                <button
                                  type="button"
                                  onClick={() => setSelectedReportMember(m)}
                                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl bg-blue-50 hover:bg-blue-100 text-blue-700 font-bold border border-blue-200 transition cursor-pointer text-[10px]"
                                  title="Cetak Rapor Keaktifan & Rekomendasi Beasiswa BI"
                                >
                                  <Printer className="w-3 h-3 text-blue-600" />
                                  <span>Cetak PDF</span>
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB BARU: LEADERBOARD & PERINGKAT KEAKTIFAN (TOP 3 PODIUM & FULL RANKING) */}
          {activeTab === 'leaderboard' && (
            <div className="space-y-6 animate-in fade-in duration-200">
              {/* Header Banner Leaderboard */}
              <div className="p-5 sm:p-6 rounded-3xl bg-gradient-to-r from-blue-900 via-indigo-900 to-slate-900 text-white shadow-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-400/20 border border-amber-300/30 text-amber-300 text-[11px] font-black uppercase mb-2">
                    <Crown className="w-3.5 h-3.5 fill-amber-400" />
                    <span>Leaderboard & Evaluasi Poin Resmi</span>
                  </div>
                  <h2 className="text-lg sm:text-2xl font-black text-white tracking-tight">
                    Klasemen Poin Keaktifan Anggota & BPH
                  </h2>
                  <p className="text-xs text-indigo-200 mt-1 max-w-2xl leading-relaxed">
                    Peringkat dihitung otomatis secara realtime dari seluruh presensi kehadiran agenda proker, acara wajib, rutin, dan tugas khusus delegasi Bank Indonesia.
                  </p>
                </div>

                <div className="flex items-center gap-2 self-start sm:self-center">
                  <button
                    onClick={handleExportCSV}
                    className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-bold border border-white/20 transition cursor-pointer backdrop-blur-md shadow-xs active:scale-95"
                  >
                    <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Ekspor Format LPJ BI</span>
                  </button>
                  <button
                    onClick={loadAdminData}
                    className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 text-xs font-black transition cursor-pointer shadow-md active:scale-95"
                  >
                    <Crown className="w-3.5 h-3.5" />
                    <span>Segarkan Skor</span>
                  </button>
                </div>
              </div>

              {/* PODIUM SPOTLIGHT TOP 3 ANGGOTA */}
              {evaluations.length >= 3 && (
                <div className="space-y-3">
                  <h3 className="text-xs font-black text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                    <Crown className="w-3.5 h-3.5 text-amber-500" />
                    <span>Podium 3 Besar Keaktifan Terbaik</span>
                  </h3>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end pt-4">
                    {/* JUARA 2 (PERAK) - Kiri */}
                    {evaluations[1] && (
                      <div className="order-2 md:order-1 p-5 rounded-3xl bg-white/90 backdrop-blur-md border border-slate-200/80 shadow-md flex flex-col items-center text-center space-y-3 relative overflow-hidden">
                        <div className="absolute top-3 left-3 px-2 py-0.5 rounded-full bg-slate-200 text-slate-700 text-[10px] font-black uppercase">
                          🥈 Peringkat #2
                        </div>
                        <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-slate-200 to-slate-100 ring-4 ring-slate-300 shadow-md flex items-center justify-center text-slate-700 font-black text-xl mt-2">
                          {evaluations[1].full_name.charAt(0)}
                        </div>
                        <div className="space-y-0.5">
                          <h4 className="text-sm font-black text-slate-900 line-clamp-1">
                            {evaluations[1].full_name}
                          </h4>
                          <p className="text-[11px] text-slate-500 font-medium">
                            {evaluations[1].division} &bull; {evaluations[1].role === 'admin' ? 'BPH' : evaluations[1].role === 'kadiv' ? 'Kadiv' : 'Anggota'}
                          </p>
                        </div>
                        <div className="w-full py-2 px-3 rounded-2xl bg-slate-50 border border-slate-100 flex items-center justify-around text-xs">
                          <div>
                            <span className="text-[10px] text-slate-400 font-bold block">TOTAL POIN</span>
                            <span className="font-black text-slate-800 text-sm">{evaluations[1].total_points} P</span>
                          </div>
                          <div className="w-px h-6 bg-slate-200" />
                          <div>
                            <span className="text-[10px] text-slate-400 font-bold block">KEHADIRAN</span>
                            <span className="font-black text-slate-800 text-sm">{evaluations[1].attendance_percentage}%</span>
                          </div>
                        </div>
                        <button
                          onClick={() => setSelectedReportMember(evaluations[1])}
                          className="w-full py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer"
                        >
                          <Printer className="w-3.5 h-3.5 text-slate-600" />
                          <span>Cetak Rapor PDF</span>
                        </button>
                      </div>
                    )}

                    {/* JUARA 1 (EMAS) - Tengah (Highlight Spotlight) */}
                    {evaluations[0] && (
                      <div className="order-1 md:order-2 p-6 rounded-3xl bg-gradient-to-b from-amber-50/80 via-white to-white border-2 border-amber-300 shadow-xl shadow-amber-500/10 flex flex-col items-center text-center space-y-3.5 relative overflow-hidden -translate-y-2">
                        <div className="absolute top-0 inset-x-0 h-1.5 bg-gradient-to-r from-amber-400 via-yellow-300 to-amber-500" />
                        <div className="px-3 py-1 rounded-full bg-gradient-to-r from-amber-400 to-yellow-500 text-slate-950 text-xs font-black uppercase flex items-center gap-1 shadow-xs">
                          <Crown className="w-3.5 h-3.5 fill-slate-950" />
                          <span>🥇 JUARA #1 TERAKTIF</span>
                        </div>
                        <div className="w-20 h-20 rounded-3xl bg-gradient-to-tr from-amber-400 to-yellow-200 ring-4 ring-amber-300 shadow-lg flex items-center justify-center text-slate-950 font-black text-2xl">
                          {evaluations[0].full_name.charAt(0)}
                        </div>
                        <div className="space-y-0.5">
                          <h4 className="text-base font-black text-slate-900 line-clamp-1">
                            {evaluations[0].full_name}
                          </h4>
                          <p className="text-xs text-amber-700 font-bold">
                            {evaluations[0].division} &bull; {evaluations[0].role === 'admin' ? 'BPH' : evaluations[0].role === 'kadiv' ? 'Kepala Divisi' : 'Anggota'}
                          </p>
                        </div>
                        <div className="w-full py-2.5 px-4 rounded-2xl bg-amber-50/80 border border-amber-200/80 flex items-center justify-around text-xs">
                          <div>
                            <span className="text-[10px] text-amber-800 font-bold block">TOTAL POIN</span>
                            <span className="font-black text-amber-900 text-base">{evaluations[0].total_points} Poin</span>
                          </div>
                          <div className="w-px h-7 bg-amber-200" />
                          <div>
                            <span className="text-[10px] text-amber-800 font-bold block">KEHADIRAN</span>
                            <span className="font-black text-amber-900 text-base">{evaluations[0].attendance_percentage}%</span>
                          </div>
                        </div>
                        <button
                          onClick={() => setSelectedReportMember(evaluations[0])}
                          className="w-full py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-black transition flex items-center justify-center gap-1.5 cursor-pointer shadow-md shadow-blue-600/20"
                        >
                          <Printer className="w-3.5 h-3.5" />
                          <span>Cetak Rapor Beasiswa BI (PDF)</span>
                        </button>
                      </div>
                    )}

                    {/* JUARA 3 (PERUNGGU) - Kanan */}
                    {evaluations[2] && (
                      <div className="order-3 p-5 rounded-3xl bg-white/90 backdrop-blur-md border border-slate-200/80 shadow-md flex flex-col items-center text-center space-y-3 relative overflow-hidden">
                        <div className="absolute top-3 left-3 px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 text-[10px] font-black uppercase">
                          🥉 Peringkat #3
                        </div>
                        <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-amber-200 to-amber-100 ring-4 ring-amber-700/30 shadow-md flex items-center justify-center text-amber-900 font-black text-xl mt-2">
                          {evaluations[2].full_name.charAt(0)}
                        </div>
                        <div className="space-y-0.5">
                          <h4 className="text-sm font-black text-slate-900 line-clamp-1">
                            {evaluations[2].full_name}
                          </h4>
                          <p className="text-[11px] text-slate-500 font-medium">
                            {evaluations[2].division} &bull; {evaluations[2].role === 'admin' ? 'BPH' : evaluations[2].role === 'kadiv' ? 'Kadiv' : 'Anggota'}
                          </p>
                        </div>
                        <div className="w-full py-2 px-3 rounded-2xl bg-slate-50 border border-slate-100 flex items-center justify-around text-xs">
                          <div>
                            <span className="text-[10px] text-slate-400 font-bold block">TOTAL POIN</span>
                            <span className="font-black text-slate-800 text-sm">{evaluations[2].total_points} P</span>
                          </div>
                          <div className="w-px h-6 bg-slate-200" />
                          <div>
                            <span className="text-[10px] text-slate-400 font-bold block">KEHADIRAN</span>
                            <span className="font-black text-slate-800 text-sm">{evaluations[2].attendance_percentage}%</span>
                          </div>
                        </div>
                        <button
                          onClick={() => setSelectedReportMember(evaluations[2])}
                          className="w-full py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer"
                        >
                          <Printer className="w-3.5 h-3.5 text-slate-600" />
                          <span>Cetak Rapor PDF</span>
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* FILTER & PENCARIAN ANGGOTA LEADERBOARD */}
              <div className="p-4 rounded-2xl bg-white/90 backdrop-blur-md border border-slate-200/80 shadow-xs flex flex-col sm:flex-row gap-3 items-center justify-between">
                <div className="relative w-full sm:w-80">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    placeholder="Cari nama anggota atau NPM..."
                    value={searchMember}
                    onChange={(e) => setSearchMember(e.target.value)}
                    className="w-full pl-9 pr-4 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-600/30"
                  />
                </div>

                <div className="flex items-center gap-2 w-full sm:w-auto">
                  <Filter className="w-4 h-4 text-slate-400" />
                  <select
                    value={selectedDivisionFilter}
                    onChange={(e) => setSelectedDivisionFilter(e.target.value)}
                    className="flex-1 sm:flex-initial px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl text-slate-700 font-bold focus:outline-none focus:ring-2 focus:ring-blue-600/30 cursor-pointer"
                  >
                    {ALL_DIVISIONS.map((d) => (
                      <option key={d} value={d}>
                        {d === 'Semua' ? 'Semua Divisi' : d}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* TABEL LENGKAP KLASEMEN LEADERBOARD */}
              <div className="rounded-3xl bg-white/90 backdrop-blur-md border border-slate-200/80 overflow-hidden shadow-xs">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 text-slate-500 font-bold uppercase tracking-wider text-[10px] border-b border-slate-200">
                      <tr>
                        <th className="py-3.5 px-4 text-center">Rank</th>
                        <th className="py-3.5 px-4">Nama Lengkap & NPM</th>
                        <th className="py-3.5 px-4">Divisi & Jabatan</th>
                        <th className="py-3.5 px-4 text-center">Hadir / Izin / Alfa</th>
                        <th className="py-3.5 px-4 text-center">Persentase</th>
                        <th className="py-3.5 px-4 text-center">Total Poin</th>
                        <th className="py-3.5 px-4 text-center">Predikat</th>
                        <th className="py-3.5 px-4 text-center">Rapor PDF</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-medium">
                      {filteredEvaluations.map((ev, index) => {
                        const isTop1 = index === 0;
                        const isTop2 = index === 1;
                        const isTop3 = index === 2;

                        return (
                          <tr
                            key={ev.user_id || ev.npm}
                            className={`hover:bg-blue-50/40 transition ${
                              isTop1 ? 'bg-amber-50/40' : isTop2 ? 'bg-slate-50/50' : isTop3 ? 'bg-orange-50/20' : ''
                            }`}
                          >
                            <td className="py-3.5 px-4 text-center font-black">
                              {isTop1 ? (
                                <span className="inline-flex items-center justify-center w-7 h-7 rounded-xl bg-gradient-to-tr from-amber-400 to-yellow-300 text-slate-950 font-black shadow-xs">
                                  🥇
                                </span>
                              ) : isTop2 ? (
                                <span className="inline-flex items-center justify-center w-7 h-7 rounded-xl bg-slate-200 text-slate-700 font-black shadow-xs">
                                  🥈
                                </span>
                              ) : isTop3 ? (
                                <span className="inline-flex items-center justify-center w-7 h-7 rounded-xl bg-amber-100 text-amber-800 font-black shadow-xs">
                                  🥉
                                </span>
                              ) : (
                                <span className="text-slate-400 font-mono">#{index + 1}</span>
                              )}
                            </td>

                            <td className="py-3.5 px-4">
                              <div className="font-extrabold text-slate-900 flex items-center gap-1.5">
                                <span>{ev.full_name}</span>
                                {ev.role === 'admin' && (
                                  <span className="px-1.5 py-0.2 rounded bg-purple-100 text-purple-700 border border-purple-200 text-[9px] font-black uppercase">
                                    BPH
                                  </span>
                                )}
                              </div>
                              <span className="font-mono text-[11px] text-slate-400 font-bold block">
                                {ev.npm || ev.nim || '-'}
                              </span>
                            </td>

                            <td className="py-3.5 px-4">
                              <span className="text-slate-700 font-semibold">{ev.division}</span>
                              <span className="text-[10px] text-slate-400 block font-medium">
                                {ev.role === 'admin' ? 'BPH' : ev.role === 'kadiv' ? 'Kepala Divisi' : 'Anggota'}
                              </span>
                            </td>

                            <td className="py-3.5 px-4 text-center">
                              <div className="inline-flex items-center gap-1 font-mono text-[11px] font-bold">
                                <span className="text-emerald-600">{ev.total_hadir || 0}H</span>
                                <span className="text-slate-300">&bull;</span>
                                <span className="text-amber-600">{ev.total_izin || 0}I</span>
                                <span className="text-slate-300">&bull;</span>
                                <span className="text-rose-600">{ev.total_alfa || 0}A</span>
                              </div>
                            </td>

                            <td className="py-3.5 px-4 text-center">
                              <span className="font-black text-slate-900 font-mono">
                                {ev.attendance_percentage}%
                              </span>
                            </td>

                            <td className="py-3.5 px-4 text-center">
                              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200 font-black text-xs">
                                {ev.total_points} Poin
                              </span>
                            </td>

                            <td className="py-3.5 px-4 text-center">
                              <span
                                className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold border ${
                                  ev.predicate === 'Sangat Aktif'
                                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                    : ev.predicate === 'Aktif'
                                    ? 'bg-blue-50 text-blue-700 border-blue-200'
                                    : 'bg-amber-50 text-amber-700 border-amber-200'
                                }`}
                              >
                                {ev.predicate}
                              </span>
                            </td>

                            <td className="py-3.5 px-4 text-center">
                              <button
                                onClick={() => setSelectedReportMember(ev)}
                                className="px-3 py-1.5 rounded-xl bg-blue-50 hover:bg-blue-600 text-blue-600 hover:text-white border border-blue-200 text-xs font-bold transition flex items-center gap-1 mx-auto cursor-pointer shadow-xs active:scale-95"
                                title="Download / Cetak PDF Rapor Resmi Bank Indonesia"
                              >
                                <Printer className="w-3.5 h-3.5" />
                                <span className="hidden sm:inline">Rapor PDF</span>
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: KELOLA WHITELIST SK ANGGOTA & KADIV */}
          {activeTab === 'whitelist' && (
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h2 className="text-base sm:text-lg font-black text-slate-900 tracking-tight">
                    Daftar SK Resmi Penerima Beasiswa GenBI UNMA
                  </h2>
                  <p className="text-xs text-slate-500">
                    Hanya anggota yang terdaftar di whitelist ini yang dapat mengaktifkan akun di SIMAK GENBI.
                  </p>
                </div>
                <div className="flex items-center gap-2 self-start sm:self-center">
                  <button
                    onClick={() => setShowImportCsvModal(true)}
                    className="px-3.5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black shadow-md shadow-emerald-600/20 flex items-center gap-1.5 transition cursor-pointer"
                    title="Import data banyak anggota sekaligus via file atau teks CSV"
                  >
                    <FileSpreadsheet className="w-4 h-4" />
                    <span>Import CSV Massal</span>
                  </button>

                  <button
                    onClick={() => setShowAddWhitelistModal(true)}
                    className="px-4 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-xl text-xs font-black shadow-md shadow-blue-600/25 flex items-center gap-1.5 transition cursor-pointer"
                  >
                    <UserPlus className="w-4 h-4" />
                    <span>Tambah 1 Anggota</span>
                  </button>
                </div>
              </div>

              {/* Tabel Whitelist Anggota SK */}
              {isLoadingWhitelist ? (
                <div className="p-8 rounded-[24px] border border-slate-200 bg-white/70 text-center text-xs text-slate-400 font-medium">
                  Memuat daftar SK whitelist...
                </div>
              ) : whitelistMembers.length === 0 ? (
                <div className="p-8 rounded-[24px] border border-dashed border-slate-200 bg-white/70 text-center text-xs text-slate-400">
                  Belum ada data anggota yang didaftarkan ke whitelist. Klik "Tambah Anggota SK" untuk menambahkan penerima beasiswa baru.
                </div>
              ) : (
                <div className="overflow-x-auto rounded-3xl border border-slate-200/90 bg-white shadow-xs">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-slate-50/90 text-slate-500 border-b border-slate-200">
                        <th className="py-3.5 px-4 font-black text-[11px] uppercase tracking-wider">NPM</th>
                        <th className="py-3.5 px-4 font-black text-[11px] uppercase tracking-wider">Nama Lengkap Sesuai SK</th>
                        <th className="py-3.5 px-4 font-black text-[11px] uppercase tracking-wider">Divisi</th>
                        <th className="py-3.5 px-4 font-black text-[11px] uppercase tracking-wider text-center">Jabatan / Role</th>
                        <th className="py-3.5 px-4 font-black text-[11px] uppercase tracking-wider text-center">Status Aktivasi</th>
                        <th className="py-3.5 px-4 font-black text-[11px] uppercase tracking-wider text-center">Aksi</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {whitelistMembers.map((w) => {
                        const identifier = w.npm || w.nim || '-';
                        return (
                          <tr key={identifier} className="hover:bg-blue-50/30 transition">
                            <td className="py-3.5 px-4 font-mono font-bold text-slate-700">
                              <span className="px-2 py-0.5 rounded-lg bg-slate-100 border border-slate-200/80">
                                {identifier}
                              </span>
                            </td>
                            <td className="py-3.5 px-4 font-extrabold text-slate-900">{w.full_name}</td>
                            <td className="py-3.5 px-4 font-medium text-slate-600">{w.division}</td>
                            <td className="py-3.5 px-4 text-center">
                              {w.role === 'kadiv' ? (
                                <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-amber-50 text-amber-900 border border-amber-300 text-[10px] font-black shadow-xs">
                                  <Crown className="w-3 h-3 text-amber-600" />
                                  <span>Kepala Divisi</span>
                                </span>
                              ) : w.role === 'admin' ? (
                                <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-indigo-50 text-indigo-800 border border-indigo-200 text-[10px] font-black">
                                  <span>BPH</span>
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-slate-100 text-slate-700 border border-slate-200 text-[10px] font-bold">
                                  <span>Anggota</span>
                                </span>
                              )}
                            </td>
                            <td className="py-3.5 px-4 text-center">
                              {w.is_claimed ? (
                                <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-300 text-[10px] font-black">
                                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 animate-pulse" />
                                  <span>Sudah Aktif</span>
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-amber-50 text-amber-800 border border-amber-300 text-[10px] font-bold">
                                  <span>Menunggu Aktivasi</span>
                                </span>
                              )}
                            </td>
                            <td className="py-3.5 px-4 text-center">
                              <div className="flex items-center justify-center gap-1.5">
                                <button
                                  onClick={() => handleOpenEditWhitelist(w)}
                                  className="p-2 rounded-xl text-blue-600 hover:bg-blue-50 border border-transparent hover:border-blue-200 transition cursor-pointer"
                                  title="Edit data anggota SK"
                                >
                                  <Pencil className="w-4 h-4" />
                                </button>
                                <button
                                  onClick={() => handleDeleteWhitelist(identifier)}
                                  className="p-2 rounded-xl text-rose-500 hover:bg-rose-50 border border-transparent hover:border-rose-200 transition cursor-pointer"
                                  title="Hapus dari SK Whitelist"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </main>

        {/* Footer Hak Cipta SIMAK GenBI & PD-Dev */}
        <Footer />
      </div>

      {/* Modal Buat Acara Baru */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-md rounded-[32px] bg-white p-6 shadow-2xl space-y-4 relative border border-slate-100">
            <button
              onClick={() => setShowCreateModal(false)}
              className="absolute top-4 right-4 p-2 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            <div>
              <h3 className="text-base font-black text-slate-900">Buat Sesi Kegiatan Baru</h3>
              <p className="text-xs text-slate-500">Generate token presensi QR resmi untuk agenda GenBI</p>
            </div>

            <form onSubmit={handleCreateEvent} className="space-y-3.5 text-left">
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-slate-600 uppercase">Nama Acara / Proker</label>
                <input
                  type="text"
                  required
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder="Contoh: Rapat Pleno Evaluasi Semester"
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-600/30 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-600 uppercase">Kategori</label>
                  <select
                    value={newCategory}
                    onChange={(e) => setNewCategory(e.target.value as EventCategory)}
                    className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-600/30 focus:outline-none bg-white"
                  >
                    <option value="Proker">Proker</option>
                    <option value="Wajib">Wajib</option>
                    <option value="Rutin">Rutin</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-600 uppercase">Bobot Poin</label>
                  <input
                    type="number"
                    min={5}
                    max={50}
                    value={newPoints}
                    onChange={(e) => setNewPoints(Number(e.target.value))}
                    className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-600/30 focus:outline-none"
                  />
                </div>
              </div>

              <WibDateTimePicker
                value={newDate}
                onChange={setNewDate}
                label="Tanggal & Jam Pelaksanaan"
                required
              />

              <div className="space-y-1">
                <div className="flex justify-between items-center">
                  <label className="text-[11px] font-bold text-slate-600 uppercase">Kode Token Presensi</label>
                  <button
                    type="button"
                    onClick={generateRandomToken}
                    className="text-[10px] font-black text-blue-600 hover:underline cursor-pointer"
                  >
                    Regenerate Token
                  </button>
                </div>
                <input
                  type="text"
                  required
                  value={newToken}
                  onChange={(e) => setNewToken(e.target.value.toUpperCase())}
                  className="w-full px-3 py-2 text-xs font-mono font-bold border border-slate-200 rounded-xl uppercase tracking-wider focus:ring-2 focus:ring-blue-600/30 focus:outline-none"
                />
              </div>

              {/* Opsi Geofencing Validasi Lokasi Kampus UNMA */}
              <div className="p-3 bg-blue-50/70 border border-blue-200/80 rounded-2xl space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-blue-600 shrink-0" />
                    <div>
                      <span className="text-xs font-bold text-slate-900 block leading-tight">
                        Wajib Presensi di Lokasi (GPS)
                      </span>
                      <span className="text-[10px] text-slate-500">
                        Cegah titip presensi dari luar area Kampus UNMA
                      </span>
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={requireLocation}
                    onChange={(e) => setRequireLocation(e.target.checked)}
                    className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500 cursor-pointer"
                  />
                </div>

                {requireLocation && (
                  <div className="pt-1 flex items-center justify-between text-xs">
                    <span className="text-[11px] font-medium text-slate-600">Radius Toleransi:</span>
                    <select
                      value={targetRadius}
                      onChange={(e) => setTargetRadius(Number(e.target.value))}
                      className="px-2 py-1 text-xs border border-blue-200 rounded-lg bg-white font-bold"
                    >
                      <option value={150}>150 Meter (Gedung)</option>
                      <option value={250}>250 Meter (Area Kampus)</option>
                      <option value={500}>500 Meter (Lingkungan UNMA)</option>
                    </select>
                  </div>
                )}
              </div>

              <button
                type="submit"
                disabled={isSubmittingEvent}
                className="w-full py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-black text-xs rounded-xl shadow-md shadow-blue-600/25 disabled:opacity-60 cursor-pointer mt-1"
              >
                {isSubmittingEvent ? 'Menyimpan Acara...' : 'Simpan & Buka Sesi Presensi'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Modal Edit Acara */}
      {showEditEventModal && editingEvent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-md rounded-[32px] bg-white p-6 shadow-2xl space-y-4 relative border border-slate-100">
            <button
              onClick={() => {
                setShowEditEventModal(false);
                setEditingEvent(null);
              }}
              className="absolute top-4 right-4 p-2 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            <div>
              <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-blue-50 text-blue-700 text-[10px] font-bold mb-1">
                <Pencil className="w-3 h-3" />
                <span>Edit Agenda</span>
              </div>
              <h3 className="text-base font-black text-slate-900">Perbarui Rincian Agenda</h3>
              <p className="text-xs text-slate-500">Ubah judul, poin keaktifan, jadwal, atau token presensi</p>
            </div>

            <form onSubmit={handleUpdateEvent} className="space-y-3.5 text-left">
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-slate-600 uppercase">Nama Acara / Proker</label>
                <input
                  type="text"
                  required
                  value={editEventTitle}
                  onChange={(e) => setEditEventTitle(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-600/30 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-600 uppercase">Kategori</label>
                  <select
                    value={editEventCategory}
                    onChange={(e) => setEditEventCategory(e.target.value as EventCategory)}
                    className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-600/30 focus:outline-none bg-white font-medium"
                  >
                    <option value="Proker">Proker Utama</option>
                    <option value="Wajib">Acara Wajib BI</option>
                    <option value="Rutin">Rapat Rutin</option>
                    <option value="Sosial">Kegiatan Sosial</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-600 uppercase">Poin Kehadiran</label>
                  <input
                    type="number"
                    min={5}
                    max={100}
                    required
                    value={editEventPoints}
                    onChange={(e) => setEditEventPoints(Number(e.target.value))}
                    className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-600/30 focus:outline-none font-bold"
                  />
                </div>
              </div>

              <WibDateTimePicker
                value={editEventDate}
                onChange={setEditEventDate}
                label="Waktu Pelaksanaan"
                required
              />

              <div className="space-y-1">
                <label className="text-[11px] font-bold text-slate-600 uppercase">Kode Token Presensi</label>
                <input
                  type="text"
                  required
                  value={editEventToken}
                  onChange={(e) => setEditEventToken(e.target.value.toUpperCase())}
                  className="w-full px-3 py-2 text-xs font-mono font-bold border border-slate-200 rounded-xl uppercase tracking-wider focus:ring-2 focus:ring-blue-600/30 focus:outline-none"
                />
              </div>

              <div className="p-3 bg-blue-50/70 border border-blue-200/80 rounded-2xl space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-blue-600 shrink-0" />
                    <div>
                      <span className="text-xs font-bold text-slate-900 block leading-tight">
                        Wajib Presensi di Lokasi (GPS)
                      </span>
                      <span className="text-[10px] text-slate-500">
                        Cegah presensi dari luar area Kampus UNMA
                      </span>
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={editEventRequireLocation}
                    onChange={(e) => setEditEventRequireLocation(e.target.checked)}
                    className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500 cursor-pointer"
                  />
                </div>

                {editEventRequireLocation && (
                  <div className="pt-1 flex items-center justify-between text-xs">
                    <span className="text-[11px] font-medium text-slate-600">Radius Toleransi:</span>
                    <select
                      value={editEventRadius}
                      onChange={(e) => setEditEventRadius(Number(e.target.value))}
                      className="px-2 py-1 text-xs border border-blue-200 rounded-lg bg-white font-bold"
                    >
                      <option value={150}>150 Meter (Gedung)</option>
                      <option value={250}>250 Meter (Area Kampus)</option>
                      <option value={500}>500 Meter (Lingkungan UNMA)</option>
                    </select>
                  </div>
                )}
              </div>

              <div className="pt-2 flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowEditEventModal(false);
                    setEditingEvent(null);
                  }}
                  className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isUpdatingEvent}
                  className="flex-1 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-black text-xs rounded-xl shadow-md shadow-blue-600/25 disabled:opacity-60 cursor-pointer"
                >
                  {isUpdatingEvent ? 'Menyimpan...' : 'Perbarui Agenda'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Tampilkan QR Code Besar Sesi & Mode Proyektor */}
      {showQrModal && activeQrEvent && (
        <div className={`fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in ${isProjectorMode ? 'p-2' : 'p-4'}`}>
          <div className={`w-full rounded-[36px] bg-white p-6 shadow-2xl space-y-5 text-center relative border border-slate-100 ${isProjectorMode ? 'max-w-2xl p-8' : 'max-w-sm'}`}>
            <div className="absolute top-4 right-4 flex items-center gap-2">
              <button
                onClick={() => setIsProjectorMode(!isProjectorMode)}
                className="p-2 rounded-full text-slate-400 hover:text-blue-600 hover:bg-slate-100 transition cursor-pointer"
                title={isProjectorMode ? 'Keluar mode layar penuh' : 'Mode Proyektor Penuh'}
              >
                {isProjectorMode ? <Minimize2 className="w-5 h-5" /> : <Maximize2 className="w-5 h-5" />}
              </button>
              <button
                onClick={() => {
                  setShowQrModal(false);
                  setIsProjectorMode(false);
                }}
                className="p-2 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div>
              <span className="inline-block px-3 py-1 rounded-full bg-blue-50 text-blue-700 border border-blue-200 text-[11px] font-black mb-1.5">
                PRESENSI RESMI &bull; {activeQrEvent.category.toUpperCase()}
              </span>
              <h3 className={`font-black text-slate-900 leading-snug ${isProjectorMode ? 'text-2xl' : 'text-base'}`}>
                {activeQrEvent.title}
              </h3>
              <p className="text-xs text-emerald-600 font-extrabold mt-1">
                +{activeQrEvent.points} Poin Keaktifan Mahasiswa
              </p>
            </div>

            {/* Render QR Besar */}
            <div className={`mx-auto bg-white p-5 rounded-3xl border-4 border-dashed border-blue-500 flex flex-col items-center justify-center shadow-2xl ${isProjectorMode ? 'w-80 h-80' : 'w-64 h-64'}`}>
              <QRCodeSVG
                value={activeQrEvent.qr_token}
                size={isProjectorMode ? 280 : 220}
                level="H"
                includeMargin={false}
              />
            </div>

            <div className="space-y-1">
              <span className="text-[11px] text-slate-400 font-bold uppercase tracking-wider">
                Kode Token Sesi Presensi
              </span>
              <div className={`font-mono font-black text-slate-900 tracking-widest bg-slate-100 py-1.5 px-4 rounded-xl inline-block border border-slate-200 shadow-inner ${isProjectorMode ? 'text-2xl' : 'text-base'}`}>
                {activeQrEvent.qr_token}
              </div>
            </div>

            <p className="text-xs text-slate-400 font-medium">
              Anggota dapat langsung membuka kamera pemindai di aplikasi SIMAK GENBI atau mengetik kode token di atas.
            </p>
          </div>
        </div>
      )}



      {/* Modal Detail Peserta Hadir / Izin pada Sesi */}
      {selectedEventForParticipants && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-lg rounded-[32px] bg-white p-6 shadow-2xl space-y-4 relative border border-slate-100 max-h-[85vh] flex flex-col">
            <button
              onClick={() => setSelectedEventForParticipants(null)}
              className="absolute top-4 right-4 p-2 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <span className="inline-block px-2.5 py-0.5 rounded-md bg-blue-50 text-blue-700 border border-blue-200 text-[10px] font-bold mb-1">
                  Detail Presensi Kegiatan
                </span>
                <h3 className="text-base font-extrabold text-slate-900 leading-snug">
                  {selectedEventForParticipants.title}
                </h3>
                <p className="text-xs text-slate-500">
                  Total Terdata: {participants.length} Anggota
                </p>
              </div>

              <button
                type="button"
                onClick={() => setShowManualAttendanceModal(!showManualAttendanceModal)}
                className="px-3 py-1.5 rounded-xl bg-blue-50 hover:bg-blue-100 text-blue-700 font-bold text-xs border border-blue-200 flex items-center gap-1.5 transition cursor-pointer self-start sm:self-center"
              >
                <UserPlus className="w-3.5 h-3.5" />
                <span>+ Presensi Manual</span>
              </button>
            </div>

            {/* Form Presensi Manual (Jika Dibuka) */}
            {showManualAttendanceModal && (
              <form onSubmit={handleAddManualAttendance} className="p-3 bg-blue-50/70 border border-blue-200/80 rounded-2xl space-y-2 animate-in fade-in">
                <div className="flex items-center justify-between text-[11px] font-bold text-blue-900">
                  <span>Input Presensi Manual Anggota:</span>
                  <button
                    type="button"
                    onClick={() => setShowManualAttendanceModal(false)}
                    className="p-1 text-slate-400 hover:text-slate-600 rounded-md"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
                <div className="flex gap-2">
                  <input
                    type="text"
                    required
                    value={manualMemberNpm}
                    onChange={(e) => setManualMemberNpm(e.target.value)}
                    placeholder="Masukkan NPM (contoh: 2214100048)"
                    className="flex-1 px-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-blue-600/30 focus:outline-none"
                  />
                  <button
                    type="submit"
                    disabled={isSubmittingManualAtt}
                    className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-xs transition disabled:opacity-60 cursor-pointer"
                  >
                    {isSubmittingManualAtt ? 'Menyimpan...' : 'Hadirkan'}
                  </button>
                </div>
                <p className="text-[10px] text-slate-500">
                  Gunakan fitur ini jika ada anggota yang hadir tetapi kendala HP/kamera saat memindai token.
                </p>
              </form>
            )}

            {/* List Peserta */}
            <div className="flex-1 overflow-y-auto space-y-2 pr-1">
              {isLoadingParticipants ? (
                <div className="py-8 text-center text-xs text-slate-400 font-medium">
                  Memuat data peserta...
                </div>
              ) : participants.length === 0 ? (
                <div className="py-8 text-center text-xs text-slate-400 font-medium">
                  Belum ada anggota yang melakukan presensi atau mengajukan izin pada sesi ini.
                </div>
              ) : (
                participants.map((p) => (
                  <div
                    key={p.id}
                    className="p-3 rounded-xl bg-slate-50 border border-slate-200/70 flex items-center justify-between text-xs"
                  >
                    <div>
                      <span className="font-bold text-slate-900 block">{p.full_name}</span>
                      <div className="flex flex-wrap items-center gap-1.5 font-mono text-[10px] text-slate-500">
                        <span>{p.npm || p.nim}</span>
                        <span>&bull;</span>
                        <span>Divisi {p.division}</span>
                        <span>&bull;</span>
                        <span className="text-blue-700 font-sans font-bold bg-blue-50 px-1.5 py-0.5 rounded border border-blue-200/50">
                          {formatDateTimeWIB(p.scanned_at)}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5">
                      {p.status === 'hadir' ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-bold">
                          <UserCheck className="w-3 h-3" />
                          <span>Hadir</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-blue-50 text-blue-700 border border-blue-200 text-[10px] font-bold">
                          <span>Izin {p.verified ? '(Disetujui)' : '(Tertunda)'}</span>
                        </span>
                      )}

                      <button
                        type="button"
                        onClick={() => handleDeleteParticipant(p.id, p.full_name)}
                        className="p-1 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition cursor-pointer"
                        title="Hapus presensi peserta ini"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="pt-2 border-t border-slate-100 text-right">
              <button
                type="button"
                onClick={() => setSelectedEventForParticipants(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition cursor-pointer"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}



      {/* Modal Tambah Anggota ke Whitelist SK */}
      {showAddWhitelistModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-md rounded-[32px] bg-white p-6 shadow-2xl space-y-4 relative border border-slate-100">
            <button
              onClick={() => setShowAddWhitelistModal(false)}
              className="absolute top-4 right-4 p-2 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            <div>
              <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md bg-blue-50 text-blue-700 text-[10px] font-black uppercase tracking-wider mb-1">
                Registrasi Tertutup
              </div>
              <h3 className="text-base font-black text-slate-900">
                Tambah Anggota SK ke Whitelist
              </h3>
              <p className="text-xs text-slate-500">
                Daftarkan NPM dan Nama Anggota resmi sesuai SK agar mereka dapat mengaktifkan akun.
              </p>
            </div>

            <form onSubmit={handleAddWhitelistMember} className="space-y-3.5 text-left pt-1">
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-slate-600 uppercase">NPM Anggota</label>
                <input
                  type="text"
                  required
                  value={whiteNpm}
                  onChange={(e) => setWhiteNpm(e.target.value)}
                  placeholder="Contoh: 22.14.1.0028 atau 2414101078"
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-600/30 focus:outline-none"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-bold text-slate-600 uppercase">
                  Nama Lengkap Sesuai SK
                </label>
                <input
                  type="text"
                  required
                  value={whiteFullName}
                  onChange={(e) => setWhiteFullName(e.target.value)}
                  placeholder="Nama Lengkap Anggota"
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-600/30 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-600 uppercase">Divisi</label>
                  <select
                    value={whiteDivision}
                    onChange={(e) => setWhiteDivision(e.target.value as Division)}
                    className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-600/30 focus:outline-none bg-white"
                  >
                    <option value="Publikasi dan Sosialisasi">Publikasi dan Sosialisasi</option>
                    <option value="Lingkungan Hidup">Lingkungan Hidup</option>
                    <option value="Pendidikan">Pendidikan</option>
                    <option value="Pengabdian Masyarakat">Pengabdian Masyarakat</option>
                    <option value="Kewirausahaan">Kewirausahaan</option>
                    <option value="BPH">BPH</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-600 uppercase">Jabatan / Role</label>
                  <select
                    value={whiteRole}
                    onChange={(e) => setWhiteRole(e.target.value as Role)}
                    className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-600/30 focus:outline-none bg-white font-bold"
                  >
                    <option value="member">Anggota</option>
                    <option value="kadiv">⭐ Kepala Divisi (Kadiv)</option>
                    <option value="admin">🛡️ BPH</option>
                  </select>
                </div>
              </div>

              <div className="pt-2 flex gap-2">
                <button
                  type="button"
                  onClick={() => setShowAddWhitelistModal(false)}
                  className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isSavingWhitelist}
                  className="flex-1 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-bold text-xs rounded-xl shadow-md shadow-blue-600/25 transition cursor-pointer disabled:opacity-70"
                >
                  {isSavingWhitelist ? 'Menyimpan...' : 'Tambahkan ke SK'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Edit SK Anggota Whitelist */}
      {showEditWhitelistModal && editingWhitelist && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-md rounded-[32px] bg-white p-6 shadow-2xl space-y-4 relative border border-slate-100">
            <button
              onClick={() => {
                setShowEditWhitelistModal(false);
                setEditingWhitelist(null);
              }}
              className="absolute top-4 right-4 p-2 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            <div>
              <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md bg-amber-50 text-amber-700 text-[10px] font-black uppercase tracking-wider mb-1 border border-amber-200">
                <Pencil className="w-3 h-3" />
                <span>Edit SK Anggota</span>
              </div>
              <h3 className="text-base font-black text-slate-900">
                Perbarui Data Penerima Beasiswa
              </h3>
              <p className="text-xs text-slate-500">
                NPM: <span className="font-mono font-bold text-slate-700">{editingWhitelist.npm}</span>
              </p>
            </div>

            <form onSubmit={handleUpdateWhitelist} className="space-y-3.5 text-left pt-1">
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-slate-600 uppercase">
                  Nama Lengkap Sesuai SK
                </label>
                <input
                  type="text"
                  required
                  value={editWhiteFullName}
                  onChange={(e) => setEditWhiteFullName(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-600/30 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-600 uppercase">Divisi</label>
                  <select
                    value={editWhiteDivision}
                    onChange={(e) => setEditWhiteDivision(e.target.value as Division)}
                    className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-600/30 focus:outline-none bg-white font-medium"
                  >
                    <option value="Publikasi dan Sosialisasi">Publikasi dan Sosialisasi</option>
                    <option value="Lingkungan Hidup">Lingkungan Hidup</option>
                    <option value="Pendidikan">Pendidikan</option>
                    <option value="Pengabdian Masyarakat">Pengabdian Masyarakat</option>
                    <option value="Kewirausahaan">Kewirausahaan</option>
                    <option value="BPH">BPH</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-600 uppercase">Jabatan / Role</label>
                  <select
                    value={editWhiteRole}
                    onChange={(e) => setEditWhiteRole(e.target.value as Role)}
                    className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-600/30 focus:outline-none bg-white font-bold"
                  >
                    <option value="member">Anggota</option>
                    <option value="kadiv">⭐ Kepala Divisi (Kadiv)</option>
                    <option value="admin">🛡️ BPH</option>
                  </select>
                </div>
              </div>

              <div className="pt-2 flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowEditWhitelistModal(false);
                    setEditingWhitelist(null);
                  }}
                  className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isUpdatingWhitelist}
                  className="flex-1 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-bold text-xs rounded-xl shadow-md shadow-blue-600/25 transition cursor-pointer disabled:opacity-70"
                >
                  {isUpdatingWhitelist ? 'Menyimpan...' : 'Perbarui Data SK'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}



      {/* Modal Import Massal CSV Whitelist */}
      {showImportCsvModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-lg rounded-[32px] bg-white p-6 shadow-2xl space-y-4 relative border border-slate-100">
            <button
              onClick={() => setShowImportCsvModal(false)}
              className="absolute top-4 right-4 p-2 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            <div>
              <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md bg-emerald-50 text-emerald-700 text-[10px] font-black uppercase tracking-wider mb-1">
                Batch Import BPH
              </div>
              <h3 className="text-base sm:text-lg font-black text-slate-900">
                Impor Massal Whitelist Anggota (CSV / Excel)
              </h3>
              <p className="text-xs text-slate-500">
                Salin dan tempel daftar penerima beasiswa atau pilih file .csv/.txt untuk mendaftarkan seluruh anggota dalam sekali klik.
              </p>
            </div>

            <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200 text-[11px] text-slate-600 space-y-1">
              <span className="font-bold block text-slate-800">Format Kolom (Pemisah Koma atau Tab):</span>
              <p className="font-mono text-[10px] bg-white p-1.5 rounded-lg border border-slate-200 text-slate-700">
                NPM, Nama Lengkap, Divisi, Role (Opsional: member/kadiv/admin)
              </p>
              <p className="text-[10px] text-slate-400">
                Contoh: <code>2414101078, Pangki Deswa Rayhandi, Publikasi dan Sosialisasi, kadiv</code>
              </p>
            </div>

            {/* Input File CSV Alternatif */}
            <div className="flex items-center justify-between">
              <label className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold cursor-pointer transition">
                <UploadCloud className="w-3.5 h-3.5 text-slate-600" />
                <span>Pilih Berkas .csv/.txt</span>
                <input
                  type="file"
                  accept=".csv,.txt"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      const reader = new FileReader();
                      reader.onload = (event) => {
                        const content = event.target?.result as string;
                        if (content) setCsvText(content);
                      };
                      reader.readAsText(file);
                    }
                  }}
                />
              </label>

              {csvText && (
                <button
                  type="button"
                  onClick={() => setCsvText('')}
                  className="text-xs text-rose-500 hover:underline font-bold"
                >
                  Bersihkan Teks
                </button>
              )}
            </div>

            {/* Area Teks CSV */}
            <textarea
              rows={6}
              value={csvText}
              onChange={(e) => setCsvText(e.target.value)}
              placeholder="Tempelkan baris data CSV di sini...&#10;22.14.1.0028, Ahmad Fauzi, Pendidikan, member&#10;22.14.1.0045, Siti Nurhaliza, Lingkungan Hidup, kadiv"
              className="w-full p-3 text-xs font-mono border border-slate-200 rounded-2xl bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/30 resize-none"
            />

            <div className="pt-2 flex gap-2">
              <button
                type="button"
                onClick={() => setShowImportCsvModal(false)}
                className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleImportCsv}
                disabled={isImportingCsv || !csvText.trim()}
                className="flex-1 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-bold text-xs rounded-xl shadow-md shadow-emerald-600/25 transition cursor-pointer disabled:opacity-60 flex items-center justify-center gap-1.5"
              >
                {isImportingCsv ? 'Mengimpor Data...' : 'Mulai Impor Massal'}
              </button>
            </div>
          </div>
        </div>
      )}



      {/* Modal Dialog Tolak Izin dengan Alasan */}
      {rejectAttendanceId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-sm rounded-[32px] bg-white p-6 shadow-2xl space-y-4 relative border border-slate-100 text-left">
            <button
              onClick={() => setRejectAttendanceId(null)}
              className="absolute top-4 right-4 p-2 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            <div>
              <div className="w-10 h-10 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center mb-2">
                <XCircle className="w-5 h-5" />
              </div>
              <h3 className="text-base font-black text-slate-900">
                Tolak Pengajuan Izin
              </h3>
              <p className="text-xs text-slate-500">
                Status kehadiran akan otomatis diubah menjadi <strong>Alfa</strong> (0 poin). Masukkan alasan resmi penolakan untuk evaluasi BPH.
              </p>
            </div>

            <div className="space-y-1">
              <label className="text-[11px] font-bold text-slate-600 uppercase">
                Alasan Penolakan
              </label>
              <textarea
                rows={3}
                required
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                placeholder="Contoh: Bukti surat tidak valid, tidak ada stempel basah/tanda tangan, atau diajukan melebihi batas waktu."
                className="w-full p-2.5 text-xs border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-rose-500/30 resize-none"
              />
            </div>

            <div className="pt-2 flex gap-2">
              <button
                type="button"
                onClick={() => setRejectAttendanceId(null)}
                className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleRejectIzin}
                disabled={isSubmittingRejection || !rejectionReason.trim()}
                className="flex-1 py-2.5 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-xl shadow-md shadow-rose-600/20 transition cursor-pointer disabled:opacity-60"
              >
                {isSubmittingRejection ? 'Memproses...' : 'Tolak & Tandai Alfa'}
              </button>
            </div>
          </div>
        </div>
      )}


      {/* Modal Cetak Rapor Keaktifan & Rekomendasi Beasiswa Bank Indonesia */}
      {selectedReportMember && (
        <MemberReportModal
          evaluation={selectedReportMember}
          onClose={() => setSelectedReportMember(null)}
        />
      )}

    </div>
  );
};

export default AdminDashboardPage;
