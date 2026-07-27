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

const SUMMARY_COLLECTION = 'laporan_harian';
const APPLICANT_COLLECTION = 'data_harian';

async function getCollectionName(reportId: string): Promise<string> {
  try {
    const dataHarianDoc = doc(db, APPLICANT_COLLECTION, reportId);
    const snap = await getDoc(dataHarianDoc);
    if (snap.exists()) {
      return APPLICANT_COLLECTION;
    }
  } catch (err) {
    console.warn('Error fetching from data_harian:', err);
  }
  return SUMMARY_COLLECTION;
}

export function subscribeToUserReports(
  telegramId: string, 
  onUpdate: (reports: DailyReport[]) => void,
  onError?: (error: Error) => void
): () => void {
  const qSummary = query(collection(db, SUMMARY_COLLECTION), where('telegramId', '==', telegramId));
  const qApplicant = query(collection(db, APPLICANT_COLLECTION), where('telegramId', '==', telegramId));

  let summaryReports: DailyReport[] = [];
  let applicantReports: DailyReport[] = [];

  const handleUpdate = () => {
    const combined = [...summaryReports, ...applicantReports];
    combined.sort((a, b) => {
      const timeA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const timeB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return timeB - timeA;
    });
    onUpdate(combined);
  };

  const unsub1 = onSnapshot(qSummary, (snapshot) => {
    summaryReports = snapshot.docs.map(docSnap => docSnap.data() as DailyReport);
    handleUpdate();
  }, (err) => {
    console.warn('Notice listening to user summary reports:', err);
    if (onError) onError(err);
  });

  const unsub2 = onSnapshot(qApplicant, (snapshot) => {
    applicantReports = snapshot.docs.map(docSnap => docSnap.data() as DailyReport);
    handleUpdate();
  }, (err) => {
    console.warn('Notice listening to user applicant reports:', err);
    if (onError) onError(err);
  });

  return () => {
    unsub1();
    unsub2();
  };
}

export function subscribeToAllReports(
  onUpdate: (reports: DailyReport[]) => void,
  onError?: (error: Error) => void
): () => void {
  const qSummary = query(collection(db, SUMMARY_COLLECTION), orderBy('createdAt', 'desc'));
  const qApplicant = query(collection(db, APPLICANT_COLLECTION), orderBy('createdAt', 'desc'));

  let summaryReports: DailyReport[] = [];
  let applicantReports: DailyReport[] = [];

  const handleUpdate = () => {
    const combined = [...summaryReports, ...applicantReports];
    combined.sort((a, b) => {
      const timeA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const timeB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return timeB - timeA;
    });
    onUpdate(combined);
  };

  const unsub1 = onSnapshot(qSummary, (snapshot) => {
    summaryReports = snapshot.docs.map(docSnap => docSnap.data() as DailyReport);
    handleUpdate();
  }, (err) => {
    console.warn('Error listening to all summary reports:', err);
  });

  const unsub2 = onSnapshot(qApplicant, (snapshot) => {
    applicantReports = snapshot.docs.map(docSnap => docSnap.data() as DailyReport);
    handleUpdate();
  }, (err) => {
    console.warn('Error listening to all applicant reports:', err);
  });

  return () => {
    unsub1();
    unsub2();
  };
}

export async function createDailyReport(
  user: { telegramId: string; username: string; name: string },
  formData: DailyReportFormData
): Promise<DailyReport> {
  const reportId = `REP_${Date.now()}_${user.telegramId.slice(-4)}`;
  const now = new Date().toISOString();

  const isApplicantReport = !!(formData.applicantWhatsapp || formData.uid9Kucing || formData.applicantTelegramUsername);
  const targetCollection = isApplicantReport ? APPLICANT_COLLECTION : SUMMARY_COLLECTION;

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
    applicantName: formData.applicantName || '',
    grup: formData.grup || 'T0',
    visit: Number(formData.visit) || 0,
    applicant: Number(formData.applicant) || 0,
    quality: Number(formData.quality) || 0,
    posting: Number(formData.posting) || 0,
    permission: Number(formData.permission) || 0,
    effectiveStatus: formData.effectiveStatus || 'YES',
    note: formData.note || '',
    // videoUrl is saved if it's a valid web URL (blob/data URLs are excluded from Firestore to prevent 1MB document size limits)
    ...(formData.videoUrl && (formData.videoUrl.startsWith('http://') || formData.videoUrl.startsWith('https://')) ? { videoUrl: formData.videoUrl } : {}),
    applicantPhotoUrl: formData.applicantPhotoUrl || '',
    isLate: formData.isLate || false,
    fine: formData.fine || 0,
    createdAt: now,
    ...(isApplicantReport ? { result: formData.result || 'Pending' } : {})
  };

  try {
    // PREVENT DUPLICATES
    if (isApplicantReport) {
      // 1. Check for duplicate applicant (UID, Telegram, or WhatsApp)
      const existingApplicant = await checkReportDuplicate(
        formData.uid9Kucing || '', 
        formData.applicantTelegramUsername || '', 
        formData.applicantWhatsapp || ''
      );
      if (existingApplicant) {
        throw new Error(`Data pelamar duplikat terdeteksi: Sudah pernah diinput oleh @${existingApplicant.recruiterUsername || existingApplicant.username} pada ${existingApplicant.date}.`);
      }
    } else {
      // 2. Check for duplicate daily summary (One summary per user per day)
      const reportsRef = collection(db, SUMMARY_COLLECTION);
      const qSummary = query(
        reportsRef,
        where('telegramId', '==', user.telegramId),
        where('date', '==', formData.date)
      );
      const snapSummary = await getDocs(qSummary);
      
      // Filter out individual applicant reports (those with UID/WA/TG)
      const existingSummaryDoc = snapSummary.docs.find(d => {
        const data = d.data();
        return !data.uid9Kucing && !data.applicantWhatsapp && !data.applicantTelegramUsername;
      });

      if (existingSummaryDoc) {
        const existingReportData = existingSummaryDoc.data() as DailyReport;
        const existingId = existingSummaryDoc.id;
        const updatedReport: DailyReport = {
          ...existingReportData,
          ...report,
          reportId: existingId,
          updatedAt: now
        };
        const reportRef = doc(db, SUMMARY_COLLECTION, existingId);
        await setDoc(reportRef, updatedReport, { merge: true });

        const cleanSender = (report.username || '').replace(/@/g, '').trim();
        createNotification({
          targetRole: 'ADMIN_OWNER',
          title: 'Laporan Harian Diperbarui',
          message: `Laporan harian dikirim ulang/diperbarui oleh @${cleanSender} untuk tanggal ${report.date}.`,
          type: 'NEW_REPORT',
          reportId: existingId,
          senderName: report.username
        }).catch(err => console.error('Error creating report update notification:', err));

        return updatedReport;
      }
    }

    const reportRef = doc(db, targetCollection, reportId);
    await setDoc(reportRef, report);

    // Trigger notification to Admin & Owner if status is Pending or new report
    if (isApplicantReport) {
      const cleanRec = (report.recruiterUsername || report.username || '').replace(/@/g, '').trim();
      const cleanApp = (report.applicantTelegramUsername || '').replace(/@/g, '').trim();
      const applicantName = cleanApp ? `@${cleanApp}` : (report.name || 'Pelamar');
      createNotification({
        targetRole: 'ADMIN_OWNER',
        title: 'Laporan Rekrutan Baru (Pending)',
        message: `Laporan rekrutan dari @${cleanRec} untuk pelamar ${applicantName}. Status: Pending.`,
        type: 'NEW_REPORT',
        reportId,
        senderName: report.username
      }).catch(err => console.error('Error creating new report notification:', err));
    } else {
      const cleanSender = (report.username || '').replace(/@/g, '').trim();
      createNotification({
        targetRole: 'ADMIN_OWNER',
        title: 'Laporan Harian Baru',
        message: `Laporan harian baru dikirim oleh @${cleanSender} untuk tanggal ${report.date}.`,
        type: 'NEW_REPORT',
        reportId,
        senderName: report.username
      }).catch(err => console.error('Error creating new report notification:', err));
    }

    return report;
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `${targetCollection}/${reportId}`);
  }
}

export async function getReportsByTelegramId(telegramId: string): Promise<DailyReport[]> {
  try {
    const q1 = query(collection(db, SUMMARY_COLLECTION), where('telegramId', '==', telegramId));
    const q2 = query(collection(db, APPLICANT_COLLECTION), where('telegramId', '==', telegramId));

    const [snap1, snap2] = await Promise.all([getDocs(q1), getDocs(q2)]);
    const reports1 = snap1.docs.map(docSnap => docSnap.data() as DailyReport);
    const reports2 = snap2.docs.map(docSnap => docSnap.data() as DailyReport);

    const combined = [...reports1, ...reports2];
    return combined.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, SUMMARY_COLLECTION);
  }
}

export async function updateReportStatus(
  reportId: string, 
  result: 'Pending' | 'ACC' | 'REJECT',
  targetTelegramId?: string,
  applicantTgUsername?: string
): Promise<void> {
  try {
    const colName = await getCollectionName(reportId);
    const reportRef = doc(db, colName, reportId);
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
      const cleanApp = applicantTg ? applicantTg.replace(/@/g, '').trim() : '';
      const applicantName = cleanApp ? `@${cleanApp}` : 'Pelamar';

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
    handleFirestoreError(error, OperationType.WRITE, `reports/${reportId}`);
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
  const updateData = { ...data };
  if (updateData.videoUrl && !updateData.videoUrl.startsWith('http://') && !updateData.videoUrl.startsWith('https://')) {
    delete updateData.videoUrl;
  }

  try {
    const colName = await getCollectionName(reportId);
    const reportRef = doc(db, colName, reportId);
    await setDoc(reportRef, { ...updateData, updatedAt: new Date().toISOString() }, { merge: true });

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
        const cleanApp = applicantTg ? applicantTg.replace(/@/g, '').trim() : '';
        const applicantName = cleanApp ? `@${cleanApp}` : 'Pelamar';
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
    handleFirestoreError(error, OperationType.WRITE, `reports/${reportId}`);
  }
}

export async function updateReportPermission(reportId: string, permission: number): Promise<void> {
  try {
    const colName = await getCollectionName(reportId);
    const reportRef = doc(db, colName, reportId);
    await setDoc(reportRef, { permission, updatedAt: new Date().toISOString() }, { merge: true });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `reports/${reportId}`);
  }
}

export async function updateReportFine(reportId: string, fine: number): Promise<void> {
  try {
    const colName = await getCollectionName(reportId);
    const reportRef = doc(db, colName, reportId);
    await setDoc(reportRef, { fine, updatedAt: new Date().toISOString() }, { merge: true });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `reports/${reportId}`);
  }
}

export async function checkReportDuplicate(
  uid9Kucing: string,
  applicantTelegramUsername: string,
  applicantWhatsapp?: string
): Promise<DailyReport | null> {
  const reportsRef = collection(db, APPLICANT_COLLECTION);
  
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
    }

    return null;
  } catch (error) {
    console.error('Error checking report duplicate:', error);
    return null;
  }
}

export async function getAllReports(): Promise<DailyReport[]> {
  try {
    const [snap1, snap2] = await Promise.all([
      getDocs(collection(db, SUMMARY_COLLECTION)),
      getDocs(collection(db, APPLICANT_COLLECTION))
    ]);
    const reports1 = snap1.docs.map(docSnap => docSnap.data() as DailyReport);
    const reports2 = snap2.docs.map(docSnap => docSnap.data() as DailyReport);

    const combined = [...reports1, ...reports2];
    return combined.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, SUMMARY_COLLECTION);
  }
}
