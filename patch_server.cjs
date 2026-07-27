const fs = require('fs');

let server = fs.readFileSync('server.ts', 'utf8');

server = server.replace(
  "const ext = mimeType.includes('quicktime') || mimeType.includes('mov') ? 'mov' : 'mp4';",
  "let ext = 'mp4';\n            if (mimeType.includes('quicktime') || mimeType.includes('mov')) ext = 'mov';\n            else if (mimeType.includes('gif')) ext = 'gif';"
);

server = server.replace(
  "console.log(`[Compression] Running ffmpeg compression (converting to silent animation)...`);",
  "if (ext !== 'gif') {\n                console.log(`[Compression] Running ffmpeg compression (converting to silent animation)...`);"
);

server = server.replace(
  "fileNameToSend = `laporan_${report?.reportId || Date.now()}.mp4`;\n              }",
  "fileNameToSend = `laporan_${report?.reportId || Date.now()}.mp4`;\n              }\n              }"
);

fs.writeFileSync('server.ts', server);
