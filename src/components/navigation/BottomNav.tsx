import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  LayoutGrid, 
  CalendarClock, 
  ClipboardPen, 
  FileText, 
  Clock3, 
  UserCheck, 
  ShieldCheck, 
  Crown, 
  Megaphone, 
  Grid2x2, 
  X, 
  ChevronRight, 
  Sparkles,
  LogOut,
  Moon,
  Sun,
  Coins
} from 'lucide-react';
import { triggerHaptic } from '../../telegram/webapp';
import { useAuth } from '../../hooks/useAuth';
import { useTheme } from '../../contexts/ThemeContext';
import { StatusBadge } from '../common/StatusBadge';

export type TabType = 'beranda' | 'postingan' | 'laporan' | 'data_harian' | 'profil' | 'admin' | 'owner' | 'pengumuman' | 'gaji';

interface BottomNavProps {
  activeTab: TabType;
  setActiveTab: (tab: TabType) => void;
}

export const BottomNav: React.FC<BottomNavProps> = ({ activeTab, setActiveTab }) => {
  const { userProfile, telegramUser, logout } = useAuth();
  const { colorScheme, toggleTheme } = useTheme();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isKeyboardVisible, setIsKeyboardVisible] = useState(false);

  useEffect(() => {
    const handleFocusIn = (e: FocusEvent) => {
      const target = e.target as HTMLElement;
      if (
        target && 
        (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) &&
        !['checkbox', 'radio', 'submit', 'button', 'file'].includes((target as HTMLInputElement).type || '')
      ) {
        setIsKeyboardVisible(true);
      }
    };

    const handleFocusOut = () => {
      setTimeout(() => {
        const activeEl = document.activeElement as HTMLElement;
        const isStillInput = activeEl && (
          activeEl.tagName === 'INPUT' || 
          activeEl.tagName === 'TEXTAREA' || 
          activeEl.isContentEditable
        ) && !['checkbox', 'radio', 'submit', 'button', 'file'].includes((activeEl as HTMLInputElement).type || '');
        
        if (!isStillInput) {
          setIsKeyboardVisible(false);
        }
      }, 80);
    };

    const initialHeight = window.innerHeight;
    const handleResize = () => {
      const currentHeight = window.innerHeight;
      // If viewport shrank by more than 140px, keyboard is likely open
      if (initialHeight - currentHeight > 140) {
        const activeEl = document.activeElement as HTMLElement;
        const isFocusedOnInput = activeEl && (
          activeEl.tagName === 'INPUT' || 
          activeEl.tagName === 'TEXTAREA' || 
          activeEl.isContentEditable
        );
        if (isFocusedOnInput) {
          setIsKeyboardVisible(true);
        }
      } else {
        setIsKeyboardVisible(false);
      }
    };

    document.addEventListener('focusin', handleFocusIn);
    document.addEventListener('focusout', handleFocusOut);
    window.addEventListener('resize', handleResize);

    return () => {
      document.removeEventListener('focusin', handleFocusIn);
      document.removeEventListener('focusout', handleFocusOut);
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  const handleTabClick = (tab: TabType) => {
    triggerHaptic('selection');
    setActiveTab(tab);
    setIsMenuOpen(false);
  };

  const handleMenuToggle = () => {
    triggerHaptic('impact', 'light');
    setIsMenuOpen(prev => !prev);
  };

  // Primary 5 fixed tabs (including Gaji)
  const primaryTabs = [
    { id: 'beranda' as TabType, label: 'Beranda', icon: LayoutGrid },
    { id: 'postingan' as TabType, label: 'Postingan', icon: ClipboardPen },
    { id: 'data_harian' as TabType, label: 'Data Harian', icon: CalendarClock },
    { id: 'laporan' as TabType, label: 'Laporan', icon: FileText },
    { id: 'gaji' as TabType, label: 'Gaji', icon: Coins }
  ];

  // Secondary menu items inside drawer
  const secondaryMenuItems = [
    {
      id: 'profil' as TabType,
      label: 'Profil Saya',
      desc: 'Data akun & ID Telegram',
      icon: UserCheck,
      color: 'from-sky-500/20 to-blue-600/10 text-sky-400 border-sky-500/30'
    },
    {
      id: 'pengumuman' as TabType,
      label: 'Pengumuman',
      desc: 'Instruksi tim',
      icon: Megaphone,
      color: 'from-amber-500/20 to-orange-600/10 text-amber-400 border-amber-500/30'
    }
  ];

  if (userProfile?.role === 'Admin' || userProfile?.role === 'Owner') {
    secondaryMenuItems.unshift({
      id: 'admin' as TabType,
      label: 'Panel Admin',
      desc: 'Kelola tim, approval & sistem',
      icon: ShieldCheck,
      color: 'from-emerald-500/20 to-teal-600/10 text-emerald-400 border-emerald-500/30'
    });
  }

  if (userProfile?.role === 'Owner') {
    secondaryMenuItems.unshift({
      id: 'owner' as TabType,
      label: 'Panel Owner',
      desc: 'Akses penuh manajemen tim',
      icon: Crown,
      color: 'from-amber-500/20 to-yellow-600/10 text-amber-300 border-amber-500/40'
    });
  }

  // Determine if active tab is one of the secondary items
  const activeSecondaryItem = secondaryMenuItems.find(item => item.id === activeTab);
  const isSecondaryActive = Boolean(activeSecondaryItem);

  // Dynamic 5th menu button props
  const fifthButtonIcon = activeSecondaryItem ? activeSecondaryItem.icon : Grid2x2;
  const fifthButtonLabel = activeSecondaryItem ? activeSecondaryItem.label.split(' ')[0] : 'Menu';
  const FifthIcon = fifthButtonIcon;

  return (
    <>
      {/* Bottom Drawer Overlay Sheet */}
      <AnimatePresence>
        {isMenuOpen && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsMenuOpen(false)}
              className="fixed inset-0 bg-black/70 backdrop-blur-md z-40"
            />

            {/* Menu Sheet */}
            <motion.div
              initial={{ y: '100%', opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: '100%', opacity: 0 }}
              transition={{ type: 'spring', damping: 25, stiffness: 280 }}
              style={{
                paddingBottom: 'calc(var(--tg-safe-area-inset-bottom, env(safe-area-inset-bottom, 0px)) + 8px)'
              }}
              className="fixed bottom-0 left-0 right-0 z-50 p-4 max-w-lg mx-auto"
            >
              <div 
                className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-white/95 dark:bg-slate-900/95 shadow-2xl p-5 space-y-5 backdrop-blur-2xl text-slate-900 dark:text-white"
              >
                {/* Header: User Profile & Close */}
                <div className="flex items-center justify-between pb-3 border-b border-slate-200/80 dark:border-slate-800/80">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-sky-500 to-blue-600 flex items-center justify-center font-black text-slate-900 dark:text-white text-sm shadow-md shadow-sky-500/20 border border-white/20 shrink-0">
                      {(userProfile?.firstName?.[0] || telegramUser?.first_name?.[0] || 'A').toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="font-extrabold text-sm text-slate-900 dark:text-white truncate max-w-[160px]">
                          {userProfile?.firstName || telegramUser?.first_name || 'User'}
                        </h3>
                        {userProfile?.role && <StatusBadge role={userProfile.role} size="sm" />}
                      </div>
                      <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400 truncate">
                        @{ (userProfile?.username || telegramUser?.username || 'user').replace(/^@/, '') }
                      </p>
                    </div>
                  </div>

                  <button
                    onClick={() => setIsMenuOpen(false)}
                    className="p-2 rounded-2xl bg-slate-200 dark:bg-slate-900 border border-slate-300 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-all active:scale-95"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                {/* Secondary Menu List */}
                <div className="space-y-2">
                  <p className="text-[10px] font-black uppercase text-slate-500 dark:text-slate-400 tracking-wider px-1">
                    Navigasi Tambahan
                  </p>

                  <div className="grid grid-cols-1 gap-2">
                    {secondaryMenuItems.map((item) => {
                      const Icon = item.icon;
                      const isActive = activeTab === item.id;

                      return (
                        <button
                          key={item.id}
                          onClick={() => handleTabClick(item.id)}
                          className={`w-full flex items-center justify-between p-3.5 rounded-2xl border transition-all active:scale-[0.99] text-left ${
                            isActive
                              ? 'bg-sky-500/15 border-sky-500/40 text-slate-900 dark:text-white shadow-lg shadow-sky-500/10'
                              : 'bg-slate-100/80 dark:bg-slate-900/60 border-slate-200/80 dark:border-slate-800/80 text-slate-700 dark:text-slate-300 hover:bg-slate-200/80 dark:hover:bg-slate-100 dark:bg-slate-800/50 hover:text-slate-900 dark:hover:text-white'
                          }`}
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <div className={`w-9 h-9 rounded-xl border flex items-center justify-center shrink-0 bg-gradient-to-br ${item.color}`}>
                              <Icon className="w-4.5 h-4.5" />
                            </div>
                            <div className="min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="font-extrabold text-xs text-slate-900 dark:text-white tracking-tight">{item.label}</span>
                                {isActive && (
                                  <span className="w-2 h-2 rounded-full bg-sky-400 animate-pulse" />
                                )}
                              </div>
                              <p className="text-[10px] text-slate-500 dark:text-slate-400 font-medium truncate mt-0.5">{item.desc}</p>
                            </div>
                          </div>

                          <ChevronRight className={`w-4 h-4 shrink-0 transition-transform ${isActive ? 'text-sky-400 translate-x-0.5' : 'text-slate-600'}`} />
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Bottom Quick Controls */}
                <div className="pt-2 border-t border-slate-200/80 dark:border-slate-800/80 flex items-center justify-between gap-3">
                  <button
                    type="button"
                    onClick={toggleTheme}
                    className="flex items-center gap-2 text-xs font-bold text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-900 px-3.5 py-2.5 rounded-2xl border border-slate-300/80 dark:border-slate-800/80 hover:border-sky-500/40 cursor-pointer transition-all active:scale-95"
                  >
                    {colorScheme === 'dark' ? (
                      <>
                        <Sun className="w-4 h-4 text-amber-400 shrink-0" />
                        <span>Mode Terang (Soft)</span>
                      </>
                    ) : (
                      <>
                        <Moon className="w-4 h-4 text-sky-600 dark:text-sky-400 shrink-0" />
                        <span>Mode Gelap (Twilight)</span>
                      </>
                    )}
                  </button>

                  <button
                    onClick={() => {
                      setIsMenuOpen(false);
                      logout();
                    }}
                    className="py-2.5 px-4 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs font-bold hover:bg-rose-500/20 transition-all active:scale-95 flex items-center gap-1.5"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    <span>Keluar Sesi</span>
                  </button>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Floating Bottom Nav Bar (5 Spacious Buttons) */}
      <div 
        style={{
          paddingBottom: 'calc(var(--tg-safe-area-inset-bottom, env(safe-area-inset-bottom, 0px)) + 8px)'
        }}
        className={`fixed bottom-0 left-0 right-0 z-40 px-3 md:px-6 pointer-events-none transition-all duration-300 ease-in-out transform ${
          isKeyboardVisible ? 'translate-y-28 opacity-0 pointer-events-none' : 'translate-y-0 opacity-100'
        }`}
      >
        <nav 
          className="w-full max-w-xl mx-auto pointer-events-auto backdrop-blur-2xl border border-slate-200/90 dark:border-white/10 bg-white/85 dark:bg-slate-950/85 rounded-2xl p-1 shadow-lg shadow-slate-900/5 dark:shadow-2xl flex items-center justify-between"
        >
          {/* Primary 4 Buttons */}
          {primaryTabs.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;

            return (
              <button
                key={item.id}
                onClick={() => handleTabClick(item.id)}
                className="flex-1 flex flex-col items-center justify-center py-2 px-1 rounded-xl transition-colors duration-200 relative"
              >
                <div className="relative flex items-center justify-center">
                  <Icon className={`w-5 h-5 transition-transform duration-200 ${isActive ? 'scale-105 text-sky-600 dark:text-sky-400 font-extrabold' : 'scale-100 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'}`} />
                </div>

                <span className={`text-[10px] md:text-[11px] tracking-tight mt-1 truncate max-w-full ${isActive ? 'text-sky-600 dark:text-sky-400 font-bold' : 'text-slate-500 dark:text-slate-400 font-medium'}`}>
                  {item.label}
                </span>
              </button>
            );
          })}

          {/* 5th Dynamic Menu Button */}
          <button
            onClick={handleMenuToggle}
            className="flex-1 flex flex-col items-center justify-center py-2 px-1 rounded-xl transition-colors duration-200 relative"
          >
            <div className="relative flex items-center justify-center">
              <FifthIcon className={`w-5 h-5 transition-transform duration-200 ${isSecondaryActive || isMenuOpen ? 'scale-105 text-sky-600 dark:text-sky-400 font-extrabold' : 'scale-100 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'}`} />
            </div>

            <span className={`text-[10px] md:text-[11px] tracking-tight mt-1 truncate max-w-full ${isSecondaryActive || isMenuOpen ? 'text-sky-600 dark:text-sky-400 font-bold' : 'text-slate-500 dark:text-slate-400 font-medium'}`}>
              {fifthButtonLabel}
            </span>
          </button>
        </nav>
      </div>
    </>
  );
};

