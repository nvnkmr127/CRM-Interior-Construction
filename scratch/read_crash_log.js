const fs = require('fs');
const path = require('path');
const logPath = path.join(__dirname, '../server/server_crash_log.txt');
if (fs.existsSync(logPath)) {
  const content = fs.readFileSync(logPath, 'utf16le');
  console.log(content.slice(-4000)); // Print last 4000 chars
} else {
  console.log("File not found:", logPath);
}
