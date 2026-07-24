import { useState, useCallback, useEffect } from 'react';
import { UserProfile, UserRole, UserStatus } from '../types';
import { getAllUsers, subscribeToAllUsers, updateUserStatus, updateUserRole } from '../firebase/services/userService';
import { syncUserToSheetsApi } from '../services/api';
import { useAuth } from './useAuth';

export function useRecruiters() {
  const { userProfile } = useAuth();
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (userProfile?.role !== 'Admin' && userProfile?.role !== 'Owner') {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    const unsubscribe = subscribeToAllUsers((updatedUsers) => {
      setUsers(updatedUsers);
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, [userProfile?.role]);

  const changeStatus = async (telegramId: string, status: UserStatus) => {
    if (!userProfile) return;
    setIsLoading(true);
    try {
      const approved = status === 'Active';
      const approvedBy = `${userProfile.firstName} (${userProfile.role})`;
      await updateUserStatus(telegramId, status, approved, approvedBy);

      const targetUser = users.find((u) => u.telegramId === telegramId);
      const updatedUser: UserProfile | undefined = targetUser
        ? { ...targetUser, status, approved, approvedBy, approvedAt: new Date().toISOString() }
        : undefined;

      setUsers((prev) =>
        prev.map((u) => (u.telegramId === telegramId ? { ...u, status, approved, approvedBy } : u))
      );

      // Auto sync to Google Sheets if ACC'd
      if (status === 'Active' && updatedUser) {
        syncUserToSheetsApi(updatedUser).catch((sheetsErr) => {
          console.warn('[Google Sheets] Auto sync user failed:', sheetsErr);
        });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal memperbarui status user.');
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  const changeRole = async (telegramId: string, role: UserRole) => {
    if (!userProfile || userProfile.role !== 'Owner') {
      throw new Error('Hanya Owner yang dapat mengubah Role user');
    }
    setIsLoading(true);
    try {
      await updateUserRole(telegramId, role, userProfile.firstName);
      setUsers((prev) =>
        prev.map((u) => (u.telegramId === telegramId ? { ...u, role } : u))
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal mengubah role user.');
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  return {
    users,
    isLoading,
    error,
    refetch: async () => {}, // No-op, handled by realtime subscription
    changeStatus,
    changeRole
  };
}
