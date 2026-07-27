const fs = require('fs');
let code = fs.readFileSync('src/pages/DashboardPage.tsx', 'utf8');

const t1 = "    if (allReports.length) {";
const t2 = "    const filteredRecruiters = Object.values(stats)";

const startIndex = code.indexOf(t1);
const endIndex = code.indexOf(t2);

if (startIndex !== -1 && endIndex !== -1) {
  const replacement = `    if (allReports.length || allPosts.length) {
      const dailyStats: Record<string, Record<string, {
        applicants: number;
        quality: number;
        visits: number;
        accT0: number;
        accV0: number;
        fines: number;
        channels: Record<string, number>;
        isDetailed: boolean;
      }>> = {};

      allReports.forEach(r => {
        const reportDate = r.date || (r.createdAt ? r.createdAt.split('T')[0] : '');
        if (!reportDate) return;
        const reportMonday = getWIBMondayOfDate(reportDate);
        if (reportMonday !== targetMondayStr) return;

        const reportTgId = r.telegramId ? String(r.telegramId) : '';
        const reportCleanUname = (r.recruiterUsername || r.username || '').replace(/@/g, '').trim().toLowerCase();

        const matchedUser = allUsers.find(u => 
          (reportTgId && String(u.telegramId) === reportTgId) ||
          (reportCleanUname && u.username && u.username.replace(/@/g, '').trim().toLowerCase() === reportCleanUname)
        );

        if (matchedUser && (matchedUser.role === 'Admin' || matchedUser.role === 'Owner')) {
          return;
        }

        let key = reportTgId;
        if (matchedUser) {
          key = String(matchedUser.telegramId) || matchedUser.username.replace(/@/g, '').trim().toLowerCase();
        } else {
          key = reportTgId || reportCleanUname || 'Unknown';
        }
        
        if (!stats[key]) {
          stats[key] = {
            telegramId: reportTgId || (matchedUser ? String(matchedUser.telegramId) : ''),
            name: r.name || (matchedUser ? \`\${matchedUser.firstName} \${matchedUser.lastName || ''}\`.trim() : 'Recruiter'),
            username: r.recruiterUsername || r.username || matchedUser?.username || '',
            points: 0, count: 0, applicantCount: 0, qualityCount: 0, visitCount: 0, accT0Count: 0, accV0Count: 0, effectiveDaysCount: 0,
            effectiveDates: new Set<string>(), fineTotal: 0, photo: matchedUser?.photoUrl || '', channels: {}
          };
        }

        if (!dailyStats[key]) dailyStats[key] = {};
        if (!dailyStats[key][reportDate]) {
          dailyStats[key][reportDate] = { applicants: 0, quality: 0, visits: 0, accT0: 0, accV0: 0, fines: 0, channels: {}, isDetailed: false };
        }

        const isDetailed = !!(r.applicantWhatsapp || r.uid9Kucing || r.applicantTelegramUsername);
        if (isDetailed) {
          dailyStats[key][reportDate].isDetailed = true;
          // Kirim Data (ALL results) count as applicants
          dailyStats[key][reportDate].applicants += 1;
          
          if (r.result === 'ACC') {
            dailyStats[key][reportDate].quality += 1;
            if (r.grup === 'T0' || r.grup === 'T3') dailyStats[key][reportDate].accT0 += 1;
            else if (r.grup === 'V0') dailyStats[key][reportDate].accV0 += 1;
            
            if (r.channel && r.channel.trim()) {
              const ch = r.channel.trim();
              dailyStats[key][reportDate].channels[ch] = (dailyStats[key][reportDate].channels[ch] || 0) + 1;
            }
          }
        } else {
          // Laporan Harian (Summary)
          // We only use summary numbers if detailed data wasn't provided for this day
          if (!dailyStats[key][reportDate].isDetailed) {
            dailyStats[key][reportDate].applicants = Math.max(dailyStats[key][reportDate].applicants, Number(r.applicant) || 0);
            dailyStats[key][reportDate].quality = Math.max(dailyStats[key][reportDate].quality, Number(r.quality) || 0);
          }
          // Add visits and fines from summary
          dailyStats[key][reportDate].visits += (Number(r.visit) || 0);
          const fineVal = r.fine !== undefined ? r.fine : (r.isLate ? 5000 : 0);
          dailyStats[key][reportDate].fines += fineVal;
        }
      });
      
      // Process daily aggregations
      Object.keys(dailyStats).forEach(key => {
        Object.keys(dailyStats[key]).forEach(date => {
          const ds = dailyStats[key][date];
          stats[key].count += 1;
          stats[key].applicantCount += ds.applicants;
          stats[key].qualityCount += ds.quality;
          stats[key].visitCount += ds.visits;
          stats[key].accT0Count += ds.accT0;
          stats[key].accV0Count += ds.accV0;
          stats[key].fineTotal += ds.fines;
          
          Object.keys(ds.channels).forEach(ch => {
            stats[key].channels[ch] = (stats[key].channels[ch] || 0) + ds.channels[ch];
            overallChannels[ch] = (overallChannels[ch] || 0) + ds.channels[ch];
          });
          
          stats[key].points += (ds.applicants * 1) + (ds.quality * 3) + (ds.visits * 0.1);
          
          // Determine if effective day
          let requiredPosting = 90;
          if (ds.applicants >= 3) requiredPosting = 0;
          else if (ds.applicants === 2) requiredPosting = 30;
          else if (ds.applicants === 1) requiredPosting = 60;
          
          let postCount = 0;
          const userPostsOnDate = allPosts.filter(ap => {
            const apDate = ap.date || (ap.createdAt ? ap.createdAt.split('T')[0] : '');
            if (apDate !== date) return false;
            const apTgId = ap.telegramId ? String(ap.telegramId) : '';
            const apCleanUname = (ap.username || '').replace(/@/g, '').trim().toLowerCase();
            const s = stats[key];
            return (s.telegramId && apTgId === s.telegramId) || (s.username && apCleanUname === s.username.replace(/@/g, '').toLowerCase());
          });
          postCount = userPostsOnDate.reduce((sum, ap) => sum + (Array.isArray(ap.links) ? ap.links.length : 0), 0);
          
          if (ds.applicants >= 3 || postCount >= requiredPosting) {
            stats[key].effectiveDates.add(date);
          }
        });
      });

      // Process users who ONLY posted links (no reports)
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

`;

  code = code.substring(0, startIndex) + replacement + code.substring(endIndex);
  fs.writeFileSync('src/pages/DashboardPage.tsx', code);
  console.log('Success replacing leaderboard logic!');
} else {
  console.log('Target not found!', startIndex, endIndex);
}
