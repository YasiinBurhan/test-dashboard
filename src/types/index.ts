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
}

export interface DailyReportFormData {
  date: string;
  recruiterUsername?: string;
  channel?: string;
  applicantWhatsapp?: string;
  uid9Kucing?: string;
  applicantTelegramUsername?: string;
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
}

export interface Announcement {
  id: string;
  title: string;
  content: string;
  author: string;
  pinned: boolean;
  createdAt: string;
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
