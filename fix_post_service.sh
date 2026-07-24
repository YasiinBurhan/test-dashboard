cat << 'INNER_EOF' >> src/firebase/services/postService.ts

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
INNER_EOF
