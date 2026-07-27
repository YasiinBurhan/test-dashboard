const fs = require('fs');
let code = fs.readFileSync('src/pages/DashboardPage.tsx', 'utf8');

const t1 = "        stats[key].count += 1;";
const t2 = "        const applicant = Number(r.applicant) || 0;";
const t3 = "        const quality = Number(r.quality) || 0;";
const t4 = "        const visit = Number(r.visit) || 0;";

const startIndex = code.indexOf(t1);
const endIndex = code.indexOf(t4) + t4.length;

if (startIndex !== -1 && endIndex !== -1) {
  const replacement = `        stats[key].count += 1;
        
        const isDetailed = !!(r.applicantWhatsapp || r.uid9Kucing || r.applicantTelegramUsername);
        const groupKey = \`\${key}_\${reportDate}\`;
        const hasDetailed = detailedGroups.has(groupKey);

        let applicant = 0;
        let quality = 0;
        const visit = Number(r.visit) || 0;`;

  code = code.substring(0, startIndex) + replacement + code.substring(endIndex);
  fs.writeFileSync('src/pages/DashboardPage.tsx', code);
  console.log('Success chunking!');
} else {
  console.log('Target not found!', startIndex, endIndex);
}
