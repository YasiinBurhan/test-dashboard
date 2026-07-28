import React, { useState, useRef, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { GlassCard } from '../components/common/GlassCard';
import { Button } from '../components/common/Button';
import { useAuth } from '../hooks/useAuth';
import { useReports } from '../hooks/useReports';
import { triggerHaptic } from '../telegram/webapp';
import { getSystemSettings } from '../firebase/services/settingService';
import { subscribeToAllUsers } from '../firebase/services/userService';
import { createPost, subscribeToRecruiterPosts, getRecruiterPosts, subscribeToTodayPostsAllRecruiters, archiveOldPosts, subscribeToAllPosts } from '../firebase/services/postService';
import { SystemSettings, BatchPost, UserProfile } from '../types';
import { getWIBDate, getWIBMonday, getWIBMondayOfDate, getWIBCurrentWeekDays, getIndonesianDayName, formatDateWithDay, getWIBWeekDaysOfMonday, formatUsername } from '../utils/format';
import { 
  Image as ImageIcon, 
  X, 
  Send, 
  AlertCircle, 
  CheckCircle2, 
  Upload, 
  Plus,
  Link as LinkIcon,
  Globe,
  Hash,
  History,
  Archive,
  ChevronRight,
  ChevronLeft,
  ChevronDown,
  ExternalLink,
  Calendar,
  Clock,
  Sparkles,
  Timer,
  ShieldCheck,
  AlertTriangle,
  Target,
  Camera,
  ArrowRight,
  ArrowLeft,
  Trophy,
  Users,
  Award,
  HelpCircle,
  BookOpen,
  Lightbulb,
  ListOrdered,
  CheckSquare,
  FileText,
  ChevronUp,
  Info
} from 'lucide-react';

const getApiBaseUrl = () => {
  if (import.meta.env.VITE_BACKEND_URL) {
    return import.meta.env.VITE_BACKEND_URL;
  }
  return 'https://test-dashboard-lake-pi.vercel.app';
};

const API_BASE_URL = getApiBaseUrl();

type SocialPlatform = 'Facebook' | 'X (Twitter)' | 'Instagram' | 'TikTok' | 'Threads' | 'WhatsApp' | 'Telegram' | 'Lainnya';

interface SocialLink {
  url: string;
  platform: SocialPlatform;
}

// Channel Platform Real SVG Icons (Aligned with DataHarianPage)
const ChannelPlatformIcon: React.FC<{ id: string; className?: string }> = ({ id, className = "w-3.5 h-3.5 shrink-0" }) => {
  switch (id) {
    case 'Facebook':
      return (
        <svg className={`${className} fill-current`} viewBox="0 0 24 24">
          <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
        </svg>
      );
    case 'X (Twitter)':
      return (
        <svg className={`${className} fill-current`} viewBox="0 0 24 24">
          <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
        </svg>
      );
    case 'Threads':
      return (
        <svg className={`${className} fill-current`} viewBox="0 0 24 24">
          <path d="M12.186 24c-3.142 0-5.782-1.002-7.587-2.87-1.848-1.91-2.599-4.57-2.599-7.728 0-3.322.95-6.07 2.825-8.17C6.632 3.123 9.29 2 12.723 2c3.488 0 6.208 1.14 8.084 3.388 1.583 1.897 2.392 4.417 2.392 7.488 0 .61-.03 1.256-.09 1.933h-3.411c.045-.487.068-.962.068-1.428 0-2.22-.57-3.992-1.693-5.27-1.196-1.36-2.937-2.05-5.183-2.05-2.298 0-4.093.758-5.337 2.252-1.22 1.466-1.838 3.513-1.838 6.084 0 2.327.534 4.254 1.587 5.727 1.055 1.475 2.585 2.223 4.548 2.223 1.623 0 2.946-.43 3.931-1.28.932-.803 1.488-1.922 1.654-3.328h-5.26v-3.072h8.777c.074.526.111 1.077.111 1.652 0 2.457-.833 4.475-2.477 6.002C18.667 23.23 15.808 24 12.186 24z" />
        </svg>
      );
    case 'Instagram':
      return (
        <svg className={`${className} fill-current`} viewBox="0 0 24 24">
          <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z" />
        </svg>
      );
    case 'TikTok':
      return (
        <svg className={`${className} fill-current`} viewBox="0 0 24 24">
          <path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.82.57-1.31 1.54-1.33 2.54-.02 1.08.46 2.15 1.28 2.84 1.01.83 2.47.98 3.63.4 1.03-.51 1.69-1.57 1.78-2.72.08-2.71.04-5.43.05-8.15-.01-2.9-.01-5.8 0-8.7z" />
        </svg>
      );
    case 'Telegram':
      return (
        <svg className={`${className} fill-current`} viewBox="0 0 24 24">
          <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm4.64 6.8c-.15 1.58-.8 5.42-1.13 7.19-.14.75-.42 1-.68 1.03-.58.05-1.02-.38-1.58-.75-.88-.58-1.38-.94-2.23-1.5-.99-.65-.35-1.01.22-1.59.15-.15 2.71-2.48 2.76-2.69.01-.03.01-.14-.07-.2-.08-.06-.19-.04-.27-.02-.12.02-1.96 1.25-5.54 3.69-.52.36-1 .53-1.42.52-.47-.01-1.37-.26-2.03-.48-.82-.27-1.47-.42-1.42-.88.03-.25.38-.51 1.07-.78 4.18-1.82 6.97-3.02 8.37-3.61 3.99-1.66 4.82-1.95 5.36-1.96.12 0 .38.03.55.17.14.12.18.28.2.45-.01.07.01.23 0 .39z" />
        </svg>
      );
    case 'WhatsApp':
      return (
        <svg className={`${className} fill-current`} viewBox="0 0 24 24">
          <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946.003-6.556 5.338-11.891 11.893-11.891 3.181.001 6.167 1.24 8.413 3.488 2.245 2.248 3.481 5.236 3.48 8.414-.003 6.557-5.338 11.892-11.893 11.892-1.99-.001-3.951-.5-5.688-1.448l-6.305 1.654zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884-.001 2.225.651 3.891 1.746 5.634l-.999 3.648 3.742-.981zm11.387-5.464c-.074-.124-.272-.198-.57-.347-.297-.149-1.758-.868-2.031-.967-.272-.099-.47-.149-.669.149-.198.297-.768.967-.941 1.165-.173.198-.347.223-.644.074-.297-.149-1.255-.462-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.297-.347.446-.521.151-.172.2-.296.3-.495.099-.198.05-.372-.025-.521-.075-.148-.669-1.611-.916-2.206-.242-.579-.487-.501-.669-.51l-.57-.01c-.198 0-.52.074-.792.372s-1.04 1.016-1.04 2.479 1.065 2.876 1.213 3.074c.149.198 2.095 3.2 5.076 4.487.709.306 1.263.489 1.694.626.712.226 1.36.194 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.695.248-1.29.173-1.414z" />
        </svg>
      );
    default:
      return <Globe className={`${className}`} />;
  }
};

const CHANNELS = [
  { id: 'Facebook', label: 'Facebook', color: 'text-blue-400 border-blue-500/20 bg-blue-500/5', active: 'bg-blue-600 text-white border-blue-500' },
  { id: 'X (Twitter)', label: 'X (Twitter)', color: 'text-slate-200 border-slate-300 dark:border-slate-700 bg-slate-100 dark:bg-slate-800/20', active: 'bg-slate-200 text-slate-900 border-white' },
  { id: 'Threads', label: 'Threads', color: 'text-slate-900 dark:text-white border-zinc-700 bg-zinc-800/20', active: 'bg-white text-zinc-950 border-white' },
  { id: 'Instagram', label: 'Instagram', color: 'text-pink-400 border-pink-500/20 bg-pink-500/5', active: 'bg-gradient-to-r from-purple-500 to-pink-500 text-slate-900 dark:text-white border-transparent' },
  { id: 'TikTok', label: 'TikTok', color: 'text-cyan-400 border-cyan-400/20 bg-cyan-400/5', active: 'bg-cyan-500 text-slate-950 border-cyan-400' },
  { id: 'WhatsApp', label: 'WhatsApp', color: 'text-emerald-400 border-emerald-500/20 bg-emerald-500/5', active: 'bg-emerald-600 text-white border-emerald-500' },
  { id: 'Telegram', label: 'Telegram', color: 'text-sky-400 border-sky-400/20 bg-sky-400/5', active: 'bg-sky-500 text-white border-sky-400' },
  { id: 'Lainnya', label: 'Lainnya', color: 'text-slate-600 dark:text-slate-400 border-slate-300 dark:border-slate-700 bg-slate-100 dark:bg-slate-800/20', active: 'bg-slate-700 text-slate-900 dark:text-white border-slate-600' },
];

export const PostinganPage: React.FC = () => {
  const { userProfile, telegramUser } = useAuth();
  const { reports } = useReports();
  const [links, setLinks] = useState<SocialLink[]>([]);
  const [bulkText, setBulkText] = useState('');
  const [isReviewingLinks, setIsReviewingLinks] = useState(false);
  const [isConfirmed, setIsConfirmed] = useState(false);
  const [startNumber, setStartNumber] = useState<number | ''>(1);
  const [hasUserEditedStartNumber, setHasUserEditedStartNumber] = useState(false);
  const [images, setImages] = useState<string[]>([]);
  const [formStep, setFormStep] = useState<'upload' | 'link'>('upload');
  const [isUploading, setIsUploading] = useState(false);
  const [settings, setSettings] = useState<SystemSettings | null>(null);
  const [status, setStatus] = useState<{ type: 'idle' | 'success' | 'error'; message?: string }>({ type: 'idle' });
  const [alertState, setAlertState] = useState<{
    isOpen: boolean;
    type: 'success' | 'error' | 'warning';
    title: string;
    message: string;
  }>({
    isOpen: false,
    type: 'success',
    title: '',
    message: ''
  });

  const showAlert = (type: 'success' | 'error' | 'warning', title: string, message: string) => {
    setAlertState({ isOpen: true, type, title, message });
    triggerHaptic('notification', type === 'success' ? 'success' : 'error');
  };

  const closeAlert = () => {
    setAlertState(prev => ({ ...prev, isOpen: false }));
  };

  const fileInputRef = useRef<HTMLInputElement>(null);

  // View State & Post Count
  const [allUsers, setAllUsers] = useState<UserProfile[]>([]);
  const [recruiters, setRecruiters] = useState<UserProfile[]>([]);
  const [selectedRecruiterId, setSelectedRecruiterId] = useState<string>('');
  const [selectedHistoryRecruiterId, setSelectedHistoryRecruiterId] = useState<string>('ALL');
  const [isHistoryRecruiterDropdownOpen, setIsHistoryRecruiterDropdownOpen] = useState<boolean>(false);
  const [isBuatRecruiterDropdownOpen, setIsBuatRecruiterDropdownOpen] = useState<boolean>(false);
  const [activeView, setActiveView] = useState<'buat' | 'riwayat' | 'status'>('buat');
  const [historySubTab, setHistorySubTab] = useState<'minggu_ini' | 'arsip'>('minggu_ini');
  const [isGuideOpen, setIsGuideOpen] = useState<boolean>(false);
  const [guideTab, setGuideTab] = useState<'aturan' | 'buat' | 'riwayat_status'>('aturan');
  const currentDayName = getIndonesianDayName(getWIBDate()) || 'Senin';
  const [selectedDay, setSelectedDay] = useState<string>(currentDayName);
  const [selectedArchiveDay, setSelectedArchiveDay] = useState<string>('Senin');
  const [openPlatformDropdownIdx, setOpenPlatformDropdownIdx] = useState<number | null>(null);

  const userMap = useMemo(() => {
    const map = new Map<string, UserProfile>();
    allUsers.forEach(u => {
      if (u.telegramId) map.set(String(u.telegramId), u);
      if (u.username) map.set(u.username.toLowerCase().replace(/^@/, ''), u);
    });
    return map;
  }, [allUsers]);

  const getPostRecruiterInfo = (post: BatchPost) => {
    let matchedUser = post.telegramId ? userMap.get(String(post.telegramId)) : undefined;
    if (!matchedUser && post.username) {
      matchedUser = userMap.get(post.username.toLowerCase().replace(/^@/, ''));
    }

    const name = matchedUser 
      ? `${matchedUser.firstName} ${matchedUser.lastName || ''}`.trim()
      : (post.name || 'Recruiter');

    const username = matchedUser?.username || post.username || '';
    const photoUrl = matchedUser?.photoUrl || '';

    return { name, username, photoUrl, user: matchedUser };
  };
  const [allCurrentWeekPosts, setAllCurrentWeekPosts] = useState<BatchPost[]>([]);
  const [allTodayPosts, setAllTodayPosts] = useState<BatchPost[]>([]);
  const [allArchivedPosts, setAllArchivedPosts] = useState<BatchPost[]>([]);
  const [posts, setPosts] = useState<BatchPost[]>([]);
  const [todayPostingsCount, setTodayPostingsCount] = useState<number>(0);
  const [lastDoc, setLastDoc] = useState<any>(null);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [hasMore, setHasMore] = useState(true);

  // Pagination & Expand State
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [archivePage, setArchivePage] = useState<number>(1);
  const [statusPage, setStatusPage] = useState<number>(1);
  const [statusFilter, setStatusFilter] = useState<'semua' | 'aktif' | 'belum'>('semua');
  const [expandedWeekKey, setExpandedWeekKey] = useState<string | null>(null);
  const [expandedPostIds, setExpandedPostIds] = useState<Record<string, boolean>>({});
  const ITEMS_PER_PAGE = 10;

  // Reset status filter and pagination when activeView changes
  useEffect(() => {
    setStatusFilter('semua');
  }, [activeView]);

  // Reset status page when statusFilter changes
  useEffect(() => {
    setStatusPage(1);
  }, [statusFilter]);

  const filteredRecruiters = useMemo(() => {
    return recruiters.filter(rec => {
      const hasPosted = allTodayPosts.some(p => p.telegramId === String(rec.telegramId));
      if (statusFilter === 'aktif') return hasPosted;
      if (statusFilter === 'belum') return !hasPosted;
      return true;
    });
  }, [recruiters, allTodayPosts, statusFilter]);

  const statusCounts = useMemo(() => {
    let aktifCount = 0;
    let belumCount = 0;
    recruiters.forEach(rec => {
      const hasPosted = allTodayPosts.some(p => p.telegramId === String(rec.telegramId));
      if (hasPosted) {
        aktifCount++;
      } else {
        belumCount++;
      }
    });
    return {
      semua: recruiters.length,
      aktif: aktifCount,
      belum: belumCount
    };
  }, [recruiters, allTodayPosts]);

  // Reset pagination when tab view, day filter, or expanded week changes
  useEffect(() => {
    setCurrentPage(1);
    setArchivePage(1);
    setStatusPage(1);
  }, [activeView, selectedDay, expandedWeekKey, selectedArchiveDay]);

  useEffect(() => {
    setSelectedArchiveDay('Semua');
  }, [expandedWeekKey, activeView]);

  const totalPages = useMemo(() => {
    return Math.max(1, Math.ceil(posts.length / ITEMS_PER_PAGE));
  }, [posts.length]);

  const paginatedPosts = useMemo(() => {
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    return posts.slice(startIndex, startIndex + ITEMS_PER_PAGE);
  }, [posts, currentPage]);

  // Get current WIB week days (Senin - Minggu)
  const weekDays = useMemo(() => getWIBCurrentWeekDays(), []);

  // Map total links per day in current week
  const weekPostsCountMap = useMemo(() => {
    const map: Record<string, number> = {
      'Semua': 0,
      'Senin': 0,
      'Selasa': 0,
      'Rabu': 0,
      'Kamis': 0,
      'Jumat': 0,
      'Sabtu': 0,
      'Minggu': 0,
    };

    allCurrentWeekPosts.forEach((post) => {
      const dayName = getIndonesianDayName(post.date || '');
      const linkCount = Array.isArray(post.links) ? post.links.length : 0;
      map['Semua'] += linkCount;
      if (dayName && map[dayName] !== undefined) {
        map[dayName] += linkCount;
      }
    });

    return map;
  }, [allCurrentWeekPosts]);

  const archivedWeeks = useMemo(() => {
    const normalizeDate = (d: string) => {
      if (!d) return 'https://test-dashboard-lake-pi.vercel.app';
      const parts = d.split('-');
      if (parts.length !== 3) return d;
      if (parts[0].length === 2) return parts.reverse().join('-');
      return d;
    };

    const getWeekKey = (dateStr: string) => {
      const normalized = normalizeDate(dateStr);
      return getWIBMondayOfDate(normalized);
    };

    const groups: Record<string, BatchPost[]> = {};
    allArchivedPosts.forEach(post => {
      const weekKey = getWeekKey(post.date || '');
      if (weekKey) {
        if (!groups[weekKey]) {
          groups[weekKey] = [];
        }
        groups[weekKey].push(post);
      }
    });
    
    // Sort week keys descending (newest week first)
    const sortedWeekKeys = Object.keys(groups).sort((a, b) => b.localeCompare(a));
    
    return sortedWeekKeys.map(weekKey => {
      // Calculate Sunday date
      const parts = weekKey.split('-');
      const year = Number(parts[0]);
      const month = Number(parts[1]);
      const day = Number(parts[2]);
      const d = new Date(year, month - 1, day);
      d.setDate(d.getDate() + 6);
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const dt = String(d.getDate()).padStart(2, '0');
      const sundayStr = `${y}-${m}-${dt}`;
      
      const formattedMonday = `${parts[2]}/${parts[1]}/${parts[0]}`;
      const formattedSunday = `${dt}/${m}/${y}`;
      const label = `Periode: Senin, ${formattedMonday} - Minggu, ${formattedSunday}`;
      
      const sortedPosts = groups[weekKey].sort((a, b) => {
        const dateA = normalizeDate(a.date || '');
        const dateB = normalizeDate(b.date || '');
        if (dateA !== dateB) return dateB.localeCompare(dateA);
        return (b.createdAt || '').localeCompare(a.createdAt || '');
      });
      
      const totalLinks = sortedPosts.reduce((sum, p) => sum + (Array.isArray(p.links) ? p.links.length : 0), 0);
      
      return {
        weekKey,
        label,
        totalLinks,
        posts: sortedPosts
      };
    });
  }, [allArchivedPosts]);

  const isManagement = userProfile?.role === 'Admin' || userProfile?.role === 'Owner';
  
  // Effective Telegram ID (resilient to page reload before userProfile finishes loading)
  const effectiveTelegramId = isManagement 
    ? selectedRecruiterId 
    : (userProfile?.telegramId || (telegramUser?.id ? String(telegramUser.id) : ''));

  useEffect(() => {
    const unsubscribeUsers = subscribeToAllUsers((users) => {
      setAllUsers(users);
      const recs = users.filter(u => u.status === 'Active' && u.role === 'Recruiter');
      setRecruiters(recs);
      if (isManagement) {
        setSelectedRecruiterId(prev => {
          if (prev) {
            // Check if previously selected is still valid, else pick first
            const stillExists = recs.find(r => String(r.telegramId) === String(prev));
            if (stillExists) return prev;
          }
          return recs.length > 0 ? String(recs[0].telegramId) : '';
        });
      }
    });

    const unsubscribePosts = subscribeToTodayPostsAllRecruiters((posts) => {
      setAllTodayPosts(posts);
    });

    return () => {
      unsubscribeUsers();
      unsubscribePosts();
    };
  }, [isManagement]); // Remove activeView to avoid infinite re-renders or resubscriptions

  // Helper to normalize URLs for strict duplicate comparison
  const normalizeUrl = (url: string): string => {
    if (!url) return 'https://test-dashboard-lake-pi.vercel.app';
    let clean = url.trim().toLowerCase();
    clean = clean.replace(/\/+$/, ''); // Strip trailing slashes
    if (clean.startsWith('http://')) {
      clean = 'https://' + clean.slice(7);
    }
    return clean;
  };

  // Set of all submitted URLs in today's & current week's posts for duplicate detection
  const submittedUrlSet = useMemo(() => {
    const set = new Set<string>();
    const addPosts = (postList: BatchPost[]) => {
      postList.forEach(post => {
        if (Array.isArray(post.links)) {
          post.links.forEach(l => {
            if (l) {
              const norm = normalizeUrl(l);
              if (norm) set.add(norm);
            }
          });
        }
      });
    };
    addPosts(allTodayPosts);
    addPosts(allCurrentWeekPosts);
    addPosts(allArchivedPosts);
    addPosts(posts);
    return set;
  }, [allTodayPosts, allCurrentWeekPosts, allArchivedPosts, posts]);

  // Helper to check if a specific link in the form is a duplicate
  const checkLinkDuplicate = (linkUrl: string, index: number, allFormLinks: SocialLink[]) => {
    const clean = normalizeUrl(linkUrl);
    if (!clean) return { isDup: false };

    // 1. Check if duplicate in current form batch (matches another index before or after)
    const otherIndexInBatch = allFormLinks.findIndex((l, idx) => idx !== index && normalizeUrl(l.url) === clean);
    if (otherIndexInBatch !== -1) {
      return { isDup: true, reason: 'batch' as const, dupIndex: otherIndexInBatch + 1 };
    }

    // 2. Check if duplicate in submitted database posts
    if (submittedUrlSet.has(clean)) {
      return { isDup: true, reason: 'database' as const };
    }

    return { isDup: false };
  };

  // Calculate recruits recorded in Data Harian today for this recruiter
  const todayRecruits = useMemo(() => {
    const today = getWIBDate();
    const normalizeDate = (d: string) => {
      if (!d) return 'https://test-dashboard-lake-pi.vercel.app';
      const parts = d.split('-');
      if (parts.length !== 3) return d;
      if (parts[0].length === 2) return parts.reverse().join('-');
      return d;
    };
    const normalizedToday = normalizeDate(today);

    const todayReports = reports.filter((r) => {
      return r.telegramId === effectiveTelegramId && normalizeDate(r.date || '') === normalizedToday && r.result === 'ACC';
    });

    if (todayReports.length === 0) return 0;

    return todayReports.reduce((sum, r) => {
      const val = r.applicant !== undefined && r.applicant !== null ? Number(r.applicant) : 1;
      return sum + (isNaN(val) ? 1 : val);
    }, 0);
  }, [reports, effectiveTelegramId]);

  // Target posting rule calculation based on requirements:
  // Target 3+ rekrutan/hari -> Posting: Bebas
  // Target 2 rekrutan/hari  -> Posting: 30 postingan
  // Target 1 rekrutan/hari  -> Posting: 60 postingan
  // Target 0 rekrutan/hari  -> Posting: 90 postingan
  const targetRule = useMemo(() => {
    if (todayRecruits >= 3) {
      return {
        required: 0,
        label: 'Bebas Posting',
        badge: 'Bebas Posting 🎉',
        color: 'from-emerald-500/20 to-teal-500/10 text-emerald-300 border-emerald-500/40',
        iconColor: 'text-emerald-400',
        isFree: true,
        tierName: '3+ Rekrutan',
        description: 'Selamat! Dengan 3+ rekrutan dari Data Harian, Anda bebas posting (tanpa batas minimal).'
      };
    } else if (todayRecruits === 2) {
      return {
        required: 30,
        label: '30 Postingan',
        badge: 'Target: 30 Posting',
        color: 'from-sky-500/20 to-blue-500/10 text-sky-300 border-sky-500/40',
        iconColor: 'text-sky-400',
        isFree: false,
        tierName: '2 Rekrutan',
        description: 'Dengan 2 rekrutan dari Data Harian, target posting Anda adalah 30 postingan.'
      };
    } else if (todayRecruits === 1) {
      return {
        required: 60,
        label: '60 Postingan',
        badge: 'Target: 60 Posting',
        color: 'from-amber-500/20 to-orange-500/10 text-amber-300 border-amber-500/40',
        iconColor: 'text-amber-400',
        isFree: false,
        tierName: '1 Rekrutan',
        description: 'Dengan 1 rekrutan dari Data Harian, target posting Anda adalah 60 postingan.'
      };
    } else {
      return {
        required: 90,
        label: '90 Postingan',
        badge: 'Target: 90 Posting',
        color: 'from-rose-500/20 to-pink-500/10 text-rose-300 border-rose-500/40',
        iconColor: 'text-rose-400',
        isFree: false,
        tierName: '0 Rekrutan',
        description: 'Dengan 0 rekrutan dari Data Harian, target posting Anda adalah 90 postingan.'
      };
    }
  }, [todayRecruits]);

  // Check if daily posting target has been reached
  const isTargetReached = useMemo(() => {
    if (targetRule.isFree) return false;
    return targetRule.required > 0 && todayPostingsCount >= targetRule.required;
  }, [targetRule, todayPostingsCount]);

  // Live countdown to midnight (00:00)
  const [timeRemainingMs, setTimeRemainingMs] = useState<number>(0);
  const [elapsedPercent, setElapsedPercent] = useState<number>(100);
  const [currentHour, setCurrentHour] = useState<number>(0);

  useEffect(() => {
    const updateTimer = () => {
      const now = new Date();
      
      // Get Jakarta parts
      const partsArr = new Intl.DateTimeFormat('en-US', {
        timeZone: 'Asia/Jakarta',
        hour: 'numeric', minute: 'numeric', second: 'numeric',
        year: 'numeric', month: 'numeric', day: 'numeric',
        hour12: false
      }).formatToParts(now);

      const parts: Record<string, number> = {};
      partsArr.forEach(({type, value}) => {
        if (type !== 'literal') parts[type] = parseInt(value);
      });

      const hour = parts.hour === 24 ? 0 : (parts.hour || 0);
      const minute = parts.minute || 0;
      const second = parts.second || 0;

      const jakartaTime = new Date(2000, 0, 1, hour, minute, second);
      
      let targetTime: Date;
      if (hour < 22) {
        // Target is 22:00:00 WIB (10 Malam)
        targetTime = new Date(2000, 0, 1, 22, 0, 0);
      } else {
        // Target is midnight 00:00:00 WIB
        targetTime = new Date(2000, 0, 2, 0, 0, 0);
      }

      const diff = Math.max(0, targetTime.getTime() - jakartaTime.getTime());
      const totalPeriodSec = hour < 22 ? 22 * 3600 : 2 * 3600;
      const currSec = hour < 22 ? (hour * 3600 + minute * 60 + second) : ((hour - 22) * 3600 + minute * 60 + second);
      const pct = Math.min(100, Math.max(0, (currSec / totalPeriodSec) * 100));

      setTimeRemainingMs(diff);
      setElapsedPercent(pct);
      setCurrentHour(hour);
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, []);

  const isTimeRestricted = useMemo(() => {
    return currentHour >= 22 && currentHour < 24;
  }, [currentHour]);

  const formatTime = (ms: number) => {
    if (ms <= 0) return { hours: '00', minutes: '00', seconds: '00' };
    const seconds = Math.floor((ms / 1000) % 60);
    const minutes = Math.floor((ms / (1000 * 60)) % 60);
    const hours = Math.floor((ms / (1000 * 60 * 60)) % 24);
    return {
      hours: String(hours).padStart(2, '0'),
      minutes: String(minutes).padStart(2, '0'),
      seconds: String(seconds).padStart(2, '0')
    };
  };

  const { hours, minutes, seconds } = formatTime(timeRemainingMs);

  useEffect(() => {
    const init = async () => {
      const s = await getSystemSettings();
      setSettings(s);
      await archiveOldPosts(); // Auto archive old posts on mount

      if (activeView === 'riwayat') {
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    };
    init();
  }, []);

  const hasUserEditedStartNumberRef = useRef(hasUserEditedStartNumber);
  useEffect(() => {
    hasUserEditedStartNumberRef.current = hasUserEditedStartNumber;
  }, [hasUserEditedStartNumber]);

  // Real-time listener for posts & automatic next startNumber calculation
  useEffect(() => {
    setIsLoadingHistory(true);

    const processFetchedPosts = (fetchedPosts: BatchPost[]) => {
      const normalizeDate = (d: string) => {
        if (!d) return 'https://test-dashboard-lake-pi.vercel.app';
        const parts = d.split('-');
        if (parts.length !== 3) return d;
        if (parts[0].length === 2) return parts.reverse().join('-');
        return d;
      };

      const currentMonday = getWIBMonday(0);

      // Current week posts (date >= currentMonday and not archived)
      const weekPosts = fetchedPosts.filter(p => {
        const pDate = normalizeDate(p.date || '');
        return pDate >= currentMonday && !p.archived;
      });
      setAllCurrentWeekPosts(weekPosts);

      // Archived posts (archived flag true or date < currentMonday)
      const archivePosts = fetchedPosts.filter(p => {
        const pDate = normalizeDate(p.date || '');
        return p.archived || pDate < currentMonday;
      });
      setAllArchivedPosts(archivePosts);

      setIsLoadingHistory(false);
      setHasMore(false);
    };

    if (isManagement && (!selectedHistoryRecruiterId || selectedHistoryRecruiterId === 'ALL')) {
      const unsubscribe = subscribeToAllPosts((fetchedPosts) => {
        processFetchedPosts(fetchedPosts);
      }, 300);
      return () => unsubscribe();
    }

    const targetId = isManagement 
      ? selectedHistoryRecruiterId 
      : (userProfile?.telegramId || (telegramUser?.id ? String(telegramUser.id) : ''));

    if (!targetId) {
      setIsLoadingHistory(false);
      return () => {};
    }

    const unsubscribe = subscribeToRecruiterPosts(
      targetId,
      (fetchedPosts) => {
        processFetchedPosts(fetchedPosts);
      },
      100
    );

    return () => unsubscribe();
  }, [isManagement, selectedHistoryRecruiterId, userProfile?.telegramId, telegramUser?.id]);

  // Dedicated effect to calculate total links today and startNumber for the currently active recruiter
  useEffect(() => {
    if (!effectiveTelegramId) return;

    const normalizeDate = (d: string) => {
      if (!d) return 'https://test-dashboard-lake-pi.vercel.app';
      const parts = d.split('-');
      if (parts.length !== 3) return d;
      if (parts[0].length === 2) return parts.reverse().join('-');
      return d;
    };

    const today = getWIBDate();
    const normalizedToday = normalizeDate(today);

    // Filter today's posts for the active recruiter
    const todayPostsForRecruiter = allTodayPosts.filter(p => 
      String(p.telegramId) === String(effectiveTelegramId) && 
      normalizeDate(p.date || '') === normalizedToday && 
      !p.archived
    );

    const totalLinksToday = todayPostsForRecruiter.reduce((acc, post) => {
      const linkCount = Array.isArray(post.links) ? post.links.length : 0;
      return acc + linkCount;
    }, 0);

    setTodayPostingsCount(totalLinksToday);

    if (todayPostsForRecruiter.length === 0) {
      if (!hasUserEditedStartNumberRef.current) {
        setStartNumber(1);
      }
    } else if (!hasUserEditedStartNumberRef.current) {
      setStartNumber(totalLinksToday + 1);
    }
  }, [allTodayPosts, effectiveTelegramId, hasUserEditedStartNumber]);

  const resetToAutoStartNumber = () => {
    setHasUserEditedStartNumber(false);
    hasUserEditedStartNumberRef.current = false;
    const normalizeDate = (d: string) => {
      if (!d) return 'https://test-dashboard-lake-pi.vercel.app';
      const parts = d.split('-');
      if (parts.length !== 3) return d;
      if (parts[0].length === 2) return parts.reverse().join('-');
      return d;
    };
    const today = getWIBDate();
    const normalizedToday = normalizeDate(today);
    const todayPosts = allCurrentWeekPosts.filter(p => normalizeDate(p.date || '') === normalizedToday && !p.archived);
    if (todayPosts.length > 0) {
      const totalLinksToday = todayPosts.reduce((acc, post) => {
        const linkCount = Array.isArray(post.links) ? post.links.length : 0;
        return acc + linkCount;
      }, 0);
      setStartNumber(totalLinksToday + 1);
    } else {
      setStartNumber(1);
    }
  };

  // Sync displayed posts based on activeView, historySubTab & selectedDay
  useEffect(() => {
    if (activeView === 'riwayat') {
      if (historySubTab === 'minggu_ini') {
        setPosts(allCurrentWeekPosts.filter(p => getIndonesianDayName(p.date || '') === selectedDay));
      } else if (historySubTab === 'arsip') {
        setPosts(allArchivedPosts);
      }
    }
  }, [activeView, historySubTab, selectedDay, allCurrentWeekPosts, allArchivedPosts]);

  const fetchHistory = async (reset: boolean = false) => {
    // Legacy fetch logic replaced by onSnapshot
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const currentCount = images.length;
    const selectedCount = files.length;

    if (currentCount >= 10) {
      showAlert(
        'warning',
        'Batas Maksimal Foto',
        'Anda sudah mengunggah 10 foto screenshot. Hapus beberapa foto jika ingin menambah yang baru.'
      );
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    if (currentCount + selectedCount > 10) {
      showAlert(
        'warning',
        'Maksimal 10 Foto Screenshot',
        `Anda memilih ${selectedCount} foto, tetapi sisa slot hanya ${10 - currentCount}. Hanya ${10 - currentCount} foto pertama yang ditambahkan.`
      );
    }

    const remainingSlots = 10 - currentCount;
    const filesToProcess = Array.from(files).slice(0, remainingSlots);

    filesToProcess.forEach(file => {
      const reader = new FileReader();
      reader.onloadend = () => {
        setImages(prev => {
          if (prev.length >= 10) return prev;
          return [...prev, reader.result as string];
        });
      };
      reader.readAsDataURL(file);
    });

    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const removeImage = (index: number) => {
    setImages(prev => prev.filter((_, i) => i !== index));
    triggerHaptic('impact', 'light');
  };

  const updateLink = (index: number, url: string) => {
    const newLinks = [...links];
    let platform = newLinks[index].platform;
    
    const lowUrl = url.toLowerCase();
    if (lowUrl.includes('facebook.com') || lowUrl.includes('fb.com') || lowUrl.includes('fb.watch')) {
      platform = 'Facebook';
    } else if (lowUrl.includes('x.com') || lowUrl.includes('twitter.com')) {
      platform = 'X (Twitter)';
    } else if (lowUrl.includes('instagram.com') || lowUrl.includes('instagr.am')) {
      platform = 'Instagram';
    } else if (lowUrl.includes('tiktok.com')) {
      platform = 'TikTok';
    } else if (lowUrl.includes('threads.net')) {
      platform = 'Threads';
    } else if (lowUrl.includes('wa.me') || lowUrl.includes('whatsapp.com')) {
      platform = 'WhatsApp';
    } else if (lowUrl.includes('t.me') || lowUrl.includes('telegram.me')) {
      platform = 'Telegram';
    }
    
    newLinks[index] = { url, platform };
    setLinks(newLinks);
  };

  const updatePlatform = (index: number, platform: SocialPlatform) => {
    const newLinks = [...links];
    newLinks[index] = { ...newLinks[index], platform };
    setLinks(newLinks);
    triggerHaptic('selection');
  };

  const removeLink = (index: number) => {
    setLinks(prev => prev.filter((_, i) => i !== index));
    triggerHaptic('impact', 'light');
  };

  const compressImage = (base64: string, quality: number = 0.7): Promise<string> => {
    return new Promise((resolve) => {
      const img = new Image();
      img.src = base64;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        
        let width = img.width;
        let height = img.height;
        const maxDim = 1280;
        
        if (width > height) {
          if (width > maxDim) {
            height *= maxDim / width;
            width = maxDim;
          }
        } else {
          if (height > maxDim) {
            width *= maxDim / height;
            height = maxDim;
          }
        }
        
        canvas.width = width;
        canvas.height = height;
        ctx?.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', quality));
      };
    });
  };

  const handleSubmit = async () => {
    if (isUploading) return;

    if (isTimeRestricted) {
      showAlert('warning', 'Pengiriman Ditutup', 'Pengiriman ditutup antara pukul 22:00 WIB dan 00:00 WIB.');
      return;
    }

    if (isTargetReached) {
      showAlert('warning', 'Target Sudah Selesai 🎉', 'Target postingan harian Anda sudah tercapai. Formulir postingan ditutup otomatis.');
      return;
    }

    if (images.length !== 10) {
      showAlert('warning', 'Jumlah Foto Tidak Sesuai', `Anda wajib mengunggah tepat 10 foto screenshot postingan (kurang dari 10 tidak diperbolehkan). Saat ini: ${images.length} foto.`);
      setFormStep('upload');
      return;
    }

    const validLinks = links.filter(l => l.url.trim() !== '');
    if (validLinks.length !== 10) {
      showAlert('warning', 'Jumlah Link Tidak Sesuai', `Anda wajib memasukkan tepat 10 link postingan valid. Saat ini baru ada ${validLinks.length} link.`);
      return;
    }

    // 1. Check internal batch duplicates (within current links)
    const normalizedBatch = validLinks.map(l => normalizeUrl(l.url));
    const batchDuplicates = normalizedBatch.filter((url, idx) => normalizedBatch.indexOf(url) !== idx);
    if (batchDuplicates.length > 0) {
      showAlert(
        'error',
        'Terdapat Link Duplikat di Formulir',
        'Terdapat URL link yang sama dimasukkan lebih dari sekali dalam input di atas. Mohon pastikan semua link berbeda.'
      );
      triggerHaptic('notification', 'error');
      return;
    }

    // 2. Check duplicates against submitted database posts
    const databaseDuplicates = validLinks.filter(l => submittedUrlSet.has(normalizeUrl(l.url)));
    if (databaseDuplicates.length > 0) {
      showAlert(
        'error',
        'Terdapat Link Duplikat dengan Database',
        `Terdapat ${databaseDuplicates.length} link yang sudah pernah dikirim sebelumnya hari ini atau minggu ini. Mohon periksa dan ganti link yang terduplikasi.`
      );
      triggerHaptic('notification', 'error');
      return;
    }

    setIsUploading(true);
    setStatus({ type: 'idle' });
    triggerHaptic('impact', 'medium');

    try {
      const selectedRec = isManagement ? recruiters.find(r => String(r.telegramId) === String(selectedRecruiterId)) : null;
      const recruiterName = selectedRec 
        ? `${selectedRec.firstName} ${selectedRec.lastName || ''}`.trim()
        : (userProfile ? `${userProfile.firstName} ${userProfile.lastName || ''}`.trim() : `${telegramUser?.first_name || ''} ${telegramUser?.last_name || ''}`.trim() || 'Recruiter');
      const recruiterUsername = selectedRec
        ? (selectedRec.username || '')
        : (userProfile?.username || telegramUser?.username || '');
      const recruiterTelegramId = effectiveTelegramId;
      
      // Compress all images separately
      setStatus({ type: 'idle', message: 'Sedang mengompres gambar...' });
      const compressedImages = await Promise.all(images.map(img => compressImage(img)));
      
      let currentSettings = settings;
      if (!currentSettings || !currentSettings.telegramGroupId) {
        try {
          const sys = await getSystemSettings();
          if (sys) currentSettings = sys;
        } catch (sysErr) {
          console.warn('[Postingan] Fallback fetch system settings error:', sysErr);
        }
      }

      const effectiveStartNum = typeof startNumber === 'number' && startNumber >= 1 ? startNumber : 1;

      let sendSuccess = false;

      // 1. Try backend server endpoint if API_BASE_URL is configured
      if (API_BASE_URL !== undefined) {
        try {
          const response = await fetch(`${API_BASE_URL}/api/telegram/send-post`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              links: validLinks.map(l => l.url),
              startNumber: effectiveStartNum,
              images: compressedImages,
              recruiterName,
              recruiterUsername,
              groupId: currentSettings?.telegramGroupId || '',
              topicId: currentSettings?.telegramTopicPosting || '',
              botToken: currentSettings?.telegramBotToken || ''
            })
          });

          const contentType = response.headers.get('content-type');
          if (contentType && contentType.includes('application/json')) {
            const result = await response.json();
            if (result.success) {
              sendSuccess = true;
            } else if (result.error) {
              console.warn('[Postingan] Backend response error:', result.error);
            }
          }
        } catch (err) {
          console.warn('[Postingan] Backend API unavailable, attempting direct Telegram API fallback:', err);
        }
      }

      // 2. Direct Telegram API fallback (Works on Firebase static hosting without Vercel or Node backend)
      if (!sendSuccess) {
        const token = currentSettings?.telegramBotToken;
        let targetGroup = String(currentSettings?.telegramGroupId || '').trim();
        const targetTopic = currentSettings?.telegramTopicPosting;

        if (!token || !targetGroup) {
          console.warn('[Postingan] Token Bot Telegram atau Group ID belum dikonfigurasi di Pengaturan. Melewati pengiriman ke Telegram.');
          sendSuccess = true;
        } else {
          if (!targetGroup.startsWith('-100') && !targetGroup.startsWith('@')) {
            if (!targetGroup.startsWith('-')) targetGroup = '-100' + targetGroup;
            else targetGroup = '-100' + targetGroup.substring(1);
          }
          const topicNum = targetTopic && !isNaN(Number(targetTopic)) ? Number(targetTopic) : undefined;

          let textContent = `📌 <b>LINK POSTINGAN BARU</b>\n\n`;
          textContent += `👤 <b>Recruiter:</b> ${recruiterName} (${recruiterUsername ? formatUsername(recruiterUsername) : '-'})\n`;
          textContent += `📊 <b>Jumlah Link:</b> ${validLinks.length}\n\n`;
          validLinks.forEach((l, idx) => {
            textContent += `${effectiveStartNum + idx}. ${l.url}\n`;
          });

          if (compressedImages && compressedImages.length > 0) {
            let mediaResult;
            if (compressedImages.length === 1) {
              const fetchRes = await fetch(compressedImages[0]);
              const blob = await fetchRes.blob();
              const formData = new FormData();
              formData.append('chat_id', targetGroup);
              if (topicNum) formData.append('message_thread_id', String(topicNum));
              formData.append('photo', blob, 'image.jpg');

              let tgRes = await fetch(`https://api.telegram.org/bot${token}/sendPhoto`, {
                method: 'POST',
                body: formData
              });
              mediaResult = await tgRes.json();

              if (!mediaResult.ok && topicNum && mediaResult.description && (
                mediaResult.description.toLowerCase().includes('thread') ||
                mediaResult.description.toLowerCase().includes('topic') ||
                mediaResult.description.toLowerCase().includes('message_thread_id')
              )) {
                formData.delete('message_thread_id');
                tgRes = await fetch(`https://api.telegram.org/bot${token}/sendPhoto`, {
                  method: 'POST',
                  body: formData
                });
                mediaResult = await tgRes.json();
              }
            } else {
              const formData = new FormData();
              formData.append('chat_id', targetGroup);
              if (topicNum) formData.append('message_thread_id', String(topicNum));
              
              const mediaArray = [];
              for (let i = 0; i < compressedImages.length; i++) {
                const fetchRes = await fetch(compressedImages[i]);
                const blob = await fetchRes.blob();
                const fileKey = `photo${i}`;
                formData.append(fileKey, blob, `post_${Date.now()}_${i}.jpg`);
                mediaArray.push({
                  type: 'photo',
                  media: `attach://${fileKey}`
                });
              }
              formData.append('media', JSON.stringify(mediaArray));
              
              let tgRes = await fetch(`https://api.telegram.org/bot${token}/sendMediaGroup`, {
                method: 'POST',
                body: formData
              });
              mediaResult = await tgRes.json();

              if (!mediaResult.ok && topicNum && mediaResult.description && (
                mediaResult.description.toLowerCase().includes('thread') ||
                mediaResult.description.toLowerCase().includes('topic') ||
                mediaResult.description.toLowerCase().includes('message_thread_id')
              )) {
                formData.delete('message_thread_id');
                tgRes = await fetch(`https://api.telegram.org/bot${token}/sendMediaGroup`, {
                  method: 'POST',
                  body: formData
                });
                mediaResult = await tgRes.json();
              }
            }
            
            if (!mediaResult.ok) {
              throw new Error(`Telegram Error: ${mediaResult.description || 'Gagal mengirim gambar ke Telegram'}`);
            }
            
            let textRes = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                chat_id: targetGroup,
                message_thread_id: topicNum,
                text: textContent,
                parse_mode: 'HTML',
                link_preview_options: { is_disabled: true }
              })
            });
            let textData = await textRes.json();

            if (!textData.ok && topicNum && textData.description && (
              textData.description.toLowerCase().includes('thread') ||
              textData.description.toLowerCase().includes('topic') ||
              textData.description.toLowerCase().includes('message_thread_id')
            )) {
              textRes = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  chat_id: targetGroup,
                  text: textContent,
                  parse_mode: 'HTML',
                  link_preview_options: { is_disabled: true }
                })
              });
              textData = await textRes.json();
            }

            if (!textData.ok) {
              throw new Error(`Telegram Error: ${textData.description || 'Gagal mengirim pesan ke Telegram'}`);
            }
            sendSuccess = true;
          } else {
            let tgRes = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                chat_id: targetGroup,
                message_thread_id: topicNum,
                text: textContent,
                parse_mode: 'HTML',
                link_preview_options: { is_disabled: true }
              })
            });
            let tgData = await tgRes.json();

            if (!tgData.ok && topicNum && tgData.description && (
              tgData.description.toLowerCase().includes('thread') ||
              tgData.description.toLowerCase().includes('topic') ||
              tgData.description.toLowerCase().includes('message_thread_id')
            )) {
              tgRes = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  chat_id: targetGroup,
                  text: textContent,
                  parse_mode: 'HTML',
                  link_preview_options: { is_disabled: true }
                })
              });
              tgData = await tgRes.json();
            }

            if (!tgData.ok) {
              throw new Error(`Telegram Error: ${tgData.description || 'Gagal mengirim pesan ke Telegram'}`);
            }
            sendSuccess = true;
          }
        }
      }

      if (sendSuccess) {
        const newPostData = {
          telegramId: recruiterTelegramId,
          username: recruiterUsername,
          name: recruiterName,
          date: getWIBDate(),
          startNumber: effectiveStartNum,
          links: validLinks.map(l => l.url),
          platforms: validLinks.map(l => l.platform)
        };

        const newTotalPostings = todayPostingsCount + validLinks.length;
        const isNowFinished = !targetRule.isFree && targetRule.required > 0 && newTotalPostings >= targetRule.required;

        await createPost(newPostData);

        setStatus({ type: 'success', message: 'Batch Berhasil Dikirim!' });
        if (isNowFinished) {
          showAlert(
            'success',
            'Selamat! Target Postingan Selesai! 🎉',
            `Luar biasa! Batch postingan (${validLinks.length} link & ${images.length} foto) telah berhasil terkirim. Total postingan Anda hari ini telah mencapai target (${newTotalPostings} / ${targetRule.required} postingan). Formulir postingan kini ditutup otomatis.`
          );
        } else {
          showAlert(
            'success',
            'Data Berhasil Terkirim! 🎉',
            `Batch postingan (${validLinks.length} link & ${images.length} foto screenshot) telah berhasil tersimpan dan terkirim.`
          );
        }
        
        setLinks([]);
        setBulkText('');
        setIsReviewingLinks(false);
        setIsConfirmed(false);
        setImages([]);
        setFormStep('upload');
        setHasUserEditedStartNumber(false);
        hasUserEditedStartNumberRef.current = false;
        triggerHaptic('notification', 'success');
        
        // Switch view to Riwayat Posts automatically
        setActiveView('riwayat');
        setHistorySubTab('minggu_ini');
      } else {
        throw new Error('Gagal mengirim postingan ke Telegram. Mohon periksa Token Bot dan Group ID di Pengaturan.');
      }
    } catch (err) {
      console.error('[Postingan] Error submitting:', err);
      const errMsg = err instanceof Error ? err.message : 'Gagal mengirim postingan.';
      setStatus({ type: 'error', message: errMsg });
      showAlert('error', 'Gagal Mengirim Data', errMsg);
      triggerHaptic('notification', 'error');
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="pb-24 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col gap-4">
        {/* Unified Daily Dashboard (Timer & Target Progress combined) */}
        <GlassCard className="p-4 border-slate-200/80 dark:border-slate-800/80 bg-white/80 dark:bg-slate-950/80 overflow-hidden relative shadow-xl space-y-4">
          {/* Subtle Background Accent */}
          <div className="absolute top-0 right-0 p-2 opacity-10 pointer-events-none">
            <Sparkles className="w-16 h-16 text-amber-500/30" />
          </div>

          {/* Top Header Row */}
          <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800/60 pb-3 flex-wrap gap-2 relative z-10">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-sky-500/10 border border-sky-500/20 flex items-center justify-center text-sky-600 dark:text-sky-400">
                <Target className="w-4 h-4 text-sky-600 dark:text-sky-400" />
              </div>
              <div>
                <h2 className="text-xs font-black text-slate-900 dark:text-white tracking-tight">Ringkasan Aktivitas Hari Ini</h2>
                <p className="text-[9.5px] text-slate-600 dark:text-slate-400 font-bold">{formatDateWithDay(getWIBDate())}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[8px] sm:text-[9px] font-black uppercase text-amber-700 dark:text-amber-400 bg-amber-500/10 px-2.5 py-1 rounded-lg border border-amber-500/20 flex items-center gap-1">
                <Timer className="w-3 h-3 animate-pulse" /> Batas: 22:00 WIB
              </span>
            </div>
          </div>

          {/* Main Content Grid: Left (Countdown) & Right (Target) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 relative z-10">
            {/* Left: Countdown Timer */}
            <div className="space-y-3 bg-slate-50 dark:bg-slate-900/30 rounded-2xl border border-slate-200/80 dark:border-slate-800/40 p-3.5 flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="text-[9.5px] font-black text-slate-600 dark:text-slate-400 uppercase tracking-wider">Sisa Waktu Kerja</span>
                <span className="text-[8px] sm:text-[9px] font-black text-amber-700 dark:text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
                  {Math.round(elapsedPercent)}% Berjalan
                </span>
              </div>
              
              <div className="flex items-center gap-2 justify-center font-mono py-1">
                <div className="text-center">
                  <span className="text-2xl font-black text-slate-900 dark:text-white tracking-tighter tabular-nums">{hours}</span>
                  <span className="block text-[6.5px] sm:text-[7px] font-black text-slate-500 dark:text-slate-400 uppercase -mt-0.5 font-sans">Jam</span>
                </div>
                <span className="text-lg font-black text-slate-600 dark:text-slate-400">:</span>
                <div className="text-center">
                  <span className="text-2xl font-black text-slate-900 dark:text-white tracking-tighter tabular-nums">{minutes}</span>
                  <span className="block text-[6.5px] sm:text-[7px] font-black text-slate-500 dark:text-slate-400 uppercase -mt-0.5 font-sans">Menit</span>
                </div>
                <span className="text-lg font-black text-slate-600 dark:text-slate-400">:</span>
                <div className="text-center">
                  <span className="text-2xl font-black text-amber-600 dark:text-amber-400 tracking-tighter tabular-nums">{seconds}</span>
                  <span className="block text-[6.5px] sm:text-[7px] font-black text-slate-500 dark:text-slate-400 uppercase -mt-0.5 font-sans">Detik</span>
                </div>
              </div>

              <div className="w-full h-1.5 bg-slate-200 dark:bg-slate-950 rounded-full overflow-hidden border border-slate-300 dark:border-slate-900/60 p-0.5">
                <motion.div 
                  initial={{ width: 0 }}
                  animate={{ width: `${elapsedPercent}%` }}
                  className="h-full bg-gradient-to-r from-amber-600 to-amber-400 rounded-full"
                />
              </div>
            </div>

            {/* Right: Target Posting Tracker */}
            <div className="space-y-3.5 bg-slate-50 dark:bg-slate-900/30 rounded-2xl border border-slate-200/80 dark:border-slate-800/40 p-3.5 flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="text-[9.5px] font-black text-slate-600 dark:text-slate-400 uppercase tracking-wider">Target Postingan</span>
                <span className={`text-[8.5px] sm:text-[9px] font-black px-2 py-0.5 rounded-lg border ${
                  targetRule.isFree 
                    ? 'text-emerald-700 dark:text-emerald-400 bg-emerald-500/10 border-emerald-500/20' 
                    : 'text-sky-700 dark:text-sky-400 bg-sky-500/10 border-sky-500/20'
                }`}>
                  {targetRule.label}
                </span>
              </div>

              {/* Status Mini Cards */}
              <div className="grid grid-cols-2 gap-2">
                <div className="bg-white dark:bg-slate-950/60 border border-slate-200 dark:border-slate-900 rounded-xl p-2 text-center">
                  <span className="text-[7.5px] sm:text-[8px] font-black text-slate-500 dark:text-slate-400 uppercase block tracking-wider">Rekrutan Hari Ini</span>
                  <span className="text-xs sm:text-sm font-black text-emerald-600 dark:text-emerald-400 block mt-0.5">{todayRecruits} Orang</span>
                </div>
                <div className="bg-white dark:bg-slate-950/60 border border-slate-200 dark:border-slate-900 rounded-xl p-2 text-center">
                  <span className="text-[7.5px] sm:text-[8px] font-black text-slate-500 dark:text-slate-400 uppercase block tracking-wider">Telah Diposting</span>
                  <span className="text-xs sm:text-sm font-black text-slate-900 dark:text-white block mt-0.5">
                    {todayPostingsCount} {targetRule.isFree ? '' : `/ ${targetRule.required}`}
                  </span>
                </div>
              </div>

              {/* Progress Bar */}
              {!targetRule.isFree ? (
                <div className="space-y-1">
                  <div className="flex items-center justify-between text-[8px] sm:text-[9px] font-bold">
                    <span className="text-slate-500 dark:text-slate-400">Progres Target</span>
                    <span className={todayPostingsCount >= targetRule.required ? 'text-emerald-600 dark:text-emerald-400 font-black' : 'text-amber-600 dark:text-amber-400 font-black'}>
                      {todayPostingsCount >= targetRule.required 
                        ? 'Target Selesai ✅' 
                        : `Kurang ${targetRule.required - todayPostingsCount} link`}
                    </span>
                  </div>
                  <div className="w-full h-1.5 bg-slate-200 dark:bg-slate-950 rounded-full overflow-hidden border border-slate-300 dark:border-slate-900/60 p-0.5">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${Math.min(100, Math.round((todayPostingsCount / targetRule.required) * 100))}%` }}
                      className={`h-full rounded-full ${
                        todayPostingsCount >= targetRule.required 
                          ? 'bg-gradient-to-r from-emerald-500 to-teal-400' 
                          : 'bg-gradient-to-r from-sky-500 to-indigo-500'
                      }`}
                    />
                  </div>
                </div>
              ) : (
                <div className="py-1 px-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-700 dark:text-emerald-300 text-[8.5px] font-black uppercase tracking-tight text-center flex items-center justify-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-600 dark:text-emerald-400 shrink-0" />
                  Bebas Posting! (Rekrutan ≥ 3) 🎉
                </div>
              )}
            </div>
          </div>
        </GlassCard>

        {/* Header Section */}
        <div className="px-1 flex items-center justify-between mb-2">
          <div>
            <h1 className="text-xl font-black text-slate-900 dark:text-white flex items-center gap-2">
              <ImageIcon className="w-6 h-6 text-sky-600 dark:text-sky-400" />
              Batch Postingan
            </h1>
          </div>
        </div>

        {/* Main Navigation Tabs */}
        <div 
          style={{ top: 'calc(60px + env(safe-area-inset-top, 0px))' }}
          className="sticky z-30 flex p-1.5 bg-slate-200/90 dark:bg-slate-950/95 backdrop-blur-md rounded-2xl border border-slate-300 dark:border-slate-800/80 shadow-2xl mb-4 overflow-x-auto no-scrollbar scroll-smooth"
        >
          <button
            onClick={() => { setActiveView('buat'); triggerHaptic('selection'); }}
            className={`shrink-0 flex-1 flex items-center justify-center gap-1.5 h-10 rounded-xl text-[10px] font-black uppercase transition-all ${
              activeView === 'buat' 
                ? 'bg-sky-500 text-slate-950 shadow-lg scale-[1.02]' 
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <Plus className="w-3.5 h-3.5" />
            Buat
          </button>
          <button
            onClick={() => { setActiveView('riwayat'); triggerHaptic('selection'); }}
            className={`shrink-0 flex-1 flex items-center justify-center gap-1.5 h-10 rounded-xl text-[10px] font-black uppercase transition-all ${
              activeView === 'riwayat' 
                ? 'bg-sky-500 text-slate-950 shadow-lg scale-[1.02]' 
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <Calendar className="w-3.5 h-3.5" />
            Riwayat & Arsip
          </button>
          {isManagement && (
            <button
              onClick={() => { setActiveView('status'); triggerHaptic('selection'); }}
              className={`shrink-0 flex-1 flex items-center justify-center gap-1.5 h-10 rounded-xl text-[10px] font-black uppercase transition-all ${
                activeView === 'status' 
                  ? 'bg-emerald-500 text-slate-950 shadow-lg scale-[1.02]' 
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <Users className="w-3.5 h-3.5" />
              Status
            </button>
          )}
        </div>

        {activeView === 'buat' && (
          <motion.div
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            className="space-y-4"
          >
            {/* Panduan & Cara Kerja Postingan (Detailed Guide Card) */}
            <GlassCard className="p-4 bg-white/90 dark:bg-slate-950/90 border-slate-200 dark:border-slate-800 shadow-xl space-y-3 relative overflow-hidden">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-sky-500/10 border border-sky-500/20 flex items-center justify-center shrink-0 text-sky-600 dark:text-sky-400">
                    <BookOpen className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-xs font-black text-slate-900 dark:text-white tracking-tight flex items-center gap-1.5">
                      Panduan & Cara Kerja Postingan
                    </h3>
                    <p className="text-[10px] text-slate-600 dark:text-slate-400 font-medium">
                      Pelajari aturan target, alur pengerjaan, dan tips hasil terbaik
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
                <div className="space-y-3 pt-1 border-t border-slate-200 dark:border-slate-800/80">
                  {/* Segmented Guide Tabs */}
                  <div className="flex p-0.5 bg-slate-100 dark:bg-slate-900/90 rounded-xl border border-slate-200 dark:border-slate-800/80">
                    <button
                      type="button"
                      onClick={() => { setGuideTab('aturan'); triggerHaptic('selection'); }}
                      className={`flex-1 py-1.5 rounded-lg text-[9.5px] font-black uppercase transition-all flex items-center justify-center gap-1 ${
                        guideTab === 'aturan'
                          ? 'bg-sky-500 text-slate-950 shadow-sm'
                          : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                      }`}
                    >
                      <Target className="w-3 h-3" />
                      1. Aturan Target
                    </button>
                    <button
                      type="button"
                      onClick={() => { setGuideTab('buat'); triggerHaptic('selection'); }}
                      className={`flex-1 py-1.5 rounded-lg text-[9.5px] font-black uppercase transition-all flex items-center justify-center gap-1 ${
                        guideTab === 'buat'
                          ? 'bg-sky-500 text-slate-950 shadow-sm'
                          : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                      }`}
                    >
                      <ListOrdered className="w-3 h-3" />
                      2. Cara Buat
                    </button>
                    <button
                      type="button"
                      onClick={() => { setGuideTab('riwayat_status'); triggerHaptic('selection'); }}
                      className={`flex-1 py-1.5 rounded-lg text-[9.5px] font-black uppercase transition-all flex items-center justify-center gap-1 ${
                        guideTab === 'riwayat_status'
                          ? 'bg-amber-500 text-slate-950 shadow-sm'
                          : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                      }`}
                    >
                      <History className="w-3 h-3" />
                      3. Fitur Lainnya
                    </button>
                  </div>

                  {/* Tab Content: Aturan Target */}
                  {guideTab === 'aturan' && (
                    <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800/60 space-y-3 text-[11px] text-slate-700 dark:text-slate-300 leading-relaxed">
                      <div className="flex items-start gap-2 text-sky-700 dark:text-sky-300 font-black">
                        <Info className="w-4 h-4 text-sky-600 dark:text-sky-400 shrink-0 mt-0.5" />
                        <span>Ketentuan Beban Target Postingan Harian:</span>
                      </div>
                      <p className="text-[10px] text-slate-600 dark:text-slate-400 font-medium">
                        Sistem secara otomatis menghitung rekrutan hari ini dari menu <strong className="text-slate-900 dark:text-white">Data Harian</strong> untuk menentukan kuota postingan minimal yang wajib Anda penuhi setiap hari:
                      </p>
                      <ul className="space-y-2 pl-0.5 text-[10px]">
                        <li className="flex items-center gap-2.5 p-2 rounded-xl bg-white dark:bg-slate-950 border border-rose-200 dark:border-rose-900/50 text-slate-700 dark:text-slate-300 shadow-sm">
                          <span className="w-2.5 h-2.5 rounded-full bg-rose-500 shrink-0" />
                          <span><strong className="text-slate-900 dark:text-white">0 Rekrutan Hari Ini:</strong> Wajib memposting minimal <strong className="text-rose-600 dark:text-rose-400 font-black">90 link postingan</strong>.</span>
                        </li>
                        <li className="flex items-center gap-2.5 p-2 rounded-xl bg-white dark:bg-slate-950 border border-amber-200 dark:border-amber-900/50 text-slate-700 dark:text-slate-300 shadow-sm">
                          <span className="w-2.5 h-2.5 rounded-full bg-amber-500 shrink-0" />
                          <span><strong className="text-slate-900 dark:text-white">1 Rekrutan Hari Ini:</strong> Kuota berkurang, wajib memposting minimal <strong className="text-amber-600 dark:text-amber-400 font-black">60 link postingan</strong>.</span>
                        </li>
                        <li className="flex items-center gap-2.5 p-2 rounded-xl bg-white dark:bg-slate-950 border border-sky-200 dark:border-sky-900/50 text-slate-700 dark:text-slate-300 shadow-sm">
                          <span className="w-2.5 h-2.5 rounded-full bg-sky-500 shrink-0" />
                          <span><strong className="text-slate-900 dark:text-white">2 Rekrutan Hari Ini:</strong> Kuota berkurang signifikan, wajib memposting minimal <strong className="text-sky-600 dark:text-sky-400 font-black">30 link postingan</strong>.</span>
                        </li>
                        <li className="flex items-center gap-2.5 p-2 rounded-xl bg-white dark:bg-slate-950 border border-emerald-200 dark:border-emerald-900/50 text-slate-700 dark:text-slate-300 shadow-sm">
                          <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shrink-0" />
                          <span><strong className="text-slate-900 dark:text-white">3+ Rekrutan Hari Ini:</strong> Bebas! Target tercapai 100%, Anda dibebaskan dari kewajiban memposting link hari ini.</span>
                        </li>
                      </ul>
                      <div className="p-2.5 rounded-xl bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-[9.5px] text-slate-600 dark:text-slate-400 flex flex-wrap gap-2 items-center justify-between font-medium">
                        <span>⏰ Batas Pengiriman Harian: <strong className="text-slate-900 dark:text-white">22:00 WIB</strong></span>
                        <span>🔄 Reset Otomatis Sistem: <strong className="text-slate-900 dark:text-white">00:00 WIB</strong></span>
                      </div>
                    </div>
                  )}

                  {/* Tab Content: Cara Buat Postingan */}
                  {guideTab === 'buat' && (
                    <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800/60 space-y-3 text-[11px] text-slate-700 dark:text-slate-300">
                      <div className="flex items-center gap-2 text-sky-700 dark:text-sky-300 font-black">
                        <CheckSquare className="w-4 h-4 text-sky-600 dark:text-sky-400 shrink-0" />
                        <span>Cara Pengisian Form Postingan (Aturan 10/10):</span>
                      </div>
                      <p className="text-[10px] text-slate-600 dark:text-slate-400 font-medium">
                        Gunakan halaman ini untuk melaporkan link iklan lowongan kerja yang Anda sebar di media sosial dengan ketentuan wajib 10 link dan 10 bukti screenshot:
                      </p>
                      <ol className="space-y-3 text-[10px] text-slate-700 dark:text-slate-300">
                        <li className="flex items-start gap-2.5">
                          <span className="w-5 h-5 rounded-full bg-sky-100 dark:bg-sky-950 text-sky-700 dark:text-sky-400 font-black flex items-center justify-center shrink-0 text-[10px] border border-sky-200 dark:border-sky-900/40">1</span>
                          <div>
                            <strong className="text-slate-900 dark:text-white block mb-0.5">Nomor Awal Otomatis:</strong> 
                            Sistem menghitung otomatis nomor urutan link berikutnya secara akurat berdasarkan riwayat postingan Anda. Bagian ini dikunci agar urutan penomoran selalu tepat dan berurutan.
                          </div>
                        </li>
                        <li className="flex items-start gap-2.5">
                          <span className="w-5 h-5 rounded-full bg-sky-100 dark:bg-sky-950 text-sky-700 dark:text-sky-400 font-black flex items-center justify-center shrink-0 text-[10px] border border-sky-200 dark:border-sky-900/40">2</span>
                          <div>
                            <strong className="text-slate-900 dark:text-white block mb-0.5">Upload 10 Screenshot Bukti (Wajib):</strong> 
                            Anda wajib mengunggah <strong className="text-rose-600 dark:text-rose-400">tepat 10 foto screenshot</strong> sebagai bukti hasil postingan Anda. Jika kurang dari 10 foto, sistem akan menolak pengiriman.
                          </div>
                        </li>
                        <li className="flex items-start gap-2.5">
                          <span className="w-5 h-5 rounded-full bg-sky-100 dark:bg-sky-950 text-sky-700 dark:text-sky-400 font-black flex items-center justify-center shrink-0 text-[10px] border border-sky-200 dark:border-sky-900/40">3</span>
                          <div>
                            <strong className="text-slate-900 dark:text-white block mb-0.5">Wajib 10 Link URL Postingan:</strong> 
                            Anda wajib memasukkan <strong className="text-rose-600 dark:text-rose-400">tepat 10 link postingan</strong>. Bila sudah mencapai 10 link, Anda tidak bisa menambah lagi. Gunakan tombol <em className="text-sky-600 dark:text-sky-400 font-bold not-italic">+ Tambah Link</em> atau input masal untuk melengkapi tepat 10 link.
                            <span className="text-rose-600 dark:text-rose-400 mt-1 block font-semibold">⚠️ Catatan: Hindari menyalin link yang sama (duplikat), karena sistem akan menolaknya otomatis demi keaslian data.</span>
                          </div>
                        </li>
                        <li className="flex items-start gap-2.5">
                          <span className="w-5 h-5 rounded-full bg-sky-100 dark:bg-sky-950 text-sky-700 dark:text-sky-400 font-black flex items-center justify-center shrink-0 text-[10px] border border-sky-200 dark:border-sky-900/40">4</span>
                          <div>
                            <strong className="text-slate-900 dark:text-white block mb-0.5">Kirim ke Telegram Secara Otomatis:</strong> 
                            Klik tombol <em className="text-sky-600 dark:text-sky-400 font-bold not-italic">Kirim ke Telegram</em>. Bot akan merangkum semua link Anda dengan format rapi dan mengirimkannya secara otomatis ke grup Telegram tim yang telah dikonfigurasi di menu Pengaturan. Riwayat postingan Anda juga langsung tercatat di database aplikasi.
                          </div>
                        </li>
                      </ol>
                    </div>
                  )}

                  {/* Tab Content: Riwayat & Status */}
                  {guideTab === 'riwayat_status' && (
                    <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800/60 space-y-3 text-[11px] text-slate-700 dark:text-slate-300">
                      <div className="flex items-center gap-2 text-amber-700 dark:text-amber-300 font-black">
                        <History className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
                        <span>Panduan Menu Riwayat & Status:</span>
                      </div>
                      <p className="text-[10px] text-slate-600 dark:text-slate-400 font-medium">
                        Halaman ini dilengkapi dengan pelacakan riwayat yang detail untuk membantu memantau kinerja harian:
                      </p>
                      <ul className="space-y-2.5 text-[10px] text-slate-700 dark:text-slate-300">
                        <li className="flex items-start gap-2.5 p-2 rounded-xl bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800/50 shadow-sm">
                          <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                          <div>
                            <strong className="text-slate-900 dark:text-white">Tab Riwayat Mingguan:</strong> 
                            Membantu Anda melacak daftar link postingan yang sudah berhasil Anda laporkan, terbagi berdasarkan hari (Senin - Minggu) di minggu berjalan. Anda juga dapat beralih ke sub-tab <strong className="text-slate-900 dark:text-white">Arsip</strong> untuk meninjau data minggu-minggu sebelumnya.
                          </div>
                        </li>
                        <li className="flex items-start gap-2.5 p-2 rounded-xl bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800/50 shadow-sm">
                          <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                          <div>
                            <strong className="text-slate-900 dark:text-white">Hak Akses Data:</strong> 
                            Sebagai recruiter, Anda hanya dapat melihat data laporan Anda sendiri demi privasi. Namun, pengguna dengan status <strong className="text-sky-600 dark:text-sky-400">Admin</strong> atau <strong className="text-amber-600 dark:text-amber-400">Owner</strong> memiliki wewenang untuk melihat riwayat postingan seluruh recruiter melalui menu pilihan akun yang tersedia.
                          </div>
                        </li>
                        {isManagement && (
                        <li className="flex items-start gap-2.5 p-2 rounded-xl bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800/50 shadow-sm">
                          <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                          <div>
                            <strong className="text-slate-900 dark:text-white">Menu Status Tim (Khusus Manajemen):</strong> 
                            Menyajikan dashboard pemantauan rekrutmen dan postingan harian seluruh anggota tim secara real-time. Memudahkan pemantauan siapa saja yang sudah atau belum memenuhi target beban kerjanya hari ini.
                          </div>
                        </li>
                        )}
                      </ul>
                    </div>
                  )}
                </div>
              )}
            </GlassCard>
            {isTimeRestricted ? (
              <GlassCard className="p-8 text-center space-y-6 border-rose-500/30 bg-rose-500/5 relative overflow-hidden py-12">
                <div className="absolute top-0 right-0 p-3 opacity-5">
                  <Clock className="w-32 h-32 text-rose-500" />
                </div>
                
                <div className="w-20 h-20 rounded-full bg-rose-500/10 border border-rose-500/30 flex items-center justify-center mx-auto text-rose-400 animate-pulse shadow-lg">
                  <Clock className="w-10 h-10" />
                </div>
                
                <div className="space-y-2 max-w-md mx-auto">
                  <h3 className="text-lg font-black text-slate-900 dark:text-white tracking-tight">
                    Pengiriman Postingan Ditutup 🔒
                  </h3>
                  <p className="text-xs text-rose-700 dark:text-rose-200/80 leading-relaxed font-medium">
                    Batas waktu pengiriman postingan harian adalah pukul <strong className="text-rose-300">22:00 WIB</strong>. 
                    Semua input pengiriman dikunci sementara dan akan otomatis dibuka kembali pada pukul <strong className="text-rose-300">00:00 WIB (Midnight)</strong>.
                  </p>
                </div>

                <div className="p-4 rounded-2xl bg-white dark:bg-slate-950/80 border border-slate-200 dark:border-slate-800/80 max-w-sm mx-auto shadow-inner">
                  <p className="text-[9px] font-black uppercase text-slate-500 dark:text-slate-400 tracking-wider mb-2">
                    Akan Dibuka Kembali Dalam:
                  </p>
                  <div className="flex items-center justify-center gap-2">
                    <div className="flex flex-col items-center">
                      <span className="text-2xl font-black text-rose-400 tracking-tighter">{hours}</span>
                      <span className="text-[7px] font-bold text-slate-500 dark:text-slate-400 uppercase mt-0.5">Jam</span>
                    </div>
                    <span className="text-lg font-black text-rose-500/40 -translate-y-1">:</span>
                    <div className="flex flex-col items-center">
                      <span className="text-2xl font-black text-rose-400 tracking-tighter">{minutes}</span>
                      <span className="text-[7px] font-bold text-slate-500 dark:text-slate-400 uppercase mt-0.5">Menit</span>
                    </div>
                    <span className="text-lg font-black text-rose-500/40 -translate-y-1">:</span>
                    <div className="flex flex-col items-center">
                      <span className="text-2xl font-black text-rose-400 tracking-tighter">{seconds}</span>
                      <span className="text-[7px] font-bold text-slate-500 dark:text-slate-400 uppercase mt-0.5">Detik</span>
                    </div>
                  </div>
                </div>

                <div className="pt-2">
                  <p className="text-[10px] text-slate-500 dark:text-slate-400 font-medium">
                    Silakan kembali lagi nanti untuk mengirimkan batch postingan baru Anda.
                  </p>
                </div>
              </GlassCard>
            ) : isTargetReached ? (
              <GlassCard className="p-8 text-center space-y-6 border-emerald-500/30 bg-emerald-500/5 relative overflow-hidden py-10 shadow-2xl">
                <div className="absolute top-0 right-0 p-3 opacity-10 pointer-events-none">
                  <Trophy className="w-40 h-40 text-emerald-400" />
                </div>

                <div className="w-20 h-20 rounded-3xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center mx-auto text-emerald-400 shadow-xl shadow-emerald-500/10 relative">
                  <Trophy className="w-10 h-10 animate-bounce" />
                  <span className="absolute -top-1 -right-1 flex h-4 w-4">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-4 w-4 bg-emerald-500"></span>
                  </span>
                </div>

                <div className="space-y-2 max-w-md mx-auto">
                  <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-[10px] font-black uppercase tracking-wider">
                    <Award className="w-3.5 h-3.5 text-emerald-400" />
                    Target Postingan Selesai 100% 🎉
                  </div>
                  <h3 className="text-xl font-black text-slate-900 dark:text-white tracking-tight">
                    Selamat! Target Hari Ini Telah Tercapai!
                  </h3>
                  <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed font-medium">
                    Luar biasa! Anda telah memposting <strong className="text-emerald-400">{todayPostingsCount} link</strong> dari target minimum <strong className="text-emerald-400">{targetRule.required} postingan</strong> (berdasarkan {todayRecruits} rekrutan di Data Harian).
                  </p>
                </div>

                {/* Summary Grid */}
                <div className="grid grid-cols-3 gap-2 max-w-md mx-auto p-3 rounded-2xl bg-white dark:bg-slate-950/80 border border-slate-200 dark:border-slate-800/80 shadow-inner">
                  <div className="p-2 text-center">
                    <p className="text-[8px] font-black text-slate-500 dark:text-slate-400 uppercase">Rekrutan Hari Ini</p>
                    <p className="text-xs font-black text-emerald-400 mt-0.5">{todayRecruits} Orang</p>
                  </div>
                  <div className="p-2 text-center border-x border-slate-200 dark:border-slate-800">
                    <p className="text-[8px] font-black text-slate-500 dark:text-slate-400 uppercase">Target Minimal</p>
                    <p className="text-xs font-black text-sky-400 mt-0.5">{targetRule.required} Link</p>
                  </div>
                  <div className="p-2 text-center">
                    <p className="text-[8px] font-black text-slate-500 dark:text-slate-400 uppercase">Telah Diposting</p>
                    <p className="text-xs font-black text-emerald-300 mt-0.5">{todayPostingsCount} Link</p>
                  </div>
                </div>

                <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 max-w-md mx-auto text-center space-y-1">
                  <p className="text-[11px] font-bold text-emerald-700 dark:text-emerald-200">
                    🔒 Formulir postingan ditutup otomatis untuk hari ini.
                  </p>
                  <p className="text-[9.5px] text-slate-600 dark:text-slate-400 font-medium">
                    Silakan beristirahat atau persiapkan materi postingan Anda untuk besok. Kerja bagus!
                  </p>
                </div>
              </GlassCard>
            ) : (
              <div className="space-y-4">
              {/* Step Navigation Bar */}
              <div className="flex items-center gap-2 p-1.5 rounded-2xl bg-white dark:bg-slate-950/85 border border-slate-200 dark:border-slate-800/80">
                <button
                  type="button"
                  onClick={() => {
                    setFormStep('upload');
                    triggerHaptic('selection');
                  }}
                  className={`flex-1 py-2 px-3 rounded-xl text-[10px] font-black uppercase transition-all flex items-center justify-center gap-2 border ${
                    formStep === 'upload'
                      ? 'bg-sky-500 text-slate-950 border-sky-400 shadow-md shadow-sky-500/20'
                      : 'bg-transparent text-slate-600 dark:text-slate-400 border-transparent hover:text-slate-900 dark:text-white'
                  }`}
                >
                  <Camera className="w-3.5 h-3.5" />
                  1. Upload SS ({images.length}/10)
                </button>

                <ArrowRight className="w-3.5 h-3.5 text-slate-600 shrink-0" />

                <button
                  type="button"
                  onClick={() => {
                    if (images.length < 10) {
                      showAlert(
                        'warning',
                        'Foto Kurang dari 10',
                        `Anda wajib mengunggah tepat 10 foto screenshot postingan (kurang dari 10 tidak diperbolehkan). Saat ini baru ada ${images.length} foto.`
                      );
                      return;
                    }
                    setFormStep('link');
                    triggerHaptic('selection');
                  }}
                  className={`flex-1 py-2 px-3 rounded-xl text-[10px] font-black uppercase transition-all flex items-center justify-center gap-2 border ${
                    formStep === 'link'
                      ? 'bg-sky-500 text-slate-950 border-sky-400 shadow-md shadow-sky-500/20'
                      : 'bg-transparent text-slate-600 dark:text-slate-400 border-transparent hover:text-slate-900 dark:text-white'
                  }`}
                >
                  <LinkIcon className="w-3.5 h-3.5" />
                  2. Tempel Link ({links.length})
                </button>
              </div>

              {/* Form Card */}
              <GlassCard className="p-4 space-y-6 bg-white dark:bg-slate-950/90 border-slate-200 dark:border-slate-800 shadow-xl">
                {/* Recruiter Selector for Admin & Owner in Create Post */}
                {isManagement && (
                  <div className="p-3 bg-slate-50 dark:bg-slate-900/60 rounded-2xl border border-amber-500/20 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-black uppercase text-amber-400 tracking-wider flex items-center gap-1.5">
                        <Users className="w-3.5 h-3.5 text-amber-400" />
                        Posting Atas Nama Recruiter:
                      </span>
                    </div>
                    <div className="relative">
                      {(() => {
                        const activeRec = recruiters.find(r => String(r.telegramId) === String(selectedRecruiterId));
                        return (
                          <button
                            type="button"
                            onClick={() => {
                              setIsBuatRecruiterDropdownOpen(!isBuatRecruiterDropdownOpen);
                              triggerHaptic('selection');
                            }}
                            className={`w-full flex items-center justify-between p-2 rounded-xl text-xs transition-all border ${
                              isBuatRecruiterDropdownOpen
                                ? 'bg-amber-500/10 border-amber-500/30 ring-1 ring-amber-500/20'
                                : 'bg-white dark:bg-slate-950/80 border-slate-200 dark:border-slate-800 shadow-sm hover:border-amber-500/30'
                            }`}
                          >
                            {activeRec ? (
                              <div className="flex items-center gap-2.5 min-w-0">
                                <div className="relative shrink-0">
                                  {activeRec.photoUrl ? (
                                    <img referrerPolicy="no-referrer" src={activeRec.photoUrl} alt={activeRec.firstName} className="w-7 h-7 rounded-full object-cover border border-amber-200 dark:border-amber-900/50 p-0.5 bg-amber-50 dark:bg-amber-900/20" />
                                  ) : (
                                    <div className="w-7 h-7 rounded-full bg-amber-100 dark:bg-amber-900/40 text-amber-600 dark:text-amber-400 font-black text-[10px] flex items-center justify-center border border-amber-200 dark:border-amber-900/50 p-0.5">
                                      {activeRec.firstName?.charAt(0).toUpperCase() || 'R'}
                                    </div>
                                  )}
                                </div>
                                <div className="text-left min-w-0">
                                  <div className="font-black text-xs text-slate-900 dark:text-white truncate">
                                    {activeRec.firstName} {activeRec.lastName || ''}
                                  </div>
                                  <div className="text-[9px] text-slate-500 dark:text-slate-400 font-medium truncate">
                                    {activeRec.username ? formatUsername(activeRec.username) : (activeRec.role === 'Admin' || activeRec.role === 'Owner' ? activeRec.role : 'Recruiter')}
                                  </div>
                                </div>
                              </div>
                            ) : (
                              <div className="flex items-center gap-2.5 min-w-0 text-slate-500">
                                <div className="w-7 h-7 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center border border-slate-200 dark:border-slate-700">
                                  <Users className="w-3.5 h-3.5 text-slate-400" />
                                </div>
                                <span className="font-medium text-xs">Pilih Recruiter...</span>
                              </div>
                            )}
                            <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${isBuatRecruiterDropdownOpen ? 'rotate-180 text-amber-500' : ''}`} />
                          </button>
                        );
                      })()}

                      {isBuatRecruiterDropdownOpen && (
                        <>
                          <div className="fixed inset-0 z-40" onClick={() => setIsBuatRecruiterDropdownOpen(false)} />
                          <div className="absolute left-0 right-0 top-full mt-2 z-50 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-200 max-h-[280px] overflow-y-auto overscroll-contain">
                            <div className="p-1.5 space-y-0.5">
                              {recruiters.map((rec) => {
                                const isSelected = String(selectedRecruiterId) === String(rec.telegramId);
                                return (
                                  <button
                                    key={rec.telegramId}
                                    type="button"
                                    onClick={() => {
                                      setSelectedRecruiterId(String(rec.telegramId));
                                      setIsBuatRecruiterDropdownOpen(false);
                                      triggerHaptic('selection');
                                    }}
                                    className={`w-full flex items-center justify-between p-2 rounded-xl text-xs transition-all ${
                                      isSelected
                                        ? 'bg-amber-500/10 text-amber-700 dark:text-amber-300 border border-amber-500/20 font-black'
                                        : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800/80 hover:text-slate-900 dark:hover:text-white border border-transparent'
                                    }`}
                                  >
                                    <div className="flex items-center gap-2.5 min-w-0">
                                      <div className="relative shrink-0">
                                        {rec.photoUrl ? (
                                          <img referrerPolicy="no-referrer" src={rec.photoUrl} alt={rec.firstName} className="w-8 h-8 rounded-full object-cover border border-slate-200 dark:border-slate-700 shadow-sm p-0.5 bg-slate-50 dark:bg-slate-800" />
                                        ) : (
                                          <div className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 font-black text-[11px] flex items-center justify-center border border-slate-200 dark:border-slate-700 shadow-sm p-0.5">
                                            {rec.firstName?.charAt(0).toUpperCase() || 'R'}
                                          </div>
                                        )}
                                      </div>
                                      <div className="text-left min-w-0">
                                        <div className="font-black text-xs text-slate-900 dark:text-white truncate">
                                          {rec.firstName} {rec.lastName || ''}
                                        </div>
                                        <div className="text-[9.5px] text-slate-500 dark:text-slate-400 font-medium truncate">
                                          {rec.username ? formatUsername(rec.username) : `ID: ${rec.telegramId}`}
                                        </div>
                                      </div>
                                    </div>
                                    {isSelected && (
                                      <CheckCircle2 className="w-4 h-4 text-amber-500 shrink-0" />
                                    )}
                                  </button>
                                );
                              })}
                              
                              {recruiters.length === 0 && (
                                <div className="p-4 text-center">
                                  <p className="text-[10px] text-slate-500 font-medium">Tidak ada recruiter yang tersedia.</p>
                                </div>
                              )}
                            </div>
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                )}



                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleImageUpload}
                  multiple
                  accept="image/*"
                  className="hidden"
                />

                {/* STEP 1: UPLOAD SCREENSHOTS FIRST */}
                {formStep === 'upload' && (
                  <motion.div
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 10 }}
                    className="space-y-5"
                  >
                    <div className="flex items-center justify-between px-1">
                      <div className="space-y-0.5">
                        <label className="text-[11px] font-black text-slate-700 dark:text-slate-300 uppercase tracking-wider flex items-center gap-2">
                          <Camera className="w-4 h-4 text-sky-400" />
                          Unggah Bukti Screenshot
                        </label>
                        <p className="text-[9px] text-slate-500 dark:text-slate-400 font-bold">
                          Wajib unggah tepat 10 foto screenshot postingan Anda.
                        </p>
                      </div>
                      <span className={`text-[9px] font-black px-2.5 py-1 rounded-xl border ${
                        images.length === 10
                          ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20'
                          : 'text-amber-400 bg-amber-500/10 border-amber-500/20'
                      }`}>
                        {images.length} / 10 Foto
                      </span>
                    </div>

                    {images.length === 0 ? (
                      <div 
                        onClick={() => fileInputRef.current?.click()}
                        className="group cursor-pointer aspect-video rounded-2xl border border-dashed border-slate-200 dark:border-slate-800 hover:border-sky-500/30 bg-white dark:bg-slate-950/40 flex flex-col items-center justify-center gap-3.5 transition-all duration-300 active:scale-[0.98] p-6 text-center"
                      >
                        <div className="w-12 h-12 rounded-xl bg-sky-500/5 border border-sky-500/10 flex items-center justify-center text-sky-400 group-hover:scale-105 group-hover:bg-sky-500/10 group-hover:border-sky-500/20 transition-all shadow-md">
                          <Upload className="w-6 h-6" />
                        </div>
                        <div className="space-y-1">
                          <p className="text-[11px] font-black text-slate-900 dark:text-white group-hover:text-sky-400 transition-colors">
                            Klik di sini untuk memilih foto screenshot
                          </p>
                          <p className="text-[9.5px] text-slate-500 dark:text-slate-400 font-semibold">
                            Format file didukung: JPG, PNG, WEBP (Maks. 10MB)
                          </p>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-4 animate-in fade-in duration-300">
                        <div className="flex gap-3 overflow-x-auto pb-4 snap-x custom-scrollbar">
                          <AnimatePresence mode="popLayout">
                            {images.map((img, idx) => (
                              <motion.div
                                key={`${idx}-${img.substring(0, 20)}`}
                                layout
                                initial={{ opacity: 0, scale: 0.9 }}
                                animate={{ opacity: 1, scale: 1 }}
                                exit={{ opacity: 0, scale: 0.9 }}
                                className="relative shrink-0 w-28 h-28 sm:w-32 sm:h-32 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/60 p-1.5 group shadow-md snap-start"
                              >
                                <img referrerPolicy="no-referrer" src={img} alt={`SS Postingan ${idx + 1}`} className="w-full h-full object-cover rounded-lg" />
                                <div className="absolute top-3 left-3 px-2 py-0.5 rounded-lg bg-black/85 backdrop-blur-md text-white text-[9px] font-black border border-white/10">
                                  #{idx + 1}
                                </div>
                                <button
                                  type="button"
                                  onClick={() => removeImage(idx)}
                                  className="absolute top-3 right-3 w-6 h-6 rounded-lg bg-black/85 backdrop-blur-md text-white hover:text-rose-400 flex items-center justify-center hover:bg-rose-500/20 border border-white/10 hover:border-rose-500/20 transition-all z-10"
                                >
                                  <X className="w-3.5 h-3.5" />
                                </button>
                              </motion.div>
                            ))}
                          </AnimatePresence>
                          
                          {images.length < 10 && (
                            <button
                              type="button"
                              onClick={() => fileInputRef.current?.click()}
                              className="relative shrink-0 w-28 h-28 sm:w-32 sm:h-32 rounded-xl border border-dashed border-slate-200 dark:border-slate-800 hover:border-sky-500/30 bg-white dark:bg-slate-950/20 flex flex-col items-center justify-center gap-2 transition-all text-slate-500 dark:text-slate-400 hover:text-sky-400 group snap-start"
                            >
                              <Plus className="w-5 h-5 group-hover:scale-105 transition-transform" />
                              <span className="text-[10px] font-black uppercase tracking-wider">Tambah</span>
                            </button>
                          )}
                        </div>

                        {images.length < 10 && (
                          <button
                            type="button"
                            onClick={() => fileInputRef.current?.click()}
                            className="w-full py-2.5 rounded-xl bg-slate-50 dark:bg-slate-900/40 border border-slate-200 dark:border-slate-800 text-[10px] font-black text-sky-400 hover:bg-slate-100 dark:bg-slate-800/40 transition-all flex items-center justify-center gap-2"
                          >
                            <Plus className="w-3.5 h-3.5" />
                            Pilih Foto Tambahan ({images.length}/10)
                          </button>
                        )}
                      </div>
                    )}

                    <Button
                      fullWidth
                      onClick={() => {
                        if (images.length < 10) {
                          showAlert(
                            'warning',
                            'Jumlah Foto Kurang',
                            `Anda wajib mengunggah tepat 10 foto screenshot postingan (kurang dari 10 tidak diperbolehkan). Saat ini: ${images.length} foto.`
                          );
                          return;
                        }
                        setFormStep('link');
                        triggerHaptic('selection');
                      }}
                      icon={<ArrowRight className="w-4 h-4" />}
                    >
                      Lanjut Tempel Link ({images.length}/10 Foto Siap)
                    </Button>
                  </motion.div>
                )}

                {/* STEP 2: PASTE & REVIEW LINKS */}
                {formStep === 'link' && (
                  <motion.div
                    initial={{ opacity: 0, x: 10 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -10 }}
                    className="space-y-5"
                  >
                    <div className="flex items-center justify-between pb-2 border-b border-slate-200 dark:border-slate-800/60">
                      <button
                        type="button"
                        onClick={() => {
                          setFormStep('upload');
                          triggerHaptic('selection');
                        }}
                        className="text-[10px] font-black text-sky-700 dark:text-sky-400 hover:text-sky-800 dark:hover:text-sky-300 flex items-center gap-1.5 transition-all bg-sky-500/10 px-3 py-1.5 rounded-xl border border-sky-500/20 active:scale-95"
                      >
                        <ArrowLeft className="w-3.5 h-3.5" />
                        Edit Foto SS ({images.length} Foto)
                      </button>

                      <span className="text-[8px] text-emerald-400 font-black bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20 flex items-center gap-1">
                        <ShieldCheck className="w-2.5 h-2.5" /> Smart Duplication Check
                      </span>
                    </div>

                    <div className="space-y-4">
                      <div className="flex items-center justify-between px-1">
                        <label className="text-[11px] font-black text-slate-700 dark:text-slate-300 uppercase tracking-wider flex items-center gap-2">
                          <LinkIcon className="w-4 h-4 text-sky-400" />
                          {isReviewingLinks ? 'Review Link Terdeteksi' : 'Tempel Daftar Link'}
                          {links.length > 0 && (
                            <span className="text-[9px] text-sky-400 normal-case font-bold ml-2">
                              ({links.length} Link)
                            </span>
                          )}
                        </label>
                      </div>

                      {!isReviewingLinks ? (
                        <div className="space-y-4">
                          <div className="relative group">
                            <textarea
                              placeholder="Tempel link postingan di sini (satu link per baris atau terpisah spasi)..."
                              className="w-full h-32 p-4 rounded-2xl bg-white dark:bg-slate-950/40 border border-slate-200 dark:border-slate-800 text-[11px] text-slate-900 dark:text-white placeholder:text-slate-700 outline-none focus:border-sky-500/30 transition-all resize-none font-medium leading-relaxed"
                              value={bulkText}
                              onChange={(e) => {
                                setBulkText(e.target.value);
                              }}
                            />
                            <div className="absolute top-2 right-2 opacity-0 group-focus-within:opacity-100 transition-opacity pointer-events-none">
                              <span className="text-[8px] font-black text-sky-500 bg-sky-500/10 px-1.5 py-0.5 rounded border border-sky-500/20 uppercase">
                                Tempel Otomatis
                              </span>
                            </div>
                          </div>
                          
                          <Button
                            fullWidth
                            variant="secondary"
                            disabled={!bulkText.trim()}
                            onClick={() => {
                              const rawLinks = bulkText.match(/https?:\/\/[^\s]+/g);
                              if (!rawLinks || rawLinks.length === 0) {
                                showAlert('warning', 'Link Tidak Ditemukan', 'Tidak ada link valid yang ditemukan pada teks yang ditempel.');
                                return;
                              }

                              const detected = rawLinks.map(url => url.replace(/[,\.\)]+$/, ''));

                              if (detected.length < 10) {
                                showAlert('warning', 'Jumlah Link Kurang', `Anda wajib memasukkan tepat 10 link. Terdeteksi baru ada: ${detected.length} link.`);
                                return;
                              }

                              if (detected.length > 10) {
                                showAlert('warning', 'Jumlah Link Berlebih', `Anda hanya diperbolehkan memasukkan tepat 10 link. Terdeteksi: ${detected.length} link. Silakan kurangi agar pas 10.`);
                                return;
                              }

                              // Try to detect platform with correct fallbacks
                              const formattedLinks: SocialLink[] = detected.map(url => {
                                let platform: SocialPlatform = 'Lainnya';
                                const lowUrl = url.toLowerCase();
                                if (lowUrl.includes('facebook.com') || lowUrl.includes('fb.com') || lowUrl.includes('fb.watch')) {
                                  platform = 'Facebook';
                                } else if (lowUrl.includes('x.com') || lowUrl.includes('twitter.com')) {
                                  platform = 'X (Twitter)';
                                } else if (lowUrl.includes('instagram.com') || lowUrl.includes('instagr.am')) {
                                  platform = 'Instagram';
                                } else if (lowUrl.includes('tiktok.com')) {
                                  platform = 'TikTok';
                                } else if (lowUrl.includes('threads.net')) {
                                  platform = 'Threads';
                                } else if (lowUrl.includes('wa.me') || lowUrl.includes('whatsapp.com')) {
                                  platform = 'WhatsApp';
                                } else if (lowUrl.includes('t.me') || lowUrl.includes('telegram.me') || lowUrl.includes('telegram.org')) {
                                  platform = 'Telegram';
                                }
                                
                                return { url, platform };
                              });

                              setLinks(formattedLinks);
                              setIsReviewingLinks(true);
                              triggerHaptic('notification', 'success');
                            }}
                          >
                            Pratinjau Link ({bulkText.match(/https?:\/\/[^\s]+/g)?.length || 0})
                          </Button>
                        </div>
                      ) : (
                        <div className="space-y-3 animate-in fade-in slide-in-from-top-2">
                          <div className="space-y-2.5 max-h-[320px] overflow-y-auto pr-1 custom-scrollbar">
                            {links.map((link, idx) => {
                              const dupInfo = checkLinkDuplicate(link.url, idx, links);
                              const isDuplicate = dupInfo.isDup;
                              return (
                                <div 
                                  key={idx} 
                                  className={`p-3 rounded-2xl border transition-all duration-200 flex flex-col gap-2.5 relative group ${
                                    isDuplicate 
                                      ? 'bg-rose-500/5 border-rose-500/35 shadow-sm shadow-rose-500/5' 
                                      : 'bg-slate-50 dark:bg-slate-900/20 border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-300 dark:border-slate-700/60'
                                  }`}
                                >
                                  {/* Header info & controls inside card */}
                                  <div className="flex items-center justify-between gap-2.5">
                                    <div className="flex items-center gap-2">
                                      <span className={`text-[10px] font-black w-5.5 h-5.5 flex items-center justify-center rounded-lg border shrink-0 ${
                                        isDuplicate 
                                          ? 'text-rose-600 dark:text-rose-400 border-rose-500/20 bg-rose-500/10'
                                          : 'text-sky-600 dark:text-sky-400 border-sky-500/20 bg-sky-500/5'
                                      }`}>
                                        {Math.max(1, typeof startNumber === 'number' ? startNumber : 1) + idx}
                                      </span>
                                      <span className="text-[9px] font-black uppercase text-slate-500 dark:text-slate-400 tracking-wider">
                                        Link Postingan
                                      </span>
                                    </div>

                                    <div className="flex items-center gap-1.5">
                                      {/* Platform Selection Dropdown */}
                                      <div className="relative">
                                        <div 
                                          className="flex items-center gap-1 bg-white dark:bg-slate-950/60 rounded-lg px-2 py-0.5 border border-slate-200 dark:border-slate-800 cursor-pointer"
                                          onClick={() => { setOpenPlatformDropdownIdx(openPlatformDropdownIdx === idx ? null : idx); triggerHaptic('selection'); }}
                                        >
                                          <ChannelPlatformIcon id={link.platform} className="w-3 h-3 text-slate-500 dark:text-slate-400" />
                                          <div className="bg-transparent text-[9px] font-black uppercase text-slate-700 dark:text-slate-300 flex items-center gap-1 py-0.5 pr-1">
                                            {CHANNELS.find(c => c.id === link.platform)?.label}
                                            <ChevronDown className={`w-2.5 h-2.5 transition-transform ${openPlatformDropdownIdx === idx ? 'rotate-180' : ''}`} />
                                          </div>
                                        </div>
                                        
                                        {openPlatformDropdownIdx === idx && (
                                          <>
                                            <div className="fixed inset-0 z-40" onClick={() => setOpenPlatformDropdownIdx(null)} />
                                            <div className="absolute right-0 top-full mt-1 z-50 w-36 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-xl overflow-hidden py-1 animate-in fade-in zoom-in-95 duration-200">
                                              {CHANNELS.map(c => (
                                                <div 
                                                  key={c.id} 
                                                  className={`px-3 py-2 text-[10px] font-black uppercase flex items-center gap-2 cursor-pointer transition-colors ${link.platform === c.id ? 'bg-sky-50 dark:bg-sky-500/10 text-sky-600 dark:text-sky-400' : 'text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/80'}`}
                                                  onClick={(e) => {
                                                    e.stopPropagation();
                                                    updatePlatform(idx, c.id as SocialPlatform);
                                                    setOpenPlatformDropdownIdx(null);
                                                    triggerHaptic('selection');
                                                  }}
                                                >
                                                  <ChannelPlatformIcon id={c.id} className="w-3 h-3 shrink-0" />
                                                  {c.label}
                                                </div>
                                              ))}
                                            </div>
                                          </>
                                        )}
                                      </div>

                                      {/* Trash Delete Button */}
                                      <button
                                        type="button"
                                        onClick={() => removeLink(idx)}
                                        className="p-1 rounded-lg bg-slate-100 dark:bg-slate-950/40 border border-slate-200 dark:border-slate-800 hover:border-rose-500/30 hover:bg-rose-500/10 text-slate-500 dark:text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 transition-colors cursor-pointer"
                                        title="Hapus Link"
                                      >
                                        <X className="w-3.5 h-3.5" />
                                      </button>
                                    </div>
                                  </div>

                                  {/* URL Input Box */}
                                  <div className="relative w-full">
                                    <input
                                      type="text"
                                      value={link.url}
                                      onChange={(e) => updateLink(idx, e.target.value)}
                                      placeholder="https://..."
                                      className={`w-full bg-white dark:bg-slate-950/40 border border-slate-200 dark:border-slate-800/80 text-[11px] rounded-xl pl-3 pr-8 py-2 outline-none focus:border-sky-500/50 transition-all font-medium leading-relaxed ${
                                        isDuplicate ? 'text-rose-700 dark:text-rose-700 dark:text-rose-200 border-rose-500/30 focus:border-rose-500/40' : 'text-slate-900 dark:text-slate-100'
                                      }`}
                                    />
                                    <div className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-600 dark:text-slate-400 hover:text-sky-600 dark:hover:text-sky-400 transition-colors">
                                      <ExternalLink 
                                        className="w-3.5 h-3.5 cursor-pointer" 
                                        onClick={() => link.url && window.open(link.url, '_blank')}
                                      />
                                    </div>
                                  </div>

                                  {isDuplicate && (
                                    <div className="text-[9px] text-rose-600 dark:text-rose-400 font-bold flex items-center gap-1.5 animate-in fade-in slide-in-from-left-2 duration-200">
                                      <AlertTriangle className="w-3 h-3 text-rose-500 shrink-0" />
                                      {dupInfo.reason === 'database'
                                        ? 'Link ini sudah pernah dikirim sebelumnya di database!'
                                        : `Link ini terdeteksi duplikat dengan Link #${dupInfo.dupIndex}!`
                                      }
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                          
                          <div className="flex gap-2 animate-in fade-in zoom-in duration-300">
                            {links.length < 10 ? (
                              <button
                                type="button"
                                onClick={() => {
                                  if (links.length >= 10) {
                                    showAlert('warning', 'Batas Maksimal Link', 'Maksimal 10 link dalam satu batch pengiriman.');
                                    return;
                                  }
                                  setLinks(prev => [...prev, { url: '', platform: 'Lainnya' }]);
                                  triggerHaptic('impact', 'light');
                                }}
                                className="flex-1 py-2.5 h-auto text-[10px] font-black uppercase rounded-xl bg-sky-500/10 hover:bg-sky-500/20 text-sky-700 dark:text-sky-400 border border-sky-500/25 transition-all flex items-center justify-center gap-1.5 active:scale-95 cursor-pointer"
                              >
                                <Plus className="w-3.5 h-3.5" />
                                Tambah Link ({links.length}/10)
                              </button>
                            ) : (
                              <div className="flex-1 py-2.5 h-auto text-[10px] font-black uppercase rounded-xl bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-400 flex items-center justify-center gap-1.5 cursor-not-allowed">
                                <Plus className="w-3.5 h-3.5" />
                                Batas 10 Link Tercapai
                              </div>
                            )}
                            <Button 
                              variant="secondary" 
                              className="flex-1 py-2.5 h-auto text-[10px] font-black uppercase"
                              onClick={() => {
                                setIsReviewingLinks(false);
                                setLinks([]);
                                setIsConfirmed(false);
                                triggerHaptic('impact', 'light');
                              }}
                            >
                              Ubah Masal
                            </Button>
                          </div>
                        </div>
                      )}
                    </div>

                    <Button
                      fullWidth
                      onClick={handleSubmit}
                      disabled={isUploading || links.filter(l => l.url.trim() !== '').length !== 10 || images.length !== 10}
                      isLoading={isUploading}
                      icon={<Send className="w-4 h-4" />}
                    >
                      Kirim Batch Postingan ({links.filter(l => l.url.trim() !== '').length}/10 Link & {images.length}/10 Foto)
                    </Button>
                  </motion.div>
                )}
              </GlassCard>
            </div>
        )}
      </motion.div>
    )}

        {/* History Views (Riwayat & Arsip) */}
        {activeView === 'riwayat' && (
          <motion.div
            initial={{ opacity: 0, x: 10 }}
            animate={{ opacity: 1, x: 0 }}
            className="space-y-3"
          >
            {/* Recruiter Selector for Admin & Owner */}
            {isManagement && (
              <div className="p-3.5 bg-white/90 dark:bg-slate-950/90 rounded-2xl border border-slate-200 dark:border-slate-800/90 shadow-md space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-xl bg-sky-500/10 border border-sky-500/20 flex items-center justify-center shrink-0">
                      <Users className="w-4 h-4 text-sky-600 dark:text-sky-400" />
                    </div>
                    <div>
                      <h4 className="text-xs font-black text-slate-900 dark:text-white">Filter Recruiter</h4>
                      <p className="text-[9.5px] text-slate-600 dark:text-slate-400 font-medium">Postingan semua recruiter atau pilih per-recruiter</p>
                    </div>
                  </div>

                  {/* Dropdown Menu Trigger with Photo */}
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => {
                        setIsHistoryRecruiterDropdownOpen(!isHistoryRecruiterDropdownOpen);
                        triggerHaptic('selection');
                      }}
                      className="w-full sm:w-auto flex items-center justify-between gap-2.5 bg-slate-100 dark:bg-slate-900/90 border border-slate-300 dark:border-slate-700/80 rounded-xl px-3 py-2 text-xs font-bold text-slate-900 dark:text-white hover:border-sky-500 transition-colors shadow-sm"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        {selectedHistoryRecruiterId === 'ALL' ? (
                          <>
                            <div className="w-6 h-6 rounded-full bg-sky-500/20 border border-sky-500/30 flex items-center justify-center shrink-0">
                              <Users className="w-3.5 h-3.5 text-sky-600 dark:text-sky-400" />
                            </div>
                            <span className="text-sky-700 dark:text-sky-300 font-black text-xs truncate">
                              Semua Recruiter ({recruiters.length})
                            </span>
                          </>
                        ) : (() => {
                          const activeRec = recruiters.find(r => String(r.telegramId) === String(selectedHistoryRecruiterId));
                          if (!activeRec) return <span className="text-sky-700 dark:text-sky-300 font-black">Pilih Recruiter</span>;
                          return (
                            <>
                              {activeRec.photoUrl ? (
                                <img                                    src={activeRec.photoUrl}
                                  alt={activeRec.firstName}
                                  className="w-6 h-6 rounded-full object-cover border border-sky-400/40 shrink-0 p-0.5 bg-sky-500/10"
                                  referrerPolicy="no-referrer"                                 />
                              ) : (
                                <div className="w-6 h-6 rounded-full bg-gradient-to-tr from-sky-500 to-indigo-600 text-slate-900 dark:text-white font-black text-[10px] flex items-center justify-center shrink-0 border border-white/20 p-0.5">
                                  <span className="w-full h-full rounded-full bg-sky-500/10 flex items-center justify-center">
                                    {activeRec.firstName?.charAt(0).toUpperCase()}
                                  </span>
                                </div>
                              )}
                              <div className="flex items-center gap-1.5 min-w-0">
                                <span className="text-slate-900 dark:text-white font-black text-xs truncate max-w-[120px]">
                                  {activeRec.firstName} {activeRec.lastName || ''}
                                </span>
                                {activeRec.username && (
                                  <span className="text-[9.5px] text-sky-600 dark:text-sky-400 font-semibold truncate">
                                    ({formatUsername(activeRec.username)})
                                  </span>
                                )}
                              </div>
                            </>
                          );
                        })()}
                      </div>
                      <ChevronDown className={`w-3.5 h-3.5 text-slate-500 dark:text-slate-400 transition-transform ${isHistoryRecruiterDropdownOpen ? 'rotate-180 text-sky-500' : ''}`} />
                    </button>

                    {/* Popover Dropdown Menu */}
                    <AnimatePresence>
                      {isHistoryRecruiterDropdownOpen && (
                        <>
                          {/* Backdrop to close dropdown on click outside */}
                          <div
                            className="fixed inset-0 z-40"
                            onClick={() => setIsHistoryRecruiterDropdownOpen(false)}
                          />

                          <motion.div
                            initial={{ opacity: 0, y: -8, scale: 0.98 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            exit={{ opacity: 0, y: -8, scale: 0.98 }}
                            transition={{ duration: 0.15 }}
                            className="absolute right-0 top-full mt-2 z-50 w-full sm:w-72 bg-white dark:bg-slate-900/95 backdrop-blur-xl border border-slate-200 dark:border-slate-700/80 rounded-2xl shadow-2xl overflow-hidden max-h-72 overflow-y-auto no-scrollbar p-1.5 space-y-1"
                          >
                            {/* Option: All Recruiters */}
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedHistoryRecruiterId('ALL');
                                setIsHistoryRecruiterDropdownOpen(false);
                                triggerHaptic('selection');
                              }}
                              className={`w-full flex items-center justify-between p-2 rounded-xl text-xs font-bold transition-all ${
                                selectedHistoryRecruiterId === 'ALL'
                                  ? 'bg-sky-500/20 text-sky-700 dark:text-sky-300 border border-sky-500/30'
                                  : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white border border-transparent'
                              }`}
                            >
                              <div className="flex items-center gap-2.5">
                                <div className="w-8 h-8 rounded-full bg-sky-500/10 border border-sky-500/20 flex items-center justify-center shrink-0">
                                  <Users className="w-4 h-4 text-sky-600 dark:text-sky-400" />
                                </div>
                                <div className="text-left">
                                  <div className="font-black text-xs text-slate-900 dark:text-white">Semua Recruiter</div>
                                  <div className="text-[9px] text-slate-500 dark:text-slate-400 font-medium">Tampilkan postingan seluruh tim ({recruiters.length} recruiter)</div>
                                </div>
                              </div>
                              {selectedHistoryRecruiterId === 'ALL' && (
                                <CheckCircle2 className="w-4 h-4 text-sky-600 dark:text-sky-400 shrink-0" />
                              )}
                            </button>

                            <div className="h-px bg-slate-200 dark:bg-slate-800/80 my-1" />

                            {/* List of Recruiters with Photos */}
                            {recruiters.map((rec) => {
                              const isSelected = selectedHistoryRecruiterId === rec.telegramId;
                              return (
                                <button
                                  key={rec.telegramId}
                                  type="button"
                                  onClick={() => {
                                    setSelectedHistoryRecruiterId(rec.telegramId);
                                    setIsHistoryRecruiterDropdownOpen(false);
                                    triggerHaptic('selection');
                                  }}
                                  className={`w-full flex items-center justify-between p-2 rounded-xl text-xs transition-all ${
                                    isSelected
                                      ? 'bg-sky-500/20 text-sky-700 dark:text-sky-300 border border-sky-500/30 font-black'
                                      : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white border border-transparent'
                                  }`}
                                >
                                  <div className="flex items-center gap-2.5 min-w-0">
                                    <div className="relative shrink-0">
                                      {rec.photoUrl ? (
                                        <img referrerPolicy="no-referrer"                                           src={rec.photoUrl}
                                          alt={rec.firstName}
                                          className="w-8 h-8 rounded-full object-cover border border-slate-300 dark:border-slate-700 shadow-sm p-0.5 bg-slate-100 dark:bg-slate-800"
                                                                                   />
                                      ) : (
                                        <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-sky-500 to-indigo-600 text-slate-900 dark:text-white font-black text-xs flex items-center justify-center border border-white/10 shadow-sm p-0.5">
                                          <span className="w-full h-full rounded-full bg-sky-500/10 flex items-center justify-center">
                                            {rec.firstName?.charAt(0).toUpperCase() || 'R'}
                                          </span>
                                        </div>
                                      )}
                                    </div>
                                    <div className="text-left min-w-0">
                                      <div className="font-black text-xs text-slate-900 dark:text-white truncate">
                                        {rec.firstName} {rec.lastName || ''}
                                      </div>
                                      <div className="text-[9.5px] text-slate-500 dark:text-slate-400 font-medium truncate">
                                        {rec.username ? formatUsername(rec.username) : `ID: ${rec.telegramId}`}
                                      </div>
                                    </div>
                                  </div>
                                  {isSelected && (
                                    <CheckCircle2 className="w-4 h-4 text-sky-600 dark:text-sky-400 shrink-0 ml-2" />
                                  )}
                                </button>
                              );
                            })}
                          </motion.div>
                        </>
                      )}
                    </AnimatePresence>
                  </div>
                </div>
              </div>
            )}

            {/* History Sub-tab Segmented Control */}
            <div className="flex p-1 bg-slate-200/90 dark:bg-slate-950/90 rounded-2xl border border-slate-300 dark:border-slate-800/90 shadow-md">
              <button
                onClick={() => { setHistorySubTab('minggu_ini'); triggerHaptic('selection'); }}
                className={`flex-1 py-2.5 rounded-xl text-[10px] font-black uppercase transition-all flex items-center justify-center gap-1.5 ${
                  historySubTab === 'minggu_ini'
                    ? 'bg-sky-500 text-slate-950 shadow-md scale-[1.01]'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <Calendar className="w-3.5 h-3.5" />
                Minggu Ini ({allCurrentWeekPosts.length})
              </button>
              <button
                onClick={() => { setHistorySubTab('arsip'); triggerHaptic('selection'); }}
                className={`flex-1 py-2.5 rounded-xl text-[10px] font-black uppercase transition-all flex items-center justify-center gap-1.5 ${
                  historySubTab === 'arsip'
                    ? 'bg-amber-500 text-slate-950 shadow-md scale-[1.01]'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <Archive className="w-3.5 h-3.5" />
                Arsip Minggu Lalu ({archivedWeeks.length})
              </button>
            </div>

            {historySubTab === 'minggu_ini' && (
              <>
                <div className="space-y-3 p-3.5 rounded-2xl bg-white/90 dark:bg-slate-950/90 border border-slate-200 dark:border-slate-800/90 shadow-sm">
                  <div className="flex items-center justify-between px-0.5">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-xl bg-sky-500/10 border border-sky-500/20 flex items-center justify-center shrink-0">
                        <Calendar className="w-3.5 h-3.5 text-sky-600 dark:text-sky-400" />
                      </div>
                      <div className="flex flex-col gap-1">
                        <h3 className="text-xs font-black text-slate-900 dark:text-white tracking-tight">Filter Hari Minggu Ini</h3>
                        <span className="text-[9px] font-black text-sky-700 dark:text-sky-400 bg-sky-500/10 px-2 py-0.5 rounded-full border border-sky-500/20 flex items-center gap-1 w-fit">
                          <Timer className="w-2.5 h-2.5 text-sky-600 dark:text-sky-400 animate-pulse" />
                          {weekDays[0]?.displayDate} - {weekDays[6]?.displayDate}
                        </span>
                      </div>
                    </div>
                    <div className="text-right">
                      <span className="text-[9px] font-black text-sky-700 dark:text-sky-300 bg-sky-500/15 px-2.5 py-1 rounded-full border border-sky-500/30">
                        {weekPostsCountMap['Semua'] || 0} Link Total
                      </span>
                    </div>
                  </div>

                  {/* Day Buttons Grid Layout (7 Hari) */}
                  <div className="flex sm:grid sm:grid-cols-7 gap-1.5 overflow-x-auto pt-2 pb-1.5 no-scrollbar -mx-2 px-2 sm:mx-0 sm:px-0">
                    {/* Monday - Sunday Tiles */}
                    {weekDays.map((wDay) => {
                      const isSelected = selectedDay === wDay.dayName;
                      const linkCount = weekPostsCountMap[wDay.dayName] || 0;
                      return (
                        <button
                          key={wDay.dayName}
                          onClick={() => { setSelectedDay(wDay.dayName); triggerHaptic('selection'); }}
                          className={`p-2 rounded-xl text-center transition-all flex flex-col items-center justify-center gap-0.5 border relative shrink-0 min-w-[76px] sm:min-w-0 flex-1 ${
                            isSelected
                              ? 'bg-sky-500 text-slate-950 border-sky-400 shadow-lg shadow-sky-500/15 font-black scale-[1.02]'
                              : wDay.isToday
                              ? 'bg-amber-500/10 text-amber-800 dark:text-amber-200 border-amber-500/40 shadow-sm'
                              : 'bg-slate-100 dark:bg-slate-900/90 text-slate-700 dark:text-slate-400 border-slate-200 dark:border-slate-800 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200/80 dark:hover:bg-slate-800'
                          }`}
                        >
                          {wDay.isToday && (
                            <span className="absolute -top-1.5 left-1/2 -translate-x-1/2 text-[6px] font-black uppercase bg-amber-400 text-slate-950 px-1.5 py-0.2 rounded-full border border-amber-300 shadow-sm tracking-tighter shrink-0 whitespace-nowrap">
                              Hari Ini
                            </span>
                          )}
                          <span className="text-[9px] font-black uppercase tracking-wider mt-0.5">{wDay.dayName}</span>
                          <span className="text-[7.5px] font-medium opacity-70">{wDay.displayDate}</span>
                          <span className={`text-[8px] font-bold px-1.5 py-0.2 rounded-full border ${
                            isSelected 
                              ? 'text-slate-950 bg-white/40 border-slate-950/25' 
                              : linkCount > 0
                              ? 'text-emerald-700 dark:text-emerald-400 bg-emerald-500/10 border-emerald-500/20'
                              : 'text-slate-500 dark:text-slate-400 bg-slate-200/50 dark:bg-slate-950/40 border-slate-300 dark:border-slate-800'
                          }`}>
                            {linkCount} Link
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {posts.length === 0 && !isLoadingHistory ? (
                  <div className="py-20 text-center bg-slate-50 dark:bg-slate-900/40 rounded-3xl border border-slate-200 dark:border-slate-800/50">
                    <Clock className="w-8 h-8 text-slate-700 mx-auto mb-2" />
                    <p className="text-xs font-bold text-slate-500 dark:text-slate-400">
                      {`Belum ada postingan untuk hari ${selectedDay}`}
                    </p>
                  </div>
                ) : (
                  paginatedPosts.map((post) => {
                    const isExpanded = expandedPostIds[post.id] || false;
                    const visibleLinks = isExpanded ? post.links : post.links.slice(0, 2);
                    const cardStartNum = Math.max(1, Number(post.startNumber) || 1);
                    const cardLinkCount = Array.isArray(post.links) ? post.links.length : 0;
                    const cardEndNum = cardLinkCount > 0 ? (cardStartNum + cardLinkCount - 1) : cardStartNum;
                    const { name: recruiterName, username: recruiterUsername, photoUrl: recruiterPhoto } = getPostRecruiterInfo(post);
                    const recruiterTag = recruiterUsername ? `@${recruiterUsername.replace(/^@/, '')}` : '';

                    return (
                      <GlassCard key={post.id} className={`p-4 space-y-3 ${post.archived ? 'opacity-70 grayscale-[0.3]' : ''}`}>
                        <div className="flex items-center justify-between gap-3 pb-2 border-b border-slate-200 dark:border-slate-800/60">
                          <div className="flex items-center gap-2.5 min-w-0">
                            {/* Recruiter Avatar */}
                            <div className="relative shrink-0">
                              {recruiterPhoto ? (
                                <img referrerPolicy="no-referrer"                                   src={recruiterPhoto} 
                                  alt={recruiterName} 
                                  className="w-9 h-9 rounded-full object-cover border border-sky-400/30 shadow-md ring-2 ring-sky-500/10"
                                                                   />
                              ) : (
                                <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-sky-500 to-indigo-600 text-slate-900 dark:text-white font-black text-xs flex items-center justify-center border border-white/20 shadow-md ring-2 ring-sky-500/10">
                                  {(recruiterName || 'R').charAt(0).toUpperCase()}
                                </div>
                              )}
                              <div className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full bg-emerald-500 border-2 border-slate-950 flex items-center justify-center shadow-sm">
                                <span className="w-1.5 h-1.5 rounded-full bg-white"></span>
                              </div>
                            </div>

                            {/* Recruiter Name & Info */}
                            <div className="flex flex-col min-w-0">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className="text-xs font-black text-slate-900 dark:text-white truncate max-w-[130px] sm:max-w-[200px]">
                                  {recruiterName || 'Recruiter'}
                                </span>
                                {recruiterTag && (
                                  <span className="text-[9px] font-semibold text-sky-300 bg-sky-500/15 px-1.5 py-0.2 rounded-md border border-sky-500/25 truncate">
                                    {recruiterTag}
                                  </span>
                                )}
                              </div>
                              <div className="flex items-center gap-2 text-[9.5px] text-slate-600 dark:text-slate-400 font-medium mt-0.5 flex-wrap">
                                <span className="text-sky-300 font-black">#{cardStartNum} - #{cardEndNum}</span>
                                <span>•</span>
                                <span className="flex items-center gap-1 text-slate-700 dark:text-slate-300">
                                  <Calendar className="w-2.5 h-2.5 text-sky-400" />
                                  {formatDateWithDay(post.date || '') || post.date}
                                </span>
                              </div>
                            </div>
                          </div>

                          <div className="flex -space-x-1.5 shrink-0">
                            {Array.from(new Set(post.platforms)).map((p, i) => (
                              <div key={i} className="w-7 h-7 rounded-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex items-center justify-center shadow-lg">
                                <ChannelPlatformIcon id={p} className={`w-3.5 h-3.5 ${CHANNELS.find(c => c.id === p)?.color?.split(' ')[0] || 'text-slate-900 dark:text-white'}`} />
                              </div>
                            ))}
                          </div>
                        </div>
                        
                        <div className="space-y-1.5 pt-2 border-t border-slate-200 dark:border-slate-800/50">
                          {visibleLinks.map((link, i) => (
                            <a 
                              key={i} 
                              href={link} 
                              target="_blank" 
                              rel="noopener noreferrer"
                              className="flex items-center justify-between p-2 rounded-xl bg-white dark:bg-slate-950/50 hover:bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800/50 transition-colors group"
                            >
                              <div className="flex items-center gap-2 truncate">
                                <span className="text-[10px] font-bold text-sky-600 dark:text-sky-400 shrink-0">
                                  {cardStartNum + i}.
                                </span>
                                <ChannelPlatformIcon id={post.platforms[i]} className={`w-3 h-3 shrink-0 ${CHANNELS.find(c => c.id === post.platforms[i])?.color?.split(' ')[0] || 'text-slate-500 dark:text-slate-400'}`} />
                                <span className="text-[10px] text-slate-600 dark:text-slate-400 font-medium truncate max-w-[200px]">
                                  {link}
                                </span>
                              </div>
                              <ExternalLink className="w-3 h-3 text-slate-600 group-hover:text-sky-400 transition-colors" />
                            </a>
                          ))}

                          {post.links.length > 2 && (
                            <button
                              type="button"
                              onClick={() => {
                                setExpandedPostIds(prev => ({ ...prev, [post.id]: !isExpanded }));
                                triggerHaptic('selection');
                              }}
                              className="w-full text-[10px] font-black text-sky-700 dark:text-sky-400 hover:text-sky-800 dark:hover:text-sky-300 bg-sky-500/10 hover:bg-sky-500/20 border border-sky-500/20 py-2 px-3 rounded-xl transition-all flex items-center justify-center gap-1.5 mt-1.5 active:scale-[0.99] shadow-sm cursor-pointer"
                            >
                              <span>{isExpanded ? 'Sembunyikan Link' : `Lihat Semua (${post.links.length} Link)`}</span>
                              <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`} />
                            </button>
                          )}
                        </div>
                      </GlassCard>
                    );
                  })
                )}

                {/* Pagination Controls for Minggu Ini */}
                {posts.length > 0 && (
                  <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-3.5 rounded-2xl bg-white dark:bg-slate-950/90 border border-slate-200 dark:border-slate-800/90 shadow-sm mt-4">
                    <div className="text-[10px] font-bold text-slate-600 dark:text-slate-400 text-center sm:text-left">
                      Menampilkan <span className="text-slate-900 dark:text-white font-black">{Math.min((currentPage - 1) * ITEMS_PER_PAGE + 1, posts.length)} - {Math.min(currentPage * ITEMS_PER_PAGE, posts.length)}</span> dari <span className="text-slate-900 dark:text-white font-black">{posts.length}</span> postingan
                    </div>
                    
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => {
                          if (currentPage > 1) {
                            setCurrentPage(prev => prev - 1);
                            triggerHaptic('selection');
                          }
                        }}
                        disabled={currentPage === 1}
                        className={`px-3 py-1.5 rounded-xl text-[10px] font-black uppercase transition-all flex items-center gap-1 border ${
                          currentPage === 1
                            ? 'bg-slate-50 dark:bg-slate-900/40 text-slate-600 border-slate-200 dark:border-slate-800/40 cursor-not-allowed'
                            : 'bg-slate-50 dark:bg-slate-900 text-sky-400 border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:bg-slate-800 hover:text-slate-900 dark:text-white shadow-sm'
                        }`}
                      >
                        <ChevronLeft className="w-3.5 h-3.5" />
                        Prev
                      </button>

                      <div className="flex items-center gap-1">
                        {Array.from({ length: totalPages }, (_, i) => i + 1)
                          .filter(p => p === 1 || p === totalPages || Math.abs(p - currentPage) <= 1)
                          .map((p, idx, arr) => {
                            const showDots = idx > 0 && p - arr[idx - 1] > 1;
                            return (
                              <React.Fragment key={p}>
                                {showDots && <span className="text-slate-600 text-[10px] px-0.5">..</span>}
                                <button
                                  onClick={() => {
                                    setCurrentPage(p);
                                    triggerHaptic('selection');
                                  }}
                                  className={`w-7 h-7 rounded-xl text-[10px] font-black transition-all border ${
                                    currentPage === p
                                      ? 'bg-sky-500 text-slate-950 border-sky-400 shadow-md shadow-sky-500/20'
                                      : 'bg-slate-50 dark:bg-slate-900 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-800 hover:text-slate-900 dark:text-white'
                                  }`}
                                >
                                  {p}
                                </button>
                              </React.Fragment>
                            );
                          })}
                      </div>

                      <button
                        onClick={() => {
                          if (currentPage < totalPages) {
                            setCurrentPage(prev => prev + 1);
                            triggerHaptic('selection');
                          }
                        }}
                        disabled={currentPage === totalPages}
                        className={`px-3 py-1.5 rounded-xl text-[10px] font-black uppercase transition-all flex items-center gap-1 border ${
                          currentPage === totalPages
                            ? 'bg-slate-50 dark:bg-slate-900/40 text-slate-600 border-slate-200 dark:border-slate-800/40 cursor-not-allowed'
                            : 'bg-slate-50 dark:bg-slate-900 text-sky-400 border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:bg-slate-800 hover:text-slate-900 dark:text-white shadow-sm'
                        }`}
                      >
                        Next
                        <ChevronRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}

            {historySubTab === 'arsip' && (
              <div className="space-y-3">
                {archivedWeeks.length === 0 && !isLoadingHistory ? (
                  <div className="py-20 text-center bg-slate-50 dark:bg-slate-900/40 rounded-3xl border border-slate-200 dark:border-slate-800/50">
                    <Archive className="w-8 h-8 text-slate-700 mx-auto mb-2" />
                    <p className="text-xs font-bold text-slate-500 dark:text-slate-400">Folder arsip kosong</p>
                  </div>
                ) : (
                  archivedWeeks.map((week) => {
                    const isWeekExpanded = expandedWeekKey === week.weekKey;
                    
                    // Filter week posts based on selectedArchiveDay
                    const filteredWeekPosts = week.posts.filter(p => getIndonesianDayName(p.date || '') === selectedArchiveDay);

                    // calculate total pages inside this week
                    const weekTotalPages = Math.max(1, Math.ceil(filteredWeekPosts.length / ITEMS_PER_PAGE));
                    const startIndex = (archivePage - 1) * ITEMS_PER_PAGE;
                    const weekPaginatedPosts = filteredWeekPosts.slice(startIndex, startIndex + ITEMS_PER_PAGE);

                    // Generate days of this specific archived week
                    const weekDaysList = getWIBWeekDaysOfMonday(week.weekKey);

                    // Count total links per day in this archived week
                    const archiveDayPostsCountMap: Record<string, number> = {
                      'Semua': 0,
                      'Senin': 0,
                      'Selasa': 0,
                      'Rabu': 0,
                      'Kamis': 0,
                      'Jumat': 0,
                      'Sabtu': 0,
                      'Minggu': 0,
                    };

                    week.posts.forEach((post) => {
                      const dayName = getIndonesianDayName(post.date || '');
                      const linkCount = Array.isArray(post.links) ? post.links.length : 0;
                      archiveDayPostsCountMap['Semua'] += linkCount;
                      if (dayName && archiveDayPostsCountMap[dayName] !== undefined) {
                        archiveDayPostsCountMap[dayName] += linkCount;
                      }
                    });

                    return (
                      <div key={week.weekKey} className="border border-slate-200 dark:border-slate-800/60 bg-white dark:bg-slate-950/40 rounded-3xl overflow-hidden transition-all duration-200">
                        {/* Collapse Header */}
                        <button
                          type="button"
                          onClick={() => {
                            setExpandedWeekKey(isWeekExpanded ? null : week.weekKey);
                            setArchivePage(1);
                            triggerHaptic('selection');
                          }}
                          className={`w-full p-4 flex items-center justify-between text-left transition-colors duration-200 ${
                            isWeekExpanded ? 'bg-slate-50 dark:bg-slate-900/60' : 'bg-white dark:bg-slate-950/20 hover:bg-slate-50 dark:bg-slate-900/30'
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 border transition-all ${
                              isWeekExpanded ? 'bg-amber-500/10 border-amber-500/30 text-amber-400' : 'bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400'
                            }`}>
                              <Archive className="w-4 h-4" />
                            </div>
                            <div className="flex flex-col gap-1">
                              <div className="flex items-center gap-2 flex-wrap">
                                <h4 className="text-xs font-black text-slate-900 dark:text-white tracking-tight">
                                  Arsip Mingguan
                                </h4>
                                <span className="text-[9px] font-black text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-full border border-amber-500/20 flex items-center gap-1 w-fit">
                                  <Timer className="w-2.5 h-2.5 text-amber-400 animate-pulse" />
                                  {weekDaysList[0]?.displayDate} - {weekDaysList[6]?.displayDate}
                                </span>
                              </div>
                              <p className="text-[10px] text-slate-600 dark:text-slate-400 font-bold mt-0.5 flex items-center gap-3">
                                <span>{week.posts.length} Batch</span>
                                <span className="w-1 h-1 rounded-full bg-slate-700"></span>
                                <span>{week.totalLinks} Link Total</span>
                              </p>
                            </div>
                          </div>
                          
                          <ChevronDown className={`w-4 h-4 text-slate-600 dark:text-slate-400 transition-transform duration-200 ${
                            isWeekExpanded ? 'rotate-180 text-amber-400' : ''
                          }`} />
                        </button>

                        {/* Collapse Content */}
                        <AnimatePresence initial={false}>
                          {isWeekExpanded && (
                            <motion.div
                              initial={{ height: 0, opacity: 0 }}
                              animate={{ height: 'auto', opacity: 1 }}
                              exit={{ height: 0, opacity: 0 }}
                              transition={{ duration: 0.2 }}
                              className="border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950/60 p-4 space-y-4"
                            >
                              {/* Day Buttons Filter inside Archived Week */}
                              <div className="flex sm:grid sm:grid-cols-7 gap-1.5 overflow-x-auto pb-1.5 no-scrollbar -mx-2 px-2 sm:mx-0 sm:px-0">
                                {/* Monday - Sunday buttons */}
                                {weekDaysList.map((wDay) => {
                                  const isSelected = selectedArchiveDay === wDay.dayName;
                                  const linkCount = archiveDayPostsCountMap[wDay.dayName] || 0;
                                  return (
                                    <button
                                      key={wDay.dayName}
                                      type="button"
                                      onClick={() => { setSelectedArchiveDay(wDay.dayName); triggerHaptic('selection'); }}
                                      className={`p-2 rounded-xl text-center transition-all flex flex-col items-center justify-center gap-0.5 border relative shrink-0 min-w-[76px] sm:min-w-0 flex-1 ${
                                        isSelected
                                          ? 'bg-gradient-to-b from-amber-500/30 to-orange-600/20 text-slate-900 dark:text-white border-amber-400 shadow-lg shadow-amber-500/15 ring-1 ring-amber-400/50'
                                          : 'bg-slate-50 dark:bg-slate-900/90 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-800 hover:text-slate-900 dark:text-white hover:bg-slate-100 dark:bg-slate-800/80'
                                      }`}
                                    >
                                      <span className="text-[9px] font-black uppercase tracking-wider">{wDay.dayName}</span>
                                      <span className="text-[7.5px] font-medium opacity-70">{wDay.displayDate}</span>
                                      <span className={`text-[8px] font-bold px-1.5 py-0.2 rounded-full border ${
                                        isSelected
                                          ? 'text-amber-700 dark:text-amber-300 bg-amber-500/20 border-amber-400/30'
                                          : linkCount > 0
                                          ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20'
                                          : 'text-slate-500 dark:text-slate-400 bg-white dark:bg-slate-950/40 border-slate-200 dark:border-slate-800'
                                      }`}>
                                        {linkCount} Link
                                      </span>
                                    </button>
                                  );
                                })}
                              </div>

                              {filteredWeekPosts.length === 0 ? (
                                <div className="py-12 text-center bg-slate-50 dark:bg-slate-900/40 rounded-2xl border border-slate-900">
                                  <Clock className="w-6 h-6 text-slate-700 mx-auto mb-2" />
                                  <p className="text-xs font-bold text-slate-500 dark:text-slate-400">
                                    {`Belum ada postingan untuk hari ${selectedArchiveDay}`}
                                  </p>
                                </div>
                              ) : (
                                <div className="space-y-3">
                                  {weekPaginatedPosts.map((post) => {
                                   const isExpanded = expandedPostIds[post.id] || false;
                                   const visibleLinks = isExpanded ? post.links : post.links.slice(0, 2);
                                   const cardStartNum = Math.max(1, Number(post.startNumber) || 1);
                                   const cardLinkCount = Array.isArray(post.links) ? post.links.length : 0;
                                   const cardEndNum = cardLinkCount > 0 ? (cardStartNum + cardLinkCount - 1) : cardStartNum;
                                   const { name: recruiterName, username: recruiterUsername, photoUrl: recruiterPhoto } = getPostRecruiterInfo(post);
                                   const recruiterTag = recruiterUsername ? formatUsername(recruiterUsername) : '';

                                   return (
                                     <GlassCard key={post.id} className="p-4 space-y-3 border-slate-200 dark:border-slate-800/40">
                                       <div className="flex items-center justify-between gap-3 pb-2 border-b border-slate-200 dark:border-slate-800/60">
                                         <div className="flex items-center gap-2.5 min-w-0">
                                           {/* Recruiter Avatar */}
                                           <div className="relative shrink-0">
                                             {recruiterPhoto ? (
                                               <img referrerPolicy="no-referrer"                                                  src={recruiterPhoto} 
                                                 alt={recruiterName} 
                                                 className="w-9 h-9 rounded-full object-cover border border-amber-400/30 shadow-md ring-2 ring-amber-500/10"
                                                                                                 />
                                             ) : (
                                               <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-amber-500 to-orange-600 text-slate-900 dark:text-white font-black text-xs flex items-center justify-center border border-white/20 shadow-md ring-2 ring-amber-500/10">
                                                 {(recruiterName || 'R').charAt(0).toUpperCase()}
                                               </div>
                                             )}
                                             <div className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full bg-amber-500 border-2 border-slate-950 flex items-center justify-center shadow-sm">
                                               <span className="w-1.5 h-1.5 rounded-full bg-white"></span>
                                             </div>
                                           </div>

                                           {/* Recruiter Name & Info */}
                                           <div className="flex flex-col min-w-0">
                                             <div className="flex items-center gap-1.5 flex-wrap">
                                               <span className="text-xs font-black text-slate-900 dark:text-white truncate max-w-[130px] sm:max-w-[200px]">
                                                 {recruiterName || 'Recruiter'}
                                               </span>
                                               {recruiterTag && (
                                                 <span className="text-[9px] font-semibold text-amber-300 bg-amber-500/15 px-1.5 py-0.2 rounded-md border border-amber-500/25 truncate">
                                                   {recruiterTag}
                                                 </span>
                                               )}
                                             </div>
                                             <div className="flex items-center gap-2 text-[9.5px] text-slate-600 dark:text-slate-400 font-medium mt-0.5 flex-wrap">
                                               <span className="text-amber-300 font-black">#{cardStartNum} - #{cardEndNum}</span>
                                               <span>•</span>
                                               <span className="flex items-center gap-1 text-slate-700 dark:text-slate-300">
                                                 <Calendar className="w-2.5 h-2.5 text-amber-400" />
                                                 {formatDateWithDay(post.date || '') || post.date}
                                               </span>
                                             </div>
                                           </div>
                                         </div>

                                         <div className="flex -space-x-1.5 shrink-0">
                                           {Array.from(new Set(post.platforms)).map((p, i) => (
                                             <div key={i} className="w-7 h-7 rounded-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex items-center justify-center shadow-lg">
                                               <ChannelPlatformIcon id={p} className={`w-3.5 h-3.5 ${CHANNELS.find(c => c.id === p)?.color?.split(' ')[0] || 'text-slate-900 dark:text-white'}`} />
                                             </div>
                                           ))}
                                         </div>
                                       </div>
                                      
                                      <div className="space-y-1.5 pt-2 border-t border-slate-200 dark:border-slate-800/30">
                                        {visibleLinks.map((link, i) => (
                                          <a 
                                            key={i} 
                                            href={link} 
                                            target="_blank" 
                                            rel="noopener noreferrer"
                                            className="flex items-center justify-between p-2 rounded-xl bg-white dark:bg-slate-950/80 hover:bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800/80 transition-colors group"
                                          >
                                            <div className="flex items-center gap-2 truncate">
                                              <span className="text-[10px] font-bold text-sky-600 dark:text-sky-400 shrink-0">
                                                {cardStartNum + i}.
                                              </span>
                                              <ChannelPlatformIcon id={post.platforms[i]} className={`w-3 h-3 shrink-0 ${CHANNELS.find(c => c.id === post.platforms[i])?.color?.split(' ')[0] || 'text-slate-500 dark:text-slate-400'}`} />
                                              <span className="text-[10px] text-slate-600 dark:text-slate-400 font-medium truncate max-w-[200px]">
                                                {link}
                                              </span>
                                            </div>
                                            <ExternalLink className="w-3 h-3 text-slate-600 group-hover:text-sky-400 transition-colors" />
                                          </a>
                                        ))}

                                        {post.links.length > 2 && (
                                          <button
                                            type="button"
                                            onClick={() => {
                                              setExpandedPostIds(prev => ({ ...prev, [post.id]: !isExpanded }));
                                              triggerHaptic('selection');
                                            }}
                                            className="w-full text-[10px] font-black text-sky-700 dark:text-sky-400 hover:text-sky-800 dark:hover:text-sky-300 bg-sky-500/10 hover:bg-sky-500/20 border border-sky-500/20 py-2 px-3 rounded-xl transition-all flex items-center justify-center gap-1.5 mt-1.5 active:scale-[0.99] shadow-sm cursor-pointer"
                                          >
                                            <span>{isExpanded ? 'Sembunyikan Link' : `Lihat Semua (${post.links.length} Link)`}</span>
                                            <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`} />
                                          </button>
                                        )}
                                      </div>
                                    </GlassCard>
                                  );
                                })}
                              </div>
                              )}

                              {/* Week Pagination Controls */}
                              {filteredWeekPosts.length > ITEMS_PER_PAGE && (
                                <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-3 rounded-2xl bg-white dark:bg-slate-950/80 border border-slate-200 dark:border-slate-800 shadow-inner mt-2">
                                  <div className="text-[10px] font-bold text-slate-600 dark:text-slate-400 text-center sm:text-left">
                                    Menampilkan <span className="text-slate-900 dark:text-white font-black">{Math.min((archivePage - 1) * ITEMS_PER_PAGE + 1, filteredWeekPosts.length)} - {Math.min(archivePage * ITEMS_PER_PAGE, filteredWeekPosts.length)}</span> dari <span className="text-slate-900 dark:text-white font-black">{filteredWeekPosts.length}</span> postingan
                                  </div>
                                  
                                  <div className="flex items-center gap-1.5">
                                    <button
                                      type="button"
                                      onClick={() => {
                                        if (archivePage > 1) {
                                          setArchivePage(prev => prev - 1);
                                          triggerHaptic('selection');
                                        }
                                      }}
                                      disabled={archivePage === 1}
                                      className={`px-3 py-1.5 rounded-xl text-[10px] font-black uppercase transition-all flex items-center gap-1 border ${
                                        archivePage === 1
                                          ? 'bg-slate-50 dark:bg-slate-900/40 text-slate-600 border-slate-950/40 cursor-not-allowed'
                                          : 'bg-slate-50 dark:bg-slate-900 text-amber-400 border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:bg-slate-800 hover:text-slate-900 dark:text-white shadow-sm'
                                      }`}
                                    >
                                      <ChevronLeft className="w-3.5 h-3.5" />
                                      Prev
                                    </button>

                                    <div className="flex items-center gap-1">
                                      {Array.from({ length: weekTotalPages }, (_, i) => i + 1)
                                        .filter(p => p === 1 || p === weekTotalPages || Math.abs(p - archivePage) <= 1)
                                        .map((p, idx, arr) => {
                                          const showDots = idx > 0 && p - arr[idx - 1] > 1;
                                          return (
                                            <React.Fragment key={p}>
                                              {showDots && <span className="text-slate-600 text-[10px] px-0.5">..</span>}
                                              <button
                                                type="button"
                                                onClick={() => {
                                                  setArchivePage(p);
                                                  triggerHaptic('selection');
                                                }}
                                                className={`w-7 h-7 rounded-xl text-[10px] font-black transition-all border ${
                                                  archivePage === p
                                                    ? 'bg-amber-500 text-slate-950 border-amber-400 shadow-md shadow-amber-500/20'
                                                    : 'bg-slate-50 dark:bg-slate-900 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-800 hover:text-slate-900 dark:text-white'
                                                }`}
                                              >
                                                {p}
                                              </button>
                                            </React.Fragment>
                                          );
                                        })}
                                    </div>

                                    <button
                                      type="button"
                                      onClick={() => {
                                        if (archivePage < weekTotalPages) {
                                          setArchivePage(prev => prev + 1);
                                          triggerHaptic('selection');
                                        }
                                      }}
                                      disabled={archivePage === weekTotalPages}
                                      className={`px-3 py-1.5 rounded-xl text-[10px] font-black uppercase transition-all flex items-center gap-1 border ${
                                        archivePage === weekTotalPages
                                          ? 'bg-slate-50 dark:bg-slate-900/40 text-slate-600 border-slate-950/40 cursor-not-allowed'
                                          : 'bg-slate-50 dark:bg-slate-900 text-amber-400 border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:bg-slate-800 hover:text-slate-900 dark:text-white shadow-sm'
                                      }`}
                                    >
                                      Next
                                      <ChevronRight className="w-3.5 h-3.5" />
                                    </button>
                                  </div>
                                </div>
                              )}
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    );
                  })
                )}
              </div>
            )}
          </motion.div>
        )}

        {isManagement && activeView === 'status' && (
          <motion.div
            initial={{ opacity: 0, x: 10 }}
            animate={{ opacity: 1, x: 0 }}
            className="space-y-3"
          >
            {recruiters.length === 0 ? (
              <div className="py-20 text-center bg-slate-50 dark:bg-slate-900/40 rounded-3xl border border-slate-200 dark:border-slate-800/50">
                <Users className="w-8 h-8 text-slate-700 mx-auto mb-2" />
                <p className="text-xs font-bold text-slate-500 dark:text-slate-400">Belum ada recruiter.</p>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="flex items-center justify-between px-1 mb-1">
                  <h3 className="text-[11px] font-black text-slate-700 dark:text-slate-300 uppercase tracking-widest">
                    Status Posting Hari Ini
                  </h3>
                  <span className="text-[9px] font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                    {formatDateWithDay(getWIBDate())}
                  </span>
                </div>

                {/* Secondary Sub-Tabs Filter for Recruiter Status */}
                <div className="flex p-1 bg-white dark:bg-slate-950/80 rounded-xl border border-slate-200 dark:border-slate-800 shadow-inner gap-1 my-2">
                  <button
                    type="button"
                    onClick={() => { setStatusFilter('semua'); triggerHaptic('selection'); }}
                    className={`flex-1 py-2 text-center rounded-lg text-[10px] font-black uppercase transition-all ${
                      statusFilter === 'semua'
                        ? 'bg-slate-100 dark:bg-slate-900 text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-800 shadow-md'
                        : 'text-slate-500 dark:text-slate-400 hover:text-slate-600 dark:text-slate-400 border border-transparent'
                    }`}
                  >
                    Semua ({statusCounts.semua})
                  </button>
                  <button
                    type="button"
                    onClick={() => { setStatusFilter('aktif'); triggerHaptic('selection'); }}
                    className={`flex-1 py-2 text-center rounded-lg text-[10px] font-black uppercase transition-all ${
                      statusFilter === 'aktif'
                        ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20 shadow-md'
                        : 'text-slate-500 dark:text-slate-400 hover:text-slate-600 dark:text-slate-400 border border-transparent'
                    }`}
                  >
                    Aktif ({statusCounts.aktif})
                  </button>
                  <button
                    type="button"
                    onClick={() => { setStatusFilter('belum'); triggerHaptic('selection'); }}
                    className={`flex-1 py-2 text-center rounded-lg text-[10px] font-black uppercase transition-all ${
                      statusFilter === 'belum'
                        ? 'bg-rose-500/10 text-rose-700 dark:text-rose-400 border border-rose-500/20 shadow-md'
                        : 'text-slate-500 dark:text-slate-400 hover:text-slate-600 dark:text-slate-400 border border-transparent'
                    }`}
                  >
                    Belum ({statusCounts.belum})
                  </button>
                </div>
                
                {filteredRecruiters.length === 0 ? (
                  <div className="py-12 text-center bg-slate-50 dark:bg-slate-900/20 rounded-2xl border border-slate-200 dark:border-slate-800/50">
                    <Users className="w-6 h-6 text-slate-700 mx-auto mb-1.5" />
                    <p className="text-[10px] font-bold text-slate-500 dark:text-slate-400">Tidak ada recruiter untuk status ini.</p>
                  </div>
                ) : (
                  filteredRecruiters.slice((statusPage - 1) * ITEMS_PER_PAGE, statusPage * ITEMS_PER_PAGE).map((rec) => {
                    const recPosts = allTodayPosts.filter(p => p.telegramId === String(rec.telegramId));
                    const totalLinksCount = recPosts.reduce((sum, p) => sum + (Array.isArray(p.links) ? p.links.length : 0), 0);
                    const hasPosted = totalLinksCount > 0;
                    return (
                      <GlassCard key={rec.telegramId} className={`p-3 border-l-4 ${hasPosted ? 'border-l-emerald-500 bg-white dark:bg-slate-950/80' : 'border-l-rose-500 bg-white dark:bg-slate-950/60'}`}>
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full overflow-hidden bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 shrink-0">
                            {rec.photoUrl ? (
                              <img referrerPolicy="no-referrer" src={rec.photoUrl} alt={rec.firstName} className="w-full h-full object-cover" />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center text-xs font-black text-slate-600 dark:text-slate-400">
                                {rec.firstName?.charAt(0) || '?'}
                              </div>
                            )}
                          </div>
                          
                          {/* Post count badge next to photo */}
                          <div className={`flex flex-col items-center justify-center px-2 py-1 rounded-xl shrink-0 min-w-[42px] border ${
                            totalLinksCount > 0 
                              ? 'bg-emerald-500/5 border-emerald-500/20 text-emerald-400' 
                              : 'bg-slate-50 dark:bg-slate-900/30 border-slate-200 dark:border-slate-800/50 text-slate-500 dark:text-slate-400'
                          }`}>
                            <span className="text-xs font-black">
                              {totalLinksCount}
                            </span>
                            <span className={`text-[6.5px] font-black uppercase tracking-wider ${
                              totalLinksCount > 0 ? 'text-emerald-500/70' : 'text-slate-600'
                            }`}>
                              Post
                            </span>
                          </div>

                          <div className="flex-1 min-w-0">
                            <h4 className="text-sm font-bold text-slate-900 dark:text-white truncate">
                              {rec.firstName} {rec.lastName || ''}
                            </h4>
                            <p className="text-[10px] text-slate-600 dark:text-slate-400 font-medium truncate">
                              {rec.username ? formatUsername(rec.username) : String(rec.telegramId)}
                            </p>
                          </div>
                          <div className="shrink-0">
                            {hasPosted ? (
                              <span className="flex items-center gap-1 text-[10px] font-black text-emerald-400 bg-emerald-500/10 px-2 py-1 rounded-lg border border-emerald-500/20">
                                <CheckCircle2 className="w-3.5 h-3.5" />
                                SUDAH
                              </span>
                            ) : (
                              <span className="flex items-center gap-1 text-[10px] font-black text-rose-400 bg-rose-500/10 px-2 py-1 rounded-lg border border-rose-500/20">
                                <AlertCircle className="w-3.5 h-3.5" />
                                BELUM
                              </span>
                            )}
                          </div>
                        </div>
                      </GlassCard>
                    );
                  })
                )}

                {/* Recruiter Status Pagination Controls */}
                {filteredRecruiters.length > ITEMS_PER_PAGE && (
                  <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-3 rounded-2xl bg-white dark:bg-slate-950/80 border border-slate-200 dark:border-slate-800 shadow-inner mt-4">
                    <div className="text-[10px] font-bold text-slate-600 dark:text-slate-400 text-center sm:text-left">
                      Menampilkan <span className="text-slate-900 dark:text-white font-black">{Math.min((statusPage - 1) * ITEMS_PER_PAGE + 1, filteredRecruiters.length)} - {Math.min(statusPage * ITEMS_PER_PAGE, filteredRecruiters.length)}</span> dari <span className="text-slate-900 dark:text-white font-black">{filteredRecruiters.length}</span> recruiter
                    </div>
                    
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => {
                          if (statusPage > 1) {
                            setStatusPage(prev => prev - 1);
                            triggerHaptic('selection');
                          }
                        }}
                        disabled={statusPage === 1}
                        className={`px-3 py-1.5 rounded-xl text-[10px] font-black uppercase transition-all flex items-center gap-1 border ${
                          statusPage === 1
                            ? 'bg-slate-50 dark:bg-slate-900/40 text-slate-600 border-slate-950/40 cursor-not-allowed'
                            : 'bg-slate-50 dark:bg-slate-900 text-emerald-400 border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:bg-slate-800 hover:text-slate-900 dark:text-white shadow-sm'
                        }`}
                      >
                        <ChevronLeft className="w-3.5 h-3.5" />
                        Prev
                      </button>

                      <div className="flex items-center gap-1">
                        {Array.from({ length: Math.max(1, Math.ceil(filteredRecruiters.length / ITEMS_PER_PAGE)) }, (_, i) => i + 1)
                          .filter(p => p === 1 || p === Math.max(1, Math.ceil(filteredRecruiters.length / ITEMS_PER_PAGE)) || Math.abs(p - statusPage) <= 1)
                          .map((p, idx, arr) => {
                            const showDots = idx > 0 && p - arr[idx - 1] > 1;
                            return (
                              <React.Fragment key={p}>
                                {showDots && <span className="text-slate-600 text-[10px] px-0.5">..</span>}
                                <button
                                  type="button"
                                  onClick={() => {
                                    setStatusPage(p);
                                    triggerHaptic('selection');
                                  }}
                                  className={`w-7 h-7 rounded-xl text-[10px] font-black transition-all border ${
                                    statusPage === p
                                      ? 'bg-emerald-500 text-slate-950 border-emerald-400 shadow-md shadow-emerald-500/20'
                                      : 'bg-slate-50 dark:bg-slate-900 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-800 hover:text-slate-900 dark:text-white'
                                  }`}
                                >
                                  {p}
                                </button>
                              </React.Fragment>
                            );
                          })}
                      </div>

                      <button
                        type="button"
                        onClick={() => {
                          if (statusPage < Math.max(1, Math.ceil(filteredRecruiters.length / ITEMS_PER_PAGE))) {
                            setStatusPage(prev => prev + 1);
                            triggerHaptic('selection');
                          }
                        }}
                        disabled={statusPage === Math.max(1, Math.ceil(filteredRecruiters.length / ITEMS_PER_PAGE))}
                        className={`px-3 py-1.5 rounded-xl text-[10px] font-black uppercase transition-all flex items-center gap-1 border ${
                          statusPage === Math.max(1, Math.ceil(filteredRecruiters.length / ITEMS_PER_PAGE))
                            ? 'bg-slate-50 dark:bg-slate-900/40 text-slate-600 border-slate-950/40 cursor-not-allowed'
                            : 'bg-slate-50 dark:bg-slate-900 text-emerald-400 border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:bg-slate-800 hover:text-slate-900 dark:text-white shadow-sm'
                        }`}
                      >
                        Next
                        <ChevronRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </motion.div>
        )}
      </div>

      {/* Modern Alert Modal Overlay */}
      <AnimatePresence>
        {alertState.isOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-white dark:bg-slate-950/80 backdrop-blur-md">
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="w-full max-w-sm rounded-3xl bg-slate-50 dark:bg-slate-900/95 border border-slate-200 dark:border-slate-800 p-6 shadow-2xl space-y-5 text-center relative overflow-hidden"
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
                  className={`w-16 h-16 rounded-2xl flex items-center justify-center border shadow-inner ${
                    alertState.type === 'success'
                      ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                      : alertState.type === 'error'
                      ? 'bg-rose-500/10 border-rose-500/30 text-rose-400'
                      : 'bg-amber-500/10 border-amber-500/30 text-amber-400'
                  }`}
                >
                  {alertState.type === 'success' && <CheckCircle2 className="w-8 h-8" />}
                  {alertState.type === 'error' && <AlertCircle className="w-8 h-8" />}
                  {alertState.type === 'warning' && <AlertTriangle className="w-8 h-8" />}
                </div>
              </div>

              {/* Content */}
              <div className="space-y-2">
                <h3 className="text-base font-black text-slate-900 dark:text-white tracking-tight">
                  {alertState.title}
                </h3>
                <p className="text-xs font-medium text-slate-700 dark:text-slate-300 leading-relaxed">
                  {alertState.message}
                </p>
              </div>

              {/* Action */}
              <Button
                fullWidth
                variant={alertState.type === 'success' ? 'primary' : 'secondary'}
                onClick={closeAlert}
                className="py-3 font-black text-xs uppercase"
              >
                Mengerti
              </Button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
