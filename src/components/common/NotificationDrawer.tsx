import React, { useEffect, useState } from 'react';
import { AppNotification, UserRole } from '../../types';
import { TabType } from '../navigation/BottomNav';
import {
  subscribeToNotifications,
  markNotificationAsRead,
  markAllNotificationsAsRead,
  deleteNotification
} from '../../firebase/services/notificationService';
import {
  Bell,
  X,
  CheckCheck,
  Trash2,
  CheckCircle2,
  XCircle,
  Rocket,
  FileSpreadsheet,
  AlertCircle,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';

interface NotificationDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  userTelegramId: string;
  userRole: UserRole;
  onUnreadCountChange?: (count: number) => void;
  setActiveTab?: (tab: TabType) => void;
}

export const NotificationDrawer: React.FC<NotificationDrawerProps> = ({
  isOpen,
  onClose,
  userTelegramId,
  userRole,
  onUnreadCountChange,
  setActiveTab
}) => {
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [currentPage, setCurrentPage] = useState<number>(1);

  useEffect(() => {
    if (!userTelegramId) {
      setNotifications([]);
      setLoading(false);
      return;
    }

    const unsubscribe = subscribeToNotifications(
      userTelegramId,
      userRole,
      (notifs) => {
        setNotifications(notifs);
        setLoading(false);

        // Count unread
        const unread = notifs.filter(
          (n) => !n.readBy || !n.readBy.includes(userTelegramId)
        ).length;

        if (onUnreadCountChange) {
          onUnreadCountChange(unread);
        }
      }
    );

    return () => unsubscribe();
  }, [userTelegramId, userRole, onUnreadCountChange]);

  const unreadCount = notifications.filter(
    (n) => !n.readBy || !n.readBy.includes(userTelegramId)
  ).length;

  const handleMarkAllRead = async () => {
    await markAllNotificationsAsRead(notifications, userTelegramId);
  };

  const handleItemClick = async (notif: AppNotification) => {
    if (!notif.readBy || !notif.readBy.includes(userTelegramId)) {
      await markNotificationAsRead(notif.id, userTelegramId);
    }

    if (setActiveTab) {
      let targetTab: TabType = 'beranda';
      
      if (notif.type === 'STATUS_CHANGE' || notif.type === 'PROMOTION' || notif.type === 'AUDIT_COMPLETE') {
        targetTab = 'data_harian';
      } else if (notif.type === 'NEW_REPORT') {
        // Decide based on message/title content
        const isDailySummary = notif.title?.toLowerCase().includes('laporan harian') || 
                               notif.message?.toLowerCase().includes('laporan harian');
        if (isDailySummary) {
          targetTab = 'laporan';
        } else {
          targetTab = 'data_harian';
        }
      } else if (notif.type === 'SYSTEM') {
        if (notif.message?.toLowerCase().includes('gaji')) {
          targetTab = 'gaji';
        } else if (notif.message?.toLowerCase().includes('pengumuman')) {
          targetTab = 'pengumuman';
        } else {
          targetTab = 'beranda';
        }
      }

      setActiveTab(targetTab);
      onClose();
    }
  };

  const handleDelete = async (e: React.MouseEvent, notifId: string) => {
    e.stopPropagation();
    await deleteNotification(notifId);
  };

  // Pagination bounds checking
  const itemsPerPage = 10;
  const totalPages = Math.ceil(notifications.length / itemsPerPage) || 1;

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [notifications.length, totalPages, currentPage]);

  const paginatedNotifications = notifications.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const getNotifIcon = (type: AppNotification['type']) => {
    switch (type) {
      case 'NEW_REPORT':
        return <FileSpreadsheet className="w-4 h-4 text-amber-400" />;
      case 'STATUS_CHANGE':
        return <CheckCircle2 className="w-4 h-4 text-emerald-400" />;
      case 'PROMOTION':
        return <Rocket className="w-4 h-4 text-sky-400" />;
      case 'AUDIT_COMPLETE':
        return <Bell className="w-4 h-4 text-indigo-400" />;
      default:
        return <AlertCircle className="w-4 h-4 text-slate-600 dark:text-slate-400" />;
    }
  };

  const formatTime = (isoString: string) => {
    if (!isoString) return '';
    try {
      const date = new Date(isoString);
      const now = new Date();
      const diffMs = now.getTime() - date.getTime();
      const diffMins = Math.floor(diffMs / (1000 * 60));
      const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
      const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

      if (diffMins < 1) return 'Baru saja';
      if (diffMins < 60) return `${diffMins} mnt yang lalu`;
      if (diffHours < 24) return `${diffHours} jam yang lalu`;
      if (diffDays < 7) return `${diffDays} hr yang lalu`;
      
      const d = date.getDate().toString().padStart(2, '0');
      const m = (date.getMonth() + 1).toString().padStart(2, '0');
      const y = date.getFullYear();
      const hh = date.getHours().toString().padStart(2, '0');
      const mm = date.getMinutes().toString().padStart(2, '0');
      return `${d}/${m}/${y} ${hh}:${mm}`;
    } catch {
      return isoString;
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-white dark:bg-slate-950/80 backdrop-blur-md animate-fadeIn">
      {/* Backdrop overlay */}
      <div className="absolute inset-0" onClick={onClose} />

      {/* Slide-over Drawer Panel */}
      <div className="relative w-full max-w-md h-full bg-white dark:bg-slate-900 border-l border-slate-200 dark:border-slate-800 shadow-2xl flex flex-col z-10 overflow-hidden">
        {/* Drawer Header */}
        <div 
          className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50/90 dark:bg-slate-900/90 backdrop-blur-md sticky top-0 z-10"
          style={{ paddingTop: 'calc(var(--tg-safe-area-inset-top, env(safe-area-inset-top, 0px)) + 16px)' }}
        >
          <div className="flex items-center gap-2">
            <div className="p-2 bg-amber-500/10 rounded-xl border border-amber-500/20 text-amber-600 dark:text-amber-400">
              <Bell className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-black text-slate-900 dark:text-white flex items-center gap-2">
                <span>Notifikasi System</span>
                {unreadCount > 0 && (
                  <span className="px-2 py-0.5 rounded-full bg-amber-500 text-slate-950 text-[10px] font-extrabold">
                    {unreadCount} Baru
                  </span>
                )}
              </h2>
              <p className="text-[11px] text-slate-600 dark:text-slate-400">Pemberitahuan laporan & pemeriksaan</p>
            </div>
          </div>

          <div className="flex items-center gap-1">
            {unreadCount > 0 && (
              <button
                type="button"
                onClick={handleMarkAllRead}
                className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white text-xs font-semibold flex items-center gap-1 cursor-pointer transition-colors"
                title="Tandai Semua Dibaca"
              >
                <CheckCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                <span className="hidden sm:inline text-[11px]">Tandai Dibaca</span>
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white cursor-pointer transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Drawer Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2.5">
          {loading ? (
            <div className="py-12 text-center text-slate-500 dark:text-slate-400 text-xs">
              Memuat notifikasi...
            </div>
          ) : notifications.length === 0 ? (
            <div className="py-16 text-center space-y-2">
              <div className="w-12 h-12 rounded-2xl bg-slate-100 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/50 flex items-center justify-center mx-auto text-slate-500 dark:text-slate-400">
                <Bell className="w-6 h-6" />
              </div>
              <p className="text-xs text-slate-600 dark:text-slate-400 font-medium">Belum ada notifikasi.</p>
            </div>
          ) : (
            <>
              {paginatedNotifications.map((notif) => {
                const isRead = notif.readBy && notif.readBy.includes(userTelegramId);

                return (
                  <div
                    key={notif.id}
                    onClick={() => handleItemClick(notif)}
                    className={`group relative p-3.5 rounded-2xl border transition-all cursor-pointer flex gap-3 ${
                      isRead
                        ? 'bg-slate-50 dark:bg-slate-900/40 border-slate-200 dark:border-slate-800/80 text-slate-700 dark:text-slate-300 hover:border-slate-300 dark:hover:border-slate-300 dark:border-slate-700'
                        : 'bg-amber-500/10 dark:bg-slate-800/80 border-amber-500/40 text-slate-900 dark:text-white shadow-md hover:border-amber-500'
                    }`}
                  >
                    {/* Icon */}
                    <div className={`p-2.5 rounded-xl border shrink-0 h-fit ${
                      isRead 
                        ? 'bg-slate-200/80 dark:bg-slate-800/80 border-slate-300 dark:border-slate-700/50 text-slate-600 dark:text-slate-400' 
                        : 'bg-amber-500/15 border-amber-500/30 text-amber-700 dark:text-amber-400'
                    }`}>
                      {getNotifIcon(notif.type)}
                    </div>

                    {/* Body */}
                    <div className="flex-1 min-w-0 pr-6">
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <h4 className={`text-xs font-bold leading-tight truncate ${isRead ? 'text-slate-700 dark:text-slate-300' : 'text-amber-800 dark:text-amber-300'}`}>
                          {notif.title}
                        </h4>
                        <span className="text-[10px] text-slate-500 dark:text-slate-400 shrink-0 font-mono">
                          {formatTime(notif.createdAt)}
                        </span>
                      </div>

                      <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed font-sans break-words">
                        {notif.message}
                      </p>

                      {notif.senderName && (
                        <div className="mt-1.5 text-[10px] text-slate-500 dark:text-slate-400 flex items-center gap-1 font-mono">
                          <span>Dari:</span>
                          <span className="text-sky-600 dark:text-sky-400 font-bold">@{notif.senderName.replace(/^@/, '')}</span>
                        </div>
                      )}
                    </div>

                    {/* Unread Indicator */}
                    {!isRead && (
                      <span className="absolute top-3.5 right-3 w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                    )}

                    {/* Delete Button */}
                    <button
                      type="button"
                      onClick={(e) => handleDelete(e, notif.id)}
                      className="absolute bottom-2.5 right-2.5 p-1 text-slate-600 dark:text-slate-400 hover:text-rose-500 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                      title="Hapus Notifikasi"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                );
              })}

              {/* Pagination UI inside Drawer */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between gap-2 p-3 rounded-2xl bg-white dark:bg-slate-950/40 border border-slate-200 dark:border-slate-800/80 shadow-md mt-4">
                  <div className="text-[10px] font-bold text-slate-600 dark:text-slate-400">
                    Halaman <span className="text-slate-900 dark:text-white font-black">{currentPage}</span> dari <span className="text-slate-900 dark:text-white font-black">{totalPages}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => {
                        if (currentPage > 1) {
                          setCurrentPage((prev) => prev - 1);
                        }
                      }}
                      disabled={currentPage === 1}
                      className={`px-2.5 py-1.5 rounded-xl text-[10px] font-black uppercase transition-all flex items-center gap-1 border ${
                        currentPage === 1
                          ? 'bg-slate-50 dark:bg-slate-900/40 text-slate-600 border-slate-200 dark:border-slate-800/40 cursor-not-allowed'
                          : 'bg-slate-50 dark:bg-slate-900 text-amber-400 border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:bg-slate-800 hover:text-slate-900 dark:text-white shadow-sm cursor-pointer'
                      }`}
                    >
                      <ChevronLeft className="w-3 h-3" />
                      Prev
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        if (currentPage < totalPages) {
                          setCurrentPage((prev) => prev + 1);
                        }
                      }}
                      disabled={currentPage === totalPages}
                      className={`px-2.5 py-1.5 rounded-xl text-[10px] font-black uppercase transition-all flex items-center gap-1 border ${
                        currentPage === totalPages
                          ? 'bg-slate-50 dark:bg-slate-900/40 text-slate-600 border-slate-200 dark:border-slate-800/40 cursor-not-allowed'
                          : 'bg-slate-50 dark:bg-slate-900 text-amber-400 border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:bg-slate-800 hover:text-slate-900 dark:text-white shadow-sm cursor-pointer'
                      }`}
                    >
                      Next
                      <ChevronRight className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Drawer Footer */}
        <div 
          className="p-3 border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950/60 text-[11px] text-slate-500 dark:text-slate-400 text-center pb-safe"
          style={{ paddingBottom: 'calc(var(--tg-safe-area-inset-bottom, env(safe-area-inset-bottom, 0px)) + 12px)' }}
        >
          Notifikasi diperbarui secara real-time
        </div>
      </div>
    </div>
  );
};
