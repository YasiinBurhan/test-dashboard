import { db } from '../config';
import { 
  doc, 
  getDoc, 
  setDoc, 
  updateDoc, 
  collection, 
  getDocs, 
  query, 
  orderBy,
  onSnapshot
} from 'firebase/firestore';
import { UserProfile, UserRole, UserStatus } from '../../types';
import { handleFirestoreError, OperationType } from '../error';

export async function testFirestoreConnection(): Promise<boolean> {
  try {
    const testRef = doc(db, 'settings', 'ping');
    await getDoc(testRef);
    return true;
  } catch {
    return false;
  }
}

export function subscribeToUserProfile(telegramId: string, onUpdate: (profile: UserProfile | null) => void): () => void {
  const userRef = doc(db, 'users', String(telegramId));
  const unsubscribe = onSnapshot(userRef, (docSnap) => {
    if (docSnap.exists()) {
      onUpdate(docSnap.data() as UserProfile);
    } else {
      onUpdate(null);
    }
  }, (error) => {
    console.error('Error listening to user profile:', error);
    onUpdate(null);
  });
  return unsubscribe;
}

export async function getUserProfile(telegramId: string): Promise<UserProfile | null> {
  try {
    const userRef = doc(db, 'users', String(telegramId));
    const docSnap = await getDoc(userRef);
    if (docSnap.exists()) {
      return docSnap.data() as UserProfile;
    }
    return null;
  } catch (error) {
    return handleFirestoreError(error, OperationType.GET, `users/${telegramId}`);
  }
}

export async function findUserProfileByIdOrUsername(idOrUsername: string): Promise<UserProfile | null> {
  const clean = String(idOrUsername || '').trim().replace(/^@/, '');
  if (!clean) return null;

  // 1. Direct document get by telegramId
  try {
    const userRef = doc(db, 'users', clean);
    const docSnap = await getDoc(userRef);
    if (docSnap.exists()) {
      return docSnap.data() as UserProfile;
    }
  } catch (err) {
    console.warn('Direct doc lookup by ID failed:', err);
  }

  // 2. Search all users for matching telegramId or username
  try {
    const allUsers = await getAllUsers();
    const found = allUsers.find(
      (u) =>
        String(u.telegramId).trim() === clean ||
        (u.username && u.username.toLowerCase() === clean.toLowerCase())
    );
    if (found) return found;
  } catch (err) {
    console.warn('Search all users failed:', err);
  }

  return null;
}

export async function createUserProfile(profile: Omit<UserProfile, 'createdAt' | 'updatedAt'>): Promise<UserProfile> {
  const now = new Date().toISOString();
  let role = profile.role || 'Recruiter';
  let status = profile.status || 'Pending';
  let approved = profile.approved ?? false;

  try {
    const allUsers = await getAllUsers();
    if (allUsers.length === 0) {
      // First user registered in the system automatically becomes Active Owner!
      role = 'Owner';
      status = 'Active';
      approved = true;
    }
  } catch (err) {
    console.warn('Error checking existing users count during profile creation:', err);
  }

  const fullProfile: UserProfile = {
    ...profile,
    createdAt: now,
    updatedAt: now,
    role,
    status,
    approved
  };

  try {
    const userRef = doc(db, 'users', String(profile.telegramId));
    await setDoc(userRef, fullProfile);
    return fullProfile;
  } catch (error) {
    return handleFirestoreError(error, OperationType.CREATE, `users/${profile.telegramId}`);
  }
}

export async function updateUserStatus(
  telegramId: string,
  status: UserStatus,
  approved: boolean,
  approvedBy: string
): Promise<void> {
  try {
    const userRef = doc(db, 'users', String(telegramId));
    const now = new Date().toISOString();
    await updateDoc(userRef, {
      status,
      approved,
      approvedBy,
      approvedAt: now,
      updatedAt: now
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `users/${telegramId}`);
  }
}

export async function updateUserRole(
  telegramId: string,
  role: UserRole,
  updatedBy: string
): Promise<void> {
  try {
    const userRef = doc(db, 'users', String(telegramId));
    const now = new Date().toISOString();
    await updateDoc(userRef, {
      role,
      updatedBy,
      updatedAt: now
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `users/${telegramId}`);
  }
}

export function subscribeToAllUsers(onUpdate: (users: UserProfile[]) => void): () => void {
  const usersRef = collection(db, 'users');
  const q = query(usersRef, orderBy('createdAt', 'desc'));
  
  return onSnapshot(q, (snapshot) => {
    const users = snapshot.docs.map(docSnap => docSnap.data() as UserProfile);
    onUpdate(users);
  }, (error) => {
    console.error('Error listening to all users:', error);
  });
}

export async function getAllUsers(): Promise<UserProfile[]> {
  try {
    const usersRef = collection(db, 'users');
    const q = query(usersRef, orderBy('createdAt', 'desc'));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(docSnap => docSnap.data() as UserProfile);
  } catch (error) {
    return handleFirestoreError(error, OperationType.LIST, 'users');
  }
}

export async function getUsersByRole(role: UserRole): Promise<UserProfile[]> {
  try {
    const users = await getAllUsers();
    return users.filter(u => u.role === role);
  } catch (error) {
    return handleFirestoreError(error, OperationType.LIST, 'users');
  }
}
