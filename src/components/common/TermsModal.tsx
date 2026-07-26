import React from 'react';
import { GlassCard } from './GlassCard';
import { X, ScrollText, ShieldCheck, CheckCircle2, Lock, FileSpreadsheet } from 'lucide-react';

interface TermsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const TermsModal: React.FC<TermsModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-white dark:bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200">
      <GlassCard className="max-w-lg w-full max-h-[85vh] flex flex-col p-0 border-amber-500/30 overflow-hidden shadow-2xl">
        {/* Modal Header */}
        <div className="p-4 md:p-5 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/90 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20">
              <ScrollText className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white tracking-tight">Syarat & Ketentuan Penggunaan</h3>
              <p className="text-[11px] text-slate-600 dark:text-slate-400">AzurLize Recruitment Platform</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:text-white hover:bg-slate-100 dark:bg-slate-800 cursor-pointer transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Content - Scrollable */}
        <div className="p-5 overflow-y-auto space-y-4 text-xs text-slate-700 dark:text-slate-300 leading-relaxed custom-scrollbar">
          <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 space-y-1.5">
            <div className="flex items-center gap-2 text-amber-400 font-semibold">
              <ShieldCheck className="w-4 h-4 shrink-0" />
              <span>1. Keanggotaan Tim Rekrutmen</span>
            </div>
            <p className="text-slate-600 dark:text-slate-400 text-[11px] leading-normal">
              Setiap anggota yang terdaftar di platform AzurLize telah disetujui secara resmi oleh Admin/Owner. Akun bersifat pribadi dan tidak diperkenankan dipindahtandagankan atau digunakan oleh pihak ketiga.
            </p>
          </div>

          <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 space-y-1.5">
            <div className="flex items-center gap-2 text-sky-400 font-semibold">
              <FileSpreadsheet className="w-4 h-4 shrink-0" />
              <span>2. Pelaporan & Kejujuran Data</span>
            </div>
            <p className="text-slate-600 dark:text-slate-400 text-[11px] leading-normal">
              Setiap rekruter wajib menginputkan data postingan harian, calon pekerja, dan laporan penempatan secara akurat dan tepat waktu. Manipulasi data atau duplikasi laporan dapat menyebabkan penangguhan akun (Suspended).
            </p>
          </div>

          <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 space-y-1.5">
            <div className="flex items-center gap-2 text-emerald-400 font-semibold">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>3. Sistem Komisi & Gaji</span>
            </div>
            <p className="text-slate-600 dark:text-slate-400 text-[11px] leading-normal">
              Perhitungan gaji harian, bonus target, dan komisi penempatan dihitung otomatis secara transparan berdasarkan kriteria yang telah disepakati bersama manajemen AzurLizeTeam.
            </p>
          </div>

          <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 space-y-1.5">
            <div className="flex items-center gap-2 text-purple-400 font-semibold">
              <Lock className="w-4 h-4 shrink-0" />
              <span>4. Kerahasiaan Data & Keamanan</span>
            </div>
            <p className="text-slate-600 dark:text-slate-400 text-[11px] leading-normal">
              Seluruh informasi pelamar, data akun, dan catatan internal AzurLize dilindungi dan dilarang untuk disebarluaskan di luar kepentingan operasional rekrutmen.
            </p>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="p-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/90 flex justify-end shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="w-full sm:w-auto px-5 py-2.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-bold rounded-xl text-xs transition-all shadow-md active:scale-95 cursor-pointer"
          >
            Saya Mengerti
          </button>
        </div>
      </GlassCard>
    </div>
  );
};
