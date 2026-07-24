import React from 'react';
import { GlassCard } from '../components/common/GlassCard';
import { StatusBadge } from '../components/common/StatusBadge';
import { formatUsername, formatWIBDate } from '../utils/format';
import { useAuth } from '../hooks/useAuth';
import { User, Mail, Phone, Key, Shield, Hash, LogOut, ExternalLink } from 'lucide-react';

export const ProfilPage: React.FC = () => {
  const { userProfile, telegramUser, logout } = useAuth();

  return (
    <div className="space-y-5 pb-28">
      <div className="space-y-1">
        <h2 className="text-xl font-extrabold text-white tracking-tight flex items-center gap-2">
          <User className="w-6 h-6 text-blue-400" />
          <span>Profil Saya</span>
        </h2>
        <p className="text-xs text-slate-400">
          Identitas dan rincian pendaftaran akun recruiter.
        </p>
      </div>

      <GlassCard className="p-6 space-y-6 border-blue-500/20 text-center">
        {/* Profile Avatar */}
        <div className="flex flex-col items-center gap-3">
          {telegramUser?.photo_url ? (
            <img
              src={telegramUser.photo_url}
              alt="Profile"
              className="w-20 h-20 rounded-3xl object-cover border-2 border-blue-500/40 shadow-xl"
            />
          ) : (
            <div className="w-20 h-20 rounded-3xl bg-gradient-to-tr from-blue-600 via-sky-500 to-indigo-600 flex items-center justify-center text-white text-3xl font-black shadow-xl">
              {(userProfile?.firstName?.[0] || telegramUser?.first_name?.[0] || 'A').toUpperCase()}
            </div>
          )}

          <div className="space-y-1">
            <h3 className="text-lg font-extrabold text-white">
              {userProfile?.firstName} {userProfile?.lastName}
            </h3>
            <span className="text-xs font-semibold text-sky-400 block">
              {formatUsername(userProfile?.username || telegramUser?.username)}
            </span>
            <div className="flex items-center justify-center gap-2 pt-1">
              {userProfile?.role && <StatusBadge role={userProfile.role} />}
              {userProfile?.status && <StatusBadge status={userProfile.status} />}
            </div>
          </div>
        </div>

        {/* Detailed Fields */}
        <div className="bg-slate-900/80 rounded-2xl border border-slate-800 p-4 text-left space-y-3.5 text-xs">
          <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
            <span className="text-slate-400 flex items-center gap-2 font-medium">
              <Hash className="w-4 h-4 text-blue-400" /> Telegram ID
            </span>
            <span className="font-mono font-bold text-white">
              {userProfile?.telegramId || telegramUser?.id}
            </span>
          </div>

          <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
            <span className="text-slate-400 flex items-center gap-2 font-medium">
              <Mail className="w-4 h-4 text-sky-400" /> Email
            </span>
            <span className="font-semibold text-white">
              {userProfile?.email || '-'}
            </span>
          </div>

          <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
            <span className="text-slate-400 flex items-center gap-2 font-medium">
              <Phone className="w-4 h-4 text-emerald-400" /> WhatsApp
            </span>
            <span className="font-semibold text-white">
              {userProfile?.whatsapp || '-'}
            </span>
          </div>

          <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
            <span className="text-slate-400 flex items-center gap-2 font-medium">
              <Key className="w-4 h-4 text-amber-400" /> UID 9Kucing
            </span>
            <span className="font-semibold text-white">
              {userProfile?.akun9Kucing || '-'}
            </span>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-slate-400 flex items-center gap-2 font-medium">
              <Shield className="w-4 h-4 text-purple-400" /> Tanggal Didaftarkan
            </span>
            <span className="font-semibold text-slate-300">
              {formatWIBDate(userProfile?.createdAt)}
            </span>
          </div>
        </div>

        {/* Logout Button */}
        <button
          onClick={logout}
          className="w-full py-3 px-4 bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 rounded-2xl border border-rose-500/20 font-semibold text-xs flex items-center justify-center gap-2 transition-colors cursor-pointer"
        >
          <LogOut className="w-4 h-4" /> Keluar Sesi Local / Reset Dev Testing
        </button>
      </GlassCard>
    </div>
  );
};
