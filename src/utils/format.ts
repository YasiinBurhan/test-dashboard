export function formatUsername(username?: string | null): string {
  if (!username) return 'tanpa_username';
  // Remove all existing @ symbols and add exactly one at the start
  const clean = username.replace(/@/g, '').trim();
  if (!clean) return 'tanpa_username';
  return `@${clean}`;
}

export function formatDateDisplay(dateStr: string): string {
  if (!dateStr) return '-';
  const clean = dateStr.split('T')[0];
  const parts = clean.split('-');
  if (parts.length === 3) {
    if (parts[0].length === 4) {
      return `${parts[2]}/${parts[1]}/${parts[0]}`;
    } else if (parts[2].length === 4) {
      return `${parts[0]}/${parts[1]}/${parts[2]}`;
    }
  }
  return dateStr;
}

export function formatWIBDate(dateString?: string | null): string {
  if (!dateString) return '-';
  try {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) {
      // It might be YYYY-MM-DD
      const clean = dateString.split('T')[0];
      const parts = clean.split('-');
      if (parts.length === 3 && parts[0].length === 4) {
        return `${parts[2]}/${parts[1]}/${parts[0]}`;
      }
      return dateString;
    }
    
    // Format to WIB (Asia/Jakarta) in DD/MM/YYYY
    const str = date.toLocaleDateString('id-ID', {
      timeZone: 'Asia/Jakarta',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
    return str.replace(/\./g, '/');
  } catch (e) {
    return dateString;
  }
}

export function formatWIBDateTime(dateString?: string | null): string {
  if (!dateString) return '-';
  try {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return dateString;
    
    // Format to WIB (Asia/Jakarta)
    const datePart = date.toLocaleDateString('id-ID', {
      timeZone: 'Asia/Jakarta',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    }).replace(/[./]/g, '/');

    const timePart = date.toLocaleTimeString('id-ID', {
      timeZone: 'Asia/Jakarta',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    });

    return `${datePart} ${timePart.replace(/\./g, ':')} WIB`;
  } catch (e) {
    return dateString;
  }
}

/**
 * Gets the current date in YYYY-MM-DD format based on Asia/Jakarta timezone (WIB)
 * Note: A new business day starts at 12:00 AM (Midnight) WIB.
 */
export function getWIBDate(): string {
  const now = new Date();
  const jakartaTime = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Jakarta' }));
  const year = jakartaTime.getFullYear();
  const month = String(jakartaTime.getMonth() + 1).padStart(2, '0');
  const day = String(jakartaTime.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Gets current time in milliseconds adjusted to WIB
 * This is useful for countdowns where we want the end of day in WIB
 */
export function getWIBNow(): Date {
  const now = new Date();
  // Get time string in WIB
  const wibString = now.toLocaleString('en-US', { timeZone: 'Asia/Jakarta' });
  return new Date(wibString);
}

/**
 * Gets the date of the Monday for the given week in WIB
 * offset: 0 for current week, -7 for last week
 * Note: Respects the 12:00 AM (Midnight) transition rule.
 */
export function getWIBMonday(offsetDays: number = 0): string {
  const now = new Date();
  const jakartaStr = now.toLocaleString('en-US', { timeZone: 'Asia/Jakarta' });
  const d = new Date(jakartaStr);
  const day = d.getDay(); // 0 (Sun) to 6 (Sat)
  const diff = d.getDate() - day + (day === 0 ? -6 : 1) + offsetDays;
  d.setDate(diff);
  
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const date = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${date}`;
}

/**
 * Gets the date of the Monday for any given date in YYYY-MM-DD format
 */
export function getWIBMondayOfDate(dateStr: string): string {
  if (!dateStr) return '';
  const parts = dateStr.split('-');
  if (parts.length !== 3) return '';
  const year = Number(parts[0]);
  const month = Number(parts[1]);
  const day = Number(parts[2]);
  
  const d = new Date(year, month - 1, day);
  const dayOfWeek = d.getDay(); // 0 (Sun) to 6 (Sat)
  const diff = d.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1);
  d.setDate(diff);
  
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const dt = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${dt}`;
}

export interface WIBWeekDayInfo {
  dayName: 'Senin' | 'Selasa' | 'Rabu' | 'Kamis' | 'Jumat' | 'Sabtu' | 'Minggu';
  dateStr: string; // YYYY-MM-DD
  displayDate: string; // DD/MM
  isToday: boolean;
}

export function getWIBCurrentWeekDays(): WIBWeekDayInfo[] {
  const mondayStr = getWIBMonday(0);
  const [y, m, d] = mondayStr.split('-').map(Number);
  const baseDate = new Date(y, m - 1, d);
  const todayStr = getWIBDate();
  
  const dayNames: ('Senin' | 'Selasa' | 'Rabu' | 'Kamis' | 'Jumat' | 'Sabtu' | 'Minggu')[] = [
    'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu', 'Minggu'
  ];

  return dayNames.map((name, idx) => {
    const cur = new Date(baseDate);
    cur.setDate(baseDate.getDate() + idx);
    const year = cur.getFullYear();
    const month = String(cur.getMonth() + 1).padStart(2, '0');
    const day = String(cur.getDate()).padStart(2, '0');
    const dateStr = `${year}-${month}-${day}`;
    
    return {
      dayName: name,
      dateStr,
      displayDate: `${day}/${month}`,
      isToday: dateStr === todayStr
    };
  });
}

export function getIndonesianDayName(dateStr: string): string {
  if (!dateStr) return '';
  try {
    const clean = dateStr.split('T')[0].split(' ')[0].replace(/\//g, '-');
    const parts = clean.split('-');
    if (parts.length !== 3) return '';

    let year = Number(parts[0]);
    let month = Number(parts[1]);
    let day = Number(parts[2]);

    if (parts[0].length === 2 && parts[2].length === 4) {
      day = Number(parts[0]);
      month = Number(parts[1]);
      year = Number(parts[2]);
    }

    if (!year || !month || !day || isNaN(year) || isNaN(month) || isNaN(day)) return '';
    const dt = new Date(year, month - 1, day);
    const dayIdx = dt.getDay(); // 0=Minggu, 1=Senin, 2=Selasa, 3=Rabu, 4=Kamis, 5=Jumat, 6=Sabtu
    const days = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
    return days[dayIdx] || '';
  } catch {
    return '';
  }
}

export function formatDateWithDay(dateStr: string): string {
  if (!dateStr) return '';
  const dayName = getIndonesianDayName(dateStr);
  try {
    const clean = dateStr.split('T')[0].split(' ')[0].replace(/\//g, '-');
    const parts = clean.split('-');
    let formattedDate = dateStr;
    if (parts.length === 3) {
      if (parts[0].length === 4) {
        // YYYY-MM-DD -> DD/MM/YYYY
        formattedDate = `${parts[2]}/${parts[1]}/${parts[0]}`;
      } else if (parts[2].length === 4) {
        // DD-MM-YYYY -> DD/MM/YYYY
        formattedDate = `${parts[0]}/${parts[1]}/${parts[2]}`;
      }
    }
    return dayName ? `${dayName}, ${formattedDate}` : formattedDate;
  } catch {
    return dateStr;
  }
}

export function getWIBWeekRange(dateStr: string): { mondayStr: string; sundayStr: string; formattedRange: string; shortFormattedRange: string } {
  if (!dateStr) return { mondayStr: '', sundayStr: '', formattedRange: '-', shortFormattedRange: '-' };
  const mondayStr = getWIBMondayOfDate(dateStr);
  if (!mondayStr) return { mondayStr: '', sundayStr: '', formattedRange: '-', shortFormattedRange: '-' };
  
  const parts = mondayStr.split('-').map(Number);
  if (parts.length !== 3 || isNaN(parts[0])) return { mondayStr: '', sundayStr: '', formattedRange: '-', shortFormattedRange: '-' };
  
  const monDate = new Date(parts[0], parts[1] - 1, parts[2]);
  const sunDate = new Date(monDate);
  sunDate.setDate(monDate.getDate() + 6);
  
  const my = String(monDate.getFullYear()).slice(-2);
  const mm = String(monDate.getMonth() + 1).padStart(2, '0');
  const md = String(monDate.getDate()).padStart(2, '0');

  const sy = String(sunDate.getFullYear()).slice(-2);
  const sm = String(sunDate.getMonth() + 1).padStart(2, '0');
  const sd = String(sunDate.getDate()).padStart(2, '0');
  const sundayStr = `${sunDate.getFullYear()}-${sm}-${sd}`;

  const formattedMon = formatDateWithDay(mondayStr);
  const formattedSun = formatDateWithDay(sundayStr);

  const shortMon = `${md}/${mm}/${my}`;
  const shortSun = `${sd}/${sm}/${sy}`;

  return {
    mondayStr,
    sundayStr,
    formattedRange: `${formattedMon} - ${formattedSun}`,
    shortFormattedRange: `${shortMon} - ${shortSun}`
  };
}

export function getWIBWeekDaysOfMonday(mondayStr: string): WIBWeekDayInfo[] {
  if (!mondayStr) return [];
  const parts = mondayStr.split('-');
  if (parts.length !== 3) return [];
  const yearNum = Number(parts[0]);
  const monthNum = Number(parts[1]);
  const dayNum = Number(parts[2]);
  
  const baseDate = new Date(yearNum, monthNum - 1, dayNum);
  const todayStr = getWIBDate();
  
  const dayNames: ('Senin' | 'Selasa' | 'Rabu' | 'Kamis' | 'Jumat' | 'Sabtu' | 'Minggu')[] = [
    'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu', 'Minggu'
  ];

  return dayNames.map((name, idx) => {
    const cur = new Date(baseDate);
    cur.setDate(baseDate.getDate() + idx);
    const year = cur.getFullYear();
    const month = String(cur.getMonth() + 1).padStart(2, '0');
    const day = String(cur.getDate()).padStart(2, '0');
    const dateStr = `${year}-${month}-${day}`;
    
    return {
      dayName: name,
      dateStr,
      displayDate: `${day}/${month}`,
      isToday: dateStr === todayStr
    };
  });
}

export function formatLastSeen(lastSeenString?: string | null): string {
  if (!lastSeenString) return 'Tidak pernah aktif';
  try {
    const lastSeen = new Date(lastSeenString);
    if (isNaN(lastSeen.getTime())) return 'Tidak valid';
    const now = new Date();
    const diffMs = now.getTime() - lastSeen.getTime();
    const diffMins = Math.floor(diffMs / 60000);

    if (diffMins < 2) {
      return 'Online';
    } else if (diffMins < 60) {
      return `Aktif ${diffMins} menit yang lalu`;
    }

    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) {
      return `Aktif ${diffHours} jam yang lalu`;
    }

    const diffDays = Math.floor(diffHours / 24);
    if (diffDays < 7) {
      return `Aktif ${diffDays} hari yang lalu`;
    }

    return `Aktif pada ${formatWIBDateTime(lastSeenString)}`;
  } catch (e) {
    return 'Tidak diketahui';
  }
}

