const fs = require('fs');
let code = fs.readFileSync('src/pages/DashboardPage.tsx', 'utf8');

const target = `        stats[key].count += 1;
        const applicant = Number(r.applicant) || 0;
        const quality = Number(r.quality) || 0;
        const visit = Number(r.visit) || 0;
        stats[key].applicantCount += applicant;
        stats[key].qualityCount += quality;
        stats[key].visitCount += visit;`;

const replacement = `        stats[key].count += 1;
        
        const isDetailed = !!(r.applicantWhatsapp || r.uid9Kucing || r.applicantTelegramUsername);
        const groupKey = \`\${key}_\${reportDate}\`;
        const hasDetailed = detailedGroups.has(groupKey);

        let applicant = 0;
        let quality = 0;
        const visit = Number(r.visit) || 0;

        if (isDetailed) {
          applicant = 1;
          if (r.result === 'ACC') quality = 1;
        } else {
          if (!hasDetailed) {
            applicant = Number(r.applicant) || 0;
            quality = Number(r.quality) || 0;
          }
        }
        
        stats[key].applicantCount += applicant;
        stats[key].qualityCount += quality;
        stats[key].visitCount += visit;`;

if (code.includes(target)) {
  code = code.replace(target, replacement);
  fs.writeFileSync('src/pages/DashboardPage.tsx', code);
  console.log('Success!');
} else {
  console.log('Target not found!');
}
