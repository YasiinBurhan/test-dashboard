import { useEffect } from 'react';
import { getTelegramWebApp, triggerHaptic } from '../telegram/webapp';

export function useTelegram() {
  const webApp = getTelegramWebApp();

  const showMainButton = (text: string, onClick: () => void) => {
    if (!webApp?.MainButton) return;
    webApp.MainButton.setText(text);
    webApp.MainButton.show();
    webApp.MainButton.onClick(onClick);
  };

  const hideMainButton = () => {
    if (!webApp?.MainButton) return;
    webApp.MainButton.hide();
  };

  const showBackButton = (onClick: () => void) => {
    if (!webApp?.BackButton) return;
    webApp.BackButton.show();
    webApp.BackButton.onClick(onClick);
  };

  const hideBackButton = () => {
    if (!webApp?.BackButton) return;
    webApp.BackButton.hide();
  };

  return {
    webApp,
    isAvailable: Boolean(webApp),
    triggerHaptic,
    showMainButton,
    hideMainButton,
    showBackButton,
    hideBackButton
  };
}
