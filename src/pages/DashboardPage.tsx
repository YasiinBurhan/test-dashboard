import React, { useEffect, useState, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { GlassCard } from '../components/common/GlassCard';
import { StatusBadge } from '../components/common/StatusBadge';
import { TabType } from '../components/navigation/BottomNav';
import { useAuth } from '../hooks/useAuth';
import { useReports } from '../hooks/useReports';
import { formatUsername, formatWIBDate, formatWIBDateTime, formatDateDisplay, getWIBMonday, getWIBMondayOfDate, getWIBWeekRange } from '../utils/format';
import { Announcement, UserProfile, DailyReport, BatchPost } from '../types';
import { subscribeToAnnouncements } from '../firebase/services/announcementService';
import { subscribeToSystemSettings } from '../firebase/services/settingService';
import { subscribeToAllUsers } from '../firebase/services/userService';
import { subscribeToAllReports } from '../firebase/services/reportService';
import { subscribeToAllPosts, subscribeToRecruiterPosts } from '../firebase/services/postService';
import { 
  BarChart2, 
  Megaphone, 
  Sparkles, 
  TrendingUp,
  Trophy,
  Medal,
  Award,
  Loader2,
  Clock,
  Timer,
  RotateCcw,
  Calendar,
  Share2,
  CheckCircle2,
  Zap,
  CalendarCheck,
  AlertTriangle,
  Activity,
  FileText,
  UserCheck,
  Crown,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Check,
  Users
} from 'lucide-react';

interface DashboardPageProps {
  setActiveTab: (tab: TabType) => void;
}

export const DashboardPage: React.FC<DashboardPageProps> = ({ setActiveTab }) => {
  const { userProfile, telegramUser } = useAuth();
  const { reports: myReports } = useReports();
  const isAdminOrOwner = userProfile?.role === 'Admin' || userProfile?.role === 'Owner';
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [currentAnnIndex, setCurrentAnnIndex] = useState<number>(0);
  const [announcementHeader, setAnnouncementHeader] = useState<string>('');

  const sortedAnnouncements = useMemo(() => {
    return [...announcements].sort((a, b) => {
      const aPinned = a.pinned ? 1 : 0;
      const bPinned = b.pinned ? 1 : 0;
      if (aPinned !== bPinned) return bPinned - aPinned;
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
  }, [announcements]);

  useEffect(() => {
    if (currentAnnIndex >= sortedAnnouncements.length && sortedAnnouncements.length > 0) {
      setCurrentAnnIndex(0);
    }
  }, [sortedAnnouncements, currentAnnIndex]);
  const [allUsers, setAllUsers] = useState<UserProfile[]>([]);
  const [isLoadingUsers, setIsLoadingUsers] = useState(true);
  const [allReports, setAllReports] = useState<DailyReport[]>([]);
  const [isLoadingReports, setIsLoadingReports] = useState(true);
  const [allPosts, setAllPosts] = useState<BatchPost[]>([]);
  const [isLoadingPosts, setIsLoadingPosts] = useState(true);
  const [selectedWeekOffset, setSelectedWeekOffset] = useState<number>(0); // 0 = Minggu Ini, -7 = Minggu Lalu
  const [selectedRecruiterFilter, setSelectedRecruiterFilter] = useState<string>(''); // For filtering in Dashboard
  const [isRecruiterFilterDropdownOpen, setIsRecruiterFilterDropdownOpen] = useState(false);
  const [timeLeft, setTimeLeft] = useState<string>('');
  const [activityPage, setActivityPage] = useState<number>(1);
  const recruiterFilterDropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (recruiterFilterDropdownRef.current && !recruiterFilterDropdownRef.current.contains(event.target as Node)) {
        setIsRecruiterFilterDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    let unsubPosts: (() => void) | undefined;
    
    if (isAdminOrOwner) {
      unsubPosts = subscribeToAllPosts((posts) => {
        setAllPosts(posts || []);
        setIsLoadingPosts(false);
      });
    } else if (telegramUser?.id) {
      unsubPosts = subscribeToRecruiterPosts(String(telegramUser.id), (posts) => {
        setAllPosts(posts || []);
        setIsLoadingPosts(false);
      });
    } else {
      setIsLoadingPosts(false);
    }

    return () => {
      if (unsubPosts) unsubPosts();
    };
  }, [isAdminOrOwner, telegramUser?.id]);

  useEffect(() => {
    const calculateTimeLeft = () => {
      const now = new Date();
      // Reset is Monday at 10:00 AM WIB (UTC+7 -> 03:00 UTC)
      const target = new Date();
      const currentDay = target.getUTCDay(); // 0 is Sunday, 1 is Monday...
      
      let daysToAdd = (1 - currentDay + 7) % 7;
      
      // If it is Monday and past 10:00 WIB, we target the next Monday
      const isMondayAndPast10WIB = currentDay === 1 && (
        target.getUTCHours() > 3 || (target.getUTCHours() === 3 && target.getUTCMinutes() >= 0)
      );
      
      if (isMondayAndPast10WIB || (daysToAdd === 0 && currentDay !== 1)) {
        daysToAdd += 7;
      }
      
      target.setUTCDate(target.getUTCDate() + daysToAdd);
      target.setUTCHours(3, 0, 0, 0);

      const diff = target.getTime() - now.getTime();
      if (diff <= 0) return 'Proses Reset...';
      
      const days = Math.floor(diff / (1000 * 60 * 60 * 24));
      const hours = Math.floor((diff / (1000 * 60 * 60)) % 24);
      const minutes = Math.floor((diff / (1000 * 60)) % 60);
      const seconds = Math.floor((diff / 1000) % 60);
      
      let str = '';
      if (days > 0) str += `${days}h `;
      
      const pad = (n: number) => String(n).padStart(2, '0');
      str += `${pad(hours)}j ${pad(minutes)}m ${pad(seconds)}d`;
      return str;
    };

    setTimeLeft(calculateTimeLeft());
    const timer = setInterval(() => {
      setTimeLeft(calculateTimeLeft());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const greeting = useMemo(() => {
    const now = new Date();
    const jakartaTime = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Jakarta' }));
    const hour = jakartaTime.getHours();
    if (hour >= 5 && hour < 11) return 'Selamat Pagi 🌅';
    if (hour >= 11 && hour < 15) return 'Selamat Siang ☀️';
    if (hour >= 15 && hour < 18) return 'Selamat Sore 🌇';
    return 'Selamat Malam 🌌';
  }, []);

  useEffect(() => {
    const unsubAnn = subscribeToAnnouncements((anns) => {
      setAnnouncements(anns || []);
    });

    const unsubSettings = subscribeToSystemSettings((sysSettings) => {
      if (sysSettings?.announcementHeader) {
        setAnnouncementHeader(sysSettings.announcementHeader);
      }
    });

    const unsubUsers = subscribeToAllUsers((users) => {
      setAllUsers(users);
      setIsLoadingUsers(false);
    });

    const unsubReports = subscribeToAllReports((reps) => {
      setAllReports(reps || []);
      setIsLoadingReports(false);
    });

    return () => {
      unsubAnn();
      unsubSettings();
      unsubUsers();
      unsubReports();
    };
  }, []);

  // Weekly Date Range (Resets Monday 10:00 AM WIB)
  const targetMondayStr = useMemo(() => getWIBMonday(selectedWeekOffset), [selectedWeekOffset]);
  const weekRangeInfo = useMemo(() => getWIBWeekRange(targetMondayStr), [targetMondayStr]);

  // Calculate stats - use allReports for Admin/Owner, myReports for Recruiter
  const reportsToUse = useMemo(() => {
    if (isAdminOrOwner) {
      if (selectedRecruiterFilter) {
        const selectedUser = allUsers.find(u => String(u.telegramId) === selectedRecruiterFilter);
        return allReports.filter(r => {
          const matchId = r.telegramId && String(r.telegramId) === selectedRecruiterFilter;
          if (matchId) return true;
          if (selectedUser && selectedUser.username) {
            const reportUname = (r.recruiterUsername || r.username || '').replace(/@/g, '').trim().toLowerCase();
            const selectedUname = selectedUser.username.replace(/@/g, '').trim().toLowerCase();
            if (reportUname && selectedUname && reportUname === selectedUname) return true;
          }
          return false;
        });
      }
      return allReports;
    }
    return myReports;
  }, [isAdminOrOwner, allReports, myReports, selectedRecruiterFilter, allUsers]);

  // Filter reports specifically for the selected week (Resets every Monday 10:00 AM WIB)
  const selectedWeekReports = useMemo(() => {
    return reportsToUse.filter(r => {
      const reportDate = r.date || (r.createdAt ? r.createdAt.split('T')[0] : '');
      if (!reportDate) return false;
      return getWIBMondayOfDate(reportDate) === targetMondayStr;
    });
  }, [reportsToUse, targetMondayStr]);

  // Approved reports submitted in the selected week (Halaman Laporan)
  const approvedReports = useMemo(() => {
    return selectedWeekReports.filter(curr => curr.result !== 'REJECT');
  }, [selectedWeekReports]);

  // 1. Metrics sourced from Halaman Laporan (Daily Reports)
  const totalVisits = useMemo(() => {
    return selectedWeekReports.reduce((acc, curr) => acc + (Number(curr.visit) || 0), 0);
  }, [selectedWeekReports]);

  const { totalApplicants, totalQuality } = useMemo(() => {
    let appCount = 0;
    let qualCount = 0;
    
    const detailedGroups = new Set<string>();
    selectedWeekReports.forEach(r => {
      const isDetailed = !!(r.applicantWhatsapp || r.uid9Kucing || r.applicantTelegramUsername);
      if (isDetailed) {
        const rDate = r.date || (r.createdAt ? r.createdAt.split('T')[0] : '');
        const userKey = r.telegramId ? String(r.telegramId) : (r.recruiterUsername || r.username || 'user');
        detailedGroups.add(`${userKey}_${rDate}`);
      }
    });

    selectedWeekReports.forEach(r => {
      const isDetailed = !!(r.applicantWhatsapp || r.uid9Kucing || r.applicantTelegramUsername);
      const rDate = r.date || (r.createdAt ? r.createdAt.split('T')[0] : '');
      const userKey = r.telegramId ? String(r.telegramId) : (r.recruiterUsername || r.username || 'user');
      const groupKey = `${userKey}_${rDate}`;

      if (isDetailed) {
        appCount += 1;
        if (r.result === 'ACC' && (r.grup === 'T0' || r.grup === 'T3' || r.grup === 'V0')) qualCount += 1;
      } else {
        if (!detailedGroups.has(groupKey)) {
          appCount += (Number(r.applicant) || 0);
          qualCount += (Number(r.quality) || 0);
        }
      }
    });

    return { totalApplicants: appCount, totalQuality: qualCount };
  }, [selectedWeekReports]);

  const postsToUse = useMemo(() => {
    if (isAdminOrOwner) {
      if (selectedRecruiterFilter) {
        const selectedUser = allUsers.find(u => String(u.telegramId) === selectedRecruiterFilter);
        return allPosts.filter(p => {
          const matchId = p.telegramId && String(p.telegramId) === selectedRecruiterFilter;
          if (matchId) return true;
          if (selectedUser && selectedUser.username) {
            const postUname = (p.username || '').replace(/@/g, '').trim().toLowerCase();
            const selectedUname = selectedUser.username.replace(/@/g, '').trim().toLowerCase();
            if (postUname && selectedUname && postUname === selectedUname) return true;
          }
          return false;
        });
      }
      return allPosts;
    }
    const myTgId = userProfile?.telegramId || (telegramUser?.id ? String(telegramUser.id) : '');
    return allPosts.filter(p => String(p.telegramId) === myTgId);
  }, [isAdminOrOwner, allPosts, userProfile, telegramUser, selectedRecruiterFilter, allUsers]);

  const totalPostings = useMemo(() => {
    const selectedWeekPosts = postsToUse.filter(p => {
      const pDate = p.date || (p.createdAt ? p.createdAt.split('T')[0] : '');
      if (!pDate) return false;
      return getWIBMondayOfDate(pDate) === targetMondayStr;
    });
    const postsFromCollection = selectedWeekPosts.reduce((acc, curr) => acc + (Array.isArray(curr.links) ? curr.links.length : 0), 0);
    const manualPostingsFromReports = selectedWeekReports.reduce((acc, curr) => acc + (Number(curr.posting) || 0), 0);
    return Math.max(postsFromCollection, manualPostingsFromReports);
  }, [postsToUse, selectedWeekReports, targetMondayStr]);

  // 2. Metrics sourced from Halaman Data Harian (ACC T0 & ACC V0)
  // An entry in Data Harian is ACC if r.result === 'ACC' in the selected week
  const totalAccT0 = useMemo(() => {
    return reportsToUse.filter(r => {
      if (r.result !== 'ACC') return false;
      if (r.grup !== 'T0' && r.grup !== 'T3') return false;
      const reportDate = r.date || (r.createdAt ? r.createdAt.split('T')[0] : '');
      const updateDate = r.updatedAt ? r.updatedAt.split('T')[0] : '';
      const isDateInWeek = reportDate && getWIBMondayOfDate(reportDate) === targetMondayStr;
      const isUpdateInWeek = updateDate && getWIBMondayOfDate(updateDate) === targetMondayStr;
      return isDateInWeek || isUpdateInWeek;
    }).reduce((acc, curr) => acc + (Number(curr.applicant) || 1), 0);
  }, [reportsToUse, targetMondayStr]);

  const totalAccV0 = useMemo(() => {
    return reportsToUse.filter(r => {
      if (r.result !== 'ACC') return false;
      if (r.grup !== 'V0') return false;
      const reportDate = r.date || (r.createdAt ? r.createdAt.split('T')[0] : '');
      const updateDate = r.updatedAt ? r.updatedAt.split('T')[0] : '';
      const isDateInWeek = reportDate && getWIBMondayOfDate(reportDate) === targetMondayStr;
      const isUpdateInWeek = updateDate && getWIBMondayOfDate(updateDate) === targetMondayStr;
      return isDateInWeek || isUpdateInWeek;
    }).reduce((acc, curr) => acc + (Number(curr.applicant) || 1), 0);
  }, [reportsToUse, targetMondayStr]);

  // Calculation of effective days this week
  const totalEffectiveDays = useMemo(() => {
    // Aggregate data per day
    const dailyStats: Record<string, { applicants: number }> = {};
    const effectiveDates = new Set<string>();

    selectedWeekReports.forEach(r => {
      const rDate = r.date || (r.createdAt ? r.createdAt.split('T')[0] : '');
      if (!rDate) return;
      
      if (!dailyStats[rDate]) {
        dailyStats[rDate] = { applicants: 0 };
      }
      
      const isDetailed = !!(r.applicantWhatsapp || r.uid9Kucing || r.applicantTelegramUsername);
      if (isDetailed) {
        dailyStats[rDate].applicants += 1;
      } else {
        // Summary
        dailyStats[rDate].applicants = Math.max(dailyStats[rDate].applicants, Number(r.applicant) || 0);
      }
    });

    Object.keys(dailyStats).forEach(date => {
      const applicants = dailyStats[date].applicants;
      
      let requiredPosting = 90;
      if (applicants >= 3) requiredPosting = 0;
      else if (applicants === 2) requiredPosting = 30;
      else if (applicants === 1) requiredPosting = 60;
      
      const postsOnDate = postsToUse.filter(p => {
        const pDate = p.date || (p.createdAt ? p.createdAt.split('T')[0] : '');
        return pDate === date;
      });
      const postCount = postsOnDate.reduce((sum, p) => sum + (Array.isArray(p.links) ? p.links.length : 0), 0);
      
      if (applicants >= 3 || postCount >= requiredPosting) {
        effectiveDates.add(date);
      }
    });
    
    // Also check posts collection for days with 0 applicants but 90+ posts
    postsToUse.forEach(p => {
      const pDate = p.date || (p.createdAt ? p.createdAt.split('T')[0] : '');
      if (!pDate) return;
      const postMonday = getWIBMondayOfDate(pDate);
      if (postMonday !== targetMondayStr) return;
      
      const postsOnDate = postsToUse.filter(ap => {
        const apDate = ap.date || (ap.createdAt ? ap.createdAt.split('T')[0] : '');
        return apDate === pDate;
      });
      const postCount = postsOnDate.reduce((sum, ap) => sum + (Array.isArray(ap.links) ? ap.links.length : 0), 0);
      
      if (postCount >= 90) {
        effectiveDates.add(pDate);
      }
    });

    return effectiveDates.size;
  }, [selectedWeekReports, postsToUse, targetMondayStr]);

  const totalFines = useMemo(() => {
    return selectedWeekReports.reduce((sum, r) => sum + (r.fine !== undefined ? r.fine : (r.isLate ? 5000 : 0)), 0);
  }, [selectedWeekReports]);

  // Weekly Leaderboard logic
  const { topRecruiters, topChannelOverall } = useMemo(() => {
    const stats: Record<string, { 
      telegramId: string;
      name: string; 
      username: string; 
      points: number; 
      count: number;
      applicantCount: number;
      qualityCount: number;
      visitCount: number;
      accT0Count: number;
      accV0Count: number;
      effectiveDaysCount: number;
      effectiveDates: Set<string>;
      fineTotal: number;
      photo: string;
      channels: Record<string, number>;
    }> = {};

    const overallChannels: Record<string, number> = {};

    // Seed stats with recruiter users (excluding Admin and Owner)
    allUsers.forEach((u) => {
      if (u.status !== 'Active') return;
      if (u.role === 'Admin' || u.role === 'Owner') return;
      const key = u.telegramId ? String(u.telegramId) : (u.username ? u.username.replace('@', '').toLowerCase() : '');
      if (!key) return;
      const fullName = u.lastName ? `${u.firstName} ${u.lastName}`.trim() : (u.firstName || u.username || 'User');
      stats[key] = {
        telegramId: String(u.telegramId || ''),
        name: fullName,
        username: u.username ? formatUsername(u.username) : '',
        points: 0,
        count: 0,
        applicantCount: 0,
        qualityCount: 0,
        visitCount: 0,
        accT0Count: 0,
        accV0Count: 0,
        effectiveDaysCount: 0,
        effectiveDates: new Set<string>(),
        fineTotal: 0,
        photo: u.photoUrl || '',
        channels: {}
      };
    });

    if (allReports.length || allPosts.length) {
      const dailyStats: Record<string, Record<string, {
        applicants: number;
        quality: number;
        visits: number;
        accT0: number;
        accV0: number;
        fines: number;
        channels: Record<string, number>;
        isDetailed: boolean;
      }>> = {};

      allReports.forEach(r => {
        const reportDate = r.date || (r.createdAt ? r.createdAt.split('T')[0] : '');
        if (!reportDate) return;
        const reportMonday = getWIBMondayOfDate(reportDate);
        if (reportMonday !== targetMondayStr) return;

        const reportTgId = r.telegramId ? String(r.telegramId) : '';
        const reportCleanUname = (r.recruiterUsername || r.username || '').replace(/@/g, '').trim().toLowerCase();

        const matchedUser = allUsers.find(u => 
          (reportTgId && String(u.telegramId) === reportTgId) ||
          (reportCleanUname && u.username && u.username.replace(/@/g, '').trim().toLowerCase() === reportCleanUname)
        );

        if (matchedUser && (matchedUser.role === 'Admin' || matchedUser.role === 'Owner')) {
          return;
        }

        let key = reportTgId;
        if (matchedUser) {
          key = String(matchedUser.telegramId) || matchedUser.username.replace(/@/g, '').trim().toLowerCase();
        } else {
          key = reportTgId || reportCleanUname || 'Unknown';
        }
        
        if (!stats[key]) {
          stats[key] = {
            telegramId: reportTgId || (matchedUser ? String(matchedUser.telegramId) : ''),
            name: r.name || (matchedUser ? `${matchedUser.firstName} ${matchedUser.lastName || ''}`.trim() : 'Recruiter'),
            username: r.recruiterUsername || r.username || matchedUser?.username || '',
            points: 0, count: 0, applicantCount: 0, qualityCount: 0, visitCount: 0, accT0Count: 0, accV0Count: 0, effectiveDaysCount: 0,
            effectiveDates: new Set<string>(), fineTotal: 0, photo: matchedUser?.photoUrl || '', channels: {}
          };
        }

        if (!dailyStats[key]) dailyStats[key] = {};
        if (!dailyStats[key][reportDate]) {
          dailyStats[key][reportDate] = { applicants: 0, quality: 0, visits: 0, accT0: 0, accV0: 0, fines: 0, channels: {}, isDetailed: false };
        }

        const isDetailed = !!(r.applicantWhatsapp || r.uid9Kucing || r.applicantTelegramUsername);
        if (isDetailed) {
          dailyStats[key][reportDate].isDetailed = true;
          // Kirim Data (ALL results) count as applicants
          dailyStats[key][reportDate].applicants += 1;
          
          if (r.result === 'ACC') {
            let isT0orV0 = false;
            if (r.grup === 'T0' || r.grup === 'T3') {
              dailyStats[key][reportDate].accT0 += 1;
              dailyStats[key][reportDate].quality += 1;
              isT0orV0 = true;
            } else if (r.grup === 'V0') {
              dailyStats[key][reportDate].accV0 += 1;
              dailyStats[key][reportDate].quality += 1;
              isT0orV0 = true;
            }
            
            if (isT0orV0 && r.channel && r.channel.trim()) {
              const ch = r.channel.trim();
              dailyStats[key][reportDate].channels[ch] = (dailyStats[key][reportDate].channels[ch] || 0) + 1;
            }
          }
        } else {
          // Laporan Harian (Summary)
          // We only use summary numbers if detailed data wasn't provided for this day
          if (!dailyStats[key][reportDate].isDetailed) {
            dailyStats[key][reportDate].applicants = Math.max(dailyStats[key][reportDate].applicants, Number(r.applicant) || 0);
            dailyStats[key][reportDate].quality = Math.max(dailyStats[key][reportDate].quality, Number(r.quality) || 0);
          }
          // Add visits and fines from summary
          dailyStats[key][reportDate].visits += (Number(r.visit) || 0);
          const fineVal = r.fine !== undefined ? r.fine : (r.isLate ? 5000 : 0);
          dailyStats[key][reportDate].fines += fineVal;
        }
      });
      
      // Process daily aggregations
      Object.keys(dailyStats).forEach(key => {
        Object.keys(dailyStats[key]).forEach(date => {
          const ds = dailyStats[key][date];
          stats[key].count += 1;
          stats[key].applicantCount += ds.applicants;
          stats[key].qualityCount += (ds.accT0 + ds.accV0);
          stats[key].visitCount += ds.visits;
          stats[key].accT0Count += ds.accT0;
          stats[key].accV0Count += ds.accV0;
          stats[key].fineTotal += ds.fines;
          
          Object.keys(ds.channels).forEach(ch => {
            stats[key].channels[ch] = (stats[key].channels[ch] || 0) + ds.channels[ch];
            overallChannels[ch] = (overallChannels[ch] || 0) + ds.channels[ch];
          });
          
          stats[key].points += (ds.accT0 + ds.accV0);
          
          // Determine if effective day
          let requiredPosting = 90;
          if (ds.applicants >= 3) requiredPosting = 0;
          else if (ds.applicants === 2) requiredPosting = 30;
          else if (ds.applicants === 1) requiredPosting = 60;
          
          let postCount = 0;
          const userPostsOnDate = allPosts.filter(ap => {
            const apDate = ap.date || (ap.createdAt ? ap.createdAt.split('T')[0] : '');
            if (apDate !== date) return false;
            const apTgId = ap.telegramId ? String(ap.telegramId) : '';
            const apCleanUname = (ap.username || '').replace(/@/g, '').trim().toLowerCase();
            const s = stats[key];
            return (s.telegramId && apTgId === s.telegramId) || (s.username && apCleanUname === s.username.replace(/@/g, '').toLowerCase());
          });
          postCount = userPostsOnDate.reduce((sum, ap) => sum + (Array.isArray(ap.links) ? ap.links.length : 0), 0);
          
          if (ds.applicants >= 3 || postCount >= requiredPosting) {
            stats[key].effectiveDates.add(date);
          }
        });
      });

      // Process users who ONLY posted links (no reports)
      allPosts.forEach(p => {
        const postDate = p.date || (p.createdAt ? p.createdAt.split('T')[0] : '');
        if (!postDate) return;
        const postMonday = getWIBMondayOfDate(postDate);
        if (postMonday !== targetMondayStr) return;
        
        const postTgId = p.telegramId ? String(p.telegramId) : '';
        const postCleanUname = (p.username || '').replace(/@/g, '').trim().toLowerCase();
        const key = Object.keys(stats).find(k => {
          const s = stats[k];
          return (postTgId && s.telegramId === postTgId) || (postCleanUname && s.username && s.username.replace(/@/g, '').trim().toLowerCase() === postCleanUname);
        });
        
        if (key && stats[key]) {
          const userPostsOnDate = allPosts.filter(ap => {
            const apDate = ap.date || (ap.createdAt ? ap.createdAt.split('T')[0] : '');
            if (apDate !== postDate) return false;
            const apTgId = ap.telegramId ? String(ap.telegramId) : '';
            const apCleanUname = (ap.username || '').replace(/@/g, '').trim().toLowerCase();
            return (postTgId && apTgId === postTgId) || (postCleanUname && apCleanUname === postCleanUname);
          });
          const totalLinksOnDate = userPostsOnDate.reduce((sum, ap) => sum + (Array.isArray(ap.links) ? ap.links.length : 0), 0);
          if (totalLinksOnDate >= 90) {
            stats[key].effectiveDates.add(postDate);
          }
        }
      });
    }

    const filteredRecruiters = Object.values(stats)
      .filter(rec => {
        const u = allUsers.find(user => 
          (rec.telegramId && String(user.telegramId) === rec.telegramId) || 
          (user.username && rec.username && user.username.replace(/@/g, '').toLowerCase() === rec.username.replace(/@/g, '').toLowerCase())
        );
        if (u && (u.role === 'Admin' || u.role === 'Owner')) {
          return false;
        }
        // Jika belum ada data rekrutan (count === 0) dan belum ada postingan, belum masuk leaderboard
        return rec.count > 0 || rec.effectiveDates.size > 0;
      })
      .map(rec => {
        rec.effectiveDaysCount = rec.effectiveDates.size;
        const sortedCh = Object.entries(rec.channels).sort((a, b) => b[1] - a[1]);
        const topChannel = sortedCh.length > 0 ? { name: sortedCh[0][0], count: sortedCh[0][1] } : null;
        return {
          ...rec,
          topChannel
        };
      })
      .sort((a, b) => b.points - a.points);

    const sortedOverallCh = Object.entries(overallChannels).sort((a, b) => b[1] - a[1]);
    const topChannelOverall = sortedOverallCh.length > 0 ? { name: sortedOverallCh[0][0], count: sortedOverallCh[0][1] } : null;

    return {
      topRecruiters: filteredRecruiters.slice(0, 3),
      topChannelOverall
    };
  }, [allReports, allUsers, targetMondayStr]);

  const totalAllRecruitersCount = useMemo(() => {
    return allUsers.filter(u => u.role === 'Recruiter').length;
  }, [allUsers]);

  const podiumRecruiters = useMemo(() => {
    return topRecruiters.slice(0, 3);
  }, [topRecruiters]);

  const remainingRecruiters = useMemo(() => {
    return topRecruiters.slice(3);
  }, [topRecruiters]);

  // All Recent Activities across reports and posting links (Admin, Owner, Recruiter)
  const allRecentActivities = useMemo(() => {
    const reportList = (reportsToUse || []).map(r => {
      const isApplicant = !!(r.applicantWhatsapp || r.uid9Kucing || r.applicantTelegramUsername);
      return {
        id: r.id || `rep-${Math.random()}`,
        username: r.username || r.recruiterUsername || '',
        name: r.recruiterUsername || r.username || '',
        createdAt: r.createdAt || r.date || '',
        date: r.date || (r.createdAt ? r.createdAt.split('T')[0] : ''),
        activityType: (isApplicant ? 'pelamar' : 'laporan') as 'pelamar' | 'laporan' | 'posting',
        // Pelamar specific
        applicantWhatsapp: r.applicantWhatsapp,
        uid9Kucing: r.uid9Kucing,
        applicantTelegramUsername: r.applicantTelegramUsername,
        channel: r.channel,
        grup: r.grup,
        // Laporan specific
        posting: r.posting,
        visit: r.visit,
        applicant: r.applicant,
        quality: r.quality,
        result: r.result,
        linksCount: 0,
        platforms: [] as string[],
      };
    });

    const postList = (postsToUse || []).map(p => ({
      id: p.id || `post-${Math.random()}`,
      username: p.username || p.name || '',
      name: p.name || p.username || '',
      createdAt: p.createdAt || p.date || '',
      date: p.date || (p.createdAt ? p.createdAt.split('T')[0] : ''),
      activityType: 'posting' as const,
      applicantWhatsapp: undefined,
      uid9Kucing: undefined,
      applicantTelegramUsername: undefined,
      channel: undefined,
      grup: undefined,
      posting: undefined,
      visit: undefined,
      applicant: undefined,
      quality: undefined,
      result: undefined,
      linksCount: Array.isArray(p.links) ? p.links.length : 0,
      platforms: Array.isArray(p.platforms) ? Array.from(new Set(p.platforms.filter(Boolean))) : [],
    }));

    const combined = [...reportList, ...postList];

    return combined
      .sort((a, b) => {
        const timeA = new Date(a.createdAt || a.date).getTime();
        const timeB = new Date(b.createdAt || b.date).getTime();
        return timeB - timeA;
      });
  }, [reportsToUse, postsToUse]);

  const ACTIVITIES_PER_PAGE = 5;
  const totalActivityPages = Math.ceil(allRecentActivities.length / ACTIVITIES_PER_PAGE) || 1;

  const paginatedActivities = useMemo(() => {
    const validPage = Math.max(1, Math.min(activityPage, totalActivityPages));
    const start = (validPage - 1) * ACTIVITIES_PER_PAGE;
    return allRecentActivities.slice(start, start + ACTIVITIES_PER_PAGE);
  }, [allRecentActivities, activityPage, totalActivityPages]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="space-y-5 pb-24"
    >
      {/* Welcome User Banner */}
      <GlassCard className="relative overflow-hidden border border-slate-200/80 dark:border-slate-800/80 bg-gradient-to-b from-white/90 to-slate-50/90 dark:from-slate-900/80 dark:to-slate-950/90 p-5 shadow-lg">
        <div className="absolute top-0 right-0 w-56 h-56 bg-sky-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-10 -left-10 w-44 h-44 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="flex items-center gap-4 relative z-10">
          <div className="relative shrink-0">
            <div className="w-16 h-16 rounded-2xl p-0.5 bg-gradient-to-tr from-sky-400 to-indigo-500 shadow-lg flex items-center justify-center">
              {telegramUser?.photo_url ? (
                <img referrerPolicy="no-referrer"                   src={telegramUser.photo_url}
                  alt="Profile"
                  className="w-full h-full rounded-[14px] object-cover border border-slate-200 dark:border-slate-950"
                />
              ) : (
                <div className="w-full h-full rounded-[14px] bg-slate-200 dark:bg-slate-900 flex items-center justify-center text-slate-900 dark:text-white text-2xl font-black">
                  {(userProfile?.firstName?.[0] || telegramUser?.first_name?.[0] || 'A').toUpperCase()}
                </div>
              )}
            </div>
            <span className="absolute -bottom-1 -right-1 w-4 h-4 bg-emerald-500 rounded-full border-2 border-white dark:border-slate-950 shadow-md" />
          </div>

          <div className="flex flex-col overflow-hidden">
            <div className="flex items-center gap-1.5 text-[10px] font-black text-sky-600 dark:text-sky-400 uppercase tracking-widest">
              <Sparkles className="w-3.5 h-3.5 animate-pulse" /> {greeting}
            </div>
            <h2 className="text-lg font-black text-slate-900 dark:text-white truncate tracking-tight mt-0.5">
              {userProfile?.firstName} {userProfile?.lastName || ''}
            </h2>
            <div className="flex items-center gap-2 flex-wrap mt-1">
              <span className="text-[11px] text-slate-600 dark:text-slate-400 font-medium">
                {formatUsername(userProfile?.username || telegramUser?.username)}
              </span>
              <div className="w-1 h-1 rounded-full bg-slate-300 dark:bg-slate-800 shrink-0" />
              {userProfile?.role && <StatusBadge role={userProfile.role} size="sm" />}
              {userProfile?.status && <StatusBadge status={userProfile.status} size="sm" />}
            </div>
          </div>
        </div>
      </GlassCard>

      {/* System Announcement Banner */}
      {announcementHeader && (
        <div className="p-3.5 rounded-2xl bg-sky-500/10 dark:bg-sky-500/5 border border-sky-500/20 dark:border-sky-500/10 flex items-start gap-3 shadow-md">
          <div className="p-2 rounded-xl bg-sky-500/20 dark:bg-sky-500/15 text-sky-600 dark:text-sky-400 shrink-0 border border-sky-500/30 dark:border-sky-500/25">
            <Megaphone className="w-4 h-4 animate-pulse" />
          </div>
          <p className="text-xs text-slate-800 dark:text-slate-300 font-semibold leading-relaxed">
            {announcementHeader}
          </p>
        </div>
      )}

      {/* Real-time Announcements Widget */}
      {sortedAnnouncements.length > 0 && (
        <GlassCard className="relative border border-sky-200/60 dark:border-sky-950/60 bg-gradient-to-r from-sky-500/5 via-sky-500/[0.02] to-transparent p-5 shadow-lg overflow-hidden">
          {/* Decorative background blur */}
          <div className="absolute top-0 right-0 w-24 h-24 bg-sky-500/10 rounded-full blur-2xl pointer-events-none" />
          
          <div className="flex flex-col gap-3">
            {/* Header of widget */}
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800/60 pb-2.5">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-sky-500/10 text-sky-500 border border-sky-500/20">
                  <Megaphone className="w-4 h-4 animate-bounce" />
                </div>
                <div>
                  <h3 className="text-xs font-black text-slate-800 dark:text-slate-200 uppercase tracking-widest flex items-center gap-1.5">
                    <span>Pengumuman Rekrutmen</span>
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  </h3>
                  <span className="text-[10px] text-slate-500 dark:text-slate-400 font-medium">Instruksi & informasi manajemen terbaru</span>
                </div>
              </div>

              {/* Navigation Arrows for Carousel */}
              {sortedAnnouncements.length > 1 && (
                <div className="flex items-center gap-1.5 bg-slate-100 dark:bg-slate-900 px-2 py-1 rounded-xl border border-slate-200/60 dark:border-slate-800/80 shrink-0">
                  <button
                    onClick={() => setCurrentAnnIndex(prev => (prev - 1 + sortedAnnouncements.length) % sortedAnnouncements.length)}
                    className="p-1 rounded hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-500 hover:text-slate-900 dark:hover:text-white transition-colors cursor-pointer"
                  >
                    <ChevronLeft className="w-3.5 h-3.5" />
                  </button>
                  <span className="text-[9px] font-black text-slate-600 dark:text-slate-400 font-mono">
                    {currentAnnIndex + 1}/{sortedAnnouncements.length}
                  </span>
                  <button
                    onClick={() => setCurrentAnnIndex(prev => (prev + 1) % sortedAnnouncements.length)}
                    className="p-1 rounded hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-500 hover:text-slate-900 dark:hover:text-white transition-colors cursor-pointer"
                  >
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
            </div>

            {/* Announcement Content */}
            {(() => {
              const ann = sortedAnnouncements[currentAnnIndex] || sortedAnnouncements[0];
              if (!ann) return null;
              
              const totalReactions = ann.reactionsList?.length || 0;
              const totalComments = ann.comments?.length || 0;
              
              return (
                <div className="space-y-2.5 relative">
                  {/* Badge Row */}
                  <div className="flex items-center gap-2 flex-wrap">
                    {ann.pinned ? (
                      <span className="text-[9px] bg-amber-500/20 text-amber-700 dark:text-amber-300 border border-amber-500/30 px-2.5 py-0.5 rounded-full font-bold uppercase tracking-wider flex items-center gap-1 shadow-sm">
                        📌 PINNED
                      </span>
                    ) : (
                      <span className="text-[9px] bg-sky-500/10 text-sky-600 dark:text-sky-400 border border-sky-500/20 px-2.5 py-0.5 rounded-full font-bold uppercase tracking-wider flex items-center gap-1 shadow-sm">
                        TERBARU
                      </span>
                    )}
                    <span className="text-[10px] text-slate-500 dark:text-slate-400 font-semibold">
                      Oleh: <span className="text-slate-700 dark:text-slate-300 font-bold">{ann.author}</span>
                    </span>
                    <span className="text-slate-300 dark:text-slate-800 font-light text-xs shrink-0">|</span>
                    <span className="text-[10px] text-slate-500 dark:text-slate-400 font-medium flex items-center gap-1">
                      <Calendar className="w-3.5 h-3.5 text-slate-400" />
                      {formatWIBDate(ann.createdAt)}
                    </span>
                  </div>

                  {/* Title & Body */}
                  <div className="space-y-1">
                    <h4 className={`text-sm leading-snug tracking-tight ${
                      ann.author === 'Owner'
                        ? 'font-black text-rose-600 dark:text-rose-400'
                        : 'font-extrabold text-slate-900 dark:text-white'
                    }`}>
                      {ann.title}
                    </h4>
                    <p className={`text-xs line-clamp-3 leading-relaxed whitespace-pre-line ${
                      ann.author === 'Owner'
                        ? 'text-rose-600 dark:text-rose-400 font-bold'
                        : 'text-slate-700 dark:text-slate-300 font-medium'
                    }`}>
                      {ann.content}
                    </p>
                  </div>

                  {/* Stats & Link Footer */}
                  <div className="flex items-center justify-between pt-2.5 border-t border-slate-100 dark:border-slate-800/40">
                    {/* Reactions & Comments Info */}
                    <div className="flex items-center gap-2.5">
                      {totalReactions > 0 ? (
                        <div className="flex items-center gap-1 bg-sky-500/10 dark:bg-sky-500/5 px-2 py-0.5 rounded-lg border border-sky-500/20 text-[10px] font-bold text-sky-600 dark:text-sky-400">
                          <span>✨</span>
                          <span>{totalReactions} Reaksi</span>
                        </div>
                      ) : (
                        <span className="text-[10px] text-slate-400 dark:text-slate-500 italic">Belum ada reaksi</span>
                      )}
                      
                      {totalComments > 0 ? (
                        <div className="flex items-center gap-1 bg-indigo-500/10 dark:bg-indigo-500/5 px-2 py-0.5 rounded-lg border border-indigo-500/20 text-[10px] font-bold text-indigo-600 dark:text-indigo-400">
                          <span>💬</span>
                          <span>{totalComments} Komentar</span>
                        </div>
                      ) : (
                        <span className="text-[10px] text-slate-400 dark:text-slate-500 italic">Belum ada diskusi</span>
                      )}
                    </div>

                    {/* CTA Button to expand & discuss */}
                    <button
                      onClick={() => setActiveTab('pengumuman')}
                      className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-black text-white bg-sky-500 hover:bg-sky-600 dark:bg-sky-600 dark:hover:bg-sky-700 rounded-xl shadow-md shadow-sky-500/20 transition-all hover:scale-105 active:scale-95 cursor-pointer"
                    >
                      <span>Buka Diskusi</span>
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })()}
          </div>
        </GlassCard>
      )}

      {/* Top Banner / Hero Information */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
        {/* Reset Counter Panel */}
        <div className="p-3.5 rounded-2xl bg-gradient-to-r from-amber-500/10 to-amber-600/15 dark:from-amber-500/5 dark:to-amber-600/10 border border-amber-500/20 dark:border-amber-500/15 flex items-center justify-between gap-3 shadow-md backdrop-blur-md">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="p-2.5 rounded-xl bg-amber-500/20 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400 shrink-0 border border-amber-500/30 dark:border-amber-500/20 shadow-inner">
              <Timer className="w-5 h-5 text-amber-600 dark:text-amber-400" />
            </div>
            <div className="min-w-0">
              <span className="text-[9px] font-black text-amber-700 dark:text-amber-400/90 uppercase tracking-widest block">Reset Mingguan</span>
              <span className="text-[11px] font-extrabold text-slate-900 dark:text-slate-100 truncate block">Setiap Senin 10:00 WIB</span>
            </div>
          </div>
          <div className="bg-white/90 dark:bg-slate-950/60 border border-amber-500/30 dark:border-amber-500/20 rounded-xl px-3 py-1.5 text-right shrink-0 shadow-inner">
            <span className="text-[9px] text-slate-500 dark:text-slate-400 block font-black uppercase tracking-widest mb-0.5">Sisa Waktu</span>
            <span className="text-xs font-mono font-black text-amber-600 dark:text-amber-400 tracking-wide flex items-center justify-end gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse inline-block shrink-0" />
              {timeLeft || 'Menghitung...'}
            </span>
          </div>
        </div>

        {/* Date / Time Info */}
        <div className="p-3.5 rounded-2xl bg-gradient-to-r from-blue-500/10 to-indigo-600/15 dark:from-blue-500/5 dark:to-indigo-600/10 border border-blue-500/20 dark:border-blue-500/15 flex items-center justify-between gap-3 shadow-md backdrop-blur-md">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="p-2.5 rounded-xl bg-blue-500/20 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 shrink-0 border border-blue-500/30 dark:border-blue-500/20 shadow-inner">
              <Calendar className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            </div>
            <div className="min-w-0">
              <span className="text-[9px] font-black text-blue-700 dark:text-blue-400/90 uppercase tracking-widest block">Hari Kerja</span>
              <span className="text-[11px] font-extrabold text-slate-900 dark:text-slate-100 truncate block">Periode Aktif</span>
            </div>
          </div>
          <div className="bg-white/90 dark:bg-slate-950/60 border border-blue-500/30 dark:border-blue-500/20 rounded-xl px-3 py-1.5 text-right shrink-0 shadow-inner">
            <span className="text-[9px] text-slate-500 dark:text-slate-400 block font-black uppercase tracking-widest mb-0.5">WIB</span>
            <span className="text-xs font-mono font-black text-sky-600 dark:text-sky-400 tracking-wide flex items-center justify-end gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-sky-500 animate-pulse inline-block shrink-0" />
              {weekRangeInfo.shortFormattedRange}
            </span>
          </div>
        </div>
      </div>

      {/* Leaderboard Section */}
      <div className="space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 px-1">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-xs font-bold text-slate-800 dark:text-slate-300 uppercase tracking-widest flex items-center gap-2">
                <Trophy className="w-4 h-4 text-amber-500 dark:text-amber-400" />
                <span>Leaderboard Mingguan</span>
              </h3>
            </div>
            <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5 font-medium flex items-center gap-1">
              <Calendar className="w-3 h-3 text-sky-600 dark:text-sky-400" /> Periode: <span className="text-slate-800 dark:text-slate-200 font-semibold">{weekRangeInfo.shortFormattedRange}</span>
            </p>
          </div>

          <div className="flex items-center gap-1.5 self-start sm:self-auto">
            <button
              onClick={() => setSelectedWeekOffset(0)}
              className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition-all cursor-pointer ${
                selectedWeekOffset === 0
                  ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
                  : 'bg-slate-200/80 dark:bg-slate-800/80 text-slate-700 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white border border-slate-300 dark:border-slate-700/60'
              }`}
            >
              Minggu Ini
            </button>
            <button
              onClick={() => setSelectedWeekOffset(-7)}
              className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition-all cursor-pointer ${
                selectedWeekOffset === -7
                  ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
                  : 'bg-slate-200/80 dark:bg-slate-800/80 text-slate-700 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white border border-slate-300 dark:border-slate-700/60'
              }`}
            >
              Minggu Lalu
            </button>
          </div>
        </div>

        <GlassCard className="p-0 border-slate-200/80 dark:border-slate-800/80 overflow-hidden shadow-xl">
          {/* Info Banner */}
          <div className="px-3.5 py-2 bg-amber-500/10 border-b border-amber-500/20 flex flex-wrap items-center justify-between gap-2 text-[10px]">
            <span className="text-amber-800 dark:text-amber-300/90 font-medium flex items-center gap-1.5">
              <Clock className="w-3 h-3 text-amber-600 dark:text-amber-400 shrink-0" />
              Reset otomatis setiap Senin 10:00 WIB
            </span>
            {topChannelOverall && (
              <span className="text-amber-800 dark:text-amber-300 font-bold bg-amber-500/15 px-2 py-0.5 rounded-full border border-amber-500/30 flex items-center gap-1">
                <Share2 className="w-2.5 h-2.5 text-amber-600 dark:text-amber-400" />
                Top Channel: <span className="text-slate-900 dark:text-white">{topChannelOverall.name}</span> ({topChannelOverall.count})
              </span>
            )}
          </div>

          {isLoadingUsers || isLoadingReports ? (
            <div className="p-8 flex flex-col items-center justify-center gap-2 text-slate-500 dark:text-slate-400">
              <Loader2 className="w-5 h-5 animate-spin text-amber-500" />
              <span className="text-[10px] font-medium uppercase tracking-tighter">Memuat Data Leaderboard...</span>
            </div>
          ) : topRecruiters.length === 0 ? (
            <div className="p-8 text-center text-slate-600 dark:text-slate-400 space-y-1">
              <p className="text-xs font-semibold">Belum ada data performa rekrutmen minggu ini.</p>
              <p className="text-[10px] text-slate-500 dark:text-slate-400 italic">Leaderboard akan diperbarui seiring laporan disetujui. Reset berikutnya: Senin pukul 10:00 WIB.</p>
            </div>
          ) : (
            <div className="flex flex-col">
              {/* Podium Top 3 */}
              <div className="bg-slate-100/70 dark:bg-slate-950/30 border-b border-slate-200/80 dark:border-slate-800/50 pb-5">
                <div className="grid grid-cols-3 gap-1.5 items-end pt-6 pb-2 px-2 max-w-sm mx-auto">
                  {/* 2nd Place */}
                  <div className="flex flex-col items-center">
                    {podiumRecruiters[1] ? (
                      <motion.div 
                        initial={{ opacity: 0, y: 15 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.1, duration: 0.4 }}
                        className="w-full flex flex-col items-center"
                      >
                        <div className="relative mb-2 shrink-0">
                          <div className="w-13 h-13 sm:w-14 sm:h-14 rounded-full p-0.5 bg-gradient-to-b from-slate-300 via-slate-400 to-slate-600 shadow-md flex items-center justify-center">
                            <div className="w-full h-full rounded-full overflow-hidden bg-slate-50 dark:bg-slate-900 flex items-center justify-center border border-slate-950">
                              {podiumRecruiters[1].photo ? (
                                <img referrerPolicy="no-referrer" src={podiumRecruiters[1].photo} alt={podiumRecruiters[1].name} className="w-full h-full object-cover"  />
                              ) : (
                                <span className="text-sm font-black text-slate-700 dark:text-slate-300">{podiumRecruiters[1].name[0]?.toUpperCase()}</span>
                              )}
                            </div>
                          </div>
                          <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-4.5 h-4.5 bg-slate-400 border border-slate-300 text-slate-950 font-black rounded-full flex items-center justify-center text-[9px] shadow-sm">
                            2
                          </div>
                        </div>
                        <div className="text-center w-full max-w-[85px]">
                          <span className="text-[10px] text-slate-800 dark:text-slate-300 font-extrabold block truncate leading-tight">{podiumRecruiters[1].name}</span>
                          <span className="text-[11px] font-black text-slate-700 dark:text-slate-400 block mt-0.5">{Math.floor(podiumRecruiters[1].points)} <span className="text-[8px] font-medium text-slate-500 dark:text-slate-400">ACC</span></span>
                        </div>
                      </motion.div>
                    ) : (
                      <div className="h-1" />
                    )}
                  </div>

                  {/* 1st Place */}
                  <div className="flex flex-col items-center">
                    <motion.div 
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.4 }}
                      className="w-full flex flex-col items-center"
                    >
                      <div className="relative mb-2.5 shrink-0">
                        <Crown className="w-4 h-4 text-amber-500 dark:text-amber-400 absolute -top-4 left-1/2 -translate-x-1/2 drop-shadow-md animate-pulse" />
                        <div className="w-16 h-16 sm:w-18 sm:h-18 rounded-full p-0.5 bg-gradient-to-b from-amber-300 via-yellow-400 to-amber-600 shadow-lg shadow-amber-500/20 flex items-center justify-center">
                          <div className="w-full h-full rounded-full overflow-hidden bg-white dark:bg-slate-900 flex items-center justify-center border border-amber-300 dark:border-slate-950">
                            {podiumRecruiters[0].photo ? (
                              <img referrerPolicy="no-referrer" src={podiumRecruiters[0].photo} alt={podiumRecruiters[0].name} className="w-full h-full object-cover"  />
                            ) : (
                              <span className="text-base font-black text-amber-600 dark:text-amber-400">{podiumRecruiters[0].name[0]?.toUpperCase()}</span>
                            )}
                          </div>
                        </div>
                        <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-5.5 h-5.5 bg-amber-500 border border-amber-300 text-slate-950 font-black rounded-full flex items-center justify-center text-[10px] shadow-sm">
                          1
                        </div>
                      </div>
                      <div className="text-center w-full max-w-[95px]">
                        <span className="text-xs text-amber-900 dark:text-amber-300 font-extrabold block truncate leading-tight">{podiumRecruiters[0].name}</span>
                        <span className="text-xs font-black text-slate-900 dark:text-white block mt-0.5">{Math.floor(podiumRecruiters[0].points)} <span className="text-[9px] font-medium text-amber-600 dark:text-amber-400">ACC</span></span>
                      </div>
                    </motion.div>
                  </div>

                  {/* 3rd Place */}
                  <div className="flex flex-col items-center">
                    {podiumRecruiters[2] ? (
                      <motion.div 
                        initial={{ opacity: 0, y: 15 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.2, duration: 0.4 }}
                        className="w-full flex flex-col items-center"
                      >
                        <div className="relative mb-2 shrink-0">
                          <div className="w-13 h-13 sm:w-14 sm:h-14 rounded-full p-0.5 bg-gradient-to-b from-amber-700 via-amber-800 to-amber-950 shadow-md flex items-center justify-center">
                            <div className="w-full h-full rounded-full overflow-hidden bg-white dark:bg-slate-900 flex items-center justify-center border border-amber-700 dark:border-slate-950">
                              {podiumRecruiters[2].photo ? (
                                <img referrerPolicy="no-referrer" src={podiumRecruiters[2].photo} alt={podiumRecruiters[2].name} className="w-full h-full object-cover"  />
                              ) : (
                                <span className="text-sm font-black text-amber-700 dark:text-amber-600">{podiumRecruiters[2].name[0]?.toUpperCase()}</span>
                              )}
                            </div>
                          </div>
                          <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-4.5 h-4.5 bg-amber-800 border border-amber-700 text-slate-900 dark:text-white font-black rounded-full flex items-center justify-center text-[9px] shadow-sm">
                            3
                          </div>
                        </div>
                        <div className="text-center w-full max-w-[85px]">
                          <span className="text-[10px] text-slate-800 dark:text-slate-300 font-extrabold block truncate leading-tight">{podiumRecruiters[2].name}</span>
                          <span className="text-[11px] font-black text-amber-800 dark:text-amber-600/80 block mt-0.5">{Math.floor(podiumRecruiters[2].points)} <span className="text-[8px] font-medium text-slate-500 dark:text-slate-400">ACC</span></span>
                        </div>
                      </motion.div>
                    ) : (
                      <div className="h-1" />
                    )}
                  </div>
                </div>
              </div>

              {/* Ranks 4 and Below */}
              <div className="divide-y divide-slate-200/80 dark:divide-slate-800/50 bg-slate-50/50 dark:bg-slate-950/10">
                {remainingRecruiters.map((rec, idx) => {
                  const rank = idx + 4;
                  return (
                    <motion.div
                      key={rec.telegramId}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: idx * 0.03 }}
                      className="p-3.5 flex items-center justify-between hover:bg-slate-200/40 dark:hover:bg-white/5 transition-colors group"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="flex items-center gap-2.5 shrink-0">
                          {/* Rank Circle */}
                          <span className="w-5 text-center text-slate-500 dark:text-slate-400 text-[10.5px] font-black">
                            {rank}
                          </span>
                          <div className="w-9 h-9 rounded-xl overflow-hidden border border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-900 flex items-center justify-center">
                            {rec.photo ? (
                              <img referrerPolicy="no-referrer" src={rec.photo} alt={rec.name} className="w-full h-full object-cover"  />
                            ) : (
                              <span className="text-xs font-bold text-slate-600 dark:text-slate-400">
                                {rec.name[0]?.toUpperCase() || 'R'}
                              </span>
                            )}
                          </div>
                        </div>

                        <div className="flex flex-col min-w-0">
                          <h4 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-slate-200 truncate group-hover:text-amber-500 dark:group-hover:text-amber-400 transition-colors">
                            {rec.name}
                          </h4>
                          <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                            <span className="text-[9.5px] text-slate-500 dark:text-slate-400 font-medium truncate">
                              {formatUsername(rec.username)}
                            </span>
                            <div className="w-1 h-1 rounded-full bg-slate-300 dark:bg-slate-800 shrink-0" />
                            <span className="text-[9.5px] text-sky-600 dark:text-sky-400 font-bold whitespace-nowrap">
                              {rec.applicantCount} Kirim Data
                            </span>
                            {rec.qualityCount > 0 && (
                              <>
                                <div className="w-1 h-1 rounded-full bg-slate-300 dark:bg-slate-800 shrink-0" />
                                <span className="text-[9.5px] text-emerald-600 dark:text-emerald-400 font-bold whitespace-nowrap">
                                  {rec.qualityCount} Pelamar Disetujui
                                </span>
                              </>
                            )}
                          </div>

                          {/* Stats Row */}
                          <div className="mt-1 flex flex-wrap items-center gap-1">
                            {rec.topChannel && (
                              <span className="text-[8px] text-amber-700 dark:text-amber-300 font-bold bg-amber-500/10 px-1 py-0.1 rounded border border-amber-500/20 flex items-center gap-0.5">
                                <Share2 className="w-2 h-2 text-amber-500 dark:text-amber-400" />
                                {rec.topChannel.name}
                              </span>
                            )}
                            {rec.accT0Count > 0 && (
                              <span className="text-[8px] text-cyan-700 dark:text-cyan-300 font-bold bg-cyan-500/10 px-1 py-0.1 rounded border border-cyan-500/20 flex items-center gap-0.5">
                                <CheckCircle2 className="w-2 h-2 text-cyan-500 dark:text-cyan-400" />
                                T0: {rec.accT0Count}
                              </span>
                            )}
                            {rec.accV0Count > 0 && (
                              <span className="text-[8px] text-purple-700 dark:text-purple-300 font-bold bg-purple-500/10 px-1 py-0.1 rounded border border-purple-500/20 flex items-center gap-0.5">
                                <Zap className="w-2 h-2 text-purple-500 dark:text-purple-400" />
                                V0: {rec.accV0Count}
                              </span>
                            )}
                            {rec.effectiveDaysCount > 0 && (
                              <span className="text-[8px] text-teal-700 dark:text-teal-300 font-bold bg-teal-500/10 px-1 py-0.1 rounded border border-teal-500/20 flex items-center gap-0.5">
                                <CalendarCheck className="w-2 h-2 text-teal-500 dark:text-teal-400" />
                                {rec.effectiveDaysCount} Hari
                              </span>
                            )}
                            {rec.fineTotal > 0 && (
                              <span className="text-[8px] text-rose-700 dark:text-rose-300 font-bold bg-rose-500/10 px-1 py-0.1 rounded border border-rose-500/20 flex items-center gap-0.5">
                                <AlertTriangle className="w-2 h-2 text-rose-500 dark:text-rose-400" />
                                Rp {rec.fineTotal.toLocaleString('id-ID')}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="text-right shrink-0">
                        <div className="flex items-center gap-0.5 justify-end">
                          <span className="text-xs sm:text-sm font-black text-slate-800 dark:text-slate-200 tracking-tight group-hover:text-amber-500 dark:group-hover:text-amber-300 transition-colors">
                            {Math.floor(rec.points)}
                          </span>
                          <Sparkles className="w-2.5 h-2.5 text-amber-500 dark:text-amber-400" />
                        </div>
                        <span className="text-[8px] text-slate-500 dark:text-slate-400 font-bold uppercase tracking-tight block mt-0.2">{rec.count} Lap</span>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            </div>
          )}

          {topRecruiters.length > 0 && (
            <div className="p-2.5 bg-slate-100/80 dark:bg-slate-950/40 border-t border-slate-200 dark:border-slate-800/50 flex items-center justify-between px-3.5">
              <span className="text-[9px] text-slate-500 dark:text-slate-400 font-medium flex items-center gap-1.5 italic">
                <Medal className="w-3 h-3 text-amber-500" />
                Point: Total ACC T0 & V0
              </span>
              <span className="text-[9px] text-slate-600 dark:text-slate-400 font-bold">
                Total: {totalAllRecruitersCount} Recruiter
              </span>
            </div>
          )}
        </GlassCard>
      </div>

      {/* My Stats Summary Card */}
      <div className="space-y-3">
        <h3 className="text-xs font-bold text-slate-700 dark:text-slate-400 uppercase tracking-widest px-1">
          {isAdminOrOwner ? (selectedRecruiterFilter ? 'Ringkasan Performa Recruiter' : 'Ringkasan Performa Semua Recruiter') : 'Ringkasan Performa Saya'}
        </h3>

        <GlassCard className="p-4 space-y-4 border-slate-200 dark:border-slate-800/80 bg-white/80 dark:bg-slate-950/20 shadow-lg">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between border-b border-slate-200 dark:border-slate-800/60 pb-3 gap-3">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-xl bg-sky-500/10 text-sky-600 dark:text-sky-400 border border-sky-500/20">
                <BarChart2 className="w-4 h-4" />
              </div>
              <span className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">
                {isAdminOrOwner ? (selectedRecruiterFilter ? 'Metrik Recruiter' : 'Metrik Akumulasi Semua Laporan') : 'Metrik Akumulasi Laporan Saya'}
              </span>
            </div>
            
            {isAdminOrOwner && (
              <div className="relative w-full sm:w-auto" ref={recruiterFilterDropdownRef}>
                <button
                  type="button"
                  onClick={() => setIsRecruiterFilterDropdownOpen(!isRecruiterFilterDropdownOpen)}
                  className="flex items-center justify-between w-full sm:w-64 bg-white dark:bg-slate-950 text-slate-900 dark:text-white text-xs font-bold px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                >
                  <div className="flex items-center gap-2 truncate">
                    {selectedRecruiterFilter ? (
                      <>
                        {allUsers.find(u => String(u.telegramId) === selectedRecruiterFilter)?.photoUrl ? (
                          <img src={allUsers.find(u => String(u.telegramId) === selectedRecruiterFilter)?.photoUrl} alt="Profile" className="w-5 h-5 rounded-full object-cover" />
                        ) : (
                          <div className="w-5 h-5 rounded-full bg-indigo-100 dark:bg-indigo-500/20 flex items-center justify-center text-[9px] text-indigo-600 dark:text-indigo-400">
                            {allUsers.find(u => String(u.telegramId) === selectedRecruiterFilter)?.firstName?.charAt(0) || '?'}
                          </div>
                        )}
                        <span className="truncate">
                          {allUsers.find(u => String(u.telegramId) === selectedRecruiterFilter)?.firstName} {allUsers.find(u => String(u.telegramId) === selectedRecruiterFilter)?.lastName || ''}
                        </span>
                      </>
                    ) : (
                      <span className="text-slate-500 dark:text-slate-400">Semua Recruiter</span>
                    )}
                  </div>
                  <ChevronDown className={`w-4 h-4 text-slate-500 transition-transform ${isRecruiterFilterDropdownOpen ? 'rotate-180' : ''}`} />
                </button>

                <AnimatePresence>
                  {isRecruiterFilterDropdownOpen && (
                    <motion.div
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      className="absolute right-0 z-50 w-full sm:w-64 mt-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-xl overflow-hidden max-h-60 overflow-y-auto"
                    >
                      <button
                        type="button"
                        onClick={() => { setSelectedRecruiterFilter(''); setIsRecruiterFilterDropdownOpen(false); }}
                        className={`w-full text-left px-3 py-2 text-xs font-medium hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors flex items-center gap-2 ${!selectedRecruiterFilter ? 'bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400' : 'text-slate-700 dark:text-slate-300'}`}
                      >
                        <div className="w-5 h-5 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center shrink-0">
                          <Users className="w-3 h-3 text-slate-500" />
                        </div>
                        Semua Recruiter
                        {!selectedRecruiterFilter && <Check className="w-3 h-3 ml-auto" />}
                      </button>
                      {allUsers.filter(u => u.role === 'Recruiter').map(r => (
                        <button
                          key={r.telegramId}
                          type="button"
                          onClick={() => { setSelectedRecruiterFilter(String(r.telegramId)); setIsRecruiterFilterDropdownOpen(false); }}
                          className={`w-full text-left px-3 py-2 text-xs font-medium hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors flex items-center gap-2 ${selectedRecruiterFilter === String(r.telegramId) ? 'bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400' : 'text-slate-700 dark:text-slate-300'}`}
                        >
                          {r.photoUrl ? (
                            <img src={r.photoUrl} alt={r.firstName} className="w-5 h-5 rounded-full object-cover shrink-0" />
                          ) : (
                            <div className="w-5 h-5 rounded-full bg-indigo-100 dark:bg-indigo-500/20 flex items-center justify-center text-[9px] shrink-0">
                              {r.firstName?.charAt(0) || '?'}
                            </div>
                          )}
                          <span className="truncate">
                            {r.firstName} {r.lastName || ''}
                          </span>
                          {selectedRecruiterFilter === String(r.telegramId) && <Check className="w-3 h-3 ml-auto shrink-0" />}
                        </button>
                      ))}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {/* Kunjungan -> Tanya Kerja */}
            <div className="bg-slate-50 dark:bg-slate-900/50 p-3.5 rounded-2xl border border-slate-200/80 dark:border-slate-800/60 flex flex-col justify-between hover:border-blue-500/30 transition-all group">
              <div className="flex items-center justify-between gap-2 mb-2">
                <span className="text-[10px] text-slate-600 dark:text-slate-400 font-extrabold uppercase tracking-wider">Tanya Kerja</span>
                <Clock className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400 group-hover:scale-110 transition-transform" />
              </div>
              <span className="text-xl sm:text-2xl font-black text-blue-600 dark:text-blue-400 tracking-tight">{totalVisits}</span>
            </div>

            {/* Pelamar -> Kirim Data */}
            <div className="bg-slate-50 dark:bg-slate-900/50 p-3.5 rounded-2xl border border-slate-200/80 dark:border-slate-800/60 flex flex-col justify-between hover:border-sky-500/30 transition-all group">
              <div className="flex items-center justify-between gap-2 mb-2">
                <span className="text-[10px] text-slate-600 dark:text-slate-400 font-extrabold uppercase tracking-wider">Kirim Data</span>
                <UserCheck className="w-3.5 h-3.5 text-sky-600 dark:text-sky-400 group-hover:scale-110 transition-transform" />
              </div>
              <span className="text-xl sm:text-2xl font-black text-sky-600 dark:text-sky-400 tracking-tight">{totalApplicants}</span>
            </div>

            {/* Berkualitas -> Pelamar Disetujui */}
            <div className="bg-slate-50 dark:bg-slate-900/50 p-3.5 rounded-2xl border border-slate-200/80 dark:border-slate-800/60 flex flex-col justify-between hover:border-emerald-500/30 transition-all group">
              <div className="flex items-center justify-between gap-2 mb-2">
                <span className="text-[10px] text-slate-600 dark:text-slate-400 font-extrabold uppercase tracking-wider">Pelamar Disetujui</span>
                <Sparkles className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 group-hover:scale-110 transition-transform" />
              </div>
              <span className="text-xl sm:text-2xl font-black text-emerald-600 dark:text-emerald-400 tracking-tight">{totalQuality}</span>
            </div>

            {/* Postingan */}
            <div className="bg-slate-50 dark:bg-slate-900/50 p-3.5 rounded-2xl border border-slate-200/80 dark:border-slate-800/60 flex flex-col justify-between hover:border-indigo-500/30 transition-all group">
              <div className="flex items-center justify-between gap-2 mb-2">
                <span className="text-[10px] text-slate-600 dark:text-slate-400 font-extrabold uppercase tracking-wider">Postingan</span>
                <FileText className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400 group-hover:scale-110 transition-transform" />
              </div>
              <span className="text-xl sm:text-2xl font-black text-indigo-600 dark:text-indigo-400 tracking-tight">{totalPostings}</span>
            </div>

            {/* ACC T0 */}
            <div className="bg-slate-50 dark:bg-slate-900/50 p-3.5 rounded-2xl border border-slate-200/80 dark:border-slate-800/60 flex flex-col justify-between hover:border-cyan-500/30 transition-all group">
              <div className="flex items-center justify-between gap-2 mb-2">
                <span className="text-[10px] text-slate-600 dark:text-slate-400 font-extrabold uppercase tracking-wider">ACC T0</span>
                <CheckCircle2 className="w-3.5 h-3.5 text-cyan-600 dark:text-cyan-400 group-hover:scale-110 transition-transform" />
              </div>
              <span className="text-xl sm:text-2xl font-black text-cyan-600 dark:text-cyan-400 tracking-tight">{totalAccT0}</span>
            </div>

            {/* ACC V0 */}
            <div className="bg-slate-50 dark:bg-slate-900/50 p-3.5 rounded-2xl border border-slate-200/80 dark:border-slate-800/60 flex flex-col justify-between hover:border-purple-500/30 transition-all group">
              <div className="flex items-center justify-between gap-2 mb-2">
                <span className="text-[10px] text-slate-600 dark:text-slate-400 font-extrabold uppercase tracking-wider">ACC V0</span>
                <Zap className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400 group-hover:scale-110 transition-transform" />
              </div>
              <span className="text-xl sm:text-2xl font-black text-purple-600 dark:text-purple-400 tracking-tight">{totalAccV0}</span>
            </div>

            {/* Hari Efektif */}
            <div className="bg-slate-50 dark:bg-slate-900/50 p-3.5 rounded-2xl border border-slate-200/80 dark:border-slate-800/60 flex flex-col justify-between hover:border-teal-500/30 transition-all group">
              <div className="flex items-center justify-between gap-2 mb-2">
                <span className="text-[10px] text-slate-600 dark:text-slate-400 font-extrabold uppercase tracking-wider">Hari Efektif</span>
                <CalendarCheck className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400 group-hover:scale-110 transition-transform" />
              </div>
              <span className="text-xl sm:text-2xl font-black text-teal-600 dark:text-teal-400 tracking-tight">{totalEffectiveDays} <span className="text-[10px] text-slate-500 dark:text-slate-400 font-bold">Hari</span></span>
            </div>

            {/* Total Denda */}
            <div className="bg-slate-50 dark:bg-slate-900/50 p-3.5 rounded-2xl border border-slate-200/80 dark:border-slate-800/60 flex flex-col justify-between hover:border-rose-500/30 transition-all group">
              <div className="flex items-center justify-between gap-2 mb-2">
                <span className="text-[10px] text-slate-600 dark:text-slate-400 font-extrabold uppercase tracking-wider">Total Denda</span>
                <AlertTriangle className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400 group-hover:scale-110 transition-transform" />
              </div>
              <span className="text-lg sm:text-xl font-black text-rose-600 dark:text-rose-400 tracking-tight">Rp {totalFines.toLocaleString('id-ID')}</span>
            </div>
          </div>
        </GlassCard>
      </div>

      {/* Log Aktivitas Section (10 Aktivitas Terbaru) */}
      <div className="space-y-3">
        <div className="flex items-center justify-between px-1">
          <h3 className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-widest flex items-center gap-1.5">
            <Activity className="w-3.5 h-3.5 text-sky-500 dark:text-sky-400 animate-pulse" />
            <span>Log Aktivitas Terbaru</span>
          </h3>
          <span className="text-[10px] text-sky-700 dark:text-sky-300 font-extrabold bg-sky-50 dark:bg-sky-500/20 px-2.5 py-0.5 rounded-full border border-sky-200 dark:border-sky-500/30">
            Halaman {activityPage} dari {totalActivityPages}
          </span>
        </div>

        <GlassCard className="p-4 border-slate-200 dark:border-slate-800/80 bg-white/90 dark:bg-slate-950/40 shadow-sm">
          {isLoadingReports && isLoadingPosts ? (
            <div className="p-8 text-center text-slate-500 dark:text-slate-400 space-y-2">
              <Loader2 className="w-5 h-5 animate-spin mx-auto text-sky-500" />
              <p className="text-xs font-medium uppercase tracking-tight">Memuat log aktivitas...</p>
            </div>
          ) : paginatedActivities.length === 0 ? (
            <div className="p-8 text-center text-slate-500 dark:text-slate-400 space-y-1">
              <Activity className="w-6 h-6 mx-auto opacity-40 text-slate-400 dark:text-slate-500" />
              <p className="text-xs font-medium">Belum ada log aktivitas tercatat.</p>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="relative pl-4 space-y-3.5 before:absolute before:left-2 before:top-2 before:bottom-2 before:w-px before:bg-slate-200 dark:before:bg-slate-800">
                {paginatedActivities.map((act, index) => {
                  const isPelamar = act.activityType === 'pelamar';
                  const isLaporan = act.activityType === 'laporan';
                  const isPosting = act.activityType === 'posting';

                  const rawUser = act.username || act.name || 'Recruiter';
                  const formattedUser = formatUsername(rawUser);
                  const groupLabel = act.grup ? (act.grup === 'T0' ? 'T0-MARK' : act.grup) : '';

                  let detailSentence = '';

                  if (isPosting) {
                    const uniquePlatforms = act.platforms ? Array.from(new Set(act.platforms.filter(Boolean))) : [];
                    const platformStr = uniquePlatforms.length > 0 ? uniquePlatforms.join(', ') : 'Direct/Umum';
                    detailSentence = `Memposting ${act.linksCount} link ke platform ${platformStr} (Tanggal ${formatDateDisplay(act.date)})`;
                  } else if (isPelamar) {
                    detailSentence = `Menginput data Pelamar: ${act.applicantWhatsapp || act.uid9Kucing || act.applicantTelegramUsername || '-'}${act.channel ? ` • Channel: ${act.channel}` : ''}`;
                  } else {
                    detailSentence = `Menginput Laporan Harian Tgl ${formatDateDisplay(act.date)} • Posting: ${act.posting || 0} • Visit: ${act.visit || 0} • Pelamar: ${act.applicant || 0}`;
                  }

                  return (
                    <div key={act.id || index} className="relative flex items-start gap-3.5 group">
                      {/* Timeline Bullet */}
                      <div className={`absolute -left-[21px] top-2 w-2.5 h-2.5 rounded-full border-2 bg-white dark:bg-slate-950 transition-colors ${
                        isPelamar 
                          ? 'border-sky-500 group-hover:bg-sky-500' 
                          : isLaporan 
                          ? 'border-emerald-500 group-hover:bg-emerald-500'
                          : 'border-indigo-500 group-hover:bg-indigo-500'
                      }`} />
                      
                      <div className="flex-1 bg-slate-50/90 dark:bg-slate-900/60 border border-slate-200/90 dark:border-slate-800/80 rounded-xl p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:border-slate-300 dark:hover:border-slate-700 hover:bg-slate-100/90 dark:hover:bg-slate-900/80 transition-all shadow-2xs">
                        <div className="flex items-start gap-3 min-w-0">
                          <div className={`p-2 rounded-lg shrink-0 border ${
                            isPelamar 
                              ? 'bg-sky-500/10 text-sky-600 dark:text-sky-400 border-sky-500/20' 
                              : isLaporan 
                              ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20'
                              : 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/20'
                          }`}>
                            {isPelamar && <UserCheck className="w-3.5 h-3.5" />}
                            {isLaporan && <FileText className="w-3.5 h-3.5" />}
                            {isPosting && <Share2 className="w-3.5 h-3.5" />}
                          </div>

                          <div className="min-w-0">
                            {/* Header: Username + Activity Badge */}
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-[13px] font-black text-slate-900 dark:text-slate-100 tracking-tight">
                                {formattedUser}
                              </span>
                              <span className={`text-[9px] font-extrabold px-2 py-0.5 rounded border uppercase tracking-wide ${
                                isPelamar 
                                  ? 'bg-sky-100 dark:bg-sky-500/20 text-sky-800 dark:text-sky-300 border-sky-300 dark:border-sky-500/30' 
                                  : isLaporan 
                                  ? 'bg-emerald-100 dark:bg-emerald-500/20 text-emerald-800 dark:text-emerald-300 border-emerald-300 dark:border-emerald-500/30'
                                  : 'bg-indigo-100 dark:bg-indigo-500/20 text-indigo-800 dark:text-indigo-300 border-indigo-300 dark:border-indigo-500/30'
                              }`}>
                                {isPelamar ? 'Pelamar' : isLaporan ? 'Laporan Harian' : 'Postingan Link'}
                              </span>
                            </div>

                            {/* Description below header */}
                            <p className="text-[11px] text-slate-700 dark:text-slate-300 mt-1 leading-snug font-medium">
                              {detailSentence}
                            </p>

                            {/* Footer info: Timestamp & Group */}
                            <div className="flex items-center gap-2 mt-1.5 text-[10px] text-slate-500 dark:text-slate-400 font-medium">
                              <span className="flex items-center gap-1 text-slate-600 dark:text-slate-400">
                                <Clock className="w-3 h-3 text-slate-500 dark:text-slate-400" />
                                {formatWIBDateTime(act.createdAt)}
                              </span>
                              {isPelamar && groupLabel && (
                                <span className="text-cyan-800 dark:text-cyan-300 font-extrabold bg-cyan-100 dark:bg-cyan-500/20 px-1.5 py-0.5 rounded text-[8.5px] border border-cyan-300 dark:border-cyan-500/30 uppercase tracking-tight">
                                  {groupLabel}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        <div className="shrink-0 self-end sm:self-center">
                          {act.result && (
                            <span className={`inline-flex items-center gap-1.5 font-black rounded-full border px-2.5 py-0.5 text-[10px] uppercase tracking-wider ${
                              act.result === 'ACC' 
                                ? 'bg-emerald-100 dark:bg-emerald-500/20 text-emerald-800 dark:text-emerald-300 border-emerald-300 dark:border-emerald-500/40' 
                                : act.result === 'REJECT' 
                                ? 'bg-rose-100 dark:bg-rose-500/20 text-rose-800 dark:text-rose-300 border-rose-300 dark:border-rose-500/40' 
                                : 'bg-amber-100 dark:bg-amber-500/20 text-amber-800 dark:text-amber-300 border-amber-300 dark:border-amber-500/40'
                            }`}>
                              <span className="w-1.5 h-1.5 rounded-full bg-current" />
                              {act.result === 'ACC' ? 'Di-ACC Admin/Owner' : act.result === 'REJECT' ? 'Ditolak Admin/Owner' : 'Menunggu ACC'}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Pagination Controls */}
              {totalActivityPages > 1 && (
                <div className="flex items-center justify-center gap-4 pt-2 border-t border-slate-100 dark:border-slate-800/60">
                  <button
                    onClick={() => setActivityPage(prev => Math.max(1, prev - 1))}
                    disabled={activityPage === 1}
                    className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-900 disabled:opacity-30 transition-colors"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <span className="text-[11px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-tight">
                    Halaman {activityPage} / {totalActivityPages}
                  </span>
                  <button
                    onClick={() => setActivityPage(prev => Math.min(totalActivityPages, prev + 1))}
                    disabled={activityPage === totalActivityPages}
                    className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-900 disabled:opacity-30 transition-colors"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>
          )}
        </GlassCard>
      </div>

    </motion.div>
  );
};

