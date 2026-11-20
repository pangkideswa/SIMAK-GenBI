import React, { useState, useEffect, useRef } from 'react';
import {
  LogOut,
  ScanLine,
  FileText,
  Award,
  Calendar,
  Clock,
  MapPin,
  CheckCircle2,
  X,
  RefreshCw,
  Sparkles,
  Camera,
  Keyboard,
  AlertCircle,
  CalendarDays,
  ShieldAlert,
  History,
  CheckCircle,
  Hourglass,
  CalendarX,
  Copy,
  ChevronRight,
  Wifi,
  Info,
  ShieldCheck,
  Zap,
  User,
  Settings,
  Phone,
  GraduationCap,
  Trophy,
  Crown,
  Upload,
  Download,
  SlidersHorizontal,
  Share2,
  Flashlight,
  KeyRound,
  Eye,
  EyeOff,
  Bell,
  RotateCw,
  Trash2,
} from 'lucide-react';
import { QRCodeSVG, QRCodeCanvas } from 'qrcode.react';
import { Html5Qrcode } from 'html5-qrcode';
import html2canvas from 'html2canvas-pro';
import { supabase } from '../lib/supabase';
import { uploadProofToGDrive } from '../lib/gdrive';
import { normalizeStudentId } from '../lib/memberSync';
import { formatDateTimeWIB } from '../lib/dateUtils';
import { changeUserPin } from '../lib/authSecurity';
import { Footer } from '../components/Footer';
import {
  isPushNotificationEnabled,
  requestNotificationPermission,
  sendWebNotification,
  checkUpcomingAgendaReminders,
} from '../lib/notificationService';
import { filterDeletedAttendances, filterDeletedEvents } from '../lib/eventSync';
import {
  recordUnifiedAttendance,
  applyEvaluationsOverrides,
  EVALUATIONS_OVERRIDES_KEY,
} from '../lib/attendanceSync';
import { MemberReportModal } from '../components/MemberReportModal';
import {
  enqueueOfflineAttendance,
  initOfflineQueueSync,
  getOfflineQueue,
  flushOfflineQueue,
} from '../lib/offlineQueue';
import type { Event as EventType, MemberEvaluation, EvaluationPredicate, Role } from '../types/database';

interface DashboardPageProps {
  user: {
    id: string;
    npm: string;
    nim?: string;
    fullName: string;
    division: string;
    role: Role;
  };
  onLogout: () => void;
  onSwitchToAdminView?: () => void;
}

interface AttendanceRecord {
  id: string;
  event_id: string;
  status: 'hadir' | 'izin' | 'alfa' | 'delegasi';
  proof_url: string | null;
  verified: boolean;
  scanned_at: string;
  event_title?: string;
  event_points?: number;
  event_date?: string;
  event_category?: string;
}

// Data percontohan realistis menggunakan UUID valid agar tersimpan permanen di PostgreSQL Supabase
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

const DEFAULT_SAMPLE_ATTENDANCES: AttendanceRecord[] = [
  {
    id: 'att-1',
    event_id: 'sample-evt-1',
    status: 'hadir',
    proof_url: null,
    verified: true,
    scanned_at: new Date(Date.now() - 86400000 * 3).toISOString(),
    event_title: 'Sosialisasi Cinta Bangga Paham (CBP) Rupiah ke SMA Majalengka',
    event_points: 15,
    event_date: new Date(Date.now() - 86400000 * 3).toISOString(),
    event_category: 'Proker',
  },
  {
    id: 'att-2',
    event_id: 'sample-evt-2',
    status: 'hadir',
    proof_url: null,
    verified: true,
    scanned_at: new Date(Date.now() - 86400000 * 10).toISOString(),
    event_title: 'Orientasi & Pembekalan Awal Penerima Beasiswa Bank Indonesia',
    event_points: 25,
    event_date: new Date(Date.now() - 86400000 * 10).toISOString(),
    event_category: 'Wajib',
  },
];

export const DashboardPage: React.FC<DashboardPageProps> = ({
  user,
  onLogout,
  onSwitchToAdminView,
}) => {
  const currentNpm = user.npm || user.nim || '-';

  // Profil asli tersinkronisasi murni dari database
  const [profile, setProfile] = useState<{
    id: string;
    npm: string;
    nim: string;
    fullName: string;
    division: string;
    role: string;
    phone?: string | null;
    studyProgram?: string | null;
    bio?: string | null;
    avatarUrl?: string | null;
  }>({
    id: user.id,
    npm: currentNpm,
    nim: currentNpm,
    fullName: user.fullName,
    division: user.division,
    role: user.role,
    phone: (() => {
      try {
        const byId = localStorage.getItem('simak_profile_extra_' + user.id);
        if (byId) return JSON.parse(byId)?.phone || null;
        const byNpm = localStorage.getItem('simak_profile_extra_' + currentNpm);
        if (byNpm) return JSON.parse(byNpm)?.phone || null;
      } catch {}
      return null;
    })(),
    studyProgram: (() => {
      try {
        const byId = localStorage.getItem('simak_profile_extra_' + user.id);
        if (byId) return JSON.parse(byId)?.study_program || null;
        const byNpm = localStorage.getItem('simak_profile_extra_' + currentNpm);
        if (byNpm) return JSON.parse(byNpm)?.study_program || null;
      } catch {}
      return null;
    })(),
    bio: (() => {
      try {
        const byId = localStorage.getItem('simak_profile_extra_' + user.id);
        if (byId) return JSON.parse(byId)?.bio || null;
        const byNpm = localStorage.getItem('simak_profile_extra_' + currentNpm);
        if (byNpm) return JSON.parse(byNpm)?.bio || null;
      } catch {}
      return null;
    })(),
    avatarUrl: (() => {
      try {
        return localStorage.getItem('simak_avatar_' + user.id) || null;
      } catch {
        return null;
      }
    })(),
  });

  const [events, setEvents] = useState<EventType[]>(DEFAULT_SAMPLE_EVENTS);
  const [attendances, setAttendances] = useState<AttendanceRecord[]>(() => {
    try {
      const saved = localStorage.getItem('simak_attendances_' + user.id);
      if (saved) return JSON.parse(saved);
    } catch {}
    return DEFAULT_SAMPLE_ATTENDANCES;
  });

  const [leaderboard, setLeaderboard] = useState<MemberEvaluation[]>(() => {
    try {
      const saved = localStorage.getItem('simak_leaderboard_cache');
      if (saved) return JSON.parse(saved);
    } catch {}
    return DEFAULT_SAMPLE_LEADERBOARD;
  });
  const [isLoadingLeaderboard, setIsLoadingLeaderboard] = useState(false);

  const [evaluation, setEvaluation] = useState<MemberEvaluation>(() => {
    try {
      const saved = localStorage.getItem('simak_eval_' + user.id);
      if (saved) return JSON.parse(saved);
    } catch {}
    return {
      user_id: user.id,
      npm: currentNpm,
      nim: currentNpm,
      email: null,
      full_name: user.fullName,
      division: user.division as any,
      role: user.role,
      avatar_url: (() => {
        try {
          return localStorage.getItem('simak_avatar_' + user.id) || null;
        } catch {
          return null;
        }
      })(),
      total_points: user.role === 'admin' ? 95 : user.role === 'kadiv' ? 85 : 60,
      total_hadir: user.role === 'admin' ? 7 : user.role === 'kadiv' ? 6 : 4,
      total_izin: 0,
      total_alfa: 0,
      attendance_percentage: 100,
      predicate: 'Sangat Aktif',
    };
  });

  // Active Tab & Filter Leaderboard
  const [activeTab, setActiveTab] = useState<'events' | 'history' | 'leaderboard' | 'kadiv-workspace' | 'tiers'>('events');
  const [selectedLeaderboardDivision, setSelectedLeaderboardDivision] = useState<string>('Semua');
  const [leaderboardSortOrder, setLeaderboardSortOrder] = useState<'highest' | 'lowest'>('highest');

  // Ref Kartu ID untuk Export PNG
  const memberCardRef = useRef<HTMLDivElement | null>(null);
  const proofFileInputRef = useRef<HTMLInputElement | null>(null);
  const delegasiFileInputRef = useRef<HTMLInputElement | null>(null);
  const [isDownloadingCard, setIsDownloadingCard] = useState(false);
  const [cardSide, setCardSide] = useState<'front' | 'back'>('front');

  // Modals state
  const [showQrModal, setShowQrModal] = useState(false);
  const [showIzinModal, setShowIzinModal] = useState(false);
  const [showDelegasiModal, setShowDelegasiModal] = useState(false);
  const [showScanModal, setShowScanModal] = useState(false);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [scanMode, setScanMode] = useState<'camera' | 'manual'>('camera');

  // Delegasi Bank Indonesia (Wilayah 9 & 10) State
  const [delegasiTitle, setDelegasiTitle] = useState('');
  const [delegasiCity, setDelegasiCity] = useState('Kantor Perwakilan BI Cirebon');
  const [delegasiNote, setDelegasiNote] = useState('');
  const [delegasiFile, setDelegasiFile] = useState<File | null>(null);
  const [delegasiFileUrl, setDelegasiFileUrl] = useState('');
  const [isUploadingDelegasi, setIsUploadingDelegasi] = useState(false);
  const [delegasiSuccess, setDelegasiSuccess] = useState(false);
  const [delegasiGps, setDelegasiGps] = useState<{ lat: number; lng: number } | null>(null);
  const [isFetchingDelegasiGps, setIsFetchingDelegasiGps] = useState(false);

  // Profile Edit Form State
  const [editFullName, setEditFullName] = useState(user.fullName);
  const [editPhone, setEditPhone] = useState(() => {
    try {
      const byId = localStorage.getItem('simak_profile_extra_' + user.id);
      if (byId) return JSON.parse(byId)?.phone || '';
      const byNpm = localStorage.getItem('simak_profile_extra_' + currentNpm);
      if (byNpm) return JSON.parse(byNpm)?.phone || '';
    } catch {}
    return '';
  });
  const [editStudyProgram, setEditStudyProgram] = useState(() => {
    try {
      const byId = localStorage.getItem('simak_profile_extra_' + user.id);
      if (byId) return JSON.parse(byId)?.study_program || '';
      const byNpm = localStorage.getItem('simak_profile_extra_' + currentNpm);
      if (byNpm) return JSON.parse(byNpm)?.study_program || '';
    } catch {}
    return '';
  });
  const [editBio, setEditBio] = useState(() => {
    try {
      const byId = localStorage.getItem('simak_profile_extra_' + user.id);
      if (byId) return JSON.parse(byId)?.bio || '';
      const byNpm = localStorage.getItem('simak_profile_extra_' + currentNpm);
      if (byNpm) return JSON.parse(byNpm)?.bio || '';
    } catch {}
    return '';
  });
  const [isSavingProfile, setIsSavingProfile] = useState(false);

  // Scanner & Presensi State
  const [manualToken, setManualToken] = useState('');
  const [scannerMessage, setScannerMessage] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);
  const [isSubmittingAttendance, setIsSubmittingAttendance] = useState(false);
  const qrScannerRef = useRef<Html5Qrcode | null>(null);
  const qrImageInputRef = useRef<HTMLInputElement | null>(null);
  const [isScanningImage, setIsScanningImage] = useState(false);
  const [cameraFacing, setCameraFacing] = useState<'environment' | 'user'>('environment');
  const [isCameraStarting, setIsCameraStarting] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [isCameraActive, setIsCameraActive] = useState(false);

  // Pop-up Notifikasi Berhasil Presensi & Sinkronisasi Leaderboard
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);
  const [isTorchOn, setIsTorchOn] = useState(false);

  // Form Ubah Password / PIN Mandiri State
  const [showPasswordForm, setShowPasswordForm] = useState(false);
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPasswordText, setShowPasswordText] = useState(false);
  const [isUpdatingPassword, setIsUpdatingPassword] = useState(false);
  const [isPushEnabled, setIsPushEnabled] = useState(isPushNotificationEnabled());
  const [offlineQueueCount, setOfflineQueueCount] = useState<number>(() => {
    return getOfflineQueue().length;
  });
  const [isSyncingQueue, setIsSyncingQueue] = useState(false);
  const [attendanceSuccessData, setAttendanceSuccessData] = useState<{
    eventTitle: string;
    category: string;
    pointsAdded: number;
    totalPoints: number;
    predicate: string;
    scannedAt: string;
    locationNote?: string;
  } | null>(null);

  // Form Izin State
  const [selectedEventId, setSelectedEventId] = useState('');
  const [alasanIzin, setAlasanIzin] = useState('Sakit dengan Surat Keterangan Dokter');
  const [proofUrl, setProofUrl] = useState('');
  const [proofFile, setProofFile] = useState<File | null>(null);
  const [isUploadingProof, setIsUploadingProof] = useState(false);
  const [keteranganIzin, setKeteranganIzin] = useState('');
  const [izinSuccess, setIzinSuccess] = useState(false);

  // Foto Profil ID Card & Akun Anggota
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const avatarFileInputRef = useRef<HTMLInputElement>(null);

  // Helper kompresi foto profil menjadi format persegi (Square 1:1) dan hemat memori
  const processProfileImage = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      if (!file.type.startsWith('image/')) {
        reject(new Error('File yang dipilih bukan berkas gambar.'));
        return;
      }

      const objectUrl = URL.createObjectURL(file);
      const img = new Image();

      img.onload = () => {
        try {
          // Hitung crop 1:1 di tengah (center crop)
          const size = Math.min(img.width, img.height);
          const startX = (img.width - size) / 2;
          const startY = (img.height - size) / 2;

          const targetSize = 400; // Resolusi 400x400 sangat tajam untuk ID Card & avatar
          const canvas = document.createElement('canvas');
          canvas.width = targetSize;
          canvas.height = targetSize;
          const ctx = canvas.getContext('2d');

          if (!ctx) {
            URL.revokeObjectURL(objectUrl);
            reject(new Error('Gagal memproses gambar pada canvas.'));
            return;
          }

          ctx.drawImage(img, startX, startY, size, size, 0, 0, targetSize, targetSize);
          const base64Data = canvas.toDataURL('image/jpeg', 0.85);

          // Bersihkan memori canvas & object URL
          canvas.width = 0;
          canvas.height = 0;
          URL.revokeObjectURL(objectUrl);

          resolve(base64Data);
        } catch (err) {
          URL.revokeObjectURL(objectUrl);
          reject(err);
        }
      };

      img.onerror = () => {
        URL.revokeObjectURL(objectUrl);
        reject(new Error('Gagal memuat berkas gambar.'));
      };

      img.src = objectUrl;
    });
  };

  const handleAvatarFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploadingAvatar(true);
    try {
      const base64Avatar = await processProfileImage(file);

      // 1. Simpan langsung ke cache lokal agar ID Card langsung menampilkan foto tanpa delay
      try {
        localStorage.setItem('simak_avatar_' + user.id, base64Avatar);
      } catch {}

      setProfile((prev) => ({
        ...prev,
        avatarUrl: base64Avatar,
      }));

      // 2. Sinkronisasi ke Supabase
      let finalUrl = base64Avatar;
      if (!user.id.startsWith('demo-')) {
        try {
          const response = await fetch(base64Avatar);
          const blob = await response.blob();
          const cleanNpm = profile.npm || profile.nim || user.id;
          const fileName = `avatar_${cleanNpm}_${Date.now()}.jpg`;

          const { error: storageError } = await supabase.storage
            .from('avatars')
            .upload(fileName, blob, {
              contentType: 'image/jpeg',
              upsert: true,
            });

          if (!storageError) {
            const { data: publicData } = supabase.storage
              .from('avatars')
              .getPublicUrl(fileName);
            if (publicData?.publicUrl) {
              finalUrl = publicData.publicUrl;
              try {
                localStorage.setItem('simak_avatar_' + user.id, finalUrl);
              } catch {}
              setProfile((prev) => ({
                ...prev,
                avatarUrl: finalUrl,
              }));
            }
          }
        } catch (storageErr) {
          console.warn('Storage upload note:', storageErr);
        }

        // Update kolom avatar_url di tabel profiles
        await (supabase.from('profiles') as any)
          .update({ avatar_url: finalUrl })
          .eq('id', user.id);

        // Update juga di member_evaluations agar sinkron di seluruh leaderboard & sistem
        await (supabase.from('member_evaluations') as any)
          .update({ avatar_url: finalUrl })
          .eq('user_id', user.id);
      }

      setLeaderboard((prev) =>
        prev.map((item) =>
          item.user_id === user.id ? { ...item, avatar_url: finalUrl } : item
        )
      );

      showToast('Foto profil ID Card berhasil dipasang dan tersinkronisasi!', 'success');
    } catch (err: any) {
      showToast(err.message || 'Gagal memproses foto profil.', 'error');
    } finally {
      setIsUploadingAvatar(false);
      if (avatarFileInputRef.current) {
        avatarFileInputRef.current.value = '';
      }
    }
  };

  const handleRemoveAvatar = async () => {
    if (!confirm('Apakah Anda yakin ingin menghapus foto profil ini?')) return;

    setIsUploadingAvatar(true);
    try {
      try {
        localStorage.removeItem('simak_avatar_' + user.id);
      } catch {}

      setProfile((prev) => ({
        ...prev,
        avatarUrl: null,
      }));

      if (!user.id.startsWith('demo-')) {
        await (supabase.from('profiles') as any)
          .update({ avatar_url: null })
          .eq('id', user.id);

        await (supabase.from('member_evaluations') as any)
          .update({ avatar_url: null })
          .eq('user_id', user.id);
      }

      setLeaderboard((prev) =>
        prev.map((item) =>
          item.user_id === user.id ? { ...item, avatar_url: null } : item
        )
      );

      showToast('Foto profil berhasil dihapus.', 'info');
    } catch (err: any) {
      showToast(err.message || 'Gagal menghapus foto profil.', 'error');
    } finally {
      setIsUploadingAvatar(false);
    }
  };

  // Toast Notification State
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'info' | 'error' | 'warning' } | null>(null);

  // QR Anggota Timer
  const [qrCodeTimer, setQrCodeTimer] = useState(45);

  const showToast = (message: string, type: 'success' | 'info' | 'error' | 'warning' = 'success') => {
    setToast({ message, type });
    setTimeout(() => {
      setToast(null);
    }, 4000);
  };

  // 1. Fetch Profile secara independen
  const fetchProfile = async () => {
    let overrides: Record<string, any> = {};
    try {
      const rawOv = localStorage.getItem('simak_whitelist_overrides');
      if (rawOv) overrides = JSON.parse(rawOv);
    } catch {}

    const myCleanId = normalizeStudentId(user.npm || user.nim);
    const myOverride = overrides[myCleanId];

    // Baca data tambahan profil tersimpan dari localStorage
    let localExtra: any = null;
    try {
      const byId = localStorage.getItem('simak_profile_extra_' + user.id);
      const byNpm = localStorage.getItem('simak_profile_extra_' + myCleanId);
      if (byId) localExtra = JSON.parse(byId);
      else if (byNpm) localExtra = JSON.parse(byNpm);
    } catch {}

    // Inisialisasi default demo & mode simulasi Super Admin untuk profil
    if (user.id.startsWith('demo-') || user.id.startsWith('simulasi-')) {
      const isSimulasiKadiv = user.role === 'kadiv';
      let defaultProdi = localExtra?.study_program || (isSimulasiKadiv ? 'Sistem Informasi' : 'Informatika');
      let defaultBio =
        localExtra?.bio ||
        (isSimulasiKadiv
          ? `Kepala Divisi ${user.division || 'Publikasi dan Sosialisasi'} GenBI UNMA`
          : user.role === 'admin'
          ? 'Pengurus Harian GenBI UNMA • Dedikasi Untuk Negeri'
          : 'Penerima Beasiswa Bank Indonesia Komisariat UNMA');
      let defaultPhone = localExtra?.phone || '081234567890';
      if (user.nim === '2214100010') {
        defaultProdi = localExtra?.study_program || 'Sistem Informasi';
        defaultBio = localExtra?.bio || 'Kepala Divisi Publikasi dan Sosialisasi GenBI UNMA';
        defaultPhone = localExtra?.phone || '082345678901';
      } else if (user.nim === '2214100048') {
        defaultProdi = localExtra?.study_program || 'Manajemen';
        defaultBio = localExtra?.bio || 'Penerima Beasiswa Bank Indonesia Komisariat UNMA';
        defaultPhone = localExtra?.phone || '083456789012';
      }
      setProfile((prev) => ({
        ...prev,
        fullName: user.id.startsWith('simulasi-') ? user.fullName : (myOverride?.full_name || localExtra?.full_name || prev.fullName),
        division: user.id.startsWith('simulasi-') ? user.division : (myOverride?.division || prev.division),
        role: user.id.startsWith('simulasi-') ? user.role : (myOverride?.role || prev.role),
        studyProgram: localExtra?.study_program || prev.studyProgram || defaultProdi,
        bio: localExtra?.bio || prev.bio || defaultBio,
        phone: localExtra?.phone || prev.phone || defaultPhone,
      }));
      setEditFullName(user.id.startsWith('simulasi-') ? user.fullName : (myOverride?.full_name || localExtra?.full_name || user.fullName));
      setEditPhone(localExtra?.phone || defaultPhone);
      setEditStudyProgram(localExtra?.study_program || defaultProdi);
      setEditBio(localExtra?.bio || defaultBio);
      return;
    }

    try {
      let p: any = null;
      try {
        const { data: profData } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', user.id)
          .maybeSingle();
        p = profData;
      } catch {}

      if (!p && myCleanId) {
        try {
          const { data: profByNpm } = await supabase
            .from('profiles')
            .select('*')
            .or(`npm.eq.${myCleanId},nim.eq.${myCleanId}`)
            .maybeSingle();
          p = profByNpm;
        } catch {}
      }

      const cachedAvatar = (() => {
        try {
          return localStorage.getItem('simak_avatar_' + user.id);
        } catch {
          return null;
        }
      })();
      const effectiveAvatar = p?.avatar_url || cachedAvatar || null;
      if (p?.avatar_url && p.avatar_url !== cachedAvatar) {
        try {
          localStorage.setItem('simak_avatar_' + user.id, p.avatar_url);
        } catch {}
      }

      const studentId = p?.npm || p?.nim || user.npm || user.nim || '-';
      const cleanId = normalizeStudentId(studentId);
      const ov = overrides[cleanId] || myOverride;

      const finalPhone = p?.phone || localExtra?.phone || null;
      const finalProdi = p?.study_program || localExtra?.study_program || null;
      const finalBio = p?.bio || localExtra?.bio || null;
      const finalFullName = ov?.full_name || p?.full_name || localExtra?.full_name || user.fullName;

      setProfile({
        id: p?.id || user.id,
        npm: studentId,
        nim: studentId,
        fullName: finalFullName,
        division: ov?.division || p?.division || user.division,
        role: ov?.role || p?.role || user.role,
        phone: finalPhone,
        studyProgram: finalProdi,
        bio: finalBio,
        avatarUrl: effectiveAvatar,
      });
      setEditFullName(finalFullName);
      setEditPhone(finalPhone || '');
      setEditStudyProgram(finalProdi || '');
      setEditBio(finalBio || '');
    } catch {
      if (myOverride || localExtra) {
        setProfile((prev) => ({
          ...prev,
          fullName: myOverride?.full_name || localExtra?.full_name || prev.fullName,
          division: myOverride?.division || prev.division,
          role: myOverride?.role || prev.role,
          phone: localExtra?.phone || prev.phone,
          studyProgram: localExtra?.study_program || prev.studyProgram,
          bio: localExtra?.bio || prev.bio,
        }));
        if (localExtra?.phone) setEditPhone(localExtra.phone);
        if (localExtra?.study_program) setEditStudyProgram(localExtra.study_program);
        if (localExtra?.bio) setEditBio(localExtra.bio);
      }
    }
  };

  // Simpan Pengaturan Profil Mandiri Anggota
  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editFullName.trim()) {
      showToast('Nama lengkap tidak boleh kosong.', 'error');
      return;
    }

    setIsSavingProfile(true);
    const cleanNpm = normalizeStudentId(profile.npm || profile.nim || user.npm || user.nim);
    const updatedData = {
      full_name: editFullName.trim(),
      phone: editPhone.trim() || null,
      study_program: editStudyProgram.trim() || null,
      bio: editBio.trim() || null,
    };

    try {
      // 1. Simpan ke local storage secara permanen (Primary Cache agar aman saat refresh)
      try {
        localStorage.setItem('simak_profile_extra_' + user.id, JSON.stringify(updatedData));
        if (cleanNpm) {
          localStorage.setItem('simak_profile_extra_' + cleanNpm, JSON.stringify(updatedData));
        }

        // Update whitelist overrides agar sinkron ke seluruh modul
        const rawOv = localStorage.getItem('simak_whitelist_overrides');
        let ovMap: Record<string, any> = {};
        if (rawOv) ovMap = JSON.parse(rawOv);
        ovMap[cleanNpm] = {
          ...(ovMap[cleanNpm] || {}),
          full_name: editFullName.trim(),
          phone: editPhone.trim() || null,
          study_program: editStudyProgram.trim() || null,
          bio: editBio.trim() || null,
        };
        localStorage.setItem('simak_whitelist_overrides', JSON.stringify(ovMap));

        // Update session jika nama berubah
        const rawSession = localStorage.getItem('simak_user_session');
        if (rawSession) {
          const sess = JSON.parse(rawSession);
          sess.fullName = editFullName.trim();
          localStorage.setItem('simak_user_session', JSON.stringify(sess));
        }
      } catch (lsErr) {
        console.warn('Gagal menyimpan cache profil lokal:', lsErr);
      }

      // 2. Sinkronisasi ke Supabase jika bukan demo
      if (!user.id.startsWith('demo-')) {
        try {
          // Update berdasarkan id
          await (supabase.from('profiles') as any).update({
            full_name: editFullName.trim(),
            phone: editPhone.trim() || null,
            study_program: editStudyProgram.trim() || null,
            bio: editBio.trim() || null,
          }).eq('id', user.id);

          // Update juga berdasarkan npm jika ada
          if (cleanNpm) {
            await (supabase.from('profiles') as any).update({
              full_name: editFullName.trim(),
              phone: editPhone.trim() || null,
              study_program: editStudyProgram.trim() || null,
              bio: editBio.trim() || null,
            }).or(`npm.eq.${cleanNpm},nim.eq.${cleanNpm}`);

            // Update member_evaluations agar sinkron di leaderboard & rapor
            await (supabase.from('member_evaluations') as any).update({
              full_name: editFullName.trim(),
            }).or(`user_id.eq.${user.id},npm.eq.${cleanNpm}`);
          }
        } catch (dbErr) {
          console.warn('Supabase sync note:', dbErr);
        }
      }

      setProfile((prev) => ({
        ...prev,
        fullName: editFullName.trim(),
        phone: editPhone.trim() || null,
        studyProgram: editStudyProgram.trim() || null,
        bio: editBio.trim() || null,
      }));

      showToast('Profil Anda berhasil diperbarui dan tersimpan permanen!', 'success');
      setShowProfileModal(false);
      fetchProfile();
      fetchEvaluation();
    } catch (err: any) {
      showToast(err.message || 'Gagal menyimpan pembaruan profil.', 'error');
    } finally {
      setIsSavingProfile(false);
    }
  };

  // Fetch Leaderboard Keaktifan untuk Anggota & BPH (Tersimpan Permanen di Supabase & Local Cache)
  const fetchLeaderboard = async () => {
    setIsLoadingLeaderboard(true);
    let overrides: Record<string, any> = {};
    try {
      const rawOv = localStorage.getItem('simak_whitelist_overrides');
      if (rawOv) overrides = JSON.parse(rawOv);
    } catch {}

    const applyOverrides = (list: MemberEvaluation[]): MemberEvaluation[] => {
      return list.map((item) => {
        const cleanId = normalizeStudentId(item.npm || item.nim);
        const ov = overrides[cleanId];
        if (ov) {
          return {
            ...item,
            full_name: ov.full_name || item.full_name,
            division: ov.division || item.division,
            role: ov.role || item.role,
          };
        }
        return item;
      });
    };

    try {
      const { data, error } = await supabase
        .from('member_evaluations')
        .select('*')
        .order('total_points', { ascending: false });

      if (error) throw error;
      if (data && data.length > 0) {
        const mapped: MemberEvaluation[] = data.map((d: any) => ({
          ...d,
          npm: d.npm || d.nim || '-',
          nim: d.npm || d.nim || '-',
        }));
        const finalLb = applyEvaluationsOverrides(applyOverrides(mapped));
        setLeaderboard(finalLb);
        localStorage.setItem('simak_leaderboard_cache', JSON.stringify(finalLb));
      } else {
        const cached = localStorage.getItem('simak_leaderboard_cache');
        if (cached) {
          setLeaderboard(applyEvaluationsOverrides(applyOverrides(JSON.parse(cached))));
        } else {
          setLeaderboard(applyEvaluationsOverrides(applyOverrides(DEFAULT_SAMPLE_LEADERBOARD)));
        }
      }
    } catch {
      const cached = localStorage.getItem('simak_leaderboard_cache');
      if (cached) {
        setLeaderboard(applyEvaluationsOverrides(applyOverrides(JSON.parse(cached))));
      } else {
        setLeaderboard(applyEvaluationsOverrides(applyOverrides(DEFAULT_SAMPLE_LEADERBOARD)));
      }
    } finally {
      setIsLoadingLeaderboard(false);
    }
  };

  // 2. Fetch Evaluasi Keaktifan secara independen (Supabase View + Local Persistence + Overrides)
  const fetchEvaluation = async () => {
    let localOverride: any = null;
    try {
      const rawOv = localStorage.getItem(EVALUATIONS_OVERRIDES_KEY);
      if (rawOv) {
        const ovMap = JSON.parse(rawOv);
        const cleanId = normalizeStudentId(user.npm || user.nim || profile.npm);
        localOverride = ovMap[cleanId] || ovMap[user.id];
      }
    } catch {}
    if (!localOverride) {
      try {
        const rawLocal = localStorage.getItem('simak_eval_' + user.id);
        if (rawLocal) localOverride = JSON.parse(rawLocal);
      } catch {}
    }

    try {
      const { data: evalData } = await supabase
        .from('member_evaluations')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();

      const ev = evalData as any;
      if (ev) {
        let loadedEval: MemberEvaluation = {
          user_id: user.id,
          npm: ev.npm || ev.nim || profile.npm,
          nim: ev.npm || ev.nim || profile.npm,
          email: ev.email || null,
          full_name: ev.full_name || profile.fullName,
          division: ev.division || (profile.division as any),
          role: ev.role || profile.role,
          avatar_url: ev.avatar_url || (() => {
            try {
              return localStorage.getItem('simak_avatar_' + user.id) || null;
            } catch {
              return null;
            }
          })(),
          total_points: Number(ev.total_points ?? 0),
          total_hadir: Number(ev.total_hadir ?? 0),
          total_izin: Number(ev.total_izin ?? 0),
          total_alfa: Number(ev.total_alfa ?? 0),
          attendance_percentage: Number(ev.attendance_percentage ?? 0),
          predicate: ev.predicate || 'Anggota Baru',
        };

        if (
          localOverride &&
          (localOverride.total_points > loadedEval.total_points ||
            localOverride.total_hadir > loadedEval.total_hadir)
        ) {
          loadedEval = {
            ...loadedEval,
            total_points: localOverride.total_points,
            total_hadir: localOverride.total_hadir,
            attendance_percentage:
              localOverride.attendance_percentage ?? loadedEval.attendance_percentage,
            predicate: localOverride.predicate || loadedEval.predicate,
          };
        }

        setEvaluation(loadedEval);
        localStorage.setItem('simak_eval_' + user.id, JSON.stringify(loadedEval));
      } else if (localOverride) {
        setEvaluation(localOverride);
        localStorage.setItem('simak_eval_' + user.id, JSON.stringify(localOverride));
      } else {
        const cached = localStorage.getItem('simak_eval_' + user.id);
        if (cached) {
          setEvaluation(JSON.parse(cached));
        }
      }
    } catch {
      if (localOverride) {
        setEvaluation(localOverride);
        localStorage.setItem('simak_eval_' + user.id, JSON.stringify(localOverride));
      } else {
        const cached = localStorage.getItem('simak_eval_' + user.id);
        if (cached) {
          setEvaluation(JSON.parse(cached));
        }
      }
    }
  };

  // 3. Fetch Agenda Terjadwal (events aktif dengan dukungan overrides lokal & realtime sync)
  const fetchEvents = async () => {
    try {
      const { data: eventData } = await supabase
        .from('events')
        .select('*')
        .order('event_date', { ascending: true });

      let eventOverrides: Record<string, any> = {};
      try {
        const raw = localStorage.getItem('simak_events_overrides');
        if (raw) eventOverrides = JSON.parse(raw);
      } catch {}

      const base = (eventData && eventData.length > 0) ? eventData : DEFAULT_SAMPLE_EVENTS;
      const merged = base.map((ev: any) => {
        const ov = eventOverrides[ev.id];
        return ov ? { ...ev, ...ov } : ev;
      });

      for (const [ovId, ovEv] of Object.entries(eventOverrides)) {
        if (!merged.some((e: any) => e.id === ovId)) {
          merged.unshift(ovEv);
        }
      }

      const activeEvents = filterDeletedEvents(merged.filter((ev: any) => ev.is_active !== false) as EventType[]);
      setEvents(activeEvents);
      // Cek dan jadwalkan pengingat otomatis jika ada agenda dalam 24 jam ke depan
      checkUpcomingAgendaReminders(activeEvents);
    } catch {
      let eventOverrides: Record<string, any> = {};
      try {
        const raw = localStorage.getItem('simak_events_overrides');
        if (raw) eventOverrides = JSON.parse(raw);
      } catch {}

      const merged = DEFAULT_SAMPLE_EVENTS.map((ev: any) => {
        const ov = eventOverrides[ev.id];
        return ov ? { ...ev, ...ov } : ev;
      });
      const activeEvents = filterDeletedEvents(merged.filter((ev: any) => ev.is_active !== false) as EventType[]);
      setEvents(activeEvents);
    }
  };

  // 4. Fetch Riwayat Kehadiran Anggota (Sinkron Supabase + Cache Offline)
  const fetchAttendances = async () => {
    try {
      const { data: attData } = await supabase
        .from('attendances')
        .select('id, event_id, status, proof_url, verified, scanned_at')
        .eq('user_id', user.id)
        .order('scanned_at', { ascending: false });

      let listToEnrich = (attData as any[]) || [];

      // Gabungkan dengan data lokal di localStorage agar tidak hilang saat reload
      const localSaved = localStorage.getItem('simak_attendances_' + user.id);
      if (localSaved) {
        try {
          const parsed = JSON.parse(localSaved);
          const existingIds = new Set(listToEnrich.map((a: any) => a.id));
          for (const item of parsed) {
            if (!existingIds.has(item.id)) {
              listToEnrich.push(item);
            }
          }
        } catch {}
      }

      // Gabungkan juga dari simak_all_attendances yang cocok dengan user.id atau NPM/NIM
      try {
        const cleanUserNpm = normalizeStudentId(user.npm || user.nim || profile.npm);
        const rawAll = localStorage.getItem('simak_all_attendances');
        if (rawAll) {
          const allList = JSON.parse(rawAll);
          const matched = allList.filter(
            (item: any) =>
              item.user_id === user.id ||
              (cleanUserNpm && normalizeStudentId(item.npm || item.nim) === cleanUserNpm)
          );
          const existingEventIds = new Set(listToEnrich.map((a: any) => a.event_id));
          const existingIds = new Set(listToEnrich.map((a: any) => a.id));
          for (const m of matched) {
            if (!existingIds.has(m.id) && !existingEventIds.has(m.event_id)) {
              listToEnrich.unshift(m);
              existingIds.add(m.id);
              existingEventIds.add(m.event_id);
            }
          }
        }
      } catch {}

      // Bersihkan presensi yang ada di blacklist hapus
      listToEnrich = filterDeletedAttendances(listToEnrich);

      if (listToEnrich.length > 0) {
        const eventIds = [...new Set(listToEnrich.map((a: any) => a.event_id))];
        const { data: relatedEvents } = await supabase
          .from('events')
          .select('id, title, points, event_date, category')
          .in('id', eventIds);

        const eventMap = new Map((relatedEvents || []).map((e: any) => [e.id, e]));

        const enriched: AttendanceRecord[] = listToEnrich.map((a: any) => {
          const ev: any = eventMap.get(a.event_id) || events.find((e) => e.id === a.event_id);
          return {
            id: a.id,
            event_id: a.event_id,
            status: a.status,
            proof_url: a.proof_url,
            verified: a.verified,
            scanned_at: a.scanned_at,
            event_title: ev?.title || a.event_title || 'Agenda Kegiatan GenBI',
            event_points: ev?.points || a.event_points || 10,
            event_date: ev?.event_date || a.event_date,
            event_category: ev?.category || a.event_category || 'Proker',
          };
        });
        setAttendances(enriched);
        localStorage.setItem('simak_attendances_' + user.id, JSON.stringify(enriched));
      } else {
        setAttendances([]);
      }
    } catch {
      const localSaved = localStorage.getItem('simak_attendances_' + user.id);
      if (localSaved) {
        try {
          setAttendances(filterDeletedAttendances(JSON.parse(localSaved)));
          return;
        } catch {}
      }
      setAttendances(filterDeletedAttendances(DEFAULT_SAMPLE_ATTENDANCES));
    }
  };

  useEffect(() => {
    fetchProfile();
    fetchEvaluation();
    fetchEvents();
    fetchAttendances();
    fetchLeaderboard();

    const handleSync = (event: any) => {
      const detail = event?.detail;
      if (!detail?.npm) return;
      const cleanTargetId = normalizeStudentId(detail.npm);
      const myCleanId = normalizeStudentId(user.npm || user.nim);

      if (cleanTargetId === myCleanId) {
        setProfile((prev) => ({
          ...prev,
          fullName: detail.full_name || prev.fullName,
          division: detail.division || prev.division,
          role: detail.role || prev.role,
        }));
      }

      setLeaderboard((prev) =>
        prev.map((item) => {
          if (normalizeStudentId(item.npm || item.nim) === cleanTargetId) {
            return {
              ...item,
              full_name: detail.full_name || item.full_name,
              division: detail.division || item.division,
              role: detail.role || item.role,
            };
          }
          return item;
        })
      );
    };

    // Listener Realtime Event & Attendance Sync
    const handleEventSync = (e: any) => {
      const synced = e?.detail;
      if (!synced?.id) return;
      setEvents((prev) => [synced, ...prev.filter((ev) => ev.id !== synced.id)]);
    };

    const handleEventDeleted = (e: any) => {
      const delId = e?.detail?.id;
      if (!delId) return;
      setEvents((prev) => prev.filter((ev) => ev.id !== delId));
    };

    const handleAttDeleted = (e: any) => {
      const delId = e?.detail?.id;
      if (!delId) return;
      setAttendances((prev) => prev.filter((a) => a.id !== delId));
      fetchEvaluation();
      fetchLeaderboard();
    };

    const handleAttVerified = (e: any) => {
      const verifiedId = e?.detail?.id;
      if (!verifiedId) return;
      setAttendances((prev) =>
        prev.map((a) => (a.id === verifiedId ? { ...a, verified: true } : a))
      );
      fetchEvaluation();
      fetchLeaderboard();
    };

    const handleAttSubmittedOrSynced = () => {
      fetchAttendances();
      fetchEvaluation();
      fetchLeaderboard();
    };

    const updateOfflineCount = () => {
      setOfflineQueueCount(getOfflineQueue().length);
    };

    const handleLockSync = (e: any) => {
      const detail = e?.detail;
      if (detail?.eventId) {
        if (detail.is_active === false) {
          setEvents((prev) => prev.filter((ev) => ev.id !== detail.eventId));
        } else {
          fetchEvents();
        }
      }
    };

    window.addEventListener('simak_member_sync', handleSync);
    window.addEventListener('simak_event_sync', handleEventSync);
    window.addEventListener('simak_event_lock_sync', handleLockSync);
    window.addEventListener('simak_event_deleted', handleEventDeleted);
    window.addEventListener('simak_attendance_deleted', handleAttDeleted);
    window.addEventListener('simak_attendance_verified', handleAttVerified);
    window.addEventListener('simak_attendance_submitted', handleAttSubmittedOrSynced);
    window.addEventListener('simak_attendance_sync', handleAttSubmittedOrSynced);
    window.addEventListener('simak_evaluations_sync', handleAttSubmittedOrSynced);
    window.addEventListener('simak_offline_synced', updateOfflineCount);
    window.addEventListener('online', updateOfflineCount);
    window.addEventListener('offline', updateOfflineCount);

    const cleanupOffline = initOfflineQueueSync(
      async (queued) => {
        try {
          await handleProcessAttendanceToken(queued.token);
          return true;
        } catch {
          return false;
        }
      },
      (isOnline, queueCount) => {
        setOfflineQueueCount(queueCount);
        if (isOnline && queueCount > 0) {
          showToast(`Sinyal pulih! Memproses ${queueCount} presensi offline...`, 'info');
        }
      }
    );

    return () => {
      cleanupOffline();
      window.removeEventListener('simak_member_sync', handleSync);
      window.removeEventListener('simak_event_sync', handleEventSync);
      window.removeEventListener('simak_event_lock_sync', handleLockSync);
      window.removeEventListener('simak_event_deleted', handleEventDeleted);
      window.removeEventListener('simak_attendance_deleted', handleAttDeleted);
      window.removeEventListener('simak_attendance_verified', handleAttVerified);
      window.removeEventListener('simak_attendance_submitted', handleAttSubmittedOrSynced);
      window.removeEventListener('simak_attendance_sync', handleAttSubmittedOrSynced);
      window.removeEventListener('simak_evaluations_sync', handleAttSubmittedOrSynced);
      window.removeEventListener('simak_offline_synced', updateOfflineCount);
      window.removeEventListener('online', updateOfflineCount);
      window.removeEventListener('offline', updateOfflineCount);
    };
  }, [user.id, user.role, user.division]);

  // Handler Sinkronisasi Manual Antrean Offline
  const handleManualSyncQueue = async () => {
    setIsSyncingQueue(true);
    try {
      const processed = await flushOfflineQueue(async (queued) => {
        try {
          await handleProcessAttendanceToken(queued.token);
          return true;
        } catch {
          return false;
        }
      });
      setOfflineQueueCount(getOfflineQueue().length);
      if (processed > 0) {
        showToast(`Berhasil mensinkronkan ${processed} data presensi offline!`, 'success');
      } else {
        showToast('Antrean sedang diproses atau sudah kosong.', 'info');
      }
    } catch {
      showToast('Gagal memproses antrean offline.', 'error');
    } finally {
      setIsSyncingQueue(false);
    }
  };

  // Timer QR dinamis anti-titip absen
  useEffect(() => {
    let interval: ReturnType<typeof setInterval>;
    if (showQrModal) {
      interval = setInterval(() => {
        setQrCodeTimer((prev) => (prev > 1 ? prev - 1 : 45));
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [showQrModal]);

  // Handler Scan dari File Foto Kamera HP / Galeri (Bisa berjalan di browser HP tanpa kendala HTTPS)
  const handleScanFromImageFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsScanningImage(true);
    setScannerMessage(null);
    try {
      const html5QrCode = new Html5Qrcode('qr-reader-file-temp');
      const decodedText = await html5QrCode.scanFile(file, true);
      html5QrCode.clear();
      handleProcessAttendanceToken(decodedText);
    } catch {
      setScannerMessage({
        type: 'error',
        text: 'Tidak dapat mendeteksi barcode pada foto yang diambil. Pastikan QR code terlihat jelas dan tidak blur, atau masukkan kode token secara manual.',
      });
    } finally {
      setIsScanningImage(false);
      e.target.value = '';
    }
  };

  // Hentikan streaming kamera dan bersihkan scanner
  const stopCameraScanner = async () => {
    setIsTorchOn(false);
    if (qrScannerRef.current) {
      try {
        if (qrScannerRef.current.isScanning) {
          await qrScannerRef.current.stop();
        }
      } catch {}
      try {
        qrScannerRef.current.clear();
      } catch {}
      qrScannerRef.current = null;
    }
    setIsCameraActive(false);
    setIsCameraStarting(false);
  };

  // Toggle Senter / Flashlight pada Scanner Kamera
  const toggleTorch = async () => {
    try {
      const videoEl = document.querySelector('#qr-reader video') as HTMLVideoElement;
      const track = videoEl?.srcObject
        ? (videoEl.srcObject as MediaStream).getVideoTracks()[0]
        : null;
      if (track) {
        const nextTorch = !isTorchOn;
        await (track.applyConstraints as any)({
          advanced: [{ torch: nextTorch }],
        });
        setIsTorchOn(nextTorch);
      } else {
        showToast('Fitur senter/flashlight memerlukan kamera belakang aktif.', 'warning');
      }
    } catch {
      showToast('Senter/Flashlight tidak didukung pada browser atau perangkat ini.', 'warning');
    }
  };

  // Update Password / PIN Mandiri Anggota
  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPassword || newPassword.length < 4) {
      showToast('PIN / Password baru minimal 4 karakter!', 'warning');
      return;
    }
    if (newPassword !== confirmPassword) {
      showToast('Konfirmasi PIN baru tidak cocok dengan PIN baru!', 'warning');
      return;
    }

    setIsUpdatingPassword(true);
    const cleanId = normalizeStudentId(user.npm || user.nim);

    try {
      const res = await changeUserPin(
        cleanId,
        oldPassword || 'genbi123',
        newPassword,
        user.fullName
      );

      if (!res.success) {
        showToast(res.message, 'error');
        return;
      }

      showToast(res.message, 'success');
      setOldPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setShowPasswordForm(false);
    } catch (err: any) {
      showToast('Gagal memperbarui PIN: ' + (err.message || 'Terjadi kesalahan'), 'error');
    } finally {
      setIsUpdatingPassword(false);
    }
  };

  // Toggle / Test Web Push Notification PWA
  const handleTogglePushNotification = async () => {
    if (typeof window === 'undefined' || !('Notification' in window)) {
      showToast('Browser ini belum mendukung Web Push Notification.', 'error');
      return;
    }

    const currentPermission = Notification.permission;

    if (currentPermission === 'denied') {
      showToast('Izin notifikasi diblokir browser. Buka setelan browser / info situs untuk mengizinkan notifikasi.', 'error');
      return;
    }

    if (currentPermission === 'granted') {
      // Jika sudah diizinkan, kirimkan notifikasi tes ke PWA perangkat
      await sendWebNotification('Pengingat SIMAK GENBI Aktif 🔔', {
        body: 'Notifikasi presensi Anda aktif dan siap menerima jadwal kegiatan resmi.',
        icon: '/logo-genbi.png',
      });
      setIsPushEnabled(true);
      showToast('Notifikasi PWA aktif! Tes notifikasi telah dikirim ke perangkat Anda.', 'info');
      return;
    }

    // Jika belum diizinkan (default), minta izin
    const res = await requestNotificationPermission();
    if (res.granted) {
      setIsPushEnabled(true);
      showToast('Notifikasi pengingat agenda resmi berhasil diaktifkan!', 'success');
    } else {
      showToast('Izin notifikasi tidak diizinkan oleh pengguna.', 'error');
    }
  };

  // Share Agenda ke WhatsApp Broadcast
  const handleShareWhatsApp = (ev: EventType) => {
    const dateFormatted = formatDateTimeWIB(ev.event_date);
    const locationText = ev.require_location
      ? 'Kampus Universitas Majalengka (Wajib Presensi GPS di Lokasi)'
      : 'Kampus Universitas Majalengka';

    const text = `📢 *PENGUMUMAN KEGIATAN GENBI UNMA* 📢\n\n📌 *Acara*: ${ev.title}\n📂 *Kategori*: ${ev.category}\n🕒 *Waktu*: ${dateFormatted}\n📍 *Lokasi*: ${locationText}\n🎖️ *Bobot Poin*: +${ev.points} Poin Keaktifan\n🔑 *Kode Token Presensi*: ${ev.qr_token}\n\nMohon seluruh rekan-rekan penerima beasiswa Bank Indonesia hadir tepat waktu dan mengisi presensi via SIMAK GENBI:\n👉 ${window.location.origin}\n\n#GenBIUNMA #EnergiUntukNegeri #BankIndonesia`;

    window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`, '_blank');
  };

  // Jalankan kamera scanner viewfinder real-time
  const startCameraScanner = async (facing: 'environment' | 'user' = cameraFacing) => {
    setIsCameraStarting(true);
    setCameraError(null);
    setScannerMessage(null);

    // Pastikan scanner sebelumnya dibersihkan
    await stopCameraScanner();

    // Berikan toleransi render DOM elemen #qr-reader
    const readerElement = document.getElementById('qr-reader');
    if (!readerElement) {
      setTimeout(() => startCameraScanner(facing), 120);
      return;
    }

    try {
      const html5QrCode = new Html5Qrcode('qr-reader');
      qrScannerRef.current = html5QrCode;

      const scanConfig = {
        fps: 15,
        qrbox: (viewWidth: number, viewHeight: number) => {
          const edge = Math.min(viewWidth, viewHeight);
          const size = Math.max(180, Math.floor(edge * 0.72));
          return { width: size, height: size };
        },
        aspectRatio: 1.0,
      };

      try {
        await html5QrCode.start(
          { facingMode: facing },
          scanConfig,
          (decodedText) => {
            handleProcessAttendanceToken(decodedText);
          },
          () => {}
        );
        setIsCameraActive(true);
      } catch {
        // Fallback: telusuri device kamera yang ada
        const cameras = await Html5Qrcode.getCameras();
        if (cameras && cameras.length > 0) {
          const chosenCam =
            facing === 'environment'
              ? cameras.find(
                  (c) =>
                    c.label.toLowerCase().includes('back') ||
                    c.label.toLowerCase().includes('belakang') ||
                    c.label.toLowerCase().includes('environment')
                ) || cameras[0]
              : cameras.find(
                  (c) =>
                    c.label.toLowerCase().includes('front') ||
                    c.label.toLowerCase().includes('depan') ||
                    c.label.toLowerCase().includes('user')
                ) || cameras[cameras.length - 1];

          await html5QrCode.start(
            chosenCam.id,
            scanConfig,
            (decodedText) => {
              handleProcessAttendanceToken(decodedText);
            },
            () => {}
          );
          setIsCameraActive(true);
        } else {
          throw new Error('Tidak ada kamera yang dapat diakses oleh browser.');
        }
      }
    } catch (camErr: any) {
      console.warn('Camera scanner exception:', camErr);
      const msg = camErr?.message || '';
      if (msg.includes('NotAllowedError') || msg.includes('Permission')) {
        setCameraError('Izin kamera ditolak oleh browser. Buka pengaturan browser smartphone Anda dan izinkan akses kamera untuk situs ini.');
      } else if (!window.isSecureContext && location.hostname !== 'localhost') {
        setCameraError(
          'Browser smartphone membatasi streaming kamera karena tidak menggunakan HTTPS. Buka aplikasi via URL HTTPS (contoh: https://...) atau ambil foto barcode di bawah.'
        );
      } else {
        setCameraError(msg || 'Gagal memulai streaming kamera scanner. Silakan coba lagi atau gunakan tombol foto di bawah.');
      }
    } finally {
      setIsCameraStarting(false);
    }
  };

  // Kamera Scanner lifecycle
  useEffect(() => {
    if (showScanModal && scanMode === 'camera') {
      const timer = setTimeout(() => {
        startCameraScanner(cameraFacing);
      }, 150);

      return () => {
        clearTimeout(timer);
        stopCameraScanner();
      };
    } else {
      stopCameraScanner();
    }
  }, [showScanModal, scanMode, cameraFacing]);

  // Fungsi Hitung Jarak Geografis (Haversine Formula dalam Meter)
  const calculateDistanceMeters = (lat1: number, lon1: number, lat2: number, lon2: number) => {
    const R = 6371e3; // Radius bumi dalam meter
    const phi1 = (lat1 * Math.PI) / 180;
    const phi2 = (lat2 * Math.PI) / 180;
    const deltaPhi = ((lat2 - lat1) * Math.PI) / 180;
    const deltaLambda = ((lon2 - lon1) * Math.PI) / 180;

    const a =
      Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
      Math.cos(phi1) * Math.cos(phi2) * Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return Math.round(R * c);
  };

  // Render & Unduh Smart ID Card Vertikal Resmi SIMAK GENBI (100% Identik & Presisi dengan Preview via html2canvas 3x Scale)
  const handleDownloadCardPng = async () => {
    if (!memberCardRef.current) return;
    setIsDownloadingCard(true);
    try {
      const cardEl = memberCardRef.current;
      const canvas = await html2canvas(cardEl, {
        scale: 3, // Skala 3x Ultra-HD Retina (990 x 1564 px) untuk hasil unduhan super tajam dan jernih
        useCORS: true,
        allowTaint: true,
        backgroundColor: null,
        logging: false,
      });

      const image = canvas.toDataURL('image/png');
      const link = document.createElement('a');
      link.href = image;
      const sideName = cardSide === 'front' ? 'Depan' : 'Belakang';
      link.download = `SmartID_SIMAK_GENBI_${profile.npm || profile.nim}_${sideName}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      showToast(`Smart ID Card (${sideName}) berhasil diunduh dengan kualitas HD!`, 'success');
    } catch (err: any) {
      showToast('Gagal mengunduh kartu digital: ' + (err?.message || ''), 'error');
    } finally {
      setIsDownloadingCard(false);
    }
  };

  // Validasi presensi dengan qr_token asli + Geofencing GPS Kampus UNMA
  const handleProcessAttendanceToken = async (token: string) => {
    const cleanToken = token.trim();
    if (!cleanToken) {
      setScannerMessage({ type: 'error', text: 'Kode token wajib diisi.' });
      return;
    }

    setIsSubmittingAttendance(true);
    setScannerMessage(null);

    try {
      const matchedEvent = events.find(
        (e) => e.qr_token.toUpperCase() === cleanToken.toUpperCase()
      );

      if (!matchedEvent) {
        setScannerMessage({
          type: 'error',
          text: `Kode token "${cleanToken}" tidak valid atau sesi kegiatan sudah dikunci pengurus.`,
        });
        setIsSubmittingAttendance(false);
        return;
      }

      let userLat: number | null = null;
      let userLng: number | null = null;
      let locationNote = '';

      // User wajib aktifkan GPS saat presensi untuk mencatat koordinat lokasi nyata
      if (navigator.geolocation) {
        try {
          const position = await new Promise<GeolocationPosition>((resolve, reject) => {
            navigator.geolocation.getCurrentPosition(resolve, reject, {
              enableHighAccuracy: true,
              timeout: 6000,
              maximumAge: 0,
            });
          });
          userLat = position.coords.latitude;
          userLng = position.coords.longitude;
          locationNote = ` (Koordinat: ${userLat.toFixed(4)}, ${userLng.toFixed(4)})`;

          // Jika acara memiliki target lokasi & radius khusus yang ditentukan oleh BPH
          if (
            matchedEvent.require_location &&
            matchedEvent.target_lat &&
            matchedEvent.target_lng
          ) {
            const maxRadius = matchedEvent.radius_meters ?? 250;
            const distance = calculateDistanceMeters(
              userLat,
              userLng,
              matchedEvent.target_lat,
              matchedEvent.target_lng
            );

            if (distance > maxRadius) {
              throw new Error(
                `Presensi ditolak: Anda berada di luar radius lokasi pelaksanaan acara (${distance}m dari titik acara, batas toleransi: ${maxRadius}m).`
              );
            }
          }
        } catch (geoErr: any) {
          if (matchedEvent.require_location) {
            throw new Error(
              geoErr?.message ||
                'Wajib mengaktifkan GPS pada perangkat Anda untuk presensi acara ini.'
            );
          }
        }
      } else if (matchedEvent.require_location) {
        throw new Error('Perangkat Anda tidak mendukung fitur lokasi GPS.');
      }

      // Catat presensi secara terpadu ke seluruh subsistem & broadcast (Sinkron 100%)
      await recordUnifiedAttendance({
        eventId: matchedEvent.id,
        userId: user.id,
        userFullName: profile.fullName || user.fullName,
        userNpm: profile.npm || user.npm || user.nim || '-',
        userDivision: profile.division || user.division,
        userRole: (profile.role as Role) || user.role,
        eventTitle: matchedEvent.title,
        eventPoints: matchedEvent.points,
        eventCategory: matchedEvent.category,
        eventDate: matchedEvent.event_date,
        status: 'hadir',
        verified: true,
        userLat,
        userLng,
      });

      if (!navigator.onLine) {
        enqueueOfflineAttendance({
          userId: user.id,
          token: cleanToken,
          userLat,
          userLng,
          eventTitle: matchedEvent.title,
        });
        showToast('Presensi offline tersimpan di antrean perangkat.', 'info');
      }

      // Re-fetch data segar dari seluruh cache terpadu & database
      fetchLeaderboard();
      fetchEvaluation();
      fetchAttendances();

      const newTotalPoints = evaluation.total_points + matchedEvent.points;
      const newPredicate: EvaluationPredicate =
        newTotalPoints >= 80 ? 'Sangat Aktif' :
        newTotalPoints >= 60 ? 'Aktif' : 'Perlu Pembinaan';

      // 5. Hentikan kamera dan tutup modal scanner
      await stopCameraScanner();
      setShowScanModal(false);

      // 6. Haptic Vibration & Audio Feedback
      if (typeof navigator !== 'undefined' && navigator.vibrate) {
        navigator.vibrate([100, 50, 100]);
      }
      try {
        const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
        if (AudioCtx) {
          const ctx = new AudioCtx();
          const playNote = (freq: number, start: number, duration: number) => {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = 'sine';
            osc.frequency.setValueAtTime(freq, ctx.currentTime + start);
            gain.gain.setValueAtTime(0.12, ctx.currentTime + start);
            gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + start + duration);
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.start(ctx.currentTime + start);
            osc.stop(ctx.currentTime + start + duration);
          };
          playNote(523.25, 0, 0.14); // C5
          playNote(659.25, 0.1, 0.14); // E5
          playNote(783.99, 0.2, 0.22); // G5
          playNote(1046.5, 0.32, 0.35); // C6
        }
      } catch {}

      // 7. Tampilkan Pop-Up Notifikasi Berhasil Presensi yang Megah
      setAttendanceSuccessData({
        eventTitle: matchedEvent.title,
        category: matchedEvent.category,
        pointsAdded: matchedEvent.points,
        totalPoints: newTotalPoints,
        predicate: newPredicate,
        scannedAt: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) + ' WIB',
        locationNote: locationNote ? `Kampus UNMA ${locationNote}` : 'Terverifikasi Lokasi Kampus UNMA',
      });
      setShowSuccessModal(true);
      showToast(`Presensi berhasil: ${matchedEvent.title} (+${matchedEvent.points} Poin)!`, 'success');
    } catch (err: any) {
      setScannerMessage({
        type: 'error',
        text: err.message || 'Gagal memproses presensi.',
      });
    } finally {
      setIsSubmittingAttendance(false);
    }
  };

  // Submit Ajukan Izin dengan Integrasi Google Drive (Mesin SIAPOS) & Supabase
  const handleAjukanIzin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedEventId) {
      showToast('Pilih agenda kegiatan yang ingin diajukan izin.', 'warning');
      return;
    }
    if (!keteranganIzin.trim() || keteranganIzin.trim().length < 5) {
      showToast('Keterangan alasan izin wajib diisi secara jelas (minimal 5 karakter).', 'warning');
      return;
    }
    if (!proofFile && !proofUrl.trim()) {
      showToast('Wajib melampirkan foto surat dokter, surat dispensasi, atau bukti pendukung lainnya.', 'warning');
      return;
    }

    setIsUploadingProof(true);
    try {
      let finalProofUrl = proofUrl.trim();
      const currentEvent = events.find((ev) => ev.id === selectedEventId);
      const fullNote = keteranganIzin ? `${alasanIzin} (${keteranganIzin})` : alasanIzin;

      // Jika ada file bukti yang diunggah pengguna (Surat Sakit, Dispensasi, dll)
      if (proofFile) {
        showToast('Mengunggah berkas ke Google Drive...', 'info');
        const uploadResult = await uploadProofToGDrive(proofFile, {
          uploaderNpm: profile.npm || profile.nim,
          uploaderName: profile.fullName,
          eventTitle: currentEvent?.title || 'Agenda GenBI',
          reason: fullNote,
        });

        finalProofUrl = uploadResult.fileUrl;
      }

      // Catat ke Database Supabase
      try {
        const { error } = await (supabase.from('attendances') as any).insert({
          event_id: selectedEventId,
          user_id: user.id,
          status: 'izin',
          proof_url: finalProofUrl || fullNote,
          verified: false,
        });

        if (error) {
          if (error.code === '23505' || error.message.includes('unique')) {
            showToast('Anda sudah pernah mengajukan presensi/izin untuk agenda ini.', 'warning');
            setIsUploadingProof(false);
            return;
          }
          console.warn('Supabase izin insert note:', error.message);
        }
      } catch (dbErr: any) {
        console.warn('Database note:', dbErr?.message);
      }

      // Simpan juga ke state dan cache lokal
      const newIzin: AttendanceRecord = {
        id: 'izin-' + Date.now(),
        event_id: selectedEventId,
        status: 'izin',
        proof_url: finalProofUrl || fullNote,
        verified: false,
        scanned_at: new Date().toISOString(),
        event_title: currentEvent?.title || 'Agenda Kegiatan GenBI',
        event_points: 0,
        event_date: currentEvent?.event_date,
        event_category: currentEvent?.category,
      };

      setAttendances((prev) => {
        const next = [newIzin, ...prev];
        localStorage.setItem('simak_attendances_' + user.id, JSON.stringify(next));
        return next;
      });

      // Sinkronkan ke simak_all_attendances untuk dibaca instan oleh Admin
      try {
        const storedAllRaw = localStorage.getItem('simak_all_attendances');
        const storedAll = storedAllRaw ? JSON.parse(storedAllRaw) : [];
        storedAll.unshift({
          id: 'izin-' + Date.now(),
          event_id: selectedEventId,
          user_id: user.id,
          status: 'izin',
          proof_url: finalProofUrl || fullNote,
          verified: false,
          scanned_at: new Date().toISOString(),
          full_name: profile.fullName || user.fullName,
          npm: profile.npm || user.npm || user.nim || '-',
          nim: profile.npm || user.npm || user.nim || '-',
          division: profile.division || user.division,
        });
        localStorage.setItem('simak_all_attendances', JSON.stringify(storedAll));
      } catch {}

      setIzinSuccess(true);
      setProofFile(null);
      setProofUrl('');
      setKeteranganIzin('');
      showToast('Pengajuan izin berhasil tersimpan dan diteruskan ke Pengurus BPH.', 'success');
      fetchEvaluation();
      fetchAttendances();
    } catch (err: any) {
      showToast(err.message || 'Gagal mengirim pengajuan izin.', 'error');
    } finally {
      setIsUploadingProof(false);
    }
  };

  // Helper Ambil Lokasi GPS Nyata untuk Presensi Delegasi BI
  const handleFetchDelegasiGps = () => {
    if (!navigator.geolocation) {
      showToast('Perangkat Anda tidak mendukung fitur lokasi GPS.', 'warning');
      return;
    }
    setIsFetchingDelegasiGps(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setDelegasiGps({
          lat: Number(pos.coords.latitude.toFixed(6)),
          lng: Number(pos.coords.longitude.toFixed(6)),
        });
        setIsFetchingDelegasiGps(false);
      },
      (err) => {
        setIsFetchingDelegasiGps(false);
        showToast('Gagal mengambil koordinat GPS: ' + err.message, 'error');
      },
      { timeout: 10000, enableHighAccuracy: true }
    );
  };

  // Submit Presensi Tugas Delegasi Bank Indonesia (Wilayah 9 & 10 Ciayumajakuning)
  const handleAjukanDelegasi = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!delegasiTitle.trim() || delegasiTitle.trim().length < 4) {
      showToast('Harap isi nama kegiatan penugasan delegasi Bank Indonesia dengan jelas.', 'warning');
      return;
    }
    if (!delegasiNote.trim() || delegasiNote.trim().length < 5) {
      showToast('Harap berikan deskripsi tugas delegasi atau nomor surat tugas (minimal 5 karakter).', 'warning');
      return;
    }
    if (!delegasiFile && !delegasiFileUrl.trim()) {
      showToast('Wajib melampirkan foto selfie kegiatan di lokasi acara atau foto ID Card tanda pengenal delegasi.', 'warning');
      return;
    }

    setIsUploadingDelegasi(true);
    try {
      let finalPhotoUrl = delegasiFileUrl.trim();

      // Deteksi GPS
      let lat = delegasiGps?.lat || null;
      let lng = delegasiGps?.lng || null;
      if (!lat && navigator.geolocation) {
        try {
          const pos = await new Promise<GeolocationPosition>((resolve, reject) => {
            navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 6000, enableHighAccuracy: true });
          });
          lat = Number(pos.coords.latitude.toFixed(6));
          lng = Number(pos.coords.longitude.toFixed(6));
        } catch {}
      }

      // Upload ke Google Drive
      if (delegasiFile) {
        showToast('Mengunggah bukti foto delegasi ke Google Drive...', 'info');
        const uploadResult = await uploadProofToGDrive(delegasiFile, {
          uploaderNpm: profile.npm || profile.nim,
          uploaderName: profile.fullName,
          eventTitle: `[DELEGASI BI] ${delegasiTitle} (${delegasiCity})`,
          reason: delegasiNote,
        });
        finalPhotoUrl = uploadResult.fileUrl;
      }

      const targetEventId = 'e4444444-4444-4444-4444-444444444444';

      const delegasiMetadata = JSON.stringify({
        isDelegasi: true,
        title: delegasiTitle.trim(),
        city: delegasiCity,
        note: delegasiNote.trim(),
        photoUrl: finalPhotoUrl,
        lat,
        lng,
        submittedAt: new Date().toISOString(),
      });

      // Insert ke Database Supabase attendances
      try {
        const { error } = await (supabase.from('attendances') as any).insert({
          event_id: targetEventId,
          user_id: user.id,
          status: 'delegasi',
          proof_url: delegasiMetadata,
          verified: false,
          user_lat: lat,
          user_lng: lng,
        });

        if (error) {
          if (error.code === '23505' || error.message.includes('unique')) {
            showToast('Anda sudah pernah mengajukan presensi delegasi pada agenda ini.', 'warning');
            setIsUploadingDelegasi(false);
            return;
          }
          console.warn('Supabase delegasi insert note:', error.message);
        }
      } catch (dbErr: any) {
        console.warn('Database note:', dbErr?.message);
      }

      // Simpan ke state dan cache lokal
      const newDelegasiItem: AttendanceRecord = {
        id: 'delegasi-' + Date.now(),
        event_id: targetEventId,
        status: 'delegasi',
        proof_url: delegasiMetadata,
        verified: false,
        scanned_at: new Date().toISOString(),
        event_title: `[DELEGASI BI] ${delegasiTitle} (${delegasiCity})`,
        event_points: 30,
        event_date: new Date().toISOString(),
        event_category: 'Wajib',
      };

      setAttendances((prev) => {
        const next = [newDelegasiItem, ...prev];
        localStorage.setItem('simak_attendances_' + user.id, JSON.stringify(next));
        return next;
      });

      // Simpan ke simak_all_attendances untuk sinkronisasi seketika ke Admin
      try {
        const storedAllRaw = localStorage.getItem('simak_all_attendances');
        const storedAll = storedAllRaw ? JSON.parse(storedAllRaw) : [];
        storedAll.unshift({
          id: 'delegasi-' + Date.now(),
          event_id: targetEventId,
          user_id: user.id,
          status: 'delegasi',
          proof_url: delegasiMetadata,
          verified: false,
          scanned_at: new Date().toISOString(),
          full_name: profile.fullName || user.fullName,
          npm: profile.npm || user.npm || user.nim || '-',
          nim: profile.npm || user.npm || user.nim || '-',
          division: profile.division || user.division,
          user_lat: lat,
          user_lng: lng,
        });
        localStorage.setItem('simak_all_attendances', JSON.stringify(storedAll));
      } catch {}

      setDelegasiSuccess(true);
      setDelegasiFile(null);
      setDelegasiFileUrl('');
      setDelegasiTitle('');
      setDelegasiNote('');
      showToast('Presensi tugas delegasi berhasil diajukan dan diteruskan ke BPH (+30 Poin).', 'success');
      fetchEvaluation();
      fetchAttendances();
    } catch (err: any) {
      showToast(err.message || 'Gagal mengirim presensi tugas delegasi.', 'error');
    } finally {
      setIsUploadingDelegasi(false);
    }
  };

  // Predicate Tier Helpers
  const getTierInfo = (points: number) => {
    if (points >= 90) {
      return {
        tierName: 'Platinum Garuda',
        color: 'from-amber-400 via-amber-300 to-yellow-500 text-slate-950',
        badgeBg: 'bg-gradient-to-r from-amber-400 to-yellow-500 text-slate-950 font-black',
        desc: 'Prioritas rekomendasi perpanjangan beasiswa Bank Indonesia & kepengurusan BPH.',
      };
    }
    if (points >= 75) {
      return {
        tierName: 'Gold Star',
        color: 'from-emerald-400 to-teal-500 text-white',
        badgeBg: 'bg-emerald-50 text-emerald-800 border-emerald-300',
        desc: 'Sangat aktif dalam seluruh agenda dan program kerja komisariat.',
      };
    }
    if (points >= 50) {
      return {
        tierName: 'Silver Member',
        color: 'from-blue-500 to-indigo-600 text-white',
        badgeBg: 'bg-blue-50 text-blue-800 border-blue-300',
        desc: 'Keaktifan reguler memenuhi batas standar evaluasi Bank Indonesia.',
      };
    }
    return {
      tierName: 'Bronze (Baru/Pembinaan)',
      color: 'from-slate-500 to-slate-700 text-white',
      badgeBg: 'bg-slate-100 text-slate-700 border-slate-300',
      desc: 'Tingkatkan presensi agenda wajib dan program kerja komisariat.',
    };
  };

  const currentTier = getTierInfo(evaluation.total_points);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 flex flex-col items-center relative overflow-x-hidden">
      {/* Background Micro Grid Pattern & Radial Mesh */}
      <div className="fixed inset-0 pointer-events-none -z-10">
        <div className="absolute inset-0 bg-[radial-gradient(#cbd5e1_1px,transparent_1px)] [background-size:24px_24px] opacity-40" />
        <div className="absolute -top-32 -left-32 w-96 h-96 rounded-full bg-blue-600/15 blur-3xl animate-pulse" />
        <div className="absolute top-1/3 -right-32 w-96 h-96 rounded-full bg-indigo-500/15 blur-3xl" />
        <div className="absolute bottom-10 left-1/4 w-96 h-96 rounded-full bg-cyan-400/10 blur-3xl" />
      </div>

      {/* Floating Toast Notification (Hijau = Sukses, Merah = Gagal/Error, Kuning = Info/Peringatan) */}
      {toast && (
        <div
          className={`fixed top-5 z-50 px-4 py-2.5 rounded-2xl shadow-2xl backdrop-blur-md border flex items-center gap-2.5 text-xs font-bold animate-in slide-in-from-top-4 duration-300 ${
            toast.type === 'error'
              ? 'bg-rose-600/95 text-white border-rose-400/50 shadow-rose-950/40'
              : toast.type === 'info' || toast.type === 'warning'
              ? 'bg-amber-400 text-slate-950 border-amber-300 shadow-amber-950/30 font-extrabold'
              : 'bg-emerald-600/95 text-white border-emerald-400/50 shadow-emerald-950/40'
          }`}
        >
          {toast.type === 'error' ? (
            <AlertCircle className="w-4 h-4 text-rose-100 shrink-0" />
          ) : toast.type === 'info' || toast.type === 'warning' ? (
            <Info className="w-4 h-4 text-slate-950 shrink-0" />
          ) : (
            <CheckCircle2 className="w-4 h-4 text-emerald-100 shrink-0" />
          )}
          <span>{toast.message}</span>
        </div>
      )}

      {/* Switch Banner jika BPH sedang melihat tampilan anggota */}
      {onSwitchToAdminView && (
        <div className="w-full bg-gradient-to-r from-blue-700 via-blue-800 to-indigo-900 text-white px-4 py-2.5 flex items-center justify-between text-xs shadow-md border-b border-blue-600/40 sticky top-0 z-40">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
            <span className="font-semibold">
              Mode Pratinjau Anggota (BPH) &bull; {profile.fullName}
            </span>
          </div>
          <button
            onClick={onSwitchToAdminView}
            className="px-3 py-1 bg-white text-blue-900 rounded-lg font-bold text-[11px] hover:bg-blue-50 transition shadow-xs cursor-pointer"
          >
            Kembali ke Panel BPH &rarr;
          </button>
        </div>
      )}

      {/* Main Container Responsif (Mobile-first, Max-5XL Desktop) */}
      <div className="w-full max-w-6xl xl:max-w-7xl min-h-screen flex flex-col pb-20">
        {/* Sticky Header Glassmorphism PWA */}
        <header className="sticky top-0 z-30 px-4 sm:px-8 py-3.5 bg-white/90 backdrop-blur-xl border-b border-slate-200/80 shadow-xs flex items-center justify-between">
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-2xl bg-white p-1.5 shadow-md shadow-blue-600/10 ring-2 ring-blue-100 border border-slate-100 flex items-center justify-center">
              <img
                src="/logo-genbi.png"
                alt="Logo GenBI UNMA"
                className="w-full h-full object-contain"
              />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="font-black text-base tracking-tight text-slate-900">SIMAK</span>
                <span className="font-black text-base tracking-tight bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-800 bg-clip-text text-transparent">
                  GENBI
                </span>
              </div>
              <p className="text-[10px] text-slate-400 font-bold tracking-wider uppercase leading-none">
                Komisariat UNMA
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Tag Role & Divisi Header */}
            {profile.role === 'admin' ? (
              <span className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-black bg-blue-100 text-blue-900 border border-blue-200 shadow-xs">
                <ShieldCheck className="w-3.5 h-3.5 text-blue-700" />
                BPH Komisariat
              </span>
            ) : profile.role === 'kadiv' ? (
              <span className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-black bg-gradient-to-r from-amber-500 to-amber-600 text-white shadow-xs">
                <Crown className="w-3.5 h-3.5 text-amber-200" />
                Kadiv {profile.division}
              </span>
            ) : (
              <span className="hidden sm:inline-flex items-center gap-1 px-3 py-1 rounded-full text-[11px] font-bold bg-blue-50 text-blue-700 border border-blue-200/80">
                <span className="w-1.5 h-1.5 rounded-full bg-blue-600 animate-pulse" />
                Divisi {profile.division}
              </span>
            )}

            {/* Tombol Lonceng Notifikasi PWA */}
            <button
              onClick={handleTogglePushNotification}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-bold transition cursor-pointer ${
                isPushEnabled
                  ? 'bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border-emerald-200'
                  : 'bg-slate-100 hover:bg-blue-50 text-slate-700 hover:text-blue-700 border-slate-200'
              }`}
              title={isPushEnabled ? 'Notifikasi PWA Aktif (Klik untuk kirim tes)' : 'Aktifkan Pengingat Notifikasi Presensi'}
            >
              <Bell className={`w-3.5 h-3.5 ${isPushEnabled ? 'text-emerald-600' : 'text-slate-500'}`} />
              <span className="hidden sm:inline">{isPushEnabled ? 'Notifikasi Aktif' : 'Notifikasi'}</span>
            </button>

            {/* Tombol Pengaturan Profil */}
            <button
              onClick={() => setShowProfileModal(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-blue-50 text-slate-700 hover:text-blue-700 border border-slate-200 text-xs font-bold transition cursor-pointer"
              title="Pengaturan Profil Anggota"
            >
              {profile.avatarUrl ? (
                <img
                  src={profile.avatarUrl}
                  alt={profile.fullName}
                  className="w-4 h-4 rounded-full object-cover shrink-0"
                />
              ) : (
                <Settings className="w-3.5 h-3.5 text-slate-500 shrink-0" />
              )}
              <span className="hidden sm:inline">Profil</span>
            </button>

            <button
              onClick={onLogout}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-rose-50 text-slate-600 hover:text-rose-600 border border-slate-200 text-xs font-bold transition cursor-pointer"
              title="Keluar dari Akun"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Keluar</span>
            </button>
          </div>
        </header>

        {/* Content Body */}
        <main className="p-4 sm:p-6 lg:p-8 space-y-6">
          {/* OFFLINE QUEUE FLOATING BANNER */}
          {offlineQueueCount > 0 && (
            <div className="p-4 rounded-2xl bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-300/80 text-amber-950 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-md shadow-amber-500/10 animate-in fade-in duration-300">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-amber-500 text-slate-950 font-black flex items-center justify-center shrink-0 shadow-sm">
                  <Wifi className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-xs sm:text-sm font-black text-amber-950 flex items-center gap-2">
                    <span>{offlineQueueCount} Formulir Presensi Tersimpan di HP (Antrean Offline)</span>
                  </h4>
                  <p className="text-[11px] text-amber-800 leading-tight mt-0.5">
                    Data Anda aman tersimpan di memori perangkat dan otomatis terkirim begitu HP Anda kembali terhubung internet.
                  </p>
                </div>
              </div>

              <button
                onClick={handleManualSyncQueue}
                disabled={isSyncingQueue}
                className="self-start sm:self-center px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 active:scale-95 text-slate-950 text-xs font-black transition cursor-pointer flex items-center gap-1.5 shadow-sm disabled:opacity-50 shrink-0"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isSyncingQueue ? 'animate-spin' : ''}`} />
                <span>{isSyncingQueue ? 'Mensinkronkan...' : 'Sinkronkan Sekarang'}</span>
              </button>
            </div>
          )}

          {/* Greeting Banner */}
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-2 px-1">
            <div>
              <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md bg-blue-100/70 text-blue-800 text-[10px] font-extrabold uppercase tracking-widest mb-1">
                Komunitas Penerima Beasiswa Bank Indonesia &bull; GenBI UNMA
              </div>
              <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight leading-tight">
                Halo, {profile.fullName} 👋
              </h2>
            </div>
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold bg-white/90 border border-slate-200 shadow-xs text-slate-700">
                <ShieldCheck className="w-3.5 h-3.5 text-blue-600" />
                <span>Semester Genap 2026/2027</span>
              </span>
            </div>
          </div>

          {/* GRID LAYOUT: Desktop 12 Kolom (5 Kolom Kiri, 7 Kolom Kanan), Mobile Vertikal */}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-5 md:gap-6 items-start">
            {/* ======================================================== */}
            {/* KOLOM KIRI (md:col-span-5): KARTU ANGGOTA & QUICK ACTIONS */}
            {/* ======================================================== */}
            <div className="md:col-span-5 space-y-4">
              {/* Header Tab Pilihan Sisi Kartu (Depan / Belakang) */}
              <div className="flex items-center justify-between px-1">
                <div className="flex items-center gap-1 p-1 rounded-2xl bg-white/80 border border-slate-200/80 shadow-xs">
                  <button
                    type="button"
                    onClick={() => setCardSide('front')}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                      cardSide === 'front'
                        ? 'bg-blue-600 text-white shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Tampak Depan
                  </button>
                  <button
                    type="button"
                    onClick={() => setCardSide('back')}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                      cardSide === 'back'
                        ? 'bg-blue-600 text-white shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Tampak Belakang
                  </button>
                </div>

                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => avatarFileInputRef.current?.click()}
                    disabled={isUploadingAvatar}
                    className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-white/90 hover:bg-blue-50 text-slate-700 hover:text-blue-700 border border-slate-200 text-xs font-bold transition cursor-pointer shadow-xs disabled:opacity-50"
                    title="Pasang atau ganti foto profil ID Card"
                  >
                    <Camera className={`w-3.5 h-3.5 text-blue-600 ${isUploadingAvatar ? 'animate-spin' : ''}`} />
                    <span className="hidden sm:inline">
                      {isUploadingAvatar ? 'Memproses...' : profile.avatarUrl ? 'Ganti Foto' : 'Foto'}
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setCardSide(cardSide === 'front' ? 'back' : 'front')}
                    className="p-2 rounded-xl bg-white/90 hover:bg-blue-50 text-slate-700 hover:text-blue-700 border border-slate-200 transition cursor-pointer shadow-xs"
                    title="Putar Sisi Kartu"
                  >
                    <RotateCw className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={handleDownloadCardPng}
                    disabled={isDownloadingCard}
                    className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 active:scale-95 text-white font-bold text-xs shadow-md shadow-blue-600/20 transition cursor-pointer disabled:opacity-50"
                    title="Unduh Kartu Gambar PNG Format Standar KTM (300 DPI)"
                  >
                    <Download className={`w-3.5 h-3.5 ${isDownloadingCard ? 'animate-bounce' : ''}`} />
                    <span className="hidden sm:inline">{isDownloadingCard ? 'Mengunduh...' : 'Unduh'}</span>
                  </button>
                </div>
              </div>

              {/* KARTU IDENTITAS VERTIKAL RESMI SIMAK GENBI (SMART ID CARD) */}
              <div
                ref={memberCardRef}
                className="relative max-w-[330px] w-full mx-auto rounded-[32px] overflow-hidden select-none transition-all duration-300 shadow-2xl shadow-blue-950/40 border border-white/20"
                style={{
                  aspectRatio: '1 / 1.58',
                  background: 'linear-gradient(155deg, #061127 0%, #0d2556 42%, #143575 75%, #081736 100%)',
                }}
              >
                {/* Visual Glass Sheen & Holographic Mesh Lighting */}
                <div className="absolute inset-0 bg-gradient-to-tr from-white/10 via-transparent to-white/5 pointer-events-none" />
                <div className="absolute -top-24 -right-24 w-60 h-60 rounded-full bg-blue-500/25 blur-2xl pointer-events-none" />
                <div className="absolute -bottom-24 -left-24 w-60 h-60 rounded-full bg-indigo-500/25 blur-2xl pointer-events-none" />
                
                {/* Geometric Security Concentric Rings (Ciri Khas Cetak Pengaman Uang / Kartu Bank Indonesia) */}
                <div className="absolute -right-16 top-28 w-64 h-64 rounded-full border border-white/5 pointer-events-none" />
                <div className="absolute -right-28 top-16 w-88 h-88 rounded-full border border-white/5 pointer-events-none" />
                <div className="absolute -left-20 bottom-16 w-56 h-56 rounded-full border border-white/5 pointer-events-none" />

                {/* 1. Lubang Tali Lanyard / Smart ID Slot */}
                <div className="pt-3 pb-1 flex justify-center relative z-10">
                  <div className="w-12 h-2 rounded-full bg-white/20 border border-white/30 shadow-inner" />
                </div>

                {cardSide === 'front' ? (
                  /* ================= TAMPAK DEPAN (SMART ID VERTIKAL RESMI SIMAK GENBI) ================= */
                  <div className="h-[calc(100%-20px)] flex flex-col justify-between relative px-5 pt-1 pb-4 text-white">
                    {/* Header: Logo Resmi & Brand SIMAK GENBI */}
                    <div className="relative z-10 flex items-center justify-between pb-2.5 border-b border-white/15">
                      <div className="flex items-center gap-2">
                        <div className="w-9 h-9 rounded-xl bg-white p-1.5 shadow-md border border-white/50 flex items-center justify-center shrink-0">
                          <img
                            src="/logo-genbi.png"
                            alt="Logo GenBI"
                            className="w-full h-full object-contain"
                          />
                        </div>
                        <div>
                          <div className="flex items-center gap-1">
                            <span className="text-xs font-black tracking-tight text-white">SIMAK</span>
                            <span className="text-xs font-black tracking-tight bg-gradient-to-r from-blue-300 to-indigo-200 bg-clip-text text-transparent">GENBI</span>
                          </div>
                          <p className="text-[9px] font-bold text-blue-200/90 tracking-wider uppercase leading-none mt-0.5">
                            KOMISARIAT UNMA
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-1 px-2.5 py-1 rounded-xl bg-amber-400/20 backdrop-blur-md border border-amber-300/40 text-[9px] font-black tracking-wider text-amber-300">
                        <Sparkles className="w-3 h-3 text-amber-300 shrink-0" />
                        <span>SMART ID</span>
                      </div>
                    </div>

                    {/* Center: Foto Avatar & Identitas Lengkap Anggota */}
                    <div className="relative z-10 text-center my-auto py-1">
                      {/* Avatar Profile Ring */}
                      <div
                        onClick={() => avatarFileInputRef.current?.click()}
                        className="group relative w-19 h-19 mx-auto mb-2 cursor-pointer"
                        title="Klik untuk memasang / mengganti foto profil ID Card"
                      >
                        <div className="w-full h-full rounded-full p-0.5 bg-gradient-to-tr from-amber-400 via-blue-400 to-indigo-400 shadow-xl shadow-blue-900/50 relative overflow-hidden">
                          <div className="w-full h-full rounded-full bg-slate-900 border-2 border-white flex items-center justify-center text-white font-black text-2xl uppercase overflow-hidden">
                            {profile.avatarUrl ? (
                              <img
                                src={profile.avatarUrl}
                                alt={profile.fullName}
                                className="w-full h-full object-cover"
                                crossOrigin="anonymous"
                              />
                            ) : (
                              profile.fullName.charAt(0)
                            )}
                          </div>

                          {/* Hover Overlay Kamera */}
                          <div className="absolute inset-0 bg-slate-950/60 rounded-full flex flex-col items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity text-white text-[9px] font-bold">
                            <Camera className="w-4 h-4 text-white mb-0.5" />
                            <span>{profile.avatarUrl ? 'Ganti' : 'Pasang'}</span>
                          </div>
                        </div>

                        <span className="absolute bottom-0 right-0 w-5 h-5 rounded-full bg-emerald-500 border-2 border-slate-900 flex items-center justify-center shadow-xs">
                          {profile.avatarUrl ? (
                            <CheckCircle2 className="w-3 h-3 text-white" />
                          ) : (
                            <Camera className="w-2.5 h-2.5 text-white" />
                          )}
                        </span>
                      </div>

                      {/* Nama Lengkap */}
                      <h3 className="text-sm sm:text-base font-black text-white tracking-wide uppercase px-2 line-clamp-1 leading-snug drop-shadow-sm">
                        {profile.fullName}
                      </h3>

                      {/* NPM Capsule */}
                      <div className="mt-1">
                        <span className="font-mono text-xs font-bold text-blue-200 bg-black/40 backdrop-blur-md px-3 py-0.5 rounded-full border border-white/15 tracking-wider inline-block">
                          NPM {profile.npm || profile.nim}
                        </span>
                      </div>

                      {/* Divisi & Jabatan Badge */}
                      <p className="text-[11px] text-blue-100 font-medium mt-1">
                        {profile.division} {profile.studyProgram ? `• ${profile.studyProgram}` : ''}
                      </p>

                      <div className="mt-1.5 flex justify-center">
                        {profile.role === 'kadiv' ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md bg-amber-400 text-slate-950 font-black text-[9px] uppercase tracking-wider shadow-sm">
                            <Crown className="w-2.5 h-2.5 text-slate-950" />
                            Kepala Divisi
                          </span>
                        ) : profile.role === 'admin' ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md bg-blue-500 text-white font-black text-[9px] uppercase tracking-wider shadow-sm border border-blue-400/40">
                            <ShieldCheck className="w-2.5 h-2.5 text-white" />
                            BPH Komisariat
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md bg-white/15 text-blue-100 font-bold text-[9px] uppercase tracking-wider border border-white/20">
                            Anggota GenBI
                          </span>
                        )}
                      </div>

                      {/* QR Code Presensi Resmi dalam Card Tile Putih */}
                      <div className="mt-2.5 inline-block p-2 bg-white rounded-2xl shadow-xl shadow-black/30 border-2 border-blue-400/30">
                        <QRCodeSVG
                          value={`GENBI-MEMBER:${profile.id}:${profile.npm || profile.nim}:${profile.division}`}
                          size={110}
                          level="H"
                          includeMargin={false}
                        />
                      </div>
                      <span className="text-[8px] font-mono font-bold text-blue-300/80 block uppercase tracking-widest mt-1">
                        ID PRESENSI DIGITAL RESMI
                      </span>
                    </div>

                    {/* Footer Kartu Institusional Presisi (Tanpa Alamat Website) */}
                    <div className="relative z-10 pt-2.5 border-t border-white/15 text-center space-y-0.5">
                      <p className="text-[9px] font-bold text-blue-200 tracking-wider uppercase">
                        BANK INDONESIA &bull; ENERGI UNTUK NEGERI
                      </p>
                      <p className="text-[8px] text-blue-300/70 font-medium uppercase tracking-widest">
                        GENBI KOMISARIAT UNIVERSITAS MAJALENGKA
                      </p>
                    </div>
                  </div>
                ) : (
                  /* ================= TAMPAK BELAKANG (SMART ID VERTIKAL RESMI SIMAK GENBI) ================= */
                  <div className="h-[calc(100%-20px)] flex flex-col justify-between relative px-5 pt-3 pb-4 text-white text-center">
                    {/* Header Belakang */}
                    <div className="relative z-10 border-b border-white/15 pb-2">
                      <h4 className="text-[11px] font-black tracking-widest text-white uppercase">
                        KARTU TANDA PENERIMA BEASISWA
                      </h4>
                      <p className="text-[9px] text-blue-200/80 font-medium uppercase mt-0.5">
                        Komisariat Universitas Majalengka
                      </p>
                    </div>

                    {/* Logo Besar & Nilai Filosofis GenBI */}
                    <div className="relative z-10 my-auto py-2 space-y-3">
                      <div className="w-20 h-20 rounded-3xl bg-white p-2.5 mx-auto shadow-2xl border border-white/40 flex items-center justify-center">
                        <img
                          src="/logo-genbi.png"
                          alt="Logo GenBI"
                          className="w-full h-full object-contain"
                        />
                      </div>

                      <div className="space-y-1">
                        <h3 className="text-xs font-black tracking-widest uppercase text-white">
                          GENERASI BARU INDONESIA
                        </h3>
                        <p className="text-[10px] text-amber-300 font-bold tracking-wide">
                          Frontrunners &bull; Change Agents &bull; Future Leaders
                        </p>
                      </div>

                      <div className="p-3 rounded-2xl bg-white/5 border border-white/10 text-[9px] text-blue-100/90 leading-relaxed max-w-[270px] mx-auto text-center font-medium">
                        Kartu ini merupakan tanda pengenal digital resmi penerima Beasiswa Bank Indonesia di Universitas Majalengka. Berlaku selama periode kepengurusan aktif.
                      </div>
                    </div>

                    {/* Footer Belakang Presisi (Tanpa Alamat Website) */}
                    <div className="relative z-10 pt-2.5 border-t border-white/15 text-center space-y-0.5">
                      <p className="text-[9px] font-bold text-blue-200 tracking-wider uppercase">
                        BANK INDONESIA &bull; ENERGI UNTUK NEGERI
                      </p>
                      <p className="text-[8px] text-blue-300/70 font-medium uppercase tracking-widest">
                        SIMAK GENBI &bull; SISTEM MANAJEMEN &amp; KEAKTIFAN
                      </p>
                    </div>
                  </div>
                )}
              </div>

              {/* Petunjuk pasang foto jika belum ada foto profil */}
              {!profile.avatarUrl && (
                <div
                  onClick={() => avatarFileInputRef.current?.click()}
                  className="mt-2 text-center p-2.5 rounded-2xl bg-blue-50/80 border border-blue-200/80 cursor-pointer hover:bg-blue-100/70 transition shadow-xs"
                >
                  <p className="text-[11px] font-bold text-blue-800 flex items-center justify-center gap-1.5">
                    <Camera className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                    <span>Klik di sini untuk pasang foto resmi Anda pada ID Card</span>
                  </p>
                </div>
              )}

              {/* Hidden Canvas untuk Generate Smart ID Card Download PNG */}
              <div style={{ display: 'none' }} aria-hidden="true">
                <QRCodeCanvas
                  id="member-qr-canvas"
                  value={`GENBI-MEMBER:${profile.id}:${profile.npm || profile.nim}:${profile.division}`}
                  size={256}
                  level="H"
                  includeMargin={false}
                />
              </div>

              {/* Quick Actions (Presensi QR, Tugas Delegasi BI Wilayah 9 & 10, Ajukan Izin) */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                <button
                  onClick={() => {
                    setShowScanModal(true);
                    setScannerMessage(null);
                  }}
                  className="flex items-center gap-3 p-3.5 rounded-2xl bg-white/90 backdrop-blur-xl border border-white ring-1 ring-slate-900/5 shadow-md shadow-slate-200/50 hover:border-blue-500 hover:shadow-lg hover:shadow-blue-500/10 text-slate-800 transition-all duration-200 group cursor-pointer active:scale-[0.98]"
                >
                  <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center group-hover:bg-blue-600 group-hover:text-white transition shadow-xs shrink-0">
                    <ScanLine className="w-5 h-5" />
                  </div>
                  <div className="text-left">
                    <span className="block text-xs font-black text-slate-900">Presensi QR</span>
                    <span className="block text-[10px] text-slate-500 font-medium">Scan kegiatan UNMA</span>
                  </div>
                </button>

                {/* Tombol Presensi Delegasi Bank Indonesia (+30 Poin) */}
                <button
                  onClick={() => {
                    setShowDelegasiModal(true);
                    setDelegasiSuccess(false);
                  }}
                  className="flex items-center gap-3 p-3.5 rounded-2xl bg-white/95 backdrop-blur-xl border border-amber-200/90 ring-1 ring-amber-400/20 shadow-md shadow-amber-500/10 hover:border-amber-400 hover:shadow-lg hover:shadow-amber-500/15 text-slate-800 transition-all duration-200 group cursor-pointer active:scale-[0.98]"
                >
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-amber-100 to-yellow-100 text-amber-700 flex items-center justify-center group-hover:bg-gradient-to-tr group-hover:from-amber-500 group-hover:to-yellow-400 group-hover:text-slate-950 transition shadow-xs shrink-0 font-black">
                    <Award className="w-5 h-5 text-amber-600 group-hover:text-slate-950 transition" />
                  </div>
                  <div className="text-left flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-1">
                      <span className="block text-xs font-black text-slate-900 truncate">Tugas Delegasi</span>
                      <span className="px-2 py-0.5 rounded-full bg-gradient-to-r from-amber-400 to-yellow-400 text-slate-950 text-[9px] font-black shadow-xs shrink-0 tracking-tight">
                        +30 P
                      </span>
                    </div>
                    <span className="block text-[10px] text-amber-800 font-bold truncate">Perwakilan BI</span>
                  </div>
                </button>

                <button
                  onClick={() => {
                    setShowIzinModal(true);
                    setIzinSuccess(false);
                    if (events.length > 0 && !selectedEventId) {
                      setSelectedEventId(events[0].id);
                    }
                  }}
                  className="flex items-center gap-3 p-3.5 rounded-2xl bg-white/90 backdrop-blur-xl border border-white ring-1 ring-slate-900/5 shadow-md shadow-slate-200/50 hover:border-indigo-500 hover:shadow-lg hover:shadow-indigo-500/10 text-slate-800 transition-all duration-200 group cursor-pointer active:scale-[0.98]"
                >
                  <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center group-hover:bg-indigo-600 group-hover:text-white transition shadow-xs shrink-0">
                    <FileText className="w-5 h-5" />
                  </div>
                  <div className="text-left">
                    <span className="block text-xs font-black text-slate-900">Ajukan Izin</span>
                    <span className="block text-[10px] text-slate-500 font-medium">Dispensasi resmi</span>
                  </div>
                </button>
              </div>

              {/* PWA Install Promotion Pill */}
              <div className="p-3.5 rounded-2xl bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-100 flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 rounded-lg bg-blue-600 text-white">
                    <Zap className="w-3.5 h-3.5" />
                  </div>
                  <div>
                    <span className="font-bold text-slate-800 block leading-tight">Install PWA SIMAK</span>
                    <span className="text-[10px] text-slate-500">Bisa dibuka offline di homescreen</span>
                  </div>
                </div>
                <button
                  onClick={() => showToast('Gunakan menu browser -> "Add to Home Screen / Install Aplikasi"', 'info')}
                  className="px-2.5 py-1 bg-white border border-blue-200 text-blue-700 rounded-lg font-bold text-[11px] hover:bg-blue-100 transition cursor-pointer"
                >
                  Panduan
                </button>
              </div>
            </div>

            {/* ======================================================== */}
            {/* KOLOM KANAN (md:col-span-7): EVALUASI, AGENDA, & RIWAYAT */}
            {/* ======================================================== */}
            <div className="md:col-span-7 space-y-5">
              {/* Kartu Evaluasi Keaktifan (Glassmorphism + Dynamic Progress) */}
              <div className="p-5 sm:p-6 rounded-[28px] bg-white/90 backdrop-blur-xl border border-white ring-1 ring-slate-900/5 shadow-xl shadow-slate-200/50 space-y-5">
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 rounded-2xl bg-amber-50 text-amber-600 border border-amber-200/80 shadow-xs">
                      <Award className="w-6 h-6" />
                    </div>
                    <div>
                      <h3 className="text-sm font-black text-slate-900 tracking-tight">
                        Evaluasi Keaktifan Anggota
                      </h3>
                      <p className="text-[11px] text-slate-500 font-medium">
                        Standar Evaluasi Penerima Beasiswa Bank Indonesia
                      </p>
                    </div>
                  </div>

                  {/* Predikat Badge */}
                  <div className={`px-3 py-1 rounded-full border text-xs font-black flex items-center gap-1.5 shadow-xs ${currentTier.badgeBg}`}>
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>{currentTier.tierName}</span>
                  </div>
                </div>

                {/* Score & Progress */}
                <div className="space-y-2.5 pt-1">
                  <div className="flex justify-between items-baseline">
                    <div className="flex items-baseline gap-1">
                      <span className="text-3xl font-black text-slate-900 tracking-tight">
                        {evaluation.total_points}
                      </span>
                      <span className="text-xs font-bold text-slate-400">/ 100 Poin</span>
                    </div>
                    <div className="text-right">
                      <span className="text-xs font-extrabold text-blue-600 bg-blue-50 px-2.5 py-0.5 rounded-full border border-blue-100">
                        {evaluation.attendance_percentage}% Tingkat Kehadiran
                      </span>
                    </div>
                  </div>

                  {/* Gradient Multi-Level Progress Bar */}
                  <div className="w-full h-3.5 bg-slate-100 rounded-full overflow-hidden p-0.5 border border-slate-200/70 shadow-inner">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-blue-600 via-indigo-600 to-amber-400 transition-all duration-700 ease-out shadow-xs"
                      style={{
                        width: `${Math.max(Math.min(evaluation.total_points, 100), 4)}%`,
                      }}
                    />
                  </div>
                  <div className="flex justify-between text-[10px] font-bold text-slate-400 px-0.5">
                    <span>0 Poin</span>
                    <span>50 (Minimal)</span>
                    <span>75 (Aman)</span>
                    <span>100 (Optimal)</span>
                  </div>
                </div>

                {/* Metric counters */}
                <div className="grid grid-cols-3 gap-2.5 pt-3 border-t border-slate-100 text-center">
                  <div className="p-3 rounded-2xl bg-slate-50/80 border border-slate-100 transition hover:bg-slate-100/60">
                    <span className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                      Hadir Kegiatan
                    </span>
                    <span className="block text-lg font-black text-slate-900 mt-0.5">
                      {evaluation.total_hadir} <span className="text-xs font-medium text-slate-400">kali</span>
                    </span>
                  </div>
                  <div className="p-3 rounded-2xl bg-slate-50/80 border border-slate-100 transition hover:bg-slate-100/60">
                    <span className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                      Izin Resmi
                    </span>
                    <span className="block text-lg font-black text-slate-900 mt-0.5">
                      {evaluation.total_izin} <span className="text-xs font-medium text-slate-400">kali</span>
                    </span>
                  </div>
                  <div className="p-3 rounded-2xl bg-slate-50/80 border border-slate-100 transition hover:bg-slate-100/60">
                    <span className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                      Alfa / Absen
                    </span>
                    <span className="block text-lg font-black text-emerald-600 mt-0.5">
                      {evaluation.total_alfa}
                    </span>
                  </div>
                </div>

                {/* Tombol Cetak Rapor Keaktifan Resmi Bank Indonesia */}
                <div className="pt-3 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setShowReportModal(true)}
                    className="w-full py-2.5 px-3 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-black text-xs shadow-md shadow-blue-600/25 flex items-center justify-center gap-2 transition cursor-pointer"
                  >
                    <Award className="w-4 h-4 text-amber-300" />
                    <span>Cetak Rapor Keaktifan & Rekomendasi BI (PDF)</span>
                  </button>
                </div>
              </div>

              {/* Navigation Tabs (Agenda vs Riwayat vs Panduan Poin) */}
              <div className="space-y-4">
                <div className="flex p-1 bg-white/90 backdrop-blur-md border border-slate-200/80 rounded-2xl shadow-xs overflow-x-auto">
                  <button
                    onClick={() => setActiveTab('events')}
                    className={`flex-1 min-w-[100px] py-2 rounded-xl text-xs font-extrabold flex items-center justify-center gap-1.5 transition cursor-pointer ${
                      activeTab === 'events'
                        ? 'bg-blue-600 text-white shadow-md shadow-blue-600/20'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <Calendar className="w-3.5 h-3.5" />
                    <span>Agenda ({events.length})</span>
                  </button>

                  <button
                    onClick={() => setActiveTab('history')}
                    className={`flex-1 min-w-[100px] py-2 rounded-xl text-xs font-extrabold flex items-center justify-center gap-1.5 transition cursor-pointer ${
                      activeTab === 'history'
                        ? 'bg-blue-600 text-white shadow-md shadow-blue-600/20'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <History className="w-3.5 h-3.5" />
                    <span>Riwayat ({attendances.length})</span>
                  </button>

                  <button
                    onClick={() => {
                      setActiveTab('leaderboard');
                      fetchLeaderboard();
                    }}
                    className={`flex-1 min-w-[110px] py-2 rounded-xl text-xs font-extrabold flex items-center justify-center gap-1.5 transition cursor-pointer ${
                      activeTab === 'leaderboard'
                        ? 'bg-blue-600 text-white shadow-md shadow-blue-600/20'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <Trophy className="w-3.5 h-3.5 text-amber-300" />
                    <span>Leaderboard</span>
                  </button>

                  {/* Tab Khusus Kepala Divisi (Kadiv Workspace) */}
                  {profile.role === 'kadiv' && (
                    <button
                      onClick={() => setActiveTab('kadiv-workspace')}
                      className={`flex-1 min-w-[130px] py-2 rounded-xl text-xs font-black flex items-center justify-center gap-1.5 transition cursor-pointer ${
                        activeTab === 'kadiv-workspace'
                          ? 'bg-gradient-to-r from-amber-500 to-amber-600 text-white shadow-md shadow-amber-500/20'
                          : 'text-amber-800 bg-amber-50 hover:bg-amber-100'
                      }`}
                    >
                      <Crown className="w-3.5 h-3.5 text-amber-300" />
                      <span>Divisi Saya</span>
                    </button>
                  )}

                  <button
                    onClick={() => setActiveTab('tiers')}
                    className={`flex-1 min-w-[90px] py-2 rounded-xl text-xs font-extrabold flex items-center justify-center gap-1.5 transition cursor-pointer ${
                      activeTab === 'tiers'
                        ? 'bg-blue-600 text-white shadow-md shadow-blue-600/20'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <Info className="w-3.5 h-3.5" />
                    <span>Panduan</span>
                  </button>
                </div>

                {/* TAB 1: AGENDA & SESI TERBUKA */}
                {activeTab === 'events' && (
                  <div className="space-y-3">
                    {events.length === 0 ? (
                      <div className="p-8 rounded-[28px] bg-white/80 backdrop-blur-md border border-dashed border-slate-200 text-center space-y-2.5">
                        <CalendarDays className="w-10 h-10 text-slate-300 mx-auto" />
                        <h4 className="text-sm font-bold text-slate-700">
                          Belum ada agenda atau proker terjadwal
                        </h4>
                        <p className="text-xs text-slate-400 max-w-sm mx-auto">
                          Pengurus belum membuka sesi presensi baru. Jadwal kegiatan akan muncul otomatis saat sesi dibuka.
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {events.map((agenda) => {
                          const badgeColor =
                            agenda.category === 'Wajib'
                              ? 'bg-rose-50 text-rose-700 border-rose-200'
                              : agenda.category === 'Proker'
                              ? 'bg-blue-50 text-blue-700 border-blue-200'
                              : 'bg-amber-50 text-amber-700 border-amber-200';

                          const formattedDateWIB = formatDateTimeWIB(agenda.event_date);

                          const matchedAttendance = attendances.find((a) => a.event_id === agenda.id);
                          const isAlreadyAttended = matchedAttendance?.status === 'hadir';
                          const isAlreadyIzin = matchedAttendance?.status === 'izin';

                          return (
                            <div
                              key={agenda.id}
                              className={`p-4 sm:p-5 rounded-2xl bg-white/90 backdrop-blur-md border ring-1 transition-all space-y-3 ${
                                isAlreadyAttended
                                  ? 'border-emerald-300 ring-emerald-500/10 shadow-xs bg-emerald-50/30'
                                  : isAlreadyIzin
                                  ? 'border-blue-300 ring-blue-500/10 shadow-xs bg-blue-50/20'
                                  : 'border-white ring-slate-900/5 shadow-md shadow-slate-200/40 hover:border-slate-300'
                              }`}
                            >
                              <div className="flex justify-between items-start gap-2">
                                <div className="flex items-center gap-1.5">
                                  <span className={`px-2 py-0.5 rounded-md text-[10px] font-extrabold border ${badgeColor}`}>
                                    {agenda.category}
                                  </span>
                                  <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-black">
                                    +{agenda.points} Poin
                                  </span>
                                </div>

                                {isAlreadyAttended ? (
                                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800 text-[11px] font-black border border-emerald-300">
                                    <CheckCircle className="w-3.5 h-3.5 text-emerald-600" />
                                    <span>Sudah Hadir</span>
                                  </span>
                                ) : isAlreadyIzin ? (
                                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-blue-100 text-blue-800 text-[11px] font-bold border border-blue-300">
                                    <Hourglass className="w-3.5 h-3.5 text-blue-600" />
                                    <span>{matchedAttendance.verified ? 'Izin Disetujui' : 'Izin Diajukan'}</span>
                                  </span>
                                ) : (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setManualToken(agenda.qr_token);
                                      setShowScanModal(true);
                                      setScanMode('manual');
                                    }}
                                    className="text-[11px] font-bold text-blue-600 hover:text-blue-700 flex items-center gap-1 cursor-pointer bg-blue-50 hover:bg-blue-100 px-2.5 py-1 rounded-lg transition"
                                  >
                                    <span>Presensi Cepat</span>
                                    <ChevronRight className="w-3.5 h-3.5" />
                                  </button>
                                )}
                              </div>

                              <h4 className="text-sm sm:text-base font-extrabold text-slate-900 leading-snug">
                                {agenda.title}
                              </h4>

                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 text-xs text-slate-500 pt-1">
                                <div className="flex items-center gap-1.5">
                                  <Clock className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                                  <span>{formattedDateWIB}</span>
                                </div>
                                <div className="flex items-center gap-1.5">
                                  <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                                  <span>Kampus Universitas Majalengka</span>
                                </div>
                              </div>

                              <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[11px]">
                                <div className="flex items-center gap-1.5 text-slate-500">
                                  <span>Token Sesi:</span>
                                  <span className="font-mono font-bold text-slate-700 bg-slate-100 px-2 py-0.5 rounded-md border border-slate-200">
                                    {agenda.qr_token}
                                  </span>
                                </div>
                                <div className="flex items-center gap-2">
                                  <button
                                    type="button"
                                    onClick={() => handleShareWhatsApp(agenda)}
                                    className="flex items-center gap-1 text-emerald-600 hover:text-emerald-700 font-bold cursor-pointer"
                                    title="Bagikan info acara ke WhatsApp"
                                  >
                                    <Share2 className="w-3 h-3" />
                                    <span>Share WA</span>
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      navigator.clipboard.writeText(agenda.qr_token);
                                      showToast(`Token "${agenda.qr_token}" disalin!`, 'info');
                                    }}
                                    className="flex items-center gap-1 text-slate-400 hover:text-slate-700 font-semibold cursor-pointer"
                                    title="Salin token ke clipboard"
                                  >
                                    <Copy className="w-3 h-3" />
                                    <span>Salin</span>
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

                {/* TAB 2: RIWAYAT KEHADIRAN ANGGOTA */}
                {activeTab === 'history' && (
                  <div className="space-y-3">
                    {attendances.length === 0 ? (
                      <div className="p-8 rounded-[28px] bg-white/80 backdrop-blur-md border border-dashed border-slate-200 text-center space-y-2">
                        <CalendarX className="w-10 h-10 text-slate-300 mx-auto" />
                        <h4 className="text-sm font-bold text-slate-700">
                          Belum ada riwayat presensi tercatat
                        </h4>
                        <p className="text-xs text-slate-400 max-w-sm mx-auto">
                          Gunakan tombol Presensi QR saat kegiatan berlangsung atau ajukan dispensasi resmi jika berhalangan.
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-2.5">
                        {attendances.map((att) => {
                          const isHadir = att.status === 'hadir';
                          const isIzin = att.status === 'izin';

                          const dateStr = formatDateTimeWIB(att.scanned_at);

                          return (
                            <div
                              key={att.id}
                              className="p-4 rounded-2xl bg-white/90 backdrop-blur-md border border-white ring-1 ring-slate-900/5 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                            >
                              <div className="space-y-1">
                                <div className="flex items-center gap-2">
                                  <span className="text-xs font-extrabold text-slate-900">
                                    {att.event_title}
                                  </span>
                                  <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-600">
                                    {att.event_category}
                                  </span>
                                </div>
                                <p className="text-[11px] text-slate-400 flex items-center gap-1 font-medium">
                                  <Clock className="w-3 h-3" />
                                  <span>{dateStr}</span>
                                </p>
                                {att.proof_url && (
                                  <p className="text-[11px] text-slate-500 italic truncate max-w-xs">
                                    Keterangan: {att.proof_url}
                                  </p>
                                )}
                              </div>

                              <div className="shrink-0 self-start sm:self-center">
                                {isHadir && (
                                  <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-[11px] font-black">
                                    <CheckCircle className="w-3.5 h-3.5" />
                                    <span>Hadir (+{att.event_points || 10} Poin)</span>
                                  </span>
                                )}
                                {isIzin && att.verified && (
                                  <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-blue-50 text-blue-700 border border-blue-200 text-[11px] font-bold">
                                    <CheckCircle className="w-3.5 h-3.5" />
                                    <span>Izin Disetujui BPH</span>
                                  </span>
                                )}
                                {isIzin && !att.verified && (
                                  <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-amber-50 text-amber-700 border border-amber-200 text-[11px] font-bold">
                                    <Hourglass className="w-3.5 h-3.5" />
                                    <span>Menunggu Verifikasi</span>
                                  </span>
                                )}
                                {att.status === 'alfa' && (
                                  <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-rose-50 text-rose-700 border border-rose-200 text-[11px] font-bold">
                                    <span>Alfa (0 Poin)</span>
                                  </span>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}

                {/* TAB 3: LEADERBOARD POIN KEAKTIFAN */}
                {activeTab === 'leaderboard' && (
                  <div className="space-y-4">
                    <div className="p-4 rounded-2xl bg-gradient-to-r from-amber-500/10 via-blue-500/10 to-indigo-500/10 border border-amber-200/80 flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <div className="p-2 bg-amber-400 text-slate-950 rounded-xl shadow-xs">
                          <Trophy className="w-5 h-5" />
                        </div>
                        <div>
                          <h4 className="text-xs sm:text-sm font-black text-slate-900">
                            Peringkat Keaktifan GenBI UNMA
                          </h4>
                          <p className="text-[11px] text-slate-500">
                            Evaluasi real-time penilaian keaktifan untuk monitoring BPH
                          </p>
                        </div>
                      </div>
                      <button
                        onClick={fetchLeaderboard}
                        disabled={isLoadingLeaderboard}
                        className="p-2 bg-white rounded-xl border border-slate-200 text-slate-600 hover:text-blue-600 transition shadow-xs cursor-pointer"
                        title="Segarkan data peringkat"
                      >
                        <RefreshCw className={`w-3.5 h-3.5 ${isLoadingLeaderboard ? 'animate-spin' : ''}`} />
                      </button>
                    </div>

                    {/* Podium Spotlight: Top 3 GenBI of the Month */}
                    {leaderboard.length >= 3 && (() => {
                      const topThree = leaderboard.slice().sort((a, b) => b.total_points - a.total_points).slice(0, 3);
                      return (
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                          {/* Juara 2 (Perak) */}
                          <div className="order-2 sm:order-1 p-3.5 rounded-2xl bg-white/95 border border-slate-200 shadow-xs flex flex-col justify-between relative overflow-hidden">
                            <div className="flex items-center justify-between mb-2">
                              <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 text-[10px] font-black border border-slate-200">
                                #2 Runner Up
                              </span>
                              <span className="font-black text-xs text-blue-600">
                                +{topThree[1]?.total_points} P
                              </span>
                            </div>
                            <div>
                              <h5 className="font-extrabold text-xs text-slate-900 line-clamp-1">
                                {topThree[1]?.full_name}
                              </h5>
                              <p className="text-[10px] text-slate-400 line-clamp-1">
                                {topThree[1]?.division}
                              </p>
                            </div>
                          </div>

                          {/* Juara 1: GenBI of the Month (Emas) */}
                          <div className="order-1 sm:order-2 p-4 rounded-2xl bg-gradient-to-br from-amber-500/15 via-yellow-500/10 to-amber-600/15 border-2 border-amber-300 shadow-sm flex flex-col justify-between relative overflow-hidden">
                            <div className="flex items-center justify-between mb-2">
                              <span className="px-2.5 py-0.5 rounded-full bg-amber-400 text-slate-950 text-[10px] font-black shadow-xs flex items-center gap-1">
                                <Crown className="w-3 h-3 text-slate-950" />
                                <span>GenBI of the Month</span>
                              </span>
                              <span className="font-black text-sm text-amber-900">
                                +{topThree[0]?.total_points} P
                              </span>
                            </div>
                            <div>
                              <h5 className="font-black text-sm text-slate-950 line-clamp-1">
                                {topThree[0]?.full_name}
                              </h5>
                              <p className="text-[10px] font-semibold text-slate-600 line-clamp-1">
                                {topThree[0]?.division}
                              </p>
                              {topThree[0]?.attendance_percentage === 100 && (
                                <span className="inline-flex items-center gap-1 mt-1 px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 text-[9px] font-bold">
                                  ✓ 100% Kehadiran Proker
                                </span>
                              )}
                            </div>
                          </div>

                          {/* Juara 3 (Perunggu) */}
                          <div className="order-3 p-3.5 rounded-2xl bg-white/95 border border-slate-200 shadow-xs flex flex-col justify-between relative overflow-hidden">
                            <div className="flex items-center justify-between mb-2">
                              <span className="px-2 py-0.5 rounded-full bg-amber-50 text-amber-800 text-[10px] font-black border border-amber-200">
                                #3 Top Contributor
                              </span>
                              <span className="font-black text-xs text-blue-600">
                                +{topThree[2]?.total_points} P
                              </span>
                            </div>
                            <div>
                              <h5 className="font-extrabold text-xs text-slate-900 line-clamp-1">
                                {topThree[2]?.full_name}
                              </h5>
                              <p className="text-[10px] text-slate-400 line-clamp-1">
                                {topThree[2]?.division}
                              </p>
                            </div>
                          </div>
                        </div>
                      );
                    })()}

                    {/* Filter Divisi & Urutan Poin */}
                    <div className="p-3 bg-white/90 backdrop-blur-md rounded-2xl border border-slate-200/80 space-y-2">
                      <div className="flex items-center justify-between text-xs font-bold text-slate-600">
                        <span className="flex items-center gap-1">
                          <SlidersHorizontal className="w-3.5 h-3.5" />
                          <span>Filter & Urutkan</span>
                        </span>
                        <div className="flex gap-1">
                          <button
                            type="button"
                            onClick={() => setLeaderboardSortOrder('highest')}
                            className={`px-2 py-0.5 rounded text-[10px] font-extrabold cursor-pointer transition ${
                              leaderboardSortOrder === 'highest'
                                ? 'bg-blue-600 text-white'
                                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                            }`}
                          >
                            Poin Tertinggi &darr;
                          </button>
                          <button
                            type="button"
                            onClick={() => setLeaderboardSortOrder('lowest')}
                            className={`px-2 py-0.5 rounded text-[10px] font-extrabold cursor-pointer transition ${
                              leaderboardSortOrder === 'lowest'
                                ? 'bg-rose-600 text-white'
                                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                            }`}
                          >
                            Paling Rendah &uarr;
                          </button>
                        </div>
                      </div>

                      {/* Pill Pilihan Divisi */}
                      <div className="flex gap-1.5 overflow-x-auto pb-1 text-[11px]">
                        {[
                          'Semua',
                          'Publikasi dan Sosialisasi',
                          'Lingkungan Hidup',
                          'Pendidikan',
                          'Pengabdian Masyarakat',
                          'Kewirausahaan',
                          'BPH',
                        ].map((divName) => (
                          <button
                            key={divName}
                            type="button"
                            onClick={() => setSelectedLeaderboardDivision(divName)}
                            className={`px-2.5 py-1 rounded-xl whitespace-nowrap font-bold transition cursor-pointer ${
                              selectedLeaderboardDivision === divName
                                ? 'bg-slate-900 text-white shadow-xs'
                                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                            }`}
                          >
                            {divName}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Filtered & Sorted Leaderboard Data */}
                    {(() => {
                      const filtered = leaderboard
                        .filter(
                          (m) =>
                            selectedLeaderboardDivision === 'Semua' ||
                            m.division === selectedLeaderboardDivision
                        )
                        .sort((a, b) =>
                          leaderboardSortOrder === 'highest'
                            ? b.total_points - a.total_points
                            : a.total_points - b.total_points
                        );

                      if (filtered.length === 0) {
                        return (
                          <div className="p-8 text-center text-xs text-slate-400 bg-white/70 rounded-2xl border border-dashed border-slate-200">
                            Tidak ada anggota di divisi ini yang ditemukan.
                          </div>
                        );
                      }

                      return (
                        <div className="space-y-2">
                          {filtered.map((member, idx) => {
                            const isCurrentUser = member.user_id === user.id;
                            const rankNumber = idx + 1;

                            const statusBadge =
                              member.total_points >= 75 ? (
                                <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-black">
                                  Aman / Rekomendasi
                                </span>
                              ) : member.total_points >= 50 ? (
                                <span className="px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200 text-[10px] font-bold">
                                  Pantau Keaktifan
                                </span>
                              ) : (
                                <span className="px-2 py-0.5 rounded-full bg-rose-50 text-rose-700 border border-rose-200 text-[10px] font-black">
                                  Peringatan / Evaluasi DO
                                </span>
                              );

                            return (
                              <div
                                key={member.user_id}
                                className={`p-3.5 rounded-2xl border transition-all flex items-center justify-between gap-3 ${
                                  isCurrentUser
                                    ? 'bg-blue-50/90 border-blue-300 ring-2 ring-blue-500/20 shadow-xs'
                                    : 'bg-white/90 border-slate-200 hover:border-slate-300'
                                }`}
                              >
                                <div className="flex items-center gap-3 min-w-0">
                                  <span
                                    className={`w-7 h-7 rounded-xl flex items-center justify-center font-black text-xs shrink-0 ${
                                      rankNumber === 1 && leaderboardSortOrder === 'highest'
                                        ? 'bg-amber-400 text-slate-950 shadow-xs'
                                        : rankNumber === 2 && leaderboardSortOrder === 'highest'
                                        ? 'bg-slate-300 text-slate-800'
                                        : rankNumber === 3 && leaderboardSortOrder === 'highest'
                                        ? 'bg-amber-700 text-white'
                                        : 'bg-slate-100 text-slate-600'
                                    }`}
                                  >
                                    {rankNumber}
                                  </span>

                                  {member.avatar_url ? (
                                    <img
                                      src={member.avatar_url}
                                      alt=""
                                      className="w-7 h-7 rounded-full object-cover shrink-0 border border-slate-200"
                                    />
                                  ) : (
                                    <div className="w-7 h-7 rounded-full bg-slate-200/80 text-slate-700 font-bold text-xs flex items-center justify-center shrink-0 border border-slate-200">
                                      {member.full_name?.charAt(0)}
                                    </div>
                                  )}

                                  <div className="min-w-0">
                                    <div className="flex items-center gap-1.5 flex-wrap">
                                      <span className="text-xs font-black text-slate-900 truncate">
                                        {member.full_name}
                                      </span>
                                      {isCurrentUser && (
                                        <span className="px-1.5 py-0.2 bg-blue-600 text-white rounded text-[9px] font-bold">
                                          Anda
                                        </span>
                                      )}
                                      {member.role === 'kadiv' && (
                                        <span className="inline-flex items-center gap-0.5 px-1.5 py-0.2 bg-amber-100 text-amber-900 border border-amber-300 rounded text-[9px] font-extrabold">
                                          <Crown className="w-2.5 h-2.5 text-amber-700" />
                                          Kadiv
                                        </span>
                                      )}
                                    </div>
                                    <p className="text-[10px] text-slate-400 font-medium">
                                      NPM {member.npm || member.nim} &bull; {member.division}
                                    </p>
                                  </div>
                                </div>

                                <div className="flex flex-col items-end shrink-0 gap-1">
                                  <div className="flex items-baseline gap-1">
                                    <span className="text-sm font-black text-slate-900">
                                      {member.total_points}
                                    </span>
                                    <span className="text-[10px] font-bold text-slate-400">Poin</span>
                                  </div>
                                  {statusBadge}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      );
                    })()}
                  </div>
                )}

                {/* TAB KHUSUS KEPALA DIVISI (KADIV WORKSPACE) */}
                {activeTab === 'kadiv-workspace' && profile.role === 'kadiv' && (
                  <div className="space-y-4">
                    <div className="p-4 rounded-2xl bg-gradient-to-r from-amber-500/15 via-yellow-500/10 to-orange-500/10 border border-amber-300 flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <div className="p-2.5 bg-amber-400 text-slate-950 rounded-xl shadow-xs">
                          <Crown className="w-5 h-5" />
                        </div>
                        <div>
                          <h4 className="text-xs sm:text-sm font-black text-slate-900">
                            Workspace Kepala Divisi {profile.division}
                          </h4>
                          <p className="text-[11px] text-slate-600">
                            Pantau keaktifan rekan satu divisi untuk evaluasi pembinaan internal
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-2">
                      {leaderboard
                        .filter((m) => m.division === profile.division)
                        .map((divMember) => {
                          const isKadivSelf = divMember.user_id === user.id;
                          return (
                            <div
                              key={divMember.user_id}
                              className={`p-3.5 rounded-2xl border flex items-center justify-between gap-3 ${
                                isKadivSelf
                                  ? 'bg-amber-50/80 border-amber-300 ring-1 ring-amber-400/40'
                                  : 'bg-white/90 border-slate-200'
                              }`}
                            >
                              <div>
                                <div className="flex items-center gap-1.5">
                                  <span className="font-extrabold text-xs text-slate-900">
                                    {divMember.full_name}
                                  </span>
                                  {isKadivSelf && (
                                    <span className="px-1.5 py-0.2 bg-amber-400 text-slate-950 rounded text-[9px] font-black">
                                      Saya (Kadiv)
                                    </span>
                                  )}
                                </div>
                                <span className="font-mono text-[10px] text-slate-400 block">
                                  NPM {divMember.npm || divMember.nim}
                                </span>
                              </div>

                              <div className="flex items-center gap-4 text-xs text-right">
                                <div>
                                  <span className="text-[10px] text-slate-400 block uppercase font-bold">Hadir</span>
                                  <span className="font-bold text-slate-800">{divMember.total_hadir}x</span>
                                </div>
                                <div>
                                  <span className="text-[10px] text-slate-400 block uppercase font-bold">Izin</span>
                                  <span className="font-bold text-slate-600">{divMember.total_izin}x</span>
                                </div>
                                <div>
                                  <span className="text-[10px] text-slate-400 block uppercase font-bold">Poin</span>
                                  <span className="font-black text-blue-600">{divMember.total_points}</span>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                    </div>
                  </div>
                )}

                {/* TAB 5: PANDUAN TIER & SISTEM POIN */}
                {activeTab === 'tiers' && (
                  <div className="p-5 rounded-3xl bg-white/90 backdrop-blur-md border border-white ring-1 ring-slate-900/5 shadow-xs space-y-4">
                    <div>
                      <h4 className="text-sm font-extrabold text-slate-900">
                        Pedoman Evaluasi Beasiswa Bank Indonesia
                      </h4>
                      <p className="text-xs text-slate-500">
                        Ketentuan bobot keaktifan GenBI Komisariat Universitas Majalengka:
                      </p>
                    </div>

                    <div className="space-y-3">
                      <div className="p-3.5 rounded-2xl bg-amber-50/70 border border-amber-200 flex items-start gap-3">
                        <div className="p-2 rounded-xl bg-amber-400 text-slate-950 font-black text-xs">
                          90-100
                        </div>
                        <div>
                          <span className="font-extrabold text-xs text-amber-900 block">
                            Platinum Garuda (Sangat Aktif)
                          </span>
                          <p className="text-[11px] text-amber-800">
                            Peringkat tertinggi. Memenuhi seluruh presensi proker dan agenda wajib. Berhak atas surat rekomendasi prioritas beasiswa & kepengurusan.
                          </p>
                        </div>
                      </div>

                      <div className="p-3.5 rounded-2xl bg-emerald-50/70 border border-emerald-200 flex items-start gap-3">
                        <div className="p-2 rounded-xl bg-emerald-500 text-white font-black text-xs">
                          75-89
                        </div>
                        <div>
                          <span className="font-extrabold text-xs text-emerald-900 block">
                            Gold Star (Aktif Unggul)
                          </span>
                          <p className="text-[11px] text-emerald-800">
                            Tingkat keaktifan sangat baik. Memenuhi seluruh batas minimal ketentuan keaktifan Bank Indonesia.
                          </p>
                        </div>
                      </div>

                      <div className="p-3.5 rounded-2xl bg-blue-50/70 border border-blue-200 flex items-start gap-3">
                        <div className="p-2 rounded-xl bg-blue-500 text-white font-black text-xs">
                          50-74
                        </div>
                        <div>
                          <span className="font-extrabold text-xs text-blue-900 block">
                            Silver Member (Standar Minimal)
                          </span>
                          <p className="text-[11px] text-blue-800">
                            Batas aman evaluasi. Dianjurkan meningkatkan kehadiran pada agenda proker mendatang.
                          </p>
                        </div>
                      </div>

                      <div className="p-3.5 rounded-2xl bg-rose-50/70 border border-rose-200 flex items-start gap-3">
                        <div className="p-2 rounded-xl bg-rose-500 text-white font-black text-xs">
                          &lt; 50
                        </div>
                        <div>
                          <span className="font-extrabold text-xs text-rose-900 block">
                            Bronze (Perlu Pembinaan)
                          </span>
                          <p className="text-[11px] text-rose-800">
                            Di bawah standar minimum. Wajib mengikuti pembinaan khusus bersama BPH Komisariat UNMA.
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </main>

        {/* Footer Hak Cipta SIMAK GenBI & PD-Dev */}
        <Footer />
      </div>

      {/* Modal ID QR Anggota (High-Res Digital Stamp) */}
      {showQrModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-sm rounded-[32px] bg-white p-6 shadow-2xl space-y-5 text-center relative border border-slate-100">
            <button
              onClick={() => setShowQrModal(false)}
              className="absolute top-4 right-4 p-2 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            <div>
              <span className="inline-block px-3 py-1 rounded-full bg-blue-50 text-blue-700 border border-blue-200 text-[11px] font-black mb-2">
                PRESENSI DIGITAL RESMI
              </span>
              <h3 className="text-base font-black text-slate-900 leading-tight">
                {profile.fullName}
              </h3>
              <p className="text-xs text-slate-500 font-mono mt-0.5">
                NPM {profile.npm || profile.nim} &bull; Divisi {profile.division}
              </p>
            </div>

            <div className="mx-auto w-56 h-56 bg-white p-4 rounded-3xl border-2 border-dashed border-blue-500 flex flex-col items-center justify-center shadow-inner relative group">
              <QRCodeSVG
                value={`GENBI-MEMBER:${profile.id}:${profile.npm || profile.nim}:${profile.division}`}
                size={180}
                level="H"
                includeMargin={false}
              />
            </div>

            <div className="flex items-center justify-center gap-1.5 text-xs text-slate-500 font-bold">
              <RefreshCw className="w-3.5 h-3.5 text-blue-600 animate-spin" />
              <span>
                Token berganti dinamis dalam <strong className="text-blue-600 font-black">{qrCodeTimer}s</strong>
              </span>
            </div>

            <p className="text-[11px] text-slate-400">
              Tunjukkan QR Code ini ke petugas absensi saat kegiatan offline berlangsung di kampus.
            </p>
          </div>
        </div>
      )}

      {/* Modal Presensi QR (Live Camera Scanner Viewfinder + Manual Input) */}
      {showScanModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-sm rounded-[32px] bg-white p-6 shadow-2xl space-y-4 text-center relative border border-slate-100">
            <button
              onClick={() => {
                setShowScanModal(false);
                stopCameraScanner();
              }}
              className="absolute top-4 right-4 p-2 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            <div>
              <h3 className="text-base font-black text-slate-900">Presensi Sesi Kegiatan</h3>
              <p className="text-xs text-slate-500">Scan QR Code panitia atau masukkan kode token sesi</p>
            </div>

            {/* Toggle Mode Scanner */}
            <div className="flex rounded-xl bg-slate-100 p-1 text-xs font-bold text-slate-600">
              <button
                type="button"
                onClick={() => setScanMode('camera')}
                className={`flex-1 py-1.5 rounded-lg flex items-center justify-center gap-1.5 transition cursor-pointer ${
                  scanMode === 'camera' ? 'bg-white text-blue-600 shadow-xs' : 'hover:text-slate-900'
                }`}
              >
                <Camera className="w-3.5 h-3.5" />
                <span>Kamera Scanner</span>
              </button>
              <button
                type="button"
                onClick={() => setScanMode('manual')}
                className={`flex-1 py-1.5 rounded-lg flex items-center justify-center gap-1.5 transition cursor-pointer ${
                  scanMode === 'manual' ? 'bg-white text-blue-600 shadow-xs' : 'hover:text-slate-900'
                }`}
              >
                <Keyboard className="w-3.5 h-3.5" />
                <span>Kode Token</span>
              </button>
            </div>

            {/* Pesan status / error */}
            {scannerMessage && (
              <div
                className={`p-3 rounded-xl text-xs font-medium text-left flex items-start gap-2 ${
                  scannerMessage.type === 'success'
                    ? 'bg-emerald-50 border border-emerald-200 text-emerald-800'
                    : 'bg-rose-50 border border-rose-200 text-rose-700'
                }`}
              >
                {scannerMessage.type === 'success' ? (
                  <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600 mt-0.5" />
                ) : (
                  <AlertCircle className="w-4 h-4 shrink-0 text-rose-600 mt-0.5" />
                )}
                <span>{scannerMessage.text}</span>
              </div>
            )}

            {scanMode === 'camera' ? (
              <div className="space-y-3">
                {/* Viewfinder Kamera Scanner Real-Time */}
                <div className="relative w-full h-64 rounded-2xl overflow-hidden bg-slate-950 border border-slate-800 shadow-inner flex items-center justify-center">
                  {/* Container Html5Qrcode video */}
                  <div
                    id="qr-reader"
                    className="w-full h-full flex items-center justify-center"
                  />

                  {/* Loading State saat inisialisasi kamera */}
                  {isCameraStarting && (
                    <div className="absolute inset-0 bg-slate-950/85 flex flex-col items-center justify-center text-white gap-2 p-4 z-20">
                      <RefreshCw className="w-6 h-6 text-blue-400 animate-spin" />
                      <span className="text-xs font-bold">Mengaktifkan Kamera Scanner...</span>
                      <span className="text-[10px] text-slate-400">Pastikan izin kamera diizinkan di browser</span>
                    </div>
                  )}

                  {/* Tampilan Error Kamera / HTTPS Warning */}
                  {cameraError && (
                    <div className="absolute inset-0 bg-slate-950/90 flex flex-col items-center justify-center text-center p-4 z-20 text-white space-y-2">
                      <AlertCircle className="w-8 h-8 text-amber-400 mx-auto" />
                      <h4 className="text-xs font-bold text-amber-200">Kamera Belum Aktif</h4>
                      <p className="text-[11px] text-slate-300 leading-snug line-clamp-3">
                        {cameraError}
                      </p>
                      <button
                        type="button"
                        onClick={() => startCameraScanner(cameraFacing)}
                        className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-xs cursor-pointer flex items-center gap-1.5"
                      >
                        <RefreshCw className="w-3.5 h-3.5" />
                        <span>Coba Buka Kamera Lagi</span>
                      </button>
                    </div>
                  )}

                  {/* Overlay Viewfinder saat kamera berjalan aktif */}
                  {isCameraActive && !cameraError && (
                    <>
                      {/* Top Overlay Bar */}
                      <div className="absolute top-3 inset-x-3 flex items-center justify-between z-10 pointer-events-none">
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-900/75 backdrop-blur-md text-emerald-400 text-[10px] font-black tracking-wider border border-emerald-500/30 shadow-xs pointer-events-auto">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                          SCANNER AKTIF
                        </span>

                        <div className="flex items-center gap-1.5 pointer-events-auto">
                          {/* Tombol Toggle Senter / Torch */}
                          <button
                            type="button"
                            onClick={toggleTorch}
                            className={`p-2 rounded-xl backdrop-blur-md border transition cursor-pointer ${
                              isTorchOn
                                ? 'bg-amber-400 text-slate-950 border-amber-300 shadow-md shadow-amber-400/30'
                                : 'bg-slate-900/75 hover:bg-slate-900 text-white border-white/20'
                            }`}
                            title={isTorchOn ? 'Matikan Senter' : 'Nyalakan Senter (Flashlight)'}
                          >
                            <Flashlight className={`w-3.5 h-3.5 ${isTorchOn ? 'text-slate-950 animate-pulse' : 'text-amber-300'}`} />
                          </button>

                          <button
                            type="button"
                            onClick={() => {
                              const next = cameraFacing === 'environment' ? 'user' : 'environment';
                              setCameraFacing(next);
                            }}
                            className="p-2 rounded-xl bg-slate-900/75 hover:bg-slate-900 text-white backdrop-blur-md border border-white/20 transition cursor-pointer"
                            title="Ganti Kamera Depan/Belakang"
                          >
                            <RefreshCw className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      {/* 4 Sudut Reticle Viewfinder (Corner Brackets) */}
                      <div className="absolute inset-8 pointer-events-none z-10 flex flex-col justify-between">
                        <div className="flex justify-between">
                          <div className="w-6 h-6 border-t-3 border-l-3 border-emerald-400 rounded-tl-lg shadow-[0_0_8px_#34d399]" />
                          <div className="w-6 h-6 border-t-3 border-r-3 border-emerald-400 rounded-tr-lg shadow-[0_0_8px_#34d399]" />
                        </div>
                        <div className="flex justify-between">
                          <div className="w-6 h-6 border-b-3 border-l-3 border-emerald-400 rounded-bl-lg shadow-[0_0_8px_#34d399]" />
                          <div className="w-6 h-6 border-b-3 border-r-3 border-emerald-400 rounded-br-lg shadow-[0_0_8px_#34d399]" />
                        </div>
                      </div>

                      {/* Laser Beam Bergerak Naik Turun */}
                      <div className="absolute inset-x-8 h-0.5 bg-gradient-to-r from-transparent via-emerald-400 to-transparent shadow-[0_0_12px_#34d399] animate-scan-beam pointer-events-none z-10" />

                      {/* Bottom Instruction Pill */}
                      <div className="absolute bottom-2.5 inset-x-4 z-10 text-center pointer-events-none">
                        <span className="px-3 py-1 rounded-full bg-slate-900/80 backdrop-blur-md text-[10px] text-slate-200 font-bold border border-white/10 shadow-xs">
                          Arahkan kamera ke QR Code kegiatan
                        </span>
                      </div>
                    </>
                  )}
                </div>

                {/* Input Kamera File Foto Alternatif (Fallback jika streaming tidak diizinkan di browser pengguna) */}
                <input
                  type="file"
                  ref={qrImageInputRef}
                  accept="image/*"
                  capture="environment"
                  className="hidden"
                  onChange={handleScanFromImageFile}
                />
                <div id="qr-reader-file-temp" style={{ display: 'none' }} />

                <button
                  type="button"
                  onClick={() => qrImageInputRef.current?.click()}
                  disabled={isScanningImage || isSubmittingAttendance}
                  className="w-full py-2.5 px-3 bg-slate-100 hover:bg-blue-50 text-slate-700 hover:text-blue-700 border border-slate-200/90 rounded-2xl font-bold text-xs flex items-center justify-center gap-2 transition cursor-pointer shadow-xs active:scale-[0.98]"
                >
                  <Camera className="w-4 h-4 text-slate-500 shrink-0" />
                  <span>{isScanningImage ? 'Membaca Foto Barcode...' : '📸 Alternatif: Ambil Foto / File Barcode'}</span>
                </button>
              </div>
            ) : (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  handleProcessAttendanceToken(manualToken);
                }}
                className="space-y-3 text-left pt-2"
              >
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-600 uppercase">
                    Masukkan Kode QR Token
                  </label>
                  <input
                    type="text"
                    required
                    value={manualToken}
                    onChange={(e) => setManualToken(e.target.value)}
                    placeholder="Contoh: CBP-UNMA-2026"
                    className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono uppercase tracking-wider focus:outline-none focus:ring-2 focus:ring-blue-600/30"
                  />
                </div>
                <button
                  type="submit"
                  disabled={isSubmittingAttendance}
                  className="w-full py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-bold text-xs rounded-xl shadow-md shadow-blue-600/25 disabled:opacity-60 cursor-pointer"
                >
                  {isSubmittingAttendance ? 'Memvalidasi...' : 'Verifikasi Presensi Sekarang'}
                </button>
              </form>
            )}
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* POP-UP NOTIFIKASI BERHASIL PRESENSI & POIN MASUK KE LEADERBOARD */}
      {/* ======================================================== */}
      {showSuccessModal && attendanceSuccessData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/75 backdrop-blur-md animate-in fade-in">
          <div className="w-full max-w-sm rounded-[32px] bg-white p-6 shadow-2xl relative border border-slate-100 overflow-hidden text-center space-y-4">
            {/* Visual Ambient Glow */}
            <div className="absolute -top-16 -right-16 w-44 h-44 rounded-full bg-amber-400/20 blur-2xl pointer-events-none" />
            <div className="absolute -bottom-12 -left-12 w-40 h-40 rounded-full bg-emerald-400/20 blur-2xl pointer-events-none" />

            <button
              onClick={() => setShowSuccessModal(false)}
              className="absolute top-4 right-4 p-2 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition cursor-pointer z-10"
            >
              <X className="w-5 h-5" />
            </button>

            {/* Celebratory Icon Badge */}
            <div className="relative mx-auto w-20 h-20 flex items-center justify-center">
              <div className="absolute inset-0 rounded-full bg-emerald-100 animate-ping opacity-60" />
              <div className="relative w-18 h-18 rounded-full bg-gradient-to-br from-emerald-500 to-teal-600 text-white flex items-center justify-center shadow-lg shadow-emerald-500/30">
                <CheckCircle2 className="w-10 h-10 text-white" />
              </div>
              <div className="absolute -bottom-1 -right-1 w-7 h-7 rounded-full bg-amber-400 text-slate-950 border-2 border-white flex items-center justify-center shadow-md">
                <Sparkles className="w-3.5 h-3.5 text-slate-950" />
              </div>
            </div>

            {/* Judul & Pesan */}
            <div>
              <span className="inline-block px-3 py-0.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200 text-[10px] font-black uppercase tracking-wider mb-1">
                Presensi Terverifikasi Resmi
              </span>
              <h3 className="text-xl font-black text-slate-900 tracking-tight">
                Presensi Berhasil! 🎉
              </h3>
              <p className="text-xs text-slate-500 font-medium mt-1">
                Kehadiran Anda telah resmi dicatat dan poin langsung ditambahkan ke Leaderboard.
              </p>
            </div>

            {/* Rincian Kegiatan & Perolehan Poin */}
            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 text-left space-y-3">
              <div>
                <div className="flex items-center gap-1.5 mb-1">
                  <span className="px-2 py-0.5 rounded-md bg-blue-100 text-blue-800 font-bold text-[10px]">
                    {attendanceSuccessData.category}
                  </span>
                  <span className="text-[11px] text-slate-400 font-medium">
                    {attendanceSuccessData.scannedAt}
                  </span>
                </div>
                <h4 className="text-xs font-black text-slate-900 leading-snug">
                  {attendanceSuccessData.eventTitle}
                </h4>
              </div>

              <div className="flex items-center justify-between p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/30">
                <span className="text-xs font-bold text-amber-950 flex items-center gap-1.5">
                  <Award className="w-4 h-4 text-amber-600 shrink-0" />
                  <span>Poin Diperoleh</span>
                </span>
                <span className="px-2.5 py-0.5 rounded-full bg-amber-500 text-white font-black text-xs shadow-xs">
                  +{attendanceSuccessData.pointsAdded} Poin
                </span>
              </div>

              <div className="pt-2 border-t border-slate-200 flex items-center justify-between text-xs">
                <div>
                  <span className="text-[10px] text-slate-400 block font-bold uppercase tracking-wider">
                    Total Poin Anda Sekarang
                  </span>
                  <span className="text-base font-black text-blue-700">
                    {attendanceSuccessData.totalPoints} Poin
                  </span>
                </div>
                <div className="text-right">
                  <span className="text-[10px] text-slate-400 block font-bold uppercase tracking-wider">
                    Status Predikat
                  </span>
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-emerald-100 text-emerald-800 border border-emerald-300">
                    {attendanceSuccessData.predicate}
                  </span>
                </div>
              </div>

              {attendanceSuccessData.locationNote && (
                <div className="flex items-center gap-1.5 text-[10px] text-slate-500 pt-1">
                  <MapPin className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                  <span className="truncate">{attendanceSuccessData.locationNote}</span>
                </div>
              )}
            </div>

            {/* Tombol Aksi */}
            <div className="space-y-2 pt-1">
              <button
                type="button"
                onClick={() => {
                  setShowSuccessModal(false);
                  setActiveTab('leaderboard');
                  window.scrollTo({ top: 400, behavior: 'smooth' });
                }}
                className="w-full py-3 bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-700 hover:from-blue-700 hover:to-indigo-700 text-white font-black text-xs rounded-2xl shadow-lg shadow-blue-600/25 flex items-center justify-center gap-2 transition active:scale-[0.98] cursor-pointer"
              >
                <Trophy className="w-4 h-4 text-amber-300" />
                <span>Lihat Peringkat di Leaderboard</span>
              </button>

              <button
                type="button"
                onClick={() => setShowSuccessModal(false)}
                className="w-full py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-2xl transition cursor-pointer"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Ajukan Izin */}
      {showIzinModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-sm rounded-[32px] bg-white p-6 shadow-2xl space-y-4 relative border border-slate-100">
            <button
              onClick={() => {
                setShowIzinModal(false);
                setIzinSuccess(false);
              }}
              className="absolute top-4 right-4 p-2 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            <div>
              <h3 className="text-base font-black text-slate-900">Form Izin / Dispensasi</h3>
              <p className="text-xs text-slate-500">Pemberitahuan resmi berhalangan hadir agenda GenBI</p>
            </div>

            {izinSuccess ? (
              <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-center space-y-2">
                <CheckCircle2 className="w-8 h-8 text-emerald-600 mx-auto" />
                <h4 className="text-xs font-bold text-emerald-900">Pengajuan Berhasil Disimpan</h4>
                <p className="text-[11px] text-emerald-700">
                  Data permohonan izin Anda berhasil tercatat di sistem dan diteruskan ke Pengurus BPH untuk diverifikasi.
                </p>
                <button
                  onClick={() => {
                    setShowIzinModal(false);
                    setIzinSuccess(false);
                  }}
                  className="mt-2 w-full py-2 bg-emerald-600 text-white rounded-xl text-xs font-bold cursor-pointer"
                >
                  Selesai
                </button>
              </div>
            ) : events.length === 0 ? (
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 text-center space-y-2">
                <ShieldAlert className="w-6 h-6 text-slate-400 mx-auto" />
                <p className="text-xs text-slate-600 font-medium">
                  Saat ini belum ada agenda kegiatan aktif untuk diajukan dispensasi.
                </p>
                <button
                  type="button"
                  onClick={() => setShowIzinModal(false)}
                  className="px-4 py-2 bg-slate-200 text-slate-700 rounded-xl text-xs font-bold cursor-pointer"
                >
                  Tutup
                </button>
              </div>
            ) : (
              <div className="space-y-3 text-left">
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-600 uppercase">Pilih Agenda Kegiatan</label>
                  <select
                    value={selectedEventId}
                    onChange={(e) => setSelectedEventId(e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-blue-600/30"
                  >
                    {events.map((ag) => (
                      <option key={ag.id} value={ag.id}>
                        {ag.title} (+{ag.points} Poin)
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-600 uppercase">Kategori Alasan</label>
                  <select
                    value={alasanIzin}
                    onChange={(e) => setAlasanIzin(e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-blue-600/30"
                  >
                    <option value="Sakit dengan Surat Keterangan Dokter">Sakit (Surat Dokter / Medis)</option>
                    <option value="Jadwal Kuliah / Praktikum Wajib Bentrok">Tugas Kuliah / Praktikum Wajib Kampus</option>
                    <option value="Keperluan Keluarga Mendesak">Keperluan Keluarga Mendesak</option>
                    <option value="Tugas Institusi / Delegasi Kampus">Tugas Khusus Rektorat / Fakultas</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-700 uppercase flex items-center justify-between">
                    <span>Keterangan Alasan Izin *</span>
                    <span className="text-[10px] text-slate-400 font-normal">Min. 5 karakter</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={keteranganIzin}
                    onChange={(e) => setKeteranganIzin(e.target.value)}
                    placeholder="Contoh: Mengikuti ujian susulan praktikum fisika"
                    className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-blue-600/30"
                  />
                </div>

                {/* Upload Bukti File Langsung atau Tautan URL */}
                <div className="space-y-1.5 p-3 rounded-2xl bg-blue-50/60 border border-blue-200/70">
                  <label className="text-[11px] font-bold text-slate-700 uppercase flex items-center justify-between">
                    <span>Unggah Berkas Bukti / Surat *</span>
                    <span className="text-[10px] text-blue-600 font-semibold">Foto / PDF</span>
                  </label>
                  
                  <div className="flex items-center gap-2">
                    <input
                      ref={proofFileInputRef}
                      type="file"
                      accept="image/jpeg,image/png,image/webp,application/pdf"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          setProofFile(file);
                        }
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => proofFileInputRef.current?.click()}
                      className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-white border border-dashed border-blue-400 rounded-xl text-xs font-bold text-blue-700 hover:bg-blue-50 transition cursor-pointer"
                    >
                      <Upload className="w-4 h-4 text-blue-600 shrink-0" />
                      <span className="truncate max-w-[200px]">
                        {proofFile ? `${proofFile.name} (${(proofFile.size / 1024).toFixed(0)} KB)` : 'Pilih File Surat Dokter / Tugas'}
                      </span>
                    </button>

                    {proofFile && (
                      <button
                        type="button"
                        onClick={() => {
                          setProofFile(null);
                          if (proofFileInputRef.current) proofFileInputRef.current.value = '';
                        }}
                        className="p-2 text-rose-500 hover:bg-rose-50 rounded-lg text-xs font-bold cursor-pointer"
                        title="Batal pilih file"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    )}
                  </div>

                  <div className="pt-1">
                    <span className="text-[10px] text-slate-400 block mb-1">Atau tempelkan tautan URL berkas:</span>
                    <input
                      type="url"
                      value={proofUrl}
                      onChange={(e) => setProofUrl(e.target.value)}
                      placeholder="https://drive.google.com/..."
                      className="w-full px-3 py-1.5 text-xs border border-slate-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-blue-600/30"
                    />
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleAjukanIzin}
                  disabled={isUploadingProof}
                  className="w-full py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-bold text-xs rounded-xl shadow-md shadow-blue-600/25 transition cursor-pointer mt-1 disabled:opacity-70 flex items-center justify-center gap-2"
                >
                  {isUploadingProof ? (
                    <>
                      <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      <span>Mengunggah Berkas ke Drive...</span>
                    </>
                  ) : (
                    <span>Kirim Pengajuan Izin</span>
                  )}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Modal Presensi Tugas Delegasi Bank Indonesia (Wilayah 9 & 10 Ciayumajakuning) */}
      {showDelegasiModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-md rounded-[32px] bg-white p-6 shadow-2xl space-y-4 relative border border-slate-100 max-h-[90vh] flex flex-col">
            <button
              onClick={() => {
                setShowDelegasiModal(false);
                setDelegasiSuccess(false);
              }}
              className="absolute top-4 right-4 p-2 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            <div>
              <div className="flex items-center gap-1.5 mb-1">
                <span className="px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-900 border border-amber-300 text-[10px] font-black uppercase tracking-wider">
                  ⭐ Presensi Luar Kampus
                </span>
                <span className="px-2 py-0.5 rounded-full bg-purple-100 text-purple-900 text-[10px] font-bold">
                  Wilayah 9 & 10
                </span>
              </div>
              <h3 className="text-base font-black text-slate-900">
                Presensi Tugas Delegasi BI
              </h3>
              <p className="text-xs text-slate-500">
                Khusus perwakilan GenBI UNMA yang ditugaskan pada agenda Bank Indonesia di Ciayumajakuning (+30 Poin).
              </p>
            </div>

            {delegasiSuccess ? (
              <div className="p-5 rounded-2xl bg-emerald-50 border border-emerald-200 text-center space-y-2.5">
                <CheckCircle2 className="w-10 h-10 text-emerald-600 mx-auto" />
                <h4 className="text-sm font-bold text-emerald-900">Presensi Delegasi Berhasil Dikirim!</h4>
                <p className="text-xs text-emerald-700 leading-relaxed">
                  Laporan tugas delegasi Anda beserta koordinat GPS lokasi & foto bukti telah terkirim dan diteruskan ke Pengurus BPH untuk diverifikasi. Poin reward (+30 Poin) akan otomatis masuk ke evaluasi Anda setelah disetujui.
                </p>
                <button
                  onClick={() => {
                    setShowDelegasiModal(false);
                    setDelegasiSuccess(false);
                  }}
                  className="mt-2 w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition cursor-pointer"
                >
                  Tutup
                </button>
              </div>
            ) : (
              <div className="space-y-3.5 text-left overflow-y-auto pr-1 flex-1">
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-700 uppercase flex items-center justify-between">
                    <span>Nama Agenda / Kegiatan Delegasi *</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={delegasiTitle}
                    onChange={(e) => setDelegasiTitle(e.target.value)}
                    placeholder="Contoh: Diseminasi CBP Rupiah & Festival QRIS 2026"
                    className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-amber-500/30"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-700 uppercase">
                    Lokasi Wilayah Tugas (Wilayah 9 & 10) *
                  </label>
                  <select
                    value={delegasiCity}
                    onChange={(e) => setDelegasiCity(e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-amber-500/30 font-medium"
                  >
                    <option value="Kantor Perwakilan BI Cirebon">Kantor Perwakilan BI Cirebon (Jl. Yos Sudarso)</option>
                    <option value="Kota Cirebon">Kota Cirebon</option>
                    <option value="Kabupaten Cirebon">Kabupaten Cirebon</option>
                    <option value="Kabupaten Kuningan">Kabupaten Kuningan</option>
                    <option value="Kabupaten Indramayu">Kabupaten Indramayu</option>
                    <option value="Kabupaten Majalengka">Kabupaten Majalengka</option>
                    <option value="Luar Wilayah (Penugasan Khusus BI)">Luar Wilayah (Penugasan Khusus BI)</option>
                  </select>
                </div>

                {/* GPS Lokasi Nyata */}
                <div className="p-3 rounded-2xl bg-amber-50/70 border border-amber-200/80 space-y-1.5">
                  <div className="flex items-center justify-between text-xs font-bold text-amber-950">
                    <span className="flex items-center gap-1.5">
                      <MapPin className="w-3.5 h-3.5 text-amber-600" />
                      <span>Koordinat GPS Nyata di Lokasi Acara</span>
                    </span>
                    <button
                      type="button"
                      onClick={handleFetchDelegasiGps}
                      disabled={isFetchingDelegasiGps}
                      className="text-[10px] px-2.5 py-0.5 rounded-lg bg-amber-200 hover:bg-amber-300 text-amber-900 font-black transition cursor-pointer"
                    >
                      {isFetchingDelegasiGps ? 'Mendeteksi...' : delegasiGps ? 'Perbarui GPS' : 'Kunci GPS'}
                    </button>
                  </div>
                  {delegasiGps ? (
                    <p className="text-[11px] font-mono text-emerald-700 font-bold">
                      ✓ GPS Terkunci: {delegasiGps.lat}, {delegasiGps.lng}
                    </p>
                  ) : (
                    <p className="text-[10px] text-amber-800">
                      Tekan tombol "Kunci GPS" di atas untuk merekam lokasi nyata Anda saat penugasan berlangsung.
                    </p>
                  )}
                </div>

                {/* Deskripsi Penugasan */}
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-700 uppercase flex items-center justify-between">
                    <span>Uraian Tugas / No. Surat Tugas *</span>
                    <span className="text-[10px] text-slate-400 font-normal">Min. 5 karakter</span>
                  </label>
                  <textarea
                    required
                    rows={2}
                    value={delegasiNote}
                    onChange={(e) => setDelegasiNote(e.target.value)}
                    placeholder="Contoh: Ditugaskan mewakili GenBI UNMA sebagai LO kepanitiaan bersama komisariat se-Ciayumajakuning."
                    className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-amber-500/30"
                  />
                </div>

                {/* Unggah Foto Selfie / ID Card Bukti di Acara */}
                <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200 space-y-2">
                  <label className="text-[11px] font-bold text-slate-800 uppercase flex items-center justify-between">
                    <span>Foto Selfie di Lokasi / ID Card Delegasi *</span>
                    <span className="text-[10px] text-purple-600 font-bold">Google Drive</span>
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      ref={delegasiFileInputRef}
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          setDelegasiFile(file);
                        }
                      }}
                      className="hidden"
                    />
                    <button
                      type="button"
                      onClick={() => delegasiFileInputRef.current?.click()}
                      className="flex-1 flex items-center justify-center gap-2 px-3 py-2.5 bg-white border border-dashed border-amber-400 rounded-xl text-xs font-bold text-amber-800 hover:bg-amber-50 transition cursor-pointer"
                    >
                      <Camera className="w-4 h-4 text-amber-600 shrink-0" />
                      <span className="truncate max-w-[200px]">
                        {delegasiFile ? `${delegasiFile.name} (${(delegasiFile.size / 1024).toFixed(0)} KB)` : 'Pilih Foto / Ambil Kamera'}
                      </span>
                    </button>

                    {delegasiFile && (
                      <button
                        type="button"
                        onClick={() => {
                          setDelegasiFile(null);
                          if (delegasiFileInputRef.current) delegasiFileInputRef.current.value = '';
                        }}
                        className="p-2 text-slate-400 hover:text-slate-600 cursor-pointer"
                        title="Hapus foto"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                  <p className="text-[10px] text-slate-500">
                    Foto otomatis diunggah ke Google Drive dan langsung terhubung ke dashboard admin BPH.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={handleAjukanDelegasi}
                  disabled={isUploadingDelegasi}
                  className="w-full py-3 bg-gradient-to-r from-amber-500 via-amber-600 to-yellow-600 hover:from-amber-600 hover:to-yellow-700 active:scale-[0.98] text-slate-950 font-black text-xs rounded-xl shadow-md shadow-amber-500/25 transition disabled:opacity-60 cursor-pointer flex items-center justify-center gap-2"
                >
                  {isUploadingDelegasi ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Mengunggah Bukti & Menyimpan...</span>
                    </>
                  ) : (
                    <>
                      <Award className="w-4 h-4 text-slate-950" />
                      <span>Kirim Presensi Delegasi (+30 Poin)</span>
                    </>
                  )}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Modal Pengaturan Profil Anggota */}
      {showProfileModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-md rounded-[32px] bg-white p-6 sm:p-7 shadow-2xl space-y-4 relative border border-slate-100">
            <button
              onClick={() => setShowProfileModal(false)}
              className="absolute top-4 right-4 p-2 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="text-left">
              <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md bg-blue-50 text-blue-700 text-[10px] font-black uppercase tracking-wider mb-1">
                Data Anggota Resmi
              </div>
              <h3 className="text-base sm:text-lg font-black text-slate-900">
                Pengaturan Profil Pribadi
              </h3>
              <p className="text-xs text-slate-500">
                Lengkapi nomor WhatsApp, program studi, dan biodata profil Anda.
              </p>
            </div>

            {/* Foto Profil Anggota & ID Card */}
            <div className="flex items-center gap-4 p-3 rounded-2xl bg-gradient-to-r from-blue-50/70 via-indigo-50/40 to-slate-50 border border-blue-100/80">
              <div
                onClick={() => avatarFileInputRef.current?.click()}
                className="group relative w-16 h-16 rounded-full shrink-0 p-0.5 bg-gradient-to-tr from-blue-600 to-indigo-600 shadow-md cursor-pointer"
                title="Pilih foto profil"
              >
                <div className="w-full h-full rounded-full bg-slate-900 border-2 border-white flex items-center justify-center text-white font-black text-xl uppercase overflow-hidden">
                  {profile.avatarUrl ? (
                    <img src={profile.avatarUrl} alt={profile.fullName} className="w-full h-full object-cover" />
                  ) : (
                    profile.fullName.charAt(0)
                  )}
                </div>
                <div className="absolute inset-0 bg-slate-950/60 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                  <Camera className="w-5 h-5 text-white" />
                </div>
              </div>
              <div className="flex-1 min-w-0">
                <h4 className="text-xs font-black text-slate-800 uppercase tracking-wider">
                  Foto ID Card & Profil
                </h4>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Foto otomatis tersinkronisasi dengan ID Card dan akun Anda.
                </p>
                <div className="flex items-center gap-2 mt-2">
                  <button
                    type="button"
                    onClick={() => avatarFileInputRef.current?.click()}
                    disabled={isUploadingAvatar}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-[11px] font-bold shadow-xs transition cursor-pointer disabled:opacity-50"
                  >
                    <Camera className="w-3 h-3" />
                    <span>{isUploadingAvatar ? 'Memproses...' : profile.avatarUrl ? 'Ganti Foto' : 'Unggah Foto'}</span>
                  </button>
                  {profile.avatarUrl && (
                    <button
                      type="button"
                      onClick={handleRemoveAvatar}
                      disabled={isUploadingAvatar}
                      className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-600 text-[11px] font-bold transition cursor-pointer"
                    >
                      <Trash2 className="w-3 h-3" />
                      <span>Hapus</span>
                    </button>
                  )}
                </div>
              </div>
            </div>

            <form onSubmit={handleSaveProfile} className="space-y-3 pt-1">
              {/* Nama Lengkap */}
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-slate-600 uppercase">
                  Nama Lengkap
                </label>
                <div className="relative">
                  <User className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
                  <input
                    type="text"
                    required
                    value={editFullName}
                    onChange={(e) => setEditFullName(e.target.value)}
                    placeholder="Nama Lengkap Anda"
                    className="w-full pl-9 pr-3 py-2 text-xs border border-slate-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-blue-600/30"
                  />
                </div>
              </div>

              {/* NPM & Divisi (Readonly SK) */}
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-600 uppercase">
                    NPM (Terkunci SK)
                  </label>
                  <input
                    type="text"
                    disabled
                    value={profile.npm || profile.nim}
                    className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl bg-slate-100 text-slate-500 font-mono"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-600 uppercase">
                    Divisi (Terkunci SK)
                  </label>
                  <input
                    type="text"
                    disabled
                    value={profile.role === 'kadiv' ? `Kadiv ${profile.division}` : profile.division}
                    className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl bg-slate-100 text-slate-500 font-bold"
                  />
                </div>
              </div>

              {/* No WhatsApp / HP */}
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-slate-600 uppercase">
                  Nomor WhatsApp Aktif
                </label>
                <div className="relative">
                  <Phone className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
                  <input
                    type="tel"
                    value={editPhone}
                    onChange={(e) => setEditPhone(e.target.value)}
                    placeholder="Contoh: 081234567890"
                    className="w-full pl-9 pr-3 py-2 text-xs border border-slate-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-blue-600/30"
                  />
                </div>
              </div>

              {/* Program Studi / Fakultas */}
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-slate-600 uppercase">
                  Program Studi & Fakultas
                </label>
                <div className="relative">
                  <GraduationCap className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
                  <input
                    type="text"
                    value={editStudyProgram}
                    onChange={(e) => setEditStudyProgram(e.target.value)}
                    placeholder="Contoh: Teknik Informatika - FT UNMA"
                    className="w-full pl-9 pr-3 py-2 text-xs border border-slate-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-blue-600/30"
                  />
                </div>
              </div>

              {/* Bio / Motto */}
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-slate-600 uppercase">
                  Bio / Motto Singkat
                </label>
                <textarea
                  rows={2}
                  value={editBio}
                  onChange={(e) => setEditBio(e.target.value)}
                  placeholder="Tuliskan komitmen atau motto Anda di GenBI..."
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-blue-600/30 resize-none"
                />
              </div>

              <div className="pt-2 flex gap-2">
                <button
                  type="button"
                  onClick={() => setShowProfileModal(false)}
                  className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isSavingProfile}
                  className="flex-1 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-bold text-xs rounded-xl shadow-md shadow-blue-600/25 transition cursor-pointer disabled:opacity-70"
                >
                  {isSavingProfile ? 'Menyimpan...' : 'Simpan Profil'}
                </button>
              </div>
            </form>

            {/* Bagian Ubah Password / PIN Mandiri */}
            <div className="pt-3 border-t border-slate-100 space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-xs font-bold text-slate-800">
                  <KeyRound className="w-3.5 h-3.5 text-blue-600" />
                  <span>Keamanan Akun (Password / PIN)</span>
                </div>
                <button
                  type="button"
                  onClick={() => setShowPasswordForm(!showPasswordForm)}
                  className="text-[11px] font-bold text-blue-600 hover:underline cursor-pointer"
                >
                  {showPasswordForm ? 'Sembunyikan' : 'Ganti Password'}
                </button>
              </div>

              {showPasswordForm && (
                <form onSubmit={handleUpdatePassword} className="p-3 bg-slate-50 border border-slate-200 rounded-2xl space-y-2.5 animate-in fade-in">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-600 uppercase">
                      PIN / Password Saat Ini
                    </label>
                    <input
                      type="password"
                      value={oldPassword}
                      onChange={(e) => setOldPassword(e.target.value)}
                      placeholder="Masukkan PIN saat ini (default: genbi123)..."
                      className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-blue-600/30 font-medium"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-600 uppercase">
                      PIN / Password Baru (Min. 4 Karakter)
                    </label>
                    <div className="relative">
                      <input
                        type={showPasswordText ? 'text' : 'password'}
                        required
                        minLength={4}
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        placeholder="Masukkan PIN baru..."
                        className="w-full px-3 py-2 pr-9 text-xs border border-slate-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-blue-600/30 font-medium"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPasswordText(!showPasswordText)}
                        className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600 cursor-pointer"
                      >
                        {showPasswordText ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-600 uppercase">
                      Ulangi PIN Baru
                    </label>
                    <input
                      type={showPasswordText ? 'text' : 'password'}
                      required
                      minLength={4}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Konfirmasi PIN baru..."
                      className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-blue-600/30 font-medium"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={isUpdatingPassword}
                    className="w-full py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl transition cursor-pointer disabled:opacity-60"
                  >
                    {isUpdatingPassword ? 'Memperbarui...' : 'Simpan PIN Baru'}
                  </button>
                </form>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Hidden File Input untuk Unggah Foto Profil Anggota */}
      <input
        ref={avatarFileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleAvatarFileChange}
      />

      {/* Modal Cetak Rapor Keaktifan & Rekomendasi Beasiswa Bank Indonesia */}
      {showReportModal && (
        <MemberReportModal
          evaluation={evaluation}
          onClose={() => setShowReportModal(false)}
        />
      )}
    </div>
  );
};

export default DashboardPage;
