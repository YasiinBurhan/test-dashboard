const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');

const cryptoImport = `import crypto from 'crypto';\n`;
if (!code.includes('import crypto from')) {
    code = code.replace(`import express`, `${cryptoImport}import express`);
}

const endpoint = `
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
    if (auth_date) dataCheckArr.push(\`auth_date=\${auth_date}\`);
    if (first_name) dataCheckArr.push(\`first_name=\${first_name}\`);
    if (id) dataCheckArr.push(\`id=\${id}\`);
    if (last_name) dataCheckArr.push(\`last_name=\${last_name}\`);
    if (photo_url) dataCheckArr.push(\`photo_url=\${photo_url}\`);
    if (username) dataCheckArr.push(\`username=\${username}\`);
    
    const dataCheckString = dataCheckArr.sort().join('\\n');
    
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
`;

if (!code.includes('/api/auth/telegram-widget')) {
    code = code.replace(`app.post('/api/auth/login-manual'`, `${endpoint}\napp.post('/api/auth/login-manual'`);
    fs.writeFileSync('server.ts', code);
    console.log("Patched server.ts");
} else {
    console.log("Already patched");
}
