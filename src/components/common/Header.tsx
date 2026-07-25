import React, { useState, useEffect } from 'react';
import { AzurLizeLogo } from '../logo/AzurLizeLogo';
import { StatusBadge } from './StatusBadge';
import { useAuth } from '../../hooks/useAuth';
import { NotificationDrawer } from './NotificationDrawer';
import { Bell } from 'lucide-react';
import { subscribeToNotifications } from '../../firebase/services/notificationService';
import { isTelegramEnvironment, isStandaloneApp } from '../../telegram/webapp';

interface HeaderProps {
  title?: string;
  showUserBadge?: boolean;
}

export const Header: React.FC<HeaderProps> = ({ title, showUserBadge = true }) => {
  const { userProfile, telegramUser } = useAuth();
  const [isNotifOpen, setIsNotifOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isTelegramBotMode, setIsTelegramBotMode] = useState(false);
  const [safeAreaTop, setSafeAreaTop] = useState('0px');

  const userTelegramId = userProfile?.telegramId || (telegramUser?.id ? String(telegramUser.id) : '');
  const userRole = userProfile?.role || 'Recruiter';

  useEffect(() => {
    // Initial read directly from CSS variables
    const initialVal = typeof window !== 'undefined' ? (document.documentElement.style.getPropertyValue('--tg-safe-area-inset-top') || '0px') : '0px';
    setSafeAreaTop(initialVal);

    const handleSafeAreaUpdate = (e: Event) => {
      const customEvent = e as CustomEvent;
      const { eventType, prevTop, currentTop, appliedTop } = customEvent.detail || {};
      
      const latestVal = document.documentElement.style.getPropertyValue('--tg-safe-area-inset-top') || '0px';
      setSafeAreaTop(latestVal);
      
      console.log(`\n[Header Re-render Lifecycle Trace]`);
      console.log(`  Event: ${eventType}`);
      console.log(`  Previous Top: ${prevTop}`);
      console.log(`  Current Top: ${currentTop}`);
      console.log(`  Applied CSS Variable: ${appliedTop}`);
      console.log(`  Header state updated directly from CSS Variable to: ${latestVal}`);
    };

    window.addEventListener('tg-safe-area-updated', handleSafeAreaUpdate);
    return () => {
      window.removeEventListener('tg-safe-area-updated', handleSafeAreaUpdate);
    };
  }, []);

  useEffect(() => {
    // Detect if running inside Telegram Mini App vs Standalone PWA / Web Browser
    const checkMode = () => {
      const inTelegram = isTelegramEnvironment();
      const standalone = isStandaloneApp();
      // If inside Telegram WebApp and NOT standalone home screen shortcut
      setIsTelegramBotMode(inTelegram && !standalone);
    };

    checkMode();
    window.addEventListener('resize', checkMode);
    return () => window.removeEventListener('resize', checkMode);
  }, []);

  useEffect(() => {
    if (!userTelegramId) return;

    const unsubscribe = subscribeToNotifications(
      userTelegramId,
      userRole,
      (notifs) => {
        const unread = notifs.filter(
          (n) => !n.readBy || !n.readBy.includes(userTelegramId)
        ).length;
        setUnreadCount(unread);
      }
    );

    return () => unsubscribe();
  }, [userTelegramId, userRole]);

  return (
    <>
      <header 
        style={{
          backgroundColor: 'var(--tg-header-bg-color, var(--tg-bg-color, #030712))',
          borderColor: 'var(--tg-secondary-bg-color, rgba(255, 255, 255, 0.1))',
          paddingTop: `calc(${safeAreaTop} + 12px)`,
          paddingBottom: '12px',
          top: 0
        }}
        className="sticky z-40 w-full backdrop-blur-xl border-b px-4 md:px-8 transition-colors duration-300"
      >
        <div className="w-full max-w-7xl mx-auto flex items-center justify-between gap-3">

          {title ? (
            <div className="flex items-center gap-3">
              <AzurLizeLogo size="sm" showText={false} />
              <h1 className="text-lg font-bold text-slate-800 dark:text-white tracking-tight">{title}</h1>
            </div>
          ) : (
            <AzurLizeLogo size="sm" />
          )}

          <div className="flex items-center gap-2">
            {/* Notification Bell Button */}
            {userTelegramId && (
              <button
                type="button"
                onClick={() => setIsNotifOpen(true)}
                className="relative p-2.5 rounded-2xl bg-slate-900/90 border border-amber-500/20 text-slate-300 hover:text-amber-400 hover:border-amber-500/40 cursor-pointer transition-all shadow-md active:scale-95"
                title="Notifikasi"
              >
                <Bell className="w-5 h-5" />
                {unreadCount > 0 && (
                  <span className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-amber-500 text-[10px] font-black text-slate-950 shadow-sm animate-pulse">
                    {unreadCount > 99 ? '99+' : unreadCount}
                  </span>
                )}
              </button>
            )}

            {showUserBadge && (userProfile || telegramUser) && (
              <div className="relative shrink-0">
                {telegramUser?.photo_url ? (
                  <img
                    src={telegramUser.photo_url}
                    alt="Avatar"
                    className="w-8 h-8 rounded-2xl object-cover border border-sky-400/50 shadow-md shadow-sky-500/20"
                  />
                ) : (
                  <div className="w-8 h-8 rounded-2xl bg-gradient-to-tr from-sky-500 via-blue-600 to-indigo-600 flex items-center justify-center text-white font-black text-xs border border-white/20 shadow-md shadow-sky-500/20">
                    {(userProfile?.firstName?.[0] || telegramUser?.first_name?.[0] || 'A').toUpperCase()}
                  </div>
                )}
                <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-emerald-500 rounded-full border-2 border-[var(--tg-bg-color,#030712)]" />
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Notification Drawer Modal */}
      {userTelegramId && (
        <NotificationDrawer
          isOpen={isNotifOpen}
          onClose={() => setIsNotifOpen(false)}
          userTelegramId={userTelegramId}
          userRole={userRole}
          onUnreadCountChange={setUnreadCount}
        />
      )}
    </>
  );
};

