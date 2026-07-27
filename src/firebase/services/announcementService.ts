import {
  collection,
  doc,
  setDoc,
  deleteDoc,
  getDocs,
  query,
  orderBy,
  onSnapshot,
  updateDoc,
  getDoc
} from 'firebase/firestore';
import { db } from '../config';
import { handleFirestoreError, OperationType } from '../error';
import { Announcement, AnnouncementComment, AnnouncementReaction } from '../../types';
import { createNotification } from './notificationService';

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
    createdAt: now,
    reactionsList: [],
    comments: []
  };

  try {
    const annRef = doc(db, COLLECTION_NAME, id);
    await setDoc(annRef, announcement);

    // Trigger notification to all users
    await createNotification({
      targetRole: 'ALL',
      title: `📢 Pengumuman Baru: ${title}`,
      message: `${content.substring(0, 100)}${content.length > 100 ? '...' : ''}`,
      type: 'NEW_ANNOUNCEMENT',
      senderName: author
    });

    return announcement;
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `${COLLECTION_NAME}/${id}`);
  }
}

export async function toggleAnnouncementReaction(
  announcementId: string,
  userTelegramId: string,
  userName: string,
  userPhotoUrl: string | undefined,
  role: string,
  emoji: string
): Promise<void> {
  const annRef = doc(db, COLLECTION_NAME, announcementId);
  try {
    const docSnap = await getDoc(annRef);
    if (!docSnap.exists()) return;
    const annData = docSnap.data() as Announcement;
    
    let list = annData.reactionsList || [];
    const existingIndex = list.findIndex(r => r.userId === userTelegramId && r.emoji === emoji);
    let isRemoved = false;

    if (existingIndex > -1) {
      // Remove it
      list = list.filter((_, idx) => idx !== existingIndex);
      isRemoved = true;
    } else {
      // Remove other reactions by the same user to allow only 1 active reaction per user
      list = list.filter(r => r.userId !== userTelegramId);
      list.push({
        userId: userTelegramId,
        userName,
        userPhotoUrl: userPhotoUrl || '',
        role,
        emoji
      });
    }
    
    await updateDoc(annRef, { reactionsList: list });

    if (!isRemoved) {
      // Create notification
      await createNotification({
        targetRole: 'ALL',
        title: `✨ Reaksi Baru di Pengumuman`,
        message: `${userName} (${role}) memberikan reaksi ${emoji} pada "${annData.title}"`,
        type: 'ANNOUNCEMENT_REACTION',
        senderName: userName
      });
    }
  } catch (error) {
    console.error('Error toggling announcement reaction:', error);
  }
}

export async function addAnnouncementComment(
  announcementId: string,
  commentData: {
    userId: string;
    userName: string;
    userPhotoUrl?: string;
    role: string;
    content: string;
  }
): Promise<void> {
  const annRef = doc(db, COLLECTION_NAME, announcementId);
  const commentId = `COM_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const now = new Date().toISOString();
  
  const newComment: AnnouncementComment = {
    id: commentId,
    announcementId,
    ...commentData,
    createdAt: now
  };
  
  try {
    const docSnap = await getDoc(annRef);
    if (!docSnap.exists()) return;
    const annData = docSnap.data() as Announcement;
    
    const comments = annData.comments || [];
    comments.push(newComment);
    
    await updateDoc(annRef, { comments });

    // Create notification
    await createNotification({
      targetRole: 'ALL',
      title: `💬 Komentar Baru di Pengumuman`,
      message: `${commentData.userName} (${commentData.role}): "${commentData.content.substring(0, 50)}${commentData.content.length > 50 ? '...' : ''}"`,
      type: 'ANNOUNCEMENT_CHAT',
      senderName: commentData.userName
    });
  } catch (error) {
    console.error('Error adding announcement comment:', error);
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
