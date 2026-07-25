import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { GlassCard } from '../components/common/GlassCard';
import { Input } from '../components/common/Input';
import { Button } from '../components/common/Button';
import { useReports } from '../hooks/useReports';
import { useAuth } from '../hooks/useAuth';
import { useRecruiters } from '../hooks/useRecruiters';
import { subscribeToRecruiterPosts } from '../firebase/services/postService';
import { subscribeToSystemSettings, getSystemSettings } from '../firebase/services/settingService';
import { sendReportToTelegramApi } from '../services/api';
import { DailyReportFormData, BatchPost, SystemSettings } from '../types';
import { Calendar, Eye, UserCheck, Star, Share2, AlertCircle, FileText, CheckCircle2, Sparkles, RefreshCw, Copy, Clock, Lock, Unlock, Timer, Users, UserX } from 'lucide-react';
import { getWIBDate, getWIBMondayOfDate } from '../utils/format';

export const LaporanHarianPage: React.FC = () => {
  const { submitReport, isLoading, reports } = useReports();
  const { userProfile, telegramUser } = useAuth();

  const getInitialDate = () => {
    const now = new Date();
    const wibStr = now.toLocaleString('en-US', { timeZone: 'Asia/Jakarta' });
    const wibDate = new Date(wibStr);
    const hours = wibDate.getHours();
    const minutes = wibDate.getMinutes();
    
    // If before 10:01 AM, they are submitting for yesterday
    if (hours < 10 || (hours === 10 && minutes < 1)) {
      wibDate.setDate(wibDate.getDate() - 1);
    }
    
    const year = wibDate.getFullYear();
    const month = String(wibDate.getMonth() + 1).padStart(2, '0');
    const day = String(wibDate.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const initialDateStr = getInitialDate();
  
  const effectiveTelegramId = userProfile?.telegramId || (telegramUser?.id ? String(telegramUser.id) : '');
  const isAdminOrOwner = userProfile?.role === 'Admin' || userProfile?.role === 'Owner';
  const { users } = useRecruiters();
  const [activeTab, setActiveTab] = useState<'form' | 'weekly' | 'archive' | 'status'>('form');

  const [formData, setFormData] = useState<DailyReportFormData>({
    date: initialDateStr,
    visit: 0,
    applicant: 0,
    quality: 0,
    posting: 0,
    permission: 0,
    effectiveStatus: 'YES',
    note: ''
  });

  const recruiters = useMemo(() => {
    return users.filter(u => u.role === 'Recruiter');
  }, [users]);

  const { submittedRecruiters, unsubmittedRecruiters } = useMemo(() => {
    const targetDate = formData.date || initialDateStr;
    const submittedIds = new Set(
      reports
        .filter(r => r.date === targetDate && !r.applicantWhatsapp && !r.uid9Kucing)
        .map(r => r.telegramId)
    );
    
    return {
      submittedRecruiters: recruiters.filter(u => submittedIds.has(u.telegramId)),
      unsubmittedRecruiters: recruiters.filter(u => !submittedIds.has(u.telegramId))
    };
  }, [recruiters, reports, formData?.date, initialDateStr]);

  const alreadyHasIzinThisWeek = useMemo(() => {
    if (!formData.date || !reports || reports.length === 0) return false;
    
    const targetMonday = getWIBMondayOfDate(formData.date);
    
    return reports.some(r => {
      if (r.permission !== 1) return false;
      if (r.telegramId !== effectiveTelegramId) return false;
      if (r.applicantWhatsapp || r.uid9Kucing) return false; // Must be summary report
      return getWIBMondayOfDate(r.date) === targetMonday;
    });
  }, [reports, formData.date, effectiveTelegramId]);

  // Auto-reset Izin status if they already had Izin this week and are not Admin/Owner
  useEffect(() => {
    if (alreadyHasIzinThisWeek && !isAdminOrOwner && formData.permission === 1) {
      setFormData(prev => ({ ...prev, permission: 0 }));
    }
  }, [alreadyHasIzinThisWeek, isAdminOrOwner, formData.permission]);

  const [allPosts, setAllPosts] = useState<BatchPost[]>([]);
  const [hasManuallyEditedPosting, setHasManuallyEditedPosting] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [settings, setSettings] = useState<SystemSettings | null>(null);

  const [alertState, setAlertState] = useState<{
    isOpen: boolean;
    type: 'success' | 'error' | 'warning';
    title: string;
    message: string;
  }>({
    isOpen: false,
    type: 'success',
    title: '',
    message: '',
  });

  const closeAlert = () => {
    setAlertState((prev) => ({ ...prev, isOpen: false }));
  };

  // Timer & Automatic Locking Logic (00:00 - 10:00 WIB)
  const [nowWib, setNowWib] = useState<{ hours: number; minutes: number; seconds: number; isPast10: boolean; timeString: string }>({
    hours: 0,
    minutes: 0,
    seconds: 0,
    isPast10: false,
    timeString: '00:00:00'
  });

  useEffect(() => {
    const updateTimer = () => {
      const now = new Date();
      const wibStr = now.toLocaleString('en-US', { timeZone: 'Asia/Jakarta' });
      const wibDate = new Date(wibStr);
      const hours = wibDate.getHours();
      const minutes = wibDate.getMinutes();
      const seconds = wibDate.getSeconds();
      const isPast10 = hours >= 10;
      
      const pad = (n: number) => String(n).padStart(2, '0');
      const timeString = `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;

      setNowWib({ hours, minutes, seconds, isPast10, timeString });
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, []);

  // Compute remaining time until 10:00:00 WIB
  const timeInfo = useMemo(() => {
    if (nowWib.isPast10) {
      return { hours: '00', minutes: '00', seconds: '00', elapsedPercent: 100 };
    }
    
    const targetSeconds = 10 * 3600; // 10:00:00 WIB
    const currentSeconds = nowWib.hours * 3600 + nowWib.minutes * 60 + nowWib.seconds;
    const diff = Math.max(0, targetSeconds - currentSeconds);

    const h = Math.floor(diff / 3600);
    const m = Math.floor((diff % 3600) / 60);
    const s = diff % 60;

    const pad = (n: number) => String(n).padStart(2, '0');
    
    const elapsedPercent = Math.min(100, Math.max(0, (currentSeconds / targetSeconds) * 100));

    return {
      hours: pad(h),
      minutes: pad(m),
      seconds: pad(s),
      elapsedPercent
    };
  }, [nowWib]);

  const { hours, minutes, seconds, elapsedPercent } = timeInfo;

  // Compute remaining time until midnight (00:00:00 WIB) when the topic/form opens again
  const reopenTimeInfo = useMemo(() => {
    const currentSeconds = nowWib.hours * 3600 + nowWib.minutes * 60 + nowWib.seconds;
    const totalDaySeconds = 24 * 3600;
    const diff = Math.max(0, totalDaySeconds - currentSeconds);

    const h = Math.floor(diff / 3600);
    const m = Math.floor((diff % 3600) / 60);
    const s = diff % 60;

    const pad = (n: number) => String(n).padStart(2, '0');

    return {
      hours: pad(h),
      minutes: pad(m),
      seconds: pad(s)
    };
  }, [nowWib]);


  // Lock status: locked if past 10:00 WIB and NOT Admin/Owner
  const isLocked = nowWib.isPast10 && !isAdminOrOwner;

  // Subscribe to system settings for Telegram group and topic IDs
  useEffect(() => {
    const unsubscribe = subscribeToSystemSettings((s) => {
      setSettings(s);
    });
    return () => unsubscribe();
  }, []);

  // Subscribe to recruiter posts
  useEffect(() => {
    if (!effectiveTelegramId) return;

    const unsubscribe = subscribeToRecruiterPosts(
      effectiveTelegramId,
      (fetchedPosts) => {
        setAllPosts(fetchedPosts);
      },
      100
    );

    return () => unsubscribe();
  }, [effectiveTelegramId]);

  // Helper to normalize dates to YYYY-MM-DD for consistent comparison
  const normalizeDate = (d: string) => {
    if (!d) return '';
    const parts = d.split('-');
    if (parts.length !== 3) return d;
    // If DD-MM-YYYY (parts[0] is day), convert to YYYY-MM-DD
    if (parts[0].length === 2) return parts.reverse().join('-');
    return d;
  };

  // Compute auto-detected posting count for the selected date
  const autoPostingCount = useMemo(() => {
    const targetDate = normalizeDate(formData.date);
    const matchedPosts = allPosts.filter(p => normalizeDate(p.date || '') === targetDate && !p.archived);

    return matchedPosts.reduce((sum, post) => {
      const linkCount = Array.isArray(post.links) ? post.links.length : 0;
      return sum + linkCount;
    }, 0);
  }, [allPosts, formData.date]);

  // Compute auto-detected applicant count (Total Data: ACC + REJECT)
  const autoApplicantCount = useMemo(() => {
    const targetDate = normalizeDate(formData.date);
    const userReports = reports.filter(r => 
      normalizeDate(r.date) === targetDate && 
      r.telegramId === effectiveTelegramId &&
      (r.applicantWhatsapp || r.uid9Kucing) // Individual applicant reports (all results)
    );
    return userReports.length;
  }, [reports, formData.date, effectiveTelegramId]);

  // Compute auto-detected quality (ACC) count
  const autoQualityCount = useMemo(() => {
    const targetDate = normalizeDate(formData.date);
    const userReports = reports.filter(r => 
      normalizeDate(r.date) === targetDate && 
      r.telegramId === effectiveTelegramId &&
      (r.applicantWhatsapp || r.uid9Kucing) && // Individual applicant reports
      r.result === 'ACC'
    );
    return userReports.length;
  }, [reports, formData.date, effectiveTelegramId]);

  // Sync auto counts with formData
  useEffect(() => {
    setFormData(prev => ({
      ...prev,
      posting: autoPostingCount,
      applicant: autoApplicantCount,
      quality: autoQualityCount
    }));
  }, [autoPostingCount, autoApplicantCount, autoQualityCount]);

  // Auto set active & effective based on target achievement rules
  useEffect(() => {
    const recruits = Number(formData.applicant) || 0;
    let requiredPosting = 90;
    if (recruits >= 3) requiredPosting = 0;
    else if (recruits === 2) requiredPosting = 30;
    else if (recruits === 1) requiredPosting = 60;
    else requiredPosting = 90;

    const currentPosting = Number(formData.posting) || 0;
    const isTargetReached = recruits >= 3 || currentPosting >= requiredPosting;

    setFormData(prev => ({
      ...prev,
      effectiveStatus: isTargetReached ? 'YES' : 'NO'
    }));
  }, [formData.applicant, formData.posting]);

  const handleDateChange = (newDate: string) => {
    setHasManuallyEditedPosting(false); // Reset manual override flag so new date auto-fills
    setFormData(prev => ({
      ...prev,
      date: newDate
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isLocked) {
      setError('Formulir harian telah terkunci karena sudah melewati batas waktu pukul 10.00 WIB.');
      return;
    }

    if (!formData.date) {
      setError('Tanggal wajib diisi.');
      return;
    }

    if (formData.permission === 1 && alreadyHasIzinThisWeek && !isAdminOrOwner) {
      setError('Batas izin Anda minggu ini sudah terpakai (Maksimal 1x per minggu, Senin - Minggu).');
      return;
    }

    setError(null);
    setSuccessMsg(null);
    setIsSubmitting(true);

    try {
      const reportText = generateReportText();
      const newReport = await submitReport(formData);

      // Fetch system settings as fallback if state settings is missing or incomplete
      let currentSettings = settings;
      if (!currentSettings || !currentSettings.telegramGroupId) {
        try {
          const sys = await getSystemSettings();
          if (sys) currentSettings = sys;
        } catch (sysErr) {
          console.warn('[LaporanHarian] Fallback fetch system settings error:', sysErr);
        }
      }

      const groupId = currentSettings?.telegramGroupId || '';
      const topicId = currentSettings?.telegramTopicId || currentSettings?.telegramTopicT0 || '';

      const tgRes = await sendReportToTelegramApi(newReport, undefined, groupId, topicId, reportText);
      
      if (tgRes.success) {
        setAlertState({
          isOpen: true,
          type: 'success',
          title: 'Berhasil!',
          message: 'Laporan harian berhasil dikirim, tersimpan, dan terkirim ke Telegram!'
        });
      } else {
        setAlertState({
          isOpen: true,
          type: 'warning',
          title: 'Tersimpan',
          message: `Laporan harian tersimpan di database. Catatan Telegram: ${tgRes.error}`
        });
      }

      // Reset form counters
      setFormData({
        date: initialDateStr,
        visit: 0,
        applicant: 0,
        quality: 0,
        posting: 0,
        permission: 0,
        note: ''
      });
      setHasManuallyEditedPosting(false);
    } catch (err) {
      setAlertState({
        isOpen: true,
        type: 'error',
        title: 'Gagal',
        message: err instanceof Error ? err.message : 'Gagal mengirim laporan harian.'
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const formatDateDisplay = (dateStr: string) => {
    if (!dateStr) return '';
    const parts = dateStr.split('-');
    if (parts.length === 3) {
      // YYYY-MM-DD to DD/MM/YYYY
      return `${parts[2]}/${parts[1]}/${parts[0]}`;
    }
    return dateStr;
  };

  const generateReportText = () => {
    const rawUsername = userProfile?.username || telegramUser?.username || 'Recruiter';
    const username = rawUsername.replace(/^@/, '');

    return `Laporan Recruiter @<b>${username}</b>
Tanggal: <b>${formatDateDisplay(formData.date)}</b>

Jumlah Orang yang bertanya pekerjaan: <b>${formData.visit || 0}</b>
Jumlah orang yang sudah memberikan data kerja : <b>${formData.applicant || 0}</b>
Jumlah pelamar yang disetujui: <b>${formData.quality || 0}</b>
Jumlah postingan yang disubmit: <b>${formData.posting || 0}</b>

Izin tidak bekerja? <b>${formData.permission === 1 ? 'YA (IZIN)' : 'TIDAK (AKTIF)'}</b>
Status Target & Efektif? <b>${formData.effectiveStatus || 'YES'}</b>`;
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="space-y-5 pb-28"
    >
      {/* Live WIB Timer & Lock Status */}
      <GlassCard className="p-4 bg-slate-950/80 border-slate-800/80 shadow-xl space-y-4">
        {/* Header Row */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800/60 pb-3">
          <div className="flex items-center gap-2">
            <Timer className="w-4 h-4 text-sky-400 animate-pulse" />
            <h3 className="text-[11px] sm:text-xs font-black text-white uppercase tracking-wider">Status Laporan & Jadwal</h3>
          </div>
          <div className="flex items-center gap-1.5">
            <span className={`text-[8px] sm:text-[9px] font-black uppercase px-2 py-0.5 rounded-full border ${
              nowWib.isPast10 
                ? 'bg-rose-500/10 text-rose-300 border-rose-500/20' 
                : 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20'
            }`}>
              {nowWib.isPast10 ? '🔴 Form Ditutup' : '🟢 Form Dibuka'}
            </span>
          </div>
        </div>

        {/* Single Dynamic Timer Block */}
        <div className="p-4 rounded-2xl bg-slate-900/40 border border-slate-800/60 flex flex-col md:flex-row md:items-center justify-between gap-4 text-center md:text-left">
          <div className="space-y-1">
            <span className="text-[10px] font-black uppercase tracking-wider text-sky-400 block">
              {nowWib.isPast10 ? 'Sisa Waktu Pembukaan Laporan' : 'Sisa Waktu Pengisian Hari Ini'}
            </span>
            <p className="text-[9.5px] text-slate-400 font-medium max-w-md leading-normal mx-auto md:mx-0">
              {nowWib.isPast10 
                ? 'Formulir saat ini ditutup karena telah melewati pukul 10:00 WIB. Pendaftaran laporan berikutnya akan dibuka kembali tepat pukul 00:00 WIB.' 
                : 'Mohon kirimkan laporan harian Anda sebelum batas waktu pengerjaan berakhir pada pukul 10:00 WIB Pagi.'}
            </p>
          </div>
          
          <div className="flex items-center justify-center gap-1.5 font-mono shrink-0 mx-auto md:mx-0">
            <div className="text-center bg-slate-950/90 px-3 py-2 rounded-xl border border-slate-800/80 min-w-[48px] shadow-inner">
              <span className={`text-xl sm:text-2xl font-black tracking-tighter ${nowWib.isPast10 ? 'text-amber-400' : 'text-white'}`}>
                {nowWib.isPast10 ? reopenTimeInfo.hours : hours}
              </span>
              <span className="block text-[7px] font-bold text-slate-500 uppercase font-sans mt-0.5">Jam</span>
            </div>
            <span className="text-xl font-black text-slate-700 animate-pulse">:</span>
            <div className="text-center bg-slate-950/90 px-3 py-2 rounded-xl border border-slate-800/80 min-w-[48px] shadow-inner">
              <span className={`text-xl sm:text-2xl font-black tracking-tighter ${nowWib.isPast10 ? 'text-amber-400' : 'text-white'}`}>
                {nowWib.isPast10 ? reopenTimeInfo.minutes : minutes}
              </span>
              <span className="block text-[7px] font-bold text-slate-500 uppercase font-sans mt-0.5">Min</span>
            </div>
            <span className="text-xl font-black text-slate-700 animate-pulse">:</span>
            <div className="text-center bg-slate-950/90 px-3 py-2 rounded-xl border border-slate-800/80 min-w-[48px] shadow-inner">
              <span className={`text-xl sm:text-2xl font-black tracking-tighter ${nowWib.isPast10 ? 'text-amber-300' : 'text-sky-400'}`}>
                {nowWib.isPast10 ? reopenTimeInfo.seconds : seconds}
              </span>
              <span className="block text-[7px] font-bold text-slate-500 uppercase font-sans mt-0.5">Detik</span>
            </div>
          </div>
        </div>
      </GlassCard>



      <div className="flex bg-slate-900/80 p-1 rounded-2xl border border-slate-800 shrink-0 gap-1 overflow-x-auto no-scrollbar">
        <button
          type="button"
          onClick={() => setActiveTab('form')}
          className={`flex-1 min-w-[100px] flex items-center justify-center gap-2 px-3 py-2 rounded-xl text-[11px] font-bold transition-all ${
            activeTab === 'form'
              ? 'bg-sky-500 text-white shadow-lg shadow-sky-500/20'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
          }`}
        >
          <FileText className="w-3.5 h-3.5" />
          <span>Formulir</span>
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('weekly')}
          className={`flex-1 min-w-[100px] flex items-center justify-center gap-2 px-3 py-2 rounded-xl text-[11px] font-bold transition-all ${
            activeTab === 'weekly'
              ? 'bg-indigo-500 text-white shadow-lg shadow-indigo-500/20'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
          }`}
        >
          <Calendar className="w-3.5 h-3.5" />
          <span>Minggu Ini</span>
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('archive')}
          className={`flex-1 min-w-[100px] flex items-center justify-center gap-2 px-3 py-2 rounded-xl text-[11px] font-bold transition-all ${
            activeTab === 'archive'
              ? 'bg-purple-500 text-white shadow-lg shadow-purple-500/20'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
          }`}
        >
          <Clock className="w-3.5 h-3.5" />
          <span>Arsip</span>
        </button>
        {isAdminOrOwner && (
          <button
            type="button"
            onClick={() => setActiveTab('status')}
            className={`flex-1 min-w-[120px] flex items-center justify-center gap-2 px-3 py-2 rounded-xl text-[11px] font-bold transition-all ${
              activeTab === 'status'
                ? 'bg-amber-500 text-white shadow-lg shadow-amber-500/20'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            <span>Status Recruiter</span>
          </button>
        )}
      </div>

      {activeTab === 'form' && (
        <div className="space-y-5">
          <GlassCard className="border-slate-800/80 shadow-sm">
        <form onSubmit={handleSubmit} className="space-y-4">

          {nowWib.isPast10 && (
            <div className={`p-3.5 rounded-2xl flex items-start gap-3 border text-xs font-medium ${
              isLocked 
                ? 'bg-rose-500/15 border-rose-500/30 text-rose-300' 
                : 'bg-amber-500/15 border-amber-500/30 text-amber-300'
            }`}>
              <Lock className={`w-5 h-5 shrink-0 mt-0.5 ${isLocked ? 'text-rose-400' : 'text-amber-400'}`} />
              <div className="space-y-1">
                <strong className="block font-bold">
                  {isLocked ? '🔒 Formulir Laporan Harian Terkunci' : '⚠️ Batas Waktu 10.00 WIB telah Lewat'}
                </strong>
                <p>
                  Batas waktu pengiriman laporan harian (00.00 - 10.00 WIB) telah lewat untuk hari ini.
                </p>
                {isAdminOrOwner && (
                  <p className="text-[10px] text-emerald-400 font-semibold flex items-center gap-1 pt-0.5">
                    <Unlock className="w-3 h-3 text-emerald-400 shrink-0" />
                    <span>Akses Admin/Owner: Anda dapat tetap mengisi/mengirimkan laporan ini.</span>
                  </p>
                )}
              </div>
            </div>
          )}

          {error && (
            <div className="bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs p-3.5 rounded-2xl flex items-center gap-2 font-medium">
              <span>⚠️</span>
              <span>{error}</span>
            </div>
          )}

          {successMsg && (
            <div className="bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs p-3.5 rounded-2xl flex items-center gap-2 font-medium">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>{successMsg}</span>
            </div>
          )}

          <div className="relative group mb-4">
            <div className="absolute -inset-0.5 bg-gradient-to-r from-sky-500/10 to-indigo-500/10 rounded-[24px] blur opacity-75 transition duration-1000"></div>
            <div className="relative flex items-center justify-between p-4 bg-slate-950/40 rounded-[20px] border border-slate-800/50 backdrop-blur-xl">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-2xl bg-sky-500/10 border border-sky-500/20 shadow-inner">
                  <Calendar className="w-5 h-5 text-sky-400" />
                </div>
                <div>
                  <p className="text-[10px] font-bold text-slate-500 uppercase tracking-[0.2em] leading-none mb-1.5">Periode Laporan</p>
                  <p className="text-xl font-black text-white tracking-tight leading-none">
                    {formatDateDisplay(formData.date)}
                  </p>
                </div>
              </div>
              <div className="flex flex-col items-end gap-2">
                <div className="px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center gap-1.5">
                  <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse shadow-[0_0_8px_rgba(52,211,153,0.5)]" />
                  <span className="text-[9px] font-black text-emerald-400 uppercase tracking-widest">Active</span>
                </div>
                <span className="text-[9px] text-slate-500 font-bold uppercase tracking-tighter opacity-60">
                  Shift Auto-Reset 10:01
                </span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Jumlah orang yang bertanya pekerjaan"
              type="number"
              min="0"
              placeholder="0"
              icon={<Eye className="w-4 h-4 text-blue-400" />}
              value={formData.visit === 0 ? '' : formData.visit}
              onChange={(e) => {
                const val = e.target.value;
                setFormData({ ...formData, visit: val === '' ? 0 : Number(val) });
              }}
              disabled={isLocked}
              required
            />

            <Input
              label="Jumlah orang yang sudah memberikan data kerja"
              type="number"
              min="0"
              placeholder="0"
              icon={<UserCheck className="w-4 h-4 text-sky-400" />}
              value={formData.applicant}
              disabled={true}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Jumlah pelamar yang disetujui"
              type="number"
              min="0"
              placeholder="0"
              icon={<Star className="w-4 h-4 text-emerald-400" />}
              value={formData.quality}
              disabled={true}
            />

            <div className="relative flex flex-col">
              <Input
                label="Jumlah postingan yang disubmit"
                type="number"
                min="0"
                placeholder="0"
                icon={<Share2 className="w-4 h-4 text-indigo-400" />}
                value={formData.posting}
                disabled={true}
              />
            </div>
          </div>

          {/* Section 1: Izin Tidak Bekerja */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold tracking-wider text-slate-400 uppercase px-1 flex items-center gap-1.5">
              <AlertCircle className="w-4 h-4 text-amber-400" />
              <span>Izin Tidak Bekerja?</span>
            </label>
            <span className="text-[10px] text-slate-400 px-1 block mb-2 -mt-1">
              {isAdminOrOwner 
                ? 'Pilih Ya jika izin/libur, pilih Tidak jika aktif bekerja seperti biasa.' 
                : 'Pilih Ya jika Anda izin/libur hari ini (Maksimal 1x per minggu, Senin - Minggu).'}
            </span>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                disabled={isLocked}
                onClick={() => setFormData({ ...formData, permission: 0 })}
                className={`py-2.5 px-4 rounded-xl text-xs font-bold border transition-all flex items-center justify-center gap-1.5 ${
                  isLocked
                    ? 'opacity-50 cursor-not-allowed bg-slate-950 text-slate-600 border-slate-900'
                    : formData.permission === 0
                    ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40 font-black cursor-pointer'
                    : 'bg-slate-900/80 text-slate-400 border-slate-800/80 hover:text-slate-300 hover:border-slate-700 cursor-pointer'
                }`}
              >
                Tidak (Aktif)
              </button>
              <button
                type="button"
                disabled={isLocked || (alreadyHasIzinThisWeek && !isAdminOrOwner)}
                onClick={() => {
                  setFormData({ ...formData, permission: 1 });
                  if (!isAdminOrOwner) {
                    setAlertState({
                      isOpen: true,
                      type: 'warning',
                      title: 'Pemberitahuan Izin',
                      message: 'Anda mengaktifkan status "Izin Tidak Bekerja". Ingat, fitur ini hanya dapat diaktifkan maksimal 1 kali dalam seminggu!'
                    });
                  }
                }}
                className={`py-2.5 px-4 rounded-xl text-xs font-bold border transition-all flex items-center justify-center gap-1.5 ${
                  isLocked || (alreadyHasIzinThisWeek && !isAdminOrOwner)
                    ? 'opacity-50 cursor-not-allowed bg-slate-950 text-slate-600 border-slate-900'
                    : formData.permission === 1
                    ? 'bg-rose-500/20 text-rose-300 border-rose-500/40 font-black cursor-pointer'
                    : 'bg-slate-900/80 text-slate-400 border-slate-800/80 hover:text-slate-300 hover:border-slate-700 cursor-pointer'
                }`}
              >
                Ya (Izin)
              </button>
            </div>
            {!isAdminOrOwner && (
              <p className="text-[10px] text-emerald-400 font-semibold px-1 mt-1 flex items-center gap-1 leading-normal">
                <span>🟢</span>
                <span>Anda dapat mengatur status izin sendiri maksimal 1 kali per minggu (Senin - Minggu).</span>
              </p>
            )}
            {alreadyHasIzinThisWeek && !isAdminOrOwner && (
              <p className="text-[10px] text-rose-400 font-semibold px-1 mt-1 flex items-center gap-1 leading-normal">
                <span>⚠️</span>
                <span>Batas izin Anda minggu ini sudah terpakai (Maksimal 1x per minggu, Senin - Minggu).</span>
              </p>
            )}
            {isAdminOrOwner && alreadyHasIzinThisWeek && (
              <p className="text-[10px] text-amber-400 font-semibold px-1 mt-1 flex items-center gap-1 leading-normal">
                <span>💡</span>
                <span>Recruiter sudah izin minggu ini, tetapi Anda dapat mengubahnya kembali karena Anda adalah Admin/Owner.</span>
              </p>
            )}
          </div>

          {/* Section 2: Karyawan Aktif & Efektif (Mencapai Target) */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold tracking-wider text-slate-400 uppercase px-1 flex items-center gap-1.5">
              <Sparkles className="w-4 h-4 text-indigo-400" />
              <span>Status Target & Efektif</span>
            </label>
            <div className={`py-3 px-4 rounded-xl text-xs font-bold border flex items-center justify-between ${
              formData.effectiveStatus === 'YES'
                ? 'bg-indigo-500/10 text-indigo-300 border-indigo-500/30'
                : 'bg-amber-500/10 text-amber-300 border-amber-500/40'
            }`}>
              <div className="flex items-center gap-2">
                <span className="text-base">{formData.effectiveStatus === 'YES' ? '🎯' : '⚠️'}</span>
                <div>
                  <p className="font-extrabold text-sm">{formData.effectiveStatus === 'YES' ? 'YES (Target Tercapai)' : 'NO (Belum Memenuhi Target)'}</p>
                  <p className="text-[10px] text-slate-400 font-normal mt-0.5">
                    {Number(formData.applicant || 0)} • {Number(formData.posting || 0)} / {
                      Number(formData.applicant || 0) >= 3 ? 0 : Number(formData.applicant || 0) === 2 ? 30 : Number(formData.applicant || 0) === 1 ? 60 : 90
                    } Target Postingan
                  </p>
                </div>
              </div>
              <span className={`px-2.5 py-1 rounded-lg text-xs font-black uppercase tracking-wider ${
                formData.effectiveStatus === 'YES' ? 'bg-indigo-500/20 text-indigo-300' : 'bg-amber-500/20 text-amber-300'
              }`}>
                {formData.effectiveStatus}
              </span>
            </div>
          </div>

          <Button
            type="submit"
            fullWidth
            disabled={isLocked || isSubmitting}
            isLoading={isSubmitting}
            icon={isLocked ? <Lock className="w-4 h-4" /> : <Sparkles className="w-4 h-4" />}
            className="mt-2"
          >
            {isLocked ? 'Form Terkunci (Lewat 10.00 WIB)' : 'Kirim Laporan'}
          </Button>
        </form>
      </GlassCard>
      </div>
      )}

      {activeTab === 'weekly' && (
        <div className="space-y-4">
          <GlassCard className="p-4 border-slate-800/80 bg-slate-950/50">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2.5 rounded-xl bg-indigo-500/10 border border-indigo-500/20">
                <Calendar className="w-5 h-5 text-indigo-400" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white">Laporan Minggu Ini</h3>
                <p className="text-[10px] text-slate-500">Daftar laporan Anda untuk minggu ini.</p>
              </div>
            </div>
            
            <div className="space-y-3">
              {reports
                .filter(r => r.telegramId === effectiveTelegramId && !r.applicantWhatsapp && !r.uid9Kucing && getWIBMondayOfDate(r.date) === getWIBMondayOfDate(getWIBDate()))
                .sort((a, b) => b.date.localeCompare(a.date))
                .map((r, idx) => (
                  <div key={idx} className="p-3 rounded-2xl bg-slate-900/50 border border-slate-800/80 flex items-center justify-between">
                    <div className="flex flex-col">
                      <span className="text-[10px] font-bold text-slate-400">{formatDateDisplay(r.date)}</span>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-xs font-bold text-white">{r.visit} Visit</span>
                        <span className="text-slate-700">•</span>
                        <span className="text-xs font-bold text-sky-400">{r.applicant} Data</span>
                        <span className="text-slate-700">•</span>
                        <span className="text-xs font-bold text-emerald-400">{r.quality} ACC</span>
                      </div>
                    </div>
                    <div className="flex flex-col items-end">
                      <span className={`text-[10px] font-black px-2 py-0.5 rounded-lg border ${
                        r.effectiveStatus === 'YES' 
                          ? 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20' 
                          : 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                      }`}>
                        {r.effectiveStatus}
                      </span>
                      {r.permission === 1 && (
                        <span className="text-[8px] font-bold text-rose-400 mt-1 uppercase tracking-widest">Izin</span>
                      )}
                    </div>
                  </div>
                ))}
              {reports.filter(r => r.telegramId === effectiveTelegramId && !r.applicantWhatsapp && !r.uid9Kucing && getWIBMondayOfDate(r.date) === getWIBMondayOfDate(getWIBDate())).length === 0 && (
                <div className="py-12 text-center">
                  <Clock className="w-8 h-8 text-slate-800 mx-auto mb-2 opacity-20" />
                  <p className="text-xs text-slate-500 italic">Belum ada laporan minggu ini.</p>
                </div>
              )}
            </div>
          </GlassCard>
        </div>
      )}

      {activeTab === 'archive' && (
        <div className="space-y-4">
          <GlassCard className="p-4 border-slate-800/80 bg-slate-950/50">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2.5 rounded-xl bg-purple-500/10 border border-purple-500/20">
                <Clock className="w-5 h-5 text-purple-400" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white">Arsip Laporan</h3>
                <p className="text-[10px] text-slate-500">Semua riwayat laporan harian Anda.</p>
              </div>
            </div>

            <div className="space-y-3">
              {reports
                .filter(r => r.telegramId === effectiveTelegramId && !r.applicantWhatsapp && !r.uid9Kucing)
                .sort((a, b) => b.date.localeCompare(a.date))
                .map((r, idx) => (
                  <div key={idx} className="p-3 rounded-2xl bg-slate-900/50 border border-slate-800/80 flex items-center justify-between">
                    <div className="flex flex-col">
                      <span className="text-[10px] font-bold text-slate-400">{formatDateDisplay(r.date)}</span>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-xs font-bold text-white">{r.visit} Visit</span>
                        <span className="text-slate-700">•</span>
                        <span className="text-xs font-bold text-sky-400">{r.applicant} Data</span>
                        <span className="text-slate-700">•</span>
                        <span className="text-xs font-bold text-emerald-400">{r.quality} ACC</span>
                      </div>
                    </div>
                    <div className="flex flex-col items-end">
                      <span className={`text-[10px] font-black px-2 py-0.5 rounded-lg border ${
                        r.effectiveStatus === 'YES' 
                          ? 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20' 
                          : 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                      }`}>
                        {r.effectiveStatus}
                      </span>
                    </div>
                  </div>
                ))}
              {reports.filter(r => r.telegramId === effectiveTelegramId && !r.applicantWhatsapp && !r.uid9Kucing).length === 0 && (
                <div className="py-12 text-center">
                  <Clock className="w-8 h-8 text-slate-800 mx-auto mb-2 opacity-20" />
                  <p className="text-xs text-slate-500 italic">Belum ada riwayat laporan.</p>
                </div>
              )}
            </div>
          </GlassCard>
        </div>
      )}

      {activeTab === 'status' && isAdminOrOwner && (
        <div className="space-y-4">
          <GlassCard className="p-4 border-slate-800/80 space-y-4 bg-slate-950/50">
            <h3 className="text-sm font-bold text-emerald-400 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4" />
              <span>Sudah Laporan ({submittedRecruiters.length})</span>
            </h3>
            {submittedRecruiters.length === 0 ? (
              <p className="text-xs text-slate-500">Belum ada yang mengumpulkan laporan.</p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {submittedRecruiters.map(r => (
                  <div key={r.telegramId} className="flex items-center gap-3 p-3 rounded-2xl bg-slate-900 border border-slate-800/80 w-full min-w-0">
                    <div className="w-10 h-10 rounded-xl overflow-hidden bg-slate-800 shrink-0 border border-slate-700">
                      {r.photoUrl ? (
                        <img src={r.photoUrl} alt={r.firstName} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-slate-500 font-bold text-xs uppercase">
                          {r.firstName.slice(0, 2)}
                        </div>
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-bold text-slate-200 truncate">{r.firstName} {r.lastName}</p>
                      <p className="text-[10px] text-slate-400 truncate">@{r.username || 'Tanpa username'}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </GlassCard>

          <GlassCard className="p-4 border-slate-800/80 space-y-4 bg-slate-950/50">
            <h3 className="text-sm font-bold text-rose-400 flex items-center gap-2">
              <UserX className="w-4 h-4" />
              <span>Belum Laporan ({unsubmittedRecruiters.length})</span>
            </h3>
            {unsubmittedRecruiters.length === 0 ? (
              <p className="text-xs text-slate-500">Semua recruiter sudah mengumpulkan laporan.</p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {unsubmittedRecruiters.map(r => (
                  <div key={r.telegramId} className="flex items-center gap-3 p-3 rounded-2xl bg-slate-900 border border-slate-800/80 w-full min-w-0">
                    <div className="w-10 h-10 rounded-xl overflow-hidden bg-slate-800 shrink-0 border border-slate-700">
                      {r.photoUrl ? (
                        <img src={r.photoUrl} alt={r.firstName} className="w-full h-full object-cover grayscale opacity-70" referrerPolicy="no-referrer" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-slate-500 font-bold text-xs uppercase">
                          {r.firstName.slice(0, 2)}
                        </div>
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-bold text-slate-300 truncate">{r.firstName} {r.lastName}</p>
                      <p className="text-[10px] text-slate-400 truncate">@{r.username || 'Tanpa username'}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </GlassCard>
        </div>
      )}

      {/* Modern Alert Modal Overlay */}
      <AnimatePresence>
        {alertState.isOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="w-full max-w-sm rounded-[32px] bg-slate-900/95 border border-slate-800 p-8 shadow-2xl space-y-6 text-center relative overflow-hidden"
            >
              {/* Background Ambient Glow */}
              <div
                className={`absolute -top-16 -left-16 w-32 h-32 rounded-full blur-3xl pointer-events-none opacity-30 ${
                  alertState.type === 'success'
                    ? 'bg-emerald-500'
                    : alertState.type === 'error'
                    ? 'bg-rose-500'
                    : 'bg-amber-500'
                }`}
              />

              {/* Icon Header */}
              <div className="flex justify-center">
                <div
                  className={`w-20 h-20 rounded-3xl flex items-center justify-center border shadow-inner ${
                    alertState.type === 'success'
                      ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                      : alertState.type === 'error'
                      ? 'bg-rose-500/10 border-rose-500/30 text-rose-400'
                      : 'bg-amber-500/10 border-amber-500/30 text-amber-400'
                  }`}
                >
                  {alertState.type === 'success' && <CheckCircle2 className="w-10 h-10" />}
                  {alertState.type === 'error' && <AlertCircle className="w-10 h-10" />}
                  {alertState.type === 'warning' && <AlertCircle className="w-10 h-10" />}
                </div>
              </div>

              {/* Content */}
              <div className="space-y-2">
                <h3 className="text-xl font-black text-white tracking-tight">
                  {alertState.title}
                </h3>
                <p className="text-sm font-medium text-slate-400 leading-relaxed">
                  {alertState.message}
                </p>
              </div>

              {/* Action */}
              <Button
                fullWidth
                variant={alertState.type === 'success' ? 'primary' : 'secondary'}
                onClick={closeAlert}
                className="py-4 font-black text-xs uppercase tracking-widest"
              >
                Mengerti
              </Button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

