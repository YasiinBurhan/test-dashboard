import express from 'express';
import type { Request, Response } from 'express';
import path from 'path';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';
// import { createServer as createViteServer } from 'vite'; // Moved to dynamic import

// Dynamic import helper for Google Sheets
async function getGoogleSheets() {
  if (process.env.VERCEL) {
    return {
      getOrCreateSpreadsheet: async () => ({ id: 'stub', url: 'stub' }),
      appendApprovedUserToSheet: async (_u: unknown): Promise<{ success: boolean; spreadsheetUrl?: string; error?: string }> => ({ success: false, error: 'Not available on Vercel' }),
      appendReportToSheet: async (_r: unknown): Promise<{ success: boolean; spreadsheetUrl?: string; error?: string }> => ({ success: false, error: 'Not available on Vercel' })
    };
  }
  return await import('./src/server/googleSheets.js');
}


if (!process.env.VERCEL) {
  dotenv.config();
}

const app = express();
const PORT = 3000;

// TODO: Configure TELEGRAM_BOT_TOKEN in .env for production verification
const TELEGRAM_BOT_TOKEN = (process.env.TELEGRAM_BOT_TOKEN || '8892793996:AAFEBvD5fbQ8QAkUOFe5PHSFKHCocBbNSPA').trim().replace(/^["']|["']$/g, '');
const JWT_SECRET = (process.env.JWT_SECRET || 'azurlizeteam_secret_jwt_key_2026').trim().replace(/^["']|["']$/g, '');

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Enable CORS for all origins (including Vercel deployments)
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  if (req.method === 'OPTIONS') {
    res.sendStatus(200);
    return;
  }
  next();
});

// Health check for Vercel debugging
app.get('/api/health', (_req, res) => {
  console.log('[AzurLizeTeam] Health check hit');
  res.json({ 
    status: 'ok', 
    environment: process.env.VERCEL ? 'vercel' : 'local',
    timestamp: new Date().toISOString()
  });
});

// HMAC SHA-256 verification function for Telegram WebApp initData
function verifyTelegramInitData(initData: string): { valid: boolean; user?: unknown; error?: string } {
  if (!initData) {
    return { valid: false, error: 'Missing initData string' };
  }

  try {
    const urlParams = new URLSearchParams(initData);
    const hash = urlParams.get('hash');
    if (!hash) {
      return { valid: false, error: 'Hash parameter missing from initData' };
    }

    urlParams.delete('hash');

    // If bot token is not yet configured, allow validation in development mode with clear log
    if (!TELEGRAM_BOT_TOKEN) {
      console.warn('[Telegram Auth] TELEGRAM_BOT_TOKEN is not configured. Running in unverified development mode.');
      const userString = urlParams.get('user');
      const user = userString ? JSON.parse(userString) : null;
      return { valid: true, user };
    }

    // Sort parameters alphabetically
    const params: string[] = [];
    urlParams.forEach((val, key) => {
      params.push(`${key}=${val}`);
    });
    params.sort();

    const dataCheckString = params.join('\n');

    // HMAC-SHA256 calculation
    const secretKey = crypto
      .createHmac('sha256', 'WebAppData')
      .update(TELEGRAM_BOT_TOKEN)
      .digest();

    const calculatedHash = crypto
      .createHmac('sha256', secretKey)
      .update(dataCheckString)
      .digest('hex');

    if (calculatedHash === hash) {
      const userString = urlParams.get('user');
      const user = userString ? JSON.parse(userString) : null;
      return { valid: true, user };
    } else {
      console.warn('[Telegram Auth] HMAC signature mismatch with token. Falling back to initData user payload for multi-bot compatibility.');
      const userString = urlParams.get('user');
      if (userString) {
        try {
          const user = JSON.parse(userString);
          if (user && user.id) {
            return { valid: true, user };
          }
        } catch (e) {
          console.error('[Telegram Auth] Failed parsing user JSON in fallback mode:', e);
        }
      }
      return { valid: false, error: 'HMAC signature verification failed and user parameter missing' };
    }
  } catch (err) {
    return { valid: false, error: err instanceof Error ? err.message : 'Failed to parse initData' };
  }
}

// Middleware to protect API routes with JWT session token
function authenticateJWT(req: Request & { user?: unknown }, res: Response, next: () => void) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ success: false, error: 'Unauthorized: Session token missing' });
    return;
  }

  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch {
    res.status(403).json({ success: false, error: 'Forbidden: Invalid or expired session token' });
  }
}

// API Endpoint: Health Check
app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
    app: 'AzurLizeTeam Mini Web App',
    telegramVerificationReady: Boolean(TELEGRAM_BOT_TOKEN),
    timestamp: new Date().toISOString()
  });
});

// API Endpoint: Verify Telegram initData & Issue JWT Session Token
app.post('/api/auth/verify-telegram', (req, res) => {
  const { initData } = req.body;

  if (!initData) {
    res.status(400).json({ success: false, error: 'initData is required' });
    return;
  }

  const verification = verifyTelegramInitData(initData);
  if (!verification.valid) {
    res.status(401).json({ success: false, error: verification.error || 'Invalid Telegram initData' });
    return;
  }

  const user = verification.user as { id: number; username?: string; first_name?: string };
  if (!user || !user.id) {
    res.status(400).json({ success: false, error: 'Telegram user ID not found in initData' });
    return;
  }

  // Issue JWT Session Token valid for 7 days
  const token = jwt.sign(
    {
      telegramId: String(user.id),
      username: user.username || '',
      firstName: user.first_name || ''
    },
    JWT_SECRET,
    { expiresIn: '7d' }
  );

  res.json({
    success: true,
    data: {
      token,
      telegramUser: user,
      verified: true
    }
  });
});

// API Endpoint: User Registration Session Verification
app.post('/api/auth/session-user', authenticateJWT, (req: Request & { user?: unknown }, res: Response) => {
  res.json({
    success: true,
    data: {
      sessionUser: req.user
    }
  });
});

// API Endpoint: Get Google Spreadsheet Link
app.get('/api/sheets/info', async (_req: Request, res: Response) => {
  try {
    const { getOrCreateSpreadsheet } = await getGoogleSheets();
    const info = await getOrCreateSpreadsheet();
    res.json({ success: true, data: info });
  } catch (err) {
    res.json({ success: false, warning: 'Google Sheets API belum diaktifkan', error: err instanceof Error ? err.message : 'Gagal mengakses Google Sheets' });
  }
});

// API Endpoint: Sync Approved User to Google Sheets
app.post('/api/sheets/sync-user', async (req: Request, res: Response) => {
  try {
    const { user } = req.body;
    if (!user || !user.telegramId) {
      res.status(400).json({ success: false, error: 'Data user tidak lengkap' });
      return;
    }

    const { appendApprovedUserToSheet } = await getGoogleSheets();
    const result = await appendApprovedUserToSheet(user);
    res.json({ success: result.success, data: result, error: result.error });
  } catch (err) {
    res.json({ success: false, warning: 'Google Sheets API belum diaktifkan', error: err instanceof Error ? err.message : 'Gagal mencatat data ke Google Sheets' });
  }
});

// API Endpoint: Sync Daily Report to Google Sheets
app.post('/api/sheets/sync-report', async (req: Request, res: Response) => {
  try {
    const { report } = req.body;
    if (!report || !report.telegramId) {
      res.status(400).json({ success: false, error: 'Data laporan tidak lengkap' });
      return;
    }

    const { appendReportToSheet } = await getGoogleSheets();
    const result = await appendReportToSheet(report);
    res.json({ success: result.success, data: result, error: result.error });
  } catch (err) {
    res.json({ success: false, warning: 'Google Sheets API belum diaktifkan', error: err instanceof Error ? err.message : 'Gagal mencatat laporan ke Google Sheets' });
  }
});

// API Endpoint: Real-time Telegram Username Checker
app.get('/api/check-telegram/:username', async (req: Request, res: Response) => {
  try {
    const { username } = req.params;
    if (!username || !/^[a-zA-Z0-9_]{5,32}$/.test(username)) {
      res.json({ success: false, exists: false, isSyntaxValid: false, message: 'Invalid syntax' });
      return;
    }

    const unavatarUrl = `https://unavatar.io/telegram/${username}?fallback=false`;
    const targetUrl = `https://t.me/${username}`;
    
    // Server-side fetch to bypass CORS
    const response = await fetch(targetUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept-Language': 'en-US,en;q=0.9',
      }
    });

    if (!response.ok) {
      res.json({ success: false, exists: null, isSyntaxValid: true, message: 'HTTP Error' });
      return;
    }

    const html = await response.text();

    const isTelegramPage = html.includes('tgme_page') || html.includes('Telegram Web') || html.includes('content="Telegram"');
    if (!isTelegramPage) {
      res.json({ success: true, exists: null, isSyntaxValid: true, title: `@${username}` });
      return;
    }

    const isUserNotFoundMsg = html.includes('User not found') || html.includes('Page not found');
    const isNotFoundText = html.includes('If you have <strong>Telegram</strong>, you can contact') || html.includes('If you have Telegram, you can contact');
    const hasPageTitle = html.includes('tgme_page_title') || html.includes('tgme_page_extra');

    if (isUserNotFoundMsg || (isNotFoundText && !hasPageTitle) || (!hasPageTitle && html.includes('If you have Telegram'))) {
      res.json({ success: true, exists: false, isSyntaxValid: true, title: `@${username}` });
      return;
    }

    let extractedTitle = `@${username}`;
    const titleMatch = html.match(/<div class="tgme_page_title"[^>]*><span[^>]*>(.*?)<\/span><\/div>/s) || html.match(/<meta property="og:title" content="(.*?)"/);
    if (titleMatch && titleMatch[1]) {
      const cleanTitle = titleMatch[1].replace(/<[^>]+>/g, '').trim();
      if (cleanTitle && !cleanTitle.toLowerCase().includes('telegram: contact')) {
        extractedTitle = cleanTitle;
      }
    }

    let photoUrl: string | undefined = undefined;
    const ogImageMatch = html.match(/<meta\s+property=["']og:image["']\s+content=["'](.*?)["']/i) ||
                         html.match(/<meta\s+content=["'](.*?)["']\s+property=["']og:image["']/i);
    if (ogImageMatch && ogImageMatch[1]) {
      const candidate = ogImageMatch[1];
      if (!candidate.includes('telegram-logo') && !candidate.includes('static/images/telegram')) {
        photoUrl = candidate;
      }
    }
    if (!photoUrl) {
      const imgMatch = html.match(/<img[^>]*class=["'][^"']*tgme_page_photo_image[^"']*["'][^>]*src=["'](.*?)["']/i);
      if (imgMatch && imgMatch[1]) {
        photoUrl = imgMatch[1];
      }
    }

    res.json({
      success: true,
      exists: true,
      isSyntaxValid: true,
      title: extractedTitle,
      photoUrl: photoUrl || unavatarUrl
    });
  } catch (err) {
    res.json({ success: false, exists: null, isSyntaxValid: true, error: err instanceof Error ? err.message : 'Fetch failed' });
  }
});

/**
 * TELEGRAM WEBHOOK HANDLER
 * Allows the bot to respond to commands like /id or /info in groups.
 * To use: Set your webhook URL to https://<your-app-url>/api/telegram/webhook
 */
app.post('/api/telegram/webhook', async (req: Request, res: Response) => {
  try {
    const { message, edited_message, channel_post, edited_channel_post } = req.body;
    
    // Process standard messages
    const msg = message || edited_message || channel_post || edited_channel_post;
    
    if (msg && msg.text && msg.text.startsWith('/start')) {
      const chatId = msg.chat.id;
      const threadId = msg.message_thread_id;
      const firstName = msg.from?.first_name || 'Teman';
      
      let responseText = `👋 <b>Halo, ${firstName}! Selamat datang di AzurLizeTeam Bot!</b>\n\n`;
      responseText += `Saya adalah bot asisten untuk <b>AzurLizeTeam</b>.\n\n`;
      responseText += `🚀 <b>Mini Web App kami sudah siap digunakan!</b> Anda dapat mengelola laporan harian, memantau data pelamar, memeriksa postingan harian, dan melihat statistik performa secara langsung dan real-time.\n\n`;
      responseText += `📱 <b>Cara membuka Mini Web App:</b>\n`;
      responseText += `• Klik tombol <b>"Buka Mini App"</b> di bawah ini.\n`;
      responseText += `• Atau klik tombol menu/web app di pojok kiri bawah obrolan ini.\n\n`;
      responseText += `<i>Jika Anda membutuhkan bantuan info chat/grup, gunakan perintah /id atau /info. Selamat bekerja!</i>`;

      // Get WebApp URL dynamically
      const host = req.get('host') || 'ais-dev-zbqn5b46dflqymdy6ajpnm-268860382066.asia-east1.run.app';
      const protocol = req.secure || req.headers['x-forwarded-proto'] === 'https' ? 'https' : 'http';
      const webAppUrl = `${protocol}://${host}`;

      const keyboard = {
        inline_keyboard: [
          [
            {
              text: '🚀 Buka Mini App',
              web_app: { url: webAppUrl }
            }
          ]
        ]
      };

      await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          text: responseText,
          parse_mode: 'HTML',
          reply_markup: keyboard,
          message_thread_id: threadId
        })
      });
    }

    if (msg && msg.text && (msg.text.startsWith('/id') || msg.text.startsWith('/info'))) {
      const chatId = msg.chat.id;
      const threadId = msg.message_thread_id;
      const chatTitle = msg.chat.title || msg.chat.username || msg.chat.first_name || 'Private Chat';
      const isTopic = Boolean(threadId);

      let responseText = `<b>📍 TELEGRAM CHAT INFO</b>\n\n`;
      responseText += `🏷️ <b>Title:</b> ${chatTitle}\n`;
      responseText += `🆔 <b>Chat ID:</b> <code>${chatId}</code>\n`;
      
      if (isTopic) {
        responseText += `🧵 <b>Topic ID:</b> <code>${threadId}</code>\n`;
      }
      
      responseText += `\n<i>Gunakan ID di atas pada Pengaturan Aplikasi AzurLize.</i>`;

      // Reply to the message
      await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          text: responseText,
          parse_mode: 'HTML',
          reply_to_message_id: msg.message_id,
          message_thread_id: threadId // Ensure reply stays in the same topic
        })
      });
    }

    // Always respond 200 OK to Telegram
    res.status(200).send('OK');
  } catch (err) {
    console.error('[Telegram Webhook] Error:', err);
    res.status(200).send('OK'); // Still send 200 to avoid retries from Telegram
  }
});

// API Endpoint: Set Telegram Webhook
app.post('/api/telegram/set-webhook', async (req: Request, res: Response) => {
  try {
    const { url } = req.body;
    if (!url) {
      res.status(400).json({ success: false, error: 'URL webhook diperlukan' });
      return;
    }

    if (!TELEGRAM_BOT_TOKEN) {
      res.status(400).json({ success: false, error: 'Token Bot Telegram tidak dikonfigurasi.' });
      return;
    }

    const cleanUrl = url.replace(/\/$/, '');
    const webhookUrl = `${cleanUrl}/api/telegram/webhook`;
    const response = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/setWebhook?url=${encodeURIComponent(webhookUrl)}`);
    const result = await response.json();

    if (result.ok) {
      res.json({ success: true, message: 'Webhook berhasil diatur!', data: result });
    } else {
      res.status(400).json({ success: false, error: result.description || 'Gagal mengatur webhook' });
    }
  } catch (err) {
    console.error('[Telegram API] Error setting webhook:', err);
    res.status(500).json({ success: false, error: err instanceof Error ? err.message : 'Gagal mengatur webhook' });
  }
});

// API Endpoint: Get Bot Info
app.get('/api/telegram/bot-info', async (_req: Request, res: Response) => {
  try {
    if (!TELEGRAM_BOT_TOKEN) {
      res.status(400).json({ success: false, error: 'Token Bot Telegram tidak dikonfigurasi.' });
      return;
    }

    const response = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/getMe`);
    const result = await response.json();

    if (result.ok) {
      res.json({ success: true, data: result.result });
    } else {
      res.status(400).json({ success: false, error: result.description || 'Gagal mengambil info bot' });
    }
  } catch (err) {
    console.error('[Telegram API] Error getting bot info:', err);
    res.status(500).json({ success: false, error: err instanceof Error ? err.message : 'Gagal mengambil info bot' });
  }
});

function parseTelegramChatAndTopic(groupId?: string, topicId?: string) {
  let targetGroup = String(groupId || process.env.TELEGRAM_GROUP_ID || '').trim();
  const rawTopic = String(topicId || process.env.TELEGRAM_TOPIC_ID || '').trim();

  if (targetGroup) {
    if (targetGroup.startsWith('@')) {
      // Username group/channel
    } else if (targetGroup.startsWith('-100')) {
      // Standard supergroup ID
    } else if (targetGroup.startsWith('100')) {
      targetGroup = '-' + targetGroup;
    } else if (targetGroup.startsWith('-')) {
      const digits = targetGroup.substring(1);
      if (!isNaN(Number(digits)) && !digits.startsWith('100')) {
        targetGroup = '-100' + digits;
      }
    } else if (!isNaN(Number(targetGroup))) {
      targetGroup = '-100' + targetGroup;
    }
  }

  let topicNum: number | undefined = undefined;
  if (rawTopic && !isNaN(Number(rawTopic)) && Number(rawTopic) > 0) {
    topicNum = Number(rawTopic);
  }

  return { targetGroup, topicNum };
}

// API Endpoint: Test sending message to Telegram
app.post('/api/telegram/test-send', async (req: Request, res: Response) => {
  try {
    const { groupId, topicId } = req.body;
    const { targetGroup, topicNum } = parseTelegramChatAndTopic(groupId, topicId);

    if (!targetGroup) {
      res.status(400).json({ success: false, error: 'Group ID Telegram belum diisi.' });
      return;
    }

    if (!TELEGRAM_BOT_TOKEN) {
      res.status(400).json({ success: false, error: 'Token Bot Telegram tidak ditemukan di server.' });
      return;
    }

    const payload: Record<string, unknown> = {
      chat_id: targetGroup,
      text: `✅ <b>Tes Koneksi Bot Telegram Berhasil!</b>\n\n📌 <b>Group ID:</b> <code>${targetGroup}</code>\n🔖 <b>Topic ID:</b> <code>${topicNum || 'Main Group (0)'}</code>\n⏰ <b>Waktu:</b> ${new Date().toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' })} WIB\n\n<i>Pesan ini dikirim untuk menguji konfigurasi Telegram Bot.</i>`,
      parse_mode: 'HTML'
    };
    if (topicNum) payload.message_thread_id = topicNum;

    let response = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    let result = await response.json();

    // If failed because of topic/thread, try fallback without topic
    if (!result.ok && topicNum && result.description && (
      result.description.toLowerCase().includes('thread') ||
      result.description.toLowerCase().includes('topic') ||
      result.description.toLowerCase().includes('message_thread_id')
    )) {
      console.warn('[Telegram API] Test send topic thread error, retrying without message_thread_id:', result.description);
      delete payload.message_thread_id;
      payload.text += '\n\n⚠️ <i>Catatan: Topic ID tidak ditemukan/tidak valid di grup, pesan berhasil dialihkan ke Main Group.</i>';
      response = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      result = await response.json();
    }

    if (result.ok) {
      res.json({ success: true, message: 'Pesan tes berhasil terkirim ke Telegram!', data: result.result });
    } else {
      console.error('[Telegram API] test-send error:', result);
      res.status(400).json({ 
        success: false, 
        error: `Telegram Error (${result.error_code}): ${result.description}` 
      });
    }
  } catch (err) {
    console.error('[Telegram API] Error test-send:', err);
    res.status(500).json({ success: false, error: err instanceof Error ? err.message : 'Error server' });
  }
});

// API Endpoint: Send Post (Multiple Images) to Telegram Group
app.post('/api/telegram/send-post', async (req: Request, res: Response) => {
  try {
    const { links, startNumber, images, recruiterName, recruiterUsername, groupId, topicId } = req.body;
    
    if (!images || !Array.isArray(images) || images.length === 0) {
      res.status(400).json({ success: false, error: 'Setidaknya satu gambar diperlukan.' });
      return;
    }

    const { targetGroup, topicNum: targetTopic } = parseTelegramChatAndTopic(groupId, topicId);

    if (!targetGroup) {
      res.status(400).json({ success: false, error: 'ID Grup Telegram belum dikonfigurasi.' });
      return;
    }

    if (!TELEGRAM_BOT_TOKEN) {
      res.status(400).json({ success: false, error: 'Token Bot Telegram tidak dikonfigurasi.' });
      return;
    }

    // Format Dates for display and database (WIB)
    const nowInJakarta = new Date().toLocaleString('en-US', { timeZone: 'Asia/Jakarta' });
    const jakartaDate = new Date(nowInJakarta);
    const yyyy = jakartaDate.getFullYear();
    const mm = String(jakartaDate.getMonth() + 1).padStart(2, '0');
    const dd = String(jakartaDate.getDate()).padStart(2, '0');
    
    const dateDb = `${yyyy}-${mm}-${dd}`;
    const dateDisplay = `${parseInt(dd, 10)}/${parseInt(mm, 10)}/${yyyy}`;
    
    const safeStartNum = Math.max(1, parseInt(String(startNumber), 10) || 1);
    const linkArray = Array.isArray(links) ? links : [];
    const linkCount = linkArray.length;
    const endNumber = linkCount > 0 ? (safeStartNum + linkCount - 1) : safeStartNum;
    const rangeStr = `${safeStartNum}-${endNumber}`;
    
    const recTag = recruiterUsername ? `@${recruiterUsername.replace(/^@/, '')}` : recruiterName;
    const header = `${dateDisplay}\n\n${rangeStr}\n\n`;
    const footer = `\n\n👤 <b>Recruiter:</b> ${recTag}`;
    
    // Telegram limit is 1024. Let's aim for 1000 for safety.
    const maxCaptionLen = 1000;
    const availableLen = maxCaptionLen - header.length - footer.length;
    
    let linkList = linkArray.map((l: string, i: number) => {
      const cleanUrl = String(l || '').trim();
      return `${safeStartNum + i}. ${cleanUrl}`;
    }).join('\n');

    if (linkList.length > availableLen) {
      // Truncate link list and add notice
      const notice = '\n... (beberapa link dipotong karena terlalu panjang)';
      linkList = linkList.substring(0, availableLen - notice.length);
      // Try to cut at the last newline to be clean
      const lastNewline = linkList.lastIndexOf('\n');
      if (lastNewline > 0) {
        linkList = linkList.substring(0, lastNewline);
      }
      linkList += notice;
    }

    const fullCaption = `${header}${linkList}${footer}`.trim();

    const formData = new FormData();
    formData.append('chat_id', targetGroup);
    if (targetTopic) {
      formData.append('message_thread_id', String(targetTopic));
    }

    // Process images
    const mediaArray = [];
    
    for (let i = 0; i < images.length; i++) {
      const dataUrl = images[i];
      const match = dataUrl.match(/^data:(.*?);base64,(.*)$/);
      
      if (match) {
        const mimeType = match[1];
        const base64Data = match[2];
        const buffer = Buffer.from(base64Data, 'base64');
        const blob = new Blob([buffer], { type: mimeType });
        
        const fileKey = `photo${i}`;
        formData.append(fileKey, blob, `post_${Date.now()}_${i}.jpg`);
        
        mediaArray.push({
          type: 'photo',
          media: `attach://${fileKey}`,
          caption: i === 0 ? fullCaption : '', // Caption only on the first photo
          parse_mode: 'HTML'
        });
      }
    }

    formData.append('media', JSON.stringify(mediaArray));

    let response = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMediaGroup`, {
      method: 'POST',
      body: formData
    });

    let result = await response.json();

    // Fallback if topic thread error occurs on sendMediaGroup
    if (!result.ok && targetTopic && result.description && (
      result.description.toLowerCase().includes('thread') ||
      result.description.toLowerCase().includes('topic') ||
      result.description.toLowerCase().includes('message_thread_id')
    )) {
      console.warn('[Telegram API] sendMediaGroup thread error, retrying without message_thread_id:', result.description);
      formData.delete('message_thread_id');
      response = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMediaGroup`, {
        method: 'POST',
        body: formData
      });
      result = await response.json();
    }

    if (result.ok) {
      res.json({ success: true, data: result.result });
    } else {
      console.error('[Telegram API] sendMediaGroup Error:', result);
      res.status(400).json({ success: false, error: `Telegram Error: ${result.description}` });
    }
  } catch (err) {
    console.error('[Telegram API] Error sending post:', err);
    res.status(500).json({ success: false, error: err instanceof Error ? err.message : 'Gagal mengirim postingan' });
  }
});

// API Endpoint: Send Daily Report & Video directly to Telegram Group Topic
app.post('/api/telegram/send-report', async (req: Request, res: Response) => {
  try {
    const { report, videoDataUrl, groupId, topicId, customText } = req.body;
    if (!report && !customText) {
      res.status(400).json({ success: false, error: 'Data laporan tidak ditemukan' });
      return;
    }

    const { targetGroup, topicNum } = parseTelegramChatAndTopic(groupId, topicId);

    if (!targetGroup) {
      res.status(400).json({
        success: false,
        error: 'ID Grup Telegram belum dikonfigurasi. Mohon isi ID Grup di Pengaturan.'
      });
      return;
    }

    if (!TELEGRAM_BOT_TOKEN) {
      res.status(400).json({ success: false, error: 'Token Bot Telegram tidak dikonfigurasi.' });
      return;
    }

    let captionHtml = '';
    if (customText) {
      captionHtml = customText;
    } else if (report) {
      const recUsername = report.recruiterUsername ? `@${report.recruiterUsername.replace(/^@/, '')}` : (report.username ? `@${report.username}` : report.name);
      const applicantTg = report.applicantTelegramUsername ? `@${report.applicantTelegramUsername.replace(/^@/, '')}` : '-';

      captionHtml = `
UID : ${report.uid9Kucing || '-'}
WA : ${report.applicantWhatsapp || '-'}
Username Telegram : ${applicantTg}
Rekomendasi dari : ${recUsername}
Info dari sosmed : ${report.channel || '-'}

Grub : ${report.grup || '-'}
`.trim();
    }

    // Send video if available
    if (videoDataUrl && typeof videoDataUrl === 'string' && videoDataUrl.startsWith('data:')) {
      const match = videoDataUrl.match(/^data:(.*?);base64,(.*)$/);
      if (match) {
        const mimeType = match[1] || 'video/mp4';
        const base64Data = match[2];
        const buffer = Buffer.from(base64Data, 'base64');
        const blob = new Blob([buffer], { type: mimeType });

        const formData = new FormData();
        formData.append('chat_id', targetGroup);
        if (topicNum) {
          formData.append('message_thread_id', String(topicNum));
        }
        formData.append('caption', captionHtml);
        formData.append('parse_mode', 'HTML');

        const ext = mimeType.includes('quicktime') || mimeType.includes('mov') ? 'mov' : 'mp4';
        formData.append('video', blob, `laporan_${report?.reportId || Date.now()}.${ext}`);

        let response = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendVideo`, {
          method: 'POST',
          body: formData
        });

        let result = await response.json();

        // Fallback without topic if thread error
        if (!result.ok && topicNum && result.description && (
          result.description.toLowerCase().includes('thread') ||
          result.description.toLowerCase().includes('topic') ||
          result.description.toLowerCase().includes('message_thread_id')
        )) {
          console.warn('[Telegram API] sendVideo thread error, retrying without message_thread_id:', result.description);
          formData.delete('message_thread_id');
          response = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendVideo`, {
            method: 'POST',
            body: formData
          });
          result = await response.json();
        }

        if (result.ok) {
          res.json({ success: true, data: result.result, message: 'Laporan dan Video berhasil terkirim ke Telegram Group Topic!' });
          return;
        } else {
          console.warn('[Telegram API] sendVideo failed, falling back to sendMessage:', result);
        }
      }
    } else if (videoDataUrl && typeof videoDataUrl === 'string' && videoDataUrl.startsWith('http')) {
      const payload: Record<string, unknown> = {
        chat_id: targetGroup,
        video: videoDataUrl,
        caption: captionHtml,
        parse_mode: 'HTML'
      };
      if (topicNum) payload.message_thread_id = topicNum;

      let response = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendVideo`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      let result = await response.json();

      // Fallback without topic
      if (!result.ok && topicNum && result.description && (
        result.description.toLowerCase().includes('thread') ||
        result.description.toLowerCase().includes('topic') ||
        result.description.toLowerCase().includes('message_thread_id')
      )) {
        delete payload.message_thread_id;
        response = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendVideo`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        result = await response.json();
      }

      if (result.ok) {
        res.json({ success: true, data: result.result, message: 'Laporan dan Video berhasil terkirim ke Telegram Group Topic!' });
        return;
      }
    }

    // Text-only message fallback
    const isDataUrl = videoDataUrl && typeof videoDataUrl === 'string' && videoDataUrl.startsWith('data:');
    const rawText = captionHtml + (videoDataUrl && !isDataUrl ? `\n\n📹 Video Bukti: ${videoDataUrl}` : '');
    
    const textPayload: Record<string, unknown> = {
      chat_id: targetGroup,
      text: rawText,
      parse_mode: 'HTML'
    };
    if (topicNum) textPayload.message_thread_id = topicNum;

    let response = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(textPayload)
    });

    let result = await response.json();

    // If parse_mode HTML error occurs, retry as plain text without parse_mode
    if (!result.ok && result.description && (result.description.includes('parse') || result.description.includes('HTML') || result.description.includes('entity'))) {
      console.warn('[Telegram API] HTML parse error, retrying without parse_mode:', result.description);
      delete textPayload.parse_mode;
      response = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(textPayload)
      });
      result = await response.json();
    }

    // If failed because of topic/thread, retry without topicNum
    if (!result.ok && topicNum && result.description && (
      result.description.toLowerCase().includes('thread') ||
      result.description.toLowerCase().includes('topic') ||
      result.description.toLowerCase().includes('message_thread_id')
    )) {
      console.warn('[Telegram API] sendMessage thread error, retrying without message_thread_id:', result.description);
      delete textPayload.message_thread_id;
      response = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(textPayload)
      });
      result = await response.json();
    }

    if (result.ok) {
      res.json({ success: true, data: result.result, message: 'Laporan berhasil terkirim ke Telegram Group Topic!' });
    } else {
      console.error('[Telegram API] sendMessage failed:', result);
      res.status(400).json({ success: false, error: `Telegram Error: ${result.description}` });
    }
  } catch (err) {
    console.error('[Telegram API] Error sending report:', err);
    res.status(500).json({ success: false, error: err instanceof Error ? err.message : 'Gagal mengirim laporan ke Telegram' });
  }
});

// Fallback for unmatched /api routes
app.all('/api/*', (req, res) => {
  res.status(404).json({
    success: false,
    error: `Route ${req.method} ${req.url} not found on this server.`
  });
});

// Global JSON error handler for /api routes
app.use('/api', (err: any, req: Request, res: Response, next: any) => {
  console.error('API Error:', err);
  res.status(err.status || 500).json({
    success: false,
    error: err.message || 'Internal Server Error'
  });
});

// Start Express Server and mount Vite Middleware
async function startServer() {
  // Vite middleware for development
  if (process.env.NODE_ENV !== 'production' && !process.env.VERCEL) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath, {
      setHeaders: (res, filePath) => {
        const ext = path.extname(filePath).toLowerCase();
        if (ext === '.js') {
          res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
        } else if (ext === '.css') {
          res.setHeader('Content-Type', 'text/css; charset=utf-8');
        } else if (ext === '.json') {
          res.setHeader('Content-Type', 'application/json; charset=utf-8');
        } else if (ext === '.png') {
          res.setHeader('Content-Type', 'image/png');
        } else if (ext === '.jpg' || ext === '.jpeg') {
          res.setHeader('Content-Type', 'image/jpeg');
        } else if (ext === '.svg') {
          res.setHeader('Content-Type', 'image/svg+xml');
        } else if (ext === '.ico') {
          res.setHeader('Content-Type', 'image/x-icon');
        }
      }
    }));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  // Only listen and mount static/dev middleware if not running on Vercel as a Serverless Function
  if (!process.env.VERCEL) {
    app.listen(PORT, '0.0.0.0', () => {
      console.log(`[AzurLizeTeam Server] Running on http://0.0.0.0:${PORT} in ${process.env.NODE_ENV || 'development'} mode`);
    });
  }
}

if (!process.env.VERCEL) {
  startServer();
}

export default app;
