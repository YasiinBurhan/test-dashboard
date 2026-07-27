import React, { useState } from 'react';
import { GlassCard } from '../components/common/GlassCard';
import { StatusBadge } from '../components/common/StatusBadge';
import { formatUsername, formatWIBDate } from '../utils/format';
import { useAuth } from '../hooks/useAuth';
import { updateUserPin } from '../firebase/services/userService';
import { User, Mail, Phone, Key, Shield, Hash, ExternalLink, Lock, EyeOff, Eye, Save } from 'lucide-react';

export const ProfilPage: React.FC = () => {
  const { userProfile, telegramUser } = useAuth();
  
  const [pin, setPin] = useState(userProfile?.pin || '');
  const [showPin, setShowPin] = useState(false);
  const [isSavingPin, setIsSavingPin] = useState(false);
  const [pinMessage, setPinMessage] = useState<{text: string, type: 'success'|'error'} | null>(null);

  const handleSavePin = async () => {
    if (!userProfile) return;
    if (pin.length < 4) {
      setPinMessage({ text: 'PIN minimal 4 karakter', type: 'error' });
      return;
    }
    
    setIsSavingPin(true);
    setPinMessage(null);
    try {
      await updateUserPin(userProfile.telegramId, pin);
      setPinMessage({ text: 'PIN berhasil disimpan!', type: 'success' });
      setTimeout(() => setPinMessage(null), 3000);
    } catch (err) {
      setPinMessage({ text: 'Gagal menyimpan PIN', type: 'error' });
    } finally {
      setIsSavingPin(false);
    }
  };

  return (
    <div className="space-y-5">
      <div className="space-y-1">
        <h2 className="text-xl font-extrabold text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
          <User className="w-6 h-6 text-blue-400" />
          <span>Profil Saya</span>
        </h2>
        <p className="text-xs text-slate-600 dark:text-slate-400">
          Identitas dan rincian pendaftaran akun recruiter.
        </p>
      </div>

      <GlassCard className="p-6 space-y-6 border-blue-500/20 text-center">
        {/* Profile Avatar */}
        <div className="flex flex-col items-center gap-3">
          {telegramUser?.photo_url ? (
            <img referrerPolicy="no-referrer"               src={telegramUser.photo_url}
              alt="Profile"
              className="w-20 h-20 rounded-3xl object-cover border-2 border-blue-500/40 shadow-xl"
            />
          ) : (
            <div className="w-20 h-20 rounded-3xl bg-gradient-to-tr from-blue-600 via-sky-500 to-indigo-600 flex items-center justify-center text-slate-900 dark:text-white text-3xl font-black shadow-xl">
              {(userProfile?.firstName?.[0] || telegramUser?.first_name?.[0] || 'A').toUpperCase()}
            </div>
          )}

          <div className="space-y-1">
            <h3 className="text-lg font-extrabold text-slate-900 dark:text-white">
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
        <div className="bg-slate-50 dark:bg-slate-900/80 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 text-left space-y-3.5 text-xs">
          <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-2.5">
            <span className="text-slate-600 dark:text-slate-400 flex items-center gap-2 font-medium">
              <Hash className="w-4 h-4 text-blue-400" /> Telegram ID
            </span>
            <span className="font-mono font-bold text-slate-900 dark:text-white">
              {userProfile?.telegramId || telegramUser?.id}
            </span>
          </div>

          <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-2.5">
            <span className="text-slate-600 dark:text-slate-400 flex items-center gap-2 font-medium">
              <Mail className="w-4 h-4 text-sky-400" /> Email
            </span>
            <span className="font-semibold text-slate-900 dark:text-white">
              {userProfile?.email || '-'}
            </span>
          </div>

          <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-2.5">
            <span className="text-slate-600 dark:text-slate-400 flex items-center gap-2 font-medium">
              <Phone className="w-4 h-4 text-emerald-400" /> WhatsApp
            </span>
            <span className="font-semibold text-slate-900 dark:text-white">
              {userProfile?.whatsapp || '-'}
            </span>
          </div>

          <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-2.5">
            <span className="text-slate-600 dark:text-slate-400 flex items-center gap-2 font-medium">
              <Key className="w-4 h-4 text-amber-400" /> UID 9Kucing
            </span>
            <span className="font-semibold text-slate-900 dark:text-white">
              {userProfile?.akun9Kucing || '-'}
            </span>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-slate-600 dark:text-slate-400 flex items-center gap-2 font-medium">
              <Shield className="w-4 h-4 text-purple-400" /> Tanggal Didaftarkan
            </span>
            <span className="font-semibold text-slate-700 dark:text-slate-300">
              {formatWIBDate(userProfile?.createdAt)}
            </span>
          </div>
        </div>

        {/* PIN Setup for APK Login */}
        <div className="bg-sky-50 dark:bg-slate-900/80 rounded-2xl border border-sky-200 dark:border-sky-900/50 p-4 text-left space-y-3 text-xs">
          <div className="flex flex-col gap-1">
            <span className="text-slate-900 dark:text-white font-bold flex items-center gap-2">
              <Lock className="w-4 h-4 text-sky-500" /> Kode Akses APK (PIN)
            </span>
            <span className="text-[10px] text-slate-600 dark:text-slate-400 leading-relaxed">
              Buat PIN agar Anda bisa login di aplikasi Android (APK) dengan aman. Jangan berikan PIN ini kepada siapapun.
            </span>
          </div>
          
          <div className="flex gap-2 items-center">
            <div className="relative flex-1">
              <input 
                type={showPin ? "text" : "password"}
                value={pin}
                onChange={(e) => setPin(e.target.value)}
                placeholder="Buat PIN Rahasia"
                className="w-full bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2.5 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-sky-500 pr-10 font-mono"
              />
              <button 
                onClick={() => setShowPin(!showPin)}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-sky-500 p-1 cursor-pointer"
              >
                {showPin ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            <button 
              onClick={handleSavePin}
              disabled={isSavingPin || !pin || pin === userProfile?.pin}
              className="bg-sky-500 hover:bg-sky-600 disabled:opacity-50 text-white rounded-xl px-3 py-2.5 font-bold transition-colors cursor-pointer flex items-center gap-1 shrink-0"
            >
              {isSavingPin ? (
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  <Save className="w-4 h-4" /> Simpan
                </>
              )}
            </button>
          </div>
          {pinMessage && (
            <p className={`text-[10px] font-bold ${pinMessage.type === 'success' ? 'text-emerald-500' : 'text-rose-500'}`}>
              {pinMessage.text}
            </p>
          )}
        </div>
      </GlassCard>
    </div>
  );
};
