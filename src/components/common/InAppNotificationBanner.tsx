import React, { useEffect, useState, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { AppNotification } from '../../types';
import { TabType } from '../navigation/BottomNav';
import { 
  Bell, 
  X, 
  ChevronRight, 
  Rocket, 
  FileSpreadsheet, 
  AlertCircle, 
  CheckCircle2, 
  User,
  Volume2
} from 'lucide-react';
import { markNotificationAsRead } from '../../firebase/services/notificationService';

interface InAppNotificationBannerProps {
  setActiveTab: (tab: TabType) => void;
  userTelegramId: string;
}

export const InAppNotificationBanner: React.FC<InAppNotificationBannerProps> = ({
  setActiveTab,
  userTelegramId
}) => {
  const [notification, setNotification] = useState<AppNotification | null>(null);
  const [isVisible, setIsVisible] = useState<boolean>(false);
  const [progress, setProgress] = useState<number>(100);
  const autoCloseTimerRef = useRef<NodeJS.Timeout | null>(null);
  const progressTimerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    const handleInAppNotification = (e: Event) => {
      const customEvent = e as CustomEvent<AppNotification>;
      const notifData = customEvent.detail;
      
      if (!notifData) return;

      // Check if it was sent by the current user to avoid self-notification banner
      if (notifData.senderName && userTelegramId && notifData.senderName.replace(/^@/, '') === userTelegramId) {
        return;
      }

      // Clear existing timers
      if (autoCloseTimerRef.current) clearTimeout(autoCloseTimerRef.current);
      if (progressTimerRef.current) clearInterval(progressTimerRef.current);

      // Trigger physical vibration if supported on the device/webview
      try {
        if (typeof navigator !== 'undefined' && navigator.vibrate) {
          navigator.vibrate([150, 100, 150]);
        }
      } catch (err) {
        console.debug('Vibration not supported or blocked:', err);
      }

      // Play elegant tone as a safety/secondary trigger
      try {
        const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
        if (AudioContextClass) {
          const ctx = new AudioContextClass();
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'sine';
          osc.frequency.setValueAtTime(880, ctx.currentTime); // A5
          osc.frequency.exponentialRampToValueAtTime(1318.51, ctx.currentTime + 0.15); // E6
          gain.gain.setValueAtTime(0.1, ctx.currentTime);
          gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start();
          osc.stop(ctx.currentTime + 0.4);
        }
      } catch (err) {
        console.debug('Audio chime failed:', err);
      }

      setNotification(notifData);
      setIsVisible(true);
      setProgress(100);

      // Tick the progress bar
      const totalTime = 6000; // 6 seconds
      const intervalTime = 50;
      let elapsed = 0;

      progressTimerRef.current = setInterval(() => {
        elapsed += intervalTime;
        const remaining = Math.max(0, 100 - (elapsed / totalTime) * 100);
        setProgress(remaining);
        if (remaining <= 0) {
          if (progressTimerRef.current) clearInterval(progressTimerRef.current);
        }
      }, intervalTime);

      // Auto-dismiss
      autoCloseTimerRef.current = setTimeout(() => {
        setIsVisible(false);
      }, totalTime);
    };

    window.addEventListener('in-app-push-notification', handleInAppNotification);

    return () => {
      window.removeEventListener('in-app-push-notification', handleInAppNotification);
      if (autoCloseTimerRef.current) clearTimeout(autoCloseTimerRef.current);
      if (progressTimerRef.current) clearInterval(progressTimerRef.current);
    };
  }, [userTelegramId]);

  const handleDismiss = () => {
    setIsVisible(false);
  };

  const handleOpen = async () => {
    if (!notification) return;

    // Mark as read in Firestore
    if (userTelegramId && (!notification.readBy || !notification.readBy.includes(userTelegramId))) {
      try {
        await markNotificationAsRead(notification.id, userTelegramId);
      } catch (err) {
        console.error('Failed to mark read from banner:', err);
      }
    }

    // Determine target redirect tab
    let targetTab: TabType = 'beranda';
    if (notification.type === 'STATUS_CHANGE' || notification.type === 'PROMOTION' || notification.type === 'AUDIT_COMPLETE') {
      targetTab = 'data_harian';
    } else if (notification.type === 'RECRUITER_REGISTERED') {
      targetTab = 'admin';
    } else if (notification.type === 'NEW_REPORT') {
      const isDailySummary = notification.title?.toLowerCase().includes('laporan harian') || 
                             notification.message?.toLowerCase().includes('laporan harian');
      targetTab = isDailySummary ? 'laporan' : 'data_harian';
    } else if (notification.type === 'SYSTEM') {
      if (notification.message?.toLowerCase().includes('gaji')) {
        targetTab = 'gaji';
      } else if (notification.message?.toLowerCase().includes('pengumuman')) {
        targetTab = 'pengumuman';
      }
    }

    setActiveTab(targetTab);
    setIsVisible(false);
  };

  const getNotifIcon = (type: AppNotification['type']) => {
    switch (type) {
      case 'NEW_REPORT':
        return <FileSpreadsheet className="w-4 h-4 text-amber-500" />;
      case 'STATUS_CHANGE':
        return <CheckCircle2 className="w-4 h-4 text-emerald-500" />;
      case 'PROMOTION':
        return <Rocket className="w-4 h-4 text-sky-500" />;
      case 'AUDIT_COMPLETE':
        return <Bell className="w-4 h-4 text-indigo-500" />;
      case 'RECRUITER_REGISTERED':
        return <User className="w-4 h-4 text-sky-500" />;
      default:
        return <AlertCircle className="w-4 h-4 text-slate-500 dark:text-slate-400" />;
    }
  };

  return (
    <AnimatePresence>
      {isVisible && notification && (
        <motion.div
          initial={{ opacity: 0, y: -80, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -40, scale: 0.95 }}
          transition={{ type: 'spring', damping: 20, stiffness: 260 }}
          className="fixed top-4 left-4 right-4 md:left-auto md:right-4 md:w-full md:max-w-sm z-[9999] shadow-2xl rounded-2xl border border-amber-500/30 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md overflow-hidden flex flex-col"
          style={{ 
            top: 'calc(var(--tg-safe-area-inset-top, env(safe-area-inset-top, 0px)) + 16px)' 
          }}
        >
          {/* Top subtle line */}
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-amber-500 via-sky-500 to-emerald-500" />

          {/* Banner Header */}
          <div className="px-4 pt-3 pb-1.5 flex items-center justify-between border-b border-slate-100 dark:border-slate-800 text-[10px] text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider">
            <div className="flex items-center gap-1.5">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500"></span>
              </span>
              <span>Notifikasi Baru</span>
            </div>
            <div className="flex items-center gap-1">
              <Volume2 className="w-3 h-3 text-sky-500 animate-pulse" />
              <span>WebView System</span>
            </div>
          </div>

          {/* Banner Body */}
          <div 
            onClick={handleOpen}
            className="p-4 flex gap-3 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors"
          >
            {/* Left Icon with soft gradient ring */}
            <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-600 dark:text-amber-400 shrink-0 h-fit">
              {getNotifIcon(notification.type)}
            </div>

            {/* Title & Description */}
            <div className="flex-1 min-w-0">
              <h4 className="text-xs font-black text-slate-900 dark:text-white mb-0.5 leading-tight truncate">
                {notification.title}
              </h4>
              <p className="text-xs text-slate-600 dark:text-slate-300 font-medium leading-relaxed line-clamp-2">
                {notification.message}
              </p>
              {notification.senderName && (
                <span className="inline-block mt-1 text-[9px] font-mono text-sky-600 dark:text-sky-400">
                  @{notification.senderName.replace(/^@/, '')}
                </span>
              )}
            </div>
          </div>

          {/* Actions Footer */}
          <div className="flex border-t border-slate-100 dark:border-slate-800 divide-x divide-slate-100 dark:divide-slate-800 text-xs font-black">
            <button
              type="button"
              onClick={handleDismiss}
              className="flex-1 py-2.5 text-center text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-all flex items-center justify-center gap-1"
            >
              <X className="w-3.5 h-3.5" />
              Tutup
            </button>
            <button
              type="button"
              onClick={handleOpen}
              className="flex-1 py-2.5 text-center text-amber-500 dark:text-amber-400 hover:text-amber-600 dark:hover:text-amber-300 hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-all flex items-center justify-center gap-1"
            >
              Buka Detail
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Time Progress Bar */}
          <div className="w-full h-[3px] bg-slate-100 dark:bg-slate-800">
            <div 
              className="h-full bg-amber-500 transition-all duration-75 ease-linear"
              style={{ width: `${progress}%` }}
            />
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
