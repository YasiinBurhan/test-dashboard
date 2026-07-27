const fs = require('fs');
let content = fs.readFileSync('src/pages/DataHarianPage.tsx', 'utf8');

content = content.replace(
  "Data harian wajib diinput sebelum pukul <strong className=\"text-slate-900 dark:text-slate-200\">23:59 WIB</strong> setiap hari. Sistem akan melakukan reset kumulatif otomatis pada pukul 00:00 WIB.</p>",
  "Data harian wajib diinput sebelum pukul <strong className=\"text-slate-900 dark:text-slate-200\">10:00 WIB</strong> keesokan harinya. Sistem akan melakukan pergantian hari laporan otomatis pada pukul 10:00 WIB.</p>"
);

fs.writeFileSync('src/pages/DataHarianPage.tsx', content);
