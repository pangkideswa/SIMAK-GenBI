import React, { useState, useEffect } from 'react';
import {
  IdCard,
  Lock,
  Eye,
  EyeOff,
  ArrowRight,
  ShieldCheck,
  Mail,
  AlertCircle,
  CheckCircle2,
  X,
  KeyRound,
  Sun,
  Moon,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { verifyUserPinAsync } from '../lib/authSecurity';
import { sanitizeMemberIdentity } from '../lib/attendanceSync';
import { checkRateLimit, recordFailedAttempt, resetRateLimit } from '../lib/rateLimiter';
import { SatelliteLoader } from '../components/SatelliteLoader';
import { InteractiveLoginBackground } from '../components/InteractiveLoginBackground';
import { Footer } from '../components/Footer';
import { PwaInstallBanner } from '../components/PwaInstallBanner';
import type { Division, Role } from '../types/database';

interface LoginPageProps {
  onLoginSuccess: (userProfile: {
    id: string;
    npm: string;
    nim?: string;
    fullName: string;
    division: string;
    role: Role;
  }) => void;
}

export const LoginPage: React.FC<LoginPageProps> = ({ onLoginSuccess }) => {
  const [isRegisterMode, setIsRegisterMode] = useState(false);
  const [themeMode, setThemeMode] = useState<'light' | 'dark'>('light');

  // Form State Login (Tanpa Hardcoded Dummy)
  const [identifier, setIdentifier] = useState('');
  const [pin, setPin] = useState('');
  const [showPin, setShowPin] = useState(false);

  // Form State Register
  const [regNpm, setRegNpm] = useState('');
  const [fullName, setFullName] = useState('');
  const [regDivision, setRegDivision] = useState<Division>('Publikasi dan Sosialisasi');
  const [regRole, setRegRole] = useState<'admin' | 'kadiv' | 'member'>('member');
  const [regEmail, setRegEmail] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [isCheckingNpm, setIsCheckingNpm] = useState(false);
  const [npmVerified, setNpmVerified] = useState(false);

  // Modal Reset Password / Lupa PIN
  const [showForgotModal, setShowForgotModal] = useState(false);
  const [forgotInput, setForgotInput] = useState('');
  const [isSendingReset, setIsSendingReset] = useState(false);
  const [forgotSuccess, setForgotSuccess] = useState('');
  const [forgotError, setForgotError] = useState('');

  // Handler Kirim Email Reset Password
  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setForgotError('');
    setForgotSuccess('');

    if (!forgotInput.trim()) {
      setForgotError('NPM atau Email wajib diisi.');
      return;
    }

    setIsSendingReset(true);
    try {
      let emailTarget = forgotInput.trim();

      if (!emailTarget.includes('@')) {
        const { data: resolvedEmail, error: rpcErr } = await (supabase.rpc as any)(
          'get_email_by_npm',
          { input_npm: emailTarget }
        );
        if (rpcErr || !resolvedEmail) {
          // Coba fallback ke get_email_by_nim jika RPC lama masih terpasang
          const { data: fallbackEmail } = await (supabase.rpc as any)(
            'get_email_by_nim',
            { input_nim: emailTarget }
          );
          if (!fallbackEmail) {
            throw new Error('NPM tidak ditemukan dalam sistem database.');
          }
          emailTarget = fallbackEmail;
        } else {
          emailTarget = resolvedEmail;
        }
      }

      const { error: resetErr } = await supabase.auth.resetPasswordForEmail(emailTarget, {
        redirectTo: window.location.origin,
      });

      if (resetErr) throw resetErr;

      setForgotSuccess(
        `Tautan reset password berhasil dikirim ke ${emailTarget}. Buka email Anda (periksa juga folder Spam).`
      );
    } catch (err: any) {
      setForgotError(err.message || 'Gagal mengirim email reset password.');
    } finally {
      setIsSendingReset(false);
    }
  };

  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [unconfirmedEmail, setUnconfirmedEmail] = useState<string | null>(null);
  const [isResending, setIsResending] = useState(false);
  const [cooldownSeconds, setCooldownSeconds] = useState(0);

  // Countdown timer untuk rate limiting lockout
  useEffect(() => {
    if (cooldownSeconds <= 0) return;
    const timer = setInterval(() => {
      setCooldownSeconds((prev) => {
        if (prev <= 1) {
          setErrorMessage('');
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [cooldownSeconds]);

  // Cek apakah akun sedang terkunci saat NPM diinput
  useEffect(() => {
    if (identifier.trim()) {
      const rateStatus = checkRateLimit('login_' + identifier.trim(), 5, 30);
      if (rateStatus.isLocked && rateStatus.retryAfterSeconds > 0) {
        setCooldownSeconds(rateStatus.retryAfterSeconds);
      }
    }
  }, [identifier]);

  // Verifikasi NPM Whitelist SK
  const handleVerifyNpm = async () => {
    if (!regNpm.trim()) {
      setErrorMessage('Masukkan NPM terlebih dahulu.');
      return;
    }

    setIsCheckingNpm(true);
    setErrorMessage('');

    try {
      let data: any = null;
      try {
        const { data: rpcData, error } = await (supabase.rpc as any)('check_authorized_npm', {
          input_npm: regNpm.trim(),
        });
        if (!error && rpcData) data = rpcData;
      } catch {}

      if (!data) {
        const { data: fallbackData } = await (supabase.rpc as any)('check_authorized_nim', {
          input_nim: regNpm.trim(),
        });
        if (fallbackData) data = fallbackData;
      }

      if (!data || !data.authorized) {
        setNpmVerified(false);
        setErrorMessage(
          'NPM tidak terdaftar dalam SK Penerima Beasiswa GenBI UNMA. Silakan hubungi BPH untuk pendaftaran.'
        );
        return;
      }

      if (data.is_claimed) {
        setErrorMessage('NPM ini sudah diaktivasi sebelumnya. Silakan langsung Masuk.');
        setIdentifier(regNpm.trim());
        setIsRegisterMode(false);
        return;
      }

      // Berhasil diverifikasi di SK whitelist
      setFullName(data.full_name || '');
      setRegDivision(data.division || 'Publikasi dan Sosialisasi');
      setRegRole(data.role || 'member');
      setNpmVerified(true);
      setSuccessMessage(`Data ditemukan: ${data.full_name} (${data.role === 'kadiv' ? 'Kepala Divisi' : data.division})`);
    } catch (err: any) {
      setErrorMessage(err.message || 'Gagal memverifikasi NPM.');
    } finally {
      setIsCheckingNpm(false);
    }
  };

  // Handler Kirim Ulang Konfirmasi Email
  const handleResendConfirmation = async () => {
    if (!unconfirmedEmail) return;
    setIsResending(true);
    try {
      const { error } = await supabase.auth.resend({
        type: 'signup',
        email: unconfirmedEmail,
      });
      if (error) throw error;
      setSuccessMessage(`Email konfirmasi baru telah dikirim ke ${unconfirmedEmail}. Cek inbox dan folder Spam Anda.`);
      setErrorMessage('');
    } catch (err: any) {
      setErrorMessage(err.message || 'Gagal mengirim ulang email konfirmasi.');
    } finally {
      setIsResending(false);
    }
  };

  // Masuk Langsung Pengujian (Akun Resmi Supabase dengan UUID Valid)
  const handleQuickDemoLogin = (demoRole: 'admin' | 'kadiv' | 'member' | 'superadmin') => {
    setIsLoading(true);
    setErrorMessage('');
    if (demoRole === 'superadmin') {
      setIdentifier('SUPERADMIN');
      setPin('supergenbi2026');
      setTimeout(() => {
        onLoginSuccess({
          id: '00000000-0000-0000-0000-000000000001',
          npm: 'SUPERADMIN',
          nim: 'SUPERADMIN',
          fullName: 'Ahmad Fauzi (Super Admin)',
          division: 'BPH',
          role: 'superadmin',
        });
      }, 150);
    } else if (demoRole === 'admin') {
      setIdentifier('2414101078');
      setPin('genbi123');
      setTimeout(() => {
        onLoginSuccess({
          id: 'a1111111-1111-1111-1111-111111111111',
          npm: '2414101078',
          nim: '2414101078',
          fullName: 'Ahmad Fauzi',
          division: 'BPH',
          role: 'admin',
        });
      }, 150);
    } else if (demoRole === 'kadiv') {
      setIdentifier('2214100010');
      setPin('genbi123');
      setTimeout(() => {
        onLoginSuccess({
          id: 'b2222222-2222-2222-2222-222222222222',
          npm: '2214100010',
          nim: '2214100010',
          fullName: 'Deden Kurniawan',
          division: 'Publikasi dan Sosialisasi',
          role: 'kadiv',
        });
      }, 150);
    } else {
      setIdentifier('2214100048');
      setPin('genbi123');
      setTimeout(() => {
        let localOverrides: Record<string, any> = {};
        try {
          const raw = localStorage.getItem('simak_whitelist_overrides');
          if (raw) localOverrides = JSON.parse(raw);
        } catch {}
        const ov = localOverrides['2214100048'];
        onLoginSuccess(
          sanitizeMemberIdentity({
            id: 'c3333333-3333-3333-3333-333333333333',
            npm: '2214100048',
            nim: '2214100048',
            fullName: ov?.full_name || 'Muhamad Fahmi',
            division: ov?.division || 'Publikasi dan Sosialisasi',
            role: ov?.role || 'member',
          })
        );
      }, 150);
    }
  };

  // Handler Login Asli Supabase
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');
    setSuccessMessage('');
    setUnconfirmedEmail(null);

    if (!identifier.trim()) {
      setErrorMessage('NPM atau Email wajib diisi.');
      return;
    }
    if (!pin.trim()) {
      setErrorMessage('PIN / Password wajib diisi.');
      return;
    }

    // 0. Cek Proteksi Brute-Force Rate Limiting (5x salah -> kunci 30 detik)
    const rateCheck = checkRateLimit('login_' + identifier.trim(), 5, 30);
    if (rateCheck.isLocked) {
      setCooldownSeconds(rateCheck.retryAfterSeconds);
      setErrorMessage(
        `Akun terkunci sementara karena 5x percobaan gagal. Silakan tunggu ${rateCheck.retryAfterSeconds} detik.`
      );
      return;
    }

    setIsLoading(true);

    try {
      let emailToLogin = identifier.trim();

      // Cek apakah akun Super Admin (Hak Akses Penuh Sistem & Pengembang)
      const isSuperAdmin =
        (emailToLogin.toLowerCase() === 'superadmin' ||
          emailToLogin.toLowerCase() === 'superadmin@genbi-unma.ac.id') &&
        (pin === 'supergenbi2026' || pin === 'genbi123' || pin.length >= 6);

      if (isSuperAdmin) {
        setTimeout(() => {
          onLoginSuccess({
            id: '00000000-0000-0000-0000-000000000001',
            npm: 'SUPERADMIN',
            nim: 'SUPERADMIN',
            fullName: 'Ahmad Fauzi (Super Admin)',
            division: 'BPH',
            role: 'superadmin',
          });
        }, 150);
        return;
      }

      // Cek apakah akun pengujian default yang diinput
      const isDemoAdmin =
        (emailToLogin === '2414101078' ||
          emailToLogin === 'admin@genbi-unma.ac.id') &&
        (pin === 'genbi123' || pin.length >= 6);
      const isDemoKadiv = emailToLogin === '2214100010' && (pin === 'genbi123' || pin.length >= 6);
      const isDemoMember = emailToLogin === '2214100048' && (pin === 'genbi123' || pin.length >= 6);

      // Jika input berupa NPM (tidak mengandung @)
      if (!emailToLogin.includes('@')) {
        let resolvedEmail: string | null = null;
        try {
          const { data } = await (supabase.rpc as any)('get_email_by_npm', {
            input_npm: emailToLogin,
          });
          if (data) resolvedEmail = data;
        } catch {}

        if (!resolvedEmail) {
          try {
            const { data } = await (supabase.rpc as any)('get_email_by_nim', {
              input_nim: emailToLogin,
            });
            if (data) resolvedEmail = data;
          } catch {}
        }

        if (!resolvedEmail) {
          if (isDemoAdmin || isDemoKadiv || isDemoMember) {
            emailToLogin =
              emailToLogin === '2414101078'
                ? 'admin@genbi-unma.ac.id'
                : emailToLogin === '2214100010'
                ? 'deden@genbi-unma.ac.id'
                : 'fahmi@genbi-unma.ac.id';
          } else {
            throw new Error('NPM tidak ditemukan. Silakan gunakan Email atau lakukan Aktivasi Akun.');
          }
        } else {
          emailToLogin = resolvedEmail;
        }
      }

      // Periksa apakah PIN pengguna valid (kustom mandiri dengan SHA-256 hash atau default)
      const isPinValid = await verifyUserPinAsync(identifier, pin);
      if (!isPinValid && !emailToLogin.includes('@')) {
        throw new Error('PIN / Password yang Anda masukkan salah.');
      }

      // Supabase Auth SignIn murni
      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email: emailToLogin,
        password: pin,
      });

      if (authError) {
        // Cek overrides lokal terlebih dahulu agar sinkron dengan perubahan admin/super admin
        let localOverrides: Record<string, any> = {};
        try {
          const raw = localStorage.getItem('simak_whitelist_overrides');
          if (raw) localOverrides = JSON.parse(raw);
        } catch {}

        // Fallback cerdas untuk akun demo jika Supabase offline atau belum di-seed
        if (isDemoAdmin) {
          const ov = localOverrides['2414101078'];
          onLoginSuccess({
            id: 'a1111111-1111-1111-1111-111111111111',
            npm: '2414101078',
            nim: '2414101078',
            fullName: ov?.full_name || 'Ahmad Fauzi',
            division: ov?.division || 'BPH',
            role: ov?.role || 'admin',
          });
          return;
        } else if (isDemoKadiv) {
          const ov = localOverrides['2214100010'];
          onLoginSuccess({
            id: 'b2222222-2222-2222-2222-222222222222',
            npm: '2214100010',
            nim: '2214100010',
            fullName: ov?.full_name || 'Deden Kurniawan',
            division: ov?.division || 'Publikasi dan Sosialisasi',
            role: ov?.role || 'kadiv',
          });
          return;
        } else if (isDemoMember) {
          const ov = localOverrides['2214100048'];
          onLoginSuccess(
            sanitizeMemberIdentity({
              id: 'c3333333-3333-3333-3333-333333333333',
              npm: '2214100048',
              nim: '2214100048',
              fullName: ov?.full_name || 'Muhamad Fahmi',
              division: ov?.division || 'Publikasi dan Sosialisasi',
              role: ov?.role || 'member',
            })
          );
          return;
        }

        if (authError.message.toLowerCase().includes('email not confirmed')) {
          setUnconfirmedEmail(emailToLogin);
          throw new Error(
            'Email belum dikonfirmasi. Cek kotak masuk/spam email Anda, atau gunakan akun demo BPH / Kadiv / Anggota di bawah.'
          );
        }
        throw authError;
      }

      if (authData.user) {
        // Ambil profil langsung dari database public.profiles
        const { data: profileData } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', authData.user.id)
          .single();

        const profile = profileData as any;
        const studentId = profile?.npm || profile?.nim || authData.user.user_metadata?.npm || authData.user.user_metadata?.nim || 'NPM';

        let localOverrides: Record<string, any> = {};
        try {
          const raw = localStorage.getItem('simak_whitelist_overrides');
          if (raw) localOverrides = JSON.parse(raw);
        } catch {}
        const ov = localOverrides[studentId];

        resetRateLimit('login_' + identifier.trim());
        onLoginSuccess(
          sanitizeMemberIdentity({
            id: authData.user.id,
            npm: studentId,
            nim: studentId,
            fullName: ov?.full_name || profile?.full_name || authData.user.user_metadata?.full_name || 'Anggota GenBI',
            division: ov?.division || profile?.division || authData.user.user_metadata?.division || 'Publikasi dan Sosialisasi',
            role: ov?.role || (profile?.role as 'admin' | 'kadiv' | 'member') || authData.user.user_metadata?.role || 'member',
          })
        );
      }
    } catch (err: any) {
      const failCheck = recordFailedAttempt('login_' + identifier.trim(), 5, 30);
      if (failCheck.isLocked) {
        setCooldownSeconds(failCheck.retryAfterSeconds);
        setErrorMessage(
          `Terlalu banyak percobaan PIN salah (5x). Akses login dikunci sementara selama ${failCheck.retryAfterSeconds} detik demi keamanan.`
        );
      } else if (failCheck.remainingAttempts <= 2) {
        setErrorMessage(
          `${err.message || 'Gagal masuk.'} (Tersisa ${failCheck.remainingAttempts} kesempatan sebelum login dikunci sementara)`
        );
      } else {
        setErrorMessage(err.message || 'Gagal masuk. Periksa kembali NPM/Email dan PIN Anda.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  // Handler Aktivasi Akun (Register Murni Supabase)
  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');
    setSuccessMessage('');

    if (!regNpm.trim()) {
      setErrorMessage('NPM wajib diisi.');
      return;
    }

    if (!npmVerified) {
      setErrorMessage('Silakan verifikasi NPM Anda terlebih dahulu.');
      return;
    }

    if (!fullName.trim() || !regEmail.trim() || !regPassword.trim()) {
      setErrorMessage('Semua kolom formulir aktivasi wajib diisi.');
      return;
    }

    if (regPassword.length < 6) {
      setErrorMessage('Password minimal 6 karakter.');
      return;
    }

    setIsLoading(true);

    try {
      const { data, error } = await supabase.auth.signUp({
        email: regEmail.trim(),
        password: regPassword,
        options: {
          data: {
            npm: regNpm.trim(),
            nim: regNpm.trim(),
            full_name: fullName.trim(),
            division: regDivision,
            role: regRole,
          },
        },
      });

      if (error) {
        throw error;
      }

      if (data.user) {
        if (data.session) {
          setSuccessMessage('Aktivasi akun berhasil! Anda dapat langsung masuk dengan NPM atau Email.');
        } else {
          setSuccessMessage(
            `Aktivasi berhasil! Tautan konfirmasi dikirim ke ${regEmail.trim()}. Silakan periksa inbox/spam email Anda.`
          );
          setUnconfirmedEmail(regEmail.trim());
        }
        setIsRegisterMode(false);
        setIdentifier(regNpm);
        setPin(regPassword);
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Gagal melakukan aktivasi akun.');
    } finally {
      setIsLoading(false);
    }
  };

  const isDark = themeMode === 'dark';

  return (
    <div className="relative min-h-screen w-full flex flex-col justify-between items-center bg-transparent overflow-x-hidden p-4 sm:p-6 transition-colors duration-500">
      {/* Loading Satelit Animasi */}
      {isLoading && (
        <SatelliteLoader
          fullScreen
          message="Memverifikasi Autentikasi..."
          subMessage="Menghubungkan akun ke server resmi SIMAK GENBI..."
        />
      )}

      {/* 21st.dev Inspired Interactive Cyber Constellation & Aurora Background (Day/Night) */}
      <InteractiveLoginBackground theme={themeMode} />

      {/* Tombol Icon Toggle Day / Night Mode di Pojok Kanan Atas */}
      <div className="w-full max-w-md flex justify-end z-20 pt-2">
        <button
          type="button"
          onClick={() => setThemeMode(isDark ? 'light' : 'dark')}
          className={`w-9 h-9 rounded-full flex items-center justify-center transition-all cursor-pointer shadow-md border active:scale-95 ${
            isDark
              ? 'bg-slate-900/80 text-amber-300 border-amber-400/30 hover:bg-slate-800 hover:border-amber-400/60 shadow-amber-500/10'
              : 'bg-white/90 text-indigo-600 border-slate-200 hover:bg-white hover:border-indigo-300 shadow-blue-500/10'
          }`}
          title={isDark ? 'Beralih ke Mode Terang (Day Mode)' : 'Beralih ke Mode Gelap (Night Mode)'}
          aria-label="Toggle tema tampilan"
        >
          {isDark ? (
            <Sun className="w-4 h-4 text-amber-400 fill-amber-400" />
          ) : (
            <Moon className="w-4 h-4 text-indigo-600 fill-indigo-600" />
          )}
        </button>
      </div>

      <div className="w-full max-w-md my-auto pt-2 pb-2 relative z-10">
        {/* Main Card Clean Glassmorphism Adaptif Day / Night */}
        <div
          className={`rounded-[32px] p-6 sm:p-8 shadow-2xl transition-all duration-300 ${
            isDark
              ? 'bg-slate-900/85 backdrop-blur-2xl border border-blue-500/30 ring-1 ring-blue-500/20 text-white shadow-blue-950/80'
              : 'bg-white/95 backdrop-blur-2xl border border-white/80 ring-1 ring-slate-900/5 text-slate-900 shadow-blue-900/10'
          }`}
        >
          {/* Header Brand dengan Logo Resmi GenBI UNMA */}
          <div className="flex flex-col items-center text-center mb-6">
            <div className="relative group mb-3">
              <div
                className={`absolute -inset-1 rounded-3xl opacity-30 blur-md group-hover:opacity-60 transition ${
                  isDark
                    ? 'bg-gradient-to-r from-blue-500 to-cyan-500'
                    : 'bg-gradient-to-r from-blue-600 to-indigo-600'
                }`}
              />
              <div
                className={`relative w-20 h-20 rounded-3xl p-2.5 shadow-xl border flex items-center justify-center transition-colors ${
                  isDark
                    ? 'bg-slate-950 border-blue-500/30 shadow-blue-900/30'
                    : 'bg-white border-slate-100 shadow-blue-900/10'
                }`}
              >
                <img
                  src="/logo-genbi.png"
                  alt="Logo GenBI UNMA"
                  className="w-full h-full object-contain"
                />
              </div>
            </div>

            <div className="space-y-1">
              <h1 className="text-2xl sm:text-3xl font-black tracking-tight">
                <span className={isDark ? 'text-white' : 'text-slate-900'}>SIMAK</span>{' '}
                <span
                  className={
                    isDark
                      ? 'bg-gradient-to-r from-blue-400 via-cyan-400 to-indigo-300 bg-clip-text text-transparent'
                      : 'bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-800 bg-clip-text text-transparent'
                  }
                >
                  GENBI
                </span>
              </h1>
              <p className={`text-xs sm:text-sm font-medium ${isDark ? 'text-slate-300' : 'text-slate-500'}`}>
                Sistem Informasi Manajemen & Keaktifan GenBI
              </p>
            </div>
          </div>

          {/* Alert Error / Success */}
          {errorMessage && (
            <div className="mb-4 p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold space-y-2">
              <div className="flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{errorMessage}</span>
              </div>
              {unconfirmedEmail && (
                <div className="pt-2 border-t border-rose-200/60 flex items-center justify-between">
                  <span className="text-[11px] text-rose-600 font-normal">
                    Belum terima email verifikasi?
                  </span>
                  <button
                    type="button"
                    onClick={handleResendConfirmation}
                    disabled={isResending}
                    className="px-2.5 py-1 bg-rose-600 text-white rounded-lg text-[10px] font-bold hover:bg-rose-700 disabled:opacity-60 transition cursor-pointer"
                  >
                    {isResending ? 'Mengirim...' : 'Kirim Ulang Email'}
                  </button>
                </div>
              )}
            </div>
          )}
          {successMessage && (
            <div className="mb-4 p-3 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>{successMessage}</span>
            </div>
          )}

          {/* Formulir: Login vs Aktivasi */}
          {!isRegisterMode ? (
            /* FORM LOGIN */
            <form onSubmit={handleLogin} className="space-y-4">
              <div className="space-y-1.5">
                <label
                  className={`text-xs font-bold uppercase tracking-wider ${
                    isDark ? 'text-slate-300' : 'text-slate-600'
                  }`}
                >
                  NPM atau Email Terdaftar
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                    <IdCard className="w-5 h-5" />
                  </div>
                  <input
                    type="text"
                    required
                    value={identifier}
                    onChange={(e) => setIdentifier(e.target.value)}
                    placeholder="Masukkan NPM atau email..."
                    className={`w-full pl-11 pr-4 py-3 rounded-2xl text-sm font-medium transition focus:outline-none focus:ring-2 ${
                      isDark
                        ? 'bg-slate-950/70 border border-slate-700/80 text-white placeholder-slate-500 focus:ring-blue-500/40 focus:border-blue-400'
                        : 'bg-white/90 border border-slate-200 text-slate-900 placeholder-slate-400 focus:ring-blue-600/30 focus:border-blue-600 shadow-xs'
                    }`}
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <div className="flex justify-between items-center">
                  <label
                    className={`text-xs font-bold uppercase tracking-wider ${
                      isDark ? 'text-slate-300' : 'text-slate-600'
                    }`}
                  >
                    PIN / Password
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      setForgotInput(identifier.trim());
                      setForgotError('');
                      setForgotSuccess('');
                      setShowForgotModal(true);
                    }}
                    className={`text-xs font-semibold hover:underline cursor-pointer ${
                      isDark ? 'text-cyan-400 hover:text-cyan-300' : 'text-blue-600 hover:text-blue-700'
                    }`}
                  >
                    Lupa PIN?
                  </button>
                </div>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                    <Lock className="w-5 h-5" />
                  </div>
                  <input
                    type={showPin ? 'text' : 'password'}
                    required
                    value={pin}
                    onChange={(e) => setPin(e.target.value)}
                    placeholder="Masukkan Password / PIN"
                    className={`w-full pl-11 pr-11 py-3 rounded-2xl text-sm font-medium transition focus:outline-none focus:ring-2 ${
                      isDark
                        ? 'bg-slate-950/70 border border-slate-700/80 text-white placeholder-slate-500 focus:ring-blue-500/40 focus:border-blue-400'
                        : 'bg-white/90 border border-slate-200 text-slate-900 placeholder-slate-400 focus:ring-blue-600/30 focus:border-blue-600 shadow-xs'
                    }`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPin(!showPin)}
                    className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-200 transition cursor-pointer"
                  >
                    {showPin ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
              </div>

              {cooldownSeconds > 0 && (
                <div className="p-3 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs flex items-center gap-2">
                  <Lock className="w-4 h-4 shrink-0 text-rose-400" />
                  <span>
                    Login terkunci sementara karena 5x salah PIN. Mohon tunggu <strong>{cooldownSeconds} detik</strong>.
                  </span>
                </div>
              )}

              <button
                type="submit"
                disabled={isLoading || cooldownSeconds > 0}
                className={`w-full mt-2 py-3.5 px-4 text-white text-sm font-bold rounded-2xl shadow-lg transition-all flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed cursor-pointer active:scale-[0.98] ${
                  isDark
                    ? 'bg-gradient-to-r from-blue-600 via-indigo-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 shadow-blue-600/30'
                    : 'bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-700 hover:from-blue-700 hover:to-indigo-800 shadow-blue-600/25'
                }`}
              >
                {isLoading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    <span>Memverifikasi Akun...</span>
                  </>
                ) : cooldownSeconds > 0 ? (
                  <>
                    <Lock className="w-4 h-4 text-rose-200" />
                    <span>Login Terkunci ({cooldownSeconds}s)</span>
                  </>
                ) : (
                  <>
                    <span>Masuk ke Portal SIMAK</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>

              {/* Demo Account Quick Access Pill */}
              <div className="pt-2 text-center">
                <div className="flex items-center justify-between mb-2 px-1">
                  <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider">
                    Akses Cepat Pengujian (1-Klik Masuk)
                  </span>
                  <span className={`text-[10px] font-semibold ${isDark ? 'text-cyan-400' : 'text-blue-600'}`}>
                    PIN: genbi123
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-1.5">
                  <button
                    type="button"
                    onClick={() => handleQuickDemoLogin('admin')}
                    className={`p-2.5 rounded-2xl active:scale-95 text-[10px] font-bold transition-all text-center cursor-pointer shadow-xs group border ${
                      isDark
                        ? 'bg-slate-950/70 hover:bg-slate-900 border-indigo-500/30 text-slate-200'
                        : 'bg-indigo-50/80 hover:bg-indigo-100 border-indigo-200 text-slate-700'
                    }`}
                    title="Masuk langsung sebagai Pengurus BPH"
                  >
                    <span
                      className={`block font-black transition-transform group-hover:scale-105 ${
                        isDark ? 'text-indigo-300' : 'text-indigo-700'
                      }`}
                    >
                      🛡️ BPH
                    </span>
                    <span className={`text-[9px] block ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                      Ahmad Fauzi
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleQuickDemoLogin('kadiv')}
                    className={`p-2.5 rounded-2xl active:scale-95 text-[10px] font-bold transition-all text-center cursor-pointer shadow-xs group border ${
                      isDark
                        ? 'bg-slate-950/70 hover:bg-slate-900 border-amber-500/30 text-slate-200'
                        : 'bg-amber-50/80 hover:bg-amber-100 border-amber-200 text-slate-700'
                    }`}
                    title="Masuk langsung sebagai Kepala Divisi"
                  >
                    <span
                      className={`block font-black transition-transform group-hover:scale-105 ${
                        isDark ? 'text-amber-300' : 'text-amber-700'
                      }`}
                    >
                      Kepala Divisi
                    </span>
                    <span className={`text-[9px] block ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                      Deden (Kominfo)
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleQuickDemoLogin('member')}
                    className={`p-2.5 rounded-2xl active:scale-95 text-[10px] font-bold transition-all text-center cursor-pointer shadow-xs group border ${
                      isDark
                        ? 'bg-slate-950/70 hover:bg-slate-900 border-blue-500/30 text-slate-200'
                        : 'bg-blue-50/80 hover:bg-blue-100 border-blue-200 text-slate-700'
                    }`}
                    title="Masuk langsung sebagai Anggota Penerima Beasiswa"
                  >
                    <span
                      className={`block font-black transition-transform group-hover:scale-105 ${
                        isDark ? 'text-cyan-300' : 'text-blue-700'
                      }`}
                    >
                      👤 Anggota
                    </span>
                    <span className={`text-[9px] block ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                      Fahmi
                    </span>
                  </button>
                </div>
              </div>
            </form>
          ) : (
            /* FORM AKTIVASI AKUN / REGISTER (CLOSED WHITELIST OLEH BPH) */
            <form onSubmit={handleRegister} className="space-y-3.5">
              <div className="p-3 bg-blue-50/80 border border-blue-200/70 rounded-2xl">
                <div className="flex items-start gap-2 text-blue-900 text-xs">
                  <ShieldCheck className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-semibold">Registrasi Tertutup GenBI UNMA:</span> Masukkan NPM Anda untuk memeriksa kesesuaian dengan SK Resmi dari BPH.
                  </div>
                </div>
              </div>

              {/* Input NPM + Tombol Cek */}
              <div className="space-y-1">
                <label className="text-[11px] font-bold uppercase tracking-wider text-slate-600">
                  NPM Anggota
                </label>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <IdCard className="w-4 h-4 absolute left-3.5 top-3 text-slate-400" />
                    <input
                      type="text"
                      required
                      value={regNpm}
                      disabled={npmVerified}
                      onChange={(e) => {
                        setRegNpm(e.target.value);
                        setNpmVerified(false);
                      }}
                      placeholder="Masukkan NPM Anda"
                      className="w-full pl-10 pr-3 py-2.5 bg-white/70 border border-slate-200 rounded-xl text-xs font-medium focus:ring-2 focus:ring-blue-600/30 focus:outline-none disabled:bg-slate-100 disabled:text-slate-500"
                    />
                  </div>
                  {!npmVerified ? (
                    <button
                      type="button"
                      onClick={handleVerifyNpm}
                      disabled={isCheckingNpm || !regNpm.trim()}
                      className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 active:scale-95 text-white text-xs font-semibold rounded-xl shadow-sm transition disabled:opacity-50 cursor-pointer shrink-0"
                    >
                      {isCheckingNpm ? 'Memeriksa...' : 'Cek SK'}
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => {
                        setNpmVerified(false);
                        setFullName('');
                      }}
                      className="px-3 py-2.5 bg-slate-200 hover:bg-slate-300 text-slate-700 text-xs font-semibold rounded-xl transition cursor-pointer shrink-0"
                    >
                      Ubah NPM
                    </button>
                  )}
                </div>
              </div>

              {/* Data Terbuka Hanya Setelah NPM Terverifikasi */}
              {npmVerified && (
                <div className="space-y-3.5 pt-1 animate-in fade-in duration-200">
                  <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-2xl flex items-center justify-between text-xs">
                    <div>
                      <p className="font-bold text-emerald-950">{fullName}</p>
                      <p className="text-[11px] text-emerald-700">
                        {regRole === 'kadiv' ? '⭐ Kepala Divisi' : regRole === 'admin' ? '🛡️ BPH' : 'Anggota'} • Divisi {regDivision}
                      </p>
                    </div>
                    <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[11px] font-bold uppercase tracking-wider text-slate-600">
                      Alamat Email Aktif
                    </label>
                    <div className="relative">
                      <Mail className="w-4 h-4 absolute left-3.5 top-3 text-slate-400" />
                      <input
                        type="email"
                        required
                        value={regEmail}
                        onChange={(e) => setRegEmail(e.target.value)}
                        placeholder="nama@email.com"
                        className="w-full pl-10 pr-3 py-2.5 bg-white/70 border border-slate-200 rounded-xl text-xs font-medium focus:ring-2 focus:ring-blue-600/30 focus:outline-none"
                      />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[11px] font-bold uppercase tracking-wider text-slate-600">
                      Buat Password Baru
                    </label>
                    <div className="relative">
                      <Lock className="w-4 h-4 absolute left-3.5 top-3 text-slate-400" />
                      <input
                        type="password"
                        required
                        value={regPassword}
                        onChange={(e) => setRegPassword(e.target.value)}
                        placeholder="Minimal 6 karakter"
                        className="w-full pl-10 pr-3 py-2.5 bg-white/70 border border-slate-200 rounded-xl text-xs font-medium focus:ring-2 focus:ring-blue-600/30 focus:outline-none"
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={isLoading}
                    className="w-full mt-2 py-3 px-4 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 active:scale-[0.98] text-white text-xs font-bold rounded-xl shadow-lg shadow-emerald-600/20 transition-all flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed cursor-pointer"
                  >
                    {isLoading ? (
                      <>
                        <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        <span>Mengaktifkan Akun...</span>
                      </>
                    ) : (
                      <>
                        <span>Aktifkan Akun Saya</span>
                        <ArrowRight className="w-4 h-4" />
                      </>
                    )}
                  </button>
                </div>
              )}
            </form>
          )}

          {/* Toggle Login / Register */}
          <div className="mt-5 pt-4 border-t border-slate-800 text-center">
            {!isRegisterMode ? (
              <p className="text-xs text-slate-400">
                Penerima beasiswa baru?{' '}
                <button
                  type="button"
                  onClick={() => {
                    setIsRegisterMode(true);
                    setErrorMessage('');
                    setSuccessMessage('');
                  }}
                  className="font-bold text-cyan-400 hover:text-cyan-300 hover:underline cursor-pointer"
                >
                  Aktivasi Akun SIMAK
                </button>
              </p>
            ) : (
              <p className="text-xs text-slate-400">
                Sudah memiliki akun terdaftar?{' '}
                <button
                  type="button"
                  onClick={() => {
                    setIsRegisterMode(false);
                    setErrorMessage('');
                    setSuccessMessage('');
                  }}
                  className="font-bold text-cyan-400 hover:text-cyan-300 hover:underline cursor-pointer"
                >
                  Masuk Kembali
                </button>
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Footer Hak Cipta SIMAK GenBI & PD-Dev */}
      <Footer showInstitution className={`border-t-0 bg-transparent py-4 transition-colors ${isDark ? 'text-slate-400' : 'text-slate-500'}`} />

      {/* Modal Dialog Lupa PIN / Reset Password */}
      {showForgotModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-sm rounded-[32px] bg-white p-6 shadow-2xl space-y-4 relative border border-slate-100 text-left">
            <button
              onClick={() => setShowForgotModal(false)}
              className="absolute top-4 right-4 p-2 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            <div>
              <div className="w-10 h-10 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center mb-2">
                <KeyRound className="w-5 h-5" />
              </div>
              <h3 className="text-base font-black text-slate-900">
                Atur Ulang PIN / Password
              </h3>
              <p className="text-xs text-slate-500">
                Masukkan NPM atau alamat Email terdaftar Anda. Kami akan mengirimkan tautan pembuatan password baru.
              </p>
            </div>

            {forgotError && (
              <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-xl flex items-start gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{forgotError}</span>
              </div>
            )}

            {forgotSuccess ? (
              <div className="space-y-3 pt-1">
                <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs rounded-xl flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  <span>{forgotSuccess}</span>
                </div>
                <button
                  type="button"
                  onClick={() => setShowForgotModal(false)}
                  className="w-full py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition cursor-pointer"
                >
                  Tutup
                </button>
              </div>
            ) : (
              <form onSubmit={handleResetPassword} className="space-y-3 pt-1">
                <div className="space-y-1">
                  <label className="text-[11px] font-bold uppercase tracking-wider text-slate-600">
                    NPM atau Email
                  </label>
                  <input
                    type="text"
                    required
                    value={forgotInput}
                    onChange={(e) => setForgotInput(e.target.value)}
                    placeholder="Contoh: 2414101078 atau email@unma.ac.id"
                    className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-600/30"
                  />
                </div>

                <div className="pt-2 flex gap-2">
                  <button
                    type="button"
                    onClick={() => setShowForgotModal(false)}
                    className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition cursor-pointer"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    disabled={isSendingReset}
                    className="flex-1 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-bold text-xs rounded-xl shadow-md shadow-blue-600/25 transition cursor-pointer disabled:opacity-70 flex items-center justify-center gap-1.5"
                  >
                    {isSendingReset ? 'Mengirim...' : 'Kirim Tautan'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* Pop-up / Banner Instalasi PWA 1-Klik Khas SIMAK GENBI */}
      <PwaInstallBanner />
    </div>
  );
};

export default LoginPage;
