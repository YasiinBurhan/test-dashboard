import React from 'react';
import { motion } from 'motion/react';
import { AzurLizeLogo } from '../components/logo/AzurLizeLogo';
import { Sparkles } from 'lucide-react';

export const SplashPage: React.FC = () => {
  return (
    <div className="fixed inset-0 z-50 bg-slate-950 flex flex-col items-center justify-center p-6 text-center select-none overflow-hidden">
      {/* Background ambient lighting */}
      <div className="absolute -top-32 -left-32 w-80 h-80 bg-sky-500/15 rounded-full blur-3xl pointer-events-none animate-pulse" />
      <div className="absolute -bottom-32 -right-32 w-80 h-80 bg-indigo-600/15 rounded-full blur-3xl pointer-events-none animate-pulse" />

      <motion.div
        initial={{ scale: 0.85, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
        className="flex flex-col items-center gap-6"
      >
        <AzurLizeLogo size="xl" showText={true} />

        <div className="flex items-center gap-2 mt-6 bg-slate-900/80 border border-slate-800 px-3.5 py-1.5 rounded-full shadow-lg">
          <Sparkles className="w-3.5 h-3.5 text-sky-400 animate-spin" style={{ animationDuration: '3s' }} />
          <span className="text-xs font-bold text-slate-300 tracking-wider uppercase">
            Memuat Sistem AzurLize...
          </span>
        </div>

        {/* Smooth 2.2s loading bar fill */}
        <div className="w-56 h-2 bg-slate-900 border border-slate-800 rounded-full overflow-hidden mt-1 relative p-0.5">
          <motion.div
            initial={{ width: '0%' }}
            animate={{ width: '100%' }}
            transition={{ duration: 2.1, ease: 'easeInOut' }}
            className="h-full bg-gradient-to-r from-sky-400 via-blue-500 to-indigo-600 rounded-full shadow-sm shadow-sky-400/50"
          />
        </div>
      </motion.div>

      <div className="absolute bottom-8 left-0 right-0 text-center">
        <p className="text-[11px] text-slate-500 font-semibold tracking-wide">
          AzurLize Team &bull; Recruitment Platform v1.0.0
        </p>
      </div>
    </div>
  );
};

