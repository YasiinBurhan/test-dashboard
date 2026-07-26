import React, { useState, useEffect } from 'react';
import { GlassCard } from './GlassCard';
import { X, PlusSquare, Check, Share, MoreVertical } from 'lucide-react';
import appIconImg from '../../assets/images/azurlize_app_icon_1784976691348.jpg';

interface AddToHomeScreenModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AddToHomeScreenModal: React.FC<AddToHomeScreenModalProps> = ({ isOpen, onClose }) => {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isInstalled, setIsInstalled] = useState(false);

  useEffect(() => {
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  const handleInstallClick = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') {
        setIsInstalled(true);
      }
      setDeferredPrompt(null);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-white dark:bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200">
      <GlassCard className="max-w-md w-full p-0 border-sky-500/30 overflow-hidden shadow-2xl">
        {/* Modal Header */}
        <div className="p-4 md:p-5 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/90 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-0.5 rounded-xl bg-gradient-to-br from-sky-500 to-blue-600 shrink-0">
              <img referrerPolicy="no-referrer"                 src={appIconImg}
                alt="AzurLize Logo"
                className="w-8 h-8 rounded-lg object-cover"
              />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white tracking-tight">Tambah ke Beranda</h3>
              <p className="text-[11px] text-slate-600 dark:text-slate-400">Pintasan Aplikasi AzurLize</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:text-white hover:bg-slate-100 dark:bg-slate-800 cursor-pointer transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 space-y-4 text-xs text-slate-700 dark:text-slate-300">
          {/* App Preview Card */}
          <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 flex items-center gap-3.5 shadow-inner">
            <img referrerPolicy="no-referrer"               src={appIconImg}
              alt="AzurLize App Icon"
              className="w-12 h-12 rounded-2xl object-cover shadow-lg shadow-sky-500/20 border border-sky-500/40 shrink-0"
            />
            <div>
              <h4 className="text-xs font-bold text-slate-900 dark:text-white">AzurLize Recruitment Platform</h4>
              <p className="text-[11px] text-slate-600 dark:text-slate-400">AzurLizeTeam Official Mini App</p>
            </div>
          </div>

          {deferredPrompt ? (
            <div className="text-center space-y-3 py-2">
              <p className="text-slate-700 dark:text-slate-300">
                Pintasan aplikasi dengan ikon resmi AzurLize siap dipasang ke layar utama HP Anda.
              </p>
              <button
                type="button"
                onClick={handleInstallClick}
                className="w-full py-3 px-4 bg-gradient-to-r from-sky-500 to-blue-600 hover:from-sky-400 hover:to-blue-500 text-slate-900 dark:text-white font-bold rounded-xl text-xs flex items-center justify-center gap-2 shadow-lg shadow-sky-500/20 active:scale-95 cursor-pointer transition-all"
              >
                <PlusSquare className="w-4 h-4" /> Pasang Pintasan Sekarang
              </button>
            </div>
          ) : isInstalled ? (
            <div className="text-center space-y-2 py-4 text-emerald-400 font-semibold">
              <div className="w-12 h-12 rounded-full bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center mx-auto">
                <Check className="w-6 h-6" />
              </div>
              <p>Ikon aplikasi berhasil ditambahkan ke Beranda!</p>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-slate-700 dark:text-slate-300 leading-relaxed">
                Untuk kemudahan akses cepat tanpa membuka chat Telegram, Anda dapat menambahkan pintasan aplikasi dengan foto ikon AzurLize ke layar utama (Home Screen) smartphone Anda:
              </p>

              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 space-y-2">
                <div className="flex items-start gap-2.5">
                  <span className="w-5 h-5 rounded-full bg-sky-500/20 text-sky-400 font-bold text-[10px] flex items-center justify-center shrink-0 mt-0.5">1</span>
                  <p className="text-slate-700 dark:text-slate-300 text-[11px]">
                    Tekan tombol titik tiga <MoreVertical className="w-3.5 h-3.5 inline text-sky-400" /> di pojok kanan atas aplikasi Telegram / Browser.
                  </p>
                </div>
                <div className="flex items-start gap-2.5">
                  <span className="w-5 h-5 rounded-full bg-sky-500/20 text-sky-400 font-bold text-[10px] flex items-center justify-center shrink-0 mt-0.5">2</span>
                  <p className="text-slate-700 dark:text-slate-300 text-[11px]">
                    Pilih menu <strong className="text-slate-900 dark:text-white">"Tambah ke Beranda"</strong> atau <strong className="text-slate-900 dark:text-white">"Add to Home Screen"</strong> / <Share className="w-3.5 h-3.5 inline text-sky-400" />.
                  </p>
                </div>
                <div className="flex items-start gap-2.5">
                  <span className="w-5 h-5 rounded-full bg-sky-500/20 text-sky-400 font-bold text-[10px] flex items-center justify-center shrink-0 mt-0.5">3</span>
                  <p className="text-slate-700 dark:text-slate-300 text-[11px]">
                    Foto ikon AzurLize akan muncul di layar utama smartphone untuk akses instan!
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/90 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="w-full sm:w-auto px-5 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold rounded-xl text-xs cursor-pointer transition-colors"
          >
            Tutup
          </button>
        </div>
      </GlassCard>
    </div>
  );
};
