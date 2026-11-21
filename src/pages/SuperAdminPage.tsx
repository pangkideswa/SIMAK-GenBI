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
  AlertCircle,
  Info,
  Briefcase,
  Settings,
  X,
  UserPlus,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { Division, Role } from '../types/database';
import { syncMemberUpdate, normalizeStudentId } from '../lib/memberSync';
import {
  MasterJabatan,
  getMasterJabatanList,
  saveMasterJabatan,
  deleteMasterJabatan,
  getMasterDivisions,
  addMasterDivision,
  deleteMasterDivision,
  resolveUserJabatan,
} from '../lib/roleMaster';
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
import { purgeSuperAdminFromCache } from '../lib/attendanceSync';
import { AdminDashboardPage } from './AdminDashboardPage';
import DashboardPage from './DashboardPage';
import { Footer } from '../components/Footer';
import { MubesAwardsManager } from '../components/MubesAwardsManager';

interface SuperAdminPageProps {
  onLogout: () => void;
}

interface MemberUser {
  npm: string;
  nim?: string;
  fullName: string;
  division: Division | string;
  role: Role;
  jabatan?: string;
  isClaimed?: boolean;
  email?: string;
  source: 'database' | 'whitelist' | 'override';
}

const DEFAULT_MEMBERS_ROSTER: MemberUser[] = [
  { npm: '2414101078', nim: '2414101078', fullName: 'Pangki Deswa Rayhandi', division: 'Pengabdian Masyarakat', role: 'member', jabatan: 'Anggota', isClaimed: true, email: 'admin@genbi-unma.ac.id', source: 'whitelist' },
  { npm: '2214100010', nim: '2214100010', fullName: 'Deden Kurniawan', division: 'Publikasi dan Sosialisasi', role: 'kadiv', jabatan: 'Kepala Divisi', isClaimed: true, email: 'deden@genbi-unma.ac.id', source: 'whitelist' },
  { npm: '2214100025', nim: '2214100025', fullName: 'Siti Rahmawati', division: 'Pendidikan', role: 'kadiv', jabatan: 'Kepala Divisi', isClaimed: true, email: 'siti@genbi-unma.ac.id', source: 'whitelist' },
  { npm: '2214100033', nim: '2214100033', fullName: 'Fajar Pratama', division: 'Lingkungan Hidup', role: 'kadiv', jabatan: 'Kepala Divisi', isClaimed: true, email: 'fajar@genbi-unma.ac.id', source: 'whitelist' },
  { npm: '2214100048', nim: '2214100048', fullName: 'Anisa Permata', division: 'Publikasi dan Sosialisasi', role: 'member', jabatan: 'Anggota', isClaimed: true, email: 'anisa@genbi-unma.ac.id', source: 'whitelist' },
  { npm: '2214100052', nim: '2214100052', fullName: 'Rizky Ramadhan', division: 'Kewirausahaan', role: 'member', jabatan: 'Anggota', isClaimed: false, email: 'rizky@genbi-unma.ac.id', source: 'whitelist' },
  { npm: '2214100067', nim: '2214100067', fullName: 'Nadia Putri', division: 'Pengabdian Masyarakat', role: 'member', jabatan: 'Anggota', isClaimed: false, email: 'nadia@genbi-unma.ac.id', source: 'whitelist' },
];

export const SuperAdminPage: React.FC<SuperAdminPageProps> = ({ onLogout }) => {
  const [activeTab, setActiveTab] = useState<'users' | 'periods' | 'bph-panel' | 'simulator' | 'system' | 'audit' | 'mubes-awards'>('users');
  const [members, setMembers] = useState<MemberUser[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterDivision, setFilterDivision] = useState<string>('all');
  const [filterRole, setFilterRole] = useState<string>('all');

  // Master Jabatan & Divisi State
  const [masterJabatanList, setMasterJabatanList] = useState<MasterJabatan[]>(getMasterJabatanList());
  const [masterDivisions, setMasterDivisions] = useState<string[]>(getMasterDivisions());
  const [showMasterModal, setShowMasterModal] = useState(false);
  const [masterTab, setMasterTab] = useState<'jabatan' | 'divisi'>('jabatan');

  // Form Tambah Jabatan Baru
  const [newJabatanName, setNewJabatanName] = useState('');
  const [newJabatanRole, setNewJabatanRole] = useState<'admin' | 'kadiv' | 'member'>('admin');
  const [newJabatanDiv, setNewJabatanDiv] = useState('BPH');
  const [newDivisionInput, setNewDivisionInput] = useState('');

  // Modal Tambah Anggota / Penerima Baru
  const [showAddMemberModal, setShowAddMemberModal] = useState(false);
  const [newMemberNpm, setNewMemberNpm] = useState('');
  const [newMemberName, setNewMemberName] = useState('');
  const [newMemberDiv, setNewMemberDiv] = useState('Belum Ada Divisi');
  const [newMemberJabatan, setNewMemberJabatan] = useState('Penerima Beasiswa Baru');
  const [isSavingNewMember, setIsSavingNewMember] = useState(false);

  // Modal Ubah Hak Akses & Jabatan Pengguna
  const [editingMember, setEditingMember] = useState<MemberUser | null>(null);
  const [editName, setEditName] = useState('');
  const [editDivision, setEditDivision] = useState<string>('Publikasi dan Sosialisasi');
  const [editRole, setEditRole] = useState<Role>('member');
  const [editJabatan, setEditJabatan] = useState('Anggota');
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
  const [periodStatusLabel, setPeriodStatusLabel] = useState('Masa yang akan datang');
  const [isSavingPeriod, setIsSavingPeriod] = useState(false);

  // Floating Toast Notification State
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'info' | 'error' | 'warning' } | null>(null);

  const showToast = (message: string, type: 'success' | 'info' | 'error' | 'warning' = 'success') => {
    setToast({ message, type });
    setTimeout(() => {
      setToast(null);
    }, 4000);
  };

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
            jabatan: ov.jabatan || def.jabatan,
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
              division: (ov?.division || item.division || 'Publikasi dan Sosialisasi'),
              role: (ov?.role || item.role || 'member') as Role,
              jabatan: ov?.jabatan || (item as any)?.jabatan || resolveUserJabatan(item),
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
              division: (ov?.division || p.division || existing?.division || 'Publikasi dan Sosialisasi'),
              role: (ov?.role || p.role || existing?.role || 'member') as Role,
              jabatan: ov?.jabatan || (p as any)?.jabatan || existing?.jabatan || resolveUserJabatan(p),
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
    purgeSuperAdminFromCache();
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

    const handleJabatanSync = (e: any) => {
      if (e?.detail) setMasterJabatanList(e.detail);
      else setMasterJabatanList(getMasterJabatanList());
    };

    const handleDivisionSync = (e: any) => {
      if (e?.detail) setMasterDivisions(e.detail);
      else setMasterDivisions(getMasterDivisions());
    };

    window.addEventListener('simak_member_sync', handleSync);
    window.addEventListener('simak_period_sync', handlePeriodSync);
    window.addEventListener('simak_audit_sync', handleAuditSync);
    window.addEventListener('simak_jabatan_sync', handleJabatanSync);
    window.addEventListener('simak_division_sync', handleDivisionSync);
    return () => {
      window.removeEventListener('simak_member_sync', handleSync);
      window.removeEventListener('simak_period_sync', handlePeriodSync);
      window.removeEventListener('simak_audit_sync', handleAuditSync);
      window.removeEventListener('simak_jabatan_sync', handleJabatanSync);
      window.removeEventListener('simak_division_sync', handleDivisionSync);
    };
  }, []);

  // CRUD Handler Periode Kepengurusan
  const handleOpenAddPeriod = () => {
    setEditingPeriod(null);
    setPeriodName('');
    setPeriodYear('2026/2027');
    setPeriodSemester('Ganjil');
    setPeriodIsActive(periods.length === 0);
    setPeriodStatusLabel('Masa yang akan datang');
    setShowPeriodModal(true);
  };

  const handleOpenEditPeriod = (p: AcademicPeriod) => {
    setEditingPeriod(p);
    setPeriodName(p.name);
    setPeriodYear(p.academicYear);
    setPeriodSemester(p.semester);
    setPeriodIsActive(p.isActive);
    setPeriodStatusLabel(p.statusLabel || (p.isActive ? 'Periode Aktif' : 'Masa yang akan datang'));
    setShowPeriodModal(true);
  };

  const handleSavePeriodSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!periodName.trim()) {
      showToast('Nama periode wajib diisi (contoh: T.A. 2026/2027 Ganjil)!', 'warning');
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
        statusLabel: periodStatusLabel.trim() || (periodIsActive ? 'Periode Aktif' : 'Masa yang akan datang'),
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
      showToast(
        editingPeriod
          ? `Periode "${periodName}" berhasil diperbarui!`
          : `Periode baru "${periodName}" berhasil ditambahkan!`,
        'success'
      );
    } catch (err: any) {
      showToast('Gagal menyimpan periode: ' + (err.message || 'Terjadi kesalahan sistem'), 'error');
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
      showToast(`Periode "${name}" sekarang aktif sebagai kepengurusan berjalan!`, 'success');
    } catch (err: any) {
      showToast('Gagal mengaktifkan periode: ' + err.message, 'error');
    }
  };

  const handleDeletePeriod = async (id: string, name: string) => {
    if (periods.length <= 1) {
      showToast('Tidak dapat menghapus periode terakhir! Sistem harus memiliki minimal satu periode.', 'warning');
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
      showToast(`Periode "${name}" berhasil dihapus.`, 'info');
    } catch (err: any) {
      showToast('Gagal menghapus periode: ' + err.message, 'error');
    }
  };

  // Buka Modal Edit Hak Akses & Jabatan
  const handleOpenEdit = (m: MemberUser) => {
    setEditingMember(m);
    setEditName(m.fullName);
    setEditDivision(m.division);
    setEditRole(m.role);
    setEditJabatan(m.jabatan || resolveUserJabatan(m));
  };

  // Simpan Perubahan Hak Akses / Role & Jabatan
  const handleSaveMemberAccess = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingMember || !editName.trim()) {
      showToast('Nama pengguna wajib diisi!', 'warning');
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
                jabatan: editJabatan,
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
        jabatan: editJabatan,
      });

      recordAuditLog({
        actorName: 'Super Admin Root',
        actorRole: 'Super Admin',
        actionType: 'ROLE_CHANGE',
        target: `${cleanId} (${editName.trim()})`,
        description: `Mengubah hak akses "${editName.trim()}" menjadi ${editJabatan} (${editRole}) pada divisi ${editDivision}.`,
      });

      setEditingMember(null);
      showToast(`Sukses! Data ${editName.trim()} berhasil diubah menjadi ${editJabatan} (${editDivision}) dan disinkronkan ke seluruh sistem!`, 'success');
    } catch (err: any) {
      showToast(err.message || 'Gagal menyimpan perubahan hak akses.', 'error');
    } finally {
      setIsSavingEdit(false);
    }
  };

  // Tambah Penerima Beasiswa / Anggota Baru
  const handleCreateNewMember = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanId = normalizeStudentId(newMemberNpm);
    if (!cleanId || !newMemberName.trim()) {
      showToast('NPM dan Nama Lengkap wajib diisi!', 'warning');
      return;
    }

    setIsSavingNewMember(true);
    try {
      const assignedRole: Role =
        newMemberJabatan.toLowerCase().includes('ketua') ||
        newMemberJabatan.toLowerCase().includes('sekretaris') ||
        newMemberJabatan.toLowerCase().includes('bendahara') ||
        newMemberDiv === 'BPH'
          ? 'admin'
          : newMemberJabatan.toLowerCase().includes('kepala divisi')
          ? 'kadiv'
          : 'member';

      await syncMemberUpdate({
        npm: cleanId,
        nim: cleanId,
        fullName: newMemberName.trim(),
        division: newMemberDiv,
        role: assignedRole,
        jabatan: newMemberJabatan,
      });

      recordAuditLog({
        actorName: 'Super Admin Root',
        actorRole: 'Super Admin',
        actionType: 'WHITELIST_ADD',
        target: `${cleanId} (${newMemberName.trim()})`,
        description: `Menambahkan penerima beasiswa baru "${newMemberName.trim()}" pada divisi ${newMemberDiv} dengan jabatan ${newMemberJabatan}.`,
      });

      setShowAddMemberModal(false);
      setNewMemberNpm('');
      setNewMemberName('');
      loadAllUsers();
      showToast(`Penerima beasiswa baru ${newMemberName.trim()} berhasil didaftarkan ke sistem!`, 'success');
    } catch (err: any) {
      showToast(err.message || 'Gagal menambahkan anggota baru.', 'error');
    } finally {
      setIsSavingNewMember(false);
    }
  };

  // Simpan Jabatan Baru di Master
  const handleSaveNewJabatan = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newJabatanName.trim()) {
      showToast('Nama jabatan wajib diisi!', 'warning');
      return;
    }
    const updated = saveMasterJabatan({
      name: newJabatanName.trim(),
      role: newJabatanRole,
      division: newJabatanDiv,
    });
    setMasterJabatanList(updated);
    setNewJabatanName('');
    showToast(`Jabatan "${newJabatanName.trim()}" berhasil ditambahkan ke master!`, 'success');
  };

  // Hapus Jabatan dari Master
  const handleDeleteJabatan = (id: string, name: string) => {
    if (!window.confirm(`Hapus jabatan "${name}" dari master? Anggota yang memakai jabatan ini dapat disesuaikan kembali.`)) return;
    const updated = deleteMasterJabatan(id);
    setMasterJabatanList(updated);
    showToast(`Jabatan "${name}" berhasil dihapus dari sistem.`, 'info');
  };

  // Tambah Divisi Baru di Master
  const handleAddDivision = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDivisionInput.trim()) {
      showToast('Nama divisi wajib diisi!', 'warning');
      return;
    }
    const updated = addMasterDivision(newDivisionInput.trim());
    setMasterDivisions(updated);
    setNewDivisionInput('');
    showToast(`Divisi "${newDivisionInput.trim()}" berhasil ditambahkan ke master!`, 'success');
  };

  // Hapus Divisi dari Master
  const handleDeleteDivision = (name: string) => {
    if (name === 'BPH') {
      showToast('Divisi BPH tidak dapat dihapus karena merupakan struktur inti!', 'warning');
      return;
    }
    if (!window.confirm(`Hapus divisi "${name}" dari master?`)) return;
    const updated = deleteMasterDivision(name);
    setMasterDivisions(updated);
    showToast(`Divisi "${name}" berhasil dihapus.`, 'info');
  };

  // Reset & Sinkronisasi Ulang Database Cache
  const handleClearAndResync = () => {
    if (!confirm('Bersihkan cache overrides lokal dan sinkronkan ulang seluruh data langsung dari Supabase?')) return;
    localStorage.removeItem('simak_whitelist_overrides');
    localStorage.removeItem('simak_leaderboard_cache');
    localStorage.removeItem('simak_evaluations_overrides');
    localStorage.removeItem('simak_all_attendances');
    purgeSuperAdminFromCache();
    loadAllUsers();
    showToast('Cache lokal berhasil dibersihkan dan data disinkronkan ulang!', 'success');
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
      showToast('Gagal membuat backup: ' + err.message, 'error');
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

        showToast('Data cadangan berhasil dipulihkan! Seluruh pengguna, periode, dan riwayat presensi langsung disinkronkan.', 'success');
        loadAllUsers();
        setPeriods(getAcademicPeriods());
        setAuditLogs(getAuditLogs());
        window.dispatchEvent(new CustomEvent('simak_member_sync', { detail: { npm: 'RESTORE_ALL' } }));
        window.dispatchEvent(new CustomEvent('simak_period_sync', { detail: { action: 'restore' } }));
        window.dispatchEvent(new CustomEvent('simak_attendance_sync', { detail: { action: 'restore' } }));
      } catch (err: any) {
        showToast('Gagal memulihkan cadangan: ' + err.message, 'error');
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
    const currentJabatan = m.jabatan || resolveUserJabatan(m);
    const matchRole =
      filterRole === 'all' ||
      m.role === filterRole ||
      currentJabatan.toLowerCase() === filterRole.toLowerCase() ||
      (m.jabatan && m.jabatan.toLowerCase() === filterRole.toLowerCase());

    return matchQuery && matchDivision && matchRole;
  });

  const renderJabatanBadge = (m: MemberUser) => {
    const jab = m.jabatan || resolveUserJabatan(m);
    if (jab === 'Ketua') {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-amber-500/20 text-amber-300 border border-amber-400/40 text-[10px] font-black shadow-xs">
          <Crown className="w-3 h-3 text-amber-400" />
          <span>Ketua</span>
        </span>
      );
    }
    if (jab === 'Wakil Ketua') {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-400/40 text-[10px] font-black">
          <Shield className="w-3 h-3 text-indigo-400" />
          <span>Wakil Ketua</span>
        </span>
      );
    }
    if (jab.toLowerCase().includes('sekretaris')) {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-blue-500/20 text-blue-300 border border-blue-400/40 text-[10px] font-black">
          <Briefcase className="w-3 h-3 text-blue-400" />
          <span>{jab}</span>
        </span>
      );
    }
    if (jab.toLowerCase().includes('bendahara')) {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-400/40 text-[10px] font-black">
          <Sparkles className="w-3 h-3 text-emerald-400" />
          <span>{jab}</span>
        </span>
      );
    }
    if (m.role === 'kadiv' || jab.toLowerCase().includes('kepala divisi')) {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30 text-[10px] font-black">
          <span>{jab}</span>
        </span>
      );
    }
    if (m.role === 'admin') {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-blue-500/20 text-blue-300 border border-blue-500/30 text-[10px] font-black">
          <Shield className="w-3 h-3 text-blue-400" />
          <span>{jab || 'BPH'}</span>
        </span>
      );
    }
    if (m.division === 'Belum Ada Divisi') {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-slate-800 text-amber-300 border border-amber-500/30 text-[10px] font-bold">
          <UserPlus className="w-3 h-3 text-amber-400" />
          <span>{jab || 'Penerima Baru'}</span>
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-slate-800 text-slate-300 border border-slate-700 text-[10px] font-bold">
        <User className="w-3 h-3 text-slate-400" />
        <span>{jab || 'Anggota'}</span>
      </span>
    );
  };

  // User session untuk BPH Panel Operasional (menggunakan akun personal resmi BPH Pangki Deswa Rayhandi)
  const superAdminBphUser = {
    id: 'a1111111-1111-1111-1111-111111111111',
    npm: '2414101078',
    nim: '2414101078',
    fullName: 'Pangki Deswa Rayhandi',
    division: 'BPH' as Division,
    role: 'admin' as Role,
    email: 'admin@genbi-unma.ac.id',
  };

  // User session untuk Simulator Multi-Role
  const simulatedUser = {
    id: `simulasi-${simulatedRole}-${simulatedDivision.replace(/\s+/g, '_').toLowerCase()}`,
    npm: simulatedRole === 'kadiv' ? '2214100010' : '2214100048',
    nim: simulatedRole === 'kadiv' ? '2214100010' : '2214100048',
    fullName: `Pangki Deswa Rayhandi (Simulasi ${simulatedRole === 'kadiv' ? 'Kepala Divisi' : 'Anggota'})`,
    division: simulatedDivision,
    role: simulatedRole,
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col antialiased selection:bg-blue-600 selection:text-white relative">
      {/* Background Ambient Glow (Navy Blue & Gold) */}
      <div className="fixed inset-0 pointer-events-none -z-10">
        <div className="absolute top-0 right-1/4 w-[500px] h-[500px] rounded-full bg-blue-600/10 blur-[120px]" />
        <div className="absolute bottom-1/3 left-10 w-[400px] h-[400px] rounded-full bg-amber-500/5 blur-[120px]" />
      </div>

      {/* Floating Toast Notification (Hijau = Sukses, Merah = Gagal/Error, Kuning = Info/Peringatan) */}
      {toast && (
        <div
          className={`fixed top-5 left-1/2 -translate-x-1/2 z-50 px-4 py-2.5 rounded-2xl shadow-2xl backdrop-blur-md border flex items-center gap-2.5 text-xs font-bold animate-in slide-in-from-top-4 duration-300 ${
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
      {/* HEADER UTAMA SUPER ADMIN */}
      <header className="sticky top-0 z-40 bg-slate-950/90 backdrop-blur-xl border-b border-blue-900/40 px-3 sm:px-6 lg:px-8 py-3 shadow-xl shadow-blue-950/30">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-2 sm:gap-4">
          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl sm:rounded-2xl bg-white p-1 shadow-md border border-blue-500/30 flex items-center justify-center shrink-0">
              <img
                src="/logo-genbi.png"
                alt="Logo GenBI UNMA"
                className="w-full h-full object-contain"
              />
            </div>
            <div>
              <div className="flex items-center gap-1.5 sm:gap-2">
                <h1 className="text-xs sm:text-base font-black tracking-tight text-white flex items-center gap-1">
                  <span>SIMAK GENBI</span>
                  <span className="bg-gradient-to-r from-amber-400 via-amber-300 to-yellow-500 bg-clip-text text-transparent font-black tracking-wider flex items-center gap-0.5">
                    • SUPER ADMIN <Crown className="w-3 h-3 text-amber-400 inline" />
                  </span>
                </h1>
                <span className="px-1.5 py-0.5 rounded-full bg-amber-500/15 border border-amber-400/30 text-amber-300 text-[8px] sm:text-[10px] font-black uppercase tracking-wider">
                  ROOT SYSTEM
                </span>
              </div>
              <p className="text-[9px] sm:text-[11px] text-slate-400 font-medium truncate max-w-[200px] xs:max-w-xs sm:max-w-none">
                Pusat Kontrol Tertinggi Sistem & Pengembang Tunggal &bull; Pangki Deswa Rayhandi
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-xl bg-blue-950/50 border border-blue-800/40 text-xs">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-[11px] font-mono text-blue-200">Online</span>
            </div>

            <button
              onClick={onLogout}
              className="px-2.5 sm:px-3.5 py-1.5 rounded-xl bg-red-950/50 hover:bg-red-900/70 border border-red-800/50 text-red-300 hover:text-white text-xs font-bold transition flex items-center gap-1 cursor-pointer shadow-xs"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Keluar</span>
            </button>
          </div>
        </div>
      </header>

      {/* NAVIGASI 6 TAB UTAMA SUPER ADMIN */}
      <div className="bg-slate-900/80 border-b border-slate-800 px-4 sm:px-6 lg:px-8 sticky top-[65px] z-30 backdrop-blur-md">
        <div className="max-w-7xl mx-auto flex items-center gap-1.5 overflow-x-auto py-2.5 no-scrollbar">
          <button
            onClick={() => setActiveTab('users')}
            className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-extrabold transition flex items-center gap-2 whitespace-nowrap cursor-pointer ${
              activeTab === 'users'
                ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-md shadow-blue-600/30'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
            }`}
          >
            <Users className={`w-4 h-4 ${activeTab === 'users' ? 'text-amber-300' : 'text-blue-400'}`} />
            <span>Manajemen Pengguna & Hak Akses ({members.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('periods')}
            className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-extrabold transition flex items-center gap-2 whitespace-nowrap cursor-pointer ${
              activeTab === 'periods'
                ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-md shadow-blue-600/30'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
            }`}
          >
            <CalendarDays className={`w-4 h-4 ${activeTab === 'periods' ? 'text-amber-300' : 'text-blue-400'}`} />
            <span>Periode Kepengurusan ({periods.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('bph-panel')}
            className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-extrabold transition flex items-center gap-2 whitespace-nowrap cursor-pointer ${
              activeTab === 'bph-panel'
                ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-md shadow-blue-600/30'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
            }`}
          >
            <Calendar className={`w-4 h-4 ${activeTab === 'bph-panel' ? 'text-amber-300' : 'text-blue-400'}`} />
            <span>Panel Operasional BPH</span>
          </button>

          <button
            onClick={() => setActiveTab('simulator')}
            className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-extrabold transition flex items-center gap-2 whitespace-nowrap cursor-pointer ${
              activeTab === 'simulator'
                ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-md shadow-blue-600/30'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
            }`}
          >
            <Laptop className={`w-4 h-4 ${activeTab === 'simulator' ? 'text-amber-300' : 'text-blue-400'}`} />
            <span>Simulator Tampilan (Kadiv / Anggota)</span>
          </button>

          <button
            onClick={() => setActiveTab('system')}
            className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-extrabold transition flex items-center gap-2 whitespace-nowrap cursor-pointer ${
              activeTab === 'system'
                ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-md shadow-blue-600/30'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
            }`}
          >
            <Database className={`w-4 h-4 ${activeTab === 'system' ? 'text-amber-300' : 'text-blue-400'}`} />
            <span>Kesehatan Sistem & Database</span>
          </button>

          <button
            onClick={() => setActiveTab('audit')}
            className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-extrabold transition flex items-center gap-2 whitespace-nowrap cursor-pointer ${
              activeTab === 'audit'
                ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-md shadow-blue-600/30'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
            }`}
          >
            <ShieldAlert className={`w-4 h-4 ${activeTab === 'audit' ? 'text-amber-300' : 'text-blue-400'}`} />
            <span>Audit Trail & Log ({auditLogs.length})</span>
          </button>
          <button
            onClick={() => setActiveTab('mubes-awards')}
            className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-extrabold transition flex items-center gap-2 whitespace-nowrap cursor-pointer ${
              activeTab === 'mubes-awards'
                ? 'bg-gradient-to-r from-amber-500 to-amber-600 text-slate-950 shadow-md shadow-amber-500/30'
                : 'text-amber-300 hover:text-white hover:bg-slate-800/60'
            }`}
          >
            <Crown className={`w-4 h-4 ${activeTab === 'mubes-awards' ? 'text-slate-950' : 'text-amber-400'}`} />
            <span>Reward Mubes (Annual Awards)</span>
          </button>
        </div>
      </div>

      {/* KONTEN UTAMA SESUAI TAB */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8 space-y-6">
        {/* TAB 1: MANAJEMEN PENGGUNA & HAK AKSES */}
        {activeTab === 'users' && (
          <div className="space-y-6 animate-in fade-in duration-200">
            {/* Header Card & Penjelasan */}
            <div className="p-4 sm:p-6 rounded-3xl bg-gradient-to-r from-blue-950/70 via-slate-900 to-slate-900 border border-blue-500/30 shadow-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/15 border border-amber-400/30 text-amber-300 text-[11px] font-bold uppercase mb-2">
                  <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                  <span>Pusat Kontrol Akses & Struktur Organisasi</span>
                </div>
                <h2 className="text-base sm:text-xl font-black text-white">
                  Kontrol Hak Akses Seluruh Anggota & Pengurus
                </h2>
                <p className="text-xs sm:text-sm text-slate-400 mt-1 max-w-2xl">
                  Pusat wewenang SUPERADMIN: Atur struktur jabatan BPH (Ketua, Wakil, Sekretaris, Bendahara), kelola divisi, dan daftarkan penerima beasiswa baru secara instan dan tersinkronisasi.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2 shrink-0">
                <button
                  onClick={() => setShowAddMemberModal(true)}
                  className="px-3 py-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white rounded-xl text-xs font-black transition flex items-center gap-1.5 cursor-pointer shadow-md shadow-emerald-950/40 active:scale-95"
                >
                  <UserPlus className="w-3.5 h-3.5" />
                  <span>+ Tambah Anggota / Penerima Baru</span>
                </button>
                <button
                  onClick={() => setShowMasterModal(true)}
                  className="px-3 py-2 bg-indigo-950 hover:bg-indigo-900 border border-indigo-700/60 text-indigo-200 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-xs active:scale-95"
                  title="Kelola nama-nama jabatan dan divisi organisasi"
                >
                  <Settings className="w-3.5 h-3.5 text-indigo-400" />
                  <span>Master Jabatan & Divisi</span>
                </button>
                <button
                  onClick={loadAllUsers}
                  disabled={isLoading}
                  className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-blue-300 rounded-xl text-xs font-bold transition flex items-center gap-1.5 border border-slate-700 cursor-pointer disabled:opacity-50"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
                  <span>Muat Ulang</span>
                </button>
                <button
                  onClick={handleClearAndResync}
                  className="px-3 py-2 bg-blue-950/60 hover:bg-blue-900 border border-blue-700/50 text-blue-200 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-xs"
                >
                  <Sliders className="w-3.5 h-3.5 text-amber-400" />
                  <span>Sinkronkan Ulang</span>
                </button>
              </div>
            </div>

            {/* Filter & Pencarian Bar */}
            <div className="flex flex-col sm:flex-row items-center gap-2.5 sm:gap-3 bg-slate-900/80 p-3 rounded-2xl border border-slate-800">
              <div className="relative flex-1 w-full">
                <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Cari berdasarkan nama, NPM, atau email..."
                  className="w-full pl-10 pr-4 py-2 text-xs bg-slate-950 border border-slate-800 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/40"
                />
              </div>

              <div className="flex items-center gap-2 w-full sm:w-auto">
                <select
                  value={filterRole}
                  onChange={(e) => setFilterRole(e.target.value)}
                  className="flex-1 sm:flex-none px-3 py-2 text-xs bg-slate-950 border border-slate-800 rounded-xl text-slate-200 font-bold focus:outline-none cursor-pointer"
                >
                  <option value="all">Semua Jabatan</option>
                  {masterJabatanList.map((j) => (
                    <option key={j.id} value={j.name}>{j.name}</option>
                  ))}
                </select>

                <select
                  value={filterDivision}
                  onChange={(e) => setFilterDivision(e.target.value)}
                  className="flex-1 sm:flex-none px-3 py-2 text-xs bg-slate-950 border border-slate-800 rounded-xl text-slate-200 font-bold focus:outline-none cursor-pointer"
                >
                  <option value="all">Semua Divisi</option>
                  {masterDivisions.map((div) => (
                    <option key={div} value={div}>{div}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Tampilan Desktop (Tabel Presisi) */}
            <div className="hidden sm:block bg-slate-900/90 rounded-3xl border border-slate-800 overflow-hidden shadow-xl">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-950/80 text-slate-400 uppercase tracking-wider text-[11px] font-black border-b border-slate-800">
                    <tr>
                      <th className="py-3.5 px-4">NPM / Identitas</th>
                      <th className="py-3.5 px-4">Nama Lengkap</th>
                      <th className="py-3.5 px-4">Divisi</th>
                      <th className="py-3.5 px-4 text-center">Jabatan / Role</th>
                      <th className="py-3.5 px-4 text-center">Status Akun</th>
                      <th className="py-3.5 px-4 text-center">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 font-medium">
                    {filteredMembers.map((m) => (
                      <tr key={m.npm} className="hover:bg-blue-950/30 transition">
                        <td className="py-3 px-4 font-mono font-bold text-slate-300">
                          <span className="px-2 py-0.5 rounded-lg bg-slate-950 border border-slate-800">
                            {m.npm}
                          </span>
                        </td>
                        <td className="py-3 px-4 font-bold text-white">
                          <span>{m.fullName}</span>
                        </td>
                        <td className="py-3 px-4 text-slate-300">{m.division}</td>
                        <td className="py-3 px-4 text-center">
                          {renderJabatanBadge(m)}
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
                            className="px-3 py-1.5 rounded-xl bg-blue-950/60 hover:bg-blue-900 text-blue-200 text-xs font-bold transition flex items-center gap-1 mx-auto border border-blue-700/50 cursor-pointer shadow-xs active:scale-95"
                          >
                            <Pencil className="w-3 h-3 text-blue-300" />
                            <span>Ubah</span>
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Tampilan Mobile (Kartu Modern Presisi Tanpa Terpotong) */}
            <div className="sm:hidden space-y-3">
              {filteredMembers.map((m) => (
                <div
                  key={m.npm}
                  className="bg-slate-900/90 rounded-2xl p-4 border border-slate-800 space-y-3 shadow-lg"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h4 className="font-extrabold text-white text-sm leading-snug">
                        {m.fullName}
                      </h4>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="px-2 py-0.5 rounded-lg bg-slate-950 border border-slate-800 text-slate-300 font-mono text-[11px]">
                          {m.npm}
                        </span>
                        <span className="text-[11px] text-slate-400 font-medium truncate">
                          {m.division}
                        </span>
                      </div>
                    </div>
                    <div>
                      {m.isClaimed ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 text-[10px] font-bold">
                          <Check className="w-3 h-3" />
                          <span>Aktif</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-400 border border-amber-500/30 text-[10px] font-bold">
                          Menunggu
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-1 border-t border-slate-800/60">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] font-bold text-slate-500 uppercase">Jabatan:</span>
                      {renderJabatanBadge(m)}
                    </div>

                    <button
                      onClick={() => handleOpenEdit(m)}
                      className="px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold transition flex items-center gap-1 shadow-md shadow-blue-600/30 cursor-pointer active:scale-95"
                    >
                      <Pencil className="w-3 h-3" />
                      <span>Ubah</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* TAB 2: MANAJEMEN PERIODE KEPENGURUSAN (CRUD SUPER ADMIN) */}
        {activeTab === 'periods' && (
          <div className="space-y-6 animate-in fade-in duration-200">
            {/* Header Banner */}
            <div className="p-5 sm:p-6 rounded-3xl bg-gradient-to-r from-blue-950/70 via-slate-900 to-slate-900 border border-blue-500/30 shadow-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-500/15 border border-blue-500/30 text-blue-300 text-[11px] font-bold uppercase mb-2">
                  <CalendarDays className="w-3.5 h-3.5 text-blue-400" />
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
                className="self-start sm:self-center px-4 py-2.5 rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white text-xs font-black transition flex items-center gap-2 cursor-pointer shadow-lg shadow-blue-600/30 active:scale-95"
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
                        <tr key={p.id} className="hover:bg-blue-950/30 transition">
                          <td className="py-3.5 px-4 font-bold text-white flex items-center gap-2">
                            <span>{p.name}</span>
                            {p.isActive && (
                              <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-[9px] font-black uppercase">
                                Sedang Berjalan
                              </span>
                            )}
                          </td>
                          <td className="py-3.5 px-4 font-mono font-bold text-blue-300">
                            {p.academicYear}
                          </td>
                          <td className="py-3.5 px-4 text-slate-300 font-semibold">
                            Semester {p.semester}
                          </td>
                          <td className="py-3.5 px-4 text-center">
                            {p.isActive ? (
                              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-[10px] font-black">
                                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                                <span>{p.statusLabel || 'PERIODE AKTIF'}</span>
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-slate-800 text-slate-400 border border-slate-700 text-[10px] font-bold">
                                <span>{p.statusLabel || 'Masa yang akan datang'}</span>
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
                                className="px-2.5 py-1.5 rounded-xl bg-blue-950/60 hover:bg-blue-900 border border-blue-700/50 text-blue-200 text-xs font-bold transition flex items-center gap-1 cursor-pointer"
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
            <div className="p-4 rounded-3xl bg-slate-900 border border-blue-500/30 flex flex-wrap items-center justify-between gap-3 shadow-lg">
              <div>
                <span className="text-xs font-black uppercase text-amber-400 block tracking-wider flex items-center gap-1.5">
                  <Laptop className="w-3.5 h-3.5 text-blue-400" />
                  <span>🧪 Simulator Tampilan Pengembang</span>
                </span>
                <p className="text-xs text-slate-400">
                  Uji antarmuka pengguna seolah-olah Anda login sebagai Kepala Divisi atau Anggota biasa.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <div className="flex items-center bg-slate-950 p-1 rounded-xl border border-slate-800 text-xs">
                  <button
                    onClick={() => setSimulatedRole('kadiv')}
                    className={`px-3 py-1.5 rounded-lg font-bold transition cursor-pointer flex items-center gap-1 ${
                      simulatedRole === 'kadiv'
                        ? 'bg-gradient-to-r from-amber-400 to-yellow-500 text-slate-950 font-black shadow-xs'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    <span>Kepala Divisi</span>
                  </button>
                  <button
                    onClick={() => setSimulatedRole('member')}
                    className={`px-3 py-1.5 rounded-lg font-bold transition cursor-pointer flex items-center gap-1 ${
                      simulatedRole === 'member'
                        ? 'bg-blue-600 text-white font-black shadow-xs'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    <User className="w-3.5 h-3.5" />
                    <span>Anggota Biasa</span>
                  </button>
                </div>

                <select
                  value={simulatedDivision}
                  onChange={(e) => setSimulatedDivision(e.target.value as Division)}
                  className="px-3 py-1.5 bg-slate-950 border border-slate-800 rounded-xl text-xs font-bold text-blue-300 focus:outline-none focus:ring-2 focus:ring-blue-500/40 cursor-pointer"
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
                  <CloudUpload className="w-4 h-4 text-blue-400" />
                </div>
                <h3 className="text-base font-black text-white">Google Drive Engine</h3>
                <p className="text-xs text-blue-300 font-bold">✓ Apps Script Auto-Compress</p>
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

            <div className="p-6 rounded-3xl bg-slate-900 border border-blue-500/25 space-y-4 shadow-xl">
              <h3 className="text-sm font-black text-white uppercase tracking-wider flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-400" />
                <span>Pembersihan Cache & Reset Sinkronisasi</span>
              </h3>
              <p className="text-xs text-slate-400 max-w-2xl leading-relaxed">
                Jika ada data tampilan yang tampak tidak berubah atau browser menyimpan cache versi lama, tekan tombol di bawah untuk membersihkan memori lokal dan memaksa aplikasi membaca langsung dari tabel PostgreSQL Supabase.
              </p>
              <button
                onClick={handleClearAndResync}
                className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold text-xs shadow-lg shadow-blue-600/30 transition cursor-pointer active:scale-95"
              >
                Reset Cache & Sinkronkan Sekarang
              </button>
            </div>

            {/* Panel Backup & Restore Database 1-Klik */}
            <div className="p-6 rounded-3xl bg-slate-900 border border-blue-500/25 space-y-4 shadow-xl">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h3 className="text-sm font-black text-white uppercase tracking-wider flex items-center gap-2">
                    <Database className="w-4 h-4 text-blue-400" />
                    <span>Cadangan & Pemulihan Basis Data (Backup & Restore)</span>
                  </h3>
                  <p className="text-xs text-slate-400 mt-1">
                    Unduh salinan berkas `.json` berisi seluruh data anggota, riwayat absensi, evaluasi poin, dan agenda untuk arsip offline.
                  </p>
                </div>

                <div className="flex items-center gap-2.5">
                  <button
                    onClick={handleDownloadBackup}
                    className="px-4 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white text-xs font-bold rounded-xl shadow-lg shadow-blue-600/25 flex items-center gap-1.5 transition cursor-pointer active:scale-95"
                  >
                    <Download className="w-4 h-4 text-amber-300" />
                    <span>Download Backup (.JSON)</span>
                  </button>

                  <label className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-blue-200 border border-blue-700/40 text-xs font-bold rounded-xl flex items-center gap-1.5 transition cursor-pointer active:scale-95 shadow-xs">
                    <Upload className="w-4 h-4 text-blue-400" />
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
            <div className="p-5 sm:p-6 rounded-3xl bg-gradient-to-r from-blue-950/70 via-slate-900 to-slate-900 border border-blue-500/30 shadow-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/15 border border-amber-400/30 text-amber-300 text-[11px] font-bold uppercase mb-2">
                  <ShieldAlert className="w-3.5 h-3.5 text-amber-400" />
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
                  className="px-3.5 py-2 rounded-xl bg-blue-950/60 hover:bg-blue-900 border border-blue-700/50 text-blue-200 text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-xs active:scale-95"
                >
                  <Download className="w-3.5 h-3.5 text-blue-300" />
                  <span>Unduh Log (.JSON)</span>
                </button>

                <button
                  onClick={() => {
                    if (confirm('Apakah Anda yakin ingin membersihkan seluruh riwayat log audit ini?')) {
                      clearAuditLogs();
                      setAuditLogs([]);
                      showToast('Log audit berhasil dibersihkan.', 'info');
                    }
                  }}
                  className="px-3.5 py-2 rounded-xl bg-rose-950/60 hover:bg-rose-900 border border-rose-800/50 text-rose-300 text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-xs active:scale-95"
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
                  className="w-full pl-9 pr-4 py-2 text-xs bg-slate-950 border border-slate-800 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/40"
                />
              </div>

              <div className="flex items-center gap-2 w-full sm:w-auto">
                <select
                  value={auditFilterType}
                  onChange={(e) => setAuditFilterType(e.target.value)}
                  className="w-full sm:w-auto px-3 py-2 text-xs bg-slate-950 border border-slate-800 rounded-xl text-slate-300 font-medium focus:outline-none focus:ring-2 focus:ring-blue-500/40 cursor-pointer"
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
                          ? 'bg-blue-500/20 text-blue-300 border-blue-500/30'
                          : isPeriod
                          ? 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30'
                          : isDelegasi
                          ? 'bg-amber-500/20 text-amber-300 border-amber-500/30'
                          : isPin
                          ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                          : 'bg-slate-800 text-slate-300 border-slate-700';

                        return (
                          <tr key={log.id} className="hover:bg-blue-950/30 transition">
                            <td className="py-3 px-4 font-mono text-slate-300 whitespace-nowrap">
                              <span className="block font-bold text-white">{timeFormatted}</span>
                              <span className="text-[10px] text-slate-500">{dateFormatted}</span>
                            </td>

                            <td className="py-3 px-4">
                              <span className="font-bold text-white block">{log.actorName}</span>
                              <span className="text-[10px] text-blue-300">{log.actorRole}</span>
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

        {/* TAB 7: REWARD MUBES (ANNUAL AWARDS) */}
        {activeTab === 'mubes-awards' && (
          <MubesAwardsManager
            currentUser={{
              id: 'super-admin-root',
              fullName: 'Pangki Deswa Rayhandi (Super Admin)',
              role: 'superadmin',
              npm: '2414101078',
            }}
            members={members.map((m) => ({
              npm: m.npm,
              nim: m.nim,
              full_name: m.fullName,
              fullName: m.fullName,
              division: m.division,
              role: m.role,
              jabatan: m.jabatan,
            }))}
            events={[]}
            onToast={showToast}
          />
        )}
      </main>

      {/* Footer Hak Cipta SIMAK GenBI & PD-Dev */}
      <Footer className="border-t-blue-900/40 bg-slate-900/90 text-slate-300" />

      {/* MODAL CRUD PERIODE KEPENGURUSAN */}
      {showPeriodModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in">
          <div className="w-full max-w-md rounded-[32px] bg-slate-900 border border-blue-500/30 p-6 shadow-2xl space-y-4 relative">
            <div>
              <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md bg-blue-500/20 text-blue-300 text-[10px] font-black uppercase tracking-wider mb-1 border border-blue-400/30">
                <CalendarDays className="w-3 h-3 text-blue-400" />
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
                  className="w-full px-3.5 py-2 text-xs bg-slate-950 border border-slate-800 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-blue-500/40"
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
                    className="w-full px-3.5 py-2 text-xs bg-slate-950 border border-slate-800 rounded-xl text-blue-300 font-mono font-bold focus:outline-none focus:ring-2 focus:ring-blue-500/40"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-400 uppercase">Semester</label>
                  <select
                    value={periodSemester}
                    onChange={(e) => setPeriodSemester(e.target.value as 'Ganjil' | 'Genap')}
                    className="w-full px-3 py-2 text-xs bg-slate-950 border border-slate-800 rounded-xl text-white font-medium focus:outline-none focus:ring-2 focus:ring-blue-500/40 cursor-pointer"
                  >
                    <option value="Ganjil">Semester Ganjil</option>
                    <option value="Genap">Semester Genap</option>
                  </select>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-bold text-slate-400 uppercase">
                  Label Status Kepengurusan
                </label>
                <input
                  type="text"
                  placeholder="Contoh: Masa yang akan datang / Periode Aktif / Persiapan"
                  value={periodStatusLabel}
                  onChange={(e) => setPeriodStatusLabel(e.target.value)}
                  className="w-full px-3.5 py-2 text-xs bg-slate-950 border border-slate-800 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-blue-500/40"
                />
                <p className="text-[10px] text-slate-500">
                  Label kustom yang tampil di tabel (misal: "Masa yang akan datang", bukan kaku Arsip Demisioner).
                </p>
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="periodIsActiveCheck"
                  checked={periodIsActive}
                  onChange={(e) => setPeriodIsActive(e.target.checked)}
                  className="w-4 h-4 rounded text-blue-600 bg-slate-950 border-slate-700 focus:ring-blue-500 cursor-pointer"
                />
                <label htmlFor="periodIsActiveCheck" className="text-xs font-bold text-blue-200 cursor-pointer">
                  Jadikan Sebagai Periode Kepengurusan Aktif
                </label>
              </div>

              <div className="p-3 rounded-2xl bg-blue-950/40 border border-blue-800/40 text-[11px] text-blue-200">
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
                  className="flex-1 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold text-xs rounded-xl shadow-lg shadow-blue-600/30 transition cursor-pointer disabled:opacity-50"
                >
                  {isSavingPeriod ? 'Menyimpan...' : 'Simpan Periode'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL UBAH HAK AKSES & JABATAN PENGGUNA */}
      {editingMember && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in">
          <div className="w-full max-w-md rounded-[32px] bg-slate-900 border border-blue-500/30 p-6 shadow-2xl space-y-4 relative">
            <button
              onClick={() => setEditingMember(null)}
              className="absolute top-4 right-4 p-2 rounded-full text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            <div>
              <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md bg-blue-500/20 text-blue-300 text-[10px] font-black uppercase tracking-wider mb-1 border border-blue-400/30">
                <Pencil className="w-3 h-3 text-blue-400" />
                <span>Super Admin Hak Akses & Jabatan</span>
              </div>
              <h3 className="text-base font-black text-white">
                Perbarui Data & Jabatan Pengguna
              </h3>
              <p className="text-xs text-slate-400">
                NPM / NIM: <span className="font-mono font-bold text-blue-300">{editingMember.npm}</span>
              </p>
            </div>

            <form onSubmit={handleSaveMemberAccess} className="space-y-3.5 text-left">
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-slate-400 uppercase">
                  Nama Lengkap Sesuai SK
                </label>
                <input
                  type="text"
                  required
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full px-3.5 py-2 text-xs bg-slate-950 border border-slate-800 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-blue-500/40"
                />
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-400 uppercase">Divisi Organisasi</label>
                  <select
                    value={editDivision}
                    onChange={(e) => {
                      const div = e.target.value;
                      setEditDivision(div);
                      if (div === 'BPH') {
                        setEditRole('admin');
                        if (!editJabatan || editJabatan === 'Anggota') setEditJabatan('Ketua');
                      } else if (div === 'Belum Ada Divisi') {
                        setEditRole('member');
                        setEditJabatan('Penerima Beasiswa Baru');
                      }
                    }}
                    className="w-full px-3 py-2 text-xs bg-slate-950 border border-slate-800 rounded-xl text-white font-medium focus:outline-none focus:ring-2 focus:ring-blue-500/40 cursor-pointer"
                  >
                    {masterDivisions.map((d) => (
                      <option key={d} value={d}>
                        {d}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-400 uppercase">Pilih Jabatan</label>
                  <select
                    value={editJabatan}
                    onChange={(e) => {
                      const jab = e.target.value;
                      setEditJabatan(jab);
                      const matched = masterJabatanList.find((j) => j.name === jab);
                      if (matched) {
                        setEditRole(matched.role);
                      } else if (
                        jab.toLowerCase().includes('ketua') ||
                        jab.toLowerCase().includes('sekretaris') ||
                        jab.toLowerCase().includes('bendahara') ||
                        editDivision === 'BPH'
                      ) {
                        setEditRole('admin');
                      } else if (jab.toLowerCase().includes('kepala divisi')) {
                        setEditRole('kadiv');
                      } else {
                        setEditRole('member');
                      }
                    }}
                    className="w-full px-3 py-2 text-xs bg-slate-950 border border-slate-800 rounded-xl text-blue-200 font-bold focus:outline-none focus:ring-2 focus:ring-blue-500/40 cursor-pointer"
                  >
                    {masterJabatanList.map((j) => (
                      <option key={j.id} value={j.name}>
                        {j.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-bold text-slate-400 uppercase">
                  Tingkat Hak Akses Sistem
                </label>
                <select
                  value={editRole}
                  onChange={(e) => setEditRole(e.target.value as Role)}
                  className="w-full px-3 py-2 text-xs bg-slate-950 border border-slate-800 rounded-xl text-amber-300 font-bold focus:outline-none focus:ring-2 focus:ring-blue-500/40 cursor-pointer"
                >
                  <option value="admin">🛡️ BPH (Akses Penuh Manajemen Presensi & Rekap)</option>
                  <option value="kadiv">Kepala Divisi (Kadiv - Akses Rekap & Verifikasi Divisi)</option>
                  <option value="member">👤 Anggota (Akses Presensi & Kartu Anggota)</option>
                </select>
              </div>

              <div className="p-3 rounded-2xl bg-blue-950/40 border border-blue-800/40 text-[11px] text-blue-200">
                💡 <strong>Sinkronisasi Universal:</strong> Perubahan nama, divisi, dan jabatan ini langsung tersinkronkan seketika ke Whitelist SK, Leaderboard/Podium, Rapor Anggota, dan profil pengguna.
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
                  className="flex-1 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold text-xs rounded-xl shadow-lg shadow-blue-600/30 transition cursor-pointer disabled:opacity-50"
                >
                  {isSavingEdit ? 'Menyimpan...' : 'Simpan & Sinkronkan'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL MASTER JABATAN & DIVISI ORGANISASI */}
      {showMasterModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md animate-in fade-in">
          <div className="w-full max-w-lg rounded-[32px] bg-slate-900 border border-indigo-500/30 p-6 shadow-2xl space-y-4 relative max-h-[90vh] flex flex-col">
            <button
              onClick={() => setShowMasterModal(false)}
              className="absolute top-4 right-4 p-2 rounded-full text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            <div>
              <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md bg-indigo-500/20 text-indigo-300 text-[10px] font-black uppercase tracking-wider mb-1 border border-indigo-400/30">
                <Settings className="w-3 h-3 text-indigo-400" />
                <span>Pusat Struktur Organisasi</span>
              </div>
              <h3 className="text-base font-black text-white">
                Master Jabatan & Divisi GenBI
              </h3>
              <p className="text-xs text-slate-400">
                Tambah, ubah, atau hapus jabatan (Ketua, Wakil, Sekretaris, Bendahara) dan divisi kapan saja sesuai kebutuhan SK kepengurusan berjalan.
              </p>
            </div>

            {/* Tab Navigasi Master */}
            <div className="flex rounded-xl bg-slate-950 p-1 border border-slate-800">
              <button
                type="button"
                onClick={() => setMasterTab('jabatan')}
                className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition cursor-pointer ${
                  masterTab === 'jabatan'
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Daftar Jabatan ({masterJabatanList.length})
              </button>
              <button
                type="button"
                onClick={() => setMasterTab('divisi')}
                className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition cursor-pointer ${
                  masterTab === 'divisi'
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Daftar Divisi ({masterDivisions.length})
              </button>
            </div>

            {/* Konten Tab Master Jabatan */}
            {masterTab === 'jabatan' && (
              <div className="space-y-4 overflow-y-auto pr-1 flex-1">
                {/* Form Tambah Jabatan Baru */}
                <form onSubmit={handleSaveNewJabatan} className="p-3.5 bg-slate-950/80 rounded-2xl border border-slate-800 space-y-2.5">
                  <span className="text-[11px] font-bold text-blue-300 uppercase block">
                    + Tambah Nama Jabatan Baru
                  </span>
                  <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
                    <input
                      type="text"
                      required
                      placeholder="Contoh: Wakil Ketua"
                      value={newJabatanName}
                      onChange={(e) => setNewJabatanName(e.target.value)}
                      className="px-3 py-2 text-xs bg-slate-900 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:outline-none"
                    />
                    <select
                      value={newJabatanDiv}
                      onChange={(e) => setNewJabatanDiv(e.target.value)}
                      className="px-2 py-2 text-xs bg-slate-900 border border-slate-700 rounded-xl text-white font-bold"
                    >
                      <option value="BPH">BPH</option>
                      <option value="all">Semua Divisi</option>
                      {masterDivisions.filter((d) => d !== 'BPH').map((d) => (
                        <option key={d} value={d}>{d}</option>
                      ))}
                    </select>
                    <select
                      value={newJabatanRole}
                      onChange={(e) => setNewJabatanRole(e.target.value as any)}
                      className="px-2 py-2 text-xs bg-slate-900 border border-slate-700 rounded-xl text-white font-bold"
                    >
                      <option value="admin">🛡️ Akses BPH</option>
                      <option value="kadiv">Akses Kadiv</option>
                      <option value="member">👤 Akses Anggota</option>
                    </select>
                    <button
                      type="submit"
                      className="py-2 px-3 bg-blue-600 hover:bg-blue-500 text-white text-xs font-black rounded-xl transition cursor-pointer shadow-md shadow-blue-600/25"
                    >
                      Simpan
                    </button>
                  </div>
                </form>

                {/* List Jabatan Aktif */}
                <div className="space-y-1.5">
                  <span className="text-[10px] font-bold text-slate-500 uppercase block">
                    Jabatan Terdaftar di Sistem
                  </span>
                  <div className="divide-y divide-slate-800/80 rounded-2xl bg-slate-950/60 border border-slate-800/80 overflow-hidden">
                    {masterJabatanList.map((j) => (
                      <div key={j.id} className="p-3 flex items-center justify-between gap-2 hover:bg-blue-950/20 transition">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-black text-white">{j.name}</span>
                          <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold border ${
                            j.role === 'admin'
                              ? 'bg-blue-500/20 text-blue-300 border-blue-500/30'
                              : j.role === 'kadiv'
                              ? 'bg-amber-500/20 text-amber-300 border-amber-500/30'
                              : 'bg-slate-800 text-slate-300 border-slate-700'
                          }`}>
                            {j.role === 'admin' ? 'BPH' : j.role === 'kadiv' ? 'Kadiv' : 'Anggota'}
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleDeleteJabatan(j.id, j.name)}
                          className="p-1.5 text-slate-500 hover:text-rose-400 hover:bg-rose-950/30 rounded-lg transition cursor-pointer"
                          title={`Hapus jabatan "${j.name}" dari sistem`}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Konten Tab Master Divisi */}
            {masterTab === 'divisi' && (
              <div className="space-y-4 overflow-y-auto pr-1 flex-1">
                {/* Form Tambah Divisi Baru */}
                <form onSubmit={handleAddDivision} className="p-3.5 bg-slate-950/80 rounded-2xl border border-slate-800 space-y-2.5">
                  <span className="text-[11px] font-bold text-blue-300 uppercase block">
                    + Tambah Divisi Baru
                  </span>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      required
                      placeholder="Contoh: Hubungan Masyarakat"
                      value={newDivisionInput}
                      onChange={(e) => setNewDivisionInput(e.target.value)}
                      className="flex-1 px-3 py-2 text-xs bg-slate-900 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:outline-none"
                    />
                    <button
                      type="submit"
                      className="py-2 px-4 bg-blue-600 hover:bg-blue-500 text-white text-xs font-black rounded-xl transition cursor-pointer shadow-md shadow-blue-600/25"
                    >
                      Tambah Divisi
                    </button>
                  </div>
                </form>

                {/* List Divisi Terdaftar */}
                <div className="space-y-1.5">
                  <span className="text-[10px] font-bold text-slate-500 uppercase block">
                    Divisi Terdaftar di SIMAK GENBI
                  </span>
                  <div className="divide-y divide-slate-800/80 rounded-2xl bg-slate-950/60 border border-slate-800/80 overflow-hidden">
                    {masterDivisions.map((d) => (
                      <div key={d} className="p-3 flex items-center justify-between gap-2 hover:bg-blue-950/20 transition">
                        <span className="text-xs font-black text-white">{d}</span>
                        {d !== 'BPH' && (
                          <button
                            type="button"
                            onClick={() => handleDeleteDivision(d)}
                            className="p-1.5 text-slate-500 hover:text-rose-400 hover:bg-rose-950/30 rounded-lg transition cursor-pointer"
                            title={`Hapus divisi "${d}"`}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            <div className="pt-2">
              <button
                type="button"
                onClick={() => setShowMasterModal(false)}
                className="w-full py-2.5 bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold rounded-xl transition cursor-pointer"
              >
                Tutup Master Organisasi
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL TAMBAH PENERIMA BEASISWA BARU */}
      {showAddMemberModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in">
          <div className="w-full max-w-md rounded-[32px] bg-slate-900 border border-emerald-500/30 p-6 shadow-2xl space-y-4 relative">
            <button
              onClick={() => setShowAddMemberModal(false)}
              className="absolute top-4 right-4 p-2 rounded-full text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            <div>
              <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md bg-emerald-500/20 text-emerald-300 text-[10px] font-black uppercase tracking-wider mb-1 border border-emerald-400/30">
                <UserPlus className="w-3 h-3 text-emerald-400" />
                <span>Penerima Beasiswa Baru</span>
              </div>
              <h3 className="text-base font-black text-white">
                Daftarkan Anggota Baru ke Sistem
              </h3>
              <p className="text-xs text-slate-400">
                Daftarkan mahasiswa penerima SK beasiswa baru yang belum masuk ke divisi manapun agar dapat langsung mengaktifkan akun di SIMAK GENBI.
              </p>
            </div>

            <form onSubmit={handleCreateNewMember} className="space-y-3.5 text-left">
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-slate-400 uppercase">
                  NPM / NIM Mahasiswa
                </label>
                <input
                  type="text"
                  required
                  placeholder="Contoh: 2414101099"
                  value={newMemberNpm}
                  onChange={(e) => setNewMemberNpm(e.target.value)}
                  className="w-full px-3.5 py-2 text-xs bg-slate-950 border border-slate-800 rounded-xl text-white font-mono focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-bold text-slate-400 uppercase">
                  Nama Lengkap Sesuai SK
                </label>
                <input
                  type="text"
                  required
                  placeholder="Nama Lengkap Penerima Beasiswa"
                  value={newMemberName}
                  onChange={(e) => setNewMemberName(e.target.value)}
                  className="w-full px-3.5 py-2 text-xs bg-slate-950 border border-slate-800 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
                />
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-400 uppercase">Divisi Penempatan</label>
                  <select
                    value={newMemberDiv}
                    onChange={(e) => setNewMemberDiv(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-slate-950 border border-slate-800 rounded-xl text-white font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500/40 cursor-pointer"
                  >
                    {masterDivisions.map((d) => (
                      <option key={d} value={d}>
                        {d}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-400 uppercase">Jabatan Awal</label>
                  <select
                    value={newMemberJabatan}
                    onChange={(e) => setNewMemberJabatan(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-slate-950 border border-slate-800 rounded-xl text-emerald-200 font-bold focus:outline-none focus:ring-2 focus:ring-emerald-500/40 cursor-pointer"
                  >
                    {masterJabatanList.map((j) => (
                      <option key={j.id} value={j.name}>
                        {j.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="p-3 rounded-2xl bg-emerald-950/30 border border-emerald-800/40 text-[11px] text-emerald-200">
                Mahasiswa yang didaftarkan akan otomatis masuk ke daftar Whitelist resmi dan siap melakukan aktivasi akun di aplikasi.
              </div>

              <div className="pt-2 flex gap-2">
                <button
                  type="button"
                  onClick={() => setShowAddMemberModal(false)}
                  className="flex-1 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold rounded-xl transition cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isSavingNewMember}
                  className="flex-1 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-xs rounded-xl shadow-lg shadow-emerald-600/30 transition cursor-pointer disabled:opacity-50"
                >
                  {isSavingNewMember ? 'Mendaftarkan...' : 'Daftarkan Anggota'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
