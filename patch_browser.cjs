const fs = require('fs');
let code = fs.readFileSync('src/pages/BrowserNoticePage.tsx', 'utf8');

if (!code.includes('TelegramLoginButton')) {
    code = code.replace(`import { ChevronLeft`, `import { TelegramLoginButton } from '../components/common/TelegramLoginButton';\nimport { ChevronLeft`);
    
    const widgetCode = `
            {/* Telegram Login Widget */}
            <div className="flex flex-col items-center justify-center space-y-3 pt-2 pb-4 border-b border-slate-200 dark:border-slate-800">
              <p className="text-xs font-bold text-slate-700 dark:text-slate-300">Gunakan Telegram Login (Rekomendasi)</p>
              <TelegramLoginButton 
                botName="azurlize_recruitment_bot" 
                onAuth={async (user) => {
                  const res = await loginWithTelegramWidget(user);
                  if (res && res.success && res.isNewUser) {
                    setMode('register');
                  }
                }} 
              />
            </div>
            
            <div className="relative flex py-2 items-center">
              <div className="flex-grow border-t border-slate-200 dark:border-slate-800"></div>
              <span className="flex-shrink-0 mx-4 text-slate-400 text-xs font-bold">ATAU MANUAL LOGIN</span>
              <div className="flex-grow border-t border-slate-200 dark:border-slate-800"></div>
            </div>
`;
    
    // insert the widgetCode before the MODE TOGGLE SWITCH
    code = code.replace(`{/* MODE TOGGLE SWITCH`, `${widgetCode}\n            {/* MODE TOGGLE SWITCH`);
    
    // We also need to extract loginWithTelegramWidget from AuthContext
    code = code.replace(`const { loginManually, registerManually } = useAuth();`, `const { loginManually, registerManually, loginWithTelegramWidget } = useAuth() as any;`);
    
    fs.writeFileSync('src/pages/BrowserNoticePage.tsx', code);
    console.log("Patched BrowserNoticePage.tsx");
} else {
    console.log("Already patched BrowserNoticePage");
}
