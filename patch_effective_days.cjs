const fs = require('fs');
let code = fs.readFileSync('src/pages/DashboardPage.tsx', 'utf8');

const t1 = "  // Helper to check if a report meets target (1 Effective Day)";
const t2 = "  const totalFines = useMemo(() => {";

const startIndex = code.indexOf(t1);
const endIndex = code.indexOf(t2);

if (startIndex !== -1 && endIndex !== -1) {
  const replacement = `  // Calculation of effective days this week
  const totalEffectiveDays = useMemo(() => {
    // Aggregate data per day
    const dailyStats: Record<string, { applicants: number }> = {};
    const effectiveDates = new Set<string>();

    selectedWeekReports.forEach(r => {
      const rDate = r.date || (r.createdAt ? r.createdAt.split('T')[0] : '');
      if (!rDate) return;
      
      if (!dailyStats[rDate]) {
        dailyStats[rDate] = { applicants: 0 };
      }
      
      const isDetailed = !!(r.applicantWhatsapp || r.uid9Kucing || r.applicantTelegramUsername);
      if (isDetailed) {
        dailyStats[rDate].applicants += 1;
      } else {
        // Summary
        dailyStats[rDate].applicants = Math.max(dailyStats[rDate].applicants, Number(r.applicant) || 0);
      }
    });

    Object.keys(dailyStats).forEach(date => {
      const applicants = dailyStats[date].applicants;
      
      let requiredPosting = 90;
      if (applicants >= 3) requiredPosting = 0;
      else if (applicants === 2) requiredPosting = 30;
      else if (applicants === 1) requiredPosting = 60;
      
      const postsOnDate = postsToUse.filter(p => {
        const pDate = p.date || (p.createdAt ? p.createdAt.split('T')[0] : '');
        return pDate === date;
      });
      const postCount = postsOnDate.reduce((sum, p) => sum + (Array.isArray(p.links) ? p.links.length : 0), 0);
      
      if (applicants >= 3 || postCount >= requiredPosting) {
        effectiveDates.add(date);
      }
    });
    
    // Also check posts collection for days with 0 applicants but 90+ posts
    postsToUse.forEach(p => {
      const pDate = p.date || (p.createdAt ? p.createdAt.split('T')[0] : '');
      if (!pDate) return;
      const postMonday = getWIBMondayOfDate(pDate);
      if (postMonday !== targetMondayStr) return;
      
      const postsOnDate = postsToUse.filter(ap => {
        const apDate = ap.date || (ap.createdAt ? ap.createdAt.split('T')[0] : '');
        return apDate === pDate;
      });
      const postCount = postsOnDate.reduce((sum, ap) => sum + (Array.isArray(ap.links) ? ap.links.length : 0), 0);
      
      if (postCount >= 90) {
        effectiveDates.add(pDate);
      }
    });

    return effectiveDates.size;
  }, [selectedWeekReports, postsToUse, targetMondayStr]);

`;
  
  code = code.substring(0, startIndex) + replacement + code.substring(endIndex);
  fs.writeFileSync('src/pages/DashboardPage.tsx', code);
  console.log('Success replacing totalEffectiveDays logic!');
} else {
  console.log('Target not found!', startIndex, endIndex);
}
