import React, { useState, useEffect } from 'react';

interface GlassCardProps {
  children: React.ReactNode;
  className?: string;
  onClick?: () => void;
  hoverable?: boolean;
}

export const GlassCard: React.FC<GlassCardProps> = ({
  children,
  className = '',
  onClick,
  hoverable = false
}) => {
  const [isLowEnd, setIsLowEnd] = useState(false);

  useEffect(() => {
    // Basic detection for low-end devices (less than 4GB RAM or less than 4 CPU cores)
    if (typeof navigator !== 'undefined') {
      const memory = (navigator as any).deviceMemory;
      const cores = navigator.hardwareConcurrency;
      if ((memory && memory < 4) || (cores && cores < 4)) {
        setIsLowEnd(true);
      }
    }
  }, []);

  return (
    <div
      onClick={onClick}
      className={`rounded-[22px] p-5 border border-slate-200/80 dark:border-white/10 bg-white/90 dark:bg-slate-900/80 shadow-sm dark:shadow-xl ${isLowEnd ? '' : 'backdrop-blur-xl'} transition-all duration-300 relative overflow-hidden text-slate-900 dark:text-slate-100 ${
        hoverable ? 'hover:scale-[1.01] hover:border-sky-500/30 hover:shadow-md active:scale-[0.99] cursor-pointer' : ''
      } ${className}`}
    >
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-slate-300/40 dark:via-white/15 to-transparent pointer-events-none" />
      {children}
    </div>
  );
};
