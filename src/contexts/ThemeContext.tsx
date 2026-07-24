import React, { createContext, useContext, useEffect, useState } from 'react';
import { TelegramThemeParams } from '../types';
import { getTelegramWebApp } from '../telegram/webapp';

interface ThemeContextType {
  colorScheme: 'light' | 'dark';
  themeParams: TelegramThemeParams;
}

const defaultParams: TelegramThemeParams = {
  bg_color: '#0f172a',
  secondary_bg_color: '#1e293b',
  text_color: '#f8fafc',
  hint_color: '#94a3b8',
  link_color: '#38bdf8',
  button_color: '#2563eb',
  button_text_color: '#ffffff',
  header_bg_color: '#0f172a',
  accent_text_color: '#60a5fa'
};

const ThemeContext = createContext<ThemeContextType>({
  colorScheme: 'dark',
  themeParams: defaultParams
});

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [colorScheme, setColorScheme] = useState<'light' | 'dark'>('dark');
  const [themeParams, setThemeParams] = useState<TelegramThemeParams>(defaultParams);

  useEffect(() => {
    const webApp = getTelegramWebApp();

    const applyTheme = () => {
      // Force premium dark theme as requested by the user
      const scheme = 'dark';
      const params = (webApp && webApp.colorScheme === 'dark') ? webApp.themeParams : {};

      setColorScheme('dark');

      const isDark = true;
      const mergedParams: TelegramThemeParams = {
        bg_color: params.bg_color || '#030712',
        secondary_bg_color: params.secondary_bg_color || '#0f172a',
        text_color: params.text_color || '#f8fafc',
        hint_color: params.hint_color || '#94a3b8',
        link_color: params.link_color || '#38bdf8',
        button_color: params.button_color || '#2563eb',
        button_text_color: params.button_text_color || '#ffffff',
        header_bg_color: params.header_bg_color || '#030712',
        accent_text_color: params.accent_text_color || '#60a5fa'
      };

      setThemeParams(mergedParams);

      // Set CSS Root Variables for global Tailwind & Glassmorphism styling
      const root = document.documentElement;
      root.classList.add('dark');

      root.style.setProperty('--tg-bg-color', mergedParams.bg_color!);
      root.style.setProperty('--tg-secondary-bg-color', mergedParams.secondary_bg_color!);
      root.style.setProperty('--tg-text-color', mergedParams.text_color!);
      root.style.setProperty('--tg-hint-color', mergedParams.hint_color!);
      root.style.setProperty('--tg-link-color', mergedParams.link_color!);
      root.style.setProperty('--tg-button-color', mergedParams.button_color!);
      root.style.setProperty('--tg-button-text-color', mergedParams.button_text_color!);
      root.style.setProperty('--tg-header-bg-color', mergedParams.header_bg_color!);
      root.style.setProperty('--tg-accent-text-color', mergedParams.accent_text_color!);
    };

    applyTheme();

    if (webApp) {
      const handleThemeChanged = () => {
        applyTheme();
      };
      webApp.onEvent('themeChanged', handleThemeChanged);
      return () => {
        webApp.offEvent('themeChanged', handleThemeChanged);
      };
    }
  }, []);

  return (
    <ThemeContext.Provider value={{ colorScheme, themeParams }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => useContext(ThemeContext);
