import { TelegramThemeParams, TelegramUser } from '../types';

declare global {
  interface Window {
    Telegram?: {
      WebApp?: {
        initData: string;
        initDataUnsafe?: {
          query_id?: string;
          user?: TelegramUser;
          receiver?: TelegramUser;
          chat_type?: string;
          chat_instance?: string;
          start_param?: string;
          auth_date?: number;
          hash?: string;
        };
        version: string;
        platform: string;
        colorScheme: 'light' | 'dark';
        themeParams: TelegramThemeParams;
        isExpanded: boolean;
        viewportHeight: number;
        viewportStableHeight: number;
        headerColor: string;
        backgroundColor: string;
        isClosingConfirmationEnabled: boolean;
        BackButton: {
          isVisible: boolean;
          show: () => void;
          hide: () => void;
          onClick: (callback: () => void) => void;
          offClick: (callback: () => void) => void;
        };
        MainButton: {
          text: string;
          color: string;
          textColor: string;
          isVisible: boolean;
          isActive: boolean;
          isProgressVisible: boolean;
          setText: (text: string) => void;
          onClick: (callback: () => void) => void;
          offClick: (callback: () => void) => void;
          show: () => void;
          hide: () => void;
          enable: () => void;
          disable: () => void;
          showProgress: (leaveActive?: boolean) => void;
          hideProgress: () => void;
          setParams: (params: { text?: string; color?: string; text_color?: string; is_active?: boolean; is_visible?: boolean }) => void;
        };
        HapticFeedback: {
          impactOccurred: (style: 'light' | 'medium' | 'heavy' | 'rigid' | 'soft') => void;
          notificationOccurred: (type: 'error' | 'success' | 'warning') => void;
          selectionChanged: () => void;
        };
        ready: () => void;
        expand: () => void;
        close: () => void;
        setHeaderColor: (color: string) => void;
        setBackgroundColor: (color: string) => void;
        onEvent: (eventType: string, eventHandler: (...args: unknown[]) => void) => void;
        offEvent: (eventType: string, eventHandler: (...args: unknown[]) => void) => void;
        sendData: (data: string) => void;
        openTelegramLink: (url: string) => void;
        openLink: (url: string) => void;
      };
    };
  }
}

export function getTelegramWebApp() {
  if (typeof window !== 'undefined' && window.Telegram?.WebApp) {
    return window.Telegram.WebApp;
  }
  return null;
}

export function isTelegramEnvironment(): boolean {
  const webApp = getTelegramWebApp();
  return Boolean(
    webApp &&
    ((webApp.initData && webApp.initData.length > 0) ||
      (webApp.initDataUnsafe && Object.keys(webApp.initDataUnsafe).length > 0))
  );
}

export function getTelegramUser(): TelegramUser | null {
  const webApp = getTelegramWebApp();
  if (webApp && webApp.initDataUnsafe?.user) {
    return webApp.initDataUnsafe.user;
  }
  return null;
}

export function triggerHaptic(
  type: 'impact' | 'notification' | 'selection',
  subtype?: 'light' | 'medium' | 'heavy' | 'rigid' | 'soft' | 'error' | 'success' | 'warning'
) {
  const webApp = getTelegramWebApp();
  if (!webApp?.HapticFeedback) return;

  try {
    if (type === 'impact') {
      webApp.HapticFeedback.impactOccurred((subtype as 'light' | 'medium' | 'heavy') || 'medium');
    } else if (type === 'notification') {
      webApp.HapticFeedback.notificationOccurred((subtype as 'success' | 'error' | 'warning') || 'success');
    } else if (type === 'selection') {
      webApp.HapticFeedback.selectionChanged();
    }
  } catch {
    // Fallback gracefully if Haptic API is unsupported on device
  }
}

export function initTelegramApp() {
  const webApp = getTelegramWebApp();
  if (webApp) {
    webApp.ready();
    webApp.expand();
  }
}
