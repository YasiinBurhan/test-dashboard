import React from 'react';
import { UserStatus, UserRole } from '../../types';

interface StatusBadgeProps {
  status?: UserStatus;
  role?: UserRole;
  size?: 'sm' | 'md';
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status, role, size = 'md' }) => {
  if (role) {
    const roleStyles = {
      Owner: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
      Admin: 'bg-indigo-500/15 text-indigo-300 border-indigo-500/30',
      Recruiter: 'bg-blue-500/15 text-blue-300 border-blue-500/30'
    };

    return (
      <span
        className={`inline-flex items-center gap-1.5 font-bold rounded-full border ${
          size === 'sm' ? 'px-2.5 py-0.5 text-[10px]' : 'px-3 py-1 text-xs'
        } ${roleStyles[role] || 'bg-slate-800 text-slate-300 border-slate-700'}`}
      >
        <span className="w-1.5 h-1.5 rounded-full bg-current animate-pulse" />
        {role}
      </span>
    );
  }

  if (status) {
    const statusStyles = {
      Active: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
      Pending: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
      Rejected: 'bg-rose-500/15 text-rose-400 border-rose-500/30',
      Suspended: 'bg-slate-500/15 text-slate-400 border-slate-500/30'
    };

    return (
      <span
        className={`inline-flex items-center gap-1.5 font-semibold rounded-full border ${
          size === 'sm' ? 'px-2.5 py-0.5 text-[10px]' : 'px-3 py-1 text-xs'
        } ${statusStyles[status] || 'bg-slate-800 text-slate-300 border-slate-700'}`}
      >
        <span className="w-1.5 h-1.5 rounded-full bg-current" />
        {status}
      </span>
    );
  }

  return null;
};
