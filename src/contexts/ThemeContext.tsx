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
  bg_color: '#000000',
  secondary_bg_color: '#1c1c1e',
  text_color: '#ffffff',
  hint_color: '#8e8e93',
  link_color: '#0a84ff',
  button_color: '#0a84ff',
  button_text_color: '#ffffff',
  header_bg_color: '#000000',
  accent_text_color: '#0a84ff'
};

// Precise native iOS Light system gray and white grouped colors
const lightParams: TelegramThemeParams = {
  bg_color: '#f2f2f7',
  secondary_bg_color: '#ffffff',
  text_color: '#000000',
  hint_color: '#8e8e93',
  link_color: '#007aff',
  button_color: '#007aff',
  button_text_color: '#ffffff',
  header_bg_color: '#f2f2f7',
  accent_text_color: '#007aff'
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
      const webApp = getTelegramWebApp();
      // If inside Telegram, prioritize Telegram WebApp colorScheme if available
      if (webApp?.colorScheme === 'light' || webApp?.colorScheme === 'dark') {
        return webApp.colorScheme;
      }
      const saved = localStorage.getItem('theme_mode');
      if (saved === 'light' || saved === 'dark') return saved;
    }
    return 'dark';
  });

  const [themeParams, setThemeParams] = useState<TelegramThemeParams>(darkParams);

  // Synchronize CSS variables, HTML classes, WebApp colors, and Android StatusBar whenever colorScheme changes
  useEffect(() => {
    const webApp = getTelegramWebApp();
    const params = webApp?.themeParams || {};
    let mergedParams: TelegramThemeParams;
    const root = document.documentElement;

    // Temporarily add a helper class to prevent layout transition flicker during swap
    root.classList.add('theme-switching');

    if (colorScheme === 'light') {
      root.classList.remove('dark');
      root.classList.add('light');
      mergedParams = {
        bg_color: lightParams.bg_color,
        secondary_bg_color: lightParams.secondary_bg_color,
        text_color: params.text_color || lightParams.text_color,
        hint_color: params.hint_color || lightParams.hint_color,
        link_color: params.link_color || lightParams.link_color,
        button_color: params.button_color || lightParams.button_color,
        button_text_color: params.button_text_color || lightParams.button_text_color,
        header_bg_color: params.header_bg_color || lightParams.header_bg_color,
        accent_text_color: params.accent_text_color || lightParams.accent_text_color
      };
      if (webApp?.setHeaderColor) {
        try { webApp.setHeaderColor('#f2f2f7'); } catch(e) {}
      }
      if (webApp?.setBackgroundColor) {
        try { webApp.setBackgroundColor('#f2f2f7'); } catch(e) {}
      }
    } else {
      root.classList.remove('light');
      root.classList.add('dark');
      mergedParams = {
        bg_color: darkParams.bg_color,
        secondary_bg_color: darkParams.secondary_bg_color,
        text_color: params.text_color || darkParams.text_color,
        hint_color: params.hint_color || darkParams.hint_color,
        link_color: params.link_color || darkParams.link_color,
        button_color: params.button_color || darkParams.button_color,
        button_text_color: params.button_text_color || darkParams.button_text_color,
        header_bg_color: params.header_bg_color || darkParams.header_bg_color,
        accent_text_color: params.accent_text_color || darkParams.accent_text_color
      };
      if (webApp?.setHeaderColor) {
        try { webApp.setHeaderColor('#000000'); } catch(e) {}
      }
      if (webApp?.setBackgroundColor) {
        try { webApp.setBackgroundColor('#000000'); } catch(e) {}
      }
    }

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

    // Force quick cleanup of transition helper
    const timer = setTimeout(() => {
      root.classList.remove('theme-switching');
    }, 50);

    return () => clearTimeout(timer);
  }, [colorScheme]);

  // Handle Telegram themeChanged events separately to prevent double run on direct changes
  useEffect(() => {
    const webApp = getTelegramWebApp();
    if (webApp) {
      const handleThemeChange = () => {
        if (webApp.colorScheme === 'light' || webApp.colorScheme === 'dark') {
          setColorScheme(webApp.colorScheme);
        }
      };
      try {
        webApp.onEvent('themeChanged', handleThemeChange);
      } catch(e) {}
      return () => {
        try {
          webApp.offEvent('themeChanged', handleThemeChange);
        } catch(e) {}
      };
    }
  }, []);

  const toggleTheme = () => {
    const next = colorScheme === 'dark' ? 'light' : 'dark';
    if (typeof window !== 'undefined') {
      localStorage.setItem('theme_mode', next);
    }
    setColorScheme(next);
  };

  const setTheme = (theme: 'light' | 'dark') => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('theme_mode', theme);
    }
    setColorScheme(theme);
  };

  return (
    <ThemeContext.Provider value={{ colorScheme, themeParams, toggleTheme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => useContext(ThemeContext);

