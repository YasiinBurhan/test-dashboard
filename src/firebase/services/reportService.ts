import {
  collection,
  doc,
  setDoc,
  getDoc,
  getDocs,
  query,
  where,
  orderBy,
  onSnapshot
} from 'firebase/firestore';
import { db } from '../config';
import { handleFirestoreError, OperationType } from '../error';
import { DailyReport, DailyReportFormData } from '../../types';
import { createNotification } from './notificationService';

const COLLECTION_NAME = 'laporan_harian';

export function subscribeToUserReports(
  telegramId: string, 
  onUpdate: (reports: DailyReport[]) => void,
  onError?: (error: Error) => void
): () => void {
  const reportsRef = collection(db, COLLECTION_NAME);
  const q = query(
    reportsRef,
    where('telegramId', '==', telegramId)
  );

  return onSnapshot(q, (snapshot) => {
    const reports = snapshot.docs.map((docSnap) => docSnap.data() as DailyReport);
    // Sort in client-side JS to avoid Firestore composite index requirement
    reports.sort((a, b) => {
      const timeA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const timeB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return timeB - timeA;
    });
    onUpdate(reports);
  }, (error) => {
    console.error('Error listening to user reports:', error);
    if (onError) {
      onError(error);
    } else {
      onUpdate([]);
    }
  });
}

export function subscribeToAllReports(
  onUpdate: (reports: DailyReport[]) => void,
  onError?: (error: Error) => void
): () => void {
  const reportsRef = collection(db, COLLECTION_NAME);
  const q = query(reportsRef, orderBy('createdAt', 'desc'));

  return onSnapshot(q, (snapshot) => {
    const reports = snapshot.docs.map((docSnap) => docSnap.data() as DailyReport);
    onUpdate(reports);
  }, (error) => {
    console.error('Error listening to all reports:', error);
    if (onError) {
      onError(error);
    } else {
      onUpdate([]);
    }
  });
}

export async function createDailyReport(
  user: { telegramId: string; username: string; name: string },
  formData: DailyReportFormData
): Promise<DailyReport> {
  const reportId = `REP_${Date.now()}_${user.telegramId.slice(-4)}`;
  const now = new Date().toISOString();

  const report: DailyReport = {
    reportId,
    telegramId: user.telegramId,
    username: user.username,
    name: user.name,
    date: formData.date,
    recruiterUsername: formData.recruiterUsername || user.username,
    channel: formData.channel || '',
    applicantWhatsapp: formData.applicantWhatsapp || '',
    uid9Kucing: formData.uid9Kucing || '',
    applicantTelegramUsername: formData.applicantTelegramUsername || '',
    result: formData.result || 'Pending',
    grup: formData.grup || 'T0',
    visit: Number(formData.visit) || 0,
    applicant: Number(formData.applicant) || 0,
    quality: Number(formData.quality) || 0,
    posting: Number(formData.posting) || 0,
    permission: Number(formData.permission) || 0,
    effectiveStatus: formData.effectiveStatus || 'YES',
    note: formData.note || '',
    videoUrl: formData.videoUrl || '',
    applicantPhotoUrl: formData.applicantPhotoUrl || '',
    isLate: formData.isLate || false,
    fine: formData.fine || 0,
    createdAt: now
  };

  try {
    const reportRef = doc(db, COLLECTION_NAME, reportId);
    await setDoc(reportRef, report);

    // Trigger notification to Admin & Owner if status is Pending or new report
    createNotification({
      targetRole: 'ADMIN_OWNER',
      title: 'Laporan Rekrutan Baru (Pending)',
      message: `Laporan rekrutan dari @${report.recruiterUsername || report.username} untuk pelamar ${report.applicantTelegramUsername ? '@' + report.applicantTelegramUsername.replace(/^@/, '') : (report.name || 'Pelamar')}. Status: Pending.`,
      type: 'NEW_REPORT',
      reportId,
      senderName: report.username
    }).catch(err => console.error('Error creating new report notification:', err));

    return report;
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `${COLLECTION_NAME}/${reportId}`);
  }
}

export async function getReportsByTelegramId(telegramId: string): Promise<DailyReport[]> {
  try {
    const reportsRef = collection(db, COLLECTION_NAME);
    const q = query(
      reportsRef,
      where('telegramId', '==', telegramId)
    );
    const snapshot = await getDocs(q);
    const reports = snapshot.docs.map((docSnap) => docSnap.data() as DailyReport);
    return reports.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, COLLECTION_NAME);
  }
}

export async function updateReportStatus(
  reportId: string, 
  result: 'Pending' | 'ACC' | 'REJECT',
  targetTelegramId?: string,
  applicantTgUsername?: string
): Promise<void> {
  try {
    const reportRef = doc(db, COLLECTION_NAME, reportId);
    await setDoc(reportRef, { result, updatedAt: new Date().toISOString() }, { merge: true });

    // Fetch telegramId and applicant info if not provided
    let recipientId = targetTelegramId;
    let applicantTg = applicantTgUsername;

    if (!recipientId) {
      const snap = await getDoc(reportRef);
      if (snap.exists()) {
        const data = snap.data() as DailyReport;
        recipientId = data.telegramId;
        applicantTg = data.applicantTelegramUsername;
      }
    }

    if (recipientId) {
      const isAcc = result === 'ACC';
      const isReject = result === 'REJECT';
      const applicantName = applicantTg ? `@${applicantTg.replace(/^@/, '')}` : 'Pelamar';

      createNotification({
        targetUserId: recipientId,
        title: isAcc ? 'Laporan Rekrutan Di-ACC! 🎉' : (isReject ? 'Laporan Rekrutan Ditolak ❌' : 'Status Laporan Diperbarui'),
        message: isAcc
          ? `Selamat! Data pelamar ${applicantName} Anda telah disetujui (ACC).`
          : (isReject ? `Data pelamar ${applicantName} Anda ditolak.` : `Status pelamar ${applicantName} diubah menjadi Pending.`),
        type: 'STATUS_CHANGE',
        reportId
      }).catch(err => console.error('Error creating status notification:', err));
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `${COLLECTION_NAME}/${reportId}`);
  }
}

export async function updateReportDetails(
  reportId: string,
  data: {
    applicantTelegramUsername?: string;
    applicantWhatsapp?: string;
    applicantPhotoUrl?: string;
    videoUrl?: string;
    channel?: string;
    grup?: string;
  },
  targetTelegramId?: string
): Promise<void> {
  try {
    const reportRef = doc(db, COLLECTION_NAME, reportId);
    await setDoc(reportRef, { ...data, updatedAt: new Date().toISOString() }, { merge: true });

    if (data.grup) {
      let recipientId = targetTelegramId;
      let applicantTg = data.applicantTelegramUsername;

      if (!recipientId || !applicantTg) {
        const snap = await getDoc(reportRef);
        if (snap.exists()) {
          const repData = snap.data() as DailyReport;
          recipientId = recipientId || repData.telegramId;
          applicantTg = applicantTg || repData.applicantTelegramUsername;
        }
      }

      if (recipientId) {
        const applicantName = applicantTg ? `@${applicantTg.replace(/^@/, '')}` : 'Pelamar';
        createNotification({
          targetUserId: recipientId,
          title: 'Promosi Rekrutan! 🚀',
          message: `Pelamar ${applicantName} Anda telah dipromosikan ke Grup ${data.grup}.`,
          type: 'PROMOTION',
          reportId
        }).catch(err => console.error('Error creating promotion notification:', err));
      }
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `${COLLECTION_NAME}/${reportId}`);
  }
}

export async function updateReportPermission(reportId: string, permission: number): Promise<void> {
  try {
    const reportRef = doc(db, COLLECTION_NAME, reportId);
    await setDoc(reportRef, { permission, updatedAt: new Date().toISOString() }, { merge: true });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `${COLLECTION_NAME}/${reportId}`);
  }
}

export async function checkReportDuplicate(
  uid9Kucing: string,
  applicantTelegramUsername: string,
  applicantWhatsapp?: string
): Promise<DailyReport | null> {
  const reportsRef = collection(db, COLLECTION_NAME);
  
  const cleanTg = applicantTelegramUsername ? applicantTelegramUsername.trim().replace(/^@/, '').toLowerCase() : '';
  const cleanUid = uid9Kucing ? uid9Kucing.trim() : '';
  const cleanWa = applicantWhatsapp ? applicantWhatsapp.trim().replace(/\D/g, '') : '';

  if (!cleanUid && !cleanTg && !cleanWa) return null;

  try {
    if (cleanUid) {
      const qUid = query(reportsRef, where('uid9Kucing', '==', cleanUid));
      const snapUid = await getDocs(qUid);
      if (!snapUid.empty) {
        return snapUid.docs[0].data() as DailyReport;
      }
    }

    if (cleanWa) {
      const qWa = query(reportsRef, where('applicantWhatsapp', '==', cleanWa));
      const snapWa = await getDocs(qWa);
      if (!snapWa.empty) {
        return snapWa.docs[0].data() as DailyReport;
      }
    }

    if (cleanTg) {
      // Check exact match
      const qTg = query(reportsRef, where('applicantTelegramUsername', '==', cleanTg));
      const snapTg = await getDocs(qTg);
      if (!snapTg.empty) {
        return snapTg.docs[0].data() as DailyReport;
      }

      // Check with @ prefix
      const qTgWithAt = query(reportsRef, where('applicantTelegramUsername', '==', `@${cleanTg}`));
      const snapTgWithAt = await getDocs(qTgWithAt);
      if (!snapTgWithAt.empty) {
        return snapTgWithAt.docs[0].data() as DailyReport;
      }

      // Check case-insensitively by fetching or comparing if needed, but standard query with exact or @ is highly reliable for our formatted data.
    }

    return null;
  } catch (error) {
    console.error('Error checking report duplicate:', error);
    return null;
  }
}

export async function getAllReports(): Promise<DailyReport[]> {
  try {
    const reportsRef = collection(db, COLLECTION_NAME);
    const q = query(reportsRef, orderBy('createdAt', 'desc'));
    const snapshot = await getDocs(q);
    return snapshot.docs.map((docSnap) => docSnap.data() as DailyReport);
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, COLLECTION_NAME);
  }
}
