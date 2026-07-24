import React from 'react';

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
  return (
    <div
      onClick={onClick}
      style={{
        backgroundColor: 'var(--tg-secondary-bg-color, rgba(15, 23, 42, 0.65))',
        color: 'var(--tg-text-color, #f8fafc)'
      }}
      className={`rounded-[20px] p-5 border border-slate-200 dark:border-white/10 shadow-sm backdrop-blur-xl transition-all duration-300 relative overflow-hidden ${
        hoverable ? 'hover:scale-[1.01] hover:border-sky-500/30 hover:shadow-sm active:scale-[0.99] cursor-pointer' : ''
      } ${className}`}
    >
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent pointer-events-none" />
      {children}
    </div>
  );
};
