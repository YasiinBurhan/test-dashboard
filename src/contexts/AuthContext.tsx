import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { AuthState, TelegramUser, UserProfile } from '../types';
import { getTelegramWebApp, isTelegramEnvironment } from '../telegram/webapp';
import { verifyTelegramInitDataApi, loginManualApi } from '../services/api';
import { getUserProfile, subscribeToUserProfile, getAllUsers, createUserProfile, findUserProfileByIdOrUsername, updateUserLastSeen } from '../firebase/services/userService';
import { signInAnonymously } from 'firebase/auth';
import { auth, db } from '../firebase/config';
import { doc, setDoc } from 'firebase/firestore';

interface AuthContextType extends AuthState {
  refreshProfile: () => Promise<UserProfile | null>;
  logout: () => void;
  continueLogin: () => Promise<void>;
  loginManually: (telegramId: string, pin?: string, name?: string, username?: string) => Promise<{ success: boolean; error?: string }>;
  registerManually: (telegramId: string, name: string, username?: string) => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

// Promise timeout helper to prevent hanging on slow network or unconfigured database
const withTimeout = <T,>(promise: Promise<T>, ms: number, fallback: T): Promise<T> => {
  return Promise.race([
    promise,
    new Promise<T>((resolve) => setTimeout(() => {
      console.warn(`[Timeout] Operation timed out after ${ms}ms, returning fallback.`);
      resolve(fallback);
    }, ms))
  ]);
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [state, setState] = useState<AuthState>({
    isAuthenticated: false,
    isLoading: true,
    telegramUser: null,
    userProfile: null,
    token: null,
    initData: '',
    error: null,
    isTelegramContext: false
  });

  const initAuth = useCallback(async () => {
    const startTime = Date.now();
    const MIN_SPLASH_DELAY = 150; // Super fast splash screen (0.15 seconds max delay if loaded)

    const finishLoading = async (newState: Omit<AuthState, 'isLoading'>) => {
      const elapsed = Date.now() - startTime;
      if (elapsed < MIN_SPLASH_DELAY) {
        await new Promise((resolve) => setTimeout(resolve, MIN_SPLASH_DELAY - elapsed));
      }
      setState({ ...newState, isLoading: false });
    };

    setState((prev) => ({ ...prev, isLoading: true, error: null }));

    // Wait for Telegram Script to load completely (optimized and fast check)
    const immediateWa = typeof window !== 'undefined' && window.Telegram?.WebApp;
    if (immediateWa && (immediateWa.initData || immediateWa.initDataUnsafe?.user || immediateWa.platform)) {
      try {
        immediateWa.ready();
      } catch (e) {
        console.error('Error calling Telegram WebApp ready:', e);
      }
    } else {
      await new Promise<void>((resolve) => {
        const checkStart = Date.now();
        const interval = setInterval(() => {
          const wa = typeof window !== 'undefined' && window.Telegram?.WebApp;
          if (wa && (wa.initData || wa.initDataUnsafe?.user || wa.platform)) {
            clearInterval(interval);
            try {
              wa.ready();
            } catch (e) {
              console.error('Error calling Telegram WebApp ready:', e);
            }
            resolve();
          } else if (Date.now() - checkStart > 200) { // Reduced script wait timeout
            clearInterval(interval);
            resolve();
          }
        }, 15);
      });
    }

    const webApp = getTelegramWebApp();
    const inTelegram = isTelegramEnvironment();

    if (!inTelegram || !webApp) {
      // Check if we have a persisted manual login in localStorage!
      const savedUserStr = localStorage.getItem('azurlize_manual_user');
      const savedToken = localStorage.getItem('azurlize_session_token');
      if (savedUserStr) {
        try {
          const savedUser = JSON.parse(savedUserStr);
          if (savedUser && savedUser.id) {
            const cleanSavedId = String(savedUser.id).trim();
            const profile = await withTimeout(findUserProfileByIdOrUsername(cleanSavedId), 8000, null);

            if (profile) {
              const tgUser: TelegramUser = {
                id: Number(profile.telegramId) || savedUser.id,
                first_name: profile.firstName || savedUser.first_name || 'User',
                last_name: profile.lastName || savedUser.last_name || '',
                username: profile.username || savedUser.username || '',
                photo_url: profile.photoUrl || savedUser.photo_url || ''
              };

              await finishLoading({
                isAuthenticated: true,
                telegramUser: tgUser,
                userProfile: profile,
                token: savedToken || 'manual_session_token',
                initData: '',
                error: null,
                isTelegramContext: true
              });
              return;
            }
          }
        } catch (e) {
          console.error('Error loading manual user session:', e);
        }
      }

      await finishLoading({
        isAuthenticated: false,
        telegramUser: null,
        userProfile: null,
        token: null,
        initData: '',
        error: null,
        isTelegramContext: false
      });
      return;
    }

    const initData = webApp.initData;
    const tgUser = webApp.initDataUnsafe?.user;

    // Default-path (No Cache): Fast API call + Fast Firestore request with quick timeout limits
    try {
      const apiResult = await withTimeout(verifyTelegramInitDataApi(initData), 4000, { success: false, error: 'Timeout' });

      if (apiResult.success && apiResult.data) {
        const freshTgUser = apiResult.data.telegramUser;
        const telegramId = String(freshTgUser.id);
        const token = apiResult.data.token;

        let profile = null;
        try {
          profile = await withTimeout(getUserProfile(telegramId), 8000, null);
        } catch (dbErr) {
          console.warn('[AuthContext] Firestore profile fetch failed:', dbErr);
        }

        await finishLoading({
          isAuthenticated: profile !== null,
          telegramUser: {
            id: freshTgUser.id,
            first_name: freshTgUser.first_name || '',
            last_name: freshTgUser.last_name || '',
            username: freshTgUser.username || '',
            photo_url: freshTgUser.photo_url || ''
          },
          userProfile: profile,
          token,
          initData,
          error: null,
          isTelegramContext: true
        });
      } else {
        throw new Error(apiResult.error || 'Gagal memverifikasi akun Telegram.');
      }
    } catch (err) {
      // Direct Fallback if API fails: try using local user client-side info immediately
      const fallbackTgUser = webApp.initDataUnsafe?.user;
      if (fallbackTgUser) {
        console.warn('[AuthContext] API verification failed, using client fallback:', err);
        const telegramId = String(fallbackTgUser.id);

        let profile = null;
        try {
          profile = await withTimeout(getUserProfile(telegramId), 8000, null);
        } catch (dbErr) {
          console.warn('[AuthContext] Fallback Firestore profile fetch failed:', dbErr);
        }

        await finishLoading({
          isAuthenticated: profile !== null,
          telegramUser: {
            id: fallbackTgUser.id,
            first_name: fallbackTgUser.first_name || '',
            last_name: fallbackTgUser.last_name || '',
            username: fallbackTgUser.username || '',
            photo_url: fallbackTgUser.photo_url || ''
          },
          userProfile: profile,
          token: 'client_side_fallback_token',
          initData,
          error: null,
          isTelegramContext: true
        });
      } else {
        await finishLoading({
          isAuthenticated: false,
          telegramUser: null,
          userProfile: null,
          token: null,
          initData,
          error: err instanceof Error ? err.message : 'Terjadi kesalahan otentikasi Telegram.',
          isTelegramContext: true
        });
      }
    }
  }, []);

  useEffect(() => {
    initAuth();
  }, [initAuth]);

  // Ensure anonymous Firebase Auth sign-in
  useEffect(() => {
    const handleFirebaseSignIn = async () => {
      try {
        if (!auth.currentUser) {
          const cred = await signInAnonymously(auth);
          console.log('[Firebase Auth] Anonymous login successful:', cred.user.uid);
        }
      } catch (err) {
        console.warn('[Firebase Auth] Failed to sign in anonymously:', err);
      }
    };
    handleFirebaseSignIn();
  }, []);

  // Update/Sync firebaseUid and admin role document
  useEffect(() => {
    const syncFirebaseUser = async () => {
      if (state.isAuthenticated && state.userProfile && auth.currentUser) {
        const firebaseUid = auth.currentUser.uid;
        const telegramId = String(state.userProfile.telegramId);

        // 1. Link firebaseUid if missing or different
        if (state.userProfile.firebaseUid !== firebaseUid) {
          try {
            const userRef = doc(db, 'users', telegramId);
            await setDoc(userRef, { firebaseUid }, { merge: true });
            console.log(`[Firebase Sync] Linked Telegram ${telegramId} with Firebase UID ${firebaseUid}`);
          } catch (err) {
            console.warn('[Firebase Sync] Failed to update firebaseUid in profile:', err);
          }
        }

        // 2. Write self-healing administrative lookup if role is Admin or Owner
        if (state.userProfile.role === 'Admin' || state.userProfile.role === 'Owner') {
          try {
            const adminRef = doc(db, 'admins', firebaseUid);
            await setDoc(adminRef, {
              telegramId,
              role: state.userProfile.role,
              updatedAt: new Date().toISOString()
            });
            console.log(`[Firebase Sync] Admin lookup synchronized for ${telegramId}`);
          } catch (err) {
            console.warn('[Firebase Sync] Failed to sync admin lookup:', err);
          }
        }
      }
    };
    syncFirebaseUser();
  }, [state.isAuthenticated, state.userProfile?.role, state.userProfile?.firebaseUid]);

  // Real-time listener for user profile updates
  useEffect(() => {
    if (state.telegramUser?.id) {
      const unsubscribe = subscribeToUserProfile(String(state.telegramUser.id), (profile) => {
        setState((prev) => {
          if (!prev.telegramUser) return prev;
          
          return {
            ...prev,
            userProfile: profile,
            isAuthenticated: profile !== null
          };
        });
      });
      
      return () => unsubscribe();
    }
  }, [state.telegramUser?.id]);

  // Track recruiter/user last seen status
  useEffect(() => {
    if (state.telegramUser?.id && state.isAuthenticated) {
      const tgId = String(state.telegramUser.id);
      
      // Update last seen immediately on load/auth
      updateUserLastSeen(tgId);
      
      // Also update last seen when user returns to app/focuses page
      const handleFocus = () => {
        updateUserLastSeen(tgId);
      };
      
      window.addEventListener('focus', handleFocus);
      return () => {
        window.removeEventListener('focus', handleFocus);
      };
    }
  }, [state.telegramUser?.id, state.isAuthenticated]);

  const refreshProfile = async (): Promise<UserProfile | null> => {
    if (!state.telegramUser) return null;
    try {
      const telegramId = String(state.telegramUser.id).trim();
      const profile = await withTimeout(getUserProfile(telegramId), 8000, state.userProfile);

      if (profile) {
        setState((prev) => ({ ...prev, userProfile: profile, isAuthenticated: true }));
      }
      return profile;
    } catch (err) {
      console.error('Error refreshing profile:', err);
      return null;
    }
  };

  const logout = () => {
    localStorage.removeItem('azurlize_manual_user');
    setState({
      isAuthenticated: false,
      isLoading: false,
      telegramUser: null,
      userProfile: null,
      token: null,
      initData: '',
      error: null,
      isTelegramContext: false
    });
  };

  const loginManually = async (telegramIdInput: string, pinInput?: string, nameInput?: string, usernameInput?: string) => {
    setState((prev) => ({ ...prev, isLoading: true, error: null }));
    const cleanId = String(telegramIdInput || '').trim().replace(/^@/, '');
    if (!cleanId) {
      setState((prev) => ({ ...prev, isLoading: false }));
      return { success: false, error: 'Mohon masukkan ID atau Username Telegram Anda.' };
    }

    try {
      const apiResult = await withTimeout(loginManualApi(cleanId, pinInput), 8000, { success: false, error: 'Timeout' });
      if (!apiResult || !apiResult.success || !apiResult.data?.token) {
        setState((prev) => ({ ...prev, isLoading: false }));
        return { success: false, error: apiResult?.error || 'Gagal login. Periksa kembali ID dan PIN.' };
      }

      const profile = await withTimeout(findUserProfileByIdOrUsername(cleanId), 8000, null);

      if (profile) {
        const tgUser: TelegramUser = {
          id: Number(profile.telegramId) || 12345678,
          first_name: profile.firstName || nameInput?.trim() || 'User',
          last_name: profile.lastName || '',
          username: profile.username || usernameInput?.trim() || '',
          photo_url: profile.photoUrl || ''
        };
        
        // Save to localStorage
        localStorage.setItem('azurlize_manual_user', JSON.stringify(tgUser));
        localStorage.setItem('azurlize_session_token', apiResult.data.token);

        setState({
          isAuthenticated: true,
          isLoading: false,
          telegramUser: tgUser,
          userProfile: profile,
          token: apiResult.data.token,
          initData: '',
          error: null,
          isTelegramContext: true
        });

        return { success: true };
      } else {
        setState((prev) => ({ ...prev, isLoading: false }));
        return {
          success: false,
          error: `ID / Username Telegram (${cleanId}) tidak terdaftar di Firestore. Silakan mendaftar terlebih dahulu di tab "Daftar Baru".`
        };
      }
    } catch (err) {
      console.error('Error during manual login:', err);
      setState((prev) => ({ ...prev, isLoading: false }));
      return { success: false, error: 'Gagal memverifikasi akun. Periksa koneksi internet Anda.' };
    }
  };

  const registerManually = (telegramId: string, name: string, username?: string) => {
    const tgUser: TelegramUser = {
      id: Number(telegramId),
      first_name: name,
      last_name: '',
      username: username || '',
      photo_url: ''
    };
    
    // Save to localStorage so if they refresh, the register state stays active
    localStorage.setItem('azurlize_manual_user', JSON.stringify(tgUser));

    setState((prev) => ({
      ...prev,
      isAuthenticated: false,
      telegramUser: tgUser,
      userProfile: null,
      isTelegramContext: true // Bypass BrowserNoticePage
    }));
  };

  const continueLogin = async () => {
    setState((prev) => ({ ...prev, isLoading: true, error: null }));
    try {
      // 1. Try to read Telegram WebApp first if available in window environment
      const webApp = getTelegramWebApp();
      const inTelegram = isTelegramEnvironment();
      if (inTelegram && webApp) {
        const initData = webApp.initData;
        const tgUser = webApp.initDataUnsafe?.user;
        if (tgUser) {
          const apiResult = await withTimeout(verifyTelegramInitDataApi(initData), 1500, { success: false, error: 'Timeout' });
          if (apiResult.success && apiResult.data) {
            const freshTgUser = apiResult.data.telegramUser;
            const freshToken = apiResult.data.token;
            const telegramId = String(freshTgUser.id);
            const freshProfile = await withTimeout(getUserProfile(telegramId), 1200, null);
            
            if (freshProfile) {
              setState({
                isAuthenticated: true,
                isLoading: false,
                telegramUser: {
                  id: freshTgUser.id,
                  first_name: freshTgUser.first_name || '',
                  last_name: freshTgUser.last_name || '',
                  username: freshTgUser.username || '',
                  photo_url: freshTgUser.photo_url || ''
                },
                userProfile: freshProfile,
                token: freshToken,
                initData,
                error: null,
                isTelegramContext: true
              });
              return;
            }
          }
        }
      }

      setState((prev) => ({ 
        ...prev, 
        isLoading: false, 
        error: 'Sesi login tidak dapat dipulihkan secara otomatis. Silakan buka kembali dari bot Telegram.' 
      }));
    } catch (err) {
      console.error('Error in continueLogin:', err);
      setState((prev) => ({ 
        ...prev, 
        isLoading: false, 
        error: 'Gagal melanjutkan login otomatis. Silakan coba lagi.' 
      }));
    }
  };

  return (
    <AuthContext.Provider
      value={{
        ...state,
        refreshProfile,
        logout,
        continueLogin,
        loginManually,
        registerManually
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuthContext = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuthContext must be used within an AuthProvider');
  }
  return context;
};
