import React from 'react';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  helperText?: string;
  error?: string;
  icon?: React.ReactNode;
}

export const Input: React.FC<InputProps> = ({
  label,
  helperText,
  error,
  icon,
  className = '',
  readOnly,
  ...props
}) => {
  return (
    <div className="flex flex-col gap-1.5 w-full">
      {label && (
        <label className="text-xs font-semibold text-slate-400 px-1">
          {label}
        </label>
      )}
      <div className="relative flex items-center">
        {icon && (
          <div className="absolute left-4 text-slate-400 text-lg pointer-events-none">
            {icon}
          </div>
        )}
        <input
          readOnly={readOnly}
          className={`w-full rounded-xl py-3 px-4 ${
            icon ? 'pl-11' : 'pl-4'
          } text-sm font-medium transition-all duration-200 outline-none border text-slate-100 placeholder:text-slate-500 ${
            readOnly
              ? 'bg-slate-900/40 border-slate-800 text-slate-500 cursor-not-allowed'
              : error
              ? 'border-rose-500/80 bg-rose-500/10 focus:ring-1 focus:ring-rose-500/30'
              : 'border-slate-800 bg-slate-900/80 focus:border-blue-500 focus:ring-1 focus:ring-blue-500/20'
          } ${className}`}
          {...props}
        />
      </div>
      {error && <span className="text-xs text-rose-400 px-1 font-medium">{error}</span>}
      {!error && helperText && (
        <span className="text-[11px] text-slate-400 px-1">{helperText}</span>
      )}
    </div>
  );
};
