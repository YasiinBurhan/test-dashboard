import React, { useState, useRef, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { GlassCard } from '../components/common/GlassCard';
import { Button } from '../components/common/Button';
import { useAuth } from '../hooks/useAuth';
import { useReports } from '../hooks/useReports';
import { triggerHaptic } from '../telegram/webapp';
import { getSystemSettings } from '../firebase/services/settingService';
import { subscribeToAllUsers } from '../firebase/services/userService';
import { createPost, subscribeToRecruiterPosts, getRecruiterPosts, subscribeToTodayPostsAllRecruiters, archiveOldPosts } from '../firebase/services/postService';
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
  Award
} from 'lucide-react';

const getApiBaseUrl = () => {
  if (import.meta.env.VITE_BACKEND_URL) {
    return import.meta.env.VITE_BACKEND_URL;
  }
  const hostname = typeof window !== 'undefined' ? window.location.hostname : '';
  if (hostname.endsWith('.vercel.app')) {
    return '';
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
  { id: 'X (Twitter)', label: 'X (Twitter)', color: 'text-slate-200 border-slate-700 bg-slate-800/20', active: 'bg-slate-200 text-slate-900 border-white' },
  { id: 'Threads', label: 'Threads', color: 'text-white border-zinc-700 bg-zinc-800/20', active: 'bg-white text-zinc-950 border-white' },
  { id: 'Instagram', label: 'Instagram', color: 'text-pink-400 border-pink-500/20 bg-pink-500/5', active: 'bg-gradient-to-r from-purple-500 to-pink-500 text-white border-transparent' },
  { id: 'TikTok', label: 'TikTok', color: 'text-cyan-400 border-cyan-400/20 bg-cyan-400/5', active: 'bg-cyan-500 text-slate-950 border-cyan-400' },
  { id: 'WhatsApp', label: 'WhatsApp', color: 'text-emerald-400 border-emerald-500/20 bg-emerald-500/5', active: 'bg-emerald-600 text-white border-emerald-500' },
  { id: 'Telegram', label: 'Telegram', color: 'text-sky-400 border-sky-400/20 bg-sky-400/5', active: 'bg-sky-500 text-white border-sky-400' },
  { id: 'Lainnya', label: 'Lainnya', color: 'text-slate-400 border-slate-700 bg-slate-800/20', active: 'bg-slate-700 text-white border-slate-600' },
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
  const [recruiters, setRecruiters] = useState<UserProfile[]>([]);
  const [selectedRecruiterId, setSelectedRecruiterId] = useState<string>('');
  const [activeView, setActiveView] = useState<'buat' | 'minggu_ini' | 'arsip' | 'status'>('buat');
  const currentDayName = getIndonesianDayName(getWIBDate()) || 'Senin';
  const [selectedDay, setSelectedDay] = useState<string>(currentDayName);
  const [selectedArchiveDay, setSelectedArchiveDay] = useState<string>('Senin');
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
      if (!d) return '';
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
    if (isManagement) {
      const unsubscribeUsers = subscribeToAllUsers((users) => {
        const recs = users.filter(u => u.role === 'Recruiter');
        setRecruiters(recs);
        setSelectedRecruiterId(prev => prev || (recs.length > 0 ? recs[0].telegramId : ''));
      });

      const unsubscribePosts = subscribeToTodayPostsAllRecruiters((posts) => {
        setAllTodayPosts(posts);
      });

      return () => {
        unsubscribeUsers();
        unsubscribePosts();
      };
    }
  }, [isManagement]); // Remove activeView to avoid infinite re-renders or resubscriptions

  // Calculate recruits recorded in Data Harian today for this recruiter
  const todayRecruits = useMemo(() => {
    const today = getWIBDate();
    const normalizeDate = (d: string) => {
      if (!d) return '';
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

      if (activeView === 'minggu_ini') {
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
    if (!effectiveTelegramId) return;

    setIsLoadingHistory(true);
    const unsubscribe = subscribeToRecruiterPosts(
      effectiveTelegramId,
      (fetchedPosts) => {
        const normalizeDate = (d: string) => {
          if (!d) return '';
          const parts = d.split('-');
          if (parts.length !== 3) return d;
          if (parts[0].length === 2) return parts.reverse().join('-');
          return d;
        };

        const today = getWIBDate();
        const normalizedToday = normalizeDate(today);
        const currentMonday = getWIBMonday(0);

        // Calculate next startNumber and total posting links count today
        const todayPosts = fetchedPosts.filter(p => normalizeDate(p.date || '') === normalizedToday && !p.archived);

        const totalLinksToday = todayPosts.reduce((acc, post) => {
          const linkCount = Array.isArray(post.links) ? post.links.length : 0;
          return acc + linkCount;
        }, 0);
        setTodayPostingsCount(totalLinksToday);

        // Debug Logging (Requirement #8)
        console.log('[Smart Detection Debug]', {
          jumlahDokumenHariIni: todayPosts.length,
          dokumenHariIni: todayPosts.map(p => ({
            id: p.id,
            startNumber: p.startNumber,
            jumlahLink: Array.isArray(p.links) ? p.links.length : 0,
            date: p.date
          })),
          totalLinksToday,
          startNumberYangDihitung: totalLinksToday === 0 ? 1 : totalLinksToday + 1,
          hasUserEdited: hasUserEditedStartNumberRef.current
        });

        if (todayPosts.length === 0) {
          if (!hasUserEditedStartNumberRef.current) {
            setStartNumber(1);
          }
        } else if (!hasUserEditedStartNumberRef.current) {
          setStartNumber(totalLinksToday + 1);
        }

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
      },
      100
    );

    return () => unsubscribe();
  }, [effectiveTelegramId]);

  const resetToAutoStartNumber = () => {
    setHasUserEditedStartNumber(false);
    hasUserEditedStartNumberRef.current = false;
    const normalizeDate = (d: string) => {
      if (!d) return '';
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

  // Sync displayed posts based on activeView & selectedDay
  useEffect(() => {
    if (activeView === 'minggu_ini') {
      setPosts(allCurrentWeekPosts.filter(p => getIndonesianDayName(p.date || '') === selectedDay));
    } else if (activeView === 'arsip') {
      setPosts(allArchivedPosts);
    }
  }, [activeView, selectedDay, allCurrentWeekPosts, allArchivedPosts]);

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

  const compressImage = (base64: string, quality: number = 0.7): Promise<string> => {
    return new Promise((resolve) => {
      const img = new Image();
      img.src = base64;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        
        // Target resolution for Telegram
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

    if (images.length === 0) {
      showAlert('warning', 'Foto Belum Diunggah', 'Mohon unggah minimal 1 foto screenshot postingan (1–10 foto) sebelum mengirim.');
      setFormStep('upload');
      return;
    }

    if (images.length > 10) {
      showAlert('warning', 'Foto Melebihi Batas', 'Maksimal 10 foto screenshot postingan diperbolehkan. Mohon kurangi jumlah foto.');
      setFormStep('upload');
      return;
    }

    const validLinks = links.filter(l => l.url.trim() !== '');
    if (validLinks.length === 0) {
      showAlert('warning', 'Link Belum Diisi', 'Minimal masukkan 1 link postingan valid.');
      return;
    }

    if (validLinks.length > 10) {
      showAlert('warning', 'Link Melebihi Batas', 'Maksimal 10 link postingan per batch.');
      return;
    }

    // Duplicate Check
    const normalizeDate = (d: string) => {
      if (!d) return '';
      const parts = d.split('-');
      if (parts.length !== 3) return d;
      if (parts[0].length === 2) return parts.reverse().join('-');
      return d;
    };
    const today = getWIBDate();
    const normalizedToday = normalizeDate(today);
    const todayPosts = posts.filter(p => normalizeDate(p.date || '') === normalizedToday);
    const existingLinks = new Set(todayPosts.flatMap(p => p.links));
    
    const duplicates = validLinks.filter(l => existingLinks.has(l.url));
    if (duplicates.length > 0) {
      showAlert(
        'error',
        'Terdapat Link Duplikat',
        `Terdapat ${duplicates.length} link yang sudah pernah dikirim hari ini. Mohon periksa dan hapus duplikasi.`
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
      
      // Compress all images
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
      if (API_BASE_URL) {
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
          throw new Error('Token Bot Telegram atau Group ID belum dikonfigurasi di Pengaturan.');
        }

        if (!targetGroup.startsWith('-100') && !targetGroup.startsWith('@')) {
          if (!targetGroup.startsWith('-')) targetGroup = '-100' + targetGroup;
          else targetGroup = '-100' + targetGroup.substring(1);
        }
        const topicNum = targetTopic && !isNaN(Number(targetTopic)) ? Number(targetTopic) : undefined;

        let textContent = `📌 <b>LINK POSTINGAN BARU</b>\n\n`;
        textContent += `👤 <b>Recruiter:</b> ${recruiterName} (${recruiterUsername ? '@' + recruiterUsername : '-'})\n`;
        textContent += `📊 <b>Jumlah Link:</b> ${validLinks.length}\n\n`;
        validLinks.forEach((l, idx) => {
          textContent += `${effectiveStartNum + idx}. ${l.url}\n`;
        });

        if (compressedImages && compressedImages.length > 0) {
          const base64Data = compressedImages[0];
          const fetchRes = await fetch(base64Data);
          const blob = await fetchRes.blob();
          const formData = new FormData();
          formData.append('chat_id', targetGroup);
          if (topicNum) formData.append('message_thread_id', String(topicNum));
          formData.append('photo', blob, 'image.jpg');
          formData.append('caption', textContent);
          formData.append('parse_mode', 'HTML');

          const tgRes = await fetch(`https://api.telegram.org/bot${token}/sendPhoto`, {
            method: 'POST',
            body: formData
          });
          const tgData = await tgRes.json();
          if (!tgData.ok) {
            throw new Error(`Telegram Error: ${tgData.description || 'Gagal mengirim gambar ke Telegram'}`);
          }
          sendSuccess = true;
        } else {
          const tgRes = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              chat_id: targetGroup,
              message_thread_id: topicNum,
              text: textContent,
              parse_mode: 'HTML'
            })
          });
          const tgData = await tgRes.json();
          if (!tgData.ok) {
            throw new Error(`Telegram Error: ${tgData.description || 'Gagal mengirim pesan ke Telegram'}`);
          }
          sendSuccess = true;
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
        
        // Switch view to Minggu Ini Posts automatically
        setActiveView('minggu_ini');
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
        {/* Live Timer Section */}
        <GlassCard className="p-4 border-amber-500/20 bg-amber-500/5 overflow-hidden relative">
          <div className="absolute top-0 right-0 p-2 opacity-10">
            <Sparkles className="w-12 h-12 text-amber-500" />
          </div>
          <div className="flex items-center justify-between relative z-10 gap-3">
            <div className="flex flex-col min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[10px] font-black text-amber-400 uppercase tracking-widest flex items-center gap-1.5">
                  <Timer className="w-3.5 h-3.5 animate-pulse text-amber-400" />
                  Batas Waktu Harian
                </span>
                <span className="text-[8px] font-black uppercase text-amber-300 bg-amber-500/10 px-2 py-0.5 rounded-full border border-amber-500/20">
                  {formatDateWithDay(getWIBDate())}
                </span>
                <span className="text-[8px] font-black uppercase text-amber-300 bg-amber-500/10 px-2 py-0.5 rounded-full border border-amber-500/20">
                  Maksimal 22:00 WIB (10 Malam)
                </span>
              </div>
              <p className="text-[9.5px] text-slate-400 font-medium mt-0.5 leading-snug">
                Pengiriman postingan ditutup otomatis pukul 22:00 WIB.
              </p>
              <div className="flex items-center gap-1.5 mt-2 font-mono">
                <div className="text-center">
                  <span className="text-2xl font-black text-white tracking-tighter">{hours}</span>
                  <span className="block text-[7px] font-bold text-slate-500 uppercase -mt-1 font-sans">Jam</span>
                </div>
                <span className="text-lg font-black text-amber-500/50 -translate-y-1">:</span>
                <div className="text-center">
                  <span className="text-2xl font-black text-white tracking-tighter">{minutes}</span>
                  <span className="block text-[7px] font-bold text-slate-500 uppercase -mt-1 font-sans">Menit</span>
                </div>
                <span className="text-lg font-black text-amber-500/50 -translate-y-1">:</span>
                <div className="text-center">
                  <span className="text-2xl font-black text-amber-400 tracking-tighter">{seconds}</span>
                  <span className="block text-[7px] font-bold text-slate-500 uppercase -mt-1 font-sans">Detik</span>
                </div>
                <span className="text-[9px] font-bold text-slate-400 ml-2 font-sans self-center">Sisa Waktu Hari Ini</span>
              </div>
            </div>
            <div className="text-right shrink-0">
              <div className="text-[9px] font-black text-slate-500 uppercase mb-1">Status Waktu</div>
              <div className="w-24 h-2 bg-slate-900 rounded-full overflow-hidden border border-slate-800">
                <motion.div 
                  initial={{ width: 0 }}
                  animate={{ width: `${elapsedPercent}%` }}
                  className="h-full bg-gradient-to-r from-amber-600 to-amber-400"
                />
              </div>
              <span className="text-[8px] font-bold text-amber-400 mt-1 block">
                {Math.round(elapsedPercent)}% Waktu Berjalan
              </span>
            </div>
          </div>
        </GlassCard>

        {/* Header Section */}
        <div className="px-1 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-black text-white flex items-center gap-2">
              <ImageIcon className="w-6 h-6 text-sky-400" />
              Batch Postingan
            </h1>
          </div>
        </div>

        {/* Recruiter Selection for Admin/Owner */}
        {isManagement && activeView !== 'status' && recruiters.length > 0 && (
          <div className="mb-4 bg-slate-950/80 rounded-2xl border border-slate-800 p-3">
            <label className="text-[10px] font-black uppercase text-slate-500 mb-2 block tracking-widest">
              Pilih Recruiter ({recruiters.length})
            </label>
            <div className="relative">
              <select
                value={selectedRecruiterId}
                onChange={(e) => {
                  setSelectedRecruiterId(e.target.value);
                  triggerHaptic('selection');
                }}
                className="w-full appearance-none bg-slate-900 border border-slate-700 text-white text-xs font-bold rounded-xl py-3 pl-12 pr-10 outline-none focus:border-sky-500 transition-colors"
              >
                {recruiters.map((rec) => {
                  const fullName = rec.lastName ? `${rec.firstName} ${rec.lastName}` : (rec.firstName || 'Recruiter');
                  const uname = formatUsername(rec.username || rec.firstName || rec.telegramId);
                  return (
                    <option key={rec.telegramId} value={rec.telegramId}>
                      {fullName} ({uname})
                    </option>
                  );
                })}
              </select>
              <div className="absolute left-3 top-1/2 -translate-y-1/2 w-7 h-7 rounded-full bg-slate-800 overflow-hidden border border-slate-700">
                {recruiters.find(r => String(r.telegramId) === String(selectedRecruiterId))?.photoUrl ? (
                  <img 
                    src={recruiters.find(r => String(r.telegramId) === String(selectedRecruiterId))?.photoUrl} 
                    alt="Recruiter" 
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-[10px] font-black text-slate-400">
                    {recruiters.find(r => String(r.telegramId) === String(selectedRecruiterId))?.firstName?.charAt(0)?.toUpperCase() || '?'}
                  </div>
                )}
              </div>
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
            </div>
          </div>
        )}

        {/* Main Navigation Tabs */}
        <div 
          style={{ top: 'calc(60px + env(safe-area-inset-top, 0px))' }}
          className="sticky z-30 flex p-1 bg-slate-950/95 backdrop-blur-md rounded-2xl border border-slate-850/80 shadow-2xl mb-4"
        >
          <button
            onClick={() => { setActiveView('buat'); triggerHaptic('selection'); }}
            className={`flex-1 flex items-center justify-center gap-2 h-11 rounded-xl text-[10px] font-black uppercase transition-all ${
              activeView === 'buat' 
                ? 'bg-sky-500/10 text-sky-400 border border-sky-500/20 shadow-lg' 
                : 'text-slate-600 hover:text-slate-400 border border-transparent'
            }`}
          >
            <Plus className="w-3.5 h-3.5" />
            Buat
          </button>
          <button
            onClick={() => { setActiveView('minggu_ini'); triggerHaptic('selection'); }}
            className={`flex-1 flex flex-col items-center justify-center h-11 rounded-xl transition-all ${
              activeView === 'minggu_ini' 
                ? 'bg-sky-500/10 text-sky-400 border border-sky-500/20 shadow-lg' 
                : 'text-slate-600 hover:text-slate-400 border border-transparent'
            }`}
          >
            <div className="flex items-center gap-1.5 text-[10px] font-black uppercase">
              <Calendar className="w-3.5 h-3.5" />
              <span>Minggu Ini</span>
            </div>
            <span className="text-[7px] font-bold opacity-60 mt-0.5 text-center w-full block">
              {weekDays[0]?.displayDate} - {weekDays[6]?.displayDate}
            </span>
          </button>
          <button
            onClick={() => { setActiveView('arsip'); triggerHaptic('selection'); }}
            className={`flex-1 flex items-center justify-center gap-2 h-11 rounded-xl text-[10px] font-black uppercase transition-all ${
              activeView === 'arsip' 
                ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20 shadow-lg' 
                : 'text-slate-600 hover:text-slate-400 border border-transparent'
            }`}
          >
            <Archive className="w-3.5 h-3.5" />
            Arsip
          </button>
          {isManagement && (
            <button
              onClick={() => { setActiveView('status'); triggerHaptic('selection'); }}
              className={`flex-1 flex items-center justify-center gap-2 h-11 rounded-xl text-[10px] font-black uppercase transition-all ${
                activeView === 'status' 
                  ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 shadow-lg' 
                  : 'text-slate-600 hover:text-slate-400 border border-transparent'
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
            {isTimeRestricted ? (
              <GlassCard className="p-8 text-center space-y-6 border-rose-500/30 bg-rose-500/5 relative overflow-hidden py-12">
                <div className="absolute top-0 right-0 p-3 opacity-5">
                  <Clock className="w-32 h-32 text-rose-500" />
                </div>
                
                <div className="w-20 h-20 rounded-full bg-rose-500/10 border border-rose-500/30 flex items-center justify-center mx-auto text-rose-400 animate-pulse shadow-lg">
                  <Clock className="w-10 h-10" />
                </div>
                
                <div className="space-y-2 max-w-md mx-auto">
                  <h3 className="text-lg font-black text-white tracking-tight">
                    Pengiriman Postingan Ditutup 🔒
                  </h3>
                  <p className="text-xs text-rose-200/80 leading-relaxed font-medium">
                    Batas waktu pengiriman postingan harian adalah pukul <strong className="text-rose-300">22:00 WIB</strong>. 
                    Semua input pengiriman dikunci sementara dan akan otomatis dibuka kembali pada pukul <strong className="text-rose-300">00:00 WIB (Midnight)</strong>.
                  </p>
                </div>

                <div className="p-4 rounded-2xl bg-slate-950/80 border border-slate-800/80 max-w-sm mx-auto shadow-inner">
                  <p className="text-[9px] font-black uppercase text-slate-500 tracking-wider mb-2">
                    Akan Dibuka Kembali Dalam:
                  </p>
                  <div className="flex items-center justify-center gap-2">
                    <div className="flex flex-col items-center">
                      <span className="text-2xl font-black text-rose-400 tracking-tighter">{hours}</span>
                      <span className="text-[7px] font-bold text-slate-500 uppercase mt-0.5">Jam</span>
                    </div>
                    <span className="text-lg font-black text-rose-500/40 -translate-y-1">:</span>
                    <div className="flex flex-col items-center">
                      <span className="text-2xl font-black text-rose-400 tracking-tighter">{minutes}</span>
                      <span className="text-[7px] font-bold text-slate-500 uppercase mt-0.5">Menit</span>
                    </div>
                    <span className="text-lg font-black text-rose-500/40 -translate-y-1">:</span>
                    <div className="flex flex-col items-center">
                      <span className="text-2xl font-black text-rose-400 tracking-tighter">{seconds}</span>
                      <span className="text-[7px] font-bold text-slate-500 uppercase mt-0.5">Detik</span>
                    </div>
                  </div>
                </div>

                <div className="pt-2">
                  <p className="text-[10px] text-slate-500 font-medium">
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
                  <h3 className="text-xl font-black text-white tracking-tight">
                    Selamat! Target Hari Ini Telah Tercapai!
                  </h3>
                  <p className="text-xs text-slate-300 leading-relaxed font-medium">
                    Luar biasa! Anda telah memposting <strong className="text-emerald-400">{todayPostingsCount} link</strong> dari target minimum <strong className="text-emerald-400">{targetRule.required} postingan</strong> (berdasarkan {todayRecruits} rekrutan di Data Harian).
                  </p>
                </div>

                {/* Summary Grid */}
                <div className="grid grid-cols-3 gap-2 max-w-md mx-auto p-3 rounded-2xl bg-slate-950/80 border border-slate-800/80 shadow-inner">
                  <div className="p-2 text-center">
                    <p className="text-[8px] font-black text-slate-500 uppercase">Rekrutan Hari Ini</p>
                    <p className="text-xs font-black text-emerald-400 mt-0.5">{todayRecruits} Orang</p>
                  </div>
                  <div className="p-2 text-center border-x border-slate-800">
                    <p className="text-[8px] font-black text-slate-500 uppercase">Target Minimal</p>
                    <p className="text-xs font-black text-sky-400 mt-0.5">{targetRule.required} Link</p>
                  </div>
                  <div className="p-2 text-center">
                    <p className="text-[8px] font-black text-slate-500 uppercase">Telah Diposting</p>
                    <p className="text-xs font-black text-emerald-300 mt-0.5">{todayPostingsCount} Link</p>
                  </div>
                </div>

                <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 max-w-md mx-auto text-center space-y-1">
                  <p className="text-[11px] font-bold text-emerald-200">
                    🔒 Formulir postingan ditutup otomatis untuk hari ini.
                  </p>
                  <p className="text-[9.5px] text-slate-400 font-medium">
                    Silakan beristirahat atau persiapkan materi postingan Anda untuk besok. Kerja bagus!
                  </p>
                </div>
              </GlassCard>
            ) : (
              <>
                {/* Syarat Target Postingan Harian (Berpatokan Data Harian) */}
                <GlassCard className="p-4 space-y-3.5 bg-slate-950/80 border-slate-800 shadow-xl relative overflow-hidden">
              <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
                <div className="flex items-center gap-2.5">
                  <div className={`w-9 h-9 rounded-2xl bg-gradient-to-br ${targetRule.color} flex items-center justify-center shrink-0 border shadow-inner`}>
                    <Target className={`w-4 h-4 ${targetRule.iconColor}`} />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-xs font-black text-white tracking-tight">Target Postingan Harian</h3>
                      <span className="text-[8px] font-black uppercase text-sky-400 bg-sky-500/10 px-2 py-0.5 rounded-full border border-sky-500/20 flex items-center gap-1">
                        <Sparkles className="w-2.5 h-2.5" /> Data Harian Sync
                      </span>
                    </div>
                    <p className="text-[10px] text-slate-400 font-medium mt-0.5 leading-snug">
                      {targetRule.description}
                    </p>
                  </div>
                </div>
              </div>

              {/* Realtime Status Banner */}
              <div className="grid grid-cols-3 gap-2">
                <div className="p-2.5 rounded-2xl bg-slate-900/90 border border-slate-800/80 text-center">
                  <p className="text-[8px] font-black uppercase text-slate-500">Rekrutan Hari Ini</p>
                  <p className="text-sm font-black text-emerald-400 mt-0.5">{todayRecruits} Orang</p>
                </div>
                <div className="p-2.5 rounded-2xl bg-slate-900/90 border border-slate-800/80 text-center">
                  <p className="text-[8px] font-black uppercase text-slate-500">Target Posting</p>
                  <p className={`text-sm font-black mt-0.5 ${targetRule.isFree ? 'text-emerald-300' : 'text-sky-400'}`}>
                    {targetRule.label}
                  </p>
                </div>
                <div className="p-2.5 rounded-2xl bg-slate-900/90 border border-slate-800/80 text-center">
                  <p className="text-[8px] font-black uppercase text-slate-500">Telah Diposting</p>
                  <p className="text-sm font-black text-white mt-0.5">
                    {todayPostingsCount} {targetRule.isFree ? '' : `/ ${targetRule.required}`}
                  </p>
                </div>
              </div>

              {/* Progress Bar or Free Badge */}
              {!targetRule.isFree ? (
                <div className="space-y-1.5 pt-0.5">
                  <div className="flex items-center justify-between text-[10px] font-bold">
                    <span className="text-slate-400">Progres Target Hari Ini</span>
                    <span className={todayPostingsCount >= targetRule.required ? 'text-emerald-400 font-black' : 'text-amber-400 font-black'}>
                      {todayPostingsCount >= targetRule.required 
                        ? '✅ Target Postingan Selesai' 
                        : `Kurang ${targetRule.required - todayPostingsCount} postingan lagi`}
                    </span>
                  </div>
                  <div className="w-full h-2.5 bg-slate-900 rounded-full overflow-hidden border border-slate-800 p-0.5">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${Math.min(100, Math.round((todayPostingsCount / targetRule.required) * 100))}%` }}
                      className={`h-full rounded-full ${
                        todayPostingsCount >= targetRule.required 
                          ? 'bg-gradient-to-r from-emerald-500 to-teal-400' 
                          : 'bg-gradient-to-r from-sky-500 via-blue-500 to-indigo-500'
                      }`}
                    />
                  </div>
                </div>
              ) : (
                <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-[10px] font-bold flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                    Bebas jumlah posting karena rekrutan hari ini sudah ≥ 3!
                  </span>
                  <span className="text-[9px] uppercase font-black bg-emerald-500/20 text-emerald-300 px-2.5 py-0.5 rounded-full border border-emerald-500/30">
                    Selesai 🎉
                  </span>
                </div>
              )}

              {/* Syarat Rule Matrix Grid */}
              <div className="pt-1.5 border-t border-slate-800/60">
                <p className="text-[8px] font-black uppercase text-slate-500 tracking-wider mb-2">
                  Ketentuan Target Postingan Harian:
                </p>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  <div className={`p-2 rounded-xl border transition-all text-center ${
                    todayRecruits === 0
                      ? 'bg-rose-500/15 border-rose-500/50 text-white shadow-md shadow-rose-500/10'
                      : 'bg-slate-900/40 border-slate-800/60 text-slate-400'
                  }`}>
                    <p className="text-[8px] font-black uppercase text-slate-400">0 Rekrutan</p>
                    <p className="text-xs font-black text-rose-400 mt-0.5">90 Posting</p>
                    {todayRecruits === 0 && (
                      <span className="inline-block text-[7px] font-black uppercase bg-rose-500/20 text-rose-300 px-1.5 py-0.5 mt-1 rounded">Aktif Saat Ini</span>
                    )}
                  </div>

                  <div className={`p-2 rounded-xl border transition-all text-center ${
                    todayRecruits === 1
                      ? 'bg-amber-500/15 border-amber-500/50 text-white shadow-md shadow-amber-500/10'
                      : 'bg-slate-900/40 border-slate-800/60 text-slate-400'
                  }`}>
                    <p className="text-[8px] font-black uppercase text-slate-400">1 Rekrutan</p>
                    <p className="text-xs font-black text-amber-400 mt-0.5">60 Posting</p>
                    {todayRecruits === 1 && (
                      <span className="inline-block text-[7px] font-black uppercase bg-amber-500/20 text-amber-300 px-1.5 py-0.5 mt-1 rounded">Aktif Saat Ini</span>
                    )}
                  </div>

                  <div className={`p-2 rounded-xl border transition-all text-center ${
                    todayRecruits === 2
                      ? 'bg-sky-500/15 border-sky-500/50 text-white shadow-md shadow-sky-500/10'
                      : 'bg-slate-900/40 border-slate-800/60 text-slate-400'
                  }`}>
                    <p className="text-[8px] font-black uppercase text-slate-400">2 Rekrutan</p>
                    <p className="text-xs font-black text-sky-400 mt-0.5">30 Posting</p>
                    {todayRecruits === 2 && (
                      <span className="inline-block text-[7px] font-black uppercase bg-sky-500/20 text-sky-300 px-1.5 py-0.5 mt-1 rounded">Aktif Saat Ini</span>
                    )}
                  </div>

                  <div className={`p-2 rounded-xl border transition-all text-center ${
                    todayRecruits >= 3
                      ? 'bg-emerald-500/15 border-emerald-500/50 text-white shadow-md shadow-emerald-500/10'
                      : 'bg-slate-900/40 border-slate-800/60 text-slate-400'
                  }`}>
                    <p className="text-[8px] font-black uppercase text-slate-400">3+ Rekrutan</p>
                    <p className="text-xs font-black text-emerald-400 mt-0.5">Bebas 🎉</p>
                    {todayRecruits >= 3 && (
                      <span className="inline-block text-[7px] font-black uppercase bg-emerald-500/20 text-emerald-300 px-1.5 py-0.5 mt-1 rounded">Aktif Saat Ini</span>
                    )}
                  </div>
                </div>
              </div>
            </GlassCard>

            {/* Header Info Section */}
            <div className="grid grid-cols-2 gap-2 px-1">
              <div className="flex items-center gap-2.5 p-3 rounded-2xl bg-slate-900/40 border border-slate-800/50 backdrop-blur-sm">
                <div className="w-7 h-7 rounded-lg bg-sky-500/10 border border-sky-500/20 flex items-center justify-center shrink-0">
                  <Globe className="w-3.5 h-3.5 text-sky-400" />
                </div>
                <div className="min-w-0">
                  <p className="text-[9px] font-black text-slate-300 uppercase tracking-tight leading-none mb-0.5">Auto Platform</p>
                  <p className="text-[8px] text-slate-500 font-bold truncate">Deteksi otomatis link medsos</p>
                </div>
              </div>
              <div className="flex items-center gap-2.5 p-3 rounded-2xl bg-slate-900/40 border border-slate-800/50 backdrop-blur-sm">
                <div className="w-7 h-7 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center shrink-0">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                </div>
                <div className="min-w-0">
                  <p className="text-[9px] font-black text-slate-300 uppercase tracking-tight leading-none mb-0.5">Filter Duplikat</p>
                  <p className="text-[8px] text-slate-500 font-bold truncate">Cegah kirim link ganda</p>
                </div>
              </div>
            </div>

            {/* Form Section */}
            <div className="space-y-4">
              {/* Step 1: Session Info */}
              <div className="grid grid-cols-2 gap-3">
                <GlassCard className="p-3 bg-slate-950/60 border-slate-800/50 flex flex-col justify-between">
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-1.5">
                      <Hash className="w-3 h-3 text-slate-400" />
                      Nomor Awal
                    </label>
                    <span className="text-[8px] font-black uppercase text-slate-400 bg-slate-900 px-1.5 py-0.5 rounded border border-slate-800">
                      Sistem Auto
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <input
                      type="number"
                      readOnly
                      disabled
                      value={startNumber}
                      className="w-full p-2 rounded-xl bg-slate-950/80 border border-slate-900 text-slate-400 font-black text-center text-sm cursor-not-allowed outline-none select-none"
                    />
                  </div>
                </GlassCard>

                <GlassCard className="p-3 bg-slate-950/60 border-slate-800/50 flex flex-col justify-between">
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-1.5">
                      <Globe className="w-3 h-3 text-sky-500" />
                      Batch Ke
                    </label>
                    <span className="text-[8px] font-bold text-sky-400 bg-sky-500/10 px-1.5 py-0.5 rounded border border-sky-500/20">
                      Auto Range
                    </span>
                  </div>
                  <div className="w-full py-2 px-1 rounded-xl bg-sky-500/5 border border-sky-500/10 text-sky-400 font-black text-center text-sm truncate flex flex-col items-center">
                    <span>#{Math.ceil(Math.max(1, typeof startNumber === 'number' ? startNumber : 1) / 10)}</span>
                    <span className="text-[8.5px] font-bold text-sky-400/80 mt-0.5">
                      ({Math.max(1, typeof startNumber === 'number' ? startNumber : 1)} - {Math.max(1, typeof startNumber === 'number' ? startNumber : 1) + (links.length || 10) - 1})
                    </span>
                  </div>
                </GlassCard>
              </div>

              {/* Step Navigation Bar */}
              <div className="flex items-center gap-2 p-1.5 rounded-2xl bg-slate-950/80 border border-slate-800/80">
                <button
                  type="button"
                  onClick={() => {
                    setFormStep('upload');
                    triggerHaptic('selection');
                  }}
                  className={`flex-1 py-2 px-3 rounded-xl text-[10px] font-black uppercase transition-all flex items-center justify-center gap-2 border ${
                    formStep === 'upload'
                      ? 'bg-sky-500 text-slate-950 border-sky-400 shadow-md shadow-sky-500/20'
                      : 'bg-transparent text-slate-400 border-transparent hover:text-white'
                  }`}
                >
                  <Camera className="w-3.5 h-3.5" />
                  1. Upload SS ({images.length}/10)
                </button>

                <ArrowRight className="w-3.5 h-3.5 text-slate-600 shrink-0" />

                <button
                  type="button"
                  onClick={() => {
                    if (images.length === 0) {
                      showAlert(
                        'warning',
                        'Foto Belum Diunggah',
                        'Mohon unggah minimal 1 foto screenshot postingan (1–10 foto) sebelum melanjutkan ke penempelan link.'
                      );
                      return;
                    }
                    if (images.length > 10) {
                      showAlert(
                        'warning',
                        'Foto Melebihi Batas',
                        'Maksimal 10 foto screenshot postingan diperbolehkan. Mohon kurangi foto.'
                      );
                      return;
                    }
                    setFormStep('link');
                    triggerHaptic('selection');
                  }}
                  className={`flex-1 py-2 px-3 rounded-xl text-[10px] font-black uppercase transition-all flex items-center justify-center gap-2 border ${
                    formStep === 'link'
                      ? 'bg-sky-500 text-slate-950 border-sky-400 shadow-md shadow-sky-500/20'
                      : 'bg-transparent text-slate-400 border-transparent hover:text-white'
                  }`}
                >
                  <LinkIcon className="w-3.5 h-3.5" />
                  2. Tempel Link ({links.length})
                </button>
              </div>

              {/* Form Card */}
              <GlassCard className="p-4 space-y-6">
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
                      <div>
                        <label className="text-[11px] font-black text-white uppercase tracking-wider flex items-center gap-2">
                          <Camera className="w-4 h-4 text-sky-400" />
                          Upload SS Postingan
                        </label>
                        <p className="text-[9.5px] text-slate-400 font-medium mt-0.5">
                          Wajib upload minimal 1 dan maksimal 10 foto screenshot.
                        </p>
                      </div>
                      <span className={`text-[9px] font-black px-2.5 py-1 rounded-full border ${
                        images.length > 0 && images.length <= 10
                          ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20'
                          : 'text-amber-400 bg-amber-500/10 border-amber-500/20'
                      }`}>
                        {images.length}/10 Foto
                      </span>
                    </div>

                    {images.length === 0 ? (
                      <div 
                        onClick={() => fileInputRef.current?.click()}
                        className="group cursor-pointer aspect-video rounded-3xl border-2 border-dashed border-slate-800 hover:border-sky-500/40 bg-slate-950/40 flex flex-col items-center justify-center gap-3 transition-all active:scale-[0.98] p-6 text-center"
                      >
                        <div className="w-14 h-14 rounded-2xl bg-sky-500/10 border border-sky-500/20 flex items-center justify-center text-sky-400 group-hover:scale-110 transition-transform shadow-lg shadow-sky-500/5">
                          <Upload className="w-7 h-7" />
                        </div>
                        <div>
                          <p className="text-xs font-black text-white group-hover:text-sky-400 transition-colors">
                            Klik di sini untuk upload foto screenshot
                          </p>
                          <p className="text-[10px] text-slate-500 font-medium mt-1">
                            Minimal 1 foto, Maksimal 10 foto per batch postingan
                          </p>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                          <AnimatePresence mode="popLayout">
                            {images.map((img, idx) => (
                              <motion.div
                                key={`${idx}-${img.substring(0, 20)}`}
                                layout
                                initial={{ opacity: 0, scale: 0.8 }}
                                animate={{ opacity: 1, scale: 1 }}
                                exit={{ opacity: 0, scale: 0.8 }}
                                className="relative aspect-square rounded-2xl overflow-hidden border border-slate-800 bg-slate-900 group shadow-md"
                              >
                                <img src={img} alt={`SS Postingan ${idx + 1}`} className="w-full h-full object-cover" />
                                <div className="absolute top-1.5 left-1.5 px-2 py-0.5 rounded-lg bg-black/70 backdrop-blur-md text-white text-[9px] font-black border border-white/10">
                                  #{idx + 1}
                                </div>
                                <button
                                  type="button"
                                  onClick={() => removeImage(idx)}
                                  className="absolute top-1.5 right-1.5 w-6 h-6 rounded-full bg-black/70 backdrop-blur-md text-white flex items-center justify-center hover:bg-rose-500 transition-colors z-10"
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
                              className="aspect-square rounded-2xl border-2 border-dashed border-slate-800 hover:border-sky-500/40 bg-slate-950/40 flex flex-col items-center justify-center gap-1.5 transition-all text-slate-500 hover:text-sky-400 group"
                            >
                              <Plus className="w-6 h-6 group-hover:scale-110 transition-transform" />
                              <span className="text-[10px] font-black uppercase tracking-tighter">Tambah Foto</span>
                            </button>
                          )}
                        </div>

                        {images.length < 10 && (
                          <button
                            type="button"
                            onClick={() => fileInputRef.current?.click()}
                            className="w-full py-2.5 rounded-xl bg-slate-900/60 border border-slate-800 text-[10px] font-black text-sky-400 hover:bg-slate-800 transition-all flex items-center justify-center gap-2"
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
                        if (images.length === 0) {
                          showAlert(
                            'warning',
                            'Foto Belum Diunggah',
                            'Mohon unggah minimal 1 foto screenshot postingan (1–10 foto) sebelum melanjutkan.'
                          );
                          return;
                        }
                        if (images.length > 10) {
                          showAlert(
                            'warning',
                            'Foto Melebihi Batas',
                            'Maksimal 10 foto screenshot postingan diperbolehkan. Mohon kurangi foto.'
                          );
                          return;
                        }
                        setFormStep('link');
                        triggerHaptic('selection');
                      }}
                      icon={<ArrowRight className="w-4 h-4" />}
                    >
                      Lanjut Tempel Link ({images.length} Foto Siap)
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
                    <div className="flex items-center justify-between pb-2 border-b border-slate-800/60">
                      <button
                        type="button"
                        onClick={() => {
                          setFormStep('upload');
                          triggerHaptic('selection');
                        }}
                        className="text-[10px] font-black text-sky-400 hover:text-sky-300 flex items-center gap-1.5 transition-all bg-sky-500/10 px-3 py-1.5 rounded-xl border border-sky-500/20 active:scale-95"
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
                        <label className="text-[11px] font-black text-slate-300 uppercase tracking-wider flex items-center gap-2">
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
                              className="w-full h-32 p-4 rounded-2xl bg-slate-950/40 border border-slate-800 text-[11px] text-white placeholder:text-slate-700 outline-none focus:border-sky-500/30 transition-all resize-none font-medium leading-relaxed"
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

                              if (detected.length > 10) {
                                showAlert('warning', 'Link Melebihi Batas', 'Maksimal 10 link diperbolehkan per batch. Mohon kurangi jumlah link.');
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
                          <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1 custom-scrollbar">
                            {links.map((link, idx) => {
                              const isDuplicate = links.filter(l => l.url === link.url).length > 1;
                              return (
                                <div 
                                  key={idx} 
                                  className={`flex flex-col gap-2 p-3 rounded-2xl border transition-all ${
                                    isDuplicate 
                                      ? 'bg-rose-500/10 border-rose-500/40' 
                                      : 'bg-slate-900/40 border-slate-700/50'
                                  }`}
                                >
                                  <div className="flex items-center justify-between gap-3">
                                    <div className="flex items-center gap-2 flex-1 min-w-0">
                                      <span className={`text-[10px] font-black w-6 h-6 flex items-center justify-center rounded-lg border shrink-0 ${
                                        isDuplicate 
                                          ? 'text-rose-400 border-rose-500/30 bg-rose-500/10'
                                          : 'text-sky-400 border-sky-500/30 bg-sky-500/5'
                                      }`}>
                                        {Math.max(1, typeof startNumber === 'number' ? startNumber : 1) + idx}
                                      </span>
                                      <span className={`text-xs truncate font-medium ${isDuplicate ? 'text-rose-200' : 'text-white'}`}>
                                        {link.url}
                                      </span>
                                    </div>
                                    <div className={`shrink-0 px-2 py-1 rounded-lg text-[8px] font-black uppercase flex items-center gap-1 border ${
                                      CHANNELS.find(c => c.id === link.platform)?.color || 'text-slate-400 border-slate-800'
                                    }`}>
                                      <ChannelPlatformIcon id={link.platform} className="w-2.5 h-2.5" />
                                      {link.platform === 'X (Twitter)' ? 'X' : link.platform}
                                    </div>
                                  </div>
                                  {isDuplicate && (
                                    <div className="text-[8px] text-rose-400 font-bold flex items-center gap-1 pl-8">
                                      ⚠️ Link Terdeteksi Duplikat
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                          
                          <div className="flex gap-2 animate-in fade-in zoom-in duration-300">
                            <Button 
                              variant="secondary" 
                              fullWidth 
                              className="py-2.5 h-auto text-[10px] font-black uppercase"
                              onClick={() => {
                                setIsReviewingLinks(false);
                                setLinks([]);
                                setIsConfirmed(false);
                                triggerHaptic('impact', 'light');
                              }}
                            >
                              Ubah Link
                            </Button>
                          </div>
                        </div>
                      )}
                    </div>

                    <Button
                      fullWidth
                      onClick={handleSubmit}
                      disabled={isUploading || links.filter(l => l.url.trim() !== '').length === 0 || images.length === 0}
                      isLoading={isUploading}
                      icon={<Send className="w-4 h-4" />}
                    >
                      Kirim Batch Postingan ({links.length} Link & {images.length} Foto)
                    </Button>
                  </motion.div>
                )}
              </GlassCard>
            </div>
          </>
        )}
      </motion.div>
    )}

        {/* History Views (Minggu Ini & Arsip) */}
        {(activeView === 'minggu_ini' || activeView === 'arsip') && (
          <motion.div
            initial={{ opacity: 0, x: 10 }}
            animate={{ opacity: 1, x: 0 }}
            className="space-y-3"
          >
            {activeView === 'minggu_ini' && (
              <>
                <div className="space-y-3 p-3.5 rounded-2xl bg-slate-950/90 border border-slate-800/90 shadow-sm">
                  <div className="flex items-center justify-between px-0.5">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-xl bg-sky-500/10 border border-sky-500/20 flex items-center justify-center shrink-0">
                        <Calendar className="w-3.5 h-3.5 text-sky-400" />
                      </div>
                      <div className="flex flex-col gap-1">
                        <h3 className="text-xs font-black text-white tracking-tight">Filter Hari Minggu Ini</h3>
                        <span className="text-[9px] font-black text-sky-400 bg-sky-500/10 px-2 py-0.5 rounded-full border border-sky-500/20 flex items-center gap-1 w-fit">
                          <Timer className="w-2.5 h-2.5 text-sky-400 animate-pulse" />
                          {weekDays[0]?.displayDate} - {weekDays[6]?.displayDate}
                        </span>
                      </div>
                    </div>
                    <div className="text-right">
                      <span className="text-[9px] font-black text-sky-300 bg-sky-500/15 px-2.5 py-1 rounded-full border border-sky-500/30">
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
                              ? 'bg-gradient-to-b from-sky-500/30 to-blue-600/20 text-white border-sky-400 shadow-lg shadow-sky-500/15 ring-1 ring-sky-400/50'
                              : wDay.isToday
                              ? 'bg-amber-500/10 text-amber-200 border-amber-500/40 shadow-sm'
                              : 'bg-slate-900/90 text-slate-400 border-slate-800 hover:text-white hover:bg-slate-800/80'
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
                              ? 'text-sky-300 bg-sky-500/20 border-sky-400/30' 
                              : linkCount > 0
                              ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20'
                              : 'text-slate-500 bg-slate-950/40 border-slate-800'
                          }`}>
                            {linkCount} Link
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {posts.length === 0 && !isLoadingHistory ? (
                  <div className="py-20 text-center bg-slate-900/40 rounded-3xl border border-slate-800/50">
                    <Clock className="w-8 h-8 text-slate-700 mx-auto mb-2" />
                    <p className="text-xs font-bold text-slate-500">
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

                    return (
                      <GlassCard key={post.id} className={`p-4 space-y-3 ${post.archived ? 'opacity-70 grayscale-[0.3]' : ''}`}>
                        <div className="flex items-start justify-between">
                          <div className="space-y-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-xs font-black text-white">#{cardStartNum} - #{cardEndNum}</span>
                              <span className="px-2.5 py-0.5 rounded-full text-[8.5px] font-black uppercase bg-sky-500/15 text-sky-300 border border-sky-500/30 flex items-center gap-1 shadow-sm">
                                <Calendar className="w-2.5 h-2.5 text-sky-400" />
                                {formatDateWithDay(post.date || '') || post.date}
                              </span>
                            </div>
                            <div className="flex items-center gap-3">
                              <div className="flex items-center gap-1.5 text-[10px] text-slate-300 font-bold">
                                <LinkIcon className="w-3 h-3 text-sky-400" />
                                {post.links.length} Item
                              </div>
                            </div>
                          </div>
                          <div className="flex -space-x-1.5">
                            {Array.from(new Set(post.platforms)).map((p, i) => (
                              <div key={i} className="w-7 h-7 rounded-full bg-slate-900 border border-slate-800 flex items-center justify-center shadow-lg">
                                <ChannelPlatformIcon id={p} className={`w-3.5 h-3.5 ${CHANNELS.find(c => c.id === p)?.color?.split(' ')[0] || 'text-white'}`} />
                              </div>
                            ))}
                          </div>
                        </div>
                        
                        <div className="space-y-1.5 pt-2 border-t border-slate-800/50">
                          {visibleLinks.map((link, i) => (
                            <a 
                              key={i} 
                              href={link} 
                              target="_blank" 
                              rel="noopener noreferrer"
                              className="flex items-center justify-between p-2 rounded-xl bg-slate-950/50 hover:bg-slate-900 border border-slate-800/50 transition-colors group"
                            >
                              <div className="flex items-center gap-2 truncate">
                                <span className="text-[10px] font-bold text-sky-400 shrink-0">
                                  {cardStartNum + i}.
                                </span>
                                <ChannelPlatformIcon id={post.platforms[i]} className={`w-3 h-3 shrink-0 ${CHANNELS.find(c => c.id === post.platforms[i])?.color?.split(' ')[0] || 'text-slate-500'}`} />
                                <span className="text-[10px] text-slate-400 font-medium truncate max-w-[200px]">
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
                              className="w-full text-[10px] font-black text-sky-400 hover:text-sky-300 bg-sky-500/10 hover:bg-sky-500/20 border border-sky-500/20 py-2 px-3 rounded-xl transition-all flex items-center justify-center gap-1.5 mt-1.5 active:scale-[0.99] shadow-sm cursor-pointer"
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
                  <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-3.5 rounded-2xl bg-slate-950/90 border border-slate-800/90 shadow-sm mt-4">
                    <div className="text-[10px] font-bold text-slate-400 text-center sm:text-left">
                      Menampilkan <span className="text-white font-black">{Math.min((currentPage - 1) * ITEMS_PER_PAGE + 1, posts.length)} - {Math.min(currentPage * ITEMS_PER_PAGE, posts.length)}</span> dari <span className="text-white font-black">{posts.length}</span> postingan
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
                            ? 'bg-slate-900/40 text-slate-600 border-slate-800/40 cursor-not-allowed'
                            : 'bg-slate-900 text-sky-400 border-slate-700 hover:bg-slate-800 hover:text-white shadow-sm'
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
                                      : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-white'
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
                            ? 'bg-slate-900/40 text-slate-600 border-slate-800/40 cursor-not-allowed'
                            : 'bg-slate-900 text-sky-400 border-slate-700 hover:bg-slate-800 hover:text-white shadow-sm'
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

            {activeView === 'arsip' && (
              <div className="space-y-3">
                {archivedWeeks.length === 0 && !isLoadingHistory ? (
                  <div className="py-20 text-center bg-slate-900/40 rounded-3xl border border-slate-800/50">
                    <Archive className="w-8 h-8 text-slate-700 mx-auto mb-2" />
                    <p className="text-xs font-bold text-slate-500">Folder arsip kosong</p>
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
                      <div key={week.weekKey} className="border border-slate-800/60 bg-slate-950/40 rounded-3xl overflow-hidden transition-all duration-200">
                        {/* Collapse Header */}
                        <button
                          type="button"
                          onClick={() => {
                            setExpandedWeekKey(isWeekExpanded ? null : week.weekKey);
                            setArchivePage(1);
                            triggerHaptic('selection');
                          }}
                          className={`w-full p-4 flex items-center justify-between text-left transition-colors duration-200 ${
                            isWeekExpanded ? 'bg-slate-900/60' : 'bg-slate-950/20 hover:bg-slate-900/30'
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 border transition-all ${
                              isWeekExpanded ? 'bg-amber-500/10 border-amber-500/30 text-amber-400' : 'bg-slate-900 border-slate-800 text-slate-400'
                            }`}>
                              <Archive className="w-4 h-4" />
                            </div>
                            <div className="flex flex-col gap-1">
                              <div className="flex items-center gap-2 flex-wrap">
                                <h4 className="text-xs font-black text-white tracking-tight">
                                  Arsip Mingguan
                                </h4>
                                <span className="text-[9px] font-black text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-full border border-amber-500/20 flex items-center gap-1 w-fit">
                                  <Timer className="w-2.5 h-2.5 text-amber-400 animate-pulse" />
                                  {weekDaysList[0]?.displayDate} - {weekDaysList[6]?.displayDate}
                                </span>
                              </div>
                              <p className="text-[10px] text-slate-400 font-bold mt-0.5 flex items-center gap-3">
                                <span>{week.posts.length} Batch</span>
                                <span className="w-1 h-1 rounded-full bg-slate-700"></span>
                                <span>{week.totalLinks} Link Total</span>
                              </p>
                            </div>
                          </div>
                          
                          <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform duration-200 ${
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
                              className="border-t border-slate-900 bg-slate-950/60 p-4 space-y-4"
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
                                          ? 'bg-gradient-to-b from-amber-500/30 to-orange-600/20 text-white border-amber-400 shadow-lg shadow-amber-500/15 ring-1 ring-amber-400/50'
                                          : 'bg-slate-900/90 text-slate-400 border-slate-800 hover:text-white hover:bg-slate-800/80'
                                      }`}
                                    >
                                      <span className="text-[9px] font-black uppercase tracking-wider">{wDay.dayName}</span>
                                      <span className="text-[7.5px] font-medium opacity-70">{wDay.displayDate}</span>
                                      <span className={`text-[8px] font-bold px-1.5 py-0.2 rounded-full border ${
                                        isSelected
                                          ? 'text-amber-300 bg-amber-500/20 border-amber-400/30'
                                          : linkCount > 0
                                          ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20'
                                          : 'text-slate-500 bg-slate-950/40 border-slate-800'
                                      }`}>
                                        {linkCount} Link
                                      </span>
                                    </button>
                                  );
                                })}
                              </div>

                              {filteredWeekPosts.length === 0 ? (
                                <div className="py-12 text-center bg-slate-900/40 rounded-2xl border border-slate-900">
                                  <Clock className="w-6 h-6 text-slate-700 mx-auto mb-2" />
                                  <p className="text-xs font-bold text-slate-500">
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

                                  return (
                                    <GlassCard key={post.id} className="p-4 space-y-3 border-slate-800/40">
                                      <div className="flex items-start justify-between">
                                        <div className="space-y-1">
                                          <div className="flex items-center gap-2 flex-wrap">
                                            <span className="text-xs font-black text-white">#{cardStartNum} - #{cardEndNum}</span>
                                            <span className="px-2.5 py-0.5 rounded-full text-[8.5px] font-black uppercase bg-amber-500/10 text-amber-300 border border-amber-500/20 flex items-center gap-1 shadow-sm">
                                              <Calendar className="w-2.5 h-2.5 text-amber-400" />
                                              {formatDateWithDay(post.date || '') || post.date}
                                            </span>
                                          </div>
                                          <div className="flex items-center gap-3">
                                            <div className="flex items-center gap-1.5 text-[10px] text-slate-400 font-bold">
                                              <LinkIcon className="w-3 h-3 text-slate-500" />
                                              {post.links.length} Item
                                            </div>
                                          </div>
                                        </div>
                                        <div className="flex -space-x-1.5">
                                          {Array.from(new Set(post.platforms)).map((p, i) => (
                                            <div key={i} className="w-7 h-7 rounded-full bg-slate-900 border border-slate-800 flex items-center justify-center shadow-lg">
                                              <ChannelPlatformIcon id={p} className={`w-3.5 h-3.5 ${CHANNELS.find(c => c.id === p)?.color?.split(' ')[0] || 'text-white'}`} />
                                            </div>
                                          ))}
                                        </div>
                                      </div>
                                      
                                      <div className="space-y-1.5 pt-2 border-t border-slate-800/30">
                                        {visibleLinks.map((link, i) => (
                                          <a 
                                            key={i} 
                                            href={link} 
                                            target="_blank" 
                                            rel="noopener noreferrer"
                                            className="flex items-center justify-between p-2 rounded-xl bg-slate-950/80 hover:bg-slate-900/60 border border-slate-900 transition-colors group"
                                          >
                                            <div className="flex items-center gap-2 truncate">
                                              <span className="text-[10px] font-bold text-sky-400 shrink-0">
                                                {cardStartNum + i}.
                                              </span>
                                              <ChannelPlatformIcon id={post.platforms[i]} className={`w-3 h-3 shrink-0 ${CHANNELS.find(c => c.id === post.platforms[i])?.color?.split(' ')[0] || 'text-slate-500'}`} />
                                              <span className="text-[10px] text-slate-400 font-medium truncate max-w-[200px]">
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
                                            className="w-full text-[10px] font-black text-sky-400 hover:text-sky-300 bg-sky-500/10 hover:bg-sky-500/20 border border-sky-500/20 py-2 px-3 rounded-xl transition-all flex items-center justify-center gap-1.5 mt-1.5 active:scale-[0.99] shadow-sm cursor-pointer"
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
                                <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-3 rounded-2xl bg-slate-950/80 border border-slate-900 shadow-inner mt-2">
                                  <div className="text-[10px] font-bold text-slate-400 text-center sm:text-left">
                                    Menampilkan <span className="text-white font-black">{Math.min((archivePage - 1) * ITEMS_PER_PAGE + 1, filteredWeekPosts.length)} - {Math.min(archivePage * ITEMS_PER_PAGE, filteredWeekPosts.length)}</span> dari <span className="text-white font-black">{filteredWeekPosts.length}</span> postingan
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
                                          ? 'bg-slate-900/40 text-slate-600 border-slate-950/40 cursor-not-allowed'
                                          : 'bg-slate-900 text-amber-400 border-slate-800 hover:bg-slate-800 hover:text-white shadow-sm'
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
                                                    : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-white'
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
                                          ? 'bg-slate-900/40 text-slate-600 border-slate-950/40 cursor-not-allowed'
                                          : 'bg-slate-900 text-amber-400 border-slate-800 hover:bg-slate-800 hover:text-white shadow-sm'
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
              <div className="py-20 text-center bg-slate-900/40 rounded-3xl border border-slate-800/50">
                <Users className="w-8 h-8 text-slate-700 mx-auto mb-2" />
                <p className="text-xs font-bold text-slate-500">Belum ada recruiter.</p>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="flex items-center justify-between px-1 mb-1">
                  <h3 className="text-[11px] font-black text-slate-300 uppercase tracking-widest">
                    Status Posting Hari Ini
                  </h3>
                  <span className="text-[9px] font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                    {formatDateWithDay(getWIBDate())}
                  </span>
                </div>

                {/* Secondary Sub-Tabs Filter for Recruiter Status */}
                <div className="flex p-1 bg-slate-950/80 rounded-xl border border-slate-900/60 shadow-inner gap-1 my-2">
                  <button
                    type="button"
                    onClick={() => { setStatusFilter('semua'); triggerHaptic('selection'); }}
                    className={`flex-1 py-2 text-center rounded-lg text-[10px] font-black uppercase transition-all ${
                      statusFilter === 'semua'
                        ? 'bg-slate-900 text-slate-200 border border-slate-800 shadow-md'
                        : 'text-slate-500 hover:text-slate-400 border border-transparent'
                    }`}
                  >
                    Semua ({statusCounts.semua})
                  </button>
                  <button
                    type="button"
                    onClick={() => { setStatusFilter('aktif'); triggerHaptic('selection'); }}
                    className={`flex-1 py-2 text-center rounded-lg text-[10px] font-black uppercase transition-all ${
                      statusFilter === 'aktif'
                        ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 shadow-md'
                        : 'text-slate-500 hover:text-slate-400 border border-transparent'
                    }`}
                  >
                    Aktif ({statusCounts.aktif})
                  </button>
                  <button
                    type="button"
                    onClick={() => { setStatusFilter('belum'); triggerHaptic('selection'); }}
                    className={`flex-1 py-2 text-center rounded-lg text-[10px] font-black uppercase transition-all ${
                      statusFilter === 'belum'
                        ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20 shadow-md'
                        : 'text-slate-500 hover:text-slate-400 border border-transparent'
                    }`}
                  >
                    Belum ({statusCounts.belum})
                  </button>
                </div>
                
                {filteredRecruiters.length === 0 ? (
                  <div className="py-12 text-center bg-slate-900/20 rounded-2xl border border-slate-900/50">
                    <Users className="w-6 h-6 text-slate-700 mx-auto mb-1.5" />
                    <p className="text-[10px] font-bold text-slate-500">Tidak ada recruiter untuk status ini.</p>
                  </div>
                ) : (
                  filteredRecruiters.slice((statusPage - 1) * ITEMS_PER_PAGE, statusPage * ITEMS_PER_PAGE).map((rec) => {
                    const recPosts = allTodayPosts.filter(p => p.telegramId === String(rec.telegramId));
                    const totalLinksCount = recPosts.reduce((sum, p) => sum + (Array.isArray(p.links) ? p.links.length : 0), 0);
                    const hasPosted = totalLinksCount > 0;
                    return (
                      <GlassCard key={rec.telegramId} className={`p-3 border-l-4 ${hasPosted ? 'border-l-emerald-500 bg-slate-950/80' : 'border-l-rose-500 bg-slate-950/60'}`}>
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full overflow-hidden bg-slate-900 border border-slate-700 shrink-0">
                            {rec.photoUrl ? (
                              <img src={rec.photoUrl} alt={rec.firstName} className="w-full h-full object-cover" />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center text-xs font-black text-slate-400">
                                {rec.firstName?.charAt(0) || '?'}
                              </div>
                            )}
                          </div>
                          
                          {/* Post count badge next to photo */}
                          <div className={`flex flex-col items-center justify-center px-2 py-1 rounded-xl shrink-0 min-w-[42px] border ${
                            totalLinksCount > 0 
                              ? 'bg-emerald-500/5 border-emerald-500/20 text-emerald-400' 
                              : 'bg-slate-900/30 border-slate-800/50 text-slate-500'
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
                            <h4 className="text-sm font-bold text-white truncate">
                              {rec.firstName} {rec.lastName || ''}
                            </h4>
                            <p className="text-[10px] text-slate-400 font-medium truncate">
                              {rec.username ? `@${rec.username}` : String(rec.telegramId)}
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
                  <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-3 rounded-2xl bg-slate-950/80 border border-slate-900 shadow-inner mt-4">
                    <div className="text-[10px] font-bold text-slate-400 text-center sm:text-left">
                      Menampilkan <span className="text-white font-black">{Math.min((statusPage - 1) * ITEMS_PER_PAGE + 1, filteredRecruiters.length)} - {Math.min(statusPage * ITEMS_PER_PAGE, filteredRecruiters.length)}</span> dari <span className="text-white font-black">{filteredRecruiters.length}</span> recruiter
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
                            ? 'bg-slate-900/40 text-slate-600 border-slate-950/40 cursor-not-allowed'
                            : 'bg-slate-900 text-emerald-400 border-slate-800 hover:bg-slate-800 hover:text-white shadow-sm'
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
                                      : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-white'
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
                            ? 'bg-slate-900/40 text-slate-600 border-slate-950/40 cursor-not-allowed'
                            : 'bg-slate-900 text-emerald-400 border-slate-800 hover:bg-slate-800 hover:text-white shadow-sm'
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
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="w-full max-w-sm rounded-3xl bg-slate-900/95 border border-slate-800 p-6 shadow-2xl space-y-5 text-center relative overflow-hidden"
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
                <h3 className="text-base font-black text-white tracking-tight">
                  {alertState.title}
                </h3>
                <p className="text-xs font-medium text-slate-300 leading-relaxed">
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
