const fs = require('fs');
let content = fs.readFileSync('src/pages/DataHarianPage.tsx', 'utf8');
content = content.replace("import gifshot from 'gifshot';\n", "");
fs.writeFileSync('src/pages/DataHarianPage.tsx', content);
