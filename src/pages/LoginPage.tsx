import React, { useState, useEffect } from 'react';
import { GlassCard } from '../components/common/GlassCard';
import { Input } from '../components/common/Input';
import { Button } from '../components/common/Button';
import { AzurLizeLogo } from '../components/logo/AzurLizeLogo';
import { useAuth } from '../hooks/useAuth';
import { formatUsername } from '../utils/format';
import { createUserProfile, getUserProfile } from '../firebase/services/userService';
import { createNotification } from '../firebase/services/notificationService';
import { RegistrationFormData } from '../types';
import { User, Mail, Phone, ShieldCheck, CheckCircle2 } from 'lucide-react';

export const LoginPage: React.FC = () => {
  const { telegramUser, refreshProfile } = useAuth();

  const [formData, setFormData] = useState<RegistrationFormData>({
    email: '',
    whatsapp: '',
    akun9Kucing: '',
    agreedTerms: false
  });

  const [isLoading, setIsLoading] = useState(false);
  const [isCheckingExisting, setIsCheckingExisting] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    const checkExistingUser = async () => {
      if (!telegramUser) {
        if (isMounted) setIsCheckingExisting(false);
        return;
      }
      const telegramId = String(telegramUser.id);
      try {
        const existing = await getUserProfile(telegramId);
        if (existing && isMounted) {
          await refreshProfile();
          return;
        }
      } catch (err) {
        console.warn('Error checking existing user in LoginPage:', err);
      } finally {
        if (isMounted) setIsCheckingExisting(false);
      }
    };

    checkExistingUser();
    return () => { isMounted = false; };
  }, [telegramUser, refreshProfile]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!telegramUser) {
      setError('Pengguna Telegram tidak terdeteksi. Buka aplikasi dari Telegram Bot.');
      return;
    }

    const telegramId = String(telegramUser.id);
    const username = (telegramUser.username || '').trim().replace(/^@/, '');
    const firstName = (telegramUser.first_name || '').trim();
    const lastName = (telegramUser.last_name || '').trim();
    const photoUrl = telegramUser.photo_url || '';

    if (!telegramId) {
      setError('ID Telegram tidak valid.');
      return;
    }

    if (!formData.email || !formData.whatsapp || !formData.akun9Kucing) {
      setError('Mohon isi seluruh bidang pendaftaran.');
      return;
    }

    if (!formData.agreedTerms) {
      setError('Anda wajib menyetujui syarat dan ketentuan rekrutmen.');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // Check if profile already exists to prevent duplication
      // Use a faster check for registration to avoid hanging on slow networks
      const existingProfile = await getUserProfile(telegramId).catch(err => {
        console.warn('Initial profile check failed, proceeding with caution:', err);
        return null;
      });

      if (existingProfile) {
        // Automatically connect and refresh if profile already exists in Firestore!
        await refreshProfile();
        return;
      }

      await createUserProfile({
        telegramId,
        username,
        firstName,
        lastName,
        photoUrl,
        email: formData.email.trim(),
        whatsapp: formData.whatsapp.trim(),
        akun9Kucing: formData.akun9Kucing.trim(),
        role: 'Recruiter',
        status: 'Pending',
        approved: false
      });

      // Send notification to Admin & Owner
      const cleanUsername = username ? username.replace(/^@+/, '') : 'No Username';
      await createNotification({
        targetRole: 'ADMIN_OWNER',
        title: 'Recruiter Baru Mendaftar 👤',
        message: `Recruiter baru ${firstName}${lastName ? ' ' + lastName : ''} (@${cleanUsername}) telah mendaftar dan menunggu persetujuan.`,
        type: 'RECRUITER_REGISTERED',
        senderName: 'System'
      }).catch(err => console.warn('Failed to send registration notification:', err));

      // Instantly refresh profile in AuthContext to transition to pending page
      await refreshProfile();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Gagal mengirim pendaftaran.';
      // Filter out technical jargon from the message if it's still JSON-like
      if (msg.includes('{') && msg.includes('}')) {
        setError('Gagal menghubungkan ke server. Silakan pastikan koneksi internet Anda stabil dan coba lagi.');
      } else {
        setError(msg);
      }
    } finally {
      setIsLoading(false);
    }
  };

  if (isCheckingExisting) {
    return (
      <div 
        style={{ minHeight: 'var(--tg-viewport-height)' }}
        className="bg-white dark:bg-slate-950 flex flex-col items-center justify-center p-4"
      >
        <GlassCard className="max-w-md w-full p-8 text-center space-y-4 border-blue-500/20">
          <AzurLizeLogo size="lg" />
          <div className="flex flex-col items-center gap-3 pt-4">
            <div className="w-8 h-8 border-3 border-sky-400 border-t-transparent rounded-full animate-spin" />
            <p className="text-sm font-bold text-slate-900 dark:text-white">Memeriksa Status Akun...</p>
            <p className="text-xs text-slate-600 dark:text-slate-400">Sedang memverifikasi data pendaftaran Telegram Anda.</p>
          </div>
        </GlassCard>
      </div>
    );
  }

  return (
    <div 
      style={{ minHeight: 'var(--tg-viewport-height)' }}
      className="bg-white dark:bg-slate-950 flex flex-col items-center justify-center p-4 pb-safe pt-safe-header overflow-x-hidden"
    >
      <div className="max-w-md w-full space-y-6">
        <div className="flex flex-col items-center text-center space-y-2">
          <AzurLizeLogo size="lg" />
          <h1 className="text-xl font-extrabold text-slate-900 dark:text-white tracking-tight mt-2">
            Pendaftaran Recruiter
          </h1>
          <p className="text-xs text-slate-600 dark:text-slate-400">
            Lengkapi formulir di bawah untuk mendaftar sebagai tim rekrutmen AzurLize.
          </p>
        </div>

        <GlassCard className="space-y-5 border-blue-500/20">
          {error && (
            <div className="bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs p-3 rounded-2xl flex flex-col gap-2">
              <div className="flex items-center gap-2">
                <span className="font-bold">⚠️</span>
                <span>{error}</span>
              </div>
              <button 
                onClick={() => window.location.reload()}
                className="text-sky-400 font-bold hover:underline self-end"
              >
                Muat Ulang Halaman
              </button>
            </div>
          )}

          {telegramUser ? (
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Auto-detected Telegram User Card */}
              <div className="bg-slate-50 dark:bg-slate-900/80 p-3.5 rounded-2xl border border-slate-200 dark:border-slate-800 flex items-center gap-3">
                {telegramUser.photo_url ? (
                  <img referrerPolicy="no-referrer"                     src={telegramUser.photo_url}
                    alt="Telegram Photo"
                                         className="w-12 h-12 rounded-xl object-cover border border-blue-500/40"
                  />
                ) : (
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-tr from-blue-600 to-sky-400 flex items-center justify-center text-slate-900 dark:text-white font-bold text-lg">
                    {((telegramUser.first_name || 'U')[0] || 'U').toUpperCase()}
                  </div>
                )}
                <div className="flex flex-col text-left overflow-hidden">
                  <span className="text-sm font-bold text-slate-900 dark:text-white truncate">
                    {telegramUser.first_name} {telegramUser.last_name || ''}
                  </span>
                  <span className="text-xs text-sky-400 font-medium">
                    {formatUsername(telegramUser.username)} &bull; ID: {telegramUser.id}
                  </span>
                  <span className="text-[10px] text-slate-500 dark:text-slate-400 flex items-center gap-1 mt-0.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> Terdeteksi Otomatis (Telegram WebApp)
                  </span>
                </div>
              </div>

              {/* User Input Fields */}
              <Input
                label="Email Aktif"
                type="email"
                placeholder="nama@email.com"
                icon={<Mail className="w-4 h-4" />}
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                required
              />

              <Input
                label="Nomor WhatsApp"
                type="tel"
                placeholder="081234567890"
                icon={<Phone className="w-4 h-4" />}
                value={formData.whatsapp}
                onChange={(e) => setFormData({ ...formData, whatsapp: e.target.value })}
                required
              />

              <Input
                label="UID / Akun 9Kucing"
                type="text"
                placeholder="Masukkan ID / Akun 9Kucing"
                icon={<User className="w-4 h-4" />}
                value={formData.akun9Kucing}
                onChange={(e) => setFormData({ ...formData, akun9Kucing: e.target.value })}
                required
              />

              {/* Agreement Checkbox */}
              <label className="flex items-start gap-3 pt-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={formData.agreedTerms}
                  onChange={(e) => setFormData({ ...formData, agreedTerms: e.target.checked })}
                  className="mt-0.5 rounded bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-blue-600 focus:ring-blue-500 w-4 h-4 cursor-pointer"
                />
                <span className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed">
                  Saya menyetujui seluruh <span className="text-blue-400 font-semibold">syarat & ketentuan</span> sebagai tim rekrutmen AzurLizeTeam.
                </span>
              </label>

              <Button
                type="submit"
                fullWidth
                isLoading={isLoading}
                icon={<ShieldCheck className="w-5 h-5" />}
                className="mt-4"
              >
                Kirim Pendaftaran
              </Button>
            </form>
          ) : (
            <div className="text-center py-6 space-y-4">
              <div className="w-16 h-16 rounded-2xl bg-rose-500/10 border border-rose-500/30 flex items-center justify-center mx-auto text-rose-400 text-3xl">
                ⚠️
              </div>
              <div className="space-y-1">
                <p className="text-sm font-bold text-slate-900 dark:text-white">Akun Telegram Tidak Terdeteksi</p>
                <p className="text-xs text-slate-600 dark:text-slate-400 max-w-xs mx-auto leading-relaxed">
                  Sistem tidak dapat mendeteksi kredensial Telegram Anda. Silakan buka aplikasi ini melalui Telegram Bot Anda.
                </p>
              </div>
            </div>
          )}
        </GlassCard>
      </div>
    </div>
  );
};
