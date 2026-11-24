import { useState, useEffect } from 'react';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import AdminDashboardPage from './pages/AdminDashboardPage';
import { SuperAdminPage } from './pages/SuperAdminPage';
import { DocumentVerificationView } from './components/DocumentVerificationView';
import { SatelliteLoader } from './components/SatelliteLoader';
import { PwaInstallBanner } from './components/PwaInstallBanner';
import { supabase } from './lib/supabase';
import { purgeSuperAdminFromCache, sanitizeMemberIdentity } from './lib/attendanceSync';

interface UserSession {
  id: string;
  npm: string;
  nim?: string;
  fullName: string;
  division: string;
  role: 'superadmin' | 'admin' | 'kadiv' | 'member';
}

export function App() {
  const [user, setUser] = useState<UserSession | null>(() => {
    // Restore session langsung dari localStorage agar saat refresh (F5) tidak hilang
    try {
      const saved = localStorage.getItem('simak_user_session');
      if (saved) {
        const parsed = sanitizeMemberIdentity(JSON.parse(saved));
        const cleanId = parsed.npm || parsed.nim;
        if (cleanId) {
          try {
            const rawWl = localStorage.getItem('simak_whitelist_overrides');
            if (rawWl) {
              const wl = JSON.parse(rawWl);
              const ov = wl[cleanId];
              if (ov?.full_name) parsed.fullName = ov.full_name;
              if (ov?.division) parsed.division = ov.division;
              if (ov?.role) parsed.role = ov.role;
            }
          } catch {}
        }
        return {
          ...parsed,
          npm: parsed.npm || parsed.nim || '-',
          nim: parsed.npm || parsed.nim || '-',
        };
      }
    } catch {}
    return null;
  });

  const [isInitializing, setIsInitializing] = useState(true);
  const [adminViewMode, setAdminViewMode] = useState<'admin' | 'member'>('admin');
  const [isVerifyingDoc, setIsVerifyingDoc] = useState(() => {
    return typeof window !== 'undefined' && window.location.search.includes('verify=doc');
  });

  // Cek dan sinkronkan sesi autentikasi Supabase saat aplikasi dibuka
  useEffect(() => {
    purgeSuperAdminFromCache();
    const checkSession = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user) {
          const { data: profileData } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', session.user.id)
            .single();

          const profile = profileData as any;

          if (profile) {
            const activeUser: UserSession = sanitizeMemberIdentity({
              id: profile.id,
              npm: profile.npm || profile.nim || session.user.user_metadata?.npm || session.user.user_metadata?.nim || '-',
              nim: profile.npm || profile.nim || '-',
              fullName: profile.full_name,
              division: profile.division,
              role: profile.role,
            });
            setUser(activeUser);
            localStorage.setItem('simak_user_session', JSON.stringify(activeUser));
          } else {
            const fallbackUser: UserSession = sanitizeMemberIdentity({
              id: session.user.id,
              npm: session.user.user_metadata?.npm || session.user.user_metadata?.nim || '-',
              nim: session.user.user_metadata?.npm || session.user.user_metadata?.nim || '-',
              fullName: session.user.user_metadata?.full_name || 'Anggota GenBI',
              division: session.user.user_metadata?.division || 'Publikasi dan Sosialisasi',
              role: session.user.user_metadata?.role || 'member',
            });
            setUser(fallbackUser);
            localStorage.setItem('simak_user_session', JSON.stringify(fallbackUser));
          }
        }
      } catch {
        // Pertahankan user dari localStorage jika offline
      } finally {
        setIsInitializing(false);
      }
    };

    checkSession();

    // Listener perubahan state auth
    const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session && !localStorage.getItem('simak_user_session')) {
        setUser(null);
      }
    });

    // Listener pembaruan data member secara realtime lintas perangkat (Desktop & Mobile)
    const handleMemberSync = (e: any) => {
      const detail = e?.detail;
      if (!detail) return;
      setUser((prev) => {
        if (!prev) return null;
        const myNpm = prev.npm || prev.nim;
        if (detail.npm === 'ALL_SYNC') {
          try {
            const raw = localStorage.getItem('simak_user_session');
            if (raw) return JSON.parse(raw);
          } catch {}
          return prev;
        }
        if (detail.npm === myNpm || detail.nim === myNpm) {
          const updated: UserSession = {
            ...prev,
            fullName: detail.full_name || detail.fullName || prev.fullName,
            division: detail.division || prev.division,
            role: detail.role || prev.role,
          };
          localStorage.setItem('simak_user_session', JSON.stringify(updated));
          return updated;
        }
        return prev;
      });
    };
    window.addEventListener('simak_member_sync', handleMemberSync);

    return () => {
      authListener.subscription.unsubscribe();
      window.removeEventListener('simak_member_sync', handleMemberSync);
    };
  }, []);

  const handleLoginSuccess = (userProfile: UserSession) => {
    const normalized: UserSession = sanitizeMemberIdentity({
      ...userProfile,
      npm: userProfile.npm || userProfile.nim || '-',
      nim: userProfile.npm || userProfile.nim || '-',
    });
    setUser(normalized);
    localStorage.setItem('simak_user_session', JSON.stringify(normalized));
  };

  const handleLogout = async () => {
    try {
      await supabase.auth.signOut();
    } catch {
      // Ignored
    }
    localStorage.removeItem('simak_user_session');
    setUser(null);
  };

  if (isInitializing) {
    return (
      <SatelliteLoader
        fullScreen
        message="MEMUAT SIMAK GENBI"
        subMessage="Komisariat Universitas Majalengka • KPw BI Cirebon"
      />
    );
  }

  if (isVerifyingDoc) {
    return (
      <DocumentVerificationView
        onGoToLogin={() => {
          window.history.replaceState({}, '', window.location.pathname);
          setIsVerifyingDoc(false);
        }}
      />
    );
  }

  if (!user) {
    return <LoginPage onLoginSuccess={handleLoginSuccess} />;
  }

  return (
    <>
      {user.role === 'superadmin' ? (
        <SuperAdminPage onLogout={handleLogout} />
      ) : user.role === 'admin' ? (
        adminViewMode === 'member' ? (
          <DashboardPage
            user={user}
            onLogout={handleLogout}
            onSwitchToAdminView={() => setAdminViewMode('admin')}
          />
        ) : (
          <AdminDashboardPage
            user={user}
            onLogout={handleLogout}
            onSwitchToMemberView={() => setAdminViewMode('member')}
          />
        )
      ) : (
        <DashboardPage user={user} onLogout={handleLogout} />
      )}
      <PwaInstallBanner />
    </>
  );
}

export default App;
