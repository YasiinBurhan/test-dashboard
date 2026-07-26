import React, { createContext, useContext, useEffect, useState } from 'react';
import { TelegramThemeParams } from '../types';
import { getTelegramWebApp } from '../telegram/webapp';

interface ThemeContextType {
  colorScheme: 'light' | 'dark';
  themeParams: TelegramThemeParams;
  toggleTheme: () => void;
  setTheme: (theme: 'light' | 'dark') => void;
}

const darkParams: TelegramThemeParams = {
  bg_color: '#030712',
  secondary_bg_color: '#0f172a',
  text_color: '#f8fafc',
  hint_color: '#94a3b8',
  link_color: '#38bdf8',
  button_color: '#2563eb',
  button_text_color: '#ffffff',
  header_bg_color: '#030712',
  accent_text_color: '#60a5fa'
};

// Warm, soft non-glaring light mode palette (slate-100 neutral background)
const lightParams: TelegramThemeParams = {
  bg_color: '#f1f5f9',
  secondary_bg_color: '#ffffff',
  text_color: '#0f172a',
  hint_color: '#64748b',
  link_color: '#0284c7',
  button_color: '#2563eb',
  button_text_color: '#ffffff',
  header_bg_color: '#e2e8f0',
  accent_text_color: '#0284c7'
};

const ThemeContext = createContext<ThemeContextType>({
  colorScheme: 'dark',
  themeParams: darkParams,
  toggleTheme: () => {},
  setTheme: () => {}
});

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [colorScheme, setColorScheme] = useState<'light' | 'dark'>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('theme_mode');
      if (saved === 'light' || saved === 'dark') return saved;
      const webApp = getTelegramWebApp();
      if (webApp?.colorScheme === 'light' || webApp?.colorScheme === 'dark') {
        return webApp.colorScheme;
      }
    }
    return 'dark';
  });

  const [themeParams, setThemeParams] = useState<TelegramThemeParams>(darkParams);

  const applyTheme = (scheme: 'light' | 'dark') => {
    const webApp = getTelegramWebApp();
    const params = webApp?.themeParams || {};
    
    let mergedParams: TelegramThemeParams;
    const root = document.documentElement;

    if (scheme === 'light') {
      root.classList.remove('dark');
      root.classList.add('light');
      mergedParams = {
        bg_color: params.bg_color || lightParams.bg_color,
        secondary_bg_color: params.secondary_bg_color || lightParams.secondary_bg_color,
        text_color: params.text_color || lightParams.text_color,
        hint_color: params.hint_color || lightParams.hint_color,
        link_color: params.link_color || lightParams.link_color,
        button_color: params.button_color || lightParams.button_color,
        button_text_color: params.button_text_color || lightParams.button_text_color,
        header_bg_color: params.header_bg_color || lightParams.header_bg_color,
        accent_text_color: params.accent_text_color || lightParams.accent_text_color
      };
    } else {
      root.classList.remove('light');
      root.classList.add('dark');
      mergedParams = {
        bg_color: params.bg_color || darkParams.bg_color,
        secondary_bg_color: params.secondary_bg_color || darkParams.secondary_bg_color,
        text_color: params.text_color || darkParams.text_color,
        hint_color: params.hint_color || darkParams.hint_color,
        link_color: params.link_color || darkParams.link_color,
        button_color: params.button_color || darkParams.button_color,
        button_text_color: params.button_text_color || darkParams.button_text_color,
        header_bg_color: params.header_bg_color || darkParams.header_bg_color,
        accent_text_color: params.accent_text_color || darkParams.accent_text_color
      };
    }

    setColorScheme(scheme);
    setThemeParams(mergedParams);

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

  useEffect(() => {
    applyTheme(colorScheme);
  }, [colorScheme]);

  const toggleTheme = () => {
    const next = colorScheme === 'dark' ? 'light' : 'dark';
    if (typeof window !== 'undefined') {
      localStorage.setItem('theme_mode', next);
    }
    applyTheme(next);
  };

  const setTheme = (theme: 'light' | 'dark') => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('theme_mode', theme);
    }
    applyTheme(theme);
  };

  return (
    <ThemeContext.Provider value={{ colorScheme, themeParams, toggleTheme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => useContext(ThemeContext);

