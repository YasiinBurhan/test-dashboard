import {
  collection,
  doc,
  setDoc,
  deleteDoc,
  getDocs,
  query,
  orderBy,
  onSnapshot
} from 'firebase/firestore';
import { db } from '../config';
import { handleFirestoreError, OperationType } from '../error';
import { Announcement } from '../../types';

const COLLECTION_NAME = 'announcements';

export function subscribeToAnnouncements(onUpdate: (anns: Announcement[]) => void): () => void {
  const annRef = collection(db, COLLECTION_NAME);
  const q = query(annRef, orderBy('createdAt', 'desc'));

  return onSnapshot(q, (snapshot) => {
    const anns = snapshot.docs.map((docSnap) => docSnap.data() as Announcement);
    onUpdate(anns);
  }, (error) => {
    console.error('Error listening to announcements:', error);
  });
}

export async function getAnnouncements(): Promise<Announcement[]> {
  try {
    const annRef = collection(db, COLLECTION_NAME);
    const q = query(annRef, orderBy('createdAt', 'desc'));
    const snapshot = await getDocs(q);
    return snapshot.docs.map((docSnap) => docSnap.data() as Announcement);
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, COLLECTION_NAME);
  }
}

export async function createAnnouncement(
  title: string,
  content: string,
  author: string,
  pinned: boolean = false
): Promise<Announcement> {
  const id = `ANN_${Date.now()}`;
  const now = new Date().toISOString();

  const announcement: Announcement = {
    id,
    title,
    content,
    author,
    pinned,
    createdAt: now
  };

  try {
    const annRef = doc(db, COLLECTION_NAME, id);
    await setDoc(annRef, announcement);
    return announcement;
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `${COLLECTION_NAME}/${id}`);
  }
}

export async function deleteAnnouncement(id: string): Promise<void> {
  try {
    const annRef = doc(db, COLLECTION_NAME, id);
    await deleteDoc(annRef);
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `${COLLECTION_NAME}/${id}`);
  }
}
