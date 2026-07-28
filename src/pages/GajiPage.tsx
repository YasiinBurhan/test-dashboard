import React, { useState, useEffect, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Coins, 
  Search, 
  Filter, 
  ArrowUpDown, 
  Plus, 
  FileText, 
  CheckCircle2, 
  Clock, 
  X, 
  Edit, 
  Trash2, 
  RefreshCw, 
  Printer, 
  Award, 
  TrendingUp, 
  Percent, 
  Calendar, 
  User, 
  Briefcase,
  TrendingDown,
  ChevronRight,
  ChevronDown,
  Info,
  BookOpen,
  ListOrdered,
  ShieldAlert,
  ChevronUp
} from 'lucide-react';
import { GlassCard } from '../components/common/GlassCard';
import { triggerHaptic } from '../telegram/webapp';
import { useAuth } from '../hooks/useAuth';
import { subscribeToAllUsers } from '../firebase/services/userService';
import { subscribeToAllReports } from '../firebase/services/reportService';
import { 
  subscribeToAllSalaries, 
  saveSalarySlip, 
  deleteSalarySlip, 
  calculateRecruiterMetrics 
} from '../firebase/services/salaryService';
import { UserProfile, DailyReport, RecruiterSalary } from '../types';
import { getWIBMonday, getWIBMondayOfDate, getWIBWeekRange } from '../utils/format';

export const GajiPage: React.FC = () => {
  const { userProfile } = useAuth();
  
  // Roles check
  const isAdminOrOwner = userProfile?.role === 'Admin' || userProfile?.role === 'Owner';
  const isRecruiter = userProfile?.role === 'Recruiter';

  // State
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [reports, setReports] = useState<DailyReport[]>([]);
  const [salaries, setSalaries] = useState<RecruiterSalary[]>([]);
  const [loading, setLoading] = useState(true);

  // Period management
  const [selectedPeriod, setSelectedPeriod] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'uninput' | 'draft' | 'paid'>('all');
  const [sortBy, setSortBy] = useState<'name' | 'gaji' | 'hari'>('name');

  // Guide widget state
  const [isGuideOpen, setIsGuideOpen] = useState(true);
  const [activeGuideTab, setActiveGuideTab] = useState<'ketentuan' | 'alur' | 'jadwal'>('ketentuan');

  // Period in examination check
  const currentMondayStr = useMemo(() => getWIBMonday(0), []);
  const isPeriodInPemeriksaan = useMemo(() => {
    if (!selectedPeriod) return false;
    return selectedPeriod < currentMondayStr;
  }, [selectedPeriod, currentMondayStr]);
  
  // Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedRecruiter, setSelectedRecruiter] = useState<UserProfile | null>(null);
  const [formData, setFormData] = useState<Partial<RecruiterSalary>>({});
  const [isSaving, setIsSaving] = useState(false);
  const [isCalculating, setIsCalculating] = useState(false);
  const [viewOnly, setViewOnly] = useState(false);

  // Generate WIB week period options (last 8 weeks)
  const periodOptions = useMemo(() => {
    const options = [];
    const today = new Date();
    // Offset weekly to get past Mondays
    for (let i = 0; i < 8; i++) {
      const offsetDays = -i * 7;
      const d = new Date(today);
      d.setDate(today.getDate() + offsetDays);
      
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      const dateStr = `${year}-${month}-${day}`;
      const mondayStr = getWIBMondayOfDate(dateStr);
      
      if (mondayStr) {
        const { formattedRange, shortFormattedRange } = getWIBWeekRange(mondayStr);
        options.push({
          mondayStr,
          label: `Periode: ${shortFormattedRange}`,
          fullLabel: formattedRange
        });
      }
    }
    return options;
  }, []);

  // Initialize selected period with current week's Monday
  useEffect(() => {
    if (periodOptions.length > 0 && !selectedPeriod) {
      setSelectedPeriod(periodOptions[0].mondayStr);
    }
  }, [periodOptions, selectedPeriod]);

  // Real-time subscriptions
  useEffect(() => {
    setLoading(true);
    
    const unsubUsers = subscribeToAllUsers((updatedUsers) => {
      // Filter out admins/owners, only process Recruiters
      const recruiters = updatedUsers.filter(u => u.role === 'Recruiter' && u.status === 'Active');
      setUsers(recruiters);
    });

    const unsubReports = subscribeToAllReports((updatedReports) => {
      setReports(updatedReports);
    });

    const unsubSalaries = subscribeToAllSalaries((updatedSalaries) => {
      setSalaries(updatedSalaries);
      setLoading(false);
    });

    return () => {
      unsubUsers();
      unsubReports();
      unsubSalaries();
    };
  }, []);

  // Format IDR Currency
  const formatRupiah = (val: number | undefined) => {
    if (val === undefined || isNaN(val)) return 'Rp 0';
    return 'Rp ' + Number(val).toLocaleString('id-ID');
  };

  // Filter & sort recruiters whose salary is pending / calculated
  const baseProcessedRecruiters = useMemo(() => {
    if (!selectedPeriod) return [];

    return users.map(user => {
      // Find saved salary slip for this period
      const rawSavedSalary = salaries.find(
        s => s.telegramId === user.telegramId && s.periode === selectedPeriod
      );

      const savedSalary = rawSavedSalary ? {
        ...rawSavedSalary,
        deklarasiV0: isPeriodInPemeriksaan ? (rawSavedSalary.deklarasiV0 || 0) : 0,
        sebenarnyaV0: isPeriodInPemeriksaan ? (rawSavedSalary.sebenarnyaV0 || 0) : 0,
        deklarasiT0: isPeriodInPemeriksaan ? (rawSavedSalary.deklarasiT0 || 0) : 0,
        sebenarnyaT0: isPeriodInPemeriksaan ? (rawSavedSalary.sebenarnyaT0 || 0) : 0,
        t3: isPeriodInPemeriksaan ? (rawSavedSalary.t3 || 0) : 0,
      } : null;

      // Check daily reports for this period to verify if any report exists
      const userReports = reports.filter(r => {
        const rDate = r.date || (r.createdAt ? r.createdAt.split('T')[0] : '');
        return r.telegramId === user.telegramId && getWIBMondayOfDate(rDate) === selectedPeriod;
      });

      return {
        user,
        salarySlip: savedSalary || null,
        hasReports: userReports.length > 0,
        reportsCount: userReports.length,
        status: savedSalary ? savedSalary.status : 'uninput' // 'uninput' | 'Draft' | 'Paid'
      };
    })
    .filter(item => {
      // Search filter
      const searchLower = searchQuery.toLowerCase();
      return item.user.firstName?.toLowerCase().includes(searchLower) || 
             item.user.lastName?.toLowerCase().includes(searchLower) ||
             item.user.username?.toLowerCase().includes(searchLower);
    })
    .sort((a, b) => {
      // Sort configurations
      if (sortBy === 'name') {
        const nameA = `${a.user.firstName} ${a.user.lastName}`.trim().toLowerCase();
        const nameB = `${b.user.firstName} ${b.user.lastName}`.trim().toLowerCase();
        return nameA.localeCompare(nameB);
      }
      if (sortBy === 'gaji') {
        const salaryA = a.salarySlip?.totalGaji || 0;
        const salaryB = b.salarySlip?.totalGaji || 0;
        return salaryB - salaryA; // highest salary first
      }
      if (sortBy === 'hari') {
        const daysA = a.salarySlip?.hariEfektif || 0;
        const daysB = b.salarySlip?.hariEfektif || 0;
        return daysB - daysA; // highest effective days first
      }
      return 0;
    });
  }, [users, reports, salaries, selectedPeriod, searchQuery, sortBy]);

  // Split into Belum and Sudah Input
  const { belumInputRecruiters, sudahInputRecruiters } = useMemo(() => {
    const belum = baseProcessedRecruiters.filter(item => item.status === 'uninput');
    const sudah = baseProcessedRecruiters.filter(item => item.status === 'Draft' || item.status === 'Paid');
    return { belumInputRecruiters: belum, sudahInputRecruiters: sudah };
  }, [baseProcessedRecruiters]);

  // Backwards-compatible filtered processedRecruiters list
  const processedRecruiters = useMemo(() => {
    return baseProcessedRecruiters.filter(item => {
      if (statusFilter === 'uninput') return item.status === 'uninput';
      if (statusFilter === 'draft') return item.status === 'Draft';
      if (statusFilter === 'paid') return item.status === 'Paid';
      return true;
    });
  }, [baseProcessedRecruiters, statusFilter]);

  // Recruiter's personal salary slips
  const mySalaries = useMemo(() => {
    if (!userProfile?.telegramId) return [];
    return salaries.filter(s => s.telegramId === userProfile.telegramId);
  }, [salaries, userProfile]);

  // Calculations for summary boxes (Admin/Owner)
  const summaryStats = useMemo(() => {
    if (!selectedPeriod) return { totalStaff: 0, pendingInput: 0, totalDraft: 0, totalPaid: 0, totalPayout: 0 };
    
    let totalStaff = users.length;
    let pendingInput = 0;
    let totalDraft = 0;
    let totalPaid = 0;
    let totalPayout = 0;

    users.forEach(u => {
      const slip = salaries.find(s => s.telegramId === u.telegramId && s.periode === selectedPeriod);
      if (!slip) {
        pendingInput++;
      } else {
        if (slip.status === 'Draft') totalDraft++;
        if (slip.status === 'Paid') totalPaid++;
        totalPayout += (slip.totalGaji || 0);
      }
    });

    return { totalStaff, pendingInput, totalDraft, totalPaid, totalPayout };
  }, [users, salaries, selectedPeriod]);

  // Handle open creation or editing modal
  const handleOpenSalaryModal = async (recruiter: UserProfile, slip: RecruiterSalary | null = null, viewMode: boolean = false) => {
    setSelectedRecruiter(recruiter);
    setViewOnly(!isAdminOrOwner ? true : viewMode);
    
    if (slip) {
      // Open existing slip
      setFormData({
        ...slip,
        deklarasiV0: isPeriodInPemeriksaan ? (slip.deklarasiV0 || 0) : 0,
        sebenarnyaV0: isPeriodInPemeriksaan ? (slip.sebenarnyaV0 || 0) : 0,
        deklarasiT0: isPeriodInPemeriksaan ? (slip.deklarasiT0 || 0) : 0,
        sebenarnyaT0: isPeriodInPemeriksaan ? (slip.sebenarnyaT0 || 0) : 0,
        t3: isPeriodInPemeriksaan ? (slip.t3 || 0) : 0,
      });
      setIsModalOpen(true);
    } else {
      // Start auto-calculation for new slip
      setIsCalculating(true);
      setIsModalOpen(true);
      try {
        const autoMetrics = await calculateRecruiterMetrics(recruiter.telegramId, selectedPeriod);
        
        setFormData({
          id: `${recruiter.telegramId}_${selectedPeriod}`,
          periode: selectedPeriod,
          username: recruiter.username || '',
          recruiterName: `${recruiter.firstName || ''} ${recruiter.lastName || ''}`.trim(),
          telegramId: recruiter.telegramId,
          status: 'Draft',
          note: '',
          ...autoMetrics,
          deklarasiV0: isPeriodInPemeriksaan ? (autoMetrics.deklarasiV0 || 0) : 0,
          sebenarnyaV0: isPeriodInPemeriksaan ? (autoMetrics.sebenarnyaV0 || 0) : 0,
          deklarasiT0: isPeriodInPemeriksaan ? (autoMetrics.deklarasiT0 || 0) : 0,
          sebenarnyaT0: isPeriodInPemeriksaan ? (autoMetrics.sebenarnyaT0 || 0) : 0,
          t3: isPeriodInPemeriksaan ? (autoMetrics.t3 || 0) : 0,
        });
      } catch (err) {
        console.error('Failed to pre-calculate salary:', err);
      } finally {
        setIsCalculating(false);
      }
    }
  };

  // Recalculate values based on inputs
  const recalculateTotal = (updatedFields: Partial<RecruiterSalary>) => {
    setFormData(prev => {
      const merged = { ...prev, ...updatedFields };
      
      let levelGaji = merged.levelGaji || 'Level 1';
      let t3Count = Number(merged.t3) || 0;
      let sebenarnyaV0Count = Number(merged.sebenarnyaV0) || 0;
      let sebenarnyaT0Count = Number(merged.sebenarnyaT0) || 0;

      const totalPromosi = t3Count + sebenarnyaV0Count;

      // Auto calculate level based on t3 & sebenarnyaV0 if levelGaji wasn't explicitly changed
      if (updatedFields.t3 !== undefined || updatedFields.sebenarnyaV0 !== undefined || updatedFields.levelGaji === undefined) {
        levelGaji = totalPromosi >= 12 ? 'Level 3' : totalPromosi >= 7 ? 'Level 2' : totalPromosi >= 3 ? 'Level 1' : 'Level 0';
      }

      let defaultGajiPokok = Number(merged.gajiPokok) || 0;
      let defaultKomisi = Number(merged.komisi) || 0;
      let defaultBonusT3 = Number(merged.bonusT3) || 0;

      // Calculate default components based on levelGaji
      if (levelGaji === 'Level 3') {
        defaultGajiPokok = 500000;
        defaultKomisi = sebenarnyaT0Count * 2000;
        defaultBonusT3 = totalPromosi * 9000;
      } else if (levelGaji === 'Level 2') {
        defaultGajiPokok = 400000;
        defaultKomisi = sebenarnyaT0Count * 2000;
        defaultBonusT3 = totalPromosi * 8000;
      } else if (levelGaji === 'Level 1') {
        defaultGajiPokok = 300000;
        defaultKomisi = sebenarnyaT0Count * 2000;
        defaultBonusT3 = totalPromosi * 7000;
      } else { // Level 0
        defaultGajiPokok = 0;
        defaultKomisi = sebenarnyaT0Count * 5000;
        defaultBonusT3 = totalPromosi * 10000;
      }

      const gajiPokok = updatedFields.gajiPokok !== undefined ? Number(updatedFields.gajiPokok) : defaultGajiPokok;
      const komisi = updatedFields.komisi !== undefined ? Number(updatedFields.komisi) : defaultKomisi;
      const bonusT0 = Number(merged.bonusT0) || 0;
      const bonusT3 = updatedFields.bonusT3 !== undefined ? Number(updatedFields.bonusT3) : defaultBonusT3;
      const otherBonus = Number(merged.otherBonus) || 0;
      const deduksi = Number(merged.deduksi) || 0;
      
      const totalGaji = Math.max(0, gajiPokok + komisi + bonusT0 + bonusT3 + otherBonus - deduksi);
      
      // Also calculate tingkat penerimaan dynamically if deklarasi and sebenarnya changed
      let tingkatPenerimaan = merged.tingkatPenerimaan || 0;
      const totalDeklarasi = (Number(merged.deklarasiT0) || 0) + (Number(merged.deklarasiV0) || 0);
      const totalSebenarnya = (Number(merged.sebenarnyaT0) || 0) + (Number(merged.sebenarnyaV0) || 0);
      if (totalDeklarasi > 0) {
        tingkatPenerimaan = Math.round((totalSebenarnya / totalDeklarasi) * 100);
      }

      return {
        ...merged,
        levelGaji,
        gajiPokok,
        komisi,
        bonusT3,
        totalGaji,
        tingkatPenerimaan
      };
    });
  };

  // Save/submit form to Firestore
  const handleSaveSalary = async () => {
    if (!isAdminOrOwner) return;
    if (!formData.id || !formData.periode) return;
    
    setIsSaving(true);
    try {
      const finalSlip: RecruiterSalary = {
        id: formData.id,
        periode: formData.periode,
        username: formData.username || '',
        recruiterName: formData.recruiterName || '',
        telegramId: formData.telegramId || '',
        hariEfektif: Number(formData.hariEfektif) || 0,
        totalPostingan: Number(formData.totalPostingan) || 0,
        deklarasiT0: Number(formData.deklarasiT0) || 0,
        sebenarnyaT0: Number(formData.sebenarnyaT0) || 0,
        t3: Number(formData.t3) || 0,
        deklarasiV0: Number(formData.deklarasiV0) || 0,
        sebenarnyaV0: Number(formData.sebenarnyaV0) || 0,
        levelGaji: formData.levelGaji || 'Recruiter',
        tingkatPenerimaan: Number(formData.tingkatPenerimaan) || 0,
        rasioPeningkatan: Number(formData.rasioPeningkatan) || 0,
        gajiPokok: Number(formData.gajiPokok) || 0,
        komisi: Number(formData.komisi) || 0,
        bonusT0: Number(formData.bonusT0) || 0,
        bonusT3: Number(formData.bonusT3) || 0,
        otherBonus: Number(formData.otherBonus) || 0,
        deduksi: Number(formData.deduksi) || 0,
        totalGaji: Number(formData.totalGaji) || 0,
        status: (formData.status as 'Draft' | 'Paid') || 'Draft',
        note: formData.note || '',
        createdAt: formData.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        createdBy: userProfile?.username || 'System'
      };

      await saveSalarySlip(finalSlip);
      setIsModalOpen(false);
    } catch (err) {
      alert('Gagal menyimpan slip gaji. Silakan coba kembali.');
    } finally {
      setIsSaving(false);
    }
  };

  // Quick action: recalculate default
  const triggerAutoRecalculate = async () => {
    if (!isAdminOrOwner) return;
    if (!formData.telegramId || !formData.periode) return;
    setIsCalculating(true);
    try {
      const autoMetrics = await calculateRecruiterMetrics(formData.telegramId, formData.periode);
      recalculateTotal({
        ...autoMetrics,
        deklarasiV0: isPeriodInPemeriksaan ? (autoMetrics.deklarasiV0 || 0) : 0,
        sebenarnyaV0: isPeriodInPemeriksaan ? (autoMetrics.sebenarnyaV0 || 0) : 0,
        deklarasiT0: isPeriodInPemeriksaan ? (autoMetrics.deklarasiT0 || 0) : 0,
        sebenarnyaT0: isPeriodInPemeriksaan ? (autoMetrics.sebenarnyaT0 || 0) : 0,
        t3: isPeriodInPemeriksaan ? (autoMetrics.t3 || 0) : 0,
      });
    } catch (err) {
      console.error('Recalculation failed:', err);
    } finally {
      setIsCalculating(false);
    }
  };

  // Delete slip
  const handleDeleteSlip = async (id: string) => {
    if (!isAdminOrOwner) return;
    if (confirm('Apakah Anda yakin ingin menghapus slip gaji ini?')) {
      try {
        await deleteSalarySlip(id);
      } catch (err) {
        alert('Gagal menghapus slip gaji.');
      }
    }
  };

  // Simulate print/export slip
  const printSlip = () => {
    window.print();
  };

  if (!isAdminOrOwner && !isRecruiter) {
    return (
      <div className="flex flex-col items-center justify-center py-20 px-4 text-center">
        <div className="w-16 h-16 bg-slate-100 dark:bg-slate-900 rounded-full flex items-center justify-center mb-4">
          <Coins className="w-8 h-8 text-slate-400" />
        </div>
        <h2 className="text-xl font-black text-slate-900 dark:text-white mb-2">Akses Dibatasi</h2>
        <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm">
          Sistem Penggajian hanya dapat diakses oleh Admin, Owner, dan Recruiter aktif.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6 px-1 pb-16">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-black text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
            <Coins className="w-5.5 h-5.5 text-emerald-500" />
            <span>Sistem Penggajian Recruiter</span>
          </h2>
          <p className="text-[11px] text-slate-600 dark:text-slate-400">
            {isAdminOrOwner 
              ? 'Kelola rekapitulasi slip gaji mingguan, verifikasi target, denda denda, bonus, dan komisi tim.' 
              : 'Pantau riwayat penerimaan slip gaji mingguan, rincian komisi, denda keterlambatan, dan bonus Anda.'}
          </p>
        </div>

        {/* Period Selection */}
        <div className="flex items-center gap-2">
          <Calendar className="w-4 h-4 text-slate-500" />
          <select
            value={selectedPeriod}
            onChange={(e) => setSelectedPeriod(e.target.value)}
            className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl px-4 py-2 text-xs font-black text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
          >
            {periodOptions.map((opt) => (
              <option key={opt.mondayStr} value={opt.mondayStr}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Panduan & Deskripsi Penggajian Recruiter Widget */}
      <GlassCard className="p-4 bg-white/90 dark:bg-slate-950/90 border-slate-200 dark:border-slate-800 shadow-xl space-y-3 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-500/5 rounded-full blur-xl pointer-events-none" />
        
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center shrink-0 text-emerald-600 dark:text-emerald-400">
              <BookOpen className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-xs font-black text-slate-900 dark:text-white tracking-tight flex items-center gap-1.5">
                Panduan & Cara Kerja Sistem Penggajian
              </h3>
              <p className="text-[10px] text-slate-600 dark:text-slate-400 font-medium">
                Recruiter <strong className="text-emerald-600 dark:text-emerald-400 font-bold">TIDAK PERLU</strong> menginput data gaji — Perhitungan dikalkulasi otomatis oleh sistem
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => { setIsGuideOpen(!isGuideOpen); triggerHaptic('selection'); }}
            className="p-1.5 rounded-xl bg-slate-100 dark:bg-slate-900 border border-slate-300 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors"
          >
            {isGuideOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        </div>

        {isGuideOpen && (
          <div className="space-y-3 pt-2 border-t border-slate-200 dark:border-slate-800/80">
            {/* Sub-tabs inside Guide Widget */}
            <div className="flex p-0.5 bg-slate-100 dark:bg-slate-900/90 rounded-xl border border-slate-200 dark:border-slate-800/80 gap-0.5">
              <button
                type="button"
                onClick={() => { setActiveGuideTab('ketentuan'); triggerHaptic('selection'); }}
                className={`flex-1 py-1.5 rounded-lg text-[9.5px] font-black uppercase transition-all flex items-center justify-center gap-1 ${
                  activeGuideTab === 'ketentuan'
                    ? 'bg-emerald-500 text-slate-950 shadow-sm'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <ShieldAlert className="w-3.5 h-3.5" />
                1. Ketentuan Input
              </button>
              <button
                type="button"
                onClick={() => { setActiveGuideTab('alur'); triggerHaptic('selection'); }}
                className={`flex-1 py-1.5 rounded-lg text-[9.5px] font-black uppercase transition-all flex items-center justify-center gap-1 ${
                  activeGuideTab === 'alur'
                    ? 'bg-sky-500 text-slate-950 shadow-sm'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <ListOrdered className="w-3.5 h-3.5" />
                2. Alur Otomatis
              </button>
              <button
                type="button"
                onClick={() => { setActiveGuideTab('jadwal'); triggerHaptic('selection'); }}
                className={`flex-1 py-1.5 rounded-lg text-[9.5px] font-black uppercase transition-all flex items-center justify-center gap-1 ${
                  activeGuideTab === 'jadwal'
                    ? 'bg-amber-500 text-slate-950 shadow-sm'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <Calendar className="w-3.5 h-3.5" />
                3. Jadwal & Status
              </button>
            </div>

            {/* Tab 1: Ketentuan Input */}
            {activeGuideTab === 'ketentuan' && (
              <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800/60 space-y-3 text-[11px] text-slate-700 dark:text-slate-300 leading-relaxed">
                <div className="flex items-center gap-2 text-emerald-700 dark:text-emerald-400 font-black">
                  <Info className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                  <span>Informasi Beban Kerja & Input Data Gaji:</span>
                </div>
                <div className="space-y-2 text-[10px]">
                  <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-slate-800 dark:text-slate-200">
                    <p className="font-bold text-emerald-700 dark:text-emerald-400 mb-1 flex items-center gap-1.5">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      Recruiter Tidak Perlu Menginput Apapun di Halaman Ini
                    </p>
                    <p className="text-slate-600 dark:text-slate-400 font-medium">
                      Sebagai Recruiter, Anda <strong className="text-slate-900 dark:text-white">tidak perlu menginput angka gaji atau nominal apapun</strong> secara manual. Semua rincian komponen gaji Anda dihitung dan ditarik secara otomatis oleh sistem.
                    </p>
                  </div>
                  <ul className="space-y-2 text-slate-600 dark:text-slate-400 font-medium">
                    <li className="flex items-start gap-2 p-2 rounded-xl bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
                      <span className="w-2 h-2 rounded-full bg-sky-500 shrink-0 mt-1.5" />
                      <span><strong className="text-slate-900 dark:text-white">Input Laporan Harian:</strong> Anda hanya perlu fokus melaporkan rekrutan di menu <strong className="text-slate-900 dark:text-white">Data Harian</strong> dan mengirim link lowongan di menu <strong className="text-slate-900 dark:text-white">Postingan</strong>.</span>
                    </li>
                    <li className="flex items-start gap-2 p-2 rounded-xl bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
                      <span className="w-2 h-2 rounded-full bg-amber-500 shrink-0 mt-1.5" />
                      <span><strong className="text-slate-900 dark:text-white">Pengelolaan Admin & Owner:</strong> Admin dan Owner bertugas meninjau, memverifikasi, merekap, dan menerbitkan slip gaji serta memproses pembayaran.</span>
                    </li>
                    <li className="flex items-start gap-2 p-2 rounded-xl bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
                      <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0 mt-1.5" />
                      <span><strong className="text-slate-900 dark:text-white">Transparansi Rincian:</strong> Anda dapat melihat rincian gaji pokok, komisi rekrutan, denda keterlambatan, hingga bonus omset secara transparan kapan saja di halaman ini.</span>
                    </li>
                  </ul>
                </div>
              </div>
            )}

            {/* Tab 2: Alur Otomatis */}
            {activeGuideTab === 'alur' && (
              <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800/60 space-y-3 text-[11px] text-slate-700 dark:text-slate-300">
                <div className="flex items-center gap-2 text-sky-700 dark:text-sky-400 font-black">
                  <ListOrdered className="w-4 h-4 text-sky-600 dark:text-sky-400 shrink-0" />
                  <span>Sumber Data Perhitungan Otomatis Slip Gaji:</span>
                </div>
                <ol className="space-y-2.5 text-[10px] text-slate-600 dark:text-slate-400">
                  <li className="flex items-start gap-2.5 p-2.5 rounded-xl bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
                    <span className="w-5 h-5 rounded-full bg-sky-100 dark:bg-sky-950 text-sky-700 dark:text-sky-400 font-black flex items-center justify-center shrink-0 text-[10px] border border-sky-200 dark:border-sky-900/40">1</span>
                    <div>
                      <strong className="text-slate-900 dark:text-white block mb-0.5">Syarat Verifikasi Data Harian (Tab Pemeriksaan):</strong>
                      Data rekrutan V0, T0, dan T3 <strong className="text-slate-900 dark:text-white">baru terhitung di slip gaji</strong> setelah melewati minggu berjalan dan diproses di <strong className="text-sky-600 dark:text-sky-400 font-bold">Tab Pemeriksaan</strong> pada menu Data Harian. Selama belum masuk pemeriksaan, nilai Deklarasi V0 & V0 Verified sengaja dikosongkan (0).
                    </div>
                  </li>
                  <li className="flex items-start gap-2.5 p-2.5 rounded-xl bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
                    <span className="w-5 h-5 rounded-full bg-sky-100 dark:bg-sky-950 text-sky-700 dark:text-sky-400 font-black flex items-center justify-center shrink-0 text-[10px] border border-sky-200 dark:border-sky-900/40">2</span>
                    <div>
                      <strong className="text-slate-900 dark:text-white block mb-0.5">Penghitungan Denda Keterlambatan Laporan:</strong>
                      Sistem memeriksa riwayat pengiriman laporan harian. Pengiriman laporan setelah <strong className="text-rose-600 dark:text-rose-400 font-bold">pukul 10:00 WIB</strong> akan dikenakan denda keterlambatan secara otomatis.
                    </div>
                  </li>
                  <li className="flex items-start gap-2.5 p-2.5 rounded-xl bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
                    <span className="w-5 h-5 rounded-full bg-sky-100 dark:bg-sky-950 text-sky-700 dark:text-sky-400 font-black flex items-center justify-center shrink-0 text-[10px] border border-sky-200 dark:border-sky-900/40">3</span>
                    <div>
                      <strong className="text-slate-900 dark:text-white block mb-0.5">Level Gaji & Komisi:</strong>
                      Level gaji ditentukan otomatis dari jumlah keanggotaan/rekrutan yang dipromosikan (T3 & V0 Verified) sesuai struktur jenjang komisi perusahaan.
                    </div>
                  </li>
                </ol>
              </div>
            )}

            {/* Tab 3: Jadwal & Status */}
            {activeGuideTab === 'jadwal' && (
              <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800/60 space-y-3 text-[11px] text-slate-700 dark:text-slate-300">
                <div className="flex items-center gap-2 text-amber-700 dark:text-amber-400 font-black">
                  <Calendar className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
                  <span>Siklus Periode Kerja & Status Pembayaran:</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[10px]">
                  <div className="p-3 rounded-xl bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-1">
                    <span className="text-[9px] font-extrabold uppercase text-slate-500">Periode Rekap</span>
                    <p className="font-black text-slate-900 dark:text-white text-xs">Senin s/d Minggu</p>
                    <p className="text-slate-500 text-[9.5px]">Rekapitulasi aktivitas kerja dihitung selama 7 hari dalam 1 minggu periode berjalan.</p>
                  </div>
                  <div className="p-3 rounded-xl bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-1">
                    <span className="text-[9px] font-extrabold uppercase text-emerald-600 dark:text-emerald-400">Hari Gajian</span>
                    <p className="font-black text-emerald-600 dark:text-emerald-400 text-xs">Jumat Minggu Depan</p>
                    <p className="text-slate-500 text-[9.5px]">Pembayaran ditransfer oleh Admin/Owner setiap hari Jumat minggu berikutnya.</p>
                  </div>
                </div>
                <div className="p-2.5 rounded-xl bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-[9.5px] text-slate-600 dark:text-slate-400 flex flex-wrap gap-2 items-center justify-between font-medium">
                  <span>📝 Status <strong className="text-slate-900 dark:text-white">Draft</strong>: Slip sedang direkap Admin</span>
                  <span>✅ Status <strong className="text-emerald-600 dark:text-emerald-400 font-bold">Paid</strong>: Gaji telah ditransfer</span>
                </div>
              </div>
            )}
          </div>
        )}
      </GlassCard>

      {/* DASHBOARD SUMMARY CARDS */}
      {isAdminOrOwner && (
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
          <div className="p-4 sm:p-5 rounded-3xl bg-gradient-to-br from-white to-slate-50 dark:from-slate-900 dark:to-slate-950 border border-slate-200/80 dark:border-slate-800/80 flex flex-col justify-between shadow-sm relative overflow-hidden group">
            <div className="absolute -right-4 -top-4 w-16 h-16 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center opacity-50 group-hover:scale-110 transition-transform">
              <User className="w-6 h-6 text-slate-400" />
            </div>
            <div className="relative z-10">
              <span className="text-[10px] font-extrabold uppercase tracking-widest text-slate-500 dark:text-slate-400">Total Recruiter</span>
              <div className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white mt-1">{summaryStats.totalStaff}</div>
              <span className="text-[10px] font-medium text-slate-500">Orang</span>
            </div>
          </div>

          <div className="p-4 sm:p-5 rounded-3xl bg-gradient-to-br from-white to-rose-50/50 dark:from-slate-900 dark:to-rose-950/20 border border-rose-200/60 dark:border-rose-900/40 flex flex-col justify-between shadow-sm relative overflow-hidden group">
            <div className="absolute -right-4 -top-4 w-16 h-16 bg-rose-100 dark:bg-rose-900/30 rounded-full flex items-center justify-center opacity-50 group-hover:scale-110 transition-transform">
              <Clock className="w-6 h-6 text-rose-400" />
            </div>
            <div className="relative z-10">
              <span className="text-[10px] font-extrabold uppercase tracking-widest text-rose-600 dark:text-rose-400">Belum Diinput</span>
              <div className="text-2xl sm:text-3xl font-black text-rose-600 dark:text-rose-400 mt-1">{summaryStats.pendingInput}</div>
              <span className="text-[10px] font-medium text-rose-500/70">Orang</span>
            </div>
          </div>

          <div className="p-4 sm:p-5 rounded-3xl bg-gradient-to-br from-white to-amber-50/50 dark:from-slate-900 dark:to-amber-950/20 border border-amber-200/60 dark:border-amber-900/40 flex flex-col justify-between shadow-sm relative overflow-hidden group">
            <div className="absolute -right-4 -top-4 w-16 h-16 bg-amber-100 dark:bg-amber-900/30 rounded-full flex items-center justify-center opacity-50 group-hover:scale-110 transition-transform">
              <FileText className="w-6 h-6 text-amber-400" />
            </div>
            <div className="relative z-10">
              <span className="text-[10px] font-extrabold uppercase tracking-widest text-amber-600 dark:text-amber-400">Gaji Draft</span>
              <div className="text-2xl sm:text-3xl font-black text-amber-600 dark:text-amber-400 mt-1">{summaryStats.totalDraft}</div>
              <span className="text-[10px] font-medium text-amber-500/70">Slips</span>
            </div>
          </div>

          <div className="p-4 sm:p-5 rounded-3xl bg-gradient-to-br from-white to-emerald-50/50 dark:from-slate-900 dark:to-emerald-950/20 border border-emerald-200/60 dark:border-emerald-900/40 flex flex-col justify-between shadow-sm relative overflow-hidden group">
            <div className="absolute -right-4 -top-4 w-16 h-16 bg-emerald-100 dark:bg-emerald-900/30 rounded-full flex items-center justify-center opacity-50 group-hover:scale-110 transition-transform">
              <CheckCircle2 className="w-6 h-6 text-emerald-400" />
            </div>
            <div className="relative z-10">
              <span className="text-[10px] font-extrabold uppercase tracking-widest text-emerald-600 dark:text-emerald-400">Telah Dibayar</span>
              <div className="text-2xl sm:text-3xl font-black text-emerald-600 dark:text-emerald-400 mt-1">{summaryStats.totalPaid}</div>
              <span className="text-[10px] font-medium text-emerald-500/70">Slips</span>
            </div>
          </div>

          <div className="col-span-2 lg:col-span-1 p-4 sm:p-5 rounded-3xl bg-gradient-to-br from-emerald-500 to-teal-600 dark:from-emerald-600 dark:to-teal-700 border border-emerald-400/30 flex flex-col justify-between shadow-lg shadow-emerald-500/20 relative overflow-hidden group">
            <div className="absolute -right-4 -top-4 w-20 h-20 bg-white/10 rounded-full flex items-center justify-center opacity-50 group-hover:scale-110 transition-transform">
              <TrendingUp className="w-10 h-10 text-white/50" />
            </div>
            <div className="relative z-10">
              <span className="text-[10px] font-extrabold uppercase tracking-widest text-emerald-50">Total Pengeluaran</span>
              <div className="text-xl sm:text-2xl font-black text-white mt-1 drop-shadow-sm">{formatRupiah(summaryStats.totalPayout)}</div>
              <span className="text-[10px] font-medium text-emerald-100/70">IDR</span>
            </div>
          </div>
        </div>
      )}

      {isRecruiter && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {/* Recruiter personal overview */}
          {(() => {
            const currentSlip = salaries.find(s => s.telegramId === userProfile?.telegramId && s.periode === selectedPeriod);
            return (
              <>
                <div className="p-4 rounded-3xl bg-white dark:bg-slate-950/60 border border-slate-200 dark:border-slate-900/60">
                  <p className="text-[9px] font-extrabold uppercase tracking-wider text-slate-500">Hari Kerja Efektif</p>
                  <p className="text-lg font-black text-slate-900 dark:text-white mt-1">
                    {currentSlip ? `${currentSlip.hariEfektif} Hari` : '-'}
                  </p>
                </div>
                <div className="p-4 rounded-3xl bg-white dark:bg-slate-950/60 border border-slate-200 dark:border-slate-900/60">
                  <p className="text-[9px] font-extrabold uppercase tracking-wider text-slate-500">Target ACC T0 / V0</p>
                  <p className="text-lg font-black text-slate-900 dark:text-white mt-1">
                    {currentSlip ? `${isPeriodInPemeriksaan ? (currentSlip.sebenarnyaT0 || 0) : 0} / ${isPeriodInPemeriksaan ? (currentSlip.sebenarnyaV0 || 0) : 0}` : '-'}
                  </p>
                </div>
                <div className="p-4 rounded-3xl bg-white dark:bg-slate-950/60 border border-slate-200 dark:border-slate-900/60">
                  <p className="text-[9px] font-extrabold uppercase tracking-wider text-rose-500">Deduksi (Denda Lambat)</p>
                  <p className="text-lg font-black text-rose-500 mt-1">
                    {currentSlip ? formatRupiah(currentSlip.deduksi) : '-'}
                  </p>
                </div>
                <div className="p-4 rounded-3xl bg-emerald-500/10 border border-emerald-500/20">
                  <p className="text-[9px] font-extrabold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">Total Gaji Diterima</p>
                  <p className="text-lg font-black text-emerald-600 dark:text-emerald-400 mt-1">
                    {currentSlip ? formatRupiah(currentSlip.totalGaji) : 'Belum Rekap'}
                  </p>
                </div>
              </>
            );
          })()}
        </div>
      )}

      {/* ADMIN & OWNER WORKFLOW PANELS */}
      {isAdminOrOwner && (
        <div className="space-y-4">
          {/* Filter & Sorting bar */}
          <div className="flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between p-3.5 rounded-3xl bg-white dark:bg-slate-950/60 border border-slate-200 dark:border-slate-900/80">
            {/* Search */}
            <div className="relative flex-1">
              <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Cari Username / Nama Recruiter..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl pl-10 pr-4 py-2 text-xs font-medium text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
              />
            </div>

            {/* Filter and sorting controls */}
            <div className="flex flex-wrap gap-2">
              {/* Filter */}
              <div className="flex items-center gap-1.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl px-3 py-1.5">
                <Filter className="w-3.5 h-3.5 text-slate-400" />
                <select
                  value={statusFilter}
                  onChange={(e: any) => setStatusFilter(e.target.value)}
                  className="bg-transparent border-none text-[11px] font-bold text-slate-700 dark:text-slate-300 focus:outline-none cursor-pointer"
                >
                  <option value="all">Semua Status Gaji</option>
                  <option value="uninput">⚠️ Belum Diinput</option>
                  <option value="draft">📝 Draft</option>
                  <option value="paid">✅ Lunas (Paid)</option>
                </select>
              </div>

              {/* Sort */}
              <div className="flex items-center gap-1.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl px-3 py-1.5">
                <ArrowUpDown className="w-3.5 h-3.5 text-slate-400" />
                <select
                  value={sortBy}
                  onChange={(e: any) => setSortBy(e.target.value)}
                  className="bg-transparent border-none text-[11px] font-bold text-slate-700 dark:text-slate-300 focus:outline-none cursor-pointer"
                >
                  <option value="name">Sortir: Nama (A-Z)</option>
                  <option value="gaji">Sortir: Gaji Tertinggi</option>
                  <option value="hari">Sortir: Hari Efektif</option>
                </select>
              </div>
            </div>
          </div>

          {/* Segmented Tab Filter - Extremely beautiful & user-friendly on mobile */}
          <div className="grid grid-cols-3 p-1.5 bg-slate-100 dark:bg-slate-900 rounded-2xl gap-1">
            <button
              onClick={() => setStatusFilter('all')}
              className={`py-2 text-center text-xs font-black rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                statusFilter === 'all'
                  ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm'
                  : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200'
              }`}
            >
              Semua ({baseProcessedRecruiters.length})
            </button>
            <button
              onClick={() => setStatusFilter('uninput')}
              className={`py-2 text-center text-xs font-black rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                statusFilter === 'uninput'
                  ? 'bg-rose-500 text-white shadow-sm shadow-rose-500/10'
                  : 'text-rose-600 hover:bg-rose-500/5 dark:text-rose-400'
              }`}
            >
              ⚠️ Belum ({belumInputRecruiters.length})
            </button>
            <button
              onClick={() => setStatusFilter('draft')}
              className={`py-2 text-center text-xs font-black rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                statusFilter === 'draft' || statusFilter === 'paid'
                  ? 'bg-emerald-500 text-white shadow-sm shadow-emerald-500/10'
                  : 'text-emerald-600 hover:bg-emerald-500/5 dark:text-emerald-400'
              }`}
            >
              ✅ Sudah ({sudahInputRecruiters.length})
            </button>
          </div>

          {/* RECRUITERS LIST */}
          {loading ? (
            <div className="flex flex-col items-center justify-center py-12 space-y-2">
              <RefreshCw className="w-8 h-8 text-emerald-500 animate-spin" />
              <p className="text-xs text-slate-400 font-bold">Memuat data gaji...</p>
            </div>
          ) : baseProcessedRecruiters.length === 0 ? (
            <div className="p-8 text-center rounded-3xl border border-dashed border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950/40">
              <Info className="w-8 h-8 text-slate-400 mx-auto mb-2" />
              <p className="text-xs font-bold text-slate-700 dark:text-slate-300">Tidak ada recruiter ditemukan</p>
              <p className="text-[10px] text-slate-600 dark:text-slate-400 mt-1">Coba sesuaikan kata kunci pencarian atau filter status gaji.</p>
            </div>
          ) : (
            <div className="space-y-6">
              {/* SECTION 1: BELUM DIINPUT */}
              {(statusFilter === 'all' || statusFilter === 'uninput') && belumInputRecruiters.length > 0 && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between px-1">
                    <h3 className="text-xs font-black uppercase tracking-wider text-rose-500 flex items-center gap-1.5">
                      <Clock className="w-4 h-4" />
                      <span>Belum Diinput ({belumInputRecruiters.length})</span>
                    </h3>
                    <span className="text-[9px] bg-rose-500/10 text-rose-600 dark:text-rose-400 px-2.5 py-0.5 rounded-full font-black uppercase tracking-wider">
                      Perlu Diproses
                    </span>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {belumInputRecruiters.map((item) => (
                      <motion.div
                        layout
                        key={item.user.telegramId}
                        className="p-3.5 sm:p-4 rounded-3xl bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-900/60 hover:border-emerald-500/30 transition-all flex flex-col justify-between space-y-3.5 shadow-sm"
                      >
                        {/* Header: user info and status badge */}
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-3">
                            {/* Photo / Avatar */}
                            {item.user.photoUrl ? (
                              <img 
                                src={item.user.photoUrl} 
                                alt={item.user.firstName}
                                referrerPolicy="no-referrer"
                                className="w-10 h-10 rounded-2xl object-cover border border-slate-200 dark:border-slate-800/60"
                              />
                            ) : (
                              <div className="w-10 h-10 rounded-2xl bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800/60 flex items-center justify-center text-slate-900 dark:text-white font-black text-xs uppercase">
                                {item.user.firstName?.slice(0, 2) || item.user.username?.slice(0, 2) || 'R'}
                              </div>
                            )}
                            <div>
                              <p className="text-xs font-black text-slate-900 dark:text-white leading-tight">
                                {item.user.firstName} {item.user.lastName}
                              </p>
                              <p className="text-[10px] text-slate-600 dark:text-slate-400 font-mono mt-0.5">
                                @{item.user.username} • UID: {item.user.telegramId}
                              </p>
                            </div>
                          </div>

                          <span className="text-[8px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-rose-500/10 text-rose-500 border border-rose-500/20 whitespace-nowrap">
                            Belum Diinput
                          </span>
                        </div>

                        {/* Summary details */}
                        <div className="px-3 py-2.5 rounded-2xl bg-slate-50 dark:bg-slate-900/30 border border-slate-100 dark:border-slate-850/40 grid grid-cols-2 gap-2 text-[10px] font-bold text-slate-600 dark:text-slate-400">
                          <div>
                            <span className="text-slate-500 font-medium">Laporan:</span> <span className="text-slate-900 dark:text-white font-black">{item.reportsCount}</span>
                          </div>
                          <div>
                            <span className="text-slate-500 font-medium">Hari Kerja:</span> <span className="text-slate-900 dark:text-white font-black">{item.reportsCount > 0 ? 'Auto' : '0'}</span>
                          </div>
                        </div>

                        {/* Bottom: Action */}
                        <div className="flex items-center justify-between pt-1.5 border-t border-slate-100 dark:border-slate-900/80">
                          <p className="text-[9px] font-bold text-slate-600 dark:text-slate-400">
                            Estimasi Gaji: <span className="text-emerald-500 font-black">Rp 0</span>
                          </p>
                          <button
                            onClick={() => handleOpenSalaryModal(item.user, null, false)}
                            className="px-3.5 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-2xl text-[10px] font-black flex items-center gap-1.5 cursor-pointer transition-colors shadow-sm shadow-emerald-500/10"
                          >
                            <Plus className="w-3.5 h-3.5" /> Input Slip
                          </button>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                </div>
              )}

              {/* SECTION 2: SUDAH DIINPUT */}
              {(statusFilter === 'all' || statusFilter === 'draft' || statusFilter === 'paid') && sudahInputRecruiters.length > 0 && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between px-1">
                    <h3 className="text-xs font-black uppercase tracking-wider text-emerald-500 flex items-center gap-1.5">
                      <CheckCircle2 className="w-4 h-4" />
                      <span>Sudah Diinput ({sudahInputRecruiters.length})</span>
                    </h3>
                    <span className="text-[9px] bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 px-2.5 py-0.5 rounded-full font-black uppercase tracking-wider">
                      Telah Terbit
                    </span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {sudahInputRecruiters
                      .filter(item => {
                        if (statusFilter === 'draft') return item.status === 'Draft';
                        if (statusFilter === 'paid') return item.status === 'Paid';
                        return true;
                      })
                      .map((item) => {
                        const hasSalary = !!item.salarySlip;
                        const status = item.status;
                        const reportsCount = item.reportsCount;
                        
                        return (
                          <motion.div
                            layout
                            key={item.user.telegramId}
                            className="p-3.5 sm:p-4 rounded-3xl bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-900/60 hover:border-emerald-500/30 transition-all flex flex-col justify-between space-y-3.5 shadow-sm"
                          >
                            {/* Header: user info and status badge */}
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex items-center gap-3">
                                {/* Photo / Avatar */}
                                {item.user.photoUrl ? (
                                  <img 
                                    src={item.user.photoUrl} 
                                    alt={item.user.firstName}
                                    referrerPolicy="no-referrer"
                                    className="w-10 h-10 rounded-2xl object-cover border border-slate-200 dark:border-slate-800/60"
                                  />
                                ) : (
                                  <div className="w-10 h-10 rounded-2xl bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800/60 flex items-center justify-center text-slate-900 dark:text-white font-black text-xs uppercase">
                                    {item.user.firstName?.slice(0, 2) || item.user.username?.slice(0, 2) || 'R'}
                                  </div>
                                )}
                                <div>
                                  <p className="text-xs font-black text-slate-900 dark:text-white leading-tight">
                                    {item.user.firstName} {item.user.lastName}
                                  </p>
                                  <p className="text-[10px] text-slate-600 dark:text-slate-400 font-mono mt-0.5">
                                    @{item.user.username} • UID: {item.user.telegramId}
                                  </p>
                                </div>
                              </div>

                              {/* Status badges */}
                              <div>
                                {status === 'Draft' ? (
                                  <span className="text-[8px] font-black uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-amber-500/10 text-amber-500 border border-amber-500/20 whitespace-nowrap">
                                    Draft
                                  </span>
                                ) : (
                                  <span className="text-[8px] font-black uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 whitespace-nowrap">
                                    Paid
                                  </span>
                                )}
                              </div>
                            </div>

                            {/* Report summary logs for selected week */}
                            <div className="px-3.5 py-2 rounded-2xl bg-slate-50 dark:bg-slate-900/30 border border-slate-100 dark:border-slate-850/40 grid grid-cols-2 gap-2 text-[10px] font-bold text-slate-600 dark:text-slate-400">
                              <div>
                                <span className="text-slate-500 font-medium">Laporan:</span> <span className="text-slate-900 dark:text-white font-black">{reportsCount} Slip</span>
                              </div>
                              <div>
                                <span className="text-slate-500 font-medium">Hari Efektif:</span> <span className="text-slate-900 dark:text-white font-black">{item.salarySlip ? `${item.salarySlip.hariEfektif} Hari` : 'Auto-hitung'}</span>
                              </div>
                              <div className="col-span-2 pt-1 border-t border-dashed border-slate-200/50 dark:border-slate-800/50 flex justify-between">
                                <span className="text-slate-500 font-medium">ACC T0 / V0:</span>
                                <span className="text-slate-900 dark:text-white font-black">
                                  {item.salarySlip ? `${item.salarySlip.sebenarnyaT0} T0 / ${item.salarySlip.sebenarnyaV0} V0` : '-'}
                                </span>
                              </div>
                            </div>

                            {/* Bottom: salary and actions */}
                            <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-900/80 gap-2">
                              <div className="min-w-0">
                                <p className="text-[9px] font-bold text-slate-500 uppercase tracking-wider">Total Gaji</p>
                                <p className="text-xs sm:text-sm font-black text-emerald-600 dark:text-emerald-400 truncate">
                                  {formatRupiah(item.salarySlip?.totalGaji)}
                                </p>
                              </div>

                              <div className="flex gap-1 shrink-0">
                                <button
                                  onClick={() => handleOpenSalaryModal(item.user, item.salarySlip, true)}
                                  className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-900 dark:hover:bg-slate-850 text-[10px] font-black rounded-xl text-slate-700 dark:text-slate-300 transition-colors cursor-pointer"
                                >
                                  Detail
                                </button>
                                <button
                                  onClick={() => handleOpenSalaryModal(item.user, item.salarySlip, false)}
                                  className="p-1.5 bg-blue-500/10 hover:bg-blue-500/20 rounded-xl text-blue-600 dark:text-blue-400 border border-blue-500/10 cursor-pointer transition-colors"
                                  title="Edit Slip Gaji"
                                >
                                  <Edit className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  onClick={() => handleDeleteSlip(item.salarySlip!.id)}
                                  className="p-1.5 bg-rose-500/10 hover:bg-rose-500/20 rounded-xl text-rose-500 border border-rose-500/10 cursor-pointer transition-colors"
                                  title="Hapus Slip Gaji"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>
                          </motion.div>
                        );
                      })}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* RECRUITER ONLY VIEW */}
      {isRecruiter && (
        <div className="space-y-4">
          {/* Profile Header Widget */}
          <div className="p-4 rounded-3xl bg-gradient-to-br from-emerald-500/10 to-teal-500/5 border border-emerald-500/15 flex items-center gap-4">
            {userProfile?.photoUrl ? (
              <img 
                src={userProfile.photoUrl} 
                alt={userProfile.firstName}
                referrerPolicy="no-referrer"
                className="w-12 h-12 rounded-2xl object-cover border-2 border-white dark:border-slate-900 shadow-sm"
              />
            ) : (
              <div className="w-12 h-12 rounded-2xl bg-emerald-500 text-white font-black text-lg flex items-center justify-center uppercase shadow-sm">
                {userProfile?.firstName?.slice(0, 2) || 'R'}
              </div>
            )}
            <div>
              <h3 className="text-xs font-black text-slate-900 dark:text-white leading-tight">
                Halo, {userProfile?.firstName} {userProfile?.lastName}!
              </h3>
              <p className="text-[10px] text-slate-600 dark:text-slate-400 mt-1 font-medium">
                Peran: Recruiter • Telegram ID: {userProfile?.telegramId}
              </p>
            </div>
          </div>

          <h3 className="text-xs font-black uppercase tracking-wider text-slate-500">Riwayat Slip Gaji Anda</h3>
          
          {loading ? (
            <div className="flex flex-col items-center justify-center py-12">
              <RefreshCw className="w-6 h-6 text-emerald-500 animate-spin" />
              <p className="text-[10px] text-slate-400 font-bold mt-2">Memuat riwayat slip...</p>
            </div>
          ) : mySalaries.length === 0 ? (
            <div className="p-8 text-center rounded-3xl border border-dashed border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950/40">
              <FileText className="w-8 h-8 text-slate-400 mx-auto mb-2" />
              <p className="text-xs font-bold text-slate-700 dark:text-slate-300">Belum ada slip gaji</p>
              <p className="text-[10px] text-slate-600 dark:text-slate-400 mt-1">Admin/Owner akan memposting slip gaji Anda setiap minggunya.</p>
            </div>
          ) : (
            <div className="space-y-2.5">
              {mySalaries.map(slip => {
                const { shortFormattedRange } = getWIBWeekRange(slip.periode);
                return (
                  <div 
                    key={slip.id}
                    className="p-4 rounded-3xl bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-900/60 flex items-center justify-between"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-500">
                        <FileText className="w-4.5 h-4.5" />
                      </div>
                      <div>
                        <p className="text-xs font-black text-slate-900 dark:text-white">
                          Slip Gaji {shortFormattedRange}
                        </p>
                        <p className="text-[10px] text-slate-600 dark:text-slate-400 font-bold">
                          Total Bersih: <span className="text-emerald-500 font-black">{formatRupiah(slip.totalGaji)}</span>
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      {slip.status === 'Paid' ? (
                        <span className="text-[8px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
                          Paid
                        </span>
                      ) : (
                        <span className="text-[8px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-500 border border-amber-500/20">
                          Draft
                        </span>
                      )}
                      
                      <button
                        onClick={() => handleOpenSalaryModal(userProfile!, slip, true)}
                        className="px-2.5 py-1 bg-slate-50 hover:bg-slate-100 dark:bg-slate-900 dark:hover:bg-slate-800 text-[10px] font-bold rounded-xl border border-slate-200 dark:border-slate-800 cursor-pointer transition-colors"
                      >
                        Detail
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* DETAILED DIALOG/MODAL FOR FORM & PRINT PREVIEW */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, y: 20, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 20, scale: 0.98 }}
              transition={{ type: 'spring', damping: 28, stiffness: 300 }}
              className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800/80 rounded-3xl w-full max-w-2xl overflow-hidden shadow-2xl relative"
            >
              {/* Header */}
              <div className="p-5 border-b border-slate-150 dark:border-slate-800/80 flex justify-between items-center bg-slate-50 dark:bg-slate-950/40">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-500">
                    <Coins className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-black uppercase tracking-wider text-slate-800 dark:text-slate-100">
                      {viewOnly ? 'Detail Slip Gaji Resmi' : formData.createdAt ? 'Edit Slip Gaji' : 'Input Slip Gaji Baru'}
                    </h3>
                    <p className="text-[10px] font-extrabold text-slate-500 dark:text-slate-400 uppercase tracking-widest mt-0.5">
                      Periode: {getWIBWeekRange(formData.periode || '').formattedRange}
                    </p>
                  </div>
                </div>
                <button 
                  onClick={() => setIsModalOpen(false)}
                  className="p-2 hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-500 dark:text-slate-400 rounded-xl cursor-pointer transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Loader during auto-calculations */}
              {isCalculating ? (
                <div className="py-24 flex flex-col items-center justify-center space-y-4">
                  <RefreshCw className="w-10 h-10 text-emerald-500 animate-spin" />
                  <div className="text-center">
                    <p className="text-xs font-black text-slate-800 dark:text-slate-200">Menghitung Data Finansial...</p>
                    <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-1 max-w-xs mx-auto">
                      Mengakumulasikan postingan harian, denda keterlambatan, dan target konversi...
                    </p>
                  </div>
                </div>
              ) : (
                <div className="p-6 max-h-[75vh] overflow-y-auto space-y-6">
                  
                  {/* PREVIEW MODE (Premium Printable Payslip) */}
                  {viewOnly ? (
                    <div id="printable-slip" className="space-y-6 relative">
                      {/* Diagonal Stamp Seal Watermark */}
                      <div className="absolute right-4 top-10 pointer-events-none select-none rotate-[15deg] opacity-90">
                        {formData.status === 'Paid' ? (
                          <div className="border-4 border-emerald-500/40 text-emerald-500/80 font-black text-sm uppercase tracking-widest px-4 py-1.5 rounded-xl bg-emerald-500/5">
                            LUNAS / PAID
                          </div>
                        ) : (
                          <div className="border-4 border-amber-500/40 text-amber-500/80 font-black text-sm uppercase tracking-widest px-4 py-1.5 rounded-xl bg-amber-500/5">
                            DRAFT ONLY
                          </div>
                        )}
                      </div>

                      {/* Corporate Payslip Box */}
                      <div className="p-5 sm:p-6 rounded-3xl bg-slate-50/50 dark:bg-slate-950/40 border border-slate-200/60 dark:border-slate-800/60 shadow-inner">
                        {/* Company Logo Title */}
                        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-5 border-b border-dashed border-slate-200 dark:border-slate-800">
                          <div>
                            <div className="flex items-center gap-1.5">
                              <span className="text-sm font-black tracking-wider text-slate-900 dark:text-white uppercase">AZURLIZE</span>
                              <span className="text-[9px] font-black uppercase tracking-widest bg-emerald-500 text-white px-2 py-0.5 rounded">TEAM</span>
                            </div>
                            <p className="text-[9px] text-slate-500 dark:text-slate-400 font-bold mt-1 uppercase tracking-wider">
                              Recruitment Operations Division
                            </p>
                          </div>
                          <div className="text-left sm:text-right font-mono text-[9px] text-slate-500 space-y-0.5">
                            <p className="font-bold text-slate-700 dark:text-slate-300">NO. SLIP: SLIP-PAY/{formData.periode}/{formData.telegramId?.slice(-5)}</p>
                            <p>TANGGAL TERBIT: {formData.createdAt ? new Date(formData.createdAt).toLocaleDateString('id-ID', {day: 'numeric', month: 'long', year: 'numeric'}) : '-'}</p>
                            <p>OLEH: @{formData.createdBy || 'system'}</p>
                          </div>
                        </div>

                        {/* Recruiter Identity Row */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 py-4 border-b border-slate-200 dark:border-slate-800">
                          <div className="space-y-1">
                            <span className="text-[8.5px] font-extrabold uppercase tracking-widest text-slate-400">Penerima Manfaat</span>
                            <div className="flex items-center gap-2.5">
                              {selectedRecruiter?.photoUrl ? (
                                <img 
                                  src={selectedRecruiter.photoUrl} 
                                  alt={formData.recruiterName}
                                  referrerPolicy="no-referrer"
                                  className="w-8 h-8 rounded-xl object-cover border border-slate-200 dark:border-slate-800"
                                />
                              ) : (
                                <div className="w-8 h-8 rounded-xl bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 flex items-center justify-center font-black text-xs">
                                  {formData.recruiterName?.slice(0, 2) || 'RC'}
                                </div>
                              )}
                              <div>
                                <h4 className="text-xs font-black text-slate-800 dark:text-white leading-tight">{formData.recruiterName}</h4>
                                <p className="text-[9px] text-slate-500 font-mono">@{formData.username} • ID: {formData.telegramId}</p>
                              </div>
                            </div>
                          </div>

                          <div className="grid grid-cols-2 gap-2 text-[9.5px]">
                            <div>
                              <span className="block text-slate-400 font-bold uppercase text-[8px] tracking-wider">Jabatan</span>
                              <span className="font-black text-slate-700 dark:text-slate-300 uppercase">{formData.levelGaji || 'RECRUITER'}</span>
                            </div>
                            <div>
                              <span className="block text-slate-400 font-bold uppercase text-[8px] tracking-wider">Metode Bayar</span>
                              <span className="font-black text-emerald-500 uppercase">TELEGRAM / TRANSFER</span>
                            </div>
                          </div>
                        </div>

                        {/* Part 1: Kinerja / Performance Table */}
                        <div className="py-4 space-y-2">
                          <span className="text-[8.5px] font-extrabold uppercase tracking-widest text-slate-400">1. Ringkasan Performa Kerja (Verified)</span>
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-white dark:bg-slate-900/40 p-3 rounded-2xl border border-slate-150 dark:border-slate-800/80">
                            <div className="text-center sm:text-left">
                              <span className="text-[8.5px] text-slate-500 dark:text-slate-400 block font-medium">Hari Kerja</span>
                              <span className="text-xs font-black text-slate-900 dark:text-white">{formData.hariEfektif || 0} Hari</span>
                            </div>
                            <div className="text-center sm:text-left border-l sm:border-l border-slate-100 dark:border-slate-800 pl-2">
                              <span className="text-[8.5px] text-slate-500 dark:text-slate-400 block font-medium">Postingan</span>
                              <span className="text-xs font-black text-slate-900 dark:text-white">{formData.totalPostingan || 0} Share</span>
                            </div>
                            <div className="text-center sm:text-left border-l border-slate-100 dark:border-slate-800 pl-2">
                              <span className="text-[8.5px] text-slate-500 dark:text-slate-400 block font-medium">Konversi ACC</span>
                              <span className="text-xs font-black text-slate-900 dark:text-white">
                                {formData.sebenarnyaT0 || 0} T0 / {formData.sebenarnyaV0 || 0} V0
                              </span>
                            </div>
                            <div className="text-center sm:text-left border-l border-slate-100 dark:border-slate-800 pl-2">
                              <span className="text-[8.5px] text-slate-500 dark:text-slate-400 block font-medium">ACC Rate</span>
                              <span className="text-xs font-black text-sky-500">{formData.tingkatPenerimaan || 0}%</span>
                            </div>
                          </div>
                        </div>

                        {/* Part 2: Financial Itemized Statement (Classic Invoice Style) */}
                        <div className="py-4 space-y-3 border-t border-slate-200 dark:border-slate-800">
                          <span className="text-[8.5px] font-extrabold uppercase tracking-widest text-slate-400 block">2. Itemisasi Pendapatan & Potongan</span>
                          
                          <div className="space-y-2 text-xs">
                            {/* Earnings heading */}
                            <div className="text-[9px] font-black uppercase text-emerald-600 dark:text-emerald-400 tracking-wider">A. Komponen Pendapatan</div>
                            
                            {/* Gaji Pokok */}
                            <div className="flex justify-between items-center font-medium text-slate-600 dark:text-slate-300">
                              <span>Gaji Pokok Mingguan (Sesuai Keaktifan)</span>
                              <span className="font-mono text-slate-900 dark:text-white font-bold">{formatRupiah(formData.gajiPokok)}</span>
                            </div>

                            {/* Komisi */}
                            <div className="flex justify-between items-center font-medium text-slate-600 dark:text-slate-300">
                              <span>Komisi Pengisian Validasi Sukses</span>
                              <span className="font-mono text-slate-900 dark:text-white font-bold">{formatRupiah(formData.komisi)}</span>
                            </div>

                            {/* Bonus T0 */}
                            <div className="flex justify-between items-center font-medium text-slate-600 dark:text-slate-300">
                              <span>Bonus Pencapaian Target T0 (Awal)</span>
                              <span className="font-mono text-slate-900 dark:text-white font-bold">{formatRupiah(formData.bonusT0)}</span>
                            </div>

                            {/* Bonus T3 */}
                            <div className="flex justify-between items-center font-medium text-slate-600 dark:text-slate-300">
                              <span>Bonus Konversi Berhasil T3 (Promoted)</span>
                              <span className="font-mono text-slate-900 dark:text-white font-bold">{formatRupiah(formData.bonusT3)}</span>
                            </div>

                            {/* Other Bonus */}
                            {Number(formData.otherBonus) > 0 && (
                              <div className="flex justify-between items-center font-medium text-slate-600 dark:text-slate-300">
                                <span>Tunjangan Prestasi / Bonus Tambahan</span>
                                <span className="font-mono text-slate-900 dark:text-white font-bold">{formatRupiah(formData.otherBonus)}</span>
                              </div>
                            )}

                            {/* Deductions heading */}
                            <div className="text-[9px] font-black uppercase text-rose-500 tracking-wider pt-2 border-t border-slate-100 dark:border-slate-800">
                              B. Komponen Potongan / Deduksi
                            </div>

                            {/* Deductions / Deduksi */}
                            <div className="flex justify-between items-center font-medium text-slate-600 dark:text-slate-300">
                              <span className="text-rose-500">Denda Keterlambatan Laporan Harian ({((formData.deduksi || 0) / 5000)} Pelanggaran)</span>
                              <span className="font-mono text-rose-500 font-bold">- {formatRupiah(formData.deduksi)}</span>
                            </div>
                          </div>
                        </div>

                        {/* Part 3: Net Total highlight */}
                        <div className="p-4 rounded-2xl bg-emerald-500/10 dark:bg-emerald-500/5 border border-emerald-500/20 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 mt-4">
                          <div>
                            <span className="text-[9px] font-extrabold uppercase tracking-widest text-emerald-600 dark:text-emerald-400 block">Total Gaji Bersih Diterima</span>
                            <span className="text-[10px] text-slate-500">Telah diverifikasi tanpa sengketa data.</span>
                          </div>
                          <span className="text-xl sm:text-2xl font-black text-emerald-600 dark:text-emerald-400 font-mono tracking-tight">
                            {formatRupiah(formData.totalGaji)}
                          </span>
                        </div>

                        {/* Catatan / Note block inside preview */}
                        {formData.note && (
                          <div className="mt-4 p-3 rounded-2xl bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-[10px] text-slate-600 dark:text-slate-400 leading-relaxed">
                            <span className="font-black text-slate-800 dark:text-slate-200 uppercase tracking-wider block mb-1">Catatan Khusus:</span>
                            {formData.note}
                          </div>
                        )}

                        {/* Signatures */}
                        <div className="mt-8 pt-6 border-t border-slate-200 dark:border-slate-800 grid grid-cols-2 gap-4 text-center text-[10px]">
                          <div className="space-y-12">
                            <p className="text-slate-500 font-medium">Dibuat & Diverifikasi,</p>
                            <div className="font-black text-slate-800 dark:text-slate-200">
                              <p className="underline underline-offset-4">{formData.createdBy || 'ADMINISTRATOR'}</p>
                              <p className="text-[8px] font-extrabold text-slate-400 uppercase tracking-widest mt-0.5">Admin Tim</p>
                            </div>
                          </div>
                          <div className="space-y-12">
                            <p className="text-slate-500 font-medium">Disetujui,</p>
                            <div className="font-black text-slate-800 dark:text-slate-200">
                              <p className="underline underline-offset-4">AzurLize Owner</p>
                              <p className="text-[8px] font-extrabold text-slate-400 uppercase tracking-widest mt-0.5">Owner Eksekutif</p>
                            </div>
                          </div>
                        </div>

                        {/* Disclaimer */}
                        <p className="text-[8px] text-center text-slate-400 dark:text-slate-500 mt-8 leading-tight">
                          Dokumen slip gaji ini dihasilkan secara otomatis melalui Sistem Operasional AzurLize Recruitment Platform.<br />
                          Segala bentuk sengketa hitungan harus diajukan maksimal 1x24 jam sejak waktu terbit slip gaji.
                        </p>
                      </div>
                    </div>
                  ) : (
                    /* EDIT / FORM INPUT MODE (Premium Form Layout) */
                    <div className="space-y-6">
                      
                      {/* Recruiter profile banner in slip */}
                      <div className="flex items-center gap-3.5 p-4 bg-slate-50 dark:bg-slate-950/40 rounded-2xl border border-slate-200/60 dark:border-slate-800/60">
                        {selectedRecruiter?.photoUrl ? (
                          <img 
                            src={selectedRecruiter.photoUrl} 
                            alt={formData.recruiterName}
                            referrerPolicy="no-referrer"
                            className="w-11 h-11 rounded-2xl object-cover border border-slate-200 dark:border-slate-800 shadow-sm"
                          />
                        ) : (
                          <div className="w-11 h-11 rounded-2xl bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 font-black flex items-center justify-center uppercase text-sm">
                            {formData.recruiterName?.slice(0, 2) || 'R'}
                          </div>
                        )}
                        <div>
                          <div className="flex items-center gap-2">
                            <h4 className="text-xs font-black text-slate-900 dark:text-white">{formData.recruiterName}</h4>
                            <span className="text-[8px] font-black uppercase bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400 px-1.5 py-0.5 rounded">
                              {formData.levelGaji || 'Recruiter'}
                            </span>
                          </div>
                          <p className="text-[10px] text-slate-600 dark:text-slate-400 font-mono mt-0.5">
                            Username: @{formData.username} • UID Telegram: {formData.telegramId}
                          </p>
                        </div>
                      </div>

                      {/* SECTION 1: Performance metrics breakdown */}
                      <div className="p-4 sm:p-5 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-4">
                        <div className="flex items-center gap-1.5 pb-2 border-b border-slate-100 dark:border-slate-800/80">
                          <Award className="w-4 h-4 text-sky-500" />
                          <h5 className="text-[10px] font-black uppercase tracking-widest text-slate-700 dark:text-slate-300">
                            1. Ringkasan Performa Kerja Recruiter
                          </h5>
                        </div>

                        <div className="space-y-4">
                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <label className="block text-[9px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">Hari Kerja Efektif</label>
                              <div className="relative">
                                <input
                                  type="number"
                                  value={formData.hariEfektif || 0}
                                  disabled={true}
                                  className="w-full bg-slate-100 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 rounded-xl pl-3 pr-9 py-2 text-xs font-black text-slate-500 dark:text-slate-400 cursor-not-allowed"
                                />
                                <span className="text-[8.5px] font-extrabold text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 uppercase">Hari</span>
                              </div>
                              <p className="text-[8px] font-bold text-amber-600 dark:text-amber-400 mt-1">
                                * Dihitung otomatis berdasarkan jumlah data rekrutan yang di-ACC (Verified) dan target postingan harian yang tercapai.
                              </p>
                            </div>

                            <div>
                              <label className="block text-[9px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">Total Postingan</label>
                              <div className="relative">
                                <input
                                  type="number"
                                  value={formData.totalPostingan || 0}
                                  disabled={true}
                                  className="w-full bg-slate-100 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 rounded-xl pl-3 pr-9 py-2 text-xs font-black text-slate-500 dark:text-slate-400 cursor-not-allowed"
                                />
                                <span className="text-[8.5px] font-extrabold text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 uppercase">Post</span>
                              </div>
                              <p className="text-[8px] font-bold text-amber-600 dark:text-amber-400 mt-1">
                                * Diakumulasikan otomatis dari seluruh postingan laporan harian (Senin - Minggu).
                              </p>
                            </div>
                          </div>

                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <label className="block text-[9px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">Deklarasi T0</label>
                              <input
                                type="number"
                                value={formData.deklarasiT0 || 0}
                                disabled={true}
                                className="w-full bg-slate-100 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-xs font-black text-slate-500 dark:text-slate-400 cursor-not-allowed"
                              />
                              <p className="text-[8px] font-bold text-amber-600 dark:text-amber-400 mt-1">
                                * Diambil otomatis dari total data rekrutan (Grup T0) di Tab Pemeriksaan pada menu Data Harian.
                              </p>
                            </div>

                            <div>
                              <label className="block text-[9px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">T0 Verified</label>
                              <input
                                type="number"
                                value={formData.sebenarnyaT0 || 0}
                                disabled={true}
                                className="w-full bg-slate-100 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-xs font-black text-slate-500 dark:text-slate-400 cursor-not-allowed"
                              />
                              <p className="text-[8px] font-bold text-amber-600 dark:text-amber-400 mt-1">
                                * Diambil otomatis dari total data rekrutan (Grup T0) berstatus ACC di Tab Pemeriksaan pada menu Data Harian.
                              </p>
                            </div>
                          </div>

                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <label className="block text-[9px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">Deklarasi V0</label>
                              <input
                                type="number"
                                value={formData.deklarasiV0 || 0}
                                disabled={true}
                                className="w-full bg-slate-100 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-xs font-black text-slate-500 dark:text-slate-400 cursor-not-allowed"
                              />
                              <p className="text-[8px] font-bold text-amber-600 dark:text-amber-400 mt-1">
                                * Diambil otomatis dari total data rekrutan (Grup V0) di Tab Pemeriksaan pada menu Data Harian.
                              </p>
                            </div>

                            <div>
                              <label className="block text-[9px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">V0 Verified</label>
                              <input
                                type="number"
                                value={formData.sebenarnyaV0 || 0}
                                disabled={true}
                                className="w-full bg-slate-100 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-xs font-black text-slate-500 dark:text-slate-400 cursor-not-allowed"
                              />
                              <p className="text-[8px] font-bold text-amber-600 dark:text-amber-400 mt-1">
                                * Diambil otomatis dari total data rekrutan (Grup V0) berstatus ACC di Tab Pemeriksaan pada menu Data Harian.
                              </p>
                            </div>
                          </div>

                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <label className="block text-[9px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">T3 (Promoted)</label>
                              <input
                                type="number"
                                value={formData.t3 || 0}
                                disabled={true}
                                className="w-full bg-slate-100 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-xs font-black text-slate-500 dark:text-slate-400 cursor-not-allowed"
                              />
                              <p className="text-[8px] font-bold text-amber-600 dark:text-amber-400 mt-1">
                                * Diambil otomatis dari total data rekrutan (Grup T3) berstatus ACC di Tab Pemeriksaan pada menu Data Harian.
                              </p>
                            </div>

                            <div className="flex gap-2">
                              <div className="flex-1">
                                <label className="block text-[9px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">Tingkat Terima</label>
                                <div className="relative">
                                  <input
                                    type="number"
                                    value={formData.tingkatPenerimaan || 0}
                                    disabled
                                    className="w-full bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-800 rounded-xl pl-3 pr-7 py-2 text-xs font-black text-slate-700 dark:text-slate-300"
                                  />
                                  <Percent className="w-3 h-3 absolute right-2 top-1/2 -translate-y-1/2 text-slate-400" />
                                </div>
                              </div>
                              <div className="flex-1">
                                <label className="block text-[9px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">Rasio Up (%)</label>
                                <div className="relative">
                                  <input
                                    type="number"
                                    value={formData.rasioPeningkatan || 0}
                                    disabled={viewOnly}
                                    onChange={(e) => setFormData({ ...formData, rasioPeningkatan: Math.max(0, Number(e.target.value)) })}
                                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl pl-3 pr-7 py-2 text-xs font-black text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                                  />
                                  <Percent className="w-3 h-3 absolute right-2 top-1/2 -translate-y-1/2 text-slate-400" />
                                </div>
                              </div>
                            </div>
                          </div>

                          <div className="border-t border-slate-100 dark:border-slate-800/80 pt-4">
                            <div className="max-w-md">
                              <label className="block text-[9px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">Level Gaji</label>
                              <input
                                type="text"
                                value={formData.levelGaji || 'Level 1'}
                                disabled={true}
                                className="w-full bg-slate-100 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-xs font-black text-slate-500 dark:text-slate-400 cursor-not-allowed"
                              />
                              <p className="text-[8px] font-bold text-amber-600 dark:text-amber-400 mt-1">
                                * Ditentukan otomatis berdasarkan jumlah keanggotaan dipromosikan (T3 & Sebenarnya V0).
                              </p>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* SECTION 2: Finance breakdowns (earnings & deductions) */}
                      <div className="p-4 sm:p-5 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-4">
                        <div className="flex items-center gap-1.5 pb-2 border-b border-slate-100 dark:border-slate-800/80">
                          <TrendingUp className="w-4 h-4 text-emerald-500" />
                          <h5 className="text-[10px] font-black uppercase tracking-widest text-slate-700 dark:text-slate-300">
                            2. Kalkulasi Keuangan & Komisi Pendapatan
                          </h5>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          {/* Earnings Column */}
                          <div className="space-y-3.5 p-4 rounded-2xl bg-emerald-500/5 dark:bg-emerald-500/10 border border-emerald-500/10 dark:border-emerald-500/20">
                            <div className="flex items-center gap-1.5">
                              <span className="w-2 h-2 rounded-full bg-emerald-500" />
                              <span className="text-[9px] font-black uppercase tracking-widest text-emerald-600 dark:text-emerald-400">
                                Komponen Pendapatan (+)
                              </span>
                            </div>
                            
                            <div className="space-y-3">
                              <div>
                                <label className="block text-[9.5px] font-bold text-slate-700 dark:text-slate-300 mb-1">Gaji Pokok</label>
                                <div className="relative">
                                  <span className="text-[10px] font-black text-slate-400 absolute left-3 top-1/2 -translate-y-1/2">Rp</span>
                                  <input
                                    type="number"
                                    value={formData.gajiPokok || 0}
                                    disabled={viewOnly}
                                    onChange={(e) => recalculateTotal({ gajiPokok: Math.max(0, Number(e.target.value)) })}
                                    className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl pl-8 pr-3 py-1.5 text-xs font-black text-slate-900 dark:text-white focus:ring-2 focus:ring-emerald-500/20"
                                  />
                                </div>
                              </div>

                              <div>
                                <label className="block text-[9.5px] font-bold text-slate-700 dark:text-slate-300 mb-1">Komisi Rekrutmen</label>
                                <div className="relative">
                                  <span className="text-[10px] font-black text-slate-400 absolute left-3 top-1/2 -translate-y-1/2">Rp</span>
                                  <input
                                    type="number"
                                    value={formData.komisi || 0}
                                    disabled={viewOnly}
                                    onChange={(e) => recalculateTotal({ komisi: Math.max(0, Number(e.target.value)) })}
                                    className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl pl-8 pr-3 py-1.5 text-xs font-black text-slate-900 dark:text-white focus:ring-2 focus:ring-emerald-500/20"
                                  />
                                </div>
                              </div>

                              <div>
                                <label className="block text-[9.5px] font-bold text-slate-700 dark:text-slate-300 mb-1">Bonus T0</label>
                                <div className="relative">
                                  <span className="text-[10px] font-black text-slate-400 absolute left-3 top-1/2 -translate-y-1/2">Rp</span>
                                  <input
                                    type="number"
                                    value={formData.bonusT0 || 0}
                                    disabled={viewOnly}
                                    onChange={(e) => recalculateTotal({ bonusT0: Math.max(0, Number(e.target.value)) })}
                                    className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl pl-8 pr-3 py-1.5 text-xs font-black text-slate-900 dark:text-white focus:ring-2 focus:ring-emerald-500/20"
                                  />
                                </div>
                              </div>

                              <div>
                                <label className="block text-[9.5px] font-bold text-slate-700 dark:text-slate-300 mb-1">Bonus T3</label>
                                <div className="relative">
                                  <span className="text-[10px] font-black text-slate-400 absolute left-3 top-1/2 -translate-y-1/2">Rp</span>
                                  <input
                                    type="number"
                                    value={formData.bonusT3 || 0}
                                    disabled={viewOnly}
                                    onChange={(e) => recalculateTotal({ bonusT3: Math.max(0, Number(e.target.value)) })}
                                    className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl pl-8 pr-3 py-1.5 text-xs font-black text-slate-900 dark:text-white focus:ring-2 focus:ring-emerald-500/20"
                                  />
                                </div>
                              </div>

                              <div>
                                <label className="block text-[9.5px] font-bold text-slate-700 dark:text-slate-300 mb-1">Bonus Tambahan Lainnya</label>
                                <div className="relative">
                                  <span className="text-[10px] font-black text-slate-400 absolute left-3 top-1/2 -translate-y-1/2">Rp</span>
                                  <input
                                    type="number"
                                    value={formData.otherBonus || 0}
                                    disabled={viewOnly}
                                    onChange={(e) => recalculateTotal({ otherBonus: Math.max(0, Number(e.target.value)) })}
                                    className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl pl-8 pr-3 py-1.5 text-xs font-black text-slate-900 dark:text-white focus:ring-2 focus:ring-emerald-500/20"
                                  />
                                </div>
                              </div>
                            </div>
                          </div>

                          {/* Deductions Column */}
                          <div className="flex flex-col justify-between p-4 rounded-2xl bg-rose-500/5 dark:bg-rose-500/10 border border-rose-500/10 dark:border-rose-500/20">
                            <div className="space-y-4">
                              <div className="flex items-center gap-1.5">
                                <span className="w-2 h-2 rounded-full bg-rose-500" />
                                <span className="text-[9px] font-black uppercase tracking-widest text-rose-500">
                                  Komponen Potongan (-)
                                </span>
                              </div>
                              
                              <div>
                                <label className="block text-[9.5px] font-bold text-slate-700 dark:text-slate-300 mb-1">Denda Laporan Harian</label>
                                <div className="relative">
                                  <span className="text-[10px] font-black text-rose-400 absolute left-3 top-1/2 -translate-y-1/2">Rp</span>
                                  <input
                                    type="number"
                                    value={formData.deduksi || 0}
                                    disabled={viewOnly}
                                    onChange={(e) => recalculateTotal({ deduksi: Math.max(0, Number(e.target.value)) })}
                                    className="w-full bg-white dark:bg-slate-900 border border-rose-200 dark:border-rose-800 rounded-xl pl-8 pr-3 py-1.5 text-xs font-black text-rose-500 focus:ring-2 focus:ring-rose-500/20"
                                  />
                                </div>
                                <p className="text-[8.5px] text-slate-500 mt-1.5 leading-relaxed">
                                  *Denda keterlambatan ditarik dari jumlah hari bolos/lambat melapor harian (Rp 5.000 per kejadian).
                                </p>
                              </div>
                            </div>

                            {/* Total salary highlighted summary */}
                            <div className="pt-4 border-t border-rose-200 dark:border-rose-800/80 mt-6 space-y-1">
                              <span className="text-[9px] font-extrabold uppercase tracking-widest text-slate-500 block">Akumulasi Total Gaji Bersih</span>
                              <p className="text-2xl font-black text-emerald-600 dark:text-emerald-400 font-mono tracking-tight">
                                {formatRupiah(formData.totalGaji)}
                              </p>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Catatan / Notes */}
                      <div className="space-y-2">
                        <label className="block text-[9px] font-extrabold uppercase tracking-wider text-slate-500">Catatan Khusus Slip Gaji (Akan Tampil di Slip)</label>
                        <textarea
                          placeholder="Masukkan catatan khusus slip gaji ini, misal denda khusus atau tambahan prestasi..."
                          value={formData.note || ''}
                          disabled={viewOnly}
                          onChange={(e) => setFormData({ ...formData, note: e.target.value })}
                          className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl px-4 py-2.5 text-xs font-medium text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 min-h-[60px]"
                        />
                      </div>

                      {/* Status Toggle (Admin Only) */}
                      {!viewOnly && (
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-2xl bg-slate-50 dark:bg-slate-950/40 border border-slate-200 dark:border-slate-800/80">
                          <div>
                            <p className="text-xs font-black text-slate-900 dark:text-white leading-tight">Status Penerbitan Slip Gaji</p>
                            <p className="text-[9px] text-slate-500 dark:text-slate-400 mt-0.5 font-medium">Tandai PAID jika hak slip gaji telah ditransfer penuh ke Recruiter.</p>
                          </div>

                          <div className="flex gap-2 shrink-0">
                            <button
                              type="button"
                              onClick={() => setFormData({ ...formData, status: 'Draft' })}
                              className={`px-4 py-1.5 rounded-xl text-xs font-black border transition-all cursor-pointer ${
                                formData.status === 'Draft' 
                                  ? 'bg-amber-500 text-white border-amber-500 shadow-sm shadow-amber-500/25' 
                                  : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 hover:bg-slate-50'
                              }`}
                            >
                              Draft (Simpan)
                            </button>
                            <button
                              type="button"
                              onClick={() => setFormData({ ...formData, status: 'Paid' })}
                              className={`px-4 py-1.5 rounded-xl text-xs font-black border transition-all cursor-pointer ${
                                formData.status === 'Paid' 
                                  ? 'bg-emerald-500 text-white border-emerald-500 shadow-sm shadow-emerald-500/25' 
                                  : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 hover:bg-slate-50'
                              }`}
                            >
                              Paid (Lunas)
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Footer Actions */}
              <div className="p-5 border-t border-slate-150 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/40 flex flex-col sm:flex-row justify-between gap-3">
                {/* Print button on view-only */}
                {viewOnly ? (
                  <>
                    <button
                      onClick={printSlip}
                      className="px-5 py-2.5 bg-slate-900 hover:bg-slate-800 dark:bg-white dark:hover:bg-slate-100 text-white dark:text-slate-950 rounded-2xl text-xs font-black flex items-center justify-center gap-2 cursor-pointer transition-colors shadow-sm"
                    >
                      <Printer className="w-4 h-4" /> Cetak / Unduh Slip Gaji
                    </button>

                    <button
                      onClick={() => setIsModalOpen(false)}
                      className="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-2xl text-xs font-black transition-colors cursor-pointer"
                    >
                      Tutup Slip
                    </button>
                  </>
                ) : (
                  <>
                    {/* Admin Actions */}
                    <button
                      type="button"
                      onClick={triggerAutoRecalculate}
                      disabled={isCalculating}
                      className="px-4 py-2.5 bg-sky-500/10 hover:bg-sky-500/20 text-sky-600 dark:text-sky-400 rounded-2xl text-xs font-black border border-sky-500/25 flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-60 transition-colors"
                    >
                      <RefreshCw className="w-3.5 h-3.5" /> Ambil Data Auto
                    </button>

                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => setIsModalOpen(false)}
                        className="px-4 py-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-2xl text-xs font-bold transition-colors cursor-pointer"
                      >
                        Batal
                      </button>

                      <button
                        type="button"
                        onClick={handleSaveSalary}
                        disabled={isSaving || isCalculating}
                        className="px-5 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-white rounded-2xl text-xs font-black transition-colors flex items-center justify-center gap-1.5 shadow-md shadow-emerald-500/25 cursor-pointer disabled:opacity-60"
                      >
                        {isSaving ? (
                          <>
                            <RefreshCw className="w-3.5 h-3.5 animate-spin" /> Menyimpan...
                          </>
                        ) : (
                          'Simpan Slip Gaji'
                        )}
                      </button>
                    </div>
                  </>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
