sed -i -e '289,304c\
  useEffect(() => {\
    if (isManagement) {\
      if (activeView === '"'"'buat'"'"') {\
        setActiveView('"'"'minggu_ini'"'"');\
      }\
      \
      const unsubscribeUsers = subscribeToAllUsers((users) => {\
        const recs = users.filter(u => u.role === '"'"'Recruiter'"'"');\
        setRecruiters(recs);\
        setSelectedRecruiterId(prev => prev || (recs.length > 0 ? recs[0].telegramId : '"'"''"'"'));\
      });\
\
      const unsubscribePosts = subscribeToTodayPostsAllRecruiters((posts) => {\
        setAllTodayPosts(posts);\
      });\
\
      return () => {\
        unsubscribeUsers();\
        unsubscribePosts();\
      };\
    }\
  }, [isManagement]); // Remove activeView to avoid infinite re-renders or resubscriptions' src/pages/PostinganPage.tsx
