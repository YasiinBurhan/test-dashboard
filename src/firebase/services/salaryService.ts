import { collection, doc, getDocs, getDoc, setDoc, deleteDoc, query, orderBy, where, onSnapshot } from 'firebase/firestore';
import { db } from '../config';
import { handleFirestoreError, OperationType } from '../error';
import { RecruiterSalary, DailyReport } from '../../types';
import { getWIBMondayOfDate } from '../../utils/format';

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
    // Fetch all reports for this user
    const reportsRef = collection(db, 'laporan_harian');
    const q = query(reportsRef, where('telegramId', '==', telegramId));
    const snapshot = await getDocs(q);
    const allReports = snapshot.docs.map(docSnap => docSnap.data() as DailyReport);

    // Filter reports that belong to the selected week (WIB Monday)
    const reportsInWeek = allReports.filter(r => {
      const reportDate = r.date || (r.createdAt ? r.createdAt.split('T')[0] : '');
      if (!reportDate) return false;
      return getWIBMondayOfDate(reportDate) === periodeMondayStr;
    });

    // 1. Hari Efektif
    const hariEfektif = reportsInWeek.filter(r => r.effectiveStatus === 'YES').length;

    // 2. TOTAL POSTINGAN
    const totalPostingan = reportsInWeek.reduce((sum, r) => sum + (Number(r.posting) || 0), 0);

    // 3. Deklarasi T0: Sum applicant count where grup is T0 or T3
    const deklarasiT0 = reportsInWeek
      .filter(r => r.grup === 'T0' || r.grup === 'T3')
      .reduce((sum, r) => {
        const isDetailed = !!(r.applicantWhatsapp || r.uid9Kucing || r.applicantTelegramUsername);
        return sum + (isDetailed ? 1 : (Number(r.applicant) || 0));
      }, 0);

    // 4. Sebenarnya T0: Verified (ACC) T0 or T3 recruits
    const sebenarnyaT0 = reportsInWeek
      .filter(r => r.result === 'ACC' && (r.grup === 'T0' || r.grup === 'T3'))
      .reduce((sum, r) => {
        const isDetailed = !!(r.applicantWhatsapp || r.uid9Kucing || r.applicantTelegramUsername);
        return sum + (isDetailed ? 1 : (Number(r.applicant) || 0));
      }, 0);

    // 5. T3: Verified (ACC) T3 recruits
    const t3 = reportsInWeek
      .filter(r => r.result === 'ACC' && r.grup === 'T3')
      .reduce((sum, r) => {
        const isDetailed = !!(r.applicantWhatsapp || r.uid9Kucing || r.applicantTelegramUsername);
        return sum + (isDetailed ? 1 : (Number(r.applicant) || 0));
      }, 0);

    // 6. Deklarasi V0: Sum applicant count where grup is V0
    const deklarasiV0 = reportsInWeek
      .filter(r => r.grup === 'V0')
      .reduce((sum, r) => {
        const isDetailed = !!(r.applicantWhatsapp || r.uid9Kucing || r.applicantTelegramUsername);
        return sum + (isDetailed ? 1 : (Number(r.applicant) || 0));
      }, 0);

    // 7. Sebenarnya V0: Verified (ACC) V0 recruits
    const sebenarnyaV0 = reportsInWeek
      .filter(r => r.result === 'ACC' && r.grup === 'V0')
      .reduce((sum, r) => {
        const isDetailed = !!(r.applicantWhatsapp || r.uid9Kucing || r.applicantTelegramUsername);
        return sum + (isDetailed ? 1 : (Number(r.applicant) || 0));
      }, 0);

    // 8. Deduksi (auto-calculate late submission fines: sum of fine)
    const deduksi = reportsInWeek.reduce((sum, r) => sum + (Number(r.fine) || 0), 0);

    // 9. Tingkat Penerimaan (% ACC)
    const totalDeklarasi = deklarasiT0 + deklarasiV0;
    const totalSebenarnya = sebenarnyaT0 + sebenarnyaV0;
    const tingkatPenerimaan = totalDeklarasi > 0 
      ? Math.round((totalSebenarnya / totalDeklarasi) * 100) 
      : 0;

    // Smart default salary formula based on active recruitment rates
    // Feel free to adjust these base rates for default values
    const levelGaji = hariEfektif >= 6 ? 'Senior Recruiter' : hariEfektif >= 3 ? 'Junior Recruiter' : 'Intern Recruiter';
    const gajiPokok = hariEfektif * 50000; // Rp 50.000 per effective day worked
    const komisi = sebenarnyaT0 * 25000 + sebenarnyaV0 * 15000; // T0 get 25k, V0 get 15k
    const bonusT0 = sebenarnyaT0 >= 5 ? 100000 : 0; // Bonus threshold
    const bonusT3 = t3 * 35000; // Rp 35.000 per promoted T3 recruiter
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
      levelGaji: 'Intern Recruiter',
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
