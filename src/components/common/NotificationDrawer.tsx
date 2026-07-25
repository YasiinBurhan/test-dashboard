import React, { useEffect, useState } from 'react';
import { AppNotification, UserRole } from '../../types';
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
  AlertCircle
} from 'lucide-react';

interface NotificationDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  userTelegramId: string;
  userRole: UserRole;
  onUnreadCountChange?: (count: number) => void;
}

export const NotificationDrawer: React.FC<NotificationDrawerProps> = ({
  isOpen,
  onClose,
  userTelegramId,
  userRole,
  onUnreadCountChange
}) => {
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

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
  };

  const handleDelete = async (e: React.MouseEvent, notifId: string) => {
    e.stopPropagation();
    await deleteNotification(notifId);
  };

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
        return <AlertCircle className="w-4 h-4 text-slate-400" />;
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
    <div className="fixed inset-0 z-50 flex justify-end bg-slate-950/80 backdrop-blur-md animate-fadeIn">
      {/* Backdrop overlay */}
      <div className="absolute inset-0" onClick={onClose} />

      {/* Slide-over Drawer Panel */}
      <div className="relative w-full max-w-md h-full bg-slate-900 border-l border-slate-800 shadow-2xl flex flex-col z-10 overflow-hidden">
        {/* Drawer Header */}
        <div 
          className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-900/90 backdrop-blur-md sticky top-0 z-10"
          style={{ paddingTop: 'calc(var(--tg-safe-area-inset-top, env(safe-area-inset-top, 0px)) + 16px)' }}
        >
          <div className="flex items-center gap-2">
            <div className="p-2 bg-amber-500/10 rounded-xl border border-amber-500/20 text-amber-400">
              <Bell className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-black text-white flex items-center gap-2">
                <span>Notifikasi System</span>
                {unreadCount > 0 && (
                  <span className="px-2 py-0.5 rounded-full bg-amber-500 text-slate-950 text-[10px] font-extrabold">
                    {unreadCount} Baru
                  </span>
                )}
              </h2>
              <p className="text-[11px] text-slate-400">Pemberitahuan laporan & pemeriksaan</p>
            </div>
          </div>

          <div className="flex items-center gap-1">
            {unreadCount > 0 && (
              <button
                type="button"
                onClick={handleMarkAllRead}
                className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-semibold flex items-center gap-1 cursor-pointer transition-colors"
                title="Tandai Semua Dibaca"
              >
                <CheckCheck className="w-4 h-4 text-emerald-400" />
                <span className="hidden sm:inline text-[11px]">Tandai Dibaca</span>
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white cursor-pointer transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Drawer Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2.5">
          {loading ? (
            <div className="py-12 text-center text-slate-500 text-xs">
              Memuat notifikasi...
            </div>
          ) : notifications.length === 0 ? (
            <div className="py-16 text-center space-y-2">
              <div className="w-12 h-12 rounded-2xl bg-slate-800/60 border border-slate-700/50 flex items-center justify-center mx-auto text-slate-500">
                <Bell className="w-6 h-6" />
              </div>
              <p className="text-xs text-slate-400 font-medium">Belum ada notifikasi.</p>
            </div>
          ) : (
            notifications.map((notif) => {
              const isRead = notif.readBy && notif.readBy.includes(userTelegramId);

              return (
                <div
                  key={notif.id}
                  onClick={() => handleItemClick(notif)}
                  className={`group relative p-3.5 rounded-2xl border transition-all cursor-pointer flex gap-3 ${
                    isRead
                      ? 'bg-slate-900/40 border-slate-800/80 text-slate-300 hover:border-slate-700'
                      : 'bg-slate-800/80 border-amber-500/40 text-white shadow-lg shadow-amber-500/5 hover:border-amber-400'
                  }`}
                >
                  {/* Icon */}
                  <div className={`p-2.5 rounded-xl border shrink-0 h-fit ${
                    isRead 
                      ? 'bg-slate-800/80 border-slate-700/50 text-slate-400' 
                      : 'bg-amber-500/15 border-amber-500/30 text-amber-400'
                  }`}>
                    {getNotifIcon(notif.type)}
                  </div>

                  {/* Body */}
                  <div className="flex-1 min-w-0 pr-6">
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <h4 className={`text-xs font-bold leading-tight truncate ${isRead ? 'text-slate-300' : 'text-amber-300'}`}>
                        {notif.title}
                      </h4>
                      <span className="text-[10px] text-slate-500 shrink-0 font-mono">
                        {formatTime(notif.createdAt)}
                      </span>
                    </div>

                    <p className="text-xs text-slate-300 leading-relaxed font-sans break-words">
                      {notif.message}
                    </p>

                    {notif.senderName && (
                      <div className="mt-1.5 text-[10px] text-slate-400 flex items-center gap-1 font-mono">
                        <span>Dari:</span>
                        <span className="text-sky-400 font-bold">@{notif.senderName.replace(/^@/, '')}</span>
                      </div>
                    )}
                  </div>

                  {/* Unread Indicator */}
                  {!isRead && (
                    <span className="absolute top-3.5 right-3 w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
                  )}

                  {/* Delete Button */}
                  <button
                    type="button"
                    onClick={(e) => handleDelete(e, notif.id)}
                    className="absolute bottom-2.5 right-2.5 p-1 text-slate-500 hover:text-rose-400 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                    title="Hapus Notifikasi"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              );
            })
          )}
        </div>

        {/* Drawer Footer */}
        <div 
          className="p-3 border-t border-slate-800 bg-slate-950/60 text-[11px] text-slate-500 text-center pb-safe"
          style={{ paddingBottom: 'calc(var(--tg-safe-area-inset-bottom, env(safe-area-inset-bottom, 0px)) + 12px)' }}
        >
          Notifikasi diperbarui secara real-time
        </div>
      </div>
    </div>
  );
};
