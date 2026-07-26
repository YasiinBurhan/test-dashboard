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
import { triggerHaptic } from '../telegram/webapp';
import { DailyReportFormData, BatchPost, SystemSettings } from '../types';
import { Calendar, Eye, UserCheck, Star, Share2, AlertCircle, FileText, CheckCircle2, Sparkles, RefreshCw, Copy, Clock, Lock, Unlock, Timer, Users, UserX, ChevronDown } from 'lucide-react';
import { getWIBDate, getWIBMonday, getWIBMondayOfDate, getIndonesianDayName, formatDateDisplay, formatUsername } from '../utils/format';

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
  const [statusSubTab, setStatusSubTab] = useState<'izin' | 'sudah' | 'belum'>('sudah');
  const [expandedWeeks, setExpandedWeeks] = useState<Record<string, boolean>>({});
  const [expandedArchiveDays, setExpandedArchiveDays] = useState<Record<string, boolean>>({});

  const toggleWeek = (weekStart: string) => {
    setExpandedWeeks(prev => ({
      ...prev,
      [weekStart]: !prev[weekStart]
    }));
    triggerHaptic('selection');
  };

  const toggleDay = (dayKey: string) => {
    setExpandedArchiveDays(prev => ({
      ...prev,
      [dayKey]: !prev[dayKey]
    }));
    triggerHaptic('selection');
  };

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

  const { sudahLaporan, belumLaporan, izinRecruiters } = useMemo(() => {
    const targetDate = formData.date || initialDateStr;
    const dailyReports = reports.filter(r => 
      r.date === targetDate && 
      !r.applicantWhatsapp && 
      !r.uid9Kucing && 
      !r.applicantTelegramUsername
    );
    
    const submittedIds = new Set(dailyReports.map(r => r.telegramId));
    const izinIds = new Set(dailyReports.filter(r => r.permission === 1).map(r => r.telegramId));
    
    return {
      sudahLaporan: recruiters.filter(u => submittedIds.has(u.telegramId) && !izinIds.has(u.telegramId)),
      izinRecruiters: recruiters.filter(u => izinIds.has(u.telegramId)),
      belumLaporan: recruiters.filter(u => !submittedIds.has(u.telegramId))
    };
  }, [recruiters, reports, formData?.date, initialDateStr]);

  const currentMondayStr = getWIBMonday(0);
  const lastMondayStr = getWIBMonday(-7);

  const archivedWeeks = useMemo(() => {
    const archivedReports = reports.filter(r => 
      r.telegramId === effectiveTelegramId && 
      !r.applicantWhatsapp && 
      !r.uid9Kucing && 
      !r.applicantTelegramUsername && 
      r.date < currentMondayStr
    );

    const groups: Record<string, typeof archivedReports> = {};
    archivedReports.forEach(r => {
      const monday = getWIBMondayOfDate(r.date);
      if (!groups[monday]) groups[monday] = [];
      groups[monday].push(r);
    });

    return Object.entries(groups)
      .sort(([a], [b]) => b.localeCompare(a))
      .map(([monday, reports]) => {
        // Group reports by date within the week
        const dayGroups = reports.reduce((acc, r) => {
          if (!acc[r.date]) acc[r.date] = [];
          acc[r.date].push(r);
          return acc;
        }, {} as Record<string, typeof reports>);

        return {
          monday,
          dayGroups: Object.entries(dayGroups).sort(([a], [b]) => a.localeCompare(b)),
          totalReports: reports.length
        };
      });
  }, [reports, effectiveTelegramId, currentMondayStr]);

  const alreadyHasIzinThisWeek = useMemo(() => {
    if (!formData.date || !reports || reports.length === 0) return false;
    
    const targetMonday = getWIBMondayOfDate(formData.date);
    
    return reports.some(r => {
      if (r.permission !== 1) return false;
      if (r.telegramId !== effectiveTelegramId) return false;
      if (r.applicantWhatsapp || r.uid9Kucing || r.applicantTelegramUsername) return false; // Must be summary report
      return getWIBMondayOfDate(r.date) === targetMonday;
    });
  }, [reports, formData.date, effectiveTelegramId]);

  const currentWeekReports = useMemo(() => {
    return reports.filter(
      r =>
        r.telegramId === effectiveTelegramId &&
        !r.applicantWhatsapp &&
        !r.uid9Kucing &&
        !r.applicantTelegramUsername &&
        r.date >= currentMondayStr
    );
  }, [reports, effectiveTelegramId, currentMondayStr]);

  const totalPostingCurrentWeek = useMemo(() => {
    return currentWeekReports.reduce((sum, r) => sum + (r.posting || 0), 0);
  }, [currentWeekReports]);

  const totalFineCurrentWeek = useMemo(() => {
    return currentWeekReports.reduce((sum, r) => sum + (r.fine || 0), 0);
  }, [currentWeekReports]);

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


  // Lock status: we no longer lock the form completely, we allow late submissions with a fine of 5000
  const isLocked = false;

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

  // Compute pending applicant reports count
  const pendingReportsCount = useMemo(() => {
    const targetDate = normalizeDate(formData.date);
    const userReports = reports.filter(r => 
      normalizeDate(r.date) === targetDate && 
      r.telegramId === effectiveTelegramId &&
      (r.applicantWhatsapp || r.uid9Kucing) && // Individual applicant reports
      (!r.result || r.result === 'Pending')
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

    if (!formData.date) {
      setError('Tanggal wajib diisi.');
      return;
    }

    if (formData.permission === 1 && alreadyHasIzinThisWeek && !isAdminOrOwner) {
      setError('Batas izin Anda minggu ini sudah terpakai (Maksimal 1x per minggu, Senin - Minggu).');
      return;
    }

    // Check if a report for this date already exists for this user (Daily Summary)
    const normalizedTargetDate = normalizeDate(formData.date);
    const alreadySubmitted = reports.some(r => 
      normalizeDate(r.date) === normalizedTargetDate && 
      r.telegramId === effectiveTelegramId && 
      !r.applicantWhatsapp && 
      !r.uid9Kucing && 
      !r.applicantTelegramUsername
    );

    if (alreadySubmitted && !isAdminOrOwner) {
      setError(`Anda sudah mengirimkan laporan harian untuk tanggal ${formatDateDisplay(formData.date)}. Laporan hanya dapat dikirim sekali per hari.`);
      setAlertState({
        isOpen: true,
        type: 'error',
        title: 'Duplikat Laporan',
        message: `Anda sudah pernah mengirimkan laporan harian untuk tanggal ${formatDateDisplay(formData.date)}. Jika ada kesalahan data, silakan hubungi Admin.`
      });
      return;
    }

    const isLateSubmission = nowWib.isPast10;
    const finalReportData = {
      ...formData,
      isLate: isLateSubmission,
      fine: isLateSubmission ? 5000 : 0
    };

    setError(null);
    setSuccessMsg(null);
    setIsSubmitting(true);

    try {
      const reportText = generateReportText(isLateSubmission);
      const newReport = await submitReport(finalReportData);

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

  const generateReportText = (isLateSubmission: boolean = false) => {
    const rawUsername = userProfile?.username 
      ? formatUsername(userProfile.username)
      : telegramUser?.username 
      ? formatUsername(telegramUser.username)
      : userProfile?.firstName 
      ? (userProfile.lastName ? `${userProfile.firstName} ${userProfile.lastName}` : userProfile.firstName)
      : telegramUser?.first_name 
      ? (telegramUser.last_name ? `${telegramUser.first_name} ${telegramUser.last_name}` : telegramUser.first_name)
      : 'Recruiter';
    const username = rawUsername.replace(/^@/, '');

    return `Laporan Recruiter @<b>${username}</b>
Tanggal: <b>${formatDateDisplay(formData.date)}</b>

Jumlah Orang yang bertanya pekerjaan: <b>${formData.visit || 0}</b>
Jumlah orang yang sudah memberikan data kerja : <b>${formData.applicant || 0}</b>
Jumlah pelamar yang disetujui: <b>${formData.quality || 0}</b>
Jumlah postingan yang disubmit: <b>${formData.posting || 0}</b>

Izin tidak bekerja? <b>${formData.permission === 1 ? 'YA (IZIN)' : 'TIDAK (AKTIF)'}</b>
Status Target & Efektif? <b>${formData.effectiveStatus || 'YES'}</b>${isLateSubmission ? '\nTerlambat? <b>YA (DENDA Rp 5.000)</b>' : ''}`;
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="space-y-5"
    >
      {/* Live WIB Timer & Lock Status */}
      <GlassCard className="p-4 bg-white/90 dark:bg-slate-950/80 border-slate-200/80 dark:border-slate-800/80 shadow-xl space-y-4">
        {/* Header Row */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 dark:border-slate-800/60 pb-3">
          <div className="flex items-center gap-2">
            <Timer className="w-4 h-4 text-sky-600 dark:text-sky-400 animate-pulse" />
            <h3 className="text-[11px] sm:text-xs font-black text-slate-900 dark:text-white uppercase tracking-wider">Status Laporan & Jadwal</h3>
          </div>
          <div className="flex items-center gap-1.5">
            <span className={`text-[8px] sm:text-[9px] font-black uppercase px-2 py-0.5 rounded-full border ${
              nowWib.isPast10 
                ? 'bg-rose-500/10 text-rose-600 dark:text-rose-300 border-rose-500/20' 
                : 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-300 border-emerald-500/20'
            }`}>
              {nowWib.isPast10 ? '🔴 Form Ditutup' : '🟢 Form Dibuka'}
            </span>
          </div>
        </div>

        {/* Modern Mobile-Optimized Timer Block */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-5 relative z-10 px-1 py-1">
          <div className="text-center sm:text-left space-y-1.5 flex-1">
            <div className="flex items-center justify-center sm:justify-start gap-2">
              <div className={`w-2 h-2 rounded-full animate-pulse ${nowWib.isPast10 ? 'bg-amber-500 shadow-[0_0_8px_rgba(251,191,36,0.5)]' : 'bg-emerald-500 shadow-[0_0_8px_rgba(52,211,153,0.5)]'}`} />
              <h2 className={`text-[11px] font-black uppercase tracking-[0.15em] ${nowWib.isPast10 ? 'text-amber-600 dark:text-amber-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
                {nowWib.isPast10 ? 'Form Ditutup' : 'Form Dibuka'}
              </h2>
            </div>
            <p className="text-[10px] text-slate-600 dark:text-slate-400 font-bold max-w-[280px] leading-relaxed mx-auto sm:mx-0">
              {nowWib.isPast10 
                ? 'Laporan berikutnya akan dibuka kembali pada pukul 00:00 WIB.' 
                : 'Kirimkan laporan Anda sebelum batas waktu pukul 10:00 WIB Pagi.'}
            </p>
          </div>
          
          <div className="flex items-center gap-1.5 font-mono shrink-0 scale-95 sm:scale-100">
            {[
              { val: nowWib.isPast10 ? reopenTimeInfo.hours : hours, label: 'Jam' },
              { val: nowWib.isPast10 ? reopenTimeInfo.minutes : minutes, label: 'Min' },
              { val: nowWib.isPast10 ? reopenTimeInfo.seconds : seconds, label: 'Det' }
            ].map((unit, uIdx) => (
              <React.Fragment key={uIdx}>
                <div className="text-center bg-slate-100 dark:bg-slate-900/90 px-3 py-2.5 rounded-[20px] border border-slate-300 dark:border-slate-800 shadow-2xl min-w-[56px] flex flex-col items-center">
                  <span className={`text-2xl font-black tracking-tighter block leading-none ${nowWib.isPast10 ? 'text-amber-600 dark:text-amber-400' : 'text-slate-900 dark:text-white'}`}>
                    {unit.val}
                  </span>
                  <span className="text-[7px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest mt-1.5 block leading-none">
                    {unit.label}
                  </span>
                </div>
                {uIdx < 2 && <span className="text-xl font-black text-slate-600 dark:text-slate-400 dark:text-slate-800 self-center mb-4">:</span>}
              </React.Fragment>
            ))}
          </div>
        </div>
      </GlassCard>

      <div className="flex bg-slate-100 dark:bg-slate-900/80 p-1.5 rounded-2xl border border-slate-200 dark:border-slate-800 shrink-0 gap-1 overflow-x-auto no-scrollbar scroll-smooth">
        <button
          type="button"
          onClick={() => {
            setActiveTab('form');
            triggerHaptic('selection');
          }}
          className={`shrink-0 flex-1 min-w-[100px] py-2 px-3 rounded-xl text-[10px] sm:text-xs font-black uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 ${
            activeTab === 'form' ? 'bg-sky-500 text-white shadow-lg scale-[1.02]' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          <FileText className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
          <span>Formulir</span>
        </button>
        <button
          type="button"
          onClick={() => {
            setActiveTab('weekly');
            triggerHaptic('selection');
          }}
          className={`shrink-0 flex-1 min-w-[110px] py-2 px-3 rounded-xl text-[10px] sm:text-xs font-black uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 ${
            activeTab === 'weekly' ? 'bg-indigo-500 text-white shadow-lg scale-[1.02]' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          <Calendar className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
          <span>Minggu Ini</span>
        </button>
        <button
          type="button"
          onClick={() => {
            setActiveTab('archive');
            triggerHaptic('selection');
          }}
          className={`shrink-0 flex-1 min-w-[100px] py-2 px-3 rounded-xl text-[10px] sm:text-xs font-black uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 ${
            activeTab === 'archive' ? 'bg-purple-500 text-white shadow-lg scale-[1.02]' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          <Clock className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
          <span>Arsip</span>
        </button>
        {isAdminOrOwner && (
          <button
            type="button"
            onClick={() => {
              setActiveTab('status');
              triggerHaptic('selection');
            }}
            className={`shrink-0 flex-1 min-w-[130px] py-2 px-3 rounded-xl text-[10px] sm:text-xs font-black uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 ${
              activeTab === 'status' ? 'bg-amber-500 text-slate-950 shadow-lg scale-[1.02]' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <Users className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            <span>Status Recruiter</span>
          </button>
        )}
      </div>

      {activeTab === 'form' && (
        <div className="space-y-5">
          <GlassCard className="border-slate-200/80 dark:border-slate-800/80 shadow-sm">
        <form onSubmit={handleSubmit} className="space-y-4">

          {nowWib.isPast10 && (
            <div className={`p-3.5 rounded-2xl flex items-start gap-3 border text-xs font-medium ${
              isLocked 
                ? 'bg-rose-500/15 border-rose-500/30 text-rose-700 dark:text-rose-300' 
                : 'bg-amber-500/15 border-amber-500/30 text-amber-800 dark:text-amber-300'
            }`}>
              <Lock className={`w-5 h-5 shrink-0 mt-0.5 ${isLocked ? 'text-rose-600 dark:text-rose-400' : 'text-amber-600 dark:text-amber-400'}`} />
              <div className="space-y-1">
                <strong className="block font-bold">
                  {isLocked ? '🔒 Formulir Laporan Harian Terkunci' : '⚠️ Batas Waktu 10.00 WIB telah Lewat'}
                </strong>
                <p>
                  Batas waktu pengiriman laporan harian (00.00 - 10.00 WIB) telah lewat untuk hari ini.
                </p>
                {isAdminOrOwner && (
                  <p className="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-1 pt-0.5">
                    <Unlock className="w-3 h-3 text-emerald-600 dark:text-emerald-400 shrink-0" />
                    <span>Akses Admin/Owner: Anda dapat tetap mengisi/mengirimkan laporan ini.</span>
                  </p>
                )}
              </div>
            </div>
          )}

          {error && (
            <div className="bg-rose-500/15 border border-rose-500/30 text-rose-700 dark:text-rose-300 text-xs p-3.5 rounded-2xl flex items-center gap-2 font-medium">
              <span>⚠️</span>
              <span>{error}</span>
            </div>
          )}

          {successMsg && (
            <div className="bg-emerald-500/15 border border-emerald-500/30 text-emerald-700 dark:text-emerald-300 text-xs p-3.5 rounded-2xl flex items-center gap-2 font-medium">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
              <span>{successMsg}</span>
            </div>
          )}

          <div className="relative group mb-4">
            <div className="absolute -inset-0.5 bg-gradient-to-r from-sky-500/10 to-indigo-500/10 rounded-[24px] blur opacity-75 transition duration-1000"></div>
            <div className="relative flex items-center justify-between p-4 bg-slate-50/90 dark:bg-slate-950/40 rounded-[20px] border border-slate-200 dark:border-slate-800/50 backdrop-blur-xl">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-2xl bg-sky-500/10 border border-sky-500/20 shadow-inner">
                  <Calendar className="w-5 h-5 text-sky-600 dark:text-sky-400" />
                </div>
                <div>
                  <p className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-[0.2em] leading-none mb-1.5">Periode Laporan</p>
                  <p className="text-xl font-black text-slate-900 dark:text-white tracking-tight leading-none">
                    {formatDateDisplay(formData.date)}
                  </p>
                </div>
              </div>
              <div className="flex flex-col items-end gap-2">
                <div className="px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center gap-1.5">
                  <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse shadow-[0_0_8px_rgba(52,211,153,0.5)]" />
                  <span className="text-[9px] font-black text-emerald-400 uppercase tracking-widest">Active</span>
                </div>
                <span className="text-[9px] text-slate-500 dark:text-slate-400 font-bold uppercase tracking-tighter opacity-60">
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

          {/* Pending Data Notice Alert Box */}
          {pendingReportsCount > 0 && (
            <div className="bg-amber-500/10 border border-amber-500/30 rounded-[20px] p-4 text-xs text-amber-300 flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <span className="font-extrabold block text-sm">⚠️ Ada Data Pelamar yang Masih Pending</span>
                <p className="leading-relaxed text-[11px] text-slate-700 dark:text-slate-300">
                  Terdapat <strong className="text-amber-300 font-extrabold">{pendingReportsCount} data pelamar</strong> Anda hari ini yang masih dalam proses pemeriksaan oleh Admin/Owner.
                </p>
                <p className="text-[10px] text-slate-500 dark:text-slate-400 leading-normal">
                  Jumlah pelamar disetujui (ACC) dan status target Anda akan otomatis diperbarui begitu pemeriksaan selesai.
                </p>
              </div>
            </div>
          )}

          {/* Section 1: Izin Tidak Bekerja */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold tracking-wider text-slate-600 dark:text-slate-400 uppercase px-1 flex items-center gap-1.5">
              <AlertCircle className="w-4 h-4 text-amber-400" />
              <span>Izin Tidak Bekerja?</span>
            </label>
            <span className="text-[10px] text-slate-600 dark:text-slate-400 px-1 block mb-2 -mt-1">
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
                    ? 'opacity-50 cursor-not-allowed bg-slate-100 dark:bg-slate-950 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-900'
                    : formData.permission === 0
                    ? 'bg-emerald-500/20 text-emerald-800 dark:text-emerald-300 border-emerald-500/40 font-black cursor-pointer shadow-sm'
                    : 'bg-slate-100 dark:bg-slate-900/80 text-slate-700 dark:text-slate-400 border-slate-200 dark:border-slate-800/80 hover:text-slate-900 dark:hover:text-slate-300 hover:border-slate-300 dark:hover:border-slate-700 cursor-pointer'
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
                    ? 'opacity-50 cursor-not-allowed bg-slate-100 dark:bg-slate-950 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-900'
                    : formData.permission === 1
                    ? 'bg-rose-500/20 text-rose-800 dark:text-rose-300 border-rose-500/40 font-black cursor-pointer shadow-sm'
                    : 'bg-slate-100 dark:bg-slate-900/80 text-slate-700 dark:text-slate-400 border-slate-200 dark:border-slate-800/80 hover:text-slate-900 dark:hover:text-slate-300 hover:border-slate-300 dark:hover:border-slate-700 cursor-pointer'
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
            <label className="text-xs font-bold tracking-wider text-slate-600 dark:text-slate-400 uppercase px-1 flex items-center gap-1.5">
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
                  <p className="text-[10px] text-slate-600 dark:text-slate-400 font-normal mt-0.5">
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
          <GlassCard className="p-4 border-slate-200 dark:border-slate-800/80 bg-white dark:bg-slate-950/50">
            <div className="flex items-center justify-between gap-3 mb-6">
              <div className="space-y-1">
                <h3 className="text-[15px] font-black text-slate-900 dark:text-white flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-sky-400" />
                  Minggu Ini
                </h3>
                <p className="text-[10px] text-slate-500 dark:text-slate-400 font-medium">Laporan aktif Anda.</p>
              </div>
              <div className="flex gap-2">
                <div className="flex flex-col items-end bg-indigo-500/10 border border-indigo-500/20 px-2.5 py-1 rounded-xl">
                  <span className="text-[8px] font-black uppercase text-indigo-300/80 leading-none mb-1">Postingan</span>
                  <span className="text-[15px] font-black text-slate-900 dark:text-white leading-none tracking-tighter">{totalPostingCurrentWeek}</span>
                </div>
                {totalFineCurrentWeek > 0 && (
                  <div className="flex flex-col items-end bg-rose-500/10 border border-rose-500/20 px-2.5 py-1 rounded-xl">
                    <span className="text-[8px] font-black uppercase text-rose-300/80 leading-none mb-1">Danda</span>
                    <span className="text-[13px] font-black text-rose-400 leading-none tracking-tighter">Rp {(totalFineCurrentWeek/1000).toFixed(0)}k</span>
                  </div>
                )}
              </div>
            </div>
            
            <div className="grid gap-3">
              {reports
                .filter(r => r.telegramId === effectiveTelegramId && !r.applicantWhatsapp && !r.uid9Kucing && !r.applicantTelegramUsername && r.date >= currentMondayStr)
                .sort((a, b) => b.date.localeCompare(a.date))
                .map((r, idx) => (
                  <div key={idx} className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 flex flex-col gap-3 active:scale-[0.98] transition-transform shadow-sm">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <div className={`w-9 h-9 rounded-xl flex items-center justify-center border ${r.permission === 1 ? 'bg-amber-500/10 text-amber-400 border-amber-500/20' : 'bg-blue-500/10 text-blue-400 border-blue-500/20'}`}>
                          {r.permission === 1 ? <UserX className="w-5 h-5" /> : <FileText className="w-5 h-5" />}
                        </div>
                        <div>
                          <span className="text-xs font-black text-slate-900 dark:text-white tracking-tight block">{formatDateDisplay(r.date)}</span>
                          <span className="text-[9px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest">{getIndonesianDayName(r.date)}</span>
                        </div>
                      </div>
                      <div className={`text-[9px] font-black px-2.5 py-1 rounded-full border ${
                        r.result === 'ACC' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20 shadow-[0_0_8px_rgba(52,211,153,0.1)]' :
                        r.result === 'REJECT' ? 'bg-rose-500/10 text-rose-400 border-rose-500/20 shadow-[0_0_8px_rgba(251,113,133,0.1)]' :
                        'bg-amber-500/10 text-amber-400 border-amber-500/20 shadow-[0_0_8px_rgba(251,191,36,0.1)]'
                      }`}>
                        {r.result || 'PENDING'}
                      </div>
                    </div>

                    <div className="grid grid-cols-4 gap-2">
                      {[
                        { label: 'Visit', value: r.visit, color: 'text-slate-900 dark:text-white' },
                        { label: 'Data', value: r.applicant, color: 'text-sky-400' },
                        { label: 'ACC', value: r.quality, color: 'text-emerald-400' },
                        { label: 'Post', value: r.posting || 0, color: 'text-indigo-400' }
                      ].map((stat, sIdx) => (
                        <div key={sIdx} className="bg-white dark:bg-slate-950/60 p-2 rounded-xl border border-slate-200 dark:border-slate-800/80 flex flex-col items-center">
                          <span className="text-[7px] font-black uppercase text-slate-500 dark:text-slate-400 mb-0.5 tracking-tighter">{stat.label}</span>
                          <span className={`text-sm font-black ${stat.color}`}>{stat.value}</span>
                        </div>
                      ))}
                    </div>

                    <div className="flex items-center justify-between mt-1">
                      <div className="flex items-center gap-2">
                        <span className={`text-[10px] font-black px-2 py-0.5 rounded-md border ${
                          r.effectiveStatus === 'YES' 
                            ? 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20' 
                            : 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                        }`}>
                          {r.effectiveStatus}
                        </span>
                        {r.permission === 1 && (
                          <span className="text-[9px] font-black text-rose-400 bg-rose-500/10 px-2 py-0.5 rounded-md uppercase tracking-tight">Izin</span>
                        )}
                      </div>
                      {(r.isLate || (r.fine && r.fine > 0)) && (
                        <span className="text-[10px] font-black text-rose-400 flex items-center gap-1">
                          <AlertCircle className="w-3 h-3" />
                          Danda Rp {(r.fine || 5000).toLocaleString('id-ID')}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              {reports.filter(r => r.telegramId === effectiveTelegramId && !r.applicantWhatsapp && !r.uid9Kucing && !r.applicantTelegramUsername && r.date >= currentMondayStr).length === 0 && (
                <div className="py-12 text-center bg-slate-50 dark:bg-slate-900/20 rounded-2xl border border-dashed border-slate-200 dark:border-slate-800/50">
                  <Clock className="w-8 h-8 text-slate-800 mx-auto mb-2 opacity-30" />
                  <p className="text-xs text-slate-500 dark:text-slate-400 italic">Belum ada laporan minggu ini.</p>
                </div>
              )}
            </div>
          </GlassCard>
        </div>
      )}

      {activeTab === 'archive' && (
        <div className="space-y-4">
          <GlassCard className="p-4 border-slate-200 dark:border-slate-800/80 bg-white dark:bg-slate-950/50">
            <div className="flex items-center gap-3 mb-6 px-1">
              <div className="p-2.5 rounded-xl bg-purple-500/10 border border-purple-500/20">
                <Clock className="w-5 h-5 text-purple-400" />
              </div>
              <div className="space-y-1">
                <h3 className="text-[15px] font-black text-slate-900 dark:text-white">Arsip Laporan</h3>
                <p className="text-[10px] text-slate-500 dark:text-slate-400 font-medium">Riwayat laporan lampau Anda.</p>
              </div>
            </div>

            <div className="grid gap-3">
              {archivedWeeks.map((week, wIdx) => {
                const isExpanded = expandedWeeks[week.monday];
                const weekEnd = new Date(week.monday);
                weekEnd.setDate(weekEnd.getDate() + 6);
                const weekEndStr = weekEnd.toISOString().split('T')[0];
                
                return (
                  <div key={week.monday} className="space-y-2">
                    <button
                      onClick={() => toggleWeek(week.monday)}
                      className={`w-full flex items-center justify-between p-3 rounded-2xl border transition-all ${
                        isExpanded 
                          ? 'bg-purple-500/10 border-purple-500/30 shadow-lg shadow-purple-500/5' 
                          : 'bg-slate-50 dark:bg-slate-900/40 border-slate-200 dark:border-slate-800/60 hover:bg-slate-50 dark:bg-slate-900/60'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className={`p-2 rounded-xl transition-colors ${
                          isExpanded ? 'bg-purple-500 text-slate-950' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                        }`}>
                          <Calendar className="w-3.5 h-3.5" />
                        </div>
                        <div className="text-left">
                          <span className="text-[11px] font-black text-slate-900 dark:text-slate-200 block uppercase tracking-wider">
                            Minggu {formatDateDisplay(week.monday)} - {formatDateDisplay(weekEndStr)}
                          </span>
                          <span className="text-[9px] font-bold text-slate-500 dark:text-slate-400">
                            {week.totalReports} Laporan Tersimpan
                          </span>
                        </div>
                      </div>
                      <motion.div
                        animate={{ rotate: isExpanded ? 180 : 0 }}
                        transition={{ type: 'spring', stiffness: 300, damping: 20 }}
                      >
                        <ChevronDown className={`w-4 h-4 ${isExpanded ? 'text-purple-400' : 'text-slate-600'}`} />
                      </motion.div>
                    </button>

                    <AnimatePresence>
                      {isExpanded && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.3, ease: 'easeInOut' }}
                          className="overflow-hidden"
                        >
                          <div className="grid gap-2 pl-2 border-l-2 border-purple-500/20 py-1 mt-2">
                            {week.dayGroups.map(([date, reps], dIdx) => {
                              const dayKey = `${week.monday}-${date}`;
                              const isDayExpanded = expandedArchiveDays[dayKey];
                              const dayName = getIndonesianDayName(date);
                              
                              return (
                                <div key={dIdx} className="space-y-2">
                                  <button
                                    onClick={() => toggleDay(dayKey)}
                                    className={`w-full flex items-center justify-between p-2.5 rounded-xl border transition-all ${
                                      isDayExpanded 
                                        ? 'bg-purple-500/5 border-purple-500/20 text-purple-300' 
                                        : 'bg-slate-50 dark:bg-slate-900/20 border-slate-200 dark:border-slate-800/40 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:bg-slate-900/40'
                                    }`}
                                  >
                                    <div className="flex items-center gap-2">
                                      <span className="text-[10px] font-black uppercase tracking-wider">{dayName}, {formatDateDisplay(date)}</span>
                                      <span className="text-[9px] font-bold px-1.5 py-0.2 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400">{reps.length}</span>
                                    </div>
                                    <ChevronDown className={`w-3.5 h-3.5 transition-transform ${isDayExpanded ? 'rotate-180' : ''}`} />
                                  </button>

                                  <AnimatePresence>
                                    {isDayExpanded && (
                                      <motion.div
                                        initial={{ height: 0, opacity: 0 }}
                                        animate={{ height: 'auto', opacity: 1 }}
                                        exit={{ height: 0, opacity: 0 }}
                                        className="overflow-hidden"
                                      >
                                        <div className="space-y-2 pl-2 border-l border-slate-200 dark:border-slate-800/50 py-1">
                                          {reps.map((r, idx) => (
                                            <div key={idx} className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-900/30 border border-slate-200 dark:border-slate-800/40 flex items-center justify-between opacity-90 active:scale-[0.99] transition-transform">
                                              <div className="flex items-center gap-3">
                                                <div className="w-9 h-9 rounded-xl bg-slate-100 dark:bg-slate-800/50 flex items-center justify-center text-slate-500 dark:text-slate-400 border border-slate-300 dark:border-slate-700/50">
                                                  {r.permission === 1 ? <UserX className="w-4 h-4" /> : <FileText className="w-4 h-4" />}
                                                </div>
                                                <div>
                                                  <div className="text-[13px] font-black text-slate-700 dark:text-slate-300 tracking-tight">{formatDateDisplay(r.date)}</div>
                                                  <div className="flex items-center gap-2 mt-0.5">
                                                    <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400">
                                                      {r.permission === 1 ? 'Izin' : `${r.posting || 0} Post`}
                                                    </span>
                                                    {r.fine && r.fine > 0 && (
                                                      <>
                                                        <span className="text-slate-800">•</span>
                                                        <span className="text-[10px] font-bold text-rose-500/60">Danda Rp {r.fine.toLocaleString('id-ID')}</span>
                                                      </>
                                                    )}
                                                  </div>
                                                </div>
                                              </div>
                                              <div className={`text-[9px] font-black px-2 py-1 rounded-full border ${
                                                r.result === 'ACC' ? 'bg-emerald-500/5 text-emerald-500/50 border-emerald-500/10' :
                                                r.result === 'REJECT' ? 'bg-rose-500/5 text-rose-500/50 border-rose-500/10' :
                                                'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border-slate-300 dark:border-slate-700/50'
                                              }`}>
                                                {r.result || 'PENDING'}
                                              </div>
                                            </div>
                                          ))}
                                        </div>
                                      </motion.div>
                                    )}
                                  </AnimatePresence>
                                </div>
                              );
                            })}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                );
              })}

              {archivedWeeks.length === 0 && (
                <div className="py-12 text-center bg-slate-50 dark:bg-slate-900/10 rounded-2xl border border-dashed border-slate-200 dark:border-slate-800/30">
                  <Clock className="w-8 h-8 text-slate-800 mx-auto mb-2 opacity-10" />
                  <p className="text-xs text-slate-600 italic">Belum ada arsip laporan.</p>
                </div>
              )}
            </div>
          </GlassCard>
        </div>
      )}

      {activeTab === 'status' && isAdminOrOwner && (
        <div className="space-y-4">
          <div className="flex bg-slate-50 dark:bg-slate-900/80 p-1.5 rounded-2xl border border-slate-200 dark:border-slate-800 shrink-0 gap-1 overflow-x-auto no-scrollbar scroll-smooth">
            <button
              onClick={() => { setStatusSubTab('izin'); triggerHaptic('selection'); }}
              className={`flex-1 py-2 px-3 rounded-xl text-[10px] sm:text-xs font-black uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 ${
                statusSubTab === 'izin' ? 'bg-amber-500 text-slate-950 shadow-lg scale-[1.02]' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <UserX className="w-3.5 h-3.5" />
              <span>Izin ({izinRecruiters.length})</span>
            </button>
            <button
              onClick={() => { setStatusSubTab('sudah'); triggerHaptic('selection'); }}
              className={`flex-1 py-2 px-3 rounded-xl text-[10px] sm:text-xs font-black uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 ${
                statusSubTab === 'sudah' ? 'bg-emerald-500 text-slate-950 shadow-lg scale-[1.02]' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>Sudah ({sudahLaporan.length})</span>
            </button>
            <button
              onClick={() => { setStatusSubTab('belum'); triggerHaptic('selection'); }}
              className={`flex-1 py-2 px-3 rounded-xl text-[10px] sm:text-xs font-black uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 ${
                statusSubTab === 'belum' ? 'bg-rose-500 text-slate-950 shadow-lg scale-[1.02]' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <AlertCircle className="w-3.5 h-3.5" />
              <span>Belum ({belumLaporan.length})</span>
            </button>
          </div>

          <GlassCard className="p-4 border-slate-200 dark:border-slate-800/80 space-y-4 bg-white dark:bg-slate-950/50 min-h-[300px]">
            {statusSubTab === 'izin' && (
              <div className="space-y-4">
                {izinRecruiters.length === 0 ? (
                  <div className="py-12 text-center bg-slate-50 dark:bg-slate-900/20 rounded-2xl border border-dashed border-slate-200 dark:border-slate-800/50">
                    <p className="text-xs text-slate-500 dark:text-slate-400 italic">Tidak ada recruiter yang izin hari ini.</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {izinRecruiters.map(r => (
                      <div key={r.telegramId} className="flex items-center gap-3 p-3 rounded-2xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800/80 w-full min-w-0">
                        <div className="w-10 h-10 rounded-xl overflow-hidden bg-slate-100 dark:bg-slate-800 shrink-0 border border-slate-300 dark:border-slate-700">
                          {r.photoUrl ? (
                            <img src={r.photoUrl} alt={r.firstName} className="w-full h-full object-cover grayscale opacity-70" referrerPolicy="no-referrer" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-slate-500 dark:text-slate-400 font-bold text-xs uppercase">
                              {r.firstName.slice(0, 2)}
                            </div>
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-bold text-slate-900 dark:text-slate-200 truncate">{r.firstName} {r.lastName}</p>
                          <p className="text-[10px] text-amber-500 font-bold uppercase tracking-tighter">Status: Izin</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {statusSubTab === 'sudah' && (
              <div className="space-y-4">
                {sudahLaporan.length === 0 ? (
                  <div className="py-12 text-center bg-slate-50 dark:bg-slate-900/20 rounded-2xl border border-dashed border-slate-200 dark:border-slate-800/50">
                    <p className="text-xs text-slate-500 dark:text-slate-400 italic">Belum ada yang mengumpulkan laporan aktif.</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {sudahLaporan.map(r => (
                      <div key={r.telegramId} className="flex items-center gap-3 p-3 rounded-2xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800/80 w-full min-w-0">
                        <div className="w-10 h-10 rounded-xl overflow-hidden bg-slate-100 dark:bg-slate-800 shrink-0 border border-slate-300 dark:border-slate-700">
                          {r.photoUrl ? (
                            <img src={r.photoUrl} alt={r.firstName} className="w-full h-full object-cover"  />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-slate-500 dark:text-slate-400 font-bold text-xs uppercase">
                              {r.firstName.slice(0, 2)}
                            </div>
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-bold text-slate-900 dark:text-slate-200 truncate">{r.firstName} {r.lastName}</p>
                          <p className="text-[10px] text-emerald-500 font-bold uppercase tracking-tighter">Status: Aktif</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {statusSubTab === 'belum' && (
              <div className="space-y-4">
                {belumLaporan.length === 0 ? (
                  <div className="py-12 text-center bg-slate-50 dark:bg-slate-900/20 rounded-2xl border border-dashed border-slate-200 dark:border-slate-800/50">
                    <p className="text-xs text-slate-500 dark:text-slate-400 italic">Semua recruiter sudah mengumpulkan laporan.</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {belumLaporan.map(r => (
                      <div key={r.telegramId} className="flex items-center gap-3 p-3 rounded-2xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800/80 w-full min-w-0">
                        <div className="w-10 h-10 rounded-xl overflow-hidden bg-slate-100 dark:bg-slate-800 shrink-0 border border-slate-300 dark:border-slate-700">
                          {r.photoUrl ? (
                            <img src={r.photoUrl} alt={r.firstName} className="w-full h-full object-cover grayscale opacity-70" referrerPolicy="no-referrer" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-slate-500 dark:text-slate-400 font-bold text-xs uppercase">
                              {r.firstName.slice(0, 2)}
                            </div>
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-bold text-slate-700 dark:text-slate-300 truncate">{r.firstName} {r.lastName}</p>
                          <p className="text-[10px] text-rose-500 font-bold uppercase tracking-tighter">Status: Belum</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </GlassCard>
        </div>
      )}

      {/* Modern Alert Modal Overlay */}
      <AnimatePresence>
        {alertState.isOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-white dark:bg-slate-950/80 backdrop-blur-md">
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="w-full max-w-sm rounded-[32px] bg-slate-50 dark:bg-slate-900/95 border border-slate-200 dark:border-slate-800 p-8 shadow-2xl space-y-6 text-center relative overflow-hidden"
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
                <h3 className="text-xl font-black text-slate-900 dark:text-white tracking-tight">
                  {alertState.title}
                </h3>
                <p className="text-sm font-medium text-slate-600 dark:text-slate-400 leading-relaxed">
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

