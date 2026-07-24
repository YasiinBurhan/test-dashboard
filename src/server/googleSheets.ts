import { google } from 'googleapis';

interface ApprovedUserData {
  telegramId: string;
  firstName: string;
  lastName?: string;
  username?: string;
  email: string;
  whatsapp: string;
  akun9Kucing: string;
  role: string;
  status: string;
  approvedBy?: string;
  approvedAt?: string;
}

interface ReportData {
  reportId?: string;
  telegramId: string;
  name: string;
  username?: string;
  date: string;
  visit: number;
  applicant: number;
  quality: number;
  posting: number;
  permission: number;
  note?: string;
  createdAt?: string;
}

let cachedSpreadsheetId: string | null = null;
let cachedSpreadsheetUrl: string | null = null;

async function getSheetsAuth() {
  const auth = new google.auth.GoogleAuth({
    scopes: [
      'https://www.googleapis.com/auth/spreadsheets',
      'https://www.googleapis.com/auth/drive.file'
    ]
  });
  return auth;
}

export async function getOrCreateSpreadsheet(): Promise<{ id: string; url: string }> {
  if (cachedSpreadsheetId && cachedSpreadsheetUrl) {
    return { id: cachedSpreadsheetId, url: cachedSpreadsheetUrl };
  }

  const auth = await getSheetsAuth();
  const drive = google.drive({ version: 'v3', auth });
  const sheets = google.sheets({ version: 'v4', auth });

  // 1. Check if spreadsheet already exists in Drive
  try {
    const res = await drive.files.list({
      q: "name = 'AzurLizeTeam - Data Rekrutmen & Team ACC' and mimeType = 'application/vnd.google-apps.spreadsheet' and trashed = false",
      fields: 'files(id, name, webViewLink)'
    });

    if (res.data.files && res.data.files.length > 0) {
      const file = res.data.files[0];
      cachedSpreadsheetId = file.id!;
      cachedSpreadsheetUrl = file.webViewLink || `https://docs.google.com/spreadsheets/d/${file.id}`;

      // Auto-share with ghrryuuka@gmail.com so they can find it in 'Shared with me'
      try {
        await drive.permissions.create({
          fileId: cachedSpreadsheetId,
          requestBody: {
            role: 'writer',
            type: 'user',
            emailAddress: 'ghrryuuka@gmail.com'
          }
        });
      } catch (shareErr) {
        // Silent catch for share permission errors
      }

      return { id: cachedSpreadsheetId, url: cachedSpreadsheetUrl };
    }
  } catch (err: any) {
    const errMsg = err?.message || String(err);
    if (errMsg.includes('has not been used in project') || errMsg.includes('disabled') || errMsg.includes('API has not been used')) {
      console.log('[Google Sheets] Google Drive/Sheets API is not enabled in this GCP project.');
      throw new Error('Google Sheets API belum diaktifkan atau tidak tersedia.');
    }
    console.warn('[Google Sheets] Search file notice:', errMsg);
  }

  // 2. Create a new Spreadsheet
  try {
    const created = await sheets.spreadsheets.create({
      requestBody: {
        properties: {
          title: 'AzurLizeTeam - Data Rekrutmen & Team ACC'
        },
        sheets: [
          {
            properties: {
              sheetId: 0,
              title: 'Data ACC'
            }
          },
          {
            properties: {
              sheetId: 1,
              title: 'Laporan Harian'
            }
          }
        ]
      }
    });

    const spreadsheetId = created.data.spreadsheetId!;
    const spreadsheetUrl = created.data.spreadsheetUrl || `https://docs.google.com/spreadsheets/d/${spreadsheetId}`;

    // Auto-share with ghrryuuka@gmail.com so they can find it in 'Shared with me'
    try {
      await drive.permissions.create({
        fileId: spreadsheetId,
        requestBody: {
          role: 'writer',
          type: 'user',
          emailAddress: 'ghrryuuka@gmail.com'
        }
      });
      console.log('[Google Sheets] Auto-shared new spreadsheet with ghrryuuka@gmail.com');
    } catch (shareErr) {
      console.warn('[Google Sheets] Failed to auto-share new spreadsheet:', shareErr);
    }

    // 3. Add Headers to "Data ACC"
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: 'Data ACC!A1:J1',
      valueInputOption: 'USER_ENTERED',
      requestBody: {
        values: [
          [
            'Waktu ACC',
            'Telegram ID',
            'Nama Lengkap',
            'Username Telegram',
            'Email',
            'No. WhatsApp',
            'Akun 9Kucing',
            'Role',
            'Status',
            'Approved By'
          ]
        ]
      }
    });

    // 4. Add Headers to "Laporan Harian"
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: 'Laporan Harian!A1:J1',
      valueInputOption: 'USER_ENTERED',
      requestBody: {
        values: [
          [
            'Tanggal Laporan',
            'Telegram ID',
            'Nama Recruiter',
            'Username',
            'Jumlah Visit',
            'Jumlah Pelamar',
            'Kualitas',
            'Jumlah Posting',
            'Jumlah Izin',
            'Catatan'
          ]
        ]
      }
    });

    cachedSpreadsheetId = spreadsheetId;
    cachedSpreadsheetUrl = spreadsheetUrl;

    return { id: spreadsheetId, url: spreadsheetUrl };
  } catch (err: any) {
    const errMsg = err?.message || String(err);
    if (errMsg.includes('has not been used in project') || errMsg.includes('disabled') || errMsg.includes('API has not been used')) {
      console.log('[Google Sheets] Google Drive/Sheets API is disabled in GCP project.');
    } else {
      console.warn('[Google Sheets] Create spreadsheet notice:', errMsg);
    }
    throw new Error('Google Sheets API belum diaktifkan atau tidak tersedia.');
  }
}

export async function appendApprovedUserToSheet(userData: ApprovedUserData): Promise<{ success: boolean; spreadsheetUrl?: string; error?: string }> {
  try {
    const { id: spreadsheetId, url: spreadsheetUrl } = await getOrCreateSpreadsheet();
    const auth = await getSheetsAuth();
    const sheets = google.sheets({ version: 'v4', auth });

    const nowFormatted = userData.approvedAt
      ? new Date(userData.approvedAt).toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' })
      : new Date().toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' });

    const fullName = `${userData.firstName || ''} ${userData.lastName || ''}`.trim();
    const usernameFormatted = userData.username ? `@${userData.username.replace(/^@/, '')}` : '-';

    await sheets.spreadsheets.values.append({
      spreadsheetId,
      range: 'Data ACC!A:J',
      valueInputOption: 'USER_ENTERED',
      requestBody: {
        values: [
          [
            nowFormatted,
            userData.telegramId || '-',
            fullName || '-',
            usernameFormatted,
            userData.email || '-',
            userData.whatsapp || '-',
            userData.akun9Kucing || '-',
            userData.role || 'Recruiter',
            userData.status || 'Active',
            userData.approvedBy || 'Admin'
          ]
        ]
      }
    });

    return { success: true, spreadsheetUrl };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Gagal menyimpan ke Google Sheets' };
  }
}

export async function appendReportToSheet(reportData: ReportData): Promise<{ success: boolean; spreadsheetUrl?: string; error?: string }> {
  try {
    const { id: spreadsheetId, url: spreadsheetUrl } = await getOrCreateSpreadsheet();
    const auth = await getSheetsAuth();
    const sheets = google.sheets({ version: 'v4', auth });

    const usernameFormatted = reportData.username ? `@${reportData.username.replace(/^@/, '')}` : '-';

    await sheets.spreadsheets.values.append({
      spreadsheetId,
      range: 'Laporan Harian!A:J',
      valueInputOption: 'USER_ENTERED',
      requestBody: {
        values: [
          [
            reportData.date || '-',
            reportData.telegramId || '-',
            reportData.name || '-',
            usernameFormatted,
            reportData.visit ?? 0,
            reportData.applicant ?? 0,
            reportData.quality ?? 0,
            reportData.posting ?? 0,
            reportData.permission ?? 0,
            reportData.note || '-'
          ]
        ]
      }
    });

    return { success: true, spreadsheetUrl };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Gagal menyimpan laporan ke Google Sheets' };
  }
}
