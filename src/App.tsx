import { useState, useEffect } from 'react';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import AdminDashboardPage from './pages/AdminDashboardPage';
import { SuperAdminPage } from './pages/SuperAdminPage';
import { DocumentVerificationView } from './components/DocumentVerificationView';
import { SatelliteLoader } from './components/SatelliteLoader';
import { supabase } from './lib/supabase';
import { purgeSuperAdminFromCache } from './lib/attendanceSync';

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
        const parsed = JSON.parse(saved);
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
            const activeUser: UserSession = {
              id: profile.id,
              npm: profile.npm || profile.nim || session.user.user_metadata?.npm || session.user.user_metadata?.nim || '-',
              nim: profile.npm || profile.nim || '-',
              fullName: profile.full_name,
              division: profile.division,
              role: profile.role,
            };
            setUser(activeUser);
            localStorage.setItem('simak_user_session', JSON.stringify(activeUser));
          } else {
            const fallbackUser: UserSession = {
              id: session.user.id,
              npm: session.user.user_metadata?.npm || session.user.user_metadata?.nim || '-',
              nim: session.user.user_metadata?.npm || session.user.user_metadata?.nim || '-',
              fullName: session.user.user_metadata?.full_name || 'Anggota GenBI',
              division: session.user.user_metadata?.division || 'Publikasi dan Sosialisasi',
              role: session.user.user_metadata?.role || 'member',
            };
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

    return () => {
      authListener.subscription.unsubscribe();
    };
  }, []);

  const handleLoginSuccess = (userProfile: UserSession) => {
    const normalized: UserSession = {
      ...userProfile,
      npm: userProfile.npm || userProfile.nim || '-',
      nim: userProfile.npm || userProfile.nim || '-',
    };
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

  // JIKA SUPER ADMIN (HAK AKSES PENUH PENGEMBANG / MASTER DEV)
  // Panel terpisah khusus developer dengan kontrol penuh sistem
  if (user.role === 'superadmin') {
    return <SuperAdminPage onLogout={handleLogout} />;
  }

  // Jika admin -> arahkan ke AdminDashboardPage atau tampilan Anggota jika sedang di-switch
  if (user.role === 'admin') {
    if (adminViewMode === 'member') {
      return (
        <DashboardPage
          user={user}
          onLogout={handleLogout}
          onSwitchToAdminView={() => setAdminViewMode('admin')}
        />
      );
    }
    return (
      <AdminDashboardPage
        user={user}
        onLogout={handleLogout}
        onSwitchToMemberView={() => setAdminViewMode('member')}
      />
    );
  }

  // Jika member atau kadiv -> Dashboard Anggota
  return <DashboardPage user={user} onLogout={handleLogout} />;
}

export default App;
