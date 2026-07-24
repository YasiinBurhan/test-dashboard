import React, { useEffect, useState } from 'react';
import { GlassCard } from '../components/common/GlassCard';
import { Announcement } from '../types';
import { subscribeToAnnouncements } from '../firebase/services/announcementService';
import { formatWIBDate } from '../utils/format';
import { Megaphone, Pin, Calendar, RefreshCw } from 'lucide-react';

export const PengumumanPage: React.FC = () => {
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    setIsLoading(true);
    const unsubscribe = subscribeToAnnouncements((data) => {
      setAnnouncements(data || []);
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, []);

  return (
    <div className="space-y-5 pb-28">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-extrabold text-white tracking-tight flex items-center gap-2">
            <Megaphone className="w-6 h-6 text-amber-400" />
            <span>Pengumuman Rekrutmen</span>
          </h2>
          <p className="text-xs text-slate-400">
            Instruksi, regulasi, dan informasi penting dari manajemen.
          </p>
        </div>

        <button
          onClick={() => {}}
          disabled={isLoading}
          className="p-2.5 rounded-2xl bg-slate-900 border border-slate-800 text-slate-300 hover:text-white"
        >
          <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      <div className="space-y-3">
        {isLoading ? (
          <div className="py-12 text-center text-slate-400 text-xs">
            Memuat pengumuman...
          </div>
        ) : announcements.length === 0 ? (
          <GlassCard className="py-12 text-center text-slate-400 space-y-2">
            <Megaphone className="w-10 h-10 text-slate-600 mx-auto" />
            <p className="text-sm font-semibold text-slate-300">Belum Ada Pengumuman</p>
            <p className="text-xs text-slate-500">
              Pengumuman dari Admin dan Owner akan muncul di sini.
            </p>
          </GlassCard>
        ) : (
          announcements.map((ann) => (
            <GlassCard
              key={ann.id}
              className={`p-5 space-y-3 border-slate-800 ${
                ann.pinned ? 'border-amber-500/40 bg-gradient-to-br from-slate-900 via-slate-900 to-amber-950/20' : ''
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <h3 className="text-base font-extrabold text-white tracking-tight leading-snug">
                  {ann.title}
                </h3>
                {ann.pinned && (
                  <span className="shrink-0 text-[10px] bg-amber-500/20 text-amber-300 px-2.5 py-1 rounded-full border border-amber-500/30 font-bold flex items-center gap-1">
                    <Pin className="w-3 h-3" /> Pinned
                  </span>
                )}
              </div>

              <div className="text-xs text-slate-200 whitespace-pre-line leading-relaxed border-t border-slate-800/80 pt-3">
                {ann.content}
              </div>

              <div className="flex items-center justify-between text-[11px] text-slate-500 pt-1 border-t border-slate-800/40">
                <span className="font-semibold text-sky-400">Oleh: {ann.author}</span>
                <span className="flex items-center gap-1">
                  <Calendar className="w-3 h-3" />
                  {formatWIBDate(ann.createdAt)}
                </span>
              </div>
            </GlassCard>
          ))
        )}
      </div>
    </div>
  );
};
