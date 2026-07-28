import { collection, doc, getDocs, getDoc, setDoc, deleteDoc, query, orderBy, where, onSnapshot } from 'firebase/firestore';
import { db } from '../config';
import { handleFirestoreError, OperationType } from '../error';
import { RecruiterSalary, DailyReport } from '../../types';
import { getWIBMonday, getWIBMondayOfDate } from '../../utils/format';

const COLLECTION_NAME = 'salaries';

export function subscribeToAllSalaries(onUpdate: (salaries: RecruiterSalary[]) => void, onError?: (error: any) => void): () => void {
  const salariesRef = collection(db, COLLECTION_NAME);
  const q = query(salariesRef, orderBy('createdAt', 'desc'));

  return onSnapshot(q, (snapshot) => {
    const salaries = snapshot.docs.map(docSnap => docSnap.data() as RecruiterSalary);
    onUpdate(salaries);
  }, (error) => {
    console.warn('Notice listening to all salaries:', error);
    if (onError) {
      onError(error);
    } else {
      onUpdate([]);
    }
  });
}

export async function getAllSalaries(): Promise<RecruiterSalary[]> {
  try {
    const salariesRef = collection(db, COLLECTION_NAME);
    const q = query(salariesRef, orderBy('createdAt', 'desc'));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(docSnap => docSnap.data() as RecruiterSalary);
  } catch (error) {
    const rawMessage = error instanceof Error ? error.message : String(error);
    if (rawMessage.includes('permission') || rawMessage.includes('PERMISSION_DENIED')) {
      console.warn('Firestore permissions missing for salaries collection');
      return [];
    }
    return handleFirestoreError(error, OperationType.LIST, COLLECTION_NAME);
  }
}

export async function saveSalarySlip(salary: RecruiterSalary): Promise<void> {
  try {
    const salaryRef = doc(db, COLLECTION_NAME, salary.id);
    await setDoc(salaryRef, {
      ...salary,
      updatedAt: new Date().toISOString()
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `${COLLECTION_NAME}/${salary.id}`);
  }
}

export async function deleteSalarySlip(id: string): Promise<void> {
  try {
    const salaryRef = doc(db, COLLECTION_NAME, id);
    await deleteDoc(salaryRef);
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `${COLLECTION_NAME}/${id}`);
  }
}

/**
 * Automatically fetch and aggregate a recruiter's daily reports for a specific week
 * and calculate smart defaults for their salary slip fields.
 */
export async function calculateRecruiterMetrics(
  telegramId: string,
  periodeMondayStr: string
): Promise<Partial<RecruiterSalary>> {
  try {
    // Fetch all reports for this user from both summary and applicant-specific collections
    const reportsRef = collection(db, 'laporan_harian');
    const qSummary = query(reportsRef, where('telegramId', '==', telegramId));
    const dataHarianRef = collection(db, 'data_harian');
    const qApplicant = query(dataHarianRef, where('telegramId', '==', telegramId));

    const [snapshotSummary, snapshotApplicant] = await Promise.all([
      getDocs(qSummary),
      getDocs(qApplicant)
    ]);

    const summaryReports = snapshotSummary.docs.map(docSnap => docSnap.data() as DailyReport);
    const applicantReports = snapshotApplicant.docs.map(docSnap => docSnap.data() as DailyReport);
    const allReports = [...summaryReports, ...applicantReports];

    // Filter reports that belong to the selected week (WIB Monday)
    const reportsInWeek = allReports.filter(r => {
      const reportDate = r.date || (r.createdAt ? r.createdAt.split('T')[0] : '');
      if (!reportDate) return false;
      return getWIBMondayOfDate(reportDate) === periodeMondayStr;
    });

    // 1. Hari Efektif (Dynamic calculation based on daily verified ACC applicant counts and posting targets)
    const summaryReportsInWeek = reportsInWeek.filter(r => !r.applicantWhatsapp && !r.uid9Kucing && !r.applicantTelegramUsername);
    let hariEfektif = 0;

    for (const r of summaryReportsInWeek) {
      const reportDate = r.date;
      if (!reportDate) continue;

      const posting = Number(r.posting) || 0;

      // Filter applicant reports for this specific date
      const applicantReportsOnDate = reportsInWeek.filter(app => 
        (app.applicantWhatsapp || app.uid9Kucing || app.applicantTelegramUsername) && 
        app.date === reportDate
      );

      // Count how many are ACC (Verified)
      const accCount = applicantReportsOnDate.filter(app => app.result === 'ACC').length;

      // Determine required target posting based on verified ACC count
      let requiredPosting = 90;
      if (accCount >= 3) requiredPosting = 0;
      else if (accCount === 2) requiredPosting = 30;
      else if (accCount === 1) requiredPosting = 60;
      else requiredPosting = 90;

      // Target is reached if either accCount >= 3 or posting >= requiredPosting
      const isTargetReached = accCount >= 3 || posting >= requiredPosting;
      if (isTargetReached) {
        hariEfektif++;
      }
    }

    // 2. TOTAL POSTINGAN
    const totalPostingan = reportsInWeek.reduce((sum, r) => sum + (Number(r.posting) || 0), 0);

    const currentMondayStr = getWIBMonday(0);

    // 3. Deklarasi T0: Count detailed applicant reports where grup is T0 (must be in examination tab)
    const deklarasiT0 = reportsInWeek
      .filter(r => r.grup === 'T0' && (r.applicantWhatsapp || r.uid9Kucing || r.applicantTelegramUsername) && r.date < currentMondayStr)
      .length;

    // 4. Sebenarnya T0: Verified (ACC) T0 recruits (must be in examination tab)
    const sebenarnyaT0 = reportsInWeek
      .filter(r => r.result === 'ACC' && r.grup === 'T0' && (r.applicantWhatsapp || r.uid9Kucing || r.applicantTelegramUsername) && r.date < currentMondayStr)
      .length;

    // 5. T3: Verified (ACC) T3 recruits (must be in examination tab)
    const t3 = reportsInWeek
      .filter(r => r.result === 'ACC' && r.grup === 'T3' && (r.applicantWhatsapp || r.uid9Kucing || r.applicantTelegramUsername) && r.date < currentMondayStr)
      .length;

    // 6. Deklarasi V0: Count detailed applicant reports where grup is V0 (must be in examination tab)
    const deklarasiV0 = reportsInWeek
      .filter(r => r.grup === 'V0' && (r.applicantWhatsapp || r.uid9Kucing || r.applicantTelegramUsername) && r.date < currentMondayStr)
      .length;

    // 7. Sebenarnya V0: Verified (ACC) V0 recruits (must be in examination tab)
    const sebenarnyaV0 = reportsInWeek
      .filter(r => r.result === 'ACC' && r.grup === 'V0' && (r.applicantWhatsapp || r.uid9Kucing || r.applicantTelegramUsername) && r.date < currentMondayStr)
      .length;

    // 8. Deduksi (auto-calculate late submission fines: sum of fine)
    const deduksi = reportsInWeek.reduce((sum, r) => sum + (Number(r.fine) || 0), 0);

    // 9. Tingkat Penerimaan (% ACC)
    const totalDeklarasi = deklarasiT0 + deklarasiV0;
    const totalSebenarnya = sebenarnyaT0 + sebenarnyaV0;
    const tingkatPenerimaan = totalDeklarasi > 0 
      ? Math.round((totalSebenarnya / totalDeklarasi) * 100) 
      : 0;

    // Smart default salary formula based on active recruitment rates
    // Level is decided based on number of promoted keanggotaan (t3 + sebenarnyaV0)
    const totalPromosi = t3 + sebenarnyaV0;
    const levelGaji = totalPromosi >= 12 ? 'Level 3' : totalPromosi >= 7 ? 'Level 2' : totalPromosi >= 3 ? 'Level 1' : 'Level 0';
    
    let gajiPokok = 0;
    let komisi = 0;
    let bonusT3 = 0;

    if (levelGaji === 'Level 3') {
      gajiPokok = 500000;
      komisi = sebenarnyaT0 * 2000;
      bonusT3 = totalPromosi * 9000;
    } else if (levelGaji === 'Level 2') {
      gajiPokok = 400000;
      komisi = sebenarnyaT0 * 2000;
      bonusT3 = totalPromosi * 8000;
    } else if (levelGaji === 'Level 1') {
      gajiPokok = 300000;
      komisi = sebenarnyaT0 * 2000;
      bonusT3 = totalPromosi * 7000;
    } else { // Level 0
      gajiPokok = 0;
      komisi = sebenarnyaT0 * 5000;
      bonusT3 = totalPromosi * 10000;
    }

    const bonusT0 = 0;
    const otherBonus = 0;
    
    const totalGaji = gajiPokok + komisi + bonusT0 + bonusT3 + otherBonus - deduksi;

    return {
      hariEfektif,
      totalPostingan,
      deklarasiT0,
      sebenarnyaT0,
      t3,
      deklarasiV0,
      sebenarnyaV0,
      levelGaji,
      tingkatPenerimaan,
      rasioPeningkatan: 0,
      gajiPokok,
      komisi,
      bonusT0,
      bonusT3,
      otherBonus,
      deduksi,
      totalGaji: Math.max(0, totalGaji)
    };
  } catch (error) {
    console.error('Error calculating recruiter metrics:', error);
    return {
      hariEfektif: 0,
      totalPostingan: 0,
      deklarasiT0: 0,
      sebenarnyaT0: 0,
      t3: 0,
      deklarasiV0: 0,
      sebenarnyaV0: 0,
      levelGaji: 'Level 1',
      tingkatPenerimaan: 0,
      rasioPeningkatan: 0,
      gajiPokok: 0,
      komisi: 0,
      bonusT0: 0,
      bonusT3: 0,
      otherBonus: 0,
      deduksi: 0,
      totalGaji: 0
    };
  }
}
