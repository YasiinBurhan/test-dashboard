import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import Tesseract from 'tesseract.js';
import { GlassCard } from '../components/common/GlassCard';
import { Input } from '../components/common/Input';
import { Button } from '../components/common/Button';
import { useReports } from '../hooks/useReports';
import { useAuth } from '../hooks/useAuth';
import { DailyReportFormData, DailyReport, SystemSettings, UserProfile } from '../types';
import { formatUsername, formatWIBDate, getWIBDate, getWIBMonday, getWIBMondayOfDate, formatDateWithDay, getWIBCurrentWeekDays, WIBWeekDayInfo, getWIBWeekRange } from '../utils/format';
import { subscribeToSystemSettings, getSystemSettings } from '../firebase/services/settingService';
import { sendReportToTelegramApi } from '../services/api';
import { checkReportDuplicate } from '../firebase/services/reportService';
import { subscribeToAllUsers } from '../firebase/services/userService';
import { 
  CalendarClock, 
  CheckCircle2, 
  Clock, 
  Timer,
  Sparkles, 
  FileText, 
  UserCheck, 
  Phone, 
  Hash, 
  Send, 
  MessageSquare, 
  Users, 
  Globe, 
  Share2, 
  AtSign, 
  FileSpreadsheet,
  Zap,
  Check,
  XCircle,
  HelpCircle,
  ExternalLink,
  User,
  Lock,
  Loader2,
  AlertTriangle,
  AlertCircle,
  UserX,
  Archive,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  ArrowRight,
  Video,
  Upload,
  X,
  Plus,
  Edit2,
  RotateCcw
} from 'lucide-react';
import { triggerHaptic } from '../telegram/webapp';

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

// Channel Platform Real SVG Icons
const compressMediaFile = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith('image/')) {
      if (file.size > 20 * 1024 * 1024) {
        reject(new Error('Ukuran file video terlalu besar (Maksimal 20MB).'));
        return;
      }
      const reader = new FileReader();
      reader.onload = (e) => resolve(e.target?.result as string);
      reader.onerror = (err) => reject(err);
      reader.readAsDataURL(file);
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const MAX_WIDTH = 1200;
        const MAX_HEIGHT = 1200;
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > MAX_WIDTH) {
            height = Math.round((height * MAX_WIDTH) / width);
            width = MAX_WIDTH;
          }
        } else {
          if (height > MAX_HEIGHT) {
            width = Math.round((width * MAX_HEIGHT) / height);
            height = MAX_HEIGHT;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(event.target?.result as string);
          return;
        }

        ctx.drawImage(img, 0, 0, width, height);
        const compressedDataUrl = canvas.toDataURL('image/jpeg', 0.75);
        resolve(compressedDataUrl);
      };
      img.onerror = () => resolve(event.target?.result as string);
      img.src = event.target?.result as string;
    };
    reader.onerror = (err) => reject(err);
    reader.readAsDataURL(file);
  });
};

const ChannelPlatformIcon: React.FC<{ id: string; className?: string }> = ({ id, className = "w-4 h-4 shrink-0" }) => {
  switch (id) {
    case 'Facebook':
      return (
        <svg className={`${className} text-blue-500 fill-current`} viewBox="0 0 24 24">
          <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
        </svg>
      );
    case 'X (Twitter)':
      return (
        <svg className={`${className} text-slate-200 fill-current`} viewBox="0 0 24 24">
          <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
        </svg>
      );
    case 'Threads':
      return (
        <svg className={`${className} text-white fill-current`} viewBox="0 0 24 24">
          <path d="M12.186 24c-3.142 0-5.782-1.002-7.587-2.87-1.848-1.91-2.599-4.57-2.599-7.728 0-3.322.95-6.07 2.825-8.17C6.632 3.123 9.29 2 12.723 2c3.488 0 6.208 1.14 8.084 3.388 1.583 1.897 2.392 4.417 2.392 7.488 0 .61-.03 1.256-.09 1.933h-3.411c.045-.487.068-.962.068-1.428 0-2.22-.57-3.992-1.693-5.27-1.196-1.36-2.937-2.05-5.183-2.05-2.298 0-4.093.758-5.337 2.252-1.22 1.466-1.838 3.513-1.838 6.084 0 2.327.534 4.254 1.587 5.727 1.055 1.475 2.585 2.223 4.548 2.223 1.623 0 2.946-.43 3.931-1.28.932-.803 1.488-1.922 1.654-3.328h-5.26v-3.072h8.777c.074.526.111 1.077.111 1.652 0 2.457-.833 4.475-2.477 6.002C18.667 23.23 15.808 24 12.186 24z" />
        </svg>
      );
    case 'Instagram':
      return (
        <svg className={`${className} text-pink-500 fill-current`} viewBox="0 0 24 24">
          <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z" />
        </svg>
      );
    case 'TikTok':
      return (
        <svg className={`${className} text-cyan-400 fill-current`} viewBox="0 0 24 24">
          <path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.82.57-1.31 1.54-1.33 2.54-.02 1.08.46 2.15 1.28 2.84 1.01.83 2.47.98 3.63.4 1.03-.51 1.69-1.57 1.78-2.72.08-2.71.04-5.43.05-8.15-.01-2.9-.01-5.8 0-8.7z" />
        </svg>
      );
    case 'LinkedIn':
      return (
        <svg className={`${className} text-sky-500 fill-current`} viewBox="0 0 24 24">
          <path d="M19 3a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h14m-.5 15.5v-5.3a3.26 3.26 0 0 0-3.26-3.26c-.85 0-1.84.52-2.28 1.3v-1.11h-2.79v8.37h2.79v-4.93c0-.77.62-1.4 1.39-1.4a1.4 1.4 0 0 1 1.4 1.4v4.93h2.75M6.46 10.9v8.37H9.25V10.9H6.46M7.86 6.7a1.62 1.62 0 1 0 0 3.24 1.62 1.62 0 0 0 0-3.24z" />
        </svg>
      );
    case 'Telegram':
      return (
        <svg className={`${className} text-sky-400 fill-current`} viewBox="0 0 24 24">
          <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm4.64 6.8c-.15 1.58-.8 5.42-1.13 7.19-.14.75-.42 1-.68 1.03-.58.05-1.02-.38-1.58-.75-.88-.58-1.38-.94-2.23-1.5-.99-.65-.35-1.01.22-1.59.15-.15 2.71-2.48 2.76-2.69.01-.03.01-.14-.07-.2-.08-.06-.19-.04-.27-.02-.12.02-1.96 1.25-5.54 3.69-.52.36-1 .53-1.42.52-.47-.01-1.37-.26-2.03-.48-.82-.27-1.47-.42-1.42-.88.03-.25.38-.51 1.07-.78 4.18-1.82 6.97-3.02 8.37-3.61 3.99-1.66 4.82-1.95 5.36-1.96.12 0 .38.03.55.17.14.12.18.28.2.45-.01.07.01.23 0 .39z" />
        </svg>
      );
    case 'WhatsApp':
      return (
        <svg className={`${className} text-emerald-400 fill-current`} viewBox="0 0 24 24">
          <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946.003-6.556 5.338-11.891 11.893-11.891 3.181.001 6.167 1.24 8.413 3.488 2.245 2.248 3.481 5.236 3.48 8.414-.003 6.557-5.338 11.892-11.893 11.892-1.99-.001-3.951-.5-5.688-1.448l-6.305 1.654zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884-.001 2.225.651 3.891 1.746 5.634l-.999 3.648 3.742-.981zm11.387-5.464c-.074-.124-.272-.198-.57-.347-.297-.149-1.758-.868-2.031-.967-.272-.099-.47-.149-.669.149-.198.297-.768.967-.941 1.165-.173.198-.347.223-.644.074-.297-.149-1.255-.462-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.297-.347.446-.521.151-.172.2-.296.3-.495.099-.198.05-.372-.025-.521-.075-.148-.669-1.611-.916-2.206-.242-.579-.487-.501-.669-.51l-.57-.01c-.198 0-.52.074-.792.372s-1.04 1.016-1.04 2.479 1.065 2.876 1.213 3.074c.149.198 2.095 3.2 5.076 4.487.709.306 1.263.489 1.694.626.712.226 1.36.194 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.695.248-1.29.173-1.414z" />
        </svg>
      );
    default:
      return <Globe className={`${className} text-emerald-400`} />;
  }
};

// Telegram Username Parser Helper
const parseTelegramUsername = (raw?: string) => {
  if (!raw) return { clean: '', formatted: '', url: '' };
  let clean = raw.trim();

  // Handle special case where user doesn't have a telegram username or it was not found
  if (
    clean.toLowerCase().includes('tidak ditemukan') || 
    clean.toLowerCase().includes('tidak ada') || 
    clean === '-' ||
    clean.toLowerCase().includes('no username')
  ) {
    return {
      clean: 'tidak_ada',
      formatted: 'Username Tidak Ditemukan',
      url: ''
    };
  }

  // Extract from full URLs or links like https://t.me/username, t.me/username, telegram.me/username, tg://resolve?domain=username
  if (clean.includes('t.me/') || clean.includes('telegram.me/')) {
    const match = clean.match(/(?:t\.me|telegram\.me)\/([a-zA-Z0-9_]+)/i);
    if (match && match[1]) {
      clean = match[1];
    }
  } else if (clean.includes('tg://')) {
    const match = clean.match(/domain=([a-zA-Z0-9_]+)/i);
    if (match && match[1]) {
      clean = match[1];
    }
  }

  // Remove query params, hash or trailing slash
  clean = clean.split('?')[0].split('#')[0].replace(/\/$/, '');
  // Strip leading @ or slashes or plus
  clean = clean.replace(/^[@/+]+/, '');

  if (!clean) return { clean: '', formatted: '', url: '' };

  return {
    clean,
    formatted: `@${clean}`,
    url: `https://t.me/${clean}`
  };
};

// In-memory cache for ultra-fast Telegram availability checks
const tgCheckCache = new Map<string, { exists: boolean | null; title?: string; photoUrl?: string; isSyntaxValid: boolean; message?: string }>();

// Real-time Telegram Username Availability Checker (Ultra-fast parallel check with cache)
const checkTelegramAvailability = async (cleanUsername: string): Promise<{
  exists: boolean | null;
  title?: string;
  photoUrl?: string;
  isSyntaxValid: boolean;
  message?: string;
}> => {
  if (!cleanUsername) {
    return { exists: false, isSyntaxValid: false, message: 'Username belum diisi' };
  }

  // Telegram username rules: 5-32 chars, a-z, A-Z, 0-9, _
  const syntaxRegex = /^[a-zA-Z0-9_]{5,32}$/;
  if (!syntaxRegex.test(cleanUsername)) {
    return {
      exists: false,
      isSyntaxValid: false,
      message: 'Username Telegram minimal 5-32 karakter (hanya huruf, angka, & underscore)'
    };
  }

  const lowerKey = cleanUsername.toLowerCase();
  if (tgCheckCache.has(lowerKey)) {
    return tgCheckCache.get(lowerKey)!;
  }

  const unavatarUrl = `https://unavatar.io/telegram/${cleanUsername}?fallback=false`;

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);

    const response = await fetch(`${API_BASE_URL}/api/check-telegram/${cleanUsername}`, { signal: controller.signal });
    clearTimeout(timeoutId);

    if (!response.ok) {
      const res = {
        exists: null,
        title: `@${cleanUsername}`,
        isSyntaxValid: true,
        message: `Format username @${cleanUsername} valid.`
      };
      tgCheckCache.set(lowerKey, res);
      return res;
    }

    const data = await response.json();

    if (data.exists === false) {
      const res = {
        exists: false,
        isSyntaxValid: true,
        message: `Username @${cleanUsername} TIDAK TERDAFTAR di Telegram.`
      };
      tgCheckCache.set(lowerKey, res);
      return res;
    }

    if (data.exists === true) {
      const res = {
        exists: true,
        title: data.title || `@${cleanUsername}`,
        photoUrl: data.photoUrl || unavatarUrl,
        isSyntaxValid: true,
        message: `Username @${cleanUsername} terdaftar aktif.`
      };
      tgCheckCache.set(lowerKey, res);
      return res;
    }

    // exists === null
    const res = {
      exists: null,
      title: `@${cleanUsername}`,
      isSyntaxValid: true,
      message: `Format username @${cleanUsername} valid.`
    };
    tgCheckCache.set(lowerKey, res);
    return res;
  } catch {
    const res = {
      exists: null,
      title: `@${cleanUsername}`,
      isSyntaxValid: true,
      message: `Format username @${cleanUsername} valid.`
    };
    tgCheckCache.set(lowerKey, res);
    return res;
  }
};

// Channel Platforms with Colors & Active Styles
const CHANNELS = [
  { id: 'Facebook', label: 'FB (Facebook)', color: 'bg-blue-600/20 border-blue-500/40 text-blue-400', activeBg: 'bg-blue-600 text-white' },
  { id: 'X (Twitter)', label: 'X (Twitter)', color: 'bg-slate-700/30 border-slate-600/40 text-slate-300', activeBg: 'bg-slate-200 text-slate-900' },
  { id: 'Threads', label: 'Threads', color: 'bg-zinc-800/40 border-zinc-700/50 text-zinc-300', activeBg: 'bg-zinc-100 text-zinc-950' },
  { id: 'Instagram', label: 'Instagram', color: 'bg-pink-600/20 border-pink-500/40 text-pink-400', activeBg: 'bg-gradient-to-r from-purple-500 to-pink-500 text-white' },
  { id: 'TikTok', label: 'TikTok', color: 'bg-cyan-500/20 border-cyan-400/40 text-cyan-300', activeBg: 'bg-cyan-500 text-slate-950' },
  { id: 'LinkedIn', label: 'LinkedIn', color: 'bg-sky-700/20 border-sky-600/40 text-sky-400', activeBg: 'bg-sky-600 text-white' },
  { id: 'Telegram', label: 'Telegram', color: 'bg-sky-500/20 border-sky-400/40 text-sky-300', activeBg: 'bg-sky-500 text-white' },
  { id: 'WhatsApp', label: 'WhatsApp', color: 'bg-emerald-600/20 border-emerald-500/40 text-emerald-400', activeBg: 'bg-emerald-600 text-white' },
  { id: 'Lainnya', label: 'Lainnya', color: 'bg-emerald-500/20 border-emerald-500/40 text-emerald-400', activeBg: 'bg-emerald-600 text-white' },
];

const ReportListCard: React.FC<{
  rep: DailyReport,
  isAdminOrOwner: boolean,
  onUpdateStatus: (id: string, status: 'Pending' | 'ACC' | 'REJECT') => void,
  onUpdatePermission?: (id: string, permission: number) => void,
  onUpdateDetails?: (id: string, data: any) => Promise<void>,
  userPhotoMap?: Map<string, { photoUrl?: string; firstName?: string; name?: string }>,
  isPemeriksaan?: boolean,
  isArsip?: boolean
}> = ({ rep, isAdminOrOwner, onUpdateStatus, onUpdatePermission, onUpdateDetails, userPhotoMap, isPemeriksaan, isArsip }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [showMediaModal, setShowMediaModal] = useState(false);
  const { clean, formatted, url } = rep.applicantTelegramUsername ? parseTelegramUsername(rep.applicantTelegramUsername) : { clean: null, formatted: null, url: null };

  const { userProfile, telegramUser } = useAuth();
  const currentUsername = userProfile?.username || telegramUser?.username;
  const currentTelegramId = userProfile?.telegramId || String(telegramUser?.id || '');

  const canEdit = useMemo(() => {
    if (isAdminOrOwner) return true;
    const repUsername = rep.recruiterUsername || rep.username;
    if (repUsername && currentUsername && repUsername.toLowerCase() === currentUsername.toLowerCase()) {
      return true;
    }
    if (rep.telegramId && currentTelegramId && rep.telegramId === currentTelegramId) {
      return true;
    }
    return false;
  }, [isAdminOrOwner, rep, currentUsername, currentTelegramId]);

  const [isEditing, setIsEditing] = useState(false);
  const [editTg, setEditTg] = useState(rep.applicantTelegramUsername || '');
  const [editWa, setEditWa] = useState(rep.applicantWhatsapp || '');
  const [editGrup, setEditGrup] = useState<'T0' | 'V0' | 'RECRUITER' | 'T3'>((rep.grup as 'T0' | 'V0' | 'RECRUITER' | 'T3') || 'T0');
  const [editChannel, setEditChannel] = useState(rep.channel || '');
  const [isSaving, setIsSaving] = useState(false);

  const handleSaveDetails = async () => {
    if (!onUpdateDetails) return;
    setIsSaving(true);
    try {
      const parsed = parseTelegramUsername(editTg);
      const cleanTg = parsed.clean || editTg.trim();
      const finalTg = parsed.formatted || editTg.trim();

      let newPhotoUrl = rep.applicantPhotoUrl || '';
      
      // If the username actually changed, try to auto-detect their new profile photo!
      if (cleanTg.toLowerCase() !== (clean ? clean.toLowerCase() : '')) {
        try {
          const res = await checkTelegramAvailability(cleanTg);
          if (res.exists && res.photoUrl) {
            newPhotoUrl = res.photoUrl;
          }
        } catch (e) {
          console.error('Error fetching new photo:', e);
        }
      }

      const updateData: any = {
        applicantTelegramUsername: finalTg,
        applicantWhatsapp: editWa,
        grup: editGrup,
        channel: editChannel,
        applicantPhotoUrl: newPhotoUrl
      };

      // If the old videoUrl was just a fallback to the old profile picture, update it to the new one!
      if (rep.videoUrl && (rep.videoUrl === rep.applicantPhotoUrl || rep.videoUrl.startsWith('https://unavatar.io/telegram/'))) {
        updateData.videoUrl = newPhotoUrl;
      }

      await onUpdateDetails(rep.reportId || '', updateData);
      setIsEditing(false);
      triggerHaptic('notification', 'success');
    } catch (err) {
      console.error('Error saving details:', err);
      triggerHaptic('notification', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const recruiterInfo = useMemo(() => {
    if (!userPhotoMap) return null;
    const tgId = rep.telegramId;
    if (tgId && userPhotoMap.has(tgId)) {
      return userPhotoMap.get(tgId);
    }
    const rUsername = rep.recruiterUsername || rep.username;
    if (rUsername) {
      const formattedName = formatUsername(rUsername).toLowerCase();
      if (userPhotoMap.has(formattedName)) {
        return userPhotoMap.get(formattedName);
      }
    }
    return null;
  }, [rep, userPhotoMap]);

  const applicantPhotoInfo = useMemo(() => {
    if (!userPhotoMap) return null;
    if (clean && userPhotoMap.has(clean)) {
      return userPhotoMap.get(clean);
    }
    return null;
  }, [userPhotoMap, clean]);

  const cleanWa = rep.applicantWhatsapp ? rep.applicantWhatsapp.replace(/[^0-9]/g, '') : '';
  const waUrl = cleanWa ? (cleanWa.startsWith('62') ? `https://wa.me/${cleanWa}` : cleanWa.startsWith('0') ? `https://wa.me/62${cleanWa.slice(1)}` : `https://wa.me/${cleanWa}`) : null;

  const isImageMedia = rep.videoUrl && (rep.videoUrl.startsWith('data:image/') || rep.videoUrl.match(/\.(jpeg|jpg|png|webp|gif)($|\?)/i));

  return (
    <div className="bg-slate-950 rounded-2xl border border-slate-800 text-xs overflow-hidden transition-all shadow-md hover:border-slate-700">
      {/* Header Bar - Always Visible (Click to Collapse/Expand) */}
      <div 
        onClick={() => {
          setIsExpanded(!isExpanded);
          triggerHaptic('selection');
        }}
        className="p-3 flex items-center justify-between cursor-pointer select-none bg-slate-950 hover:bg-slate-900/60 transition-colors"
      >
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-8 h-8 rounded-full overflow-hidden bg-slate-900 border border-slate-700 shrink-0 flex items-center justify-center shadow-inner">
            {rep.applicantPhotoUrl ? (
              <img 
                src={rep.applicantPhotoUrl} 
                alt="Foto Pelamar" 
                className="w-full h-full object-cover" 
                referrerPolicy="no-referrer"
              />
            ) : applicantPhotoInfo?.photoUrl ? (
              <img 
                src={applicantPhotoInfo.photoUrl} 
                alt="Foto Pelamar" 
                className="w-full h-full object-cover" 
                referrerPolicy="no-referrer"
              />
            ) : isImageMedia ? (
              <img 
                src={rep.videoUrl} 
                alt="Foto Pelamar" 
                className="w-full h-full object-cover" 
                referrerPolicy="no-referrer"
              />
            ) : (
              <span className="text-[11px] font-black text-amber-400">
                {(rep.applicantTelegramUsername || rep.applicantWhatsapp || 'P').replace('@', '').charAt(0).toUpperCase()}
              </span>
            )}
          </div>
          <div className="flex flex-col min-w-0">
            <span className="font-bold text-white text-xs truncate leading-tight flex items-center gap-1.5">
              <span>{applicantPhotoInfo?.name || applicantPhotoInfo?.firstName || (clean ? clean : 'Pelamar')}</span>
              {rep.videoUrl && (
                <span className="text-[9px] px-1.5 py-0.2 bg-sky-500/10 text-sky-400 rounded-md border border-sky-500/20 font-medium shrink-0">
                  📷 Bukti
                </span>
              )}
            </span>
            <div className="flex items-center gap-2 text-[10px] text-slate-400 font-medium flex-wrap">
              {formatted ? (
                <a 
                  href={url as string} 
                  target="_blank" 
                  rel="noopener noreferrer" 
                  onClick={(e) => e.stopPropagation()}
                  className="text-sky-400 hover:underline font-mono font-semibold truncate flex items-center gap-0.5"
                >
                  <Send className="w-2.5 h-2.5 shrink-0" />
                  <span>{formatted}</span>
                </a>
              ) : (
                <span className="text-slate-500 text-[10px]">Tanpa Username Telegram</span>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0" onClick={(e) => e.stopPropagation()}>
          {isAdminOrOwner ? (
            <select
              value={rep.result || 'Pending'}
              onChange={(e) => onUpdateStatus(rep.reportId || '', e.target.value as 'Pending' | 'ACC' | 'REJECT')}
              className={`px-2 py-0.5 rounded-full text-[10px] font-black border outline-none appearance-none cursor-pointer ${
                rep.result === 'ACC'
                  ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                  : rep.result === 'REJECT'
                  ? 'bg-rose-500/20 text-rose-300 border-rose-500/30'
                  : 'bg-amber-500/20 text-amber-300 border-amber-500/30'
              }`}
            >
              <option value="Pending" className="bg-slate-900 text-amber-400">
                {isPemeriksaan ? 'Pending (Belum Diperiksa)' : 'Pending'}
              </option>
              <option value="ACC" className="bg-slate-900 text-emerald-400">
                {isPemeriksaan ? 'ACC (Bekerja)' : 'ACC'}
              </option>
              <option value="REJECT" className="bg-slate-900 text-rose-400">
                {isPemeriksaan ? 'REJECT (Tidak Bekerja)' : 'REJECT'}
              </option>
            </select>
          ) : (
            <span className={`px-2 py-0.5 rounded-full text-[10px] font-black border ${
              rep.result === 'ACC'
                ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                : rep.result === 'REJECT'
                ? 'bg-rose-500/20 text-rose-300 border-rose-500/30'
                : 'bg-amber-500/20 text-amber-300 border-amber-500/30'
            }`}>
              {rep.result === 'ACC'
                ? (isPemeriksaan ? 'ACC (Bekerja)' : 'ACC')
                : rep.result === 'REJECT'
                ? (isPemeriksaan ? 'REJECT (Tidak Bekerja)' : 'REJECT')
                : 'Pending'}
            </span>
          )}

          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setIsExpanded(!isExpanded);
              triggerHaptic('selection');
            }}
            className="p-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-800 transition-all flex items-center gap-1 text-[10px] font-bold shadow-sm"
            title={isExpanded ? "Sembunyikan Detail" : "Lihat Detail Akun"}
          >
            <span>{isExpanded ? 'Tutup' : 'Detail'}</span>
            {isExpanded ? <ChevronUp className="w-3.5 h-3.5 text-sky-400" /> : <ChevronDown className="w-3.5 h-3.5 text-slate-400" />}
          </button>
        </div>
      </div>

      {/* Expanded Details Panel */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
            className="px-3.5 pb-3.5 pt-1 space-y-2 border-t border-slate-900/80 bg-slate-950/60"
          >
            {isEditing ? (
              <div className="space-y-3 pt-1">
                <div className="grid grid-cols-2 gap-3">
                  <div className="flex flex-col gap-1">
                    <label className="text-slate-500 font-semibold uppercase text-[9px] tracking-wider">Username Telegram</label>
                    <input 
                      type="text" 
                      value={editTg} 
                      onChange={(e) => setEditTg(e.target.value)}
                      className="bg-slate-900 border border-slate-800 text-slate-200 text-xs rounded-xl px-2.5 py-1.5 focus:border-sky-500 focus:outline-none font-medium"
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-slate-500 font-semibold uppercase text-[9px] tracking-wider">Nomor WhatsApp</label>
                    <input 
                      type="text" 
                      value={editWa} 
                      onChange={(e) => setEditWa(e.target.value)}
                      className="bg-slate-900 border border-slate-800 text-slate-200 text-xs rounded-xl px-2.5 py-1.5 focus:border-sky-500 focus:outline-none font-medium"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="flex flex-col gap-1">
                    <label className="text-slate-500 font-semibold uppercase text-[9px] tracking-wider">Grup</label>
                    <select 
                      value={editGrup} 
                      onChange={(e) => setEditGrup(e.target.value as 'T0' | 'V0' | 'RECRUITER' | 'T3')}
                      className="bg-slate-900 border border-slate-800 text-slate-200 text-xs rounded-xl px-2.5 py-1.5 focus:border-sky-500 focus:outline-none cursor-pointer font-medium"
                    >
                      <option value="T0">T0-MARK</option>
                      <option value="V0">V0</option>
                      <option value="RECRUITER">RECRUITER</option>
                      {isAdminOrOwner && <option value="T3">T0-MARK (Dipromosikan)</option>}
                    </select>
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-slate-500 font-semibold uppercase text-[9px] tracking-wider">Channel / Sosmed</label>
                    <select 
                      value={editChannel} 
                      onChange={(e) => setEditChannel(e.target.value)}
                      className="bg-slate-900 border border-slate-800 text-slate-200 text-xs rounded-xl px-2.5 py-1.5 focus:border-sky-500 focus:outline-none cursor-pointer font-medium"
                    >
                      {CHANNELS.map(ch => (
                        <option key={ch.id} value={ch.id}>{ch.label}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="flex items-center gap-2 pt-1">
                  <button
                    type="button"
                    disabled={isSaving}
                    onClick={handleSaveDetails}
                    className="px-3 py-1.5 bg-sky-500 hover:bg-sky-600 disabled:opacity-50 text-white rounded-xl text-[10px] font-bold transition-all flex items-center gap-1 shadow-sm"
                  >
                    {isSaving ? 'Menyimpan...' : 'Simpan'}
                  </button>
                  <button
                    type="button"
                    disabled={isSaving}
                    onClick={() => {
                      setIsEditing(false);
                      setEditTg(rep.applicantTelegramUsername || '');
                      setEditWa(rep.applicantWhatsapp || '');
                      setEditGrup(rep.grup || 'T0');
                      setEditChannel(rep.channel || '');
                    }}
                    className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-slate-200 rounded-xl text-[10px] font-bold border border-slate-800 transition-all"
                  >
                    Batal
                  </button>
                </div>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-2 gap-x-3 gap-y-2.5 text-[10px] sm:text-xs md:text-sm text-slate-400 pt-1">
                  <div className="flex flex-col gap-0.5">
                    <span className="text-slate-500 font-semibold uppercase text-[9px] sm:text-[10px] md:text-xs tracking-wider">Tanggal</span>
                    <strong className="text-slate-200 text-[10px] sm:text-xs md:text-sm">{formatDateWithDay(rep.date)}</strong>
                  </div>
                  <div className="flex flex-col gap-0.5">
                    <span className="text-slate-500 font-semibold uppercase text-[9px] sm:text-[10px] md:text-xs tracking-wider">UID 9Kucing</span>
                    <strong className="text-amber-300 font-mono font-bold text-[10px] sm:text-xs md:text-sm">{rep.uid9Kucing || '-'}</strong>
                  </div>
                  <div className="flex flex-col gap-0.5">
                    <span className="text-slate-500 font-semibold uppercase text-[9px] sm:text-[10px] md:text-xs tracking-wider">Channel</span>
                    <strong className="text-slate-200 text-[10px] sm:text-xs md:text-sm">{rep.channel || '-'}</strong>
                  </div>
                  <div className="flex flex-col gap-0.5">
                    <span className="text-slate-500 font-semibold uppercase text-[9px] sm:text-[10px] md:text-xs tracking-wider">Grup</span>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <strong className="text-slate-200 text-[10px] sm:text-xs md:text-sm">
                        {rep.grup === 'T0' ? 'T0-MARK' : rep.grup === 'V0' ? 'V0' : rep.grup === 'RECRUITER' ? 'RECRUITER' : rep.grup === 'T3' ? 'T0-MARK' : (rep.grup || '-')}
                      </strong>
                      {rep.grup === 'T3' && (
                        <span className="text-[8px] sm:text-[9px] px-1.5 py-0.5 bg-emerald-500/10 text-emerald-400 rounded-md border border-emerald-500/30 font-extrabold uppercase shrink-0">
                          Dipromosikan
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex flex-col gap-1 pt-1.5 border-t border-slate-900/40 mt-1 min-w-0">
                    <span className="text-slate-500 font-semibold uppercase text-[9px] sm:text-[10px] md:text-xs tracking-wider">WhatsApp Pelamar</span>
                    <div className="flex items-center gap-1.5 mt-0.5 min-w-0">
                      <div className="w-6 h-6 sm:w-7 sm:h-7 rounded-full bg-emerald-500/10 border border-emerald-500/30 shrink-0 flex items-center justify-center">
                        <Phone className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-emerald-400" />
                      </div>
                      <div className="flex flex-col min-w-0">
                        {waUrl ? (
                          <a 
                            href={waUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-[10px] sm:text-xs md:text-sm text-emerald-400 font-bold font-mono hover:underline truncate"
                          >
                            {rep.applicantWhatsapp || 'Tanpa WA'}
                          </a>
                        ) : (
                          <span className="text-[10px] sm:text-xs md:text-sm text-slate-400 font-mono truncate">
                            {rep.applicantWhatsapp || '-'}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-col gap-1 pt-1.5 border-t border-slate-900/40 mt-1 min-w-0">
                    <span className="text-slate-500 font-semibold uppercase text-[9px] sm:text-[10px] md:text-xs tracking-wider">Recruiter</span>
                    <div className="flex items-center gap-1.5 mt-0.5 min-w-0">
                      <div className="w-6 h-6 sm:w-7 sm:h-7 rounded-full overflow-hidden bg-slate-900 border border-slate-800 shrink-0 flex items-center justify-center">
                        {recruiterInfo?.photoUrl ? (
                          <img 
                            src={recruiterInfo.photoUrl} 
                            alt={recruiterInfo.firstName} 
                            className="w-full h-full object-cover" 
                            referrerPolicy="no-referrer"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-[10px] sm:text-xs font-black text-slate-400 bg-slate-900">
                            {recruiterInfo?.firstName?.charAt(0).toUpperCase() || (rep.recruiterUsername || rep.username || '?').replace(/^@/, '').charAt(0).toUpperCase()}
                          </div>
                        )}
                      </div>
                      <div className="flex flex-col min-w-0">
                        <span className="text-[10px] sm:text-xs md:text-sm text-slate-200 font-extrabold leading-tight truncate">
                          {formatUsername(rep.recruiterUsername || rep.username)}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Foto / Bukti Pelamar Section */}
                {rep.videoUrl && (
                  <div className="pt-2 border-t border-slate-900/60 mt-1.5 space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-500 font-semibold uppercase text-[9px] sm:text-[10px] md:text-xs tracking-wider flex items-center gap-1">
                        <span>🖼️ Foto / Bukti Pelamar</span>
                      </span>
                      <button
                        type="button"
                        onClick={() => setShowMediaModal(true)}
                        className="text-[10px] sm:text-xs font-bold text-sky-400 hover:text-sky-300 transition-colors"
                      >
                        Lihat Penuh ↗
                      </button>
                    </div>
                    <div 
                      onClick={() => setShowMediaModal(true)}
                      className="relative rounded-xl overflow-hidden border border-slate-800 bg-slate-900/80 max-h-36 flex items-center justify-center cursor-pointer group hover:border-sky-500/50 transition-all"
                    >
                      {isImageMedia ? (
                        <img 
                          src={rep.videoUrl} 
                          alt="Foto Pelamar" 
                          className="w-full max-h-36 object-cover group-hover:scale-105 transition-transform duration-300" 
                          referrerPolicy="no-referrer"
                        />
                      ) : (
                        <video 
                          src={rep.videoUrl} 
                          className="w-full max-h-36 object-contain bg-black"
                        />
                      )}
                      <div className="absolute inset-0 bg-slate-950/20 group-hover:bg-transparent transition-colors" />
                    </div>
                  </div>
                )}
              </>
            )}

            {/* Action Row: Hubungi Pelamar (Telegram & WhatsApp) & Ubah Data */}
            <div className="flex items-center justify-between pt-2 border-t border-slate-800/80 mt-1.5 flex-wrap gap-2">
              <span className="text-[9px] font-bold uppercase tracking-wider text-slate-500">
                Aksi Lanjutan:
              </span>
              <div className="flex items-center gap-1.5 shrink-0 flex-wrap">
                {canEdit && !isEditing && (
                  <button
                    type="button"
                    onClick={() => {
                      setIsEditing(true);
                      triggerHaptic('selection');
                    }}
                    className="px-2.5 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-800 hover:border-sky-500/30 text-[10px] text-slate-300 hover:text-white font-bold flex items-center gap-1 transition-all shadow-sm"
                  >
                    <Edit2 className="w-2.5 h-2.5 text-sky-400" />
                    <span>Ubah Data</span>
                  </button>
                )}
                {clean && (
                  <a
                    href={url as string}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-2.5 py-1 rounded-lg bg-sky-500/10 hover:bg-sky-500/20 border border-sky-500/30 text-[10px] text-sky-300 font-bold flex items-center gap-1 transition-all shadow-sm"
                  >
                    <Send className="w-2.5 h-2.5 text-sky-400" />
                    <span>Telegram</span>
                    <ExternalLink className="w-2.5 h-2.5" />
                  </a>
                )}
                {waUrl && (
                  <a
                    href={waUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-2.5 py-1 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 text-[10px] text-emerald-300 font-bold flex items-center gap-1 transition-all shadow-sm"
                  >
                    <Phone className="w-2.5 h-2.5 text-emerald-400" />
                    <span>WA</span>
                    <ExternalLink className="w-2.5 h-2.5" />
                  </a>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Full Screen Media Modal */}
      {showMediaModal && rep.videoUrl && (
        <div 
          className="fixed inset-0 z-50 bg-slate-950/90 backdrop-blur-md p-4 flex items-center justify-center"
          onClick={() => setShowMediaModal(false)}
        >
          <div 
            className="relative max-w-lg w-full bg-slate-900 border border-slate-800 rounded-3xl p-3 overflow-hidden shadow-2xl space-y-3"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-2 border-b border-slate-800 px-1">
              <span className="text-xs font-bold text-white flex items-center gap-1.5">
                <span>🖼️ Foto / Bukti Pelamar</span>
                <span className="text-[10px] text-slate-400 font-normal">({rep.applicantWhatsapp || 'Pelamar'})</span>
              </span>
              <button
                type="button"
                onClick={() => setShowMediaModal(false)}
                className="p-1 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="rounded-2xl overflow-hidden bg-black flex items-center justify-center max-h-[75vh]">
              {isImageMedia ? (
                <img 
                  src={rep.videoUrl} 
                  alt="Bukti Pelamar" 
                  className="w-full h-full object-contain"
                />
              ) : (
                <video 
                  src={rep.videoUrl} 
                  controls 
                  autoPlay
                  className="w-full h-full object-contain"
                />
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export const DataHarianPage: React.FC = () => {
  const { userProfile, telegramUser } = useAuth();
  const { reports, submitReport, updateStatus, updatePermission, updateDetails, isLoading } = useReports();
  const [activeTab, setActiveTab] = useState<'formulir' | 'minggu_ini' | 'pemeriksaan' | 'arsip'>('formulir');
  const [pemeriksaanFilter, setPemeriksaanFilter] = useState<'semua' | 'pending' | 'bekerja' | 'tidak_bekerja'>('semua');
  const [activeDayTab, setActiveDayTab] = useState<'Semua' | 'Senin' | 'Selasa' | 'Rabu' | 'Kamis' | 'Jumat' | 'Sabtu' | 'Minggu'>('Semua');
  const [selectedRecruiter, setSelectedRecruiter] = useState<string>('Semua');
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [expandedArchiveWeekKey, setExpandedArchiveWeekKey] = useState<string | null>(null);
  const [archiveWeekPage, setArchiveWeekPage] = useState<number>(1);
  const [isChannelDropdownOpen, setIsChannelDropdownOpen] = useState<boolean>(false);
  const ITEMS_PER_PAGE = 10;

  const [allUsers, setAllUsers] = useState<UserProfile[]>([]);

  useEffect(() => {
    const unsubscribe = subscribeToAllUsers((users) => {
      setAllUsers(users);
    });
    return () => unsubscribe();
  }, []);

  const userPhotoMap = useMemo(() => {
    const map = new Map<string, { photoUrl?: string; firstName?: string; name?: string }>();
    allUsers.forEach((u) => {
      const uName = u.lastName ? `${u.firstName} ${u.lastName}` : u.firstName;
      const data = {
        photoUrl: u.photoUrl,
        firstName: u.firstName,
        name: uName
      };
      if (u.username) {
        const formatted = formatUsername(u.username).toLowerCase();
        map.set(formatted, data);
        const clean = u.username.replace(/@/g, '').toLowerCase();
        map.set(clean, data);
      }
      if (u.telegramId) {
        map.set(String(u.telegramId), data);
      }
    });
    return map;
  }, [allUsers]);

  useEffect(() => {
    setCurrentPage(1);
  }, [activeTab, activeDayTab, selectedRecruiter]);

  const isAdminOrOwner = userProfile?.role === 'Admin' || userProfile?.role === 'Owner';
  const telegramId = userProfile?.telegramId || String(telegramUser?.id || '');

  const todayStr = getWIBDate();

  // Auto-set recruiter username
  const autoRecruiterUsername = userProfile?.username 
    ? formatUsername(userProfile.username)
    : telegramUser?.username
    ? formatUsername(telegramUser.username)
    : userProfile?.firstName
    ? formatUsername(userProfile.firstName)
    : 'Recruiter';

  interface RecruiterOption {
    key: string;
    telegramId?: string;
    username: string;
    cleanUsername: string;
    name: string;
    role?: string;
  }

  // Extract all unique recruiters (registered users + report submitters)
  const recruitersList = useMemo(() => {
    const map = new Map<string, RecruiterOption>();

    // 1. Add registered Recruiter users from allUsers (exclude Admin & Owner)
    allUsers.forEach((u) => {
      if (u.role === 'Admin' || u.role === 'Owner') return;

      const cleanUname = (u.username || u.firstName || '').replace(/@/g, '').trim().toLowerCase();
      const formattedUname = formatUsername(u.username || u.firstName || u.telegramId);
      const fullName = u.lastName ? `${u.firstName} ${u.lastName}` : (u.firstName || u.username || 'Recruiter');
      const key = u.telegramId ? String(u.telegramId) : (cleanUname || formattedUname.toLowerCase());

      map.set(key, {
        key,
        telegramId: u.telegramId ? String(u.telegramId) : undefined,
        username: formattedUname,
        cleanUsername: cleanUname,
        name: fullName,
        role: u.role
      });
    });

    // 2. Add any additional recruiters found in reports who might not be in allUsers
    reports.forEach((r) => {
      let rUsername = r.recruiterUsername || r.username || '';
      let rName = r.name || '';
      const rTgId = r.telegramId ? String(r.telegramId) : undefined;

      const cleanUname = rUsername.replace(/@/g, '').trim().toLowerCase();
      const formattedUname = formatUsername(rUsername || rTgId || 'Recruiter');
      const key = rTgId || (cleanUname || formattedUname.toLowerCase());

      if (!map.has(key)) {
        let foundExistingKey: string | undefined = undefined;
        for (const [existingKey, existingRec] of map.entries()) {
          if ((rTgId && existingRec.telegramId === rTgId) || (cleanUname && cleanUname !== 'recruiter' && existingRec.cleanUsername === cleanUname)) {
            foundExistingKey = existingKey;
            break;
          }
        }

        if (!foundExistingKey) {
          map.set(key, {
            key,
            telegramId: rTgId,
            username: formattedUname,
            cleanUsername: cleanUname,
            name: rName || formattedUname,
            role: 'Recruiter'
          });
        }
      }
    });

    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [allUsers, reports]);

  // Admin/Owner sees all reports, regular users see only theirs
  const userReports = useMemo(() => {
    // Only display individual applicant entries (having whatsapp or uid9kucing), exclude Daily Summary reports
    const applicantOnlyReports = reports.filter((r) => r.applicantWhatsapp || r.uid9Kucing);

    let baseReports = applicantOnlyReports;
    if (!isAdminOrOwner) {
      baseReports = applicantOnlyReports.filter((r) => String(r.telegramId) === String(telegramId));
    } else if (selectedRecruiter !== 'Semua') {
      const targetRecruiter = recruitersList.find(rec => rec.key === selectedRecruiter);

      const targetTgId = targetRecruiter?.telegramId ? String(targetRecruiter.telegramId) : (selectedRecruiter.match(/^\d+$/) ? selectedRecruiter : undefined);
      const targetCleanUname = targetRecruiter?.cleanUsername || selectedRecruiter.replace(/@/g, '').trim().toLowerCase();

      baseReports = applicantOnlyReports.filter((r) => {
        const rTgId = r.telegramId ? String(r.telegramId) : undefined;
        const rCleanUname = (r.recruiterUsername || r.username || '').replace(/@/g, '').trim().toLowerCase();

        // Match by Telegram ID if available
        if (targetTgId && rTgId && targetTgId === rTgId) {
          return true;
        }

        // Match by clean username (case-insensitive, ignoring @)
        if (targetCleanUname && rCleanUname && targetCleanUname !== 'recruiter' && targetCleanUname === rCleanUname) {
          return true;
        }

        // Fallback direct match
        if (selectedRecruiter) {
          const selClean = selectedRecruiter.replace(/@/g, '').trim().toLowerCase();
          if (rTgId === selectedRecruiter || (rCleanUname && rCleanUname === selClean)) {
            return true;
          }
        }

        return false;
      });
    }
    return baseReports;
  }, [reports, telegramId, isAdminOrOwner, selectedRecruiter, recruitersList, allUsers]);

  // Calculate current week's Monday
  const currentMondayStr = useMemo(() => {
    return getWIBMonday(0);
  }, []);

  // Calculate last week's Monday
  const lastMondayStr = useMemo(() => {
    return getWIBMonday(-7);
  }, []);

  const reportsMingguIni = useMemo(() => {
    return userReports.filter(r => r.date >= currentMondayStr);
  }, [userReports, currentMondayStr]);

  const weekDays = useMemo(() => {
    return getWIBCurrentWeekDays();
  }, []);

  const filteredReportsMingguIni = useMemo(() => {
    if (activeDayTab === 'Semua') {
      return reportsMingguIni;
    }
    const targetDay = weekDays.find(d => d.dayName === activeDayTab);
    if (!targetDay) return [];
    return reportsMingguIni.filter(r => r.date === targetDay.dateStr);
  }, [reportsMingguIni, activeDayTab, weekDays]);

  const getReportCountForDay = (dayName: string) => {
    if (dayName === 'Semua') return reportsMingguIni.length;
    const targetDay = weekDays.find(d => d.dayName === dayName);
    if (!targetDay) return 0;
    return reportsMingguIni.filter(r => r.date === targetDay.dateStr).length;
  };

  const reportsPemeriksaan = useMemo(() => {
    return userReports.filter(r => r.date >= lastMondayStr && r.date < currentMondayStr);
  }, [userReports, currentMondayStr, lastMondayStr]);

  const countPemeriksaanPending = useMemo(() => {
    return reportsPemeriksaan.filter(r => !r.result || r.result === 'Pending').length;
  }, [reportsPemeriksaan]);

  const countPemeriksaanBekerja = useMemo(() => {
    return reportsPemeriksaan.filter(r => r.result === 'ACC').length;
  }, [reportsPemeriksaan]);

  const countPemeriksaanTidakBekerja = useMemo(() => {
    return reportsPemeriksaan.filter(r => r.result === 'REJECT').length;
  }, [reportsPemeriksaan]);

  const filteredReportsPemeriksaan = useMemo(() => {
    return reportsPemeriksaan.filter(r => {
      if (pemeriksaanFilter === 'pending') return !r.result || r.result === 'Pending';
      if (pemeriksaanFilter === 'bekerja') return r.result === 'ACC';
      if (pemeriksaanFilter === 'tidak_bekerja') return r.result === 'REJECT';
      return true;
    });
  }, [reportsPemeriksaan, pemeriksaanFilter]);

  const reportsArsip = useMemo(() => {
    return userReports.filter(r => r.date < lastMondayStr);
  }, [userReports, lastMondayStr]);

  const archivedWeeks = useMemo(() => {
    const groups: Record<string, DailyReport[]> = {};
    reportsArsip.forEach(rep => {
      const weekKey = rep.date ? getWIBMondayOfDate(rep.date) : '';
      if (weekKey) {
        if (!groups[weekKey]) {
          groups[weekKey] = [];
        }
        groups[weekKey].push(rep);
      }
    });

    const sortedWeekKeys = Object.keys(groups).sort((a, b) => b.localeCompare(a));

    return sortedWeekKeys.map(weekKey => {
      const weekRange = getWIBWeekRange(weekKey);
      return {
        weekKey,
        rangeText: weekRange.shortFormattedRange,
        reports: groups[weekKey]
      };
    });
  }, [reportsArsip]);

  const paginatedReportsMingguIni = useMemo(() => {
    return filteredReportsMingguIni.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);
  }, [filteredReportsMingguIni, currentPage, ITEMS_PER_PAGE]);

  const paginatedReportsPemeriksaan = useMemo(() => {
    return filteredReportsPemeriksaan.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);
  }, [filteredReportsPemeriksaan, currentPage, ITEMS_PER_PAGE]);

  const paginatedReportsArsip = useMemo(() => {
    return reportsArsip.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);
  }, [reportsArsip, currentPage, ITEMS_PER_PAGE]);

  const renderPagination = (totalItems: number) => {
    if (totalItems === 0) return null;
    const totalPages = Math.ceil(totalItems / ITEMS_PER_PAGE) || 1;

    return (
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-3 rounded-2xl bg-slate-950/90 border border-slate-800/90 shadow-xl mt-4">
        <div className="text-[10px] font-bold text-slate-400 text-center sm:text-left flex items-center gap-2 flex-wrap justify-center sm:justify-start">
          <span>
            Menampilkan <span className="text-white font-black">{Math.min((currentPage - 1) * ITEMS_PER_PAGE + 1, totalItems)} - {Math.min(currentPage * ITEMS_PER_PAGE, totalItems)}</span> dari <span className="text-white font-black">{totalItems}</span> data
          </span>
          <span className="text-[9px] px-2 py-0.5 rounded-full bg-slate-900 border border-slate-800 text-sky-400 font-semibold shadow-inner">
            10 per halaman
          </span>
        </div>
        
        {totalPages > 1 && (
          <div className="flex items-center gap-1.5">
            <button
              type="button"
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
                  : 'bg-slate-900 text-sky-400 border-slate-700 hover:bg-slate-800 hover:text-white shadow-sm cursor-pointer'
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
                        type="button"
                        onClick={() => {
                          setCurrentPage(p);
                          triggerHaptic('selection');
                        }}
                        className={`w-7 h-7 rounded-xl text-[10px] font-black transition-all border ${
                          currentPage === p
                            ? 'bg-sky-500 text-slate-950 border-sky-400 shadow-md shadow-sky-500/20'
                            : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-white cursor-pointer'
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
                if (currentPage < totalPages) {
                  setCurrentPage(prev => prev + 1);
                  triggerHaptic('selection');
                }
              }}
              disabled={currentPage === totalPages}
              className={`px-3 py-1.5 rounded-xl text-[10px] font-black uppercase transition-all flex items-center gap-1 border ${
                currentPage === totalPages
                  ? 'bg-slate-900/40 text-slate-600 border-slate-800/40 cursor-not-allowed'
                  : 'bg-slate-900 text-sky-400 border-slate-700 hover:bg-slate-800 hover:text-white shadow-sm cursor-pointer'
              }`}
            >
              Next
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </div>
    );
  };

  // Check if submitted report today
  const hasReportToday = useMemo(() => {
    return reports.some((r) => r.telegramId === telegramId && r.date === todayStr && (r.applicantWhatsapp || r.uid9Kucing));
  }, [reports, telegramId, todayStr]);

  // Form State initialized with auto set values
  const [formData, setFormData] = useState<DailyReportFormData>({
    date: todayStr,
    recruiterUsername: autoRecruiterUsername,
    channel: 'Facebook',
    applicantWhatsapp: '',
    uid9Kucing: '',
    applicantTelegramUsername: '',
    result: 'Pending',
    grup: 'T0',
    visit: 0,
    applicant: 1,
    quality: 0,
    posting: 0,
    permission: 0,
    note: ''
  });

  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
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
  const [showReview, setShowReview] = useState<boolean>(false);
  const [isCheckingDuplicate, setIsCheckingDuplicate] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [formStep, setFormStep] = useState<'upload' | 'data'>('upload');

  const [isScanningUID, setIsScanningUID] = useState(false);
  const [scanProgress, setScanProgress] = useState<number>(0);
  const [scanError, setScanError] = useState<string | null>(null);

  const handleScanScreenshot = async (file: File) => {
    setIsScanningUID(true);
    setScanProgress(0);
    setScanError(null);
    triggerHaptic('impact');
    try {
      // Run Tesseract.js OCR directly in the browser
      const result = await Tesseract.recognize(
        file,
        'eng',
        {
          logger: m => {
            if (m.status === 'recognizing text') {
              setScanProgress(Math.round(m.progress * 100));
            }
          }
        }
      );

      const text = result.data.text || '';
      console.log('Tesseract OCR Result Raw Text:', text);

      let extractedUid = '';

      // Helper to check if a sequence looks like a typical Indonesian phone number
      // (Starts with 08..., 62..., +62..., or 8... and length is 9-14 digits)
      const isPhoneNumber = (numStr: string) => {
        const clean = numStr.replace(/\D/g, '');
        if ((clean.startsWith('08') || clean.startsWith('62') || clean.startsWith('8')) && clean.length >= 9 && clean.length <= 14) {
          return true;
        }
        return false;
      };

      // Helper to clean common OCR confusion characters into numbers
      const cleanOcrDigits = (str: string) => {
        return str
          .replace(/o/gi, '0')     // 'o' or 'O' to '0'
          .replace(/[ilI|]/g, '1') // 'i', 'l', 'I', or pipe '|' to '1'
          .replace(/s/gi, '5')     // 's' or 'S' to '5'
          .replace(/z/gi, '2')     // 'z' or 'Z' to '2'
          .replace(/b/g, '6')      // 'b' to '6'
          .replace(/g/g, '9')      // 'g' to '9'
          .replace(/\D/g, '');     // Strip all other non-digits
      };

      const lines = text.split('\n').map(l => l.trim()).filter(Boolean);

      // --- STAGE 1: Keyword scanning with multi-line lookahead ---
      for (let i = 0; i < lines.length; i++) {
        const lineLower = lines[i].toLowerCase();
        const hasKeyword = lineLower.includes('uid') || 
                            lineLower.includes('user id') || 
                            lineLower.includes('id pelamar') || 
                            lineLower.includes('id:') || 
                            lineLower.includes('id ') ||
                            lineLower.includes('pelamar');

        if (hasKeyword) {
          // 1a. Check same line (excluding the keyword label itself)
          const cleanLine = lineLower
            .replace(/user\s*id/g, '')
            .replace(/id\s*pelamar/g, '')
            .replace(/id/g, '')
            .replace(/uid/g, '')
            .replace(/pelamar/g, '');

          // Look for any string that contains 5-15 digits or digit-lookalikes
          const sameLineMatches = cleanLine.match(/[0-9oilszbg|]{5,15}/gi);
          if (sameLineMatches) {
            for (const match of sameLineMatches) {
              const cleaned = cleanOcrDigits(match);
              if (cleaned.length >= 5 && cleaned.length <= 15 && !isPhoneNumber(cleaned)) {
                extractedUid = cleaned;
                console.log(`[OCR Stage 1a] Found on same line as keyword: ${extractedUid} (raw: ${match})`);
                break;
              }
            }
          }
          if (extractedUid) break;

          // 1b. Check next line
          if (i + 1 < lines.length) {
            const nextLine = lines[i + 1];
            const nextLineMatches = nextLine.match(/[0-9oilszbg|]{5,15}/gi);
            if (nextLineMatches) {
              for (const match of nextLineMatches) {
                const cleaned = cleanOcrDigits(match);
                if (cleaned.length >= 5 && cleaned.length <= 15 && !isPhoneNumber(cleaned)) {
                  extractedUid = cleaned;
                  console.log(`[OCR Stage 1b] Found on next line: ${extractedUid} (raw: ${match})`);
                  break;
                }
              }
            }
          }
          if (extractedUid) break;

          // 1c. Check second next line
          if (i + 2 < lines.length) {
            const afterNextLine = lines[i + 2];
            const afterNextLineMatches = afterNextLine.match(/[0-9oilszbg|]{5,15}/gi);
            if (afterNextLineMatches) {
              for (const match of afterNextLineMatches) {
                const cleaned = cleanOcrDigits(match);
                if (cleaned.length >= 5 && cleaned.length <= 15 && !isPhoneNumber(cleaned)) {
                  extractedUid = cleaned;
                  console.log(`[OCR Stage 1c] Found on line after next: ${extractedUid} (raw: ${match})`);
                  break;
                }
              }
            }
          }
          if (extractedUid) break;
        }
      }

      // --- STAGE 2: Keyword search with spaces removed (for spaced out numbers like "U I D : 1 2 3 4 5") ---
      if (!extractedUid) {
        for (let i = 0; i < lines.length; i++) {
          const lineLower = lines[i].toLowerCase();
          if (lineLower.includes('uid') || lineLower.includes('user') || lineLower.includes('pelamar') || lineLower.includes('id')) {
            const nextLineText = lines[i + 1] ? lines[i + 1] : '';
            // Combine current and next line, strip all whitespace
            const combinedNoSpaces = (lines[i] + nextLineText).replace(/\s+/g, '').toLowerCase();
            const keywordMatch = combinedNoSpaces.match(/(?:uid|userid|idpelamar|id|pelamar)(?::|;|=|-)*([0-9oilszbg|]{5,15})/i);
            if (keywordMatch && keywordMatch[1]) {
              const cleaned = cleanOcrDigits(keywordMatch[1]);
              if (cleaned.length >= 5 && cleaned.length <= 15 && !isPhoneNumber(cleaned)) {
                extractedUid = cleaned;
                console.log(`[OCR Stage 2] Found with spaced-out keyword remover: ${extractedUid}`);
                break;
              }
            }
          }
        }
      }

      // --- STAGE 3: Fallback line-by-line standalone digits ---
      if (!extractedUid) {
        for (const line of lines) {
          // Find standalone blocks of 5-15 digits that are not phone numbers
          const standaloneMatches = line.match(/\b([0-9]{5,15})\b/g);
          if (standaloneMatches) {
            for (const match of standaloneMatches) {
              if (!isPhoneNumber(match)) {
                extractedUid = match;
                console.log(`[OCR Stage 3] Found via standalone digits: ${extractedUid}`);
                break;
              }
            }
          }
          if (extractedUid) break;
        }
      }

      // --- STAGE 4: Fallback ANY digits sequence with OCR cleanup ---
      if (!extractedUid) {
        const generalMatches = text.match(/[0-9oilszbg|]{5,15}/gi);
        if (generalMatches) {
          for (const match of generalMatches) {
            const cleaned = cleanOcrDigits(match);
            if (cleaned.length >= 5 && cleaned.length <= 15 && !isPhoneNumber(cleaned)) {
              extractedUid = cleaned;
              console.log(`[OCR Stage 4] Found via general character scan: ${extractedUid}`);
              break;
            }
          }
        }
      }

      if (extractedUid) {
        setFormData(prev => ({ ...prev, uid9Kucing: extractedUid }));
        triggerHaptic('notification', 'success');
        showAlert('success', 'UID Terdeteksi 🎉', `Berhasil mendeteksi UID 9Kucing: ${extractedUid}`);
      } else {
        throw new Error('UID tidak terdeteksi. Silakan coba screenshot lain, atau ketik UID secara manual.');
      }
    } catch (err) {
      console.error(err);
      const errMsg = err instanceof Error ? err.message : 'Gagal memproses screenshot';
      setScanError(errMsg);
      triggerHaptic('notification', 'error');
      showAlert('error', 'Gagal Membaca UID ⚠️', errMsg);
    } finally {
      setIsScanningUID(false);
      setScanProgress(0);
    }
  };

  // Telegram Username Real-time Status
  const [tgStatus, setTgStatus] = useState<{
    status: 'idle' | 'checking' | 'exists' | 'not_found' | 'invalid_syntax' | 'format_valid';
    title?: string;
    photoUrl?: string;
    message?: string;
  }>({ status: 'idle' });

  const [settings, setSettings] = useState<SystemSettings | null>(null);

  useEffect(() => {
    const unsubscribe = subscribeToSystemSettings((s) => {
      setSettings(s);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const rawTg = formData.applicantTelegramUsername;
    if (!rawTg || !rawTg.trim()) {
      setTgStatus({ status: 'idle' });
      return;
    }

    const { clean: cleanTg } = parseTelegramUsername(rawTg);

    if (cleanTg === 'tidak_ada') {
      setTgStatus({
        status: 'exists',
        title: 'Username Tidak Ditemukan',
        message: 'Pelamar dikonfirmasi tidak memiliki username Telegram.'
      });
      return;
    }

    if (!cleanTg || cleanTg.length < 5 || !/^[a-zA-Z0-9_]{5,32}$/.test(cleanTg)) {
      setTgStatus({
        status: 'invalid_syntax',
        message: 'Username Telegram minimal 5-32 karakter (hanya huruf, angka, & underscore)'
      });
      return;
    }

    const lowerKey = cleanTg.toLowerCase();
    if (tgCheckCache.has(lowerKey)) {
      const cached = tgCheckCache.get(lowerKey)!;
      if (!cached.isSyntaxValid) {
        setTgStatus({ status: 'invalid_syntax', message: cached.message });
      } else if (cached.exists === false) {
        setTgStatus({
          status: 'not_found',
          message: `Username @${cleanTg} TIDAK TERDAFTAR di Telegram.`
        });
      } else if (cached.exists === null) {
        setTgStatus({
          status: 'format_valid',
          title: cached.title || `@${cleanTg}`,
          message: `Format @${cleanTg} valid.`
        });
      } else {
        setTgStatus({
          status: 'exists',
          title: cached.title || `@${cleanTg}`,
          photoUrl: cached.photoUrl,
          message: `Username @${cleanTg} terdaftar aktif di Telegram.`
        });
        if (cached.photoUrl) {
          setFormData((prev) => ({ 
            ...prev, 
            applicantPhotoUrl: cached.photoUrl,
            videoUrl: prev.videoUrl || cached.photoUrl 
          }));
        }
      }
      return;
    }

    setTgStatus({
      status: 'checking',
      message: `Memeriksa keberadaan akun Telegram @${cleanTg}...`
    });

    const timer = setTimeout(async () => {
      const result = await checkTelegramAvailability(cleanTg);
      if (!result.isSyntaxValid) {
        setTgStatus({ status: 'invalid_syntax', message: result.message });
      } else if (result.exists === false) {
        setTgStatus({
          status: 'not_found',
          message: `Username @${cleanTg} TIDAK TERDAFTAR di Telegram.`
        });
      } else if (result.exists === null) {
        setTgStatus({
          status: 'format_valid',
          title: result.title || `@${cleanTg}`,
          message: `Format @${cleanTg} valid.`
        });
      } else {
        setTgStatus({
          status: 'exists',
          title: result.title || `@${cleanTg}`,
          photoUrl: result.photoUrl,
          message: `Username @${cleanTg} terdaftar aktif di Telegram.`
        });
        if (result.photoUrl) {
          setFormData((prev) => ({ 
            ...prev, 
            applicantPhotoUrl: result.photoUrl,
            videoUrl: prev.videoUrl || result.photoUrl 
          }));
        }
      }
    }, 250);

    return () => clearTimeout(timer);
  }, [formData.applicantTelegramUsername]);

  // Keep date & recruiter username always auto-updated
  useEffect(() => {
    setFormData((prev) => ({
      ...prev,
      date: todayStr,
      recruiterUsername: autoRecruiterUsername
    }));
  }, [todayStr, autoRecruiterUsername]);

  // Live countdown to midnight (00:00)
  const [timeRemainingMs, setTimeRemainingMs] = useState<number>(0);
  const [elapsedPercent, setElapsedPercent] = useState<number>(100);

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

      // We create "local" dates using Jakarta values to get a relative difference
      // This works because both dates share the same local offset
      const jakartaTime = new Date(2000, 0, 1, parts.hour, parts.minute, parts.second);
      const midnightTime = new Date(2000, 0, 1, 23, 59, 59, 999);
      
      const diff = midnightTime.getTime() - jakartaTime.getTime();
      const totalDayMs = 24 * 60 * 60 * 1000;
      const elapsedMs = (parts.hour * 3600 + parts.minute * 60 + parts.second) * 1000;
      const pct = Math.min(100, Math.max(0, (elapsedMs / totalDayMs) * 100));

      setTimeRemainingMs(Math.max(0, diff));
      setElapsedPercent(pct);
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, []);

  const formatTime = (ms: number) => {
    if (ms <= 0) return { hours: '00', minutes: '00', seconds: '00' };
    const totalSeconds = Math.floor(ms / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    return {
      hours: String(hours).padStart(2, '0'),
      minutes: String(minutes).padStart(2, '0'),
      seconds: String(seconds).padStart(2, '0')
    };
  };

  const { hours, minutes, seconds } = formatTime(timeRemainingMs);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);

    if (!formData.videoUrl) {
      setError('Bukti Foto / Video pelamar wajib diupload terlebih dahulu.');
      showAlert('warning', 'Video / Bukti Wajib Diupload ⚠️', 'Harap upload video atau foto bukti pelamar terlebih dahulu sebelum mengirimkan formulir!');
      setFormStep('upload');
      return;
    }

    if (!formData.applicantWhatsapp) {
      setError('Nomor WA Pelamar wajib diisi.');
      showAlert('warning', 'Data Belum Lengkap', 'Nomor WA Pelamar wajib diisi.');
      return;
    }

    if (!formData.uid9Kucing) {
      setError('UID 9kucing wajib diisi.');
      showAlert('warning', 'Data Belum Lengkap', 'UID 9kucing wajib diisi.');
      return;
    }

    if (formData.applicantTelegramUsername && formData.applicantTelegramUsername.toLowerCase() !== 'tidak_ada' && formData.applicantTelegramUsername.toLowerCase() !== 'tidak ada') {
      if (tgStatus.status === 'checking') {
        setError('Sedang mengecek validitas username Telegram, mohon tunggu sebentar.');
        showAlert('warning', 'Pengecekan Telegram', 'Sedang mengecek username Telegram, silakan tunggu sebentar.');
        return;
      }
      if (tgStatus.status === 'invalid_syntax') {
        setError('Format username Telegram tidak valid.');
        showAlert('warning', 'Username Tidak Valid', 'Format username Telegram yang Anda masukkan tidak valid.');
        return;
      }
      if (tgStatus.status === 'not_found') {
        setError('Username Telegram tidak ditemukan atau tidak terdaftar.');
        const cleanName = parseTelegramUsername(formData.applicantTelegramUsername).clean;
        showAlert('error', 'Username Tidak Ditemukan', `Username Telegram @${cleanName} tidak terdaftar di Telegram. Harap pastikan username benar!`);
        return;
      }
    }

    setIsCheckingDuplicate(true);
    try {
      const parsedTg = parseTelegramUsername(formData.applicantTelegramUsername);
      const finalTg = parsedTg.formatted || formData.applicantTelegramUsername.trim();

      // Check duplicate using our firestore service
      const finalWa = formData.applicantWhatsapp ? formData.applicantWhatsapp.trim().replace(/\D/g, '') : '';
      const duplicateRecord = await checkReportDuplicate(formData.uid9Kucing, finalTg, finalWa);
      if (duplicateRecord) {
        const cleanRecUsername = duplicateRecord.recruiterUsername ? duplicateRecord.recruiterUsername.replace(/^@/, '') : 'Recruiter';
        const dispGrup = duplicateRecord.grup === 'T0' ? 'T0-MARK' : duplicateRecord.grup === 'V0' ? 'V0' : duplicateRecord.grup === 'RECRUITER' ? 'RECRUITER' : duplicateRecord.grup === 'T3' ? 'T3' : (duplicateRecord.grup || '-');
        const dupMsg = `Data dengan UID "${formData.uid9Kucing}", Username Telegram "${finalTg}", atau WhatsApp "${finalWa}" sudah pernah diinput oleh recruiter @${cleanRecUsername} pada tanggal ${duplicateRecord.date} (Grup: ${dispGrup}, Status: ${duplicateRecord.result}).`;
        setError(`⚠️ DUPLIKAT TERDETEKSI: ${dupMsg}`);
        showAlert('error', 'Duplikat Terdeteksi ⚠️', dupMsg);
        setIsCheckingDuplicate(false);
        return;
      }

      // No duplicate, show Review Modal
      setShowReview(true);
      triggerHaptic('selection');
    } catch (err) {
      console.error('Error in duplicate check:', err);
      // Fallback: let them submit/review anyway
      setShowReview(true);
    } finally {
      setIsCheckingDuplicate(false);
    }
  };

  const handleConfirmSubmit = async () => {
    setError(null);
    setSuccessMsg(null);
    setIsSubmitting(true);

    try {
      const parsedTg = parseTelegramUsername(formData.applicantTelegramUsername);
      const finalTg = parsedTg.formatted || formData.applicantTelegramUsername.trim();
      
      const targetGrup = formData.grup;

      const reportData = {
        ...formData,
        date: todayStr, // Ensure auto set date
        recruiterUsername: autoRecruiterUsername, // Ensure auto set recruiter username
        applicantTelegramUsername: finalTg,
        result: 'Pending' as 'Pending' | 'ACC' | 'REJECT',
        grup: targetGrup
      };

      await submitReport(reportData);
      
      // Send to Telegram using real-time settings or fallback (skip if T3/Dipromosikan)
      let telegramNotice = '';
      if (targetGrup === 'T3') {
        telegramNotice = ' (Status T0-MARK Dipromosikan: disimpan di sistem, tidak dikirim ke Telegram)';
      } else {
        try {
          let currentSettings = settings;
          if (!currentSettings || !currentSettings.telegramGroupId) {
            try {
              const sys = await getSystemSettings();
              if (sys) currentSettings = sys;
            } catch (sysErr) {
              console.warn('[DataHarian] Fallback fetch system settings error:', sysErr);
            }
          }

          const groupId = currentSettings?.telegramGroupId || '';
          let topicId = '';
          if (targetGrup === 'T0') topicId = currentSettings?.telegramTopicT0 || '';
          if (targetGrup === 'V0') topicId = currentSettings?.telegramTopicV0 || '';
          if (targetGrup === 'RECRUITER') topicId = currentSettings?.telegramTopicRecruiter || '';

          // Call our proxy server to send the message to Telegram
          const res = await sendReportToTelegramApi(reportData, formData.videoUrl, groupId, topicId);
          if (!res.success) {
            console.error('Failed to send to telegram:', res.error);
            telegramNotice = ` (Catatan Telegram: ${res.error})`;
          } else {
            telegramNotice = ' (Terkirim ke Telegram)';
          }
        } catch (e) {
          console.error('Error sending telegram notification:', e);
          telegramNotice = ` (Error Telegram: ${e instanceof Error ? e.message : 'Koneksi gagal'})`;
        }
      }

      const successMessage = `Data Harian pelamar berhasil disimpan!${telegramNotice ? telegramNotice : ' Tersinkron ke Telegram & Google Sheets.'}`;
      setSuccessMsg(successMessage);
      showAlert('success', 'Berhasil Disimpan 🎉', successMessage);

      // Reset candidate specific fields for next entry
      setFormData((prev) => ({
        ...prev,
        applicantWhatsapp: '',
        uid9Kucing: '',
        applicantTelegramUsername: '',
        result: 'Pending',
        grup: 'T0',
        note: '',
        videoUrl: undefined,
        applicantPhotoUrl: undefined
      }));
      setFormStep('upload');
      
      setShowReview(false);
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : 'Gagal menyimpan data harian.';
      setError(errMsg);
      showAlert('error', 'Gagal Menyimpan Data', errMsg);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="space-y-5 pb-28"
    >
      {/* Live Timer Section */}
      <GlassCard className="p-4 border-sky-500/20 bg-sky-500/5 overflow-hidden relative">
        <div className="absolute top-0 right-0 p-2 opacity-10">
          <Sparkles className="w-12 h-12 text-sky-500" />
        </div>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between relative z-10 gap-3">
          <div className="flex flex-col min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[10px] font-black text-sky-400 uppercase tracking-widest flex items-center gap-1.5">
                <Timer className="w-3.5 h-3.5 animate-pulse text-sky-400" />
                Batas Waktu Harian
              </span>
              <span className="text-[8px] font-black uppercase text-sky-300 bg-sky-500/10 px-2 py-0.5 rounded-full border border-sky-500/20">
                {formatDateWithDay(getWIBDate())}
              </span>
              <span className={`text-[8px] font-black uppercase px-2 py-0.5 rounded-full border ${
                !hasReportToday 
                  ? 'bg-amber-500/10 text-amber-300 border-amber-500/20' 
                  : 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20'
              }`}>
                {!hasReportToday ? 'Belum Input Data' : 'Data Hari Ini Tersimpan'}
              </span>
              <span className="text-[8px] font-black uppercase text-sky-300 bg-sky-500/10 px-2 py-0.5 rounded-full border border-sky-500/20">
                Maksimal 23:59 WIB (12 Malam)
              </span>
            </div>
            <p className="text-[9.5px] text-slate-400 font-medium mt-0.5 leading-snug">
              {!hasReportToday 
                ? 'Mohon kirimkan data harian Anda sebelum berganti hari pada pukul 00:00 WIB.' 
                : 'Selamat! Data harian Anda hari ini sudah berhasil dikirim dan tersimpan.'}
            </p>
            <div className="flex items-center gap-1.5 mt-2 font-mono">
              <div className="text-center">
                <span className="text-2xl font-black text-white tracking-tighter">{hours}</span>
                <span className="block text-[7px] font-bold text-slate-500 uppercase -mt-1 font-sans">Jam</span>
              </div>
              <span className="text-lg font-black text-sky-500/50 -translate-y-1">:</span>
              <div className="text-center">
                <span className="text-2xl font-black text-white tracking-tighter">{minutes}</span>
                <span className="block text-[7px] font-bold text-slate-500 uppercase -mt-1 font-sans">Menit</span>
              </div>
              <span className="text-lg font-black text-sky-500/50 -translate-y-1">:</span>
              <div className="text-center">
                <span className="text-2xl font-black text-sky-400 tracking-tighter">{seconds}</span>
                <span className="block text-[7px] font-bold text-slate-500 uppercase -mt-1 font-sans">Detik</span>
              </div>
              <span className="text-[9px] font-bold text-slate-400 ml-2 font-sans self-center">Sisa Waktu Hari Ini</span>
            </div>
          </div>
          <div className="text-left sm:text-right shrink-0">
            <div className="text-[9px] font-black text-slate-500 uppercase mb-1">Status Hari Ini</div>
            <div className="w-24 h-2 bg-slate-900 rounded-full overflow-hidden border border-slate-800">
              <motion.div 
                initial={{ width: 0 }}
                animate={{ width: `${elapsedPercent}%` }}
                className={`h-full ${
                  !hasReportToday ? 'bg-gradient-to-r from-amber-600 to-amber-400' : 'bg-gradient-to-r from-emerald-600 to-emerald-400'
                }`}
              />
            </div>
            <span className={`text-[8px] font-bold mt-1 block ${!hasReportToday ? 'text-amber-400' : 'text-emerald-400'}`}>
              {Math.round(elapsedPercent)}% Waktu Berjalan
            </span>
          </div>
        </div>
      </GlassCard>

      {/* Header */}
      <div className="space-y-1">
        <h2 className="text-xl font-black text-white tracking-tight flex items-center gap-2">
          <div className="p-2 rounded-2xl bg-sky-500/10 text-sky-400 border border-sky-500/20">
            <CalendarClock className="w-5 h-5" />
          </div>
          <span>Data Harian</span>
        </h2>
        <p className="text-xs text-slate-400">
          Form input data harian recruiter & pelamar dengan siklus pembaruan harian.
        </p>
      </div>

      {/* Tabs */}
      <div className="flex bg-slate-900/80 p-1 rounded-2xl border border-slate-800 shrink-0 gap-1 overflow-x-auto no-scrollbar">
        <button
          type="button"
          onClick={() => setActiveTab('formulir')}
          className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 whitespace-nowrap ${
            activeTab === 'formulir' ? 'bg-sky-500 text-slate-950 shadow-md' : 'text-slate-400 hover:text-white hover:bg-white/5'
          }`}
        >
          <FileText className="w-3.5 h-3.5" />
          <span>Formulir</span>
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('minggu_ini')}
          className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 whitespace-nowrap ${
            activeTab === 'minggu_ini' ? 'bg-amber-500 text-slate-950 shadow-md' : 'text-slate-400 hover:text-white hover:bg-white/5'
          }`}
        >
          <CalendarClock className="w-3.5 h-3.5" />
          <span>Minggu Ini ({reportsMingguIni.length})</span>
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('pemeriksaan')}
          className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 whitespace-nowrap ${
            activeTab === 'pemeriksaan' ? 'bg-emerald-500 text-slate-950 shadow-md' : 'text-slate-400 hover:text-white hover:bg-white/5'
          }`}
        >
          <CheckCircle2 className="w-3.5 h-3.5" />
          <span>Pemeriksaan ({reportsPemeriksaan.length})</span>
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('arsip')}
          className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 whitespace-nowrap ${
            activeTab === 'arsip' ? 'bg-purple-500 text-slate-950 shadow-md' : 'text-slate-400 hover:text-white hover:bg-white/5'
          }`}
        >
          <Archive className="w-3.5 h-3.5" />
          <span>Arsip ({reportsArsip.length})</span>
        </button>
      </div>

      {/* Recruiter Filter for Admin/Owner */}
      {isAdminOrOwner && activeTab !== 'formulir' && (
        <div className="bg-slate-900/60 border border-slate-800/80 p-3 rounded-2xl flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 shadow-sm relative overflow-hidden">
          <div className="absolute top-0 left-0 w-1 h-full bg-sky-500" />
          <div className="flex items-center gap-2 relative z-10 pl-1.5">
            <div className="p-1.5 rounded-lg bg-sky-500/10 text-sky-400">
              <UserCheck className="w-4 h-4" />
            </div>
            <div>
              <span className="block text-[8px] font-black uppercase text-slate-500 tracking-wider">Hak Akses Admin / Owner</span>
              <span className="block text-xs font-bold text-white">Filter Data Recruiter</span>
            </div>
          </div>
          <div className="relative shrink-0 sm:w-64">
            <select
              value={selectedRecruiter}
              onChange={(e) => {
                setSelectedRecruiter(e.target.value);
                triggerHaptic('selection');
              }}
              className="w-full pl-11 pr-8 py-2 rounded-xl text-xs font-bold border border-slate-800 bg-slate-950 text-white outline-none focus:border-sky-500 cursor-pointer appearance-none"
            >
              <option value="Semua">Semua Recruiter ({recruitersList.length})</option>
              {recruitersList.map((rec) => (
                <option key={rec.key} value={rec.key}>
                  {rec.name} ({rec.username})
                </option>
              ))}
            </select>
            <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2.5 text-slate-400">
              <ChevronDown className="w-3.5 h-3.5" />
            </div>
            <div className="absolute left-2.5 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full bg-slate-900 overflow-hidden border border-slate-800">
              {(() => {
                if (selectedRecruiter === 'Semua') {
                  return (
                    <div className="w-full h-full flex items-center justify-center text-[10px] font-black text-slate-500 bg-slate-900">
                      <Users className="w-3 h-3 text-sky-400" />
                    </div>
                  );
                }
                const recObj = recruitersList.find(r => r.key === selectedRecruiter);
                const matched = (recObj?.telegramId ? userPhotoMap.get(recObj.telegramId) : undefined) ||
                                (recObj?.cleanUsername ? userPhotoMap.get(recObj.cleanUsername) : undefined) ||
                                userPhotoMap.get(selectedRecruiter.toLowerCase());
                if (matched?.photoUrl) {
                  return (
                    <img 
                      src={matched.photoUrl} 
                      alt="Recruiter" 
                      className="w-full h-full object-cover"
                      referrerPolicy="no-referrer"
                    />
                  );
                }
                return (
                  <div className="w-full h-full flex items-center justify-center text-[10px] font-black text-slate-400 bg-slate-900">
                    {matched?.firstName?.charAt(0).toUpperCase() || recObj?.name?.charAt(0).toUpperCase() || selectedRecruiter.charAt(0).toUpperCase()}
                  </div>
                );
              })()}
            </div>
          </div>
        </div>
      )}

      {activeTab === 'formulir' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Main Form (col-span-8 on laptop, 12 on mobile) */}
          <div className="lg:col-span-8 space-y-4">
            <GlassCard className="border-slate-800/80 shadow-sm space-y-4">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <h3 className="text-sm font-extrabold text-white flex items-center gap-2">
            <FileText className="w-4 h-4 text-sky-400" />
            <span>Form Data Harian</span>
          </h3>

          <span className="text-[10px] text-sky-400 font-bold bg-sky-500/10 px-2.5 py-0.5 rounded-full border border-sky-500/20 flex items-center gap-1">
            <Sparkles className="w-3 h-3" /> Auto Sync
          </span>
        </div>

        {/* Step Navigation Tabs */}
        <div className="flex items-center p-1 bg-slate-950/80 rounded-2xl border border-slate-900/60 shadow-inner gap-1.5">
          <button
            type="button"
            onClick={() => {
              setError(null);
              setFormStep('upload');
              triggerHaptic('selection');
            }}
            className={`flex-1 py-1.5 px-2.5 rounded-xl text-[10px] sm:text-xs font-black uppercase transition-all flex items-center justify-center gap-1.5 border ${
              formStep === 'upload'
                ? 'bg-sky-500 text-slate-950 border-sky-400 shadow-sm'
                : 'bg-transparent text-slate-400 border-transparent hover:text-white'
            }`}
          >
            <Video className="w-3.5 h-3.5" />
            1. Upload Video / Bukti {formData.videoUrl ? '✅' : '⚠️'}
          </button>

          <ArrowRight className="w-3 h-3 text-slate-600 shrink-0" />

          <button
            type="button"
            onClick={() => {
              if (!formData.videoUrl) {
                setError('Bukti Foto / Video pelamar wajib diupload terlebih dahulu.');
                showAlert('warning', 'Upload Video / Bukti Dulu ⚠️', 'Harap upload video atau foto bukti pelamar terlebih dahulu!');
                setFormStep('upload');
                return;
              }
              setError(null);
              setFormStep('data');
              triggerHaptic('selection');
            }}
            className={`flex-1 py-1.5 px-2.5 rounded-xl text-[10px] sm:text-xs font-black uppercase transition-all flex items-center justify-center gap-1.5 border ${
              formStep === 'data'
                ? 'bg-sky-500 text-slate-950 border-sky-400 shadow-sm'
                : 'bg-transparent text-slate-400 border-transparent hover:text-white'
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            2. Input Data Pelamar
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* STEP 1: UPLOAD VIDEO FIRST */}
          {formStep === 'upload' && (
            <div className="space-y-4">
              {/* Metadata Bar (Tanggal, Recruiter, Status) */}
              <div className="grid grid-cols-3 gap-2 text-[10px] sm:text-xs text-slate-400 bg-slate-950/60 p-3 rounded-2xl border border-slate-900/80">
                <div className="flex flex-col gap-0.5">
                  <span className="text-slate-500 font-bold uppercase text-[8px] tracking-wider">Tanggal</span>
                  <span className="text-sky-300 font-black">{formData.date}</span>
                </div>
                <div className="flex flex-col gap-0.5 border-l border-slate-800/60 pl-2">
                  <span className="text-slate-500 font-bold uppercase text-[8px] tracking-wider">Recruiter</span>
                  <span className="text-sky-300 font-black truncate">{formData.recruiterUsername}</span>
                </div>
                <div className="flex flex-col gap-0.5 border-l border-slate-800/60 pl-2">
                  <span className="text-slate-500 font-bold uppercase text-[8px] tracking-wider">Status Default</span>
                  <span className="text-amber-400 font-black flex items-center gap-0.5">
                    <Lock className="w-2.5 h-2.5 shrink-0" /> Pending
                  </span>
                </div>
              </div>

              {/* Upload Video / Foto Bukti FIRST */}
              <div className="p-4 rounded-2xl border border-slate-800 bg-slate-950/40 space-y-3">
                <label className="text-xs font-black tracking-wider text-slate-400 uppercase flex items-center gap-1.5">
                  <span>📹</span>
                  <span>Bukti Foto / Video Pelamar</span>
                  <span className="text-[9px] bg-rose-500/20 text-rose-300 px-2.5 py-0.5 rounded-full font-black border border-rose-500/30 uppercase tracking-widest ml-auto">WAJIB UPLOAD DULU</span>
                </label>
                
                <div className="flex flex-col sm:flex-row items-center gap-4">
                  <div className="w-full sm:w-1/2">
                    <input
                      type="file"
                      accept="image/*,video/*"
                      id="bukti-video-input"
                      onChange={async (e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          try {
                            const dataUrl = await compressMediaFile(file);
                            setFormData((prev) => ({ ...prev, videoUrl: dataUrl }));
                            setError(null);
                            showAlert('success', 'Bukti Diupload ✅', 'Foto/Video bukti pelamar berhasil diproses dan disimpan!');
                          } catch (err: any) {
                            console.error('Error processing media file:', err);
                            showAlert('error', 'Gagal Memproses File', err.message || 'Gagal memproses file foto/video.');
                          }
                        }
                      }}
                      className="hidden"
                    />
                    <label
                      htmlFor="bukti-video-input"
                      className="flex flex-col items-center justify-center border-2 border-dashed border-slate-800 hover:border-sky-500/50 bg-slate-900/60 hover:bg-slate-900/90 rounded-2xl p-5 text-center cursor-pointer transition-all group w-full"
                    >
                      <span className="text-2xl mb-1.5 group-hover:scale-110 transition-transform duration-200">📹</span>
                      <span className="text-xs font-bold text-slate-200">Pilih / Seret Video atau Foto</span>
                      <span className="text-[10px] text-slate-500 font-medium mt-0.5">Format video (mp4) atau foto (jpg, png)</span>
                    </label>
                  </div>

                  <div className="w-full sm:w-1/2">
                    {formData.videoUrl ? (
                      <div className="relative rounded-2xl overflow-hidden border border-slate-800 bg-black aspect-video flex items-center justify-center shadow-inner group">
                        {formData.videoUrl.startsWith('data:image/') || formData.videoUrl.match(/\.(jpeg|jpg|png|webp|gif)($|\?)/i) ? (
                          <img 
                            src={formData.videoUrl} 
                            alt="Bukti Pelamar" 
                            className="w-full h-full object-contain"
                          />
                        ) : (
                          <video
                            src={formData.videoUrl}
                            controls
                            className="w-full h-full object-contain"
                          />
                        )}
                        <button
                          type="button"
                          onClick={() => {
                            setFormData({ ...formData, videoUrl: undefined });
                            showAlert('warning', 'Bukti Dihapus', 'File bukti video/foto telah dihapus.');
                          }}
                          className="absolute top-2 right-2 p-1.5 rounded-xl bg-rose-500 text-white hover:bg-rose-600 transition-colors shadow-md text-xs font-bold flex items-center gap-1 z-10"
                        >
                          <span>Hapus</span>
                        </button>
                      </div>
                    ) : (
                      <div className="rounded-2xl border border-dashed border-slate-800/80 bg-slate-900/20 aspect-video flex flex-col items-center justify-center text-center p-4 w-full">
                        <span className="text-xl text-slate-600 mb-1">📹</span>
                        <p className="text-xs text-slate-500 font-medium">Belum ada video/foto bukti yang dipilih.</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Continue Button */}
              <div className="flex justify-end mt-2">
                <Button
                  type="button"
                  fullWidth
                  onClick={() => {
                    if (!formData.videoUrl) {
                      setError('Bukti Foto / Video pelamar wajib diupload terlebih dahulu.');
                      showAlert('warning', 'Video / Bukti Belum Diupload ⚠️', 'Harap upload video atau foto bukti pelamar terlebih dahulu sebelum melanjutkan ke pengisian data!');
                      return;
                    }
                    setError(null);
                    setFormStep('data');
                    triggerHaptic('selection');
                  }}
                  icon={<ArrowRight className="w-3.5 h-3.5" />}
                  className="py-2.5 px-4 text-xs font-black uppercase tracking-wider"
                >
                  Lanjutkan Isi Data Pelamar
                </Button>
              </div>
            </div>
          )}

          {/* STEP 2: FILL DATA */}
          {formStep === 'data' && (
            <div className="space-y-4">
              {/* Metadata Bar (Tanggal, Recruiter, Status) */}
              <div className="grid grid-cols-3 gap-2 text-[10px] sm:text-xs text-slate-400 bg-slate-950/60 p-3 rounded-2xl border border-slate-900/80">
                <div className="flex flex-col gap-0.5">
                  <span className="text-slate-500 font-bold uppercase text-[8px] tracking-wider">Tanggal</span>
                  <span className="text-sky-300 font-black">{formData.date}</span>
                </div>
                <div className="flex flex-col gap-0.5 border-l border-slate-800/60 pl-2">
                  <span className="text-slate-500 font-bold uppercase text-[8px] tracking-wider">Recruiter</span>
                  <span className="text-sky-300 font-black truncate">{formData.recruiterUsername}</span>
                </div>
                <div className="flex flex-col gap-0.5 border-l border-slate-800/60 pl-2">
                  <span className="text-slate-500 font-bold uppercase text-[8px] tracking-wider">Status Default</span>
                  <span className="text-amber-400 font-black flex items-center gap-0.5">
                    <Lock className="w-2.5 h-2.5 shrink-0" /> Pending
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                {/* 3. Channels Custom Dropdown */}
                <div className="space-y-1.5 relative">
                  <label className="text-xs font-bold tracking-wider text-slate-400 uppercase px-1 flex items-center gap-2">
                    <Share2 className="w-3.5 h-3.5 text-indigo-400" />
                    <span>Channel / Platform</span>
                  </label>
                  
                  <div className="relative">
                    {/* Dropdown Trigger Button */}
                    <button
                      key="channel-dropdown-trigger"
                      type="button"
                      onClick={() => {
                        setIsChannelDropdownOpen(!isChannelDropdownOpen);
                        triggerHaptic('selection');
                      }}
                      className="w-full rounded-2xl py-3 px-4 text-sm font-semibold border border-slate-800 bg-slate-900/80 hover:bg-slate-800/60 text-slate-100 flex items-center justify-between transition-all duration-200 outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20"
                    >
                      <div className="flex items-center gap-2.5">
                        {formData.channel ? (
                          <>
                            <ChannelPlatformIcon id={formData.channel} className="w-4 h-4 shrink-0" />
                            <span>{CHANNELS.find(c => c.id === formData.channel)?.label || formData.channel}</span>
                          </>
                        ) : (
                          <span className="text-slate-500">Pilih Channel / Platform</span>
                        )}
                      </div>
                      <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform duration-200 ${isChannelDropdownOpen ? 'rotate-180' : ''}`} />
                    </button>

                    {/* Dropdown Options Panel */}
                    {isChannelDropdownOpen && (
                      <>
                        {/* Backdrop Click Handler to Close */}
                        <div 
                          key="channel-dropdown-backdrop"
                          className="fixed inset-0 z-40" 
                          onClick={() => setIsChannelDropdownOpen(false)} 
                        />
                        
                        {/* Options Container */}
                        <div 
                          key="channel-dropdown-options"
                          className="absolute left-0 right-0 mt-1.5 rounded-2xl border border-slate-800/90 bg-slate-950/95 backdrop-blur-xl shadow-md z-50 py-1.5 max-h-64 overflow-y-auto divide-y divide-slate-900/50"
                        >
                          {CHANNELS.map((ch) => {
                            const isSelected = formData.channel === ch.id;
                            return (
                              <button
                                key={ch.id}
                                type="button"
                                onClick={() => {
                                  setFormData({ ...formData, channel: ch.id });
                                  setIsChannelDropdownOpen(false);
                                  triggerHaptic('selection');
                                }}
                                className={`w-full text-left px-4 py-2.5 text-xs font-bold transition-all flex items-center justify-between hover:bg-slate-900 ${
                                  isSelected 
                                    ? 'text-sky-400 bg-sky-500/5' 
                                    : 'text-slate-300 hover:text-white'
                                }`}
                              >
                                <div className="flex items-center gap-2.5">
                                  <ChannelPlatformIcon id={ch.id} className="w-4 h-4 shrink-0" />
                                  <span>{ch.label}</span>
                                </div>
                                {isSelected && <Check className="w-3.5 h-3.5 text-sky-400" />}
                              </button>
                            );
                          })}
                        </div>
                      </>
                    )}
                  </div>
                </div>

                {/* 4. UID 9kucing */}
                <div className="space-y-2 bg-slate-900/50 p-4 rounded-2xl border border-slate-800">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                      <Hash className="w-4 h-4 text-amber-400" />
                      UID 9kucing
                    </span>
                    {formData.uid9Kucing && (
                      <span className="text-[10px] text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-lg border border-emerald-500/20 font-bold">
                        Terisi Otomatis
                      </span>
                    )}
                  </div>

                  <div 
                    className={`relative border-2 border-dashed rounded-xl p-4 flex flex-col items-center justify-center gap-2 transition-all duration-200 cursor-pointer min-h-[110px] ${
                      isScanningUID 
                        ? 'border-sky-500/50 bg-sky-500/5' 
                        : 'border-slate-800 hover:border-sky-500/40 bg-slate-950/40 hover:bg-slate-950/60'
                    }`}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={(e) => {
                      e.preventDefault();
                      const file = e.dataTransfer.files?.[0];
                      if (file && file.type.startsWith('image/')) {
                        handleScanScreenshot(file);
                      }
                    }}
                    onPaste={(e) => {
                      const item = e.clipboardData.items[0];
                      if (item && item.type.indexOf('image') === 0) {
                        const file = item.getAsFile();
                        if (file) handleScanScreenshot(file);
                      }
                    }}
                    onClick={() => {
                      const fileInput = document.getElementById('uid-screenshot-input');
                      fileInput?.click();
                    }}
                  >
                    <input
                      id="uid-screenshot-input"
                      type="file"
                      accept="image/*"
                      className="hidden"
                      disabled={isScanningUID}
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) handleScanScreenshot(file);
                      }}
                    />

                    {isScanningUID ? (
                      <div className="flex flex-col items-center gap-2">
                        <Loader2 className="w-8 h-8 text-sky-400 animate-spin" />
                        <span className="text-xs font-bold text-sky-300 animate-pulse">Membaca screenshot via Tesseract OCR...</span>
                        {scanProgress > 0 && (
                          <div className="w-32 bg-slate-800 h-1.5 rounded-full overflow-hidden mt-1">
                            <div 
                              className="bg-sky-400 h-full transition-all duration-300"
                              style={{ width: `${scanProgress}%` }}
                            />
                          </div>
                        )}
                        <span className="text-[10px] text-slate-500">{scanProgress > 0 ? `Proses: ${scanProgress}%` : 'Mempersiapkan OCR...'}</span>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center gap-1.5 text-center">
                        <div className="w-10 h-10 rounded-full bg-slate-900/80 flex items-center justify-center border border-slate-800">
                          <Upload className="w-5 h-5 text-slate-400" />
                        </div>
                        <div className="text-xs font-bold text-slate-200">
                          Klik / Seret / Paste Screenshot UID
                        </div>
                        <div className="text-[10px] text-slate-400 max-w-[250px]">
                          Upload screenshot profil 9Kucing pelamar. UID akan otomatis dibaca & diisi.
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="relative pt-1">
                    <Input
                      label="Atau edit manual jika diperlukan"
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      placeholder="UID akan terisi otomatis dari screenshot di atas"
                      icon={<Hash className="w-4 h-4 text-amber-400" />}
                      value={formData.uid9Kucing}
                      onChange={(e) => setFormData({ ...formData, uid9Kucing: e.target.value.replace(/\D/g, '') })}
                      required
                    />
                  </div>

                  {scanError && (
                    <div className="text-[10px] text-rose-400 flex items-center gap-1.5 px-2 bg-rose-500/5 py-1.5 rounded-lg border border-rose-500/10">
                      <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                      <span>{scanError}</span>
                    </div>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                {/* 5. WA Nomor WA Pelamar */}
                <Input
                  label="Nomor WA Pelamar"
                  type="tel"
                  placeholder="Contoh: 081234567890 / 628123..."
                  icon={<Phone className="w-4 h-4 text-emerald-400" />}
                  value={formData.applicantWhatsapp}
                  onChange={(e) => setFormData({ ...formData, applicantWhatsapp: e.target.value })}
                  required
                />

                {/* 6. Username Telegram Pelamar */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between px-1">
                    <label className="text-xs font-bold tracking-wider text-slate-400 uppercase">
                      Username Telegram Pelamar
                    </label>
                    <button
                      type="button"
                      onClick={() => {
                        setFormData(prev => ({ ...prev, applicantTelegramUsername: 'Username Tidak Ditemukan' }));
                        triggerHaptic('selection');
                      }}
                      className="text-[10px] text-amber-400 hover:text-amber-300 font-extrabold transition-all flex items-center gap-1 bg-amber-500/10 hover:bg-amber-500/20 px-2 py-0.5 rounded-lg border border-amber-500/20 shadow-sm"
                    >
                      <span>Tidak Ada Username</span>
                    </button>
                  </div>
                  <Input
                    type="text"
                    placeholder="Contoh: @username_pelamar atau t.me/..."
                    icon={<Send className="w-4 h-4 text-sky-400" />}
                    value={formData.applicantTelegramUsername}
                    onChange={(e) => {
                      const val = e.target.value;
                      // Auto detect if user pasted link or full URL
                      if (val.includes('t.me') || val.includes('telegram.me') || val.includes('http') || val.includes('tg://')) {
                        const parsed = parseTelegramUsername(val);
                        setFormData({ ...formData, applicantTelegramUsername: parsed.formatted || val });
                      } else {
                        setFormData({ ...formData, applicantTelegramUsername: val });
                      }
                    }}
                    onBlur={() => {
                      if (formData.applicantTelegramUsername) {
                        const parsed = parseTelegramUsername(formData.applicantTelegramUsername);
                        if (parsed.formatted) {
                          setFormData((prev) => ({ ...prev, applicantTelegramUsername: parsed.formatted }));
                        }
                      }
                    }}
                  />
                </div>
              </div>

              {/* Live Real Telegram Account Verification & Status Preview */}
              {(() => {
                const { clean: cleanTg, formatted: formattedTg, url: tgUrl } = parseTelegramUsername(formData.applicantTelegramUsername);
                if (!cleanTg || tgStatus.status === 'idle') return null;

                if (cleanTg === 'tidak_ada') {
                  return (
                    <motion.div
                      initial={{ opacity: 0, y: -4 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="p-3.5 rounded-2xl bg-slate-900 border border-slate-800 flex items-start gap-3 shadow-xl"
                    >
                      <div className="w-10 h-10 rounded-full bg-slate-950 border border-slate-900 flex items-center justify-center text-amber-400 shrink-0 shadow-inner">
                        <UserX className="w-5 h-5" />
                      </div>
                      <div className="space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-xs font-black text-white font-mono">Username Tidak Ditemukan</span>
                          <span className="text-[9px] bg-amber-500/10 text-amber-400 px-2.5 py-0.5 rounded-full border border-amber-500/20 font-black flex items-center gap-1 uppercase tracking-wider">
                            Bypass Verifikasi
                          </span>
                        </div>
                        <p className="text-xs text-slate-300 font-bold">
                          Pelamar dikonfirmasi tidak memiliki username / akun Telegram.
                        </p>
                        <p className="text-[10px] text-slate-400 leading-relaxed">
                          Data akan disimpan dengan keterangan <strong className="text-slate-300">"Username Tidak Ditemukan"</strong> untuk memudahkan verifikasi rekrutmen oleh Admin & Owner.
                        </p>
                      </div>
                    </motion.div>
                  );
                }

                if (tgStatus.status === 'checking') {
                  return (
                    <motion.div
                      initial={{ opacity: 0, y: -4 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="p-3.5 rounded-2xl bg-sky-950/40 border border-sky-500/30 flex items-center gap-3 shadow-md"
                    >
                      <Loader2 className="w-5 h-5 text-sky-400 animate-spin shrink-0" />
                      <div>
                        <span className="text-xs font-bold text-sky-300">Memeriksa Akun Telegram...</span>
                        <p className="text-[10px] text-slate-400 font-mono">Verifikasi keberadaan username @{cleanTg} di server Telegram</p>
                      </div>
                    </motion.div>
                  );
                }

                if (tgStatus.status === 'invalid_syntax') {
                  return (
                    <motion.div
                      initial={{ opacity: 0, y: -4 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="p-3.5 rounded-2xl bg-amber-950/70 border border-amber-500/40 flex items-start gap-3 shadow-lg"
                    >
                      <div className="w-9 h-9 rounded-full bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400 shrink-0">
                        <AlertTriangle className="w-5 h-5" />
                      </div>
                      <div className="space-y-0.5">
                        <span className="text-xs font-bold text-amber-300">Format Username Tidak Valid</span>
                        <p className="text-[11px] text-amber-200/90 font-medium">{tgStatus.message}</p>
                      </div>
                    </motion.div>
                  );
                }

                if (tgStatus.status === 'format_valid') {
                  return (
                    <motion.div
                      initial={{ opacity: 0, y: -4 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="p-3.5 rounded-2xl bg-slate-900 border border-slate-800 flex items-start justify-between gap-3 shadow-xl"
                    >
                      <div className="flex items-start gap-3">
                        <div className="w-10 h-10 rounded-full bg-slate-950 border border-slate-900 flex items-center justify-center text-slate-300 shrink-0 shadow-inner">
                          <Check className="w-5 h-5 text-sky-400" />
                        </div>
                        <div className="space-y-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-xs font-black text-white font-mono">{formattedTg}</span>
                            <span className="text-[9px] bg-slate-800 text-slate-400 px-2.5 py-0.5 rounded-full border border-slate-800 font-bold flex items-center gap-1 uppercase tracking-wider">
                              Format Valid
                            </span>
                          </div>
                          <p className="text-xs text-sky-300 font-bold">
                            ✓ Format penulisan username valid
                          </p>
                          <p className="text-[10px] text-slate-400 leading-relaxed">
                            Format username benar, namun keberadaan akun di Telegram tidak dapat divalidasi otomatis secara real-time saat ini.
                          </p>
                        </div>
                      </div>

                      <a
                        href={tgUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-750 border border-slate-800 text-slate-300 text-[11px] font-bold flex items-center gap-1 transition-all shrink-0"
                      >
                        <span>Cek Link</span>
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    </motion.div>
                  );
                }

                if (tgStatus.status === 'not_found') {
                  return (
                    <motion.div
                      initial={{ opacity: 0, y: -4 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="p-3.5 rounded-2xl bg-gradient-to-r from-rose-950/90 via-red-950/80 to-slate-900 border border-rose-500/60 flex items-start justify-between gap-3 shadow-xl"
                    >
                      <div className="flex items-start gap-3">
                        <div className="w-10 h-10 rounded-full bg-rose-500/20 border border-rose-500/50 flex items-center justify-center text-rose-400 shrink-0 shadow-inner">
                          <UserX className="w-5 h-5" />
                        </div>
                        <div className="space-y-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-xs font-black text-white font-mono">{formattedTg}</span>
                            <span className="text-[9px] bg-rose-500/30 text-rose-200 px-2.5 py-0.5 rounded-full border border-rose-500/40 font-black flex items-center gap-1 uppercase tracking-wider">
                              <XCircle className="w-2.5 h-2.5 text-rose-400" />
                              Tidak Terdaftar
                            </span>
                          </div>
                          <p className="text-xs text-rose-200 font-bold">
                            ⚠️ Username tidak ditemukan di Telegram!
                          </p>
                          <p className="text-[10px] text-slate-300">
                            Akun @{cleanTg} belum dibuat atau username salah eja. Mohon pastikan ejaan username pelamar sudah benar.
                          </p>
                        </div>
                      </div>

                      <a
                        href={tgUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-3 py-1.5 rounded-xl bg-rose-900/60 hover:bg-rose-800/80 border border-rose-500/40 text-rose-200 text-[11px] font-bold flex items-center gap-1 transition-all shrink-0"
                      >
                        <span>Cek Link</span>
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    </motion.div>
                  );
                }

                // 'exists' Status
                return (
                  <motion.div
                    initial={{ opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="p-3.5 rounded-2xl bg-gradient-to-r from-emerald-950/90 via-sky-950/80 to-slate-900 border border-emerald-500/50 flex items-center justify-between gap-3 shadow-xl"
                  >
                    <div className="flex items-center gap-3">
                      {tgStatus.photoUrl ? (
                        <div className="relative shrink-0">
                          <img
                            src={tgStatus.photoUrl}
                            alt={tgStatus.title || cleanTg}
                            referrerPolicy="no-referrer"
                            className="w-12 h-12 rounded-full object-cover border-2 border-emerald-400 shadow-lg ring-2 ring-emerald-500/20"
                            onError={(e) => {
                              // Fallback if image fails to load
                              e.currentTarget.style.display = 'none';
                            }}
                          />
                          <div className="absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full bg-emerald-500 border-2 border-slate-900 flex items-center justify-center">
                            <Check className="w-2.5 h-2.5 text-slate-950 font-black" />
                          </div>
                        </div>
                      ) : (
                        <div className="w-12 h-12 rounded-full bg-gradient-to-tr from-emerald-500 to-sky-500 flex items-center justify-center text-slate-950 shadow-md shrink-0 font-bold border-2 border-emerald-400">
                          <CheckCircle2 className="w-6 h-6" />
                        </div>
                      )}

                      <div className="space-y-0.5">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-xs font-black text-white font-mono">{formattedTg}</span>
                          <span className="text-[9px] bg-emerald-500/20 text-emerald-300 px-2 py-0.5 rounded-full border border-emerald-500/30 font-bold flex items-center gap-1">
                            <Check className="w-2.5 h-2.5 text-emerald-400" />
                            Terdaftar Aktif
                          </span>
                        </div>
                        <p className="text-[11px] font-bold text-white">
                          {tgStatus.title || formattedTg}
                        </p>
                        <p className="text-[10px] text-slate-400 font-mono">
                          Link: <span className="text-sky-300">{tgUrl}</span>
                        </p>
                      </div>
                    </div>

                    <a
                      href={tgUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-3.5 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-black flex items-center gap-1.5 transition-all shadow-md shrink-0 hover:scale-[1.03]"
                    >
                      <span>Buka Chat</span>
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  </motion.div>
                );
              })()}

              {/* 7. Grup Selection */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold tracking-wider text-slate-400 uppercase px-1 flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <Users className="w-3.5 h-3.5 text-purple-400" />
                    <span>Grup / Penempatan</span>
                  </span>
                </label>
                <select
                  value={formData.grup}
                  onChange={(e) => {
                    setFormData({ ...formData, grup: e.target.value as 'T0' | 'V0' | 'RECRUITER' | 'T3' });
                    triggerHaptic('selection');
                  }}
                  className="w-full bg-slate-900 border border-slate-800 text-slate-200 text-xs sm:text-sm rounded-xl px-3 py-2.5 focus:border-sky-500 focus:outline-none cursor-pointer font-black"
                >
                  <option value="T0" className="bg-slate-950 text-slate-200">T0-MARK</option>
                  <option value="V0" className="bg-slate-950 text-slate-200">V0</option>
                  <option value="RECRUITER" className="bg-slate-950 text-slate-200">RECRUITER</option>
                  {isAdminOrOwner && <option value="T3" className="bg-slate-950 text-slate-200">T0-MARK (Dipromosikan)</option>}
                </select>
              </div>

              {/* Catatan Tambahan */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold tracking-wider text-slate-400 uppercase px-1 flex items-center gap-1.5">
                  <MessageSquare className="w-3.5 h-3.5 text-slate-400" />
                  <span>Catatan / Keterangan</span>
                </label>
                <textarea
                  rows={2}
                  placeholder="Catatan pelamar atau kendala (opsional)..."
                  value={formData.note}
                  onChange={(e) => setFormData({ ...formData, note: e.target.value })}
                  className="w-full rounded-2xl py-2 px-4 text-xs font-medium outline-none border border-slate-800 bg-slate-900/80 focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20 text-white transition-all placeholder:text-slate-500"
                />
              </div>

              <div className="flex gap-2.5 pt-2">
                <Button
                  type="button"
                  variant="secondary"
                  fullWidth
                  onClick={() => {
                    setFormStep('upload');
                    triggerHaptic('selection');
                  }}
                  icon={<ChevronLeft className="w-3.5 h-3.5" />}
                  className="py-2.5 px-3.5 text-xs font-black uppercase tracking-wider"
                >
                  Kembali ke Video
                </Button>

                <Button
                  type="submit"
                  fullWidth
                  isLoading={isLoading || isCheckingDuplicate}
                  icon={<Sparkles className="w-3.5 h-3.5" />}
                  className="py-2.5 px-3.5 text-xs font-black uppercase tracking-wider"
                >
                  Simpan Data
                </Button>
              </div>
            </div>
          )}
        </form>
      </GlassCard>
          </div>

          {/* Sidebar / Live Summary & Guidelines (col-span-4 on laptop, 12 on mobile) */}
          <div className="lg:col-span-4 space-y-4">
            {/* OCR Instructions Widget */}
            <GlassCard className="border-slate-800/80 p-4 space-y-3 relative overflow-hidden">
              <div className="absolute top-0 right-0 w-24 h-24 bg-amber-500/5 rounded-full blur-xl pointer-events-none" />
              
              <div className="flex items-center gap-2 border-b border-slate-800 pb-2.5">
                <div className="p-1.5 rounded-lg bg-amber-500/10 text-amber-400">
                  <HelpCircle className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-xs font-black text-white uppercase tracking-wider">Panduan Scan Screenshot</h4>
                  <p className="text-[9px] text-slate-500">Tips agar pembacaan UID akurat</p>
                </div>
              </div>

              <ul className="space-y-2 text-[10.5px] text-slate-400 leading-relaxed font-medium list-disc pl-4">
                <li>Gunakan screenshot berkualitas tinggi dengan tulisan yang <strong className="text-slate-200">jelas dan tidak buram</strong>.</li>
                <li>Pastikan bagian profil atau <strong className="text-amber-300 font-black">UID Pelamar (5-15 digit)</strong> terlihat sepenuhnya dalam gambar.</li>
                <li>Jika scan gagal, Anda selalu bisa mengetikkan UID secara manual pada kolom input.</li>
                <li>Gunakan fitur drag-and-drop atau paste langsung untuk mempercepat upload dari laptop Anda.</li>
              </ul>
            </GlassCard>
          </div>
        </div>
      )}

      {activeTab === 'minggu_ini' && (() => {
        const dayTabs = [
          { name: 'Semua', label: 'Semua', displayDate: '', isToday: false },
          ...weekDays.map(d => ({
            name: d.dayName,
            label: d.dayName,
            displayDate: d.displayDate,
            isToday: d.isToday
          }))
        ];

        return (
          <GlassCard className="p-4 space-y-4 border-slate-800 bg-slate-900/80">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-xl bg-amber-500/15 text-amber-400">
                  <FileSpreadsheet className="w-4 h-4" />
                </div>
                <span className="text-xs font-bold text-white uppercase tracking-wider">
                  Data Minggu Ini
                </span>
              </div>
              <span className="text-[10px] bg-slate-800 text-slate-300 px-2.5 py-0.5 rounded-full font-bold">
                {activeDayTab === 'Semua' 
                  ? `Total ${reportsMingguIni.length}` 
                  : `${filteredReportsMingguIni.length} dari ${reportsMingguIni.length}`}
              </span>
            </div>

            {/* Horizontal Scrollable Day Tabs */}
            <div className="flex gap-1.5 overflow-x-auto pb-1.5 -mx-4 px-4 scrollbar-none sm:mx-0 sm:px-0">
              {dayTabs.map((tab) => {
                const count = getReportCountForDay(tab.name);
                const isActive = activeDayTab === tab.name;
                return (
                  <button
                    key={tab.name}
                    type="button"
                    onClick={() => {
                      setActiveDayTab(tab.name as any);
                      triggerHaptic('selection');
                    }}
                    className={`relative shrink-0 flex flex-col items-center justify-center py-1.5 px-3 rounded-xl border text-center transition-all ${
                      isActive
                        ? 'bg-amber-500 text-slate-950 border-amber-400 shadow-sm shadow-amber-500/10'
                        : 'bg-slate-950/40 text-slate-400 border-slate-800/80 hover:text-white hover:bg-slate-900/50'
                    }`}
                  >
                    <div className="flex items-center gap-1">
                      <span className="text-[10px] font-black uppercase tracking-wider">{tab.label}</span>
                      {count > 0 && (
                        <span className={`text-[8px] font-extrabold px-1.5 py-0.2 rounded-full ${
                          isActive ? 'bg-slate-950/20 text-slate-950' : 'bg-amber-500/20 text-amber-300'
                        }`}>
                          {count}
                        </span>
                      )}
                    </div>
                    {tab.displayDate && (
                      <span className={`text-[8px] font-bold ${isActive ? 'text-slate-800' : 'text-slate-500'} -mt-0.5`}>
                        {tab.displayDate} {tab.isToday && '• Hari Ini'}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
            
            {filteredReportsMingguIni.length === 0 ? (
              <div className="text-center py-8 text-xs text-slate-500 font-medium">
                {activeDayTab === 'Semua' 
                  ? 'Belum ada data minggu ini.' 
                  : `Belum ada data untuk hari ${activeDayTab}.`}
              </div>
            ) : (
              <>
                <div className="space-y-2 max-h-[60vh] overflow-y-auto pr-1">
                  {paginatedReportsMingguIni.map((rep, idx) => (
                    <ReportListCard key={rep.reportId || idx} rep={rep} isAdminOrOwner={isAdminOrOwner} onUpdateStatus={updateStatus} onUpdatePermission={updatePermission} onUpdateDetails={updateDetails} userPhotoMap={userPhotoMap} />
                  ))}
                </div>
                {renderPagination(filteredReportsMingguIni.length)}
              </>
            )}
          </GlassCard>
        );
      })()}

      {activeTab === 'pemeriksaan' && (
        <GlassCard className="p-4 space-y-3 border-slate-800 bg-slate-900/80">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-800 pb-3 gap-2.5">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-xl bg-emerald-500/15 text-emerald-400">
                <CheckCircle2 className="w-4 h-4" />
              </div>
              <div>
                <span className="text-xs font-bold text-white uppercase tracking-wider block">
                  Pemeriksaan (Data Minggu Lalu)
                </span>
                <span className="text-[9px] text-slate-400 font-medium">
                  ACC = Bekerja | REJECT = Tidak Bekerja
                </span>
              </div>
            </div>

            {/* Sub-tabs: Semua, Pending, Bekerja, Tidak Bekerja */}
            <div className="flex bg-slate-950 p-1 rounded-xl border border-slate-800 gap-1 overflow-x-auto no-scrollbar shrink-0">
              <button
                type="button"
                onClick={() => {
                  setPemeriksaanFilter('semua');
                  setCurrentPage(1);
                  triggerHaptic('selection');
                }}
                className={`py-1.5 px-3 rounded-lg text-[10px] font-bold transition-all flex items-center gap-1.5 whitespace-nowrap ${
                  pemeriksaanFilter === 'semua'
                    ? 'bg-slate-800 text-white border border-slate-700 shadow-sm'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/50'
                }`}
              >
                <span>Semua ({reportsPemeriksaan.length})</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setPemeriksaanFilter('pending');
                  setCurrentPage(1);
                  triggerHaptic('selection');
                }}
                className={`py-1.5 px-3 rounded-lg text-[10px] font-bold transition-all flex items-center gap-1.5 whitespace-nowrap ${
                  pemeriksaanFilter === 'pending'
                    ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 shadow-sm'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/50'
                }`}
              >
                <span>Pending ({countPemeriksaanPending})</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setPemeriksaanFilter('bekerja');
                  setCurrentPage(1);
                  triggerHaptic('selection');
                }}
                className={`py-1.5 px-3 rounded-lg text-[10px] font-bold transition-all flex items-center gap-1.5 whitespace-nowrap ${
                  pemeriksaanFilter === 'bekerja'
                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shadow-sm'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/50'
                }`}
              >
                <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                <span>Bekerja ({countPemeriksaanBekerja})</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setPemeriksaanFilter('tidak_bekerja');
                  setCurrentPage(1);
                  triggerHaptic('selection');
                }}
                className={`py-1.5 px-3 rounded-lg text-[10px] font-bold transition-all flex items-center gap-1.5 whitespace-nowrap ${
                  pemeriksaanFilter === 'tidak_bekerja'
                    ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40 shadow-sm'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/50'
                }`}
              >
                <UserX className="w-3 h-3 text-rose-400" />
                <span>Tidak Bekerja ({countPemeriksaanTidakBekerja})</span>
              </button>
            </div>
          </div>

          {filteredReportsPemeriksaan.length === 0 ? (
            <div className="text-center py-8 text-xs text-slate-500 font-medium">
              Tidak ada data pemeriksaan untuk filter ini.
            </div>
          ) : (
            <>
              <div className="space-y-2 max-h-[60vh] overflow-y-auto pr-1">
                {paginatedReportsPemeriksaan.map((rep, idx) => (
                  <ReportListCard key={rep.reportId || idx} rep={rep} isAdminOrOwner={isAdminOrOwner} onUpdateStatus={updateStatus} onUpdatePermission={updatePermission} onUpdateDetails={updateDetails} userPhotoMap={userPhotoMap} isPemeriksaan={true} />
                ))}
              </div>
              {renderPagination(filteredReportsPemeriksaan.length)}
            </>
          )}
        </GlassCard>
      )}

      {activeTab === 'arsip' && (
        <GlassCard className="p-3.5 sm:p-4 md:p-5 space-y-3.5 border-slate-800 bg-slate-900/80">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-800/80 pb-3 gap-2">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-purple-500/15 text-purple-400 border border-purple-500/20 shrink-0">
                <Archive className="w-4 h-4 sm:w-5 sm:h-5" />
              </div>
              <div>
                <h3 className="text-xs sm:text-sm font-black text-white uppercase tracking-wider block">
                  Arsip Data Mingguan
                </h3>
                <p className="text-[10px] sm:text-xs text-purple-300/80 font-medium">
                  Pilih minggu untuk membuka daftar pelamar
                </p>
              </div>
            </div>
            <span className="text-[10px] sm:text-xs bg-purple-500/10 text-purple-300 border border-purple-500/20 px-2.5 py-1 rounded-full font-bold w-fit shrink-0">
              {reportsArsip.length} Data • {archivedWeeks.length} Minggu
            </span>
          </div>

          {archivedWeeks.length === 0 ? (
            <div className="text-center py-10 text-xs sm:text-sm text-slate-500 font-medium">Tidak ada data di arsip.</div>
          ) : (
            <div className="space-y-3">
              {archivedWeeks.map((week) => {
                const isWeekExpanded = expandedArchiveWeekKey === week.weekKey;
                const totalPages = Math.max(1, Math.ceil(week.reports.length / ITEMS_PER_PAGE));
                const startIndex = (archiveWeekPage - 1) * ITEMS_PER_PAGE;
                const paginatedWeekReports = week.reports.slice(startIndex, startIndex + ITEMS_PER_PAGE);

                return (
                  <div key={week.weekKey} className="border border-slate-800/90 bg-slate-950/70 rounded-2xl overflow-hidden transition-all duration-200 shadow-md hover:border-purple-500/30">
                    {/* Expandable Header */}
                    <button
                      type="button"
                      onClick={() => {
                        if (isWeekExpanded) {
                          setExpandedArchiveWeekKey(null);
                        } else {
                          setExpandedArchiveWeekKey(week.weekKey);
                          setArchiveWeekPage(1);
                        }
                        triggerHaptic('selection');
                      }}
                      className={`w-full p-3 sm:p-3.5 md:p-4 flex items-center justify-between text-left transition-all duration-200 gap-3 group ${
                        isWeekExpanded 
                          ? 'bg-purple-950/30 border-b border-purple-500/20' 
                          : 'bg-slate-950/40 hover:bg-slate-900/60'
                      }`}
                    >
                      <div className="flex items-center gap-3 sm:gap-4 min-w-0">
                        <div className={`w-9 h-9 sm:w-10 sm:h-10 rounded-xl flex items-center justify-center shrink-0 border transition-all duration-200 ${
                          isWeekExpanded 
                            ? 'bg-purple-500/20 border-purple-500/50 text-purple-300 shadow-lg shadow-purple-500/10' 
                            : 'bg-slate-900 border-slate-800 text-slate-400 group-hover:border-purple-500/30 group-hover:text-purple-400'
                        }`}>
                          <Archive className="w-4 h-4 sm:w-5 sm:h-5" />
                        </div>
                        <div className="flex flex-col gap-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-xs sm:text-sm font-black text-white tracking-tight">
                              Arsip Minggu
                            </span>
                            <span className="text-[10px] sm:text-xs font-bold text-purple-300 bg-purple-500/15 border border-purple-500/30 px-2.5 py-0.5 rounded-lg flex items-center gap-1.5 whitespace-nowrap shadow-sm">
                              <Timer className="w-3 h-3 text-purple-400 shrink-0" />
                              {week.rangeText}
                            </span>
                          </div>
                          <div className="flex items-center gap-2 text-[10px] sm:text-xs text-slate-400 font-medium">
                            <span>{week.reports.length} Data Pelamar</span>
                            <span className="text-slate-600">•</span>
                            <span className="text-slate-400">Periode Selesai</span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center shrink-0">
                        <span className={`text-[10px] sm:text-xs font-bold px-2.5 sm:px-3 py-1.5 rounded-xl border transition-all duration-200 flex items-center gap-1.5 ${
                          isWeekExpanded 
                            ? 'bg-purple-500/25 text-purple-200 border-purple-500/50 shadow-sm' 
                            : 'bg-slate-900/90 text-slate-300 border-slate-800 group-hover:border-slate-700 group-hover:text-white'
                        }`}>
                          <span>{isWeekExpanded ? 'Tutup' : 'Buka'}</span>
                          {isWeekExpanded ? (
                            <ChevronDown className="w-3.5 h-3.5 text-purple-300" />
                          ) : (
                            <ChevronRight className="w-3.5 h-3.5 text-slate-400 group-hover:text-white" />
                          )}
                        </span>
                      </div>
                    </button>

                    {/* Expanded Content */}
                    {isWeekExpanded && (
                      <div className="p-3 sm:p-4 md:p-5 border-t border-slate-800/80 bg-slate-900/30 space-y-3">
                        <div className="space-y-2.5 max-h-[60vh] overflow-y-auto pr-1">
                          {paginatedWeekReports.map((rep, idx) => (
                            <ReportListCard key={rep.reportId || idx} rep={rep} isAdminOrOwner={isAdminOrOwner} onUpdateStatus={updateStatus} onUpdatePermission={updatePermission} onUpdateDetails={updateDetails} userPhotoMap={userPhotoMap} isArsip={true} />
                          ))}
                        </div>

                        {/* Pagination inside week */}
                        {totalPages > 1 && (
                          <div className="flex items-center justify-between pt-3 border-t border-slate-800/60 text-[10px] sm:text-xs text-slate-400">
                            <span>Halaman {archiveWeekPage} dari {totalPages}</span>
                            <div className="flex items-center gap-1.5">
                              <button
                                type="button"
                                disabled={archiveWeekPage <= 1}
                                onClick={() => {
                                  setArchiveWeekPage(p => Math.max(1, p - 1));
                                  triggerHaptic('selection');
                                }}
                                className="p-1.5 sm:px-2.5 sm:py-1 rounded-lg bg-slate-800 text-slate-300 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-700 flex items-center gap-1 font-medium"
                              >
                                <ChevronLeft className="w-3.5 h-3.5" />
                                <span className="hidden sm:inline">Sebelumnya</span>
                              </button>
                              <button
                                type="button"
                                disabled={archiveWeekPage >= totalPages}
                                onClick={() => {
                                  setArchiveWeekPage(p => Math.min(totalPages, p + 1));
                                  triggerHaptic('selection');
                                }}
                                className="p-1.5 sm:px-2.5 sm:py-1 rounded-lg bg-slate-800 text-slate-300 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-700 flex items-center gap-1 font-medium"
                              >
                                <span className="hidden sm:inline">Berikutnya</span>
                                <ChevronRight className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </GlassCard>
      )}

      {/* Tinjau Data Modal/Overlay ("VIDEO LEBIH DULU TRUS DATA") */}
      {showReview && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-50 flex items-center justify-center p-4 overflow-y-auto">
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            className="w-full max-w-lg bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-sm space-y-5"
          >
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-sky-500/10 text-sky-400">
                  <Sparkles className="w-5 h-5 animate-pulse" />
                </div>
                <h3 className="text-base font-black text-white uppercase tracking-wider">
                  Tinjau Laporan Harian
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowReview(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors"
              >
                <XCircle className="w-5 h-5" />
              </button>
            </div>

            {/* Foto/Video Bukti Preview */}
            <div className="space-y-2">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                <span>🖼️ Bukti Foto / Video</span>
              </span>
              {formData.videoUrl ? (
                <div className="relative rounded-2xl overflow-hidden border border-slate-800/80 bg-black aspect-video max-h-48 flex items-center justify-center shadow-inner">
                  {formData.videoUrl.startsWith('data:image/') || formData.videoUrl.match(/\.(jpeg|jpg|png|webp|gif)($|\?)/i) ? (
                    <img 
                      src={formData.videoUrl} 
                      alt="Bukti Pelamar" 
                      className="w-full h-full object-contain"
                    />
                  ) : (
                    <video
                      src={formData.videoUrl}
                      controls
                      className="w-full h-full object-contain"
                    />
                  )}
                </div>
              ) : (
                <div className="rounded-2xl border border-dashed border-slate-800 bg-slate-950/40 p-4 text-center text-xs text-slate-500">
                  Tidak ada bukti foto / video yang dilampirkan.
                </div>
              )}
            </div>

            {/* Text Data Second ("TRUS DATA") */}
            <div className="space-y-3 bg-slate-950/60 p-4.5 rounded-2xl border border-slate-900/80 text-xs sm:text-sm font-mono text-slate-300">
              <div className="flex justify-between py-1 border-b border-slate-900/50">
                <span className="text-slate-500 font-bold">UID :</span>
                <span className="text-amber-400 font-bold">{formData.uid9Kucing}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-900/50">
                <span className="text-slate-500 font-bold">WA :</span>
                <span className="text-emerald-400 font-bold">{formData.applicantWhatsapp}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-900/50">
                <span className="text-slate-500 font-bold">Username Telegram :</span>
                <span className="text-sky-400 font-bold">
                  {formData.applicantTelegramUsername ? `@${formData.applicantTelegramUsername.replace(/^@/, '')}` : '-'}
                </span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-900/50">
                <span className="text-slate-500 font-bold">Rekomendasi dari :</span>
                <span className="text-purple-400 font-bold">@{autoRecruiterUsername.replace(/^@/, '')}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-900/50">
                <span className="text-slate-500 font-bold">Info dari sosmed :</span>
                <span className="text-pink-400 font-bold">{formData.channel || '-'}</span>
              </div>
              <div className="flex justify-between items-center py-1 pt-1.5">
                <span className="text-slate-500 font-bold">Grub :</span>
                <div className="flex items-center gap-1.5">
                  <span className="text-indigo-400 font-extrabold bg-indigo-500/10 px-2 py-0.5 rounded border border-indigo-500/20">
                    {formData.grup === 'T0' ? 'T0-MARK' : formData.grup === 'V0' ? 'V0' : formData.grup === 'RECRUITER' ? 'RECRUITER' : formData.grup === 'T3' ? 'T0-MARK' : (formData.grup || '-')}
                  </span>
                  {formData.grup === 'T3' && (
                    <span className="text-[9px] px-1.5 py-0.5 bg-emerald-500/10 text-emerald-400 rounded border border-emerald-500/30 font-extrabold uppercase shrink-0">
                      Dipromosikan
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Buttons */}
            <div className="flex gap-3 pt-2">
              <Button
                type="button"
                variant="secondary"
                fullWidth
                onClick={() => setShowReview(false)}
                className="rounded-2xl py-3 border-slate-800 text-slate-300 hover:text-white"
              >
                Batal &amp; Edit
              </Button>
              <Button
                type="button"
                fullWidth
                onClick={handleConfirmSubmit}
                isLoading={isSubmitting}
                icon={<Send className="w-4 h-4" />}
                className="rounded-2xl py-3 shadow-lg"
              >
                Kirim Sekarang
              </Button>
            </div>
          </motion.div>
        </div>
      )}

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
    </motion.div>
  );
};

