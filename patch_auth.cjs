const fs = require('fs');
let code = fs.readFileSync('src/contexts/AuthContext.tsx', 'utf8');

// Add the auth function
if (!code.includes('loginWithTelegramWidget')) {
    const authFn = `
  const loginWithTelegramWidget = async (user: TelegramUser) => {
    setState((prev) => ({ ...prev, isLoading: true, error: null }));
    try {
      const response = await fetch('/api/auth/telegram-widget', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(user),
      });

      const result = await response.json();
      
      if (!result.success) {
        setState((prev) => ({ ...prev, isLoading: false, error: result.error || 'Authentication failed' }));
        return { success: false, error: result.error };
      }

      localStorage.setItem('azurlize_manual_user', JSON.stringify(user));
      localStorage.setItem('azurlize_session_token', result.token);

      const profile = await withTimeout(findUserProfileByIdOrUsername(String(user.id)), 8000, null);

      if (profile) {
        setState({
          isAuthenticated: true,
          isLoading: false,
          telegramUser: user,
          userProfile: profile,
          token: result.token,
          initData: '',
          error: null,
          isTelegramContext: true
        });
        return { success: true };
      } else {
        // If not registered, but authenticated by widget, proceed to Registration Page
        setState({
          isAuthenticated: false,
          isLoading: false,
          telegramUser: user,
          userProfile: null,
          token: result.token,
          initData: '',
          error: null,
          isTelegramContext: true // This will skip BrowserNoticePage and go to LoginPage (Registration)
        });
        return { success: true, isNewUser: true };
      }
    } catch (err) {
      console.error('Error logging in with Telegram Widget:', err);
      setState((prev) => ({ ...prev, isLoading: false, error: 'Network error. Please try again.' }));
      return { success: false, error: 'Network error.' };
    }
  };
`;
    code = code.replace(`const logout = () => {`, `${authFn}\n  const logout = () => {`);
    code = code.replace(`registerManually`, `registerManually, loginWithTelegramWidget`);
    fs.writeFileSync('src/contexts/AuthContext.tsx', code);
    console.log("Patched AuthContext.tsx");
} else {
    console.log("Already patched AuthContext");
}
