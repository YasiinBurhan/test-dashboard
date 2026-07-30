import React, { useState, useEffect, useRef } from 'react';
import { AzurLizeLogo } from '../logo/AzurLizeLogo';
import { StatusBadge } from './StatusBadge';
import { useAuth } from '../../hooks/useAuth';
import { NotificationDrawer } from './NotificationDrawer';
import { Bell, Sun, Moon, Menu } from 'lucide-react';
import { subscribeToNotifications } from '../../firebase/services/notificationService';
import { isTelegramEnvironment, isStandaloneApp } from '../../telegram/webapp';
import { TabType } from '../navigation/BottomNav';
import { useTheme } from '../../contexts/ThemeContext';

const playNotificationSound = () => {
  // Trigger Telegram WebApp haptic feedback if in Telegram
  try {
    const tg = (window as any).Telegram?.WebApp;
    if (tg?.HapticFeedback) {
      tg.HapticFeedback.notificationOccurred('success');
    } else if (navigator.vibrate) {
      // Standard mobile web vibration API fallback
      navigator.vibrate([100, 50, 100]);
    }
  } catch (e) {
    console.debug('Haptic feedback not supported:', e);
  }

  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();
    
    const playTone = (frequency: number, startTime: number, duration: number) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      
      osc.type = 'sine';
      osc.frequency.setValueAtTime(frequency, startTime);
      
      gain.gain.setValueAtTime(0.12, startTime);
      gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration);
      
      osc.connect(gain);
      gain.connect(ctx.destination);
      
      osc.start(startTime);
      osc.stop(startTime + duration);
    };

    const now = ctx.currentTime;
    // Elegant soft chime: C6 (1046.50Hz) then E6 (1318.51Hz) shortly after
    playTone(1046.50, now, 0.15);
    playTone(1318.51, now + 0.08, 0.25);
  } catch (err) {
    console.warn('Could not play notification sound:', err);
  }
};

interface HeaderProps {
  title?: string;
  showUserBadge?: boolean;
  setActiveTab?: (tab: TabType) => void;
  onMenuClick?: () => void;
}

export const Header: React.FC<HeaderProps> = ({ title, showUserBadge = true, setActiveTab, onMenuClick }) => {
  const { userProfile, telegramUser } = useAuth();
  const { colorScheme, toggleTheme } = useTheme();
  const [isNotifOpen, setIsNotifOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isTelegramBotMode, setIsTelegramBotMode] = useState(false);

  const userTelegramId = userProfile?.telegramId || (telegramUser?.id ? String(telegramUser.id) : '');
  const userRole = userProfile?.role || 'Recruiter';

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

  const lastUnreadRef = useRef<number | null>(null);

  useEffect(() => {
    if (!userTelegramId) return;

    const unsubscribe = subscribeToNotifications(
      userTelegramId,
      userRole,
      (notifs) => {
        const unread = notifs.filter(
          (n) => !n.readBy || !n.readBy.includes(userTelegramId)
        ).length;
        
        if (lastUnreadRef.current !== null && unread > lastUnreadRef.current) {
          playNotificationSound();
          
          // Find the newest unread notification
          const unreadNotifs = notifs.filter(
            (n) => !n.readBy || !n.readBy.includes(userTelegramId)
          );
          if (unreadNotifs.length > 0) {
            const latestNotif = unreadNotifs[0];
            const event = new CustomEvent('in-app-push-notification', {
              detail: latestNotif
            });
            window.dispatchEvent(event);
          }
        }
        lastUnreadRef.current = unread;
        setUnreadCount(unread);
      }
    );

    return () => {
      unsubscribe();
      lastUnreadRef.current = null;
    };
  }, [userTelegramId, userRole]);

  return (
    <>
      <header 
        style={{
          paddingTop: 'calc(var(--tg-safe-area-inset-top, env(safe-area-inset-top, 0px)) + 12px)',
          paddingBottom: '12px'
        }}
        className="fixed top-0 left-0 lg:left-72 right-0 z-40 backdrop-blur-xl border-b border-slate-200/30 dark:border-white/5 bg-white/80 dark:bg-black/80 px-4 md:px-8 transition-all"
      >
        <div className="w-full max-w-7xl mx-auto flex items-center justify-between gap-3">

          <div className="flex items-center gap-2.5">
            {onMenuClick && (
              <button
                type="button"
                onClick={onMenuClick}
                className="lg:hidden p-2.5 rounded-2xl bg-slate-200/80 dark:bg-slate-900/90 border border-slate-300/80 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:text-sky-600 dark:hover:text-sky-400 cursor-pointer transition-all shrink-0 active:scale-95"
                title="Buka Menu"
              >
                <Menu className="w-5 h-5" />
              </button>
            )}
            
            {title ? (
              <div className="flex flex-col min-w-0">
                <h1 className="text-base font-black text-slate-800 dark:text-white tracking-tight truncate">{title}</h1>
                <span className="text-[9px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500 mt-0.5">Recruitment System</span>
              </div>
            ) : (
              <div className="flex flex-col sm:flex-row sm:items-center gap-0.5 sm:gap-2 select-none min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="font-black tracking-tight text-slate-900 dark:text-white text-base">
                    Azur<span className="text-sky-500">Lize</span>
                  </span>
                  <span className="text-[9px] font-black uppercase tracking-wider text-sky-500/90 dark:text-sky-400 bg-sky-500/10 border border-sky-500/30 px-1.5 py-0.5 rounded-md shadow-sm">
                    Team
                  </span>
                </div>
                <div className="flex items-center gap-1">
                  <span className="hidden sm:inline-block w-1 h-1 rounded-full bg-slate-300 dark:bg-slate-700" />
                  <span className="text-[9px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500">
                    Recruitment System
                  </span>
                </div>
              </div>
            )}
          </div>

          <div className="flex items-center gap-2.5">
            {/* Notification Bell Button */}
            {userTelegramId && (
              <button
                type="button"
                onClick={() => setIsNotifOpen(true)}
                className="relative p-2.5 rounded-2xl bg-slate-200/80 dark:bg-slate-900/90 border border-slate-300/80 dark:border-amber-500/20 text-slate-700 dark:text-slate-300 hover:text-amber-600 dark:hover:text-amber-400 hover:border-amber-500/40 cursor-pointer transition-all shadow-sm active:scale-95"
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
          setActiveTab={setActiveTab}
        />
      )}
    </>
  );
};

