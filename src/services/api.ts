import { ApiResponse } from '../types';

const API_BASE_URL = import.meta.env.VITE_BACKEND_URL || '';

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
  try {
    const response = await fetch(`${API_BASE_URL}/api/telegram/send-report`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ report, videoDataUrl, groupId, topicId, customText })
    });

    const contentType = response.headers.get('content-type');
    if (!contentType || !contentType.includes('application/json')) {
      if (response.status === 413) {
        return { success: false, error: 'Ukuran video/data terlalu besar (Maksimal 4.5MB). Mohon gunakan video yang lebih pendek atau resolusi lebih rendah.' };
      }
      return { success: false, error: `Server error (${response.status}). Mohon coba lagi nanti.` };
    }

    const data = await response.json();
    return data;
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Gagal mengirim laporan ke Telegram'
    };
  }
}
