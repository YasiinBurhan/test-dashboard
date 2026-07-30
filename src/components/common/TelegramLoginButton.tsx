import React, { useEffect, useRef } from 'react';

interface TelegramUser {
  id: number;
  first_name: string;
  last_name?: string;
  username?: string;
  photo_url?: string;
  auth_date: number;
  hash: string;
}

interface TelegramLoginButtonProps {
  botName: string;
  onAuth: (user: TelegramUser) => void;
  buttonSize?: 'large' | 'medium' | 'small';
  cornerRadius?: number;
  requestAccess?: boolean;
  usePic?: boolean;
}

export const TelegramLoginButton: React.FC<TelegramLoginButtonProps> = ({
  botName,
  onAuth,
  buttonSize = 'large',
  cornerRadius,
  requestAccess = true,
  usePic = true,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Add the callback to the global window object
    (window as any).onTelegramAuth = (user: TelegramUser) => {
      onAuth(user);
    };

    if (containerRef.current) {
      // Clear previous script if any
      containerRef.current.innerHTML = '';

      const script = document.createElement('script');
      script.src = 'https://telegram.org/js/telegram-widget.js?22';
      script.setAttribute('data-telegram-login', botName);
      script.setAttribute('data-size', buttonSize);
      if (cornerRadius !== undefined) {
        script.setAttribute('data-radius', cornerRadius.toString());
      }
      script.setAttribute('data-request-access', requestAccess ? 'write' : 'read');
      script.setAttribute('data-userpic', usePic.toString());
      script.setAttribute('data-onauth', 'onTelegramAuth(user)');
      script.async = true;

      containerRef.current.appendChild(script);
    }

    return () => {
      delete (window as any).onTelegramAuth;
    };
  }, [botName, buttonSize, cornerRadius, requestAccess, usePic, onAuth]);

  return <div ref={containerRef} className="flex justify-center my-4" />;
};
