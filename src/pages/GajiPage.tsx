import React from 'react';
import { motion } from 'motion/react';
import { Coins, Sparkles, ShieldAlert, CheckCircle2, CircleDot, Hourglass, ArrowUpRight } from 'lucide-react';

export const GajiPage: React.FC = () => {
  const steps = [
    { name: 'Desain Database Komisi', status: 'completed', desc: 'Struktur penyimpanan database gaji & rincian bonus.' },
    { name: 'Sistem Formula Otomatis', status: 'completed', desc: 'Kalkulasi otomatis komisi per recruiter.' },
    { name: 'Integrasi & Sinkronisasi', status: 'current', desc: 'Sinkronisasi dengan data harian & laporan mingguan.' },
    { name: 'Peluncuran Fitur Gaji', status: 'upcoming', desc: 'Akan otomatis terbuka untuk semua recruiter.' },
  ];

  return (
    <div className="space-y-6 pb-28 px-1">
      {/* Page header */}
      <div>
        <h2 className="text-xl font-black text-white tracking-tight flex items-center gap-2">
          <Coins className="w-5.5 h-5.5 text-emerald-400" />
          <span>Informasi Gaji & Komisi</span>
        </h2>
        <p className="text-[11px] text-slate-400">
          Sistem komisi, bonus, dan rincian upah mingguan otomatis.
        </p>
      </div>

      {/* Under Development Card */}
      <motion.div 
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: 'easeOut' }}
        className="flex flex-col p-5 sm:p-6 bg-slate-950/60 border border-slate-900 rounded-3xl relative overflow-hidden space-y-6"
      >
        {/* Soft elegant backdrops */}
        <div className="absolute -top-12 -right-12 w-40 h-40 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none animate-pulse" />
        <div className="absolute top-1/2 -left-12 w-40 h-40 bg-sky-500/5 rounded-full blur-3xl pointer-events-none" />

        {/* Hero Section */}
        <div className="flex flex-col items-center text-center space-y-4">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-amber-500/10 to-emerald-500/10 border border-slate-800/80 flex items-center justify-center text-amber-400 shadow-xl shadow-slate-950/50 relative">
            <Sparkles className="w-6 h-6 text-amber-400 animate-bounce" style={{ animationDuration: '3s' }} />
            <ShieldAlert className="w-4 h-4 absolute -bottom-1 -right-1 text-emerald-400 bg-slate-950 rounded-full" />
          </div>

          <div className="space-y-2 max-w-sm">
            <h3 className="text-sm font-black text-white uppercase tracking-wider">Sedang Disiapkan</h3>
            <p className="text-xs text-slate-300 leading-relaxed font-medium">
              Halaman kalkulator gaji, bonus mingguan, dan slip gaji otomatis saat ini sedang dalam <span className="text-emerald-400 font-bold">tahap penyempurnaan akhir</span>.
            </p>
            <p className="text-[10.5px] text-slate-400 leading-relaxed">
              Fitur ini akan otomatis dibuka dan dapat langsung Anda akses secara penuh setelah seluruh sistem sinkronisasi data presisi selesai diuji.
            </p>
          </div>
        </div>

        {/* Interactive Progress Tracker */}
        <div className="p-4 rounded-2xl bg-slate-900/30 border border-slate-900/80 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-900/60 pb-2">
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">Progres Pengembangan</span>
            <span className="text-[10px] font-mono font-black text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full">80% Selesai</span>
          </div>

          <div className="space-y-4">
            {steps.map((step, idx) => (
              <div key={idx} className="flex gap-3">
                <div className="flex flex-col items-center">
                  <div className="shrink-0 mt-0.5">
                    {step.status === 'completed' && (
                      <CheckCircle2 className="w-4.5 h-4.5 text-emerald-500 fill-emerald-500/10" />
                    )}
                    {step.status === 'current' && (
                      <CircleDot className="w-4.5 h-4.5 text-sky-400 animate-pulse" />
                    )}
                    {step.status === 'upcoming' && (
                      <Hourglass className="w-4.5 h-4.5 text-slate-600" />
                    )}
                  </div>
                  {idx < steps.length - 1 && (
                    <div className={`w-[1px] h-10 my-1 ${
                      step.status === 'completed' ? 'bg-emerald-500/30' : 'bg-slate-800'
                    }`} />
                  )}
                </div>
                <div className="space-y-0.5 min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <p className={`text-xs font-bold leading-none ${
                      step.status === 'completed' ? 'text-slate-300' : step.status === 'current' ? 'text-sky-300 font-black' : 'text-slate-500'
                    }`}>
                      {step.name}
                    </p>
                    {step.status === 'current' && (
                      <span className="text-[8px] font-black uppercase tracking-wider text-sky-400 bg-sky-500/10 px-1.5 py-0.2 rounded-md">
                        Proses
                      </span>
                    )}
                  </div>
                  <p className="text-[9.5px] text-slate-400 truncate leading-relaxed">
                    {step.desc}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Bottom tagline */}
        <div className="pt-2 text-center text-[10px] text-slate-500 font-bold tracking-wide uppercase flex items-center justify-center gap-1.5">
          <span>AzurLize Recruitment System</span>
          <ArrowUpRight className="w-3.5 h-3.5 text-slate-600" />
        </div>
      </motion.div>
    </div>
  );
};

