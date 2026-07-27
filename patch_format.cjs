const fs = require('fs');

let format = fs.readFileSync('src/utils/format.ts', 'utf8');

format = format.replace(
  "export function getWIBDate(): string {\n  const now = new Date();\n  const jakartaTime = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Jakarta' }));\n  \n  const year = jakartaTime.getFullYear();\n  const month = String(jakartaTime.getMonth() + 1).padStart(2, '0');\n  const day = String(jakartaTime.getDate()).padStart(2, '0');\n  return `${year}-${month}-${day}`;\n}",
  "export function getWIBDate(): string {\n  const now = new Date();\n  const jakartaTime = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Jakarta' }));\n  jakartaTime.setHours(jakartaTime.getHours() - 10);\n  const year = jakartaTime.getFullYear();\n  const month = String(jakartaTime.getMonth() + 1).padStart(2, '0');\n  const day = String(jakartaTime.getDate()).padStart(2, '0');\n  return `${year}-${month}-${day}`;\n}"
);

format = format.replace(
  "export function getWIBMonday(offsetDays: number = 0): string {\n  const now = new Date();\n  const jakartaStr = now.toLocaleString('en-US', { timeZone: 'Asia/Jakarta' });\n  const d = new Date(jakartaStr);\n  \n  const day = d.getDay(); // 0 (Sun) to 6 (Sat)",
  "export function getWIBMonday(offsetDays: number = 0): string {\n  const now = new Date();\n  const jakartaStr = now.toLocaleString('en-US', { timeZone: 'Asia/Jakarta' });\n  const d = new Date(jakartaStr);\n  d.setHours(d.getHours() - 10);\n  const day = d.getDay(); // 0 (Sun) to 6 (Sat)"
);

fs.writeFileSync('src/utils/format.ts', format);
