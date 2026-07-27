import React, { useState, useEffect } from 'react';
import { AuthProvider } from './contexts/AuthContext';
import { ThemeProvider } from './contexts/ThemeContext';
import { useAuth } from './hooks/useAuth';
import { initTelegramApp, getTelegramWebApp } from './telegram/webapp';
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
import { AppLayout } from './layouts/AppLayout';
import { TabType } from './components/navigation/BottomNav';
import { GlassCard } from './components/common/GlassCard';
import { ShieldAlert, LogOut } from 'lucide-react';
import { SafeArea } from 'capacitor-plugin-safe-area';
import { StatusBar } from '@capacitor/status-bar';
import { Capacitor } from '@capacitor/core';
import { usePushNotifications } from './hooks/usePushNotifications';

const ViewportUpdater: React.FC = () => {
  useEffect(() => {
    // Specifically handle Capacitor APK Status Bar and Safe Area
    const initCapacitor = async () => {
      if (Capacitor.isNativePlatform()) {
        try {
          // Make sure status bar doesn't get covered by content by applying proper padding
          await StatusBar.setOverlaysWebView({ overlay: true });
          await StatusBar.show();
          
          // Helper to apply the inset
          const applyTopInset = (val: number) => {
            if (val > 0) {
              document.documentElement.style.setProperty('--tg-safe-area-inset-top', `${val}px`);
              document.documentElement.style.setProperty('--css-safe-area-inset-top', `${val}px`);
              // dispatch event to force update
              window.dispatchEvent(new CustomEvent('tg-safe-area-updated'));
            }
          };

          // Get the exact safe area insets (to detect status bar distance)
          const safeAreaData = await SafeArea.getSafeAreaInsets();
          let topInset = safeAreaData.insets.top;
          let bottomInset = safeAreaData.insets.bottom;

          // Set immersive navigation bar if on Android
          // if (Capacitor.getPlatform() === 'android') {
          //   SafeArea.setImmersiveNavigationBar?.();
          // }

          // Fallback to getStatusBarHeight if topInset is 0
          if (topInset === 0) {
            const { statusBarHeight } = await SafeArea.getStatusBarHeight();
            if (statusBarHeight > 0) {
              // Convert to CSS pixels if it seems abnormally large (physical pixels)
              // Typical status bar is ~24-50dp. If it's > 60, it might be physical pixels.
              topInset = (statusBarHeight > 60 && window.devicePixelRatio > 1) 
                ? statusBarHeight / window.devicePixelRatio 
                : statusBarHeight;
            }
          }
          
          applyTopInset(topInset);

          if (bottomInset > 0) {
            document.documentElement.style.setProperty('--tg-safe-area-inset-bottom', `${bottomInset}px`);
            document.documentElement.style.setProperty('--css-safe-area-inset-bottom', `${bottomInset}px`);
          }

          SafeArea.addListener('safeAreaChanged', (data) => {
            const newTop = data.insets.top;
            if (newTop > 0) {
              applyTopInset(newTop);
            }
            if (data.insets.bottom > 0) {
              document.documentElement.style.setProperty('--tg-safe-area-inset-bottom', `${data.insets.bottom}px`);
              document.documentElement.style.setProperty('--css-safe-area-inset-bottom', `${data.insets.bottom}px`);
            }
          });
        } catch (e) {
          console.warn('Capacitor safe area plugin not available or error:', e);
        }
      }
    };
    
    initCapacitor();

    const updateSafeAreas = (eventType = 'App Init') => {
      if (typeof window === 'undefined') return;
      const webApp = getTelegramWebApp();
      const isNativeCapacitor = Capacitor.isNativePlatform();
      
      const prevTop = document.documentElement.style.getPropertyValue('--tg-safe-area-inset-top') || '0px';
      
      let top = 0;
      let bottom = 0;
      let left = 0;
      let right = 0;
      
      let mode = 'Browser';

      // 1. Strict Priority: If running inside Telegram, we prioritize contentSafeAreaInset, then safeAreaInset.
      if (webApp && !isNativeCapacitor) {
        mode = 'Telegram App';
        if (webApp.contentSafeAreaInset) {
          top = webApp.contentSafeAreaInset.top || 0;
          bottom = webApp.contentSafeAreaInset.bottom || 0;
          left = webApp.contentSafeAreaInset.left || 0;
          right = webApp.contentSafeAreaInset.right || 0;
        } else if (webApp.safeAreaInset) {
          top = webApp.safeAreaInset.top || 0;
          bottom = webApp.safeAreaInset.bottom || 0;
          left = webApp.safeAreaInset.left || 0;
          right = webApp.safeAreaInset.right || 0;
        }
      } else if (!isNativeCapacitor) {
        // Outside Telegram (Browser/PWA), we fallback to other platform safe area methods
        const cssTopVal = document.documentElement.style.getPropertyValue('--css-safe-area-inset-top');
        const parsedCssTop = parseFloat(cssTopVal) || 0;
        
        const cssBottomVal = document.documentElement.style.getPropertyValue('--css-safe-area-inset-bottom');
        const parsedCssBottom = parseFloat(cssBottomVal) || 0;
        
        top = parsedCssTop;
        bottom = parsedCssBottom;

        if (top === 0 && window.visualViewport) {
          if (window.visualViewport.offsetTop > 0) {
            top = window.visualViewport.offsetTop;
          }
        }
      }

      // If Capacitor, it sets its own variables natively, so we only update viewport height
      if (!isNativeCapacitor) {
        const currentTop = `${top}px`;

        // Set the standard CSS variables on the root document
        document.documentElement.style.setProperty('--tg-safe-area-inset-top', currentTop);
        document.documentElement.style.setProperty('--tg-safe-area-inset-bottom', `${bottom}px`);
        document.documentElement.style.setProperty('--tg-safe-area-inset-left', `${left}px`);
        document.documentElement.style.setProperty('--tg-safe-area-inset-right', `${right}px`);
      }
      
      let vh = `${window.innerHeight}px`;
      if (webApp && webApp.viewportStableHeight > 0) {
        vh = `${webApp.viewportStableHeight}px`;
      } else if (webApp && webApp.viewportHeight > 0) {
        vh = `${webApp.viewportHeight}px`;
      }
      document.documentElement.style.setProperty('--tg-viewport-height', vh);
      
      // Dispatch custom event to notify Header and other active observers immediately
      const event = new CustomEvent('tg-safe-area-updated', { 
        detail: {
          eventType,
          prevTop,
          currentTop: document.documentElement.style.getPropertyValue('--tg-safe-area-inset-top'),
          appliedTop: document.documentElement.style.getPropertyValue('--tg-safe-area-inset-top'),
          mode
        } 
      });
      window.dispatchEvent(event);
    };

    // Run immediately on mount
    updateSafeAreas('App Init');

    const webApp = getTelegramWebApp();
    
    const handleSafeAreaChanged = () => updateSafeAreas('safeAreaChanged / contentSafeAreaChanged');
    const handleViewportChanged = () => updateSafeAreas('viewportChanged');
    const handleResize = () => updateSafeAreas('window.resize');
    const handleOrientationChange = () => updateSafeAreas('window.orientationchange');

    if (webApp) {
      try {
        webApp.onEvent('safeAreaChanged', handleSafeAreaChanged);
        webApp.onEvent('contentSafeAreaChanged', handleSafeAreaChanged);
        webApp.onEvent('viewportChanged', handleViewportChanged);
      } catch (e) {
        console.error('Error binding Telegram events:', e);
      }
    }

    window.addEventListener('resize', handleResize);
    window.addEventListener('orientationchange', handleOrientationChange);

    return () => {
      if (webApp) {
        try {
          webApp.offEvent('safeAreaChanged', handleSafeAreaChanged);
          webApp.offEvent('contentSafeAreaChanged', handleSafeAreaChanged);
          webApp.offEvent('viewportChanged', handleViewportChanged);
        } catch (e) {
          // Ignore
        }
      }
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('orientationchange', handleOrientationChange);
    };
  }, []);

  return null; // This component doesn't render anything
};

const AppContent: React.FC = () => {
  const { isLoading, isAuthenticated, isTelegramContext, userProfile, logout } = useAuth();
  const [activeTab, setActiveTab] = useState<TabType>('beranda');

  // Initialize push notifications
  usePushNotifications(isAuthenticated);

  useEffect(() => {
    initTelegramApp();

    // Check for low-end device
    if (typeof navigator !== 'undefined') {
      const memory = (navigator as any).deviceMemory;
      const cores = navigator.hardwareConcurrency;
      if ((memory && memory < 4) || (cores && cores < 4)) {
        document.body.classList.add('low-end');
      }
    }
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
          color: 'var(--tg-text-color, #f8fafc)',
          minHeight: 'var(--tg-viewport-height)'
        }}
        className="flex flex-col items-center justify-center p-4 text-center transition-colors duration-300 bg-mesh-gradient overflow-x-hidden"
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
    <AppLayout activeTab={activeTab} setActiveTab={setActiveTab}>
      {renderTabContent()}
    </AppLayout>
  );
};

export default function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider>
        <AuthProvider>
          <ViewportUpdater />
          <AppContent />
        </AuthProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}
