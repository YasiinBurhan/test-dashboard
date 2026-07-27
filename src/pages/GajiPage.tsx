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
  Info
} from 'lucide-react';
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
import { getWIBMondayOfDate, getWIBWeekRange } from '../utils/format';

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
      const savedSalary = salaries.find(
        s => s.telegramId === user.telegramId && s.periode === selectedPeriod
      );

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
    setViewOnly(viewMode);
    
    if (slip) {
      // Open existing slip
      setFormData(slip);
      setIsModalOpen(true);
    } else {
      // Start auto-calculation for new slip
      setIsCalculating(true);
      setIsModalOpen(true);
      try {
        const autoMetrics = await calculateRecruiterMetrics(recruiter.telegramId, selectedPeriod);
        const { formattedRange } = getWIBWeekRange(selectedPeriod);
        
        setFormData({
          id: `${recruiter.telegramId}_${selectedPeriod}`,
          periode: selectedPeriod,
          username: recruiter.username || '',
          recruiterName: `${recruiter.firstName || ''} ${recruiter.lastName || ''}`.trim(),
          telegramId: recruiter.telegramId,
          status: 'Draft',
          note: '',
          ...autoMetrics
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
      const gajiPokok = Number(merged.gajiPokok) || 0;
      const komisi = Number(merged.komisi) || 0;
      const bonusT0 = Number(merged.bonusT0) || 0;
      const bonusT3 = Number(merged.bonusT3) || 0;
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
        totalGaji,
        tingkatPenerimaan
      };
    });
  };

  // Save/submit form to Firestore
  const handleSaveSalary = async () => {
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
    if (!formData.telegramId || !formData.periode) return;
    setIsCalculating(true);
    try {
      const autoMetrics = await calculateRecruiterMetrics(formData.telegramId, formData.periode);
      recalculateTotal(autoMetrics);
    } catch (err) {
      console.error('Recalculation failed:', err);
    } finally {
      setIsCalculating(false);
    }
  };

  // Delete slip
  const handleDeleteSlip = async (id: string) => {
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

      {/* DASHBOARD SUMMARY CARDS */}
      {isAdminOrOwner && (
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
          <div className="p-4 rounded-3xl bg-white dark:bg-slate-950/60 border border-slate-200 dark:border-slate-900/60 flex flex-col justify-between">
            <span className="text-[10px] font-extrabold uppercase tracking-widest text-slate-500 dark:text-slate-400">Total Recruiter</span>
            <span className="text-xl font-black text-slate-900 dark:text-white mt-2">{summaryStats.totalStaff} Orang</span>
          </div>

          <div className="p-4 rounded-3xl bg-white dark:bg-slate-950/60 border border-slate-200 dark:border-slate-900/60 flex flex-col justify-between">
            <span className="text-[10px] font-extrabold uppercase tracking-widest text-rose-500">Belum Diinput</span>
            <span className="text-xl font-black text-rose-500 mt-2">{summaryStats.pendingInput} Orang</span>
          </div>

          <div className="p-4 rounded-3xl bg-white dark:bg-slate-950/60 border border-slate-200 dark:border-slate-900/60 flex flex-col justify-between">
            <span className="text-[10px] font-extrabold uppercase tracking-widest text-amber-500">Gaji Draft</span>
            <span className="text-xl font-black text-amber-500 mt-2">{summaryStats.totalDraft} Slips</span>
          </div>

          <div className="p-4 rounded-3xl bg-white dark:bg-slate-950/60 border border-slate-200 dark:border-slate-900/60 flex flex-col justify-between">
            <span className="text-[10px] font-extrabold uppercase tracking-widest text-emerald-500">Telah Dibayar</span>
            <span className="text-xl font-black text-emerald-500 mt-2">{summaryStats.totalPaid} Slips</span>
          </div>

          <div className="col-span-2 lg:col-span-1 p-4 rounded-3xl bg-gradient-to-br from-emerald-500/10 to-teal-500/5 border border-emerald-500/20 flex flex-col justify-between">
            <span className="text-[10px] font-extrabold uppercase tracking-widest text-emerald-600 dark:text-emerald-400">Total Pengeluaran</span>
            <span className="text-xl font-black text-emerald-600 dark:text-emerald-400 mt-2">{formatRupiah(summaryStats.totalPayout)}</span>
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
                    {currentSlip ? `${currentSlip.sebenarnyaT0} / ${currentSlip.sebenarnyaV0}` : '-'}
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
          <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-900 rounded-3xl w-full max-w-2xl overflow-hidden shadow-2xl relative"
            >
              {/* Header */}
              <div className="p-4 border-b border-slate-150 dark:border-slate-900 flex justify-between items-center bg-slate-50 dark:bg-slate-950">
                <div>
                  <h3 className="text-xs font-black uppercase tracking-wider text-slate-500">
                    {viewOnly ? 'Detail Slip Gaji' : formData.createdAt ? 'Edit Slip Gaji' : 'Input Slip Gaji Baru'}
                  </h3>
                  <p className="text-[10px] font-mono text-slate-600 dark:text-slate-400 mt-0.5">
                    Periode: {getWIBWeekRange(formData.periode || '').formattedRange}
                  </p>
                </div>
                <button 
                  onClick={() => setIsModalOpen(false)}
                  className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-900 rounded-xl cursor-pointer"
                >
                  <X className="w-4.5 h-4.5" />
                </button>
              </div>

              {/* Loader during auto-calculations */}
              {isCalculating ? (
                <div className="py-24 flex flex-col items-center justify-center space-y-3">
                  <RefreshCw className="w-8 h-8 text-emerald-500 animate-spin" />
                  <p className="text-xs text-slate-400 font-bold">Menghitung akumulasi data performa recruiter...</p>
                </div>
              ) : (
                <div className="p-5 max-h-[70vh] overflow-y-auto space-y-6">
                  {/* Recruiter profile banner in slip */}
                  <div className="flex items-center gap-3 p-3 bg-slate-50 dark:bg-slate-900/40 rounded-2xl border border-slate-100 dark:border-slate-800/60">
                    {selectedRecruiter?.photoUrl ? (
                      <img 
                        src={selectedRecruiter.photoUrl} 
                        alt={formData.recruiterName}
                        referrerPolicy="no-referrer"
                        className="w-10 h-10 rounded-2xl object-cover border border-slate-200 dark:border-slate-800/60"
                      />
                    ) : (
                      <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-500 font-black flex items-center justify-center uppercase">
                        {formData.recruiterName?.slice(0, 2) || 'R'}
                      </div>
                    )}
                    <div>
                      <h4 className="text-xs font-black text-slate-900 dark:text-white">{formData.recruiterName}</h4>
                      <p className="text-[10px] text-slate-600 dark:text-slate-400 font-mono">
                        Username: @{formData.username} • Telegram ID: {formData.telegramId}
                      </p>
                    </div>
                  </div>

                  {/* SECTION 1: Performance metrics breakdown */}
                  <div className="space-y-3">
                    <div className="flex items-center gap-1.5">
                      <Award className="w-3.5 h-3.5 text-sky-500" />
                      <h5 className="text-[10px] font-black uppercase tracking-widest text-slate-500">Kinerja & Produktivitas</h5>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                      <div>
                        <label className="block text-[9px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-1">Hari Kerja Efektif</label>
                        <input
                          type="number"
                          value={formData.hariEfektif || 0}
                          disabled={viewOnly}
                          onChange={(e) => recalculateTotal({ hariEfektif: Math.max(0, Number(e.target.value)) })}
                          className="w-full bg-slate-50 dark:bg-slate-900/60 border border-slate-100 dark:border-slate-800 rounded-xl px-3 py-1.5 text-xs font-black text-slate-900 dark:text-white disabled:opacity-80"
                        />
                      </div>

                      <div>
                        <label className="block text-[9px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-1">Total Postingan</label>
                        <input
                          type="number"
                          value={formData.totalPostingan || 0}
                          disabled={viewOnly}
                          onChange={(e) => recalculateTotal({ totalPostingan: Math.max(0, Number(e.target.value)) })}
                          className="w-full bg-slate-50 dark:bg-slate-900/60 border border-slate-100 dark:border-slate-800 rounded-xl px-3 py-1.5 text-xs font-black text-slate-900 dark:text-white disabled:opacity-80"
                        />
                      </div>

                      <div>
                        <label className="block text-[9px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-1">Level Gaji</label>
                        <input
                          type="text"
                          value={formData.levelGaji || ''}
                          disabled={viewOnly}
                          onChange={(e) => setFormData({ ...formData, levelGaji: e.target.value })}
                          className="w-full bg-slate-50 dark:bg-slate-900/60 border border-slate-100 dark:border-slate-800 rounded-xl px-3 py-1.5 text-xs font-black text-slate-900 dark:text-white disabled:opacity-80"
                        />
                      </div>

                      <div>
                        <label className="block text-[9px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-1">Deklarasi T0</label>
                        <input
                          type="number"
                          value={formData.deklarasiT0 || 0}
                          disabled={viewOnly}
                          onChange={(e) => recalculateTotal({ deklarasiT0: Math.max(0, Number(e.target.value)) })}
                          className="w-full bg-slate-50 dark:bg-slate-900/60 border border-slate-100 dark:border-slate-800 rounded-xl px-3 py-1.5 text-xs font-black text-slate-900 dark:text-white disabled:opacity-80"
                        />
                      </div>

                      <div>
                        <label className="block text-[9px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-1">Sebenarnya T0 (Verified)</label>
                        <input
                          type="number"
                          value={formData.sebenarnyaT0 || 0}
                          disabled={viewOnly}
                          onChange={(e) => recalculateTotal({ sebenarnyaT0: Math.max(0, Number(e.target.value)) })}
                          className="w-full bg-slate-50 dark:bg-slate-900/60 border border-slate-100 dark:border-slate-800 rounded-xl px-3 py-1.5 text-xs font-black text-slate-900 dark:text-white disabled:opacity-80"
                        />
                      </div>

                      <div>
                        <label className="block text-[9px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-1">T3 (Promoted)</label>
                        <input
                          type="number"
                          value={formData.t3 || 0}
                          disabled={viewOnly}
                          onChange={(e) => recalculateTotal({ t3: Math.max(0, Number(e.target.value)) })}
                          className="w-full bg-slate-50 dark:bg-slate-900/60 border border-slate-100 dark:border-slate-800 rounded-xl px-3 py-1.5 text-xs font-black text-slate-900 dark:text-white disabled:opacity-80"
                        />
                      </div>

                      <div>
                        <label className="block text-[9px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-1">Deklarasi V0</label>
                        <input
                          type="number"
                          value={formData.deklarasiV0 || 0}
                          disabled={viewOnly}
                          onChange={(e) => recalculateTotal({ deklarasiV0: Math.max(0, Number(e.target.value)) })}
                          className="w-full bg-slate-50 dark:bg-slate-900/60 border border-slate-100 dark:border-slate-800 rounded-xl px-3 py-1.5 text-xs font-black text-slate-900 dark:text-white disabled:opacity-80"
                        />
                      </div>

                      <div>
                        <label className="block text-[9px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-1">Sebenarnya V0 (Verified)</label>
                        <input
                          type="number"
                          value={formData.sebenarnyaV0 || 0}
                          disabled={viewOnly}
                          onChange={(e) => recalculateTotal({ sebenarnyaV0: Math.max(0, Number(e.target.value)) })}
                          className="w-full bg-slate-50 dark:bg-slate-900/60 border border-slate-100 dark:border-slate-800 rounded-xl px-3 py-1.5 text-xs font-black text-slate-900 dark:text-white disabled:opacity-80"
                        />
                      </div>

                      <div className="flex gap-1.5">
                        <div className="flex-1">
                          <label className="block text-[9px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-1">Tingkat Terima (%)</label>
                          <div className="relative">
                            <input
                              type="number"
                              value={formData.tingkatPenerimaan || 0}
                              disabled
                              className="w-full bg-slate-100 dark:bg-slate-900/90 border border-slate-150 dark:border-slate-800 rounded-xl pl-3 pr-7 py-1.5 text-xs font-black text-slate-900 dark:text-white"
                            />
                            <Percent className="w-3 h-3 absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
                          </div>
                        </div>
                        <div className="flex-1">
                          <label className="block text-[9px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-1">Peningkatan (%)</label>
                          <div className="relative">
                            <input
                              type="number"
                              value={formData.rasioPeningkatan || 0}
                              disabled={viewOnly}
                              onChange={(e) => setFormData({ ...formData, rasioPeningkatan: Math.max(0, Number(e.target.value)) })}
                              className="w-full bg-slate-50 dark:bg-slate-900/60 border border-slate-100 dark:border-slate-800 rounded-xl pl-3 pr-7 py-1.5 text-xs font-black text-slate-900 dark:text-white disabled:opacity-80"
                            />
                            <Percent className="w-3 h-3 absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* SECTION 2: Finance breakdowns (earnings & deductions) */}
                  <div className="space-y-3">
                    <div className="flex items-center gap-1.5">
                      <TrendingUp className="w-3.5 h-3.5 text-emerald-500" />
                      <h5 className="text-[10px] font-black uppercase tracking-widest text-slate-500">Rincian Komisi & Slip Gaji</h5>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {/* Earnings Column */}
                      <div className="space-y-3 p-4 rounded-2xl bg-emerald-500/5 border border-emerald-500/10">
                        <span className="text-[9px] font-black uppercase tracking-widest text-emerald-600 dark:text-emerald-400">Pendapatan / Bonus</span>
                        
                        <div className="space-y-2.5">
                          <div>
                            <label className="block text-[9.5px] font-bold text-slate-700 dark:text-slate-300">Gaji Pokok</label>
                            <input
                              type="number"
                              value={formData.gajiPokok || 0}
                              disabled={viewOnly}
                              onChange={(e) => recalculateTotal({ gajiPokok: Math.max(0, Number(e.target.value)) })}
                              className="w-full bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-850 rounded-xl px-3 py-1.5 text-xs font-black text-slate-900 dark:text-white"
                            />
                          </div>

                          <div>
                            <label className="block text-[9.5px] font-bold text-slate-700 dark:text-slate-300">Komisi</label>
                            <input
                              type="number"
                              value={formData.komisi || 0}
                              disabled={viewOnly}
                              onChange={(e) => recalculateTotal({ komisi: Math.max(0, Number(e.target.value)) })}
                              className="w-full bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-850 rounded-xl px-3 py-1.5 text-xs font-black text-slate-900 dark:text-white"
                            />
                          </div>

                          <div>
                            <label className="block text-[9.5px] font-bold text-slate-700 dark:text-slate-300">Bonus (T0)</label>
                            <input
                              type="number"
                              value={formData.bonusT0 || 0}
                              disabled={viewOnly}
                              onChange={(e) => recalculateTotal({ bonusT0: Math.max(0, Number(e.target.value)) })}
                              className="w-full bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-850 rounded-xl px-3 py-1.5 text-xs font-black text-slate-900 dark:text-white"
                            />
                          </div>

                          <div>
                            <label className="block text-[9.5px] font-bold text-slate-700 dark:text-slate-300">Bonus (T3)</label>
                            <input
                              type="number"
                              value={formData.bonusT3 || 0}
                              disabled={viewOnly}
                              onChange={(e) => recalculateTotal({ bonusT3: Math.max(0, Number(e.target.value)) })}
                              className="w-full bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-850 rounded-xl px-3 py-1.5 text-xs font-black text-slate-900 dark:text-white"
                            />
                          </div>

                          <div>
                            <label className="block text-[9.5px] font-bold text-slate-700 dark:text-slate-300">Other Bonus</label>
                            <input
                              type="number"
                              value={formData.otherBonus || 0}
                              disabled={viewOnly}
                              onChange={(e) => recalculateTotal({ otherBonus: Math.max(0, Number(e.target.value)) })}
                              className="w-full bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-850 rounded-xl px-3 py-1.5 text-xs font-black text-slate-900 dark:text-white"
                            />
                          </div>
                        </div>
                      </div>

                      {/* Deductions Column */}
                      <div className="flex flex-col justify-between p-4 rounded-2xl bg-rose-500/5 border border-rose-500/10">
                        <div className="space-y-3">
                          <span className="text-[9px] font-black uppercase tracking-widest text-rose-500">Deduksi (Denda / Lainnya)</span>
                          
                          <div>
                            <label className="block text-[9.5px] font-bold text-slate-700 dark:text-slate-300">Deduksi / Denda Laporan</label>
                            <input
                              type="number"
                              value={formData.deduksi || 0}
                              disabled={viewOnly}
                              onChange={(e) => recalculateTotal({ deduksi: Math.max(0, Number(e.target.value)) })}
                              className="w-full bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-850 rounded-xl px-3 py-1.5 text-xs font-black text-rose-500 disabled:opacity-85"
                            />
                            <p className="text-[9px] text-slate-600 dark:text-slate-400 mt-1">
                              *Dihitung otomatis dari akumulasi denda keterlambatan posting laporan harian (Rp 5.000 per pelanggaran).
                            </p>
                          </div>
                        </div>

                        {/* Total salary highlighted summary */}
                        <div className="pt-4 border-t border-rose-500/20 mt-4 space-y-1">
                          <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500">Total Gaji Bersih</span>
                          <p className="text-xl font-black text-emerald-600 dark:text-emerald-400 font-mono">
                            {formatRupiah(formData.totalGaji)}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Catatan / Notes */}
                  <div className="space-y-2">
                    <label className="block text-[10px] font-extrabold uppercase tracking-wider text-slate-500">Catatan Khusus (Optional)</label>
                    <textarea
                      placeholder="Masukkan catatan khusus slip gaji ini, misal denda khusus atau tambahan prestasi..."
                      value={formData.note || ''}
                      disabled={viewOnly}
                      onChange={(e) => setFormData({ ...formData, note: e.target.value })}
                      className="w-full bg-slate-50 dark:bg-slate-900/60 border border-slate-150 dark:border-slate-800 rounded-2xl px-4 py-2 text-xs font-medium text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 min-h-[60px]"
                    />
                  </div>

                  {/* Status Toggle (Admin Only) */}
                  {!viewOnly && (
                    <div className="flex items-center justify-between p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-900/40 border border-slate-200 dark:border-slate-800/80">
                      <div>
                        <p className="text-xs font-black text-slate-900 dark:text-white">Status Pembayaran Gaji</p>
                        <p className="text-[9px] text-slate-600 dark:text-slate-400 font-medium">Tandai slip sebagai Paid (Lunas) agar recruiter mengetahuinya.</p>
                      </div>

                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => setFormData({ ...formData, status: 'Draft' })}
                          className={`px-3 py-1.5 rounded-xl text-[10px] font-black border transition-all cursor-pointer ${
                            formData.status === 'Draft' 
                              ? 'bg-amber-500/10 border-amber-500/40 text-amber-600 dark:text-amber-400' 
                              : 'bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-500'
                          }`}
                        >
                          Draft
                        </button>
                        <button
                          type="button"
                          onClick={() => setFormData({ ...formData, status: 'Paid' })}
                          className={`px-3 py-1.5 rounded-xl text-[10px] font-black border transition-all cursor-pointer ${
                            formData.status === 'Paid' 
                              ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-600 dark:text-emerald-400' 
                              : 'bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-500'
                          }`}
                        >
                          Paid (Lunas)
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Footer Actions */}
              <div className="p-4 border-t border-slate-150 dark:border-slate-900 bg-slate-50 dark:bg-slate-950 flex flex-col sm:flex-row justify-between gap-3">
                {/* Print button on view-only */}
                {viewOnly ? (
                  <>
                    <button
                      onClick={printSlip}
                      className="px-4 py-2 bg-slate-900 hover:bg-slate-850 text-slate-100 rounded-2xl text-xs font-black flex items-center justify-center gap-2 cursor-pointer transition-colors"
                    >
                      <Printer className="w-4 h-4" /> Cetak / Unduh Slip Gaji
                    </button>

                    <button
                      onClick={() => setIsModalOpen(false)}
                      className="px-4 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-900 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-2xl text-xs font-bold transition-colors cursor-pointer"
                    >
                      Tutup
                    </button>
                  </>
                ) : (
                  <>
                    {/* Admin Actions */}
                    <button
                      type="button"
                      onClick={triggerAutoRecalculate}
                      disabled={isCalculating}
                      className="px-3 py-2 bg-sky-500/10 hover:bg-sky-500/20 text-sky-600 dark:text-sky-400 rounded-2xl text-xs font-black border border-sky-500/20 flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-60 transition-colors"
                    >
                      <RefreshCw className="w-3.5 h-3.5" /> Auto-Hitung Ulang
                    </button>

                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => setIsModalOpen(false)}
                        className="px-4 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-2xl text-xs font-bold transition-colors cursor-pointer"
                      >
                        Batal
                      </button>

                      <button
                        type="button"
                        onClick={handleSaveSalary}
                        disabled={isSaving || isCalculating}
                        className="px-5 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-2xl text-xs font-black transition-colors flex items-center justify-center gap-1.5 shadow-md shadow-emerald-500/10 cursor-pointer disabled:opacity-60"
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
