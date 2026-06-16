const fs = require('fs');
const path = require('path');
const dir = path.join(__dirname, 'migrations');
const files = fs.readdirSync(dir).filter(f => f.endsWith('.sql'));

const UUID_DEFAULT = "TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))),2) || '-' || substr('89ab',abs(random()) % 4 + 1, 1) || substr(lower(hex(randomblob(2))),2) || '-' || lower(hex(randomblob(6))))";

for (const f of files) {
  let p = path.join(dir, f);
  let content = fs.readFileSync(p, 'utf8');

  content = content.replace(/\bUUID PRIMARY KEY DEFAULT gen_random_uuid\(\)/gi, UUID_DEFAULT);
  content = content.replace(/\bUUID\b/g, 'TEXT');
  content = content.replace(/\bJSONB\b/g, 'TEXT');
  content = content.replace(/\bTIMESTAMPTZ\b/g, 'TEXT');
  content = content.replace(/\bVARCHAR\(\d+\)\b/g, 'TEXT');
  content = content.replace(/\bDEFAULT NOW\(\)/gi, 'DEFAULT CURRENT_TIMESTAMP');
  content = content.replace(/\bTEXT\[\]\b/g, 'TEXT');

  // Also replace JSON empty default
  content = content.replace(/\bDEFAULT '\{\}'::jsonb/gi, "DEFAULT '{}'");

  fs.writeFileSync(p, content);
}
console.log('Processed ' + files.length + ' migration files.');
