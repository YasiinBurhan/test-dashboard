import {
  collection,
  doc,
  setDoc,
  updateDoc,
  deleteDoc,
  arrayUnion,
  onSnapshot,
  query,
  orderBy,
  limit
} from 'firebase/firestore';
import { db } from '../config';
import { handleFirestoreError, OperationType } from '../error';
import { AppNotification, UserRole } from '../../types';

const COLLECTION_NAME = 'notifications';

export async function createNotification(
  data: Omit<AppNotification, 'id' | 'createdAt'>
): Promise<void> {
  const notifId = `NOTIF_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const now = new Date().toISOString();

  const newNotif: AppNotification = {
    ...data,
    id: notifId,
    readBy: data.readBy || [],
    createdAt: now
  };

  try {
    const notifRef = doc(db, COLLECTION_NAME, notifId);
    await setDoc(notifRef, newNotif);
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `${COLLECTION_NAME}/${notifId}`);
  }
}

export function requestNotificationPermission(): void {
  if (typeof window !== 'undefined' && 'Notification' in window) {
    if (Notification.permission === 'default') {
      Notification.requestPermission().catch(() => {});
    }
  }
}

export function triggerSystemNotification(title: string, body: string): void {
  if (typeof window !== 'undefined' && 'Notification' in window) {
    if (Notification.permission === 'granted') {
      try {
        new Notification(title, {
          body,
          icon: '/assets/icon.png',
          badge: '/assets/icon.png',
          tag: 'azurlize-notif'
        });
      } catch (err) {
        console.warn('System Notification failed:', err);
      }
    }
  }
}

const notifiedNotifIds = new Set<string>();

export function subscribeToNotifications(
  userTelegramId: string,
  userRole: UserRole,
  onUpdate: (notifs: AppNotification[]) => void,
  onError?: (error: Error) => void
): () => void {
  const isAdminOrOwner = userRole === 'Admin' || userRole === 'Owner';
  if (isAdminOrOwner) {
    requestNotificationPermission();
  }

  const notifsRef = collection(db, COLLECTION_NAME);
  // Get recent 100 notifications ordered by createdAt desc
  const q = query(notifsRef, orderBy('createdAt', 'desc'), limit(100));

  let isFirstLoad = true;

  return onSnapshot(q, (snapshot) => {
    const allNotifs = snapshot.docs.map((docSnap) => docSnap.data() as AppNotification);

    // Filter notifications relevant to current user
    const filtered = allNotifs.filter((notif) => {
      // 1. Direct notification for specific telegramId
      if (notif.targetUserId && notif.targetUserId === userTelegramId) {
        return true;
      }

      // 2. Broadcast for ALL
      if (notif.targetRole === 'ALL') {
        return true;
      }

      // 3. For ADMIN_OWNER role
      if (notif.targetRole === 'ADMIN_OWNER' && (userRole === 'Owner' || userRole === 'Admin')) {
        return true;
      }

      // 4. Exact role match
      if (notif.targetRole === userRole) {
        return true;
      }

      return false;
    });

    if (isFirstLoad) {
      filtered.forEach((n) => notifiedNotifIds.add(n.id));
      isFirstLoad = false;
    } else {
      // Trigger browser system push notification ONLY for Admin & Owner
      if (isAdminOrOwner) {
        filtered.forEach((notif) => {
          if (!notifiedNotifIds.has(notif.id)) {
            notifiedNotifIds.add(notif.id);
            const isUnread = !notif.readBy || !notif.readBy.includes(userTelegramId);
            if (isUnread) {
              triggerSystemNotification(notif.title, notif.message);
            }
          }
        });
      }
    }

    onUpdate(filtered);
  }, (error) => {
    console.error('Error listening to notifications:', error);
    if (onError) onError(error);
    else onUpdate([]);
  });
}

export async function markNotificationAsRead(
  notificationId: string,
  userTelegramId: string
): Promise<void> {
  if (!userTelegramId) return;
  try {
    const notifRef = doc(db, COLLECTION_NAME, notificationId);
    await updateDoc(notifRef, {
      readBy: arrayUnion(userTelegramId)
    });
  } catch (error) {
    console.error('Error marking notification read:', error);
  }
}

export async function markAllNotificationsAsRead(
  notifications: AppNotification[],
  userTelegramId: string
): Promise<void> {
  if (!userTelegramId || notifications.length === 0) return;
  
  const unreadNotifs = notifications.filter(
    (n) => !n.readBy || !n.readBy.includes(userTelegramId)
  );

  const promises = unreadNotifs.map((n) => markNotificationAsRead(n.id, userTelegramId));
  await Promise.allSettled(promises);
}

export async function deleteNotification(notificationId: string): Promise<void> {
  try {
    const notifRef = doc(db, COLLECTION_NAME, notificationId);
    await deleteDoc(notifRef);
  } catch (error) {
    console.error('Error deleting notification:', error);
  }
}

export async function sendAuditCompleteBroadcast(senderName: string, dateString?: string): Promise<void> {
  const messageText = dateString
    ? `Pemeriksaan data rekrutan tanggal ${dateString} telah selesai dilakukan oleh Admin/Owner. Silakan cek hasil status rekrutan Anda.`
    : 'Pemeriksaan data rekrutan telah selesai dilakukan oleh Admin/Owner. Silakan cek hasil status rekrutan Anda.';

  await createNotification({
    targetRole: 'ALL',
    title: 'Pemeriksaan Rekrutan Selesai! ✅',
    message: messageText,
    type: 'AUDIT_COMPLETE',
    senderName: senderName || 'Admin'
  });
}
