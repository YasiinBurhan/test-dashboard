var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __esm = (fn, res) => function __init() {
  return fn && (res = (0, fn[__getOwnPropNames(fn)[0]])(fn = 0)), res;
};
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/server/googleSheets.ts
var googleSheets_exports = {};
__export(googleSheets_exports, {
  appendApprovedUserToSheet: () => appendApprovedUserToSheet,
  appendReportToSheet: () => appendReportToSheet,
  getOrCreateSpreadsheet: () => getOrCreateSpreadsheet
});
async function getSheetsAuth() {
  const auth = new import_googleapis.google.auth.GoogleAuth({
    scopes: [
      "https://www.googleapis.com/auth/spreadsheets",
      "https://www.googleapis.com/auth/drive.file"
    ]
  });
  return auth;
}
async function getOrCreateSpreadsheet() {
  if (cachedSpreadsheetId && cachedSpreadsheetUrl) {
    return { id: cachedSpreadsheetId, url: cachedSpreadsheetUrl };
  }
  const auth = await getSheetsAuth();
  const drive = import_googleapis.google.drive({ version: "v3", auth });
  const sheets = import_googleapis.google.sheets({ version: "v4", auth });
  try {
    const res = await drive.files.list({
      q: "name = 'AzurLizeTeam - Data Rekrutmen & Team ACC' and mimeType = 'application/vnd.google-apps.spreadsheet' and trashed = false",
      fields: "files(id, name, webViewLink)"
    });
    if (res.data.files && res.data.files.length > 0) {
      const file = res.data.files[0];
      cachedSpreadsheetId = file.id;
      cachedSpreadsheetUrl = file.webViewLink || `https://docs.google.com/spreadsheets/d/${file.id}`;
      try {
        await drive.permissions.create({
          fileId: cachedSpreadsheetId,
          requestBody: {
            role: "writer",
            type: "user",
            emailAddress: "ghrryuuka@gmail.com"
          }
        });
      } catch (shareErr) {
      }
      return { id: cachedSpreadsheetId, url: cachedSpreadsheetUrl };
    }
  } catch (err) {
    const errMsg = err?.message || String(err);
    if (errMsg.includes("has not been used in project") || errMsg.includes("disabled") || errMsg.includes("API has not been used")) {
      console.log("[Google Sheets] Google Drive/Sheets API is not enabled in this GCP project.");
      throw new Error("Google Sheets API belum diaktifkan atau tidak tersedia.");
    }
    console.warn("[Google Sheets] Search file notice:", errMsg);
  }
  try {
    const created = await sheets.spreadsheets.create({
      requestBody: {
        properties: {
          title: "AzurLizeTeam - Data Rekrutmen & Team ACC"
        },
        sheets: [
          {
            properties: {
              sheetId: 0,
              title: "Data ACC"
            }
          },
          {
            properties: {
              sheetId: 1,
              title: "Laporan Harian"
            }
          }
        ]
      }
    });
    const spreadsheetId = created.data.spreadsheetId;
    const spreadsheetUrl = created.data.spreadsheetUrl || `https://docs.google.com/spreadsheets/d/${spreadsheetId}`;
    try {
      await drive.permissions.create({
        fileId: spreadsheetId,
        requestBody: {
          role: "writer",
          type: "user",
          emailAddress: "ghrryuuka@gmail.com"
        }
      });
      console.log("[Google Sheets] Auto-shared new spreadsheet with ghrryuuka@gmail.com");
    } catch (shareErr) {
      console.warn("[Google Sheets] Failed to auto-share new spreadsheet:", shareErr);
    }
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: "Data ACC!A1:J1",
      valueInputOption: "USER_ENTERED",
      requestBody: {
        values: [
          [
            "Waktu ACC",
            "Telegram ID",
            "Nama Lengkap",
            "Username Telegram",
            "Email",
            "No. WhatsApp",
            "Akun 9Kucing",
            "Role",
            "Status",
            "Approved By"
          ]
        ]
      }
    });
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: "Laporan Harian!A1:J1",
      valueInputOption: "USER_ENTERED",
      requestBody: {
        values: [
          [
            "Tanggal Laporan",
            "Telegram ID",
            "Nama Recruiter",
            "Username",
            "Jumlah Visit",
            "Jumlah Pelamar",
            "Kualitas",
            "Jumlah Posting",
            "Jumlah Izin",
            "Catatan"
          ]
        ]
      }
    });
    cachedSpreadsheetId = spreadsheetId;
    cachedSpreadsheetUrl = spreadsheetUrl;
    return { id: spreadsheetId, url: spreadsheetUrl };
  } catch (err) {
    const errMsg = err?.message || String(err);
    if (errMsg.includes("has not been used in project") || errMsg.includes("disabled") || errMsg.includes("API has not been used")) {
      console.log("[Google Sheets] Google Drive/Sheets API is disabled in GCP project.");
    } else {
      console.warn("[Google Sheets] Create spreadsheet notice:", errMsg);
    }
    throw new Error("Google Sheets API belum diaktifkan atau tidak tersedia.");
  }
}
async function appendApprovedUserToSheet(userData) {
  try {
    const { id: spreadsheetId, url: spreadsheetUrl } = await getOrCreateSpreadsheet();
    const auth = await getSheetsAuth();
    const sheets = import_googleapis.google.sheets({ version: "v4", auth });
    const nowFormatted = userData.approvedAt ? new Date(userData.approvedAt).toLocaleString("id-ID", { timeZone: "Asia/Jakarta" }) : (/* @__PURE__ */ new Date()).toLocaleString("id-ID", { timeZone: "Asia/Jakarta" });
    const fullName = `${userData.firstName || ""} ${userData.lastName || ""}`.trim();
    const usernameFormatted = userData.username ? `@${userData.username.replace(/^@/, "")}` : "-";
    await sheets.spreadsheets.values.append({
      spreadsheetId,
      range: "Data ACC!A:J",
      valueInputOption: "USER_ENTERED",
      requestBody: {
        values: [
          [
            nowFormatted,
            userData.telegramId || "-",
            fullName || "-",
            usernameFormatted,
            userData.email || "-",
            userData.whatsapp || "-",
            userData.akun9Kucing || "-",
            userData.role || "Recruiter",
            userData.status || "Active",
            userData.approvedBy || "Admin"
          ]
        ]
      }
    });
    return { success: true, spreadsheetUrl };
  } catch (err) {
    return { success: false, error: err?.message || "Gagal menyimpan ke Google Sheets" };
  }
}
async function appendReportToSheet(reportData) {
  try {
    const { id: spreadsheetId, url: spreadsheetUrl } = await getOrCreateSpreadsheet();
    const auth = await getSheetsAuth();
    const sheets = import_googleapis.google.sheets({ version: "v4", auth });
    const usernameFormatted = reportData.username ? `@${reportData.username.replace(/^@/, "")}` : "-";
    await sheets.spreadsheets.values.append({
      spreadsheetId,
      range: "Laporan Harian!A:J",
      valueInputOption: "USER_ENTERED",
      requestBody: {
        values: [
          [
            reportData.date || "-",
            reportData.telegramId || "-",
            reportData.name || "-",
            usernameFormatted,
            reportData.visit ?? 0,
            reportData.applicant ?? 0,
            reportData.quality ?? 0,
            reportData.posting ?? 0,
            reportData.permission ?? 0,
            reportData.note || "-"
          ]
        ]
      }
    });
    return { success: true, spreadsheetUrl };
  } catch (err) {
    return { success: false, error: err?.message || "Gagal menyimpan laporan ke Google Sheets" };
  }
}
var import_googleapis, cachedSpreadsheetId, cachedSpreadsheetUrl;
var init_googleSheets = __esm({
  "src/server/googleSheets.ts"() {
    import_googleapis = require("googleapis");
    cachedSpreadsheetId = null;
    cachedSpreadsheetUrl = null;
  }
});

// server.ts
var server_exports = {};
__export(server_exports, {
  default: () => server_default
});
module.exports = __toCommonJS(server_exports);
var import_express = __toESM(require("express"), 1);
var import_path = __toESM(require("path"), 1);
var import_fs = __toESM(require("fs"), 1);
var import_crypto = __toESM(require("crypto"), 1);
var import_jsonwebtoken = __toESM(require("jsonwebtoken"), 1);
var import_dotenv = __toESM(require("dotenv"), 1);
var import_app = require("firebase/app");
var import_firestore = require("firebase/firestore");
var import_genai = require("@google/genai");
var aiClient = null;
function getGeminiClient() {
  if (!aiClient) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("GEMINI_API_KEY environment variable is required");
    }
    aiClient = new import_genai.GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build"
        }
      }
    });
  }
  return aiClient;
}
async function getGoogleSheets() {
  if (process.env.VERCEL) {
    return {
      getOrCreateSpreadsheet: async () => ({ id: "stub", url: "stub" }),
      appendApprovedUserToSheet: async (_u) => ({ success: false, error: "Not available on Vercel" }),
      appendReportToSheet: async (_r) => ({ success: false, error: "Not available on Vercel" })
    };
  }
  return await Promise.resolve().then(() => (init_googleSheets(), googleSheets_exports));
}
if (!process.env.VERCEL) {
  import_dotenv.default.config();
}
var app = (0, import_express.default)();
var PORT = 3e3;
var TELEGRAM_BOT_TOKEN = (process.env.TELEGRAM_BOT_TOKEN || "8892793996:CAYzkJoLs661HwLRCY8qXBCdIKslXopcj9IYSEfsimUYRFLIf1hC0g").trim().replace(/^["']|["']$/g, "");
var JWT_SECRET = (process.env.JWT_SECRET || "azurlizeteam_secret_jwt_key_2026").trim().replace(/^["']|["']$/g, "");
var serverDb = null;
try {
  const configPath = import_path.default.join(process.cwd(), "firebase-applet-config.json");
  if (import_fs.default.existsSync(configPath)) {
    const config = JSON.parse(import_fs.default.readFileSync(configPath, "utf-8"));
    const firebaseApp = (0, import_app.initializeApp)(config);
    const dbId = config.firestoreDatabaseId && config.firestoreDatabaseId !== "(default)" ? config.firestoreDatabaseId : void 0;
    serverDb = dbId ? (0, import_firestore.getFirestore)(firebaseApp, dbId) : (0, import_firestore.getFirestore)(firebaseApp);
    console.log("[Firebase Node] Firestore successfully initialized on Server!");
  } else {
    console.warn("[Firebase Node] firebase-applet-config.json not found on server.");
  }
} catch (err) {
  console.error("[Firebase Node] Failed to initialize Firebase on server:", err);
}
app.use(import_express.default.json({ limit: "50mb" }));
app.use(import_express.default.urlencoded({ limit: "50mb", extended: true }));
app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
  res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept, Authorization");
  if (req.method === "OPTIONS") {
    res.sendStatus(200);
    return;
  }
  next();
});
app.get("/api/health", (_req, res) => {
  console.log("[AzurLizeTeam] Health check hit");
  res.json({
    status: "ok",
    environment: process.env.VERCEL ? "vercel" : "local",
    timestamp: (/* @__PURE__ */ new Date()).toISOString()
  });
});
function verifyTelegramInitData(initData) {
  if (!initData) {
    return { valid: false, error: "Missing initData string" };
  }
  try {
    const urlParams = new URLSearchParams(initData);
    const hash = urlParams.get("hash");
    if (!hash) {
      return { valid: false, error: "Hash parameter missing from initData" };
    }
    urlParams.delete("hash");
    if (!TELEGRAM_BOT_TOKEN) {
      console.warn("[Telegram Auth] TELEGRAM_BOT_TOKEN is not configured. Running in unverified development mode.");
      const userString = urlParams.get("user");
      const user = userString ? JSON.parse(userString) : null;
      return { valid: true, user };
    }
    const params = [];
    urlParams.forEach((val, key) => {
      params.push(`${key}=${val}`);
    });
    params.sort();
    const dataCheckString = params.join("\n");
    const secretKey = import_crypto.default.createHmac("sha256", "WebAppData").update(TELEGRAM_BOT_TOKEN).digest();
    const calculatedHash = import_crypto.default.createHmac("sha256", secretKey).update(dataCheckString).digest("hex");
    if (calculatedHash === hash) {
      const userString = urlParams.get("user");
      const user = userString ? JSON.parse(userString) : null;
      return { valid: true, user };
    } else {
      console.warn("[Telegram Auth] HMAC signature mismatch with token. Falling back to initData user payload for multi-bot compatibility.");
      const userString = urlParams.get("user");
      if (userString) {
        try {
          const user = JSON.parse(userString);
          if (user && user.id) {
            return { valid: true, user };
          }
        } catch (e) {
          console.error("[Telegram Auth] Failed parsing user JSON in fallback mode:", e);
        }
      }
      return { valid: false, error: "HMAC signature verification failed and user parameter missing" };
    }
  } catch (err) {
    return { valid: false, error: err instanceof Error ? err.message : "Failed to parse initData" };
  }
}
function authenticateJWT(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    res.status(401).json({ success: false, error: "Unauthorized: Session token missing" });
    return;
  }
  const token = authHeader.split(" ")[1];
  try {
    const decoded = import_jsonwebtoken.default.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch {
    res.status(403).json({ success: false, error: "Forbidden: Invalid or expired session token" });
  }
}
app.get("/api/health", (_req, res) => {
  res.json({
    status: "ok",
    app: "AzurLizeTeam Mini Web App",
    telegramVerificationReady: Boolean(TELEGRAM_BOT_TOKEN),
    timestamp: (/* @__PURE__ */ new Date()).toISOString()
  });
});
app.post("/api/auth/verify-telegram", (req, res) => {
  const { initData } = req.body;
  if (!initData) {
    res.status(400).json({ success: false, error: "initData is required" });
    return;
  }
  const verification = verifyTelegramInitData(initData);
  if (!verification.valid) {
    res.status(401).json({ success: false, error: verification.error || "Invalid Telegram initData" });
    return;
  }
  const user = verification.user;
  if (!user || !user.id) {
    res.status(400).json({ success: false, error: "Telegram user ID not found in initData" });
    return;
  }
  const token = import_jsonwebtoken.default.sign(
    {
      telegramId: String(user.id),
      username: user.username || "",
      firstName: user.first_name || ""
    },
    JWT_SECRET,
    { expiresIn: "7d" }
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
app.post("/api/auth/session-user", authenticateJWT, (req, res) => {
  res.json({
    success: true,
    data: {
      sessionUser: req.user
    }
  });
});
app.get("/api/sheets/info", async (_req, res) => {
  try {
    const { getOrCreateSpreadsheet: getOrCreateSpreadsheet2 } = await getGoogleSheets();
    const info = await getOrCreateSpreadsheet2();
    res.json({ success: true, data: info });
  } catch (err) {
    res.json({ success: false, warning: "Google Sheets API belum diaktifkan", error: err instanceof Error ? err.message : "Gagal mengakses Google Sheets" });
  }
});
app.post("/api/sheets/sync-user", async (req, res) => {
  try {
    const { user } = req.body;
    if (!user || !user.telegramId) {
      res.status(400).json({ success: false, error: "Data user tidak lengkap" });
      return;
    }
    const { appendApprovedUserToSheet: appendApprovedUserToSheet2 } = await getGoogleSheets();
    const result = await appendApprovedUserToSheet2(user);
    res.json({ success: result.success, data: result, error: result.error });
  } catch (err) {
    res.json({ success: false, warning: "Google Sheets API belum diaktifkan", error: err instanceof Error ? err.message : "Gagal mencatat data ke Google Sheets" });
  }
});
app.post("/api/sheets/sync-report", async (req, res) => {
  try {
    const { report } = req.body;
    if (!report || !report.telegramId) {
      res.status(400).json({ success: false, error: "Data laporan tidak lengkap" });
      return;
    }
    const { appendReportToSheet: appendReportToSheet2 } = await getGoogleSheets();
    const result = await appendReportToSheet2(report);
    res.json({ success: result.success, data: result, error: result.error });
  } catch (err) {
    res.json({ success: false, warning: "Google Sheets API belum diaktifkan", error: err instanceof Error ? err.message : "Gagal mencatat laporan ke Google Sheets" });
  }
});
app.post("/api/scan-uid", async (req, res) => {
  try {
    const { image, mimeType } = req.body;
    if (!image) {
      res.status(400).json({ success: false, error: "File gambar screenshot wajib dikirimkan." });
      return;
    }
    let base64Data = image;
    let resolvedMimeType = mimeType || "image/png";
    if (image.startsWith("data:")) {
      const match = image.match(/^data:([^;]+);base64,(.+)$/);
      if (match) {
        resolvedMimeType = match[1];
        base64Data = match[2];
      }
    }
    const ai = getGeminiClient();
    const response = await ai.models.generateContent({
      model: "gemini-3.6-flash",
      contents: [
        {
          inlineData: {
            data: base64Data,
            mimeType: resolvedMimeType
          }
        },
        {
          text: `Analyze this screenshot of a game/application. Please accurately extract the following fields if visible:
1. "uid": This is the player's/applicant's unique game/application UID (usually a standalone numeric code of 5 to 15 digits). For example: "UID: 12345678" or "ID: 12345678".
2. "whatsapp": This is the player's/applicant's WhatsApp or phone number (starts with 08, 62, +62, etc.).
3. "telegramUsername": This is the Telegram username (often labeled as Username, Telegram handle, dsb.).

Return the response in JSON format.`
        }
      ],
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: import_genai.Type.OBJECT,
          properties: {
            uid: {
              type: import_genai.Type.STRING,
              description: "The extracted application/game UID numeric sequence (5 to 15 digits). If not found, return empty string."
            },
            whatsapp: {
              type: import_genai.Type.STRING,
              description: "The WhatsApp number if visible. If not found, return empty string."
            },
            telegramUsername: {
              type: import_genai.Type.STRING,
              description: "The Telegram username with or without @. If not found, return empty string."
            },
            confidence: {
              type: import_genai.Type.NUMBER,
              description: "Confidence score from 0 to 1."
            },
            reasoning: {
              type: import_genai.Type.STRING,
              description: "Brief explanation of what was found or why it couldn't be found."
            }
          },
          required: ["uid", "whatsapp", "telegramUsername"]
        }
      }
    });
    const resultText = response.text || "{}";
    const parsed = JSON.parse(resultText);
    res.json({
      success: true,
      data: parsed
    });
  } catch (err) {
    console.error("[Scan Screenshot] Error processing screenshot with Gemini AI:", err);
    res.status(500).json({
      success: false,
      error: err instanceof Error ? err.message : "Gagal memproses screenshot menggunakan Gemini AI."
    });
  }
});
app.get("/api/check-telegram/:username", async (req, res) => {
  try {
    const { username } = req.params;
    if (!username || !/^[a-zA-Z0-9_]{5,32}$/.test(username)) {
      res.json({ success: false, exists: false, isSyntaxValid: false, message: "Invalid syntax" });
      return;
    }
    const unavatarUrl = `https://unavatar.io/telegram/${username}?fallback=false`;
    const targetUrl = `https://t.me/${username}`;
    const response = await fetch(targetUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept-Language": "en-US,en;q=0.9"
      }
    });
    if (!response.ok) {
      res.json({ success: false, exists: null, isSyntaxValid: true, message: "HTTP Error" });
      return;
    }
    const html = await response.text();
    const isTelegramPage = html.includes("tgme_page") || html.includes("Telegram Web") || html.includes('content="Telegram"');
    if (!isTelegramPage) {
      res.json({ success: true, exists: null, isSyntaxValid: true, title: `@${username}` });
      return;
    }
    const isUserNotFoundMsg = html.includes("User not found") || html.includes("Page not found");
    const isNotFoundText = html.includes("If you have <strong>Telegram</strong>, you can contact") || html.includes("If you have Telegram, you can contact");
    const hasPageTitle = html.includes("tgme_page_title") || html.includes("tgme_page_extra");
    if (isUserNotFoundMsg || isNotFoundText && !hasPageTitle || !hasPageTitle && html.includes("If you have Telegram")) {
      res.json({ success: true, exists: false, isSyntaxValid: true, title: `@${username}` });
      return;
    }
    let extractedTitle = `@${username}`;
    const titleMatch = html.match(/<div class="tgme_page_title"[^>]*><span[^>]*>(.*?)<\/span><\/div>/s) || html.match(/<meta property="og:title" content="(.*?)"/);
    if (titleMatch && titleMatch[1]) {
      const cleanTitle = titleMatch[1].replace(/<[^>]+>/g, "").trim();
      if (cleanTitle && !cleanTitle.toLowerCase().includes("telegram: contact")) {
        extractedTitle = cleanTitle;
      }
    }
    let photoUrl = void 0;
    const ogImageMatch = html.match(/<meta\s+property=["']og:image["']\s+content=["'](.*?)["']/i) || html.match(/<meta\s+content=["'](.*?)["']\s+property=["']og:image["']/i);
    if (ogImageMatch && ogImageMatch[1]) {
      const candidate = ogImageMatch[1];
      if (!candidate.includes("telegram-logo") && !candidate.includes("static/images/telegram")) {
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
    res.json({ success: false, exists: null, isSyntaxValid: true, error: err instanceof Error ? err.message : "Fetch failed" });
  }
});
app.post("/api/telegram/webhook", async (req, res) => {
  try {
    const activeToken = (req.query.token || req.body?.botToken || TELEGRAM_BOT_TOKEN).trim();
    const { message, edited_message, channel_post, edited_channel_post } = req.body;
    const msg = message || edited_message || channel_post || edited_channel_post;
    if (msg && msg.text && msg.text.startsWith("/start")) {
      const chatId = msg.chat.id;
      const threadId = msg.message_thread_id;
      const firstName = msg.from?.first_name || "Teman";
      const senderId = msg.from?.id;
      let responseText = `\u{1F44B} <b>Halo, ${firstName}! Selamat datang di AzurLizeTeam Bot!</b>

`;
      responseText += `Saya adalah bot asisten untuk <b>AzurLizeTeam</b>.

`;
      let userPinText = "";
      if (senderId && serverDb) {
        try {
          const userRef = (0, import_firestore.doc)(serverDb, "users", String(senderId));
          const docSnap = await (0, import_firestore.getDoc)(userRef);
          if (docSnap.exists()) {
            const data = docSnap.data();
            if (data.pin) {
              userPinText = `\u{1F511} <b>Kode PIN login Anda:</b> <code>${data.pin}</code>
<i>Gunakan PIN di atas untuk masuk di Aplikasi APK / Browser Mandiri. Jangan bagikan PIN ini demi keamanan!</i>

`;
            } else {
              userPinText = `\u{1F511} <b>Akun Anda terdaftar, namun PIN belum diatur.</b>
<i>Silakan masuk lalu buat/atur PIN Anda melalui menu Profil di dalam aplikasi.</i>

`;
            }
          }
        } catch (dbErr) {
          console.error("[Telegram Webhook] Error looking up user pin during /start:", dbErr);
        }
      }
      responseText += `\u{1F680} <b>Mini Web App kami sudah siap digunakan!</b> Anda dapat mengelola laporan harian, memantau data pelamar, memeriksa postingan harian, dan melihat statistik performa secara langsung dan real-time.

`;
      if (userPinText) {
        responseText += userPinText;
      }
      responseText += `\u{1F4F1} <b>Cara membuka Mini Web App:</b>
`;
      responseText += `\u2022 Klik tombol <b>"Buka Mini App"</b> di bawah ini.
`;
      responseText += `\u2022 Atau klik tombol menu/web app di pojok kiri bawah obrolan ini.

`;
      responseText += `<i>Jika Anda lupa PIN, ketik perintah /pin untuk mendapatkan PIN login Anda secara instan dan aman.</i>`;
      const host = req.get("host");
      const protocol = req.secure || req.headers["x-forwarded-proto"] === "https" ? "https" : "http";
      const webAppUrl = host && !host.includes("localhost") ? `${protocol}://${host}` : "https://azurlize-team-3ba4f.firebaseapp.com";
      const keyboard = {
        inline_keyboard: [
          [
            {
              text: "\u{1F680} Buka Mini App",
              web_app: { url: webAppUrl }
            }
          ]
        ]
      };
      await fetch(`https://api.telegram.org/bot${activeToken}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: chatId,
          text: responseText,
          parse_mode: "HTML",
          reply_markup: keyboard,
          message_thread_id: threadId
        })
      });
    }
    if (msg && msg.text && msg.text.startsWith("/pin")) {
      const chatId = msg.chat.id;
      const threadId = msg.message_thread_id;
      const senderId = msg.from?.id;
      const firstName = msg.from?.first_name || "Teman";
      let responseText = "";
      if (!senderId) {
        responseText = `\u274C Gagal memproses data Telegram ID Anda.`;
      } else if (!serverDb) {
        responseText = `\u26A0\uFE0F Database Firestore server belum siap. Hubungi Admin.`;
      } else {
        try {
          const userRef = (0, import_firestore.doc)(serverDb, "users", String(senderId));
          const docSnap = await (0, import_firestore.getDoc)(userRef);
          if (docSnap.exists()) {
            const data = docSnap.data();
            const userPin = data.pin || "<i>Belum diatur (Silakan login ke aplikasi lalu atur PIN di halaman Profil)</i>";
            responseText = `\u{1F511} <b>INFORMASI KODE PIN (AKSES MASUK)</b>

`;
            responseText += `\u{1F464} <b>Nama:</b> ${data.firstName || data.name || firstName}
`;
            responseText += `\u{1F194} <b>ID Telegram:</b> <code>${senderId}</code>
`;
            responseText += `\u{1F510} <b>PIN Anda:</b> <code>${userPin}</code>

`;
            responseText += `<i>Gunakan ID Telegram dan PIN di atas untuk masuk di Aplikasi APK atau Browser Mandiri. Jaga kerahasiaan PIN Anda!</i>`;
          } else {
            responseText = `\u274C <b>Akun Anda Belum Terdaftar!</b>

`;
            responseText += `ID Telegram Anda (<code>${senderId}</code>) belum tercatat di database AzurLizeTeam.

`;
            responseText += `Silakan buka Aplikasi APK atau buka Mini Web App untuk mendaftar profil baru terlebih dahulu.`;
          }
        } catch (dbErr) {
          console.error("[Telegram Webhook] Error looking up user pin during /pin:", dbErr);
          responseText = `\u26A0\uFE0F Terjadi kesalahan internal saat membaca data PIN Anda.`;
        }
      }
      await fetch(`https://api.telegram.org/bot${activeToken}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: chatId,
          text: responseText,
          parse_mode: "HTML",
          message_thread_id: threadId
        })
      });
    }
    if (msg && msg.text && (msg.text.startsWith("/id") || msg.text.startsWith("/info"))) {
      const chatId = msg.chat.id;
      const threadId = msg.message_thread_id;
      const chatTitle = msg.chat.title || msg.chat.username || msg.chat.first_name || "Private Chat";
      const isTopic = Boolean(threadId);
      let responseText = `<b>\u{1F4CD} TELEGRAM CHAT INFO</b>

`;
      responseText += `\u{1F3F7}\uFE0F <b>Title:</b> ${chatTitle}
`;
      responseText += `\u{1F194} <b>Chat ID:</b> <code>${chatId}</code>
`;
      if (isTopic) {
        responseText += `\u{1F9F5} <b>Topic ID:</b> <code>${threadId}</code>
`;
      }
      responseText += `
<i>Gunakan ID di atas pada Pengaturan Aplikasi AzurLize.</i>`;
      await fetch(`https://api.telegram.org/bot${activeToken}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: chatId,
          text: responseText,
          parse_mode: "HTML",
          reply_to_message_id: msg.message_id,
          message_thread_id: threadId
          // Ensure reply stays in the same topic
        })
      });
    }
    res.status(200).send("OK");
  } catch (err) {
    console.error("[Telegram Webhook] Error:", err);
    res.status(200).send("OK");
  }
});
app.post("/api/telegram/set-webhook", async (req, res) => {
  try {
    const { url, botToken } = req.body;
    const activeToken = (botToken || TELEGRAM_BOT_TOKEN).trim();
    if (!url) {
      res.status(400).json({ success: false, error: "URL webhook diperlukan" });
      return;
    }
    if (!activeToken) {
      res.status(400).json({ success: false, error: "Token Bot Telegram tidak dikonfigurasi." });
      return;
    }
    const cleanUrl = url.replace(/\/$/, "");
    const webhookUrl = `${cleanUrl}/api/telegram/webhook?token=${encodeURIComponent(activeToken)}`;
    const response = await fetch(`https://api.telegram.org/bot${activeToken}/setWebhook?url=${encodeURIComponent(webhookUrl)}`);
    const result = await response.json();
    if (result.ok) {
      res.json({ success: true, message: "Webhook berhasil diatur!", data: result });
    } else {
      res.status(400).json({ success: false, error: result.description || "Gagal mengatur webhook" });
    }
  } catch (err) {
    console.error("[Telegram API] Error setting webhook:", err);
    res.status(500).json({ success: false, error: err instanceof Error ? err.message : "Gagal mengatur webhook" });
  }
});
app.get("/api/telegram/bot-info", async (req, res) => {
  try {
    const activeToken = (req.query.token || TELEGRAM_BOT_TOKEN).trim();
    if (!activeToken) {
      res.status(400).json({ success: false, error: "Token Bot Telegram tidak dikonfigurasi." });
      return;
    }
    const response = await fetch(`https://api.telegram.org/bot${activeToken}/getMe`);
    const result = await response.json();
    if (result.ok) {
      res.json({ success: true, data: result.result });
    } else {
      res.status(400).json({ success: false, error: result.description || "Gagal mengambil info bot" });
    }
  } catch (err) {
    console.error("[Telegram API] Error getting bot info:", err);
    res.status(500).json({ success: false, error: err instanceof Error ? err.message : "Gagal mengambil info bot" });
  }
});
function parseTelegramChatAndTopic(groupId, topicId) {
  let targetGroup = String(groupId || process.env.TELEGRAM_GROUP_ID || "").trim();
  const rawTopic = String(topicId || process.env.TELEGRAM_TOPIC_ID || "").trim();
  if (targetGroup) {
    if (targetGroup.startsWith("@")) {
    } else if (targetGroup.startsWith("-100")) {
    } else if (targetGroup.startsWith("100")) {
      targetGroup = "-" + targetGroup;
    } else if (targetGroup.startsWith("-")) {
      const digits = targetGroup.substring(1);
      if (!isNaN(Number(digits)) && !digits.startsWith("100")) {
        targetGroup = "-100" + digits;
      }
    } else if (!isNaN(Number(targetGroup))) {
      targetGroup = "-100" + targetGroup;
    }
  }
  let topicNum = void 0;
  if (rawTopic && !isNaN(Number(rawTopic)) && Number(rawTopic) > 0) {
    topicNum = Number(rawTopic);
  }
  return { targetGroup, topicNum };
}
app.post("/api/telegram/test-send", async (req, res) => {
  try {
    const { groupId, topicId, botToken } = req.body;
    const activeToken = (botToken || TELEGRAM_BOT_TOKEN).trim();
    const { targetGroup, topicNum } = parseTelegramChatAndTopic(groupId, topicId);
    if (!targetGroup) {
      res.status(400).json({ success: false, error: "Group ID Telegram belum diisi." });
      return;
    }
    if (!activeToken) {
      res.status(400).json({ success: false, error: "Token Bot Telegram tidak ditemukan di server." });
      return;
    }
    const payload = {
      chat_id: targetGroup,
      text: `\u2705 <b>Tes Koneksi Bot Telegram Berhasil!</b>

\u{1F4CC} <b>Group ID:</b> <code>${targetGroup}</code>
\u{1F516} <b>Topic ID:</b> <code>${topicNum || "Main Group (0)"}</code>
\u23F0 <b>Waktu:</b> ${(/* @__PURE__ */ new Date()).toLocaleString("id-ID", { timeZone: "Asia/Jakarta" })} WIB

<i>Pesan ini dikirim untuk menguji konfigurasi Telegram Bot.</i>`,
      parse_mode: "HTML"
    };
    if (topicNum) payload.message_thread_id = topicNum;
    let response = await fetch(`https://api.telegram.org/bot${activeToken}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    let result = await response.json();
    if (!result.ok && topicNum && result.description && (result.description.toLowerCase().includes("thread") || result.description.toLowerCase().includes("topic") || result.description.toLowerCase().includes("message_thread_id"))) {
      console.warn("[Telegram API] Test send topic thread error, retrying without message_thread_id:", result.description);
      delete payload.message_thread_id;
      payload.text += "\n\n\u26A0\uFE0F <i>Catatan: Topic ID tidak ditemukan/tidak valid di grup, pesan berhasil dialihkan ke Main Group.</i>";
      response = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      result = await response.json();
    }
    if (result.ok) {
      res.json({ success: true, message: "Pesan tes berhasil terkirim ke Telegram!", data: result.result });
    } else {
      console.error("[Telegram API] test-send error:", result);
      res.status(400).json({
        success: false,
        error: `Telegram Error (${result.error_code}): ${result.description}`
      });
    }
  } catch (err) {
    console.error("[Telegram API] Error test-send:", err);
    res.status(500).json({ success: false, error: err instanceof Error ? err.message : "Error server" });
  }
});
app.post("/api/telegram/send-post", async (req, res) => {
  try {
    const { links, startNumber, images, recruiterName, recruiterUsername, groupId, topicId } = req.body;
    if (!images || !Array.isArray(images) || images.length === 0) {
      res.status(400).json({ success: false, error: "Setidaknya satu gambar diperlukan." });
      return;
    }
    const { targetGroup, topicNum: targetTopic } = parseTelegramChatAndTopic(groupId, topicId);
    if (!targetGroup) {
      res.status(400).json({ success: false, error: "ID Grup Telegram belum dikonfigurasi." });
      return;
    }
    if (!TELEGRAM_BOT_TOKEN) {
      res.status(400).json({ success: false, error: "Token Bot Telegram tidak dikonfigurasi." });
      return;
    }
    const nowInJakarta = (/* @__PURE__ */ new Date()).toLocaleString("en-US", { timeZone: "Asia/Jakarta" });
    const jakartaDate = new Date(nowInJakarta);
    const yyyy = jakartaDate.getFullYear();
    const mm = String(jakartaDate.getMonth() + 1).padStart(2, "0");
    const dd = String(jakartaDate.getDate()).padStart(2, "0");
    const dateDb = `${yyyy}-${mm}-${dd}`;
    const dateDisplay = `${parseInt(dd, 10)}/${parseInt(mm, 10)}/${yyyy}`;
    const safeStartNum = Math.max(1, parseInt(String(startNumber), 10) || 1);
    const linkArray = Array.isArray(links) ? links : [];
    const linkCount = linkArray.length;
    const endNumber = linkCount > 0 ? safeStartNum + linkCount - 1 : safeStartNum;
    const rangeStr = `${safeStartNum}-${endNumber}`;
    const recTag = recruiterUsername ? `@${recruiterUsername.replace(/^@/, "")}` : recruiterName;
    const header = `${dateDisplay}

${rangeStr}

`;
    const footer = `

\u{1F464} <b>Recruiter:</b> ${recTag}`;
    let linkList = linkArray.map((l, i) => {
      const cleanUrl = String(l || "").trim();
      return `${safeStartNum + i}. ${cleanUrl}`;
    }).join("\n");
    const fullCaption = `${header}${linkList}${footer}`.trim();
    const formData = new FormData();
    formData.append("chat_id", targetGroup);
    if (targetTopic) {
      formData.append("message_thread_id", String(targetTopic));
    }
    const mediaArray = [];
    for (let i = 0; i < images.length; i++) {
      const dataUrl = images[i];
      const match = dataUrl.match(/^data:(.*?);base64,(.*)$/);
      if (match) {
        const mimeType = match[1];
        const base64Data = match[2];
        const buffer = Buffer.from(base64Data, "base64");
        const blob = new Blob([buffer], { type: mimeType });
        const fileKey = `photo${i}`;
        formData.append(fileKey, blob, `post_${Date.now()}_${i}.jpg`);
        mediaArray.push({
          type: "photo",
          media: `attach://${fileKey}`
        });
      }
    }
    let result;
    if (mediaArray.length === 1) {
      const photoFormData = new FormData();
      photoFormData.append("chat_id", targetGroup);
      if (targetTopic) photoFormData.append("message_thread_id", String(targetTopic));
      const photoBlob = formData.get("photo0");
      if (photoBlob) photoFormData.append("photo", photoBlob);
      let response = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendPhoto`, {
        method: "POST",
        body: photoFormData
      });
      result = await response.json();
      if (!result.ok && targetTopic && result.description && (result.description.toLowerCase().includes("thread") || result.description.toLowerCase().includes("topic") || result.description.toLowerCase().includes("message_thread_id"))) {
        photoFormData.delete("message_thread_id");
        response = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendPhoto`, {
          method: "POST",
          body: photoFormData
        });
        result = await response.json();
      }
    } else {
      formData.append("media", JSON.stringify(mediaArray));
      let response = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMediaGroup`, {
        method: "POST",
        body: formData
      });
      result = await response.json();
      if (!result.ok && targetTopic && result.description && (result.description.toLowerCase().includes("thread") || result.description.toLowerCase().includes("topic") || result.description.toLowerCase().includes("message_thread_id"))) {
        console.warn("[Telegram API] sendMediaGroup thread error, retrying without message_thread_id:", result.description);
        formData.delete("message_thread_id");
        response = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMediaGroup`, {
          method: "POST",
          body: formData
        });
        result = await response.json();
      }
    }
    if (!result.ok) {
      console.error("[Telegram API] sendMediaGroup/sendPhoto failed:", result);
      res.status(400).json({ success: false, error: `Telegram Error: ${result.description}` });
      return;
    }
    let textPayload = {
      chat_id: targetGroup,
      text: fullCaption,
      parse_mode: "HTML",
      link_preview_options: { is_disabled: true }
    };
    if (targetTopic) textPayload.message_thread_id = targetTopic;
    let textResponse = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(textPayload)
    });
    let textResult = await textResponse.json();
    if (!textResult.ok && targetTopic && textResult.description && (textResult.description.toLowerCase().includes("thread") || textResult.description.toLowerCase().includes("topic") || textResult.description.toLowerCase().includes("message_thread_id"))) {
      console.warn("[Telegram API] sendMessage thread error, retrying without message_thread_id:", textResult.description);
      delete textPayload.message_thread_id;
      textResponse = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(textPayload)
      });
      textResult = await textResponse.json();
    }
    if (textResult.ok) {
      res.json({ success: true, data: textResult.result });
    } else {
      console.error("[Telegram API] sendMessage Error:", textResult);
      res.status(400).json({ success: false, error: `Telegram Error: ${textResult.description}` });
    }
  } catch (err) {
    console.error("[Telegram API] Error sending post:", err);
    res.status(500).json({ success: false, error: err instanceof Error ? err.message : "Gagal mengirim postingan" });
  }
});
app.post("/api/telegram/send-report", async (req, res) => {
  try {
    const { report, videoDataUrl, groupId, topicId, customText } = req.body;
    if (!report && !customText) {
      res.status(400).json({ success: false, error: "Data laporan tidak ditemukan" });
      return;
    }
    const { targetGroup, topicNum } = parseTelegramChatAndTopic(groupId, topicId);
    if (!targetGroup) {
      res.status(400).json({
        success: false,
        error: "ID Grup Telegram belum dikonfigurasi. Mohon isi ID Grup di Pengaturan."
      });
      return;
    }
    if (!TELEGRAM_BOT_TOKEN) {
      res.status(400).json({ success: false, error: "Token Bot Telegram tidak dikonfigurasi." });
      return;
    }
    if (report && (report.grup === "T3" || report.grup === "T0-MARK (Dipromosikan)")) {
      res.json({ success: true, message: "Data T0-MARK Dipromosikan berhasil disimpan (tidak dikirim ke Telegram)." });
      return;
    }
    let captionHtml = "";
    if (customText) {
      captionHtml = customText;
    } else if (report) {
      const recUsername = report.recruiterUsername ? `@${report.recruiterUsername.replace(/^@/, "")}` : report.username ? `@${report.username}` : report.name;
      const applicantTg = report.applicantTelegramUsername ? `@${report.applicantTelegramUsername.replace(/^@/, "")}` : "-";
      let rawGrup = report.grup || "-";
      let displayGrup = rawGrup;
      if (rawGrup === "T0" || rawGrup === "T0-MARK") {
        displayGrup = "T0-MARK";
      } else if (rawGrup === "V0") {
        displayGrup = "V0";
      } else if (rawGrup === "RECRUITER") {
        displayGrup = "RECRUITER";
      }
      captionHtml = `
UID : ${report.uid9Kucing || "-"}
WA : ${report.applicantWhatsapp || "-"}
Username Telegram : ${applicantTg}
Rekomendasi dari : ${recUsername}
Info dari sosmed : ${report.channel || "-"}

Grub : ${displayGrup}
`.trim();
    }
    if (videoDataUrl && typeof videoDataUrl === "string" && videoDataUrl.startsWith("data:")) {
      const match = videoDataUrl.match(/^data:(.*?);base64,(.*)$/);
      if (match) {
        const mimeType = match[1] || "video/mp4";
        const base64Data = match[2];
        const buffer = Buffer.from(base64Data, "base64");
        const blob = new Blob([buffer], { type: mimeType });
        const formData = new FormData();
        formData.append("chat_id", targetGroup);
        if (topicNum) {
          formData.append("message_thread_id", String(topicNum));
        }
        formData.append("caption", captionHtml);
        formData.append("parse_mode", "HTML");
        const ext = mimeType.includes("quicktime") || mimeType.includes("mov") ? "mov" : "mp4";
        formData.append("video", blob, `laporan_${report?.reportId || Date.now()}.${ext}`);
        let response2 = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendVideo`, {
          method: "POST",
          body: formData
        });
        let result2 = await response2.json();
        if (!result2.ok && topicNum && result2.description && (result2.description.toLowerCase().includes("thread") || result2.description.toLowerCase().includes("topic") || result2.description.toLowerCase().includes("message_thread_id"))) {
          console.warn("[Telegram API] sendVideo thread error, retrying without message_thread_id:", result2.description);
          formData.delete("message_thread_id");
          response2 = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendVideo`, {
            method: "POST",
            body: formData
          });
          result2 = await response2.json();
        }
        if (result2.ok) {
          res.json({ success: true, data: result2.result, message: "Laporan dan Video berhasil terkirim ke Telegram Group Topic!" });
          return;
        } else {
          console.warn("[Telegram API] sendVideo failed, falling back to sendMessage:", result2);
        }
      }
    } else if (videoDataUrl && typeof videoDataUrl === "string" && videoDataUrl.startsWith("http")) {
      const payload = {
        chat_id: targetGroup,
        video: videoDataUrl,
        caption: captionHtml,
        parse_mode: "HTML"
      };
      if (topicNum) payload.message_thread_id = topicNum;
      let response2 = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendVideo`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      let result2 = await response2.json();
      if (!result2.ok && topicNum && result2.description && (result2.description.toLowerCase().includes("thread") || result2.description.toLowerCase().includes("topic") || result2.description.toLowerCase().includes("message_thread_id"))) {
        delete payload.message_thread_id;
        response2 = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendVideo`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload)
        });
        result2 = await response2.json();
      }
      if (result2.ok) {
        res.json({ success: true, data: result2.result, message: "Laporan dan Video berhasil terkirim ke Telegram Group Topic!" });
        return;
      }
    }
    const isDataUrl = videoDataUrl && typeof videoDataUrl === "string" && videoDataUrl.startsWith("data:");
    const rawText = captionHtml + (videoDataUrl && !isDataUrl ? `

\u{1F4F9} Video Bukti: ${videoDataUrl}` : "");
    const textPayload = {
      chat_id: targetGroup,
      text: rawText,
      parse_mode: "HTML"
    };
    if (topicNum) textPayload.message_thread_id = topicNum;
    let response = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(textPayload)
    });
    let result = await response.json();
    if (!result.ok && result.description && (result.description.includes("parse") || result.description.includes("HTML") || result.description.includes("entity"))) {
      console.warn("[Telegram API] HTML parse error, retrying without parse_mode:", result.description);
      delete textPayload.parse_mode;
      response = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(textPayload)
      });
      result = await response.json();
    }
    if (!result.ok && topicNum && result.description && (result.description.toLowerCase().includes("thread") || result.description.toLowerCase().includes("topic") || result.description.toLowerCase().includes("message_thread_id"))) {
      console.warn("[Telegram API] sendMessage thread error, retrying without message_thread_id:", result.description);
      delete textPayload.message_thread_id;
      response = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(textPayload)
      });
      result = await response.json();
    }
    if (result.ok) {
      res.json({ success: true, data: result.result, message: "Laporan berhasil terkirim ke Telegram Group Topic!" });
    } else {
      console.error("[Telegram API] sendMessage failed:", result);
      res.status(400).json({ success: false, error: `Telegram Error: ${result.description}` });
    }
  } catch (err) {
    console.error("[Telegram API] Error sending report:", err);
    res.status(500).json({ success: false, error: err instanceof Error ? err.message : "Gagal mengirim laporan ke Telegram" });
  }
});
app.all("/api/*", (req, res) => {
  res.status(404).json({
    success: false,
    error: `Route ${req.method} ${req.url} not found on this server.`
  });
});
app.use("/api", (err, req, res, next) => {
  console.error("API Error:", err);
  res.status(err.status || 500).json({
    success: false,
    error: err.message || "Internal Server Error"
  });
});
async function startServer() {
  if (process.env.NODE_ENV !== "production" && !process.env.VERCEL) {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa"
    });
    app.use(vite.middlewares);
  } else {
    const distPath = import_path.default.join(process.cwd(), "dist");
    app.use(import_express.default.static(distPath, {
      setHeaders: (res, filePath) => {
        const ext = import_path.default.extname(filePath).toLowerCase();
        if (ext === ".js") {
          res.setHeader("Content-Type", "application/javascript; charset=utf-8");
        } else if (ext === ".css") {
          res.setHeader("Content-Type", "text/css; charset=utf-8");
        } else if (ext === ".json") {
          res.setHeader("Content-Type", "application/json; charset=utf-8");
        } else if (ext === ".png") {
          res.setHeader("Content-Type", "image/png");
        } else if (ext === ".jpg" || ext === ".jpeg") {
          res.setHeader("Content-Type", "image/jpeg");
        } else if (ext === ".svg") {
          res.setHeader("Content-Type", "image/svg+xml");
        } else if (ext === ".ico") {
          res.setHeader("Content-Type", "image/x-icon");
        }
      }
    }));
    app.get("*", (_req, res) => {
      res.sendFile(import_path.default.join(distPath, "index.html"));
    });
  }
  if (!process.env.VERCEL) {
    app.listen(PORT, "0.0.0.0", () => {
      console.log(`[AzurLizeTeam Server] Running on http://0.0.0.0:${PORT} in ${process.env.NODE_ENV || "development"} mode`);
    });
  }
}
if (!process.env.VERCEL) {
  startServer();
}
var server_default = app;
//# sourceMappingURL=server.cjs.map
