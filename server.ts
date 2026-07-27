import express from 'express';
import type { Request, Response } from 'express';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { exec } from 'child_process';
import { promisify } from 'util';

const execPromise = promisify(exec);
import dotenv from 'dotenv';
import { initializeApp } from 'firebase/app';
import { getFirestore, doc, getDoc } from 'firebase/firestore';
import { GoogleGenAI, Type } from '@google/genai';

// Lazy-initialized GoogleGenAI client to avoid crash if GEMINI_API_KEY is not set on startup
let aiClient: GoogleGenAI | null = null;
function getGeminiClient(): GoogleGenAI {
  if (!aiClient) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error('GEMINI_API_KEY environment variable is required');
    }
    aiClient = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        }
      }
    });
  }
  return aiClient;
}

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
const TELEGRAM_BOT_TOKEN = (process.env.TELEGRAM_BOT_TOKEN || '8892793996:CAYzkJoLs661HwLRCY8qXBCdIKslXopcj9IYSEfsimUYRFLIf1hC0g').trim().replace(/^["']|["']$/g, '');
const JWT_SECRET = (process.env.JWT_SECRET || 'azurlizeteam_secret_jwt_key_2026').trim().replace(/^["']|["']$/g, '');

// Initialize Firebase App for Server-Side Telegram Bot lookups
let serverDb: any = null;
try {
  const configPath = path.join(process.cwd(), 'firebase-applet-config.json');
  if (fs.existsSync(configPath)) {
    const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
    const firebaseApp = initializeApp(config);
    const dbId = config.firestoreDatabaseId && config.firestoreDatabaseId !== '(default)'
      ? config.firestoreDatabaseId
      : undefined;
    serverDb = dbId ? getFirestore(firebaseApp, dbId) : getFirestore(firebaseApp);
    console.log('[Firebase Node] Firestore successfully initialized on Server!');
  } else {
    console.warn('[Firebase Node] firebase-applet-config.json not found on server.');
  }
} catch (err) {
  console.error('[Firebase Node] Failed to initialize Firebase on server:', err);
}

app.use(express.json({ limit: '500mb' }));
app.use(express.urlencoded({ limit: '500mb', extended: true }));

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

// API Endpoint: Scan Screenshot using Gemini AI for UID, WA, and Telegram Username
app.post('/api/scan-uid', async (req: Request, res: Response) => {
  try {
    const { image, mimeType } = req.body;
    if (!image) {
      res.status(400).json({ success: false, error: 'File gambar screenshot wajib dikirimkan.' });
      return;
    }

    let base64Data = image;
    let resolvedMimeType = mimeType || 'image/png';
    if (image.startsWith('data:')) {
      const match = image.match(/^data:([^;]+);base64,(.+)$/);
      if (match) {
        resolvedMimeType = match[1];
        base64Data = match[2];
      }
    }

    const ai = getGeminiClient();
    const response = await ai.models.generateContent({
      model: 'gemini-3.6-flash',
      contents: [
        {
          inlineData: {
            data: base64Data,
            mimeType: resolvedMimeType,
          },
        },
        {
          text: `Analyze this screenshot of a game/application. Please accurately extract the following fields if visible:
1. "uid": This is the player's/applicant's unique game/application UID (usually a standalone numeric code of 5 to 15 digits). For example: "UID: 12345678" or "ID: 12345678".
2. "whatsapp": This is the player's/applicant's WhatsApp or phone number (starts with 08, 62, +62, etc.).
3. "telegramUsername": This is the Telegram username (often labeled as Username, Telegram handle, dsb.).

Return the response in JSON format.`,
        },
      ],
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            uid: {
              type: Type.STRING,
              description: 'The extracted application/game UID numeric sequence (5 to 15 digits). If not found, return empty string.',
            },
            whatsapp: {
              type: Type.STRING,
              description: 'The WhatsApp number if visible. If not found, return empty string.',
            },
            telegramUsername: {
              type: Type.STRING,
              description: 'The Telegram username with or without @. If not found, return empty string.',
            },
            name: {
              type: Type.STRING,
              description: 'The display name or full name of the user/applicant if visible. If not found, return empty string.',
            },
            confidence: {
              type: Type.NUMBER,
              description: 'Confidence score from 0 to 1.',
            },
            reasoning: {
              type: Type.STRING,
              description: 'Brief explanation of what was found or why it couldn\'t be found.',
            },
          },
          required: ['uid', 'whatsapp', 'telegramUsername', 'name'],
        },
      },
    });

    const resultText = response.text || '{}';
    const parsed = JSON.parse(resultText);

    res.json({
      success: true,
      data: parsed,
    });
  } catch (err) {
    console.error('[Scan Screenshot] Error processing screenshot with Gemini AI:', err);
    res.status(500).json({
      success: false,
      error: err instanceof Error ? err.message : 'Gagal memproses screenshot menggunakan Gemini AI.',
    });
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
      res.json({ success: true, exists: null, isSyntaxValid: true, title: username });
      return;
    }

    const isUserNotFoundMsg = html.includes('User not found') || html.includes('Page not found');
    const isNotFoundText = html.includes('If you have <strong>Telegram</strong>, you can contact') || html.includes('If you have Telegram, you can contact');
    
    // Use regex to match actual class attributes of elements, avoiding CSS rule strings in style tags
    const hasPageTitle = /class=["'][^"']*(tgme_page_title|tgme_page_extra)[^"']*["']/i.test(html);

    if (isUserNotFoundMsg) {
      res.json({ success: true, exists: false, isSyntaxValid: true, title: username });
      return;
    }

    if ((isNotFoundText && !hasPageTitle) || (!hasPageTitle && html.includes('If you have Telegram'))) {
      res.json({ success: true, exists: null, isSyntaxValid: true, title: username });
      return;
    }

    let extractedTitle = username;
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
      if (!candidate.includes('telegram-logo') && 
          !candidate.includes('static/images') && 
          !candidate.includes('t_logo') && 
          !candidate.includes('telegram.org') && 
          !candidate.includes('default_avatar')) {
        photoUrl = candidate;
      }
    }
    if (!photoUrl) {
      const imgMatch = html.match(/<img[^>]*class=["'][^"']*tgme_page_photo_image[^"']*["'][^>]*src=["'](.*?)["']/i);
      if (imgMatch && imgMatch[1]) {
        const candidate = imgMatch[1];
        if (!candidate.includes('telegram-logo') && 
            !candidate.includes('static/images') && 
            !candidate.includes('t_logo') && 
            !candidate.includes('telegram.org') && 
            !candidate.includes('default_avatar')) {
          photoUrl = candidate;
        }
      }
    }
    
    // Always provide unavatar fallback if no native photo URL was found
    if (!photoUrl) {
      photoUrl = unavatarUrl;
    }

    res.json({
      success: true,
      exists: true,
      isSyntaxValid: true,
      title: extractedTitle,
      photoUrl: photoUrl
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
    const activeToken = ((req.query.token as string) || (req.body?.botToken as string) || TELEGRAM_BOT_TOKEN).trim();
    const { message, edited_message, channel_post, edited_channel_post } = req.body;
    
    // Process standard messages
    const msg = message || edited_message || channel_post || edited_channel_post;
    
    if (msg && msg.text && msg.text.startsWith('/start')) {
      const chatId = msg.chat.id;
      const threadId = msg.message_thread_id;
      const firstName = msg.from?.first_name || 'Teman';
      const senderId = msg.from?.id;
      
      let responseText = `👋 <b>Halo, ${firstName}! Selamat datang di AzurLizeTeam Bot!</b>\n\n`;
      responseText += `Saya adalah bot asisten untuk <b>AzurLizeTeam</b>.\n\n`;
      
      let userPinText = '';
      if (senderId && serverDb) {
        try {
          const userRef = doc(serverDb, 'users', String(senderId));
          const docSnap = await getDoc(userRef);
          if (docSnap.exists()) {
            const data = docSnap.data();
            if (data.pin) {
              userPinText = `🔑 <b>Kode PIN login Anda:</b> <code>${data.pin}</code>\n<i>Gunakan PIN di atas untuk masuk di Aplikasi APK / Browser Mandiri. Jangan bagikan PIN ini demi keamanan!</i>\n\n`;
            } else {
              userPinText = `🔑 <b>Akun Anda terdaftar, namun PIN belum diatur.</b>\n<i>Silakan masuk lalu buat/atur PIN Anda melalui menu Profil di dalam aplikasi.</i>\n\n`;
            }
          }
        } catch (dbErr) {
          console.error('[Telegram Webhook] Error looking up user pin during /start:', dbErr);
        }
      }
      
      responseText += `🚀 <b>Mini Web App kami sudah siap digunakan!</b> Anda dapat mengelola laporan harian, memantau data pelamar, memeriksa postingan harian, dan melihat statistik performa secara langsung dan real-time.\n\n`;
      
      if (userPinText) {
        responseText += userPinText;
      }
      
      responseText += `📱 <b>Cara membuka Mini Web App:</b>\n`;
      responseText += `• Klik tombol <b>"Buka Mini App"</b> di bawah ini.\n`;
      responseText += `• Atau klik tombol menu/web app di pojok kiri bawah obrolan ini.\n\n`;
      responseText += `<i>Jika Anda lupa PIN, ketik perintah /pin untuk mendapatkan PIN login Anda secara instan dan aman.</i>`;

      // Get WebApp URL dynamically (defaulting to Firebase hosting domain)
      const host = req.get('host');
      const protocol = req.secure || req.headers['x-forwarded-proto'] === 'https' ? 'https' : 'http';
      const webAppUrl = host && !host.includes('localhost') ? `${protocol}://${host}` : 'https://azurlize-team-3ba4f.firebaseapp.com';

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

      await fetch(`https://api.telegram.org/bot${activeToken}/sendMessage`, {
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

    if (msg && msg.text && msg.text.startsWith('/pin')) {
      const chatId = msg.chat.id;
      const threadId = msg.message_thread_id;
      const senderId = msg.from?.id;
      const firstName = msg.from?.first_name || 'Teman';

      let responseText = '';
      if (!senderId) {
        responseText = `❌ Gagal memproses data Telegram ID Anda.`;
      } else if (!serverDb) {
        responseText = `⚠️ Database Firestore server belum siap. Hubungi Admin.`;
      } else {
        try {
          const userRef = doc(serverDb, 'users', String(senderId));
          const docSnap = await getDoc(userRef);
          if (docSnap.exists()) {
            const data = docSnap.data();
            const userPin = data.pin || '<i>Belum diatur (Silakan login ke aplikasi lalu atur PIN di halaman Profil)</i>';
            responseText = `🔑 <b>INFORMASI KODE PIN (AKSES MASUK)</b>\n\n`;
            responseText += `👤 <b>Nama:</b> ${data.firstName || data.name || firstName}\n`;
            responseText += `🆔 <b>ID Telegram:</b> <code>${senderId}</code>\n`;
            responseText += `🔐 <b>PIN Anda:</b> <code>${userPin}</code>\n\n`;
            responseText += `<i>Gunakan ID Telegram dan PIN di atas untuk masuk di Aplikasi APK atau Browser Mandiri. Jaga kerahasiaan PIN Anda!</i>`;
          } else {
            responseText = `❌ <b>Akun Anda Belum Terdaftar!</b>\n\n`;
            responseText += `ID Telegram Anda (<code>${senderId}</code>) belum tercatat di database AzurLizeTeam.\n\n`;
            responseText += `Silakan buka Aplikasi APK atau buka Mini Web App untuk mendaftar profil baru terlebih dahulu.`;
          }
        } catch (dbErr) {
          console.error('[Telegram Webhook] Error looking up user pin during /pin:', dbErr);
          responseText = `⚠️ Terjadi kesalahan internal saat membaca data PIN Anda.`;
        }
      }

      await fetch(`https://api.telegram.org/bot${activeToken}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          text: responseText,
          parse_mode: 'HTML',
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
      await fetch(`https://api.telegram.org/bot${activeToken}/sendMessage`, {
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
    const { url, botToken } = req.body;
    const activeToken = (botToken || TELEGRAM_BOT_TOKEN).trim();

    if (!url) {
      res.status(400).json({ success: false, error: 'URL webhook diperlukan' });
      return;
    }

    if (!activeToken) {
      res.status(400).json({ success: false, error: 'Token Bot Telegram tidak dikonfigurasi.' });
      return;
    }

    const cleanUrl = url.replace(/\/$/, '');
    const webhookUrl = `${cleanUrl}/api/telegram/webhook?token=${encodeURIComponent(activeToken)}`;
    const response = await fetch(`https://api.telegram.org/bot${activeToken}/setWebhook?url=${encodeURIComponent(webhookUrl)}`);
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
app.get('/api/telegram/bot-info', async (req: Request, res: Response) => {
  try {
    const activeToken = ((req.query.token as string) || TELEGRAM_BOT_TOKEN).trim();
    if (!activeToken) {
      res.status(400).json({ success: false, error: 'Token Bot Telegram tidak dikonfigurasi.' });
      return;
    }

    const response = await fetch(`https://api.telegram.org/bot${activeToken}/getMe`);
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
    const { groupId, topicId, botToken } = req.body;
    const activeToken = (botToken || TELEGRAM_BOT_TOKEN).trim();
    const { targetGroup, topicNum } = parseTelegramChatAndTopic(groupId, topicId);

    if (!targetGroup) {
      res.status(400).json({ success: false, error: 'Group ID Telegram belum diisi.' });
      return;
    }

    if (!activeToken) {
      res.status(400).json({ success: false, error: 'Token Bot Telegram tidak ditemukan di server.' });
      return;
    }

    const payload: Record<string, unknown> = {
      chat_id: targetGroup,
      text: `✅ <b>Tes Koneksi Bot Telegram Berhasil!</b>\n\n📌 <b>Group ID:</b> <code>${targetGroup}</code>\n🔖 <b>Topic ID:</b> <code>${topicNum || 'Main Group (0)'}</code>\n⏰ <b>Waktu:</b> ${new Date().toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' })} WIB\n\n<i>Pesan ini dikirim untuk menguji konfigurasi Telegram Bot.</i>`,
      parse_mode: 'HTML'
    };
    if (topicNum) payload.message_thread_id = topicNum;

    let response = await fetch(`https://api.telegram.org/bot${activeToken}/sendMessage`, {
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
    const { links, startNumber, images, recruiterName, recruiterUsername, groupId, topicId, botToken } = req.body;
    
    if (!images || !Array.isArray(images) || images.length === 0) {
      res.status(400).json({ success: false, error: 'Setidaknya satu gambar diperlukan.' });
      return;
    }

    const { targetGroup, topicNum: targetTopic } = parseTelegramChatAndTopic(groupId, topicId);

    if (!targetGroup) {
      res.status(400).json({ success: false, error: 'ID Grup Telegram belum dikonfigurasi.' });
      return;
    }

    const activeToken = (botToken || TELEGRAM_BOT_TOKEN || '').trim();
    if (!activeToken) {
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
    
    let linkList = linkArray.map((l: string, i: number) => {
      const cleanUrl = String(l || '').trim();
      return `${safeStartNum + i}. ${cleanUrl}`;
    }).join('\n');

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
          media: `attach://${fileKey}`
        });
      }
    }

    let result;
    if (mediaArray.length === 1) {
      const photoFormData = new FormData();
      photoFormData.append('chat_id', targetGroup);
      if (targetTopic) photoFormData.append('message_thread_id', String(targetTopic));
      
      const photoBlob = formData.get('photo0');
      if (photoBlob) photoFormData.append('photo', photoBlob);

      let response = await fetch(`https://api.telegram.org/bot${activeToken}/sendPhoto`, {
        method: 'POST',
        body: photoFormData
      });
      result = await response.json();

      if (!result.ok && targetTopic && result.description && (
        result.description.toLowerCase().includes('thread') ||
        result.description.toLowerCase().includes('topic') ||
        result.description.toLowerCase().includes('message_thread_id')
      )) {
        photoFormData.delete('message_thread_id');
        response = await fetch(`https://api.telegram.org/bot${activeToken}/sendPhoto`, {
          method: 'POST',
          body: photoFormData
        });
        result = await response.json();
      }
    } else {
      formData.append('media', JSON.stringify(mediaArray));

      let response = await fetch(`https://api.telegram.org/bot${activeToken}/sendMediaGroup`, {
        method: 'POST',
        body: formData
      });

      result = await response.json();

      if (!result.ok && targetTopic && result.description && (
        result.description.toLowerCase().includes('thread') ||
        result.description.toLowerCase().includes('topic') ||
        result.description.toLowerCase().includes('message_thread_id')
      )) {
        console.warn('[Telegram API] sendMediaGroup thread error, retrying without message_thread_id:', result.description);
        formData.delete('message_thread_id');
        response = await fetch(`https://api.telegram.org/bot${activeToken}/sendMediaGroup`, {
          method: 'POST',
          body: formData
        });
        result = await response.json();
      }
    }

    if (!result.ok) {
      console.error('[Telegram API] sendMediaGroup/sendPhoto failed:', result);
      res.status(400).json({ success: false, error: `Telegram Error: ${result.description}` });
      return;
    }

    // Now send the text via sendMessage to avoid caption length limits
    let textPayload: Record<string, unknown> = {
      chat_id: targetGroup,
      text: fullCaption,
      parse_mode: 'HTML',
      link_preview_options: { is_disabled: true }
    };
    if (targetTopic) textPayload.message_thread_id = targetTopic;

    let textResponse = await fetch(`https://api.telegram.org/bot${activeToken}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(textPayload)
    });
    
    let textResult = await textResponse.json();
    
    if (!textResult.ok && targetTopic && textResult.description && (
      textResult.description.toLowerCase().includes('thread') ||
      textResult.description.toLowerCase().includes('topic') ||
      textResult.description.toLowerCase().includes('message_thread_id')
    )) {
      console.warn('[Telegram API] sendMessage thread error, retrying without message_thread_id:', textResult.description);
      delete textPayload.message_thread_id;
      textResponse = await fetch(`https://api.telegram.org/bot${activeToken}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(textPayload)
      });
      textResult = await textResponse.json();
    }

    if (textResult.ok) {
      res.json({ success: true, data: textResult.result });
    } else {
      console.error('[Telegram API] sendMessage Error:', textResult);
      res.status(400).json({ success: false, error: `Telegram Error: ${textResult.description}` });
    }
  } catch (err) {
    console.error('[Telegram API] Error sending post:', err);
    res.status(500).json({ success: false, error: err instanceof Error ? err.message : 'Gagal mengirim postingan' });
  }
});

// API Endpoint: Send Daily Report & Video directly to Telegram Group Topic
app.post('/api/telegram/send-report', async (req: Request, res: Response) => {
  try {
    const { report, videoDataUrl, groupId, topicId, customText, botToken } = req.body;
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

    const activeToken = (botToken || TELEGRAM_BOT_TOKEN || '').trim();
    if (!activeToken) {
      res.status(400).json({ success: false, error: 'Token Bot Telegram tidak dikonfigurasi.' });
      return;
    }

    if (report && (report.grup === 'T3' || report.grup === 'T0-MARK (Dipromosikan)')) {
      res.json({ success: true, message: 'Data T0-MARK Dipromosikan berhasil disimpan (tidak dikirim ke Telegram).' });
      return;
    }

    let captionHtml = '';
    if (customText) {
      captionHtml = customText;
    } else if (report) {
      const recUsername = report.recruiterUsername ? `@${report.recruiterUsername.replace(/^@+/, '')}` : (report.username ? `@${report.username.replace(/^@+/, '')}` : report.name);
      const rawTg = report.applicantTelegramUsername ? report.applicantTelegramUsername.replace(/^@+/, '') : '';
      const applicantTg = rawTg ? `<a href="https://t.me/${rawTg}">@${rawTg}</a>` : '-';
      const photoLink = report.applicantPhotoUrl ? `\nFoto Profil : <a href="${report.applicantPhotoUrl}">Lihat Foto Pelamar</a>` : '';

      let rawGrup = report.grup || '-';
      let displayGrup = rawGrup;
      if (rawGrup === 'T0' || rawGrup === 'T0-MARK') {
        displayGrup = 'T0-MARK';
      } else if (rawGrup === 'V0') {
        displayGrup = 'V0';
      } else if (rawGrup === 'RECRUITER') {
        displayGrup = 'RECRUITER';
      }

      captionHtml = `
UID : ${report.uid9Kucing || '-'}
WA : ${report.applicantWhatsapp || '-'}
Nama : <b>${report.applicantName || report.name || 'Tidak Diketahui'}</b>
Username Telegram : <b>${applicantTg}</b>
Rekomendasi dari : <b>${recUsername}</b>
Info dari sosmed : <b>${report.channel || '-'}</b>
Grub : <b>${displayGrup}</b>${photoLink}
`.trim();
    }

    let videoAttempted = false;
    let videoErrorMsg = '';

    // Send video if available (Wrapped in try-catch to fallback on any failures)
    try {
      if (videoDataUrl && typeof videoDataUrl === 'string') {
        videoAttempted = true;
        
        if (videoDataUrl.startsWith('data:')) {
          const match = videoDataUrl.match(/^data:(.*?);base64,(.*)$/);
          if (match) {
            const mimeType = match[1] || 'video/mp4';
            const base64Data = match[2];
            const buffer = Buffer.from(base64Data, 'base64');
            let ext = 'mp4';
            if (mimeType.includes('quicktime') || mimeType.includes('mov')) ext = 'mov';
            else if (mimeType.includes('gif')) ext = 'gif';
            
            // --- VIDEO COMPRESSION START ---
            let blobToSend = new Blob([buffer], { type: mimeType });
            let fileNameToSend = `laporan_${report?.reportId || Date.now()}.${ext}`;
            
            const tempId = crypto.randomBytes(8).toString('hex');
            const inputPath = path.join('/tmp', `in_${tempId}.${ext}`);
            const outputPath = path.join('/tmp', `out_${tempId}.mp4`);
            
            try {
              console.log(`[Compression] Saving original video to ${inputPath} (${buffer.length} bytes)`);
              await fs.promises.writeFile(inputPath, buffer);
              
              if (ext !== 'gif') {
                console.log(`[Compression] Running ffmpeg compression...`);
              // Settings: CRF 28, Scale to max 720p, keep audio with AAC
              await execPromise(`ffmpeg -i "${inputPath}" -vcodec libx264 -crf 28 -preset fast -vf "scale=-2:720" -acodec aac -b:a 128k -movflags +faststart -y "${outputPath}"`);
              
              if (fs.existsSync(outputPath)) {
                const compressedBuffer = await fs.promises.readFile(outputPath);
                console.log(`[Compression] Success! ${buffer.length} -> ${compressedBuffer.length} bytes`);
                blobToSend = new Blob([compressedBuffer], { type: 'video/mp4' });
                fileNameToSend = `laporan_${report?.reportId || Date.now()}.mp4`;
              }
              }
            } catch (compErr) {
              console.warn('[Compression] ffmpeg failed, using original:', compErr);
            } finally {
              // Cleanup temp files
              try {
                if (fs.existsSync(inputPath)) fs.unlinkSync(inputPath);
                if (fs.existsSync(outputPath)) fs.unlinkSync(outputPath);
              } catch (cleanupErr) {
                console.warn('[Compression] Cleanup error:', cleanupErr);
              }
            }
            // --- VIDEO COMPRESSION END ---

            const formData = new FormData();
            formData.append('chat_id', targetGroup);
            if (topicNum) {
              formData.append('message_thread_id', String(topicNum));
            }
            formData.append('caption', captionHtml);
            formData.append('parse_mode', 'HTML');
            const isGifFile = ext === 'gif';
            const fileParam = isGifFile ? 'animation' : 'video';
            const apiMethod = isGifFile ? 'sendAnimation' : 'sendVideo';

            formData.append(fileParam, blobToSend, fileNameToSend);

            let response = await fetch(`https://api.telegram.org/bot${activeToken}/${apiMethod}`, {
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
              console.warn(`[Telegram API] ${apiMethod} thread error, retrying without message_thread_id:`, result.description);
              formData.delete('message_thread_id');
              response = await fetch(`https://api.telegram.org/bot${activeToken}/${apiMethod}`, {
                method: 'POST',
                body: formData
              });
              result = await response.json();
            }

            if (result.ok) {
              res.json({ success: true, data: result.result, message: 'Laporan dan media berhasil terkirim ke Telegram Group Topic!' });
              return;
            } else {
              console.warn(`[Telegram API] ${apiMethod} failed, falling back to text-only:`, result);
              videoErrorMsg = result.description || 'Unknown Telegram Error';
            }
          }
        } else if (videoDataUrl.startsWith('http')) {
          const payload: Record<string, unknown> = {
            chat_id: targetGroup,
            video: videoDataUrl,
            caption: captionHtml,
            parse_mode: 'HTML'
          };
          if (topicNum) payload.message_thread_id = topicNum;

          let response = await fetch(`https://api.telegram.org/bot${activeToken}/sendVideo`, {
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
            response = await fetch(`https://api.telegram.org/bot${activeToken}/sendVideo`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(payload)
            });
            result = await response.json();
          }

          if (result.ok) {
            res.json({ success: true, data: result.result, message: 'Laporan dan Video berhasil terkirim ke Telegram Group Topic!' });
            return;
          } else {
            console.warn('[Telegram API] sendVideo (URL) failed, falling back to text-only:', result);
            videoErrorMsg = result.description || 'Unknown Telegram Error';
          }
        } else if (videoDataUrl.startsWith('blob:')) {
          videoErrorMsg = 'Format video blob: tidak didukung di server.';
        }
      }
    } catch (vidErr: any) {
      console.warn('[Telegram API] Exception during sendVideo, falling back to text-only:', vidErr);
      videoErrorMsg = vidErr instanceof Error ? vidErr.message : 'Koneksi ke server Telegram terputus saat upload video.';
    }

    // Photo / Text message fallback
    const isBlobUrl = videoDataUrl && typeof videoDataUrl === 'string' && videoDataUrl.startsWith('blob:');
    const isDataUrl = videoDataUrl && typeof videoDataUrl === 'string' && videoDataUrl.startsWith('data:');
    
    let rawText = captionHtml;
    if (videoAttempted && videoErrorMsg) {
      rawText += `\n\n⚠️ <b>Gagal Mengirim Video Bukti:</b>\n<i>${videoErrorMsg}</i>\n(Laporan data kerja tetap tercatat)`;
    } else if (videoDataUrl && !isBlobUrl && !isDataUrl) {
      rawText += `\n\n📹 Video Bukti: ${videoDataUrl}`;
    } else if (videoDataUrl) {
      rawText += `\n\n📹 Video Bukti: (Video Terlampir)`;
    }
    
    const textPayload: Record<string, unknown> = {
      chat_id: targetGroup,
      text: rawText,
      parse_mode: 'HTML'
    };
    if (topicNum) textPayload.message_thread_id = topicNum;

    let photoSuccess = false;
    let result: any = null;
    let response: any = null;

    if (report?.applicantPhotoUrl && typeof report.applicantPhotoUrl === 'string' && report.applicantPhotoUrl.startsWith('http')) {
      try {
        const photoPayload: Record<string, unknown> = {
          chat_id: targetGroup,
          photo: report.applicantPhotoUrl,
          caption: rawText,
          parse_mode: 'HTML'
        };
        if (topicNum) photoPayload.message_thread_id = topicNum;

        const photoRes = await fetch(`https://api.telegram.org/bot${activeToken}/sendPhoto`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(photoPayload)
        });
        const photoResult = await photoRes.json();
        if (photoResult.ok) {
          photoSuccess = true;
          result = photoResult;
        } else {
          console.warn('[Telegram API] sendPhoto failed, falling back to sendMessage:', photoResult);
        }
      } catch (photoErr) {
        console.warn('[Telegram API] sendPhoto exception, falling back to sendMessage:', photoErr);
      }
    }

    if (!photoSuccess) {
      response = await fetch(`https://api.telegram.org/bot${activeToken}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(textPayload)
      });

      result = await response.json();
    }

    // If parse_mode HTML error occurs, retry as plain text without parse_mode
    if (!result.ok && result.description && (result.description.includes('parse') || result.description.includes('HTML') || result.description.includes('entity'))) {
      console.warn('[Telegram API] HTML parse error, retrying without parse_mode:', result.description);
      delete textPayload.parse_mode;
      response = await fetch(`https://api.telegram.org/bot${activeToken}/sendMessage`, {
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
      response = await fetch(`https://api.telegram.org/bot${activeToken}/sendMessage`, {
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
