import React, { useState, useEffect } from 'react';
import { GlassCard } from '../components/common/GlassCard';
import { StatusBadge } from '../components/common/StatusBadge';
import { Button } from '../components/common/Button';
import { formatUsername, formatWIBDate, formatWIBDateTime } from '../utils/format';
import { useRecruiters } from '../hooks/useRecruiters';
import { UserProfile, UserStatus } from '../types';
import { getGoogleSheetInfoApi } from '../services/api';
import { Shield, Search, Filter, CheckCircle2, XCircle, AlertTriangle, RefreshCw, ChevronLeft, ChevronRight, Eye, FileSpreadsheet, ExternalLink } from 'lucide-react';

export const AdminPage: React.FC = () => {
  const { users, isLoading, error, refetch, changeStatus } = useRecruiters();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [selectedUser, setSelectedUser] = useState<UserProfile | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [sheetUrl, setSheetUrl] = useState<string | null>(null);

  useEffect(() => {
    getGoogleSheetInfoApi().then((res) => {
      if (res.success && res.data?.url) {
        setSheetUrl(res.data.url);
      }
    }).catch(console.warn);
  }, []);

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 8;

  const filteredUsers = users.filter((u) => {
    const matchesSearch =
      u.firstName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      u.lastName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      u.username.toLowerCase().includes(searchTerm.toLowerCase()) ||
      u.telegramId.toLowerCase().includes(searchTerm.toLowerCase()) ||
      u.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      u.whatsapp.toLowerCase().includes(searchTerm.toLowerCase()) ||
      u.akun9Kucing.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesStatus = statusFilter === 'ALL' ? true : u.status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  const totalPages = Math.ceil(filteredUsers.length / itemsPerPage) || 1;
  const paginatedUsers = filteredUsers.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const handleUpdateStatus = async (telegramId: string, newStatus: UserStatus) => {
    setActionLoading(true);
    try {
      await changeStatus(telegramId, newStatus);
      if (selectedUser?.telegramId === telegramId) {
        setSelectedUser((prev) => (prev ? { ...prev, status: newStatus } : null));
      }
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Gagal memperbarui status');
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <div className="space-y-5 pb-28">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-extrabold text-white tracking-tight flex items-center gap-2">
            <Shield className="w-6 h-6 text-indigo-400" />
            <span>Admin Panel Rekrutmen</span>
          </h2>
          <p className="text-xs text-slate-400">
            Persetujuan & pengelolaan status anggota recruiter.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {sheetUrl && (
            <a
              href={sheetUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="px-3 py-2 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 hover:bg-emerald-500/25 text-xs font-bold flex items-center gap-1.5 transition-all"
            >
              <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
              <span className="hidden sm:inline">Google Sheets ACC</span>
              <ExternalLink className="w-3 h-3 opacity-70" />
            </a>
          )}

          <button
            onClick={refetch}
            disabled={isLoading}
            className="p-2.5 rounded-2xl bg-slate-900 border border-slate-800 text-slate-300 hover:text-white cursor-pointer"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs p-3 rounded-2xl">
          {error}
        </div>
      )}

      {/* Filter and Search Controls */}
      <GlassCard className="p-3.5 space-y-3 border-slate-800">
        <div className="flex flex-col sm:flex-row gap-2">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3.5 top-3 text-slate-400" />
            <input
              type="text"
              placeholder="Cari ID / Nama / Email / 9Kucing..."
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full bg-slate-900/80 border border-slate-700/60 rounded-xl pl-10 pr-3 py-2 text-xs text-white outline-none focus:border-indigo-500"
            />
          </div>

          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
            {['ALL', 'Pending', 'Active', 'Rejected', 'Suspended'].map((st) => (
              <button
                key={st}
                onClick={() => {
                  setStatusFilter(st);
                  setCurrentPage(1);
                }}
                className={`px-3 py-1.5 rounded-xl text-[11px] font-semibold whitespace-nowrap transition-colors cursor-pointer ${
                  statusFilter === st
                    ? 'bg-indigo-600 text-white'
                    : 'bg-slate-900 text-slate-400 hover:text-slate-200 border border-slate-800'
                }`}
              >
                {st}
              </button>
            ))}
          </div>
        </div>
      </GlassCard>

      {/* Recruiter Users Table/List */}
      <div className="space-y-3">
        {isLoading ? (
          <div className="py-12 text-center text-slate-400 text-xs">
            Memuat daftar recruiter...
          </div>
        ) : paginatedUsers.length === 0 ? (
          <GlassCard className="py-12 text-center text-slate-400 space-y-2">
            <Filter className="w-10 h-10 text-slate-600 mx-auto" />
            <p className="text-sm font-semibold text-slate-300">Tidak Ada Data Recruiter</p>
            <p className="text-xs text-slate-500">
              Tidak ada data pendaftar yang cocok dengan filter pencarian saat ini.
            </p>
          </GlassCard>
        ) : (
          paginatedUsers.map((user) => (
            <GlassCard
              key={user.telegramId}
              className={`p-4 space-y-3 border-slate-800 hover:border-slate-700 ${
                user.status === 'Pending' ? 'border-amber-500/40 bg-amber-500/5' : ''
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  {user.photoUrl ? (
                    <img
                      src={user.photoUrl}
                      alt="Avatar"
                      className="w-10 h-10 rounded-xl object-cover border border-slate-700"
                    />
                  ) : (
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-600 to-sky-500 flex items-center justify-center text-white font-bold text-sm">
                      {(user.firstName[0] || 'U').toUpperCase()}
                    </div>
                  )}

                  <div>
                    <h4 className="text-sm font-bold text-white flex items-center gap-2">
                      <span>{user.firstName} {user.lastName}</span>
                      <StatusBadge role={user.role} size="sm" />
                    </h4>
                    <span className="text-xs text-sky-400 font-medium block">
                      {formatUsername(user.username)} &bull; ID: {user.telegramId}
                    </span>
                  </div>
                </div>

                <StatusBadge status={user.status} />
              </div>

              {/* Grid details */}
              <div className="bg-slate-900/80 p-3 rounded-xl border border-slate-800/80 grid grid-cols-2 gap-2 text-xs">
                <div>
                  <span className="text-[10px] text-slate-500 font-semibold uppercase block">Email:</span>
                  <span className="text-slate-200 font-medium truncate block">{user.email}</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-500 font-semibold uppercase block">WhatsApp:</span>
                  <span className="text-slate-200 font-medium truncate block">{user.whatsapp}</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-500 font-semibold uppercase block">UID 9Kucing:</span>
                  <span className="text-slate-200 font-medium truncate block">{user.akun9Kucing}</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-500 font-semibold uppercase block">Didaftarkan:</span>
                  <span className="text-slate-300">{formatWIBDate(user.createdAt)}</span>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-end gap-2 pt-1 border-t border-slate-800/60">
                <button
                  onClick={() => setSelectedUser(user)}
                  className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold flex items-center gap-1 cursor-pointer"
                >
                  <Eye className="w-3.5 h-3.5" /> Detail
                </button>

                {user.status !== 'Active' && (
                  <button
                    disabled={actionLoading}
                    onClick={() => handleUpdateStatus(user.telegramId, 'Active')}
                    className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-1 shadow-md shadow-emerald-600/20 cursor-pointer"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" /> Setuju (Approve)
                  </button>
                )}

                {user.status !== 'Rejected' && (
                  <button
                    disabled={actionLoading}
                    onClick={() => handleUpdateStatus(user.telegramId, 'Rejected')}
                    className="px-3 py-1.5 rounded-xl bg-rose-600/80 hover:bg-rose-600 text-white text-xs font-semibold flex items-center gap-1 cursor-pointer"
                  >
                    <XCircle className="w-3.5 h-3.5" /> Tolak (Reject)
                  </button>
                )}

                {user.status !== 'Suspended' && (
                  <button
                    disabled={actionLoading}
                    onClick={() => handleUpdateStatus(user.telegramId, 'Suspended')}
                    className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-amber-600/80 text-amber-300 text-xs font-semibold flex items-center gap-1 cursor-pointer"
                  >
                    <AlertTriangle className="w-3.5 h-3.5" /> Suspend
                  </button>
                )}
              </div>
            </GlassCard>
          ))
        )}
      </div>

      {/* Pagination Bar */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between bg-slate-900/80 p-3 rounded-2xl border border-slate-800 text-xs text-slate-400">
          <span>Halaman {currentPage} dari {totalPages}</span>
          <div className="flex items-center gap-2">
            <button
              disabled={currentPage === 1}
              onClick={() => setCurrentPage((p) => p - 1)}
              className="p-1.5 rounded-xl bg-slate-800 disabled:opacity-40 text-white"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              disabled={currentPage === totalPages}
              onClick={() => setCurrentPage((p) => p + 1)}
              className="p-1.5 rounded-xl bg-slate-800 disabled:opacity-40 text-white"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Detail Modal */}
      {selectedUser && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <GlassCard className="max-w-md w-full space-y-4 text-left border-indigo-500/30">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Shield className="w-5 h-5 text-indigo-400" /> Detail Profil Recruiter
              </h3>
              <button
                onClick={() => setSelectedUser(null)}
                className="text-slate-400 hover:text-white font-bold"
              >
                ✕
              </button>
            </div>

            <div className="space-y-2 text-xs">
              <p><strong className="text-slate-400">Nama:</strong> {selectedUser.firstName} {selectedUser.lastName}</p>
              <p><strong className="text-slate-400">Username:</strong> {formatUsername(selectedUser.username)}</p>
              <p><strong className="text-slate-400">Telegram ID:</strong> {selectedUser.telegramId}</p>
              <p><strong className="text-slate-400">Email:</strong> {selectedUser.email}</p>
              <p><strong className="text-slate-400">WhatsApp:</strong> {selectedUser.whatsapp}</p>
              <p><strong className="text-slate-400">UID 9Kucing:</strong> {selectedUser.akun9Kucing}</p>
              <p><strong className="text-slate-400">Role:</strong> {selectedUser.role}</p>
              <p><strong className="text-slate-400">Status:</strong> <StatusBadge status={selectedUser.status} size="sm" /></p>
              <p><strong className="text-slate-400">Disetujui Oleh:</strong> {selectedUser.approvedBy || '-'}</p>
              <p><strong className="text-slate-400">Waktu Persetujuan:</strong> {selectedUser.approvedAt ? formatWIBDateTime(selectedUser.approvedAt) : '-'}</p>
            </div>

            {/* Quick Actions inside Modal */}
            <div className="pt-3 border-t border-slate-800 space-y-2">
              <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Ubah Status Recruiter:</span>
              <div className="flex flex-wrap gap-2">
                {selectedUser.status !== 'Active' && (
                  <button
                    disabled={actionLoading}
                    onClick={() => handleUpdateStatus(selectedUser.telegramId, 'Active')}
                    className="flex-1 min-w-[100px] px-3 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] font-bold flex items-center justify-center gap-1 cursor-pointer transition-colors"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" /> Approve
                  </button>
                )}

                {selectedUser.status !== 'Rejected' && (
                  <button
                    disabled={actionLoading}
                    onClick={() => handleUpdateStatus(selectedUser.telegramId, 'Rejected')}
                    className="flex-1 min-w-[100px] px-3 py-2 rounded-xl bg-rose-600/80 hover:bg-rose-600 text-white text-[11px] font-bold flex items-center justify-center gap-1 cursor-pointer transition-colors"
                  >
                    <XCircle className="w-3.5 h-3.5" /> Reject
                  </button>
                )}

                {selectedUser.status !== 'Suspended' && (
                  <button
                    disabled={actionLoading}
                    onClick={() => handleUpdateStatus(selectedUser.telegramId, 'Suspended')}
                    className="flex-1 min-w-[100px] px-3 py-2 rounded-xl bg-slate-800 hover:bg-amber-600/80 text-amber-300 text-[11px] font-bold flex items-center justify-center gap-1 cursor-pointer transition-colors"
                  >
                    <AlertTriangle className="w-3.5 h-3.5" /> Suspend
                  </button>
                )}
              </div>
            </div>

            <div className="pt-2">
              <Button fullWidth variant="secondary" onClick={() => setSelectedUser(null)}>
                Tutup Detail
              </Button>
            </div>
          </GlassCard>
        </div>
      )}
    </div>
  );
};
