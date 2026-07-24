import React, { useState, useEffect } from 'react';
import { AuthProvider } from './contexts/AuthContext';
import { ThemeProvider } from './contexts/ThemeContext';
import { useAuth } from './hooks/useAuth';
import { initTelegramApp } from './telegram/webapp';
import { ErrorBoundary } from './components/common/ErrorBoundary';
import { SplashPage } from './pages/SplashPage';
import { BrowserNoticePage } from './pages/BrowserNoticePage';
import { LoginPage } from './pages/LoginPage';
import { PendingPage } from './pages/PendingPage';
import { DashboardPage } from './pages/DashboardPage';
import { DataHarianPage } from './pages/DataHarianPage';
import { LaporanHarianPage } from './pages/LaporanHarianPage';
import { PengumumanPage } from './pages/PengumumanPage';
import { PostinganPage } from './pages/PostinganPage';
import { ProfilPage } from './pages/ProfilPage';
import { AdminPage } from './pages/AdminPage';
import { OwnerPage } from './pages/OwnerPage';
import { GajiPage } from './pages/GajiPage';
import { MainLayout } from './layouts/MainLayout';
import { TabType } from './components/navigation/BottomNav';
import { GlassCard } from './components/common/GlassCard';
import { ShieldAlert, LogOut } from 'lucide-react';

const AppContent: React.FC = () => {
  const { isLoading, isAuthenticated, isTelegramContext, userProfile, logout } = useAuth();
  const [activeTab, setActiveTab] = useState<TabType>('beranda');
  const [forceShowInstructions, setForceShowInstructions] = useState(false);

  useEffect(() => {
    initTelegramApp();
  }, []);

  if (isLoading) {
    return <SplashPage />;
  }

  // If opened in browser without Telegram WebApp context
  if (!isTelegramContext && !isAuthenticated) {
    return <BrowserNoticePage />;
  }

  // If user hasn't registered yet (no profile in Firestore)
  if (!userProfile) {
    return <LoginPage />;
  }

  // If status is Pending approval
  if (userProfile.status === 'Pending') {
    return <PendingPage />;
  }

  // If status is Rejected or Suspended
  if (userProfile.status === 'Rejected' || userProfile.status === 'Suspended') {
    return (
      <div
        style={{
          backgroundColor: 'var(--tg-bg-color, #030712)',
          color: 'var(--tg-text-color, #f8fafc)'
        }}
        className="min-h-screen flex flex-col items-center justify-center p-4 text-center transition-colors duration-300 bg-mesh-gradient overflow-x-hidden"
      >
        <GlassCard className="max-w-md w-full space-y-4 border-rose-500/40 p-6">
          <div className="w-16 h-16 rounded-full bg-rose-500/20 text-rose-500 dark:text-rose-400 flex items-center justify-center mx-auto text-3xl font-bold">
            <ShieldAlert className="w-8 h-8" />
          </div>

          <h2 className="text-xl font-extrabold text-white">
            Akun Anda {userProfile.status === 'Rejected' ? 'Ditolak' : 'Ditangguhkan (Suspended)'}
          </h2>

          <p className="text-xs text-slate-300 leading-relaxed">
            {userProfile.status === 'Rejected'
              ? 'Maaf, pendaftaran Anda sebagai tim rekrutmen AzurLizeTeam tidak dapat disetujui oleh Admin.'
              : 'Akun Anda saat ini ditangguhkan oleh Admin. Silakan hubungi Owner untuk bantuan lebih lanjut.'}
          </p>

          <button
            onClick={logout}
            className="w-full py-3 px-4 bg-slate-900 hover:bg-slate-800 text-slate-300 rounded-2xl border border-slate-800 font-semibold text-xs flex items-center justify-center gap-2 cursor-pointer transition-colors"
          >
            <LogOut className="w-4 h-4" /> Keluar Sesi
          </button>
        </GlassCard>
      </div>
    );
  }

  // Status is Active: render Main App Dashboard and tabs
  const renderTabContent = () => {
    switch (activeTab) {
      case 'beranda':
        return <DashboardPage setActiveTab={setActiveTab} />;
      case 'postingan':
        return <PostinganPage />;
      case 'data_harian':
        return <DataHarianPage />;
      case 'laporan':
        return <LaporanHarianPage />;
      case 'gaji':
        return <GajiPage />;
      case 'pengumuman':
        return <PengumumanPage />;
      case 'profil':
        return <ProfilPage />;
      case 'admin':
        return <AdminPage />;
      case 'owner':
        return <OwnerPage />;
      default:
        return <DashboardPage setActiveTab={setActiveTab} />;
    }
  };

  return (
    <MainLayout activeTab={activeTab} setActiveTab={setActiveTab}>
      {renderTabContent()}
    </MainLayout>
  );
};

export default function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider>
        <AuthProvider>
          <AppContent />
        </AuthProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}
