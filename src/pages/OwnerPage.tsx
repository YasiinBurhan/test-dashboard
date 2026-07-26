import React, { useEffect, useState } from 'react';
import { GlassCard } from '../components/common/GlassCard';
import { StatusBadge } from '../components/common/StatusBadge';
import { formatUsername } from '../utils/format';
import { Button } from '../components/common/Button';
import { useRecruiters } from '../hooks/useRecruiters';
import { Announcement, DailyReport, SystemSettings, UserRole, UserStatus } from '../types';
import {
  getAnnouncements,
  createAnnouncement,
  deleteAnnouncement
} from '../firebase/services/announcementService';
import {
  getSystemSettings,
  updateSystemSettings
} from '../firebase/services/settingService';
import { subscribeToAllReports } from '../firebase/services/reportService';
import { Key, Megaphone, Settings, Users, ShieldAlert, Plus, Trash2, CheckCircle2, BarChart2, Bot, Globe, XCircle, AlertTriangle, Send, FileSpreadsheet, Copy, Download, Calendar, Filter, Check, Database, Eye, RefreshCw, AlertCircle } from 'lucide-react';
import { doc, getDoc, deleteDoc, updateDoc, deleteField, collection, getDocs, limit, query } from 'firebase/firestore';
import { db } from '../firebase/config';

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

const formatDateDDMMYYYY = (dateString?: string) => {
  if (!dateString) return '-';
  const clean = dateString.split('T')[0];
  const parts = clean.split('-');
  if (parts.length === 3 && parts[0].length === 4) {
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
  }
  return dateString;
};

export const OwnerPage: React.FC = () => {
  const { users, changeStatus, changeRole, refetch: refetchUsers } = useRecruiters();

  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [settings, setSettings] = useState<SystemSettings | null>(null);

  // Announcement Form State
  const [annTitle, setAnnTitle] = useState('');
  const [annContent, setAnnContent] = useState('');
  const [annPinned, setAnnPinned] = useState(false);
  const [isSubmittingAnn, setIsSubmittingAnn] = useState(false);

  // Settings State
  const [isSavingSettings, setIsSavingSettings] = useState(false);
  const [settingsSuccess, setSettingsSuccess] = useState<string | null>(null);
  const [isSettingWebhook, setIsSettingWebhook] = useState(false);
  const [webhookStatus, setWebhookStatus] = useState<string | null>(null);
  const [botInfo, setBotInfo] = useState<{ first_name: string; username: string } | null>(null);
  const [isTestingTelegram, setIsTestingTelegram] = useState(false);
  const [testTelegramStatus, setTestTelegramStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const handleTestSendTelegram = async () => {
    if (!settings?.telegramGroupId) {
      setTestTelegramStatus({ type: 'error', message: 'Isi Telegram Group ID terlebih dahulu!' });
      return;
    }

    setIsTestingTelegram(true);
    setTestTelegramStatus(null);

    // Try backend API first
    try {
      if (API_BASE_URL) {
        const response = await fetch(`${API_BASE_URL}/api/telegram/test-send`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            groupId: settings.telegramGroupId,
            topicId: settings.telegramTopicId,
            botToken: settings.telegramBotToken
          })
        });

        const contentType = response.headers.get('content-type');
        if (contentType && contentType.includes('application/json')) {
          const data = await response.json();
          if (data.success) {
            setTestTelegramStatus({ type: 'success', message: data.message || 'Pesan tes berhasil terkirim ke Telegram!' });
            return;
          }
        }
      }
    } catch (err) {
      console.warn('Backend API unavailable, falling back to direct Telegram API:', err);
    }

    // Direct Telegram Bot API fallback (Firebase / Serverless)
    try {
      const botToken = settings?.telegramBotToken;
      if (!botToken) {
        setTestTelegramStatus({ type: 'error', message: 'Token Bot Telegram belum diisi di Pengaturan.' });
        return;
      }

      let cleanGroup = String(settings.telegramGroupId || '').trim();
      if (!cleanGroup.startsWith('-100') && !cleanGroup.startsWith('@')) {
        if (!cleanGroup.startsWith('-')) cleanGroup = '-100' + cleanGroup;
        else cleanGroup = '-100' + cleanGroup.substring(1);
      }
      const topicNum = settings.telegramTopicId && !isNaN(Number(settings.telegramTopicId)) ? Number(settings.telegramTopicId) : undefined;

      const response = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: cleanGroup,
          message_thread_id: topicNum,
          text: '🤖 <b>TES BOT TELEGRAM AZURLIZE</b>\n\nBot berhasil terhubung ke Telegram!',
          parse_mode: 'HTML'
        })
      });

      const data = await response.json();
      if (data.ok) {
        setTestTelegramStatus({ type: 'success', message: '✅ Pesan tes berhasil terkirim ke Telegram!' });
      } else {
        setTestTelegramStatus({ type: 'error', message: `❌ Gagal: ${data.description || 'Gagal mengirim pesan tes.'}` });
      }
    } catch (err) {
      setTestTelegramStatus({ type: 'error', message: err instanceof Error ? err.message : 'Error koneksi ke Telegram' });
    } finally {
      setIsTestingTelegram(false);
    }
  };

  const [activeSubTab, setActiveSubTab] = useState<'users' | 'announcements' | 'settings' | 'export' | 'database'>('users');

  // Export Spreadsheet State
  const [allReports, setAllReports] = useState<DailyReport[]>([]);
  const [exportDate, setExportDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [exportRecruiter, setExportRecruiter] = useState<string>('');
  const [exportResultFilter, setExportResultFilter] = useState<string>('all');
  const [exportGrupFilter, setExportGrupFilter] = useState<string>('all');
  const [copyStatus, setCopyStatus] = useState<string | null>(null);

  // Firestore Database Manager State
  const [dbCollection, setDbCollection] = useState('users');
  const [customCollection, setCustomCollection] = useState('');
  const [dbDocId, setDbDocId] = useState('');
  const [dbFieldName, setDbFieldName] = useState('');
  const [loadedDocData, setLoadedDocData] = useState<any>(null);
  const [dbStatus, setDbStatus] = useState<{ type: 'success' | 'error' | 'info'; message: string } | null>(null);
  const [isLoadingDb, setIsLoadingDb] = useState(false);
  const [confirmDeleteDoc, setConfirmDeleteDoc] = useState(false);
  const [confirmDeleteField, setConfirmDeleteField] = useState(false);
  const [detectedDocIds, setDetectedDocIds] = useState<string[]>([]);
  const [isFetchingDocIds, setIsFetchingDocIds] = useState(false);

  const activeCollection = dbCollection === 'custom' ? customCollection.trim() : dbCollection;

  const handleFetchDocIds = async () => {
    if (!activeCollection) {
      setDetectedDocIds([]);
      return;
    }
    setIsFetchingDocIds(true);
    try {
      const q = query(collection(db, activeCollection), limit(100));
      const querySnapshot = await getDocs(q);
      const ids = querySnapshot.docs.map(d => d.id);
      setDetectedDocIds(ids);
    } catch (err) {
      console.error('Error fetching doc ids:', err);
      setDetectedDocIds([]);
    } finally {
      setIsFetchingDocIds(false);
    }
  };

  useEffect(() => {
    if (activeSubTab === 'database' && activeCollection) {
      handleFetchDocIds();
    }
  }, [activeSubTab, activeCollection]);

  const handleLoadDocument = async () => {
    if (!activeCollection) {
      setDbStatus({ type: 'error', message: 'Nama koleksi / path tidak boleh kosong!' });
      return;
    }
    if (!dbDocId.trim()) {
      setDbStatus({ type: 'error', message: 'Document ID tidak boleh kosong!' });
      return;
    }

    setIsLoadingDb(true);
    setDbStatus(null);
    setLoadedDocData(null);
    setConfirmDeleteDoc(false);
    setConfirmDeleteField(false);

    try {
      const docRef = doc(db, activeCollection, dbDocId.trim());
      const docSnap = await getDoc(docRef);

      if (docSnap.exists()) {
        setLoadedDocData(docSnap.data());
        setDbStatus({ type: 'success', message: 'Dokumen berhasil ditemukan & dimuat dari Firestore!' });
      } else {
        setDbStatus({ type: 'error', message: 'Dokumen tidak ditemukan di Firestore!' });
      }
    } catch (err) {
      setDbStatus({ 
        type: 'error', 
        message: err instanceof Error ? err.message : 'Gagal memuat dokumen dari Firestore' 
      });
    } finally {
      setIsLoadingDb(false);
    }
  };

  const handleDeleteDocument = async () => {
    if (!activeCollection || !dbDocId.trim()) return;

    setIsLoadingDb(true);
    setDbStatus(null);

    try {
      const docRef = doc(db, activeCollection, dbDocId.trim());
      await deleteDoc(docRef);
      setDbStatus({ type: 'success', message: `Dokumen dengan ID "${dbDocId}" berhasil dihapus dari koleksi "${activeCollection}" secara permanen!` });
      setLoadedDocData(null);
      setConfirmDeleteDoc(false);
      handleFetchDocIds(); // Refresh the list of IDs
    } catch (err) {
      setDbStatus({ 
        type: 'error', 
        message: err instanceof Error ? err.message : 'Gagal menghapus dokumen' 
      });
    } finally {
      setIsLoadingDb(false);
    }
  };

  const handleDeleteField = async () => {
    if (!activeCollection || !dbDocId.trim() || !dbFieldName.trim()) {
      setDbStatus({ type: 'error', message: 'Koleksi, ID Dokumen, dan Nama Field harus diisi!' });
      return;
    }

    setIsLoadingDb(true);
    setDbStatus(null);

    try {
      const docRef = doc(db, activeCollection, dbDocId.trim());
      await updateDoc(docRef, {
        [dbFieldName.trim()]: deleteField()
      });
      setDbStatus({ 
        type: 'success', 
        message: `Field "${dbFieldName}" berhasil dihapus dari dokumen "${dbDocId}"!` 
      });
      
      // Refresh loaded document to show updated state
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        setLoadedDocData(docSnap.data());
      } else {
        setLoadedDocData(null);
      }
      setConfirmDeleteField(false);
    } catch (err) {
      setDbStatus({ 
        type: 'error', 
        message: err instanceof Error ? err.message : 'Gagal menghapus field' 
      });
    } finally {
      setIsLoadingDb(false);
    }
  };

  useEffect(() => {
    if (activeSubTab === 'export') {
      const unsubscribe = subscribeToAllReports((reports) => {
        setAllReports(reports || []);
      });
      return () => unsubscribe();
    }
  }, [activeSubTab]);

  const filteredReports = allReports.filter((r) => {
    const rDate = r.date || (r.createdAt ? r.createdAt.split('T')[0] : '');
    if (exportDate && rDate !== exportDate) return false;

    if (exportRecruiter) {
      const recruiterClean = exportRecruiter.toLowerCase().replace(/^@/, '').trim();
      const reportRecruiter = (r.recruiterUsername || r.username || '').toLowerCase().replace(/^@/, '');
      if (!reportRecruiter.includes(recruiterClean)) return false;
    }

    if (exportResultFilter !== 'all') {
      if (exportResultFilter === 'ACC' && r.result !== 'ACC') return false;
      if (exportResultFilter === 'REJECT' && r.result !== 'REJECT') return false;
      if (exportResultFilter === 'Pending' && r.result !== 'Pending') return false;
    }

    if (exportGrupFilter !== 'all' && r.grup !== exportGrupFilter) return false;

    return true;
  });

  const handleCopySpreadsheet = async () => {
    if (filteredReports.length === 0) {
      alert('Tidak ada data laporan untuk disalin.');
      return;
    }

    const headers = [
      'Tanggal',
      'Username Recruiter',
      'Recruitment channels',
      'WA Pelamar',
      'UID 9Kucing Pelamar',
      'Username Pelamar',
      'Results',
      'Grup'
    ];

    const rows = filteredReports.map((r) => [
      formatDateDDMMYYYY(r.date || (r.createdAt ? r.createdAt.split('T')[0] : '')),
      formatUsername(r.recruiterUsername || r.username),
      r.channel || '-',
      r.applicantWhatsapp || '-',
      r.uid9Kucing || '-',
      formatUsername(r.applicantTelegramUsername),
      r.result === 'ACC' ? 'YES' : (r.result === 'REJECT' ? 'NO' : (r.result || 'YES')),
      r.grup || '-'
    ]);

    const tsvText = [
      headers.join('\t'),
      ...rows.map((row) => row.join('\t'))
    ].join('\n');

    try {
      await navigator.clipboard.writeText(tsvText);
      setCopyStatus('✅ Data berhasil disalin ke Clipboard! Silakan Buka Google Sheets / Excel lalu lakukan Paste (Ctrl+V).');
      setTimeout(() => setCopyStatus(null), 5000);
    } catch (err) {
      console.error('Failed to copy to clipboard:', err);
      alert('Gagal menyalin data otomatis. Silakan gunakan tombol Download .CSV.');
    }
  };

  const handleDownloadCSV = () => {
    if (filteredReports.length === 0) {
      alert('Tidak ada data laporan untuk diunduh.');
      return;
    }

    const headers = [
      'Tanggal',
      'Username Recruiter',
      'Recruitment channels',
      'WA Pelamar',
      'UID 9Kucing Pelamar',
      'Username Pelamar',
      'Results',
      'Grup'
    ];

    const rows = filteredReports.map((r) => [
      `"${formatDateDDMMYYYY(r.date || (r.createdAt ? r.createdAt.split('T')[0] : '')).replace(/"/g, '""')}"`,
      `"${formatUsername(r.recruiterUsername || r.username).replace(/"/g, '""')}"`,
      `"${(r.channel || '-').replace(/"/g, '""')}"`,
      `"${(r.applicantWhatsapp || '-').replace(/"/g, '""')}"`,
      `"${(r.uid9Kucing || '-').replace(/"/g, '""')}"`,
      `"${formatUsername(r.applicantTelegramUsername).replace(/"/g, '""')}"`,
      `"${r.result === 'ACC' ? 'YES' : (r.result === 'REJECT' ? 'NO' : (r.result || 'YES'))}"`,
      `"${(r.grup || '-').replace(/"/g, '""')}"`
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,\uFEFF' + [
      headers.map(h => `"${h}"`).join(','),
      ...rows.map(row => row.join(','))
    ].join('\n');

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `data_harian_spreadsheet_${exportDate || 'semua'}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const fetchBotInfo = async (currentSettings?: SystemSettings | null) => {
    const activeSettings = currentSettings || settings;
    const botToken = activeSettings?.telegramBotToken;

    // Try backend API first
    try {
      if (API_BASE_URL) {
        const queryUrl = botToken 
          ? `${API_BASE_URL}/api/telegram/bot-info?token=${encodeURIComponent(botToken)}`
          : `${API_BASE_URL}/api/telegram/bot-info`;
        const response = await fetch(queryUrl);
        const contentType = response.headers.get('content-type');
        if (contentType && contentType.includes('application/json')) {
          const result = await response.json();
          if (result.success) {
            setBotInfo(result.data);
            return;
          }
        }
      }
    } catch (err) {
      console.warn('Backend API unavailable for bot info, falling back to direct Telegram API:', err);
    }

    // Direct Telegram Bot API fallback
    try {
      const botToken = activeSettings?.telegramBotToken;
      if (!botToken) return;

      const response = await fetch(`https://api.telegram.org/bot${botToken}/getMe`);
      const result = await response.json();
      if (result.ok) {
        setBotInfo(result.result);
      }
    } catch (err) {
      console.error('Error fetching bot info via Telegram API:', err);
    }
  };

  const handleSetWebhook = async () => {
    setIsSettingWebhook(true);
    setWebhookStatus(null);
    
    const botToken = settings?.telegramBotToken?.trim();
    if (!botToken) {
      setWebhookStatus('❌ Token Bot Telegram belum diisi. Silakan isi Token Bot dan klik "Simpan Pengaturan" terlebih dahulu.');
      setIsSettingWebhook(false);
      return;
    }

    const currentOrigin = window.location.origin;
    const isLocalDev = currentOrigin.includes('localhost:') || currentOrigin.includes('127.0.0.1:');
    const isFirebaseHosting = currentOrigin.includes('firebaseapp.com') || currentOrigin.includes('web.app');
    
    let defaultBaseUrl = 'https://azurlize-team-3ba4f.firebaseapp.com';
    if (API_BASE_URL) {
      defaultBaseUrl = API_BASE_URL;
    } else if (!isLocalDev && !isFirebaseHosting) {
      defaultBaseUrl = currentOrigin;
    }

    const targetBaseUrl = (settings?.webhookUrl?.trim() || defaultBaseUrl).replace(/\/$/, '');
    const fullWebhookUrl = `${targetBaseUrl}/api/telegram/webhook`;

    // Try backend API if configured
    if (API_BASE_URL) {
      try {
        const response = await fetch(`${API_BASE_URL}/api/telegram/set-webhook`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            url: targetBaseUrl,
            botToken: botToken
          })
        });
        
        const contentType = response.headers.get('content-type');
        if (contentType && contentType.includes('application/json')) {
          const result = await response.json();
          if (result.success) {
            setWebhookStatus('✅ Webhook Bot berhasil diaktifkan di Vercel!');
            setIsSettingWebhook(false);
            return;
          }
        }
      } catch (err) {
        console.warn('Backend endpoint unavailable, calling Telegram API directly:', err);
      }
    }

    // Direct Telegram API call (Works directly on Firebase without Vercel or Node backend!)
    try {
      const response = await fetch(`https://api.telegram.org/bot${botToken}/setWebhook?url=${encodeURIComponent(fullWebhookUrl)}`);
      const result = await response.json();

      if (result.ok) {
        setWebhookStatus('✅ Webhook Bot berhasil diaktifkan langsung di Telegram!');
      } else {
        setWebhookStatus(`❌ Telegram Error: ${result.description || 'Gagal mengaktifkan Webhook'}`);
      }
    } catch (err) {
      setWebhookStatus(`❌ Gagal terhubung ke Telegram API: ${err instanceof Error ? err.message : 'Koneksi error'}`);
    } finally {
      setIsSettingWebhook(false);
    }
  };

  const loadOwnerData = async () => {
    try {
      const anns = await getAnnouncements();
      setAnnouncements(anns || []);
      const sys = await getSystemSettings();
      setSettings(sys);
      if (activeSubTab === 'settings') {
        fetchBotInfo(sys);
      }
    } catch (err) {
      console.error('Error loading owner data:', err);
    }
  };

  useEffect(() => {
    loadOwnerData();
  }, [activeSubTab]);

  const handleCreateAnnouncement = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!annTitle || !annContent) return;

    setIsSubmittingAnn(true);
    try {
      await createAnnouncement(annTitle, annContent, 'Owner', annPinned);
      setAnnTitle('');
      setAnnContent('');
      setAnnPinned(false);
      await loadOwnerData();
    } catch (err) {
      alert('Gagal membuat pengumuman');
    } finally {
      setIsSubmittingAnn(false);
    }
  };

  const handleDeleteAnnouncement = async (id: string) => {
    if (!confirm('Hapus pengumuman ini?')) return;
    try {
      await deleteAnnouncement(id);
      await loadOwnerData();
    } catch (err) {
      alert('Gagal menghapus pengumuman');
    }
  };

  const handleSaveSettings = async () => {
    if (!settings) return;
    setIsSavingSettings(true);
    setSettingsSuccess(null);
    try {
      const updated = await updateSystemSettings(settings);
      setSettings(updated);
      setSettingsSuccess('Pengaturan sistem berhasil diperbarui!');
    } catch (err) {
      alert('Gagal memperbarui pengaturan');
    } finally {
      setIsSavingSettings(false);
    }
  };

  const handleRoleChange = async (telegramId: string, newRole: UserRole) => {
    try {
      await changeRole(telegramId, newRole);
      await refetchUsers();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Gagal mengubah role');
    }
  };

  const handleStatusChange = async (telegramId: string, newStatus: UserStatus) => {
    try {
      await changeStatus(telegramId, newStatus);
      await refetchUsers();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Gagal mengubah status');
    }
  };

  // Overall Statistics
  const totalUsers = users.length;
  const activeCount = users.filter((u) => u.status === 'Active').length;
  const pendingCount = users.filter((u) => u.status === 'Pending').length;
  const adminCount = users.filter((u) => u.role === 'Admin').length;

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-extrabold text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
          <Key className="w-6 h-6 text-amber-400" />
          <span>Owner Control Center</span>
        </h2>
        <p className="text-xs text-slate-600 dark:text-slate-400">
          Akses tingkat lanjut untuk mengelola Admin, Pengumuman, dan Sistem.
        </p>
      </div>

      {/* System Stats Row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-center text-xs">
        <GlassCard className="p-2.5 sm:p-3 border-amber-500/20 shadow-sm">
          <span className="text-[9px] sm:text-[10px] text-slate-500 dark:text-slate-400 font-bold uppercase block tracking-tighter sm:tracking-normal">Total Recruiter</span>
          <span className="text-base sm:text-lg font-black text-slate-900 dark:text-white">{totalUsers}</span>
        </GlassCard>
        <GlassCard className="p-2.5 sm:p-3 border-amber-500/20 shadow-sm">
          <span className="text-[9px] sm:text-[10px] text-slate-500 dark:text-slate-400 font-bold uppercase block tracking-tighter sm:tracking-normal">Aktif</span>
          <span className="text-base sm:text-lg font-black text-emerald-400">{activeCount}</span>
        </GlassCard>
        <GlassCard className="p-2.5 sm:p-3 border-amber-500/20 shadow-sm">
          <span className="text-[9px] sm:text-[10px] text-slate-500 dark:text-slate-400 font-bold uppercase block tracking-tighter sm:tracking-normal">Pending Approval</span>
          <span className="text-base sm:text-lg font-black text-amber-400">{pendingCount}</span>
        </GlassCard>
        <GlassCard className="p-2.5 sm:p-3 border-amber-500/20 shadow-sm">
          <span className="text-[9px] sm:text-[10px] text-slate-500 dark:text-slate-400 font-bold uppercase block tracking-tighter sm:tracking-normal">Jumlah Admin</span>
          <span className="text-base sm:text-lg font-black text-indigo-400">{adminCount}</span>
        </GlassCard>
      </div>

      {/* Sub Tabs */}
      <div className="flex items-center gap-1.5 bg-slate-50 dark:bg-slate-900/80 p-1.5 rounded-2xl border border-slate-200 dark:border-slate-800 text-[10px] sm:text-xs overflow-x-auto no-scrollbar shrink-0">
        <button
          onClick={() => setActiveSubTab('users')}
          className={`shrink-0 flex-1 min-w-[90px] py-2 rounded-xl font-black transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
            activeSubTab === 'users' ? 'bg-amber-500 text-slate-950 shadow-md scale-[1.02]' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:text-white'
          }`}
        >
          <Users className="w-3.5 h-3.5 sm:w-4 sm:h-4" /> Kelola Role
        </button>
        <button
          onClick={() => setActiveSubTab('announcements')}
          className={`shrink-0 flex-1 min-w-[100px] py-2 rounded-xl font-black transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
            activeSubTab === 'announcements' ? 'bg-amber-500 text-slate-950 shadow-md scale-[1.02]' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:text-white'
          }`}
        >
          <Megaphone className="w-3.5 h-3.5 sm:w-4 sm:h-4" /> Pengumuman
        </button>
        <button
          onClick={() => setActiveSubTab('export')}
          className={`shrink-0 flex-1 min-w-[110px] py-2 rounded-xl font-black transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
            activeSubTab === 'export' ? 'bg-amber-500 text-slate-950 shadow-md scale-[1.02]' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:text-white'
          }`}
        >
          <FileSpreadsheet className="w-3.5 h-3.5 sm:w-4 sm:h-4" /> Export Data
        </button>
        <button
          onClick={() => setActiveSubTab('settings')}
          className={`shrink-0 flex-1 min-w-[100px] py-2 rounded-xl font-black transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
            activeSubTab === 'settings' ? 'bg-amber-500 text-slate-950 shadow-md scale-[1.02]' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:text-white'
          }`}
        >
          <Settings className="w-3.5 h-3.5 sm:w-4 sm:h-4" /> System Setting
        </button>
        <button
          onClick={() => setActiveSubTab('database')}
          className={`shrink-0 flex-1 min-w-[90px] py-2 rounded-xl font-black transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
            activeSubTab === 'database' ? 'bg-amber-500 text-slate-950 shadow-md scale-[1.02]' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:text-white'
          }`}
        >
          <Database className="w-3.5 h-3.5 sm:w-4 sm:h-4" /> Kelola DB
        </button>
      </div>

      {/* Sub Tab Content: Role Management */}
      {activeSubTab === 'users' && (
        <div className="space-y-3">
          <h3 className="text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider px-1">
            Daftar Pengguna & Penetapan Role Admin
          </h3>

          {users.map((u) => (
            <GlassCard key={u.telegramId} className="p-4 space-y-3 border-slate-200 dark:border-slate-800">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    <span>{u.firstName} {u.lastName}</span>
                    <StatusBadge role={u.role} size="sm" />
                  </h4>
                  <span className="text-xs text-sky-400">{formatUsername(u.username)}</span>
                </div>
                <StatusBadge status={u.status} size="sm" />
              </div>

              <div className="flex flex-col gap-2 pt-2 border-t border-slate-200 dark:border-slate-800/80 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-slate-600 dark:text-slate-400 font-medium">Ubah Role Pengguna:</span>
                  <div className="flex items-center gap-1.5">
                    {(['Recruiter', 'Admin', 'Owner'] as UserRole[]).map((roleOption) => (
                      <button
                        key={roleOption}
                        disabled={u.role === roleOption}
                        onClick={() => handleRoleChange(u.telegramId, roleOption)}
                        className={`px-2.5 py-1 rounded-xl text-[11px] font-bold cursor-pointer ${
                          u.role === roleOption
                            ? 'bg-amber-500 text-slate-950'
                            : 'bg-slate-100 dark:bg-slate-800 hover:bg-slate-700 text-slate-700 dark:text-slate-300'
                        }`}
                      >
                        {roleOption}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex items-center justify-between pt-1 text-xs">
                  <span className="text-slate-600 dark:text-slate-400 font-medium">Persetujuan Status:</span>
                  <div className="flex items-center gap-1.5">
                    {u.status !== 'Active' && (
                      <button
                        onClick={() => handleStatusChange(u.telegramId, 'Active')}
                        className="px-2 py-1 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-[10px] font-bold flex items-center gap-1 cursor-pointer transition-colors"
                      >
                        <CheckCircle2 className="w-3 h-3" /> Approve
                      </button>
                    )}
                    {u.status !== 'Rejected' && (
                      <button
                        onClick={() => handleStatusChange(u.telegramId, 'Rejected')}
                        className="px-2 py-1 rounded-xl bg-rose-600/80 hover:bg-rose-600 text-white text-[10px] font-bold flex items-center gap-1 cursor-pointer transition-colors"
                      >
                        <XCircle className="w-3 h-3" /> Reject
                      </button>
                    )}
                    {u.status !== 'Suspended' && (
                      <button
                        onClick={() => handleStatusChange(u.telegramId, 'Suspended')}
                        className="px-2 py-1 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-amber-600/80 text-amber-300 text-[10px] font-bold flex items-center gap-1 cursor-pointer transition-colors"
                      >
                        <AlertTriangle className="w-3 h-3" /> Suspend
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </GlassCard>
          ))}
        </div>
      )}

      {/* Sub Tab Content: Announcements Management */}
      {activeSubTab === 'announcements' && (
        <div className="space-y-4">
          <GlassCard className="p-4 space-y-3 border-amber-500/20">
            <h3 className="text-sm font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
              <Plus className="w-4 h-4 text-amber-400" /> Buat Pengumuman Baru
            </h3>

            <form onSubmit={handleCreateAnnouncement} className="space-y-3">
              <input
                type="text"
                placeholder="Judul Pengumuman"
                value={annTitle}
                onChange={(e) => setAnnTitle(e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700/80 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 dark:text-white outline-none focus:border-amber-500"
                required
              />

              <textarea
                rows={3}
                placeholder="Isi Pengumuman..."
                value={annContent}
                onChange={(e) => setAnnContent(e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700/80 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 dark:text-white outline-none focus:border-amber-500"
                required
              />

              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={annPinned}
                  onChange={(e) => setAnnPinned(e.target.checked)}
                  className="rounded bg-slate-50 dark:bg-slate-900 border-slate-300 dark:border-slate-700 text-amber-500"
                />
                <span className="text-xs text-slate-700 dark:text-slate-300 font-medium">Pin pengumuman di paling atas</span>
              </label>

              <Button type="submit" fullWidth isLoading={isSubmittingAnn}>
                Publikasikan Pengumuman
              </Button>
            </form>
          </GlassCard>

          <div className="space-y-2">
            <h4 className="text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider px-1">
              Daftar Pengumuman Aktif
            </h4>
            {announcements.map((a) => (
              <GlassCard key={a.id} className="p-4 space-y-2 border-slate-200 dark:border-slate-800">
                <div className="flex items-center justify-between">
                  <h5 className="text-sm font-bold text-slate-900 dark:text-white">{a.title}</h5>
                  <button
                    onClick={() => handleDeleteAnnouncement(a.id)}
                    className="text-rose-400 hover:text-rose-300 p-1 cursor-pointer"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
                <p className="text-xs text-slate-700 dark:text-slate-300 whitespace-pre-line">{a.content}</p>
              </GlassCard>
            ))}
          </div>
        </div>
      )}

      {/* Sub Tab Content: Export Spreadsheet */}
      {activeSubTab === 'export' && (
        <div className="space-y-4">
          <GlassCard className="p-4 border-amber-500/30 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-black text-amber-400 flex items-center gap-2">
                  <FileSpreadsheet className="w-5 h-5 text-amber-400" />
                  <span>Export & Salin Data Harian ke Spreadsheet</span>
                </h3>
                <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">
                  Format ini disesuaikan untuk langsung disalin (Copy) lalu ditempel (Paste/Ctrl+V) di Google Sheets atau Excel.
                </p>
              </div>
            </div>

            {/* Notification / Copy Success */}
            {copyStatus && (
              <div className="p-3 bg-emerald-500/15 border border-emerald-500/40 rounded-xl text-xs text-emerald-300 font-bold flex items-center gap-2 animate-fadeIn">
                <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>{copyStatus}</span>
              </div>
            )}

            {/* Filter Controls */}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2.5 pt-2">
              {/* Date Filter */}
              <div className="flex flex-col gap-1">
                <label className="text-[10px] font-bold text-slate-600 dark:text-slate-400 uppercase flex items-center gap-1">
                  <Calendar className="w-3 h-3 text-amber-400" /> Tanggal
                </label>
                <input
                  type="date"
                  value={exportDate}
                  onChange={(e) => setExportDate(e.target.value)}
                  className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-2 text-xs text-slate-900 dark:text-white outline-none focus:border-amber-400 font-mono"
                />
                <div className="flex items-center gap-1 mt-1 text-[10px]">
                  <button
                    type="button"
                    onClick={() => setExportDate(new Date().toISOString().split('T')[0])}
                    className="px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 hover:bg-slate-700 text-amber-400 cursor-pointer font-medium"
                  >
                    Hari Ini
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const d = new Date();
                      d.setDate(d.getDate() - 1);
                      setExportDate(d.toISOString().split('T')[0]);
                    }}
                    className="px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 hover:bg-slate-700 text-slate-700 dark:text-slate-300 cursor-pointer font-medium"
                  >
                    Kemarin
                  </button>
                  <button
                    type="button"
                    onClick={() => setExportDate('')}
                    className="px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 hover:bg-slate-700 text-slate-600 dark:text-slate-400 cursor-pointer font-medium"
                  >
                    Semua
                  </button>
                </div>
              </div>

              {/* Recruiter Filter */}
              <div className="flex flex-col gap-1">
                <label className="text-[10px] font-bold text-slate-600 dark:text-slate-400 uppercase flex items-center gap-1">
                  <Users className="w-3 h-3 text-amber-400" /> Recruiter
                </label>
                <input
                  type="text"
                  placeholder="Cari Username..."
                  value={exportRecruiter}
                  onChange={(e) => setExportRecruiter(e.target.value)}
                  className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-2 text-xs text-slate-900 dark:text-white outline-none focus:border-amber-400"
                />
              </div>

              {/* Result Filter */}
              <div className="flex flex-col gap-1">
                <label className="text-[10px] font-bold text-slate-600 dark:text-slate-400 uppercase flex items-center gap-1">
                  <Filter className="w-3 h-3 text-amber-400" /> Result Status
                </label>
                <select
                  value={exportResultFilter}
                  onChange={(e) => setExportResultFilter(e.target.value)}
                  className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-2 text-xs text-slate-900 dark:text-white outline-none focus:border-amber-400 cursor-pointer"
                >
                  <option value="all">Semua Status</option>
                  <option value="ACC">ACC (YES)</option>
                  <option value="Pending">Pending</option>
                  <option value="REJECT">REJECT (NO)</option>
                </select>
              </div>

              {/* Grup Filter */}
              <div className="flex flex-col gap-1">
                <label className="text-[10px] font-bold text-slate-600 dark:text-slate-400 uppercase flex items-center gap-1">
                  <Filter className="w-3 h-3 text-amber-400" /> Grup
                </label>
                <select
                  value={exportGrupFilter}
                  onChange={(e) => setExportGrupFilter(e.target.value)}
                  className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-2 text-xs text-slate-900 dark:text-white outline-none focus:border-amber-400 cursor-pointer"
                >
                  <option value="all">Semua Grup</option>
                  <option value="T0">T0 / T0-Mark</option>
                  <option value="V0">V0</option>
                  <option value="RECRUITER">RECRUITER</option>
                  <option value="T3">T3</option>
                </select>
              </div>
            </div>

            {/* Summary & Action Buttons */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-3 border-t border-slate-200 dark:border-slate-800/80">
              <div className="text-xs text-slate-700 dark:text-slate-300">
                Menampilkan <span className="font-extrabold text-amber-400">{filteredReports.length}</span> baris data
                {exportDate && <span> untuk tanggal <b className="text-slate-900 dark:text-white">{formatDateDDMMYYYY(exportDate)}</b></span>}
              </div>

              <div className="flex items-center gap-2 w-full sm:w-auto">
                <button
                  type="button"
                  onClick={handleCopySpreadsheet}
                  className="flex-1 sm:flex-initial px-4 py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-xl text-xs flex items-center justify-center gap-2 cursor-pointer shadow-lg transition-all"
                >
                  <Copy className="w-4 h-4" />
                  <span>Salin ke Spreadsheet (Copy)</span>
                </button>
                <button
                  type="button"
                  onClick={handleDownloadCSV}
                  className="px-3 py-2.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold rounded-xl text-xs flex items-center justify-center gap-1.5 cursor-pointer border border-slate-300 dark:border-slate-700 transition-all"
                >
                  <Download className="w-4 h-4 text-sky-400" />
                  <span>Download .CSV</span>
                </button>
              </div>
            </div>
          </GlassCard>

          {/* Table Preview */}
          <GlassCard className="p-3 border-slate-200 dark:border-slate-800 overflow-hidden space-y-3">
            <div className="flex items-center justify-between px-1">
              <h4 className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                Pratinjau Tabel (Siap Salin & Tempel)
              </h4>
              <span className="text-[10px] text-slate-500 dark:text-slate-400">
                Kolom: Tanggal | Username Recruiter | Channels | WA Pelamar | UID 9Kucing | Username Pelamar | Results | Grup
              </span>
            </div>

            {filteredReports.length === 0 ? (
              <div className="py-12 text-center text-slate-500 dark:text-slate-400 text-xs">
                Tidak ada data laporan harian yang sesuai dengan filter.
              </div>
            ) : (
              <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
                <table className="w-full text-left text-xs text-slate-700 dark:text-slate-300 font-mono">
                  <thead className="bg-slate-50 dark:bg-slate-900/90 text-[10px] uppercase font-bold text-amber-400 border-b border-slate-200 dark:border-slate-800">
                    <tr>
                      <th className="p-2.5 whitespace-nowrap">Tanggal</th>
                      <th className="p-2.5 whitespace-nowrap">Username Recruiter</th>
                      <th className="p-2.5 whitespace-nowrap">Recruitment channels</th>
                      <th className="p-2.5 whitespace-nowrap">WA Pelamar</th>
                      <th className="p-2.5 whitespace-nowrap">UID 9Kucing Pelamar</th>
                      <th className="p-2.5 whitespace-nowrap">Username Pelamar</th>
                      <th className="p-2.5 whitespace-nowrap">Results</th>
                      <th className="p-2.5 whitespace-nowrap">Grup</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 bg-white dark:bg-slate-950/40 text-[11px]">
                    {filteredReports.map((r, idx) => {
                      const formattedResult = r.result === 'ACC' ? 'YES' : (r.result === 'REJECT' ? 'NO' : (r.result || 'YES'));
                      return (
                        <tr key={r.reportId || idx} className="hover:bg-slate-50 dark:bg-slate-900/50 transition-colors">
                          <td className="p-2.5 whitespace-nowrap font-sans font-medium text-slate-700 dark:text-slate-300">
                            {formatDateDDMMYYYY(r.date || (r.createdAt ? r.createdAt.split('T')[0] : ''))}
                          </td>
                          <td className="p-2.5 whitespace-nowrap font-sans text-sky-400">
                            {formatUsername(r.recruiterUsername || r.username)}
                          </td>
                          <td className="p-2.5 whitespace-nowrap font-sans text-slate-700 dark:text-slate-300">
                            {r.channel || '-'}
                          </td>
                          <td className="p-2.5 whitespace-nowrap font-sans text-emerald-400">
                            {r.applicantWhatsapp || '-'}
                          </td>
                          <td className="p-2.5 whitespace-nowrap text-amber-300 font-bold">
                            {r.uid9Kucing || '-'}
                          </td>
                          <td className="p-2.5 whitespace-nowrap font-sans text-sky-300">
                            {formatUsername(r.applicantTelegramUsername)}
                          </td>
                          <td className="p-2.5 whitespace-nowrap font-sans font-black">
                            <span className={`px-2 py-0.5 rounded text-[10px] ${
                              formattedResult === 'YES' 
                                ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' 
                                : formattedResult === 'NO'
                                ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                                : 'bg-amber-500/20 text-amber-400'
                            }`}>
                              {formattedResult}
                            </span>
                          </td>
                          <td className="p-2.5 whitespace-nowrap font-sans font-bold text-indigo-300">
                            {r.grup || '-'}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </GlassCard>
        </div>
      )}

      {/* Sub Tab Content: System Settings */}
      {activeSubTab === 'settings' && settings && (
        <GlassCard className="p-5 space-y-4 border-amber-500/20">
          <h3 className="text-sm font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
            <Settings className="w-4 h-4 text-amber-400" /> Konfigurasi Sistem AzurLizeTeam
          </h3>

          {settingsSuccess && (
            <div className="bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs p-3 rounded-2xl flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              <span>{settingsSuccess}</span>
            </div>
          )}

          <div className="space-y-3">
            <div className="flex items-center justify-between bg-slate-50 dark:bg-slate-900/80 p-3 rounded-2xl border border-slate-200 dark:border-slate-800">
              <div>
                <span className="text-xs font-bold text-slate-900 dark:text-white block">Status Operasional Sistem</span>
                <span className="text-[11px] text-slate-600 dark:text-slate-400">Pilih status operasional portal rekrutmen</span>
              </div>
              <select
                value={settings.systemStatus}
                onChange={(e) => setSettings({ ...settings, systemStatus: e.target.value as 'Operational' | 'Maintenance' })}
                className="bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white text-xs font-bold px-3 py-1.5 rounded-xl border border-slate-300 dark:border-slate-700 outline-none"
              >
                <option value="Operational">Operational</option>
                <option value="Maintenance">Maintenance</option>
              </select>
            </div>

            <div className="flex items-center justify-between bg-slate-50 dark:bg-slate-900/80 p-3 rounded-2xl border border-slate-200 dark:border-slate-800">
              <div>
                <span className="text-xs font-bold text-slate-900 dark:text-white block">Izinkan Pendaftaran Recruiter Baru</span>
                <span className="text-[11px] text-slate-600 dark:text-slate-400">Buka / tutup pendaftaran recruiter baru</span>
              </div>
              <input
                type="checkbox"
                checked={settings.allowRegistrations}
                onChange={(e) => setSettings({ ...settings, allowRegistrations: e.target.checked })}
                className="w-5 h-5 rounded bg-slate-100 dark:bg-slate-800 border-slate-300 dark:border-slate-700 text-amber-500 cursor-pointer"
              />
            </div>

            <div className="flex flex-col gap-1.5 bg-slate-50 dark:bg-slate-900/80 p-3 rounded-2xl border border-slate-200 dark:border-slate-800">
              <label className="text-xs font-bold text-slate-900 dark:text-white">Header Banner Pengumuman Dashboard</label>
              <textarea
                rows={2}
                value={settings.announcementHeader}
                onChange={(e) => setSettings({ ...settings, announcementHeader: e.target.value })}
                className="w-full bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl p-2.5 text-xs text-slate-900 dark:text-white outline-none focus:border-amber-500"
              />
            </div>

            <div className="flex flex-col gap-1.5 bg-slate-50 dark:bg-slate-900/80 p-3 rounded-2xl border border-amber-500/30">
              <label className="text-xs font-bold text-amber-400 flex items-center justify-between">
                <span>Telegram Bot Token (Dari @BotFather)</span>
                <span className="text-[10px] text-amber-300 font-normal">Wajib diisi untuk Bot Telegram</span>
              </label>
              <input
                type="text"
                placeholder="Contoh: 1234567890:ABCdefGHIjklMNOpqrsTUVwxyZ"
                value={settings.telegramBotToken || ''}
                onChange={(e) => setSettings({ ...settings, telegramBotToken: e.target.value })}
                className="w-full bg-white dark:bg-slate-950 border border-amber-500/40 rounded-xl p-2.5 text-xs text-slate-900 dark:text-white outline-none focus:border-amber-400 font-mono"
              />
              <p className="text-[10px] text-slate-600 dark:text-slate-400">Dapatkan token dari @BotFather di Telegram lalu paste di sini.</p>
            </div>

            <div className="flex flex-col gap-1.5 bg-slate-50 dark:bg-slate-900/80 p-3 rounded-2xl border border-slate-200 dark:border-slate-800">
              <label className="text-xs font-bold text-slate-900 dark:text-white">Telegram Group ID (Tujuan Notifikasi)</label>
              <input
                type="text"
                placeholder="Contoh: -100123456789"
                value={settings.telegramGroupId || ''}
                onChange={(e) => setSettings({ ...settings, telegramGroupId: e.target.value })}
                className="w-full bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl p-2.5 text-xs text-slate-900 dark:text-white outline-none focus:border-amber-500"
              />
            </div>

            <div className="flex flex-col gap-1.5 bg-slate-50 dark:bg-slate-900/80 p-3 rounded-2xl border border-slate-200 dark:border-slate-800">
              <label className="text-xs font-bold text-slate-900 dark:text-white">Topic ID Laporan Harian (Statistik Rekrutmen)</label>
              <input
                type="text"
                placeholder="Contoh: 122"
                value={settings.telegramTopicId || ''}
                onChange={(e) => setSettings({ ...settings, telegramTopicId: e.target.value })}
                className="w-full bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl p-2.5 text-xs text-slate-900 dark:text-white outline-none focus:border-amber-500"
              />
            </div>

            <div className="flex flex-col gap-1.5 bg-slate-50 dark:bg-slate-900/80 p-3 rounded-2xl border border-slate-200 dark:border-slate-800">
              <label className="text-xs font-bold text-slate-900 dark:text-white">Topic ID Grup T0 (Tujuan Notifikasi)</label>
              <input
                type="text"
                placeholder="Contoh: 123"
                value={settings.telegramTopicT0 || ''}
                onChange={(e) => setSettings({ ...settings, telegramTopicT0: e.target.value })}
                className="w-full bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl p-2.5 text-xs text-slate-900 dark:text-white outline-none focus:border-amber-500"
              />
            </div>

            <div className="flex flex-col gap-1.5 bg-slate-50 dark:bg-slate-900/80 p-3 rounded-2xl border border-slate-200 dark:border-slate-800">
              <label className="text-xs font-bold text-slate-900 dark:text-white">Topic ID Grup V0 (Tujuan Notifikasi)</label>
              <input
                type="text"
                placeholder="Contoh: 124"
                value={settings.telegramTopicV0 || ''}
                onChange={(e) => setSettings({ ...settings, telegramTopicV0: e.target.value })}
                className="w-full bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl p-2.5 text-xs text-slate-900 dark:text-white outline-none focus:border-amber-500"
              />
            </div>

            <div className="flex flex-col gap-1.5 bg-slate-50 dark:bg-slate-900/80 p-3 rounded-2xl border border-slate-200 dark:border-slate-800">
              <label className="text-xs font-bold text-slate-900 dark:text-white">Topic ID Grup RECRUITER (Tujuan Notifikasi)</label>
              <input
                type="text"
                placeholder="Contoh: 127"
                value={settings.telegramTopicRecruiter || ''}
                onChange={(e) => setSettings({ ...settings, telegramTopicRecruiter: e.target.value })}
                className="w-full bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl p-2.5 text-xs text-slate-900 dark:text-white outline-none focus:border-amber-500"
              />
            </div>

            <div className="flex flex-col gap-1.5 bg-slate-50 dark:bg-slate-900/80 p-3 rounded-2xl border border-slate-200 dark:border-slate-800">
              <label className="text-xs font-bold text-slate-900 dark:text-white">Topic ID Grup T3 (Tujuan Notifikasi)</label>
              <input
                type="text"
                placeholder="Contoh: 125"
                value={settings.telegramTopicT3 || ''}
                onChange={(e) => setSettings({ ...settings, telegramTopicT3: e.target.value })}
                className="w-full bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl p-2.5 text-xs text-slate-900 dark:text-white outline-none focus:border-amber-500"
              />
            </div>

            <div className="flex flex-col gap-1.5 bg-slate-50 dark:bg-slate-900/80 p-3 rounded-2xl border border-slate-200 dark:border-slate-800">
              <label className="text-xs font-bold text-slate-900 dark:text-white">Topic ID Posting (Album/Gambar)</label>
              <input
                type="text"
                placeholder="Contoh: 126"
                value={settings.telegramTopicPosting || ''}
                onChange={(e) => setSettings({ ...settings, telegramTopicPosting: e.target.value })}
                className="w-full bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl p-2.5 text-xs text-slate-900 dark:text-white outline-none focus:border-amber-500"
              />
            </div>

            <div className="flex flex-col gap-1.5 bg-slate-50 dark:bg-slate-900/80 p-3 rounded-2xl border border-slate-200 dark:border-slate-800">
              <label className="text-xs font-bold text-sky-300">Webhook Base URL (Domain Hosting)</label>
              <input
                type="text"
                placeholder="https://azurlize-team-3ba4f.firebaseapp.com"
                value={settings.webhookUrl || ''}
                onChange={(e) => setSettings({ ...settings, webhookUrl: e.target.value })}
                className="w-full bg-white dark:bg-slate-950 border border-sky-500/30 rounded-xl p-2.5 text-xs text-slate-900 dark:text-white outline-none focus:border-sky-400 font-mono"
              />
              <p className="text-[10px] text-slate-500 dark:text-slate-400">Domain publik yang dipakai untuk Menerima Webhook Telegram Bot.</p>
            </div>

            <div className="flex flex-col gap-2 pt-2 border-t border-slate-200 dark:border-slate-800/80">
              <button
                type="button"
                onClick={handleTestSendTelegram}
                disabled={isTestingTelegram || !settings?.telegramGroupId}
                className="w-full py-2.5 px-4 rounded-xl bg-sky-500/20 hover:bg-sky-500/30 text-sky-300 border border-sky-500/40 text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Send className="w-3.5 h-3.5" />
                <span>{isTestingTelegram ? 'Mengirim Pesan Tes...' : '🧪 Tes Kirim Pesan Uji Coba ke Telegram'}</span>
              </button>

              {testTelegramStatus && (
                <div className={`p-3 rounded-xl border text-xs font-medium ${
                  testTelegramStatus.type === 'success' 
                    ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-300' 
                    : 'bg-rose-500/15 border-rose-500/30 text-rose-300'
                }`}>
                  {testTelegramStatus.message}
                </div>
              )}
            </div>

            <Button fullWidth isLoading={isSavingSettings} onClick={handleSaveSettings}>
              Simpan Pengaturan
            </Button>
          </div>

          {/* Webhook Configuration */}
          <div className="mt-8 pt-6 border-t border-slate-200 dark:border-slate-800/50 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Bot className="w-4 h-4 text-sky-400" />
                <h4 className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-tighter">Konfigurasi Bot Webhook</h4>
              </div>
              {botInfo && (
                <div className="flex items-center gap-2 px-2.5 py-1 rounded-lg bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                  <span className="text-[9px] font-bold text-emerald-400">{botInfo.first_name}</span>
                  <span className="text-[9px] text-slate-500 dark:text-slate-400">@{botInfo.username}</span>
                </div>
              )}
            </div>
            
            <GlassCard className="p-4 bg-white dark:bg-slate-950/50 border-slate-200 dark:border-slate-800 space-y-3">
              <p className="text-[11px] text-slate-600 dark:text-slate-400 leading-relaxed">
                Aktifkan Webhook agar Bot dapat merespon perintah <code>/id</code> atau <code>/info</code> langsung di grup Telegram untuk mendapatkan ID Chat/Topic secara otomatis.
              </p>

              <div className="flex flex-col gap-1.5">
                <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase">Webhook URL saat ini:</span>
                <div className="flex items-center gap-2 bg-slate-50 dark:bg-slate-900 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800">
                  <Globe className="w-3 h-3 text-sky-400" />
                  <span className="text-[10px] text-sky-300 font-mono truncate">{(settings?.webhookUrl || 'https://azurlize-team-3ba4f.firebaseapp.com').replace(/\/$/, '')}/api/telegram/webhook</span>
                </div>
              </div>

              {webhookStatus && (
                <div className={`text-[10px] font-bold p-2 rounded-lg ${webhookStatus.includes('✅') ? 'bg-emerald-500/10 text-emerald-400' : 'bg-rose-500/10 text-rose-400'}`}>
                  {webhookStatus}
                </div>
              )}

              <Button 
                variant="secondary" 
                fullWidth 
                onClick={handleSetWebhook}
                isLoading={isSettingWebhook}
              >
                Aktifkan Webhook Bot
              </Button>
              
              <p className="text-[9px] text-slate-500 dark:text-slate-400 italic text-center">
                *Hanya bot yang dikonfigurasi di server yang akan merespon.
              </p>
            </GlassCard>
          </div>
        </GlassCard>
      )}

      {/* Sub Tab Content: Firestore Database Manager */}
      {activeSubTab === 'database' && (
        <GlassCard className="p-5 space-y-6 border-amber-500/20">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center">
              <Database className="w-5 h-5 text-amber-400" />
            </div>
            <div>
              <h3 className="text-sm font-extrabold text-slate-900 dark:text-white">Pengelola Dokumen & Field Firestore</h3>
              <p className="text-[11px] text-slate-600 dark:text-slate-400">Inspeksi dokumen, hapus dokumen, atau hapus field tertentu dari Firestore secara aman.</p>
            </div>
          </div>

          {/* Status Alert */}
          {dbStatus && (
            <div className={`p-4 rounded-2xl border text-xs font-semibold flex items-start gap-2.5 ${
              dbStatus.type === 'success' 
                ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-300' 
                : dbStatus.type === 'error'
                ? 'bg-rose-500/15 border-rose-500/30 text-rose-300'
                : 'bg-sky-500/15 border-sky-500/30 text-sky-300'
            }`}>
              <AlertCircle className={`w-4 h-4 shrink-0 ${
                dbStatus.type === 'success' ? 'text-emerald-400' : dbStatus.type === 'error' ? 'text-rose-400' : 'text-sky-400'
              }`} />
              <div className="space-y-1">
                <span className="block font-black uppercase tracking-wider text-[10px]">
                  {dbStatus.type === 'success' ? 'Sukses' : dbStatus.type === 'error' ? 'Gagal' : 'Informasi'}
                </span>
                <p className="font-medium text-slate-200">{dbStatus.message}</p>
              </div>
            </div>
          )}

          {/* Configuration Form */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Left side - Selection Form */}
            <div className="space-y-4">
              <div className="flex flex-col gap-1.5 bg-slate-50 dark:bg-slate-900/60 p-3.5 rounded-2xl border border-slate-200 dark:border-slate-800">
                <label className="text-xs font-black text-slate-700 dark:text-slate-300 uppercase font-mono">1. Pilih Koleksi / Path</label>
                <select
                  value={dbCollection}
                  onChange={(e) => {
                    setDbCollection(e.target.value);
                    setLoadedDocData(null);
                    setDbStatus(null);
                  }}
                  className="w-full bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl p-2.5 text-xs text-slate-900 dark:text-white outline-none focus:border-amber-500 font-bold"
                >
                  <option value="users">👤 Users (user profiles & recruiter roles)</option>
                  <option value="posts">📝 Posts (job batch postings)</option>
                  <option value="laporan_harian">📊 Laporan Harian (daily recruitment reports)</option>
                  <option value="data_harian">📋 Data Harian (applicant logs)</option>
                  <option value="daily_reports">📋 Daily Reports (alternative collection)</option>
                  <option value="announcements">📢 Announcements (pengumuman)</option>
                  <option value="settings">⚙️ Settings (system configuration)</option>
                  <option value="notifications">🔔 Notifications (real-time notifications)</option>
                  <option value="custom">✍️ Path Kustom...</option>
                </select>

                {dbCollection === 'custom' && (
                  <input
                    type="text"
                    placeholder="Masukkan nama koleksi (contoh: chats)"
                    value={customCollection}
                    onChange={(e) => {
                      setCustomCollection(e.target.value);
                      setLoadedDocData(null);
                    }}
                    className="mt-2 w-full bg-white dark:bg-slate-950 border border-amber-500/40 rounded-xl p-2.5 text-xs text-slate-900 dark:text-white outline-none focus:border-amber-400 font-mono"
                  />
                )}
              </div>

              <div className="flex flex-col gap-1.5 bg-slate-50 dark:bg-slate-900/60 p-3.5 rounded-2xl border border-slate-200 dark:border-slate-800">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-black text-slate-700 dark:text-slate-300 uppercase font-mono">2. ID Dokumen (Doc ID)</label>
                  <button
                    type="button"
                    onClick={handleFetchDocIds}
                    disabled={isFetchingDocIds || !activeCollection}
                    className="text-[10px] text-amber-400 hover:text-amber-300 flex items-center gap-1 font-bold disabled:opacity-50 cursor-pointer"
                  >
                    <RefreshCw className={`w-3 h-3 ${isFetchingDocIds ? 'animate-spin' : ''}`} /> Scan ID
                  </button>
                </div>

                {/* Auto Detected Document IDs Select / Quick-Click Panel */}
                {detectedDocIds.length > 0 && (
                  <div className="mb-2 bg-white dark:bg-slate-950/60 p-2.5 rounded-xl border border-slate-900 space-y-1.5">
                    <span className="text-[9.5px] font-black text-emerald-400 uppercase font-mono block">
                      ✨ ID Terdeteksi ({detectedDocIds.length} Dokumen):
                    </span>
                    <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto no-scrollbar">
                      {detectedDocIds.map((id) => {
                        const isSelected = dbDocId === id;
                        return (
                          <button
                            key={id}
                            type="button"
                            onClick={() => {
                              setDbDocId(id);
                              setLoadedDocData(null);
                              setDbStatus(null);
                            }}
                            className={`px-2 py-0.5 rounded-lg text-[10px] font-mono transition-all border shrink-0 cursor-pointer ${
                              isSelected
                                ? 'bg-emerald-500/20 text-emerald-300 border-emerald-400 font-black'
                                : 'bg-slate-50 dark:bg-slate-900 text-slate-600 dark:text-slate-400 border-slate-850 hover:text-slate-900 dark:text-white hover:border-slate-300 dark:border-slate-700'
                            }`}
                          >
                            {id}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {isFetchingDocIds && (
                  <div className="py-2 text-[10px] text-amber-400 font-medium animate-pulse flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-ping" />
                    Memindai ID dokumen dari Firestore...
                  </div>
                )}

                {!isFetchingDocIds && detectedDocIds.length === 0 && (
                  <div className="text-[10px] text-slate-500 dark:text-slate-400 italic mb-2">
                    Koleksi kosong atau tidak dapat diakses (0 dokumen terdeteksi).
                  </div>
                )}

                <input
                  type="text"
                  placeholder="Atau ketik ID manual di sini..."
                  value={dbDocId}
                  onChange={(e) => {
                    setDbDocId(e.target.value);
                    setLoadedDocData(null);
                  }}
                  className="w-full bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl p-2.5 text-xs text-slate-900 dark:text-white outline-none focus:border-amber-500 font-mono"
                />
              </div>

              <button
                type="button"
                onClick={handleLoadDocument}
                disabled={isLoadingDb || !activeCollection || !dbDocId.trim()}
                className="w-full py-3 px-4 rounded-xl bg-indigo-500/20 hover:bg-indigo-500/30 text-indigo-300 border border-indigo-500/40 text-xs font-black transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Eye className="w-4 h-4" />
                <span>{isLoadingDb ? 'Memuat Dokumen...' : '🔍 Cari & Muat Dokumen'}</span>
              </button>
            </div>

            {/* Right side - Loaded Document Data View */}
            <div className="bg-slate-50 dark:bg-slate-900/40 border border-slate-200 dark:border-slate-800/80 rounded-2xl p-4 flex flex-col justify-between min-h-[220px]">
              <div>
                <span className="text-[10px] font-black text-slate-600 dark:text-slate-400 uppercase tracking-wider block mb-2 font-mono">
                  Pratinjau Dokumen (JSON)
                </span>

                {loadedDocData ? (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] text-emerald-400 font-black flex items-center gap-1">
                        <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                        Dokumen Ditemukan ({Object.keys(loadedDocData).length} Field)
                      </span>
                      <button
                        type="button"
                        onClick={handleLoadDocument}
                        className="text-[10px] text-indigo-400 hover:text-indigo-300 flex items-center gap-1 font-bold"
                      >
                        <RefreshCw className="w-3 h-3" /> Refresh
                      </button>
                    </div>
                    <pre className="bg-white dark:bg-slate-950 p-3 rounded-xl text-[11px] text-sky-400 overflow-x-auto border border-slate-850/80 max-h-48 font-mono no-scrollbar">
                      {JSON.stringify(loadedDocData, null, 2)}
                    </pre>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-10 text-center space-y-2">
                    <Database className="w-8 h-8 text-slate-600" />
                    <span className="text-xs font-bold text-slate-500 dark:text-slate-400">Cari dokumen untuk melihat data di sini</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Actions Section: Only shown if document is loaded or details filled */}
          {loadedDocData && (
            <div className="pt-4 border-t border-slate-200 dark:border-slate-800/80 grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Box A: Hapus Seluruh Dokumen */}
              <div className="bg-rose-950/10 border border-rose-900/30 rounded-2xl p-4 space-y-3">
                <div className="flex items-center gap-2">
                  <Trash2 className="w-4 h-4 text-rose-400" />
                  <span className="text-xs font-black text-slate-900 dark:text-white uppercase font-mono">Hapus Seluruh Dokumen</span>
                </div>
                <p className="text-[11px] text-slate-600 dark:text-slate-400 leading-relaxed">
                  Tindakan ini akan menghapus dokumen dengan ID <code>{dbDocId}</code> dari koleksi <code>{activeCollection}</code> secara permanen.
                </p>

                {!confirmDeleteDoc ? (
                  <button
                    type="button"
                    onClick={() => setConfirmDeleteDoc(true)}
                    className="w-full py-2.5 px-4 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 text-xs font-black transition-all cursor-pointer"
                  >
                    Hapus Dokumen ini
                  </button>
                ) : (
                  <div className="space-y-2">
                    <div className="p-2.5 bg-rose-500/10 border border-rose-500/20 rounded-xl flex items-start gap-2">
                      <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                      <span className="text-[10.5px] font-medium text-rose-300">
                        Apakah Anda benar-benar yakin? Tindakan ini tidak bisa dibatalkan!
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={handleDeleteDocument}
                        disabled={isLoadingDb}
                        className="flex-1 py-2 px-3 rounded-xl bg-rose-600 hover:bg-rose-700 text-slate-900 dark:text-white text-xs font-black transition-all cursor-pointer shadow-md shadow-rose-600/10"
                      >
                        {isLoadingDb ? 'Menghapus...' : 'Ya, Hapus Permanen'}
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmDeleteDoc(false)}
                        className="py-2 px-3.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-bold transition-all cursor-pointer"
                      >
                        Batal
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Box B: Hapus Field Tertentu */}
              <div className="bg-amber-950/10 border border-amber-900/30 rounded-2xl p-4 space-y-3">
                <div className="flex items-center gap-2">
                  <XCircle className="w-4 h-4 text-amber-400" />
                  <span className="text-xs font-black text-slate-900 dark:text-white uppercase font-mono">Hapus Field Spesifik</span>
                </div>
                <p className="text-[11px] text-slate-600 dark:text-slate-400 leading-relaxed">
                  Menghapus satu field atau properti saja dari dokumen ini tanpa menghapus data field lainnya.
                </p>

                <div className="space-y-3">
                  {loadedDocData && Object.keys(loadedDocData).length > 0 && (
                    <div className="space-y-1.5 bg-white dark:bg-slate-950/60 p-2.5 rounded-xl border border-slate-900">
                      <span className="text-[9.5px] font-black text-amber-400 uppercase font-mono block">
                        ✨ Pilih Field Terdeteksi (Klik untuk memilih):
                      </span>
                      <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto no-scrollbar">
                        {Object.keys(loadedDocData).map((key) => {
                          const isSelected = dbFieldName === key;
                          return (
                            <button
                              key={key}
                              type="button"
                              onClick={() => {
                                setDbFieldName(key);
                                setConfirmDeleteField(false);
                              }}
                              className={`px-2.5 py-1 rounded-lg text-[10px] font-mono transition-all border shrink-0 cursor-pointer ${
                                isSelected
                                  ? 'bg-amber-500/20 text-amber-300 border-amber-400 font-black scale-[1.02] shadow-sm shadow-amber-500/10'
                                  : 'bg-slate-50 dark:bg-slate-900 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-800 hover:text-slate-900 dark:text-white hover:border-slate-300 dark:border-slate-700'
                              }`}
                            >
                              {key}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  <div className="flex flex-col gap-1">
                    <span className="text-[9.5px] font-bold text-slate-600 dark:text-slate-400 uppercase font-mono">Nama Field (Case Sensitive):</span>
                    <input
                      type="text"
                      placeholder="Pilih di atas atau ketik manual..."
                      value={dbFieldName}
                      onChange={(e) => setDbFieldName(e.target.value)}
                      className="w-full bg-white dark:bg-slate-950 border border-slate-850 rounded-xl p-2 text-xs text-slate-900 dark:text-white outline-none focus:border-amber-400 font-mono"
                    />
                  </div>

                  {!confirmDeleteField ? (
                    <button
                      type="button"
                      onClick={() => {
                        if (!dbFieldName.trim()) {
                          setDbStatus({ type: 'error', message: 'Tulis nama field yang ingin dihapus terlebih dahulu!' });
                          return;
                        }
                        setConfirmDeleteField(true);
                      }}
                      disabled={!dbFieldName.trim()}
                      className="w-full py-2.5 px-4 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/30 text-xs font-black transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Hapus Field "{dbFieldName || '...'}"
                    </button>
                  ) : (
                    <div className="space-y-2">
                      <div className="p-2.5 bg-amber-500/10 border border-amber-500/20 rounded-xl flex items-start gap-2">
                        <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                        <span className="text-[10.5px] font-medium text-amber-300">
                          Hapus field "{dbFieldName}" dari dokumen ini? Properti ini akan hilang permanen.
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={handleDeleteField}
                          disabled={isLoadingDb}
                          className="flex-1 py-2 px-3 rounded-xl bg-amber-600 hover:bg-amber-700 text-slate-950 text-xs font-black transition-all cursor-pointer shadow-md shadow-amber-500/10"
                        >
                          {isLoadingDb ? 'Menghapus Field...' : 'Ya, Hapus Field'}
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirmDeleteField(false)}
                          className="py-2 px-3.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-bold transition-all cursor-pointer"
                        >
                          Batal
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </GlassCard>
      )}
    </div>
  );
};
