const fs = require('fs');
const path = require('path');

const files = ['error_log.txt', 'crash_log.txt', 'sse_log.txt'];
for (const file of files) {
  const logPath = path.join(__dirname, '..', 'server', file);
  if (fs.existsSync(logPath)) {
    const stats = fs.statSync(logPath);
    console.log(`--- ${file} (modified: ${stats.mtime}) ---`);
    const content = fs.readFileSync(logPath, 'utf8');
    console.log(content.slice(-2000));
  } else {
    console.log('File does not exist:', logPath);
  }
}
