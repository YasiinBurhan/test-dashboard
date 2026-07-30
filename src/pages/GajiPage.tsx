import React, { useState, useEffect, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
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
  ChevronLeft,
  ChevronDown,
  Info,
  BookOpen,
  ListOrdered,
  ShieldAlert,
  ChevronUp,
  Crown,
  Trophy,
  Medal,
  DollarSign,
  Eye
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
  const [sortBy, setSortBy] = useState<'name' | 'gaji' | 'hari' | 'acc'>('acc');
  const [leaderboardScope, setLeaderboardScope] = useState<'period' | 'allTime'>('period');
  const [leaderboardPage, setLeaderboardPage] = useState(1);
  const ITEMS_PER_PAGE = 10;

  // Guide widget state
  const [isGuideOpen, setIsGuideOpen] = useState(false);
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

  // ESC Key listener & Body Scroll Lock for modal accessibility
  useEffect(() => {
    if (isModalOpen) {
      document.body.style.overflow = 'hidden';
      const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === 'Escape') setIsModalOpen(false);
      };
      window.addEventListener('keydown', handleKeyDown);
      return () => {
        document.body.style.overflow = '';
        window.removeEventListener('keydown', handleKeyDown);
      };
    } else {
      document.body.style.overflow = '';
    }
  }, [isModalOpen]);

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
        deklarasiV0: rawSavedSalary.deklarasiV0 || 0,
        sebenarnyaV0: rawSavedSalary.sebenarnyaV0 || 0,
        deklarasiT0: rawSavedSalary.deklarasiT0 || 0,
        sebenarnyaT0: rawSavedSalary.sebenarnyaT0 || 0,
        t3: rawSavedSalary.t3 || 0,
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
      if (sortBy === 'acc') {
        const itemAReports = reports.filter(r => r.telegramId === a.user.telegramId && (r.applicantWhatsapp || r.uid9Kucing || r.applicantTelegramUsername));
        const itemBReports = reports.filter(r => r.telegramId === b.user.telegramId && (r.applicantWhatsapp || r.uid9Kucing || r.applicantTelegramUsername));
        
        const periodAReports = itemAReports.filter(r => (r.date || r.createdAt?.split('T')[0]) && getWIBMondayOfDate(r.date || r.createdAt?.split('T')[0]) === selectedPeriod);
        const periodBReports = itemBReports.filter(r => (r.date || r.createdAt?.split('T')[0]) && getWIBMondayOfDate(r.date || r.createdAt?.split('T')[0]) === selectedPeriod);

        const repAccA = periodAReports.filter(r => r.result === 'ACC').length;
        const repAccB = periodBReports.filter(r => r.result === 'ACC').length;

        const slipAccA = a.salarySlip ? ((a.salarySlip.sebenarnyaT0 || 0) + (a.salarySlip.sebenarnyaV0 || 0) + (a.salarySlip.t3 || 0)) : 0;
        const slipAccB = b.salarySlip ? ((b.salarySlip.sebenarnyaT0 || 0) + (b.salarySlip.sebenarnyaV0 || 0) + (b.salarySlip.t3 || 0)) : 0;

        const totalAccA = Math.max(repAccA, slipAccA);
        const totalAccB = Math.max(repAccB, slipAccB);

        return totalAccB - totalAccA;
      }
      return 0;
    });
  }, [users, reports, salaries, selectedPeriod, searchQuery, sortBy]);

  // ACC Ranking Leaderboard for Admin & Owner
  const accLeaderboard = useMemo(() => {
    return users.map(u => {
      // Applicant reports for this user
      const userReports = reports.filter(r => r.telegramId === u.telegramId && (r.applicantWhatsapp || r.uid9Kucing || r.applicantTelegramUsername));
      
      // Period reports
      const periodReports = userReports.filter(r => {
        const rDate = r.date || (r.createdAt ? r.createdAt.split('T')[0] : '');
        return getWIBMondayOfDate(rDate) === selectedPeriod;
      });

      // Count ACC in period from reports
      const periodACC_T0 = periodReports.filter(r => r.result === 'ACC' && r.grup === 'T0').length;
      const periodACC_V0 = periodReports.filter(r => r.result === 'ACC' && r.grup === 'V0').length;
      const periodACC_T3 = periodReports.filter(r => r.result === 'ACC' && r.grup === 'T3').length;
      const periodACC_Total = periodACC_T0 + periodACC_V0 + periodACC_T3;

      // Check saved salary slip for this period
      const savedSlip = salaries.find(s => s.telegramId === u.telegramId && s.periode === selectedPeriod);
      const slipACC_T0 = savedSlip?.sebenarnyaT0 || 0;
      const slipACC_V0 = savedSlip?.sebenarnyaV0 || 0;
      const slipACC_T3 = savedSlip?.t3 || 0;
      const slipACC_Total = slipACC_T0 + slipACC_V0 + slipACC_T3;
      
      // Take maximum for period accuracy
      const finalT0 = Math.max(periodACC_T0, slipACC_T0);
      const finalV0 = Math.max(periodACC_V0, slipACC_V0);
      const finalT3 = Math.max(periodACC_T3, slipACC_T3);
      const finalPeriodACC = finalT0 + finalV0 + finalT3;

      // All time from reports
      const allTimeACC_T0 = userReports.filter(r => r.result === 'ACC' && r.grup === 'T0').length;
      const allTimeACC_V0 = userReports.filter(r => r.result === 'ACC' && r.grup === 'V0').length;
      const allTimeACC_T3 = userReports.filter(r => r.result === 'ACC' && r.grup === 'T3').length;
      
      // All time from saved salaries
      const userSalaries = salaries.filter(s => s.telegramId === u.telegramId);
      const salariesACC_T0 = userSalaries.reduce((sum, s) => sum + (s.sebenarnyaT0 || 0), 0);
      const salariesACC_V0 = userSalaries.reduce((sum, s) => sum + (s.sebenarnyaV0 || 0), 0);
      const salariesACC_T3 = userSalaries.reduce((sum, s) => sum + (s.t3 || 0), 0);

      const finalAllTimeT0 = Math.max(allTimeACC_T0, salariesACC_T0);
      const finalAllTimeV0 = Math.max(allTimeACC_V0, salariesACC_V0);
      const finalAllTimeT3 = Math.max(allTimeACC_T3, salariesACC_T3);
      const finalAllTimeACC = finalAllTimeT0 + finalAllTimeV0 + finalAllTimeT3;

      return {
        user: u,
        periodACC: finalPeriodACC,
        periodACCBreakdown: { t0: finalT0, v0: finalV0, t3: finalT3 },
        allTimeACC: finalAllTimeACC,
        allTimeBreakdown: { t0: finalAllTimeT0, v0: finalAllTimeV0, t3: finalAllTimeT3 },
        salarySlip: savedSlip || null,
      };
    }).sort((a, b) => {
      if (leaderboardScope === 'period') {
        return b.periodACC - a.periodACC || b.allTimeACC - a.allTimeACC;
      }
      return b.allTimeACC - a.allTimeACC || b.periodACC - a.periodACC;
    });
  }, [users, reports, salaries, selectedPeriod, leaderboardScope]);

  // Reset page when scope or period changes
  useEffect(() => {
    setLeaderboardPage(1);
  }, [leaderboardScope, selectedPeriod]);

  const totalLeaderboardPages = useMemo(() => {
    return Math.ceil(accLeaderboard.length / ITEMS_PER_PAGE) || 1;
  }, [accLeaderboard.length, ITEMS_PER_PAGE]);

  const currentLeaderboardPage = Math.min(leaderboardPage, totalLeaderboardPages);

  const paginatedLeaderboard = useMemo(() => {
    const start = (currentLeaderboardPage - 1) * ITEMS_PER_PAGE;
    return accLeaderboard.slice(start, start + ITEMS_PER_PAGE);
  }, [accLeaderboard, currentLeaderboardPage, ITEMS_PER_PAGE]);

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
        akun9Kucing: slip.akun9Kucing || recruiter.akun9Kucing || '',
        deklarasiV0: slip.deklarasiV0 || 0,
        sebenarnyaV0: slip.sebenarnyaV0 || 0,
        deklarasiT0: slip.deklarasiT0 || 0,
        sebenarnyaT0: slip.sebenarnyaT0 || 0,
        t3: slip.t3 || 0,
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
          akun9Kucing: recruiter.akun9Kucing || '',
          status: 'Draft',
          note: '',
          ...autoMetrics,
          deklarasiV0: autoMetrics.deklarasiV0 || 0,
          sebenarnyaV0: autoMetrics.sebenarnyaV0 || 0,
          deklarasiT0: autoMetrics.deklarasiT0 || 0,
          sebenarnyaT0: autoMetrics.sebenarnyaT0 || 0,
          t3: autoMetrics.t3 || 0,
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
      
      // Also calculate tingkat penerimaan dynamically: (promoted + V0 VERIFIED) / 7
      const promoted = Number(merged.t3) || 0;
      const v0Verified = Number(merged.sebenarnyaV0) || 0;
      const tingkatPenerimaan = Number(((promoted + v0Verified) / 7).toFixed(1));

      // Calculate Rasio Up (%) dynamically: (PROMOTED + VERIFIED V0) / (VERIFIED T0 + PROMOTED + DEKLARASI V0 + VERIFIED V0) * 100
      const t0Verified = Number(merged.sebenarnyaT0) || 0;
      const v0Deklarasi = Number(merged.deklarasiV0) || 0;
      const numeratorUp = promoted + v0Verified;
      const denominatorUp = t0Verified + promoted + v0Deklarasi + v0Verified;
      const rasioPeningkatan = denominatorUp > 0 ? Math.round((numeratorUp / denominatorUp) * 100) : 0;

      return {
        ...merged,
        levelGaji,
        gajiPokok,
        komisi,
        bonusT3,
        totalGaji,
        tingkatPenerimaan,
        rasioPeningkatan
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
        akun9Kucing: formData.akun9Kucing || selectedRecruiter?.akun9Kucing || '',
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
        deklarasiV0: autoMetrics.deklarasiV0 || 0,
        sebenarnyaV0: autoMetrics.sebenarnyaV0 || 0,
        deklarasiT0: autoMetrics.deklarasiT0 || 0,
        sebenarnyaT0: autoMetrics.sebenarnyaT0 || 0,
        t3: formData.t3 || 0,
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
    <div className="space-y-6 px-1 pb-4">
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
                      <strong className="text-slate-900 dark:text-white block mb-0.5">Syarat Verifikasi Data Harian (Data Minggu Lalu):</strong>
                      Data rekrutan V0, T0, dan T3 <strong className="text-slate-900 dark:text-white">baru terhitung di slip gaji</strong> setelah melewati minggu berjalan dan diproses di <strong className="text-sky-600 dark:text-sky-400 font-bold">Data Minggu Lalu</strong> pada menu Data Harian. Selama belum masuk pemeriksaan minggu lalu, nilai Deklarasi V0 & V0 Verified sengaja dikosongkan (0).
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

      {/* PERINGKAT TERBANYAK ACC (UNTUK SEMUA RECRUITER & ADMIN) */}
      <GlassCard className="p-4 sm:p-5 bg-gradient-to-br from-amber-500/5 via-emerald-500/5 to-slate-950/80 border border-amber-500/20 dark:border-amber-500/30 rounded-3xl shadow-xl space-y-4 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-36 h-36 bg-amber-500/10 rounded-full blur-2xl pointer-events-none" />

        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200/60 dark:border-slate-800/80 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-2xl bg-gradient-to-br from-amber-400 to-amber-600 text-slate-950 flex items-center justify-center font-black shadow-md shadow-amber-500/20 shrink-0">
              <Trophy className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-black text-slate-900 dark:text-white tracking-tight flex items-center gap-1.5">
                Peringkat Recruiter Terbanyak ACC
                <span className="text-[9px] bg-amber-500/20 text-amber-700 dark:text-amber-400 font-extrabold uppercase px-2 py-0.5 rounded-full border border-amber-500/30">
                  Leaderboard
                </span>
              </h3>
              <p className="text-[10px] text-slate-600 dark:text-slate-400">
                Peringkat recruiter berdasarkan jumlah verifikasi ACC terbanyak (T0, V0 & T3)
              </p>
            </div>
          </div>

          {/* Scope Toggle: Periode ini vs All Time */}
          <div className="flex p-0.5 bg-slate-100 dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shrink-0 self-start sm:self-center">
            <button
              type="button"
              onClick={() => { setLeaderboardScope('period'); triggerHaptic('selection'); }}
              className={`px-3 py-1.5 rounded-lg text-[10px] font-black transition-all ${
                leaderboardScope === 'period'
                  ? 'bg-amber-500 text-slate-950 shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              Periode Ini
            </button>
            <button
              type="button"
              onClick={() => { setLeaderboardScope('allTime'); triggerHaptic('selection'); }}
              className={`px-3 py-1.5 rounded-lg text-[10px] font-black transition-all ${
                leaderboardScope === 'allTime'
                  ? 'bg-amber-500 text-slate-950 shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              Semua Periode (Total)
            </button>
          </div>
        </div>

        {/* Ranking Cards Grid */}
        {accLeaderboard.length === 0 ? (
          <p className="text-xs text-slate-500 text-center py-4">Belum ada data recruiter untuk periode ini.</p>
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {paginatedLeaderboard.map((item, index) => {
                const totalACC = leaderboardScope === 'period' ? item.periodACC : item.allTimeACC;
                const breakdown = leaderboardScope === 'period' ? item.periodACCBreakdown : item.allTimeBreakdown;
                const rank = (currentLeaderboardPage - 1) * ITEMS_PER_PAGE + index + 1;
                const isCurrentUser = userProfile?.telegramId && item.user.telegramId === userProfile.telegramId;

                // Rank styling
                const isGold = rank === 1;
                const isSilver = rank === 2;
                const isBronze = rank === 3;

                return (
                  <motion.div
                    key={item.user.telegramId}
                    whileHover={{ scale: 1.01 }}
                    className={`p-3.5 rounded-2xl border transition-all flex flex-col justify-between space-y-2.5 relative overflow-hidden ${
                      isCurrentUser
                        ? 'ring-2 ring-emerald-500 border-emerald-500/50 bg-emerald-500/10 dark:bg-emerald-950/20'
                        : isGold
                        ? 'bg-gradient-to-br from-amber-500/10 via-amber-500/5 to-slate-950/80 border-amber-500/40 shadow-md shadow-amber-500/10'
                        : isSilver
                        ? 'bg-gradient-to-br from-slate-300/10 via-slate-400/5 to-slate-950/80 border-slate-400/40'
                        : isBronze
                        ? 'bg-gradient-to-br from-amber-700/10 via-amber-800/5 to-slate-950/80 border-amber-700/40'
                        : 'bg-white/80 dark:bg-slate-950/60 border-slate-200 dark:border-slate-800'
                    }`}
                  >
                    {/* Badge rank */}
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="relative shrink-0">
                          {item.user.photoUrl ? (
                            <img
                              src={item.user.photoUrl}
                              alt={item.user.firstName}
                              referrerPolicy="no-referrer"
                              className="w-9 h-9 rounded-xl object-cover border border-slate-200 dark:border-slate-800"
                            />
                          ) : (
                            <div className="w-9 h-9 rounded-xl bg-slate-200 dark:bg-slate-800 flex items-center justify-center text-slate-900 dark:text-white font-black text-xs">
                              {item.user.firstName?.slice(0, 2) || 'R'}
                            </div>
                          )}
                          {isGold && (
                            <div className="absolute -top-1.5 -right-1.5 bg-amber-400 text-slate-950 p-0.5 rounded-full shadow-sm">
                              <Crown className="w-3 h-3" />
                            </div>
                          )}
                        </div>
                        <div className="truncate">
                          <p className="text-xs font-black text-slate-900 dark:text-white leading-tight flex items-center gap-1 truncate">
                            <span className="truncate">{item.user.firstName} {item.user.lastName}</span>
                            {isCurrentUser && (
                              <span className="text-[8px] bg-emerald-500 text-white font-black uppercase px-1.5 py-0.2 rounded shrink-0">
                                Anda
                              </span>
                            )}
                          </p>
                          <p className="text-[9.5px] text-slate-500 font-mono truncate">@{item.user.username || '-'} • UID: {item.user.akun9Kucing || '-'}</p>
                        </div>
                      </div>

                      {/* Rank tag */}
                      <div className="text-right shrink-0">
                        <span className={`text-[10px] font-black px-2 py-0.5 rounded-lg inline-flex items-center gap-1 ${
                          isGold ? 'bg-amber-400 text-slate-950' :
                          isSilver ? 'bg-slate-300 text-slate-900' :
                          isBronze ? 'bg-amber-700 text-white' :
                          'bg-slate-100 dark:bg-slate-900 text-slate-600 dark:text-slate-400'
                        }`}>
                          {isGold && <Crown className="w-3 h-3" />}
                          {isSilver && <Award className="w-3 h-3" />}
                          {isBronze && <Medal className="w-3 h-3" />}
                          #{rank}
                        </span>
                      </div>
                    </div>

                    {/* ACC Counts & Breakdown */}
                    <div className="p-2.5 rounded-xl bg-slate-100/70 dark:bg-slate-900/60 border border-slate-200/50 dark:border-slate-800/50 flex items-center justify-between">
                      <div>
                        <span className="text-[9px] font-extrabold uppercase text-slate-500 block">Total Terbanyak ACC</span>
                        <span className="text-base font-black text-emerald-600 dark:text-emerald-400">
                          {totalACC} <span className="text-[10px] font-bold">ACC Verified</span>
                        </span>
                      </div>
                      <div className="text-right text-[9.5px] font-mono font-bold text-slate-600 dark:text-slate-300 space-x-1">
                        <span className="bg-sky-500/10 text-sky-600 dark:text-sky-400 px-1.5 py-0.5 rounded">T0: {breakdown.t0}</span>
                        <span className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 px-1.5 py-0.5 rounded">V0: {breakdown.v0}</span>
                        <span className="bg-purple-500/10 text-purple-600 dark:text-purple-400 px-1.5 py-0.5 rounded">T3: {breakdown.t3}</span>
                      </div>
                    </div>

                    {/* Total Gaji & Action */}
                    <div className="flex items-center justify-between pt-1">
                      <div>
                        <span className="text-[9px] font-extrabold uppercase text-slate-500 block">Total Gaji</span>
                        <span className="text-xs font-black text-emerald-600 dark:text-emerald-400 font-mono">
                          {item.salarySlip ? formatRupiah(item.salarySlip.totalGaji) : 'Belum Input Gaji'}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleOpenSalaryModal(item.user, item.salarySlip, !isAdminOrOwner)}
                        className="text-[9.5px] font-black text-emerald-600 dark:text-emerald-400 hover:underline flex items-center gap-0.5 cursor-pointer"
                      >
                        Detail Slip <ChevronRight className="w-3 h-3" />
                      </button>
                    </div>
                  </motion.div>
                );
              })}
            </div>

            {/* Pagination Controls */}
            {accLeaderboard.length > 0 && (
              <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-3 border-t border-slate-200/60 dark:border-slate-800/80">
                <p className="text-[11px] font-bold text-slate-500">
                  Menampilkan <span className="font-black text-slate-900 dark:text-white">{(currentLeaderboardPage - 1) * ITEMS_PER_PAGE + 1}</span> - <span className="font-black text-slate-900 dark:text-white">{Math.min(currentLeaderboardPage * ITEMS_PER_PAGE, accLeaderboard.length)}</span> dari <span className="font-black text-emerald-500">{accLeaderboard.length}</span> Anggota
                </p>

                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    disabled={currentLeaderboardPage <= 1}
                    onClick={() => {
                      setLeaderboardPage(p => Math.max(p - 1, 1));
                      triggerHaptic('selection');
                    }}
                    className="px-3 py-1.5 rounded-xl text-xs font-black bg-slate-100 hover:bg-slate-200 dark:bg-slate-900 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 disabled:opacity-40 disabled:cursor-not-allowed transition-all flex items-center gap-1 cursor-pointer"
                  >
                    <ChevronLeft className="w-4 h-4" /> Prev
                  </button>

                  <div className="flex items-center gap-1 px-1 overflow-x-auto max-w-[200px] sm:max-w-none">
                    {Array.from({ length: totalLeaderboardPages }, (_, i) => i + 1).map((p) => (
                      <button
                        key={p}
                        type="button"
                        onClick={() => {
                          setLeaderboardPage(p);
                          triggerHaptic('selection');
                        }}
                        className={`w-7 h-7 shrink-0 rounded-lg text-xs font-black transition-all cursor-pointer ${
                          p === currentLeaderboardPage
                            ? 'bg-emerald-500 text-white shadow-sm'
                            : 'bg-slate-100 dark:bg-slate-900 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800'
                        }`}
                      >
                        {p}
                      </button>
                    ))}
                  </div>

                  <button
                    type="button"
                    disabled={currentLeaderboardPage >= totalLeaderboardPages}
                    onClick={() => {
                      setLeaderboardPage(p => Math.min(p + 1, totalLeaderboardPages));
                      triggerHaptic('selection');
                    }}
                    className="px-3 py-1.5 rounded-xl text-xs font-black bg-slate-100 hover:bg-slate-200 dark:bg-slate-900 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 disabled:opacity-40 disabled:cursor-not-allowed transition-all flex items-center gap-1 cursor-pointer"
                  >
                    Next <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </GlassCard>





      {/* DETAILED DIALOG/MODAL FOR FORM & PRINT PREVIEW */}
      {createPortal(
        <AnimatePresence>
          {isModalOpen && (
            <div 
              className="fixed inset-0 z-[100] bg-slate-950/85 backdrop-blur-md flex flex-col items-center justify-start sm:justify-center pt-[calc(var(--tg-safe-area-inset-top,env(safe-area-inset-top,0px))+28px)] pb-[calc(var(--tg-safe-area-inset-bottom,env(safe-area-inset-bottom,0px))+20px)] px-3 sm:px-4 overflow-y-auto"
              onClick={() => setIsModalOpen(false)}
            >
              <motion.div
                initial={{ opacity: 0, y: 20, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 20, scale: 0.98 }}
                transition={{ type: 'spring', damping: 28, stiffness: 300 }}
                onClick={(e) => e.stopPropagation()}
                className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800/80 rounded-2xl sm:rounded-3xl w-full max-w-2xl max-h-[calc(100vh-var(--tg-safe-area-inset-top,env(safe-area-inset-top,0px))-60px)] sm:max-h-[85vh] flex flex-col overflow-hidden shadow-2xl relative my-auto"
              >
                {/* Header */}
                <div className="p-4 sm:p-5 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center bg-slate-50 dark:bg-slate-950 shrink-0 sticky top-0 z-30 shadow-xs">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-500 shrink-0">
                    <Coins className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm sm:text-base font-black tracking-tight text-slate-900 dark:text-white">
                        {viewOnly ? 'Detail Slip Gaji Resmi' : formData.createdAt ? 'Edit Slip Gaji' : 'Input Slip Gaji Baru'}
                      </h3>
                      {selectedRecruiter && (
                        <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-[10px] font-black uppercase tracking-wider border border-emerald-500/20">
                          {[selectedRecruiter.firstName, selectedRecruiter.lastName].filter(Boolean).join(' ') || selectedRecruiter.username || 'Recruiter'}
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] font-bold text-slate-500 dark:text-slate-400 mt-0.5">
                      Periode: {getWIBWeekRange(formData.periode || '').formattedRange}
                    </p>
                  </div>
                </div>
                <button 
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  aria-label="Tutup"
                  className="p-2.5 hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-500 dark:text-slate-400 rounded-xl cursor-pointer transition-colors active:scale-95 touch-manipulation"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Loader during auto-calculations */}
              {isCalculating ? (
                <div className="py-20 flex-1 flex flex-col items-center justify-center space-y-4">
                  <RefreshCw className="w-10 h-10 text-emerald-500 animate-spin" />
                  <div className="text-center px-4">
                    <p className="text-xs font-black text-slate-800 dark:text-slate-200">Menghitung Data Finansial...</p>
                    <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-1 max-w-xs mx-auto">
                      Mengakumulasikan postingan harian, denda keterlambatan, dan target konversi...
                    </p>
                  </div>
                </div>
              ) : (
                <div className="p-4 sm:p-6 flex-1 overflow-y-auto space-y-5 sm:space-y-6 touch-auto">
                  
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
                                <p className="text-[9px] text-slate-500 font-mono">@{formData.username || '-'} • UID 9Kucing: {formData.akun9Kucing || selectedRecruiter?.akun9Kucing || '-'}</p>
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
                              <span className="text-[8.5px] text-slate-500 dark:text-slate-400 block font-medium">Tingkat Terima</span>
                              <span className="text-xs font-black text-sky-500">{formData.tingkatPenerimaan || 0}</span>
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
                            Username: @{formData.username || '-'} • UID 9Kucing: {formData.akun9Kucing || selectedRecruiter?.akun9Kucing || '-'}
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
                                * Diambil otomatis dari total data rekrutan (Grup T0 & T3) di Data Minggu Lalu pada menu Data Harian.
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
                                * Diambil otomatis dari total data rekrutan (Grup T0) berstatus ACC di Data Minggu Lalu pada menu Data Harian.
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
                                * Diambil otomatis dari total data rekrutan (Grup V0) di Data Minggu Lalu pada menu Data Harian.
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
                                * Diambil otomatis dari total data rekrutan (Grup V0) berstatus ACC di Data Minggu Lalu pada menu Data Harian.
                              </p>
                            </div>
                          </div>

                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <label className="block text-[9px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">PROMOTED</label>
                              <input
                                type="number"
                                value={formData.t3 || 0}
                                disabled={viewOnly || !isAdminOrOwner}
                                onChange={(e) => recalculateTotal({ t3: Math.max(0, Number(e.target.value)) })}
                                className={
                                  viewOnly || !isAdminOrOwner
                                    ? "w-full bg-slate-100 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-xs font-black text-slate-500 dark:text-slate-400 cursor-not-allowed"
                                    : "w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-xs font-black text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                                }
                              />
                              <p className="text-[8px] font-bold text-amber-600 dark:text-amber-400 mt-1">
                                * Diinput manual oleh Admin / Owner pada halaman Gaji.
                              </p>
                            </div>

                            <div>
                              <label className="block text-[9px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">LEVEL GAJI</label>
                              <input
                                type="text"
                                value={formData.levelGaji || 'Level 1'}
                                disabled={true}
                                className="w-full bg-slate-100 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-xs font-black text-slate-500 dark:text-slate-400 cursor-not-allowed"
                              />
                              <p className="text-[8px] font-bold text-amber-600 dark:text-amber-400 mt-1">
                                * Ditentukan otomatis berdasarkan jumlah keanggotaan dipromosikan (Promoted & Sebenarnya V0).
                              </p>
                            </div>
                          </div>

                          <div className="grid grid-cols-2 gap-4 pt-2 border-t border-slate-100 dark:border-slate-800/80">
                            <div>
                              <label className="block text-[9px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">Tingkat Terima</label>
                              <div className="relative">
                                <input
                                  type="number"
                                  step="0.1"
                                  value={formData.tingkatPenerimaan || 0}
                                  disabled
                                  className="w-full bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-xs font-black text-slate-700 dark:text-slate-300"
                                />
                              </div>
                              <p className="text-[8px] font-bold text-amber-600 dark:text-amber-400 mt-1">
                                * Rata-rata harian dari total Promoted & V0 Verified.
                              </p>
                            </div>
                             <div>
                              <label className="block text-[9px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">Rasio Up (%)</label>
                              <div className="relative">
                                <input
                                  type="number"
                                  value={formData.rasioPeningkatan || 0}
                                  disabled
                                  className="w-full bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-800 rounded-xl pl-3 pr-7 py-2 text-xs font-black text-slate-700 dark:text-slate-300 cursor-not-allowed"
                                />
                                <Percent className="w-3 h-3 absolute right-2 top-1/2 -translate-y-1/2 text-slate-400" />
                              </div>
                              <p className="text-[8px] font-bold text-amber-600 dark:text-amber-400 mt-1">
                                * Persentase perbandingan hasil promosi & verifikasi.
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
              <div className="p-4 sm:p-5 border-t border-slate-150 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/40 flex flex-col-reverse sm:flex-row justify-between gap-2.5 sm:gap-3 shrink-0 sticky bottom-0 z-20">
                {/* Print button on view-only */}
                {viewOnly ? (
                  <>
                    <button
                      type="button"
                      onClick={printSlip}
                      className="w-full sm:w-auto px-5 py-2.5 bg-slate-900 hover:bg-slate-800 dark:bg-white dark:hover:bg-slate-100 text-white dark:text-slate-950 rounded-2xl text-xs font-black flex items-center justify-center gap-2 cursor-pointer transition-colors shadow-sm active:scale-95 touch-manipulation"
                    >
                      <Printer className="w-4 h-4" /> Cetak / Unduh Slip Gaji
                    </button>

                    <button
                      type="button"
                      onClick={() => setIsModalOpen(false)}
                      className="w-full sm:w-auto px-5 py-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-2xl text-xs font-black transition-colors cursor-pointer active:scale-95 touch-manipulation"
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
                      className="w-full sm:w-auto px-4 py-2.5 bg-sky-500/10 hover:bg-sky-500/20 text-sky-600 dark:text-sky-400 rounded-2xl text-xs font-black border border-sky-500/25 flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-60 transition-colors active:scale-95 touch-manipulation"
                    >
                      <RefreshCw className="w-3.5 h-3.5" /> Ambil Data Auto
                    </button>

                    <div className="flex gap-2 w-full sm:w-auto">
                      <button
                        type="button"
                        onClick={() => setIsModalOpen(false)}
                        className="flex-1 sm:flex-none px-4 py-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-2xl text-xs font-bold transition-colors cursor-pointer active:scale-95 touch-manipulation"
                      >
                        Batal
                      </button>

                      <button
                        type="button"
                        onClick={handleSaveSalary}
                        disabled={isSaving || isCalculating}
                        className="flex-1 sm:flex-none px-5 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-white rounded-2xl text-xs font-black transition-colors flex items-center justify-center gap-1.5 shadow-md shadow-emerald-500/25 cursor-pointer disabled:opacity-60 active:scale-95 touch-manipulation"
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
        </AnimatePresence>,
        document.body
      )}
    </div>
  );
};
