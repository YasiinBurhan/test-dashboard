import React from 'react';
import { motion } from 'motion/react';
import { Coins, Sparkles, AlertCircle } from 'lucide-react';

export const GajiPage: React.FC = () => {
  return (
    <div className="space-y-6 pb-28">
      {/* Page header */}
      <div>
        <h2 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
          <Coins className="w-5.5 h-5.5 text-emerald-400" />
          <span>Kalkulator & Slip Gaji</span>
        </h2>
        <p className="text-[11px] text-slate-400">
          Sistem komisi, bonus, dan rincian upah mingguan.
        </p>
      </div>

      {/* Under Development Card */}
      <motion.div 
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="flex flex-col items-center justify-center py-16 px-6 text-center space-y-5 bg-slate-950/40 border border-slate-900 rounded-3xl relative overflow-hidden"
      >
        {/* Soft backdrops */}
        <div className="absolute -top-10 -right-10 w-32 h-32 bg-amber-500/5 rounded-full blur-2xl pointer-events-none" />
        <div className="absolute -bottom-10 -left-10 w-32 h-32 bg-emerald-500/5 rounded-full blur-2xl pointer-events-none" />

        <div className="w-16 h-16 rounded-full bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 shadow-lg shadow-amber-950/20 relative">
          <Sparkles className="w-7 h-7 animate-pulse" />
          <AlertCircle className="w-3.5 h-3.5 absolute -bottom-0.5 -right-0.5 text-amber-500" />
        </div>

        <div className="space-y-2.5 max-w-sm relative">
          <h3 className="text-base font-bold text-white">Dalam Pengembangan</h3>
          <p className="text-xs text-slate-400 leading-relaxed">
            Halaman kalkulator gaji, bonus, dan arsip rincian komisi mingguan saat ini sedang disesuaikan oleh tim pengembang kami untuk sinkronisasi sistem otomatis yang lebih presisi.
          </p>
        </div>

        <div className="pt-2 text-[10px] text-slate-500 font-medium">
          AzurLize Recruitment Automation System
        </div>
      </motion.div>
    </div>
  );
};
