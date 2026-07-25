import React, { useState, useEffect } from 'react';
import { Smartphone, PlusSquare, X, ChevronRight, MoreVertical, Share, Sparkles } from 'lucide-react';
import { AddToHomeScreenModal } from './AddToHomeScreenModal';

export const AddToHomeScreenNotice: React.FC = () => {
  const [isDismissed, setIsDismissed] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);

  useEffect(() => {
    const dismissed = localStorage.getItem('azurlize_pwa_notice_dismissed');
    if (dismissed === 'true') {
      setIsDismissed(true);
    }
  }, []);

  const handleDismiss = () => {
    setIsDismissed(true);
    localStorage.setItem('azurlize_pwa_notice_dismissed', 'true');
  };

  const handleOpenNotice = () => {
    setIsModalOpen(true);
  };

  if (isDismissed) {
    return (
      <>
        {/* Compact pill banner when dismissed */}
        <div className="flex items-center justify-between px-3.5 py-2 rounded-2xl bg-slate-900/80 border border-sky-500/20 backdrop-blur-md text-xs text-slate-300">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-sky-400 shrink-0" />
            <span>Akses Cepat: <strong className="text-white">Tambah ke Beranda HP</strong></span>
          </div>
          <button
            onClick={handleOpenNotice}
            className="px-2.5 py-1 rounded-lg bg-sky-500/10 hover:bg-sky-500/20 text-sky-400 font-semibold text-[11px] border border-sky-500/30 transition-colors cursor-pointer"
          >
            Petunjuk
          </button>
        </div>

        <AddToHomeScreenModal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
        />
      </>
    );
  }

  return (
    <>
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-sky-950/80 via-slate-900/90 to-blue-950/80 border border-sky-500/30 p-4 shadow-lg shadow-sky-950/40 backdrop-blur-md animate-in fade-in duration-300">
        <div className="absolute top-0 right-0 w-32 h-32 bg-sky-500/10 rounded-full blur-2xl pointer-events-none" />

        <div className="flex items-start justify-between gap-3 relative z-10">
          <div className="flex items-start gap-3">
            <div className="p-2.5 rounded-2xl bg-gradient-to-br from-sky-500 to-blue-600 text-white shadow-md shadow-sky-500/30 shrink-0 mt-0.5">
              <Smartphone className="w-5 h-5" />
            </div>
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <h4 className="text-xs md:text-sm font-bold text-white tracking-tight">
                  Tambah Aplikasi ke Layar Utama (Beranda HP)
                </h4>
                <span className="px-2 py-0.5 rounded-full bg-sky-500/20 border border-sky-400/30 text-sky-300 text-[10px] font-bold">
                  Penting
                </span>
              </div>
              <p className="text-[11px] md:text-xs text-slate-300 leading-relaxed">
                Buka bot lebih cepat! Klik menu <strong>titik tiga (⋮)</strong> di pojok kanan atas layar Telegram / browser ini, lalu pilih <strong className="text-sky-300">"Tambah ke Beranda"</strong> untuk memasang pintasan.
              </p>
            </div>
          </div>

          <button
            onClick={handleDismiss}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer shrink-0"
            title="Sembunyikan"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="mt-3 pt-3 border-t border-slate-800/80 flex items-center justify-between gap-2 text-[11px]">
          <div className="flex items-center gap-1.5 text-slate-400">
            <span>Panduan:</span>
            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-slate-800 text-slate-200 font-mono text-[10px]">
              <MoreVertical className="w-3 h-3 text-sky-400" /> Menu → <Share className="w-3 h-3 text-sky-400" /> Tambah ke Beranda
            </span>
          </div>

          <button
            onClick={handleOpenNotice}
            className="px-3 py-1.5 rounded-xl bg-sky-500 hover:bg-sky-400 text-slate-950 font-bold text-xs flex items-center gap-1 shadow-md shadow-sky-500/20 transition-all cursor-pointer active:scale-95 shrink-0"
          >
            <PlusSquare className="w-3.5 h-3.5" />
            <span>Buka Petunjuk</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      <AddToHomeScreenModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
      />
    </>
  );
};
