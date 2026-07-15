const fs = require('fs');
let code = fs.readFileSync('d:/Digicloudify softwares/CRM-Interior-Construction/client/src/pages/analytics/LeadAnalyticsPage.jsx', 'utf8');
const lines = code.split('\n');

const keys = {};

lines.forEach((line, index) => {
  const match = line.match(/<div key="([^"]+)">/);
  if (match) {
    const key = match[1];
    if (!keys[key]) keys[key] = [];
    keys[key].push(index + 1);
  }
});

for (const [key, locs] of Object.entries(keys)) {
  if (locs.length > 1) {
    console.log(`Duplicate key "${key}" at lines: ${locs.join(', ')}`);
  }
}
