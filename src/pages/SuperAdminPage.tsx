import React, { useState, useEffect } from 'react';
import {
  Users,
  Calendar,
  Sparkles,
  Database,
  RefreshCw,
  LogOut,
  Pencil,
  Crown,
  Shield,
  User,
  Search,
  Sliders,
  Laptop,
  Check,
  Server,
  CloudUpload,
  AlertTriangle,
  Download,
  Upload,
  CalendarDays,
  Plus,
  Trash2,
  CheckCircle2,
  ShieldAlert,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { Division, Role } from '../types/database';
import { syncMemberUpdate, normalizeStudentId } from '../lib/memberSync';
import {
  AcademicPeriod,
  getAcademicPeriods,
  saveAcademicPeriod,
  setActivePeriod,
  deleteAcademicPeriod,
} from '../lib/periodSync';
import {
  AuditLog,
  getAuditLogs,
  clearAuditLogs,
  recordAuditLog,
} from '../lib/auditLog';
import { AdminDashboardPage } from './AdminDashboardPage';
import DashboardPage from './DashboardPage';
import { Footer } from '../components/Footer';

interface SuperAdminPageProps {
  onLogout: () => void;
}

interface MemberUser {
  npm: string;
  nim?: string;
  fullName: string;
  division: Division;
  role: Role;
  isClaimed?: boolean;
  email?: string;
  source: 'database' | 'whitelist' | 'override';
}

const DEFAULT_MEMBERS_ROSTER: MemberUser[] = [
  { npm: '2414101078', nim: '2414101078', fullName: 'Pangki Deswa Rayhandi', division: 'BPH', role: 'admin', isClaimed: true, email: 'admin@genbi-unma.ac.id', source: 'whitelist' },
  { npm: '2214100010', nim: '2214100010', fullName: 'Deden Kurniawan', division: 'Publikasi dan Sosialisasi', role: 'kadiv', isClaimed: true, email: 'deden@genbi-unma.ac.id', source: 'whitelist' },
  { npm: '2214100025', nim: '2214100025', fullName: 'Siti Rahmawati', division: 'Pendidikan', role: 'kadiv', isClaimed: true, email: 'siti@genbi-unma.ac.id', source: 'whitelist' },
  { npm: '2214100033', nim: '2214100033', fullName: 'Fajar Pratama', division: 'Lingkungan Hidup', role: 'kadiv', isClaimed: true, email: 'fajar@genbi-unma.ac.id', source: 'whitelist' },
  { npm: '2214100048', nim: '2214100048', fullName: 'Anisa Permata', division: 'Publikasi dan Sosialisasi', role: 'member', isClaimed: true, email: 'anisa@genbi-unma.ac.id', source: 'whitelist' },
  { npm: '2214100052', nim: '2214100052', fullName: 'Rizky Ramadhan', division: 'Kewirausahaan', role: 'member', isClaimed: false, email: 'rizky@genbi-unma.ac.id', source: 'whitelist' },
  { npm: '2214100067', nim: '2214100067', fullName: 'Nadia Putri', division: 'Pengabdian Masyarakat', role: 'member', isClaimed: false, email: 'nadia@genbi-unma.ac.id', source: 'whitelist' },
];

export const SuperAdminPage: React.FC<SuperAdminPageProps> = ({ onLogout }) => {
  const [activeTab, setActiveTab] = useState<'users' | 'periods' | 'bph-panel' | 'simulator' | 'system' | 'audit'>('users');
  const [members, setMembers] = useState<MemberUser[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterDivision, setFilterDivision] = useState<string>('all');
  const [filterRole, setFilterRole] = useState<string>('all');

  // Modal Ubah Hak Akses Pengguna
  const [editingMember, setEditingMember] = useState<MemberUser | null>(null);
  const [editName, setEditName] = useState('');
  const [editDivision, setEditDivision] = useState<Division>('Publikasi dan Sosialisasi');
  const [editRole, setEditRole] = useState<Role>('member');
  const [isSavingEdit, setIsSavingEdit] = useState(false);

  // State Simulator Multi-Role
  const [simulatedRole, setSimulatedRole] = useState<'admin' | 'kadiv' | 'member'>('member');
  const [simulatedDivision, setSimulatedDivision] = useState<Division>('Publikasi dan Sosialisasi');

  // State CRUD Periode Kepengurusan
  const [periods, setPeriods] = useState<AcademicPeriod[]>(getAcademicPeriods());
  const [showPeriodModal, setShowPeriodModal] = useState(false);
  const [editingPeriod, setEditingPeriod] = useState<AcademicPeriod | null>(null);
  const [periodName, setPeriodName] = useState('');
  const [periodYear, setPeriodYear] = useState('2026/2027');
  const [periodSemester, setPeriodSemester] = useState<'Ganjil' | 'Genap'>('Ganjil');
  const [periodIsActive, setPeriodIsActive] = useState(false);
  const [isSavingPeriod, setIsSavingPeriod] = useState(false);

  // State Audit Trail & Log Keamanan
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>(getAuditLogs());
  const [auditSearch, setAuditSearch] = useState('');
  const [auditFilterType, setAuditFilterType] = useState<string>('all');

  // Load Semua Data Member dari Database + Overrides
  const loadAllUsers = async () => {
    setIsLoading(true);
    try {
      let overrides: Record<string, any> = {};
      try {
        const raw = localStorage.getItem('simak_whitelist_overrides');
        if (raw) overrides = JSON.parse(raw);
      } catch {}

      // Ambil dari Supabase profiles & authorized_members
      let combinedMap = new Map<string, MemberUser>();

      // Isi dari default roster dulu
      for (const def of DEFAULT_MEMBERS_ROSTER) {
        const cleanId = normalizeStudentId(def.npm);
        const ov = overrides[cleanId];
        combinedMap.set(cleanId, {
          ...def,
          npm: cleanId,
          nim: cleanId,
          ...(ov ? {
            fullName: ov.full_name || def.fullName,
            division: ov.division || def.division,
            role: ov.role || def.role,
            source: 'override' as const,
          } : {}),
        });
      }

      // Ambil authorized_members
      try {
        const { data: authData } = await (supabase.from('authorized_members') as any).select('*');
        if (authData && authData.length > 0) {
          for (const item of authData) {
            const cleanId = normalizeStudentId(item.npm || item.nim);
            if (!cleanId) continue;
            const ov = overrides[cleanId];
            combinedMap.set(cleanId, {
              npm: cleanId,
              nim: cleanId,
              fullName: ov?.full_name || item.full_name || 'Anggota GenBI',
              division: (ov?.division || item.division || 'Publikasi dan Sosialisasi') as Division,
              role: (ov?.role || item.role || 'member') as Role,
              isClaimed: Boolean(item.is_claimed),
              source: ov ? 'override' : 'database',
            });
          }
        }
      } catch {}

      // Ambil profiles untuk data akun aktif
      try {
        const { data: profData } = await supabase.from('profiles').select('*');
        if (profData && profData.length > 0) {
          for (const p of profData) {
            const cleanId = normalizeStudentId(p.npm || p.nim);
            if (!cleanId) continue;
            const ov = overrides[cleanId];
            const existing = combinedMap.get(cleanId);
            combinedMap.set(cleanId, {
              npm: cleanId,
              nim: cleanId,
              fullName: ov?.full_name || p.full_name || existing?.fullName || 'Pengguna GenBI',
              division: (ov?.division || p.division || existing?.division || 'Publikasi dan Sosialisasi') as Division,
              role: (ov?.role || p.role || existing?.role || 'member') as Role,
              isClaimed: true,
              email: p.email || existing?.email,
              source: ov ? 'override' : 'database',
            });
          }
        }
      } catch {}

      setMembers(Array.from(combinedMap.values()));
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadAllUsers();

    const handleSync = () => {
      loadAllUsers();
    };

    const handlePeriodSync = () => {
      setPeriods(getAcademicPeriods());
    };

    const handleAuditSync = () => {
      setAuditLogs(getAuditLogs());
    };

    window.addEventListener('simak_member_sync', handleSync);
    window.addEventListener('simak_period_sync', handlePeriodSync);
    window.addEventListener('simak_audit_sync', handleAuditSync);
    return () => {
      window.removeEventListener('simak_member_sync', handleSync);
      window.removeEventListener('simak_period_sync', handlePeriodSync);
      window.removeEventListener('simak_audit_sync', handleAuditSync);
    };
  }, []);

  // CRUD Handler Periode Kepengurusan
  const handleOpenAddPeriod = () => {
    setEditingPeriod(null);
    setPeriodName('');
    setPeriodYear('2026/2027');
    setPeriodSemester('Ganjil');
    setPeriodIsActive(periods.length === 0);
    setShowPeriodModal(true);
  };

  const handleOpenEditPeriod = (p: AcademicPeriod) => {
    setEditingPeriod(p);
    setPeriodName(p.name);
    setPeriodYear(p.academicYear);
    setPeriodSemester(p.semester);
    setPeriodIsActive(p.isActive);
    setShowPeriodModal(true);
  };

  const handleSavePeriodSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!periodName.trim()) {
      alert('Nama periode wajib diisi (contoh: T.A. 2026/2027 Ganjil)!');
      return;
    }

    setIsSavingPeriod(true);
    try {
      const updated = await saveAcademicPeriod({
        id: editingPeriod ? editingPeriod.id : undefined,
        name: periodName.trim(),
        academicYear: periodYear.trim(),
        semester: periodSemester,
        isActive: periodIsActive,
      });
      setPeriods(updated);
      setShowPeriodModal(false);
      recordAuditLog({
        actorName: 'Super Admin Root',
        actorRole: 'Super Admin',
        actionType: editingPeriod ? 'PERIOD_CREATE' : 'PERIOD_CREATE',
        target: periodName.trim(),
        description: `${editingPeriod ? 'Memperbarui' : 'Membuat'} periode kepengurusan "${periodName.trim()}" (${periodSemester}).`,
      });
      alert(
        editingPeriod
          ? `Periode "${periodName}" berhasil diperbarui!`
          : `Periode baru "${periodName}" berhasil ditambahkan!`
      );
    } catch (err: any) {
      alert('Gagal menyimpan periode: ' + (err.message || 'Terjadi kesalahan sistem'));
    } finally {
      setIsSavingPeriod(false);
    }
  };

  const handleSetActivePeriod = async (id: string, name: string) => {
    try {
      const updated = await setActivePeriod(id);
      setPeriods(updated);
      recordAuditLog({
        actorName: 'Super Admin Root',
        actorRole: 'Super Admin',
        actionType: 'PERIOD_ACTIVATE',
        target: name,
        description: `Menetapkan periode "${name}" sebagai periode kepengurusan aktif SIMAK GENBI.`,
      });
      alert(`Periode "${name}" sekarang aktif sebagai kepengurusan berjalan!`);
    } catch (err: any) {
      alert('Gagal mengaktifkan periode: ' + err.message);
    }
  };

  const handleDeletePeriod = async (id: string, name: string) => {
    if (periods.length <= 1) {
      alert('Tidak dapat menghapus periode terakhir! Sistem harus memiliki minimal satu periode.');
      return;
    }
    const confirmDelete = window.confirm(`Apakah Anda yakin ingin menghapus data periode "${name}"?`);
    if (!confirmDelete) return;

    try {
      const updated = await deleteAcademicPeriod(id);
      setPeriods(updated);
      recordAuditLog({
        actorName: 'Super Admin Root',
        actorRole: 'Super Admin',
        actionType: 'PERIOD_DELETE',
        target: name,
        description: `Menghapus periode kepengurusan "${name}" dari sistem database.`,
      });
      alert(`Periode "${name}" berhasil dihapus.`);
    } catch (err: any) {
      alert('Gagal menghapus periode: ' + err.message);
    }
  };

  // Buka Modal Edit Hak Akses
  const handleOpenEdit = (m: MemberUser) => {
    setEditingMember(m);
    setEditName(m.fullName);
    setEditDivision(m.division);
    setEditRole(m.role);
  };

  // Simpan Perubahan Hak Akses / Role
  const handleSaveMemberAccess = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingMember || !editName.trim()) {
      alert('Nama pengguna wajib diisi!');
      return;
    }

    setIsSavingEdit(true);
    const cleanId = normalizeStudentId(editingMember.npm || editingMember.nim);

    try {
      // 1. Update state tabel secara instan
      setMembers((prev) =>
        prev.map((m) =>
          normalizeStudentId(m.npm || m.nim) === cleanId
            ? {
                ...m,
                fullName: editName.trim(),
                division: editDivision,
                role: editRole,
                source: 'override',
              }
            : m
        )
      );

      // 2. Jalankan sinkronisasi universal ke Supabase, LocalStorage, dan Event Bus
      await syncMemberUpdate({
        npm: cleanId,
        nim: editingMember.nim,
        fullName: editName.trim(),
        division: editDivision,
        role: editRole,
      });

      recordAuditLog({
        actorName: 'Super Admin Root',
        actorRole: 'Super Admin',
        actionType: 'ROLE_CHANGE',
        target: `${cleanId} (${editName.trim()})`,
        description: `Mengubah hak akses "${editName.trim()}" menjadi ${editRole === 'admin' ? 'BPH / Administrator' : editRole === 'kadiv' ? 'Kepala Divisi' : 'Anggota'} pada divisi ${editDivision}.`,
      });

      setEditingMember(null);
      alert(`Sukses! Hak akses untuk ${editName.trim()} berhasil diubah menjadi ${editRole === 'admin' ? 'BPH / Admin' : editRole === 'kadiv' ? 'Kepala Divisi' : 'Anggota'} dan disinkronkan ke seluruh sistem!`);
    } catch (err: any) {
      alert(err.message || 'Gagal menyimpan perubahan hak akses.');
    } finally {
      setIsSavingEdit(false);
    }
  };

  // Reset & Sinkronisasi Ulang Database Cache
  const handleClearAndResync = () => {
    if (!confirm('Bersihkan cache overrides lokal dan sinkronkan ulang seluruh data langsung dari Supabase?')) return;
    localStorage.removeItem('simak_whitelist_overrides');
    localStorage.removeItem('simak_leaderboard_cache');
    loadAllUsers();
    alert('Cache lokal berhasil dibersihkan dan data disinkronkan ulang!');
  };

  // Unduh Full Cadangan Database & Local Persistence (.JSON)
  const handleDownloadBackup = async () => {
    try {
      let authMembers: any[] = [];
      let eventsList: any[] = [];
      let attendancesList: any[] = [];
      let profilesList: any[] = [];

      try {
        const { data } = await supabase.from('authorized_members').select('*');
        if (data) authMembers = data;
      } catch {}
      try {
        const { data } = await supabase.from('events').select('*');
        if (data) eventsList = data;
      } catch {}
      try {
        const { data } = await supabase.from('attendances').select('*');
        if (data) attendancesList = data;
      } catch {}
      try {
        const { data } = await supabase.from('profiles').select('*');
        if (data) profilesList = data;
      } catch {}

      const backupData = {
        meta: {
          system: 'SIMAK GENBI UNMA',
          version: '2.0.0',
          backupDate: new Date().toISOString(),
          author: 'Pangki Deswa Rayhandi (Super Admin)',
        },
        database: {
          authorized_members: authMembers,
          profiles: profilesList,
          events: eventsList,
          attendances: attendancesList,
        },
        localPersistence: {
          whitelist_overrides: localStorage.getItem('simak_whitelist_overrides'),
          events_overrides: localStorage.getItem('simak_events_overrides'),
          all_attendances: localStorage.getItem('simak_all_attendances'),
          user_passwords: localStorage.getItem('simak_user_passwords'),
          evaluations_overrides: localStorage.getItem('simak_evaluations_overrides'),
          academic_periods: localStorage.getItem('simak_academic_periods'),
          audit_logs: localStorage.getItem('simak_audit_logs'),
          offline_queue: localStorage.getItem('simak_offline_queue'),
        },
      };

      const blob = new Blob([JSON.stringify(backupData, null, 2)], {
        type: 'application/json',
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `BACKUP_SIMAK_GENBI_UNMA_${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (err: any) {
      alert('Gagal membuat backup: ' + err.message);
    }
  };

  // Pulihkan Data dari Berkas Cadangan JSON
  const handleRestoreBackup = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (
      !confirm(
        `Pulihkan data sistem dari berkas "${file.name}"?\nPERINGATAN: Seluruh cache lokal, periode kepengurusan, dan data presensi akan dipulihkan sesuai berkas cadangan ini.`
      )
    ) {
      e.target.value = '';
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const content = event.target?.result as string;
        const parsed = JSON.parse(content);

        if (!parsed.meta?.system || !parsed.meta.system.includes('SIMAK GENBI')) {
          throw new Error('File JSON tidak valid atau bukan berkas cadangan resmi SIMAK GENBI.');
        }

        if (parsed.localPersistence) {
          const lp = parsed.localPersistence;
          if (lp.whitelist_overrides) localStorage.setItem('simak_whitelist_overrides', lp.whitelist_overrides);
          if (lp.events_overrides) localStorage.setItem('simak_events_overrides', lp.events_overrides);
          if (lp.all_attendances) localStorage.setItem('simak_all_attendances', lp.all_attendances);
          if (lp.user_passwords) localStorage.setItem('simak_user_passwords', lp.user_passwords);
          if (lp.evaluations_overrides) localStorage.setItem('simak_evaluations_overrides', lp.evaluations_overrides);
          if (lp.academic_periods) localStorage.setItem('simak_academic_periods', lp.academic_periods);
          if (lp.audit_logs) localStorage.setItem('simak_audit_logs', lp.audit_logs);
          if (lp.offline_queue) localStorage.setItem('simak_offline_queue', lp.offline_queue);
        }

        alert('Data cadangan berhasil dipulihkan! Seluruh pengguna, periode, dan riwayat presensi langsung disinkronkan.');
        loadAllUsers();
        setPeriods(getAcademicPeriods());
        setAuditLogs(getAuditLogs());
        window.dispatchEvent(new CustomEvent('simak_member_sync', { detail: { npm: 'RESTORE_ALL' } }));
        window.dispatchEvent(new CustomEvent('simak_period_sync', { detail: { action: 'restore' } }));
        window.dispatchEvent(new CustomEvent('simak_attendance_sync', { detail: { action: 'restore' } }));
      } catch (err: any) {
        alert('Gagal memulihkan cadangan: ' + err.message);
      } finally {
        e.target.value = '';
      }
    };
    reader.readAsText(file);
  };

  // Filter daftar pengguna
  const filteredMembers = members.filter((m) => {
    const q = searchQuery.toLowerCase();
    const matchQuery =
      m.fullName.toLowerCase().includes(q) ||
      m.npm.toLowerCase().includes(q) ||
      (m.email && m.email.toLowerCase().includes(q));

    const matchDivision = filterDivision === 'all' || m.division === filterDivision;
    const matchRole = filterRole === 'all' || m.role === filterRole;

    return matchQuery && matchDivision && matchRole;
  });

  // User session untuk BPH Panel Operasional
  const superAdminBphUser = {
    id: '00000000-0000-0000-0000-000000000001',
    npm: 'SUPERADMIN',
    nim: 'SUPERADMIN',
    fullName: 'Pangki Deswa Rayhandi (Super Admin)',
    division: 'BPH',
    role: 'admin' as Role,
  };

  // User session untuk Simulator Multi-Role
  const simulatedUser = {
    id: '00000000-0000-0000-0000-000000000001',
    npm: 'SUPERADMIN',
    nim: 'SUPERADMIN',
    fullName: `Pangki Deswa Rayhandi (Simulasi ${simulatedRole === 'kadiv' ? 'Kepala Divisi' : 'Anggota'})`,
    division: simulatedDivision,
    role: simulatedRole,
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col antialiased selection:bg-purple-600 selection:text-white">
      {/* HEADER UTAMA SUPER ADMIN */}
      <header className="sticky top-0 z-40 bg-slate-950/90 backdrop-blur-xl border-b border-purple-900/40 px-4 sm:px-6 lg:px-8 py-3.5 shadow-xl shadow-purple-950/20">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-white p-1.5 shadow-md border border-purple-500/30 flex items-center justify-center">
              <img
                src="/logo-genbi.png"
                alt="Logo GenBI UNMA"
                className="w-full h-full object-contain"
              />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-sm sm:text-base font-black tracking-tight text-white flex items-center gap-1.5">
                  <span>SIMAK GENBI</span>
                  <span className="text-purple-400 font-extrabold">• SUPER ADMIN</span>
                </h1>
                <span className="px-2 py-0.5 rounded-full bg-purple-500/20 border border-purple-400/30 text-purple-300 text-[10px] font-black uppercase tracking-wider">
                  ROOT SYSTEM
                </span>
              </div>
              <p className="text-[11px] text-slate-400 font-medium">
                Pusat Kontrol Tertinggi Sistem & Pengembang Tunggal • Pangki Deswa Rayhandi
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-xl bg-purple-950/40 border border-purple-800/40 text-xs">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-[11px] font-mono text-purple-200">Supabase: Online</span>
            </div>

            <button
              onClick={onLogout}
              className="px-3.5 py-1.5 rounded-xl bg-red-950/50 hover:bg-red-900/70 border border-red-800/50 text-red-300 hover:text-white text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-xs"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Keluar</span>
            </button>
          </div>
        </div>
      </header>

      {/* NAVIGASI 4 TAB UTAMA SUPER ADMIN */}
      <div className="bg-slate-900/60 border-b border-slate-800 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto flex items-center gap-1 overflow-x-auto py-2 no-scrollbar">
          <button
            onClick={() => setActiveTab('users')}
            className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-extrabold transition flex items-center gap-2 whitespace-nowrap cursor-pointer ${
              activeTab === 'users'
                ? 'bg-purple-600 text-white shadow-md shadow-purple-600/30'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
            }`}
          >
            <Users className="w-4 h-4 text-purple-300" />
            <span>Manajemen Pengguna & Hak Akses ({members.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('periods')}
            className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-extrabold transition flex items-center gap-2 whitespace-nowrap cursor-pointer ${
              activeTab === 'periods'
                ? 'bg-purple-600 text-white shadow-md shadow-purple-600/30'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
            }`}
          >
            <CalendarDays className="w-4 h-4 text-purple-300" />
            <span>Periode Kepengurusan ({periods.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('bph-panel')}
            className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-extrabold transition flex items-center gap-2 whitespace-nowrap cursor-pointer ${
              activeTab === 'bph-panel'
                ? 'bg-purple-600 text-white shadow-md shadow-purple-600/30'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
            }`}
          >
            <Calendar className="w-4 h-4 text-purple-300" />
            <span>Panel Operasional BPH</span>
          </button>

          <button
            onClick={() => setActiveTab('simulator')}
            className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-extrabold transition flex items-center gap-2 whitespace-nowrap cursor-pointer ${
              activeTab === 'simulator'
                ? 'bg-purple-600 text-white shadow-md shadow-purple-600/30'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
            }`}
          >
            <Laptop className="w-4 h-4 text-purple-300" />
            <span>Simulator Tampilan (Kadiv / Anggota)</span>
          </button>

          <button
            onClick={() => setActiveTab('system')}
            className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-extrabold transition flex items-center gap-2 whitespace-nowrap cursor-pointer ${
              activeTab === 'system'
                ? 'bg-purple-600 text-white shadow-md shadow-purple-600/30'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
            }`}
          >
            <Database className="w-4 h-4 text-purple-300" />
            <span>Kesehatan Sistem & Database</span>
          </button>

          <button
            onClick={() => setActiveTab('audit')}
            className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-extrabold transition flex items-center gap-2 whitespace-nowrap cursor-pointer ${
              activeTab === 'audit'
                ? 'bg-purple-600 text-white shadow-md shadow-purple-600/30'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
            }`}
          >
            <ShieldAlert className="w-4 h-4 text-purple-300" />
            <span>Audit Trail & Log ({auditLogs.length})</span>
          </button>
        </div>
      </div>

      {/* KONTEN UTAMA SESUAI TAB */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8 space-y-6">
        {/* TAB 1: MANAJEMEN PENGGUNA & HAK AKSES */}
        {activeTab === 'users' && (
          <div className="space-y-6 animate-in fade-in duration-200">
            {/* Header Card & Penjelasan */}
            <div className="p-5 sm:p-6 rounded-3xl bg-gradient-to-r from-purple-950/60 via-slate-900 to-slate-900 border border-purple-500/20 shadow-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-purple-500/10 border border-purple-500/20 text-purple-300 text-[11px] font-bold uppercase mb-2">
                  <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                  <span>Master Akses Pengguna</span>
                </div>
                <h2 className="text-lg sm:text-xl font-black text-white">
                  Kontrol Hak Akses Seluruh Anggota & Pengurus
                </h2>
                <p className="text-xs sm:text-sm text-slate-400 mt-1 max-w-2xl">
                  Ubah jabatan atau status akun (BPH Admin, Kepala Divisi, Anggota) secara instan. Perubahan akan langsung tersinkronkan realtime ke seluruh sistem dan database.
                </p>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={loadAllUsers}
                  disabled={isLoading}
                  className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-purple-300 rounded-xl text-xs font-bold transition flex items-center gap-1.5 border border-slate-700 cursor-pointer disabled:opacity-50"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
                  <span>Muat Ulang</span>
                </button>
                <button
                  onClick={handleClearAndResync}
                  className="px-3.5 py-2 bg-purple-950/60 hover:bg-purple-900 border border-purple-700/50 text-purple-200 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer"
                >
                  <Sliders className="w-3.5 h-3.5 text-amber-400" />
                  <span>Sinkronkan Ulang</span>
                </button>
              </div>
            </div>

            {/* Filter & Pencarian Bar */}
            <div className="flex flex-col sm:flex-row items-center gap-3 bg-slate-900/80 p-3 rounded-2xl border border-slate-800">
              <div className="relative flex-1 w-full">
                <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Cari berdasarkan nama, NPM, atau email..."
                  className="w-full pl-10 pr-4 py-2 text-xs bg-slate-950 border border-slate-800 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-purple-500/40"
                />
              </div>

              <div className="flex items-center gap-2 w-full sm:w-auto">
                <select
                  value={filterRole}
                  onChange={(e) => setFilterRole(e.target.value)}
                  className="flex-1 sm:flex-none px-3 py-2 text-xs bg-slate-950 border border-slate-800 rounded-xl text-slate-200 font-bold focus:outline-none cursor-pointer"
                >
                  <option value="all">Semua Jabatan</option>
                  <option value="admin">BPH / Admin</option>
                  <option value="kadiv">Kepala Divisi</option>
                  <option value="member">Anggota</option>
                </select>

                <select
                  value={filterDivision}
                  onChange={(e) => setFilterDivision(e.target.value)}
                  className="flex-1 sm:flex-none px-3 py-2 text-xs bg-slate-950 border border-slate-800 rounded-xl text-slate-200 font-bold focus:outline-none cursor-pointer"
                >
                  <option value="all">Semua Divisi</option>
                  <option value="BPH">BPH</option>
                  <option value="Publikasi dan Sosialisasi">Publikasi & Sosialisasi</option>
                  <option value="Lingkungan Hidup">Lingkungan Hidup</option>
                  <option value="Pendidikan">Pendidikan</option>
                  <option value="Pengabdian Masyarakat">Pengabdian Masyarakat</option>
                  <option value="Kewirausahaan">Kewirausahaan</option>
                </select>
              </div>
            </div>

            {/* Tabel Daftar Pengguna & Akses */}
            <div className="bg-slate-900/90 rounded-3xl border border-slate-800 overflow-hidden shadow-xl">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-950/80 text-slate-400 uppercase tracking-wider text-[11px] font-black border-b border-slate-800">
                    <tr>
                      <th className="py-3.5 px-4">NPM / Identitas</th>
                      <th className="py-3.5 px-4">Nama Lengkap</th>
                      <th className="py-3.5 px-4">Divisi</th>
                      <th className="py-3.5 px-4 text-center">Hak Akses / Role</th>
                      <th className="py-3.5 px-4 text-center">Status Akun</th>
                      <th className="py-3.5 px-4 text-center">Aksi Cepat</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 font-medium">
                    {filteredMembers.map((m) => {
                      const isMe = m.npm === '2414101078';
                      return (
                        <tr key={m.npm} className="hover:bg-purple-950/20 transition">
                          <td className="py-3 px-4 font-mono font-bold text-slate-300">
                            <span className="px-2 py-0.5 rounded-lg bg-slate-950 border border-slate-800">
                              {m.npm}
                            </span>
                          </td>
                          <td className="py-3 px-4 font-bold text-white flex items-center gap-2">
                            <span>{m.fullName}</span>
                            {isMe && (
                              <span className="px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300 border border-purple-400/30 text-[9px] font-black uppercase">
                                Akun Pribadi
                              </span>
                            )}
                          </td>
                          <td className="py-3 px-4 text-slate-300">{m.division}</td>
                          <td className="py-3 px-4 text-center">
                            {m.role === 'admin' ? (
                              <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/30 text-[10px] font-black">
                                <Shield className="w-3 h-3 text-purple-400" />
                                <span>BPH / Admin</span>
                              </span>
                            ) : m.role === 'kadiv' ? (
                              <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30 text-[10px] font-black">
                                <Crown className="w-3 h-3 text-amber-400" />
                                <span>Kepala Divisi</span>
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-slate-800 text-slate-300 border border-slate-700 text-[10px] font-bold">
                                <User className="w-3 h-3 text-slate-400" />
                                <span>Anggota</span>
                              </span>
                            )}
                          </td>
                          <td className="py-3 px-4 text-center">
                            {m.isClaimed ? (
                              <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-400">
                                <Check className="w-3.5 h-3.5" />
                                <span>Aktif</span>
                              </span>
                            ) : (
                              <span className="text-[11px] text-amber-400 font-medium">
                                Menunggu
                              </span>
                            )}
                          </td>
                          <td className="py-3 px-4 text-center">
                            <button
                              onClick={() => handleOpenEdit(m)}
                              className="px-3 py-1.5 rounded-xl bg-purple-900/50 hover:bg-purple-800 text-purple-200 text-xs font-bold transition flex items-center gap-1 mx-auto border border-purple-700/50 cursor-pointer shadow-xs active:scale-95"
                            >
                              <Pencil className="w-3 h-3" />
                              <span>Ubah Hak Akses</span>
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

        {/* TAB BARU: MANAJEMEN PERIODE KEPENGURUSAN (CRUD SUPER ADMIN) */}
        {activeTab === 'periods' && (
          <div className="space-y-6 animate-in fade-in duration-200">
            {/* Header Banner */}
            <div className="p-5 sm:p-6 rounded-3xl bg-gradient-to-r from-purple-950/60 via-slate-900 to-slate-900 border border-purple-500/20 shadow-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-purple-500/10 border border-purple-500/20 text-purple-300 text-[11px] font-bold uppercase mb-2">
                  <CalendarDays className="w-3.5 h-3.5 text-purple-400" />
                  <span>Siklus Periode & Multi-Tahun</span>
                </div>
                <h2 className="text-lg sm:text-xl font-black text-white">
                  Manajemen Periode Kepengurusan GenBI
                </h2>
                <p className="text-xs text-slate-400 mt-1 max-w-2xl leading-relaxed">
                  Tambah periode semester baru, arsipkan kepengurusan demisioner, dan tetapkan periode aktif. Perubahan ini tersinkronisasi otomatis secara realtime ke panel BPH dan seluruh anggota.
                </p>
              </div>

              <button
                onClick={handleOpenAddPeriod}
                className="self-start sm:self-center px-4 py-2.5 rounded-2xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-black transition flex items-center gap-2 cursor-pointer shadow-lg shadow-purple-600/30 active:scale-95"
              >
                <Plus className="w-4 h-4" />
                <span>Tambah Periode Baru</span>
              </button>
            </div>

            {/* List Tabel Periode */}
            <div className="rounded-3xl bg-slate-900 border border-slate-800 overflow-hidden shadow-xl">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-950/80 text-slate-400 font-bold uppercase tracking-wider text-[10px] border-b border-slate-800">
                    <tr>
                      <th className="py-3.5 px-4">Nama Periode</th>
                      <th className="py-3.5 px-4">Tahun Akademik</th>
                      <th className="py-3.5 px-4">Semester</th>
                      <th className="py-3.5 px-4 text-center">Status Kepengurusan</th>
                      <th className="py-3.5 px-4 text-center">Aksi Cepat</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 font-medium">
                    {periods.map((p) => {
                      return (
                        <tr key={p.id} className="hover:bg-purple-950/20 transition">
                          <td className="py-3.5 px-4 font-bold text-white flex items-center gap-2">
                            <span>{p.name}</span>
                            {p.isActive && (
                              <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-[9px] font-black uppercase">
                                Sedang Berjalan
                              </span>
                            )}
                          </td>
                          <td className="py-3.5 px-4 font-mono font-bold text-purple-300">
                            {p.academicYear}
                          </td>
                          <td className="py-3.5 px-4 text-slate-300 font-semibold">
                            Semester {p.semester}
                          </td>
                          <td className="py-3.5 px-4 text-center">
                            {p.isActive ? (
                              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-[10px] font-black">
                                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                                <span>PERIODE AKTIF</span>
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-slate-800 text-slate-400 border border-slate-700 text-[10px] font-bold">
                                <span>Arsip Demisioner</span>
                              </span>
                            )}
                          </td>
                          <td className="py-3.5 px-4 text-center">
                            <div className="flex items-center justify-center gap-1.5">
                              {!p.isActive && (
                                <button
                                  onClick={() => handleSetActivePeriod(p.id, p.name)}
                                  className="px-2.5 py-1.5 rounded-xl bg-emerald-950/60 hover:bg-emerald-900 border border-emerald-700/50 text-emerald-300 text-xs font-bold transition flex items-center gap-1 cursor-pointer"
                                  title="Jadikan periode kepengurusan aktif saat ini"
                                >
                                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                                  <span className="hidden sm:inline">Set Aktif</span>
                                </button>
                              )}

                              <button
                                onClick={() => handleOpenEditPeriod(p)}
                                className="px-2.5 py-1.5 rounded-xl bg-purple-950/60 hover:bg-purple-900 border border-purple-700/50 text-purple-200 text-xs font-bold transition flex items-center gap-1 cursor-pointer"
                                title="Edit nama atau rincian periode"
                              >
                                <Pencil className="w-3.5 h-3.5" />
                                <span className="hidden sm:inline">Edit</span>
                              </button>

                              <button
                                onClick={() => handleDeletePeriod(p.id, p.name)}
                                className="p-1.5 rounded-xl bg-rose-950/60 hover:bg-rose-900 border border-rose-800/50 text-rose-300 text-xs font-bold transition cursor-pointer"
                                title="Hapus periode ini"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
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

        {/* TAB 2: PANEL OPERASIONAL BPH (EMBEDDED DENGAN PROPS SUPER ADMIN) */}
        {activeTab === 'bph-panel' && (
          <div className="space-y-4 animate-in fade-in duration-200">
            <div className="p-4 rounded-2xl bg-indigo-950/40 border border-indigo-800/40 text-xs text-indigo-200 flex items-center justify-between">
              <span className="font-bold flex items-center gap-2">
                <Shield className="w-4 h-4 text-indigo-400" />
                <span>Panel Operasional BPH Aktif via Hak Akses Super Admin Root</span>
              </span>
              <span className="text-[11px] text-slate-400">
                Semua tindakan yang dilakukan di sini memiliki prioritas verifikasi penuh.
              </span>
            </div>

            <div className="bg-white text-slate-900 rounded-3xl overflow-hidden shadow-2xl">
              <AdminDashboardPage
                user={superAdminBphUser}
                onLogout={onLogout}
              />
            </div>
          </div>
        )}

        {/* TAB 3: SIMULATOR MULTI-ROLE (KADIV / ANGGOTA VIEW) */}
        {activeTab === 'simulator' && (
          <div className="space-y-4 animate-in fade-in duration-200">
            <div className="p-4 rounded-3xl bg-slate-900 border border-purple-500/30 flex flex-wrap items-center justify-between gap-3">
              <div>
                <span className="text-xs font-black uppercase text-purple-400 block tracking-wider">
                  🧪 Simulator Tampilan Pengembang
                </span>
                <p className="text-xs text-slate-400">
                  Uji antarmuka pengguna seolah-olah Anda login sebagai Kepala Divisi atau Anggota biasa.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <div className="flex items-center bg-slate-950 p-1 rounded-xl border border-slate-800 text-xs">
                  <button
                    onClick={() => setSimulatedRole('kadiv')}
                    className={`px-3 py-1.5 rounded-lg font-bold transition cursor-pointer ${
                      simulatedRole === 'kadiv'
                        ? 'bg-amber-500 text-slate-950 font-black'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    Kepala Divisi
                  </button>
                  <button
                    onClick={() => setSimulatedRole('member')}
                    className={`px-3 py-1.5 rounded-lg font-bold transition cursor-pointer ${
                      simulatedRole === 'member'
                        ? 'bg-blue-600 text-white font-black'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    Anggota Biasa
                  </button>
                </div>

                <select
                  value={simulatedDivision}
                  onChange={(e) => setSimulatedDivision(e.target.value as Division)}
                  className="px-3 py-1.5 bg-slate-950 border border-slate-800 rounded-xl text-xs font-bold text-purple-300 focus:outline-none cursor-pointer"
                >
                  <option value="Publikasi dan Sosialisasi">Divisi Publikasi & Sosialisasi</option>
                  <option value="Lingkungan Hidup">Divisi Lingkungan Hidup</option>
                  <option value="Pendidikan">Divisi Pendidikan</option>
                  <option value="Pengabdian Masyarakat">Divisi Pengabdian Masyarakat</option>
                  <option value="Kewirausahaan">Divisi Kewirausahaan</option>
                  <option value="BPH">Divisi BPH</option>
                </select>
              </div>
            </div>

            <div className="bg-slate-50 text-slate-900 rounded-3xl overflow-hidden shadow-2xl border border-slate-200">
              <DashboardPage
                user={simulatedUser}
                onLogout={onLogout}
              />
            </div>
          </div>
        )}

        {/* TAB 4: KESEHATAN SISTEM & DATABASE */}
        {activeTab === 'system' && (
          <div className="space-y-6 animate-in fade-in duration-200">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <div className="p-5 rounded-3xl bg-slate-900/90 border border-slate-800 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-400">Database Engine</span>
                  <Server className="w-4 h-4 text-emerald-400" />
                </div>
                <h3 className="text-base font-black text-white">Supabase PostgreSQL</h3>
                <p className="text-xs text-emerald-400 font-bold">✓ Terhubung & Idempoten</p>
                <p className="text-[11px] text-slate-500 font-mono">Endpoint: cccvuemoatduivnfsjxr.supabase.co</p>
              </div>

              <div className="p-5 rounded-3xl bg-slate-900/90 border border-slate-800 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-400">Storage Bukti & Foto</span>
                  <CloudUpload className="w-4 h-4 text-purple-400" />
                </div>
                <h3 className="text-base font-black text-white">Google Drive Engine</h3>
                <p className="text-xs text-purple-300 font-bold">✓ Apps Script Auto-Compress</p>
                <p className="text-[11px] text-slate-500">Kamera terkompresi otomatis ~200KB</p>
              </div>

              <div className="p-5 rounded-3xl bg-slate-900/90 border border-slate-800 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-400">Sinkronisasi Realtime</span>
                  <RefreshCw className="w-4 h-4 text-amber-400" />
                </div>
                <h3 className="text-base font-black text-white">Unified Event Bus</h3>
                <p className="text-xs text-amber-300 font-bold">✓ Multi-Channel Sync Aktif</p>
                <p className="text-[11px] text-slate-500">Realtime Event: simak_member_sync</p>
              </div>
            </div>

            <div className="p-6 rounded-3xl bg-slate-900 border border-purple-500/20 space-y-4">
              <h3 className="text-sm font-black text-white uppercase tracking-wider flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-400" />
                <span>Pembersihan Cache & Reset Sinkronisasi</span>
              </h3>
              <p className="text-xs text-slate-400 max-w-2xl leading-relaxed">
                Jika ada data tampilan yang tampak tidak berubah atau browser menyimpan cache versi lama, tekan tombol di bawah untuk membersihkan memori lokal dan memaksa aplikasi membaca langsung dari tabel PostgreSQL Supabase.
              </p>
              <button
                onClick={handleClearAndResync}
                className="px-5 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs shadow-lg shadow-purple-600/30 transition cursor-pointer"
              >
                Reset Cache & Sinkronkan Sekarang
              </button>
            </div>

            {/* Panel Backup & Restore Database 1-Klik */}
            <div className="p-6 rounded-3xl bg-slate-900 border border-purple-500/20 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h3 className="text-sm font-black text-white uppercase tracking-wider flex items-center gap-2">
                    <Database className="w-4 h-4 text-purple-400" />
                    <span>Cadangan & Pemulihan Basis Data (Backup & Restore)</span>
                  </h3>
                  <p className="text-xs text-slate-400 mt-1">
                    Unduh salinan berkas `.json` berisi seluruh data anggota, riwayat absensi, evaluasi poin, dan agenda untuk arsip offline.
                  </p>
                </div>

                <div className="flex items-center gap-2.5">
                  <button
                    onClick={handleDownloadBackup}
                    className="px-4 py-2.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white text-xs font-bold rounded-xl shadow-lg shadow-purple-600/25 flex items-center gap-1.5 transition cursor-pointer"
                  >
                    <Download className="w-4 h-4" />
                    <span>Download Backup (.JSON)</span>
                  </button>

                  <label className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-purple-200 border border-purple-700/40 text-xs font-bold rounded-xl flex items-center gap-1.5 transition cursor-pointer">
                    <Upload className="w-4 h-4 text-purple-400" />
                    <span>Restore Data (.JSON)</span>
                    <input
                      type="file"
                      accept=".json"
                      className="hidden"
                      onChange={handleRestoreBackup}
                    />
                  </label>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 5: AUDIT TRAIL & LOG RIWAYAT KEAMANAN (SUPER ADMIN) */}
        {activeTab === 'audit' && (
          <div className="space-y-6 animate-in fade-in duration-200">
            {/* Header Banner */}
            <div className="p-5 sm:p-6 rounded-3xl bg-gradient-to-r from-purple-950/70 via-slate-900 to-slate-900 border border-purple-500/20 shadow-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-purple-500/10 border border-purple-500/20 text-purple-300 text-[11px] font-bold uppercase mb-2">
                  <ShieldAlert className="w-3.5 h-3.5 text-purple-400" />
                  <span>Sistem Kepatuhan & Audit Trail</span>
                </div>
                <h2 className="text-lg sm:text-xl font-black text-white">
                  Log Riwayat Aktivitas & Keamanan SIMAK GENBI
                </h2>
                <p className="text-xs text-slate-400 mt-1 max-w-2xl leading-relaxed">
                  Seluruh perubahan hak akses, penetapan periode, persetujuan tugas delegasi (+30 Poin), serta perubahan PIN terekam permanen demi akuntabilitas laporan ke Bank Indonesia.
                </p>
              </div>

              <div className="flex items-center gap-2 self-start sm:self-center">
                <button
                  onClick={() => {
                    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(auditLogs, null, 2));
                    const dl = document.createElement('a');
                    dl.setAttribute('href', dataStr);
                    dl.setAttribute('download', `SIMAK_GENBI_Audit_Log_${new Date().toISOString().slice(0, 10)}.json`);
                    document.body.appendChild(dl);
                    dl.click();
                    document.body.removeChild(dl);
                  }}
                  className="px-3.5 py-2 rounded-xl bg-purple-950/60 hover:bg-purple-900 border border-purple-700/50 text-purple-200 text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-xs active:scale-95"
                >
                  <Download className="w-3.5 h-3.5 text-purple-300" />
                  <span>Unduh Log (.JSON)</span>
                </button>

                <button
                  onClick={() => {
                    if (confirm('Apakah Anda yakin ingin membersihkan seluruh riwayat log audit ini?')) {
                      clearAuditLogs();
                      setAuditLogs([]);
                      alert('Log audit berhasil dibersihkan.');
                    }
                  }}
                  className="px-3.5 py-2 rounded-xl bg-rose-950/60 hover:bg-rose-900 border border-rose-800/50 text-rose-300 text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-xs"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Bersihkan</span>
                </button>
              </div>
            </div>

            {/* Filter & Pencarian Log */}
            <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800 flex flex-col sm:flex-row gap-3 items-center justify-between">
              <div className="relative w-full sm:w-80">
                <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Cari aktor, aksi, atau target..."
                  value={auditSearch}
                  onChange={(e) => setAuditSearch(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 text-xs bg-slate-950 border border-slate-800 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-purple-500/40"
                />
              </div>

              <div className="flex items-center gap-2 w-full sm:w-auto">
                <select
                  value={auditFilterType}
                  onChange={(e) => setAuditFilterType(e.target.value)}
                  className="w-full sm:w-auto px-3 py-2 text-xs bg-slate-950 border border-slate-800 rounded-xl text-slate-300 font-medium focus:outline-none focus:ring-2 focus:ring-purple-500/40 cursor-pointer"
                >
                  <option value="all">Semua Jenis Aktivitas ({auditLogs.length})</option>
                  <option value="ROLE_CHANGE">Perubahan Hak Akses / Jabatan</option>
                  <option value="PERIOD">Siklus Periode Kepengurusan</option>
                  <option value="EVENT">Agenda & Presensi</option>
                  <option value="IZIN_DELEGASI">Verifikasi Izin & Delegasi</option>
                  <option value="AUTH_PIN_CHANGE">Keamanan PIN Anggota</option>
                </select>
              </div>
            </div>

            {/* Tabel Riwayat Log Audit */}
            <div className="rounded-3xl bg-slate-900 border border-slate-800 overflow-hidden shadow-xl">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-950/80 text-slate-400 font-bold uppercase tracking-wider text-[10px] border-b border-slate-800">
                    <tr>
                      <th className="py-3.5 px-4">Waktu (WIB)</th>
                      <th className="py-3.5 px-4">Aktor Pelaksana</th>
                      <th className="py-3.5 px-4 text-center">Tipe Aktivitas</th>
                      <th className="py-3.5 px-4">Target / Entitas</th>
                      <th className="py-3.5 px-4">Rincian Deskripsi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 font-medium">
                    {auditLogs
                      .filter((log) => {
                        const matchSearch =
                          log.actorName.toLowerCase().includes(auditSearch.toLowerCase()) ||
                          log.target.toLowerCase().includes(auditSearch.toLowerCase()) ||
                          log.description.toLowerCase().includes(auditSearch.toLowerCase());

                        if (!matchSearch) return false;
                        if (auditFilterType === 'all') return true;
                        if (auditFilterType === 'PERIOD') return log.actionType.startsWith('PERIOD');
                        if (auditFilterType === 'EVENT') return log.actionType.startsWith('EVENT');
                        if (auditFilterType === 'IZIN_DELEGASI') return log.actionType.includes('IZIN') || log.actionType.includes('DELEGASI');
                        return log.actionType === auditFilterType;
                      })
                      .map((log) => {
                        const logDate = new Date(log.timestamp);
                        const dateFormatted = logDate.toLocaleDateString('id-ID', {
                          day: '2-digit',
                          month: 'short',
                          year: 'numeric',
                        });
                        const timeFormatted = logDate.toLocaleTimeString('id-ID', {
                          hour: '2-digit',
                          minute: '2-digit',
                          hour12: false,
                        }) + ' WIB';

                        const isRole = log.actionType === 'ROLE_CHANGE';
                        const isPeriod = log.actionType.startsWith('PERIOD');
                        const isDelegasi = log.actionType.includes('DELEGASI') || log.actionType.includes('IZIN');
                        const isPin = log.actionType === 'AUTH_PIN_CHANGE';

                        const badgeColor = isRole
                          ? 'bg-purple-500/20 text-purple-300 border-purple-500/30'
                          : isPeriod
                          ? 'bg-blue-500/20 text-blue-300 border-blue-500/30'
                          : isDelegasi
                          ? 'bg-amber-500/20 text-amber-300 border-amber-500/30'
                          : isPin
                          ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                          : 'bg-slate-800 text-slate-300 border-slate-700';

                        return (
                          <tr key={log.id} className="hover:bg-purple-950/20 transition">
                            <td className="py-3 px-4 font-mono text-slate-300 whitespace-nowrap">
                              <span className="block font-bold text-white">{timeFormatted}</span>
                              <span className="text-[10px] text-slate-500">{dateFormatted}</span>
                            </td>

                            <td className="py-3 px-4">
                              <span className="font-bold text-white block">{log.actorName}</span>
                              <span className="text-[10px] text-purple-300">{log.actorRole}</span>
                            </td>

                            <td className="py-3 px-4 text-center">
                              <span className={`inline-block px-2.5 py-1 rounded-full text-[10px] font-black uppercase border ${badgeColor}`}>
                                {log.actionType.replace(/_/g, ' ')}
                              </span>
                            </td>

                            <td className="py-3 px-4 font-bold text-slate-200">
                              {log.target}
                            </td>

                            <td className="py-3 px-4 text-slate-300 text-xs max-w-md leading-relaxed">
                              {log.description}
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
      </main>

      {/* Footer Hak Cipta SIMAK GenBI & PD-Dev */}
      <Footer className="border-t-purple-900/40 bg-slate-900/90 text-slate-300" />

      {/* MODAL CRUD PERIODE KEPENGURUSAN */}
      {showPeriodModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in">
          <div className="w-full max-w-md rounded-[32px] bg-slate-900 border border-purple-500/30 p-6 shadow-2xl space-y-4 relative">
            <div>
              <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md bg-purple-500/20 text-purple-300 text-[10px] font-black uppercase tracking-wider mb-1 border border-purple-400/30">
                <CalendarDays className="w-3 h-3" />
                <span>{editingPeriod ? 'Edit Periode' : 'Tambah Periode Baru'}</span>
              </div>
              <h3 className="text-base font-black text-white">
                {editingPeriod ? 'Ubah Rincian Periode Kepengurusan' : 'Buat Periode Kepengurusan Baru'}
              </h3>
              <p className="text-xs text-slate-400">
                Data periode menentukan filter buku presensi dan arsip nilai keaktifan.
              </p>
            </div>

            <form onSubmit={handleSavePeriodSubmit} className="space-y-4 text-left">
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-slate-400 uppercase">
                  Nama Periode (Contoh: T.A. 2026/2027 Ganjil)
                </label>
                <input
                  type="text"
                  required
                  placeholder="T.A. 2026/2027 Ganjil"
                  value={periodName}
                  onChange={(e) => setPeriodName(e.target.value)}
                  className="w-full px-3.5 py-2 text-xs bg-slate-950 border border-slate-800 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-purple-500/40"
                />
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-400 uppercase">Tahun Akademik</label>
                  <input
                    type="text"
                    required
                    placeholder="2026/2027"
                    value={periodYear}
                    onChange={(e) => setPeriodYear(e.target.value)}
                    className="w-full px-3.5 py-2 text-xs bg-slate-950 border border-slate-800 rounded-xl text-purple-300 font-mono font-bold focus:outline-none focus:ring-2 focus:ring-purple-500/40"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-400 uppercase">Semester</label>
                  <select
                    value={periodSemester}
                    onChange={(e) => setPeriodSemester(e.target.value as 'Ganjil' | 'Genap')}
                    className="w-full px-3 py-2 text-xs bg-slate-950 border border-slate-800 rounded-xl text-white font-medium focus:outline-none focus:ring-2 focus:ring-purple-500/40 cursor-pointer"
                  >
                    <option value="Ganjil">Semester Ganjil</option>
                    <option value="Genap">Semester Genap</option>
                  </select>
                </div>
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="periodIsActiveCheck"
                  checked={periodIsActive}
                  onChange={(e) => setPeriodIsActive(e.target.checked)}
                  className="w-4 h-4 rounded text-purple-600 bg-slate-950 border-slate-700 focus:ring-purple-500 cursor-pointer"
                />
                <label htmlFor="periodIsActiveCheck" className="text-xs font-bold text-purple-200 cursor-pointer">
                  Jadikan Sebagai Periode Kepengurusan Aktif
                </label>
              </div>

              <div className="p-3 rounded-2xl bg-purple-950/30 border border-purple-800/30 text-[11px] text-purple-300">
                💡 <strong>Sinkronisasi Realtime:</strong> Jika periode ini diset aktif, dropdown periode di Admin BPH dan profil seluruh anggota akan otomatis berpindah ke periode ini seketika.
              </div>

              <div className="pt-2 flex gap-2">
                <button
                  type="button"
                  onClick={() => setShowPeriodModal(false)}
                  className="flex-1 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold rounded-xl transition cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isSavingPeriod}
                  className="flex-1 py-2.5 bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs rounded-xl shadow-lg shadow-purple-600/30 transition cursor-pointer disabled:opacity-50"
                >
                  {isSavingPeriod ? 'Menyimpan...' : 'Simpan Periode'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL UBAH HAK AKSES / ROLE USER */}
      {editingMember && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in">
          <div className="w-full max-w-md rounded-[32px] bg-slate-900 border border-purple-500/30 p-6 shadow-2xl space-y-4 relative">
            <div>
              <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md bg-purple-500/20 text-purple-300 text-[10px] font-black uppercase tracking-wider mb-1 border border-purple-400/30">
                <Pencil className="w-3 h-3" />
                <span>Super Admin Hak Akses</span>
              </div>
              <h3 className="text-base font-black text-white">
                Perbarui Hak Akses Akun
              </h3>
              <p className="text-xs text-slate-400">
                NPM: <span className="font-mono font-bold text-purple-300">{editingMember.npm}</span>
              </p>
            </div>

            <form onSubmit={handleSaveMemberAccess} className="space-y-4 text-left">
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-slate-400 uppercase">
                  Nama Lengkap
                </label>
                <input
                  type="text"
                  required
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full px-3.5 py-2 text-xs bg-slate-950 border border-slate-800 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-purple-500/40"
                />
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-400 uppercase">Divisi</label>
                  <select
                    value={editDivision}
                    onChange={(e) => setEditDivision(e.target.value as Division)}
                    className="w-full px-3 py-2 text-xs bg-slate-950 border border-slate-800 rounded-xl text-white font-medium focus:outline-none focus:ring-2 focus:ring-purple-500/40 cursor-pointer"
                  >
                    <option value="Publikasi dan Sosialisasi">Publikasi & Sosialisasi</option>
                    <option value="Lingkungan Hidup">Lingkungan Hidup</option>
                    <option value="Pendidikan">Pendidikan</option>
                    <option value="Pengabdian Masyarakat">Pengabdian Masyarakat</option>
                    <option value="Kewirausahaan">Kewirausahaan</option>
                    <option value="BPH">BPH</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-400 uppercase">Jabatan / Role</label>
                  <select
                    value={editRole}
                    onChange={(e) => setEditRole(e.target.value as Role)}
                    className="w-full px-3 py-2 text-xs bg-slate-950 border border-slate-800 rounded-xl text-purple-200 font-bold focus:outline-none focus:ring-2 focus:ring-purple-500/40 cursor-pointer"
                  >
                    <option value="member">👤 Anggota</option>
                    <option value="kadiv">⭐ Kepala Divisi (Kadiv)</option>
                    <option value="admin">🛡️ BPH / Administrator</option>
                  </select>
                </div>
              </div>

              <div className="p-3 rounded-2xl bg-purple-950/30 border border-purple-800/30 text-[11px] text-purple-300">
                💡 <strong>Catatan:</strong> Jika akun ini diubah dari BPH ke Anggota, akun akan langsung turun pangkat menjadi Anggota biasa di tabel whitelist, rekap keaktifan, dan profil secara otomatis.
              </div>

              <div className="pt-2 flex gap-2">
                <button
                  type="button"
                  onClick={() => setEditingMember(null)}
                  className="flex-1 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold rounded-xl transition cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isSavingEdit}
                  className="flex-1 py-2.5 bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs rounded-xl shadow-lg shadow-purple-600/30 transition cursor-pointer disabled:opacity-50"
                >
                  {isSavingEdit ? 'Menyimpan...' : 'Simpan & Sinkronkan'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
