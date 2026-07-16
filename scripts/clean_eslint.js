const fs = require('fs');
const path = require('path');

const reportPath = path.join(__dirname, 'eslint_report.json');
if (!fs.existsSync(reportPath)) {
  console.error("No report found");
  process.exit(1);
}

const reportRaw = fs.readFileSync(reportPath);
const isUTF16LE = reportRaw[0] === 0xff && reportRaw[1] === 0xfe;
const reportText = reportRaw.toString(isUTF16LE ? 'utf16le' : 'utf8');
const report = JSON.parse(reportText.replace(/^\uFEFF/, ''));

let fixCount = 0;

for (const fileResult of report) {
  const messages = fileResult.messages.filter(m => m.ruleId === 'no-useless-escape');
  if (messages.length === 0) continue;

  let fileContent = fs.readFileSync(fileResult.filePath, 'utf8');
  let lines = fileContent.split('\n');

  // Sort messages in reverse order so line/column modifications don't affect previous ones
  messages.sort((a, b) => {
    if (a.line !== b.line) return b.line - a.line;
    return b.column - a.column;
  });

  for (const msg of messages) {
    const lineIdx = msg.line - 1;
    const colIdx = msg.column - 1;
    
    const line = lines[lineIdx];
    if (line && line[colIdx] === '\\') {
      lines[lineIdx] = line.slice(0, colIdx) + line.slice(colIdx + 1);
      fixCount++;
    }
  }

  fs.writeFileSync(fileResult.filePath, lines.join('\n'), 'utf8');
}

console.log(`Fixed ${fixCount} no-useless-escape errors.`);
