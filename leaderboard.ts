  const { topRecruiters, topChannelOverall } = useMemo(() => {
    const stats: Record<string, { 
      telegramId: string;
      name: string; 
      username: string; 
      points: number; 
      count: number;
      applicantCount: number;
      qualityCount: number;
      visitCount: number;
      accT0Count: number;
      accV0Count: number;
      effectiveDaysCount: number;
      effectiveDates: Set<string>;
      fineTotal: number;
      photo: string;
      channels: Record<string, number>;
    }> = {};

    const overallChannels: Record<string, number> = {};

    // Seed stats with recruiter users (excluding Admin and Owner)
    allUsers.forEach((u) => {
      if (u.status !== 'Active') return;
      if (u.role === 'Admin' || u.role === 'Owner') return;
      const key = u.telegramId ? String(u.telegramId) : (u.username ? u.username.replace('@', '').toLowerCase() : '');
      if (!key) return;
      const fullName = u.lastName ? `${u.firstName} ${u.lastName}`.trim() : (u.firstName || u.username || 'User');
      stats[key] = {
        telegramId: String(u.telegramId || ''),
        name: fullName,
        username: u.username ? formatUsername(u.username) : '',
        points: 0,
        count: 0,
        applicantCount: 0,
        qualityCount: 0,
        visitCount: 0,
        accT0Count: 0,
        accV0Count: 0,
        effectiveDaysCount: 0,
        effectiveDates: new Set<string>(),
        fineTotal: 0,
        photo: u.photoUrl || '',
        channels: {}
      };
    });

    if (allReports.length) {
      const detailedGroups = new Set<string>();
      allReports.forEach(r => {
        const isDetailed = !!(r.applicantWhatsapp || r.uid9Kucing || r.applicantTelegramUsername);
        if (isDetailed) {
          const reportDate = r.date || (r.createdAt ? r.createdAt.split('T')[0] : '');
          const reportTgId = r.telegramId ? String(r.telegramId) : '';
          const reportCleanUname = (r.recruiterUsername || r.username || '').replace(/@/g, '').trim().toLowerCase();
          
          let key = reportTgId;
          const matchedUser = allUsers.find(u => 
            (reportTgId && String(u.telegramId) === reportTgId) ||
            (reportCleanUname && u.username && u.username.replace(/@/g, '').trim().toLowerCase() === reportCleanUname)
          );
          if (matchedUser) {
            key = String(matchedUser.telegramId) || matchedUser.username.replace(/@/g, '').trim().toLowerCase();
          } else {
            key = reportTgId || reportCleanUname || 'Unknown';
          }
          detailedGroups.add(`${key}_${reportDate}`);
        }
      });

      allReports.forEach(r => {
        // Only count approved reports (ACC)
        if (r.result !== 'ACC') return;

        const reportDate = r.date || (r.createdAt ? r.createdAt.split('T')[0] : '');
        if (!reportDate) return;

        // Check if report falls into target Monday week
        const reportMonday = getWIBMondayOfDate(reportDate);
        if (reportMonday !== targetMondayStr) return;

        const reportTgId = r.telegramId ? String(r.telegramId) : '';
        const reportCleanUname = (r.recruiterUsername || r.username || '').replace(/@/g, '').trim().toLowerCase();

        // Check if report belongs to Admin or Owner
        const matchedUser = allUsers.find(u => 
          (reportTgId && String(u.telegramId) === reportTgId) ||
          (reportCleanUname && u.username && u.username.replace(/@/g, '').trim().toLowerCase() === reportCleanUname)
        );

        if (matchedUser && (matchedUser.role === 'Admin' || matchedUser.role === 'Owner')) {
          return;
        }

        // Match key in stats or matching user in allUsers
        let key = reportTgId;
        if (!key || !stats[key]) {
          if (matchedUser) {
            key = String(matchedUser.telegramId) || matchedUser.username.replace(/@/g, '').trim().toLowerCase();
          } else {
            key = reportTgId || reportCleanUname || 'Unknown';
          }
        }

        if (!stats[key]) {
          stats[key] = {
            telegramId: reportTgId || (matchedUser ? String(matchedUser.telegramId) : ''),
            name: r.name || (matchedUser ? `${matchedUser.firstName} ${matchedUser.lastName || ''}`.trim() : 'Recruiter'),
            username: r.recruiterUsername || r.username || matchedUser?.username || '',
            points: 0,
            count: 0,
            applicantCount: 0,
            qualityCount: 0,
            visitCount: 0,
            accT0Count: 0,
            accV0Count: 0,
            effectiveDaysCount: 0,
            effectiveDates: new Set<string>(),
            fineTotal: 0,
            photo: matchedUser?.photoUrl || '',
            channels: {}
          };
        }

        stats[key].count += 1;
        
        const isDetailed = !!(r.applicantWhatsapp || r.uid9Kucing || r.applicantTelegramUsername);
        const groupKey = `${key}_${reportDate}`;
        const hasDetailed = detailedGroups.has(groupKey);

        let applicant = 0;
        let quality = 0;
        const visit = Number(r.visit) || 0;

        stats[key].applicantCount += applicant;
        stats[key].qualityCount += quality;
        stats[key].visitCount += visit;

        if (r.result === 'ACC') {
          if (r.grup === 'T0' || r.grup === 'T3') {
            stats[key].accT0Count += applicant > 0 ? applicant : 1;
          } else if (r.grup === 'V0') {
            stats[key].accV0Count += applicant > 0 ? applicant : 1;
          }
        }

        if (isReportEffective(r, allPosts)) {
          stats[key].effectiveDates.add(reportDate);
        }

        const fineVal = r.fine !== undefined ? r.fine : (r.isLate ? 5000 : 0);
        stats[key].fineTotal += fineVal;

        // Track channel
        if (r.channel && r.channel.trim()) {
          const ch = r.channel.trim();
          const chCount = applicant > 0 ? applicant : 1;
          stats[key].channels[ch] = (stats[key].channels[ch] || 0) + chCount;
          overallChannels[ch] = (overallChannels[ch] || 0) + chCount;
        }

        // Points: 1 per applicant, 3 per quality, 0.1 per visit
        stats[key].points += (applicant * 1) + (quality * 3) + (visit * 0.1);
      });
    }

    // Also check posts collection for recruiters who posted links meeting target
    if (allPosts.length) {
      allPosts.forEach(p => {
        const postDate = p.date || (p.createdAt ? p.createdAt.split('T')[0] : '');
        if (!postDate) return;
        const postMonday = getWIBMondayOfDate(postDate);
        if (postMonday !== targetMondayStr) return;

        const postTgId = p.telegramId ? String(p.telegramId) : '';
        const postCleanUname = (p.username || '').replace(/@/g, '').trim().toLowerCase();

        const key = Object.keys(stats).find(k => {
          const s = stats[k];
          return (postTgId && s.telegramId === postTgId) || (postCleanUname && s.username && s.username.replace(/@/g, '').trim().toLowerCase() === postCleanUname);
        });

        if (key && stats[key]) {
          const userPostsOnDate = allPosts.filter(ap => {
            const apDate = ap.date || (ap.createdAt ? ap.createdAt.split('T')[0] : '');
            if (apDate !== postDate) return false;
            const apTgId = ap.telegramId ? String(ap.telegramId) : '';
            const apCleanUname = (ap.username || '').replace(/@/g, '').trim().toLowerCase();
            return (postTgId && apTgId === postTgId) || (postCleanUname && apCleanUname === postCleanUname);
          });
          const totalLinksOnDate = userPostsOnDate.reduce((sum, ap) => sum + (Array.isArray(ap.links) ? ap.links.length : 0), 0);
          if (totalLinksOnDate >= 90) {
            stats[key].effectiveDates.add(postDate);
          }
        }
      });
    }

    const filteredRecruiters = Object.values(stats)
      .filter(rec => {
        const u = allUsers.find(user => 
          (rec.telegramId && String(user.telegramId) === rec.telegramId) || 
          (user.username && rec.username && user.username.replace(/@/g, '').toLowerCase() === rec.username.replace(/@/g, '').toLowerCase())
        );
        if (u && (u.role === 'Admin' || u.role === 'Owner')) {
          return false;
        }
        // Jika belum ada data rekrutan (count === 0) dan belum ada postingan, belum masuk leaderboard
        return rec.count > 0 || rec.effectiveDates.size > 0;
      })
      .map(rec => {
