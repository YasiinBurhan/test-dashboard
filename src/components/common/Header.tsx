import React from 'react';
import { AzurLizeLogo } from '../logo/AzurLizeLogo';
import { StatusBadge } from './StatusBadge';
import { useAuth } from '../../hooks/useAuth';

interface HeaderProps {
  title?: string;
  showUserBadge?: boolean;
}

export const Header: React.FC<HeaderProps> = ({ title, showUserBadge = true }) => {
  const { userProfile, telegramUser } = useAuth();

  return (
    <header 
      style={{
        backgroundColor: 'var(--tg-header-bg-color, var(--tg-bg-color, rgba(3, 7, 18, 0.95)))',
        borderColor: 'var(--tg-secondary-bg-color, rgba(255, 255, 255, 0.1))',
        paddingTop: 'calc(12px + env(safe-area-inset-top, 0px))'
      }}
      className="sticky top-0 z-40 w-full backdrop-blur-xl border-b px-4 md:px-8 py-3 transition-colors duration-300"
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

        {showUserBadge && (userProfile || telegramUser) && (
          <div className="flex items-center gap-2.5 bg-slate-900/90 backdrop-blur-md p-1.5 pl-3 pr-2 rounded-2xl border border-sky-500/20 shadow-lg shadow-sky-500/5">
            <div className="flex flex-col text-right">
              <span className="text-xs font-black text-white max-w-[95px] truncate leading-tight tracking-tight">
                {userProfile?.firstName || telegramUser?.first_name || 'User'}
              </span>
              {userProfile?.role && (
                <div className="mt-0.5 flex justify-end">
                  <StatusBadge role={userProfile.role} size="sm" />
                </div>
              )}
            </div>
            <div className="relative shrink-0">
              {telegramUser?.photo_url ? (
                <img
                  src={telegramUser.photo_url}
                  alt="Avatar"
                  className="w-8 h-8 rounded-xl object-cover border border-sky-400/50 shadow-md shadow-sky-500/20"
                />
              ) : (
                <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-sky-500 via-blue-600 to-indigo-600 flex items-center justify-center text-white font-black text-xs border border-white/20 shadow-md shadow-sky-500/20">
                  {(userProfile?.firstName?.[0] || telegramUser?.first_name?.[0] || 'A').toUpperCase()}
                </div>
              )}
              <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-emerald-500 rounded-full border-2 border-[var(--tg-bg-color,#030712)]" />
            </div>
          </div>
        )}
      </div>
    </header>
  );
};
