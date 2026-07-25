import { ApiResponse } from '../types';
import { getSystemSettings } from '../firebase/services/settingService';

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

export async function verifyTelegramInitDataApi(initData: string): Promise<ApiResponse<{
  token: string;
  telegramUser: { id: number; first_name: string; last_name?: string; username?: string; photo_url?: string };
  verified: boolean;
}>> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/auth/verify-telegram`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ initData })
    });

    const contentType = response.headers.get('content-type');
    if (!contentType || !contentType.includes('application/json')) {
      return { success: false, error: `Auth server error (${response.status}).` };
    }

    const data = await response.json();
    return data;
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Network error connecting to backend API'
    };
  }
}

export async function verifySessionApi(token: string): Promise<ApiResponse> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/auth/session-user`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      }
    });

    const contentType = response.headers.get('content-type');
    if (!contentType || !contentType.includes('application/json')) {
      return { success: false, error: `Session verification error (${response.status}).` };
    }

    const data = await response.json();
    return data;
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to verify backend session token'
    };
  }
}

export async function getGoogleSheetInfoApi(): Promise<ApiResponse<{ id: string; url: string }>> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/sheets/info`);
    
    const contentType = response.headers.get('content-type');
    if (!contentType || !contentType.includes('application/json')) {
      return { success: false, error: `Sheets service error (${response.status}).` };
    }

    const data = await response.json();
    return data;
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Gagal terhubung ke layanan Google Sheets'
    };
  }
}

export async function syncUserToSheetsApi(user: unknown): Promise<ApiResponse<{ success: boolean; spreadsheetUrl: string }>> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/sheets/sync-user`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ user })
    });

    const contentType = response.headers.get('content-type');
    if (!contentType || !contentType.includes('application/json')) {
      return { success: false, error: `Sheets sync error (${response.status}).` };
    }

    const data = await response.json();
    return data;
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Gagal mencatat data user ke Google Sheets'
    };
  }
}

export async function syncReportToSheetsApi(report: unknown): Promise<ApiResponse<{ success: boolean; spreadsheetUrl: string }>> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/sheets/sync-report`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ report })
    });

    const contentType = response.headers.get('content-type');
    if (!contentType || !contentType.includes('application/json')) {
      return { success: false, error: `Report sync error (${response.status}).` };
    }

    const data = await response.json();
    return data;
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Gagal mencatat laporan ke Google Sheets'
    };
  }
}

export async function sendReportToTelegramApi(
  report: unknown,
  videoDataUrl?: string,
  groupId?: string,
  topicId?: string,
  customText?: string
): Promise<ApiResponse> {
  const sys = await getSystemSettings();
  const token = sys?.telegramBotToken;

  // 1. Try server endpoint if API_BASE_URL is configured
  if (API_BASE_URL) {
    try {
      const response = await fetch(`${API_BASE_URL}/api/telegram/send-report`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ report, videoDataUrl, groupId, topicId, customText, botToken: token })
      });

      const contentType = response.headers.get('content-type');
      if (contentType && contentType.includes('application/json')) {
        const data = await response.json();
        if (data.success) return data;
      }
    } catch {
      // Fallback to direct Telegram API below
    }
  }

  // 2. Direct Telegram API fallback (Works on Firebase static hosting)
  try {
    const targetGroupRaw = groupId || sys?.telegramGroupId;
    const targetTopicRaw = topicId || sys?.telegramTopicReport;

    if (!token || !targetGroupRaw) {
      return { success: false, error: 'Token Bot Telegram atau Group ID belum dikonfigurasi di Pengaturan.' };
    }

    let cleanGroup = String(targetGroupRaw).trim();
    if (!cleanGroup.startsWith('-100') && !cleanGroup.startsWith('@')) {
      if (!cleanGroup.startsWith('-')) cleanGroup = '-100' + cleanGroup;
      else cleanGroup = '-100' + cleanGroup.substring(1);
    }
    const topicNum = targetTopicRaw && !isNaN(Number(targetTopicRaw)) ? Number(targetTopicRaw) : undefined;

    const messageText = customText || `📊 <b>LAPORAN HARIAN</b>\n\nData laporan telah berhasil diperbarui.`;

    if (videoDataUrl) {
      const fetchRes = await fetch(videoDataUrl);
      const blob = await fetchRes.blob();
      const formData = new FormData();
      formData.append('chat_id', cleanGroup);
      if (topicNum) formData.append('message_thread_id', String(topicNum));
      formData.append('video', blob, 'video.mp4');
      formData.append('caption', messageText);
      formData.append('parse_mode', 'HTML');

      const tgRes = await fetch(`https://api.telegram.org/bot${token}/sendVideo`, {
        method: 'POST',
        body: formData
      });
      const tgData = await tgRes.json();
      if (tgData.ok) {
        return { success: true, message: 'Laporan berhasil dikirim ke Telegram!' };
      } else {
        return { success: false, error: tgData.description || 'Gagal mengirim video laporan ke Telegram' };
      }
    } else {
      const tgRes = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: cleanGroup,
          message_thread_id: topicNum,
          text: messageText,
          parse_mode: 'HTML'
        })
      });
      const tgData = await tgRes.json();
      if (tgData.ok) {
        return { success: true, message: 'Laporan berhasil dikirim ke Telegram!' };
      } else {
        return { success: false, error: tgData.description || 'Gagal mengirim laporan ke Telegram' };
      }
    }
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Gagal mengirim laporan ke Telegram'
    };
  }
}
