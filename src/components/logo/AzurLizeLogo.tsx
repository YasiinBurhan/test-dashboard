import React from 'react';

export const ModernAMark: React.FC<{ size?: number; className?: string }> = ({ size = 24, className = '' }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 100 100"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={className}
  >
    <defs>
      <linearGradient id="azurAGradient1" x1="10" y1="90" x2="50" y2="10" gradientUnits="userSpaceOnUse">
        <stop offset="0%" stopColor="#0284c7" />
        <stop offset="50%" stopColor="#38bdf8" />
        <stop offset="100%" stopColor="#818cf8" />
      </linearGradient>
      <linearGradient id="azurAGradient2" x1="50" y1="10" x2="90" y2="90" gradientUnits="userSpaceOnUse">
        <stop offset="0%" stopColor="#3b82f6" />
        <stop offset="100%" stopColor="#1d4ed8" />
      </linearGradient>
      <linearGradient id="azurACrossbar" x1="25" y1="62" x2="75" y2="62" gradientUnits="userSpaceOnUse">
        <stop offset="0%" stopColor="#38bdf8" />
        <stop offset="100%" stopColor="#60a5fa" />
      </linearGradient>
      <filter id="azurGlow" x="-20%" y="-20%" width="140%" height="140%">
        <feGaussianBlur stdDeviation="3" result="blur" />
        <feComposite in="SourceGraphic" in2="blur" operator="over" />
      </filter>
    </defs>
    
    {/* Left leg of A */}
    <path
      d="M50 12 L20 84 H37 L50 50 L63 84 H80 L50 12 Z"
      fill="url(#azurAGradient1)"
      filter="url(#azurGlow)"
    />
    
    {/* Right leg of A for 3D bevel */}
    <path
      d="M50 12 L63 84 H80 L50 12 Z"
      fill="url(#azurAGradient2)"
      opacity="0.85"
    />
    
    {/* Futuristic crossbar */}
    <polygon
      points="31,60 69,60 63,68 37,68"
      fill="url(#azurACrossbar)"
    />
    
    {/* Inner triangle cutout */}
    <polygon
      points="50,28 38,54 62,54"
      fill="#030712"
    />
    
    {/* Tech dot accent */}
    <circle cx="50" cy="22" r="3.5" fill="#ffffff" />
  </svg>
);

interface AzurLizeLogoProps {
  size?: 'sm' | 'md' | 'lg' | 'xl';
  showText?: boolean;
  className?: string;
}

export const AzurLizeLogo: React.FC<AzurLizeLogoProps> = ({
  size = 'md',
  showText = true,
  className = ''
}) => {
  const sizeMap = {
    sm: { box: 'w-9 h-9', icon: 20, text: 'text-base' },
    md: { box: 'w-11 h-11', icon: 26, text: 'text-xl' },
    lg: { box: 'w-16 h-16', icon: 38, text: 'text-2xl' },
    xl: { box: 'w-24 h-24', icon: 56, text: 'text-3xl' }
  };

  const dimensions = sizeMap[size];

  return (
    <div className={`flex items-center gap-3 ${className}`}>
      <div className="shrink-0">
        <div
          className={`${dimensions.box} rounded-2xl bg-slate-900/90 border border-sky-500/30 flex items-center justify-center shadow-lg shadow-sky-500/20 backdrop-blur-md relative overflow-hidden group`}
        >
          <div className="absolute inset-0 bg-gradient-to-tr from-sky-500/10 via-blue-600/10 to-indigo-500/10 opacity-80" />
          <ModernAMark size={dimensions.icon} className="relative z-10 transition-transform duration-300 group-hover:scale-105" />
        </div>
      </div>

      {showText && (
        <div className="flex flex-col text-left">
          <div className="flex items-center gap-1.5">
            <span className={`font-black tracking-tight text-white ${dimensions.text}`}>
              Azur<span className="text-sky-400">Lize</span>
            </span>
            <span className="text-[9px] font-black uppercase tracking-wider text-sky-400 bg-sky-500/10 border border-sky-500/30 px-1.5 py-0.5 rounded-md shadow-sm">
              Team
            </span>
          </div>
          <span className="text-[10px] text-slate-400 font-bold tracking-wide uppercase">
            Recruitment System
          </span>
        </div>
      )}
    </div>
  );
};


