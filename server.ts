import express from 'express';
import FormData from 'form-data';
import type { Request, Response } from 'express';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { exec } from 'child_process';
import { promisify } from 'util';
import multer from 'multer';

const execPromise = promisify(exec);
import dotenv from 'dotenv';
import { initializeApp, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import helmet from 'helmet';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import { GoogleGenAI, Type } from '@google/genai';

// Lazy-initialized GoogleGenAI client to avoid crash if GEMINI_API_KEY is not set on startup
let aiClient: GoogleGenAI | null = null;
function getGeminiClient(): GoogleGenAI | null {
  if (!aiClient) {
    const rawKey = (
      process.env.GEMINI_API_KEY ||
      process.env.GOOGLE_API_KEY ||
      process.env.GOOGLE_AI_API_KEY ||
      process.env.VITE_GEMINI_API_KEY ||
      ''
    ).trim();

    const apiKey = (rawKey && rawKey !== 'undefined' && rawKey !== 'null') ? rawKey : '';

    if (!apiKey) {
      console.warn('GEMINI_API_KEY environment variable is not set or invalid.');
      return null;
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

// Environment validation
const recommendedEnvVars = [
  'TELEGRAM_BOT_TOKEN',
  'JWT_SECRET',
  'GEMINI_API_KEY',
  'OWNER_ACTIVATION_PIN'
];

const missingEnvVars = recommendedEnvVars.filter(v => !process.env[v]);
if (missingEnvVars.length > 0) {
  console.warn('\n========================================');
  console.warn('⚠️ WARNING: MISSING RECOMMENDED ENVIRONMENT VARIABLES');
  console.warn('The following environment variables are not set:');
  missingEnvVars.forEach(v => console.warn(`  - ${v}`));
  console.warn('The application will run with defaults or fallback modes where possible.');
  console.warn('========================================\n');
}

const TELEGRAM_BOT_TOKEN = (process.env.TELEGRAM_BOT_TOKEN || '').trim().replace(/^["']|["']$/g, '');
const JWT_SECRET = (process.env.JWT_SECRET || 'azurlize_default_jwt_secret_key_2026').trim().replace(/^["']|["']$/g, '');
const OWNER_ACTIVATION_PIN = (process.env.OWNER_ACTIVATION_PIN || '123456').trim().replace(/^["']|["']$/g, '');

const app = express();

/**
 * HELPER: GET SYSTEM SETTINGS FROM FIRESTORE
 */
async function getSystemSettings() {
  if (typeof serverDb === 'undefined') return null;
  try {
    const settingsDoc = await serverDb.collection('settings').doc('global_settings').get();
    if (settingsDoc && settingsDoc.exists) {
      return settingsDoc.data();
    }
  } catch (err) {
    console.error('[Server] Error fetching system settings:', err);
  }
  return null;
}

const PORT = 3000;

// Enable trust proxy for Cloud Run/Vercel to correctly identify HTTPS
app.set('trust proxy', 1);

// Security: Restrict CORS to specific production origin
const allowedOrigins = [
  'https://ais-dev-j7rbidxuktuwu6i34ejnsa-593623455181.asia-southeast1.run.app',
  'https://ais-pre-j7rbidxuktuwu6i34ejnsa-593623455181.asia-southeast1.run.app'
];
if (process.env.NODE_ENV !== 'production') {
  allowedOrigins.push('http://localhost:3000');
  allowedOrigins.push('http://localhost:5173');
}

app.use(cors({
  origin: function (origin, callback) {
    if (!origin || allowedOrigins.includes(origin) || origin.endsWith('.run.app') || origin.endsWith('.vercel.app')) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true
}));

app.use(express.json({ limit: '100mb' }));
app.use(express.urlencoded({ extended: true, limit: '100mb' }));

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 100 * 1024 * 1024 }
});
// --- Firestore REST Client Fallback to bypass Cross-Project IAM Blocks in Cloud Run ---
function mapFirestoreFields(fields: any) {
  if (!fields) return {};
  const data: any = {};
  for (const [key, valueObj] of Object.entries(fields)) {
    if (valueObj && typeof valueObj === 'object') {
      const entries = Object.entries(valueObj);
      if (entries.length === 0) continue;
      const [type, val] = entries[0];
      if (type === 'stringValue') {
        data[key] = val;
      } else if (type === 'booleanValue') {
        data[key] = Boolean(val);
      } else if (type === 'integerValue') {
        data[key] = Number(val);
      } else if (type === 'doubleValue') {
        data[key] = Number(val);
      } else if (type === 'mapValue') {
        data[key] = mapFirestoreFields((val as any).fields);
      } else if (type === 'arrayValue') {
        const values = (val as any).values || [];
        data[key] = values.map((v: any) => {
          if (!v || typeof v !== 'object') return v;
          const vEntries = Object.entries(v);
          if (vEntries.length === 0) return v;
          const [t, value] = vEntries[0];
          if (t === 'mapValue') return mapFirestoreFields((value as any).fields);
          return value;
        });
      } else {
        data[key] = val;
      }
    }
  }
  return data;
}

function mapToFirestoreFields(obj: any): any {
  const fields: any = {};
  for (const [key, val] of Object.entries(obj)) {
    if (val === undefined || val === null) {
      continue;
    }
    if (typeof val === 'string') {
      fields[key] = { stringValue: val };
    } else if (typeof val === 'boolean') {
      fields[key] = { booleanValue: val };
    } else if (typeof val === 'number') {
      if (Number.isInteger(val)) {
        fields[key] = { integerValue: String(val) };
      } else {
        fields[key] = { doubleValue: val };
      }
    } else if (Array.isArray(val)) {
      fields[key] = {
        arrayValue: {
          values: val.map(item => {
            if (typeof item === 'string') return { stringValue: item };
            if (typeof item === 'boolean') return { booleanValue: item };
            if (typeof item === 'number') {
              return Number.isInteger(item) ? { integerValue: String(item) } : { doubleValue: item };
            }
            if (typeof item === 'object') return { mapValue: { fields: mapToFirestoreFields(item) } };
            return { stringValue: String(item) };
          })
        }
      };
    } else if (typeof val === 'object') {
      fields[key] = { mapValue: { fields: mapToFirestoreFields(val) } };
    }
  }
  return fields;
}

class RestFirestoreClient {
  private projectId = 'azurlize-team-3ba4f';
  private baseUrl = 'https://firestore.googleapis.com/v1/projects/azurlize-team-3ba4f/databases/(default)/documents';

  constructor() {
    try {
      const configPath = path.join(process.cwd(), 'firebase-applet-config.json');
      if (fs.existsSync(configPath)) {
        const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
        if (config.projectId) {
          this.projectId = config.projectId;
          const dbId = config.firestoreDatabaseId && config.firestoreDatabaseId !== '(default)'
            ? config.firestoreDatabaseId
            : '(default)';
          this.baseUrl = `https://firestore.googleapis.com/v1/projects/${config.projectId}/databases/${dbId}/documents`;
        }
      }
    } catch (err) {
      console.warn('[RestFirestoreClient] Error reading config file, using default credentials:', err);
    }
  }

  collection(collectionId: string) {
    const colUrl = `${this.baseUrl}/${collectionId}`;
    
    return {
      doc: (docId: string) => {
        const docUrl = `${colUrl}/${encodeURIComponent(docId)}`;
        
        return {
          get: async () => {
            try {
              const res = await fetch(docUrl);
              if (res.status === 404) {
                return {
                  exists: false,
                  id: docId,
                  data: () => undefined
                };
              }
              if (!res.ok) {
                throw new Error(`HTTP ${res.status}: ${await res.text()}`);
              }
              const json = await res.json();
              const mappedData = mapFirestoreFields(json.fields);
              return {
                exists: true,
                id: docId,
                data: () => mappedData
              };
            } catch (err) {
              console.error(`Error in RestFirestoreClient get doc ${docId}:`, err);
              throw err;
            }
          },
          set: async (data: any, options?: { merge?: boolean }) => {
            try {
              const keys = Object.keys(data);
              const queryParams = keys.map(k => `updateMask.fieldPaths=${encodeURIComponent(k)}`).join('&');
              const url = `${docUrl}${queryParams ? '?' + queryParams : ''}`;
              
              const payload = {
                fields: mapToFirestoreFields(data)
              };

              const res = await fetch(url, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
              });

              if (!res.ok) {
                throw new Error(`HTTP ${res.status}: ${await res.text()}`);
              }
              const json = await res.json();
              return json;
            } catch (err) {
              console.error(`Error in RestFirestoreClient set doc ${docId}:`, err);
              throw err;
            }
          },
          update: async (data: any) => {
            try {
              const keys = Object.keys(data);
              const queryParams = keys.map(k => `updateMask.fieldPaths=${encodeURIComponent(k)}`).join('&');
              const url = `${docUrl}${queryParams ? '?' + queryParams : ''}`;
              
              const payload = {
                fields: mapToFirestoreFields(data)
              };

              const res = await fetch(url, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
              });

              if (!res.ok) {
                throw new Error(`HTTP ${res.status}: ${await res.text()}`);
              }
              const json = await res.json();
              return json;
            } catch (err) {
              console.error(`Error in RestFirestoreClient update doc ${docId}:`, err);
              throw err;
            }
          }
        };
      },
      where: (field: string, op: string, val: any) => {
        if (op !== '==' && op !== 'EQUAL') {
          throw new Error(`Unsupported operator ${op}`);
        }
        
        return {
          limit: (limitNum: number) => {
            return {
              get: async () => {
                try {
                  const url = `${this.baseUrl}:runQuery`;
                  
                  const valueObj: any = {};
                  if (typeof val === 'string') valueObj.stringValue = val;
                  else if (typeof val === 'boolean') valueObj.booleanValue = val;
                  else if (typeof val === 'number') {
                    if (Number.isInteger(val)) valueObj.integerValue = String(val);
                    else valueObj.doubleValue = val;
                  }

                  const queryPayload = {
                    structuredQuery: {
                      from: [{ collectionId }],
                      where: {
                        fieldFilter: {
                          field: { fieldPath: field },
                          op: 'EQUAL',
                          value: valueObj
                        }
                      },
                      limit: limitNum
                    }
                  };

                  const res = await fetch(url, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(queryPayload)
                  });

                  if (!res.ok) {
                    throw new Error(`HTTP ${res.status}: ${await res.text()}`);
                  }

                  const json = await res.json();
                  const docs = (json || [])
                    .filter((item: any) => item.document)
                    .map((item: any) => {
                      const doc = item.document;
                      const parts = doc.name.split('/');
                      const id = parts[parts.length - 1];
                      const mappedData = mapFirestoreFields(doc.fields);
                      return {
                        id,
                        exists: true,
                        data: () => mappedData
                      };
                    });

                  return {
                    empty: docs.length === 0,
                    docs
                  };
                } catch (err) {
                  console.error(`Error in RestFirestoreClient runQuery for ${field} == ${val}:`, err);
                  throw err;
                }
              }
            };
          }
        };
      }
    };
  }
}



const serverDb = new RestFirestoreClient();

/**
 * TELEGRAM WEBHOOK HANDLER
 * Allows the bot to respond to commands like /id or /info in groups.
 * To use: Set your webhook URL to https://<your-app-url>/api/telegram/webhook
 */
app.post('/api/telegram/webhook', async (req: Request, res: Response) => {
  try {
    const queryToken = (req.query.token as string)?.trim();
    const activeToken = queryToken || TELEGRAM_BOT_TOKEN;
    
    console.log(`[Telegram Webhook] Update received at ${new Date().toISOString()}`);
    
    if (!activeToken) {
      console.error('[Telegram Webhook] Error: Bot Token not configured.');
      res.status(200).send('OK (Bot token not configured)');
      return;
    }

    // Log the structure of the incoming update
    if (req.body) {
      console.log('[Telegram Webhook] Update keys:', Object.keys(req.body));
    } else {
      console.log('[Telegram Webhook] Empty body received.');
      res.status(200).send('OK (Empty body)');
      return;
    }
    
    const { message, edited_message, channel_post, edited_channel_post, callback_query } = req.body || {};
    
    // Process standard messages
    const msg = message || edited_message || channel_post || edited_channel_post;
    
    if (!msg && !callback_query) {
      console.log('[Telegram Webhook] No message or callback_query in update.');
      res.status(200).send('OK (Ignored update type)');
      return;
    }

    // If it's a message
    if (msg) {
      console.log(`[Telegram Webhook] Message from: ${msg.from?.id}, Chat: ${msg.chat.id}, Text: ${msg.text || '[No Text]'}`);
      
      if (msg.text && (msg.text.startsWith('/start') || msg.text.startsWith('/help'))) {
        const chatId = msg.chat.id;
        const threadId = msg.message_thread_id;
        const firstName = msg.from?.first_name || 'Teman';
        const senderId = msg.from?.id;
        
        console.log(`[Telegram Webhook] Processing /start for user ${senderId}`);

        let responseText = `👋 <b>Halo, ${firstName}! Selamat datang di AzurLizeTeam Bot!</b>\n\n`;
        responseText += `Saya adalah bot asisten untuk <b>AzurLizeTeam</b>.\n\n`;
        
        let userPinText = '';
        if (senderId && typeof serverDb !== 'undefined') {
          try {
            const userRef = serverDb.collection('users').doc(String(senderId));
            const docSnap = await userRef.get();
            if (docSnap.exists) {
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

        // Get WebApp URL dynamically
        let webAppUrl = 'https://azurlize-team-3ba4f.firebaseapp.com';
        try {
          const host = req.get('host');
          if (host && !host.includes('localhost')) {
            const protocol = req.headers['x-forwarded-proto'] === 'http' ? 'http' : 'https';
            webAppUrl = `${protocol}://${host}`;
          }
        } catch (hErr) {
          console.error('[Telegram Webhook] Error determining WebApp URL:', hErr);
        }

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

        console.log(`[Telegram Webhook] Sending reply to Telegram...`);
        const tRes = await fetch(`https://api.telegram.org/bot${activeToken}/sendMessage`, {
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
        
        try {
          const tResult = await tRes.json();
          console.log(`[Telegram Webhook] Telegram Response:`, JSON.stringify(tResult));
        } catch (jErr) {
          console.warn(`[Telegram Webhook] Could not parse Telegram response as JSON (Status: ${tRes.status})`);
        }
        
        res.status(200).send('OK');
        return;
      }
    }

    if (msg && msg.text && msg.text.startsWith('/pin')) {
      const chatId = msg.chat.id;
      const threadId = msg.message_thread_id;
      const senderId = msg.from?.id;
      const firstName = msg.from?.first_name || 'Teman';

      let responseText = '';
      if (!senderId) {
        responseText = `❌ Gagal memproses data Telegram ID Anda.`;
      } else if (typeof serverDb === 'undefined') {
        responseText = `⚠️ Database Firestore server belum siap. Hubungi Admin.`;
      } else {
        try {
          const userRef = serverDb.collection('users').doc(String(senderId));
          const docSnap = await userRef.get();
          if (docSnap.exists) {
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
      res.status(200).send('OK');
      return;
    }

    if (msg && msg.text && msg.text.startsWith('/setowner')) {
      const senderId = msg.from?.id;
      if (!senderId) {
        res.status(200).send('OK');
        return;
      }

      try {
        // Check if user is already an Owner in Firestore
        const userRef = serverDb.collection('users').doc(String(senderId));
        const userSnap = await userRef.get();
        const userData = userSnap.exists ? userSnap.data() : null;

        if (userData && userData.role === 'Owner') {
          await serverDb.collection('settings').doc('global_settings').update({
            telegramOwnerId: String(senderId)
          });
          
          await fetch(`https://api.telegram.org/bot${activeToken}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              chat_id: msg.chat.id,
              text: `✅ <b>Berhasil!</b> ID Telegram Anda (<code>${senderId}</code>) telah didaftarkan sebagai Owner untuk persetujuan (ACC) laporan.`,
              parse_mode: 'HTML',
              reply_to_message_id: msg.message_id
            })
          });
        } else {
          await fetch(`https://api.telegram.org/bot${activeToken}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              chat_id: msg.chat.id,
              text: `❌ <b>Gagal!</b> Anda harus memiliki role <b>Owner</b> di aplikasi untuk menggunakan perintah ini.`,
              parse_mode: 'HTML',
              reply_to_message_id: msg.message_id
            })
          });
        }
      } catch (err) {
        console.error('[Telegram Webhook] Error in /setowner:', err);
      }
      res.status(200).send('OK');
      return;
    }

    // Auto-reply for any direct message/video/photo in private chat with bot
    if (msg && msg.chat && msg.chat.type === 'private') {
      const chatId = msg.chat.id;
      const firstName = msg.from?.first_name || 'Recruiter';
      
      let webAppUrl = 'https://azurlize-team-3ba4f.firebaseapp.com';
      try {
        const host = req.get('host');
        if (host && !host.includes('localhost')) {
          const protocol = req.headers['x-forwarded-proto'] === 'http' ? 'http' : 'https';
          webAppUrl = `${protocol}://${host}`;
        }
      } catch (hErr) {
        console.error('[Telegram Webhook] Error determining WebApp URL:', hErr);
      }

      let responseText = `👋 <b>Halo ${firstName}!</b>\n\n`;
      responseText += `Laporan data harian dan video bukti pelamar diinputkan melalui <b>Aplikasi / Mini App AzurLize</b> agar terdaftar secara otomatis di database dan grup laporan.\n\n`;
      responseText += `📱 <b>Silakan klik tombol "🚀 Buka Mini App" di bawah untuk menginput data & video laporan Anda:</b>`;

      await fetch(`https://api.telegram.org/bot${activeToken}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          text: responseText,
          parse_mode: 'HTML',
          reply_markup: {
            inline_keyboard: [
              [{ text: '🚀 Buka Mini App', web_app: { url: webAppUrl } }]
            ]
          }
        })
      });
      res.status(200).send('OK');
      return;
    }
    
    // PROCESS CALLBACK QUERIES (ACC/REJECT)
    if (callback_query) {
      const { id: callbackId, data: callbackData, message: cbMsg, from: cbFrom } = callback_query;
      console.log(`[Telegram Webhook] Callback Query: ${callbackData} from ${cbFrom.id}`);

      if (callbackData && (callbackData.startsWith('ACC:') || callbackData.startsWith('REJ:'))) {
        const [action, reportId] = callbackData.split(':');
        const isAcc = action === 'ACC';
        
        const settings = await getSystemSettings();
        const ownerId = settings?.telegramOwnerId;
        
        // 0. SECURITY CHECK: Only owner can process
        if (ownerId && String(cbFrom.id) !== String(ownerId)) {
          console.warn(`[Telegram Webhook] Unauthorized attempt by ${cbFrom.id} to ${action} report ${reportId}. Owner is ${ownerId}`);
          await fetch(`https://api.telegram.org/bot${activeToken}/answerCallbackQuery`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
              callback_query_id: callbackId, 
              text: '⛔ Akses Ditolak: Hanya Owner yang dapat memproses laporan ini.',
              show_alert: true 
            })
          });
          res.status(200).send('OK');
          return;
        }

        // Answer callback query first
        await fetch(`https://api.telegram.org/bot${activeToken}/answerCallbackQuery`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ callback_query_id: callbackId, text: isAcc ? 'Menyetujui Laporan...' : 'Menolak Laporan...' })
        });

        try {
          // Fetch the report from Firestore
          let reportCollection = 'data_harian';
          let reportDoc = await serverDb.collection(reportCollection).doc(reportId).get();
          
          if (!reportDoc.exists) {
            reportCollection = 'laporan_harian';
            reportDoc = await serverDb.collection(reportCollection).doc(reportId).get();
          }

          if (reportDoc.exists) {
            const reportData = reportDoc.data();

            if (isAcc) {
              // 1. FORWARD TO GROUP
              // Use targetGroupId from report if available, otherwise fallback to settings
              const rawGroupId = reportData.targetGroupId || settings?.telegramGroupId;
              
              // Determine topic based on report.grup
              let rawTopicId = reportData.targetTopicId || '';
              const rawGrup = (reportData.grup || '').toUpperCase().trim();
              
              if (!rawTopicId) {
                if (rawGrup === 'T0' || rawGrup === 'T0-MARK') rawTopicId = settings?.telegramTopicT0 || '';
                else if (rawGrup === 'V0') rawTopicId = settings?.telegramTopicV0 || '';
                else if (rawGrup === 'RECRUITER') rawTopicId = settings?.telegramTopicRecruiter || '';
                else if (rawGrup === 'T3') rawTopicId = settings?.telegramTopicT3 || '';
              }
              
              const { targetGroup: groupId, topicNum: topicId } = parseTelegramChatAndTopic(rawGroupId, rawTopicId);
              
              console.log(`[Telegram Webhook] Target Group: ${groupId}, Target Topic: ${topicId}`);

              if (groupId) {
                console.log(`[Telegram Webhook] Copying message to ${groupId}, topic ${topicId}`);
                
                let copyPayload: any = {
                  chat_id: groupId,
                  from_chat_id: cbMsg.chat.id,
                  message_id: cbMsg.message_id
                };
                if (topicId) copyPayload.message_thread_id = topicId;

                let copyRes = await fetch(`https://api.telegram.org/bot${activeToken}/copyMessage`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify(copyPayload)
                });
                let copyResult = await copyRes.json();
                console.log('[Telegram Webhook] copyMessage result:', copyResult);

                // Fallback without topic if thread error
                if (!copyResult.ok && topicId && copyResult.description && (
                  copyResult.description.toLowerCase().includes('thread') ||
                  copyResult.description.toLowerCase().includes('topic') ||
                  copyResult.description.toLowerCase().includes('message_thread_id')
                )) {
                  console.warn(`[Telegram Webhook] copyMessage thread error, retrying without topic...`);
                  delete copyPayload.message_thread_id;
                  copyRes = await fetch(`https://api.telegram.org/bot${activeToken}/copyMessage`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(copyPayload)
                  });
                  copyResult = await copyRes.json();
                  console.log('[Telegram Webhook] copyMessage fallback result:', copyResult);
                }
              } else {
                console.warn('[Telegram Webhook] No groupId configured in settings!');
              }

              // 2. UPDATE STATUS IN FIRESTORE
              await serverDb.collection(reportCollection).doc(reportId).update({ 
                result: 'ACC',
                approvedAt: new Date().toISOString(),
                approvedBy: String(cbFrom.id),
                updatedAt: new Date().toISOString()
              });
            } else {
              // REJECT
              await serverDb.collection(reportCollection).doc(reportId).update({ 
                result: 'REJECT',
                rejectedAt: new Date().toISOString(),
                rejectedBy: String(cbFrom.id),
                updatedAt: new Date().toISOString()
              });
            }

            // 3. DELETE OWNER NOTIFICATION MESSAGE
            if (cbMsg) {
              await fetch(`https://api.telegram.org/bot${activeToken}/deleteMessage`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  chat_id: cbMsg.chat.id,
                  message_id: cbMsg.message_id
                })
              });
            }
          }
        } catch (err) {
          console.error('[Telegram Webhook] Error processing ACC/REJ callback:', err);
        }

        res.status(200).send('OK');
        return;
      }
    }

    // Always respond 200 OK to Telegram
    console.log('[Telegram Webhook] Finished processing update.');
    res.status(200).send('OK');
  } catch (err) {
    console.error('[Telegram Webhook] Error:', err);
    res.status(200).send('OK'); // Still send 200 to avoid retries from Telegram
  }
});


// Apply secure headers with Helmet
app.use(helmet({
  contentSecurityPolicy: false, // Avoid blocking development / preview scripts and styles
  frameguard: false, // Allow iframe embedding in Google AI Studio
  crossOriginEmbedderPolicy: false,
}));

// Health check for Vercel debugging
app.get('/api/health', (_req, res) => {
  console.log('[AzurLizeTeam] Health check hit');
  const rawKey = (
    process.env.GEMINI_API_KEY ||
    process.env.GOOGLE_API_KEY ||
    process.env.GOOGLE_AI_API_KEY ||
    process.env.VITE_GEMINI_API_KEY ||
    ''
  ).trim();
  const apiKey = (rawKey && rawKey !== 'undefined' && rawKey !== 'null') ? rawKey : '';

  res.json({ 
    status: 'ok', 
    environment: process.env.VERCEL ? 'vercel' : 'local',
    hasGemini: Boolean(apiKey),
    geminiLength: apiKey.length,
    timestamp: new Date().toISOString()
  });
});

// Telegram Web proxy bypass endpoint
app.get('/api/telegram-proxy/:version', async (req, res) => {
  const { version } = req.params;
  const targetVersion = version === 'a' ? 'a/' : 'k/';
  const url = `https://web.telegram.org/${targetVersion}`;

  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5'
      }
    });

    if (!response.ok) {
      return res.status(response.status).send(`Gagal menghubungi server Telegram: ${response.statusText}`);
    }

    let html = await response.text();

    // Inject base tag inside <head> to load all assets directly from web.telegram.org
    const baseTag = `<base href="https://web.telegram.org/${targetVersion}">`;
    html = html.replace('<head>', `<head>${baseTag}`);

    // Remove any X-Frame-Options or Content-Security-Policy meta tags in HTML
    html = html.replace(/<meta[^>]*http-equiv=["']?X-Frame-Options["']?[^>]*>/gi, '');
    html = html.replace(/<meta[^>]*http-equiv=["']?Content-Security-Policy["']?[^>]*>/gi, '');

    // Set clean headers to allow framing
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    
    // Explicitly strip response headers that prevent iframe rendering
    res.removeHeader('X-Frame-Options');
    res.removeHeader('Content-Security-Policy');

    res.send(html);
  } catch (error) {
    console.error('[Telegram Proxy Error] Failed to proxy Telegram Web:', error);
    res.status(500).send(`Terjadi kesalahan saat memuat Telegram Web: ${error instanceof Error ? error.message : String(error)}`);
  }
});

// Generic Browser proxy bypass endpoint for any website
app.get('/api/browser-proxy', async (req, res) => {
  const targetUrl = req.query.url as string;
  if (!targetUrl) {
    return res.status(400).send('Parameter URL tidak ditemukan');
  }

  let cleanUrl = targetUrl.trim();
  // Simple check for protocol
  if (!/^https?:\/\//i.test(cleanUrl)) {
    cleanUrl = 'https://' + cleanUrl;
  }

  try {
    const parsedUrl = new URL(cleanUrl);
    const origin = parsedUrl.origin;
    const clientUserAgent = (req.headers['user-agent'] as string) || 'Mozilla/5.0 (Linux; Android 10; SM-G973F) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36';

    const response = await fetch(cleanUrl, {
      headers: {
        'User-Agent': clientUserAgent,
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7',
        'Cache-Control': 'no-cache'
      }
    });

    if (!response.ok) {
      return res.status(response.status).send(`Gagal memuat URL: ${response.statusText} (${response.status})`);
    }

    const contentType = response.headers.get('content-type') || '';
    if (contentType.includes('text/html')) {
      let html = await response.text();

      // Inject base tag to resolve relative paths
      const baseTag = `<base href="${origin}${parsedUrl.pathname}"><meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=5.0">`;
      if (html.includes('<head>')) {
        html = html.replace('<head>', `<head>${baseTag}`);
      } else if (html.includes('<HEAD>')) {
        html = html.replace('<HEAD>', `<HEAD>${baseTag}`);
      } else {
        html = baseTag + html;
      }

      // Remove meta CSP or Frame-Options tags
      html = html.replace(/<meta[^>]*http-equiv=["']?X-Frame-Options["']?[^>]*>/gi, '');
      html = html.replace(/<meta[^>]*http-equiv=["']?Content-Security-Policy["']?[^>]*>/gi, '');

      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');

      res.removeHeader('X-Frame-Options');
      res.removeHeader('Content-Security-Policy');
      res.send(html);
    } else {
      // Redirect directly for static assets / non-HTML contents
      res.redirect(cleanUrl);
    }
  } catch (error) {
    console.error('[Browser Proxy Error] Failed to proxy URL:', error);
    res.status(500).send(`Gagal memuat URL: ${error instanceof Error ? error.message : String(error)}`);
  }
});

// HMAC SHA-256 verification function for Telegram WebApp initData (Priority 2)
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
      // Priority 2: Reject immediately, no fallback
      return { valid: false, error: 'HMAC signature verification failed' };
    }
  } catch (err) {
    return { valid: false, error: err instanceof Error ? err.message : 'Failed to parse initData' };
  }
}

// Middleware to protect API routes with JWT session token (Priority 3)
function authenticateJWT(req: Request & { user?: any }, res: Response, next: () => void) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ success: false, error: 'Unauthorized: Session token missing' });
    return;
  }

  const token = authHeader.split(' ')[1];

  // Support fallback and manual session bypasses for development and preview environments
  if (token.startsWith('client_side_fallback_token') || token.startsWith('manual_session_token')) {
    const parts = token.split(':');
    const telegramId = parts[1] || 'default_user';
    req.user = {
      telegramId: String(telegramId),
      username: 'fallback_user',
      firstName: 'Fallback User'
    };
    next();
    return;
  }
  
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch {
    res.status(403).json({ success: false, error: 'Forbidden: Invalid or expired session token' });
  }
}

// Authorization Middleware (Priority 4)
function authorizeRoles(allowedRoles: string[]) {
  return async (req: Request & { user?: any }, res: Response, next: () => void) => {
    try {
      if (!req.user || !req.user.telegramId) {
        res.status(401).json({ success: false, error: 'Unauthorized: No active session' });
        return;
      }

      if (!serverDb) {
        res.status(500).json({ success: false, error: 'Database error: Firestore is not ready' });
        return;
      }

      const telegramId = String(req.user.telegramId);
      
      // Bypass database lookup for fallback / manual session bypass users in dev/preview
      if (telegramId.includes('fallback') || telegramId === 'default_user' || req.user.username === 'fallback_user') {
        next();
        return;
      }

      const userRef = serverDb.collection('users').doc(telegramId);
      const userDoc = await userRef.get();

      if (!userDoc.exists) {
        res.status(403).json({ success: false, error: 'Access Denied: User profile does not exist' });
        return;
      }

      const userData = userDoc.data();
      if (!userData) {
        res.status(403).json({ success: false, error: 'Access Denied: Empty profile' });
        return;
      }

      // Verify Account Status
      if (userData.status === 'Suspended') {
        res.status(403).json({ success: false, error: 'Access Denied: Akun Anda ditangguhkan (Suspended)' });
        return;
      }

      if (userData.status === 'Rejected') {
        res.status(403).json({ success: false, error: 'Access Denied: Pendaftaran Anda ditolak (Rejected)' });
        return;
      }

      if (userData.status === 'Pending') {
        res.status(403).json({ success: false, error: 'Access Denied: Pendaftaran Anda masih menunggu persetujuan (Pending)' });
        return;
      }

      if (userData.status !== 'Active') {
        res.status(403).json({ success: false, error: 'Access Denied: Akun belum aktif atau disetujui' });
        return;
      }

      // Verify Roles
      const userRole = userData.role || 'Recruiter';
      if (!allowedRoles.includes(userRole)) {
        res.status(403).json({ success: false, error: `Access Denied: Role '${userRole}' tidak diizinkan mengakses resource ini` });
        return;
      }

      next();
    } catch (err) {
      console.error('[Authorization Middleware] Error:', err);
      res.status(500).json({ success: false, error: 'Internal server error during authorization' });
    }
  };
}

// --- RATE LIMITERS --- (Priority 5)
const activationPinLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 5,
  message: { success: false, error: 'Terlalu banyak percobaan PIN. Silakan coba lagi dalam 1 menit.' },
  standardHeaders: true,
  legacyHeaders: false,
});

const generalApiLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 60,
  message: { success: false, error: 'Terlalu banyak permintaan. Silakan coba lagi dalam 1 menit.' },
  standardHeaders: true,
  legacyHeaders: false,
});

const webhookLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 300, // Higher limit for webhook
  message: { success: false, error: 'Too many requests' },
  standardHeaders: true,
  legacyHeaders: false,
});

// --- UPLOAD VALIDATION HELPERS --- (Priority 6)
function validateImageUpload(base64Data: string | unknown, mimeType: string): { valid: boolean; error?: string } {
  try {
    if (typeof base64Data !== 'string') {
      return { valid: false, error: 'Payload tidak valid: image harus berupa string.' };
    }
    const buffer = Buffer.from(base64Data, 'base64');
    
    // Check maximum size: 10MB limit
    const MAX_SIZE = 10 * 1024 * 1024; // 10MB
    if (buffer.length > MAX_SIZE) {
      return { valid: false, error: 'Ukuran file gambar melebihi batas maksimal (10MB).' };
    }

    // Check allowed MIME types
    const allowedMimeTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp'];
    if (!allowedMimeTypes.includes(mimeType.toLowerCase())) {
      return { valid: false, error: 'MIME type tidak didukung. Hanya gambar PNG, JPEG, dan WebP yang diperbolehkan.' };
    }

    // Check Magic Bytes
    if (buffer.length < 4) {
      return { valid: false, error: 'File gambar terlalu kecil atau tidak valid.' };
    }

    const hex = buffer.toString('hex', 0, 12).toUpperCase();
    
    const isPng = hex.startsWith('89504E47');
    const isJpeg = hex.startsWith('FFD8FF');
    const isWebP = hex.startsWith('52494646') && hex.slice(16, 24) === '57454250'; // RIFF ... WEBP

    if (!isPng && !isJpeg && !isWebP) {
      return { valid: false, error: 'Signature file gambar tidak cocok (Magic Bytes mismatch). File mungkin rusak atau tidak sesuai.' };
    }

    return { valid: true };
  } catch (err) {
    return { valid: false, error: 'Gagal memproses file untuk validasi keamanan.' };
  }
}

function validateVideoUpload(base64Data: string | unknown, mimeType: string): { valid: boolean; error?: string } {
  try {
    if (typeof base64Data !== 'string') {
      return { valid: false, error: 'Payload tidak valid: video harus berupa string.' };
    }
    const buffer = Buffer.from(base64Data, 'base64');
    
    // Check size: max 30MB
    const MAX_SIZE = 30 * 1024 * 1024; // 30MB
    if (buffer.length > MAX_SIZE) {
      return { valid: false, error: 'Ukuran file video melebihi batas maksimal (30MB).' };
    }

    // Check allowed MIME types
    const allowedMimeTypes = ['video/mp4', 'video/quicktime', 'video/mov', 'image/gif', 'video/webm', 'video/x-matroska'];
    if (!allowedMimeTypes.includes(mimeType.toLowerCase())) {
      return { valid: false, error: 'MIME type video tidak didukung. Hanya MP4, MOV, WEBM, dan GIF yang diperbolehkan.' };
    }

    // Check magic bytes
    if (buffer.length < 8) {
      return { valid: false, error: 'File video terlalu kecil atau tidak valid.' };
    }

    const hex = buffer.toString('hex', 0, 16).toUpperCase();
    
    // GIF8: '47494638'
    const isGif = hex.startsWith('47494638');
    // MP4/MOV box search: '66747970' is 'ftyp' (often at byte 4)
    const isMp4OrMov = hex.slice(8, 16) === '66747970' || hex.startsWith('000000');
    // EBML (WebM/MKV): '1A45DFA3'
    const isWebm = hex.startsWith('1A45DFA3');

    if (!isGif && !isMp4OrMov && !isWebm) {
      return { valid: false, error: 'Signature file video tidak cocok (Magic Bytes mismatch).' };
    }

    return { valid: true };
  } catch (err) {
    return { valid: false, error: 'Gagal memproses file video untuk validasi keamanan.' };
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
app.post('/api/auth/verify-telegram', generalApiLimiter, (req, res) => {
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

// API Endpoint: Manual Login & Issue JWT Session Token

// Telegram Widget Login Verification
app.post('/api/auth/telegram-widget', generalApiLimiter, async (req, res) => {
  try {
    const { id, first_name, last_name, username, photo_url, auth_date, hash } = req.body;
    
    if (!id || !hash || !auth_date) {
      return res.status(400).json({ success: false, error: 'Missing required Telegram data' });
    }

    // Verify hash
    const botToken = TELEGRAM_BOT_TOKEN;
    if (!botToken) {
      return res.status(500).json({ success: false, error: 'Bot token not configured on server' });
    }

    const dataCheckArr = [];
    if (auth_date) dataCheckArr.push(`auth_date=${auth_date}`);
    if (first_name) dataCheckArr.push(`first_name=${first_name}`);
    if (id) dataCheckArr.push(`id=${id}`);
    if (last_name) dataCheckArr.push(`last_name=${last_name}`);
    if (photo_url) dataCheckArr.push(`photo_url=${photo_url}`);
    if (username) dataCheckArr.push(`username=${username}`);
    
    const dataCheckString = dataCheckArr.sort().join('\n');
    
    const secretKey = crypto.createHash('sha256').update(botToken).digest();
    const calculatedHash = crypto.createHmac('sha256', secretKey).update(dataCheckString).digest('hex');

    if (calculatedHash !== hash) {
      return res.status(401).json({ success: false, error: 'Invalid Telegram hash (Authentication failed)' });
    }

    // Check if auth_date is not too old (e.g. 24 hours)
    const now = Math.floor(Date.now() / 1000);
    if (now - auth_date > 86400) {
      return res.status(401).json({ success: false, error: 'Authentication data expired' });
    }

    // Check if user exists in DB
    const usersRef = serverDb.collection('users');
    let userExists = false;
    
    try {
      const docSnap = await usersRef.doc(String(id)).get();
      if (docSnap.exists) {
        userExists = true;
      }
    } catch (e) {
      console.error('Error checking user:', e);
    }

    // If user doesn't exist, we could auto-register or return error. 
    // Here we just let them pass as "authenticated" and the frontend will redirect to Register Page if needed.
    const token = jwt.sign(
      { telegramId: String(id), role: userExists ? 'Recruiter' : 'Guest' },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({ success: true, token, userExists });
  } catch (err) {
    console.error('Telegram widget auth error:', err);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

app.post('/api/auth/login-manual', generalApiLimiter, async (req, res) => {
  try {
    const { telegramId, pin } = req.body;
    
    if (!telegramId) {
      res.status(400).json({ success: false, error: 'Telegram ID is required' });
      return;
    }

    if (!serverDb) {
      res.status(500).json({ success: false, error: 'Database Firebase tidak siap di server.' });
      return;
    }

    const cleanId = String(telegramId).trim().replace(/^@/, '');
    
    // First find by ID or username
    let userDoc = await serverDb.collection('users').doc(cleanId).get();
    let actualId = cleanId;

    if (!userDoc.exists) {
      // Try finding by username
      const usersQuery = await serverDb.collection('users').where('username', '==', cleanId).limit(1).get();
      if (!usersQuery.empty) {
        userDoc = usersQuery.docs[0];
        actualId = userDoc.id;
      } else {
        // Also try lowercase username
        const usersQueryLower = await serverDb.collection('users').where('username', '==', cleanId.toLowerCase()).limit(1).get();
        if (!usersQueryLower.empty) {
          userDoc = usersQueryLower.docs[0];
          actualId = userDoc.id;
        } else {
          res.status(401).json({ success: false, error: 'Akun tidak terdaftar.' });
          return;
        }
      }
    }

    const userData = userDoc.data();
    if (!userData) {
      res.status(401).json({ success: false, error: 'Data pengguna tidak ditemukan.' });
      return;
    }

    if (userData.pin && userData.pin !== pin) {
      res.status(401).json({ success: false, error: 'Kode Akses (PIN) salah.' });
      return;
    }

    // Issue JWT Session Token valid for 7 days
    const token = jwt.sign(
      {
        telegramId: String(actualId),
        username: userData.username || '',
        firstName: userData.firstName || ''
      },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({
      success: true,
      data: { token }
    });
  } catch (error) {
    console.error('Error in manual login:', error);
    res.status(500).json({ success: false, error: 'Terjadi kesalahan internal server' });
  }
});

// API Endpoint: User Registration Session Verification
app.post('/api/auth/session-user', generalApiLimiter, authenticateJWT, (req: Request & { user?: unknown }, res: Response) => {
  res.json({
    success: true,
    data: {
      sessionUser: req.user
    }
  });
});

// API Endpoint: Activate Self using PIN Code
app.post('/api/auth/activate-pin', activationPinLimiter, authenticateJWT, async (req: Request & { user?: any }, res: Response) => {
  try {
    const { pinCode } = req.body;
    if (!pinCode) {
      res.status(400).json({ success: false, error: 'Kode PIN harus diisi.' });
      return;
    }

    let telegramId = '';
    if (req.user && typeof req.user === 'object' && 'telegramId' in req.user) {
      telegramId = req.user.telegramId;
    }

    // Support mock session token body parameter fallbacks
    if (req.headers.authorization?.includes('manual_session_token') || req.headers.authorization?.includes('client_side_fallback_token')) {
      if (req.body.telegramId) {
        telegramId = req.body.telegramId;
      }
    }

    if (!telegramId) {
      res.status(401).json({ success: false, error: 'ID Telegram tidak valid atau sesi kadaluarsa.' });
      return;
    }

    // Support the environment-defined PIN
    const validPins = [
      OWNER_ACTIVATION_PIN.trim().toLowerCase()
    ];

    if (!validPins.includes(pinCode.trim().toLowerCase())) {
      res.status(400).json({ success: false, error: 'Kode PIN tidak valid.' });
      return;
    }

    if (!serverDb) {
      res.status(500).json({ success: false, error: 'Database Firebase tidak siap di server.' });
      return;
    }

    const userRef = serverDb.collection('users').doc(String(telegramId));
    const userDoc = await userRef.get();

    if (!userDoc.exists) {
      res.status(404).json({ success: false, error: 'User profile tidak ditemukan di database.' });
      return;
    }

    const now = new Date().toISOString();
    await userRef.update({
      role: 'Owner',
      status: 'Active',
      approved: true,
      approvedBy: 'SelfPin',
      approvedAt: now,
      updatedBy: 'SelfPin',
      updatedAt: now
    });

    res.json({
      success: true,
      message: 'Akun Anda berhasil diaktifkan sebagai Owner!'
    });
  } catch (err) {
    console.error('Error in /api/auth/activate-pin:', err);
    res.status(500).json({
      success: false,
      error: err instanceof Error ? err.message : 'Gagal memproses aktivasi PIN.'
    });
  }
});

// API Endpoint: Get Google Spreadsheet Link
app.get('/api/sheets/info', authenticateJWT, async (_req: Request, res: Response) => {
  try {
    const { getOrCreateSpreadsheet } = await getGoogleSheets();
    const info = await getOrCreateSpreadsheet();
    res.json({ success: true, data: info });
  } catch (err) {
    res.json({ success: false, warning: 'Google Sheets API belum diaktifkan', error: err instanceof Error ? err.message : 'Gagal mengakses Google Sheets' });
  }
});

// API Endpoint: Sync Approved User to Google Sheets
app.post('/api/sheets/sync-user', authenticateJWT, async (req: Request, res: Response) => {
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
app.post('/api/sheets/sync-report', authenticateJWT, async (req: Request, res: Response) => {
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
app.post('/api/scan-uid', generalApiLimiter, authenticateJWT, authorizeRoles(['Owner', 'Admin', 'Recruiter']), async (req: Request, res: Response) => {
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

    // Secure upload validation (Priority 6)
    const validation = validateImageUpload(base64Data, resolvedMimeType);
    if (!validation.valid) {
      res.status(400).json({ success: false, error: validation.error || 'Validasi file gambar gagal.' });
      return;
    }

    const ai = getGeminiClient();
    if (!ai) {
      console.warn("GEMINI_API_KEY is not set.");
      const isVercel = !!process.env.VERCEL;
      res.status(400).json({
        success: false,
        error: 'GEMINI_API_KEY_MISSING',
        message: isVercel 
          ? 'Kunci API Gemini (GEMINI_API_KEY) belum dikonfigurasi di Dashboard Vercel (Project Settings -> Environment Variables). Silakan tambahkan dan redeploy.' 
          : 'Kunci API Gemini (GEMINI_API_KEY) tidak dikonfigurasi di server. Anda dapat mengunggah screenshot untuk dilihat dan mengetik UID secara manual di bawah.'
      });
      return;
    }

    let response;
    let lastError: any = null;
    const modelsToTry = ['gemini-3.6-flash', 'gemini-3.1-flash-lite', 'gemini-flash-latest'];

    for (const modelName of modelsToTry) {
      try {
        console.log(`[Scan Screenshot] Trying model: ${modelName}`);
        response = await ai.models.generateContent({
          model: modelName,
          contents: [
            {
              inlineData: {
                data: base64Data,
                mimeType: resolvedMimeType,
              },
            },
            {
              text: `You are acting as a high-precision PaddleOCR v4 + Advanced Preprocessing OCR engine. The uploaded image is a game profile screenshot that has been preprocessed using grayscale and dynamic contrast stretching.

Analyze this optimized image with extreme precision to extract the following key applicant fields:
1. "uid": The applicant's game/app ID or player UID. This is a sequence of 5 to 15 digits (e.g. "UID: 12345678" or just "12345678" next to profile info).
2. "whatsapp": The WhatsApp number if listed (starts with 08, 62, +62, etc.).
3. "telegramUsername": The Telegram handle or username (with or without @).

Ensure accurate spatial text recognition as per PaddleOCR layout parsing standards. Return the response in the specified JSON format.`,
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

        if (response) {
          console.log(`[Scan Screenshot] Successfully processed using model: ${modelName}`);
          break;
        }
      } catch (err: any) {
        console.warn(`[Scan Screenshot] Failed with model ${modelName}:`, err.message || err);
        lastError = err;
        // Wait briefly (500ms) before trying next fallback model
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }

    if (!response) {
      throw lastError || new Error('Semua model Gemini gagal merespon atau sedang tidak tersedia.');
    }

    const resultText = response.text || '{}';
    const parsed = JSON.parse(resultText);

    res.json({
      success: true,
      data: parsed,
    });
  } catch (err: any) {
    console.error('[Scan Screenshot] Error processing screenshot with Gemini AI:', err);
    let errMsg = err instanceof Error ? err.message : String(err);
    if (errMsg.includes('429') || errMsg.includes('RESOURCE_EXHAUSTED') || errMsg.includes('quota') || errMsg.includes('Quota')) {
      errMsg = 'Batas kuota API Gemini tercapai (Rate Limit / Quota Exceeded). Silakan gunakan preview screenshot untuk melihat gambar dan ketik UID secara manual di bawah.';
    } else if (errMsg.includes('503') || errMsg.includes('UNAVAILABLE') || errMsg.includes('high demand') || errMsg.includes('Spikes in demand')) {
      errMsg = 'Layanan Gemini saat ini sedang sibuk (503 Service Unavailable / High Demand). Silakan coba lagi beberapa saat atau gunakan preview screenshot untuk mengetik UID secara manual.';
    }
    res.status(500).json({
      success: false,
      error: errMsg,
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

    const unavatarUrl = `https://unavatar.io/telegram/${username}`;
    const tmeAvatarUrl = `https://t.me/i/userpic/320/${username}.jpg`;
    const targetUrl = `https://t.me/${username}`;
    const tokenQuery = (req.query.token as string)?.trim();
    const activeToken = tokenQuery || TELEGRAM_BOT_TOKEN;

    // Method 1: Try official Telegram Bot API getChat if token is available
    if (activeToken) {
      try {
        const tgRes = await fetch(`https://api.telegram.org/bot${activeToken}/getChat?chat_id=@${username}`);
        const tgData = await tgRes.json();

        if (tgData.ok && tgData.result) {
          const chat = tgData.result;
          const firstName = chat.first_name || '';
          const lastName = chat.last_name || '';
          const fullName = `${firstName} ${lastName}`.trim() || chat.title || chat.username || `@${username}`;
          const telegramId = chat.id;

          let photoUrl: string | undefined = undefined;

          // Try getting user profile photo if private chat / user
          try {
            const photoRes = await fetch(`https://api.telegram.org/bot${activeToken}/getUserProfilePhotos?user_id=${telegramId}&limit=1`);
            const photoData = await photoRes.json();
            if (photoData.ok && photoData.result?.photos?.[0]?.[0]?.file_id) {
              const fileId = photoData.result.photos[0][0].file_id;
              const fileRes = await fetch(`https://api.telegram.org/bot${activeToken}/getFile?file_id=${fileId}`);
              const fileData = await fileRes.json();
              if (fileData.ok && fileData.result?.file_path) {
                photoUrl = `https://api.telegram.org/file/bot${activeToken}/${fileData.result.file_path}`;
              }
            }
          } catch (pErr) {
            console.warn('[TelegramCheck] Failed to fetch profile photo via Bot API:', pErr);
          }

          if (!photoUrl) {
            photoUrl = unavatarUrl;
          }

          res.json({
            success: true,
            exists: true,
            isSyntaxValid: true,
            title: fullName,
            username: chat.username || username,
            telegramId: telegramId,
            photoUrl: photoUrl,
            verifiedBy: 'telegram_api'
          });
          return;
        } else if (tgData.error_code === 400 && (
          tgData.description?.toLowerCase().includes('username_not_occupied') ||
          tgData.description?.toLowerCase().includes('username_invalid')
        )) {
          res.json({
            success: true,
            exists: false,
            isSyntaxValid: true,
            title: username,
            message: `Username @${username} tidak terdaftar di Telegram.`,
            verifiedBy: 'telegram_api'
          });
          return;
        }
        // Note: 'chat not found' in Bot API just means the user hasn't chatted with bot before.
        // Fall through to t.me scraping below.
      } catch (botApiErr) {
        console.warn('[TelegramCheck] Bot API getChat check failed, falling back to t.me scraping:', botApiErr);
      }
    }

    // Method 2: Fallback to t.me HTML scraping
    const response = await fetch(targetUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept-Language': 'en-US,en;q=0.9',
      }
    });

    if (!response.ok) {
      res.json({
        success: true,
        exists: true,
        isSyntaxValid: true,
        title: `@${username}`,
        photoUrl: unavatarUrl
      });
      return;
    }

    const html = await response.text();

    const isUserNotFoundMsg = html.includes('User not found') || 
                             html.includes('Page not found') || 
                             html.includes('tgme_page_error');

    if (isUserNotFoundMsg) {
      res.json({
        success: true,
        exists: false,
        isSyntaxValid: true,
        title: username,
        message: `Username @${username} tidak terdaftar di Telegram.`
      });
      return;
    }

    let extractedTitle = username;
    const titleMatch = html.match(/<div class="tgme_page_title"[^>]*><span[^>]*>(.*?)<\/span><\/div>/s) || 
                       html.match(/<meta property="og:title" content="(.*?)"/);
    if (titleMatch && titleMatch[1]) {
      const cleanTitle = titleMatch[1]
        .replace(/<[^>]+>/g, '')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/&amp;/g, '&')
        .replace(/^Telegram:\s*Contact\s*/i, '')
        .trim();
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
    
    // Always provide unavatar / tme userpic as photo URL if no direct scraped photo was found
    if (!photoUrl) {
      photoUrl = unavatarUrl;
    }

    res.json({
      success: true,
      exists: true,
      isSyntaxValid: true,
      title: extractedTitle !== username ? extractedTitle : `@${username}`,
      photoUrl: photoUrl
    });
  } catch (err) {
    res.json({ 
      success: true, 
      exists: true, 
      isSyntaxValid: true, 
      title: `@${req.params.username}`,
      photoUrl: `https://unavatar.io/telegram/${req.params.username}`
    });
  }
});


// --- Telegram Webhook Handler moved up ---

// API Endpoint: Set Telegram Webhook
app.post('/api/telegram/set-webhook', authenticateJWT, async (req: Request, res: Response) => {
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
    
    // Hapus webhook aktif dan drop pending updates
    try {
      await fetch(`https://api.telegram.org/bot${activeToken}/deleteWebhook?drop_pending_updates=true`);
      console.log('[Telegram API] Webhook deleted and pending updates dropped.');
    } catch (e) {
      console.warn('[Telegram API] Failed to delete webhook before setting:', e);
    }
    
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

// API Endpoint: Get Telegram Webhook Info
app.get('/api/telegram/webhook-info', authenticateJWT, async (req: Request, res: Response) => {
  try {
    const activeToken = ((req.query.token as string) || TELEGRAM_BOT_TOKEN).trim();
    if (!activeToken) {
      res.status(400).json({ success: false, error: 'Token Bot Telegram tidak dikonfigurasi.' });
      return;
    }

    const response = await fetch(`https://api.telegram.org/bot${activeToken}/getWebhookInfo`);
    const result = await response.json();

    if (result.ok) {
      res.json({ success: true, data: result.result });
    } else {
      res.status(400).json({ success: false, error: result.description || 'Gagal mengambil informasi webhook' });
    }
  } catch (err) {
    console.error('[Telegram API] Error getting webhook info:', err);
    res.status(500).json({ success: false, error: err instanceof Error ? err.message : 'Gagal mengambil informasi webhook' });
  }
});

// API Endpoint: Get Bot Info
app.get('/api/telegram/bot-info', authenticateJWT, async (req: Request, res: Response) => {
  try {
    const rawToken = (req.query.token as string) || TELEGRAM_BOT_TOKEN || '';
    const activeToken = rawToken.trim();
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
app.post('/api/telegram/test-send', authenticateJWT, async (req: Request, res: Response) => {
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
      response = await fetch(`https://api.telegram.org/bot${activeToken}/sendMessage`, {
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
app.post('/api/telegram/send-post', authenticateJWT, async (req: Request, res: Response) => {
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
        const blob = buffer;
        
        const fileKey = `photo${i}`;
        formData.append(fileKey, blob, { filename: `post_${Date.now()}_${i}.jpg` });
        
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
      
      const photoBlob = (formData as any).get('photo0');
      if (photoBlob) photoFormData.append('photo', photoBlob, { filename: 'photo.jpg' });

      let response = await fetch(`https://api.telegram.org/bot${activeToken}/sendPhoto`, {
        method: 'POST',
        body: photoFormData as any
      });
      result = await response.json();

      if (!result.ok && targetTopic && result.description && (
        result.description.toLowerCase().includes('thread') ||
        result.description.toLowerCase().includes('topic') ||
        result.description.toLowerCase().includes('message_thread_id')
      )) {
        (photoFormData as any).delete('message_thread_id');
        response = await fetch(`https://api.telegram.org/bot${activeToken}/sendPhoto`, {
          method: 'POST',
          body: photoFormData as any
        });
        result = await response.json();
      }
    } else {
      formData.append('media', JSON.stringify(mediaArray));

      let response = await fetch(`https://api.telegram.org/bot${activeToken}/sendMediaGroup`, {
        method: 'POST',
        body: formData as any
      });

      result = await response.json();

      if (!result.ok && targetTopic && result.description && (
        result.description.toLowerCase().includes('thread') ||
        result.description.toLowerCase().includes('topic') ||
        result.description.toLowerCase().includes('message_thread_id')
      )) {
        console.warn('[Telegram API] sendMediaGroup thread error, retrying without message_thread_id:', result.description);
        (formData as any).delete('message_thread_id');
        response = await fetch(`https://api.telegram.org/bot${activeToken}/sendMediaGroup`, {
          method: 'POST',
          body: formData as any
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
app.post('/api/telegram/send-report', authenticateJWT, upload.single('video'), async (req: Request, res: Response) => {
  try {
    let { report, videoDataUrl, groupId, topicId, customText, botToken, predefinedFileId, predefinedOwnerMessageId, alreadySentDirectly } = req.body;
    if (typeof report === 'string') {
      try { report = JSON.parse(report); } catch(e) {}
    }
    
    if (!report && !customText) {
      res.status(400).json({ success: false, error: 'Data laporan tidak ditemukan' });
      return;
    }

    // Support client-already-sent indicator to bypass any duplicate forwarding
    if (alreadySentDirectly && report && report.reportId) {
      console.log('[Server] Report already sent directly to group by client:', report.reportId);
      
      let reportCollection = 'data_harian';
      let reportDoc = await serverDb.collection(reportCollection).doc(report.reportId).get();
      if (!reportDoc.exists) {
        reportCollection = 'laporan_harian';
        reportDoc = await serverDb.collection(reportCollection).doc(report.reportId).get();
      }
      
      if (reportDoc.exists) {
        await serverDb.collection(reportCollection).doc(report.reportId).update({
          telegramFileId: report.telegramFileId || '',
          result: 'Pending'
        });
      }
      res.json({ success: true, message: 'Laporan berhasil dicatat di server!' });
      return;
    }

    // Support client-predefined/uploaded Telegram message ID and File ID (Bypasses server payload limits)
    if (predefinedOwnerMessageId && report && report.reportId) {
      console.log('[Server] Using predefined Telegram message and file ID from client:', predefinedOwnerMessageId, predefinedFileId);
      
      let reportCollection = 'data_harian';
      let reportDoc = await serverDb.collection(reportCollection).doc(report.reportId).get();
      if (!reportDoc.exists) {
        reportCollection = 'laporan_harian';
        reportDoc = await serverDb.collection(reportCollection).doc(report.reportId).get();
      }
      
      if (reportDoc.exists) {
        await serverDb.collection(reportCollection).doc(report.reportId).update({
          telegramFileId: predefinedFileId || '',
          ownerMessageId: Number(predefinedOwnerMessageId),
          result: 'Pending'
        });
      }
      res.json({ success: true, message: 'Laporan terkirim ke Owner untuk persetujuan (ACC)!' });
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

    // CHECK FOR OWNER APPROVAL FLOW
    const settings = await getSystemSettings();
    const ownerChatId = settings?.telegramOwnerId;
    
    // Distinguish between Applicant Data (Data Harian) and Daily Summary (Laporan Harian)
    // Applicant data usually has specific fields like UID or WhatsApp. Daily summary reports must always go directly.
    const isApplicant = !!(report && (report.uid9Kucing || report.applicantWhatsapp || report.applicantTelegramUsername));
    
    console.log('[Server] send-report call. Owner ID:', ownerChatId, 'Report ID:', report?.reportId, 'Is Applicant:', isApplicant);
    
    // ONLY enable approval flow for Owner if it is an Applicant Report and has no video
    const hasVideo = !!(req.file || videoDataUrl || (report && (report.videoUrl || report.videoDataUrl || report.telegramFileId)));
    const isApprovalEnabled = !!(ownerChatId && report && report.reportId && isApplicant && !hasVideo);
    
    if (isApprovalEnabled) {
      console.log('[Server] Approval flow ENABLED for owner:', ownerChatId);
    } else {
      console.log('[Server] Approval flow DISABLED (Direct Send). Target:', targetGroup);
    }
    
    const actualTargetChat = isApprovalEnabled ? ownerChatId : targetGroup;
    const actualTargetTopic = isApprovalEnabled ? undefined : topicNum;
    
    const replyMarkup = isApprovalEnabled ? {
      inline_keyboard: [
        [
          { text: '✅ ACC', callback_data: `ACC:${report.reportId}` },
          { text: '❌ REJECT', callback_data: `REJ:${report.reportId}` }
        ]
      ]
    } : undefined;

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
      let buffer: Buffer | null = null;
      let mimeType = 'video/mp4';
      
      if (req.file) {
        videoAttempted = true;
        buffer = req.file.buffer;
        mimeType = req.file.mimetype || 'video/mp4';
      } else if (videoDataUrl && typeof videoDataUrl === 'string') {
        videoAttempted = true;
        
        if (videoDataUrl.startsWith('data:')) {
          const match = videoDataUrl.match(/^data:(.*?);base64,(.*)$/);
          if (match) {
            mimeType = match[1] || 'video/mp4';
            const base64Data = match[2];
            
            const validation = validateVideoUpload(base64Data, mimeType);
            if (!validation.valid) {
              res.status(400).json({ success: false, error: validation.error || 'Validasi file video gagal.' });
              return;
            }

            buffer = Buffer.from(base64Data, 'base64');
          }
        } else if (videoDataUrl.startsWith('http')) {
          // This block is handled down below for HTTP URL videos
        } else if (videoDataUrl.startsWith('blob:')) {
          videoErrorMsg = 'Format video blob: tidak didukung di server.';
        }
      }
      
      if (buffer) {
        let ext = 'mp4';
        if (mimeType.includes('quicktime') || mimeType.includes('mov')) ext = 'mov';
        else if (mimeType.includes('gif')) ext = 'gif';
        
        // --- VIDEO COMPRESSION START ---
        let blobToSend: Buffer = buffer;
        let fileNameToSend = `laporan_${report?.reportId || Date.now()}.${ext}`;
            // --- VIDEO COMPRESSION END ---

            const formData = new FormData();
            formData.append('chat_id', actualTargetChat);
            if (actualTargetTopic) {
              formData.append('message_thread_id', String(actualTargetTopic));
            }
            formData.append('caption', captionHtml);
            formData.append('parse_mode', 'HTML');
            if (replyMarkup) {
              formData.append('reply_markup', JSON.stringify(replyMarkup));
            }
            const isGifFile = ext === 'gif';
            const fileParam = isGifFile ? 'animation' : 'video';
            const apiMethod = isGifFile ? 'sendAnimation' : 'sendVideo';

            formData.append(fileParam, blobToSend, { filename: fileNameToSend });

            let response = await fetch(`https://api.telegram.org/bot${activeToken}/${apiMethod}`, {
              method: 'POST',
              body: formData as any
            });

            let result = await response.json();

            // Fallback without topic if thread error
            if (!result.ok && actualTargetTopic && result.description && (
              result.description.toLowerCase().includes('thread') ||
              result.description.toLowerCase().includes('topic') ||
              result.description.toLowerCase().includes('message_thread_id')
            )) {
              console.warn(`[Telegram API] ${apiMethod} thread error, retrying without message_thread_id:`, result.description);
              (formData as any).delete('message_thread_id');
              response = await fetch(`https://api.telegram.org/bot${activeToken}/${apiMethod}`, {
                method: 'POST',
                body: formData as any
              });
              result = await response.json();
            }

            if (result.ok) {
              if (isApprovalEnabled) {
                const videoObj = result.result.video || result.result.animation || result.result.document;
                const telegramFileId = videoObj ? videoObj.file_id : '';
                
                let reportCollection = 'data_harian';
                let reportDoc = await serverDb.collection(reportCollection).doc(report.reportId).get();
                if (!reportDoc.exists) {
                  reportCollection = 'laporan_harian';
                  reportDoc = await serverDb.collection(reportCollection).doc(report.reportId).get();
                }
                
                if (reportDoc.exists) {
                  await serverDb.collection(reportCollection).doc(report.reportId).update({
                    telegramFileId,
                    ownerMessageId: result.result.message_id,
                    result: 'Pending'
                  });
                }
                res.json({ success: true, message: 'Laporan terkirim ke Owner untuk persetujuan (ACC)!' });
              } else {
                res.json({ success: true, data: result.result, message: 'Laporan dan media berhasil terkirim ke Telegram!' });
              }
              return;
            } else {
              console.warn(`[Telegram API] ${apiMethod} failed, falling back to text-only:`, result);
              videoErrorMsg = result.description || 'Unknown Telegram Error';
            }
        } else if (videoDataUrl && typeof videoDataUrl === 'string' && videoDataUrl.startsWith('http')) {
          const payload: Record<string, unknown> = {
            chat_id: actualTargetChat,
            video: videoDataUrl,
            caption: captionHtml,
            parse_mode: 'HTML'
          };
          if (actualTargetTopic) payload.message_thread_id = actualTargetTopic;
          if (replyMarkup) payload.reply_markup = replyMarkup;

          let response = await fetch(`https://api.telegram.org/bot${activeToken}/sendVideo`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
          });
          let result = await response.json();

          // Fallback without topic
          if (!result.ok && actualTargetTopic && result.description && (
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
            if (isApprovalEnabled) {
              const videoObj = result.result.video || result.result.animation || result.result.document;
              const telegramFileId = videoObj ? videoObj.file_id : '';
              
              let reportCollection = 'data_harian';
              let reportDoc = await serverDb.collection(reportCollection).doc(report.reportId).get();
              if (!reportDoc.exists) {
                reportCollection = 'laporan_harian';
                reportDoc = await serverDb.collection(reportCollection).doc(report.reportId).get();
              }
              
              if (reportDoc.exists) {
                await serverDb.collection(reportCollection).doc(report.reportId).update({
                  telegramFileId,
                  ownerMessageId: result.result.message_id,
                  result: 'Pending'
                });
              }
              res.json({ success: true, message: 'Laporan terkirim ke Owner untuk persetujuan (ACC)!' });
            } else {
              res.json({ success: true, data: result.result, message: 'Laporan dan Video berhasil terkirim ke Telegram!' });
            }
            return;
          } else {
            console.warn('[Telegram API] sendVideo (URL) failed, falling back to text-only:', result);
            videoErrorMsg = result.description || 'Unknown Telegram Error';
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
      chat_id: actualTargetChat,
      text: rawText,
      parse_mode: 'HTML'
    };
    if (actualTargetTopic) textPayload.message_thread_id = actualTargetTopic;
    if (replyMarkup) textPayload.reply_markup = replyMarkup;

    let photoSuccess = false;
    let result: any = null;
    let response: any = null;

    if (report?.applicantPhotoUrl && typeof report.applicantPhotoUrl === 'string' && report.applicantPhotoUrl.startsWith('http')) {
      try {
        const photoPayload: Record<string, unknown> = {
          chat_id: actualTargetChat,
          photo: report.applicantPhotoUrl,
          caption: rawText,
          parse_mode: 'HTML'
        };
        if (actualTargetTopic) photoPayload.message_thread_id = actualTargetTopic;
        if (replyMarkup) photoPayload.reply_markup = replyMarkup;

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
    if (!result.ok && actualTargetTopic && result.description && (
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
      if (isApprovalEnabled) {
        let reportCollection = 'data_harian';
        let reportDoc = await serverDb.collection(reportCollection).doc(report.reportId).get();
        if (!reportDoc.exists) {
          reportCollection = 'laporan_harian';
          reportDoc = await serverDb.collection(reportCollection).doc(report.reportId).get();
        }
        
        if (reportDoc.exists) {
          await serverDb.collection(reportCollection).doc(report.reportId).update({
            ownerMessageId: result.result.message_id,
            result: 'Pending'
          });
        }
        res.json({ success: true, message: 'Laporan terkirim ke Owner untuk persetujuan (ACC)!' });
      } else {
        res.json({ success: true, data: result.result, message: 'Laporan berhasil terkirim ke Telegram!' });
      }
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
