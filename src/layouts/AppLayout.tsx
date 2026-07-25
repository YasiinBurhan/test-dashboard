import React, { useEffect } from 'react';
import { Header } from '../components/common/Header';
import { BottomNav, TabType } from '../components/navigation/BottomNav';
import { getTelegramWebApp } from '../telegram/webapp';

interface AppLayoutProps {
  children: React.ReactNode;
  activeTab: TabType;
  setActiveTab: (tab: TabType) => void;
  title?: string;
}

export const AppLayout: React.FC<AppLayoutProps> = ({
  children,
  activeTab,
  setActiveTab,
  title
}) => {
  useEffect(() => {
    const updateSafeAreas = () => {
      if (typeof window === 'undefined') return;
      const webApp = getTelegramWebApp();
      
      let top = 0;
      let bottom = 0;
      let left = 0;
      let right = 0;

      // 1. Priority 1: Telegram WebApp safeAreaInset
      if (webApp && webApp.safeAreaInset) {
        top = webApp.safeAreaInset.top || 0;
        bottom = webApp.safeAreaInset.bottom || 0;
        left = webApp.safeAreaInset.left || 0;
        right = webApp.safeAreaInset.right || 0;
      }

      // 2. Priority 2: CSS env(safe-area-inset-*) as fallback
      if (top === 0) {
        const cssTopVal = getComputedStyle(document.documentElement).getPropertyValue('--css-safe-area-inset-top');
        const parsedCssTop = parseFloat(cssTopVal) || 0;
        if (parsedCssTop > 0) {
          top = parsedCssTop;
        }
      }
      if (bottom === 0) {
        const cssBottomVal = getComputedStyle(document.documentElement).getPropertyValue('--css-safe-area-inset-bottom');
        const parsedCssBottom = parseFloat(cssBottomVal) || 0;
        if (parsedCssBottom > 0) {
          bottom = parsedCssBottom;
        }
      }

      // 3. Priority 3: VisualViewport API fallback
      if (top === 0 && window.visualViewport) {
        const viewportDiff = window.innerHeight - window.visualViewport.height;
        if (viewportDiff > 20 && viewportDiff < 120) {
          top = viewportDiff;
        }
      }

      // 4. Priority 4: Typical status bar fallback for standalone PWA / Telegram WebApp
      if (top === 0) {
        const isTg = !!(window as any).Telegram?.WebApp;
        const isStandalone = window.matchMedia('(display-mode: standalone)').matches || (window.navigator as any).standalone;
        if (isTg || isStandalone) {
          const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
          top = isIOS ? 44 : 24;
        }
      }

      document.documentElement.style.setProperty('--tg-safe-area-inset-top', `${top}px`);
      document.documentElement.style.setProperty('--tg-safe-area-inset-bottom', `${bottom}px`);
      document.documentElement.style.setProperty('--tg-safe-area-inset-left', `${left}px`);
      document.documentElement.style.setProperty('--tg-safe-area-inset-right', `${right}px`);
    };

    // Run immediately on mount
    updateSafeAreas();

    const webApp = getTelegramWebApp();
    if (webApp) {
      try {
        webApp.onEvent('safeAreaChanged', updateSafeAreas);
        webApp.onEvent('viewportChanged', updateSafeAreas);
      } catch (e) {
        console.error('Error binding Telegram events:', e);
      }
    }

    window.addEventListener('resize', updateSafeAreas);
    window.addEventListener('orientationchange', updateSafeAreas);

    return () => {
      if (webApp) {
        try {
          webApp.offEvent('safeAreaChanged', updateSafeAreas);
          webApp.offEvent('viewportChanged', updateSafeAreas);
        } catch (e) {
          // Ignore
        }
      }
      window.removeEventListener('resize', updateSafeAreas);
      window.removeEventListener('orientationchange', updateSafeAreas);
    };
  }, []);

  return (
    <div
      style={{
        backgroundColor: 'var(--tg-bg-color, #030712)',
        color: 'var(--tg-text-color, #f8fafc)'
      }}
      className="min-h-screen flex flex-col font-sans transition-colors duration-300 relative select-none bg-mesh-gradient overflow-x-hidden"
    >
      {/* Background ambient lighting */}
      <div className="fixed top-0 left-1/2 -translate-x-1/2 w-full max-w-lg md:max-w-2xl h-96 bg-sky-600/10 rounded-full blur-3xl pointer-events-none -z-10" />
      <div className="fixed bottom-0 right-0 w-80 h-80 bg-indigo-600/10 rounded-full blur-3xl pointer-events-none -z-10" />

      <Header title={title} />

      <main className="flex-1 w-full max-w-7xl mx-auto p-4 md:p-6 pt-3 space-y-4 md:space-y-6">
        {children}
      </main>

      <BottomNav activeTab={activeTab} setActiveTab={setActiveTab} />
    </div>
  );
};
