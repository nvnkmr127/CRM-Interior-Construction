const fs = require('fs');
let code = fs.readFileSync('d:/Digicloudify softwares/CRM-Interior-Construction/client/src/pages/analytics/LeadAnalyticsPage.jsx', 'utf8');

// The file might use \r\n or \n
const lines = code.split(/\r?\n/);

let newLines = [];
let insideDuplicateBlock = false;
let foundExecutive = 0;

for (let i = 0; i < lines.length; i++) {
  const line = lines[i];
  
  if (line.includes('key="goal_tracking"')) {
    // If we've already seen goal_tracking, skip
    if (newLines.some(l => l.includes('key="goal_tracking"'))) {
      insideDuplicateBlock = true;
    }
  }

  if (insideDuplicateBlock) {
    if (line.includes('key="project_outcomes"')) {
      insideDuplicateBlock = false;
      newLines.push(line);
    }
    continue;
  }
  
  newLines.push(line);
}

fs.writeFileSync('d:/Digicloudify softwares/CRM-Interior-Construction/client/src/pages/analytics/LeadAnalyticsPage.jsx', newLines.join('\n'));
console.log('Duplicates removed.');
