import { ApiResponse } from '../types';
import { getSystemSettings } from '../firebase/services/settingService';

const getApiBaseUrl = () => {
  if (import.meta.env.VITE_BACKEND_URL) {
    return import.meta.env.VITE_BACKEND_URL;
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
  report: any,
  videoDataUrl?: string,
  groupId?: string,
  topicId?: string,
  customText?: string
): Promise<ApiResponse> {
  const sys = await getSystemSettings();
  const token = sys?.telegramBotToken;

  // 1. Client-side direct upload for Video and GIF to bypass server JSON payload limits
  if (videoDataUrl && token) {
    try {
      const targetGroupRaw = groupId || sys?.telegramGroupId;
      const targetTopicRaw = topicId || sys?.telegramTopicReport;

      if (targetGroupRaw) {
        let cleanGroup = String(targetGroupRaw).trim();
        if (!cleanGroup.startsWith('-100') && !cleanGroup.startsWith('@')) {
          if (!cleanGroup.startsWith('-')) cleanGroup = '-100' + cleanGroup;
          else cleanGroup = '-100' + cleanGroup.substring(1);
        }
        const topicNum = targetTopicRaw && !isNaN(Number(targetTopicRaw)) ? Number(targetTopicRaw) : undefined;
        const messageText = customText || `📊 <b>LAPORAN HARIAN</b>\n\nData laporan telah berhasil diperbarui.`;

        const fetchRes = await fetch(videoDataUrl);
        const blob = await fetchRes.blob();
        
        // If > 49MB, skip direct upload so it falls back to backend for compression
        if (blob.size > 49 * 1024 * 1024) {
          throw new Error('Video is larger than 49MB, falling back to backend compression');
        }

        const isGif = blob.type.includes('gif') || videoDataUrl.startsWith('data:image/gif');
        const apiMethod = isGif ? 'sendAnimation' : 'sendVideo';
        const fileParam = isGif ? 'animation' : 'video';

        let ext = 'mp4';
        if (isGif) ext = 'gif';
        else if (blob.type.includes('quicktime') || blob.type.includes('mov')) ext = 'mov';
        else if (blob.type.includes('webm')) ext = 'webm';

        const formData = new FormData();
        formData.append('chat_id', cleanGroup);
        if (topicNum) formData.append('message_thread_id', String(topicNum));
        formData.append(fileParam, blob, `media_${Date.now()}.${ext}`);
        formData.append('caption', messageText);
        formData.append('parse_mode', 'HTML');

        const tgRes = await fetch(`https://api.telegram.org/bot${token}/${apiMethod}`, {
          method: 'POST',
          body: formData
        });
        const tgData = await tgRes.json();

        // Fallback without topic/thread if thread error occurs
        if (!tgData.ok && topicNum && tgData.description && (
          tgData.description.toLowerCase().includes('thread') ||
          tgData.description.toLowerCase().includes('topic') ||
          tgData.description.toLowerCase().includes('message_thread_id')
        )) {
          console.warn(`[Direct Telegram] ${apiMethod} thread error, retrying without message_thread_id:`, tgData.description);
          formData.delete('message_thread_id');
          const retryRes = await fetch(`https://api.telegram.org/bot${token}/${apiMethod}`, {
            method: 'POST',
            body: formData
          });
          const retryData = await retryRes.json();
          if (retryData.ok) {
            return { success: true, message: 'Laporan dan media berhasil dikirim ke Telegram!' };
          }
        }

        if (tgData.ok) {
          return { success: true, message: 'Laporan dan media berhasil dikirim ke Telegram!' };
        } else {
          console.warn(`[Direct Telegram] Direct ${apiMethod} failed, falling back to server API:`, tgData.description);
        }
      }
    } catch (directErr) {
      console.warn('[Direct Telegram] Error in direct upload, falling back to server API:', directErr);
    }
  }

  // 2. Try server endpoint if API_BASE_URL is configured
  if (API_BASE_URL !== undefined) {
    try {
      let finalVideoDataUrlForServer = videoDataUrl;
      
      // If we are falling back to the server and the video is a blob URL, we must convert it to base64
      // so it can be transmitted in the JSON payload body.
      if (videoDataUrl && videoDataUrl.startsWith('blob:')) {
        try {
          const blob = await (await fetch(videoDataUrl)).blob();
          finalVideoDataUrlForServer = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => resolve(e.target?.result as string);
            reader.onerror = (err) => reject(err);
            reader.readAsDataURL(blob);
          });
        } catch (convErr) {
          console.error('Failed to convert blob to base64 for server upload:', convErr);
        }
      }

      const response = await fetch(`${API_BASE_URL}/api/telegram/send-report`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ 
          report, 
          videoDataUrl: finalVideoDataUrlForServer, 
          groupId, 
          topicId, 
          customText, 
          botToken: token 
        })
      });

      const contentType = response.headers.get('content-type');
      if (contentType && contentType.includes('application/json')) {
        const data = await response.json();
        if (data.success) return data;
      }
    } catch (serverErr) {
      console.warn('[Server API] Server report submission failed, trying direct text fallback:', serverErr);
    }
  }

  // 3. Direct Telegram API text-only fallback (Works on Firebase static hosting as a last resort)
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
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Gagal mengirim laporan ke Telegram'
    };
  }
}
