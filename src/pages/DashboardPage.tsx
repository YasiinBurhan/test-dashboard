import React, { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { GlassCard } from '../components/common/GlassCard';
import { StatusBadge } from '../components/common/StatusBadge';
import { TabType } from '../components/navigation/BottomNav';
import { useAuth } from '../hooks/useAuth';
import { useReports } from '../hooks/useReports';
import { formatUsername, formatWIBDate } from '../utils/format';
import { Announcement } from '../types';
import { subscribeToAnnouncements } from '../firebase/services/announcementService';
import { subscribeToSystemSettings } from '../firebase/services/settingService';
import { 
  ClipboardPen, 
  CalendarClock,
  Clock3, 
  BellRing, 
  BarChart2, 
  UserCheck, 
  ShieldCheck, 
  Crown, 
  ChevronRight, 
  Megaphone, 
  Users, 
  Sparkles, 
  TrendingUp,
  Coins
} from 'lucide-react';

interface DashboardPageProps {
  setActiveTab: (tab: TabType) => void;
}

export const DashboardPage: React.FC<DashboardPageProps> = ({ setActiveTab }) => {
  const { userProfile, telegramUser } = useAuth();
  const { reports } = useReports();
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [announcementHeader, setAnnouncementHeader] = useState<string>('');

  useEffect(() => {
    const unsubAnn = subscribeToAnnouncements((anns) => {
      setAnnouncements(anns || []);
    });

    const unsubSettings = subscribeToSystemSettings((sysSettings) => {
      if (sysSettings?.announcementHeader) {
        setAnnouncementHeader(sysSettings.announcementHeader);
      }
    });

    return () => {
      unsubAnn();
      unsubSettings();
    };
  }, []);

  // Calculate my stats - only from approved (ACC) reports
  const approvedReports = reports.filter(curr => curr.result === 'ACC');
  const totalVisits = approvedReports.reduce((acc, curr) => acc + (curr.visit || 0), 0);
  const totalApplicants = approvedReports.reduce((acc, curr) => acc + (curr.applicant || 0), 0);
  const totalQuality = approvedReports.reduce((acc, curr) => acc + (curr.quality || 0), 0);
  const totalPostings = approvedReports.reduce((acc, curr) => acc + (curr.posting || 0), 0);

  const quickMenus = [
    {
      id: 'data_harian' as TabType,
      title: 'Data Harian',
      desc: 'Siklus data harian baru',
      icon: CalendarClock,
      color: 'from-emerald-400 via-teal-500 to-sky-600',
      glow: 'shadow-emerald-500/20 hover:shadow-emerald-500/40',
      badge: 'Harian'
    },
    {
      id: 'laporan' as TabType,
      title: 'Form Laporan',
      desc: 'Isi & kirim laporan',
      icon: ClipboardPen,
      color: 'from-sky-400 via-blue-500 to-indigo-600',
      glow: 'shadow-sky-500/20 hover:shadow-sky-500/40',
      badge: 'Utama'
    },
    {
      id: 'gaji' as TabType,
      title: 'Gaji Saya',
      desc: 'Estimasi & rincian gaji',
      icon: Coins,
      color: 'from-teal-400 via-emerald-500 to-green-600',
      glow: 'shadow-emerald-500/20 hover:shadow-emerald-500/40',
      badge: 'Estimasi'
    },
    {
      id: 'pengumuman' as TabType,
      title: 'Pengumuman',
      desc: 'Instruksi tim',
      icon: BellRing,
      color: 'from-amber-400 via-orange-500 to-rose-500',
      glow: 'shadow-orange-500/20 hover:shadow-orange-500/40',
      badge: announcements.length ? `${announcements.length} Baru` : undefined
    },
    {
      id: 'profil' as TabType,
      title: 'Profil Saya',
      desc: 'Identitas & status akun',
      icon: UserCheck,
      color: 'from-emerald-400 via-teal-500 to-cyan-600',
      glow: 'shadow-emerald-500/20 hover:shadow-emerald-500/40',
      badge: undefined
    }
  ];

  if (userProfile?.role === 'Admin') {
    quickMenus.push({
      id: 'admin' as TabType,
      title: 'Admin Panel',
      desc: 'Persetujuan recruiter',
      icon: ShieldCheck,
      color: 'from-purple-500 via-violet-600 to-indigo-600',
      glow: 'shadow-purple-500/20 hover:shadow-purple-500/40',
      badge: 'Management'
    });
  } else if (userProfile?.role === 'Owner') {
    quickMenus.push({
      id: 'owner' as TabType,
      title: 'Owner Panel',
      desc: 'Akses penuh & sistem',
      icon: Crown,
      color: 'from-rose-500 via-pink-600 to-purple-600',
      glow: 'shadow-rose-500/20 hover:shadow-rose-500/40',
      badge: 'System Admin'
    });
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="space-y-5 pb-24"
    >
      {/* Welcome User Banner */}
      <GlassCard className="relative overflow-hidden border border-slate-200/10 bg-slate-900/60 p-5 shadow-sm">
        <div className="absolute -top-12 -right-12 w-40 h-40 bg-sky-500/5 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-10 -left-10 w-32 h-32 bg-indigo-500/5 rounded-full blur-2xl pointer-events-none" />

        <div className="flex items-center gap-4 relative z-10">
          <div className="relative shrink-0">
            {telegramUser?.photo_url ? (
              <img
                src={telegramUser.photo_url}
                alt="Profile"
                className="w-16 h-16 rounded-xl object-cover border border-white/10 shadow-sm"
              />
            ) : (
              <div className="w-16 h-16 rounded-xl bg-blue-600 flex items-center justify-center text-white text-2xl font-bold shadow-sm border border-white/10">
                {(userProfile?.firstName?.[0] || telegramUser?.first_name?.[0] || 'A').toUpperCase()}
              </div>
            )}
            <span className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 bg-emerald-500 rounded-full border-2 border-slate-950 shadow-sm" />
          </div>

          <div className="flex flex-col overflow-hidden">
            <div className="flex items-center gap-1 text-[11px] font-semibold text-sky-400 uppercase tracking-wider">
              <Sparkles className="w-3 h-3" /> Selamat Datang
            </div>
            <h2 className="text-lg font-bold text-white truncate tracking-tight mt-0.5">
              {userProfile?.firstName} {userProfile?.lastName}
            </h2>
            <span className="text-xs text-slate-400 font-medium">
              {formatUsername(userProfile?.username || telegramUser?.username)}
            </span>

            <div className="flex items-center gap-1.5 mt-1.5">
              {userProfile?.role && <StatusBadge role={userProfile.role} size="sm" />}
              {userProfile?.status && <StatusBadge status={userProfile.status} size="sm" />}
            </div>
          </div>
        </div>
      </GlassCard>

      {/* System Announcement Banner */}
      {announcementHeader && (
        <GlassCard className="bg-slate-900/40 p-4 border border-slate-800/80 flex items-center gap-3 shadow-sm">
          <div className="p-2 rounded-xl bg-blue-500/10 text-blue-400 shrink-0 border border-blue-500/20">
            <Megaphone className="w-4 h-4" />
          </div>
          <p className="text-xs text-slate-300 font-medium leading-relaxed">
            {announcementHeader}
          </p>
        </GlassCard>
      )}

      {/* Quick Menu Grid */}
      <div className="space-y-2.5">
        <div className="flex items-center justify-between px-1">
          <h3 className="text-xs font-bold text-slate-400 tracking-wider flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-sky-400" />
            <span>Menu Utama Recruiter</span>
          </h3>
          <span className="text-[10px] text-sky-400/80 font-bold bg-sky-500/10 px-2.5 py-0.5 rounded-full border border-sky-500/20">
            AzurLize System
          </span>
        </div>

        <div className="grid grid-cols-2 gap-3">
          {quickMenus.map((menu) => {
            const Icon = menu.icon;
            // Map our gradient to solid colors for standard iOS style
            let bgSolid = 'bg-blue-600';
            if (menu.id === 'data_harian') bgSolid = 'bg-emerald-500';
            else if (menu.id === 'laporan') bgSolid = 'bg-sky-500';
            else if (menu.id === 'pengumuman') bgSolid = 'bg-orange-500';
            else if (menu.id === 'profil') bgSolid = 'bg-teal-500';
            else if (menu.id === 'admin') bgSolid = 'bg-purple-500';
            else if (menu.id === 'owner') bgSolid = 'bg-rose-500';

            return (
              <GlassCard
                key={menu.id}
                hoverable
                onClick={() => setActiveTab(menu.id)}
                className="p-4 space-y-3 flex flex-col justify-between group border-white/5 bg-slate-900/40 hover:border-slate-700/50 relative overflow-hidden transition-all duration-200 shadow-sm"
              >
                <div className="flex items-center justify-between relative z-10">
                  <div className={`w-10 h-10 rounded-xl ${bgSolid} flex items-center justify-center text-white shadow-sm transition-transform duration-200`}>
                    <Icon className="w-5 h-5 text-white" />
                  </div>

                  {menu.badge && (
                    <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-slate-950/80 text-sky-400 border border-slate-800 shadow-sm">
                      {menu.badge}
                    </span>
                  )}
                </div>

                <div className="relative z-10 pt-1">
                  <h4 className="text-sm font-bold text-white group-hover:text-sky-300 transition-colors flex items-center justify-between">
                    <span>{menu.title}</span>
                    <ChevronRight className="w-3.5 h-3.5 text-slate-500 group-hover:text-sky-400 group-hover:translate-x-0.5 transition-transform" />
                  </h4>
                  <p className="text-[11px] text-slate-400 mt-0.5 line-clamp-1">{menu.desc}</p>
                </div>
              </GlassCard>
            );
          })}
        </div>
      </div>

      {/* My Stats Summary Card */}
      <div className="space-y-2.5">
        <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest px-1">
          Ringkasan Performa Saya
        </h3>

        <GlassCard className="p-4 space-y-4 border-slate-800">
          <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-xl bg-blue-500/10 text-blue-400">
                <BarChart2 className="w-4 h-4" />
              </div>
              <span className="text-xs font-bold text-white uppercase tracking-wider">
                Metrik Akumulasi Laporan
              </span>
            </div>
            <span className="text-[10px] text-slate-300 bg-slate-800 px-2.5 py-1 rounded-full font-semibold border border-slate-700/60 flex items-center gap-1">
              <TrendingUp className="w-3 h-3 text-emerald-400" /> {approvedReports.length} Laporan ACC
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-center">
            <div className="bg-slate-900/90 p-3 rounded-2xl border border-slate-800/80">
              <span className="text-[10px] text-slate-400 block font-semibold uppercase">Kunjungan</span>
              <span className="text-xl font-black text-blue-400 mt-0.5 block">{totalVisits}</span>
            </div>
            <div className="bg-slate-900/90 p-3 rounded-2xl border border-slate-800/80">
              <span className="text-[10px] text-slate-400 block font-semibold uppercase">Pelamar</span>
              <span className="text-xl font-black text-sky-400 mt-0.5 block">{totalApplicants}</span>
            </div>
            <div className="bg-slate-900/90 p-3 rounded-2xl border border-slate-800/80">
              <span className="text-[10px] text-slate-400 block font-semibold uppercase">Berkualitas</span>
              <span className="text-xl font-black text-emerald-400 mt-0.5 block">{totalQuality}</span>
            </div>
            <div className="bg-slate-900/90 p-3 rounded-2xl border border-slate-800/80">
              <span className="text-[10px] text-slate-400 block font-semibold uppercase">Postingan</span>
              <span className="text-xl font-black text-indigo-400 mt-0.5 block">{totalPostings}</span>
            </div>
          </div>
        </GlassCard>
      </div>

      {/* Announcements Stream */}
      {announcements.length > 0 && (
        <div className="space-y-2.5">
          <div className="flex items-center justify-between px-1">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest">
              Pengumuman Terbaru
            </h3>
            <button
              onClick={() => setActiveTab('pengumuman')}
              className="text-xs text-sky-400 font-bold hover:underline"
            >
              Lihat Semua &rarr;
            </button>
          </div>

          <div className="space-y-2.5">
            {announcements.slice(0, 2).map((ann) => (
              <GlassCard key={ann.id} className="p-4 space-y-1.5 border-slate-800">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-sky-400">{ann.title}</span>
                  {ann.pinned && (
                    <span className="text-[10px] bg-amber-500/20 text-amber-300 px-2 py-0.5 rounded-full border border-amber-500/30 font-semibold">
                      📌 Pinned
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-300 line-clamp-2 leading-relaxed">
                  {ann.content}
                </p>
                <span className="text-[10px] text-slate-500 block pt-1">
                  Oleh: {ann.author} &bull; {formatWIBDate(ann.createdAt)}
                </span>
              </GlassCard>
            ))}
          </div>
        </div>
      )}
    </motion.div>
  );
};

