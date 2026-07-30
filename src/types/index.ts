export type UserRole = 'Owner' | 'Admin' | 'Recruiter';
export type UserStatus = 'Pending' | 'Active' | 'Rejected' | 'Suspended';

export interface TelegramUser {
  id: number;
  first_name: string;
  last_name?: string;
  username?: string;
  language_code?: string;
  photo_url?: string;
  is_premium?: boolean;
}

export interface TelegramThemeParams {
  bg_color?: string;
  secondary_bg_color?: string;
  text_color?: string;
  hint_color?: string;
  link_color?: string;
  button_color?: string;
  button_text_color?: string;
  header_bg_color?: string;
  accent_text_color?: string;
  section_bg_color?: string;
  section_header_text_color?: string;
  subtitle_text_color?: string;
  destructive_text_color?: string;
}

export interface UserProfile {
  telegramId: string;
  username: string;
  firstName: string;
  lastName: string;
  photoUrl: string;
  email: string;
  whatsapp: string;
  akun9Kucing: string;
  role: UserRole;
  status: UserStatus;
  approved: boolean;
  createdAt: string;
  updatedAt: string;
  approvedBy?: string;
  approvedAt?: string;
  pin?: string;
  lastSeen?: string;
  firebaseUid?: string;
}

export interface RegistrationFormData {
  email: string;
  whatsapp: string;
  akun9Kucing: string;
  agreedTerms: boolean;
}

export interface DailyReport {
  id?: string;
  reportId: string;
  telegramId: string;
  username: string;
  name: string;
  date: string; // YYYY-MM-DD
  recruiterUsername?: string;
  channel?: string;
  applicantWhatsapp?: string;
  uid9Kucing?: string;
  applicantTelegramUsername?: string;
  applicantName?: string;
  result?: 'Pending' | 'ACC' | 'REJECT';
  grup?: 'T0' | 'V0' | 'RECRUITER' | 'T3';
  visit?: number;
  applicant?: number;
  quality?: number;
  posting?: number;
  permission?: number;
  effectiveStatus?: 'YES' | 'NO';
  note?: string;
  videoUrl?: string;
  applicantPhotoUrl?: string;
  createdAt: string;
  updatedAt?: string;
  isLate?: boolean;
  fine?: number;
}

export interface DailyReportFormData {
  date: string;
  recruiterUsername?: string;
  channel?: string;
  applicantWhatsapp?: string;
  uid9Kucing?: string;
  applicantTelegramUsername?: string;
  applicantName?: string;
  result?: 'Pending' | 'ACC' | 'REJECT';
  grup?: 'T0' | 'V0' | 'RECRUITER' | 'T3';
  visit?: number;
  applicant?: number;
  quality?: number;
  posting?: number;
  permission?: number;
  effectiveStatus?: 'YES' | 'NO';
  note?: string;
  videoUrl?: string;
  applicantPhotoUrl?: string;
  isLate?: boolean;
  fine?: number;
}

export interface AppNotification {
  id: string;
  targetUserId?: string; // telegramId of specific recipient (e.g. recruiter)
  targetRole?: 'Owner' | 'Admin' | 'Recruiter' | 'ADMIN_OWNER' | 'ALL';
  title: string;
  message: string;
  type: 'NEW_REPORT' | 'STATUS_CHANGE' | 'PROMOTION' | 'AUDIT_COMPLETE' | 'SYSTEM' | 'RECRUITER_REGISTERED' | 'NEW_ANNOUNCEMENT' | 'ANNOUNCEMENT_CHAT' | 'ANNOUNCEMENT_REACTION';
  readBy?: string[]; // list of telegramIds who have read this notification
  senderName?: string;
  createdAt: string;
  reportId?: string;
}

export interface AnnouncementReaction {
  userId: string; // telegramId
  userName: string; // display name
  userPhotoUrl?: string;
  role: string;
  emoji: string;
}

export interface AnnouncementComment {
  id: string;
  announcementId: string;
  userId: string; // telegramId
  userName: string; // display name
  userPhotoUrl?: string;
  role: string;
  content: string;
  createdAt: string;
}

export interface Announcement {
  id: string;
  title: string;
  content: string;
  author: string;
  pinned: boolean;
  createdAt: string;
  reactionsList?: AnnouncementReaction[];
  comments?: AnnouncementComment[];
}

export interface SystemSettings {
  id: string;
  systemStatus: 'Operational' | 'Maintenance';
  allowRegistrations: boolean;
  announcementHeader: string;
  telegramBotToken?: string;
  telegramGroupId?: string;
  telegramTopicId?: string;
  telegramTopicT0?: string;
  telegramTopicV0?: string;
  telegramTopicRecruiter?: string;
  telegramTopicT3?: string;
  telegramTopicPosting?: string;
  telegramTopicReport?: string;
  webhookUrl?: string;
  updatedAt: string;
}

export interface BatchPost {
  id: string;
  telegramId: string;
  username: string;
  name: string;
  date: string; // YYYY-MM-DD
  startNumber: number;
  links: string[];
  platforms: string[];
  archived: boolean;
  createdAt: string;
}

export interface AuthState {
  isAuthenticated: boolean;
  isLoading: boolean;
  telegramUser: TelegramUser | null;
  userProfile: UserProfile | null;
  token: string | null;
  initData: string;
  error: string | null;
  isTelegramContext: boolean;
}

export interface ApiResponse<T = unknown> {
  success: boolean;
  message?: string;
  data?: T;
  error?: string;
}

export interface RecruiterSalary {
  id: string;              // Firestore document ID (e.g., `${telegramId}_${periode}`)
  periode: string;         // Week/Period identifier (e.g., "Periode 20-26 Juli 2026")
  username: string;        // Telegram username
  recruiterName: string;   // Full/First Name of recruiter
  telegramId: string;      // Recruiter Telegram ID
  akun9Kucing?: string;    // Recruiter OKucing UID
  hariEfektif: number;     // Hari Efektif
  totalPostingan: number;  // TOTAL POSTINGAN
  deklarasiT0: number;     // Deklarasi T0
  sebenarnyaT0: number;    // Sebenarnya T0
  t3: number;              // T3
  deklarasiV0: number;     // Deklarasi V0
  sebenarnyaV0: number;    // Sebenarnya V0
  levelGaji: string;       // Level Gaji
  tingkatPenerimaan: number; // Tingkat Penerimaan (%)
  rasioPeningkatan: number;  // Rasio Peningkatan (%)
  gajiPokok: number;       // Gaji Pokok (Rp)
  komisi: number;          // Komisi (Rp)
  bonusT0: number;         // Bonus (T0) (Rp)
  bonusT3: number;         // Bonus (T3) (Rp)
  otherBonus: number;      // Other Bonus (Rp)
  deduksi: number;         // Deduksi (Rp)
  totalGaji: number;       // Total Gaji (Rp)
  status: 'Draft' | 'Paid'; // Status slip gaji
  createdAt: string;
  updatedAt: string;
  createdBy: string;       // Admin/Owner who submitted
  note?: string;           // Optional note
}

