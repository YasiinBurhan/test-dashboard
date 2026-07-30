import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  LayoutGrid, 
  CalendarClock, 
  ClipboardPen, 
  FileText, 
  UserCheck, 
  ShieldCheck, 
  Crown, 
  Megaphone, 
  X, 
  ChevronRight, 
  LogOut,
  Moon,
  Sun,
  Coins,
  Menu
} from 'lucide-react';
import { triggerHaptic } from '../../telegram/webapp';
import { useAuth } from '../../hooks/useAuth';
import { useTheme } from '../../contexts/ThemeContext';
import { StatusBadge } from '../common/StatusBadge';
import { TabType } from './BottomNav';
import { AzurLizeLogo } from '../logo/AzurLizeLogo';

interface SidebarProps {
  activeTab: TabType;
  setActiveTab: (tab: TabType) => void;
  isOpen: boolean;
  onClose: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ 
  activeTab, 
  setActiveTab, 
  isOpen, 
  onClose 
}) => {
  const { userProfile, telegramUser, logout } = useAuth();
  const { colorScheme, toggleTheme } = useTheme();

  const handleTabClick = (tab: TabType) => {
    triggerHaptic('selection');
    setActiveTab(tab);
    onClose();
  };

  const isAdminOrOwner = userProfile?.role === 'Admin' || userProfile?.role === 'Owner';
  const isOwner = userProfile?.role === 'Owner';

  // Navigation Items
  const menuItems = [
    { id: 'beranda' as TabType, label: 'Beranda', desc: 'Ringkasan & statistik', icon: LayoutGrid },
    { id: 'postingan' as TabType, label: 'Postingan', desc: 'Daftar & tambah postingan', icon: ClipboardPen },
    { id: 'data_harian' as TabType, label: 'Data Harian', desc: 'Kalender & rekap harian', icon: CalendarClock },
    { id: 'laporan' as TabType, label: 'Laporan Pelamar', desc: 'Daftar data pelamar masuk', icon: FileText },
    { id: 'gaji' as TabType, label: 'Gaji & Bonus', desc: 'Rincian gaji & komisi', icon: Coins },
    { id: 'pengumuman' as TabType, label: 'Pengumuman', desc: 'Informasi & instruksi tim', icon: Megaphone },
    { id: 'profil' as TabType, label: 'Profil Saya', desc: 'Pengaturan akun & PIN', icon: UserCheck }
  ];

  if (isAdminOrOwner) {
    menuItems.push({
      id: 'admin' as TabType,
      label: 'Panel Admin',
      desc: 'Approval laporan & rekap',
      icon: ShieldCheck
    });
  }

  if (isOwner) {
    menuItems.push({
      id: 'owner' as TabType,
      label: 'Panel Owner',
      desc: 'Manajemen rekruter & sistem',
      icon: Crown
    });
  }

  const SidebarContent = () => (
    <div className="flex flex-col h-full bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 p-5 select-none relative">
      {/* Sidebar Header */}
      <div className="flex items-center justify-between pb-6 border-b border-slate-200/80 dark:border-slate-800/80">
        <div className="flex items-center gap-3">
          <AzurLizeLogo size="sm" />
        </div>
        
        {/* Close Button - Only visible in mobile drawer */}
        <button
          onClick={onClose}
          className="lg:hidden p-2 rounded-xl bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-500 hover:text-slate-900 dark:hover:text-white transition-all active:scale-95"
          aria-label="Tutup Menu"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* User Profile Summary */}
      <div className="mt-5 p-4 rounded-2xl bg-slate-50 dark:bg-slate-900/50 border border-slate-100 dark:border-slate-800/50 flex items-center gap-3.5">
        {telegramUser?.photo_url ? (
          <img 
            referrerPolicy="no-referrer"
            src={telegramUser.photo_url} 
            alt="Avatar" 
            className="w-11 h-11 rounded-xl object-cover border border-sky-400/40 shadow-sm shadow-sky-500/10"
          />
        ) : (
          <div className="w-11 h-11 rounded-xl bg-gradient-to-tr from-sky-500 to-indigo-500 flex items-center justify-center font-black text-white text-base shadow-sm shadow-sky-500/15 shrink-0 border border-white/10">
            {(userProfile?.firstName?.[0] || telegramUser?.first_name?.[0] || 'U').toUpperCase()}
          </div>
        )}
        <div className="min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="font-extrabold text-xs text-slate-900 dark:text-white truncate max-w-[120px]">
              {userProfile?.firstName || telegramUser?.first_name || 'User'}
            </span>
            {userProfile?.role && <StatusBadge role={userProfile.role} size="sm" />}
          </div>
          <p className="text-[10px] font-semibold text-slate-400 dark:text-slate-500 truncate mt-0.5">
            @{ (userProfile?.username || telegramUser?.username || 'user').replace(/^@/, '') }
          </p>
        </div>
      </div>

      {/* Navigation Links */}
      <div className="flex-1 overflow-y-auto py-6 space-y-1.5 scrollbar-thin scrollbar-thumb-slate-300 dark:scrollbar-thumb-slate-800">
        <p className="text-[10px] font-black uppercase tracking-wider text-slate-400 dark:text-slate-500 px-3 pb-1">
          Menu Navigasi
        </p>

        {menuItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;

          return (
            <button
              key={item.id}
              onClick={() => handleTabClick(item.id)}
              className={`w-full flex items-center justify-between px-3.5 py-3 rounded-2xl border text-left cursor-pointer transition-all ${
                isActive
                  ? 'bg-sky-500/10 border-sky-500/20 text-sky-600 dark:text-sky-400 font-extrabold shadow-sm'
                  : 'bg-transparent border-transparent text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-900/60 hover:text-slate-950 dark:hover:text-white'
              }`}
            >
              <div className="flex items-center gap-3.5 min-w-0">
                <Icon className={`w-5 h-5 shrink-0 ${isActive ? 'text-sky-500' : 'text-slate-400 group-hover:text-slate-600 dark:text-slate-500'}`} />
                <div className="min-w-0">
                  <span className="block text-[12px] font-bold tracking-tight">{item.label}</span>
                  <span className="block text-[10px] font-medium text-slate-400 dark:text-slate-500 truncate mt-0.5">{item.desc}</span>
                </div>
              </div>

              {isActive && (
                <div className="w-1.5 h-1.5 rounded-full bg-sky-500 dark:bg-sky-400 shrink-0" />
              )}
            </button>
          );
        })}
      </div>

      {/* Footer Settings & Logout */}
      <div className="pt-4 border-t border-slate-100 dark:border-slate-800/80 space-y-3">
        {/* Theme Toggle */}
        <button
          type="button"
          onClick={toggleTheme}
          className="w-full flex items-center justify-between p-3 rounded-2xl bg-slate-50 dark:bg-slate-900/40 border border-slate-100 dark:border-slate-800/80 hover:bg-slate-100 dark:hover:bg-slate-900 hover:border-slate-200 dark:hover:border-slate-800 cursor-pointer text-xs font-bold text-slate-600 dark:text-slate-300 transition-all active:scale-[0.98]"
        >
          <div className="flex items-center gap-2.5">
            {colorScheme === 'dark' ? (
              <>
                <Sun className="w-4.5 h-4.5 text-amber-400 shrink-0" />
                <span>Mode Terang (Soft)</span>
              </>
            ) : (
              <>
                <Moon className="w-4.5 h-4.5 text-sky-600 dark:text-sky-400 shrink-0" />
                <span>Mode Gelap (Twilight)</span>
              </>
            )}
          </div>
          <ChevronRight className="w-4 h-4 text-slate-400" />
        </button>

        {/* Logout */}
        <button
          onClick={() => {
            onClose();
            logout();
          }}
          className="w-full flex items-center gap-3 p-3 rounded-2xl bg-rose-500/5 hover:bg-rose-500/10 border border-rose-500/10 text-rose-500 dark:text-rose-400 text-xs font-bold hover:border-rose-500/20 transition-all active:scale-[0.98]"
        >
          <LogOut className="w-4.5 h-4.5 shrink-0" />
          <span>Keluar Sesi</span>
        </button>
      </div>
    </div>
  );

  return (
    <>
      {/* 1. Desktop/Tablet Persistent Sidebar (Large screen) */}
      <aside className="hidden lg:block w-72 h-screen fixed left-0 top-0 border-r border-slate-200/80 dark:border-slate-900/80 z-30 shadow-sm shrink-0">
        <SidebarContent />
      </aside>

      {/* 2. Mobile Sliding Navigation Drawer (Android / iOS) */}
      <AnimatePresence>
        {isOpen && (
          <>
            {/* Dark Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={onClose}
              className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 lg:hidden"
            />

            {/* Sliding Drawer Container */}
            <motion.div
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'spring', damping: 26, stiffness: 290 }}
              style={{
                top: 0,
                bottom: 0,
                paddingTop: 'var(--tg-safe-area-inset-top, env(safe-area-inset-top, 0px))',
                paddingBottom: 'var(--tg-safe-area-inset-bottom, env(safe-area-inset-bottom, 0px))'
              }}
              className="fixed left-0 w-80 max-w-[85vw] h-full z-50 shadow-2xl lg:hidden flex flex-col"
            >
              <SidebarContent />
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
};
