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
        <label className="text-xs font-semibold text-slate-700 dark:text-slate-400 px-1">
          {label}
        </label>
      )}
      <div className="relative flex items-center">
        {icon && (
          <div className="absolute left-4 text-slate-600 dark:text-slate-400 text-lg pointer-events-none">
            {icon}
          </div>
        )}
        <input
          readOnly={readOnly}
          style={{ paddingLeft: icon ? '2.75rem' : undefined, ...props.style }}
          className={`w-full rounded-xl py-3 px-4 ${
            icon ? 'pl-11' : 'pl-4'
          } text-sm font-medium transition-all duration-200 outline-none border text-slate-900 dark:text-slate-100 placeholder:text-slate-600 dark:text-slate-400 dark:placeholder:text-slate-500 dark:text-slate-400 ${
            readOnly
              ? 'bg-slate-200/50 dark:bg-slate-900/40 border-slate-300 dark:border-slate-800 text-slate-500 dark:text-slate-400 cursor-not-allowed'
              : error
              ? 'border-rose-500/80 bg-rose-500/10 focus:ring-1 focus:ring-rose-500/30'
              : 'border-slate-300/80 dark:border-slate-800 bg-white/90 dark:bg-slate-900/80 focus:border-blue-500 focus:ring-1 focus:ring-blue-500/20'
          } ${className}`}
          {...props}
        />
      </div>
      {error && <span className="text-xs text-rose-500 dark:text-rose-400 px-1 font-medium">{error}</span>}
      {!error && helperText && (
        <span className="text-[11px] text-slate-500 dark:text-slate-400 px-1">{helperText}</span>
      )}
    </div>
  );
};
