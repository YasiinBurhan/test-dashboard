import fs from 'fs';
let code = fs.readFileSync('server.ts', 'utf8');

const webhookHandlerMatch = code.match(/\/\*\*\n \* TELEGRAM WEBHOOK HANDLER[\s\S]*?\n\}\);\n/);
if (!webhookHandlerMatch) {
  console.log("Could not find webhook handler");
  process.exit(1);
}

const webhookCode = webhookHandlerMatch[0];
code = code.replace(webhookCode, '');

const dbLine = "const serverDb = new RestFirestoreClient();";
code = code.replace(dbLine, dbLine + "\n\n" + webhookCode);

fs.writeFileSync('server.ts', code);
console.log("Fixed successfully.");
