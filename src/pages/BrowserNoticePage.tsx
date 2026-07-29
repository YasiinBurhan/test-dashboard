import React, { useState, useEffect } from 'react';
import { GlassCard } from '../components/common/GlassCard';
import { AzurLizeLogo } from '../components/logo/AzurLizeLogo';
import { Button } from '../components/common/Button';
import { Input } from '../components/common/Input';
import { useAuth } from '../hooks/useAuth';
import { LogIn, UserPlus, ChevronLeft, Hash, User, ShieldAlert, Lock, Smartphone, HelpCircle } from 'lucide-react';

export const BrowserNoticePage: React.FC = () => {
  const { loginManually, registerManually } = useAuth();
  
  const [showManualForm, setShowManualForm] = useState(false);
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [telegramId, setTelegramId] = useState('');
  const [pin, setPin] = useState('');
  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isAndroid, setIsAndroid] = useState(false);
  const [showForgotPinMsg, setShowForgotPinMsg] = useState(false);

  // Detect if running on an Android device browser or user agent
  useEffect(() => {
    const isAnd = typeof navigator !== 'undefined' && /Android/i.test(navigator.userAgent);
    setIsAndroid(isAnd);
    if (isAnd) {
      // Auto-open login form directly for Android users
      setShowManualForm(true);
    }
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const cleanId = telegramId.trim();
    if (!cleanId) {
      setError('Mohon masukkan ID Telegram Anda.');
      return;
    }

    setIsLoading(true);
    try {
      const result = await loginManually(cleanId, pin, name.trim(), username.trim());
      if (!result.success) {
        setError(result.error || 'Gagal masuk.');
      }
    } catch (err) {
      setError('Terjadi kesalahan koneksi.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRegister = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const cleanId = telegramId.trim();
    if (!cleanId) {
      setError('Mohon masukkan ID Telegram Anda untuk mendaftar.');
      return;
    }

    if (!name.trim()) {
      setError('Mohon masukkan Nama Anda untuk pendaftaran.');
      return;
    }

    registerManually(cleanId, name.trim(), username.trim());
  };

  return (
    <div
      style={{
        backgroundColor: 'var(--tg-bg-color, #030712)',
        color: 'var(--tg-text-color, #f8fafc)',
        minHeight: 'var(--tg-viewport-height)'
      }}
      className="flex flex-col items-center justify-center p-5 pt-safe-header pb-safe text-center transition-colors duration-300 bg-mesh-gradient overflow-x-hidden"
    >
      <GlassCard className="max-w-md w-full p-6 space-y-6 border border-slate-200 dark:border-slate-800/80 shadow-sm relative overflow-hidden">
        {/* Decorative elements */}
        <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/5 rounded-full blur-2xl pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-32 h-32 bg-sky-500/5 rounded-full blur-2xl pointer-events-none" />

        <div className="flex justify-center">
          <AzurLizeLogo size="lg" />
        </div>

        {!isAndroid ? (
          /* BLOCK SCREEN FOR NON-ANDROID DEVICES */
          <div className="space-y-6">
            <div className="w-16 h-16 rounded-3xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center mx-auto text-amber-500 dark:text-amber-400">
              <Smartphone className="w-8 h-8" />
            </div>

            <div className="space-y-2">
              <h2 className="text-xl font-extrabold text-slate-900 dark:text-white tracking-tight">
                Akses Khusus Perangkat Android
              </h2>
              <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed font-medium">
                Maaf, web ini dirancang khusus untuk dibuka melalui browser perangkat <span className="text-sky-400 font-bold">Android</span> atau langsung di dalam <span className="text-sky-400 font-bold">Telegram Mini App</span>.
              </p>
            </div>

            <div className="bg-slate-50 dark:bg-slate-900/80 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 text-left space-y-2 text-xs">
              <p className="font-bold text-slate-800 dark:text-slate-200">Cara Mengakses Aplikasi:</p>
              <ul className="list-disc list-inside space-y-1.5 text-slate-700 dark:text-slate-300 font-medium">
                <li>Buka link ini menggunakan smartphone <strong className="text-sky-400 font-bold">Android</strong> Anda.</li>
                <li>Atau buka Bot Rekrutmen kami di Telegram: <strong className="text-sky-400 font-bold">@azurlize_recruitment_bot</strong> lalu jalankan aplikasi.</li>
              </ul>
            </div>

            <div className="pt-2 border-t border-slate-200 dark:border-slate-800/60 flex flex-col gap-3">
              <Button
                fullWidth
                onClick={() => {
                  window.location.href = 'https://t.me/azurlize_recruitment_bot';
                }}
              >
                Buka Telegram Bot
              </Button>
            </div>
          </div>
        ) : !showManualForm ? (
          /* SECTION 1: INSTRUCTIONS FOR ANDROID USERS IF NOT CURRENTLY SHOWING FORM (Fallback option) */
          <div className="space-y-6">
            <div className="w-16 h-16 rounded-3xl bg-sky-500/10 border border-sky-500/30 flex items-center justify-center mx-auto text-sky-500 dark:text-sky-400 text-3xl">
              📱
            </div>

            <div className="space-y-2">
              <h2 className="text-xl font-extrabold text-slate-900 dark:text-white tracking-tight">
                Akses Perangkat Android
              </h2>
              <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed">
                Anda berada di perangkat Android. Kami merekomendasikan membuka aplikasi rekrutmen <strong className="text-sky-400 font-bold">AzurLizeTeam</strong> langsung melalui Telegram Mini App dari Bot kami.
              </p>
            </div>

            <div className="bg-slate-50 dark:bg-slate-900/80 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 text-left space-y-2 text-xs">
              <p className="font-bold text-slate-800 dark:text-slate-200">Buka via Telegram:</p>
              <ol className="list-decimal list-inside space-y-1.5 text-slate-700 dark:text-slate-300 font-medium">
                <li>Buka aplikasi Telegram Anda.</li>
                <li>Cari Bot Rekrutmen <strong className="text-sky-400 font-bold">@azurlize_recruitment_bot</strong></li>
                <li>Tekan tombol <strong className="text-sky-400 font-bold">"Buka Web App"</strong> atau ketik <code className="text-amber-300 bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded border border-slate-300 dark:border-slate-700">/app</code></li>
              </ol>
            </div>

            <div className="pt-2 border-t border-slate-200 dark:border-slate-800/60 flex flex-col gap-3">
              <Button
                fullWidth
                onClick={() => {
                  window.location.href = 'https://t.me/azurlize_recruitment_bot';
                }}
              >
                Buka Telegram Bot
              </Button>

              <button
                type="button"
                onClick={() => setShowManualForm(true)}
                className="text-xs font-bold text-sky-400 hover:text-sky-300 transition-colors py-1 hover:underline cursor-pointer"
              >
                Tetap Masuk via Web Browser
              </button>
            </div>
          </div>
        ) : (
          /* SECTION 2: MANUAL LOGIN / REGISTER FORM FOR GENUINE ANDROID USERS */
          <div className="space-y-4 text-left">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800/60 pb-3">
              <button
                type="button"
                onClick={() => {
                  setShowManualForm(false);
                }}
                className="flex items-center gap-1 text-xs font-bold transition-colors text-slate-600 dark:text-slate-400 hover:text-slate-950 dark:hover:text-white cursor-pointer"
              >
                <ChevronLeft className="w-4 h-4" /> Buka via Bot
              </button>
              <span className="text-[10px] bg-sky-500/10 border border-sky-500/30 px-2 py-0.5 rounded-full text-sky-400 font-bold">
                Browser Android
              </span>
            </div>

            {/* MODE TOGGLE SWITCH: Masuk Akun Terdaftar VS Daftar Baru */}
            <div className="grid grid-cols-2 gap-1 p-1 bg-slate-50 dark:bg-slate-900/90 rounded-2xl border border-slate-200 dark:border-slate-800">
              <button
                type="button"
                onClick={() => { setMode('login'); setError(null); }}
                className={`py-2 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                  mode === 'login'
                    ? 'bg-sky-600 text-white shadow-md'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-200'
                }`}
              >
                <LogIn className="w-3.5 h-3.5" />
                <span>Masuk Akun</span>
              </button>
              <button
                type="button"
                onClick={() => { setMode('register'); setError(null); }}
                className={`py-2 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                  mode === 'register'
                    ? 'bg-sky-600 text-white shadow-md'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-200'
                }`}
              >
                <UserPlus className="w-3.5 h-3.5" />
                <span>Daftar Baru</span>
              </button>
            </div>

            {error && (
              <div className="bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs p-3 rounded-2xl flex items-start gap-2">
                <ShieldAlert className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                <span className="font-medium">{error}</span>
              </div>
            )}

            {mode === 'login' ? (
              <form onSubmit={handleLogin} className="space-y-4">
                <div className="bg-sky-500/10 border border-sky-500/20 p-3 rounded-2xl text-xs text-sky-300 space-y-1">
                  <p className="font-bold">🔐 Masuk Akun Aktif Anda</p>
                  <p className="text-[11px] text-slate-700 dark:text-slate-300">
                    Masukkan ID Telegram Anda untuk masuk ke dashboard secara instan.
                  </p>
                </div>

                <Input
                  label="ID Telegram Anda"
                  type="number"
                  placeholder="Contoh: 123456789"
                  icon={<Hash className="w-4 h-4" />}
                  value={telegramId}
                  onChange={(e) => setTelegramId(e.target.value)}
                  required
                  className="[appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                />
                <Input
                  label="Kode Akses (PIN)"
                  type="password"
                  placeholder="Kosongkan jika belum mengatur PIN"
                  icon={<Lock className="w-4 h-4" />}
                  value={pin}
                  onChange={(e) => setPin(e.target.value)}
                />

                <div className="flex justify-end -mt-3 pr-1">
                  <button
                    type="button"
                    onClick={() => setShowForgotPinMsg(!showForgotPinMsg)}
                    className="text-[11px] font-semibold text-sky-400 hover:text-sky-300 transition-colors hover:underline cursor-pointer"
                  >
                    Lupa PIN / Kode Akses?
                  </button>
                </div>

                {showForgotPinMsg && (
                  <div className="bg-amber-500/10 border border-amber-500/25 p-3.5 rounded-2xl text-[11px] text-amber-300 space-y-1.5 leading-relaxed border-dashed">
                    <p className="font-bold flex items-center gap-1.5 text-amber-400 text-xs">
                      💡 Cara Mendapatkan PIN:
                    </p>
                    <ol className="list-decimal list-inside space-y-1 pl-1 text-slate-300 font-medium text-left">
                      <li>Buka Bot Telegram: <a href="https://t.me/azurlize_recruitment_bot" target="_blank" rel="noopener noreferrer" className="text-sky-400 underline hover:text-sky-300 font-bold">@azurlize_recruitment_bot</a></li>
                      <li>Kirim perintah <code className="text-amber-300 bg-slate-800/80 px-1 py-0.5 rounded border border-slate-700 font-mono">/pin</code></li>
                      <li>Bot akan mengirimkan ID Telegram dan Kode PIN login Anda secara instan dan aman.</li>
                    </ol>
                  </div>
                )}

                <p className="text-[10px] text-slate-500 dark:text-slate-400 -mt-2 pl-1 leading-relaxed">
                  *Dapatkan ID dari bot Telegram seperti <span className="text-sky-400 font-bold">@userinfobot</span> (ketik /id).
                </p>

                <Button
                  type="submit"
                  fullWidth
                  isLoading={isLoading}
                  icon={<LogIn className="w-4 h-4" />}
                  className="bg-sky-600 hover:bg-sky-500 text-white rounded-2xl cursor-pointer font-bold py-3"
                >
                  Masuk Sekarang
                </Button>
              </form>
            ) : (
              <form onSubmit={handleRegister} className="space-y-4">
                <Input
                  label="ID Telegram Anda"
                  type="number"
                  placeholder="Contoh: 123456789"
                  icon={<Hash className="w-4 h-4" />}
                  value={telegramId}
                  onChange={(e) => setTelegramId(e.target.value)}
                  required
                  className="[appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                />

                <Input
                  label="Nama Lengkap"
                  type="text"
                  placeholder="Masukkan Nama Anda"
                  icon={<User className="w-4 h-4" />}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                />

                <Input
                  label="Username Telegram (Opsional)"
                  type="text"
                  placeholder="Contoh: username_anda (tanpa @)"
                  icon={<span className="text-xs text-slate-600 dark:text-slate-400 font-bold">@</span>}
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                />

                <Button
                  type="submit"
                  fullWidth
                  variant="secondary"
                  icon={<UserPlus className="w-4 h-4" />}
                  className="bg-sky-600 hover:bg-sky-500 text-white rounded-2xl cursor-pointer font-bold py-3"
                >
                  Daftar Akun Baru
                </Button>
              </form>
            )}
          </div>
        )}
      </GlassCard>
    </div>
  );
};
