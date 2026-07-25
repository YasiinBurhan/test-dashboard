import { useState, useCallback, useEffect } from 'react';
import { DailyReport, DailyReportFormData } from '../types';
import { 
  createDailyReport, 
  subscribeToUserReports, 
  subscribeToAllReports, 
  updateReportStatus,
  updateReportPermission,
  updateReportDetails
} from '../firebase/services/reportService';
import { syncReportToSheetsApi } from '../services/api';
import { useAuth } from './useAuth';

export function useReports() {
  const { telegramUser, userProfile } = useAuth();
  const [reports, setReports] = useState<DailyReport[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const role = userProfile?.role;
  const telegramUserId = telegramUser?.id;

  useEffect(() => {
    if (!telegramUserId) return;
    
    setIsLoading(true);
    let unsubscribe: () => void;

    const handleError = (err: any) => {
      console.warn('Error in useReports subscription:', err);
      const rawMessage = err instanceof Error ? err.message : String(err);
      if (rawMessage.includes('permission') || rawMessage.includes('PERMISSION_DENIED')) {
        setError('Aturan Firestore melarang akses. Mohon salin Aturan Keamanan (Firestore Rules) ke Firebase Console proyek Anda.');
      } else {
        setError('Gagal memuat data laporan harian.');
      }
      setIsLoading(false);
    };
    
    if (role === 'Admin' || role === 'Owner') {
      unsubscribe = subscribeToAllReports((data) => {
        setReports(data || []);
        setIsLoading(false);
      }, handleError);
    } else {
      unsubscribe = subscribeToUserReports(String(telegramUserId), (data) => {
        setReports(data || []);
        setIsLoading(false);
      }, handleError);
    }
    
    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [telegramUserId, role]);

  const submitReport = async (formData: DailyReportFormData) => {
    if (!telegramUser && !userProfile) throw new Error('Pengguna tidak terautentikasi');
    setIsLoading(true);
    setError(null);
    try {
      const currentTelegramId = userProfile?.telegramId || String(telegramUser?.id || '');
      const currentUsername = userProfile?.username || telegramUser?.username || '';
      const name = userProfile 
        ? (userProfile.lastName ? `${userProfile.firstName} ${userProfile.lastName}` : userProfile.firstName)
        : `${telegramUser?.first_name || ''} ${telegramUser?.last_name || ''}`.trim() || 'Recruiter';

      const newReport = await createDailyReport(
        {
          telegramId: currentTelegramId,
          username: currentUsername,
          name
        },
        formData
      );
      
      // Sync report to Google Sheets automatically
      syncReportToSheetsApi(newReport).catch((err) => {
        console.warn('[Google Sheets] Auto sync report failed:', err);
      });

      return newReport;
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Gagal mengirim laporan harian.';
      setError(msg);
      throw new Error(msg);
    } finally {
      setIsLoading(false);
    }
  };

  const updateStatus = async (reportId: string, status: 'Pending' | 'ACC' | 'REJECT') => {
    setIsLoading(true);
    setError(null);
    try {
      await updateReportStatus(reportId, status);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Gagal mengubah status.';
      setError(msg);
      throw new Error(msg);
    } finally {
      setIsLoading(false);
    }
  };

  const updatePermission = async (reportId: string, permission: number) => {
    setIsLoading(true);
    setError(null);
    try {
      await updateReportPermission(reportId, permission);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Gagal mengubah status izin.';
      setError(msg);
      throw new Error(msg);
    } finally {
      setIsLoading(false);
    }
  };

  const updateDetails = async (
    reportId: string,
    data: {
      applicantTelegramUsername?: string;
      applicantWhatsapp?: string;
      applicantPhotoUrl?: string;
      videoUrl?: string;
      channel?: string;
      grup?: string;
    }
  ) => {
    setIsLoading(true);
    setError(null);
    try {
      await updateReportDetails(reportId, data);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Gagal memperbarui data pelamar.';
      setError(msg);
      throw new Error(msg);
    } finally {
      setIsLoading(false);
    }
  };

  return {
    reports,
    isLoading,
    error,
    refetch: () => {}, // Handled by real-time listener
    submitReport,
    updateStatus,
    updatePermission,
    updateDetails
  };
}
