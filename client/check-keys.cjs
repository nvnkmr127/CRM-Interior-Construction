const fs = require('fs');
let code = fs.readFileSync('d:/Digicloudify softwares/CRM-Interior-Construction/client/src/pages/analytics/LeadAnalyticsPage.jsx', 'utf8');
const lines = code.split('\n');
lines.forEach((line, index) => {
  if (line.includes('key="goal_tracking"')) console.log(`goal_tracking line ${index + 1}`);
  if (line.includes('key="benchmark_analytics"')) console.log(`benchmark_analytics line ${index + 1}`);
  if (line.includes('key="lead_kpis"')) console.log(`lead_kpis line ${index + 1}`);
});
