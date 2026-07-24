import { 
  collection, 
  addDoc, 
  getDocs, 
  query, 
  where, 
  orderBy, 
  limit, 
  startAfter, 
  Timestamp, 
  updateDoc, 
  doc,
  getDoc,
  setDoc,
  onSnapshot
} from 'firebase/firestore';
import { db } from '../config';
import { BatchPost } from '../../types';
import { getWIBDate, getWIBMonday } from '../../utils/format';
import { handleFirestoreError, OperationType } from '../error';

const POSTS_COLLECTION = 'posts';

export const createPost = async (postData: Omit<BatchPost, 'id' | 'createdAt' | 'archived'>): Promise<string> => {
  try {
    const now = new Date();
    const createdAt = now.toISOString();
    
    const post: Omit<BatchPost, 'id'> = {
      ...postData,
      startNumber: postData.startNumber > 0 ? postData.startNumber : 1,
      archived: false,
      createdAt
    };
    
    const docRef = await addDoc(collection(db, POSTS_COLLECTION), post);
    return docRef.id;
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, POSTS_COLLECTION);
    throw error;
  }
};

export const getRecruiterPosts = async (
  telegramId: string, 
  pageSize: number = 10, 
  lastDoc?: any
) => {
  try {
    const q = query(
      collection(db, POSTS_COLLECTION),
      where('telegramId', '==', String(telegramId))
    );

    const snapshot = await getDocs(q);
    const posts = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    })) as BatchPost[];

    // Sort client-side to avoid Firestore composite index requirement
    posts.sort((a, b) => {
      const timeA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const timeB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return timeB - timeA;
    });

    return {
      posts: posts.slice(0, pageSize),
      lastDoc: snapshot.docs[snapshot.docs.length - 1]
    };
  } catch (error) {
    console.error('Error fetching recruiter posts:', error);
    return { posts: [], lastDoc: null };
  }
};

export const subscribeToRecruiterPosts = (
  telegramId: string,
  callback: (posts: BatchPost[]) => void,
  limitCount: number = 50
) => {
  const q = query(
    collection(db, POSTS_COLLECTION),
    where('telegramId', '==', String(telegramId))
  );

  return onSnapshot(q, (snapshot) => {
    const postsMap = new Map<string, BatchPost>();
    snapshot.docs.forEach(doc => {
      postsMap.set(doc.id, {
        id: doc.id,
        ...doc.data()
      } as BatchPost);
    });
    const posts = Array.from(postsMap.values());

    // Sort client-side to avoid Firestore composite index requirement
    posts.sort((a, b) => {
      const timeA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const timeB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return timeB - timeA;
    });

    callback(posts.slice(0, limitCount));
  }, (error) => {
    console.error('Error listening to recruiter posts:', error);
    callback([]);
  });
};

export const archiveOldPosts = async () => {
  const currentMonday = getWIBMonday(0); // YYYY-MM-DD of current week's Monday
  
  const normalizeDate = (d: string) => {
    if (!d) return '';
    const parts = d.split('-');
    if (parts.length !== 3) return d;
    if (parts[0].length === 2) return parts.reverse().join('-');
    return d;
  };

  try {
    // Get all potentially unarchived posts
    const q = query(
      collection(db, POSTS_COLLECTION),
      where('archived', '==', false),
      limit(100) // Sanity limit
    );

    const snapshot = await getDocs(q);
    const promises = snapshot.docs
      .filter(d => {
        const pDate = normalizeDate(d.data().date || '');
        return pDate < currentMonday;
      })
      .map(d => updateDoc(doc(db, POSTS_COLLECTION, d.id), { archived: true }));
      
    await Promise.all(promises);
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, POSTS_COLLECTION);
  }
};

export const subscribeToTodayPostsAllRecruiters = (
  callback: (posts: BatchPost[]) => void
) => {
  const todayStr = getWIBDate();
  const q = query(
    collection(db, POSTS_COLLECTION),
    where('date', '==', todayStr),
    where('archived', '==', false)
  );
  
  return onSnapshot(q, (snapshot) => {
    const posts = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    })) as BatchPost[];
    callback(posts);
  }, (error) => {
    console.error('Error listening to all today posts:', error);
    callback([]);
  });
};
