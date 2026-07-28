import { db, auth } from '../config';
import { 
  doc, 
  getDoc, 
  setDoc, 
  updateDoc, 
  collection, 
  getDocs, 
  query,
  orderBy,
  onSnapshot,
  where,
  limit,
  deleteDoc
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
    console.warn('Notice listening to user profile:', error);
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
    const rawMessage = error instanceof Error ? error.message : String(error);
    if (rawMessage.includes('permission') || rawMessage.includes('PERMISSION_DENIED') || rawMessage.includes('Missing or insufficient permissions')) {
      console.warn(`Firestore permission denied reading user profile ${telegramId}`);
      return null;
    }
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

  // 2. Search all users for matching username
  try {
    const usersRef = collection(db, 'users');
    const q1 = query(usersRef, where('username', '==', clean), limit(1));
    const snapshot = await getDocs(q1);
    if (!snapshot.empty) {
      return snapshot.docs[0].data() as UserProfile;
    }

    const q2 = query(usersRef, where('username', '==', clean.toLowerCase()), limit(1));
    const snapshot2 = await getDocs(q2);
    if (!snapshot2.empty) {
      return snapshot2.docs[0].data() as UserProfile;
    }
  } catch (err) {
    console.warn('Search user by username failed:', err);
  }

  return null;
}

export async function createUserProfile(profile: Omit<UserProfile, 'createdAt' | 'updatedAt'>): Promise<UserProfile> {
  const now = new Date().toISOString();
  let role = profile.role || 'Recruiter';
  let status = profile.status || 'Pending';
  let approved = profile.approved ?? false;

  const fullProfile: UserProfile = {
    ...profile,
    createdAt: now,
    updatedAt: now,
    role,
    status,
    approved,
    firebaseUid: auth.currentUser?.uid || ''
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

export async function updateUserPin(
  telegramId: string,
  pin: string
): Promise<void> {
  try {
    const userRef = doc(db, 'users', String(telegramId));
    const now = new Date().toISOString();
    await updateDoc(userRef, {
      pin,
      updatedAt: now
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `users/${telegramId}`);
  }
}

export async function deleteUserProfile(telegramId: string): Promise<void> {
  try {
    const userRef = doc(db, 'users', String(telegramId));
    await deleteDoc(userRef);
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `users/${telegramId}`);
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

export async function updateUserLastSeen(
  telegramId: string
): Promise<void> {
  try {
    const userRef = doc(db, 'users', String(telegramId));
    const now = new Date().toISOString();
    await updateDoc(userRef, {
      lastSeen: now,
      updatedAt: now
    });
  } catch (error) {
    // Fail silently or log softly as lastSeen shouldn't crash operations
    console.warn('Silent notice: failed to update lastSeen for user', telegramId, error);
  }
}

export function subscribeToAllUsers(onUpdate: (users: UserProfile[]) => void, onError?: (error: any) => void): () => void {
  const usersRef = collection(db, 'users');
  const q = query(usersRef, orderBy('createdAt', 'desc'));
  
  return onSnapshot(q, (snapshot) => {
    const users = snapshot.docs.map(docSnap => docSnap.data() as UserProfile);
    onUpdate(users);
  }, (error) => {
    console.warn('Error listening to all users:', error);
    if (onError) {
      onError(error);
    } else {
      onUpdate([]);
    }
  });
}

export async function getAllUsers(): Promise<UserProfile[]> {
  try {
    const usersRef = collection(db, 'users');
    const q = query(usersRef, orderBy('createdAt', 'desc'));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(docSnap => docSnap.data() as UserProfile);
  } catch (error) {
    const rawMessage = error instanceof Error ? error.message : String(error);
    if (rawMessage.includes('permission') || rawMessage.includes('PERMISSION_DENIED') || rawMessage.includes('Missing or insufficient permissions')) {
      console.warn('Firestore permissions missing for users collection');
      return [];
    }
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
